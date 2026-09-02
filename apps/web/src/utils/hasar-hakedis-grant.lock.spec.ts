import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { avansPayiForSatir, buildHasarHakedisGrantLines, buildHasarHakedisSecimSatirlari, buDosyaOdemeKaynagi, DOSYA_ODEME_IS_GRUBU_YOK, DOSYA_ODEME_TEDARIKCI_YOK, avansAciklamaMetni, dosyaOdemeIsGrubu, dosyaOdemeTedarikciAdi, gercekTedarikciIsGruplari, hasarHakedisKalan, isBuDosyaOdeme, isHasarHakedisSatiriPasif, isOrnekHakedisSatiri, scaleGrantDetailsToAmount, verilenHakedisForSatir, workGroupJobsLabel } from './hasar-hakedis-grant.ts';
import { netHakedisAfterAvans } from '../../../../packages/shared/src/hasar-flow-groups.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar hakediş maliyeti LOCK', () => {
  it('gider sayfası yalnız bu dosyanın hakedişini basar', () => {
    const buDosya = 'ilknur';
    const rows = buDosyaOdemeKaynagi([
      { id: '1', claimFileId: 'ilknur' },
      { id: '2', claimFileId: 'diger-1', claimFile: { id: 'diger-1' } },
      { id: '3', claimFile: { id: 'ilknur' } },
      { id: '4', claimFileId: 'diger-2' },
    ], buDosya);
    assert.deepEqual(rows.map((row) => row.id), ['1', '3']);
    assert.equal(isBuDosyaOdeme({ claimFileId: 'diger-1' }, buDosya), false);
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /buDosyaOdemeKaynagi\(payments, claimId\)/);
    assert.match(panel, /buDosyaOdemeKaynagi\(payRows, claimId\)/);
    assert.doesNotMatch(panel, /tedarikciHareketleri/);
    assert.doesNotMatch(panel, /payerId: row\.id/);
  });

  it('dosya hareketinde tedarikçi ve iş grubu boş bırakılmaz', () => {
    assert.equal(dosyaOdemeTedarikciAdi({ vendorName: 'Orhan Şimşek' }), 'Orhan Şimşek');
    assert.equal(dosyaOdemeTedarikciAdi({}), DOSYA_ODEME_TEDARIKCI_YOK);
    assert.equal(dosyaOdemeIsGrubu({ lineDescription: 'Mobilya' }), 'Mobilya İşleri');
    assert.equal(dosyaOdemeIsGrubu({ supplierWorkGroups: [{ name: 'Mobilya' }] }), 'Mobilya İşleri');
    assert.equal(dosyaOdemeIsGrubu({ grantLabels: ['Tedarikçi bütçesi'] }), DOSYA_ODEME_IS_GRUBU_YOK);
    assert.equal(dosyaOdemeIsGrubu({ grantLabels: ['Mobilya İşleri', 'Boya İşleri'] }), DOSYA_ODEME_IS_GRUBU_YOK);
    assert.equal(dosyaOdemeIsGrubu({}), DOSYA_ODEME_IS_GRUBU_YOK);
  });

  it('iş grubu adı Mobilya İşleri biçiminde durur', () => {
    assert.equal(workGroupJobsLabel('Mobilya'), 'Mobilya İşleri');
    assert.equal(workGroupJobsLabel('Mobilya İşleri'), 'Mobilya İşleri');
  });

  it('iş grubu satırı rapordan kalem detayı taşır', () => {
    const lines = buildHasarHakedisGrantLines({
      reportItems: [{
        id: 'i1',
        jobDescription: 'Koltuk döşeme',
        quantity: 2,
        unit: 'adet',
        supplierTotal: 7500,
        workGroup: { id: 'mob', name: 'Mobilya' },
        workGroupId: 'mob',
      }],
    });
    assert.equal(lines[0]?.label, 'Mobilya İşleri');
    assert.equal(lines[0]?.amount, 7500);
    assert.equal(lines[0]?.details[0]?.jobDescription, 'Koltuk döşeme');
  });

  it('kalem yoksa rapor / bütçe tutarı tek satır gelir', () => {
    const lines = buildHasarHakedisGrantLines({ reportItems: [], reportSupplierTotal: 12500 });
    assert.equal(lines[0]?.label, 'Tedarikçi bütçesi');
    assert.equal(lines[0]?.amount, 12500);
  });

  it('maliyet yoksa satır uydurulmaz', () => {
    assert.deepEqual(buildHasarHakedisGrantLines({ reportItems: [] }), []);
  });

  it('iş grubu satırına dosya tedarikçisi ve fiyatı bağlanır', () => {
    const rows = buildHasarHakedisSecimSatirlari({
      lines: [{
        key: 'mob',
        workGroupId: 'mob',
        label: 'Mobilya İşleri',
        amount: 7500,
        details: [],
      }],
      suppliers: [{
        id: 'v1',
        name: 'Local Kabul Tedarikci',
        paymentDueDays: 15,
        workGroups: [{ id: 'mob', name: 'Mobilya' }],
      }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.workGroupLabel, 'Mobilya İşleri');
    assert.equal(rows[0]?.vendorName, 'Local Kabul Tedarikci');
    assert.equal(rows[0]?.amount, 7500);
  });

  it('tedarikçide grup yoksa rapor iş grubu satırı kullanılır', () => {
    const rows = buildHasarHakedisSecimSatirlari({
      lines: [{
        key: 'mob',
        workGroupId: 'mob',
        label: 'Mobilya İşleri',
        amount: 90000,
        details: [],
      }],
      suppliers: [{
        id: 'orhan',
        name: 'Orhan Şimşek',
        paymentDueDays: 15,
        workGroups: [],
      }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.vendorName, 'Orhan Şimşek');
    assert.equal(rows[0]?.workGroupLabel, 'Mobilya İşleri');
    assert.equal(rows[0]?.amount, 90000);
  });

  it('iş grubu eşleşmezse dosyadaki tedarikçiye bağlanır', () => {
    const rows = buildHasarHakedisSecimSatirlari({
      lines: [{ key: 'tedarikci-butce', label: 'Tedarikçi bütçesi', amount: 12500, details: [] }],
      suppliers: [{ id: 'v1', name: 'Local Kabul Tedarikci', paymentDueDays: 15, workGroups: [] }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.amount, 12500);
    assert.equal(rows[0]?.vendorId, 'v1');
    assert.equal(rows[0]?.workGroupLabel, 'İş Grubu Yok');
  });

  it('katalog iş grubu uydurulmaz', () => {
    assert.deepEqual(buildHasarHakedisSecimSatirlari({
      lines: [],
      suppliers: [{
        id: 'v1',
        name: 'X',
        workGroups: [{ id: 'boya', name: 'Boyacı' }],
      }],
    }), []);
  });

  it('katalog yığını iş grubu sayılmaz; gerçek grup bütçe etiketi olur', () => {
    assert.deepEqual(gercekTedarikciIsGruplari(
      { id: 'v1', name: 'X', workGroups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
      ['a', 'b'],
    ), []);
    const rows = buildHasarHakedisSecimSatirlari({
      lines: [{ key: 'tedarikci-butce', label: 'Tedarikçi bütçesi', amount: 12500, details: [] }],
      suppliers: [{
        id: 'v1',
        name: 'Local Kabul Tedarikci',
        paymentDueDays: 15,
        workGroups: [{ id: 'mob', name: 'Mobilya' }],
      }],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.workGroupLabel, 'Mobilya İşleri');
    assert.equal(rows[0]?.vendorName, 'Local Kabul Tedarikci');
    assert.equal(rows[0]?.amount, 12500);
  });

  it('boyacı ayrı iş grubu satırı olur', () => {
    const rows = buildHasarHakedisSecimSatirlari({
      lines: [
        { key: 'mob', workGroupId: 'mob', label: 'Mobilya İşleri', amount: 90000, details: [] },
        { key: 'boya', workGroupId: 'boya', label: 'Boya İşleri', amount: 40000, details: [] },
      ],
      suppliers: [
        {
          id: 'orhan',
          name: 'Orhan Şimşek',
          paymentDueDays: 15,
          workGroups: [{ id: 'mob', name: 'Mobilya' }],
        },
        {
          id: 'boyaci',
          name: 'Boyacı Usta',
          paymentDueDays: 15,
          workGroups: [{ id: 'boya', name: 'Boya İşleri' }],
        },
      ],
    });
    assert.equal(rows[0]?.vendorName, 'Orhan Şimşek');
    assert.equal(rows[0]?.workGroupLabel, 'Mobilya İşleri');
    assert.equal(rows[0]?.amount, 90000);
    assert.equal(rows[1]?.vendorName, 'Boyacı Usta');
    assert.equal(rows[1]?.workGroupLabel, 'Boya İşleri');
    assert.equal(rows[1]?.amount, 40000);
  });

  it('kalan hakediş varken satır pasif olmaz', () => {
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      kalanHakedis: 11000,
      hakedisGonderildiVendorIds: ['v1'],
    }), false);
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      kalanHakedis: 0,
    }), true);
  });

  it('finansa gönderilen hakediş satırı pasiftir', () => {
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      hakedisGonderildiVendorIds: ['v1'],
    }), true);
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      workGroupId: 'mob',
      statements: [{ vendorId: 'v1', status: 'APPROVED', items: [{ workGroupId: 'mob' }] }],
    }), true);
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      workGroupId: 'siva',
      statements: [{ vendorId: 'v1', status: 'APPROVED', items: [{ workGroupId: 'mob' }] }],
    }), false);
  });

  it('kalan hakediş bütçe eksi ödenen avanstır', () => {
    assert.equal(hasarHakedisKalan(90_000, 10_000), 80_000);
    assert.equal(hasarHakedisKalan(12500, 1500), 11000);
    assert.equal(hasarHakedisKalan(12500, 1500, 6500), 4500);
  });

  it('aynı tedarikçide ikinci iş grubu kalan hakediş durur', () => {
    const statements = [{
      vendorId: 'v1',
      status: 'APPROVED',
      totalAmount: 13000,
      items: [{
        workGroupId: 'alc',
        lineDescription: 'Alçıpan İşleri',
        totalAmount: 13000,
      }],
    }];
    const verilenSihhi = verilenHakedisForSatir({
      vendorId: 'v1',
      workGroupId: 'siva',
      workGroupLabel: 'Sıhhi Tesisat İşleri',
      statements,
      vendorSatirSayisi: 2,
    });
    const verilenAlc = verilenHakedisForSatir({
      vendorId: 'v1',
      workGroupId: 'alc',
      workGroupLabel: 'Alçıpan İşleri',
      statements,
      vendorSatirSayisi: 2,
    });
    assert.equal(verilenSihhi, 0);
    assert.equal(hasarHakedisKalan(12000, 0, verilenSihhi), 12000);
    assert.equal(isHasarHakedisSatiriPasif({
      vendorId: 'v1',
      workGroupId: 'siva',
      kalanHakedis: hasarHakedisKalan(12000, 0, verilenSihhi),
    }), false);
    assert.equal(verilenAlc, 13000);
    assert.equal(hasarHakedisKalan(13000, 0, verilenAlc), 0);
  });

  it('avans iş grubu satırına bütçe payıyla yazılır', () => {
    assert.equal(avansPayiForSatir(13000, 25000, 5000), 2600);
    assert.equal(avansPayiForSatir(12000, 25000, 5000), 2400);
    assert.equal(avansPayiForSatir(13000, 13000, 1500), 1500);
  });

  it('bütçe düzenlenince kalem payı ölçeklenir', () => {
    const scaled = scaleGrantDetailsToAmount(
      [{ id: 'i1', jobDescription: 'Boru', amount: 8000 }, { id: 'i2', jobDescription: 'Musluk', amount: 4000 }],
      18000,
    );
    assert.equal(scaled[0]?.amount, 12000);
    assert.equal(scaled[1]?.amount, 6000);
  });

  it('avans brüt hakedişten düşülür', () => {
    assert.equal(netHakedisAfterAvans(12500, 2500), 10000);
  });

  it('hakediş sayfasına örnek tedarikçi basılmaz', () => {
    assert.equal(isOrnekHakedisSatiri({ key: 'ornek-orhan', vendorId: 'ornek-orhan' }), true);
    assert.equal(isOrnekHakedisSatiri({ key: 'v1', vendorId: 'gercek-uuid' }), false);
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /hakedisSayfaSatirlari = useMemo\(\s*\(\) => secimSatirlari/s);
    assert.doesNotMatch(panel, /ORNEK_HAKEDIS_TEDARIKCILERI/);
    assert.doesNotMatch(panel, /ornek-orhan/);
    assert.doesNotMatch(panel, /Boyacı Usta/);
    assert.match(panel, /isOrnekHakedisSatiri/);
  });

  it('avans açıklamasına İş Grubu Yok yazılmaz', () => {
    assert.equal(avansAciklamaMetni('İş Grubu Yok'), '');
    assert.equal(avansAciklamaMetni('iş grubu yok'), '');
    assert.equal(avansAciklamaMetni(''), '');
    assert.equal(avansAciklamaMetni('Alçıpan İşleri'), 'Alçıpan İşleri');
  });

  it('avans açıklaması boş açılır; iş grubu adı kutu doldurmaz', () => {
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /setAvansAciklama\(''\)/);
    assert.doesNotMatch(panel, /setAvansAciklama\(avansAciklamaMetni/);
    assert.match(panel, /placeholder=\{ACIKLAMA_YARDIM\.avans\}/);
    assert.doesNotMatch(panel, /hasar-avans-aciklama-yardim/);
  });

  it('panel fiş, TL, Finansa Aktar ve ödeme kuyruğunu taşır', () => {
    const panel = readFileSync(join(here, '../components/finance/HasarFileHakedisPanel.tsx'), 'utf8');
    assert.match(panel, /buildHasarHakedisGrantLines/);
    assert.match(panel, /buildHasarHakedisSecimSatirlari/);
    assert.doesNotMatch(panel, /ORNEK_HAKEDIS_TEDARIKCILERI/);
    assert.match(panel, /hasar-hakedis-is-grubu/);
    assert.match(panel, /hasar-hakedis-sayfa-listesi/);
    assert.match(panel, /Hakediş verildi/);
    assert.match(panel, /Ödenen Avans/);
    assert.match(panel, /Kalan Hakediş/);
    assert.match(panel, /hasar-hakedis-bakiye/);
    assert.match(panel, /Kalan Bakiye/);
    assert.match(panel, /Finansa Aktar/);
    assert.match(panel, /Bu iş grubuna hakediş verildi/);
    assert.doesNotMatch(panel, /Bu tedarikçiye hakediş verildi/);
    assert.match(panel, /Sözleşme durumunu belirleyiniz/);
    assert.doesNotMatch(panel, /Dosyada sözleşme var mı sorun/);
    assert.match(panel, /Avans Ver/);
    assert.match(panel, /hasar-avans-tedarikci/);
    assert.match(panel, /payerId: satir.vendorId/);
    assert.match(panel, /avansAciklamaMetni/);
    assert.doesNotMatch(panel, /setAvansAciklama\(row\.workGroupLabel\)/);
    assert.match(panel, /ArrowLeft/);
    assert.match(panel, />\s*Geri\s*</);
    assert.match(panel, /FinanceRowActions/);
    assert.match(panel, /Tedarikçi Adı Soyadı/);
    assert.match(panel, /dosyaOdemeTedarikciAdi/);
    assert.match(panel, /dosyaOdemeIsGrubu/);
    assert.match(panel, /İşlemler/);
    assert.doesNotMatch(panel, /Avans \/ Hakediş/);
    assert.match(panel, /tahsilatlar\?queue=payable&claimFileId=/);
    assert.doesNotMatch(panel, /prefix="₺"/);
    assert.doesNotMatch(panel, /CommercialPricingDrawer/);
    assert.match(panel, /label: 'Tedarikçi Adı Soyadı'/);
    assert.match(panel, /label: 'İş Grubu'/);
    assert.match(panel, /Avans uyarısı/);
    assert.match(panel, /HASAR_AVANS_YARI_ONAY_METNI/);
    assert.doesNotMatch(panel, /Avans limiti aşıyor/);
    assert.match(panel, /Ödeme Tarihi/);
    assert.match(panel, /Hakediş Talep Tarihi/);
    assert.match(panel, /TableColumnsProvider/);
    assert.match(panel, /orderedVisibleColumns/);
    assert.match(panel, /paymentDokumLayoutStyle/);
    assert.match(panel, /fromFile: claimId/);
    assert.match(panel, /label: 'Dosya'/);
    assert.match(panel, /verilenHakedisForSatir/);
    assert.match(panel, /avansPayiForSatir/);
    assert.match(panel, /hasar-hakedis-butce-duzenle/);
    assert.match(panel, />\s*Düzenle\s*</);
    assert.match(panel, /scaleGrantDetailsToAmount/);
    assert.doesNotMatch(panel, /Tedarikçi Dosyaları/);
    assert.doesNotMatch(panel, /profile-overview/);
    const statements = readFileSync(
      join(here, '../../../../apps/backend/src/modules/vendor-statements/vendor-statements.service.ts'),
      'utf8',
    );
    assert.match(statements, /items: \{ select: \{ lineDescription: true, workGroupId: true, totalAmount: true/);
  });
});
