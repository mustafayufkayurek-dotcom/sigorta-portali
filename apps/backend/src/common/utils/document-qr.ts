/**
 * Matbu / kamu evrak için Dijital Onay QR bloğu.
 * Üretim: vendored paulmillr/qr (0-dep encode) — npm kurulumuna bağlı değil.
 */
import encodeQR from './vendor/paulmillr-qr/encode';

/** Kamu evrak URL’sini kodlayan SVG + Title Case etiket */
export function renderDigitalApprovalQrBlock(publicUrl: string): string {
  const url = (publicUrl || '').trim();
  if (!url) return '';

  let svg: string;
  try {
    svg = encodeQR(url, 'svg', { scale: 3, ecc: 'medium' }) as string;
  } catch {
    return '';
  }

  const sized = svg.replace(
    /<svg\b([^>]*)>/i,
    '<svg$1 width="88" height="88" style="display:block">',
  );

  return `<div class="dijital-onay-qr" data-testid="matbu-dijital-onay-qr">
  <div class="dijital-onay-qr-code">${sized}</div>
  <div class="dijital-onay-qr-label">Dijital Onay</div>
  <div class="dijital-onay-qr-hint">Onay için karekodu okutun veya link</div>
</div>`;
}

/** Matbu şablon CSS — QR yerleşimi */
export const DOCUMENT_QR_STYLES = `
    .dijital-onay-qr { text-align: center; flex-shrink: 0; }
    .dijital-onay-qr-code { display: inline-block; padding: 4px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; }
    .dijital-onay-qr-code svg { width: 88px; height: 88px; }
    .dijital-onay-qr-label { margin-top: 6px; font-size: 11px; font-weight: 700; color: #1a4080; letter-spacing: 0.01em; }
    .dijital-onay-qr-hint { font-size: 9px; color: #64748b; margin-top: 1px; }
    .doc-header-with-qr { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2px solid #1a4080; padding-bottom: 14px; margin-bottom: 18px; }
    .doc-header-with-qr .doc-header-main { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex: 1; min-width: 0; }
    .doc-header-with-qr .doc-header-logo img { height: 64px; width: auto; max-width: 220px; object-fit: contain; display: block; }
    .doc-header-with-qr .doc-header-meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.5; }
    .doc-header-with-qr .doc-header-meta strong { display: block; font-size: 13px; color: #1a4080; margin-bottom: 2px; }
`;

/**
 * Eski / özel şablonda {{dijital_onay_qr}} yoksa başlık bandına QR ekler.
 */
export function injectDigitalApprovalQrIntoHtml(html: string, qrBlock: string): string {
  if (!qrBlock) return html;
  if (html.includes('{{dijital_onay_qr}}')) {
    return html.replaceAll('{{dijital_onay_qr}}', qrBlock);
  }
  if (html.includes('dijital-onay-qr') || html.includes('data-testid="matbu-dijital-onay-qr"')) {
    return html;
  }

  const headerRe =
    /<div class="doc-header">([\s\S]*?)<\/div>\s*(?=<h1|<p class="form-subtitle"|<div class="header-right")/;
  if (headerRe.test(html)) {
    return html.replace(headerRe, (_m, inner: string) => {
      return `<div class="doc-header-with-qr">
  <div class="doc-header-main">${inner}</div>
  ${qrBlock}
</div>
`;
    });
  }

  if (html.includes('</body>')) {
    return html.replace(
      '</body>',
      `<div style="margin:16px 28px 24px;text-align:right">${qrBlock}</div></body>`,
    );
  }
  return `${html}\n${qrBlock}`;
}
