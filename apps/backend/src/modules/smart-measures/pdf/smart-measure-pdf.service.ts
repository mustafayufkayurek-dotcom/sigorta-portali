import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import {
  SMART_MEASURE_ELEMENT_TYPE_LABELS,
  type SmartMeasureElementType,
} from '../smart-measure-element-types';
import type { SmartMeasureMetrajLine } from '../smart-measure-metraj';
import {
  AI_CONFIDENCE_LEVEL_LABELS,
  mmToCm,
  type AiConfidenceLevel,
} from '../smart-measure-metrics';

export const SMART_MEASURE_MANUFACTURING_NOTE =
  'Belirtilen ölçüler tespit ölçüleri olup, İmalat Ölçüleri Ayrıca Alınacaktır.';

export type SmartMeasurePdfData = {
  title: string;
  elementType: string;
  fileNo: string;
  claimNo?: string | null;
  customerName?: string | null;
  locationLabel?: string | null;
  roomLabel?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  areaM2?: number | null;
  perimeterM?: number | null;
  quantity?: number | null;
  aiConfidence?: number | null;
  aiConfidenceLevel?: string | null;
  aiDetectedType?: string | null;
  measuredAt: Date;
  measuredByName?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  deviceInfo?: Record<string, unknown> | null;
  metraj: SmartMeasureMetrajLine[];
  photoDataUrl?: string | null;
  versionNo: number;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMmAsCm(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return '—';
  return `${mmToCm(mm).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} cm`;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class SmartMeasurePdfService {
  async generate(data: SmartMeasurePdfData): Promise<Buffer> {
    const html = this.buildHtml(data);
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

  private buildHtml(data: SmartMeasurePdfData): string {
    const typeLabel =
      SMART_MEASURE_ELEMENT_TYPE_LABELS[data.elementType as SmartMeasureElementType] ??
      data.elementType;
    const place = [data.locationLabel, data.roomLabel].filter(Boolean).join(' · ') || '—';
    const levelLabel =
      data.aiConfidenceLevel && data.aiConfidenceLevel in AI_CONFIDENCE_LEVEL_LABELS
        ? AI_CONFIDENCE_LEVEL_LABELS[data.aiConfidenceLevel as AiConfidenceLevel]
        : null;
    const conf =
      levelLabel ??
      (data.aiConfidence != null && Number.isFinite(data.aiConfidence)
        ? `%${Math.round((data.aiConfidence <= 1 ? data.aiConfidence : data.aiConfidence / 100) * 100)}`
        : '—');
    const gps =
      data.gpsLat != null && data.gpsLng != null
        ? `${data.gpsLat.toFixed(5)}, ${data.gpsLng.toFixed(5)}`
        : '—';
    const device =
      data.deviceInfo && typeof data.deviceInfo === 'object'
        ? [data.deviceInfo['brand'], data.deviceInfo['modelName'], data.deviceInfo['osName']]
            .filter(Boolean)
            .join(' · ') || '—'
        : '—';

    const metrajRows =
      data.metraj.length > 0
        ? data.metraj
            .map(
              (m) => `
        <tr>
          <td>${escHtml(m.label)}</td>
          <td class="num">${escHtml(m.quantityText)}</td>
          <td>${escHtml(m.unit)}</td>
          <td>${escHtml(m.note ?? '—')}</td>
        </tr>`,
            )
            .join('')
        : `<tr><td colspan="4" style="color:#6b7280">Metraj satırı yok</td></tr>`;

    const photoBlock = data.photoDataUrl
      ? `<div class="section"><h2>Ölçüm Fotoğrafı</h2>
         <img class="photo" src="${escHtml(data.photoDataUrl)}" alt="Ölçüm fotoğrafı" /></div>`
      : `<div class="section"><h2>Ölçüm Fotoğrafı</h2>
         <div class="muted">Fotoğraf bu kayıtta yok.</div></div>`;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Akıllı Ölçüm</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 18px 0 8px; color: #1e3a8a; }
  .note { background: #fff7ed; border: 1px solid #fed7aa; padding: 8px 10px; border-radius: 8px; margin: 10px 0 14px; font-size: 11px; }
  .meta { color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .section { margin-top: 8px; }
  .photo { max-width: 100%; max-height: 280px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .muted { color: #6b7280; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin: 8px 0 12px; }
  .grid div span { color: #64748b; display: block; font-size: 10px; }
</style>
</head>
<body>
  <h1>${escHtml(data.title || typeLabel)}</h1>
  <div class="meta">Dosya ${escHtml(data.fileNo)}${data.claimNo ? ` · Hasar ${escHtml(data.claimNo)}` : ''} · Sürüm ${data.versionNo}</div>
  <div class="note">${escHtml(SMART_MEASURE_MANUFACTURING_NOTE)}</div>

  <div class="grid">
    <div><span>Yapı Elemanı</span><strong>${escHtml(typeLabel)}</strong></div>
    <div><span>Mahal / Oda</span><strong>${escHtml(place)}</strong></div>
    <div><span>Genişlik</span><strong>${fmtMmAsCm(data.widthMm)}</strong></div>
    <div><span>Yükseklik</span><strong>${fmtMmAsCm(data.heightMm)}</strong></div>
    <div><span>Derinlik</span><strong>${fmtMmAsCm(data.depthMm)}</strong></div>
    <div><span>Alan</span><strong>${data.areaM2 != null ? `${data.areaM2} m²` : '—'}</strong></div>
    <div><span>Çevre</span><strong>${data.perimeterM != null ? `${data.perimeterM} m` : '—'}</strong></div>
    <div><span>Adet</span><strong>${data.quantity ?? 1}</strong></div>
    <div><span>AI Güven</span><strong>${escHtml(conf)}</strong></div>
    <div><span>AI Tanımı</span><strong>${escHtml(data.aiDetectedType ?? '—')}</strong></div>
    <div><span>Ölçüm Tarihi</span><strong>${escHtml(fmtDateTime(data.measuredAt))}</strong></div>
    <div><span>Ölçen Personel</span><strong>${escHtml(data.measuredByName ?? '—')}</strong></div>
    <div><span>GPS</span><strong>${escHtml(gps)}</strong></div>
    <div><span>Cihaz</span><strong>${escHtml(device)}</strong></div>
    <div><span>Sigortalı / Müşteri</span><strong>${escHtml(data.customerName ?? '—')}</strong></div>
  </div>

  <div class="section">
    <h2>Otomatik Metraj</h2>
    <table>
      <thead><tr><th>Kalem</th><th>Miktar</th><th>Birim</th><th>Not</th></tr></thead>
      <tbody>${metrajRows}</tbody>
    </table>
  </div>

  ${photoBlock}
</body>
</html>`;
  }
}
