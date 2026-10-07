import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { buildAppPath } from '@/common/utils/app-url';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import {
  PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE,
  PUBLIC_APPROVAL_TOKEN_MAX_MS,
  buildDijitalOnayWhatsAppMessage,
  claimFileReportGrandTotal,
  evaluatePublicApprovalToken,
  isMaliMesuliyetLokasyon,
  maliMesuliyetAlanToplami,
  maliMesuliyetDaireNoOk,
  MALI_MESULIYET_MUVAFAKAT_BEKLIYOR,
  MALI_MESULIYET_MUVAFAKAT_RED,
  MALI_MESULIYET_MUVAFAKAT_VERILDI,
  publicApprovalTokenErrorMessage,
} from '@sigorta/shared';

@Injectable()
export class MaliMesuliyetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listForClaim(claimFileId: string) {
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        fileNo: true,
        insuredName: true,
        insuredPhone: true,
        customer: { select: { phone: true, fullName: true } },
      },
    });
    if (!claim) throw new NotFoundException('Hasar dosyası bulunamadı');

    const tespipler = await this.prisma.maliMesuliyetTespit.findMany({
      where: { claimFileId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const mainItems = await this.prisma.repairReportItem.findMany({
      where: {
        report: { claimFileId },
        maliMesuliyetTespitId: null,
      },
    });

    const areas = tespipler.map((row) => {
      const totals = maliMesuliyetAlanToplami(row.items);
      return { ...row, alanSatis: totals.sales, alanMaliyet: totals.cost };
    });
    const neighborItems = tespipler.flatMap((row) => row.items);
    const grand = claimFileReportGrandTotal({
      mainReportItems: mainItems,
      neighborItems,
    });
    const muvafakat = await this.prisma.maliMesuliyetMuvafakat.findUnique({
      where: { claimFileId },
    });
    return {
      tespipler: areas,
      genelToplam: grand,
      muvafakat: muvafakat
        ? {
            status: muvafakat.status,
            digitallyApprovedAt: muvafakat.digitallyApprovedAt,
            approvedFullName: muvafakat.approvedFullName,
            rejectedAt: muvafakat.rejectedAt,
            rejectReason: muvafakat.rejectReason,
            whatsappSentAt: muvafakat.whatsappSentAt,
            suggestedPhone: muvafakat.whatsappPhone || claim.insuredPhone || claim.customer?.phone || '',
          }
        : {
            status: MALI_MESULIYET_MUVAFAKAT_BEKLIYOR,
            suggestedPhone: claim.insuredPhone || claim.customer?.phone || '',
          },
      fileNo: claim.fileNo,
      insuredName: claim.insuredName || claim.customer?.fullName || '',
    };
  }

  async createTespit(
    claimFileId: string,
    dto: { lokasyon: string; daireNo?: string | number; findingsText?: string },
  ) {
    await this.assertClaim(claimFileId);
    if (!isMaliMesuliyetLokasyon(dto.lokasyon)) {
      throw new BadRequestException('Lokasyon Yan Daire, Alt Kat, Üst Kat veya Ortak Alan olmalıdır.');
    }
    if (!maliMesuliyetDaireNoOk(dto.lokasyon, dto.daireNo)) {
      throw new BadRequestException('Daire No girin.');
    }
    const count = await this.prisma.maliMesuliyetTespit.count({ where: { claimFileId } });
    return this.prisma.maliMesuliyetTespit.create({
      data: {
        claimFileId,
        lokasyon: dto.lokasyon,
        daireNo: String(dto.daireNo ?? '').trim(),
        findingsText: dto.findingsText?.trim() || null,
        sortOrder: count,
      },
      include: { items: true },
    });
  }

  async addKalem(
    tespitId: string,
    dto: {
      jobDescription: string;
      quantity?: number;
      unit?: string;
      salesUnitPrice?: number;
      supplierUnitPrice?: number;
    },
  ) {
    const tespit = await this.prisma.maliMesuliyetTespit.findUnique({ where: { id: tespitId } });
    if (!tespit) throw new NotFoundException('Mali mesuliyet alanı bulunamadı');
    const jobDescription = String(dto.jobDescription ?? '').trim();
    if (!jobDescription) throw new BadRequestException('İş kalemi yazın.');
    const quantity = Number(dto.quantity ?? 1);
    const salesUnitPrice = Number(dto.salesUnitPrice ?? 0);
    const supplierUnitPrice = Number(dto.supplierUnitPrice ?? 0);
    return this.prisma.maliMesuliyetIsKalemi.create({
      data: {
        tespitId,
        jobDescription,
        quantity,
        unit: dto.unit?.trim() || 'adet',
        salesUnitPrice,
        supplierUnitPrice,
        salesTotal: quantity * salesUnitPrice,
        supplierTotal: quantity * supplierUnitPrice,
      },
    });
  }

  async issuePublicLink(claimFileId: string, createdByUserId?: string) {
    await this.assertClaim(claimFileId);
    const existing = await this.prisma.maliMesuliyetMuvafakat.findUnique({
      where: { claimFileId },
    });
    if (existing && this.tokenGate(existing).ok && existing.publicToken) {
      return {
        ...existing,
        publicUrl: this.publicUrl(existing.publicToken),
      };
    }
    if (existing && !this.tokenGate(existing).ok && this.isConsumed(existing)) {
      throw new BadRequestException(PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE);
    }
    const publicToken = randomUUID();
    const publicTokenExpiresAt = new Date(Date.now() + PUBLIC_APPROVAL_TOKEN_MAX_MS);
    const row = existing
      ? await this.prisma.maliMesuliyetMuvafakat.update({
          where: { id: existing.id },
          data: { publicToken, publicTokenExpiresAt, createdByUserId: createdByUserId ?? existing.createdByUserId },
        })
      : await this.prisma.maliMesuliyetMuvafakat.create({
          data: {
            claimFileId,
            status: MALI_MESULIYET_MUVAFAKAT_BEKLIYOR,
            publicToken,
            publicTokenExpiresAt,
            createdByUserId: createdByUserId ?? null,
          },
        });
    return { ...row, publicUrl: this.publicUrl(publicToken) };
  }

  async sendWhatsapp(claimFileId: string, phoneRaw: string, createdByUserId?: string) {
    const issued = await this.issuePublicLink(claimFileId, createdByUserId);
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        fileNo: true,
        insuredName: true,
        insuredPhone: true,
        customer: { select: { fullName: true, phone: true } },
        assignedOfficeUser: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    const phone =
      String(phoneRaw ?? '').trim()
      || issued.whatsappPhone
      || claim?.insuredPhone
      || claim?.customer?.phone
      || '';
    if (!phone) throw new BadRequestException('Sigortalı telefon numarası bulunamadı');
    const owner = claim?.assignedOfficeUser;
    const message = buildDijitalOnayWhatsAppMessage({
      kind: 'mali_mesuliyet',
      insuredName: claim?.insuredName || claim?.customer?.fullName,
      fileNo: claim?.fileNo,
      approvalUrl: issued.publicUrl,
      ownerName: `${owner?.firstName ?? ''} ${owner?.lastName ?? ''}`.trim(),
      ownerPhone: owner?.phone,
    });
    const waUrl = buildWhatsAppMeUrl(phone, message);
    if (!waUrl) throw new BadRequestException('Geçerli bir WhatsApp telefon numarası giriniz');
    await this.prisma.maliMesuliyetMuvafakat.update({
      where: { id: issued.id },
      data: { whatsappSentAt: new Date(), whatsappPhone: phone },
    });
    return { waUrl, link: issued.publicUrl, message, phone };
  }

  async approveForClaim(claimFileId: string, fullName: string, ip?: string) {
    const issued = await this.issuePublicLink(claimFileId);
    return this.approveRecord(issued, fullName, ip);
  }

  async rejectForClaim(claimFileId: string, reason: string, ip?: string) {
    const issued = await this.issuePublicLink(claimFileId);
    return this.rejectRecord(issued, reason, ip);
  }

  async findByToken(token: string) {
    const row = await this.loadByToken(token);
    const gate = this.tokenGate(row);
    if (!gate.ok) {
      throw new BadRequestException(
        gate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(gate.reason, 'evrak'),
      );
    }
    const listed = await this.listForClaim(row.claimFileId);
    return {
      status: row.status,
      fileNo: listed.fileNo,
      insuredName: listed.insuredName,
      tespipler: listed.tespipler,
      genelToplam: listed.genelToplam,
    };
  }

  async approveByToken(token: string, fullName: string, ip?: string) {
    const row = await this.loadByToken(token);
    return this.approveRecord(row, fullName, ip);
  }

  async rejectByToken(token: string, reason: string, ip?: string) {
    const row = await this.loadByToken(token);
    return this.rejectRecord(row, reason, ip);
  }

  private async approveRecord(
    row: { id: string; status: string; digitallyApprovedAt: Date | null; publicTokenExpiresAt: Date | null; createdAt: Date },
    fullName: string,
    ip?: string,
  ) {
    const gate = this.tokenGate(row);
    if (!gate.ok) {
      throw new BadRequestException(
        gate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(gate.reason, 'evrak'),
      );
    }
    const name = String(fullName ?? '').trim();
    if (!name) throw new BadRequestException('Ad Soyad yazın.');
    const approvedAt = new Date();
    return this.prisma.maliMesuliyetMuvafakat.update({
      where: { id: row.id },
      data: {
        status: MALI_MESULIYET_MUVAFAKAT_VERILDI,
        digitallyApprovedAt: approvedAt,
        approvedFullName: name,
        approvedIp: ip ?? null,
      },
    });
  }

  private async rejectRecord(
    row: { id: string; status: string; digitallyApprovedAt: Date | null; publicTokenExpiresAt: Date | null; createdAt: Date },
    reason: string,
    _ip?: string,
  ) {
    const gate = this.tokenGate(row);
    if (!gate.ok) {
      throw new BadRequestException(
        gate.reason === 'closed'
          ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE
          : publicApprovalTokenErrorMessage(gate.reason, 'evrak'),
      );
    }
    return this.prisma.maliMesuliyetMuvafakat.update({
      where: { id: row.id },
      data: {
        status: MALI_MESULIYET_MUVAFAKAT_RED,
        rejectedAt: new Date(),
        rejectReason: String(reason ?? '').trim() || null,
      },
    });
  }

  private tokenGate(row: {
    status?: string | null;
    digitallyApprovedAt?: Date | string | null;
    publicTokenExpiresAt?: Date | string | null;
    createdAt?: Date | string | null;
  }) {
    return evaluatePublicApprovalToken(row);
  }

  private isConsumed(row: { status?: string | null; digitallyApprovedAt?: Date | string | null }) {
    const gate = evaluatePublicApprovalToken(row);
    return !gate.ok && gate.reason === 'closed';
  }

  private publicUrl(token: string) {
    return buildAppPath(this.config, `/evrak/mali-mesuliyet/${token}`);
  }

  private async loadByToken(token: string) {
    const row = await this.prisma.maliMesuliyetMuvafakat.findUnique({
      where: { publicToken: token },
    });
    if (!row) throw new NotFoundException('Evrak bulunamadı');
    return row;
  }

  private async assertClaim(claimFileId: string) {
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!claim) throw new NotFoundException('Hasar dosyası bulunamadı');
  }
}
