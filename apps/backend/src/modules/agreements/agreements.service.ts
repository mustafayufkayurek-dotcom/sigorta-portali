import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { renderAgreementTemplate } from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { CreateAgreementDto, UpdateAgreementDto, AcceptAgreementDto } from './dto/agreements.dto';
import { resolveUserId } from '@/common/utils/resolve-user-id';
import { hashAgreementContent } from './agreement-content-hash';
import { companyInfoToAgreementVars } from './agreement-company-vars';
import { userRequiresAgreementConsent, agreementTypesForRole } from './agreement-audience.constants';

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  private async resolveRenderedContent(rawContent: string): Promise<string> {
    const company = await this.systemSettings.getCompanyInfo();
    const vars = companyInfoToAgreementVars(company);
    return renderAgreementTemplate(rawContent, vars);
  }

  private async withRenderedContent<T extends { content: string }>(agreement: T): Promise<T> {
    return {
      ...agreement,
      content: await this.resolveRenderedContent(agreement.content),
    };
  }

  async userRequiresAgreements(userId: string): Promise<boolean> {
    const normalizedUserId = resolveUserId({ id: userId });
    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: { role: { select: { code: true } } },
    });
    return userRequiresAgreementConsent(user?.role?.code);
  }

  private async activeAgreementsForUser(userId: string) {
    const normalizedUserId = resolveUserId({ id: userId });
    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: { role: { select: { code: true } } },
    });
    const allowedTypes = agreementTypesForRole(user?.role?.code);
    if (allowedTypes && allowedTypes.length === 0) return [];
    return this.prisma.agreement.findMany({
      where: {
        isActive: true,
        ...(allowedTypes ? { type: { in: [...allowedTypes] } } : {}),
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAll() {
    return this.prisma.agreement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    const agreements = await this.prisma.agreement.findMany({
      where: { isActive: true },
      orderBy: { type: 'asc' },
    });
    return Promise.all(agreements.map((a) => this.withRenderedContent(a)));
  }

  async findOne(id: string, options?: { render?: boolean }) {
    const agreement = await this.prisma.agreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException('Sözleşme bulunamadı');
    if (options?.render === false) return agreement;
    return this.withRenderedContent(agreement);
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
    await this.findOne(id, { render: false });
    return this.prisma.agreement.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id, { render: false });
    await this.prisma.agreement.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Sözleşme pasifleştirildi' };
  }

  private async renderedContentHash(rawContent: string): Promise<string> {
    const rendered = await this.resolveRenderedContent(rawContent);
    return hashAgreementContent(rendered);
  }

  private isAcceptanceStale(
    agreement: { version: string; content: string },
    acceptance: {
      acceptedVersion: string | null;
      contentHash: string | null;
    } | undefined,
    currentHash: string,
  ): boolean {
    if (!acceptance) return true;
    if (!acceptance.contentHash || !acceptance.acceptedVersion) return true;
    return acceptance.acceptedVersion !== agreement.version || acceptance.contentHash !== currentHash;
  }

  async getPendingForUser(userId: string) {
    if (!(await this.userRequiresAgreements(userId))) return [];
    const normalizedUserId = resolveUserId({ id: userId });
    const activeAgreements = await this.activeAgreementsForUser(normalizedUserId);
    if (activeAgreements.length === 0) return [];

    const acceptances = await this.prisma.agreementAcceptance.findMany({
      where: { userId: normalizedUserId },
      select: {
        agreementId: true,
        acceptedVersion: true,
        contentHash: true,
      },
    });
    const acceptanceByAgreement = new Map(
      acceptances.map((row) => [row.agreementId, row]),
    );

    const pending: typeof activeAgreements = [];
    for (const agreement of activeAgreements) {
      const currentHash = await this.renderedContentHash(agreement.content);
      if (this.isAcceptanceStale(agreement, acceptanceByAgreement.get(agreement.id), currentHash)) {
        pending.push(agreement);
      }
    }
    return pending;
  }

  async accept(
    userId: string,
    dto: AcceptAgreementDto,
    ipAddress?: string | null,
    userAgent?: string | null,
    userEmail?: string | null,
  ) {
    const normalizedUserId = resolveUserId({ id: userId });
    const agreement = await this.findOne(dto.agreementId, { render: false });
    const renderedContent = await this.resolveRenderedContent(agreement.content);
    const signature = dto.signature?.trim();

    if (!signature) {
      throw new BadRequestException('Dijital imza (ad soyad) zorunludur');
    }

    const contentHash = hashAgreementContent(renderedContent);
    const now = new Date();
    const scrolledAt = dto.scrolledAt ? new Date(dto.scrolledAt) : null;
    const checkboxConfirmedAt = dto.checkboxConfirmedAt
      ? new Date(dto.checkboxConfirmedAt)
      : now;

    const acceptanceData = {
      acceptedAt: now,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      signature,
      acceptedVersion: agreement.version,
      titleSnapshot: agreement.title,
      contentHash,
      contentSnapshot: renderedContent,
      scrolledAt,
      checkboxConfirmedAt,
    };

    const result = await this.prisma.agreementAcceptance.upsert({
      where: {
        userId_agreementId: { userId: normalizedUserId, agreementId: agreement.id },
      },
      create: {
        userId: normalizedUserId,
        agreementId: agreement.id,
        ...acceptanceData,
      },
      update: acceptanceData,
    });

    this.auditLogsService.log({
      entityType: 'agreement_acceptance',
      entityId: result.id,
      action: 'AGREEMENT_ACCEPTED',
      userId: normalizedUserId,
      userEmail,
      ipAddress,
      userAgent,
      newValue: {
        agreementId: agreement.id,
        agreementType: agreement.type,
        agreementTitle: agreement.title,
        acceptedVersion: agreement.version,
        contentHash,
        signature,
        acceptedAt: now.toISOString(),
        scrolledAt: scrolledAt?.toISOString() ?? null,
        checkboxConfirmedAt: checkboxConfirmedAt.toISOString(),
      },
    });

    return result;
  }

  async getUserAcceptances(userId: string) {
    return this.prisma.agreementAcceptance.findMany({
      where: { userId },
      include: { agreement: true },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  async getAcceptances(agreementId: string) {
    await this.findOne(agreementId, { render: false });
    return this.prisma.agreementAcceptance.findMany({
      where: { agreementId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  async hasUserAcceptedAll(userId: string): Promise<boolean> {
    if (!(await this.userRequiresAgreements(userId))) return true;
    const pending = await this.getPendingForUser(userId);
    return pending.length === 0;
  }
}
