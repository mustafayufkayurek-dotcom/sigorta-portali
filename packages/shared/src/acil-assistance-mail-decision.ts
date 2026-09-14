/** Asistans gelen yazısından onay/red. Konudaki «Onay talebi» tek başına karar değildir. */

export type AssistanceMailDecision = 'approve' | 'reject';

function foldMail(value: string): string {
  return value
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

const REJECT_RE =
  /\b(reddedildi|redd(i|ediyoruz|ediyorum)|onaylamıyoruz|onaylamiyoruz|onaylamıyorum|onaylamiyorum|uygun değil|uygun degil|iptal edildi)\b/;
const APPROVE_RE =
  /\b(onaylandı|onaylandi|onaylıyorum|onayliyorum|onaylıyoruz|onayliyoruz|onay verdik|onay verildi|onaylanmıştır|onaylanmistir|uygundur)\b/;

export function parseAssistanceMailDecision(
  subject: string | null | undefined,
  body: string | null | undefined,
): AssistanceMailDecision | null {
  const text = foldMail(`${body || ''}\n${subject || ''}`);
  if (!text) return null;
  if (REJECT_RE.test(text)) return 'reject';
  if (APPROVE_RE.test(text)) return 'approve';
  return null;
}
