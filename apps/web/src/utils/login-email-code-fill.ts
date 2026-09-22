/** Postadan kopyalanan metinden 6 haneli giriş kodunu ayıklar. */

function sixDigitsLoose(text: string): string | null {
  const compact = text.match(/(\d{6})\b/);
  if (compact) return compact[1];
  const spaced = text.match(/(\d(?:[\s.\-]*\d){5})/);
  if (!spaced) return null;
  const digits = spaced[1].replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}

export function extractLoginEmailCode(raw: string): string | null {
  const text = String(raw ?? '')
    .replace(/[\u00a0\u200b\u202f]/g, ' ')
    .trim();
  if (!text) return null;

  const labeledAt = text.search(/kod(?:unuz|u)?/i);
  if (labeledAt >= 0) {
    const fromLabel = sixDigitsLoose(text.slice(labeledAt));
    if (fromLabel) return fromLabel;
  }

  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length === 6) return digitsOnly;

  return null;
}
