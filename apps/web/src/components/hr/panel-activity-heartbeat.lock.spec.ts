/**
 * Panel nabzı puantaj mesaisine düşer.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hr/panel-activity-heartbeat.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('panel activity heartbeat LOCK', () => {
  it('panel kabuğu nabız gönderir', () => {
    const layout = readFileSync(join(here, '../../app/panel/layout.tsx'), 'utf8');
    assert.match(layout, /PanelActivityHeartbeat/);
    assert.match(layout, /hr_attendance_period/);
    assert.match(layout, /\/panel\/personel-ozluk\?tab=attendance/);
    const beat = readFileSync(join(here, 'PanelActivityHeartbeat.tsx'), 'utf8');
    assert.match(beat, /hr\/activity\/beat/);
  });
});
