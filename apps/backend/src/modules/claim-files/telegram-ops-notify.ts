/**
 * Operasyon Telegram grubu — scripts/monitoring/telegram-notify.sh ile aynı API.
 * Token/chat: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (.env.telegram / backend env).
 */

export type TelegramOpsSendResult =
  | { ok: true; suppressed?: false }
  | { ok: false; reason: string };

export async function sendMeridyenTelegramOpsMessage(
  text: string,
  opts?: {
    token?: string | null;
    chatId?: string | null;
    fetchImpl?: typeof fetch;
  },
): Promise<TelegramOpsSendResult> {
  const token = (opts?.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = (opts?.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '').trim();
  if (!token || !chatId) {
    return { ok: false, reason: 'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik' };
  }

  const fetchFn = opts?.fetchImpl ?? fetch;
  try {
    const resp = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const body = (await resp.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!resp.ok || !body?.ok) {
      return {
        ok: false,
        reason: body?.description || `HTTP ${resp.status}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Telegram isteği başarısız',
    };
  }
}

export function isTelegramInspectionReminderEnabled(): boolean {
  const v = String(process.env.TELEGRAM_INSPECTION_REMINDER_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Yalnız kontrollü test — mesai dışı gönderime izin (prod’da kapalı tut). */
export function isTelegramInspectionReminderOffHoursAllowed(): boolean {
  const v = String(process.env.TELEGRAM_INSPECTION_REMINDER_ALLOW_OFF_HOURS ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function isTelegramApprovalDelayReminderEnabled(): boolean {
  const v = String(process.env.TELEGRAM_APPROVAL_DELAY_REMINDER_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Yalnız kontrollü test — mesai dışı gönderime izin (prod’da kapalı tut). */
export function isTelegramApprovalDelayReminderOffHoursAllowed(): boolean {
  const v = String(process.env.TELEGRAM_APPROVAL_DELAY_REMINDER_ALLOW_OFF_HOURS ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Fatura talebi oluşturulunca admin + finans uyarısı */
export function isTelegramInvoiceRequestNotifyEnabled(): boolean {
  const v = String(process.env.TELEGRAM_INVOICE_REQUEST_NOTIFY_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
