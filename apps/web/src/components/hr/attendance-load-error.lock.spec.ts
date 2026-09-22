/**
 * Puantaj: hata ile boş ay karışmaz; yüklemede takvim tuşu silinmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hr/attendance-load-error.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../../app/panel/personel-ozluk/page.tsx'), 'utf8');
const calendar = readFileSync(join(here, 'AttendanceCalendar.tsx'), 'utf8');

describe('puantaj yükleme ve hata LOCK', () => {
  it('bağlantı hatası boş ay mesajı değildir', () => {
    assert.match(page, /attendanceError \?/);
    assert.match(page, /Bağlantı hatası oluştu, lütfen tekrar deneyin/);
    assert.match(page, /Tekrar Dene/);
    assert.match(page, /Bu ay için devam kaydı yok/);
    assert.doesNotMatch(
      page,
      /attendanceError \|\| \(attendance\?\.days \?\? \[\]\)\.length === 0/,
    );
  });

  it('yüklemede takvim ızgarası ve onay şeridi durur', () => {
    assert.match(page, /waiting/);
    assert.match(page, /busy=\{attendanceFetching/);
    assert.match(calendar, /puantaj-onay-yukleme/);
    assert.match(calendar, /if \(waiting\)/);
  });
});
