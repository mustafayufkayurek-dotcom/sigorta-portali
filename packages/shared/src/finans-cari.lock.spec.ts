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
  finansIsletmeSabitAktifAyda,
  finansIsletmeSabitEntryDateIso,
  finansIsletmeSabitSourceId,
  finansIslemDonemSecimUyarisi,
  finansIslemTarihiDonemUyarisi,
  resolveFinansIslemTarihiDonemDurum,
  FINANS_DONEM_KAPALI_MESAJ,
  bankaCariKodu,
  buildFinansSeyirDonemKarZarar,
  cariCiftRolKimlikHatasi,
  CARI_SIRKET_TUR_GRUPLARI,
  CARI_TUR_GRUPLARI,
  CARI_TUR_LABEL,
  CARI_KARSI_TARAF_ROL_LABEL,
  cariKarsiTarafListeSayfalari,
  cariRolFromPartyKind,
  cariTurFilterKinds,
  finansPaymentCariEtiket,
  isCariKarsiTarafRol,
  isCariKarsiTarafTur,
  isCariMusteriRolu,
  normalizeCariKarsiTarafRol,
  isCariOnlyCustomerTahsilat,
  isCariSirketTur,
  isCariTedarikciRolu,
  isFinansNakitCariTur,
  NAKIT_KASA_CARI_KODU,
  proposeFinansHedefCiro,
  resolveFinansHedefSabitGider,
  shouldSuggestMaliDonemKapanis,
  shouldSuggestMaliYilKapanis,
  splitFinansSeyirBakiyeleri,
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
    assert.equal(cariVarsayilanAcilisYon('musteri_tedarikci'), 'alacak');
    assert.equal(CARI_TUR_LABEL.musteri_tedarikci, 'Müşteri Ve Tedarikçi');
    assert.ok(CARI_TUR_GRUPLARI.some((g) => g.kinds.includes('musteri_tedarikci')));
    assert.equal(isCariMusteriRolu('musteri_tedarikci'), true);
    assert.equal(isCariTedarikciRolu('musteri_tedarikci'), true);
    assert.equal(isCariMusteriRolu('tedarikci'), false);
    assert.deepEqual(cariTurFilterKinds('musteri'), ['musteri', 'musteri_tedarikci']);
    assert.deepEqual(cariTurFilterKinds('tedarikci'), ['tedarikci', 'musteri_tedarikci']);
    assert.deepEqual(cariKarsiTarafListeSayfalari('musteri'), ['musteriler']);
    assert.deepEqual(cariKarsiTarafListeSayfalari('tedarikci'), ['tedarikciler']);
    assert.deepEqual(cariKarsiTarafListeSayfalari('musteri_tedarikci'), [
      'musteriler',
      'tedarikciler',
    ]);
    assert.equal(isCariKarsiTarafRol('musteri_tedarikci'), true);
    assert.equal(normalizeCariKarsiTarafRol('x', 'musteri'), 'musteri');
    assert.equal(cariRolFromPartyKind('musteri_tedarikci'), 'musteri_tedarikci');
    assert.equal(CARI_KARSI_TARAF_ROL_LABEL.musteri_tedarikci, 'Müşteri Ve Tedarikçi');
    assert.match(
      cariCiftRolKimlikHatasi({ entityType: 'individual', identityNo: null }) || '',
      /T\.C\. kimlik/,
    );
    assert.equal(
      cariCiftRolKimlikHatasi({ entityType: 'individual', identityNo: '10000000146' }),
      null,
    );
    assert.match(
      cariCiftRolKimlikHatasi({ entityType: 'corporate', taxNumber: null }) || '',
      /vergi/,
    );
    assert.equal(isCariKarsiTarafTur('musteri'), true);
    assert.equal(isCariSirketTur('kredi_karti'), true);
    assert.equal(isCariSirketTur('musteri'), false);
    assert.ok(!CARI_SIRKET_TUR_GRUPLARI.some((g) => g.kinds.includes('musteri')));
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
      partyAccountId: 'cari-1',
    });
    const maas = normalizeFinansIsletmeSabitKalemi({
      id: 'b',
      ad: 'Maaş',
      kategori: 'Personel',
      aylikTutar: 15_000,
      baslangic: '2026-01-01',
      partyAccountId: 'cari-2',
    });
    const pasif = normalizeFinansIsletmeSabitKalemi({
      id: 'c',
      ad: 'Eski',
      aylikTutar: 10_000,
      durum: 'pasif',
      baslangic: '2026-01-01',
    });
    assert.ok(kira && maas && pasif);
    assert.equal(kira.partyAccountId, 'cari-1');
    assert.equal(pasif.partyAccountId, '');
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

  it('işletme sabiti cariye aylık düşüm — tek kaynak kimliği ve ay kapsamı', () => {
    assert.equal(finansIsletmeSabitSourceId('kira-1', 2026, 11), 'sabit:kira-1:2026-11');
    assert.equal(finansIsletmeSabitEntryDateIso(2026, 3), '2026-03-01');
    const kira = normalizeFinansIsletmeSabitKalemi({
      id: 'kira-1',
      ad: 'Ofis Kirası',
      kategori: 'Kira Ve Ofis',
      aylikTutar: 30_000,
      baslangic: '2026-01-01',
      partyAccountId: 'cari-1',
    });
    assert.ok(kira);
    assert.equal(finansIsletmeSabitAktifAyda(kira, 2026, 11), true);
    assert.equal(finansIsletmeSabitAktifAyda({ ...kira, durum: 'pasif' }, 2026, 11), false);
    assert.equal(finansIsletmeSabitAktifAyda({ ...kira, partyAccountId: '' }, 2026, 11), false);
    assert.equal(
      finansIsletmeSabitAktifAyda({ ...kira, baslangic: '2026-12-01' }, 2026, 11),
      false,
    );
    assert.equal(
      finansIsletmeSabitAktifAyda({ ...kira, bitis: '2026-10-31' }, 2026, 11),
      false,
    );
  });

  it('dosyasız müşteri tahsilatı cariye özeldir', () => {
    assert.equal(
      isCariOnlyCustomerTahsilat({
        claimFileId: null,
        paymentType: 'incoming',
        payerType: 'customer',
        payerId: 'mus-1',
      }),
      true,
    );
    assert.equal(
      isCariOnlyCustomerTahsilat({
        claimFileId: 'dosya-1',
        paymentType: 'incoming',
        payerType: 'customer',
        payerId: 'mus-1',
      }),
      false,
    );
    assert.equal(
      isCariOnlyCustomerTahsilat({
        claimFileId: null,
        paymentType: 'outgoing',
        payerType: 'customer',
        payerId: 'mus-1',
      }),
      false,
    );
  });

  it('nakit / banka cari seyirde ayrı tutulur', () => {
    assert.equal(bankaCariKodu('acc-1'), 'banka-acc-1');
    assert.equal(NAKIT_KASA_CARI_KODU, 'nakit-kasa');
    assert.equal(isFinansNakitCariTur('banka'), true);
    assert.equal(isFinansNakitCariTur('musteri'), false);
    const ozet = splitFinansSeyirBakiyeleri([
      { kind: 'musteri', netBakiye: 10_000 },
      { kind: 'tedarikci', netBakiye: -4_000 },
      { kind: 'banka', netBakiye: 25_000 },
      { kind: 'banka', netBakiye: -500 },
      { kind: 'kredi_karti', netBakiye: -2_000 },
    ]);
    assert.equal(ozet.cariAlacak, 10_000);
    assert.equal(ozet.cariBorc, 6_500);
    assert.equal(ozet.nakit, 25_000);
  });

  it('dönem gelir gider kâr tüm hatlardan toplanır', () => {
    const kz = buildFinansSeyirDonemKarZarar({
      hasarGelir: 100_000,
      acilGelir: 20_000,
      masrafGider: 45_000,
      acilGider: 15_000,
    });
    assert.equal(kz.gelir, 120_000);
    assert.equal(kz.gider, 60_000);
    assert.equal(kz.kar, 60_000);
    assert.equal(buildFinansSeyirDonemKarZarar({}).kar, 0);
    assert.equal(
      buildFinansSeyirDonemKarZarar({ hasarGelir: 10_000, masrafGider: 12_500 }).kar,
      -2_500,
    );
  });

  it('tahsilat ve ödeme cari izi etiketi durur', () => {
    assert.deepEqual(
      finansPaymentCariEtiket({
        status: 'completed',
        partyAccountId: 'cari-1',
        paymentType: 'incoming',
      }),
      { label: 'Cariye yazıldı', tone: 'posted' },
    );
    assert.equal(
      finansPaymentCariEtiket({
        status: 'pending',
        partyAccountId: 'cari-1',
        paymentType: 'outgoing',
      }).label,
      'Ödeme sonrası cariye işler',
    );
    assert.equal(
      finansPaymentCariEtiket({
        status: 'pending',
        partyAccountId: 'cari-1',
        paymentType: 'incoming',
      }).label,
      'Tahsilat sonrası cariye işler',
    );
    assert.equal(
      finansPaymentCariEtiket({ status: 'completed', partyAccountId: null }).tone,
      'missing',
    );
    assert.equal(finansPaymentCariEtiket({ status: 'pending' }).tone, 'none');
  });

  it('farklı ay tarihli işlem uyarır; kaydı kesmez', () => {
    assert.equal(finansIslemTarihiDonemUyarisi('2026-11-16', '2026-11-16'), null);
    const yeni = finansIslemTarihiDonemUyarisi('2026-12-01', '2026-11-16');
    assert.ok(yeni);
    assert.match(yeni, /yeni ay/);
    assert.match(yeni, /Kayıt durdurulmaz/);
    const onceki = finansIslemTarihiDonemUyarisi('2026-10-05', '2026-11-16');
    assert.ok(onceki);
    assert.match(onceki, /önceki ay/);
    assert.match(onceki, /Kayıt durdurulmaz/);
    const secim = finansIslemDonemSecimUyarisi(2026, 12, '2026-11-16');
    assert.ok(secim);
    assert.match(secim, /12\.2026/);
    const soft = resolveFinansIslemTarihiDonemDurum('2026-10-05', [], [], '2026-11-16');
    assert.equal(soft.kind, 'soft');
    const closed = resolveFinansIslemTarihiDonemDurum('2026-10-05', [], ['2026-10'], '2026-11-16');
    assert.equal(closed.kind, 'closed');
    assert.equal(closed.kind === 'closed' ? closed.message : '', FINANS_DONEM_KAPALI_MESAJ);
    const openSame = resolveFinansIslemTarihiDonemDurum('2026-11-16', [], [], '2026-11-16');
    assert.equal(openSame.kind, 'ok');
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
