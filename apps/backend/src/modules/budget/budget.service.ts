import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

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
    return this.prisma.budgetVersion.update({
      where: { id: versionId },
      data: {
        status: dto.status,
        notes: dto.notes ?? version.notes,
        approvedAt: dto.status === 'approved' ? new Date() : undefined,
      },
    });
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
  }) {
    const version = await this.prisma.budgetVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Bütçe versiyonu bulunamadı');
    if (!['draft', 'revision'].includes(version.status)) {
      throw new BadRequestException('Bu versiyona kalem eklenemez');
    }

    const vatRate = dto.vatRate ?? 18;
    const totalAmount = dto.quantity * dto.unitPrice * (1 + vatRate / 100);

    const item = await this.prisma.budgetItem.create({
      data: {
        budgetVersionId: versionId,
        vendorId: dto.vendorId,
        category: dto.category,
        description: dto.description,
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
