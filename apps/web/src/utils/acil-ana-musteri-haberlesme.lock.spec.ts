/**
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/acil-ana-musteri-haberlesme.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  anaMusteriAllowsEmail,
  anaMusteriAllowsWhatsApp,
  parseAnaMusteriHaberlesme,
} from './acil-ana-musteri-haberlesme.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil ana müşteri haberleşme LOCK', () => {
  it('varsayılan ikisi; kanal süzülür', () => {
    assert.equal(parseAnaMusteriHaberlesme(null), 'both');
    assert.equal(anaMusteriAllowsWhatsApp('email'), false);
    assert.equal(anaMusteriAllowsEmail('whatsapp'), false);
    assert.equal(anaMusteriAllowsWhatsApp('both') && anaMusteriAllowsEmail('both'), true);
  });

  it('onay ve kapanış adımında tercih durur; sigortalı WhatsApp', () => {
    const steps = readFileSync(
      join(here, '../components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    const page = readFileSync(
      join(here, '../app/panel/acil-yardim/[id]/page.tsx'),
      'utf8',
    );
    const workflow = readFileSync(
      join(here, '../app/panel/acil-yardim/[id]/acil-workflow.ts'),
      'utf8',
    );
    assert.match(steps, /acil-ana-musteri-kanal/);
    assert.match(steps, /Sigortalı — WhatsApp/);
    assert.match(page, /writeAnaMusteriHaberlesme/);
    assert.match(workflow, /customerNotifyChannel/);
    assert.match(workflow, /Kapanış maili \(dosya kapanınca otomatik\)/);
  });
});
