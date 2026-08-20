/**
 * Acil tedarikçi önerisi — kaynak kilidi (credential yok).
 * Ulusal A kesiti, alfabetik acil listesi, Google UI etiketi geri gelmesin.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`Dosya yok: ${rel}`);
  return readFileSync(p, 'utf8');
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

const rec = read('apps/backend/src/modules/vendors/vendor-recommendation.service.ts');
if (!rec.includes("allowNationalFallback: false")) {
  fail('Acil öneride allowNationalFallback: false yok');
}
if (!rec.includes('keepAllAreaCandidates: true')) {
  fail('Acil öneride keepAllAreaCandidates yok — kayıtlı il/ilçe adayları düşer');
}
if (!rec.includes("sortBy: 'score'")) {
  fail('Acil öneri compositeScore (sortBy score) değil');
}
if (rec.includes("sortBy: 'name'")) {
  fail('Acil öneri alfabetik sortBy name geri geldi');
}
if (!rec.includes('Yalnızca bu dosyada kullanım')) {
  fail('Dosyaya özel kayıt havuz dışı bırakılmıyor');
}
pass('Backend: il/ilçe + skor, ulusal kesit kapalı, dosya-özel havuz dışı');

const controller = read('apps/backend/src/modules/emergency/emergency-cases.controller.ts');
if (!controller.includes('limit ? Number(limit) : 20')) {
  fail('Acil recommended API varsayılan limit 20 değil');
}
if (controller.includes('limit ? Number(limit) : 80')) {
  fail('Acil recommended API ulusal 80 limiti geri geldi');
}
pass('Acil API öneri limiti 20');

const tabs = read('apps/web/src/components/vendor-discovery/RecommendedVendorsTabs.tsx');
if (tabs.includes('acilAlpha') || tabs.includes("localeCompare(b.name, 'tr')")) {
  fail('UI acil alfabetik kesit geri geldi');
}
if (!tabs.includes('list.slice(0, TOP_N)')) {
  fail('UI skorlu TOP_N kesiti yok');
}
if (!tabs.includes('TOP_FEATURED = 3')) {
  fail('UI skorlu ilk 3 (TOP_FEATURED) yok — tasarım kaybolmuş');
}
if (!tabs.includes('tedarikci-diger-ac-kapa') || !tabs.includes('Diğer Kayıtlı Tedarikçiler')) {
  fail('Diğer Kayıtlı Tedarikçiler kapalı/açılır kutusu yok (Title Case)');
}
if (tabs.includes('Diğer kayıtlı tedarikçiler')) {
  fail('Title Case ihlali: Diğer kayıtlı tedarikçiler');
}
if (!tabs.includes('resolveRegionProximity') || !tabs.includes('regionProximity')) {
  fail('Bölgeye Uzaklık (il/ilçe eşleşmesi) UI yok');
}
if (!tabs.includes('Alternatif Önerilere Bak')) {
  fail('Bölge boşken Alternatif Öneriler geçişi yok');
}
pass('UI: skorlu kayıtlı liste, boş bölgede alternatif');
pass('UI: ilk 3 açık + diğerleri kapalı/açılır kilitli');

const page = read('apps/web/src/app/panel/acil-yardim/[id]/page.tsx');
if (!page.includes('getRecommendedVendors(id, 20)')) {
  fail('Acil dosya sayfası öneriyi 20 ile istemiyor');
}
if (page.includes('getRecommendedVendors(id, 80)')) {
  fail('Acil dosya sayfası ulusal 80 limiti geri geldi');
}
if (!page.includes('tedarikci-havuz-tavsiye') || !page.includes('isAcilFileOnlyVendor')) {
  fail('Hizmet sonrası havuz kayıt tavsiyesi yok');
}
if (!page.includes('qualityWarning') || !tabs.includes('tedarikci-olumsuz-uyari')) {
  fail('Olumsuz memnuniyet/maliyet uyarısı yok');
}
if (!page.includes('tedarikci-ilk-kullanim-seridi') || !page.includes('OpsFirstRunNotice')) {
  fail('Acil tedarikçi ilk kullanım şeridi yok');
}
pass('Dosya sayfası: skorlu öneri + havuz tavsiyesi');

const cases = read('apps/backend/src/modules/emergency/emergency-cases.service.ts');
if (!cases.includes('reportNegativeVendorIfNeeded') || !cases.includes('shouldReportAcilNegativeVendorStrike')) {
  fail('Olumsuz tedarikçi 2. çalışma yönetici e-postası yok');
}
pass('Olumsuz 2. atama yöneticiye raporlanır');

const alt = read('apps/web/src/components/vendor-discovery/AlternativeVendorServicePanel.tsx');
if (/Google Places|Google Maps API/i.test(alt)) {
  fail('Alternatif panelde yasak sağlayıcı etiketi var');
}
if (!alt.includes('Alternatif tedarikçi şu anda önerilemiyor')) {
  fail('Alternatif boş durum operasyon metni yok');
}
pass('Alternatif panelde Google/API etiketi yok');
