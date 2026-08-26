/** Sigortalı kamu evrakında ücret görünmez; müşteri e-postasındaki asıl belgede tutar durur. */

export const INSURED_FEE_NOTICE = 'Bu onay formunda hizmet bedeli yer almaz.';

const TUTAR_BOX_RE = /<div class="tutar-box"[\s\S]*?<\/div>/i;
const CONSENT_RE = /<div class="consent-text">[\s\S]*?<\/div>/i;

export function toInsuredFacingMatbuHtml(html: string): string {
  if (!html) return html;
  let out = html;
  const notice = `<div class="tutar-uyari" data-testid="sigortali-ucret-gizli">${INSURED_FEE_NOTICE}</div>`;
  if (TUTAR_BOX_RE.test(out)) {
    out = out.replace(TUTAR_BOX_RE, notice);
  } else if (/Toplam Hizmet Bedeli/i.test(out)) {
    out = out.replace(
      /<div class="section">\s*(?:<div class="section-title">[\s\S]*?<\/div>)?\s*<div class="tutar-box"[\s\S]*?<\/div>\s*<\/div>/i,
      `<div class="section">${notice}</div>`,
    );
  }
  const insuredConsent =
    '<div class="consent-text">Belirtilen adreste hizmetin verildiğini onayladığımı beyan ederim. Yazıcı gerekmez; bu sayfadaki Onayla yeterlidir.</div>';
  if (CONSENT_RE.test(out)) {
    out = out.replace(CONSENT_RE, insuredConsent);
  }
  return out;
}
