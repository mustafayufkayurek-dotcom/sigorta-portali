/**
 * Dosya ili/ilçesi ile tedarikçi bölgesi eşleşmesi — km yok, etiket var.
 * UI: «Aynı İlçe» / «Aynı İl» / «Farklı İl»
 */

export type RegionProximityTone = 'same-district' | 'same-city' | 'other' | 'unknown';

export type RegionProximity = {
  label: string;
  tone: RegionProximityTone;
};

export function foldRegionKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/** Dosya bölgesi ile tedarikçi şehir/ilçe karşılaştırması. */
export function resolveRegionProximity(input: {
  fileCity?: string | null;
  fileDistrict?: string | null;
  vendorCity?: string | null;
  vendorDistrict?: string | null;
}): RegionProximity {
  const fileCity = foldRegionKey(input.fileCity ?? '');
  const fileDistrict = foldRegionKey(input.fileDistrict ?? '');
  const vendorCity = foldRegionKey(input.vendorCity ?? '');
  const vendorDistrict = foldRegionKey(input.vendorDistrict ?? '');

  if (!fileCity && !fileDistrict) {
    return { label: 'Dosya Bölgesi Belirsiz', tone: 'unknown' };
  }
  if (!vendorCity && !vendorDistrict) {
    return { label: 'Bölge Bilgisi Yok', tone: 'unknown' };
  }
  if (fileCity && vendorCity && fileCity === vendorCity) {
    if (fileDistrict && vendorDistrict && fileDistrict === vendorDistrict) {
      return { label: 'Aynı İlçe', tone: 'same-district' };
    }
    return { label: 'Aynı İl', tone: 'same-city' };
  }
  return { label: 'Farklı İl', tone: 'other' };
}
