/**
 * Gelen kutu Kullanıcı Ata — ofis listesi; kendine alma durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/inbox-assignable-users.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  INBOX_ASSIGN_SELF_LABEL,
  filterAssignableUsersBySearch,
  mergeSessionUserIntoAssignable,
} from './inbox-assignable-users.ts';

describe('gelen kutu kullanıcı ata LOCK', () => {
  const self = {
    id: 'asli',
    firstName: 'Aslı',
    lastName: 'Güngör',
    email: 'asli@meridyen-tr.com',
  };

  it('oturumdaki kişiyi listeye ekler; çift yazmaz', () => {
    const others = [{ id: 'b', firstName: 'Berk', lastName: 'Kaya', email: 'berk@meridyen-tr.com' }];
    const merged = mergeSessionUserIntoAssignable(others, self);
    assert.equal(merged[0]?.id, 'asli');
    assert.equal(mergeSessionUserIntoAssignable(merged, self).length, 2);
  });

  it('ad ve giriş e-postası ile arar; sigorta kutusunu eşlemez', () => {
    const list = mergeSessionUserIntoAssignable([], self);
    assert.equal(filterAssignableUsersBySearch(list, 'güngör').length, 1);
    assert.equal(filterAssignableUsersBySearch(list, 'asli@meridyen-tr.com').length, 1);
    assert.equal(filterAssignableUsersBySearch(list, 'asli.gungor@safranbh.com').length, 0);
  });

  it('Kullanıcı Ata kutusu Kullanıcılar listesini çekmez', () => {
    const modal = readFileSync(
      new URL('../../../apps/web/src/components/operation-inbox/InboxAssignUserModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /\/operation-inbox\/assignable-users/);
    assert.match(modal, /INBOX_ASSIGN_SELF_LABEL/);
    assert.match(modal, /mergeSessionUserIntoAssignable/);
    assert.match(modal, /filterAssignableUsersBySearch/);
    assert.doesNotMatch(modal, /\$\{API\}\/users/);
    assert.doesNotMatch(modal, /params:\s*\{\s*limit:\s*100/);
    assert.equal(INBOX_ASSIGN_SELF_LABEL, 'Kendime Al');
  });

  it('atama listesi gelen kutu yetkisiyle gelir; oturumdaki kişi eklenir', () => {
    const controller = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/operation-inbox.controller.ts', import.meta.url),
      'utf8',
    );
    const assignable = controller.slice(
      controller.indexOf("assignable-users"),
      controller.indexOf("messages/:id/routing-suggestion"),
    );
    assert.match(assignable, /operation_inbox\.view/);
    assert.match(assignable, /req\.user\?\.id/);
    assert.doesNotMatch(assignable, /user\.view/);

    const routing = readFileSync(
      new URL('../../../apps/backend/src/modules/operation-inbox/inbound-routing.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(routing, /listAssignableOfficeUsers\(messageId\?: string, viewerUserId\?: string\)/);
    assert.match(routing, /ensureViewerInAssignable/);
    assert.match(routing, /email: true/);
  });

  it('gelen kutuda Kendime Al bir kez anlatılır', () => {
    const page = readFileSync(
      new URL('../../../apps/web/src/app/panel/operasyon/gelen-kutusu/page.tsx', import.meta.url),
      'utf8',
    );
    const notice = readFileSync(
      new URL('../../../apps/web/src/utils/ops-first-run-notice.ts', import.meta.url),
      'utf8',
    );
    assert.match(page, /OpsFirstRunNotice/);
    assert.match(page, /gelen-kutu-kendime-al-seridi/);
    assert.match(notice, /gelen-kutu-kendime-al-v632/);
    assert.match(notice, /Kendime Al/);
    assert.doesNotMatch(notice, /Google/);
  });
});
