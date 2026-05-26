import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAgreementDto, UpdateAgreementDto, AcceptAgreementDto } from './dto/agreements.dto';

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.agreement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.agreement.findMany({
      where: { isActive: true },
      orderBy: { type: 'asc' },
    });
  }

  async findOne(id: string) {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Sözleşme bulunamadı');
    return agreement;
  }

  async create(dto: CreateAgreementDto) {
    return this.prisma.agreement.create({
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type,
        version: dto.version ?? '1.0',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateAgreementDto) {
    await this.findOne(id);
    return this.prisma.agreement.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agreement.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Sözleşme pasifleştirildi' };
  }

  // Kullanıcının onaylaması gereken aktif sözleşmeleri döndür
  async getPendingForUser(userId: string) {
    const activeAgreements = await this.prisma.agreement.findMany({
      where: { isActive: true },
    });

    const acceptedIds = await this.prisma.agreementAcceptance
      .findMany({ where: { userId }, select: { agreementId: true } })
      .then((rows: { agreementId: string }[]) => rows.map((r) => r.agreementId));

    return activeAgreements.filter((a) => !acceptedIds.includes(a.id));
  }

  // Onay kaydet
  async accept(
    userId: string,
    dto: AcceptAgreementDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const agreement = await this.findOne(dto.agreementId);

    return this.prisma.agreementAcceptance.upsert({
      where: { userId_agreementId: { userId, agreementId: agreement.id } },
      create: {
        userId,
        agreementId: agreement.id,
        ipAddress,
        userAgent,
        signature: dto.signature,
      },
      update: {
        acceptedAt: new Date(),
        ipAddress,
        userAgent,
        signature: dto.signature,
      },
    });
  }

  // Kullanıcının kabul ettiği sözleşmeler
  async getUserAcceptances(userId: string) {
    return this.prisma.agreementAcceptance.findMany({
      where: { userId },
      include: { agreement: true },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  // Sözleşmeyi kabul etmiş tüm kullanıcılar
  async getAcceptances(agreementId: string) {
    return this.prisma.agreementAcceptance.findMany({
      where: { agreementId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  // Kullanıcının tüm aktif sözleşmeleri onaylamış mı?
  async hasUserAcceptedAll(userId: string): Promise<boolean> {
    const pending = await this.getPendingForUser(userId);
    return pending.length === 0;
  }
}
