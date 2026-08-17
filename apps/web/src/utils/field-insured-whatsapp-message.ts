/** Saha → sigortalı WhatsApp şablonu (operasyon dili; sağlayıcı adı yok) */

export function buildFieldInsuredWhatsAppMessage(claim: {
  fileNo?: string | null;
  insuredName?: string | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
}): string {
  const fileNo = claim.fileNo?.trim() || '—';
  const insured = claim.insuredName?.trim() || '—';
  const addr = claim.propertyAddress;
  const addressParts = [
    addr?.addressLine?.trim(),
    addr?.district?.trim(),
    addr?.city?.trim(),
  ].filter(Boolean);
  const addressLine = addressParts.join(', ') || 'Adres dosyada tanımlı';

  return [
    'Meridyen Assistance — Saha Tespit',
    `Dosya No: ${fileNo}`,
    `Sayın ${insured},`,
    '',
    'Hasar tespit ziyareti için sizinle iletişime geçiyoruz.',
    `Adres: ${addressLine}`,
    '',
    'Uygun olduğunuz zamanı bu mesaja yanıtlayabilirsiniz.',
  ].join('\n');
}
