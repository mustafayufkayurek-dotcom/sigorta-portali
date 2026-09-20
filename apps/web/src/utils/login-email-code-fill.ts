/** Postadan kopyalanan metinden 6 haneli giriş kodunu ayıklar. */

export function extractLoginEmailCode(raw: string): string | null {
  const text = String(raw ?? '').replace(/\u00a0/g, ' ').trim();
  if (!text) return null;

  const labeledAt = text.search(/kod(?:unuz|u)?/i);
  if (labeledAt >= 0) {
    const afterLabel = text.slice(labeledAt);
    const six = afterLabel.match(/(\d{6})\b/);
    if (six) return six[1];
  }

  const compact = text.replace(/\s+/g, '');
  if (/^\d{6}$/.test(compact)) return compact;

  const onlySix = text.match(/^\D*(\d{6})\D*$/);
  if (onlySix && text.replace(/\D/g, '').length === 6) return onlySix[1];

  return null;
}
