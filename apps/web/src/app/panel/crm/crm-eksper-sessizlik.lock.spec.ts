/**
 * CRM eksper sessizliği ekran kilidi. Onay kuyruğu değil; otomatik mail yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/crm/crm-eksper-sessizlik.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const service = readFileSync(
  join(here, '../../../../../backend/src/modules/crm/crm.service.ts'),
  'utf8',
);

describe('CRM eksper sessizlik ekran kilidi', () => {
  it('sessiz ofis ve yeni bölge ayrı durur', () => {
    assert.match(page, /Sessiz Müşteri/);
    assert.match(page, /Yeni Bölge/);
    assert.match(page, /İstanbul/);
    assert.match(page, /evaluateExpertWork|expertWork/);
    assert.match(page, /\/crm\/relationships\/expert-work/);
    assert.match(page, /EXPERT_SILENCE_FOLLOW_UP_TITLE/);
    assert.match(page, /Yazı Hazırla/);
    assert.match(page, /Tanıtım Yazısı/);
    assert.match(page, /Tarih Bağla/);
    assert.match(page, /Ara/);
    assert.match(page, /data-testid="crm-geri"/);
    assert.match(page, /\/panel\/hasar-dosyalari/);
    assert.match(page, /aria-label="Geri"/);
  });

  it('hafıza otomatik mail atmaz', () => {
    const mapFn = service.slice(service.indexOf('async getExpertWorkMap'), service.indexOf('private reportApprovalDate'));
    assert.match(mapFn, /evaluateExpertWork/);
    assert.doesNotMatch(mapFn, /sendEmail/);
    assert.doesNotMatch(mapFn, /this\.sendEmail/);
  });

  it('Hasar listesinde dosya sorumlusu sessiz ofis şeridi durur', () => {
    const hasar = readFileSync(join(here, '../hasar-dosyalari/page.tsx'), 'utf8');
    const strip = readFileSync(join(here, '../../../components/crm/HasarSilentOfficeStrip.tsx'), 'utf8');
    assert.match(hasar, /HasarSilentOfficeStrip/);
    assert.match(hasar, /HasarSilentOwnerReport/);
    assert.match(hasar, /hasar-uyari-sirasi/);
    assert.match(hasar, /lg:grid-cols-2/);
    assert.match(strip, /hasar-sessiz-ofis-seridi/);
    assert.match(strip, /EXPERT_SILENCE_CRM_HREF/);
    assert.match(strip, /EXPERT_SILENCE_STRIP_TITLE/);
    assert.match(strip, /EXPERT_SILENCE_STRIP_CLICK/);
    assert.match(strip, /underline/);
    assert.match(strip, /aria-label="Kapat"/);
    assert.match(strip, /acil-siradaki-pulse/);
    assert.match(strip, /animate-ping/);
    assert.match(strip, /silence-warning\/dismiss/);
    assert.match(strip, /silence-warning\/opened/);
    assert.match(strip, /TrendingDown/);
    assert.match(strip, /EXPERT_SILENCE_STRIP_HINT/);
    assert.match(strip, /\/crm\/my-silent-offices/);
    assert.doesNotMatch(strip, /bg-brand-600/);
    assert.doesNotMatch(strip, /office\.name/);
    assert.doesNotMatch(strip, /Eksper Ofisi/);
    assert.doesNotMatch(strip, /Ekspertiz/);
    assert.doesNotMatch(strip, /Google/);
    assert.match(service, /getMySilentExpertOffices/);
    assert.match(service, /getSilenceActionReport/);
    assert.match(service, /recordSilenceWarningSignal/);
    assert.match(service, /assignedOfficeUserId/);
    assert.match(service, /canAct/);
    assert.match(service, /lane === 'silent'/);
    assert.doesNotMatch(service, /lane === 'silent' \|\| lane === 'open_file'/);
    assert.match(page, /EXPERT_OPEN_FILE_OWNER_LINE/);
    const shared = readFileSync(
      join(here, '../../../../../../packages/shared/src/crm-expert-silence.ts'),
      'utf8',
    );
    assert.match(shared, /EXPERT_SILENCE_DAYS = 2/);
    assert.match(shared, /Sessiz Müşteri Uyarı -> Tıklayınız|EXPERT_SILENCE_STRIP_TITLE/);
    assert.match(shared, /Dosya Akış Hızı Düşmüş/);
    assert.match(page, /firstSilentExpert/);
    assert.match(shared, /EXPERT_SILENCE_CRM_HREF/);
    assert.match(shared, /lane=silent/);
    assert.match(page, /Yeni Bölge · İstanbul/);
    assert.match(strip, /expertSilenceDismissStorageKey\(\)/);
    assert.match(page, /pickExpertSilenceAlternatives/);
    assert.match(page, /Alternatif · Yeni bölge/);
    assert.match(page, /bugünün alternatifleri/);
    assert.match(service, /expertSilenceFileStillMissing/);
    const monday = readFileSync(
      join(here, '../../../features/dashboard/components/admin/monday-meeting-notes.tsx'),
      'utf8',
    );
    assert.match(monday, /HasarSilentOwnerReport/);
  });
});
