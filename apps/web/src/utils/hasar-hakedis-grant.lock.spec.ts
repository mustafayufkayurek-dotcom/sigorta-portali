import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildHasarHakedisGrantLines, buildHasarHakedisSecimSatirlari, DOSYA_ODEME_IS_GRUBU_YOK, DOSYA_ODEME_TEDARIKCI_YOK, avansAciklamaMetni, dosyaOdemeIsGrubu, dosyaOdemeTedarikciAdi, gercekTedarikciIsGruplari, hasarHakedisKalan, isHasarHakedisSatiriPasif, isOrnekHakedisSatiri, ORNEK_HAKEDIS_TEDARIKCILERI, ornekHakedisAvans, workGroupJobsLabel } from './hasar-hakedis-grant.ts';
import { netHakedisAfterAvans } from '../../../../packages/shared/src/hasar-flow-groups.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar hakediş maliyeti LOCK', () => {
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

  it('avans brüt hakedişten düşülür', () => {
    assert.equal(netHakedisAfterAvans(12500, 2500), 10000);
  });

  it('hakediş sayfasında iki örnek tedarikçi durur', () => {
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI.length, 2);
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI[0]?.vendorName, 'Orhan Şimşek');
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI[0]?.workGroupLabel, 'Mobilya İşleri');
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI[0]?.amount, 90_000);
    assert.equal(ornekHakedisAvans('ornek-orhan'), 10_000);
    assert.equal(hasarHakedisKalan(90_000, 10_000), 80_000);
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI[1]?.vendorName, 'Boyacı Usta');
    assert.equal(ORNEK_HAKEDIS_TEDARIKCILERI[1]?.workGroupLabel, 'Boya İşleri');
    assert.equal(isOrnekHakedisSatiri(ORNEK_HAKEDIS_TEDARIKCILERI[0]!), true);
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
    assert.match(panel, /ORNEK_HAKEDIS_TEDARIKCILERI/);
    assert.match(panel, /hasar-hakedis-is-grubu/);
    assert.match(panel, /hasar-hakedis-sayfa-listesi/);
    assert.match(panel, /Hakediş verildi/);
    assert.match(panel, /Ödenen Avans/);
    assert.match(panel, /Kalan Hakediş/);
    assert.match(panel, /hasar-hakedis-bakiye/);
    assert.match(panel, /Kalan Bakiye/);
    assert.match(panel, /Finansa Aktar/);
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
    assert.match(panel, /Ödeme Tarihi/);
    assert.match(panel, /Hakediş Talep Tarihi/);
    assert.match(panel, /TableColumnsProvider/);
    assert.match(panel, /orderedVisibleColumns/);
    assert.match(panel, /paymentDokumLayoutStyle/);
    assert.match(panel, /fromFile: claimId/);
    assert.match(panel, /label: 'Dosya'/);
    assert.doesNotMatch(panel, /Tedarikçi Dosyaları/);
    assert.doesNotMatch(panel, /profile-overview/);
  });
});
