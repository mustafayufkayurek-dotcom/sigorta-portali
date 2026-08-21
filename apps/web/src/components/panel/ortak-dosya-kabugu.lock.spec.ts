/**
 * Kilit: Hasar ve Acil dosya ekranları tek tasarım dilinden beslenir.
 * Kaynak olay (21.08.2026): aynı iş için iki ayrı kabuk kodu vardı; Hasar'da
 * yapılan düzeltme Acil'e geçmiyordu.
 *
 * Çalıştır:
 * node --experimental-strip-types --test apps/web/src/components/panel/ortak-dosya-kabugu.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FILE_STATUS_TONE, fileStatusBadgeClass } from './file-status-tone.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

const stageStrip = read('FileStageStrip.tsx');
const claimStrip = read('../damage-reports/ClaimStageStrip.tsx');
const acilStrip = read('../../app/panel/acil-yardim/[id]/AcilHeaderStageStrip.tsx');
const hasarPage = read('../../app/panel/hasar-dosyalari/[id]/page.tsx');
const acilPage = read('../../app/panel/acil-yardim/[id]/page.tsx');
const hasarDetay = read('../../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx');

describe('ortak dosya kabuğu LOCK', () => {
  it('durum rengi tek sözlükten okunur', () => {
    assert.equal(FILE_STATUS_TONE.red, 'border-red-200 bg-red-50 text-red-800');
    assert.match(fileStatusBadgeClass('green'), /rounded-full/);
    assert.match(fileStatusBadgeClass('bilinmeyen'), /slate-100/);
    assert.match(hasarDetay, /FILE_STATUS_TONE/);
    assert.match(acilPage, /FILE_STATUS_TONE/);
  });

  it('rozet gövdesi iki departmanda ortak tanımdan gelir', () => {
    assert.match(hasarDetay, /FILE_STATUS_BADGE_BASE/);
    assert.match(acilPage, /FILE_STATUS_BADGE_BASE/);
  });

  it('akış şeridi tek bileşenden çizilir; kopya markup yok', () => {
    assert.match(stageStrip, /export function FileStageStrip/);
    assert.match(claimStrip, /FileStageStrip/);
    assert.match(acilStrip, /FileStageStrip/);
    // Daire / bağlayıcı çizimi yalnız ortak bileşende durur.
    assert.doesNotMatch(claimStrip, /ring-2 ring-white/);
    assert.doesNotMatch(acilStrip, /ring-2 ring-white/);
  });

  it('sekme şeridi Hasar hap görünümünden gelir', () => {
    assert.match(hasarPage, /PanelPillTabs/);
    assert.match(acilPage, /PanelPillTabs/);
    assert.doesNotMatch(acilPage, /bg-blue-50 text-blue-700'\s*:\s*'text-slate-500/);
  });

  it('durum rozeti iki ekranda da Dosya Bilgileri satırındadır', () => {
    // Hasar: üst bantta durum rozeti yok, rozet Dosya Bilgileri yanında.
    assert.doesNotMatch(hasarPage, /durumRozeti &&/);
    assert.match(hasarDetay, /STAGE_TONE_BADGE\[ozet.durumTone\]/);
    // Acil: aynı yer — durum rozeti Dosya Bilgileri başlığından sonra gelir.
    const acilBaslik = acilPage.indexOf('>Dosya Bilgileri<');
    const acilRozet = acilPage.indexOf('data-testid="guncel-durum"');
    assert.ok(acilBaslik > 0, 'Acil Dosya Bilgileri başlığı bulunamadı');
    assert.ok(acilRozet > acilBaslik, 'Acil durum rozeti üst banda geri taşınmış');
  });

  it('kart gövdesi ve bölüm başlığı ortak ölçekten gelir', () => {
    assert.match(acilPage, /PANEL_CARD_BASE/);
    assert.match(acilPage, /PanelSectionTitle/);
    // Acil kendi kart kenarına dönmez (slate-100 kart kenarı Hasar'da yok).
    assert.doesNotMatch(acilPage, /rounded-xl border border-slate-100 shadow-sm/);
    assert.doesNotMatch(acilPage, /bg-white rounded-xl border border-slate-100/);
  });
});
