import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { overlayClaimStatusProductName } from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateClaimStatusDto } from './dto/create-claim-status.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Injectable()
export class ClaimStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.claimStatus.findMany({
      orderBy: [{ sequenceNo: 'asc' }, { name: 'asc' }],
    });

    return { data: data.map((row) => overlayClaimStatusProductName(row)) };
  }

  async findOne(id: string) {
    const claimStatus = await this.prisma.claimStatus.findUnique({
      where: { id },
    });

    if (!claimStatus) {
      throw new NotFoundException('Hasar durumu bulunamadı');
    }

    return overlayClaimStatusProductName(claimStatus);
  }

  async create(dto: CreateClaimStatusDto) {
    await this.ensureCodeUnique(dto.code);

    return this.prisma.claimStatus.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateClaimStatusDto) {
    await this.findOne(id);

    if (dto.code) {
      await this.ensureCodeUnique(dto.code, id);
    }

    return this.prisma.claimStatus.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const linkedClaimFiles = await this.prisma.claimFile.count({
      where: { currentStatusId: id },
    });

    if (linkedClaimFiles > 0) {
      throw new ConflictException(
        `Bu duruma bağlı ${linkedClaimFiles} hasar dosyası mevcut. Önce ilişkili kayıtları güncellemelisiniz.`,
      );
    }

    await this.prisma.claimStatus.delete({
      where: { id },
    });

    return { message: 'Hasar durumu silindi' };
  }

  private async ensureCodeUnique(code: string, id?: string) {
    const existing = await this.prisma.claimStatus.findFirst({
      where: {
        code,
        ...(id ? { NOT: { id } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Bu kod ile bir hasar durumu zaten mevcut');
    }
  }
}