/**
 * Kapalı Hasar dosyasında ek onarım. İlk kapanış durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-ek-onarim.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXTRA_REPAIR_KIND,
  EXTRA_REPAIR_STATUS_LABEL,
  EXTRA_REPAIR_TITLE,
  canOpenHasarExtraRepair,
  extraRepairReasonOk,
  hasOpenExtraRepair,
} from './hasar-ek-onarim.ts';
import { deriveOperationStage, isHasarWorkloadOpenStage } from './operation-status.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar ek onarım LOCK', () => {
  it('kapalı dosyada ek iş açılır; açık veya iptalde açılmaz', () => {
    assert.equal(
      canOpenHasarExtraRepair({ fileClosed: true, fileCancelled: false, extraRepairOpen: false }),
      true,
    );
    assert.equal(
      canOpenHasarExtraRepair({ fileClosed: false, fileCancelled: false, extraRepairOpen: false }),
      false,
    );
    assert.equal(
      canOpenHasarExtraRepair({ fileClosed: true, fileCancelled: true, extraRepairOpen: false }),
      false,
    );
    assert.equal(
      canOpenHasarExtraRepair({ fileClosed: true, fileCancelled: false, extraRepairOpen: true }),
      false,
    );
  });

  it('gerekçe boş veya kısa olmaz', () => {
    assert.equal(extraRepairReasonOk('   '), false);
    assert.equal(extraRepairReasonOk('ek iş'), false);
    assert.equal(extraRepairReasonOk('Sigortalı ek boya istedi'), true);
  });

  it('açık ek onarım kapanış kodunun üstünde Kapalı · Ek Onarım yazar', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'closed',
      reportStatus: 'approved',
      extraRepairOpen: true,
    });
    assert.equal(stage.id, 'ek_onarim');
    assert.equal(stage.label, EXTRA_REPAIR_STATUS_LABEL);
    assert.equal(isHasarWorkloadOpenStage(stage.id), true);
  });

  it('ek onarım yokken kapalı dosya Dosya Kapatıldı kalır', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'closed',
      reportStatus: 'approved',
      extraRepairOpen: false,
    });
    assert.equal(stage.id, 'dosya_kapandi');
    assert.equal(stage.label, 'Dosya Kapatıldı');
  });

  it('ek onarım açıkken ekstra rapor reddi dosyayı Reddedildi yapmaz', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'closed',
      reportStatus: 'externally_rejected',
      extraRepairOpen: true,
    });
    assert.equal(stage.label, EXTRA_REPAIR_STATUS_LABEL);
  });

  it('açık ek kalem kind + durum ile bulunur', () => {
    assert.equal(
      hasOpenExtraRepair([{ kind: EXTRA_REPAIR_KIND, status: 'draft' }]),
      true,
    );
    assert.equal(
      hasOpenExtraRepair([{ kind: 'extra_work', status: 'draft' }]),
      false,
    );
    assert.equal(
      hasOpenExtraRepair([{ kind: EXTRA_REPAIR_KIND, status: 'completed' }]),
      false,
    );
  });

  it('kapı ve yüz durur; yeni dosya açılmaz', () => {
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/finance/extra-work-item.service.ts'),
      'utf8',
    );
    const panel = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/HasarEkOnarimPanel.tsx'),
      'utf8',
    );
    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/page.tsx'),
      'utf8',
    );
    assert.match(service, /openExtraRepair/);
    assert.match(service, /closedAt/);
    assert.doesNotMatch(service, /closedAt:\s*null/);
    assert.match(service, /EXTRA_REPAIR_KIND/);
    assert.match(service, /Saha tespit ek onarım açamaz/);
    assert.match(panel, /HasarEkOnarimPanel/);
    assert.match(panel, /Ek Onarım/);
    assert.match(panel, /Yeni dosya açılmaz/);
    assert.match(page, /HasarEkOnarimPanel/);
    assert.match(panel, /hasar-ek-onarim-seridi/);
    assert.equal(EXTRA_REPAIR_TITLE, 'Ek Onarım');
  });
});
