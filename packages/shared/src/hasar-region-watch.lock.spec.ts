/**
 * Hasar bölge maili — dosya sorumlusu ayrı; istisna dosya konusu.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-region-watch.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasarResponsibilityCoversSubject } from './hasar-region-watch.ts';

describe('hasar bölge izi LOCK', () => {
  it('tüm kapsamda her konu gider', () => {
    assert.equal(
      hasarResponsibilityCoversSubject({
        coverageType: 'all',
        claimSubjectName: 'Dahili Su',
      }),
      true,
    );
  });

  it('konu istisnası yalnız yazılan konuyu bırakır', () => {
    assert.equal(
      hasarResponsibilityCoversSubject({
        coverageType: 'specific_subjects',
        coverageConfig: { ihbarSubjects: ['Yangın Hasarı'] },
        claimSubjectName: 'Dahili Su',
      }),
      false,
    );
    assert.equal(
      hasarResponsibilityCoversSubject({
        coverageType: 'specific_subjects',
        coverageConfig: { ihbarSubjects: ['Dahili Su'] },
        claimSubjectName: 'Dahili Su',
      }),
      true,
    );
  });
});
