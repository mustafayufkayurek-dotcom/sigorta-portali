/** Platformdan giden yazının dosya sorumlusuna görünür kopyası (CC, gizli değil). */

export interface FileOwnerMailCopy {
  email: string;
  name: string;
}

export const FILE_OWNER_COPY_NOTICE_LEAD =
  'Bu ileti platform üzerinden gönderilmiştir.';

export function formatFileOwnerCopyLine(copy: FileOwnerMailCopy): string {
  const name = copy.name.trim();
  return name ? `${name} (${copy.email})` : copy.email;
}

export function buildVisibleCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  copy: FileOwnerMailCopy;
  copyLineLabel: string;
  copyExplain: string;
  extraLine?: string | null;
}): { plain: string; html: string } {
  const counterpart = [input.counterpartName?.trim(), input.counterpartAddress?.trim()]
    .filter(Boolean)
    .join(' · ');
  const copyLine = formatFileOwnerCopyLine(input.copy);
  const extra = input.extraLine?.trim() || '';
  const plain = [
    FILE_OWNER_COPY_NOTICE_LEAD,
    counterpart ? `Karşı taraf: ${counterpart}` : '',
    `${input.copyLineLabel}: ${copyLine}`,
    extra,
    input.copyExplain,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<div style="border:1px solid #cbd5e1;background:#f8fafc;padding:12px 14px;border-radius:8px;margin:0 0 16px;font-size:13px;color:#0f172a">
<p style="margin:0 0 8px">${escapeHtml(FILE_OWNER_COPY_NOTICE_LEAD)}</p>
${counterpart ? `<p style="margin:0 0 4px">Karşı taraf: ${escapeHtml(counterpart)}</p>` : ''}
<p style="margin:0 0 8px">${escapeHtml(input.copyLineLabel)}: ${escapeHtml(copyLine)}</p>
${extra ? `<p style="margin:0 0 8px">${escapeHtml(extra)}</p>` : ''}
<p style="margin:0;color:#475569">${escapeHtml(input.copyExplain)}</p>
</div>`;

  return { plain, html };
}

export function buildFileOwnerCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  owner: FileOwnerMailCopy;
}): { plain: string; html: string } {
  return buildVisibleCopyNotice({
    counterpartName: input.counterpartName,
    counterpartAddress: input.counterpartAddress,
    copy: input.owner,
    copyLineLabel: 'Dosya sorumlusu kopyası',
    copyExplain:
      'Bu kopya, platformdan karşı tarafa giden yazının dosya sorumlusunun kutusuna düşen örneğidir.',
  });
}

export function buildCrmSenderCopyNotice(input: {
  counterpartName?: string | null;
  counterpartAddress?: string | null;
  sender: FileOwnerMailCopy;
}): { plain: string; html: string } {
  return buildVisibleCopyNotice({
    counterpartName: input.counterpartName,
    counterpartAddress: input.counterpartAddress,
    copy: input.sender,
    copyLineLabel: 'Gönderen kopyası',
    extraLine: 'Gördüğünüzde lütfen Alındı yazarak yanıtlayın.',
    copyExplain:
      'Bu kopya, platformdan karşı tarafa giden yazının gönderenin kutusuna düşen örneğidir.',
  });
}

export function prependFileOwnerCopyNotice(bodyHtml: string, noticeHtml: string): string {
  const trimmed = bodyHtml.trim();
  if (!noticeHtml.trim()) return trimmed;
  return `${noticeHtml}\n${trimmed}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
