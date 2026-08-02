import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { FIELD_SURVEY_ITEM_TYPE_LABELS, type FieldSurveyItemType } from '../field-survey-item-types';

export type FieldSurveyPdfVariant = 'internal' | 'supplier';

export interface BriefPdfData {
  title: string;
  itemType: string;
  summaryText: string;
  fileNo: string;
  claimNo?: string | null;
  customerName?: string | null;
  address?: string | null;
  expertName?: string | null;
  /** Internal only — asla supplier HTML'e yazılmaz */
  customerPhone?: string | null;
  customerEmail?: string | null;
  expertPhone?: string | null;
  expertEmail?: string | null;
  policyNo?: string | null;
  dimensions: Array<{
    label: string;
    genislikCm: number | null;
    yukseklikCm: number | null;
    derinlikCm: number | null;
  }>;
  materials: Array<{ name: string; quantity: string | null; note: string | null }>;
  aiConfidence?: number | null;
  createdAt: Date;
  photoDataUrl?: string | null;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtCm(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} cm`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

@Injectable()
export class FieldSurveyPdfService {
  private readonly logger = new Logger(FieldSurveyPdfService.name);
  private logoDataUrlCache: string | null | undefined;

  constructor(private readonly config: ConfigService) {}

  async generate(data: BriefPdfData, variant: FieldSurveyPdfVariant = 'internal'): Promise<Buffer> {
    const html = this.buildHtml(data, variant);
    return this.htmlToPdf(html);
  }

  buildHtmlForTest(data: BriefPdfData, variant: FieldSurveyPdfVariant): string {
    return this.buildHtml(data, variant);
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

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

  private buildHtml(data: BriefPdfData, variant: FieldSurveyPdfVariant): string {
    const isSupplier = variant === 'supplier';
    const itemLabel = FIELD_SURVEY_ITEM_TYPE_LABELS[data.itemType as FieldSurveyItemType] ?? 'Diğer';
    const logoDataUrl = this.resolveLogoDataUrl();
    const brandHtml = logoDataUrl
      ? `<img class="header-logo" src="${logoDataUrl}" alt="Meridyen" />`
      : `<div class="header-brand-text">${escHtml(this.config.get('APP_NAME', 'Meridyen'))}</div>`;

    const dimsRows = data.dimensions
      .map(
        (d) => `
        <tr>
          <td>${escHtml(d.label)}</td>
          <td class="num">${fmtCm(d.genislikCm)}</td>
          <td class="num">${fmtCm(d.yukseklikCm)}</td>
          <td class="num">${fmtCm(d.derinlikCm)}</td>
        </tr>`,
      )
      .join('');

    const matRows =
      data.materials.length > 0
        ? data.materials
            .map(
              (m) => `
        <tr>
          <td>${escHtml(m.name)}</td>
          <td>${escHtml(m.quantity ?? '—')}</td>
          <td>${escHtml(m.note ?? '—')}</td>
        </tr>`,
            )
            .join('')
        : `<tr><td colspan="3" class="muted">Malzeme kaydı yok</td></tr>`;

    const confidence =
      data.aiConfidence != null ? `%${Math.round(data.aiConfidence * 100)}` : '—';

    const photoHtml = data.photoDataUrl
      ? `<div class="section">
    <h2>Saha Fotoğrafı</h2>
    <img class="field-photo" src="${data.photoDataUrl}" alt="Saha fotoğrafı" />
  </div>`
      : '';

    const metaInternal = `
    <div class="meta-grid">
      <div><span class="k">Dosya No</span> ${escHtml(data.fileNo)}</div>
      ${data.claimNo ? `<div><span class="k">Hasar No</span> ${escHtml(data.claimNo)}</div>` : ''}
      ${data.policyNo ? `<div><span class="k">Poliçe No</span> ${escHtml(data.policyNo)}</div>` : ''}
      ${data.customerName ? `<div><span class="k">Sigortalı</span> ${escHtml(data.customerName)}</div>` : ''}
      ${data.customerPhone ? `<div><span class="k">Telefon</span> ${escHtml(data.customerPhone)}</div>` : ''}
      ${data.customerEmail ? `<div><span class="k">E-posta</span> ${escHtml(data.customerEmail)}</div>` : ''}
      ${data.expertName ? `<div><span class="k">Eksper</span> ${escHtml(data.expertName)}</div>` : ''}
      ${data.expertPhone ? `<div><span class="k">Eksper Tel</span> ${escHtml(data.expertPhone)}</div>` : ''}
      ${data.expertEmail ? `<div><span class="k">Eksper E-posta</span> ${escHtml(data.expertEmail)}</div>` : ''}
      <div><span class="k">Parça</span> ${escHtml(itemLabel)}</div>
      <div><span class="k">Tarih</span> ${fmtDate(data.createdAt)}</div>
      <div><span class="k">Destek Skoru</span> ${confidence}</div>
      ${data.address ? `<div class="span2"><span class="k">Adres</span> ${escHtml(data.address)}</div>` : ''}
    </div>`;

    /** Supplier: yalnızca Sigortalı Adı + iş içeriği — iletişim/adres/eksper/dosya/poliçe/skor YOK */
    const metaSupplier = `
    <div class="meta-grid">
      ${data.customerName ? `<div><span class="k">Sigortalı</span> ${escHtml(data.customerName)}</div>` : ''}
      <div><span class="k">İş Kalemi</span> ${escHtml(itemLabel)}</div>
      <div><span class="k">Tarih</span> ${fmtDate(data.createdAt)}</div>
      <div class="span2"><span class="k">Başlık</span> ${escHtml(data.title)}</div>
    </div>`;

    const badgeLabel = isSupplier ? 'Tedarikçi Keşif Ölçüsü' : 'Tahmini Keşif Ölçüsü';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #1f2937; font-size: 9.5pt; margin: 0; line-height: 1.35; }
    .header { display: flex; align-items: flex-start; justify-content: flex-end; margin-bottom: 8px; min-height: 28px; }
    .header-logo { height: 28px; width: auto; max-width: 120px; object-fit: contain; }
    .header-brand-text { font-size: 11pt; font-weight: 700; color: #0f172a; }
    h1 { font-size: 13pt; margin: 0 0 4px; font-weight: 700; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; margin-bottom: 6px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; margin-bottom: 8px; font-size: 8.5pt; color: #374151; }
    .meta-grid .span2 { grid-column: 1 / -1; }
    .meta-grid .k { color: #6b7280; font-weight: 600; margin-right: 4px; }
    .section { margin-top: 8px; }
    .section h2 { font-size: 9.5pt; margin: 0 0 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    th, td { border: 1px solid #e5e7eb; padding: 3px 6px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 8pt; font-weight: 700; }
    td.num { text-align: right; white-space: nowrap; }
    td.muted { color: #6b7280; }
    .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; line-height: 1.4; font-size: 8.5pt; }
    .field-photo { max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; }
    .footer { margin-top: 10px; font-size: 7.5pt; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">${brandHtml}</div>
  <div class="badge">${escHtml(badgeLabel)}</div>
  <h1>${escHtml(data.title)}</h1>
  ${isSupplier ? metaSupplier : metaInternal}

  <div class="section">
    <h2>${isSupplier ? 'Teknik Açıklama' : 'Keşif Özeti'}</h2>
    <div class="summary">${escHtml(data.summaryText || '—')}</div>
  </div>

  <div class="section">
    <h2>${isSupplier ? 'Ölçüler' : 'Ölçü Alanları'}</h2>
    <table>
      <thead>
        <tr>
          <th>Alan / Parça</th>
          <th>Genişlik</th>
          <th>Yükseklik</th>
          <th>Derinlik</th>
        </tr>
      </thead>
      <tbody>${dimsRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Malzeme Listesi</h2>
    <table>
      <thead>
        <tr><th>Malzeme</th><th>Miktar</th><th>Not</th></tr>
      </thead>
      <tbody>${matRows}</tbody>
    </table>
  </div>

  ${photoHtml}

  <div class="footer">
    Bu belge tahmini saha keşif ölçüsüdür; kesin ölçü dosya onayı sonrası ilgili tedarikçi/usta tarafından sahada alınacaktır.
    Meridyen — ${escHtml(this.config.get('APP_NAME', 'Meridyen'))}
    ${isSupplier ? ' · Tedarikçi kopyası (iletişim ve adres bilgisi içermez)' : ''}
  </div>
</body>
</html>`;
  }
}
