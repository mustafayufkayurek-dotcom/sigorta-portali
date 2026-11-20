/**
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/components/hasar/approval-72h-owner-banner.lock.spec.ts
 *
 * Şerit yok: 72s dolunca panele / dosyaya girince doğrudan pencere.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileNoFromApproval72hBody } from './approval-72h-file-no.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('72s dosya sorumlusu pencere LOCK', () => {
  it('bildirim gövdesinden dosya no okur', () => {
    assert.equal(
      fileNoFromApproval72hBody(
        '2026 YE 1988/1 — Dosyanın onay süresi geçmiştir. Onay muhatabı ile lütfen iletişime geçin veya hatırlatma maili gönderilsin mi?',
      ),
      '2026 YE 1988/1',
    );
  });

  it('şerit yok; panel ve dosya penceresi dosya no ile açılır', () => {
    const layout = readFileSync(join(here, '../../app/panel/layout.tsx'), 'utf8');
    assert.match(layout, /Approval72hReminderDialog/);
    assert.match(layout, /approval_72h_exceeded/);
    assert.doesNotMatch(layout, /Approval72hOwnerBanner/);

    const listPage = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    assert.doesNotMatch(listPage, /Approval72hOwnerBanner/);

    const dialog = readFileSync(join(here, 'Approval72hReminderDialog.tsx'), 'utf8');
    assert.match(dialog, /buildApproval72hOwnerRelationNote/);
    assert.match(dialog, /approval-72h-relation-note/);
    assert.match(dialog, /Dosya No: \{shownFileNo\}/);
    assert.match(dialog, /h-3\.5 w-3\.5/);
    assert.match(dialog, /Onay Süresi Geçti/);

    const page = readFileSync(join(here, '../../app/panel/hasar-dosyalari/[id]/page.tsx'), 'utf8');
    assert.match(page, /approval72hExceeded/);
    assert.match(page, /fileNo=\{claim\.fileNo\}/);
  });
});
