/** Gelen kutu yanıtı: yazışma geçmişi kalır, logo / imza yığını düşer. */

const MAX_QUOTE_CHARS = 12_000;

export interface InboxReplyQuoteInput {
  replyText: string;
  fromName?: string | null;
  fromAddress?: string | null;
  receivedAt?: Date | string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  bodyPreview?: string | null;
}

const SOCIAL_OR_LOGO_DUST =
  /^(linkedin|facebook|instagram|twitter|youtube|whatsapp|x\.com|t\.co)\b/i;

export function stripEmailLogosAndRepeat(htmlOrText: string): string {
  const withoutMedia = htmlOrText
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<v:imagedata\b[^>]*\/?>/gi, ' ')
    .replace(/cid:[^\s"'<>]+/gi, ' ');
  return collapseRepeatedLines(htmlToPlain(withoutMedia));
}

function htmlToPlain(raw: string): string {
  return raw
    .replace(/<\/t[hd]>\s*<t[hd][^>]*>/gi, ': ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/:{2,}/g, ':')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function collapseRepeatedLines(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, ' ').trimEnd());
  const seen = new Map<string, number>();
  const out: string[] = [];
  let prev = '';
  let emptyRun = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      emptyRun += 1;
      if (emptyRun === 1) out.push('');
      continue;
    }
    emptyRun = 0;
    if (SOCIAL_OR_LOGO_DUST.test(trimmed) && trimmed.length < 48) continue;
    if (trimmed === prev) continue;
    prev = trimmed;
    const key = trimmed.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) continue;
    out.push(trimmed);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function inboxReplyQuoteBody(input: InboxReplyQuoteInput): string {
  const raw = [input.bodyHtml, input.bodyText, input.bodyPreview]
    .map((part) => (part ?? '').trim())
    .find(Boolean);
  if (!raw) return '';
  const cleaned = stripEmailLogosAndRepeat(raw);
  if (cleaned.length <= MAX_QUOTE_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_QUOTE_CHARS).trimEnd()}\n…`;
}

function formatReceivedAt(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildInboxReplyQuotePreview(input: InboxReplyQuoteInput): string {
  const who = [input.fromName?.trim(), input.fromAddress?.trim()].filter(Boolean).join(' · ');
  const when = formatReceivedAt(input.receivedAt);
  const subject = input.subject?.trim() ?? '';
  const header = [
    who ? `Kimden: ${who}` : '',
    when ? `Tarih: ${when}` : '',
    subject ? `Konu: ${subject}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const body = inboxReplyQuoteBody(input);
  return [header, body].filter(Boolean).join('\n\n').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Giden yazının altında teyit cümlesi — Outlook okundusuna bağlı değiliz. */
export const INBOX_REPLY_CONFIRM_LINE =
  'Bu Yazışma Tarafınıza Ulaştığında Lütfen Teyid Ediniz.';
export function buildInboxReplyHtml(input: InboxReplyQuoteInput): string {
  const reply = escapeHtml(input.replyText.trim()).replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
  const preview = buildInboxReplyQuotePreview(input);
  const confirm = `<p style="margin:12px 0 0;font-size:13px;color:#334155">${escapeHtml(INBOX_REPLY_CONFIRM_LINE)}</p>`;
  if (!preview) {
    return `<div>${reply}${confirm}</div>`;
  }
  const quote = escapeHtml(preview).replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
  return `<div>${reply}${confirm}</div>
<hr style="border:none;border-top:1px solid #cbd5e1;margin:16px 0 12px">
<p style="margin:0 0 8px;font-size:12px;color:#64748b">Yazışma geçmişi</p>
<div style="border-left:3px solid #cbd5e1;padding:0 0 0 12px;color:#334155;font-size:13px">${quote}</div>`;
}
