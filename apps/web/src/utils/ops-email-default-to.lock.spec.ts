/**
 * Kilit: liste e-posta alıcısı müşteri kartı; sigorta yedeği ikinci.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-email-default-to.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveOpsEmailDefaultTo } from './ops-email-default-to.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('liste mail alıcısı LOCK', () => {
  it('Sezgi müşteri adresini sigortadan önce seçer', () => {
    const to = resolveOpsEmailDefaultTo({
      customerEmail: 'sezgi@sezgiglobal.com',
      insuranceEmail: 'info@m-nihalsigorta.com',
    });
    assert.equal(to, 'sezgi@sezgiglobal.com');
  });

  it('Hasar ve operasyon listesi yardımcı fonksiyonu kullanır', () => {
    const hasar = readFileSync(join(here, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    const ops = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(hasar, /resolveOpsEmailDefaultTo/);
    assert.match(ops, /resolveOpsEmailDefaultTo/);
    assert.doesNotMatch(hasar, /insuranceCompany\?\.contactEmail \?\? claim\.customer\?\.email/);
  });
});
