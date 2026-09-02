/**
 * Hasar ofis dosyayı kapatır; saha field-close kapatmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/hasar-ofis-dosya-kapat.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar ofis dosya kapat LOCK', () => {
  it('office-close kapısı durur; saha Forbidden', () => {
    const ctrl = readFileSync(join(here, 'claim-files.controller.ts'), 'utf8');
    assert.match(ctrl, /:id\/office-close/);
    assert.match(ctrl, /officeClose/);
    assert.match(ctrl, /Ofis dosya kapanışı/);
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const start = src.indexOf('async officeClose');
    const end = src.indexOf('private async sendHasarFileClosureMails');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /isFieldStaffRole/);
    assert.match(fn, /Saha tespit dosyayı kapatamaz/);
    assert.match(fn, /code: 'closed'/);
    assert.match(fn, /this\.changeStatus/);
    assert.match(fn, /assertOfficeCloseReady/);
  });

  it('office-cancel açıklama ister; saha Forbidden', () => {
    const ctrl = readFileSync(join(here, 'claim-files.controller.ts'), 'utf8');
    assert.match(ctrl, /:id\/office-cancel/);
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const start = src.indexOf('async officeCancel');
    const end = src.indexOf('private async assertOfficeCloseReady');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /hasarCancelReasonOk/);
    assert.match(fn, /İptal için açıklama yazınız/);
    assert.match(fn, /code: 'cancelled'/);
    assert.match(fn, /isFieldStaffRole/);
  });

  it('saha closed durumuna geçemez', () => {
    const src = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const start = src.indexOf('async changeStatus');
    const end = src.indexOf('async officeClose');
    assert.ok(start >= 0 && end > start);
    const fn = src.slice(start, end);
    assert.match(fn, /toStatus\.isClosedState && isFieldStaffRole/);
    assert.match(fn, /officeClosing/);
    assert.match(fn, /officeCancelling/);
    assert.match(fn, /assertOfficeCloseReady/);
    assert.match(fn, /toStatus\.code === 'closed'/);
  });
});
