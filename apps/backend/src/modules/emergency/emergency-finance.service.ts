import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDraftDto } from './dto/create-invoice-draft.dto';

@Injectable()
export class EmergencyFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceList(filters: {
    month?: number;
    year?: number;
    customerId?: string;
    search?: string;
    invoiceStatus?: string; // 'invoiced' | 'pending' | 'overdue'
  }) {
    const where: any = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.search) {
      where.OR = [
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { caseNo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.year && filters.month) {
      const start = new Date(filters.year, filters.month - 1, 1);
      const end = new Date(filters.year, filters.month, 1);
      where.fileDate = { gte: start, lt: end };
    }

    const cases = await this.prisma.emergencyCase.findMany({
      where,
      include: {
        costEntries: true,
        invoiceItems: { include: { draft: { select: { id: true, draftNo: true, status: true } } } },
      },
      orderBy: [{ fileDate: 'desc' }, { createdAt: 'desc' }],
    });

    const now = Date.now();
    const enriched = cases.map((c) => {
      const totalGelir = c.costEntries.filter((e) => e.entryType === 'gelir').reduce((s, e) => s + e.amount, 0);
      const totalGider = c.costEntries.filter((e) => e.entryType === 'gider').reduce((s, e) => s + e.amount, 0);
      const netKar = totalGelir - totalGider;
      const isFaturalandildi = c.status === 'FATURALANDILDI' || !!c.invoicedAt;
      let overdueLevel: 'none' | 'warning' | 'critical' = 'none';
      if (!isFaturalandildi && c.resolvedAt) {
        const days = Math.floor((now - new Date(c.resolvedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 15) overdueLevel = 'critical';
        else if (days >= 7) overdueLevel = 'warning';
      }
      const invoiceDraft = c.invoiceItems[0]?.draft ?? null;
      return {
        id: c.id,
        caseNo: c.caseNo,
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        address: c.address,
        issueType: c.issueType,
        urgency: c.urgency,
        status: c.status,
        fileDate: c.fileDate,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        invoicedAt: c.invoicedAt,
        totalGelir,
        totalGider,
        netKar,
        overdueLevel,
        invoiceDraft,
        isFaturalandildi,
      };
    });

    // Fatura durumu filtresi
    const filtered = filters.invoiceStatus
      ? enriched.filter((c) => {
          if (filters.invoiceStatus === 'invoiced') return c.isFaturalandildi;
          if (filters.invoiceStatus === 'pending') return !c.isFaturalandildi && c.overdueLevel === 'none';
          if (filters.invoiceStatus === 'overdue') return c.overdueLevel !== 'none';
          return true;
        })
      : enriched;

    const summary = {
      totalCases: filtered.length,
      totalGelir: filtered.reduce((s, c) => s + c.totalGelir, 0),
      totalGider: filtered.reduce((s, c) => s + c.totalGider, 0),
      netKar: filtered.reduce((s, c) => s + c.netKar, 0),
    };

    return { data: filtered, summary };
  }

  async createInvoiceDraft(dto: CreateInvoiceDraftDto, userId: string) {
    // Seçilen vakaların gelirlerini topla
    const cases = await this.prisma.emergencyCase.findMany({
      where: { id: { in: dto.caseIds } },
      include: { costEntries: true },
    });

    if (cases.length === 0) {
      throw new NotFoundException('Seçilen vakalar bulunamadı');
    }

    const totalAmount = cases.reduce((sum, c) => {
      const gelir = c.costEntries
        .filter((e) => e.entryType === 'gelir')
        .reduce((s, e) => s + e.amount, 0);
      return sum + gelir;
    }, 0);

    // Sıradaki draft no
    const lastDraft = await this.prisma.emergencyInvoiceDraft.findFirst({
      orderBy: { draftNo: 'desc' },
    });
    const seq = lastDraft
      ? parseInt(lastDraft.draftNo.replace('EF-', ''), 10) + 1
      : 1;
    const draftNo = `EF-${String(seq).padStart(5, '0')}`;

    const draft = await this.prisma.emergencyInvoiceDraft.create({
      data: {
        draftNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        totalAmount,
        notes: dto.notes,
        createdByUserId: userId,
        items: {
          create: cases.map((c) => ({
            caseId: c.id,
            amount: c.costEntries
              .filter((e) => e.entryType === 'gelir')
              .reduce((s, e) => s + e.amount, 0),
            description: `${c.caseNo} — ${c.issueType}`,
          })),
        },
      },
      include: { items: { include: { case: true } } },
    });

    // Vakaları FATURALANDILDI olarak işaretle
    await this.prisma.emergencyCase.updateMany({
      where: { id: { in: dto.caseIds } },
      data: { status: 'FATURALANDILDI', invoicedAt: new Date() },
    });

    return { data: draft };
  }

  async findInvoiceDrafts(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    const drafts = await this.prisma.emergencyInvoiceDraft.findMany({
      where,
      include: {
        items: { include: { case: { select: { id: true, caseNo: true, issueType: true, address: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: drafts };
  }

  async findOneDraft(id: string) {
    const draft = await this.prisma.emergencyInvoiceDraft.findUnique({
      where: { id },
      include: {
        items: { include: { case: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!draft) throw new NotFoundException('Fatura taslağı bulunamadı');
    return { data: draft };
  }

  async approveDraft(id: string) {
    const draft = await this.prisma.emergencyInvoiceDraft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Fatura taslağı bulunamadı');
    const updated = await this.prisma.emergencyInvoiceDraft.update({
      where: { id },
      data: { status: 'approved' },
      include: { items: true },
    });
    return { data: updated };
  }

  async getMonthlySummary(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const cases = await this.prisma.emergencyCase.findMany({
      where: { fileDate: { gte: start, lt: end } },
      include: { costEntries: true },
    });
    const totalCases = cases.length;
    const totalGelir = cases.flatMap((c) => c.costEntries).filter((e) => e.entryType === 'gelir').reduce((s, e) => s + e.amount, 0);
    const totalGider = cases.flatMap((c) => c.costEntries).filter((e) => e.entryType === 'gider').reduce((s, e) => s + e.amount, 0);
    const faturalandirilan = cases.filter((c) => c.status === 'FATURALANDILDI').length;
    return {
      data: {
        year,
        month,
        totalCases,
        totalGelir,
        totalGider,
        netKar: totalGelir - totalGider,
        faturalandirilan,
        bekleyen: totalCases - faturalandirilan,
      },
    };
  }
}
