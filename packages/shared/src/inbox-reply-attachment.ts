/** Graph JSON gövdesi ~4 MB; taban64 ile ham ek tavanı. Yanıt taslak açmaz. */
export const INBOX_REPLY_ATTACH_MAX_BYTES = 3_000_000;
export const INBOX_REPLY_ATTACH_MAX_FILES = 25;

export const INBOX_REPLY_ATTACH_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.doc,.docx,.xls,.xlsx';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|heic|heif|pdf|docx?|xlsx?)$/i;

export function isInboxReplyAttachmentAllowed(fileName: string, contentType?: string | null): boolean {
  const mime = (contentType ?? '').trim().toLowerCase();
  if (mime && ALLOWED_MIME.has(mime)) return true;
  return ALLOWED_EXT.test(fileName ?? '');
}

export function isInboxReplyImageAttachment(fileName: string, contentType?: string | null): boolean {
  const mime = (contentType ?? '').trim().toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName ?? '');
}

export function sanitizeInboxReplyAttachmentName(fileName: string): string {
  const base = (fileName || 'ek').replace(/\\/g, '/').split('/').pop()?.trim() || 'ek';
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').slice(0, 180);
  return cleaned || 'ek';
}
