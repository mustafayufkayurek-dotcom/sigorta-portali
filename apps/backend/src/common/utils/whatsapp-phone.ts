/**
 * WhatsApp wa.me için E.164 benzeri rakam dizisi (ülke kodu dahil, + yok).
 * TR: 0532… / 532… / +90 532… → 90532…
 * Çift 90 (9090…) ve baştaki 00 temizlenir.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Çift ülke kodu: 9090532… → 90532…
  while (digits.startsWith('9090') && digits.length >= 14) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = `90${digits.slice(1)}`;
  } else if (!digits.startsWith('90') && digits.length === 10) {
    digits = `90${digits}`;
  }

  if (digits.length < 11) return null;
  return digits;
}

export function buildWhatsAppMeUrl(
  phone: string | null | undefined,
  message?: string | null,
): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    const text = message?.trim();
    if (!text) return null;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
  const text = message?.trim();
  if (!text) return `https://wa.me/${normalized}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
