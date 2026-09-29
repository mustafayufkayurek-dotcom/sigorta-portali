/**
 * Genel kutu kişi e-postasından ayrıdır.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/customer-general-mailbox.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  extraMailboxesFromList,
  generalMailboxFromContactInfos,
  personMailboxFromList,
  splitCustomerMailboxes,
  upsertGeneralMailboxContactInfos,
} from './customer-general-mailbox.ts';

describe('müşteri genel kutu LOCK', () => {
  it('noktalı virgülle yapışan ikinci adres genel kutuya düşer', () => {
    const raw = 'melis.uzun@remed.com.tr;konut@remed.com.tr';
    assert.deepEqual(splitCustomerMailboxes(raw), [
      'melis.uzun@remed.com.tr',
      'konut@remed.com.tr',
    ]);
    assert.equal(personMailboxFromList(raw), 'melis.uzun@remed.com.tr');
    assert.deepEqual(extraMailboxesFromList(raw), ['konut@remed.com.tr']);
  });

  it('kanal satırında genel e-posta durur', () => {
    const infos = upsertGeneralMailboxContactInfos(
      [{ type: 'phone', value: '', label: 'general' }],
      'konut@remed.com.tr',
    );
    assert.equal(generalMailboxFromContactInfos(infos), 'konut@remed.com.tr');
    const page = readFileSync(
      new URL('../../../apps/web/src/app/panel/musteriler/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(page, /Genel E-posta/);
    assert.match(page, /personMailboxFromList/);
    assert.match(page, /upsertGeneralMailboxContactInfos/);
    const invite = readFileSync(
      new URL('../../../apps/web/src/app/panel/kullanicilar/_lib/user-invite-config.ts', import.meta.url),
      'utf8',
    );
    assert.match(invite, /personMailboxFromList/);
  });
});
