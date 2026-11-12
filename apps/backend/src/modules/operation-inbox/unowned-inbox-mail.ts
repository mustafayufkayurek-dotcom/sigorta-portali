import { parseRemedSubjectLine, toInboundTitleCaseTR } from '@sigorta/shared';

export interface UnownedInboxMailFacts {
  fileNo?: string | null;
  customerName?: string | null;
  insuredName?: string | null;
  fileSubject?: string | null;
  rawSubject?: string | null;
  city?: string | null;
  district?: string | null;
}

function shown(value?: string | null): string {
  const text = value?.trim() ?? '';
  return text || '—';
}

function personName(value?: string | null): string {
  const text = value?.trim() ?? '';
  if (!text) return '—';
  return toInboundTitleCaseTR(text);
}

/** Ham konu satırını dosya konusuna indirger. Konut Anahtar durur; Ynt: zinciri basılmaz. */
export function smartInboxFileSubject(rawSubject?: string | null, known?: string | null): string {
  const cleaned = known?.trim() ?? '';
  const looksRaw =
    !cleaned
    || cleaned.includes('/')
    || /^(?:(?:ynt|re|fwd|ilt|yanıt):\s*)+/i.test(cleaned);
  if (!looksRaw) return cleaned;
  const parsed = rawSubject?.trim() ? parseRemedSubjectLine(rawSubject) : undefined;
  return parsed?.fileSubject?.trim() || cleaned || '—';
}

/** Bu yazıda il yoksa aynı zincirdeki ilk ihbarın ilini kullanır. */
export function threadFilePlace(
  current: { city?: string | null; district?: string | null },
  earlier: Array<{ city?: string | null; district?: string | null }>,
): { city: string | null; district: string | null } {
  const ownCity = current.city?.trim() || '';
  const ownDistrict = current.district?.trim() || '';
  if (ownCity || ownDistrict) {
    return { city: ownCity || null, district: ownDistrict || null };
  }
  for (const row of earlier) {
    const city = row.city?.trim() || '';
    const district = row.district?.trim() || '';
    if (city || district) return { city: city || null, district: district || null };
  }
  return { city: null, district: null };
}

export function formatInboxFilePlace(city?: string | null, district?: string | null): string {
  const placeCity = city?.trim() ? toInboundTitleCaseTR(city.trim()) : '';
  const placeDistrict = district?.trim() ? toInboundTitleCaseTR(district.trim()) : '';
  if (placeDistrict && placeCity) return `${placeDistrict} · ${placeCity}`;
  return placeDistrict || placeCity || '—';
}

export function unownedInboxSummaryRows(facts: UnownedInboxMailFacts): Array<{ label: string; value: string }> {
  return [
    { label: 'Dosya Numarası', value: shown(facts.fileNo) },
    { label: 'Müşteri Adı', value: personName(facts.customerName) },
    { label: 'Sigortalı Adı Soyadı', value: personName(facts.insuredName) },
    { label: 'Dosya Konusu', value: smartInboxFileSubject(facts.rawSubject, facts.fileSubject) },
    { label: 'Dosya İl İlçe', value: formatInboxFilePlace(facts.city, facts.district) },
  ];
}

export function unownedInboxCustomerName(input: {
  assistantName?: string | null;
  customerName?: string | null;
}): string | null {
  const assistant = input.assistantName?.trim();
  if (assistant) return assistant;
  const customer = input.customerName?.trim();
  return customer || null;
}
