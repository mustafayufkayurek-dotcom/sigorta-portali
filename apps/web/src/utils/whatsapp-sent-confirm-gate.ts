/**
 * Geriye dönük dosya girişi için geçici muafiyet (Hasar + Acil).
 *
 * 19.08.2026 (Europe/Istanbul) dahil: evrak / WhatsApp eksikleri onaya göndermeyi
 * ve «Gönderildi» işaretini kilitlemez.
 * 20.08.2026 00:00 (Europe/Istanbul) itibarıyla kural otomatik yeniden zorunlu olur.
 */
export const LEGACY_OPS_CATCHUP_ENFORCE_FROM_ISO_DATE = '2026-08-20';

/** @deprecated Aynı tarih — WhatsApp kapısı da ortak yakalama penceresini kullanır. */
export const WHATSAPP_OPEN_REQUIRED_FROM_ISO_DATE = LEGACY_OPS_CATCHUP_ENFORCE_FROM_ISO_DATE;

function istanbulCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** true → 20.08.2026 İstanbul günü ve sonrası (kural zorunlu). */
export function isLegacyOpsCatchupExpired(now: Date = new Date()): boolean {
  return istanbulCalendarDate(now) >= LEGACY_OPS_CATCHUP_ENFORCE_FROM_ISO_DATE;
}

/** true → 19.08.2026 İstanbul günü dahil muafiyet açık. */
export function isLegacyOpsCatchupBypassActive(now: Date = new Date()): boolean {
  return !isLegacyOpsCatchupExpired(now);
}

/** true → WhatsApp açmadan Gönderildi işaretlemek kapalı (zorunlu akış). */
export function isWhatsAppOpenRequiredBeforeMarkSent(now: Date = new Date()): boolean {
  return isLegacyOpsCatchupExpired(now);
}

/** true → geçici muafiyet aktif (geriye dönük giriş). */
export function isWhatsAppMarkSentBypassActive(now: Date = new Date()): boolean {
  return isLegacyOpsCatchupBypassActive(now);
}

export const LEGACY_OPS_CATCHUP_BYPASS_NOTE =
  'Geçici: 19.08.2026 tarihine kadar eksik evraklarla ilerleyebilirsiniz. 20.08.2026 itibarıyla kural otomatik yeniden zorunlu olur.';

export const WHATSAPP_MARK_SENT_BYPASS_NOTE =
  'Geçici: 19.08.2026 tarihine kadar WhatsApp açmadan «Gönderildi» işaretlenebilir. 20.08.2026 itibarıyla yeniden zorunlu olur.';
