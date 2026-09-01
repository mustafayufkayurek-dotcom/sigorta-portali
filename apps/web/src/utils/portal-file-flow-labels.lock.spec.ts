/**
 * Portal dosya durumu, ofis son işlemiyle aynı kalır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/portal-file-flow-labels.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portalStatusLabel } from './portal-file-flow-labels.ts';

describe('portal dosya durumu LOCK', () => {
  it('kapalı kod + Reddedildi adı → Reddedildi', () => {
    assert.equal(portalStatusLabel('closed', 'Reddedildi'), 'Reddedildi');
  });

  it('revizyon kodu Revizyon Talep Edildi yazar', () => {
    assert.equal(
      portalStatusLabel('budget_revision_requested', 'Rapor Yazım Aşamasında'),
      'Revizyon Talep Edildi',
    );
  });

  it('gerçek kapanış Dosya Kapatıldı kalır', () => {
    assert.equal(portalStatusLabel('closed', 'Dosya Kapatıldı'), 'Dosya Kapatıldı');
  });
});
