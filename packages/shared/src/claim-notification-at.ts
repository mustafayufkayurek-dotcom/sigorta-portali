/** İhbar anı. Gün olarak gelen tarih 03:00 diye basılmaz. */

const ISTANBUL = 'Europe/Istanbul';

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function istanbulParts(date: Date): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** Saat taşımayan değer: UTC veya İstanbul gece yarısı, saniyesiz. */
export function isDateOnlyInstant(value: unknown): boolean {
  const date = toDate(value);
  if (!date || date.getUTCMilliseconds() !== 0) return false;
  const utcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  return utcMidnight || istanbulParts(date).time === '00:00:00';
}

export function sameIstanbulDay(a: unknown, b: unknown): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  const dayOf = (d: Date) => (isDateOnlyInstant(d) && d.getUTCHours() === 0 ? d.toISOString().slice(0, 10) : istanbulParts(d).day);
  return dayOf(da) === dayOf(db);
}

/** Kayıtta: bugünün günü gelirse kayıt anı yazılır. Geçmiş gün olduğu gibi kalır. */
export function normalizeClaimNotificationDate(value: unknown, now: Date = new Date()): Date | null {
  const date = toDate(value);
  if (!date) return null;
  if (isDateOnlyInstant(date) && sameIstanbulDay(date, now)) return now;
  return date;
}

export type ClaimNotificationAt = { at: Date; dateOnly: boolean };

/** Gösterimde: eski gün kaydı dosya açılış günüyse açılış saati; değilse yalnız tarih. */
export function resolveClaimNotificationAt(
  notificationDate: unknown,
  createdAt?: unknown,
): ClaimNotificationAt | null {
  const notified = toDate(notificationDate);
  const created = toDate(createdAt);
  if (!notified) return created ? { at: created, dateOnly: false } : null;
  if (!isDateOnlyInstant(notified)) return { at: notified, dateOnly: false };
  if (created && sameIstanbulDay(notified, created)) return { at: created, dateOnly: false };
  return { at: notified, dateOnly: true };
}

export function formatClaimNotificationAt(
  notificationDate: unknown,
  createdAt?: unknown,
): string {
  const resolved = resolveClaimNotificationAt(notificationDate, createdAt);
  if (!resolved) return '—';
  if (resolved.dateOnly) {
    const d = resolved.at;
    const day = d.getUTCHours() === 0 ? d.toISOString().slice(0, 10) : istanbulParts(d).day;
    const [y, m, dd] = day.split('-');
    return `${dd}.${m}.${y}`;
  }
  return resolved.at.toLocaleString('tr-TR', {
    timeZone: ISTANBUL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
