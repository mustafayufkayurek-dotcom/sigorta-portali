/**
 * Thin re-export for Nest/TS — vendored paulmillr/qr (encode only).
 * License: MIT OR Apache-2.0 — see LICENSE in this folder.
 */
import { encodeQR as encodeQrFn } from './index.js';

export const encodeQR = encodeQrFn as (
  text: string,
  output: 'svg' | 'ascii' | 'term' | 'gif' | 'raw',
  opts?: { scale?: number; ecc?: 'low' | 'medium' | 'quartile' | 'high' },
) => string | boolean[][] | Uint8Array;

export default encodeQR;
