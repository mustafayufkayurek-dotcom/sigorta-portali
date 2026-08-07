/**
 * Geriye dönük dosya girişi için geçici muafiyet.
 *
 * 09.08.2026 (Europe/Istanbul) öncesi: WhatsApp açmadan «Gönderildi» işaretlenebilir.
 * 09.08.2026 00:00 itibarıyla: önce WhatsApp açılmalı, sonra Gönderildi aktif olur.
 */
export const WHATSAPP_OPEN_REQUIRED_FROM_ISO_DATE = '2026-08-09';

function istanbulCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** true → WhatsApp açmadan Gönderildi işaretlemek kapalı (zorunlu akış). */
export function isWhatsAppOpenRequiredBeforeMarkSent(now: Date = new Date()): boolean {
  return istanbulCalendarDate(now) >= WHATSAPP_OPEN_REQUIRED_FROM_ISO_DATE;
}

/** true → geçici muafiyet aktif (geriye dönük giriş). */
export function isWhatsAppMarkSentBypassActive(now: Date = new Date()): boolean {
  return !isWhatsAppOpenRequiredBeforeMarkSent(now);
}

export const WHATSAPP_MARK_SENT_BYPASS_NOTE =
  'Geçici: 09.08.2026 tarihine kadar WhatsApp açmadan «Gönderildi» işaretlenebilir. Bu tarihten itibaren yeniden zorunlu olur.';
