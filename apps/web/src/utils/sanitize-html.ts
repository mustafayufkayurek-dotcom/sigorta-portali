/**
 * HTML süzgeci — XSS (OWASP).
 * İstemcide DOMParser (DOMPurify sınıfı); sunucuda aynı kurallı döngülü regex.
 * Belge süzgeci style + svg (karekod) korur; önizleme süzgeci ikisini de siler.
 */

const DANGEROUS_TAGS = 'script|iframe|object|embed|form|input|button|meta|link|base|applet|textarea|noscript|frame|frameset';
const PREVIEW_EXTRA_TAGS = 'style|svg|math';

const UNSAFE_TAGS = new RegExp(`<\\s*\\/?\\s*(${DANGEROUS_TAGS}|${PREVIEW_EXTRA_TAGS})[^>]*>`, 'gi');
const UNSAFE_TAGS_DOCUMENT = new RegExp(`<\\s*\\/?\\s*(${DANGEROUS_TAGS})[^>]*>`, 'gi');
const UNSAFE_EVENT_ATTRS = /\s+on[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URLS =
  /\s+(href|src|action|formaction|xlink:href)\s*=\s*(['"]?)\s*(javascript:|vbscript:|data\s*:\s*text\s*\/\s*html)[\s\S]*?\2/gi;
const UNSAFE_SRCDOC = /\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

function stripUntilStable(html: string, pass: (input: string) => string): string {
  let cur = html || '';
  for (let i = 0; i < 8; i += 1) {
    const next = pass(cur);
    if (next === cur) return next;
    cur = next;
  }
  return cur;
}

function regexSanitize(html: string, tagRe: RegExp): string {
  return stripUntilStable(html, (input) =>
    input
      .replace(tagRe, '')
      .replace(UNSAFE_EVENT_ATTRS, '')
      .replace(UNSAFE_URLS, '')
      .replace(UNSAFE_SRCDOC, ''),
  );
}

function isDangerousUrl(value: string): boolean {
  const compact = value.trim().toLowerCase().replace(/[\s\0]/g, '');
  return (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('data:text/html')
  );
}

function sanitizeWithDomParser(html: string, allowDocumentChrome: boolean): string {
  if (typeof DOMParser === 'undefined') {
    return regexSanitize(html, allowDocumentChrome ? UNSAFE_TAGS_DOCUMENT : UNSAFE_TAGS);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__s">${html}</div>`, 'text/html');
  const root = doc.getElementById('__s') ?? doc.body;
  const forbidden = new Set(
    `${DANGEROUS_TAGS}${allowDocumentChrome ? '' : `|${PREVIEW_EXTRA_TAGS}`}`.split('|'),
  );

  root.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (forbidden.has(tag)) {
      el.remove();
      return;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'xlink:href') {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src' || name === 'action') && isDangerousUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return root.innerHTML;
}

export function escapeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHtml(html: string): string {
  const regexClean = regexSanitize(html || '', UNSAFE_TAGS);
  return sanitizeWithDomParser(regexClean, false);
}

/** Sunucudan gelen tam HTML belgeler — script vb. engellenir, style ve svg (karekod) korunur */
export function sanitizeDocumentHtml(html: string): string {
  const regexClean = regexSanitize(html || '', UNSAFE_TAGS_DOCUMENT);
  return sanitizeWithDomParser(regexClean, true);
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
    .replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();

  // Kırık absolute logo URL'lerini (yanlış APP_URL / eski host) aynı origin resmi yola çevir
  bodyContent = bodyContent.replace(
    /(<img\b[^>]*\bsrc=["'])([^"']*meridyen-logo[^"']*)(["'][^>]*>)/gi,
    '$1/meridyen-logo-original.png$3',
  );

  const scopedCss = styles.map(scopeDocumentStyles).join('\n');
  const styleBlock = scopedCss ? `<style>${scopedCss}</style>` : '';

  return `${styleBlock}<div class="evrak-document-root">${bodyContent}</div>`;
}
