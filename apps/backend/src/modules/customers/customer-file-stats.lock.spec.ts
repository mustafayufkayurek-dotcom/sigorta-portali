/**
 * Kilit: Müşteri önizleme / liste / kart aynı dosya sayısını kullanır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/customers/customer-file-stats.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyCustomerFileStats,
  emptyCustomerFileStats,
  normalizePartyName,
  partyNamesLikelyMatch,
  shouldLinkInsuranceCompany,
} from './customer-file-stats.ts';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'customers.service.ts'), 'utf8');
const claimFiles = readFileSync(join(here, '../claim-files/claim-files.service.ts'), 'utf8');
const listPage = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/musteriler/page.tsx'),
  'utf8',
);
const detailPage = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/musteriler/[id]/page.tsx'),
  'utf8',
);
const helper = readFileSync(
  join(here, '../../../../../apps/web/src/utils/customer-file-counts.ts'),
  'utf8',
);

describe('müşteri dosya sayısı LOCK', () => {
  it('Remed / asistan adı sigorta kartıyla eşleşir', () => {
    assert.equal(normalizePartyName('Remed Assistance'), 'remed');
    assert.equal(partyNamesLikelyMatch('Remed Assistance', 'Remed'), true);
    assert.equal(shouldLinkInsuranceCompany({ id: '1', subType: 'asistan_firmasi' }), true);
    assert.equal(shouldLinkInsuranceCompany({ id: '2', subType: 'insured' }), false);
  });

  it('istatistik Toplam = hasar + acil; açık ayrı durur', () => {
    const row = applyCustomerFileStats(
      { id: 'c1', _count: { claimFiles: 0 } },
      { total: 42, open: 10, closed: 32, claim: 12, emergency: 30, lastActivity: null },
    );
    assert.equal(row._count.claimFiles, 42);
    assert.equal(row._count.files, 42);
    assert.equal(row._openCount, 10);
    assert.equal(row._closedCount, 32);
    assert.equal(emptyCustomerFileStats().total, 0);
  });

  it('liste, detay, excel ve müşteri dosya listesi aynı sayacı kullanır', () => {
    assert.match(service, /attachCustomerFileStats/);
    assert.match(service, /applyCustomerFileStats/);
    assert.match(service, /dosyaSayisi: stats\.get/);
    const stats = readFileSync(join(here, 'customer-file-stats.ts'), 'utf8');
    assert.match(stats, /_openCount/);
    assert.match(stats, /emergencyCase/);
    assert.match(claimFiles, /linkedInsuranceCompanyIds/);
    assert.match(claimFiles, /resolveInsuranceCompanyIdsForCustomer/);
    assert.match(helper, /customerFileCounts/);
    assert.match(listPage, /customerFileCounts/);
    assert.match(detailPage, /customerFileCounts/);
    assert.match(detailPage, /emergency-cases/);
  });
});
