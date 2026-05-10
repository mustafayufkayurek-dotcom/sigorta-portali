import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-types.dto';

@Injectable()
export class DocumentTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { status?: string }) {
    const where: any = {};
    if (params?.status) where.status = params.status;

    const data = await this.prisma.documentType.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { vendorDocuments: true } },
      },
    });

    return { data };
  }

  async findOne(id: string) {
    const documentType = await this.prisma.documentType.findUnique({
      where: { id },
      include: {
        _count: { select: { vendorDocuments: true } },
      },
    });

    if (!documentType) {
      throw new NotFoundException('Evrak türü bulunamadı');
    }

    return documentType;
  }

  async create(dto: CreateDocumentTypeDto) {
    const existing = await this.prisma.documentType.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('Bu kod ile bir evrak türü zaten mevcut');
    }

    const nameConflict = await this.prisma.documentType.findFirst({
      where: { name: dto.name },
    });
    if (nameConflict) {
      throw new ConflictException('Bu isimde bir evrak türü zaten mevcut');
    }

    return this.prisma.documentType.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateDocumentTypeDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.documentType.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Bu kod ile başka bir evrak türü zaten mevcut');
      }
    }

    if (dto.name) {
      const nameConflict = await this.prisma.documentType.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (nameConflict) {
        throw new ConflictException('Bu isimde başka bir evrak türü zaten mevcut');
      }
    }

    return this.prisma.documentType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const docCount = await this.prisma.vendorDocument.count({
      where: { documentTypeId: id },
    });

    if (docCount > 0) {
      throw new ConflictException(
        `Bu evrak türüne bağlı ${docCount} evrak mevcut. Önce evrakları silmelisiniz.`,
      );
    }

    await this.prisma.documentType.delete({ where: { id } });
    return { message: 'Evrak türü silindi' };
  }
}
