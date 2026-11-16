/**
 * Finans cari omurgası kilidi.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/finans-cari.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCariBakiyeIletisimMesaji,
  buildFinansDonemKapanisSatir,
  canConfirmFinansDonemKapanis,
  canShowFinansSeyir,
  cariBakiyeEtiket,
  cariBakiyeMetin,
  cariNetBakiye,
  cariVarsayilanAcilisYon,
  finansDonemKapanisGun,
  addCalendarMonthsIso,
  finansDonemYilListesi,
  finansOncekiMaliDonem,
  finansOncekiMaliYil,
  finansKurulumEksikleri,
  isFinansDonemKapaliForDate,
  maliDonemPromptFromLastPosting,
  normalizeFinansKurulum,
  canAcceptFinansHedefCiro,
  normalizeFinansHedefCiro,
  normalizeFinansIsletmeSabitKalemi,
  proposeFinansHedefCiro,
  resolveFinansHedefSabitGider,
  shouldSuggestMaliDonemKapanis,
  shouldSuggestMaliYilKapanis,
  sumFinansIsletmeSabit,
} from './finans-cari.ts';

describe('Finans cari LOCK', () => {
  it('kurulum bitmeden seyir açılmaz', () => {
    assert.equal(canShowFinansSeyir(normalizeFinansKurulum(null)), false);
    assert.equal(
      canShowFinansSeyir(normalizeFinansKurulum({ cariTanim: true, acilisGozdenGecirildi: false })),
      false,
    );
    assert.equal(
      canShowFinansSeyir(
        normalizeFinansKurulum({
          cariTanim: 'yok',
          acilisGozdenGecirildi: true,
          masrafKaynak: false,
        }),
      ),
      false,
    );
    assert.equal(
      canShowFinansSeyir(
        normalizeFinansKurulum({
          cariTanim: 'yok',
          acilisGozdenGecirildi: true,
          masrafKaynak: true,
        }),
      ),
      true,
    );
    assert.deepEqual(finansKurulumEksikleri(normalizeFinansKurulum(null)), [
      'Cari hesap tanımı',
      'Açılış bakiyesi gözden geçirme',
      'Masraf kaynağı',
    ]);
  });

  it('bakiye borç − alacak; etiket muhasebe dilinde B / A', () => {
    assert.equal(cariNetBakiye({ toplamBorc: 1000, toplamAlacak: 300 }), 700);
    assert.equal(cariBakiyeEtiket(700).yon, 'borc_bakiyesi');
    assert.equal(cariBakiyeEtiket(700).label, 'Borç');
    assert.equal(cariBakiyeEtiket(700).kisaltma, 'B');
    assert.equal(cariBakiyeEtiket(-2500).yon, 'alacak_bakiyesi');
    assert.equal(cariBakiyeEtiket(-2500).tutar, 2500);
    assert.equal(cariBakiyeEtiket(-2500).label, 'Alacak');
    assert.equal(cariBakiyeEtiket(-2500).kisaltma, 'A');
    assert.equal(cariVarsayilanAcilisYon('kredi_karti'), 'borc');
    assert.equal(cariVarsayilanAcilisYon('musteri'), 'alacak');
    assert.equal(cariBakiyeMetin(700, (n) => `${n} TL`), '700 TL Borç');
    assert.equal(cariBakiyeMetin(-2500, (n) => `${n} TL`), '2500 TL Alacak');
    assert.match(
      buildCariBakiyeIletisimMesaji({
        cariAdi: 'Test Cari',
        bakiyeMetin: '1.250,00 TL Borç',
      }),
      /Test Cari cari hesabınızın güncel bakiyesi/,
    );
  });

  it('dönem sonu kapanış — aktarım yok; kapalı yıla hareket yazılmaz', () => {
    assert.equal(finansDonemKapanisGun(2025), '2025-12-31');
    assert.equal(canConfirmFinansDonemKapanis(2025, '2025-12-30'), false);
    assert.equal(canConfirmFinansDonemKapanis(2025, '2025-12-31'), true);
    assert.equal(canConfirmFinansDonemKapanis(2025, '2026-01-01'), true);
    assert.equal(isFinansDonemKapaliForDate('2025-06-01', [2025]), true);
    assert.equal(isFinansDonemKapaliForDate('2026-01-15', [2025]), false);
    assert.equal(isFinansDonemKapaliForDate('2026-10-05', [], ['2026-10']), true);
    const oncekiAy = finansOncekiMaliDonem('2026-11-15');
    assert.equal(oncekiAy?.periodKey, '2026-10');
    assert.equal(oncekiAy?.label, 'Ekim 2026');
    assert.equal(finansOncekiMaliYil('2026-11-15')?.year, 2025);
    assert.equal(shouldSuggestMaliDonemKapanis('2026-11-15', []), true);
    assert.equal(shouldSuggestMaliDonemKapanis('2026-11-15', ['2026-10']), false);
    assert.equal(shouldSuggestMaliYilKapanis(2025, '2026-11-15', []), true);
    assert.equal(shouldSuggestMaliYilKapanis(2025, '2026-11-15', [2025]), false);
    assert.equal(shouldSuggestMaliYilKapanis(2024, '2026-11-15', []), false);
    assert.equal(addCalendarMonthsIso('2026-10-26', 1), '2026-11-26');
    assert.equal(
      maliDonemPromptFromLastPosting('2026-11-25', '2026-10-26', [])?.periodKey,
      undefined,
    );
    assert.equal(
      maliDonemPromptFromLastPosting('2026-11-26', '2026-10-26', [])?.periodKey,
      '2026-10',
    );
    assert.equal(
      maliDonemPromptFromLastPosting('2026-11-26', '2026-10-26', ['2026-10']),
      null,
    );
    const satir = buildFinansDonemKapanisSatir({
      accountId: 'a1',
      accountName: 'Test',
      accountKind: 'musteri',
      toplamBorc: 1000,
      toplamAlacak: 200,
    });
    assert.equal(satir.netBakiye, 800);
    assert.equal(satir.bakiyeLabel, 'Borç');
  });

  it('hedef ciro önerisi borç + sabit + kâr payından çıkar', () => {
    const p = proposeFinansHedefCiro({
      cariBorc: 120_000,
      aylikSabitGider: 40_000,
      borcAySayisi: 12,
      karPayiPct: 15,
    });
    assert.equal(p.borcAylikPay, 10_000);
    assert.equal(p.aylikSabitGider, 40_000);
    assert.equal(p.karPayi, 7_500);
    assert.equal(p.onerilenAylik, 57_500);
    assert.equal(p.oneriVar, true);
    const bos = proposeFinansHedefCiro({ cariBorc: 0, aylikSabitGider: 0 });
    assert.equal(bos.oneriVar, false);
    assert.equal(bos.onerilenAylik, 0);
  });

  it('hedef ciro kaydı boş gelir; kabul sonradan yazılır', () => {
    assert.equal(normalizeFinansHedefCiro(null).kabulAylik, null);
    assert.equal(normalizeFinansHedefCiro({ kabulAylik: 80_000 }).kabulAylik, 80_000);
    assert.equal(normalizeFinansHedefCiro({ kabulAylik: 0 }).kabulAylik, null);
    assert.equal(normalizeFinansHedefCiro({ borcAySayisi: 99 }).borcAySayisi, 36);
    const eskiManuel = normalizeFinansHedefCiro({ manuelSabitAylik: 45_000 });
    assert.equal(eskiManuel.isletmeSabitKalemleri.length, 1);
    assert.equal(eskiManuel.isletmeSabitKalemleri[0]?.aylikTutar, 45_000);
    assert.equal(normalizeFinansHedefCiro({ manuelSabitAylik: 0 }).isletmeSabitKalemleri.length, 0);
    const kira = normalizeFinansIsletmeSabitKalemi({
      id: 'a',
      ad: 'Kira',
      kategori: 'Kira Ve Ofis',
      aylikTutar: 30_000,
      baslangic: '2026-01-01',
    });
    const maas = normalizeFinansIsletmeSabitKalemi({
      id: 'b',
      ad: 'Maaş',
      kategori: 'Personel',
      aylikTutar: 15_000,
      baslangic: '2026-01-01',
    });
    const pasif = normalizeFinansIsletmeSabitKalemi({
      id: 'c',
      ad: 'Eski',
      aylikTutar: 10_000,
      durum: 'pasif',
      baslangic: '2026-01-01',
    });
    assert.ok(kira && maas && pasif);
    assert.equal(kira.durum, 'aktif');
    assert.equal(kira.bitis, null);
    assert.equal(kira.kategori, 'Kira Ve Ofis');
    assert.equal(kira.tekrar, 'aylik');
    assert.equal(sumFinansIsletmeSabit([kira, maas, pasif]), 45_000);
    const eskiAdTutar = normalizeFinansIsletmeSabitKalemi({
      id: 'eski',
      ad: 'Kira',
      aylikTutar: 12_000,
    });
    assert.ok(eskiAdTutar);
    assert.equal(eskiAdTutar.kategori, 'Diğer');
    assert.equal(eskiAdTutar.tekrar, 'aylik');
    assert.equal(eskiAdTutar.durum, 'aktif');
    assert.equal(eskiAdTutar.bitis, null);
    const donemIci = normalizeFinansIsletmeSabitKalemi({
      id: 'd1',
      ad: 'Kira',
      aylikTutar: 10_000,
      baslangic: '2026-01-01',
      bitis: '2026-06-30',
    });
    const donemDisi = normalizeFinansIsletmeSabitKalemi({
      id: 'd2',
      ad: 'Eski Kira',
      aylikTutar: 8_000,
      baslangic: '2025-01-01',
      bitis: '2025-12-31',
    });
    assert.ok(donemIci && donemDisi);
    assert.equal(
      sumFinansIsletmeSabit([donemIci, donemDisi], { asOfIso: '2026-03-15' }),
      10_000,
    );
    assert.equal(canAcceptFinansHedefCiro(0), false);
    assert.equal(canAcceptFinansHedefCiro(1000), true);
    assert.equal(resolveFinansHedefSabitGider(0), 0);
    assert.equal(resolveFinansHedefSabitGider(45_000), 45_000);
  });

  it('dönem yılı yalnız gerçek hareket / kilit / kapatılabilir önceki yıldır', () => {
    assert.deepEqual(
      finansDonemYilListesi({
        currentYear: 2026,
        activityYears: [2026],
        closedYears: [],
        includeClosablePrevious: true,
      }),
      [2026, 2025],
    );
    assert.deepEqual(
      finansDonemYilListesi({
        currentYear: 2026,
        activityYears: [2026],
        closedYears: [],
        includeClosablePrevious: false,
      }),
      [2026],
    );
    assert.deepEqual(
      finansDonemYilListesi({
        currentYear: 2026,
        activityYears: [2026, 2024],
        closedYears: [2023],
        includeClosablePrevious: false,
      }),
      [2026, 2024, 2023],
    );
  });
});
