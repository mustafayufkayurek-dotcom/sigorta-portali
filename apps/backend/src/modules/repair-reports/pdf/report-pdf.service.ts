import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppUrl } from '@/common/utils/app-url';
import * as puppeteer from 'puppeteer';

interface ReportItem {
  workGroup?: { name: string; id?: string } | null;
  damageType?: { damageTypeName: string } | null;
  location?: string | null;
  jobDescription: string;
  description?: string | null;
  quantity: number;
  unit: string;
  supplierUnitPrice: number;
  salesUnitPrice: number;
  supplierTotal: number;
  salesTotal: number;
  marginPct: number;
  pricingType?: string | null;
  lumpSumPrice?: number | null;
  materialIncluded?: boolean | null;
  laborIncluded?: boolean | null;
  damageCategory?: string | null;
}

interface ExpertOfficeInfo {
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
}

interface ReportImage {
  storageKey: string;
  fileName?: string | null;
  caption?: string | null;
  category?: string | null;
  mimeType?: string | null;
}

interface ReportData {
  reportNo: string;
  reportType: string;
  reportDate: Date;
  createdAt?: Date | null;
  status?: string | null;
  versionNo?: number | null;
  revisedAt?: Date | null;
  originalReport?: { reportNo: string; versionNo: number; createdAt?: Date | null } | null;
  inspectorName?: string | null;
  reporterName?: string | null;
  findingsText?: string | null;
  legalNotes?: string | null;
  buildingDamageTotal: number;
  goodsDamageTotal: number;
  totalSupplierCost: number;
  totalSalesAmount: number;
  grossProfit: number;
  grossMarginPct: number;
  expertOfficeId?: string | null;
  expertOffice?: ExpertOfficeInfo | null;
  claimFile?: {
    fileNo: string;
    claimNo: string;
    lossType: string;
    insuredName?: string | null;
    commercialTitle?: string | null;
    insuranceCompany?: { name: string } | null;
    customer?: { fullName?: string | null; companyName?: string | null } | null;
    propertyAddress?: { city: string; district?: string | null; addressLine: string } | null;
  } | null;
  items?: ReportItem[];
  damageTypes?: Array<{ id: string; damageTypeName: string }>;
  images?: ReportImage[];
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LEGAL_NOTES_DEFAULT = [
  'Bu rapor, tarafsız ve bağımsız eksper incelemesi sonucunda hazırlanmış olup tüm tespitler yerinde yapılan muayeneye dayanmaktadır.',
  'Belirtilen birim fiyatlar bölgesel piyasa koşullarına ve inceleme tarihindeki rayiç fiyatlara göre belirlenmiştir.',
  'Restorasyon çalışmaları kapsamında belirtilen tüm imalatlar aynı kalite ve standartta yenileme esasına göre hesaplanmıştır.',
  'Su, elektrik ve benzeri altyapı giderleri hesaplara dahil edilmemiş olup ayrıca değerlendirilecektir.',
  'Raporlanan tüm bedeller KDV hariç olup, Yürürlükteki vergi mevzuatına göre KDV ayrıca hesaplanacaktır.',
  'Bu rapor düzenlenme tarihinden itibaren 15 (on beş) gün geçerlidir.',
];

@Injectable()
export class ReportPdfService {
  constructor(private readonly config: ConfigService) {}

  async generate(report: ReportData, viewType: 'internal' | 'external'): Promise<Buffer> {
    try {
      const html = this.buildHtml(report, viewType);
      return await this.htmlToPdf(html);
    } catch (error) {
      throw new InternalServerErrorException(
        'PDF oluşturulamadı. Sunucu PDF motorunu kontrol edin veya daha sonra tekrar deneyin.',
      );
    }
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width:100%;font-size:8px;color:#9ca3af;padding:0 15mm;display:flex;justify-content:flex-end;align-items:center;font-family:Arial,sans-serif;">
            <span>Sayfa <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private buildHtml(report: ReportData, viewType: 'internal' | 'external'): string {
    // Dynamic base URL — falls back to APP_BASE_URL then APP_URL
    const appUrl = resolveAppUrl(this.config);
    const uploadsBase = (
      this.config.get<string>('BACKEND_PUBLIC_URL') ||
      appUrl.replace(/\/api\/v1\/?$/, '')
    ).replace(/\/$/, '');

    const isDraft = report.status === 'draft' || !report.status;
    const cf = report.claimFile;
    const addr = cf?.propertyAddress
      ? `${escHtml(cf.propertyAddress.addressLine)}, ${escHtml(cf.propertyAddress.district ?? '')} ${escHtml(cf.propertyAddress.city)}`
      : '—';

    // ── FEATURE 6: Revizyon bilgisi ──
    const isRevision = (report.versionNo ?? 1) > 1;
    let revisionInfoHtml = '';
    if (isRevision) {
      const originalCreatedAt = report.originalReport?.createdAt
        ? fmtDate(report.originalReport.createdAt as Date)
        : (report.createdAt ? fmtDate(report.createdAt as Date) : '—');
      const revisedDate = report.revisedAt ? fmtDate(report.revisedAt as Date) : fmtDate(report.reportDate);
      revisionInfoHtml = `
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:6px 14px;margin-top:6px;font-size:8pt;color:#92400e;display:flex;gap:16px;align-items:center;">
          <span style="font-weight:700;">REVİZYON: ${report.versionNo}</span>
          <span>İlk Rapor: ${originalCreatedAt}</span>
          <span>Revizyon Tarihi: ${revisedDate}</span>
        </div>`;
    }

    // Group items by workGroup
    const grouped = new Map<string, ReportItem[]>();
    for (const item of report.items ?? []) {
      const key = item.workGroup?.name ?? 'Diğer';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    // Build items table rows HTML
    let itemsHtml = '';
    let rowIndex = 0;
    for (const [groupName, items] of grouped) {
      const groupSalesTotal = items.reduce((s, i) =>
        s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : i.salesTotal), 0);

      itemsHtml += `
        <tr class="group-header-row">
          <td colspan="${viewType === 'internal' ? 9 : 8}" class="group-header">${escHtml(groupName)}</td>
        </tr>`;

      for (const item of items) {
        const zebra = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
        rowIndex++;
        const isLumpsum = item.pricingType === 'lumpsum';
        const salesTotal = isLumpsum ? (item.lumpSumPrice ?? 0) : item.salesTotal;
        const unitPrice = isLumpsum ? (item.lumpSumPrice ?? 0) : item.salesUnitPrice;
        const qty = isLumpsum ? '—' : String(item.quantity);
        const unit = isLumpsum ? 'Maktuen' : escHtml(item.unit);
        const unitPriceStr = isLumpsum ? '—' : fmtCurrency(unitPrice);

        // ── FEATURE 7: Renk kodlu hasar sınıflandırma ──
        const catDot = item.damageCategory === 'esya'
          ? '<span class="cat-dot cat-dot-esya">&#9679;</span>'
          : '<span class="cat-dot cat-dot-bina">&#9679;</span>';

        if (viewType === 'internal') {
          const supplierUnitPrice = isLumpsum ? (item.lumpSumPrice ?? 0) : item.supplierUnitPrice;
          const supplierTotal = isLumpsum ? (item.lumpSumPrice ?? 0) : item.supplierTotal;
          const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;
          const marginCls = marginPct < 10 ? 'margin-low' : marginPct < 20 ? 'margin-mid' : 'margin-ok';
          itemsHtml += `
            <tr class="${zebra}">
              <td>${catDot} ${escHtml(item.workGroup?.name)}</td>
              <td>${escHtml(item.location)}</td>
              <td><strong>${escHtml(item.jobDescription)}</strong>${item.description ? `<br><span class="item-desc">${escHtml(item.description)}</span>` : ''}</td>
              <td class="text-center">${qty}</td>
              <td class="text-center">${unit}</td>
              <td class="text-right">${fmtCurrency(supplierUnitPrice)}</td>
              <td class="text-right">${unitPriceStr}</td>
              <td class="text-right"><span class="${marginCls}">%${marginPct.toFixed(1)}</span></td>
              <td class="text-right amount-cell">${fmtCurrency(salesTotal)}</td>
            </tr>`;
        } else {
          itemsHtml += `
            <tr class="${zebra}">
              <td>${catDot} ${escHtml(item.workGroup?.name)}</td>
              <td>${escHtml(item.location)}</td>
              <td><strong>${escHtml(item.jobDescription)}</strong>${item.description ? `<br><span class="item-desc">${escHtml(item.description)}</span>` : ''}</td>
              <td>${item.description ? escHtml(item.description) : '—'}</td>
              <td class="text-center">${qty}</td>
              <td class="text-center">${unit}</td>
              <td class="text-right">${unitPriceStr}</td>
              <td class="text-right amount-cell">${fmtCurrency(salesTotal)}</td>
            </tr>`;
        }
      }

      // Group subtotal row
      itemsHtml += `
        <tr class="group-total-row">
          <td colspan="${viewType === 'internal' ? 8 : 7}" class="text-right subtotal-label">ARA TOPLAM — ${escHtml(groupName)}</td>
          <td class="text-right subtotal-amount">${fmtCurrency(groupSalesTotal)}</td>
        </tr>`;
    }

    // Legal notes
    const legalLines: string[] = report.legalNotes
      ? report.legalNotes.split('\n').filter((l) => l.trim())
      : LEGAL_NOTES_DEFAULT;

    const legalHtml = legalLines
      .map((line, i) => `<li><span class="legal-num">${i + 1}.</span> ${escHtml(line)}</li>`)
      .join('');

    // QR Code URL (doğrulama)
    const verifyUrl = `${appUrl}/onay/${report.reportNo}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}`;

    const tableHeaderInternal = `
      <tr>
        <th style="width:11%">İş Grubu</th>
        <th style="width:10%">Mahal / Bölge</th>
        <th style="width:22%">İşin Tanımı</th>
        <th style="width:6%" class="text-center">Miktar</th>
        <th style="width:7%" class="text-center">Birim</th>
        <th style="width:10%" class="text-right">Tlr. Fiyat</th>
        <th style="width:10%" class="text-right">Satış Fiyatı</th>
        <th style="width:7%" class="text-right">Marj</th>
        <th style="width:10%" class="text-right">Bedel</th>
      </tr>`;

    const tableHeaderExternal = `
      <tr>
        <th style="width:11%">İş Grubu</th>
        <th style="width:10%">Mahal / Bölge</th>
        <th style="width:22%">İşin Tanımı</th>
        <th style="width:15%">Açıklama</th>
        <th style="width:7%" class="text-center">Miktar</th>
        <th style="width:7%" class="text-center">Birim</th>
        <th style="width:12%" class="text-right">Birim Fiyat</th>
        <th style="width:12%" class="text-right">Onarım Bedeli</th>
      </tr>`;

    // ── FEATURE 1: Fotoğraf Galerisi ──
    const images = report.images ?? [];
    let photoGalleryHtml = '';
    if (images.length > 0) {
      const imageItems = images.map((img) => {
        // local: /uploads/report-images/{storageKey}
        const imgUrl = `${uploadsBase}/uploads/report-images/${encodeURIComponent(img.storageKey)}`;
        const caption = img.caption ?? img.fileName ?? '';
        return `
          <div class="photo-item">
            <img src="${imgUrl}" class="photo-img" alt="${escHtml(caption)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/>
            <div class="photo-error" style="display:none;">Fotoğraf yüklenemedi</div>
            ${caption ? `<div class="photo-caption">${escHtml(caption)}</div>` : ''}
          </div>`;
      }).join('');

      photoGalleryHtml = `
        <div class="section-header" style="margin-top:14px;">Hasar Fotoğrafları</div>
        <div class="photo-gallery">
          ${imageItems}
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a202c;
    background: white;
    line-height: 1.4;
  }

  /* ── Watermark ── */
  ${isDraft ? `
  body::before {
    content: "TASLAK";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 110pt;
    font-weight: 900;
    color: rgba(59, 130, 246, 0.09);
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 14px;
  }` : viewType === 'internal' ? `
  body::before {
    content: "İÇ KULLANIM";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 72pt;
    font-weight: 900;
    color: rgba(99, 102, 241, 0.06);
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 10px;
  }` : `
  body::before {
    content: "DIŞ KULLANIM";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 72pt;
    font-weight: 900;
    color: rgba(16, 185, 129, 0.06);
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 10px;
  }`}

  /* ── Header ── */
  .report-header {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 8px 22px;
    border-radius: 4px 4px 0 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .header-brand {
    font-size: 9pt;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.5px;
    text-align: right;
  }

  /* ── Info Block ── */
  .info-block {
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 8px 22px;
    background: #f8fafc;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }

  .info-row {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: baseline;
    padding: 3px 12px 3px 0;
    border-bottom: 1px solid #e9edf2;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-row-full {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: baseline;
    padding: 3px 0;
    border-bottom: 1px solid #e9edf2;
  }

  .info-row-full:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: 7.5pt;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .info-value {
    font-size: 9pt;
    font-weight: 600;
    color: #1e293b;
  }

  /* ── Section Headers ── */
  .section-header {
    background: #f8fafc;
    color: #374151;
    padding: 5px 14px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-top: 14px;
    border-top: 2px solid #cbd5e1;
    border-bottom: 1px solid #e2e8f0;
  }

  /* ── Findings ── */
  .findings-box {
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 12px 14px;
    background: #fffbf5;
  }

  .findings-text {
    font-size: 10pt;
    font-weight: 700;
    font-style: italic;
    color: #374151;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ── Items Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
    font-size: 9pt;
    border: 1px solid #e2e8f0;
    border-top: none;
  }

  .items-table thead tr {
    background: #f1f5f9;
    color: #374151;
  }

  .items-table thead th {
    padding: 7px 8px;
    font-weight: 700;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border-right: 1px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
  }

  .items-table thead th:last-child { border-right: none; }

  /* Zebra striping */
  .row-even td { background: #ffffff; }
  .row-odd td { background: #f8fafc; }

  .items-table td {
    padding: 7px 8px;
    border-right: 1px solid #e8ecf0;
    border-bottom: 1px solid #f0f4f8;
    vertical-align: top;
    word-break: break-word;
  }

  .items-table td:last-child { border-right: none; }

  .item-desc {
    font-size: 7.5pt;
    color: #64748b;
    font-style: italic;
  }

  /* ── Feature 7: Kategori renk noktalari ── */
  .cat-dot {
    font-size: 7pt;
    margin-right: 3px;
  }
  .cat-dot-bina { color: #3b82f6; }
  .cat-dot-esya { color: #22c55e; }

  /* Group header row */
  .group-header-row td.group-header {
    background: #f8fafc;
    color: #374151;
    font-weight: 700;
    font-size: 8.5pt;
    padding: 5px 12px;
    border-top: 1px solid #cbd5e1;
    border-bottom: 1px solid #e2e8f0;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  /* Group total row */
  .group-total-row td {
    background: #f1f5f9 !important;
    border-top: 1.5px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
    font-weight: 600;
    font-size: 9pt;
    color: #374151;
  }

  .subtotal-label { color: #475569; font-style: italic; }
  .subtotal-amount { color: #374151; font-weight: 700; }

  .amount-cell { font-weight: 600; color: #374151; }

  .margin-ok { color: #16a34a; font-weight: 600; }
  .margin-mid { color: #d97706; font-weight: 600; }
  .margin-low { color: #dc2626; font-weight: 600; }

  .text-center { text-align: center; }
  .text-right { text-align: right; }

  /* ── Totals ── */
  .totals-section {
    border: 1px solid #e2e8f0;
    border-top: 2px solid #cbd5e1;
    padding: 14px 20px;
    margin-top: 14px;
    background: #f8fafc;
  }

  .totals-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 24px;
    max-width: 420px;
    margin-left: auto;
  }

  .total-row {
    display: contents;
  }

  .total-label {
    font-size: 9.5pt;
    color: #374151;
    font-weight: 500;
    text-align: right;
    padding: 4px 0;
    border-top: 1px solid #e2e8f0;
  }

  .total-amount {
    font-size: 10pt;
    font-weight: 700;
    color: #374151;
    text-align: right;
    padding: 4px 0;
    border-top: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .grand-total-label {
    font-size: 11pt;
    font-weight: 800;
    color: #1e293b;
    text-align: right;
    padding: 8px 0 4px;
    border-top: 2px solid #94a3b8;
    margin-top: 4px;
  }

  .grand-total-amount {
    font-size: 12pt;
    font-weight: 800;
    color: #1e293b;
    text-align: right;
    padding: 8px 0 4px;
    border-top: 2px solid #94a3b8;
    margin-top: 4px;
    white-space: nowrap;
  }

  /* ── Onarım Bedeli ortalanmış tek satır ── */
  .repair-total-band {
    border: 1px solid #e2e8f0;
    border-top: 2px solid #cbd5e1;
    padding: 14px 20px;
    margin-top: 14px;
    background: #f8fafc;
    text-align: center;
  }

  .repair-total-label {
    font-size: 9pt;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .repair-total-value {
    font-size: 13pt;
    font-weight: 800;
    color: #1e293b;
    letter-spacing: 0.5px;
  }

  /* ── Legal Notes ── */
  .legal-section {
    margin-top: 14px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #cbd5e1;
  }

  .legal-title {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .legal-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .legal-list li {
    font-size: 8pt;
    color: #4b5563;
    line-height: 1.5;
    padding: 2.5px 0;
    border-bottom: 1px dashed #e5e7eb;
    word-break: break-word;
  }

  .legal-list li:last-child { border-bottom: none; }

  .legal-num {
    font-weight: 700;
    color: #475569;
    margin-right: 3px;
  }

  /* ── Signatures ── */
  .signature-section {
    display: flex;
    justify-content: space-around;
    gap: 24px;
    margin-top: 28px;
    padding-top: 14px;
    border-top: 2px solid #e2e8f0;
  }

  .signature-box {
    flex: 1;
    text-align: center;
    max-width: 200px;
  }

  .signature-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 32px;
  }

  .signature-line {
    border-top: 1.5px solid #374151;
    width: 80%;
    margin: 0 auto 6px;
  }

  .signature-name {
    font-size: 9pt;
    font-weight: 600;
    color: #1e293b;
  }

  /* ── Footer ── */
  .report-footer {
    margin-top: 28px;
    padding: 10px 16px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 4px 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .qr-label {
    font-size: 7pt;
    color: #64748b;
    text-align: center;
  }

  /* ── Damage type summary ── */
  .damage-summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
    font-size: 9pt;
    border: 1px solid #e2e8f0;
    border-top: none;
  }

  .damage-summary-table thead tr { background: #f1f5f9; color: #374151; }
  .damage-summary-table thead th { padding: 6px 10px; font-weight: 600; text-align: left; }
  .damage-summary-table thead th.text-right { text-align: right; }
  .damage-summary-table tbody td { padding: 5px 10px; border-bottom: 1px solid #f0f4f8; }
  .damage-summary-table tbody tr:nth-child(even) td { background: #f8fafc; }

  /* ── Feature 1: Fotoğraf Galerisi ── */
  .photo-gallery {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-top: none;
    background: #fafafa;
  }

  .photo-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .photo-img {
    width: 100%;
    height: 160px;
    object-fit: cover;
    display: block;
  }

  .photo-error {
    width: 100%;
    height: 160px;
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 8pt;
    align-items: center;
    justify-content: center;
  }

  .photo-caption {
    font-size: 7.5pt;
    color: #475569;
    text-align: center;
    padding: 4px 8px;
    width: 100%;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    word-break: break-word;
  }

  /* ── Page break ── */
  .page-break { page-break-before: always; }

  /* Print overrides */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="report-header">
  <div class="header-brand">MERİDYEN ASİSTANS</div>
</div>

<!-- BAŞLIK -->
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:10px 22px;text-align:center;">
  <div style="font-size:15pt;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#1e293b;">HASAR TESPİT VE ONARIM RAPORU</div>
  ${isDraft ? '<div style="display:inline-block;margin-top:4px;background:#fef3c7;border-radius:3px;padding:1px 10px;font-size:8pt;font-weight:700;color:#b45309;letter-spacing:1px;">TASLAK</div>' : ''}
</div>

<!-- DOSYA BİLGİLERİ -->
<div class="info-block">
  <div class="info-grid">
    <div class="info-row">
      <span class="info-label">Dosya Numarası</span>
      <span class="info-value">${escHtml(cf?.fileNo) || escHtml(report.reportNo)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Tarih</span>
      <span class="info-value">${fmtDate(report.reportDate)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Sigortalı</span>
      <span class="info-value">${escHtml(cf?.customer?.fullName ?? cf?.customer?.companyName ?? cf?.insuredName ?? cf?.commercialTitle)}</span>
    </div>
  </div>
  <div class="info-row-full">
    <span class="info-label">Hasar Konusu</span>
    <span class="info-value">${escHtml(cf?.lossType) || '—'}</span>
  </div>
  <div class="info-row-full">
    <span class="info-label">Adres</span>
    <span class="info-value">${addr}</span>
  </div>
</div>

<!-- FEATURE 6: REVİZYON BİLGİSİ -->
${revisionInfoHtml}

<!-- TESPİT BULGULARI -->
${report.findingsText ? `
<div class="section-header">Tespit Bulgularımız</div>
<div class="findings-box">
  <div class="findings-text">${escHtml(report.findingsText)}</div>
</div>` : ''}

<!-- ONARIM KALEMLERİ -->
<table class="items-table" style="margin-top:14px;border-top:2px solid #cbd5e1;">
  <thead>
    ${viewType === 'internal' ? tableHeaderInternal : tableHeaderExternal}
  </thead>
  <tbody>
    ${itemsHtml || `<tr><td colspan="${viewType === 'internal' ? 9 : 8}" style="text-align:center;padding:20px;color:#9ca3af;">Kalem Bulunmamaktadır</td></tr>`}
  </tbody>
</table>

<!-- ONARIM BEDELİ (ortalanmış) -->
${viewType === 'external' ? `
<div class="repair-total-band">
  <div class="repair-total-label">Onarım Bedeli</div>
  <div class="repair-total-value">${fmtCurrency(report.totalSalesAmount)}</div>
</div>` : `
<div class="totals-section">
  <div class="totals-grid">
    <div class="total-label">Bina Hasar Toplamı</div>
    <div class="total-amount">${fmtCurrency(report.buildingDamageTotal)}</div>
    <div class="total-label">Eşya Hasar Toplamı</div>
    <div class="total-amount">${fmtCurrency(report.goodsDamageTotal)}</div>
    <div class="grand-total-label">Onarım Bedeli</div>
    <div class="grand-total-amount">${fmtCurrency(report.totalSalesAmount)}</div>
    <div class="total-label" style="margin-top:8px;color:#64748b;">Toplam Maliyet</div>
    <div class="total-amount" style="margin-top:8px;color:#64748b;">${fmtCurrency(report.totalSupplierCost)}</div>
    <div class="total-label" style="color:#64748b;">Brüt Kâr</div>
    <div class="total-amount" style="color:${report.grossProfit >= 0 ? '#16a34a' : '#dc2626'};">${fmtCurrency(report.grossProfit)}</div>
    <div class="total-label" style="color:#64748b;">Marj</div>
    <div class="total-amount" style="color:${report.grossMarginPct >= 20 ? '#16a34a' : report.grossMarginPct >= 10 ? '#d97706' : '#dc2626'};">%${report.grossMarginPct.toFixed(1)}</div>
  </div>
</div>`}

${report.reportType === 'multi' && (report.damageTypes?.length ?? 0) > 0 ? `
<div class="section-header" style="margin-top:14px;">Hasar Nedeni Bazlı Özet</div>
<table class="damage-summary-table">
  <thead>
    <tr>
      <th>Hasar Nedeni</th>
      ${viewType === 'internal' ? '<th class="text-right">Maliyet</th>' : ''}
      <th class="text-right">Tutar</th>
      ${viewType === 'internal' ? '<th class="text-right">Kâr</th><th class="text-right">Marj%</th>' : ''}
    </tr>
  </thead>
  <tbody>
    ${(report.damageTypes ?? []).map((dt) => {
      const dtItems = (report.items ?? []).filter((i) => i.damageType?.damageTypeName === dt.damageTypeName);
      const dtSales = dtItems.reduce((s, i) => s + i.salesTotal, 0);
      const dtSupplier = dtItems.reduce((s, i) => s + i.supplierTotal, 0);
      const dtMargin = dtSales > 0 ? ((dtSales - dtSupplier) / dtSales) * 100 : 0;
      const mCls = dtMargin >= 20 ? 'margin-ok' : dtMargin >= 10 ? 'margin-mid' : 'margin-low';
      return `<tr>
        <td>${escHtml(dt.damageTypeName)}</td>
        ${viewType === 'internal' ? `<td class="text-right">${fmtCurrency(dtSupplier)}</td>` : ''}
        <td class="text-right" style="font-weight:600;">${fmtCurrency(dtSales)}</td>
        ${viewType === 'internal' ? `<td class="text-right">${fmtCurrency(dtSales - dtSupplier)}</td><td class="text-right"><span class="${mCls}">%${dtMargin.toFixed(1)}</span></td>` : ''}
      </tr>`;
    }).join('')}
  </tbody>
</table>
` : ''}

<!-- YASAL NOTLAR -->
<div class="legal-section">
  <div class="legal-title">Yasal Uyarılar Ve Açıklamalar</div>
  <ul class="legal-list">
    ${legalHtml}
  </ul>
</div>

<!-- FEATURE 1: FOTOĞRAF GALERİSİ -->
${photoGalleryHtml}

<!-- İMZA ALANLARI -->
<div class="signature-section">
  <div class="signature-box">
    <div class="signature-label">Tespiti Yapan</div>
    <div class="signature-line"></div>
    <div class="signature-name">${escHtml(report.inspectorName) || '..............................'}</div>
  </div>
</div>

<!-- FOOTER — Sadece QR Kod -->
<div class="report-footer">
  <div class="qr-area">
    <img src="${qrUrl}" width="64" height="64" alt="QR Doğrulama" style="display:block;border-radius:4px;background:white;padding:3px;border:1px solid #e2e8f0;"/>
    <div class="qr-label">Rapor Doğrula</div>
  </div>
</div>

</body>
</html>`;
  }
}
