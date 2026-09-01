/**
 * Hasar gelir kaydı — Faturalı / Faturasız.
 * Çalıştır:
 *   node --experimental-strip-types --test apps/web/src/utils/hasar-gelir-billed.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveClaimRevenueVat } from '../../../../packages/shared/src/finance-operation-no.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('hasar gelir faturalı / faturasız LOCK', () => {
  it('faturasızda KDV sıfırlanır; faturalıda oran işler', () => {
    assert.deepEqual(
      resolveClaimRevenueVat({ billed: false, amount: 48500, vatRate: 20 }),
      { billed: false, vatRate: 0, vatAmount: 0, totalAmount: 48500 },
    );
    assert.equal(resolveClaimRevenueVat({ billed: true, amount: 1000, vatRate: 20 }).vatAmount, 200);
  });

  it('çekmece Faturalı / Faturasız seçer; faturasızda KDV alanı yoktur', () => {
    const panel = read('../components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(panel, /billed: true/);
    assert.match(panel, /hasar-gelir-faturali/);
    assert.match(panel, /hasar-gelir-faturasiz/);
    assert.match(panel, /hasar-gelir-faturasiz-not/);
    assert.match(panel, /KDV hesaplanmaz\. Kayıt tutarı nettir/);
    assert.match(panel, /billed: gelir\.billed/);
    assert.match(panel, /resolveClaimRevenueVat/);
    assert.match(panel, /Tutar \(KDV Hariç\)/);
    assert.match(panel, /Hesaplanan KDV/);
    assert.doesNotMatch(panel, /<FinansFieldLabel>KDV \(%\)<\/FinansFieldLabel>/);
    assert.match(panel, /hasar-gelir-tahsilat-kaynagi/);
    assert.match(panel, /Dosyadan gelir; burada değişmez/);
    assert.doesNotMatch(panel, /setGelir\(\{ \.\.\.gelir, collectionSource/);
    assert.match(panel, /<FinansFieldLabel required>Açıklama<\/FinansFieldLabel>/);
    assert.doesNotMatch(panel, /FinansFormSection title="Açıklama"/);
    assert.match(panel, /placeholder=\{ACIKLAMA_YARDIM\.gelir\}/);
  });

  it('şema ve kayıt billed kolonunu taşır; faturasız KDV raporuna düşmez', () => {
    const schema = read('../../../backend/prisma/schema.prisma');
    assert.match(schema, /billed\s+Boolean\s+@default\(true\)/);
    const migration = read(
      '../../../backend/prisma/migrations/20260831203000_claim_file_revenue_billed/migration.sql',
    );
    assert.match(migration, /ADD COLUMN "billed"/);
    const dto = read('../../../backend/src/modules/finance/dto/create-claim-file-revenue.dto.ts');
    assert.match(dto, /billed\?: boolean/);
    const svc = read('../../../backend/src/modules/finance/claim-file-revenue.service.ts');
    assert.match(svc, /resolveClaimRevenueVat/);
    assert.match(svc, /billed,/);
    assert.match(svc, /collectionParty: claim.collectionParty/);
    assert.doesNotMatch(svc, /collectionSource: dto.collectionSource/);
    const vat = read('../../../backend/src/modules/finance/vat-report.service.ts');
    assert.match(vat, /billed: true/);
  });
});
