import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildAvansGecmisi,
  buildAvansIslemleri,
  buildHakedisAkis,
  buildHasarHakedisOzet,
  buildOdemePlani,
  classifyHakedisBelge,
  hakedisDonemEtiket,
  hakedisDurumEtiket,
  hakedisGerceklesmeOrani,
  hakedisKesintiNet,
  hakedisTutarKirilim,
  parseAvansMahsupFromNote,
  resolveHasarAvansLimit,
} from './hasar-hakedis-ozet.ts';
import { buildHasarHakedisGrantLines } from './hasar-hakedis-grant.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar hakediş özet LOCK', () => {
  it('sözleşme yokken sıfır uydurmaz', () => {
    const ozet = buildHasarHakedisOzet({});
    assert.equal(ozet.sozlesme.amount, null);
    assert.ok(ozet.eksikler.length > 0);
  });

  it('kalan bakiye sözleşme − onaylı − talep', () => {
    const ozet = buildHasarHakedisOzet({
      sozlesmeTutari: 12500,
      onayliHakedisToplam: 2500,
      buTalepBrut: 4000,
      avansToplam: 0,
    });
    assert.equal(ozet.kalanSozlesme.amount, 6000);
    assert.equal(ozet.netOdenecek, 4000);
  });

  it('avans mahsup kullanılabilir bakiyeyi düşer', () => {
    const ozet = buildHasarHakedisOzet({
      sozlesmeTutari: 12500,
      onayliHakedisToplam: 0,
      buTalepBrut: 12500,
      avansToplam: 2500,
      oncekiMahsupToplam: 0,
    });
    assert.equal(ozet.kullanilanAvans.amount, 2500);
    assert.equal(ozet.kalanAvans.amount, 0);
    assert.equal(ozet.netOdenecek, 10000);
  });

  it('bütçe aşımında uyarı üretir', () => {
    const ozet = buildHasarHakedisOzet({
      sozlesmeTutari: 10000,
      onayliHakedisToplam: 8000,
      buTalepBrut: 4000,
    });
    assert.ok(ozet.uyarilar.some((t) => /aşıyor/.test(t)));
  });

  it('statement notundan önceki mahsup okunur', () => {
    assert.equal(parseAvansMahsupFromNote('Hasar hakediş — X · avans mahsup 2500'), 2500);
  });

  it('belge kaynak ayrımı dosya / özel', () => {
    assert.equal(classifyHakedisBelge({ documentKind: 'muvafakatname' }), 'onerilen');
    assert.equal(classifyHakedisBelge({ documentTypeName: 'Fatura' }), 'ozel');
  });

  it('kalem yoksa örnek tutar basılmaz', () => {
    assert.deepEqual(buildHasarHakedisGrantLines({ reportItems: [] }), []);
  });

  it('avans limiti sözleşmenin yüzde yirmisidir; sözleşme yoksa Eksik', () => {
    assert.equal(resolveHasarAvansLimit(12500), 2500);
    assert.equal(resolveHasarAvansLimit(null), null);
    assert.equal(hakedisTutarKirilim({ totalAmount: 6000, items: [{ totalAmount: 6000, vatRate: 0 }] }).kdv, 0);
    assert.equal(hakedisDurumEtiket({ status: 'APPROVED', odemeDurumu: 'completed' }), 'Ödendi');
    const akis = buildHakedisAkis({
      status: 'APPROVED',
      createdAt: '2026-08-15',
      autoApprovedAt: '2026-08-15',
      odemeDurumu: 'pending',
      vade: '2026-08-30',
    });
    assert.equal(akis[0]?.durum, 'tamam');
    assert.equal(akis[3]?.id, 'odeme');
    assert.equal(akis[3]?.durum, 'aktif');
    assert.equal(akis[4]?.id, 'tamamlandi');
    assert.equal(akis[4]?.durum, 'bekler');
  });

  it('dönem, kesinti ve gerçekleşme oranı hesaplanır', () => {
    assert.match(hakedisDonemEtiket({ createdAt: '2026-08-18' }), /Ağustos 2026/);
    const tutar = hakedisKesintiNet({
      totalAmount: 285000,
      notes: 'Hasar hakediş · avans mahsup 15.000',
      items: [{ totalAmount: 285000, vatRate: 0 }],
    });
    assert.equal(tutar.hakedisTutari, 285000);
    assert.equal(tutar.kesintiler, 15000);
    assert.equal(tutar.netTutar, 270000);
    assert.equal(hakedisGerceklesmeOrani(2450000, 1280000), 52.2);
  });

  it('avans ve ödeme planı mevcut kayıtlardan gelir', () => {
    const avans = buildAvansIslemleri([
      { id: 'a1', amount: 2500, status: 'pending', note: '[AVANS]', paymentDate: '2026-08-15' },
    ]);
    assert.equal(avans[0]?.tutar, 2500);
    assert.equal(avans[0]?.tipLabel, 'Avans talebi');
    const plan = buildOdemePlani({
      onayliHakedis: 10000,
      payments: [
        { id: 'p1', amount: 4000, status: 'completed', note: 'Hakediş' },
        { id: 'p2', amount: 2500, status: 'pending', note: '[AVANS]' },
      ],
    });
    assert.equal(plan.odenen, 4000);
    assert.equal(plan.bekleyen, 0);
    assert.equal(plan.kalan, 6000);
  });

  it('panel üç sekme ve kaynak etiketini taşır', () => {
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /buildHasarHakedisOzet/);
    assert.match(panel, /HAKEDIS_KAYNAK_ETIKET/);
    assert.match(panel, /hasar-hakedis-sekme/);
    assert.match(panel, /id: 'avans', label: 'Avans'/);
    assert.match(panel, /id: 'hakedis', label: 'Hakediş'/);
    assert.match(panel, /id: 'odeme', label: 'Ödemeler'/);
    assert.doesNotMatch(panel, /Ne yapmak istiyorsunuz/);
    assert.match(panel, /hasar-hakedis-islem-kart/);
    assert.match(panel, /hasar-hakedis-tedarikci-sayisi/);
    assert.match(panel, /Ödenen Avans Toplamı/);
    assert.match(panel, /grid-cols-2/);
    assert.match(panel, /Wallet/);
    assert.match(panel, /Receipt/);
    assert.doesNotMatch(panel, /role="tablist"/);
    assert.match(panel, /Tedarikçi Ödemeleri Ve Avansları/);
    assert.match(panel, /dosya-tedarikci-odeme-dokum/);
    assert.match(panel, /Tedarikçi Adı Soyadı/);
    assert.match(panel, /Ödeme Tarihi/);
    assert.match(panel, /Hakediş Talep Tarihi/);
    assert.match(panel, /İş Grubu/);
    assert.match(panel, /Kalan Hakediş/);
    assert.match(panel, /Ödenen Avans/);
    assert.match(panel, /Hakediş Yönetimi/);
    assert.match(panel, /hasar-hakedis-sayfa-listesi/);
    assert.match(panel, /HakedisTedarikciKartlari/);
    assert.match(panel, /Finansa Aktar/);
    assert.match(panel, /tahsilatlar\?queue=payable&claimFileId=/);
    assert.match(panel, /Ödemeleri gör/);
    assert.match(panel, /Açıklama/);
    assert.match(panel, /Sözleşme \/ Bütçe/);
    assert.match(panel, /Toplam Avans/);
    assert.match(panel, /Toplam Hakediş/);
    assert.match(panel, /Finans Onayına Gönder/);
    assert.match(panel, /Talep tarihi/);
    assert.match(panel, /Avans talep tarihi/);
    assert.match(panel, /Dosyada sözleşme var mı/);
    assert.match(panel, /dosya-sozlesme-soru/);
    assert.match(panel, /Sözleşme Yoksa Açıklayınız/);
    assert.match(panel, /vendor-contracts/);
    assert.match(panel, /Bu tutar bütçeyi aşıyor/);
    assert.doesNotMatch(panel, /Kalan avans hakkı/);
    assert.match(panel, /placeholder=\{ACIKLAMA_YARDIM\.avans\}/);
    assert.match(panel, /avansAciklamaMetni/);
    assert.doesNotMatch(panel, /setAvansAciklama\(row\.workGroupLabel\)/);
    assert.match(panel, /Avans Ver/);
    assert.match(panel, /hasar-avans-tedarikci/);
    assert.match(panel, /Avans verilecek tedarikçiyi seçin/);
    assert.match(panel, /Tedarikçi seçin/);
    assert.match(panel, /Bu Avans/);
    assert.match(panel, /Verilen avans/);
    assert.match(panel, /Kalan Bakiye/);
    assert.match(panel, /max-w-\[460px\]/);
    assert.doesNotMatch(panel, /Avans Geçmişi/);
    assert.doesNotMatch(panel, /Muvafakatname/);
    assert.doesNotMatch(panel, /Ara dönemde avans talepleri/);
    assert.doesNotMatch(panel, /Avans nedeni/);
    assert.doesNotMatch(panel, /Ödeme Planı/);
    assert.doesNotMatch(panel, /CommercialPricingDrawer/);
    assert.doesNotMatch(panel, /\$\{fmt\([^)]+\)\} TL/);
    assert.doesNotMatch(panel, /return `₺ /);
  });

  it('avans geçmişi mahsubu sırayla böler', () => {
    const rows = buildAvansGecmisi({
      alreadyMahsup: 500,
      payments: [
        { id: 'a1', amount: 1500, status: 'completed', paymentDate: '2026-08-15', referenceNo: 'A-2026-001', note: '[AVANS]' },
      ],
    });
    assert.equal(rows[0]?.no, 'A-2026-001');
    assert.equal(rows[0]?.kullanilan, 500);
    assert.equal(rows[0]?.kalan, 1000);
    assert.equal(rows[0]?.durum, 'Açık');
  });
});
