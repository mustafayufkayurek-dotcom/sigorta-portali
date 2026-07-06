import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';

interface BriefPdfData {
  title: string;
  itemType: string;
  summaryText: string;
  fileNo: string;
  claimNo?: string | null;
  customerName?: string | null;
  address?: string | null;
  dimensions: Array<{
    label: string;
    genislikCm: number | null;
    yukseklikCm: number | null;
    derinlikCm: number | null;
  }>;
  materials: Array<{ name: string; quantity: string | null; note: string | null }>;
  aiConfidence?: number | null;
  createdAt: Date;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  mutfak_alt_modul: 'Mutfak Alt Modül',
  kapi: 'Kapı',
  lavabo_alt: 'Lavabo Alt',
  ada_tezgah: 'Ada Tezgah',
  parke: 'Parke',
  diger: 'Diğer',
};

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
  constructor(private readonly config: ConfigService) {}

  async generate(data: BriefPdfData): Promise<Buffer> {
    const html = this.buildHtml(data);
    return this.htmlToPdf(html);
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

  private buildHtml(data: BriefPdfData): string {
    const itemLabel = ITEM_TYPE_LABELS[data.itemType] ?? 'Diğer';
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
      data.aiConfidence != null
        ? `%${Math.round(data.aiConfidence * 100)}`
        : '—';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 10pt; margin: 0; }
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
    .footer { margin-top: 20px; font-size: 8pt; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="badge">Tahmini Keşif Ölçüsü</div>
  <h1>${escHtml(data.title)}</h1>
  <div class="meta">
    Dosya No: <strong>${escHtml(data.fileNo)}</strong>
    ${data.claimNo ? ` · Hasar ${escHtml(data.claimNo)}` : ''}
    ${data.customerName ? ` · ${escHtml(data.customerName)}` : ''}
    <br />
    Parça Tipi: ${escHtml(itemLabel)} · Tarih: ${fmtDate(data.createdAt)} · AI Güven: ${confidence}
  </div>
  ${data.address ? `<div class="meta">Adres: ${escHtml(data.address)}</div>` : ''}

  <div class="section">
    <h2>Marangoz Özeti</h2>
    <div class="summary">${escHtml(data.summaryText || '—')}</div>
  </div>

  <div class="section">
    <h2>Tahmini Ölçü Modülleri</h2>
    <table>
      <thead>
        <tr>
          <th>Modül</th>
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

  <div class="footer">
    Bu belge tahmini keşif ölçüsüdür; kesin ölçü saha doğrulaması gerektirir. Meridyen — ${escHtml(this.config.get('APP_NAME', 'Meridyen'))}
  </div>
</body>
</html>`;
  }
}
