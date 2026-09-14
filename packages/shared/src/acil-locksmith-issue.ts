/** Acil konu — Çilingir (kapı/kilit) bu paketten ayrı kalır. */

const LOCKSMITH_RE = /cilingir|çilingir|cingir|çingir|kilit|kap[ıi]\s*[\/-]?\s*kilit/;

function foldIssue(value: string): string {
  return value
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAcilLocksmithIssue(
  issueType: string | null | undefined,
  extra?: string | null,
): boolean {
  const blob = foldIssue(`${issueType ?? ''} ${extra ?? ''}`);
  if (!blob) return false;
  return LOCKSMITH_RE.test(blob);
}
