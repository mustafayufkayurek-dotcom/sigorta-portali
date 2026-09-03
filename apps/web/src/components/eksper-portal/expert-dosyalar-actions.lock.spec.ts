/**
 * Kilit: Eksper Dosyalarım / Onay Bekliyor / Rapor Bekleyenler —
 * Dosya Detayı ve Not Yaz satır ikonu; oluşturma tarihi ortalı.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/eksper-portal/expert-dosyalar-actions.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ACTIONS = readFileSync(new URL('./ExpertDosyalarActions.tsx', import.meta.url), 'utf8');
const PAGE = readFileSync(
  new URL('../../app/panel/eksper-portal/dosyalar/page.tsx', import.meta.url),
  'utf8',
);

describe('eksper dosyalar işlem ikonları LOCK', () => {
  it('Dosya Detayı ve Not Yaz satırda ikon; menüde tekrarlanmaz', () => {
    assert.match(ACTIONS, /label="Dosya Detayı"/);
    assert.match(ACTIONS, /label="Not Yaz"/);
    assert.match(ACTIONS, /testId="eksper-dosyalar-detail"/);
    assert.match(ACTIONS, /testId="eksper-dosyalar-note"/);
    assert.match(ACTIONS, /StickyNote/);
    assert.match(ACTIONS, /FileText/);
    assert.equal(ACTIONS.includes("menuItem('Dosya Detayı'"), false);
    assert.equal(ACTIONS.includes("menuItem('Not Yaz'"), false);
    assert.match(ACTIONS, /menuItem\('Evraklar'/);
  });

  it('Oluşturulma Tarihi bu listelerde ortalanır', () => {
    assert.match(PAGE, /CENTERED_TABLE_COLS = new Set\(\[['"]subject['"], ['"]status['"], ['"]delayDays['"], ['"]createdAt['"], ['"]actions['"]\]\)/);
    assert.match(PAGE, /colId="createdAt"[\s\S]*align="center"[\s\S]*table-td-center/);
  });
});
