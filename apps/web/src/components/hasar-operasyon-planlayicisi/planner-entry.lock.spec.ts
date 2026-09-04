/**
 * Kapalı hasar dosyasında planlayıcı 1. adıma açılmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/planner-entry.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar planlayıcı giriş LOCK', () => {
  it('kapalı dosyada çekmece kapalı, kapanış adımı', () => {
    const rules = readFileSync(join(here, 'planner-live-rules.ts'), 'utf8');
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    assert.match(rules, /export function resolvePlannerEntry/);
    assert.match(rules, /if \(fileClosed\) \{\s*return \{ step: 'file_close', openDrawer: false \}/);
    assert.match(rules, /statuses\[s\.id\] === 'waiting'/);
    assert.match(panel, /resolvePlannerEntry/);
    assert.match(panel, /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/);
    assert.match(panel, /if \(claim\.fileClosed\) setActiveStep\('file_close'\)/);
  });

  it('açık dosyada waiting adımında çekmece açılır', () => {
    const rules = readFileSync(join(here, 'planner-live-rules.ts'), 'utf8');
    assert.match(rules, /return \{ step: waiting\.id, openDrawer: true \}/);
  });
});
