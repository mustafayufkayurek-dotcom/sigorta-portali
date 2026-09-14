/** Platformdan giden yazının gönderene görünür kopyası (CC, gizli değil; ayrı mail yok). */

export interface FileOwnerMailCopy {
  email: string;
  name: string;
}

export const PLATFORM_MAIL_COPY_TITLE = 'Platform Mail Kopyası';

export const FILE_OWNER_COPY_NOTICE_LEAD =
  'Bu İleti Platform Üzerinden Yapılan Yazışmanın Teyidi Amacı İle Gönderilmiştir.';

export function formatFileOwnerCopyLine(copy: FileOwnerMailCopy): string {
  const name = copy.name.trim();
  return name ? `${name} (${copy.email})` : copy.email;
}

export function platformMailCopyLineLabel(roleCode?: string | null): string {
  switch (String(roleCode ?? '').trim().toLowerCase()) {
    case 'finance':
      return 'Finans Kopyası';
    case 'admin':
      return 'Yönetici Kopyası';
    case 'manager':
      return 'Müdür Kopyası';
    case 'office_staff':
      return 'Dosya Sorumlusu Kopyası';
    case 'field_staff':
      return 'Saha Kopyası';
    default:
      return 'Gönderen Kopyası';
  }
}

export function buildVisibleCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  copy: FileOwnerMailCopy;
  copyLineLabel: string;
  copyExplain?: string | null;
  extraLine?: string | null;
  title?: string | null;
  sentAt?: Date | string | null;
}): { plain: string; html: string } {
  const title = input.title?.trim() || PLATFORM_MAIL_COPY_TITLE;
  const counterpart = [input.counterpartName?.trim(), input.counterpartAddress?.trim()]
    .filter(Boolean)
    .join(' · ');
  const copyLine = formatFileOwnerCopyLine(input.copy);
  const extra = input.extraLine?.trim() || '';
  const explain = input.copyExplain?.trim() || '';
  const sentAt = formatPlatformMailSentAt(input.sentAt);
  const plain = [
    title,
    FILE_OWNER_COPY_NOTICE_LEAD,
    counterpart ? `Karşı Taraf: ${counterpart}` : '',
    `${input.copyLineLabel}: ${copyLine}`,
    sentAt ? `Gönderim Tarihi: ${sentAt}` : '',
    extra,
    explain,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;max-width:640px">
<tr><td style="background:#1e3a5f;color:#ffffff;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.3">${escapeHtml(title)}</td></tr>
<tr><td style="border:1px solid #cbd5e1;border-top:0;background:#f8fafc;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
<p style="margin:0 0 10px">${escapeHtml(FILE_OWNER_COPY_NOTICE_LEAD)}</p>
${counterpart ? `<p style="margin:0 0 6px"><strong>Karşı Taraf:</strong> ${escapeHtml(counterpart)}</p>` : ''}
<p style="margin:0 0 6px"><strong>${escapeHtml(input.copyLineLabel)}:</strong> ${escapeHtml(copyLine)}</p>
${sentAt ? `<p style="margin:0 0 10px"><strong>Gönderim Tarihi:</strong> ${escapeHtml(sentAt)}</p>` : ''}
${extra ? `<p style="margin:0 0 10px">${escapeHtml(extra)}</p>` : ''}
${explain ? `<p style="margin:0;color:#334155">${escapeHtml(explain)}</p>` : ''}
</td></tr>
</table>`;

  return { plain, html };
}

export function buildPlatformMailCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  sender: FileOwnerMailCopy;
  roleCode?: string | null;
  extraLine?: string | null;
  sentAt?: Date | string | null;
}): { plain: string; html: string } {
  return buildVisibleCopyNotice({
    title: PLATFORM_MAIL_COPY_TITLE,
    counterpartName: input.counterpartName,
    counterpartAddress: input.counterpartAddress,
    copy: input.sender,
    copyLineLabel: platformMailCopyLineLabel(input.roleCode),
    extraLine: input.extraLine,
    sentAt: input.sentAt,
  });
}

export function buildFileOwnerCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  owner: FileOwnerMailCopy;
  roleCode?: string | null;
}): { plain: string; html: string } {
  return buildPlatformMailCopyNotice({
    counterpartName: input.counterpartName,
    counterpartAddress: input.counterpartAddress,
    sender: input.owner,
    roleCode: input.roleCode,
  });
}

export function buildCrmSenderCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  sender: FileOwnerMailCopy;
  roleCode?: string | null;
  sentAt?: Date | string | null;
}): { plain: string; html: string } {
  return buildPlatformMailCopyNotice({
    counterpartName: input.counterpartName,
    counterpartAddress: input.counterpartAddress,
    sender: input.sender,
    roleCode: input.roleCode,
    extraLine: 'Gördüğünüzde lütfen Alındı yazarak yanıtlayın.',
    sentAt: input.sentAt,
  });
}

export function prependFileOwnerCopyNotice(bodyHtml: string, noticeHtml: string): string {
  const trimmed = bodyHtml.trim();
  if (!noticeHtml.trim()) return trimmed;
  return `${noticeHtml}\n${trimmed}`;
}

/** Hoş geldin: kopya yeni kullanıcının kendisine gitmez. */
export function welcomeInviteAdminCopies(
  admins: FileOwnerMailCopy[],
  recipientEmail: string,
): FileOwnerMailCopy[] {
  const dest = recipientEmail.trim().toLowerCase();
  const seen = new Set<string>();
  const copies: FileOwnerMailCopy[] = [];
  for (const admin of admins) {
    const email = String(admin.email ?? '').trim();
    const key = email.toLowerCase();
    if (!email.includes('@') || key === dest || seen.has(key)) continue;
    if (key.includes('ihbar@') || key.includes('hasar@')) continue;
    seen.add(key);
    copies.push({ email, name: String(admin.name ?? '').trim() });
  }
  return copies;
}

function formatPlatformMailSentAt(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
