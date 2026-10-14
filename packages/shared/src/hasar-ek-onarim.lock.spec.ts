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
  EXTRA_REPAIR_COST_HEADING,
  EXTRA_REPAIR_COST_TOTAL_LABEL,
  extraRepairReasonOk,
  hasOpenExtraRepair,
  partitionExtraRepairCostItems,
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

  it('ilk rapor kalemleri durur; ek kalem Ek Onarım Maliyeti altına düşer', () => {
    assert.equal(EXTRA_REPAIR_COST_HEADING, 'Ek Onarım Maliyeti');
    assert.equal(EXTRA_REPAIR_COST_TOTAL_LABEL, 'Ek Onarım Toplamı');
    const original = [
      { jobDescription: 'İç Cephe Boya', workGroup: { name: 'Boya İşleri' } },
      { jobDescription: 'Laminant Parke Döşeme', workGroup: { name: 'Parke' } },
      { jobDescription: 'Mobilya Onarımı', workGroup: { name: 'Mobilya İşleri' } },
    ];
    const current = [
      ...original,
      { jobDescription: 'Lake Boyalı Çift Yüz Pervaz Yenileme', workGroup: { name: 'Mobilya İşleri' } },
      { jobDescription: '10 Cm Lake Süpürgelik Yenileme', workGroup: { name: 'Mobilya İşleri' } },
    ];
    const split = partitionExtraRepairCostItems({ currentItems: current, originalItems: original });
    assert.equal(split.originalItems.length, 3);
    assert.equal(split.extraItems.length, 2);
    assert.equal(split.extraItems[0]?.jobDescription, 'Lake Boyalı Çift Yüz Pervaz Yenileme');
    const pdf = readFileSync(
      join(here, '../../../apps/backend/src/modules/repair-reports/pdf/report-pdf.service.ts'),
      'utf8',
    );
    const rapor = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    assert.match(pdf, /EXTRA_REPAIR_COST_HEADING/);
    assert.match(pdf, /EXTRA_REPAIR_COST_TOTAL_LABEL/);
    assert.match(pdf, /partitionExtraRepairCostItems/);
    assert.match(pdf, /\.extra-cost-heading-row td \{[\s\S]*?padding: 8px 10px;/);
    assert.match(rapor, /EXTRA_REPAIR_COST_HEADING/);
    assert.match(rapor, /EXTRA_REPAIR_COST_TOTAL_LABEL/);
    assert.match(rapor, /extraRepairCost/);
  });
});
