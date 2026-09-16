import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { mapInboundLossTypeToMeridyen } from '@sigorta/shared';

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Müşteriye dönük matbu — iç fiyat / kâr etiketleri sızmaz */
const INTERNAL_COST_DESC_RE =
  /alış\s*fiyat|satış\s*fiyat|tedarikçi\s*alış|tedarikçi\s*maliyet|müşteri\s*satış|meridyen\s*satış|kâr\s*oran|kar\s*oran/i;

/** Gelen kutu / asistans imza bloğu — servis formuna basılmaz */
const INBOUND_DUMP_RE =
  /gelen\s*kutusu|bu form otomatik|asistan firması\s*:|dosya sorumlusu\s*:|mail kuyruğ|konut hasar ihbar|remed assistance|tugba\.karatay|büyükdere\s*cad|noramin iş|sigorta poliçe|onay alınmalıdır|ihbar mail|bu e-posta/i;

export function isCustomerFacingWorkSummary(description: string | null | undefined): boolean {
  const t = (description ?? '').trim();
  if (!t) return false;
  if (INTERNAL_COST_DESC_RE.test(t)) return false;
  return true;
}

export function isInboundMailDump(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (INBOUND_DUMP_RE.test(t)) return true;
  if (t.length > 400) {
    const needle = t.slice(0, 48).trim();
    if (needle.length >= 32 && t.indexOf(needle, 60) !== -1) return true;
  }
  const emailHits = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).length;
  const telHits = (t.match(/(\+90|0)\s*5\d{2}/g) ?? []).length;
  if (t.length > 500 && (emailHits >= 2 || telHits >= 2)) return true;
  return false;
}

function usableWorkLine(text: string | null | undefined): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  if (!isCustomerFacingWorkSummary(t)) return '';
  if (isInboundMailDump(t)) return '';
  return t;
}

export function buildEmergencyMatbuWorkSummary(ec: {
  issueType: string;
  notes?: string | null;
  findingsText?: string | null;
  costEntries: Array<{ description: string; entryType?: string }>;
}): string {
  const findings = usableWorkLine(ec.findingsText);
  if (findings) return findings;

  const usable = (ec.costEntries ?? [])
    .map((c) => usableWorkLine(c.description))
    .filter(Boolean);
  if (usable.length > 0) {
    return usable.map((d) => `• ${d}`).join('\n');
  }

  const notes = usableWorkLine(ec.notes);
  if (notes) return notes;

  const issueCanonical =
    mapInboundLossTypeToMeridyen(ec.issueType)
    ?? ((ec.issueType ?? '').trim() || 'Acil Yardım');
  return `${issueCanonical} hizmeti için onay talep edilmektedir.`;
}

function foldLabel(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function alreadyInStreet(street: string, piece: string): boolean {
  const p = piece.trim();
  if (!p) return true;
  return foldLabel(street).includes(foldLabel(p));
}

/** Hasar PDF adresi gibi: sokak, ilçe, il; ayrı «İlçe / İl» satırı yok. */
export function formatMatbuFileAddress(input: {
  address?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const street = (input.address ?? '').replace(/\s*(?:Tel(?:efon)?|GSM|Cep)\s*[:：]\s*\+?\d[\d\s()]{6,}\d/gi, '').trim();
  const district = (input.district ?? '').trim();
  const city = (input.city ?? '').trim();
  const parts: string[] = [];
  if (street) parts.push(street);
  if (district && !alreadyInStreet(street, district)) parts.push(district);
  if (city && city !== district && !alreadyInStreet(street, city)) parts.push(city);
  return parts.join(', ') || '—';
}

export function resolveEmergencyMatbuIdentity(ec: {
  customerName: string;
  customerPhone?: string | null;
  address: string;
  city?: string | null;
  district?: string | null;
  fileNo?: string | null;
  caseNo: string;
  customer?: {
    companyName?: string | null;
    shortName?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    subType?: string | null;
    phone?: string | null;
  } | null;
}): {
  anaMusteri: string;
  sigortaSirketi: string;
  sigortaliAd: string;
  sigortaliTelefon: string;
  sigortaliAdres: string;
  dosyaNo: string;
} {
  const c = ec.customer;
  const shortName = c?.shortName?.trim() || '';
  const company = c?.companyName?.trim() || '';
  const composed = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
  const firmLong = company || c?.fullName?.trim() || composed || '';
  const firm =
    shortName
    || (company.length > 28 ? company.split(/\s+/)[0] : '')
    || firmLong;
  const person = (ec.customerName ?? '').trim();
  const same = Boolean(firm && person && foldLabel(firm) === foldLabel(person));
  const sigortaliAd = person && (!firm || !same) ? person : (person && !firm ? person : '—');
  const anaMusteri = firm || '—';
  const sub = (c?.subType ?? '').toLowerCase();
  const sigortaSirketi = sub === 'sigorta_sirketi' && firm ? firm : '—';
  const phone = (ec.customerPhone ?? '').trim() || (c?.phone ?? '').trim() || '—';
  return {
    anaMusteri,
    sigortaSirketi,
    sigortaliAd: sigortaliAd || '—',
    sigortaliTelefon: phone,
    sigortaliAdres: formatMatbuFileAddress({
      address: ec.address,
      district: ec.district,
      city: ec.city,
    }),
    dosyaNo: (ec.fileNo ?? '').trim() || ec.caseNo,
  };
}

export function splitKdvDahil(gross: number): { matrah: string; kdv: string; toplam: string } {
  const n = Number.isFinite(gross) ? Math.max(0, gross) : 0;
  const net = n / 1.2;
  const vat = n - net;
  const fmt = (x: number) =>
    x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { matrah: fmt(net), kdv: fmt(vat), toplam: fmt(n) };
}

/** Acil gelir KDV hariçtir; kapanış raporu «TL +KDV» ile aynı. */
export function splitKdvHaric(net: number): { matrah: string; kdv: string; toplam: string } {
  const n = Number.isFinite(net) ? Math.max(0, net) : 0;
  const vat = Math.round(n * 0.2 * 100) / 100;
  const gross = Math.round((n + vat) * 100) / 100;
  const fmt = (x: number) =>
    x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { matrah: fmt(n), kdv: fmt(vat), toplam: fmt(gross) };
}
export const HASAR_REPORT_PHOTO_BOX = { width: 240, height: 156 } as const;

export function isMatbuImageFile(mime: string | null | undefined, fileName: string | null | undefined): boolean {
  if ((mime || '').toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(fileName || '');
}

export function formatWorkSummaryHtml(text: string): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '—';
  return escAttr(trimmed);
}

export function buildEmergencyMatbuApprovalTrailHtml(opts: {
  approvedFullName?: string | null;
  approvedAt?: Date | string | null;
  ip?: string | null;
}): string {
  const who = (opts.approvedFullName ?? '').trim();
  const at = opts.approvedAt ? new Date(opts.approvedAt) : null;
  const validAt = at && !Number.isNaN(at.getTime()) ? at : null;
  if (!who || !validAt) {
    return `<div class="approval-trail-title">Dijital Onay İzleri</div>
<ol class="approval-trail-list">
  <li>
    <span class="approval-trail-step">1.</span>
    <span class="approval-trail-who">Sigortalı</span>
    <span class="approval-trail-action">Bekliyor</span>
  </li>
</ol>`;
  }
  const when = validAt.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const ip = (opts.ip ?? '').trim();
  const ipHtml = ip ? ` · IP ${escAttr(ip)}` : '';
  return `<div class="approval-trail-title">Dijital Onay İzleri</div>
<ol class="approval-trail-list">
  <li>
    <span class="approval-trail-step">1.</span>
    <span class="approval-trail-meta">${escAttr(when)}${ipHtml}</span>
    <span class="approval-trail-who">${escAttr(who)}</span>
    <span class="approval-trail-action">Onayladı</span>
  </li>
</ol>`;
}

export function meridyenLogoDataUri(): string {
  const here = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const fileNames = ['meridyen-logo-report.png', 'meridyen-logo-original.png'];
  const dirs = [
    join(here, '../../../assets'),
    join(process.cwd(), 'assets'),
    join(process.cwd(), 'apps/backend/assets'),
  ];
  const candidates = dirs.flatMap((dir) => fileNames.map((name) => join(dir, name)));
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
    } catch {
      /* sonraki aday */
    }
  }
  return '';
}

export function buildEmergencyMatbuPhotoHtml(
  photos: Array<{ dataUri: string; alt?: string }>,
): string {
  if (!photos.length) {
    return '<p class="photo-empty">Bu dosyada henüz resim yok.</p>';
  }
  const rows: string[] = [];
  for (let i = 0; i < photos.length; i += 3) {
    const cells = [0, 1, 2].map((offset) => {
      const p = photos[i + offset];
      if (!p) return '<td class="photo-cell photo-cell-empty"></td>';
      const alt = escAttr(p.alt || `Tespit ${i + offset + 1}`);
      const caption = p.alt
        ? `<div class="photo-caption">${escAttr(p.alt)}</div>`
        : '';
      return `<td class="photo-cell"><img src="${p.dataUri}" class="photo-img" alt="${alt}"/>${caption}</td>`;
    });
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<table class="photo-gallery">${rows.join('')}</table>`;
}

/** Acil servis formu — Hasar Tespit Ve Onarım Raporu PDF kabuğu. Eski özel şablon yok. */
export const EMERGENCY_MATBU_TEMPLATE = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Servis Onay Formu — {{case_no}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 12mm 10mm 14mm; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #1a202c;
    background: white;
    line-height: 1.4;
  }
  .report-sheet { max-width: 210mm; margin: 0 auto; }

  .report-header {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 12px 22px;
    border-radius: 4px 4px 0 0;
    display: grid;
    grid-template-columns: minmax(72px, auto) 1fr minmax(72px, auto);
    align-items: center;
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
  .header-brand {
    font-size: 9pt;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.5px;
  }
  .header-title-block { text-align: center; min-width: 0; }
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
    background: #ecfdf5;
    color: #047857;
  }

  .dijital-onay-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    text-align: center;
  }
  .dijital-onay-qr-code {
    display: inline-block;
    padding: 3px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: white;
  }
  .dijital-onay-qr-code svg { width: 64px; height: 64px; display: block; }
  .dijital-onay-qr-label { font-size: 7pt; color: #64748b; text-align: center; }
  .dijital-onay-link { display: inline-block; font-size: 7.5pt; font-weight: 700; color: #475569; }
  .dijital-onay-qr-hint { display: none; }

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
  .info-row-full {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    align-items: start;
    gap: 2px 8px;
    padding: 4px 0 8px;
    border-bottom: 1px solid #e9edf2;
    margin-bottom: 4px;
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
  }
  .findings-box {
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 12px 14px;
    background: #fffbf5;
  }
  .findings-text {
    font-size: 10pt;
    font-weight: 500;
    font-style: normal;
    color: #374151;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
  }

  .totals-section {
    border: 1px solid #e2e8f0;
    border-top: 2px solid #cbd5e1;
    padding: 14px 20px;
    margin-top: 14px;
    background: #f8fafc;
  }
  .tutar-box {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px 24px;
    max-width: 420px;
    margin-left: auto;
    align-items: baseline;
  }
  .tutar-box .label,
  .tutar-row-label {
    font-size: 9.5pt;
    color: #374151;
    font-weight: 500;
    text-align: right;
    padding: 4px 0;
    border-top: 1px solid #e2e8f0;
  }
  .tutar-box .value,
  .tutar-row-amount {
    font-size: 10pt;
    font-weight: 700;
    color: #374151;
    text-align: right;
    padding: 4px 0;
    border-top: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .tutar-box .label.grand,
  .tutar-box .value.grand {
    font-size: 11pt;
    font-weight: 800;
    color: #1e293b;
    padding: 8px 0 4px;
    border-top: 2px solid #94a3b8;
  }
  .tutar-uyari {
    font-size: 9.5pt;
    color: #475569;
    font-weight: 600;
    text-align: right;
    padding: 8px 0;
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
  .consent-text { font-size: 8pt; color: #4b5563; line-height: 1.5; }

  .signature-section {
    display: flex;
    justify-content: space-around;
    gap: 24px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 2px solid #e2e8f0;
  }
  .signature-box { flex: 1; text-align: center; max-width: 240px; }
  .signature-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .signature-name { font-size: 9pt; font-weight: 600; color: #1e293b; margin-bottom: 32px; }
  .signature-line { border-top: 1.5px solid #374151; width: 80%; margin: 0 auto 6px; }
  .signature-hint { font-size: 7.5pt; color: #64748b; }

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
  .approval-trail-list { list-style: none; padding: 0; margin: 0; }
  .approval-trail-list li {
    font-size: 8pt;
    color: #334155;
    line-height: 1.45;
    padding: 5px 0;
  }
  .approval-trail-step { font-weight: 700; color: #475569; margin-right: 4px; }
  .approval-trail-meta { color: #64748b; margin-right: 8px; }
  .approval-trail-who { font-weight: 600; color: #1e293b; margin-right: 8px; }
  .approval-trail-action {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 7.5pt;
    font-weight: 700;
  }

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
    object-position: center;
    background: #f8fafc;
    display: block;
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
  .photo-empty {
    margin: 0;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-top: none;
    color: #64748b;
    font-size: 9pt;
    background: #fafafa;
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
<div class="report-sheet" data-matbu-v="8"><!-- hasar-onarim-raporu-kabugu -->
<div class="report-header">
  <img class="header-logo" src="{{logo_url}}" alt="Meridyen Assistance" />
  <div class="header-title-block">
    <div class="header-title">Servis Onay Formu</div>
    <div class="header-usage-badge header-usage-external">Dış Kullanım</div>
  </div>
  {{dijital_onay_qr}}
</div>

<div class="info-block">
  <div class="info-row-full">
    <span class="info-label">Tarih</span>
    <span class="info-value">{{tarih}}</span>
  </div>
  <div class="info-id-grid">
    <div class="info-field">
      <span class="info-label">Ana Müşteri</span>
      <span class="info-value">{{ana_musteri}}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Sigortalı Ad Soyad</span>
      <span class="info-value">{{musteri_ad}}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Sigorta Şirketi</span>
      <span class="info-value">{{sigorta_sirketi}}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Sigortalı Telefon</span>
      <span class="info-value">{{musteri_telefon}}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Dosya Numarası</span>
      <span class="info-value">{{dosya_no}}</span>
    </div>
    <div class="info-field info-field-address">
      <span class="info-label">Sigortalı Adres</span>
      <span class="info-value">{{adres}}</span>
    </div>
    <div class="info-field">
      <span class="info-label">Dosya Konusu</span>
      <span class="info-value">{{konu}}</span>
    </div>
  </div>
</div>

<div class="section-header">Tespit Bulguları</div>
<div class="findings-box">
  <div class="findings-text">{{is_ozeti}}</div>
</div>

<div class="totals-section">
  <div class="tutar-box">
    <span class="label">Matrah (KDV hariç)</span>
    <span class="value">{{matrah}} ₺</span>
    <span class="label">KDV (%20)</span>
    <span class="value">{{kdv}} ₺</span>
    <span class="label grand">Hizmet Bedeli (KDV dahil)</span>
    <span class="value grand">{{toplam_tutar}} ₺</span>
  </div>
</div>

<div class="legal-section">
  <div class="legal-title">Onay Beyanı</div>
  <div class="consent-text">
    Ben, aşağıda imzası bulunan <strong>{{musteri_ad}}</strong>, Meridyen Assistance tarafından yukarıda
    belirtilen adreste gerçekleştirilen hizmeti ve açıklanan toplam bedeli onayladığımı beyan ederim.
    Dijital onay, bu dosya için hizmetin kabulü niteliğindedir.
  </div>
</div>

<div class="signature-section">
  <div class="signature-box">
    <div class="signature-label">Hizmet Veren</div>
    <div class="signature-name">Meridyen Assistance</div>
    <div class="signature-line"></div>
    <div class="signature-hint">İmza · Tarih</div>
  </div>
  <div class="signature-box">
    <div class="signature-label">Sigortalı</div>
    <div class="signature-name">{{musteri_ad}}</div>
    <div class="signature-line"></div>
    <div class="signature-hint">İmza · Tarih</div>
  </div>
</div>

<div class="appendix-block">
  <div class="section-header">Tespit Resimleri (Rapor Eki)</div>
  {{dosya_resimleri}}
</div>

<div class="approval-trail-section" data-testid="dijital-onay-izi">{{dijital_onay_izi}}</div>

<div class="report-footer">
  <div class="footer-generated">{{case_no}}<br/>Servis Onay Formu</div>
  <div></div>
  <div class="footer-affiliation">Meridyen Assistance Safran Birleşik Hizmetler Yan Kuruluşudur</div>
</div>
</div>
</body>
</html>`;

const TOTALS_SECTION_RE =
  /<div class="totals-section">\s*<div class="tutar-box">[\s\S]*?<\/div>\s*<\/div>/i;
const CONSENT_RE = /<div class="consent-text">[\s\S]*?<\/div>/i;

/** İhbar formu: aynı kabuk, ücret yok, başlık «Adres Ve Hizmet Talep Onayı». */
export function applyEmergencyFormKind(html: string, kind: string): string {
  if (!html || kind !== 'adres_hizmet_talep') return html;
  let out = html.replaceAll('Servis Onay Formu', 'Adres Ve Hizmet Talep Onayı');
  out = out.replace(TOTALS_SECTION_RE, '');
  out = out.replace(
    CONSENT_RE,
    '<div class="consent-text">Belirtilen adreste hizmet talep edildiğini ve bu adreste işlem yapılmasını onayladığımı beyan ederim. Yazıcı gerekmez; bu sayfadaki Onayla yeterlidir.</div>',
  );
  return out;
}

