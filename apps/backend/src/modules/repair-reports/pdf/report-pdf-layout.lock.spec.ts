/**
 * Kilit: Çift hasarlı PDF sırası — özet bina toplamının üstünde;
 * yasal metin resimlerden sonra; iki imza + dijital iz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/pdf/report-pdf-layout.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { showPdfSplitCategoryTotals } from './report-pdf-fields.ts';

const specDir = dirname(fileURLToPath(import.meta.url));
const pdfSrc = readFileSync(join(specDir, 'report-pdf.service.ts'), 'utf8');
const reportsSrc = readFileSync(join(specDir, '../repair-reports.service.ts'), 'utf8');

describe('onarım raporu PDF düzen LOCK', () => {
  it('Hasar Nedeni Bazlı Özet bina toplamının üstünde basılır', () => {
    const ozet = pdfSrc.indexOf('${damageCauseSummaryHtml}');
    const toplam = pdfSrc.indexOf('<!-- TOPLAMLAR -->');
    assert.ok(ozet > 0 && toplam > ozet, 'özet toplam başlığının üstünde olmalı');
    assert.match(pdfSrc, /Hasar Nedeni Bazlı Özet/);
    assert.match(pdfSrc, /PDF_BINA_TOTAL_LABEL/);
  });

  it('iş grubu yanında hasar nedeni sütunu durur', () => {
    const group = pdfSrc.indexOf('>İş Grubu</th>');
    const cause = pdfSrc.indexOf('>Hasar Nedeni</th>', group);
    assert.ok(group > 0 && cause > group, 'Hasar Nedeni iş grubunun yanında olmalı');
    assert.match(pdfSrc, /cause-cell/);
    assert.match(pdfSrc, /item\.damageType\?\.damageTypeName/);
  });

  it('grup toplamında rakam da italik durur', () => {
    assert.match(pdfSrc, /\.subtotal-amount \{[^}]*font-style: italic/);
  });

  it('tespit resimleri ayrı sayfada ızgara durur; yasal metin bölünmez', () => {
    assert.match(pdfSrc, /photo-appendix/);
    assert.match(pdfSrc, /page-break-before: always/);
    assert.match(pdfSrc, /photo-frame/);
    assert.match(pdfSrc, /aspect-ratio: 4 \/ 3/);
    assert.match(pdfSrc, /\.legal-section \{[\s\S]*?page-break-inside: avoid/);
    assert.match(pdfSrc, /chunkPhotoRows\(attachmentImages, 3\)/);
  });

  it('bina ve eşya ayrı toplamı yalnız ikisi de varken çıkar', () => {
    assert.equal(showPdfSplitCategoryTotals({ binaCount: 1, esyaCount: 0, demirbasCount: 0 }), false);
    assert.equal(showPdfSplitCategoryTotals({ binaCount: 1, esyaCount: 1, demirbasCount: 0 }), true);
    assert.match(pdfSrc, /showPdfSplitCategoryTotals/);
  });

  it('yasal uyarılar tespit resimlerinin ardından gelir', () => {
    const photos = pdfSrc.indexOf('${photoGalleryHtml}');
    const legal = pdfSrc.indexOf('Yasal Uyarılar Ve Açıklamalar');
    assert.ok(photos > 0 && legal > photos, 'yasal metin resimlerden sonra olmalı');
  });

  it('Tespiti Yapan yanında Dosya Sorumlusu imza alanı ve dijital iz durur', () => {
    assert.match(pdfSrc, /Tespiti Yapan/);
    assert.match(pdfSrc, /Dosya Sorumlusu/);
    assert.match(pdfSrc, /Dijital imza izi ·/);
    assert.match(pdfSrc, /signature-stamp-inline/);
    assert.match(pdfSrc, /\$\{fileDistrict\} Network/);
    const stamp = pdfSrc.indexOf('signature-stamp-inline');
    const line = pdfSrc.indexOf('signature-line', stamp);
    assert.ok(stamp > 0 && line > stamp, 'dijital iz çizginin üstünde olmalı');
    assert.match(pdfSrc, /signatureBoxHtml\('Tespiti Yapan'/);
    assert.match(pdfSrc, /signatureBoxHtml\('Dosya Sorumlusu'/);
    assert.match(reportsSrc, /assignedInspectorVendor:/);
  });
});
