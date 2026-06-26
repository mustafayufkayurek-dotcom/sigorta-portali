import { createHash } from 'crypto';

/** Sözleşme HTML içeriğinin değişmezlik kanıtı için SHA-256 özeti */
export function hashAgreementContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
