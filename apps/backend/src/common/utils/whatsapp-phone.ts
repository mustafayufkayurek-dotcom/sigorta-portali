/**
 * WhatsApp deep-link için E.164 benzeri rakam dizisi (ülke kodu dahil, + yok).
 * TR: 0532… / 532… / +90 532… / +90 0532… → 90532…
 * Çift 90 (9090…), 00 öneki ve trunk-0 (+90 0532…) temizlenir.
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

  // +90 0532… → 900532… (ülke kodundan sonra trunk 0)
  while (digits.startsWith('90') && digits.length >= 13 && digits[2] === '0') {
    digits = `90${digits.slice(3)}`;
  }

  // 11 hane ve 5 ile başlıyorsa fazla basamak (yapıştırma) — ilk 10’u al
  if (/^5\d{10}$/.test(digits)) {
    digits = digits.slice(0, 10);
  }

  if (digits.startsWith('0')) {
    digits = `90${digits.slice(1)}`;
  } else if (!digits.startsWith('90') && digits.length === 10) {
    digits = `90${digits}`;
  }

  // TR cep: 90 + 10 hane = 12. Fazla basamak varsa kırp.
  if (digits.startsWith('90') && digits.length > 12 && digits[2] === '5') {
    digits = digits.slice(0, 12);
  }

  if (digits.length < 11) return null;

  // TR cep numarası net formatta olmalı — aksi halde WhatsApp «kullanmıyor» der
  if (digits.startsWith('905') && !/^905\d{9}$/.test(digits)) {
    return null;
  }

  return digits;
}

/**
 * WhatsApp Desktop/macOS için api.whatsapp.com daha güvenilir;
 * wa.me bazen yanlış «numarası WhatsApp kullanmıyor» uyarısı üretebiliyor.
 */
export function buildWhatsAppMeUrl(
  phone: string | null | undefined,
  message?: string | null,
): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  const text = message?.trim();
  if (!normalized) {
    if (!text) return null;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }
  if (!text) return `https://api.whatsapp.com/send?phone=${normalized}`;
  return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(text)}`;
}

/** Desktop uygulaması için protokol linki (HTTPS yedekle birlikte kullanılır). */
export function buildWhatsAppAppUrl(
  phone: string | null | undefined,
  message?: string | null,
): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const text = message?.trim();
  if (!text) return `whatsapp://send?phone=${normalized}`;
  return `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(text)}`;
}
