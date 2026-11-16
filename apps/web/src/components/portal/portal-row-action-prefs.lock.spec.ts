import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_USER_ROW_ACTIONS,
  DOSYALAR_ROW_ACTIONS,
  FATURALAR_ROW_ACTIONS,
  FINANS_FATURA_ROW_ACTIONS,
  FINANS_FATURA_TALEP_ROW_ACTIONS,
  FINANS_MASRAF_ROW_ACTIONS,
  FINANS_PARTY_CARI_ROW_ACTIONS,
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
  assert.ok(defaultPinnedActionIds(FINANS_FATURA_TALEP_ROW_ACTIONS).includes('invoice'));
  assert.ok(defaultPinnedActionIds(FINANS_FATURA_TALEP_ROW_ACTIONS).includes('view'));
  assert.ok(!defaultPinnedActionIds(FINANS_FATURA_TALEP_ROW_ACTIONS).includes('approve'));
  assert.ok(!defaultPinnedActionIds(FINANS_FATURA_TALEP_ROW_ACTIONS).includes('cancel'));
  assert.ok(defaultPinnedActionIds(FINANS_MASRAF_ROW_ACTIONS).includes('edit'));
  assert.ok(!defaultPinnedActionIds(FINANS_MASRAF_ROW_ACTIONS).includes('delete'));
  assert.ok(defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).includes('ekstre'));
  assert.ok(defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).includes('edit'));
  assert.ok(defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).includes('mail'));
  assert.ok(defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).includes('whatsapp'));
  assert.ok(!defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).includes('ara'));
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.find((a) => a.id === 'mail')?.suggested);
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.find((a) => a.id === 'whatsapp')?.suggested);
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.find((a) => a.id === 'ara')?.suggested);
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.some((a) => a.id === 'ara'));
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.some((a) => a.id === 'kopyala'));
  assert.ok(defaultPinnedActionIds(FINANS_PARTY_CARI_ROW_ACTIONS).length <= 4);
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.some((a) => a.id === 'pasif'));
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.some((a) => a.id === 'yazdir'));
  assert.ok(FINANS_PARTY_CARI_ROW_ACTIONS.some((a) => a.id === 'excel'));
  assert.ok(defaultPinnedActionIds(ADMIN_USER_ROW_ACTIONS).includes('resetPwd'));
  assert.ok(MUSTERI_ROW_ACTIONS.find((a) => a.id === 'archive')?.suggested);
  assert.ok(TEDARIKCI_ROW_ACTIONS.find((a) => a.id === 'delete')?.suggested);
});
