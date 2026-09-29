/**
 * Kilit: Sigorta Dosyalar / Faturalar Geçmiş tuşu Operasyon Geçmişi açar; Notlar çekmecesi değildir.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/sigorta-portal/sigorta-dosyalar-gecmis.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

describe('sigorta dosya geçmiş LOCK', () => {
  it('Dosyalar Geçmiş Operasyon Geçmişi overlay açar', () => {
    const src = readFileSync(join(here, 'dosyalar/page.tsx'), 'utf8');
    assert.match(src, /ExpertFileHistoryOverlay/);
    assert.match(src, /setHistoryClaimId\(f\.id\)/);
    assert.doesNotMatch(src, /onHistory=\{\(\) => openDrawer\(f\.id, 'notlar'\)\}/);
  });

  it('Faturalar Geçmiş Operasyon Geçmişi overlay açar', () => {
    const src = readFileSync(join(here, 'faturalar/page.tsx'), 'utf8');
    assert.match(src, /ExpertFileHistoryOverlay/);
    assert.match(src, /setHistoryClaimId\(inv\.claimFile\.id\)/);
    assert.doesNotMatch(src, /setDrawerTab\('notlar'\)/);
  });

  it('Onaylar Geçmiş aynı overlay kabuğundadır', () => {
    const src = readFileSync(join(here, 'onaylar/page.tsx'), 'utf8');
    assert.match(src, /ExpertFileHistoryOverlay/);
    assert.match(src, /setHistoryClaimId\(id\)/);
  });
});
