/**
 * Metraj Koşumu paneli — ürün kararıyla Raporlar sekmesinden gizlendi.
 * Çalıştır: npx tsx --test src/utils/smart-takeoff-ui-off.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const page = readFileSync(
  join(__dirname, '../app/panel/hasar-dosyalari/[id]/page.tsx'),
  'utf8',
);

describe('smart-takeoff UI OFF LOCK', () => {
  it('hasar dosyası Raporlar sekmesinde SmartTakeoffPanel mount edilmez', () => {
    assert.match(page, /SMART_TAKEOFF_UI_OFF/);
    assert.doesNotMatch(page, /<SmartTakeoffPanel/);
    assert.doesNotMatch(page, /from '@\/components\/smart-takeoff\/SmartTakeoffPanel'/);
  });
});
