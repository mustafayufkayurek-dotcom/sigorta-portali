export type VendorAccountHolderMatchStatus = 'match' | 'mismatch' | 'unknown';

export function normalizeVendorLegalName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ü]/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutLegalSuffix(value: string): string {
  return value
    .replace(
      /\b(?:anonim sirketi|limited sirketi|ltd sti|a s|ltd|sti)\b(?:\s*)$/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function compareVendorAccountHolder(
  accountHolderName: unknown,
  vendorName: unknown,
): VendorAccountHolderMatchStatus {
  const holder = normalizeVendorLegalName(accountHolderName);
  const vendor = normalizeVendorLegalName(vendorName);
  if (!holder || !vendor) return 'unknown';
  if (holder === vendor) return 'match';
  return withoutLegalSuffix(holder) === withoutLegalSuffix(vendor)
    ? 'match'
    : 'mismatch';
}

export const BANK_CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  offered: 'Teyit Mesajı Hazırlandı',
  link_opened: 'WhatsApp Açıldı',
  confirmed: 'Teyit Alındı',
  declined: 'Düzeltme İstendi',
};
