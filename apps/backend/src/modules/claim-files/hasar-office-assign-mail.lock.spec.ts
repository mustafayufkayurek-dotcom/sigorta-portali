/**
 * Dosya sorumlusuna yönetici atama yazısı gider.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/hasar-office-assign-mail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar dosya sorumlusu atama maili LOCK', () => {
  it('yazı: atayan kişinin Görev yazısı başlıkta durur', () => {
    const note = readFileSync(
      join(here, '../operation-inbox/inbox-ihbar-email.ts'),
      'utf8',
    );
    assert.match(note, /hasarAssignedByHeading/);
    assert.match(note, /HASAR_ASSIGNED_BY_HEADING_SUFFIX/);
    assert.match(note, /Tarafından Atanmıştır/);
    assert.match(note, /titleSuffix: hasarAssignedByHeading\(summary\.assignedByJobTitle\)/);
    assert.doesNotMatch(note, /Sistem Yöneticisi/);
    assert.doesNotMatch(note, /HASAR_MANAGER_ASSIGNED_HEADING/);
    const assigned = readFileSync(
      join(here, '../notifications/email/claim-event-email.service.ts'),
      'utf8',
    );
    const start = assigned.indexOf('async onClaimAssigned');
    const end = assigned.indexOf('async onClaim', start + 1);
    assert.ok(start >= 0 && end > start);
    const fn = assigned.slice(start, end);
    assert.match(fn, /buildInboxIhbarEmailTemplate/);
    assert.match(fn, /assignedByJobTitle: params\.assignedByJobTitle/);
    const tpl = readFileSync(
      join(here, '../notifications/email/email.template.ts'),
      'utf8',
    );
    assert.match(tpl, /titleSuffixHtml/);
    assert.match(tpl, /data\.titleSuffix/);
  });

  it('oluşturma, PATCH ve assign değişince atama gider; Yeni İhbar ofise gitmez', () => {
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const helperStart = src.indexOf('private async notifyHasarOfficeOwnerAssigned');
    const helperEnd = src.indexOf('private async fallbackHasarOfficeUserId');
    assert.ok(helperStart >= 0 && helperEnd > helperStart);
    const helper = src.slice(helperStart, helperEnd);
    assert.match(helper, /actorId === u\.id/);
    assert.match(helper, /onClaimAssigned/);
    assert.match(helper, /select: \{ jobTitle: true \}/);
    assert.match(helper, /assignedByJobTitle/);
    const createStart = src.indexOf('async create(');
    const createEnd = src.indexOf('async update(');
    const createFn = src.slice(createStart, createEnd);
    assert.match(createFn, /this\.notifyHasarOfficeOwnerAssigned/);
    assert.doesNotMatch(
      createFn,
      /recipients\.push\(\{ id: created\.assignedOfficeUserId/,
    );
    const updateStart = src.indexOf('async update(');
    const updateEnd = src.indexOf('async remove(');
    const updateFn = src.slice(updateStart, updateEnd);
    assert.match(updateFn, /this\.notifyHasarOfficeOwnerAssigned/);
    const assignStart = src.indexOf('async assign(');
    const assignEnd = src.indexOf('async changeStatus(');
    const assignFn = src.slice(assignStart, assignEnd);
    assert.match(assignFn, /currentResponsibleUserId = dto\.assignedOfficeUserId/);
    assert.match(assignFn, /this\.notifyHasarOfficeOwnerAssigned/);
  });

  it('gelen kutu ihbarında görev yazısı yoksa atama başlığı yok', () => {
    const inbox = readFileSync(
      join(here, '../operation-inbox/operation-inbox-notification.service.ts'),
      'utf8',
    );
    assert.doesNotMatch(inbox, /assignedByManager/);
    assert.doesNotMatch(inbox, /assignedByJobTitle/);
  });
});
