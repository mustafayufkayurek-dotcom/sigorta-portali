/**
 * Rapor / ihbar mailinde Dosya Konusu — claimSubject boş olsa da konu durur.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/common/helpers/claim-file-subject-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { claimFileSubjectName } from './ihbar-konusu.helper.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('dosya konusu mail adı LOCK', () => {
  it('claimSubject yoksa department veya lossType yazar', () => {
    assert.equal(
      claimFileSubjectName({
        claimSubject: null,
        departmentFileSubject: { name: 'Dahili Su' },
        lossType: 'Yangın',
      }),
      'Dahili Su',
    );
    assert.equal(
      claimFileSubjectName({
        claimSubject: null,
        departmentFileSubject: null,
        lossType: 'Cam Kırılması',
      }),
      'Cam Kırılması',
    );
    assert.equal(
      claimFileSubjectName({
        claimSubject: { name: 'Belirtilmemiş' },
        departmentFileSubject: null,
        lossType: 'Sel-Seylap',
      }),
      'Sel-Seylap',
    );
    assert.equal(
      claimFileSubjectName({
        claimSubject: null,
        departmentFileSubject: null,
        lossType: 'Belirtilmemiş',
      }),
      null,
    );
  });

  it('rapor gönderimi ortak adı kullanır; yalnız claimSubject yok', () => {
    const reports = readFileSync(
      join(here, '../../modules/repair-reports/repair-reports.service.ts'),
      'utf8',
    );
    assert.match(reports, /from '@\/common\/helpers\/ihbar-konusu\.helper'/);
    assert.equal(
      (reports.match(/fileSubject: claimFileSubjectName\(report\.claimFile\)/g) ?? []).length,
      2,
    );
    assert.doesNotMatch(reports, /fileSubject: report\.claimFile\?\.claimSubject\?\.name/);
  });
});
