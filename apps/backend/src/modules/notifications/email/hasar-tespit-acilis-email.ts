/**
 * Hasar Tespit Süreci Başlatıldı — ilk muhataba (Sigorta → Broker → Eksper).
 * Kaynak: meridyen-broker-acente-son-kodlar / tasarim-kaynagi.html (açık tema).
 * E-posta istemcisi grid/flex, script ve object-fit desteklemez; düzen tablodur, stil satır içidir.
 */
import { joinMailSubjectParts } from './email.template';
import { resolveMailWideLogoUrl } from './email-brand.util';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dash(value?: string | null): string {
  return escapeHtml(String(value ?? '').trim() || '—');
}

const C = {
  page: '#eaf0f5',
  paper: '#ffffff',
  ink: '#132b46',
  muted: '#627386',
  line: '#dce4ed',
  soft: '#f2f6fa',
  navy: '#102d4d',
  blue: '#175aa4',
  heroLine: '#2479c4',
  heroSub: '#d2dfec',
};
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif`;

function icon(name: 'phone' | 'mail' | 'clipboard' | 'wrench' | 'building' | 'arrow', size: number, color: string): string {
  const paths: Record<typeof name, string> = {
    phone:
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    clipboard:
      '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    wrench:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    building:
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  };
  const gap = name === 'arrow' ? 'margin-left:12px;' : 'margin-right:6px;';
  return `<span style="display:inline-block;vertical-align:middle;${gap}line-height:0;"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">${paths[name]}</svg></span>`;
}

/** 0533 633 07 13 */
export function formatHasarTespitMailPhone(raw?: string | null): { label: string; href: string } | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('90') && local.length > 10) local = local.slice(-10);
  if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (local.length !== 10) return null;
  return {
    label: `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`,
    href: `+90${local}`,
  };
}

/** Operasyon Bölgesi: {İl}-{İlçe} Network */
export function hasarTespitNetworkLabel(city?: string | null, district?: string | null): string | null {
  const il = String(city ?? '').trim();
  const ilce = String(district ?? '').trim();
  if (!il || /^belirtilmemi[sş]$/i.test(il)) return null;
  return ilce ? `${il}-${ilce} Network` : `${il} Network`;
}

export function formatHasarTespitOpenedDay(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
}

export type HasarTespitAcilisEmailData = {
  organizationName?: string | null;
  /** Pazarlama alanı yalnız broker / acente alıcısında durur. */
  recipientParty?: 'insurance' | 'agency' | 'broker' | 'expert' | null;
  insuranceCompanyName?: string | null;
  fileNo: string;
  insuredName?: string | null;
  fileSubject?: string | null;
  city?: string | null;
  district?: string | null;
  /** «13.11.2026 09:41» veya yalnız tarih */
  notificationAtLabel?: string | null;
  openedAt?: Date | string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  portalUrl?: string;
};

export function hasarTespitAcilisSubject(insuranceCompanyName?: string | null, fileNo?: string | null): string {
  return joinMailSubjectParts(insuranceCompanyName, fileNo, 'Hasar Tespit Süreci Başlatıldı');
}

function fieldRow(label: string, valueHtml: string): string {
  return `
                    <tr>
                      <td width="142" class="mp-label" style="width:142px;padding:11px 20px 11px 0;border-bottom:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.muted};vertical-align:top;">${label}</td>
                      <td style="padding:11px 0;border-bottom:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.ink};font-weight:500;vertical-align:top;word-break:break-word;">${valueHtml}</td>
                    </tr>`;
}

export function buildHasarTespitAcilisEmailHtml(data: HasarTespitAcilisEmailData): string {
  const logoUrl = escapeHtml(resolveMailWideLogoUrl(data.portalUrl));
  const openedDay = formatHasarTespitOpenedDay(data.openedAt);
  const notification = String(data.notificationAtLabel ?? '').trim().replace(/^(\d{2}\.\d{2}\.\d{4}) (\d{2}:\d{2})$/, '$1 · $2');
  const city = String(data.city ?? '').trim();
  const district = String(data.district ?? '').trim();
  const place = [city, district].filter(Boolean).join(' / ');
  const network = hasarTespitNetworkLabel(city, district);
  const phone = formatHasarTespitMailPhone(data.ownerPhone);
  const ownerEmail = String(data.ownerEmail ?? '').trim();
  const organization = String(data.organizationName ?? '').trim();
  const showPartner = data.recipientParty === 'broker' || data.recipientParty === 'agency';
  const partnerMailto = ownerEmail
    ? `mailto:${ownerEmail}?subject=${encodeURIComponent('Broker ve Acente İş Birliği')}`
    : '';

  const contactLinks = [
    phone
      ? `<a href="tel:${escapeHtml(phone.href)}" style="display:inline-block;margin:0 12px 0 0;font-size:11px;line-height:44px;color:${C.blue};text-decoration:none;white-space:nowrap;">${icon('phone', 14, C.blue)}${escapeHtml(phone.label)}</a>`
      : '',
    ownerEmail
      ? `<a href="mailto:${escapeHtml(ownerEmail)}" style="display:inline-block;font-size:11px;line-height:44px;color:${C.blue};text-decoration:none;word-break:break-all;">${icon('mail', 14, C.blue)}${escapeHtml(ownerEmail)}</a>`
      : '',
  ].join('');

  const partner = showPartner
    ? `
          <tr>
            <td class="mp-pad" style="padding:25px 32px 27px;background:${C.soft};border-top:1px solid ${C.line};">
              <div style="font-size:10px;letter-spacing:1.3px;color:${C.blue};font-weight:700;">BROKER VE ACENTELER İÇİN</div>
              <div class="mp-h2" style="font-size:22px;line-height:1.3;letter-spacing:-.4px;margin:9px 0 10px;font-weight:600;color:${C.ink};max-width:470px;">Portföyünüz İçin<br/>Birlikte Çözüm Üretelim.</div>
              <p style="margin:0;font-size:12px;line-height:1.75;color:${C.muted};max-width:520px;">Sigortalılarınızın hasar tespit, onarım ve restorasyon ihtiyaçları için hizmet kapsamımızı ve iş birliği olanaklarını birlikte değerlendirelim.</p>
              <div style="margin:14px 0 18px;font-size:11px;line-height:1.6;color:${C.ink};">
                <span style="display:inline-block;margin:0 18px 6px 0;white-space:nowrap;">${icon('clipboard', 14, C.blue)}Hasar Tespit</span><span style="display:inline-block;margin:0 18px 6px 0;white-space:nowrap;">${icon('wrench', 14, C.blue)}Onarım</span><span style="display:inline-block;margin:0 0 6px 0;white-space:nowrap;">${icon('building', 14, C.blue)}Restorasyon</span>
              </div>
              ${partnerMailto
                ? `<a href="${escapeHtml(partnerMailto)}" style="display:inline-block;background:${C.navy};color:#ffffff;text-decoration:none;border-radius:4px;font-size:12px;line-height:22px;font-weight:600;padding:12px 17px;font-family:${FONT};">İş Birliği İçin Görüşelim${icon('arrow', 15, '#ffffff')}</a>`
                : ''}
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>Hasar Tespit Süreci Başlatıldı</title>
<style>
@media only screen and (max-width:440px){
  .mp-outer{padding:10px 6px!important}
  .mp-pad{padding-left:22px!important;padding-right:22px!important}
  .mp-logo{width:145px!important;height:56px!important}
  .mp-note{font-size:10px!important}
  .mp-h1{font-size:23px!important}
  .mp-h2{font-size:20px!important}
  .mp-recipient{font-size:18px!important}
  .mp-label{width:98px!important;padding-right:12px!important}
  .mp-stack{display:block!important;width:100%!important;text-align:left!important}
  .mp-gap{padding:0 0 4px 0!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mp-outer" style="background:${C.page};padding:22px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="660" cellpadding="0" cellspacing="0" style="width:100%;max-width:660px;background:${C.paper};border:1px solid ${C.line};border-radius:8px;overflow:hidden;font-family:${FONT};">
          <tr>
            <td class="mp-pad" style="padding:20px 32px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logoUrl}" alt="Meridyen Asistans" width="174" height="67" class="mp-logo" style="display:block;width:174px;height:67px;border:0;outline:none;text-decoration:none;"/>
                  </td>
                  <td align="right" class="mp-note" style="vertical-align:middle;font-size:11px;line-height:1.6;color:${C.muted};">Hasar Onarım Ve<br/>Restorasyon Departmanı</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mp-pad" style="padding:13px 32px 14px;background:${C.navy};border-bottom:2px solid ${C.heroLine};">
              <h1 class="mp-h1" style="margin:0;font-size:25px;line-height:1.3;letter-spacing:-.6px;font-weight:650;color:#ffffff;">Hasar Tespit Süreci Başlatıldı</h1>
              ${openedDay ? `<p style="margin:5px 0 0;font-size:12px;line-height:1.6;color:${C.heroSub};">Dosya Açılışı · ${escapeHtml(openedDay)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td class="mp-pad" style="padding:22px 32px 26px;">
              ${organization ? `<div class="mp-recipient" style="font-size:19px;line-height:1.4;font-weight:650;letter-spacing:-.2px;color:${C.blue};margin:0 0 6px;">${escapeHtml(organization)}</div>` : ''}
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;font-weight:600;color:${C.ink};">Sayın Yetkili,</p>
              <p style="margin:0;font-size:13px;line-height:1.75;color:${C.muted};">Aşağıda bilgileri yer alan dosyanız için hasar tespit süreci başlatılmıştır.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:2px solid ${C.ink};">
                <tr>
                  <td colspan="2" style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:13px;line-height:1.6;font-weight:700;color:${C.ink};">Dosya Bilgileri</td>
                </tr>${[
                  fieldRow('Dosya No', `<span style="font-size:15px;font-weight:650;letter-spacing:.1px;">${dash(data.fileNo)}</span>`),
                  fieldRow('Sigorta Şirketi', dash(data.insuranceCompanyName)),
                  fieldRow('Sigortalı', dash(data.insuredName)),
                  fieldRow('Dosya Konusu', dash(data.fileSubject)),
                  fieldRow('İl / İlçe', dash(place)),
                  fieldRow('İhbar Tarihi', dash(notification)),
                ].join('')}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
                <tr>
                  <td class="mp-stack mp-gap" style="vertical-align:middle;padding:0 14px 0 0;white-space:nowrap;">
                    <div style="font-size:12px;line-height:1.5;font-weight:600;color:${C.ink};">${dash(data.ownerName)}</div>
                    <div style="font-size:10px;line-height:1.5;color:${C.muted};">Dosya Sorumlusu</div>
                  </td>
                  <td class="mp-stack" style="vertical-align:middle;width:100%;">${contactLinks}</td>
                </tr>
              </table>
              ${network
                ? `<div style="margin-top:7px;font-size:11px;line-height:1.6;"><span style="color:${C.muted};margin-right:12px;">Operasyon Bölgesi</span><strong style="font-size:12px;font-weight:600;color:${C.ink};">${escapeHtml(network)}</strong></div>`
                : ''}
            </td>
          </tr>${partner}
          <tr>
            <td class="mp-pad" style="padding:17px 32px;border-top:1px solid ${C.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="mp-stack mp-gap" style="vertical-align:middle;font-size:10px;line-height:1.6;color:${C.muted};"><strong style="font-size:11px;font-weight:600;color:${C.ink};">Meridyen Asistans</strong><br/>Safran Birleşik Hizmetler Yan Kuruluşudur.</td>
                  <td align="right" class="mp-stack" style="vertical-align:middle;font-size:10px;line-height:1.6;color:${C.muted};">Bu Bildirim Otomatik Olarak Gönderilmiştir.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
