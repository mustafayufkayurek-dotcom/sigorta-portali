import {
  buildEmergencyMapsUrl,
  formatEmergencyFileAddress,
} from './file-address';
import { resolveAcilInsuredName } from './acil-insured-name';
import { parseRemedSubjectLine, toInboundTitleCaseTR, mapInboundCategoryToMeridyen } from './inbound-mail-terminology';

export const VENDOR_LOCATION_CONFIRM_LINE = 'Konumu sigortalıdan teyit ediniz.';

export const VENDOR_LOCATION_WARNING_LINES = [
  '⚠️ Lütfen konumu kontrol ediniz. Yanlış adrese gitmeyiniz.',
  'Adres veya harita linkini doğruladıktan sonra hareket ediniz.',
] as const;

export function whatsappField(label: string, value: string): string {
  return `*${label}:* ${value}`;
}

function inboundIhbarSubject(notes?: string | null): string {
  const m = String(notes ?? '').match(/gelen kutusu ihbarı:\s*([^\n]+)/i);
  return (m?.[1] || '').trim();
}

export function formatVendorWhatsAppPhone(raw?: string | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^90/, '').replace(/^0+/, '');
  const local = digits.slice(-10);
  if (local.length !== 10) return (raw || '').trim() || '—';
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function vendorWhatsAppDosyaKonusu(issueType: string, notes?: string | null): string {
  const parsed = parseRemedSubjectLine(inboundIhbarSubject(notes));
  if (parsed?.fileSubject) return parsed.fileSubject;
  return mapInboundCategoryToMeridyen(issueType) || issueType.trim() || '—';
}

export function vendorWhatsAppDescription(
  notes?: string | null,
  findingsText?: string | null,
): string {
  const findings = (findingsText || '').trim();
  if (findings && !/^gelen kutusu ihbar/i.test(findings) && findings.length <= 240) {
    return toInboundTitleCaseTR(findings.replace(/\s+/g, ' '));
  }
  const lines = String(notes ?? '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^gelen kutusu ihbar/i.test(l))
    .filter((l) => !/adına yapılan/i.test(l))
    .filter((l) => !/ile ilgili bilgi\.?$/i.test(l))
    .filter((l) => !/@/.test(l))
    .filter((l) => !/dosya sorumlusu/i.test(l))
    .filter((l) => !/asistan firması/i.test(l))
    .filter((l) => !/^rcs-/i.test(l));
  const last = lines[lines.length - 1] || '';
  if (!last || last.length > 200) return '';
  return toInboundTitleCaseTR(last.replace(/\s+/g, ' '));
}

export function buildVendorWhatsAppText(input: {
  fileNo: string;
  issueType: string;
  insuredLabel: string;
  phone: string;
  address: string;
  city?: string | null;
  district?: string | null;
  notes?: string | null;
  findingsText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const addressLine = formatEmergencyFileAddress({
    address: input.address,
    district: input.district,
    city: input.city,
  });
  const mapsUrl = buildEmergencyMapsUrl({
    address: input.address,
    district: input.district,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const insured =
    resolveAcilInsuredName({ personField: input.insuredLabel, notes: input.notes }) || '—';
  const phone = formatVendorWhatsAppPhone(input.phone);
  const note = vendorWhatsAppDescription(input.notes, input.findingsText);
  const lines = [
    '*Meridyen Acil Yardım (Tedarikçi)*',
    whatsappField('Dosya No', input.fileNo),
    whatsappField('Dosya Konusu', vendorWhatsAppDosyaKonusu(input.issueType, input.notes)),
    whatsappField('Sigortalı', insured),
    whatsappField('Sigortalı Telefon', phone),
    whatsappField('Adres', addressLine),
  ];
  if (mapsUrl) lines.push(whatsappField('Konum', mapsUrl));
  if (note) lines.push(whatsappField('Açıklama', note));
  lines.push('', ...VENDOR_LOCATION_WARNING_LINES, VENDOR_LOCATION_CONFIRM_LINE);
  return lines.join('\n');
}
