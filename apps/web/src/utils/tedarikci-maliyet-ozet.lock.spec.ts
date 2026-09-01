import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { tedarikciMaliyetOzetiSatirlari } from './tedarikci-maliyet-ozet.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tedarikçi maliyet özeti LOCK', () => {
  it('gerçek satır durur, boşsa örnek basılmaz', () => {
    const real = tedarikciMaliyetOzetiSatirlari([{ serviceType: 'Sıva-Boya', count: 3 }]);
    assert.equal(real.ornek, false);
    assert.equal(real.rows[0]?.serviceType, 'Sıva-Boya');
    const empty = tedarikciMaliyetOzetiSatirlari([]);
    assert.equal(empty.ornek, false);
    assert.equal(empty.rows.length, 0);
  });

  it('genel bakışta alt hizmet kapsamı yok, tür balon, dosyaya dönüş ve ortalı karar kartı durur', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/[id]/page.tsx'), 'utf8');
    assert.match(page, /tedarikciMaliyetOzetiSatirlari/);
    assert.match(page, /Henüz maliyet kaydı yok/);
    assert.doesNotMatch(page, /Örnek görünüm/);
    assert.doesNotMatch(page, /ORNEK_TEDARIKCI_MALIYET_OZETI/);
    assert.match(page, /Dosyaya Dön/);
    assert.match(page, /fromFile/);
    assert.match(page, /karar-ozeti-kart/);
    assert.match(page, /flex flex-col items-center/);
    assert.match(page, /w-full text-center text-sm font-semibold tabular-nums/);
    assert.match(page, /Badge key=\{item\} variant="indigo"/);
    assert.doesNotMatch(page, /<SectionCard title="Hizmet Kapsamı">/);
  });
});
