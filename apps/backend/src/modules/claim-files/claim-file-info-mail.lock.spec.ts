/**
 * Dosya bilgisi kaydı dosya sorumlusuna gider. Sorumlu değişince yeni sorumlu da mail alır.
 * Öncelik, dosya açılışında Hasar Konusu'nun altındadır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/claim-file-info-mail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function src(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('dosya bilgisi maili ve öncelik LOCK', () => {
  it('düzenleme kaydı dosya sorumlusuna mail açar', () => {
    const service = src('apps/backend/src/modules/claim-files/claim-files.service.ts');
    const modal = src('apps/web/src/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx');
    assert.match(service, /notifyFileOwner === true/);
    assert.match(service, /onClaimFileInfoUpdated/);
    assert.match(service, /forceNewOwner: ownerChanged/);
    assert.match(modal, /notifyFileOwner: true/);
    const mail = src('apps/backend/src/modules/notifications/email/claim-event-email.service.ts');
    assert.match(mail, /Dosya Bilgileri Güncellendi/);
  });

  it('öncelik dosya açılışında durur', () => {
    assert.match(src('apps/web/src/components/claim-files/ClaimNewForm.tsx'), /data-testid="yeni-dosya-oncelik"/);
    assert.match(src('apps/web/src/components/portal/InsuranceIhbarModal.tsx'), /data-testid="sigorta-ihbar-oncelik"/);
    assert.match(src('apps/web/src/components/claim-files/ClaimNewForm.tsx'), /Öncelik zorunludur/);
    assert.match(src('apps/web/src/app/panel/eksper-portal/page.tsx'), /data-testid="eksper-ihbar-oncelik"/);
    assert.match(src('apps/web/src/app/panel/eksper-portal/page.tsx'), /Öncelik zorunludur/);
    assert.match(src('apps/web/src/components/emergency/EmergencyCaseNewForm.tsx'), /Öncelik zorunludur/);
    assert.match(src('apps/web/src/components/emergency/EmergencyCaseNewForm.tsx'), /data-testid="acil-oncelik"/);
    assert.match(src('apps/web/src/components/emergency/EmergencyCaseNewForm.tsx'), /Öncelik/);
  });

  it('düzenleme kutusunda kanal durur, tahmini onarım bitişi yoktur', () => {
    const modal = src('apps/web/src/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx');
    assert.doesNotMatch(modal, /Tahmini Onarım Bitiş/);
    assert.doesNotMatch(modal, /estimatedRepairEndAt/);
    assert.match(modal, /data-testid="duzenle-sigorta-sirketi"/);
    assert.match(modal, /data-testid="duzenle-broker"/);
    assert.match(modal, /data-testid="duzenle-acente"/);
    assert.match(modal, /channelBrokerCustomerId: channelBrokerCustomerId \|\| null/);
    const service = src('apps/backend/src/modules/claim-files/claim-files.service.ts');
    assert.match(service, /Sigorta şirketi zorunludur/);
  });
});
