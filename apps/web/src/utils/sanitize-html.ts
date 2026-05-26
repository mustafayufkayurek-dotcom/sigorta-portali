const UNSAFE_TAGS = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|meta|link|style)[^>]*>/gi;
const UNSAFE_EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const UNSAFE_URLS = /\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi;

export function sanitizeHtml(html: string): string {
  return (html || '')
    .replace(UNSAFE_TAGS, '')
    .replace(UNSAFE_EVENT_ATTRS, '')
    .replace(UNSAFE_URLS, '');
}
