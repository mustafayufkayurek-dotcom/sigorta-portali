/**
 * Planlayıcı Hasar Tespit / Onarım / Kapanış grupları.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/planner-groups.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLANNER_GROUPS, PLANNER_STEPS, PLANNER_VISIBLE_STEPS } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar planner groups lock', () => {
  it('dijital onay onarımın başında, muvafakat ayrı sayfa değil', () => {
    assert.equal(PLANNER_GROUPS.find((g) => g.id === 'onay')?.label, 'Hasar Tespit Aşaması');
    const onarim = PLANNER_VISIBLE_STEPS.filter((s) => s.group === 'onarim');
    assert.equal(onarim[0]?.id, 'digital_approval');
    assert.equal(onarim[1]?.id, 'repair_whatsapp');
    assert.equal(onarim[1]?.label, 'Onarım Planlama');
    assert.equal(onarim[2]?.label, 'Onarım Bitiş');
    assert.equal(PLANNER_STEPS.find((s) => s.id === 'muvafakat')?.hidden, true);
    assert.equal(PLANNER_STEPS.find((s) => s.id === 'whatsapp')?.hidden, true);
    assert.equal(PLANNER_VISIBLE_STEPS.find((s) => s.id === 'approved')?.label, 'Dosya Onaylandı');
    assert.ok(PLANNER_VISIBLE_STEPS.some((s) => s.id === 'docs_upload'));
  });

  it('çekmece ve özet grupları basar, sıradaki işlem listesi yok', () => {
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    const steps = readFileSync(join(here, 'steps.tsx'), 'utf8');
    assert.match(panel, /hasar-planner-groups/);
    assert.doesNotMatch(panel, /xl:grid-cols-8/);
    assert.doesNotMatch(panel, /sm:grid-cols-4/);
    assert.doesNotMatch(panel, /İlerleme Özeti/);
    assert.match(steps, /SpeechToText/);
    assert.doesNotMatch(steps, /Görüşme Notu/);
    assert.doesNotMatch(steps, /Tahmini Süre/);
    assert.doesNotMatch(steps, /Onaylayan Taraf Türü/);
  });

  it('Operasyon gövdesinde manuel yükleme formu yok; liste listOnly', () => {
    const collect = readFileSync(join(here, 'OperasyonEvrakToplamaPanel.tsx'), 'utf8');
    const stepsSrc = readFileSync(join(here, 'steps.tsx'), 'utf8');
    assert.match(collect, /Tespit Ve Onarım/);
    assert.match(collect, /listOnly/);
    assert.match(collect, /readOnly/);
    assert.doesNotMatch(collect, /Dosya Seç Ve Yükle/);
    assert.match(stepsSrc, /function StepDocsUpload/);
    assert.match(stepsSrc, /ClaimManualDocumentsPanel claimId=\{claim.claimId\}/);
  });
});
