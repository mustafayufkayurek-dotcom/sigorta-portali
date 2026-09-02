/**
 * Kilit: Dosya kapanış maili — Hasar + Acil; sigorta / asistans / eksper / broker.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/notifications/email/file-closure-email.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(here, 'file-closure-email.template.ts'), 'utf8');
const emergency = readFileSync(
  join(here, '../../emergency/emergency-cases.service.ts'),
  'utf8',
);
const claims = readFileSync(
  join(here, '../../claim-files/claim-files.service.ts'),
  'utf8',
);

describe('dosya kapanış maili LOCK', () => {
  it('acil kapanış yeni görseli kullanır; asistan firması ve hizmet verilme gövdede yok', () => {
    assert.match(emergency, /buildFileClosureEmailHtml/);
    assert.match(emergency, /buildFileClosureEmailPlaintext/);
    assert.doesNotMatch(emergency, /Asistan Firması:/);
    assert.doesNotMatch(emergency, /Onaylı Hizmet Bedeli:/);
    assert.match(emergency, /mailbox:\s*'IHBAR'/);
  });

  it('hasar kapanışında müşteriye eski şablon gitmez; dış partilere HASAR kutusundan gider', () => {
    const closed = claims.slice(claims.indexOf('if (toStatus.isClosedState'));
    const block = closed.slice(0, closed.indexOf('\n  async '));
    assert.match(block, /sendHasarFileClosureMails/);
    assert.doesNotMatch(block, /customer\?\.email[\s\S]{0,200}onClaimClosed/);
    assert.match(claims, /settingsDefinedFileSubjectName/);
    assert.doesNotMatch(claims, /fileSubject[\s\S]{0,120}\|\| claimFile\.lossType/);
    assert.match(emergency, /settingsDefinedFileSubjectName/);
    assert.match(claims, /mailbox:\s*'HASAR'/);
    assert.match(claims, /asistan_firmasi/);
    assert.match(claims, /broker_firmasi/);
    assert.match(claims, /contactEmail/);
  });

  it('süre yalnız asistans; dosya bedeli +KDV; başlık altında safran yok', () => {
    assert.match(tpl, /audience === 'assistance'/);
    assert.match(tpl, /Dosya bedeli/);
    assert.match(tpl, /TL \+KDV/);
    assert.doesNotMatch(tpl, /Onaylı Hizmet Bedeli/);
    assert.doesNotMatch(tpl, /Asistan Firması/);
    assert.doesNotMatch(tpl, /Hizmet Verilme/);
    assert.doesNotMatch(tpl, />Safran Birleşik Hizmetler</);
  });

  it('acil kapanış önizlemesi Sn. Yetkili ve TL +KDV kullanır; onaylı hizmet bedeli yok', () => {
    const workflow = readFileSync(
      join(here, '../../../../../web/src/app/panel/acil-yardim/[id]/acil-workflow.ts'),
      'utf8',
    );
    const start = workflow.indexOf('export function buildClosureEmailPreview');
    const end = workflow.indexOf('\nexport function', start + 1);
    const block = workflow.slice(start, end > start ? end : undefined);
    assert.match(block, /Sn\. Yetkili,/);
    assert.match(block, /TL \+KDV/);
    assert.match(block, /Dosya bedeli:/);
    assert.doesNotMatch(block, /Onaylı Hizmet Bedeli/);
    assert.doesNotMatch(block, /Sayın Yetkili/);
  });
});
