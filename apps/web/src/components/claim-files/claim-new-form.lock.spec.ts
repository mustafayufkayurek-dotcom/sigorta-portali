/**
 * Yeni Dosya formu — dosya sorumlusu, özel müşteri, hizmet, irtibat, i yardımı.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/claim-files/claim-new-form.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const form = readFileSync(join(here, 'ClaimNewForm.tsx'), 'utf8');
const list = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
const hint = readFileSync(join(here, '../ui/HintIcon.tsx'), 'utf8');
const fieldHelp = readFileSync(join(here, '../ui/FieldHelpTip.tsx'), 'utf8');

describe('yeni dosya form lock', () => {
  it('başlık Yeni Dosya; dosya sorumlusu, hizmet türü, özel müşteri ve irtibat durur', () => {
    assert.match(list, /title="Yeni Dosya"/);
    assert.match(form, /Dosya Sorumlusu/);
    assert.match(form, /assignedOfficeUserId/);
    assert.match(form, /Özel Müşteri/);
    assert.match(form, /Hizmet Türü/);
    assert.match(form, /İrtibat Ad Soyad/);
    assert.match(form, /İrtibat Telefon/);
    assert.match(form, /rapora yazılmaz/);
    assert.match(form, /FieldHelpTip/);
    assert.match(form, /dosya-no-yardim/);
    assert.match(form, /irtibat-telefon-yardim/);
    assert.doesNotMatch(form, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
    assert.doesNotMatch(form, /Yalnız tespit içindir; rapora yazılmaz\.<\/p>/);
    const acil = readFileSync(join(here, '../emergency/EmergencyCaseNewForm.tsx'), 'utf8');
    assert.match(acil, /acil-dosya-no-yardim/);
    assert.match(acil, /acil-tespit-bulgulari-yardim/);
    assert.doesNotMatch(acil, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
    assert.match(form, /data-field="assignedOfficeUserId"/);
    assert.match(form, /data-field="fileNo"/);
    assert.match(form, /filterInsuranceCatalogForHasarFileForm/);
    assert.doesNotMatch(form, /isOfficeStaffRole\(roleCode\) && scopedIds/);
    assert.doesNotMatch(form, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
  });

  it('sayfa başlığı i yasağı durur; alan yardımı ayrıdır', () => {
    assert.match(hint, /return null/);
    assert.match(fieldHelp, /export function FieldHelpTip/);
    assert.match(fieldHelp, /export function FieldLabel/);
    assert.match(fieldHelp, /onClick/);
  });
});
