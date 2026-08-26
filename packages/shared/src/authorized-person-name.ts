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
  if (personTokens.some((t) => FIRM_TOKENS.has(t))) return true;

  const companyFolded = foldAuthorizedPersonText(input.companyName);
  const shortFolded = foldAuthorizedPersonText(input.shortName);
  if (combined && (combined === companyFolded || combined === shortFolded)) return true;

  const companySet = new Set([...tokensOf(input.companyName), ...tokensOf(input.shortName)]);
  if (personTokens.length >= 2 && personTokens.every((t) => companySet.has(t))) return true;

  return false;
}
