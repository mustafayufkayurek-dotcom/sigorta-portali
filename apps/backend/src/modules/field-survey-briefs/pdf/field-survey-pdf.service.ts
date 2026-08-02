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
  dimensions: Array<{
    label: string;
    genislikCm: number | null;
    yukseklikCm: number | null;
    derinlikCm: number | null;
  }>;
  materials: Array<{ name: string; quantity: string | null; note: string | null }>;
  aiConfidence?: number | null;
  createdAt: Date;
  /** base64 data URI (image/jpeg|png) — saha fotoğrafı */
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

  /** Test / içerik doğrulama için HTML üretir. */
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
        margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
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
        : `<tr><td colspan="3" style="color:#6b7280">Malzeme kaydı yok</td></tr>`;

    const confidence =
      data.aiConfidence != null ? `%${Math.round(data.aiConfidence * 100)}` : '—';

    const photoHtml = data.photoDataUrl
      ? `<div class="section">
    <h2>Saha Fotoğrafı</h2>
    <img class="field-photo" src="${data.photoDataUrl}" alt="Saha fotoğrafı" />
  </div>`
      : '';

    /**
     * Internal: dosya / sigortalı / eksper / adres / ölçüm meta
     * Supplier: Sigortalı Adı Soyadı + iş kalemi — telefon/e-posta/adres/eksper iletişim YOK
     */
    const metaInternal = `
    Dosya No: <strong>${escHtml(data.fileNo)}</strong>
    ${data.claimNo ? ` · Hasar ${escHtml(data.claimNo)}` : ''}
    ${data.customerName ? ` · ${escHtml(data.customerName)}` : ''}
    ${data.expertName ? ` · Eksper: ${escHtml(data.expertName)}` : ''}
    <br />
    Parça Tipi: ${escHtml(itemLabel)} · Tarih: ${fmtDate(data.createdAt)} · Destek Skoru: ${confidence}
    ${data.address ? `<br />Adres: ${escHtml(data.address)}` : ''}`;

    const metaSupplier = `
    ${data.customerName ? `Sigortalı: <strong>${escHtml(data.customerName)}</strong><br />` : ''}
    İş Kalemi: <strong>${escHtml(itemLabel)}</strong>
    · Tarih: ${fmtDate(data.createdAt)}
    <br />
    Başlık: ${escHtml(data.title)}`;

    const badgeLabel = isSupplier ? 'Tedarikçi Keşif Ölçüsü' : 'Tahmini Keşif Ölçüsü';
    const titleHtml = `<h1>${escHtml(data.title)}</h1>`;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 10pt; margin: 0; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .header-logo { height: 40px; width: auto; object-fit: contain; }
    .header-brand-text { font-size: 14pt; font-weight: 700; color: #0f172a; }
    h1 { font-size: 16pt; margin: 0 0 4px; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 9pt; font-weight: 700; margin-bottom: 12px; }
    .meta { color: #6b7280; font-size: 9pt; margin-bottom: 14px; }
    .section { margin-top: 16px; }
    .section h2 { font-size: 11pt; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; font-size: 9pt; }
    td.num { text-align: right; white-space: nowrap; }
    .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; line-height: 1.45; }
    .field-photo { max-width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 6px; }
    .footer { margin-top: 20px; font-size: 8pt; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">${brandHtml}</div>
  <div class="badge">${escHtml(badgeLabel)}</div>
  ${titleHtml}
  <div class="meta">${isSupplier ? metaSupplier : metaInternal}</div>

  <div class="section">
    <h2>${isSupplier ? 'Teknik Açıklama' : 'Keşif Özeti'}</h2>
    <div class="summary">${escHtml(data.summaryText || '—')}</div>
  </div>

  <div class="section">
    <h2>${isSupplier ? 'Ölçüler' : 'Tahmini Ölçü Alanları'}</h2>
    <table>
      <thead>
        <tr>
          <th>Alan / Parça</th>
          <th>Genişlik (Tahmini)</th>
          <th>Yükseklik (Tahmini)</th>
          <th>Derinlik (Tahmini)</th>
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
