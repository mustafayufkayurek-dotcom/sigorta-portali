/**
 * Hasar nedeni listesi başka hattın konularını almaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/damage-reason-options.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'damage-reason-options.ts'), 'utf8');

describe('hasar nedeni listesi kilidi', () => {
  it('seçilen hattın konusu başka departmandan tamamlanmaz', () => {
    const start = src.indexOf('export async function resolveDamageReasonOptions');
    const end = src.indexOf('export async function fetchDepartmentFileSubjectNames');
    assert.ok(start > 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /return fetchActiveFileSubjects\(departmentId\)/);
    assert.doesNotMatch(fn, /hasar-onarim/);
    assert.match(src, /matchDepartmentForFileSubjects/);
    assert.match(src, /subjectNamesForCode/);
    const fetchStart = src.indexOf('export async function fetchDepartmentFileSubjectNames');
    const fetchEnd = src.indexOf('export async function fetchInboxFileSubjectNames');
    const fetchFn = src.slice(fetchStart, fetchEnd);
    assert.match(fetchFn, /hasar-tespit/);
    assert.match(fetchFn, /hasar-onarim/);
    assert.doesNotMatch(fetchFn, /claim-subjects/);
  });
});
