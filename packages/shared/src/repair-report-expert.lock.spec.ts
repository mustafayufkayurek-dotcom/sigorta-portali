/**
 * Kilit: Hasar üst bant — sigorta ihbarında eksper ofisi yok.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/repair-report-expert.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHasarHeaderBandParts } from './repair-report-expert.ts';

describe('Hasar üst bant LOCK', () => {
  it('eksper müşteride ofis + sigorta + dosya no + konu', () => {
    assert.deepEqual(
      buildHasarHeaderBandParts({
        customer: {
          companyName: 'Meridyen Ekspertiz Ltd.',
          subType: 'eksper_firmasi',
          entityType: 'corporate',
        },
        insuranceCompany: { name: 'Anadolu Sigorta' },
        fileNo: 'LOCAL-SAHA-003',
        konu: 'Dahili Su',
      }),
      ['Meridyen Ekspertiz Ltd.', 'Anadolu Sigorta', 'LOCAL-SAHA-003', 'Dahili Su'],
    );
  });

  it('sigorta ihbarında eksper ofisi yazılmaz', () => {
    assert.deepEqual(
      buildHasarHeaderBandParts({
        customer: {
          companyName: 'Anadolu Sigorta',
          subType: 'sigorta_sirketi',
          entityType: 'corporate',
        },
        insuranceCompany: { name: 'Anadolu Sigorta' },
        fileNo: 'SIG-001',
        konu: 'Dahili Su',
      }),
      ['Anadolu Sigorta', 'SIG-001', 'Dahili Su'],
    );
  });
});
