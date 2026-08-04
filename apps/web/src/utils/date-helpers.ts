/**
 * Ortak tarih yardımcı fonksiyonları
 * Müşteriler ve Tedarikçiler sayfalarında kullanılır.
 */

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function fmtDate(d: string | null | undefined): string {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString('tr-TR') : '—';
}

export function fmtDateTime(
  d: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  const dt = parseDate(d);
  return dt ? dt.toLocaleString('tr-TR', options) : '—';
}

/** Rapor oluşturma / onaya sunum süresi — alt bant analizi */
export function formatReportDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 60_000) return '<1 dk';
  const totalMin = Math.floor(safe / 60_000);
  if (totalMin < 60) return `${totalMin} dk`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
}

export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Az önce' : `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} hafta önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  const years = Math.floor(days / 365);
  return `${years} yıl önce`;
}

export function activityColor(dateStr: string | null | undefined): string {
  if (!dateStr) return 'text-gray-400';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days > 90) return 'text-status-danger';
  if (days > 30) return 'text-orange-500';
  return 'text-gray-600';
}

/**
 * WhatsApp wa.me için rakam dizisi (ülke kodu dahil, + yok).
 * TR: 0532… / 532… / +90 532… → 90532…
 * Çift 90 (9090…) ve baştaki 00 temizlenir — aksi halde WhatsApp
 * «numarası WhatsApp kullanmıyor» uyarısı verebilir.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

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

/**
 * Telefon numarasını WhatsApp wa.me linkine dönüştürür.
 */
export function toWhatsAppLink(phone: string | null | undefined, message?: string | null): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  const text = message?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}
