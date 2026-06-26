import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAgreementDto, UpdateAgreementDto, AcceptAgreementDto } from './dto/agreements.dto';
import { resolveUserId } from '@/common/utils/resolve-user-id';

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
    const normalizedUserId = resolveUserId({ id: userId });
    const activeAgreements = await this.prisma.agreement.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });

    const acceptances = await this.prisma.agreementAcceptance.findMany({
      where: { userId: normalizedUserId },
      select: { agreementId: true, acceptedAt: true },
    });
    const acceptanceByAgreement = new Map(
      acceptances.map((row) => [row.agreementId, row.acceptedAt]),
    );

    return activeAgreements.filter((agreement) => {
      const acceptedAt = acceptanceByAgreement.get(agreement.id);
      if (!acceptedAt) return true;
      // Sözleşme içeriği/versiyonu güncellendiyse yeniden onay iste
      return acceptedAt < agreement.updatedAt;
    });
  }

  // Onay kaydet
  async accept(
    userId: string,
    dto: AcceptAgreementDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedUserId = resolveUserId({ id: userId });
    const agreement = await this.findOne(dto.agreementId);

    return this.prisma.agreementAcceptance.upsert({
      where: { userId_agreementId: { userId: normalizedUserId, agreementId: agreement.id } },
      create: {
        userId: normalizedUserId,
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
