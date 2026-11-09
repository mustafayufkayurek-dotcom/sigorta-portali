/** Yetkili adı: kişi kutusu. Firma unvanı / unvan parçası kayda girmez. */

export const AUTHORIZED_PERSON_DIRTY_MESSAGE =
  'Yetkili kutusuna kişi adı yazın. Firma adı veya unvan parçası kabul edilmez.';

const FIRM_TOKENS = new Set([
  'ekspertiz',
  'ekspertizcilik',
  'sigorta',
  'asistans',
  'assistance',
  'limited',
  'ltd',
  'şti',
  'sti',
  'anonim',
  'ticaret',
  'şirket',
  'sirket',
  'holding',
  'aş',
  'as',
  'inşaat',
  'insaat',
  'lojistik',
  'nakliyat',
  'broker',
  'reasürans',
  'reasurans',
  'kooperatif',
  'mail',
  'eposta',
  'genel',
  'eksper',
  'eksperlik',
  'hizmet',
  'hizmetleri',
  'musavirlik',
  'müşavirlik',
  'danismanlik',
  'danışmanlık',
]);

export function foldAuthorizedPersonText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9çğıöşüâîû]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(value: string | null | undefined): string[] {
  const folded = foldAuthorizedPersonText(value);
  return folded ? folded.split(' ').filter(Boolean) : [];
}

export function isDirtyAuthorizedPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
  combined?: string | null;
  companyName?: string | null;
  shortName?: string | null;
}): boolean {
  const first = foldAuthorizedPersonText(input.firstName);
  const last = foldAuthorizedPersonText(input.lastName);
  const combined =
    foldAuthorizedPersonText(input.combined) || [first, last].filter(Boolean).join(' ');
  if (!combined) return false;

  const personTokens = tokensOf(combined);
  if (personTokens.some((token) => FIRM_TOKENS.has(token))) return true;

  const companyFolded = foldAuthorizedPersonText(input.companyName);
  const shortFolded = foldAuthorizedPersonText(input.shortName);
  const pastedTitle =
    (companyFolded && combined === companyFolded && tokensOf(companyFolded).some((token) => FIRM_TOKENS.has(token)))
    || (shortFolded && combined === shortFolded && tokensOf(shortFolded).some((token) => FIRM_TOKENS.has(token)));
  if (pastedTitle) return true;

  if (personTokens.length === 1 && (combined === companyFolded || combined === shortFolded)) return true;

  return false;
}
