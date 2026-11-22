/**
 * Masraf → cari (ödeme kaynağı) kilidi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/expense-party-account.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE,
  hasExpensePartyAccountId,
} from './finans-cari.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

describe('Masraf ödeme kaynağı cari LOCK', () => {
  it('paylaşılan kural: boş cari kabul edilmez', () => {
    assert.equal(hasExpensePartyAccountId(''), false);
    assert.equal(hasExpensePartyAccountId('   '), false);
    assert.equal(hasExpensePartyAccountId(null), false);
    assert.equal(hasExpensePartyAccountId(undefined), false);
    assert.equal(hasExpensePartyAccountId('acc-1'), true);
    assert.match(EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE, /Ödeme kaynağı cari/);
  });

  it('backend yeni masrafta cari ister; cariye yazar; silince hareketi kaldırır', () => {
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    const party = readFileSync(
      join(root, 'apps/backend/src/modules/finance/party-accounts.service.ts'),
      'utf8',
    );
    assert.match(svc, /EXPENSE_PARTY_ACCOUNT_REQUIRED_MESSAGE/);
    assert.match(svc, /hasExpensePartyAccountId/);
    assert.match(svc, /requirePartyAccount/);
    assert.match(svc, /syncExpenseDebit|postExpenseDebit/);
    assert.match(svc, /voidExpenseDebit/);
    assert.match(party, /async syncExpenseDebit/);
    assert.match(party, /async voidExpenseDebit/);
    assert.match(party, /sourceKind: 'masraf'/);
  });

  it('masraf ekranı oluşturma ve düzenlemede cari zorunlu; düzenlemede cariyi yükler', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    const ctrl = readFileSync(
      join(root, 'apps/backend/src/modules/finance/party-accounts.controller.ts'),
      'utf8',
    );
    assert.match(page, /masraf-cari-kaynak/);
    assert.match(page, /Ödeme Kaynağı \(Cari\)/);
    assert.match(page, /Ödeme kaynağı cari seçimi zorunludur/);
    assert.doesNotMatch(page, /!editId && !form\.partyAccountId/);
    assert.match(page, /partyAccountId:\s*e\.partyAccountId/);
    assert.match(page, /masraf-yolu-select/);
    assert.match(page, /CariHesapCreateModal/);
    assert.match(page, /CariHesapOzetModal/);
    assert.match(page, /masraf-yeni-cari/);
    assert.match(page, /masraf-cari-kart/);
    assert.match(page, /masraf-cari-ozet-ac/);
    assert.match(page, /Cari Kartı Aç/);
    assert.doesNotMatch(page, /masraf-cari-tedarikci/);
    assert.doesNotMatch(page, /Kayıt sonrası burada görünür/);
    assert.match(page, /lastSavedOpNo/);
    assert.match(page, /Son kayıt:/);
    const cariModal = readFileSync(
      join(root, 'apps/web/src/components/finance/CariHesapCreateModal.tsx'),
      'utf8',
    );
    const cariOzet = readFileSync(
      join(root, 'apps/web/src/components/finance/CariHesapOzetModal.tsx'),
      'utf8',
    );
    assert.match(cariModal, /masraf-cari-kart-ac/);
    assert.match(cariModal, /Yeni Cari Hesap/);
    assert.match(cariModal, /CariHesapFormFields/);
    assert.match(cariOzet, /Gizle/);
    assert.match(cariOzet, /Tam Ekstre \(Yeni Sekme\)/);
    assert.match(cariOzet, /Son Hareketler/);
    assert.match(cariOzet, /Masraf formu açık kalır/);
    assert.doesNotMatch(cariOzet, /absolute inset-0/);
    assert.doesNotMatch(cariOzet, /Detaya Git/);
    assert.doesNotMatch(cariOzet, /FinansModal/);
    assert.doesNotMatch(cariOzet, /href=\{`\/panel\/finans\/cariler/);
    assert.match(page, /masraf-belge-turu/);
    assert.match(page, /masraf-belge-no/);
    assert.match(page, /Kasa Fişi/);
    assert.match(page, /composeMasrafDescription/);
    assert.match(page, /masraf-tarih-donem-uyari/);
    assert.match(page, /resolveFinansIslemTarihiDonemDurum/);
    assert.match(page, /FinansTarihDonemUyariIkon/);
    assert.match(page, /FINANS_DONEM_KAPALI_MESAJ/);
    assert.match(page, /FinansVerimlilikAnalizUyariBant|pushFinansVerimlilikAnalizUyari/);
    assert.match(ctrl, /ensure-vendor/);
    assert.match(ctrl, /ensureVendorAccount/);
  });

  it('kurulum adımı masraf kaynağını anlatır; kural «sonraki aşama» değildir', () => {
    const shared = readFileSync(join(here, 'finans-cari.ts'), 'utf8');
    const home = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/page.tsx'),
      'utf8',
    );
    assert.doesNotMatch(shared, /sonraki aşama/);
    assert.match(shared, /yeni masraf cari seçilmeden kaydolmaz/);
    assert.match(home, /finans-kurulum-adim-masraf/);
    assert.match(home, /Masraf Kuralını Onayla/);
    assert.match(home, /cari seçilmeden kaydolmaz/);
  });
});
