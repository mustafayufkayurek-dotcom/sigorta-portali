import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/** Migration yok — rapor bağını notes alanında taşır (UI'da gösterilmez). */
export const REPAIR_REPORT_BUDGET_NOTE_PREFIX = 'repairReportId:';

export function buildRepairReportBudgetNote(reportId: string): string {
  return `${REPAIR_REPORT_BUDGET_NOTE_PREFIX}${reportId}`;
}

export function parseRepairReportIdFromBudgetNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes.split('\n').map((s) => s.trim()).find((s) => s.startsWith(REPAIR_REPORT_BUDGET_NOTE_PREFIX));
  if (!line) return null;
  const id = line.slice(REPAIR_REPORT_BUDGET_NOTE_PREFIX.length).trim();
  return id || null;
}

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  // ── Versiyon Yönetimi ───────────────────────────────────────────────────────

  async getVersions(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    return this.prisma.budgetVersion.findMany({
      where: { claimFileId },
      include: {
        items: { include: { vendor: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { versionNo: 'desc' },
    });
  }

  /**
   * Onarım raporu özelinde bütçe sürümü — yoksa oluşturur.
   * Bağ: notes = repairReportId:<uuid>
   */
  async getOrCreateForRepairReport(claimFileId: string, reportId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      select: { id: true, claimFileId: true, reportNo: true },
    });
    if (!report || report.claimFileId !== claimFileId) {
      throw new NotFoundException('Onarım raporu bu dosyada bulunamadı');
    }

    const noteMarker = buildRepairReportBudgetNote(reportId);
    const existing = await this.prisma.budgetVersion.findFirst({
      where: {
        claimFileId,
        notes: { startsWith: noteMarker },
      },
      include: {
        items: { include: { vendor: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { versionNo: 'desc' },
    });
    if (existing) {
      return {
        ...existing,
        repairReportId: reportId,
        reportNo: report.reportNo,
      };
    }

    const created = await this.createVersion(claimFileId, { notes: noteMarker });
    return {
      ...created,
      repairReportId: reportId,
      reportNo: report.reportNo,
      items: created?.items ?? [],
    };
  }

  /** Dosya tedarikçileri + iş grupları — rapor içi bütçe formu için */
  async getSupplierWorkGroupContext(claimFileId: string) {
    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        supplierAssignments: {
          orderBy: { sortOrder: 'asc' },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                paymentDueDays: true,
                vendorWorkGroups: {
                  include: { workGroup: { select: { id: true, name: true, code: true } } },
                },
              },
            },
          },
        },
        assignedSupplier: {
          select: {
            id: true,
            name: true,
            paymentDueDays: true,
            vendorWorkGroups: {
              include: { workGroup: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const byId = new Map<string, {
      id: string;
      name: string;
      paymentDueDays: number | null;
      workGroups: { id: string; name: string; code: string }[];
    }>();

    const pushVendor = (vendor: {
      id: string;
      name: string;
      paymentDueDays?: number | null;
      vendorWorkGroups?: { workGroup: { id: string; name: string; code: string } }[];
    } | null | undefined) => {
      if (!vendor?.id) return;
      const workGroups = (vendor.vendorWorkGroups ?? []).map((vw) => ({
        id: vw.workGroup.id,
        name: vw.workGroup.name,
        code: vw.workGroup.code,
      }));
      const prev = byId.get(vendor.id);
      if (!prev) {
        byId.set(vendor.id, {
          id: vendor.id,
          name: vendor.name,
          paymentDueDays: vendor.paymentDueDays ?? null,
          workGroups,
        });
        return;
      }
      const seen = new Set(prev.workGroups.map((g) => g.id));
      for (const g of workGroups) {
        if (!seen.has(g.id)) prev.workGroups.push(g);
      }
      if (prev.paymentDueDays == null && vendor.paymentDueDays != null) {
        prev.paymentDueDays = vendor.paymentDueDays;
      }
    };

    for (const link of claimFile.supplierAssignments) {
      pushVendor(link.vendor);
    }
    pushVendor(claimFile.assignedSupplier);

    // Tedarikçide iş grubu yoksa aktif katalogdan sun (seçim boş kalmasın)
    const catalogGroups = await this.prisma.workGroup.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

    const suppliers = Array.from(byId.values()).map((s) => ({
      ...s,
      workGroups: s.workGroups.length > 0 ? s.workGroups : catalogGroups,
    }));

    return { suppliers, catalogWorkGroups: catalogGroups };
  }

  async createVersion(claimFileId: string, dto: { notes?: string; copyFromVersionId?: string }) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    const lastVersion = await this.prisma.budgetVersion.findFirst({
      where: { claimFileId },
      orderBy: { versionNo: 'desc' },
    });
    const versionNo = (lastVersion?.versionNo ?? 0) + 1;

    const newVersion = await this.prisma.budgetVersion.create({
      data: { claimFileId, versionNo, notes: dto.notes },
    });

    // Önceki versiyondan kopyala
    if (dto.copyFromVersionId) {
      const sourceItems = await this.prisma.budgetItem.findMany({
        where: { budgetVersionId: dto.copyFromVersionId },
      });
      if (sourceItems.length > 0) {
        await this.prisma.budgetItem.createMany({
          data: sourceItems.map((item) => ({
            budgetVersionId: newVersion.id,
            vendorId: item.vendorId,
            category: item.category,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            totalAmount: item.totalAmount,
          })),
        });
        const totalAmount = sourceItems.reduce((s, i) => s + i.totalAmount, 0);
        await this.prisma.budgetVersion.update({ where: { id: newVersion.id }, data: { totalAmount } });
      }
    }

    return this.prisma.budgetVersion.findUnique({
      where: { id: newVersion.id },
      include: { items: true },
    });
  }

  async updateVersion(versionId: string, dto: { notes?: string }) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Bütçe versiyonu bulunamadı');
    if (!['draft', 'revision'].includes(version.status)) {
      throw new BadRequestException('Bu durumdaki versiyon düzenlenemez');
    }
    return this.prisma.budgetVersion.update({ where: { id: versionId }, data: { notes: dto.notes } });
  }

  async submitVersion(versionId: string) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Bütçe versiyonu bulunamadı');
    if (!['draft', 'revision'].includes(version.status)) {
      throw new BadRequestException('Bu versiyon zaten sunulmuş');
    }
    return this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: { status: 'submitted', submittedAt: new Date() },
    });
  }

  async reviewVersion(versionId: string, dto: { status: 'approved' | 'rejected' | 'revision'; notes?: string }) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Bütçe versiyonu bulunamadı');
    if (version.status !== 'submitted') {
      throw new BadRequestException('Sadece sunulmuş versiyonlar değerlendirilebilir');
    }
    const updated = await this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        status: dto.status,
        notes: dto.notes ?? version.notes,
        approvedAt: dto.status === 'approved' ? new Date() : undefined,
      },
    });

    if (dto.status === 'approved') {
      const withItems = await this.prisma.budgetVersion.findUnique({
        where: { id: versionId },
        select: { totalAmount: true, claimFileId: true },
      });
      if (withItems) {
        await this.prisma.claimFile.update({
          where: { id: withItems.claimFileId },
          data: { approvedBudgetAmount: withItems.totalAmount },
        });
      }
    }

    return updated;
  }

  async compareVersions(id1: string, id2: string) {
    const [v1, v2] = await Promise.all([
      this.prisma.budgetVersion.findUnique({ where: { id: id1 }, include: { items: { include: { vendor: true } } } }),
      this.prisma.budgetVersion.findUnique({ where: { id: id2 }, include: { items: { include: { vendor: true } } } }),
    ]);
    if (!v1 || !v2) throw new NotFoundException('Versiyon bulunamadı');
    return { v1, v2, diff: { totalAmount: v2.totalAmount - v1.totalAmount } };
  }

  // ── Kalem Yönetimi ─────────────────────────────────────────────────────────

  async addItem(versionId: string, dto: {
    vendorId?: string;
    category: string;
    description: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    /** İş grubu adı — category'ye yazılır (migration yok) */
    workGroupName?: string;
  }) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Bütçe versiyonu bulunamadı');
    if (!['draft', 'revision'].includes(version.status)) {
      throw new BadRequestException('Bu versiyona kalem eklenemez');
    }
    if (!dto.vendorId) {
      throw new BadRequestException('Dosya tedarikçisi seçiniz');
    }
    if (!dto.description?.trim()) {
      throw new BadRequestException('Açıklama zorunludur');
    }

    const vatRate = dto.vatRate ?? 18;
    const totalAmount = dto.quantity * dto.unitPrice * (1 + vatRate / 100);
    const category = (dto.workGroupName?.trim() || dto.category || 'labor').slice(0, 120);

    const item = await this.prisma.budgetItem.create({
      data: {
        budgetVersionId: versionId,
        vendorId: dto.vendorId,
        category,
        description: dto.description.trim(),
        unit: dto.unit,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        vatRate,
        totalAmount,
      },
      include: { vendor: true },
    });

    await this.recalculateVersionTotal(versionId);
    return item;
  }

  async updateItem(itemId: string, dto: Partial<{
    vendorId: string;
    category: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Bütçe kalemi bulunamadı');

    const quantity = dto.quantity ?? item.quantity;
    const unitPrice = dto.unitPrice ?? item.unitPrice;
    const vatRate = dto.vatRate ?? item.vatRate;
    const totalAmount = quantity * unitPrice * (1 + vatRate / 100);

    const updated = await this.prisma.budgetItem.update({
      where: { id: itemId },
      data: { ...dto, totalAmount },
      include: { vendor: true },
    });

    await this.recalculateVersionTotal(item.budgetVersionId);
    return updated;
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Bütçe kalemi bulunamadı');
    await this.prisma.budgetItem.delete({ where: { id: itemId } });
    await this.recalculateVersionTotal(item.budgetVersionId);
    return { message: 'Kalem silindi' };
  }

  private async recalculateVersionTotal(versionId: string) {
    const items = await this.prisma.budgetItem.findMany({ where: { budgetVersionId: versionId } });
    const totalAmount = items.reduce((s, i) => s + i.totalAmount, 0);
    await this.prisma.budgetVersion.update({ where: { id: versionId }, data: { totalAmount } });
  }

  // ── Gerçekleşen Maliyet ─────────────────────────────────────────────────────

  async getCostEntries(claimFileId: string) {
    return this.prisma.costEntry.findMany({
      where: { claimFileId },
      include: {
        vendor: true,
        expenseCategory: { include: { parent: true } },
      },
      orderBy: { entryDate: 'desc' },
    });
  }

  async addCostEntry(claimFileId: string, dto: {
    vendorId?: string;
    category: string;
    expenseCategoryId?: string;
    description: string;
    amount: number;
    vatRate?: number;
    invoiceNo?: string;
    entryDate: string;
  }) {
    const claimFile = await this.prisma.claimFile.findUnique({ where: { id: claimFileId } });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    return this.prisma.costEntry.create({
      data: {
        claimFileId,
        vendorId: dto.vendorId,
        category: dto.category,
        expenseCategoryId: dto.expenseCategoryId ?? null,
        description: dto.description,
        amount: dto.amount,
        vatRate: dto.vatRate ?? 18,
        invoiceNo: dto.invoiceNo,
        entryDate: new Date(dto.entryDate),
      },
      include: {
        vendor: true,
        expenseCategory: { include: { parent: true } },
      },
    });
  }

  async updateCostEntry(id: string, dto: any) {
    const entry = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Maliyet kalemi bulunamadı');
    return this.prisma.costEntry.update({
      where: { id },
      data: { ...dto, entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined },
      include: {
        vendor: true,
        expenseCategory: { include: { parent: true } },
      },
    });
  }

  async removeCostEntry(id: string) {
    const entry = await this.prisma.costEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Maliyet kalemi bulunamadı');
    await this.prisma.costEntry.delete({ where: { id } });
    return { message: 'Maliyet kalemi silindi' };
  }
}
