/**
 * Acil yeni ihbar mail konusu: poliçe / sigortalı / dosya no / dosya konusu.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/notifications/email/acil-yeni-ihbar-subject.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil yeni ihbar konu LOCK', () => {
  it('konu poliçe, sigortalı, dosya no ve dosya konusunu taşır; Hasar Yeni İhbar-ofis durur', () => {
    const template = readFileSync(join(here, 'email.template.ts'), 'utf8');
    const notify = readFileSync(
      join(here, '../../operation-inbox/operation-inbox-notification.service.ts'),
      'utf8',
    );
    const rows = readFileSync(
      join(here, '../../operation-inbox/inbox-ihbar-email.ts'),
      'utf8',
    );
    assert.match(template, /export function acilYeniIhbarSubject/);
    assert.match(template, /filter\(Boolean\)\.join\(' \/ '\)/);
    assert.match(template, /Yeni İhbar-\$\{shortName\}/);
    assert.match(notify, /acilYeniIhbarSubject/);
    assert.match(notify, /fileType === 'acil'/);
    assert.match(rows, /label: 'Poliçe No'/);
    assert.match(rows, /fileType === 'acil'/);
  });
});
