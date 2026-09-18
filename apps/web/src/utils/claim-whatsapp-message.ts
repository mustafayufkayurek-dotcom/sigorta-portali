import {
  buildEmergencyMapsUrl,
  formatEmergencyFileAddress,
  VENDOR_LOCATION_CONFIRM_LINE,
  VENDOR_LOCATION_WARNING_LINES,
  whatsappField,
} from '@sigorta/shared';
import { resolveClaimDosyaKonusu } from '@/utils/text-helpers';

export function buildClaimAssignmentWhatsAppMessage(claim: {
  fileNo?: string | null;
  insuredName?: string | null;
  lossType?: string | null;
  description?: string | null;
  claimSubject?: { name?: string | null } | null;
  departmentFileSubject?: { name?: string | null } | null;
  propertyAddress?: {
    addressLine?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    district?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}, recipientRole: 'Tespitçi' | 'Tedarikçi'): string {
  const fileNo = claim.fileNo?.trim() || '—';
  const insured = claim.insuredName?.trim() || '—';
  const konu = resolveClaimDosyaKonusu(claim);
  const addr = claim.propertyAddress;
  const street = [addr?.addressLine, addr?.neighborhood]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ');
  const addressLine = formatEmergencyFileAddress({
    address: street || null,
    district: addr?.district,
    city: addr?.city,
  });
  const mapsUrl = buildEmergencyMapsUrl({
    address: street || null,
    district: addr?.district,
    city: addr?.city,
    latitude: addr?.latitude,
    longitude: addr?.longitude,
  });

  const lines = [
    `*Meridyen Hasar (${recipientRole})*`,
    whatsappField('Dosya No', fileNo),
    whatsappField('Sigortalı', insured),
    ...(konu && konu !== '—' ? [whatsappField('Dosya Konusu', konu)] : []),
    whatsappField('Konum', addressLine === '—' ? 'Adres dosyada tanımlı değil' : addressLine),
  ];
  if (mapsUrl) lines.push(whatsappField('Harita', mapsUrl));
  lines.push('', ...VENDOR_LOCATION_WARNING_LINES, VENDOR_LOCATION_CONFIRM_LINE);

  return lines.join('\n');
}
