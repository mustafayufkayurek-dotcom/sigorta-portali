import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_USER_ROW_ACTIONS,
  DOSYALAR_ROW_ACTIONS,
  FATURALAR_ROW_ACTIONS,
  FINANS_FATURA_ROW_ACTIONS,
  FINANS_TAHSILAT_ROW_ACTIONS,
  MUSTERI_ROW_ACTIONS,
  ONAYLAR_ROW_ACTIONS,
  OPS_ROW_ACTIONS,
  TEDARIKCI_ROW_ACTIONS,
  defaultPinnedActionIds,
  parsePinnedActionIds,
} from './portal-row-action-prefs.ts';

test('dosya işlemlerinde evrak ve operasyon önerilip kolona düşer', () => {
  const pinned = defaultPinnedActionIds(DOSYALAR_ROW_ACTIONS);
  assert.deepEqual(pinned, ['summary', 'note', 'documents', 'operation']);
  assert.ok(DOSYALAR_ROW_ACTIONS.find((a) => a.id === 'documents')?.suggested);
  assert.ok(DOSYALAR_ROW_ACTIONS.find((a) => a.id === 'operation')?.suggested);
});

test('kayıtlı işlem listesi yalnız katalogdakileri alır', () => {
  const parsed = parsePinnedActionIds(JSON.stringify(['summary', 'hack', 'documents']), DOSYALAR_ROW_ACTIONS);
  assert.deepEqual(parsed, ['summary', 'documents']);
});

test('onay ve fatura önerileri evrak / indirmeyi kolona alır', () => {
  assert.ok(defaultPinnedActionIds(ONAYLAR_ROW_ACTIONS).includes('documents'));
  assert.ok(defaultPinnedActionIds(FATURALAR_ROW_ACTIONS).includes('download'));
  assert.ok(defaultPinnedActionIds(FATURALAR_ROW_ACTIONS).includes('documents'));
});

test('iç listelerde önerilen işlemler kolona düşer', () => {
  assert.ok(defaultPinnedActionIds(OPS_ROW_ACTIONS).includes('note'));
  assert.ok(defaultPinnedActionIds(FINANS_FATURA_ROW_ACTIONS).includes('notify'));
  assert.ok(defaultPinnedActionIds(FINANS_TAHSILAT_ROW_ACTIONS).includes('ekstre'));
  assert.ok(defaultPinnedActionIds(ADMIN_USER_ROW_ACTIONS).includes('resetPwd'));
  assert.ok(MUSTERI_ROW_ACTIONS.find((a) => a.id === 'archive')?.suggested);
  assert.ok(TEDARIKCI_ROW_ACTIONS.find((a) => a.id === 'delete')?.suggested);
});
