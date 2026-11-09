/**
 * Dosya konusu: Ayarlar açılınca veya liste okununca varsayılan hasar nedeni geri yazılmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/departments/dosya-konusu-seed.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'departments.service.ts'), 'utf8');

describe('dosya konusu seed kilidi', () => {
  it('liste ve ayar sekmeleri boş hattı hazır konuyla doldurmaz', () => {
    assert.doesNotMatch(service, /ensureDefaultRepairFileSubjects/);
    const listStart = service.indexOf('async getFileSubjects');
    const listEnd = service.indexOf('async createFileSubject');
    assert.ok(listStart > 0 && listEnd > listStart);
    const list = service.slice(listStart, listEnd);
    assert.doesNotMatch(list, /DEFAULT_REPAIR_FILE_SUBJECTS/);
    const tabsStart = service.indexOf('async ensureKonuTabDepartments');
    assert.ok(tabsStart > 0);
    assert.doesNotMatch(service.slice(tabsStart), /DEFAULT_REPAIR_FILE_SUBJECTS/);
  });
});
