/**
 * Bilgilendirme maili renkleri — durum okunur, prestij bozulmaz.
 *
 * Kilitli palet:
 * - navy  #123A63 / #1E5AA8  operasyon, atama, yeni ihbar
 * - orange #9A3412 / #C2410C  72s müşteri onay hatırlatması (ayrı şablon)
 * - teal  #0F766E            onarım raporu teslim (ayrı şablon)
 */

export type NotificationEmailTone = 'navy' | 'amber' | 'orange' | 'crimson' | 'emerald';

export function formatNotificationDateTime(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** İlçe · İl — telefon yok. */
export function formatNotificationCityDistrict(
  city?: string | null,
  district?: string | null,
): string {
  const il = (city ?? '').trim();
  const ilce = (district ?? '').trim();
  if (ilce && il) return `${ilce} · ${il}`;
  return ilce || il || '—';
}

export function notificationDash(value?: string | null): string {
  const text = (value ?? '').trim();
  return text || '—';
}
