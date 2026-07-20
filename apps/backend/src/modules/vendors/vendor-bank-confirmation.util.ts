import { BadRequestException } from '@nestjs/common';

export type AccountHolderMatchStatus = 'match' | 'mismatch' | 'unknown';

const BANK_CODES: Record<string, string> = {
  '00010': 'Ziraat Bankası',
  '00012': 'Halkbank',
  '00015': 'Vakıfbank',
  '00032': 'TEB',
  '00046': 'Akbank',
  '00059': 'Şekerbank',
  '00062': 'Garanti BBVA',
  '00064': 'İş Bankası',
  '00067': 'Yapı Kredi',
  '00099': 'ING Bank',
  '00111': 'Finansbank',
  '00134': 'Denizbank',
};

export function normalizeAndValidateVendorIban(value: unknown): {
  iban: string | null;
  bankName: string | null;
} {
  const iban = String(value ?? '').replace(/\s/g, '').toUpperCase();
  if (!iban) return { iban: null, bankName: null };

  if (!/^TR\d{24}$/.test(iban)) {
    throw new BadRequestException(
      'Türkiye IBAN numarası TR ile başlamalı ve 26 karakter olmalıdır.',
    );
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) =>
    String(char.charCodeAt(0) - 55),
  );
  let remainder = BigInt(0);
  for (const digit of numeric) {
    remainder = (remainder * BigInt(10) + BigInt(digit)) % BigInt(97);
  }
  if (remainder !== BigInt(1)) {
    throw new BadRequestException('IBAN kontrol hanesi geçersizdir.');
  }

  return {
    iban,
    bankName: BANK_CODES[iban.slice(4, 9)] ?? null,
  };
}

export function normalizeLegalName(value: unknown): string {
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

export function compareAccountHolderToVendor(
  accountHolderName: unknown,
  vendorName: unknown,
): AccountHolderMatchStatus {
  const holder = normalizeLegalName(accountHolderName);
  const vendor = normalizeLegalName(vendorName);
  if (!holder || !vendor) return 'unknown';
  if (holder === vendor) return 'match';

  const holderWithoutSuffix = withoutLegalSuffix(holder);
  const vendorWithoutSuffix = withoutLegalSuffix(vendor);
  return holderWithoutSuffix === vendorWithoutSuffix ? 'match' : 'mismatch';
}

export function formatIbanForMessage(iban: string): string {
  return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}
