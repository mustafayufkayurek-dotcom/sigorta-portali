/**
 * Hasar listesi ?status=open/closed kilidi.
 * Çalıştır: pnpm smoke:field-open-list
 *   veya: node --experimental-strip-types --test src/utils/claim-list-url-status.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  appendClaimListStatusParams,
  claimListStatusFilterFromUrl,
  resolveClaimListUrlStatus,
} from './claim-list-url-status.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/page.tsx'),
  'utf8',
);

const STATUSES = [
  { id: 's-pre', code: 'pre_review', name: 'Ön İnceleme' },
  { id: 's-repair', code: 'repair_in_progress', name: 'Onarım Devam Ediyor' },
  { id: 's-closed', code: 'closed', name: 'Kapatıldı' },
];

describe('claim-list-url-status lock', () => {
  it('open/closed semantic çözülür; tek duruma daralmaz', () => {
    assert.deepEqual(resolveClaimListUrlStatus('open', STATUSES), { kind: 'open' });
    assert.deepEqual(resolveClaimListUrlStatus('closed', STATUSES), { kind: 'closed' });
    assert.deepEqual(resolveClaimListUrlStatus('sla_exceeded', STATUSES), { kind: 'sla_exceeded' });
  });

  it('«Onarım Devam Ediyor» open sanılmaz (devam fuzzy regresyonu)', () => {
    assert.notEqual(claimListStatusFilterFromUrl('open', STATUSES), 's-repair');
    assert.equal(claimListStatusFilterFromUrl('open', STATUSES), '__open__');
    assert.equal(claimListStatusFilterFromUrl('closed', STATUSES), '__closed__');
    assert.equal(claimListStatusFilterFromUrl('pre_review', STATUSES), 's-pre');
  });

  it('open/closed API parametresi statusCode üretir', () => {
    const openParams = new URLSearchParams();
    appendClaimListStatusParams(openParams, '__open__');
    assert.equal(openParams.get('statusCode'), 'open');
    assert.equal(openParams.get('statusId'), null);

    const closedParams = new URLSearchParams();
    appendClaimListStatusParams(closedParams, '__closed__');
    assert.equal(closedParams.get('statusCode'), 'closed');
  });

  it('liste sayfasında fuzzy devam eşleşmesi yok; semantic yardımcı zorunlu', () => {
    assert.match(pageSrc, /claimListStatusFilterFromUrl/);
    assert.match(pageSrc, /appendClaimListStatusParams/);
    assert.doesNotMatch(pageSrc, /'devam'/);
  });
});
