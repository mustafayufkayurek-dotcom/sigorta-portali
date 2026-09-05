/** Tedarikçi kimliği: sözleşme ve kayıt aynı numarayı kullanır. */

export function digitsOnly(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidTcKimlikNo(value: string | null | undefined): boolean {
  const val = digitsOnly(value);
  if (val.length !== 11) return false;
  const digits = val.split('').map(Number);
  if (digits[0] === 0) return false;
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const d10 = (oddSum * 7 - evenSum) % 10;
  if (d10 !== digits[9]) return false;
  const total = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === digits[10];
}

export function isValidVergiNo(value: string | null | undefined): boolean {
  const val = digitsOnly(value);
  return val.length === 10 || val.length === 11;
}

export function vendorContractIdentityMissing(vendor: {
  entityType?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
}): boolean {
  const entity = String(vendor.entityType ?? '').toLowerCase();
  if (entity === 'corporate') return !isValidVergiNo(vendor.taxNumber);
  return !isValidTcKimlikNo(vendor.identityNo);
}

/** Levha/kimlik dosyasının metin katmanından aday numaralar. */
export function extractIdentityCandidatesFromText(raw: string): { tc: string[]; vergi: string[] } {
  const tc: string[] = [];
  const vergi: string[] = [];
  const chunks = String(raw ?? '').match(/\d{10,11}/g) ?? [];
  for (const c of chunks) {
    if (c.length === 11 && isValidTcKimlikNo(c)) tc.push(c);
    else if (isValidVergiNo(c)) vergi.push(c);
  }
  return { tc: [...new Set(tc)], vergi: [...new Set(vergi)] };
}

export function identityMatchesVendor(opts: {
  entityType?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  extracted: { tc: string[]; vergi: string[] };
}): 'ok' | 'mismatch' | 'empty-extract' {
  const { extracted } = opts;
  if (extracted.tc.length === 0 && extracted.vergi.length === 0) return 'empty-extract';
  const entity = String(opts.entityType ?? '').toLowerCase();
  if (entity === 'corporate') {
    const tax = digitsOnly(opts.taxNumber);
    if (!tax) return 'mismatch';
    return extracted.vergi.includes(tax) || extracted.tc.includes(tax) ? 'ok' : 'mismatch';
  }
  const tc = digitsOnly(opts.identityNo);
  if (!tc) return 'mismatch';
  return extracted.tc.includes(tc) ? 'ok' : 'mismatch';
}
