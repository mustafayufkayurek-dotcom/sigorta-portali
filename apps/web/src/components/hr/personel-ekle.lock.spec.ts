/**
 * Personel Ekle: görev listesi, sicil, İptal/Kaydet, rakam orta.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hr/personel-ekle.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('personel ekle LOCK', () => {
  it('görev listesi ve sicil durur; İptal ve Kaydet diğer kutularla aynıdır', () => {
    const panel = readFileSync(join(here, 'PersonelEklePanel.tsx'), 'utf8');
    const ctrl = readFileSync(
      join(here, '../../../../backend/src/modules/hr/hr.controller.ts'),
      'utf8',
    );
    assert.match(ctrl, /employees\/roles/);
    assert.match(ctrl, /employees\/next-personnel-no/);
    assert.match(panel, /hr\/employees\/roles/);
    assert.match(panel, /hr\/employees\/next-personnel-no/);
    assert.match(panel, />\s*İptal\s*</);
    assert.match(panel, /Kaydet/);
    assert.doesNotMatch(panel, /Kaydet Ve Kapat/);
    assert.match(panel, /Sicil numarası otomatik üretilir/);
    assert.match(panel, /readOnly/);
  });

  it('personel listesinde rakam sütun altında ortada durur', () => {
    const list = readFileSync(join(here, 'AdminAttendanceSupervisionPanel.tsx'), 'utf8');
    assert.match(list, /colId="hakedilen" align="center"/);
    assert.match(list, /colId="kullanilan" align="center"/);
    assert.match(list, /colId="bekleyenIzin" align="center"/);
    assert.match(list, /colId="izinKalan" align="center"/);
    assert.match(list, /colId="sicil" align="center"/);
  });

  it('mail kopyala Kopyalandı sayfasına gider', () => {
    const page = readFileSync(join(here, '../../app/giris/kopyala/GirisKoduKopyalaClient.tsx'), 'utf8');
    assert.match(page, /Kopyalandı/);
    assert.match(page, /clipboard\.writeText/);
    assert.match(page, /LoginBrandLogo alt=/);
  });
});
