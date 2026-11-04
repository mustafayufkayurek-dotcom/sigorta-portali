/** Liste araması: AYDIN / Aydın / Aydin aynı kişiyi bulur. */

const I_DOT = '\u0130'; // İ
const I_DOTLESS = '\u0131'; // ı
const I_COMBINING = 'i\u0307';

export function foldTurkishSearchText(value: string): string {
  return String(value ?? '')
    .replace(new RegExp(I_DOT, 'g'), 'i')
    .replace(/I/g, 'i')
    .replace(new RegExp(I_DOTLESS, 'g'), 'i')
    .replace(new RegExp(I_COMBINING, 'g'), 'i')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

export function listSearchTokens(query: string): string[] {
  return String(query ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function turkishISearchVariants(token: string): string[] {
  const s = String(token ?? '').trim();
  if (!s) return [];
  const out = new Set<string>([s]);
  out.add(s.replace(/I/g, I_DOTLESS).replace(new RegExp(I_DOT, 'g'), 'i'));
  out.add(s.replace(/I/g, 'i').replace(new RegExp(I_DOT, 'g'), 'i').replace(new RegExp(I_DOTLESS, 'g'), 'i'));
  out.add(s.replace(/i/g, I_DOTLESS).replace(new RegExp(I_DOT, 'g'), 'I'));
  return [...out];
}

export function nameMatchesListSearch(name: string, query: string): boolean {
  const n = foldTurkishSearchText(name);
  const tokens = listSearchTokens(query);
  if (!tokens.length) return true;
  return tokens.every((token) => n.includes(foldTurkishSearchText(token)));
}

function containsInsensitive(value: string): { contains: string; mode: 'insensitive' } {
  return { contains: value, mode: 'insensitive' };
}

/** Hasar liste / üst arama — her kelime adın içinde durur. */
export function buildClaimFileListSearchWhere(query: string): Record<string, unknown> {
  const q = String(query ?? '').trim();
  const tokens = listSearchTokens(q);
  const qVars = turkishISearchVariants(q);
  const fileOr = qVars.flatMap((v) => [
    { fileNo: containsInsensitive(v) },
    { claimNo: containsInsensitive(v) },
  ]);
  const nameOrFor = (v: string) => [
    { insuredName: containsInsensitive(v) },
    { customer: { shortName: containsInsensitive(v) } },
    { customer: { companyName: containsInsensitive(v) } },
    { customer: { fullName: containsInsensitive(v) } },
    { customer: { firstName: containsInsensitive(v) } },
    { customer: { lastName: containsInsensitive(v) } },
    { customer: { subType: containsInsensitive(v) } },
  ];
  const nameAnd = {
    AND: tokens.map((token) => ({
      OR: turkishISearchVariants(token).flatMap(nameOrFor),
    })),
  };
  return { OR: [...fileOr, nameAnd] };
}

export function buildClaimFileGlobalNameSearchAnd(query: string): Record<string, unknown> {
  const tokens = listSearchTokens(query);
  const nameOrFor = (v: string) => [
    { insuredName: containsInsensitive(v) },
    { commercialTitle: containsInsensitive(v) },
    { customer: { is: { fullName: containsInsensitive(v) } } },
    { customer: { is: { firstName: containsInsensitive(v) } } },
    { customer: { is: { lastName: containsInsensitive(v) } } },
    { customer: { is: { companyName: containsInsensitive(v) } } },
  ];
  return {
    AND: tokens.map((token) => ({
      OR: turkishISearchVariants(token).flatMap(nameOrFor),
    })),
  };
}

export function buildAcilListSearchWhere(query: string, extraOr: Record<string, unknown>[] = []): Record<string, unknown> {
  const q = String(query ?? '').trim();
  const tokens = listSearchTokens(q);
  const qVars = turkishISearchVariants(q);
  const idOr = qVars.flatMap((v) => [
    { address: containsInsensitive(v) },
    { caseNo: containsInsensitive(v) },
    { fileNo: containsInsensitive(v) },
  ]);
  const nameAnd = {
    AND: tokens.map((token) => ({
      OR: turkishISearchVariants(token).map((v) => ({ customerName: containsInsensitive(v) })),
    })),
  };
  return { OR: [...idOr, nameAnd, ...extraOr] };
}
