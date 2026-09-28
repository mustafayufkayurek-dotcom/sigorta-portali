/**
 * Akış izi: önceki sayfa adına tıklanınca dönüş. Yalnız ok yetmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/panel-flow-trail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('panel akış izi LOCK', () => {
  it('önceki sayfa adı tıklanınca o sayfaya gider', () => {
    const trail = readFileSync(join(here, 'PanelFlowTrail.tsx'), 'utf8');
    assert.match(trail, /item\.href/);
    assert.match(trail, /<Link href=\{item\.href\}/);
    assert.doesNotMatch(trail, /Google/);

    const crm = readFileSync(join(here, '../../app/panel/crm/page.tsx'), 'utf8');
    assert.match(crm, /PanelFlowTrail/);
    assert.match(crm, /Hasar Dosyaları/);
    assert.match(crm, /\/panel\/hasar-dosyalari/);
    assert.doesNotMatch(crm, /Operasyon İlişkileri/);

    const pazartesi = readFileSync(join(here, '../../app/panel/pazartesi-toplantisi/page.tsx'), 'utf8');
    assert.match(pazartesi, /PanelFlowTrail/);
    assert.match(pazartesi, /href: '\/panel'/);

    const anket = readFileSync(join(here, '../../app/panel/anketler/sonuclar/page.tsx'), 'utf8');
    assert.match(anket, /\/panel\/anketler/);
    assert.match(anket, /<Link/);

    const performans = readFileSync(join(here, '../hr/PerformanceManagementPanel.tsx'), 'utf8');
    assert.match(performans, /\/panel\/personel-ozluk/);
  });
});
