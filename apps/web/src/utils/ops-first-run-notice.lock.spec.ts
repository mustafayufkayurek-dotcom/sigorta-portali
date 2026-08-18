/**
 * Canlı operasyon değişikliği iş ekranında bir kez anlatılır; kılavuz tek başına yetmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-first-run-notice.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OPS_NOTICE } from './ops-first-run-notice.ts';

const here = dirname(fileURLToPath(import.meta.url));
const acilPage = readFileSync(
  join(here, '../app/panel/acil-yardim/[id]/page.tsx'),
  'utf8',
);
const acilForm = readFileSync(
  join(here, '../components/emergency/EmergencyCaseNewForm.tsx'),
  'utf8',
);
const notice = readFileSync(
  join(here, '../components/operasyon/OpsFirstRunNotice.tsx'),
  'utf8',
);

describe('operasyon ilk kullanım şeridi LOCK', () => {
  it('şerit Anladım ile kapanır; Google / API yok', () => {
    assert.match(notice, /Anladım/);
    assert.match(notice, /dismissOpsNotice/);
    assert.doesNotMatch(notice, /Google/);
  });

  it('Acil dosyada kayıtlı tedarikçi şeridi durur', () => {
    assert.match(acilPage, /OpsFirstRunNotice/);
    assert.match(acilPage, /OPS_NOTICE\.acilKayitliTedarikci/);
    assert.match(acilPage, /tedarikci-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilKayitliTedarikci.id, 'acil-kayitli-tedarikci-v516');
  });

  it('Acil yeni dosyada vekalet şeridi durur', () => {
    assert.match(acilForm, /OpsFirstRunNotice/);
    assert.match(acilForm, /OPS_NOTICE\.acilDosyaSorumlusuVekalet/);
    assert.match(acilForm, /dosya-sorumlusu-ilk-kullanim-seridi/);
  });
});
