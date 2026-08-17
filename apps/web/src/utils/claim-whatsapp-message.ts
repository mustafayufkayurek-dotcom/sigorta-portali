export function buildClaimAssignmentWhatsAppMessage(claim: {
  fileNo?: string | null;
  insuredName?: string | null;
  lossType?: string | null;
  description?: string | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}, recipientRole: 'Tespitçi' | 'Tedarikçi'): string {
  const fileNo = claim.fileNo?.trim() || '—';
  const insured = claim.insuredName?.trim() || '—';
  const loss = claim.lossType?.trim() || '';
  const addr = claim.propertyAddress;
  const addressParts = [
    addr?.addressLine?.trim(),
    addr?.district?.trim(),
    addr?.city?.trim(),
  ].filter(Boolean);
  const addressLine = addressParts.join(', ') || 'Adres dosyada tanımlı değil';

  let mapsLine = '';
  if (addr?.latitude != null && addr?.longitude != null) {
    mapsLine = `Harita: https://maps.google.com/?q=${addr.latitude},${addr.longitude}`;
  }

  const lines = [
    `Meridyen Assistance — Hasar Dosyası (${recipientRole})`,
    `Dosya No: ${fileNo}`,
    `Sigortalı: ${insured}`,
    ...(loss ? [`Hasar: ${loss}`] : []),
    `Konum: ${addressLine}`,
    ...(mapsLine ? [mapsLine] : []),
    '',
    '⚠️ Lütfen konumu kontrol ediniz. Yanlış adrese gitmeyiniz.',
    'Adres veya harita linkini doğruladıktan sonra hareket ediniz.',
  ];

  return lines.join('\n');
}
