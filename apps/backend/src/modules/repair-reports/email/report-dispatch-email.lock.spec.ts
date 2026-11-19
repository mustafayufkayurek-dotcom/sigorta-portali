/**
 * Onarım raporu teslim maili — teal kart, operasyon mavisi yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/email/report-dispatch-email.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'report-dispatch-email.template.ts'), 'utf8');
const service = readFileSync(join(here, 'report-email.service.ts'), 'utf8');

describe('onarım raporu teslim maili LOCK', () => {
  it('referans kart + teal; düz cümle ve operasyon mavisi yok', () => {
    assert.match(src, /Rapor Bildirimi/);
    assert.match(src, /Dosya Değerlendirmeniz Bekleniyor/);
    assert.match(src, /Hasar Onarım Ve Restorasyon Departmanı/);
    assert.match(src, /Sayın Eksperimiz/);
    assert.match(src, /Hasar Onarım Raporu/);
    assert.match(src, /CLAIM_APPROVAL_TESPIT_BODY/);
    assert.match(src, /claimApprovalGreeting/);
    assert.match(src, /recipientSurname/);
    assert.match(src, /E-posta Ekinde Sunulmuştur/);
    assert.match(src, /Dosyayı İncele Ve Değerlendir/);
    assert.match(src, /Sigorta Şirketi/);
    assert.match(src, /Hasar Konusu/);
    assert.match(src, /Dosya Sorumlusu/);
    assert.match(src, /Operasyon Bölgesi/);
    assert.match(src, /meridyen-logo\.jpg/);
    assert.doesNotMatch(src, /Maliyet veya kâr/);
    assert.doesNotMatch(src, /kâr sütunu/);
    assert.doesNotMatch(src, /#1E5AA8/);
    assert.doesNotMatch(src, /#C2410C/);
    assert.doesNotMatch(src, /Operasyon Bildirimi/);
    assert.match(service, /buildReportDispatchEmailHtml/);
    assert.match(service, /insuranceCompanyName/);
    assert.match(service, /fileSubject/);
    assert.match(service, /recipientSurname/);
    const reports = readFileSync(join(here, '../repair-reports.service.ts'), 'utf8');
    assert.equal(
      (reports.match(/insuranceCompanyName: report\.claimFile\?\.insuranceCompany\?\.name,/g) ?? []).length,
      2,
    );
    assert.equal((reports.match(/fileSubject:/g) ?? []).length, 2);
    assert.match(reports, /claimFileSubjectName/);
    assert.equal(
      (reports.match(/fileSubject: claimFileSubjectName\(report\.claimFile\)/g) ?? []).length,
      2,
      'Rapor maili Dosya Konusu yalnız claimSubject ile kesilmez',
    );
    assert.doesNotMatch(
      reports,
      /fileSubject: report\.claimFile\?\.claimSubject\?\.name/,
    );
    assert.match(reports, /departmentFileSubject: \{ select: \{[^}]*name: true/);
    assert.doesNotMatch(service, /Hasar Onarım Raporu \(\$\{opts\.reportNo\}\) ektedir/);
  });
});

