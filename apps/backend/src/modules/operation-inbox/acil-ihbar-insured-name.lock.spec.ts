/**
 * Acil yeni ihbar maili sigortalı adını dosya kişi alanından alır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/acil-ihbar-insured-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil ihbar sigortalı adı LOCK', () => {
  it('bildirim Acil müşteri unvanını sigortalı satırına basmaz', () => {
    const src = readFileSync(join(here, 'operation-inbox-notification.service.ts'), 'utf8');
    assert.match(src, /resolveAcilInsuredName/);
    assert.match(src, /personField:\s*acil\?\.customerName/);
    assert.doesNotMatch(
      src,
      /acil\?\.customer\?\.companyName \|\| acil\?\.customer\?\.fullName \|\| acil\?\.customerName/,
    );
  });

  it('heuristik Sigortalı Adı Soyadı etiketini okur', () => {
    const src = readFileSync(join(here, 'inbound-heuristic-parser.ts'), 'utf8');
    assert.match(src, /INBOUND_INSURED_NAME_FIELD_LABELS/);
  });

  it('liste ve kapanış maili aynı kuralı kullanır', () => {
    const ops = readFileSync(
      join(here, '../../../../web/src/app/panel/operasyon/page.tsx'),
      'utf8',
    );
    const closure = readFileSync(
      join(here, '../emergency/emergency-cases.service.ts'),
      'utf8',
    );
    assert.match(ops, /resolveAcilInsuredName/);
    assert.match(closure, /resolveAcilInsuredName/);
    assert.doesNotMatch(
      closure,
      /emergencyCase\.customer\?\.fullName\s*\|\|/,
    );
  });

  it('gelen kutudan Acil açınca dosya sorumlusu işlemi yapandır; öneri sessiz yazılmaz', () => {
    const openFile = readFileSync(join(here, 'operation-inbox.service.ts'), 'utf8');
    assert.match(openFile, /resolveAcilInboxFileOwnerId/);
    const start = openFile.indexOf('async openEmergencyFile');
    const end = openFile.indexOf('private async assertAssigneeCoversAssistantCustomer', start);
    assert.ok(start >= 0 && end > start);
    const body = openFile.slice(start, end);
    assert.match(body, /resolveAcilInboxFileOwnerId/);
    assert.doesNotMatch(body, /suggestedAssigneeId/);
    assert.doesNotMatch(body, /message\.assignedUserId \?\?/);
  });

  it('Acil açma kutusunda sigortalı Mevcut Müşteri diye dosya sorumlusu gibi durmaz', () => {
    const modal = readFileSync(
      join(here, '../../../../web/src/components/operation-inbox/InboxOpenFileModal.tsx'),
      'utf8',
    );
    assert.doesNotMatch(modal, /kind === 'emergency'[\s\S]{0,400}Mevcut Müşteri/);
    assert.match(modal, /isPlaceholderOfficeUserName/);
  });

  it('sınıflandırma sigortalı adını dosya sorumlusu yapmaz', () => {
    const prompt = readFileSync(join(here, 'prompts/inbound-classification.prompt.ts'), 'utf8');
    assert.match(prompt, /customerName = sigortalı kişinin adı soyadı/);
  });

  it('Acil gelen kutu önerilen sorumluyu Test Kullanıcıya basmaz', () => {
    const routing = readFileSync(join(here, 'inbound-routing.service.ts'), 'utf8');
    assert.match(routing, /isPlaceholderOfficeUser/);
    const inboxPage = readFileSync(
      join(here, '../../../../web/src/app/panel/operasyon/gelen-kutusu/page.tsx'),
      'utf8',
    );
    assert.match(inboxPage, /kind === 'emergency' \? 'actor'/);
    assert.match(inboxPage, /readStoredUserId/);
  });
});
