/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/file-recognized-partners.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filePartnersSectionTitle,
  isExpertOfficeSubType,
  sortFileRecognizedPartners,
} from './file-recognized-partners.ts';

describe('dosyadan tanınan eksper–sigorta LOCK', () => {
  it('eksper kartında sigorta, sigorta kartında eksper başlığı durur', () => {
    assert.equal(isExpertOfficeSubType('eksper_firmasi'), true);
    assert.equal(filePartnersSectionTitle('eksper_firmasi'), 'Dosyadan Tanınan Sigorta Şirketleri');
    assert.equal(filePartnersSectionTitle('sigorta_sirketi'), 'Dosyadan Tanınan Eksper Ofisleri');
    assert.equal(filePartnersSectionTitle('asistan_firmasi'), null);
  });

  it('sıra dosya sayısına göredir; 20 ile kesilir', () => {
    const rows = sortFileRecognizedPartners([
      { id: 'b', name: 'Bereket', kind: 'sigorta_sirketi', fileCount: 1 },
      { id: 'a', name: 'Allianz', kind: 'sigorta_sirketi', fileCount: 4 },
    ]);
    assert.equal(rows[0]?.name, 'Allianz');
    assert.equal(rows.length, 2);
  });
});
