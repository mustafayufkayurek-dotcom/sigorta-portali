const UNSAFE_TAGS = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|meta|link|style)[^>]*>/gi;
/** Evrak/sözleşme gibi sunucu üretimi belgeler — style etiketine izin verilir */
const UNSAFE_TAGS_NO_STYLE = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|meta|link)[^>]*>/gi;
const UNSAFE_EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const UNSAFE_URLS = /\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi;

export function sanitizeHtml(html: string): string {
  return (html || '')
    .replace(UNSAFE_TAGS, '')
    .replace(UNSAFE_EVENT_ATTRS, '')
    .replace(UNSAFE_URLS, '');
}

/** Sunucudan gelen tam HTML belgeleri için — script vb. engellenir, style korunur */
export function sanitizeDocumentHtml(html: string): string {
  return (html || '')
    .replace(UNSAFE_TAGS_NO_STYLE, '')
    .replace(UNSAFE_EVENT_ATTRS, '')
    .replace(UNSAFE_URLS, '');
}

function scopeDocumentStyles(css: string): string {
  return css
    .replace(/\bbody\s*\{/g, '.evrak-document-root {')
    .replace(/\bhtml\s*\{/g, '.evrak-document-root {');
}

/**
 * Tam HTML belgeyi (head/body) React içine gömülebilir parçaya çevirir.
 * sanitizeHtml style etiketini sildiği için CSS düz metin olarak görünüyordu.
 */
export function prepareTrustedDocumentHtml(html: string): string {
  const cleaned = sanitizeDocumentHtml(html || '');

  const styles: string[] = [];
  const stripped = cleaned.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    styles.push(css);
    return '';
  });

  const bodyMatch = stripped.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : stripped;

  bodyContent = bodyContent
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();

  const scopedCss = styles.map(scopeDocumentStyles).join('\n');
  const styleBlock = scopedCss ? `<style>${scopedCss}</style>` : '';

  return `${styleBlock}<div class="evrak-document-root">${bodyContent}</div>`;
}
