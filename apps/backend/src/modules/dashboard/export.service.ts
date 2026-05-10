import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

@Injectable()
export class ExportService {
  constructor(private dashboardService: DashboardService) {}

  async export(
    reportType: string,
    format: 'xlsx' | 'pdf',
    filters: DashboardFiltersDto,
    res: Response,
  ) {
    const data = await this.fetchReportData(reportType, filters);
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `rapor-${reportType}-${dateStr}`;

    if (format === 'xlsx') {
      const buffer = await this.generateXlsx(reportType, data);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } else {
      const buffer = this.generateCsvPdf(reportType, data);
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    }
  }

  private async fetchReportData(reportType: string, filters: DashboardFiltersDto) {
    switch (reportType) {
      case 'file-performance':
        return this.dashboardService.getFilePerformanceReport(filters);
      case 'staff-performance':
        return this.dashboardService.getStaffPerformanceReport(filters);
      case 'financial-extended':
        return this.dashboardService.getFinancialExtendedReport(filters);
      case 'adjuster-extended':
        return this.dashboardService.getAdjusterExtendedReport(filters);
      case 'profitability':
        return this.dashboardService.getProfitabilityReport(filters);
      case 'collections':
        return this.dashboardService.getCollectionsReport(filters);
      default:
        return {};
    }
  }

  private async generateXlsx(reportType: string, data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sigorta Hasar Yönetimi';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
      alignment: { horizontal: 'center' },
    };

    switch (reportType) {
      case 'file-performance':
        this.buildFilePerformanceSheet(workbook, data, headerStyle);
        break;
      case 'staff-performance':
        this.buildStaffPerformanceSheet(workbook, data, headerStyle);
        break;
      case 'financial-extended':
      case 'profitability':
        this.buildFinancialSheet(workbook, data, headerStyle);
        break;
      case 'adjuster-extended':
        this.buildAdjusterSheet(workbook, data, headerStyle);
        break;
      default:
        this.buildGenericSheet(workbook, data, headerStyle);
    }

    return (await workbook.xlsx.writeBuffer() as unknown) as Buffer;
  }

  private addHeaders(sheet: ExcelJS.Worksheet, headers: string[], style: Partial<ExcelJS.Style>) {
    const row = sheet.addRow(headers);
    row.eachCell((cell) => Object.assign(cell, { style }));
    row.height = 20;
  }

  private buildFilePerformanceSheet(
    wb: ExcelJS.Workbook,
    data: any,
    hs: Partial<ExcelJS.Style>,
  ) {
    // Summary sheet
    const summary = wb.addWorksheet('Özet');
    this.addHeaders(summary, ['Metrik', 'Değer'], hs);
    summary.addRow(['Toplam Dosya', data.summary?.totalFiles ?? 0]);
    summary.addRow(['Açık Dosya', data.summary?.openFiles ?? 0]);
    summary.addRow(['Kapanan Dosya', data.summary?.closedFiles ?? 0]);
    summary.addRow(['Ort. Kapanış Süresi (gün)', data.summary?.avgCloseDays ?? 0]);
    summary.addRow(['Medyan Kapanış Süresi (gün)', data.summary?.medianCloseDays ?? 0]);
    summary.addRow(['Min Kapanış Süresi (gün)', data.summary?.minCloseDays ?? 0]);
    summary.addRow(['Max Kapanış Süresi (gün)', data.summary?.maxCloseDays ?? 0]);
    summary.columns = [{ width: 32 }, { width: 16 }];

    // Branch sheet
    const branchSheet = wb.addWorksheet('Branş Bazlı');
    this.addHeaders(branchSheet, ['Branş', 'Toplam', 'Kapanan', 'Ort. Kapanış (gün)'], hs);
    for (const b of data.byBranch ?? []) {
      branchSheet.addRow([b.name, b.count, b.closedCount, b.avgCloseDays]);
    }
    branchSheet.columns = [{ width: 24 }, { width: 12 }, { width: 12 }, { width: 22 }];

    // Insurance sheet
    const insSheet = wb.addWorksheet('Sigorta Şirketi Bazlı');
    this.addHeaders(insSheet, ['Sigorta Şirketi', 'Toplam', 'Açık', 'Kapanan'], hs);
    for (const ins of data.byInsuranceCompany ?? []) {
      insSheet.addRow([ins.name, ins.total, ins.open, ins.closed]);
    }
    insSheet.columns = [{ width: 32 }, { width: 10 }, { width: 10 }, { width: 10 }];

    // Monthly trend
    const trendSheet = wb.addWorksheet('Aylık Trend');
    this.addHeaders(trendSheet, ['Ay', 'Açılan', 'Kapanan'], hs);
    for (const t of data.monthlyTrend ?? []) {
      trendSheet.addRow([t.month, t.opened, t.closed]);
    }
    trendSheet.columns = [{ width: 12 }, { width: 10 }, { width: 10 }];
  }

  private buildStaffPerformanceSheet(
    wb: ExcelJS.Workbook,
    data: any,
    hs: Partial<ExcelJS.Style>,
  ) {
    const staffSheet = wb.addWorksheet('Personel');
    this.addHeaders(
      staffSheet,
      ['Ad Soyad', 'Tip', 'Toplam', 'Açık', 'Kapanan', 'SLA İhlali', 'Ort. Kapanış (gün)'],
      hs,
    );
    for (const u of data.staffUsers ?? []) {
      staffSheet.addRow([
        u.userName,
        u.userType,
        u.totalFiles,
        u.openFiles,
        u.closedFiles,
        u.slaViolations,
        u.avgCloseDays,
      ]);
    }
    staffSheet.columns = [
      { width: 24 }, { width: 10 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 12 }, { width: 22 },
    ];

    const vendorSheet = wb.addWorksheet('Tedarikçiler');
    this.addHeaders(vendorSheet, ['Tedarikçi', 'Atama', 'Tamamlanan', 'Tamamlama Oranı (%)'], hs);
    for (const v of data.vendorStats ?? []) {
      vendorSheet.addRow([v.vendorName, v.assignmentCount, v.completedCount, v.completionRate]);
    }
    vendorSheet.columns = [{ width: 28 }, { width: 10 }, { width: 14 }, { width: 22 }];
  }

  private buildFinancialSheet(wb: ExcelJS.Workbook, data: any, hs: Partial<ExcelJS.Style>) {
    // Profitability rows may come from getProfitabilityReport (array) or financial extended (object)
    const rows = Array.isArray(data) ? data : data.topProfitableFiles ?? [];

    const sheet = wb.addWorksheet('Kârlılık');
    this.addHeaders(
      sheet,
      ['Dosya No', 'Sigorta Şirketi', 'Fiili Gelir', 'Fiili Gider', 'Brüt Kâr', 'Kâr Marjı (%)'],
      hs,
    );
    for (const r of rows) {
      sheet.addRow([
        r.fileNo,
        r.insuranceCompany ?? '',
        r.actualRevenue,
        r.actualCost,
        r.grossProfit,
        typeof r.grossMarginPct === 'number' ? r.grossMarginPct.toFixed(2) : '',
      ]);
    }
    sheet.columns = [{ width: 14 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];

    if (data.monthlyTrend) {
      const trendSheet = wb.addWorksheet('Aylık Trend');
      this.addHeaders(trendSheet, ['Ay', 'Gelir', 'Gider', 'Kâr'], hs);
      for (const t of data.monthlyTrend) {
        trendSheet.addRow([t.month, t.revenue, t.cost, t.profit]);
      }
      trendSheet.columns = [{ width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }];
    }

    if (data.vendorSpending) {
      const vsSheet = wb.addWorksheet('Tedarikçi Harcama');
      this.addHeaders(vsSheet, ['Tedarikçi', 'Toplam Harcama', 'İşlem Sayısı'], hs);
      for (const v of data.vendorSpending) {
        vsSheet.addRow([v.name, v.amount, v.count]);
      }
      vsSheet.columns = [{ width: 28 }, { width: 18 }, { width: 14 }];
    }
  }

  private buildAdjusterSheet(wb: ExcelJS.Workbook, data: any, hs: Partial<ExcelJS.Style>) {
    const sheet = wb.addWorksheet('Eksperler');
    this.addHeaders(
      sheet,
      ['Sıra', 'Eksper', 'Şirket', 'Toplam', 'Tamamlanan', 'Revizyon Oranı (%)', 'Ort. Rapor Süresi (gün)', 'Performans Skoru'],
      hs,
    );
    for (const a of data.adjusters ?? []) {
      sheet.addRow([
        a.rank,
        a.name,
        a.company ?? '',
        a.total,
        a.completed,
        a.revisionRate,
        a.avgReportDays,
        a.performanceScore,
      ]);
    }
    sheet.columns = [
      { width: 6 }, { width: 24 }, { width: 20 }, { width: 10 },
      { width: 12 }, { width: 20 }, { width: 26 }, { width: 18 },
    ];
  }

  private buildGenericSheet(wb: ExcelJS.Workbook, data: any, hs: Partial<ExcelJS.Style>) {
    const sheet = wb.addWorksheet('Rapor');
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      this.addHeaders(sheet, keys, hs);
      for (const row of data) {
        sheet.addRow(keys.map((k) => row[k]));
      }
    } else {
      sheet.addRow(['Veri bulunamadı']);
    }
  }

  private generateCsvPdf(reportType: string, data: any): Buffer {
    const lines: string[] = [];
    lines.push(`RAPOR: ${reportType.toUpperCase()}`);
    lines.push(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`);
    lines.push('='.repeat(60));
    lines.push(JSON.stringify(data, null, 2));
    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}
