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
  logoUrl?: string | null;
  fileNo?: string | null;
  fileTopic?: string | null;
  insuredName?: string | null;
  insuranceCompany?: string | null;
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

export const DOSYA_YAZISMALARI_LABEL = 'Dosya Yazışmaları';

const TR_MONTHS: Record<string, string> = {
  ocak: '01', şubat: '02', subat: '02', mart: '03', nisan: '04', mayıs: '05', mayis: '05',
  haziran: '06', temmuz: '07', ağustos: '08', agustos: '08', eylül: '09', eylul: '09',
  ekim: '10', kasım: '11', kasim: '11', aralık: '12', aralik: '12',
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const HEADER_LINE =
  /^(from|to|cc|sent|subject|kimden|kime|bilgi|gönderen|gonderen|gönderildi|gonderildi|konu)\s*[:：]/i;
const NOISE_LINE =
  /^(android için outlook|get outlook for|outlook for android|this email.*outlook)/i;
const FORM_CUT =
  /\b(KONUT HASAR İHBAR FORMU|HASAR İHBAR FORMU|ACİL YARDIM İHBAR FORMU|İHBAR FORMU)\b/i;

function displayPerson(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/["']/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*[·|].*$/, '')
    .trim();
}

function headerValue(line: string): string {
  return line.replace(/^[^:：]+[:：]\s*/, '').trim();
}

function formatDayHour(day: string, month: string, year: string, hour: string, minute: string): string {
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function formatCorrespondenceWhen(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  const numeric = compact.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(\d{1,2})[:.](\d{2})/);
  if (numeric) {
    return formatDayHour(numeric[1], numeric[2], numeric[3], numeric[4], numeric[5]);
  }
  const named = compact.match(
    /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4}).*?(\d{1,2})[:.](\d{2})/u,
  );
  if (named) {
    const month = TR_MONTHS[named[2].toLocaleLowerCase('tr-TR')] ?? TR_MONTHS[named[2].toLowerCase()];
    if (month) return formatDayHour(named[1], month, named[3], named[4], named[5]);
  }
  return compact
    .replace(/^(gönderildi|gonderildi|sent)\s*[:：]\s*/i, '')
    .trim();
}

export function fileStripFromSubject(subject?: string | null): {
  fileNo: string;
  fileTopic: string;
  insuredName: string;
} {
  const clean = String(subject ?? '')
    .replace(/^(ynt|re|fw|fwd|ileti|cevap)\s*:\s*/ig, '')
    .trim();
  const parts = clean.split('/').map((p) => p.trim()).filter(Boolean);
  const fileNo = parts.find((p) => /^RCS-?\d+/i.test(p) || /^AY-/i.test(p) || /^HAS-/i.test(p)) ?? '';
  const insuredName = parts.find((p) => /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/u.test(p) && !/^RCS/i.test(p) && !/^\d+$/.test(p) && p.length < 48) ?? '';
  const fileTopic = parts.at(-1) && parts.at(-1) !== fileNo && parts.at(-1) !== insuredName
    ? parts.at(-1) ?? ''
    : '';
  return { fileNo, fileTopic, insuredName };
}

export interface FileCorrespondenceItem {
  when: string;
  who: string;
  body: string;
}

export function splitFileCorrespondence(input: InboxReplyQuoteInput): FileCorrespondenceItem[] {
  let cleaned = inboxReplyQuoteBody(input);
  const formAt = cleaned.search(FORM_CUT);
  if (formAt > 40) cleaned = cleaned.slice(0, formAt).trim();
  const lines = cleaned.split(/\n/);
  const items: FileCorrespondenceItem[] = [];
  let who = displayPerson(input.fromName ?? '') || displayPerson(input.fromAddress ?? '');
  let when = formatReceivedAt(input.receivedAt);
  let body: string[] = [];

  const flush = () => {
    const text = body.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text && !who && !when) return;
    if (!text) {
      body = [];
      return;
    }
    items.push({ when, who, body: text });
    body = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (body.length) body.push('');
      continue;
    }
    if (NOISE_LINE.test(line)) continue;
    if (HEADER_LINE.test(line)) {
      const key = line.split(/[:：]/)[0].trim().toLocaleLowerCase('tr-TR');
      const value = headerValue(line);
      if (/^(from|kimden|gönderen|gonderen)$/.test(key)) {
        flush();
        who = displayPerson(value);
        when = '';
        continue;
      }
      if (/^(sent|gönderildi|gonderildi)$/.test(key)) {
        when = formatCorrespondenceWhen(value);
        continue;
      }
      continue;
    }
    body.push(line);
  }
  flush();
  return items.filter((item) => item.body.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PERSON_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#0b2847" stroke-width="1.8"/><path d="M4 21a8 8 0 0 1 16 0" stroke="#0b2847" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function buildInboxReplyQuotePreview(input: InboxReplyQuoteInput): string {
  const items = splitFileCorrespondence(input);
  if (!items.length) return '';
  return items
    .map((item, index) => {
      const head = [item.when, item.who].filter(Boolean).join(' · ');
      const block = [head, item.body].filter(Boolean).join('\n');
      return index === 0 ? block : `------\n${block}`;
    })
    .join('\n');
}

/** Giden yazının altında teyit cümlesi — Outlook okundusuna bağlı değiliz. */
export const INBOX_REPLY_CONFIRM_LINE =
  'Bu Yazışma Tarafınıza Ulaştığında Lütfen Teyid Ediniz.';
export function buildInboxReplyHtml(input: InboxReplyQuoteInput): string {
  const reply = escapeHtml(input.replyText.trim()).replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
  const confirm = `<p style="margin:12px 0 0;font-size:13px;color:#334155">${escapeHtml(INBOX_REPLY_CONFIRM_LINE)}</p>`;
  const items = splitFileCorrespondence(input);
  const strip = fileStripFromSubject(input.subject);
  const fileNo = (input.fileNo ?? strip.fileNo).trim();
  const fileTopic = (input.fileTopic ?? strip.fileTopic).trim();
  const insuredName = (input.insuredName ?? strip.insuredName).trim();
  const insuranceCompany = (input.insuranceCompany ?? '').trim();
  const fileLine = [fileNo ? `Dosya ${escapeHtml(fileNo)}` : '', fileTopic ? escapeHtml(fileTopic) : '']
    .filter(Boolean)
    .join(' · ');
  const bannerBits = [
    fileLine,
    insuredName ? `Sigortalı ${escapeHtml(insuredName)}` : '',
    insuranceCompany ? escapeHtml(insuranceCompany) : '',
  ].filter(Boolean);
  const logo = String(input.logoUrl ?? '').trim();
  const safeLogo =
    logo && /meridyen/i.test(logo) && !/javascript:/i.test(logo)
      ? `<img src="${escapeHtml(logo)}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;"/>`
      : '';

  const history = items
    .map((item, index) => {
      const head = [item.when, item.who].filter(Boolean).join(' · ');
      const card = `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;"><tr>
<td style="width:22px;vertical-align:top;padding-top:2px;">${PERSON_ICON}</td>
<td style="font-size:13px;line-height:1.45;color:#334155;"><strong>${escapeHtml(head)}</strong><br/>${escapeHtml(item.body).replace(/\n/g, '<br>\n')}</td>
</tr></table>`;
      if (index === 0) return card;
      return `<div style="margin:0 0 12px;font-size:13px;letter-spacing:1px;color:#94A3B8;">------</div>\n${card}`;
    })
    .join('\n');

  const inner = `<div style="font-size:13px;font-weight:600;color:#64748B;margin:0 0 8px;">Yeni Yazı</div>
<div style="font-size:16px;line-height:1.5;color:#0f172a;">${reply}</div>${confirm}
${
  history
    ? `<div style="border-left:3px solid #0b2847;padding:0 0 0 12px;margin-top:24px;">
<div style="font-size:13px;font-weight:600;color:#0b2847;margin:0 0 12px;">${DOSYA_YAZISMALARI_LABEL}</div>
${history}
</div>`
    : ''
}`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E2E8F0;">
<tr><td style="padding:14px 24px;border-bottom:2px solid #1E5AA8;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:14px;font-weight:600;color:#0b2847;">Meridyen Asistans</td>
<td align="right">${safeLogo}</td>
</tr></table>
</td></tr>
${
  bannerBits.length
    ? `<tr><td style="padding:16px 24px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;font-size:14px;line-height:1.5;color:#0f172a;">${bannerBits.join('<br/>')}</td></tr>`
    : ''
}
<tr><td style="padding:24px;">${inner}</td></tr>
</table>
</div>`;
}
