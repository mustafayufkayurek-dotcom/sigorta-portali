/**
 * Node Content-Disposition header ASCII-only; Türkçe dosya adı ERR_INVALID_CHAR üretir.
 * Smart Measure controller ile aynı desen (FSB bugfix S1).
 */
export function toFieldSurveyPdfContentDisposition(filename: string): string {
  const ascii =
    filename
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[^\x20-\x7E]+/g, '_')
      .replace(/["\\]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'kesif-olcusu.pdf';
  const utf8 = encodeURIComponent(filename).replace(/['()]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
