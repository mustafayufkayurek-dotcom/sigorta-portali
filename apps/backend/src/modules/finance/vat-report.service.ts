import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toGrossAmount, toNetAmount } from './overhead.constants';

/** Fatura mahsupu | yalnız satış | yalnız alış | operasyonel | karşılaştırma */
export type VatReportMethod =
  | 'invoice_settlement'
  | 'invoice_sales'
  | 'invoice_purchase'
  | 'operational'
  | 'compare';

export type VatLineSource =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'expense'
  | 'overhead'
  | 'cost_entry'
  | 'revenue';

export interface VatReportLine {
  id: string;
  source: VatLineSource;
  date: string;
  description: string | null;
  category: string;
  group: string;
  fileNo: string | null;
  documentNo: string | null;
  counterparty: string | null;
  status: string | null;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  direction: 'input' | 'output';
}

export interface VatSettlementSummary {
  outputNet: number;
  outputVat: number;
  outputGross: number;
  outputCount: number;
  inputNet: number;
  inputVat: number;
  inputGross: number;
  inputCount: number;
  netVatPayable: number;
  netVatCredit: number;
}

export interface VatRateBucket {
  vatRate: number;
  inputNet: number;
  inputVat: number;
  inputGross: number;
  outputNet: number;
  outputVat: number;
  outputGross: number;
  lineCount: number;
}

export interface VatReportSection {
  summary: VatSettlementSummary;
  byVatRate: VatRateBucket[];
  byCategory: Array<{
    category: string;
    group: string;
    direction: 'input' | 'output';
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    lineCount: number;
  }>;
  lines: VatReportLine[];
}

export interface VatReportResult {
  period: {
    year: number;
    month: number | null;
    label: string;
    from: string;
    to: string;
  };
  method: VatReportMethod;
  methodology: {
    title: string;
    description: string;
    formula: string;
  };
  /** Seçilen yönteme göre ana özet */
  summary: VatSettlementSummary;
  byVatRate: VatRateBucket[];
  byCategory: VatReportSection['byCategory'];
  lines: VatReportLine[];
  /** Fatura mahsupu (satış + alış) */
  invoiceSection: VatReportSection & {
    salesLines: VatReportLine[];
    purchaseLines: VatReportLine[];
  };
  /** Masraf fişi / sabit gider vb. */
  operationalSection: VatReportSection;
  compare?: {
    invoiceNetPayable: number;
    operationalNetPayable: number;
    difference: number;
    note: string;
  };
  notes: string[];
}

const EXPENSE_GROUP_LABEL: Record<string, string> = {
  YONETIM_GIDERLERI: 'Yönetim Giderleri',
  OPERASYON_GIDERLERI: 'Operasyon Giderleri',
  MHY_OZEL_GIDERLER: 'MHY Özel Giderler',
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  partial: 'Kısmi',
  cancelled: 'İptal',
  overdue: 'Vadesi Geçti',
};

const COUNTED_INVOICE_STATUSES = ['sent', 'paid', 'partial', 'overdue'];

const METHOD_META: Record<VatReportMethod, { title: string; description: string; formula: string }> = {
  invoice_settlement: {
    title: 'Fatura Mahsupu (Resmi)',
    description:
      'Satış faturalarından hesaplanan KDV ile alış/gider faturalarından indirilecek KDV mahsup edilir. Mali müşavir beyanı için önerilen yöntem.',
    formula: 'Devlete Ödenecek KDV = Hesaplanan KDV (satış) − İndirilecek KDV (alış)',
  },
  invoice_sales: {
    title: 'Satış Faturaları',
    description: 'Yalnızca kestiğiniz satış faturaları — devlete borçlandığınız hesaplanan KDV.',
    formula: 'Hesaplanan KDV = Σ satış faturası KDV tutarları',
  },
  invoice_purchase: {
    title: 'Alış / Gider Faturaları',
    description: 'Yalnızca aldığınız alış ve gider faturaları — indirilecek KDV.',
    formula: 'İndirilecek KDV = Σ alış faturası KDV tutarları',
  },
  operational: {
    title: 'Operasyonel Fişler',
    description: 'Masraf izleme, sabit giderler ve dosya maliyetlerinden türetilen KDV. Fatura kesilmeden önce operasyonel kontrol için.',
    formula: 'Tahmini mahsup = operasyonel gelir KDV − operasyonel gider KDV',
  },
  compare: {
    title: 'Karşılaştırma',
    description: 'Fatura mahsupu ile operasyonel kayıtları yan yana gösterir; fark mali müşavir ile mutabakatta kullanılır.',
    formula: 'Fark = Fatura mahsupu − Operasyonel tahmin',
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function inferVatRate(net: number, vat: number): number {
  if (net <= 0) return vat > 0 ? 20 : 0;
  const rate = (vat / net) * 100;
  const common = [1, 10, 18, 20];
  const nearest = common.reduce((best, r) =>
    Math.abs(r - rate) < Math.abs(best - rate) ? r : best,
  );
  return Math.abs(nearest - rate) <= 1.5 ? nearest : round2(rate);
}

function splitFromStoredAmount(
  amount: number,
  vatRate: number,
  vatIncluded: boolean,
): { net: number; vat: number; gross: number } {
  const net = toNetAmount(amount, vatRate, vatIncluded);
  const gross = vatIncluded ? amount : toGrossAmount(amount, vatRate);
  return { net: round2(net), vat: round2(gross - net), gross: round2(gross) };
}

function splitFromNet(
  net: number,
  vatRate: number,
  grossAmount?: number | null,
): { net: number; vat: number; gross: number } {
  const gross = grossAmount != null ? grossAmount : toGrossAmount(net, vatRate);
  return { net: round2(net), vat: round2(gross - net), gross: round2(gross) };
}

function buildSummary(lines: VatReportLine[]): VatSettlementSummary {
  const output = lines.filter((l) => l.direction === 'output');
  const input = lines.filter((l) => l.direction === 'input');
  const outputVat = round2(output.reduce((s, l) => s + l.vatAmount, 0));
  const inputVat = round2(input.reduce((s, l) => s + l.vatAmount, 0));
  const net = round2(outputVat - inputVat);
  return {
    outputNet: round2(output.reduce((s, l) => s + l.netAmount, 0)),
    outputVat,
    outputGross: round2(output.reduce((s, l) => s + l.grossAmount, 0)),
    outputCount: output.length,
    inputNet: round2(input.reduce((s, l) => s + l.netAmount, 0)),
    inputVat,
    inputGross: round2(input.reduce((s, l) => s + l.grossAmount, 0)),
    inputCount: input.length,
    netVatPayable: net > 0 ? net : 0,
    netVatCredit: net < 0 ? round2(Math.abs(net)) : 0,
  };
}

function aggregateSection(lines: VatReportLine[]): Omit<VatReportSection, 'lines'> & { lines: VatReportLine[] } {
  const summary = buildSummary(lines);

  const rateMap = new Map<number, VatRateBucket>();
  for (const line of lines) {
    const bucket = rateMap.get(line.vatRate) ?? {
      vatRate: line.vatRate,
      inputNet: 0,
      inputVat: 0,
      inputGross: 0,
      outputNet: 0,
      outputVat: 0,
      outputGross: 0,
      lineCount: 0,
    };
    if (line.direction === 'input') {
      bucket.inputNet += line.netAmount;
      bucket.inputVat += line.vatAmount;
      bucket.inputGross += line.grossAmount;
    } else {
      bucket.outputNet += line.netAmount;
      bucket.outputVat += line.vatAmount;
      bucket.outputGross += line.grossAmount;
    }
    bucket.lineCount += 1;
    rateMap.set(line.vatRate, bucket);
  }

  const byVatRate = [...rateMap.values()]
    .map((b) => ({
      ...b,
      inputNet: round2(b.inputNet),
      inputVat: round2(b.inputVat),
      inputGross: round2(b.inputGross),
      outputNet: round2(b.outputNet),
      outputVat: round2(b.outputVat),
      outputGross: round2(b.outputGross),
    }))
    .sort((a, b) => b.vatRate - a.vatRate);

  const catMap = new Map<string, VatReportSection['byCategory'][number]>();
  for (const line of lines) {
    const key = `${line.direction}|${line.group}|${line.category}`;
    const cur = catMap.get(key) ?? {
      category: line.category,
      group: line.group,
      direction: line.direction,
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      lineCount: 0,
    };
    cur.netAmount += line.netAmount;
    cur.vatAmount += line.vatAmount;
    cur.grossAmount += line.grossAmount;
    cur.lineCount += 1;
    catMap.set(key, cur);
  }

  const byCategory = [...catMap.values()]
    .map((c) => ({
      ...c,
      netAmount: round2(c.netAmount),
      vatAmount: round2(c.vatAmount),
      grossAmount: round2(c.grossAmount),
    }))
    .sort((a, b) => b.vatAmount - a.vatAmount);

  return { summary, byVatRate, byCategory, lines };
}

@Injectable()
export class VatReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(year: number, month?: number, method: VatReportMethod = 'invoice_settlement'): Promise<VatReportResult> {
    const from = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const to = month ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);

    const monthLabel = month
      ? new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
      : `${year} — Yıllık`;

    const invoiceLines = await this.collectInvoiceLines(from, to);
    const salesLines = invoiceLines.filter((l) => l.source === 'sales_invoice');
    const purchaseLines = invoiceLines.filter((l) => l.source === 'purchase_invoice');

    const invoiceAgg = aggregateSection(invoiceLines);
    const operationalLines = await this.collectOperationalLines(from, to, year, month);
    const operationalAgg = aggregateSection(operationalLines);

    const invoiceSection = {
      ...invoiceAgg,
      salesLines,
      purchaseLines,
    };

    const notes: string[] = [
      'Fatura mahsupunda yalnızca taslak ve iptal dışındaki faturalar (gönderildi, ödendi, kısmi, vadesi geçmiş) dahil edilir.',
      'Operasyonel kayıtlar fiş ve masraf girişlerinden türetilir; resmi beyan için fatura mahsupu esas alınmalıdır.',
      'Net KDV pozisyonu bilgilendirme amaçlıdır — beyanname için mali müşavirin onayı gerekir.',
    ];

    let summary: VatSettlementSummary;
    let lines: VatReportLine[];
    let byVatRate: VatRateBucket[];
    let byCategory: VatReportSection['byCategory'];

    switch (method) {
      case 'invoice_sales':
        summary = buildSummary(salesLines);
        lines = salesLines;
        byVatRate = aggregateSection(salesLines).byVatRate;
        byCategory = aggregateSection(salesLines).byCategory;
        break;
      case 'invoice_purchase':
        summary = buildSummary(purchaseLines);
        lines = purchaseLines;
        byVatRate = aggregateSection(purchaseLines).byVatRate;
        byCategory = aggregateSection(purchaseLines).byCategory;
        break;
      case 'operational':
        summary = operationalAgg.summary;
        lines = operationalLines;
        byVatRate = operationalAgg.byVatRate;
        byCategory = operationalAgg.byCategory;
        break;
      case 'compare':
        summary = invoiceAgg.summary;
        lines = invoiceLines;
        byVatRate = invoiceAgg.byVatRate;
        byCategory = invoiceAgg.byCategory;
        break;
      case 'invoice_settlement':
      default:
        summary = invoiceAgg.summary;
        lines = invoiceLines;
        byVatRate = invoiceAgg.byVatRate;
        byCategory = invoiceAgg.byCategory;
        break;
    }

    const result: VatReportResult = {
      period: { year, month: month ?? null, label: monthLabel, from: from.toISOString(), to: to.toISOString() },
      method,
      methodology: METHOD_META[method] ?? METHOD_META.invoice_settlement,
      summary,
      byVatRate,
      byCategory,
      lines,
      invoiceSection,
      operationalSection: operationalAgg,
      notes,
    };

    if (method === 'compare') {
      const invNet = invoiceAgg.summary.netVatPayable - invoiceAgg.summary.netVatCredit;
      const opNet = operationalAgg.summary.netVatPayable - operationalAgg.summary.netVatCredit;
      result.compare = {
        invoiceNetPayable: round2(invNet),
        operationalNetPayable: round2(opNet),
        difference: round2(invNet - opNet),
        note:
          Math.abs(invNet - opNet) < 1
            ? 'Fatura ve operasyonel kayıtlar uyumlu görünüyor.'
            : 'Fark var: faturalaşmamış fişler, taslak faturalar veya çift kayıt olabilir — mali müşavir ile kontrol edin.',
      };
    }

    return result;
  }

  private async collectInvoiceLines(from: Date, to: Date): Promise<VatReportLine[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: from, lte: to },
        status: { in: COUNTED_INVOICE_STATUSES },
      },
      include: { claimFile: { select: { fileNo: true } } },
      orderBy: { invoiceDate: 'asc' },
    });

    return invoices.map((inv) => {
      const net = round2(inv.subtotalAmount);
      const vat = round2(inv.vatAmount);
      const gross = round2(inv.totalAmount || net + vat);
      const isSales = inv.invoiceType === 'sales';
      return {
        id: inv.id,
        source: isSales ? 'sales_invoice' : 'purchase_invoice',
        date: inv.invoiceDate.toISOString(),
        description: inv.notes ?? (isSales ? 'Satış faturası' : 'Alış / gider faturası'),
        category: isSales ? 'Satış Faturası' : 'Alış Faturası',
        group: isSales ? 'Gelir Faturaları' : 'Gider Faturaları',
        fileNo: inv.claimFile?.fileNo ?? null,
        documentNo: inv.invoiceNo,
        counterparty: inv.counterpartyType,
        status: INVOICE_STATUS_LABEL[inv.status] ?? inv.status,
        netAmount: net,
        vatRate: inferVatRate(net, vat),
        vatAmount: vat,
        grossAmount: gross,
        direction: isSales ? 'output' : 'input',
      } as VatReportLine;
    });
  }

  private async collectOperationalLines(
    from: Date,
    to: Date,
    year: number,
    month?: number,
  ): Promise<VatReportLine[]> {
    const lines: VatReportLine[] = [];

    const expenses = await this.prisma.expense.findMany({
      where: {
        date: { gte: from, lte: to },
        approvalStatus: { not: 'REJECTED' },
      },
      include: {
        expenseCategory: { select: { name: true } },
        fileCase: { select: { fileNo: true } },
      },
      orderBy: { date: 'asc' },
    });

    for (const e of expenses) {
      const { net, vat, gross } = splitFromStoredAmount(Number(e.amount), e.vatRate, e.vatIncluded);
      lines.push({
        id: e.id,
        source: 'expense',
        date: e.date.toISOString(),
        description: e.description,
        category: e.expenseCategory?.name ?? e.expenseSubgroup,
        group: EXPENSE_GROUP_LABEL[e.expenseGroup] ?? e.expenseGroup,
        fileNo: e.isOverheadPool ? null : e.fileCase?.fileNo ?? null,
        documentNo: null,
        counterparty: null,
        status: e.approvalStatus,
        netAmount: net,
        vatRate: e.vatRate,
        vatAmount: vat,
        grossAmount: gross,
        direction: 'input',
      });
    }

    const overheadEntries = await this.prisma.monthlyOverheadEntry.findMany({
      where: {
        year,
        ...(month ? { month } : {}),
        source: { not: 'expense_pool' },
      },
      include: { expenseCategory: { select: { name: true } } },
      orderBy: [{ month: 'asc' }, { createdAt: 'asc' }],
    });

    for (const o of overheadEntries) {
      const { net, vat, gross } = splitFromNet(o.amount, o.vatRate, o.grossAmount);
      lines.push({
        id: o.id,
        source: 'overhead',
        date: new Date(o.year, o.month - 1, 15).toISOString(),
        description: o.description ?? `Sabit gider — ${o.year}/${String(o.month).padStart(2, '0')}`,
        category: o.expenseCategory?.name ?? 'Sabit Gider',
        group: 'Sabit Giderler',
        fileNo: null,
        documentNo: null,
        counterparty: null,
        status: o.isAllocated ? 'Dağıtıldı' : 'Bekliyor',
        netAmount: net,
        vatRate: o.vatRate,
        vatAmount: vat,
        grossAmount: gross,
        direction: 'input',
      });
    }

    const costEntries = await this.prisma.costEntry.findMany({
      where: {
        entryDate: { gte: from, lte: to },
        source: { not: 'overhead_allocation' },
      },
      include: {
        expenseCategory: { select: { name: true } },
        claimFile: { select: { fileNo: true } },
      },
      orderBy: { entryDate: 'asc' },
    });

    for (const c of costEntries) {
      const { net, vat, gross } = splitFromStoredAmount(c.amount, c.vatRate, false);
      lines.push({
        id: c.id,
        source: 'cost_entry',
        date: c.entryDate.toISOString(),
        description: c.description,
        category: c.expenseCategory?.name ?? c.category,
        group: c.isOverhead ? 'Sabit Gider Payı' : 'Dosya Maliyeti',
        fileNo: c.claimFile?.fileNo ?? null,
        documentNo: c.invoiceNo,
        counterparty: null,
        status: null,
        netAmount: net,
        vatRate: c.vatRate,
        vatAmount: vat,
        grossAmount: gross,
        direction: 'input',
      });
    }

    const revenues = await this.prisma.claimFileRevenue.findMany({
      where: {
        entryDate: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
      include: { claimFile: { select: { fileNo: true } } },
      orderBy: { entryDate: 'asc' },
    });

    for (const r of revenues) {
      const net = round2(r.amount);
      const vat = round2(r.vatAmount);
      const gross = round2(r.totalAmount || net + vat);
      lines.push({
        id: r.id,
        source: 'revenue',
        date: r.entryDate.toISOString(),
        description: r.description,
        category: r.revenueType === 'extra_work' ? 'Ek İş Geliri' : 'Dosya Ücreti',
        group: 'Operasyonel Gelir',
        fileNo: r.claimFile?.fileNo ?? null,
        documentNo: null,
        counterparty: r.collectionSource,
        status: r.status,
        netAmount: net,
        vatRate: r.vatRate,
        vatAmount: vat,
        grossAmount: gross,
        direction: 'output',
      });
    }

    lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return lines;
  }
}
