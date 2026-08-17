/** HTML metin kaçışı — XSS (OWASP). Kullanıcı/DB metnini HTML’e gömmeden önce. */
export function escHtml(s: string | null | undefined): string {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Placeholder haritası: ham HTML anahtarları (QR, tablo) hariç tüm değerler kaçışlı. */
export function escHtmlRecord(
  map: Record<string, string>,
  rawHtmlKeys: ReadonlySet<string> = new Set(),
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    out[key] = rawHtmlKeys.has(key) ? value : escHtml(value);
  }
  return out;
}
