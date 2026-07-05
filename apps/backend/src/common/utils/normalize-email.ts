/** E-posta adresini karşılaştırma/gönderim için normalize eder (Türkçe İ/ı güvenli). */
export function normalizeEmailAddress(email: string): string {
  return String(email ?? '').trim().toLocaleLowerCase('tr-TR');
}
