/** Sigortalı kamu evrakında hizmet bedeli görünmez. */

export const INSURED_FEE_NOTICE = 'Bu onay formunda hizmet bedeli yer almaz.';

const CONSENT_RE = /<div class="consent-text">[\s\S]*?<\/div>/i;
const TUTAR_BOX_RE = /<div class="tutar-box">[\s\S]*?<\/div>/i;

export function toInsuredFacingMatbuHtml(html: string): string {
  if (!html) return html;
  if (html.includes('Adres Ve Hizmet Talep Onayı') || html.includes('Adres ve hizmet talep onayı')) return html;
  let out = html;
  if (TUTAR_BOX_RE.test(out)) {
    out = out.replace(
      TUTAR_BOX_RE,
      `<div class="tutar-box" data-testid="sigortali-ucret-gizli"><p class="label grand">${INSURED_FEE_NOTICE}</p></div>`,
    );
  }
  const insuredConsent =
    '<div class="consent-text">Belirtilen adreste hizmetin verildiğini onayladığımı beyan ederim. Yazıcı gerekmez; bu sayfadaki Onayla yeterlidir.</div>';
  if (CONSENT_RE.test(out)) {
    out = out.replace(CONSENT_RE, insuredConsent);
  }
  return out;
}
