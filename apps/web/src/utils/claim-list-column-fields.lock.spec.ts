/**
 * Kilit: Dosya No hücresi / başlığı sigorta şirketi adı ile karışmasın.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/claim-list-column-fields.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertClaimListIdentityFieldsIsolated,
  claimListFileNo,
} from './claim-list-column-fields.ts';

const specDir = dirname(fileURLToPath(import.meta.url));

describe('hasar dosya no × sigorta şirketi LOCK', () => {
  it('sigorta adı dosya no yerine yazılmaz', () => {
    const isolated = assertClaimListIdentityFieldsIsolated({
      fileNo: 'EUREKO',
      claimNo: 'Eureko Sigorta',
      insuranceCompany: { name: 'Eureko Sigorta' },
      insuredName: 'İlknur Yılmaz',
    });
    assert.equal(isolated.fileNo, '—');
    assert.equal(isolated.insuranceCompany, 'Eureko Sigorta');
    assert.equal(claimListFileNo({
      fileNo: '14102847240002',
      insuranceCompany: { name: 'Eureko Sigorta' },
    }), '14102847240002');
    assert.equal(claimListFileNo({
      fileNo: 'HD-2026-0042',
      insuranceCompany: { name: 'Anadolu Sigorta' },
    }), 'HD-2026-0042');
  });

  it('dosya başlığı claimListFileNo kullanır', () => {
    const detail = readFileSync(join(specDir, '../app/panel/hasar-dosyalari/[id]/page.tsx'), 'utf8');
    assert.match(detail, /claimListFileNo\(claim\)/);
    assert.doesNotMatch(detail, /<h2[^>]*>\{claim\.fileNo/);
  });
});
