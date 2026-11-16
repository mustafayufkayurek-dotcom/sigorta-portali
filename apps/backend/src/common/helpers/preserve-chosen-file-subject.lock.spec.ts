/**
 * Seçilen dosya konusu eşleme yok diye silinmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/common/helpers/preserve-chosen-file-subject.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { preserveChosenFileSubject, sanitizeInboundLossType } from './ihbar-konusu.helper.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('seçilen dosya konusu LOCK', () => {
  it('katalog adı Belirtilmemiş olmaz', () => {
    const raw = 'Sel-Seylap';
    const kept = preserveChosenFileSubject(raw, sanitizeInboundLossType(raw));
    assert.equal(kept, 'Sel-Seylap');
  });

  it('bilinen eşleme durur', () => {
    const raw = 'Cam Kırığı';
    assert.equal(preserveChosenFileSubject(raw, sanitizeInboundLossType(raw)), 'Cam Kırılması');
  });

  it('katalog adı not sanılıp silinmez', () => {
    assert.equal(
      preserveChosenFileSubject('Boru Patlaması', sanitizeInboundLossType('Boru Patlaması')),
      'Boru Patlaması',
    );
    assert.notEqual(preserveChosenFileSubject('Tesisat Sızıntısı', sanitizeInboundLossType('Tesisat Sızıntısı')), 'Belirtilmemiş');
  });

  it('dosya açılışı ve düzenleme aynı kapıyı kullanır', () => {
    const src = readFileSync(join(here, '../../modules/claim-files/claim-files.service.ts'), 'utf8');
    assert.equal((src.match(/preserveChosenFileSubject\(/g) ?? []).length, 2);
  });

  it('düzenlemede Dosya Konusu değişince eski department konusu (Tadilat) kalmaz', () => {
    const src = readFileSync(join(here, '../../modules/claim-files/claim-files.service.ts'), 'utf8');
    assert.match(src, /Konu değişince eski Tadilat/);
    assert.match(src, /departmentCodeForNewClaim/);
    assert.match(src, /rest\.departmentFileSubjectId = deptSubject\?\.id \?\? null/);
    assert.match(src, /rest\.claimSubjectId = await resolveClaimSubjectIdByLabel/);
  });
});
