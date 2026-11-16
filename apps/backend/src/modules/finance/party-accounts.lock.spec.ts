/**
 * Şirket cari hesabı + kurulum kapısı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/finance/party-accounts.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('Party accounts LOCK', () => {
  it('kurulum ve cari API kapıları durur', () => {
    const ctrl = readFileSync(join(here, 'party-accounts.controller.ts'), 'utf8');
    const svc = readFileSync(join(here, 'party-accounts.service.ts'), 'utf8');
    const mod = readFileSync(join(here, 'finance.module.ts'), 'utf8');
    assert.match(ctrl, /finance\/party-accounts/);
    assert.match(ctrl, /Get\('setup'\)/);
    assert.match(ctrl, /Patch\('setup'\)/);
    assert.match(ctrl, /donem-kapanis/);
    assert.match(ctrl, /donem-kapanis\/:year\/:month/);
    assert.match(ctrl, /seyir-ozet/);
    assert.match(ctrl, /hedef-ciro/);
    assert.match(ctrl, /:id\/statement/);
    assert.match(ctrl, /:id\/entries/);
    assert.match(svc, /FINANS_KURULUM_AYAR_KEY/);
    assert.match(svc, /FINANS_HEDEF_CIRO_AYAR_KEY/);
    assert.match(svc, /canShowFinansSeyir/);
    assert.match(svc, /getSeyirOzet/);
    assert.match(svc, /proposeFinansHedefCiro/);
    assert.match(svc, /patchHedefCiro/);
    assert.match(svc, /isletmeSabitKalemleri/);
    assert.match(svc, /sumFinansIsletmeSabit/);
    assert.match(svc, /resolveFinansHedefSabitGider/);
    assert.match(svc, /hedefParametre/);
    assert.match(svc, /canAcceptFinansHedefCiro/);
    assert.match(svc, /hedefCiro/);
    assert.match(svc, /hedefKabul/);
    assert.match(svc, /hedefOneriYokNeden/);
    assert.doesNotMatch(svc, /manuelSabitAylik/);
    assert.doesNotMatch(svc, /havuzSabitAylik/);
    const dto = readFileSync(join(here, 'dto/party-account.dto.ts'), 'utf8');
    assert.match(dto, /isletmeSabitKalemleri/);
    assert.match(dto, /kategori/);
    assert.match(dto, /baslangic/);
    assert.match(dto, /bitis/);
    assert.match(dto, /durum/);
    assert.doesNotMatch(dto, /manuelSabitAylik/);
    assert.match(svc, /normalizeFinansIsletmeSabitKalemi/);
    assert.match(svc, /sourceKind: 'acilis'/);
    assert.match(svc, /postExpenseDebit/);
    assert.match(svc, /confirmDonemKapanis/);
    assert.match(svc, /confirmMaliDonem/);
    assert.match(svc, /uyariMaliDonem/);
    assert.match(svc, /uyariMaliYil/);
    assert.match(svc, /maliDonemPromptFromLastPosting/);
    assert.match(svc, /lastPostingDate/);
    assert.match(svc, /openFileCount/);
    assert.match(svc, /closedWithoutInvoiceCount/);
    assert.match(svc, /hasarOpenCount/);
    assert.match(svc, /acilOpenCount/);
    assert.match(svc, /pendingInvoiceRequestCount/);
    assert.match(svc, /suggestedYear/);
    assert.match(svc, /canCloseYear/);
    assert.match(svc, /finansDonemYilListesi/);
    assert.match(svc, /findYearsWithFinanceActivity/);
    assert.match(svc, /oneriVar/);
    assert.match(svc, /Hedef sıfır olamaz/);
    assert.match(svc, /openAcilHref/);
    assert.match(svc, /disiplin/);
    assert.match(svc, /FINANS_DONEM_KAPALI_MESAJ/);
    assert.match(svc, /assertEntryDateOpen/);
    assert.match(svc, /postGelirBorc/);
    assert.match(svc, /postTahsilatAlacak/);
    assert.match(svc, /postOdemeBorc/);
    assert.match(svc, /ensureCustomerAccount/);
    assert.match(svc, /ensurePersonelAccount/);
    assert.match(svc, /postPersonelMaasBorc/);
    assert.match(svc, /personel-\$/);
    assert.match(svc, /sourceKind: 'maas'/);
    assert.match(mod, /PartyAccountsController/);
    assert.match(mod, /PartyAccountsService/);
  });

  it('tahsilat ve gelir cariye bağlanır', () => {
    const pay = readFileSync(join(here, '../payments/payments.service.ts'), 'utf8');
    const payMod = readFileSync(join(here, '../payments/payments.module.ts'), 'utf8');
    const rev = readFileSync(join(here, 'claim-file-revenue.service.ts'), 'utf8');
    assert.match(pay, /syncPaymentToPartyAccount/);
    assert.match(pay, /postTahsilatAlacak/);
    assert.match(pay, /postOdemeBorc/);
    assert.match(pay, /partyAccountId/);
    assert.match(payMod, /FinanceModule/);
    assert.match(rev, /postGelirBorc/);
  });

  it('masraf cari alanına bağlanır', () => {
    const schema = readFileSync(
      join(here, '../../../prisma/schema.prisma'),
      'utf8',
    );
    const dto = readFileSync(
      join(here, '../expenses/dto/expenses.dto.ts'),
      'utf8',
    );
    const exp = readFileSync(join(here, '../expenses/expenses.service.ts'), 'utf8');
    assert.match(schema, /model PartyAccount/);
    assert.match(schema, /model PartyAccountEntry/);
    assert.match(schema, /model FinansDonemKapanis/);
    assert.match(schema, /model FinansDonemKapanisSatir/);
    assert.match(schema, /contactPhone|contact_phone/);
    assert.match(schema, /partyAccountId/);
    assert.match(dto, /partyAccountId/);
    assert.match(exp, /partyAccountId/);
    assert.match(exp, /postExpenseDebit/);
    const partyDto = readFileSync(join(here, 'dto/party-account.dto.ts'), 'utf8');
    assert.match(partyDto, /contactPhone/);
    assert.match(partyDto, /contactEmail/);
  });
});
