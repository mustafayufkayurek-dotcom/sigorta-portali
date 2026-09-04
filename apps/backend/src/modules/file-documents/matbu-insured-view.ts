/** Sigortalı kamu evrakında onay metni Onayla yolunu anlatır; hizmet bedeli belgede durur. */

export const INSURED_FEE_NOTICE = 'Bu onay formunda hizmet bedeli yer almaz.';

const CONSENT_RE = /<div class="consent-text">[\s\S]*?<\/div>/i;

export function toInsuredFacingMatbuHtml(html: string): string {
  if (!html) return html;
  const insuredConsent =
    '<div class="consent-text">Belirtilen adreste hizmetin verildiğini ve hizmet bedelini onayladığımı beyan ederim. Yazıcı gerekmez; bu sayfadaki Onayla yeterlidir.</div>';
  if (CONSENT_RE.test(html)) {
    return html.replace(CONSENT_RE, insuredConsent);
  }
  return html;
}
