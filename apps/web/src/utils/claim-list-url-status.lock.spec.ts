/**
 * Hasar listesi ?status=open/closed kilidi.
 * Çalıştır: pnpm smoke:field-open-list
 *   veya: node --experimental-strip-types --test src/utils/claim-list-url-status.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(
  join(here, '../app/panel/hasar-dosyalari/page.tsx'),
  'utf8',
);

describe('claim-list-url-status lock', () => {
  it('liste sayfasında ürün aşaması filtresi; eksper/bütçe yok', () => {
    assert.match(pageSrc, /HASAR_PRODUCT_STAGE_FILTERS/);
    assert.match(pageSrc, /hasarProductStageFilterValue/);
    assert.match(pageSrc, /claimListStatusFilterFromUrl/);
    assert.match(pageSrc, /appendClaimListStatusParams/);
    assert.doesNotMatch(pageSrc, /claimStatuses\.map\(\(s\) => <option/);
    assert.doesNotMatch(pageSrc, /'devam'/);
    assert.doesNotMatch(pageSrc, /Eksper Atandı/);
    assert.doesNotMatch(pageSrc, /Bütçe Hazırlanıyor/);
    const seed = readFileSync(join(here, '../../../backend/prisma/seed.ts'), 'utf8');
    assert.doesNotMatch(seed, /Eksper Atandı/);
    assert.doesNotMatch(seed, /Bütçe Hazırlanıyor/);
    assert.doesNotMatch(seed, /Bütçe Onaylandı/);
    const ops = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(ops, /ACIL_PRODUCT_STAGE_FILTERS/);
    assert.match(ops, /acil-asama-filtre/);
    assert.match(ops, /EMERGENCY_STATUS_PRODUCT_LABELS/);
    const detail = readFileSync(join(here, '../app/panel/hasar-dosyalari/[id]/page.tsx'), 'utf8');
    assert.match(detail, /staffVisibleClaimStatusName/);
    const claimStatus = readFileSync(
      join(here, '../../../backend/src/modules/claim-status/claim-status.service.ts'),
      'utf8',
    );
    assert.match(claimStatus, /overlayClaimStatusProductName/);
  });
});
