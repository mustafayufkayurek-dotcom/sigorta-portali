import { stripTrailingSlash } from './app-url';

/** Panel hasar dosyası detay sayfası */
export function panelHasarDosyasiPath(claimFileId: string): string {
  return `/panel/hasar-dosyalari/${claimFileId}`;
}

/** Panel onarım raporu düzenleme sayfası */
export function panelOnarimRaporuPath(claimFileId: string, reportId: string): string {
  return `/panel/hasar-dosyalari/${claimFileId}/onarim-raporu/${reportId}`;
}

/** Panel revizyon talebi detayı */
export function panelRevizyonTalebiPath(revisionId: string): string {
  return `/panel/revizyon-talepleri/${revisionId}`;
}

export function buildPanelUrl(appUrl: string, path: string): string {
  const base = stripTrailingSlash(appUrl);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
