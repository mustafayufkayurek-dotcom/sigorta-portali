/**
 * Tespitçi Rut Planı — Atanan Dosyalar’da çıkış + sıra önerisi.
 * Canlı takip yok. Çalıştır:
 * node --experimental-strip-types --test apps/web/src/components/field-survey/field-rut-plani.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('tespitçi rut planı LOCK', () => {
  it('panel Atanan Dosyalar’da durur; canlı takip / Google yazılmaz', () => {
    const panel = readFileSync(join(here, 'FieldRutPlaniPanel.tsx'), 'utf8');
    const page = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    const ctrl = readFileSync(
      join(here, '../../../../backend/src/modules/hasar-tespit-bedel/hasar-tespit-bedel.controller.ts'),
      'utf8',
    );
    const svc = readFileSync(
      join(here, '../../../../backend/src/modules/hasar-tespit-bedel/hasar-tespit-bedel.service.ts'),
      'utf8',
    );
    const notice = readFileSync(join(here, '../../utils/ops-first-run-notice.ts'), 'utf8');

    assert.match(page, /FieldRutPlaniPanel/);
    assert.match(page, /isFieldStaff/);
    assert.match(panel, /data-testid="field-rut-plani"/);
    assert.match(panel, /Rut Planı Öner/);
    assert.match(panel, /hasar-tespit-bedel\/rut-plani/);
    assert.match(panel, /tespitci-taslak-tercih/);
    assert.match(panel, /field-bedel-taslak/);
    assert.match(panel, /hasar-tespit-bedel\/taslak/);
    assert.match(panel, /OPS_NOTICE\.fieldRutPlani/);
    assert.doesNotMatch(panel, /Google|Places|canlı takip|watchPosition/i);
    assert.doesNotMatch(panel, /gelire-dusur/);
    assert.match(panel, /Gelire Düşür yönetici|Gelire Düşür finanstadır/);

    assert.match(ctrl, /hasar-tespit-bedel\/rut-plani/);
    assert.match(ctrl, /rutPlani/);
    assert.match(svc, /async rutPlani/);
    assert.match(svc, /siralaRutEnYakin/);
    assert.match(svc, /assignedFieldUserId/);
    assert.match(svc, /gecisUcretleriOner/);
    assert.match(svc, /kaydetSahaTaslak/);

    assert.match(notice, /fieldRutPlani/);
    assert.match(notice, /field-rut-plani-v723/);
    assert.match(notice, /Telefonunuz izlenmez/);
  });
});
