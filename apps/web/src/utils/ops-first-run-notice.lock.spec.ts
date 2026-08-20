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
const guide = readFileSync(
  join(here, '../../public/docs/01-personel-kullanim-kilavuzu.html'),
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
    assert.equal(OPS_NOTICE.acilKayitliTedarikci.id, 'acil-kayitli-tedarikci-v520');
    assert.match(OPS_NOTICE.acilKayitliTedarikci.body, /ilk 3/);
    assert.match(OPS_NOTICE.acilKayitliTedarikci.body, /kapalı/);
  });

  it('Acil yeni dosyada vekalet şeridi durur', () => {
    assert.match(acilForm, /OpsFirstRunNotice/);
    assert.match(acilForm, /OPS_NOTICE\.acilDosyaSorumlusuVekalet/);
    assert.match(acilForm, /dosya-sorumlusu-ilk-kullanim-seridi/);
  });

  it('personel kılavuzu Acil tedarikçi ve dosya sorumlusu maddelerini taşır', () => {
    assert.match(guide, /id="acil-yardim"/);
    assert.match(guide, /Önerilen Tedarikçiler/);
    assert.match(guide, /kayıtlı tedarikçileri gösterir/);
    assert.match(guide, /2\. kez çalışılırsa yöneticiye e-posta/);
    assert.match(guide, /Acil Yardım vekaleti olan finans personeli/);
    assert.doesNotMatch(guide, /Google Places/);
  });
});
