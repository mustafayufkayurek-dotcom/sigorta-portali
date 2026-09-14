import * as fs from 'fs';
import * as path from 'path';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(value?: string | null): string {
  const t = (value || '').trim();
  return t ? escapeHtml(t) : '—';
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

function fmtCurrency(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0TL';
}

function fmtPhone(raw?: string | null): string {
  const source = (raw || '').trim();
  if (!source) return '—';
  const digits = source.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('90') && local.length >= 12) local = local.slice(2);
  else if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return source;
}

function resolveLogoDataUrl(): string | null {
  const fileNames = ['meridyen-logo-report.png', 'meridyen-logo-original.png'];
  const dirs = [
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), 'apps', 'backend', 'assets'),
  ];
  for (const dir of dirs) {
    for (const name of fileNames) {
      const candidate = path.join(dir, name);
      try {
        if (fs.existsSync(candidate)) {
          return `data:image/png;base64,${fs.readFileSync(candidate).toString('base64')}`;
        }
      } catch {
        /* sonraki */
      }
    }
  }
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const FINDINGS_SECTION_TITLE = 'Tespit Bulguları';
const FINDINGS_LEAD = 'Riziko adreste yapılan incelemeler sonucunda;';
const GRAND_TOTAL_LABEL = 'Rapor Genel Toplam';

export function buildAcilAssistanceApprovalReportHtml(input: {
  fileNo: string;
  customer: string;
  insured: string;
  insuredPhone?: string | null;
  address: string;
  subject: string;
  location?: string | null;
  workGroup?: string | null;
  jobDescription?: string | null;
  itemDescription?: string | null;
  findings: string;
  saleAmount: number;
  saleLabel: string;
  reportDate?: Date | string | null;
  inspectorName?: string | null;
  photos: Array<{ dataUrl: string; caption?: string }>;
}): string {
  const logo = resolveLogoDataUrl();
  const headerBrand = logo
    ? `<img class="header-logo" src="${logo}" alt="Meridyen Assistance" />`
    : `<div class="header-brand">Meridyen Assistance</div>`;
  const generatedAt = new Date();
  const saleAmount = Number.isFinite(input.saleAmount) ? input.saleAmount : 0;
  const saleText = saleAmount > 0 ? fmtCurrency(saleAmount) : dash(input.saleLabel);
  const findingsBody = (input.findings || '').trim() || '—';
  const inspector = (input.inspectorName || '').trim();
  const photoRows = chunk(input.photos, 3)
    .map((row) => {
      const cells = [0, 1, 2]
        .map((idx) => {
          const img = row[idx];
          if (!img) return '<td class="photo-cell photo-cell-empty"></td>';
          const caption = (img.caption ?? '').trim();
          return `<td class="photo-cell"><img src="${img.dataUrl}" class="photo-img" alt="Tespit"/>${
            caption ? `<div class="photo-caption">${escapeHtml(caption)}</div>` : ''
          }</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const gallery = input.photos.length
    ? `<div class="appendix-block">
        <div class="section-header">Tespit Resimleri (Rapor Eki)</div>
        <table class="photo-gallery">${photoRows}</table>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #1a202c;
    background: white;
    line-height: 1.4;
  }
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
  }
  .header-brand { font-size: 9pt; font-weight: 600; color: #64748b; letter-spacing: 0.5px; }
  .header-title-block { flex: 1; text-align: right; min-width: 0; }
  .header-title {
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #1e293b;
    line-height: 1.25;
  }
  .header-usage-badge {
    display: inline-block;
    margin-top: 4px;
    border-radius: 3px;
    padding: 1px 10px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.6px;
  }
  .header-usage-external { background: #ecfdf5; color: #047857; }
  .header-date {
    margin-top: 8px;
    font-size: 9pt;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
  }
  .header-date-label {
    font-size: 7.5pt;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-right: 8px;
  }
  .info-block {
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 8px 22px;
    background: #f8fafc;
  }
  .info-id-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 18px;
    align-items: start;
  }
  .info-field {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    align-items: start;
    gap: 2px 8px;
    padding: 4px 0;
    border-bottom: 1px solid #e9edf2;
    min-width: 0;
  }
  .info-field-address { grid-row: span 2; align-self: stretch; }
  .info-label {
    font-size: 7.5pt;
    color: #64748b;
    font-weight: 600;
    letter-spacing: 0.2px;
    line-height: 1.3;
  }
  .info-value {
    font-size: 9pt;
    font-weight: 600;
    color: #1e293b;
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1.35;
    min-width: 0;
  }
  .info-field-address .info-value { line-height: 1.4; }
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
    break-after: avoid;
    page-break-after: avoid;
  }
  .findings-box {
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 12px 14px;
    background: #fffbf5;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .findings-lead {
    font-size: 10pt;
    font-weight: 700;
    font-style: italic;
    color: #1e293b;
    margin-bottom: 6px;
  }
  .findings-text {
    font-size: 10pt;
    font-weight: 500;
    color: #374151;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
    font-size: 8.5pt;
    border: 1px solid #e2e8f0;
    border-top: none;
    table-layout: fixed;
  }
  .items-table thead tr { background: #f1f5f9; color: #374151; }
  .items-table thead th {
    padding: 6px 4px;
    font-weight: 700;
    font-size: 7.5pt;
    text-align: center;
    vertical-align: middle;
    border-right: 1px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
  }
  .items-table thead th:last-child { border-right: none; }
  .row-even td { background: #ffffff; }
  .items-table td {
    padding: 4px 5px;
    border-right: 1px solid #e8ecf0;
    border-bottom: 1px solid #f0f4f8;
    vertical-align: middle;
  }
  .items-table td:last-child { border-right: none; }
  .mahal-cell, .job-desc-cell, .desc-cell {
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.3;
    vertical-align: top;
  }
  .text-center { text-align: center; white-space: nowrap; }
  .text-right { text-align: right; white-space: nowrap; }
  .amount-cell { font-weight: 600; color: #374151; white-space: nowrap; }
  .repair-totals-stack { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
  .repair-total-band {
    border: 1px solid #e2e8f0;
    border-top: 2px solid #cbd5e1;
    padding: 12px 20px;
    background: #f8fafc;
    text-align: center;
  }
  .repair-total-band-grand { background: #eef2ff; border-top-color: #64748b; }
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
  .legal-list { list-style: none; padding: 0; margin: 0; }
  .legal-list li {
    font-size: 8pt;
    color: #4b5563;
    line-height: 1.5;
    padding: 2.5px 0;
    border-bottom: 1px dashed #e5e7eb;
  }
  .legal-list li:last-child { border-bottom: none; }
  .legal-num { font-weight: 700; color: #475569; margin-right: 3px; }
  .signature-section {
    display: flex;
    justify-content: space-around;
    gap: 24px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 2px solid #e2e8f0;
  }
  .signature-box { flex: 1; text-align: center; max-width: 200px; }
  .signature-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 32px;
  }
  .signature-line { border-top: 1.5px solid #374151; width: 80%; margin: 0 auto 6px; }
  .signature-name { font-size: 9pt; font-weight: 600; color: #1e293b; }
  .appendix-block { margin-top: 12px; }
  .photo-gallery {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 8px;
    padding: 4px 6px 8px;
    border: 1px solid #e2e8f0;
    border-top: none;
    background: #fafafa;
  }
  .photo-cell {
    width: 33.33%;
    vertical-align: top;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  .photo-cell-empty { background: transparent; border: none; }
  .photo-img {
    width: 100%;
    height: 156px;
    object-fit: contain;
    background: #f8fafc;
    display: block;
  }
  .photo-caption {
    font-size: 7.5pt;
    color: #475569;
    text-align: center;
    padding: 4px 8px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .report-footer {
    margin-top: 14px;
    padding: 12px 16px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 4px 4px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: end;
    column-gap: 12px;
  }
  .footer-generated { font-size: 7.5pt; color: #64748b; text-align: left; line-height: 1.35; }
  .footer-affiliation {
    font-size: 7.5pt;
    color: #475569;
    text-align: right;
    font-weight: 600;
    line-height: 1.35;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="report-header">
  ${headerBrand}
  <div class="header-title-block">
    <div class="header-title">Acil Yardım Tespit Raporu</div>
    <div class="header-usage-badge header-usage-external">Dış Kullanım</div>
    <div class="header-date"><span class="header-date-label">Tarih</span>${fmtDate(input.reportDate)}</div>
  </div>
</div>

<div class="info-block">
  <div class="info-id-grid">
    <div class="info-field">
      <span class="info-label">Müşteri</span>
      <span class="info-value">${dash(input.customer)}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Sigortalı Ad Soyad</span>
      <span class="info-value">${dash(input.insured)}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Dosya Numarası</span>
      <span class="info-value">${dash(input.fileNo)}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Sigortalı Telefon</span>
      <span class="info-value">${escapeHtml(fmtPhone(input.insuredPhone))}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Dosya Konusu</span>
      <span class="info-value">${dash(input.subject)}</span>
    </div>
    <div class="info-field info-field-address">
      <span class="info-label">Sigortalı Adres</span>
      <span class="info-value">${dash(input.address)}</span>
    </div>
  </div>
</div>

<div class="section-header">${FINDINGS_SECTION_TITLE}</div>
<div class="findings-box">
  <div class="findings-lead">${FINDINGS_LEAD}</div>
  <div class="findings-text">${escapeHtml(findingsBody)}</div>
</div>

<table class="items-table" style="margin-top:14px;border-top:2px solid #cbd5e1;">
  <thead>
    <tr>
      <th style="width:12%">İş Grubu</th>
      <th style="width:12%">Mahal/Bölge</th>
      <th style="width:28%">İşin Tanımı</th>
      <th style="width:16%">Açıklama</th>
      <th style="width:7%" class="th-num">Miktar</th>
      <th style="width:8%" class="th-num">Birim</th>
      <th style="width:8%" class="th-num">Birim Fiyat</th>
      <th style="width:9%" class="th-num">Bedel</th>
    </tr>
  </thead>
  <tbody>
    <tr class="row-even">
      <td>${dash(input.workGroup)}</td>
      <td class="mahal-cell">${dash(input.location)}</td>
      <td class="job-desc-cell">${dash(input.jobDescription)}</td>
      <td class="desc-cell">${dash(input.itemDescription)}</td>
      <td class="text-center">1</td>
      <td class="text-center">Hizmet</td>
      <td class="text-right amount-cell">${saleText}</td>
      <td class="text-right amount-cell">${saleText}</td>
    </tr>
  </tbody>
</table>

<div class="repair-totals-stack">
  <div class="repair-total-band repair-total-band-grand">
    <div class="repair-total-label">${GRAND_TOTAL_LABEL}</div>
    <div class="repair-total-value">${saleText} +KDV</div>
  </div>
</div>

<div class="legal-section">
  <div class="legal-title">Yasal Uyarılar Ve Açıklamalar</div>
  <ul class="legal-list">
    <li><span class="legal-num">1.</span>Bu rapor, Acil Yardım sahasında yapılan tespit sonucunda hazırlanmıştır.</li>
    <li><span class="legal-num">2.</span>Belirtilen hizmet bedeli KDV hariçtir; yürürlükteki vergi mevzuatına göre KDV ayrıca hesaplanır.</li>
    <li><span class="legal-num">3.</span>Bu belge dış kullanımdır.</li>
  </ul>
</div>

<div class="signature-section">
  <div class="signature-box">
    <div class="signature-label">Tespiti Yapan</div>
    <div class="signature-line"></div>
    <div class="signature-name">${dash(inspector)}</div>
  </div>
</div>

${gallery}

<div class="report-footer">
  <div class="footer-generated">Pdf Oluşturma: ${escapeHtml(fmtDateTime(generatedAt))}<br/>Dış Kullanım</div>
  <div></div>
  <div class="footer-affiliation">Meridyen Assistance Safran Birleşik Hizmetler Yan Kuruluşudur</div>
</div>
</body>
</html>`;
}
