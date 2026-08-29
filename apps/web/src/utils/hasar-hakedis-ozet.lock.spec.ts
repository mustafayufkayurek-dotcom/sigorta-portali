import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildAvansIslemleri,
  buildHakedisAkis,
  buildHasarHakedisOzet,
  buildOdemePlani,
  classifyHakedisBelge,
  hakedisDurumEtiket,
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
    assert.equal(akis[3]?.durum, 'aktif');
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
    assert.match(panel, /Avans İşlemleri/);
    assert.match(panel, /Hakediş İşlemleri/);
    assert.match(panel, /Ödeme Planı/);
    assert.match(panel, /Dosyadan önerilen/);
    assert.match(panel, /Hakedişe özel belgeler/);
    assert.match(panel, /Hakediş Yönetimi/);
    assert.match(panel, /\+ Yeni Hakediş/);
    assert.match(panel, /Finansa Aktar/);
    assert.match(panel, /tahsilatlar\?queue=payable/);
    assert.doesNotMatch(panel, /CommercialPricingDrawer/);
  });
});
