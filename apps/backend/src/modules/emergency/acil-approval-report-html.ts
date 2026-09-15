import * as fs from 'fs';
import * as path from 'path';
import { packAcilReportPhotoRows, type AcilReportPhoto } from './acil-report-photo-layout';

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

function parseReportDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function fmtDateTime(d: Date | string | null | undefined): string {
  const date = parseReportDate(d);
  if (!date) return '—';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAcilSlaDuration(
  from?: Date | string | null,
  to?: Date | string | null,
): string {
  const start = parseReportDate(from);
  const end = parseReportDate(to);
  if (!start || !end) return '—';
  let ms = end.getTime() - start.getTime();
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours <= 0 && mins <= 0) return '0 dk';
  if (hours <= 0) return `${mins} dk`;
  if (mins === 0) return `${hours} saat`;
  return `${hours} saat ${mins} dk`;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}

export function formatAcilAmountVat(n: number): string {
  return `${fmtCurrency(n)}+KDV`;
}

export function formatAcilCityNetwork(city?: string | null): string {
  const t = String(city ?? '').trim();
  if (!t) return '—';
  return `${t} Network`;
}

export function formatAcilSicilNo(raw?: string | null): string | null {
  const t = String(raw ?? '').trim();
  return t || null;
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
  city?: string | null;
  reporterName?: string | null;
  reporterSicilNo?: string | null;
  kind?: 'tespit' | 'kapanis';
  ihbarAt?: Date | string | null;
  workStartedAt?: Date | string | null;
  serviceDeliveredAt?: Date | string | null;
  closedAt?: Date | string | null;
  photoSectionTitle?: string | null;
  preWorkApprovals?: Array<{
    title: string;
    approvedFullName?: string | null;
    approvedAt?: Date | string | null;
  }>;
  photos: AcilReportPhoto[];
}): string {
  const logo = resolveLogoDataUrl();
  const headerBrand = logo
    ? `<img class="header-logo" src="${logo}" alt="Meridyen Assistance" />`
    : `<div class="header-brand">Meridyen Assistance</div>`;
  const generatedAt = new Date();
  const saleAmount = Number.isFinite(input.saleAmount) ? input.saleAmount : 0;
  const saleText = saleAmount > 0 ? fmtCurrency(saleAmount) : dash(input.saleLabel);
  const saleVatText = saleAmount > 0 ? formatAcilAmountVat(saleAmount) : dash(input.saleLabel);
  const findingsBody = (input.findings || '').trim() || '—';
  const cityNetwork = formatAcilCityNetwork(input.city);
  const reporterName = (input.reporterName || '').trim();
  const sicil = formatAcilSicilNo(input.reporterSicilNo);
  const reporterHtml = reporterName
    ? `${escapeHtml(reporterName)}${
        sicil ? ` <span class="reporter-sicil">(Sicil No ${escapeHtml(sicil)})</span>` : ''
      }`
    : '—';
  const isClosure = input.kind === 'kapanis';
  const headerTitle = isClosure ? 'Acil Yardım Dosya Kapanış Raporu' : 'Acil Yardım Tespit Raporu';
  const findingsTitle = isClosure ? 'Hizmet Özeti' : FINDINGS_SECTION_TITLE;
  const findingsLead = isClosure ? 'Riziko adreste verilen hizmet sonucunda;' : FINDINGS_LEAD;
  const photoHeader = (input.photoSectionTitle || '').trim()
    || (isClosure ? 'Hizmet Sonrası Resimleri' : 'Tespit Resimleri (Rapor Eki)');
  const legalLead = isClosure
    ? 'Bu rapor, Acil Yardım dosyasının kapanışı üzerine hazırlanmıştır.'
    : 'Bu rapor, Acil Yardım sahasında yapılan tespit sonucunda hazırlanmıştır.';
  const headerDate = isClosure ? (input.closedAt || input.reportDate) : input.reportDate;
  const slaEnd = input.serviceDeliveredAt || input.closedAt;
  const slaLine = isClosure
    ? formatAcilSlaDuration(input.workStartedAt, slaEnd)
    : '';
  const processFields = isClosure
    ? `<div class="info-field">
      <span class="info-label">İşe Başlama</span>
      <span class="info-value">${escapeHtml(fmtDateTime(input.workStartedAt))}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Hizmet Bitiş</span>
      <span class="info-value">${escapeHtml(fmtDateTime(input.serviceDeliveredAt))}</span>
    </div>
    <div class="info-field info-field-wide">
      <span class="info-label">SLA Süresi</span>
      <span class="info-value">${escapeHtml(slaLine)}</span>
    </div>`
    : '';
  const approvals = (input.preWorkApprovals ?? []).filter((row) => String(row.title ?? '').trim());
  const approvalRows = approvals.length
    ? approvals
        .map((row) => {
          const when = row.approvedAt ? fmtDateTime(row.approvedAt instanceof Date ? row.approvedAt : new Date(row.approvedAt)) : '—';
          const who = (row.approvedFullName || '').trim() || '—';
          return `<tr>
            <td>${dash(row.title)}</td>
            <td>${escapeHtml(who)}</td>
            <td class="text-center">${escapeHtml(when)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="3">İşlem öncesi dijital onay kaydı yok.</td></tr>';
  const photoRows = packAcilReportPhotoRows(input.photos)
    .map((row) => {
      const itemSpan = row.kind === 'landscape' ? (row.items.length === 1 ? 6 : 3) : 2;
      const cells = row.items.map((img) => {
        const caption = (img.caption ?? '').trim();
        const full = row.kind === 'landscape' && row.items.length === 1;
        return `<td class="photo-cell photo-cell-${row.kind}${full ? ' photo-cell-full' : ''}" colspan="${itemSpan}">` +
          `<img src="${img.dataUrl}" class="photo-img" alt="Tespit"/>` +
          (caption ? `<div class="photo-caption">${escapeHtml(caption)}</div>` : '') +
        `</td>`;
      });
      let filled = itemSpan * row.items.length;
      while (filled < 6) {
        cells.push('<td class="photo-cell photo-cell-empty" colspan="2"></td>');
        filled += 2;
      }
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');
  const gallery = input.photos.length
    ? `<div class="appendix-block">
        <div class="section-header">${photoHeader}</div>
        <table class="photo-gallery">
          <colgroup>
            <col style="width:16.66%"/><col style="width:16.66%"/><col style="width:16.66%"/>
            <col style="width:16.66%"/><col style="width:16.66%"/><col style="width:16.66%"/>
          </colgroup>
          ${photoRows}
        </table>
      </div>`
    : '';
  const closingClass = input.photos.length ? 'closing-block closing-block-next' : 'closing-block';

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
    padding: 8px 22px 10px;
    background: #f8fafc;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .info-id-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 18px;
    align-items: start;
  }
  .info-field {
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr);
    align-items: start;
    gap: 2px 8px;
    padding: 4px 0;
    border-bottom: 1px solid #e9edf2;
    min-width: 0;
  }
  .info-field-wide { grid-column: 1 / -1; }
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
  .reporter-sicil { font-style: italic; font-weight: 500; color: #475569; }
  .approval-table { margin-top: 0; }
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
  .photo-gallery tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .photo-cell {
    vertical-align: top;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  .photo-cell-portrait { width: 33.33%; }
  .photo-cell-landscape { width: 50%; }
  .photo-cell-empty { background: transparent; border: none; }
  .photo-img {
    width: 100%;
    object-fit: contain;
    background: #f8fafc;
    display: block;
    image-orientation: none;
  }
  .photo-cell-landscape .photo-img { height: 178px; }
  .photo-cell-landscape.photo-cell-full .photo-img { height: 240px; }
  .photo-cell-portrait .photo-img { height: 232px; }
  .photo-caption {
    font-size: 7.5pt;
    color: #475569;
    text-align: center;
    padding: 4px 8px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .closing-block {
    margin-top: 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .closing-block-next {
    page-break-before: always;
    break-before: page;
  }
  .legal-closing {
    padding: 14px 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .legal-closing .legal-title { margin-bottom: 10px; }
  .legal-closing .legal-list li {
    border-bottom: none;
    padding: 3px 0;
  }
  .signature-section {
    width: 100%;
    border-collapse: collapse;
    margin-top: 22px;
    table-layout: fixed;
  }
  .signature-section td {
    width: 50%;
    text-align: center;
    vertical-align: top;
    padding: 8px 24px 4px;
  }
  .signature-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    letter-spacing: 0.4px;
    margin-bottom: 28px;
  }
  .signature-line {
    border-top: 1.5px solid #334155;
    width: 78%;
    margin: 0 auto 8px;
  }
  .signature-name {
    font-size: 9.5pt;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.35;
  }
  .signature-stamp {
    margin-top: 6px;
    font-size: 8.5pt;
    font-weight: 700;
    font-style: italic;
    color: #047857;
  }
  .report-footer {
    margin-top: 16px;
    padding: 0;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .footer-meta {
    width: 100%;
    border-collapse: collapse;
    background: #e2e8f0;
  }
  .footer-meta td {
    padding: 8px 16px;
    vertical-align: middle;
    font-size: 7.5pt;
    color: #475569;
    line-height: 1.35;
  }
  .footer-generated { text-align: left; }
  .footer-affiliation {
    text-align: right;
    font-weight: 600;
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
    <div class="header-title">${headerTitle}</div>
    <div class="header-usage-badge header-usage-external">Dış Kullanım</div>
    <div class="header-date"><span class="header-date-label">Tarih</span>${fmtDate(headerDate)}</div>
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
    <div class="info-field${isClosure ? ' info-field-address' : ' info-field-wide info-field-address'}">
      <span class="info-label">Sigortalı Adres</span>
      <span class="info-value">${dash(input.address)}</span>
    </div>
    ${processFields}
  </div>
</div>

<div class="section-header">${findingsTitle}</div>
<div class="findings-box">
  <div class="findings-lead">${findingsLead}</div>
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
      <td class="text-center">Maktuen</td>
      <td class="text-right amount-cell">${saleText}</td>
      <td class="text-right amount-cell">${saleText}</td>
    </tr>
  </tbody>
</table>

<div class="repair-totals-stack">
  <div class="repair-total-band repair-total-band-grand">
    <div class="repair-total-label">${GRAND_TOTAL_LABEL}</div>
    <div class="repair-total-value">${saleVatText}</div>
  </div>
</div>

<div class="section-header">İşlem Öncesi Dijital Onaylar</div>
<table class="items-table approval-table">
  <thead>
    <tr>
      <th style="width:44%">Belge</th>
      <th style="width:28%">Onaylayan</th>
      <th style="width:28%">Tarih Saat</th>
    </tr>
  </thead>
  <tbody>${approvalRows}</tbody>
</table>

${gallery}

<div class="${closingClass}">
  <div class="legal-closing">
    <div class="legal-title">Yasal Uyarılar Ve Açıklamalar</div>
    <ul class="legal-list">
      <li><span class="legal-num">1.</span>${legalLead}</li>
      <li><span class="legal-num">2.</span>Belirtilen hizmet bedeli KDV hariçtir; yürürlükteki vergi mevzuatına göre KDV ayrıca hesaplanır.</li>
      <li><span class="legal-num">3.</span>Bu belge dış kullanımdır.</li>
      <li><span class="legal-num">4.</span>Bu rapor yalnız bu dosyanın tarafları içindir. İzinsiz çoğaltılamaz ve dağıtılamaz.</li>
    </ul>
  </div>
  <table class="signature-section">
    <tr>
      <td>
        <div class="signature-label">Tespiti Yapan</div>
        <div class="signature-line"></div>
        <div class="signature-name">${dash(cityNetwork)}</div>
        <div class="signature-stamp">Dijital Onaylı</div>
      </td>
      <td>
        <div class="signature-label">Raporlayan</div>
        <div class="signature-line"></div>
        <div class="signature-name">${reporterHtml}</div>
        <div class="signature-stamp">Dijital Onaylı</div>
      </td>
    </tr>
  </table>
</div>

<div class="report-footer">
  <table class="footer-meta">
    <tr>
      <td class="footer-generated">Pdf Oluşturma: ${escapeHtml(fmtDateTime(generatedAt))}<br/>Dış Kullanım</td>
      <td class="footer-affiliation">Meridyen Assistance Safran Birleşik Hizmetler Yan Kuruluşudur</td>
    </tr>
  </table>
</div>
</body>
</html>`;
}
