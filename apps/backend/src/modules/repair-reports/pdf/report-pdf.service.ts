import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAppUrl } from '@/common/utils/app-url';
import { resolveRepairReportExpertName } from '@sigorta/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

interface ReportItem {
  workGroup?: { name: string; id?: string } | null;
  damageType?: { damageTypeName: string } | null;
  location?: string | null;
  metrajData?: { detectionScope?: string | null } | Record<string, unknown> | null;
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

interface ApprovalHistoryEntry {
  id?: string;
  action: string;
  reason?: string | null;
  createdAt: Date | string;
  user?: { firstName?: string | null; lastName?: string | null } | null;
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
    assignedInspectorVendor?: { name?: string | null } | null;
    assignedOfficeUser?: { firstName?: string | null; lastName?: string | null } | null;
  } | null;
  items?: ReportItem[];
  damageTypes?: Array<{ id: string; damageTypeName: string }>;
  quickDamageTypes?: string[];
  quickDamageSize?: string | null;
  images?: ReportImage[];
  approvalHistory?: ApprovalHistoryEntry[];
}

function itemSalesTotal(item: ReportItem): number {
  return item.pricingType === 'lumpsum' ? (item.lumpSumPrice ?? 0) : item.salesTotal;
}

function approvalActionLabel(action: string): string {
  if (action === 'approved') return 'Onayladı';
  if (action === 'rejected') return 'Reddetti';
  if (action === 'revision_created') return 'Revizyon Oluşturdu';
  if (action === 'pending_approval') return 'Onaya Gönderdi';
  return action || 'İşlem';
}

function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Örn. Boya → Boya İş Grubu */
function workGroupHeaderLabel(groupName: string): string {
  const name = (groupName || 'Diğer').trim();
  if (/iş grubu$/i.test(name)) return name;
  return `${name} İş Grubu`;
}

/** Örn. Boya → Boya İşleri Toplamı */
function workGroupJobsTotalLabel(groupName: string): string {
  const name = (groupName || 'Diğer').trim().replace(/\s*iş grubu$/i, '').trim() || 'Diğer';
  if (/işleri$/i.test(name)) return `${name} Toplamı`;
  return `${name} İşleri Toplamı`;
}

/** Mahal/Bölge kolonunu eksiksiz göster (location + varsa tespit alanı) */
function formatMahalBolge(item: ReportItem): string {
  const location = (item.location ?? '').trim();
  const scopeRaw = item.metrajData && typeof item.metrajData === 'object'
    ? (item.metrajData as { detectionScope?: unknown }).detectionScope
    : null;
  const scope = typeof scopeRaw === 'string' ? scopeRaw.trim() : '';
  if (location && scope && !location.toLocaleLowerCase('tr-TR').includes(scope.toLocaleLowerCase('tr-TR'))) {
    return `${location} · ${scope}`;
  }
  return location || scope || '—';
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

const QUICK_DAMAGE_TYPE_LABELS: Record<string, string> = {
  FIRE_HOME: 'Konut Yangını',
  FIRE_INDUSTRIAL: 'Endüstriyel Yangın',
  WATER_INTERNAL: 'Su Hasarı',
  NATURAL_DISASTER: 'Doğal Afet',
  EARTHQUAKE: 'Deprem',
  VEHICLE_IMPACT: 'Taşıt Çarpması',
};

const QUICK_DAMAGE_SIZE_LABELS: Record<string, string> = {
  SMALL: 'Küçük',
  MEDIUM: 'Orta',
  LARGE: 'Büyük',
};

function formatQuickRepairSummary(report: ReportData): string | null {
  const types = report.quickDamageTypes ?? [];
  if (!types.length) return null;
  const labels = types.map((t) => QUICK_DAMAGE_TYPE_LABELS[t] ?? t.replace(/_/g, ' '));
  const size = report.quickDamageSize
    ? QUICK_DAMAGE_SIZE_LABELS[report.quickDamageSize] ?? report.quickDamageSize
    : null;
  return size ? `${labels.join(' + ')} (${size})` : labels.join(' + ');
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
  private readonly logger = new Logger(ReportPdfService.name);
  private logoDataUrlCache: string | null | undefined;

  constructor(private readonly config: ConfigService) {}

  async generate(report: ReportData, viewType: 'internal' | 'external'): Promise<Buffer> {
    try {
      const html = this.buildHtml(report, viewType);
      return await this.htmlToPdf(html);
    } catch (error) {
      this.logger.error(
        `PDF motor hatası: ${(error as Error)?.message ?? error}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException(
        'PDF oluşturulamadı. Sunucu PDF motorunu kontrol edin veya daha sonra tekrar deneyin.',
      );
    }
  }

  /** Resmi marka PNG — Puppeteer için base64 data URI (ağ yok). Şeffaf zemin tercih edilir. */
  private resolveLogoDataUrl(): string | null {
    if (this.logoDataUrlCache !== undefined) return this.logoDataUrlCache;

    const fileNames = ['meridyen-logo-report.png', 'meridyen-logo-original.png'];
    const dirs = [
      path.join(process.cwd(), 'assets'),
      path.join(process.cwd(), 'apps', 'backend', 'assets'),
      path.join(__dirname, '..', '..', '..', '..', 'assets'),
    ];
    const candidates = dirs.flatMap((dir) => fileNames.map((name) => path.join(dir, name)));

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate);
          this.logoDataUrlCache = `data:image/png;base64,${buf.toString('base64')}`;
          return this.logoDataUrlCache;
        }
      } catch {
        /* sonraki aday */
      }
    }

    this.logger.warn('Meridyen logo dosyası bulunamadı; PDF başlığında metin kullanılacak');
    this.logoDataUrlCache = null;
    return null;
  }

  /** Yerel: puppeteer cache silinmiş olabilir — sistem Chrome / env fallback */
  private resolveChromeExecutable(): string | undefined {
    const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

    try {
      const bundled = puppeteer.executablePath();
      if (bundled && fs.existsSync(bundled)) return bundled;
    } catch {
      /* paket chrome yok */
    }

    const macChrome =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macChrome)) return macChrome;

    const linuxChrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    for (const p of linuxChrome) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const executablePath = this.resolveChromeExecutable();
    if (!executablePath) {
      throw new Error(
        'Chrome/Chromium bulunamadı (PUPPETEER_EXECUTABLE_PATH veya sistem Chrome gerekli)',
      );
    }
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
    const isRevision = (report.versionNo ?? 0) > 0;
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

    const subtotalColSpan = viewType === 'internal' ? 8 : 7;
    const allItems = report.items ?? [];
    const binaItems = allItems.filter((i) => (i.damageCategory ?? 'bina') !== 'esya');
    const esyaItems = allItems.filter((i) => i.damageCategory === 'esya');

    let rowIndex = 0;
    const appendWorkGroupRows = (items: ReportItem[]): string => {
      const grouped = new Map<string, ReportItem[]>();
      for (const item of items) {
        const key = item.workGroup?.name ?? 'Diğer';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      let html = '';
      for (const [groupName, groupItems] of grouped) {
        const groupSalesTotal = groupItems.reduce((s, i) => s + itemSalesTotal(i), 0);
        // İş grubu ara başlık satırı yok — yalnız kalemler + … İşleri Toplamı

        for (const item of groupItems) {
          const zebra = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
          rowIndex++;
          const isLumpsum = item.pricingType === 'lumpsum';
          const salesTotal = itemSalesTotal(item);
          const unitPrice = isLumpsum ? (item.lumpSumPrice ?? 0) : item.salesUnitPrice;
          const qty = isLumpsum ? '—' : String(item.quantity);
          const unit = isLumpsum ? 'Maktuen' : escHtml(item.unit);
          const unitPriceStr = isLumpsum ? '—' : fmtCurrency(unitPrice);
          const catDot = item.damageCategory === 'esya'
            ? '<span class="cat-dot cat-dot-esya">&#9679;</span>'
            : '<span class="cat-dot cat-dot-bina">&#9679;</span>';
          const mahalBolge = formatMahalBolge(item);
          const wgCell = workGroupHeaderLabel(item.workGroup?.name ?? groupName);

          if (viewType === 'internal') {
            const supplierUnitPrice = isLumpsum ? (item.lumpSumPrice ?? 0) : item.supplierUnitPrice;
            const supplierTotal = isLumpsum ? (item.lumpSumPrice ?? 0) : item.supplierTotal;
            const marginPct = salesTotal > 0 ? ((salesTotal - supplierTotal) / salesTotal) * 100 : 0;
            const marginCls = marginPct < 10 ? 'margin-low' : marginPct < 20 ? 'margin-mid' : 'margin-ok';
            html += `
            <tr class="${zebra}">
              <td>${catDot} ${escHtml(wgCell)}</td>
              <td class="mahal-cell">${escHtml(mahalBolge)}</td>
              <td><strong>${escHtml(item.jobDescription)}</strong>${item.description ? `<br><span class="item-desc">${escHtml(item.description)}</span>` : ''}</td>
              <td class="text-center">${qty}</td>
              <td class="text-center">${unit}</td>
              <td class="text-right">${fmtCurrency(supplierUnitPrice)}</td>
              <td class="text-right">${unitPriceStr}</td>
              <td class="text-right"><span class="${marginCls}">%${marginPct.toFixed(1)}</span></td>
              <td class="text-right amount-cell">${fmtCurrency(salesTotal)}</td>
            </tr>`;
          } else {
            html += `
            <tr class="${zebra}">
              <td>${catDot} ${escHtml(wgCell)}</td>
              <td class="mahal-cell">${escHtml(mahalBolge)}</td>
              <td><strong>${escHtml(item.jobDescription)}</strong>${item.description ? `<br><span class="item-desc">${escHtml(item.description)}</span>` : ''}</td>
              <td>${item.description ? escHtml(item.description) : '—'}</td>
              <td class="text-center">${qty}</td>
              <td class="text-center">${unit}</td>
              <td class="text-right">${unitPriceStr}</td>
              <td class="text-right amount-cell">${fmtCurrency(salesTotal)}</td>
            </tr>`;
          }
        }

        html += `
        <tr class="group-total-row">
          <td colspan="${subtotalColSpan}" class="text-right subtotal-label">${escHtml(workGroupJobsTotalLabel(groupName))}</td>
          <td class="text-right subtotal-amount">${fmtCurrency(groupSalesTotal)}</td>
        </tr>`;
      }
      return html;
    };

    /** Üst kategori başlığı yok; yalnız iş grubu satırları + bölüm alt toplamı */
    const appendCategorySection = (
      items: ReportItem[],
      categoryTotalLabel: string,
      categoryTotal: number,
    ): string => {
      if (items.length === 0) return '';
      return `
        ${appendWorkGroupRows(items)}
        <tr class="category-total-row">
          <td colspan="${subtotalColSpan}" class="text-right category-total-label">${escHtml(categoryTotalLabel)}</td>
          <td class="text-right category-total-amount">${fmtCurrency(categoryTotal)}</td>
        </tr>`;
    };

    const itemsHtml =
      allItems.length === 0
        ? ''
        : appendCategorySection(
            binaItems,
            'Bina Genel Toplam Hasarı',
            report.buildingDamageTotal,
          )
          + appendCategorySection(
            esyaItems,
            'Eşya Genel Toplam Hasarı',
            report.goodsDamageTotal,
          );

    const logoDataUrl = this.resolveLogoDataUrl();
    const generatedAt = new Date();
    const expertOfficeName = report.expertOffice?.companyName?.trim() || '—';
    const insuranceCompanyName = cf?.insuranceCompany?.name?.trim() || '—';
    const headerBrandHtml = logoDataUrl
      ? `<img class="header-logo" src="${logoDataUrl}" alt="Meridyen Assistance" />`
      : `<div class="header-brand">Meridyen Assistance</div>`;

    const approvalHistory = report.approvalHistory ?? [];
    const approvalTrailHtml = approvalHistory.length > 0
      ? `
<div class="approval-trail-section">
  <div class="approval-trail-title">Dijital Onay İzleri</div>
  <ol class="approval-trail-list">
    ${approvalHistory.map((entry, index) => {
      const who = [entry.user?.firstName, entry.user?.lastName].filter(Boolean).join(' ').trim() || '—';
      const reason = entry.reason?.trim()
        ? `<div class="approval-trail-reason">Neden: ${escHtml(entry.reason)}</div>`
        : '';
      return `<li>
        <span class="approval-trail-step">${index + 1}.</span>
        <span class="approval-trail-meta">${escHtml(fmtDateTime(entry.createdAt))}</span>
        <span class="approval-trail-who">${escHtml(who)}</span>
        <span class="approval-trail-action">${escHtml(approvalActionLabel(entry.action))}</span>
        ${reason}
      </li>`;
    }).join('')}
  </ol>
</div>`
      : '';

    const showGoodsTotal = (report.goodsDamageTotal ?? 0) > 0 || esyaItems.length > 0;
    const externalTotalsHtml = `
<div class="repair-totals-stack">
  <div class="repair-total-band">
    <div class="repair-total-label">Bina Genel Toplam Hasarı</div>
    <div class="repair-total-value">${fmtCurrency(report.buildingDamageTotal)}</div>
  </div>
  ${showGoodsTotal ? `
  <div class="repair-total-band">
    <div class="repair-total-label">Eşya Genel Toplam Hasarı</div>
    <div class="repair-total-value">${fmtCurrency(report.goodsDamageTotal)}</div>
  </div>` : ''}
  <div class="repair-total-band repair-total-band-grand">
    <div class="repair-total-label">Onarım Bedeli</div>
    <div class="repair-total-value">${fmtCurrency(report.totalSalesAmount)}</div>
  </div>
</div>`;

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
        <th style="width:14%">İş Grubu</th>
        <th style="width:16%">Mahal/Bölge</th>
        <th style="width:20%">İşin Tanımı</th>
        <th style="width:6%" class="text-center">Miktar</th>
        <th style="width:6%" class="text-center">Birim</th>
        <th style="width:10%" class="text-right">Tlr. Fiyat</th>
        <th style="width:10%" class="text-right">Satış Fiyatı</th>
        <th style="width:7%" class="text-right">Marj</th>
        <th style="width:11%" class="text-right">Bedel</th>
      </tr>`;

    const tableHeaderExternal = `
      <tr>
        <th style="width:14%">İş Grubu</th>
        <th style="width:16%">Mahal/Bölge</th>
        <th style="width:18%">İşin Tanımı</th>
        <th style="width:14%">Açıklama</th>
        <th style="width:6%" class="text-center">Miktar</th>
        <th style="width:6%" class="text-center">Birim</th>
        <th style="width:12%" class="text-right">Birim Fiyat</th>
        <th style="width:14%" class="text-right">Onarım Bedeli</th>
      </tr>`;

    // Tespit resimleri — rapor eki: en fazla 9 adet, satırda 3
    const attachmentImages = (report.images ?? []).slice(0, 9);
    let photoGalleryHtml = '';
    if (attachmentImages.length > 0) {
      const imageItems = attachmentImages.map((img, index) => {
        const imgUrl = `${uploadsBase}/uploads/report-images/${encodeURIComponent(img.storageKey)}`;
        const caption = img.caption ?? img.fileName ?? `Tespit ${index + 1}`;
        return `
          <div class="photo-item">
            <img src="${imgUrl}" class="photo-img" alt="${escHtml(caption)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/>
            <div class="photo-error" style="display:none;">Fotoğraf yüklenemedi</div>
            <div class="photo-caption">${escHtml(caption)}</div>
          </div>`;
      }).join('');

      photoGalleryHtml = `
        <div class="page-break"></div>
        <div class="section-header">Tespit Resimleri (Rapor Eki)</div>
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
    padding: 12px 22px;
    border-radius: 4px 4px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .header-logo {
    height: 72px;
    width: auto;
    max-width: 260px;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
    background: transparent;
  }

  .mahal-cell {
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.35;
    min-width: 90px;
  }

  .header-brand {
    font-size: 9pt;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  .header-title-block {
    flex: 1;
    text-align: right;
    min-width: 0;
  }

  .header-title {
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #1e293b;
    line-height: 1.25;
  }

  .header-draft-badge {
    display: inline-block;
    margin-top: 4px;
    background: #fef3c7;
    border-radius: 3px;
    padding: 1px 10px;
    font-size: 8pt;
    font-weight: 700;
    color: #b45309;
    letter-spacing: 1px;
  }

  .category-header-row td,
  .category-header {
    background: #e2e8f0;
    color: #0f172a;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    padding: 7px 10px;
  }

  .category-total-row td {
    background: #f1f5f9;
    border-top: 2px solid #94a3b8;
    border-bottom: 2px solid #94a3b8;
    padding: 6px 10px;
  }

  .category-total-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #334155;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .category-total-amount {
    font-size: 10pt;
    font-weight: 800;
    color: #0f172a;
    white-space: nowrap;
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

  .info-row-pair {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    padding: 3px 0;
    border-bottom: 1px solid #e9edf2;
  }

  .info-row-pair-left,
  .info-row-pair-right {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: baseline;
    gap: 0 8px;
    min-width: 0;
  }

  .info-row-pair-left {
    flex: 1;
  }

  .info-row-pair-right {
    flex: 0 0 auto;
    grid-template-columns: auto auto;
    justify-content: end;
    text-align: right;
  }

  .info-row-pair-right .info-label {
    text-align: right;
  }

  .info-row-pair-right .info-value {
    text-align: right;
    white-space: nowrap;
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

  /* ── Onarım / bina toplam bantları ── */
  .repair-totals-stack {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .repair-total-band {
    border: 1px solid #e2e8f0;
    border-top: 2px solid #cbd5e1;
    padding: 12px 20px;
    background: #f8fafc;
    text-align: center;
  }

  .repair-total-band-grand {
    background: #eef2ff;
    border-top-color: #64748b;
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

  .approval-trail-section {
    margin-top: 14px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #64748b;
  }

  .approval-trail-title {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .approval-trail-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .approval-trail-list li {
    font-size: 8pt;
    color: #334155;
    line-height: 1.45;
    padding: 5px 0;
    border-bottom: 1px dashed #e5e7eb;
  }

  .approval-trail-list li:last-child { border-bottom: none; }

  .approval-trail-step {
    font-weight: 700;
    color: #475569;
    margin-right: 4px;
  }

  .approval-trail-meta {
    color: #64748b;
    margin-right: 8px;
  }

  .approval-trail-who {
    font-weight: 600;
    color: #1e293b;
    margin-right: 8px;
  }

  .approval-trail-action {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 7.5pt;
    font-weight: 700;
  }

  .approval-trail-reason {
    margin-top: 2px;
    margin-left: 16px;
    color: #b91c1c;
    font-style: italic;
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
    padding: 12px 16px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 4px 4px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  .footer-generated {
    flex: 1;
    font-size: 7.5pt;
    color: #64748b;
    text-align: left;
    line-height: 1.35;
  }

  .footer-affiliation {
    flex: 1;
    font-size: 7.5pt;
    color: #475569;
    text-align: right;
    font-weight: 600;
    line-height: 1.35;
  }

  .qr-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
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

  /* ── Tespit resimleri eki: 3 sütun; 2–3. sayfaya taşabilir ── */
  .photo-gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    padding: 12px;
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
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .photo-img {
    width: 100%;
    height: 200px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
    display: block;
  }

  .photo-error {
    width: 100%;
    height: 200px;
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

<!-- HEADER: logo + başlık yan yana -->
<div class="report-header">
  ${headerBrandHtml}
  <div class="header-title-block">
    <div class="header-title">Hasar Tespit Ve Onarım Raporu</div>
    ${isDraft ? '<div class="header-draft-badge">Taslak</div>' : ''}
  </div>
</div>

<!-- DOSYA BİLGİLERİ -->
<div class="info-block">
  <div class="info-row-pair">
    <div class="info-row-pair-left">
      <span class="info-label">Eksper Ofisi</span>
      <span class="info-value">${escHtml(expertOfficeName)}</span>
    </div>
    <div class="info-row-pair-right">
      <span class="info-label">Tarih</span>
      <span class="info-value">${fmtDate(report.reportDate)}</span>
    </div>
  </div>
  <div class="info-row-full">
    <span class="info-label">Sigorta Şirketi</span>
    <span class="info-value">${escHtml(insuranceCompanyName)}</span>
  </div>
  <div class="info-row-full">
    <span class="info-label">Dosya Numarası</span>
    <span class="info-value">${escHtml(cf?.fileNo) || escHtml(report.reportNo)}</span>
  </div>
  <div class="info-row-full">
    <span class="info-label">Sigortalı</span>
    <span class="info-value">${escHtml(cf?.customer?.fullName ?? cf?.customer?.companyName ?? cf?.insuredName ?? cf?.commercialTitle)}</span>
  </div>
  <div class="info-row-full">
    <span class="info-label">Hasar Konusu</span>
    <span class="info-value">${escHtml(cf?.lossType) || '—'}</span>
  </div>
  ${formatQuickRepairSummary(report) ? `
  <div class="info-row-full">
    <span class="info-label">Hızlı Onarım Türü</span>
    <span class="info-value">${escHtml(formatQuickRepairSummary(report))}</span>
  </div>` : ''}
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

<!-- TOPLAMLAR -->
${viewType === 'external' ? externalTotalsHtml : `
<div class="totals-section">
  <div class="totals-grid">
    <div class="total-label">Bina Genel Toplam Hasarı</div>
    <div class="total-amount">${fmtCurrency(report.buildingDamageTotal)}</div>
    ${showGoodsTotal ? `
    <div class="total-label">Eşya Genel Toplam Hasarı</div>
    <div class="total-amount">${fmtCurrency(report.goodsDamageTotal)}</div>` : ''}
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

<!-- DİJİTAL ONAY İZLERİ -->
${approvalTrailHtml}

<!-- İMZA ALANLARI -->
<div class="signature-section">
  <div class="signature-box">
    <div class="signature-label">Tespiti Yapan</div>
    <div class="signature-line"></div>
    <div class="signature-name">${escHtml(resolveRepairReportExpertName(report) ?? '') || '..............................'}</div>
  </div>
</div>

<!-- TESPİT RESİMLERİ (RAPOR EKİ) -->
${photoGalleryHtml}

<!-- FOOTER -->
<div class="report-footer">
  <div class="footer-generated">Pdf Oluşturma: ${escHtml(fmtDateTime(generatedAt))}</div>
  <div class="qr-area">
    <img src="${qrUrl}" width="56" height="56" alt="QR Doğrulama" style="display:block;border-radius:4px;background:white;padding:3px;border:1px solid #e2e8f0;"/>
    <div class="qr-label">Rapor Doğrula</div>
  </div>
  <div class="footer-affiliation">Meridyen Assistance Safran Birleşik Hizmetler Yan Kuruluşudur</div>
</div>

</body>
</html>`;
  }
}
