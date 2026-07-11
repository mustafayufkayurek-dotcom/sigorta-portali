/** Remed / sigorta ihbar formlarından etiketli alan çıkarımı (web + backend ortak). */

export interface InboundFormField {
  label: string;
  value: string;
}

export const INBOUND_FORM_FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'insurer', label: 'Sigorta Şirketi' },
  { key: 'customerName', label: 'Sigorta Ettiren Ad-Soyad' },
  { key: 'customerNameAlt', label: 'Sigorta Ettiren' },
  { key: 'fileNo', label: 'Dosya No' },
  { key: 'policyNo', label: 'Poliçe No' },
  { key: 'claimNo', label: 'Referans No' },
  { key: 'phone', label: 'İletişim No' },
  { key: 'phoneAlt', label: 'Telefon' },
  { key: 'phoneAlt2', label: 'Cep Telefonu' },
  { key: 'phoneAlt3', label: 'GSM' },
  { key: 'phoneAlt4', label: 'Sigortalı Telefonu' },
  { key: 'address', label: 'Adres' },
  { key: 'addressAlt', label: 'Hasar Yeri' },
  { key: 'addressAlt2', label: 'Sigorta Ettiren Adresi' },
  { key: 'addressAlt3', label: 'İletişim Adresi' },
  { key: 'addressAlt4', label: 'Sigortalı Adresi' },
  { key: 'addressAlt5', label: 'Hasar Adresi' },
  { key: 'category', label: 'Hasar Şekli' },
  { key: 'categoryAlt', label: 'Branş' },
  { key: 'description', label: 'Açıklama' },
  { key: 'descriptionAlt', label: 'Hasar Açıklaması' },
];

const INBOUND_FORM_TITLE_PATTERN =
  /\b(KONUT HASAR İHBAR FORMU|HASAR İHBAR FORMU|ACİL YARDIM İHBAR FORMU|İHBAR FORMU)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** HTML entity ve nbsp temizliği — satır sonları korunur. */
export function decodeInboundEmailText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Etiket sınırına göre form alanlarını çıkarır.
 * Değer içindeki "No : 51" gibi iki nokta üst üste karakterleri destekler.
 */
export function extractInboundFormFields(text: string): InboundFormField[] {
  const labels = [...INBOUND_FORM_FIELD_LABELS]
    .map((f) => f.label)
    .sort((a, b) => b.length - a.length);
  const labelGroup = labels.map(escapeRegex).join('|');
  const regex = new RegExp(`(${labelGroup})\\s*:\\s*`, 'gi');
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return [];

  const fields: InboundFormField[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = match[1]?.trim();
    if (!label) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    let value = text.slice(start, end).trim();
    value = value.replace(/\s*Not\s*:\s*[\s\S]*$/i, '').trim();

    const displayLabel = INBOUND_FORM_FIELD_LABELS.find(
      (f) => f.label.toLocaleLowerCase('tr-TR') === label.toLocaleLowerCase('tr-TR'),
    )?.label ?? label;

    const dedupeKey = displayLabel.toLocaleLowerCase('tr-TR');
    if (value && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      fields.push({ label: displayLabel, value });
    }
  }

  return fields;
}

export function getInboundFormFieldValue(
  fields: InboundFormField[],
  ...labels: string[]
): string | undefined {
  for (const label of labels) {
    const key = label.toLocaleLowerCase('tr-TR');
    const hit = fields.find((f) => f.label.toLocaleLowerCase('tr-TR') === key);
    if (hit?.value?.trim()) return hit.value.trim();
  }
  return undefined;
}

/** İhbar formu gövdesi — yanıt zincirindeki imza/üst metin hariç. */
export function sliceInboundFormBody(text?: string | null): string {
  if (!text?.trim()) return '';
  const decoded = decodeInboundEmailText(text);
  const match = decoded.match(INBOUND_FORM_TITLE_PATTERN);
  if (match?.index == null) return decoded;
  return decoded.slice(match.index);
}
