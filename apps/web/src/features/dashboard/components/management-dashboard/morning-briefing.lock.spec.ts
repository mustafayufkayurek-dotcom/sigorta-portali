/**
 * Yönetici sabah bakışı: mevcut panele, sıfır satır yok, yeni tema yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/features/dashboard/components/management-dashboard/morning-briefing.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildMorningBriefingItems,
  formatMorningBriefingCount,
  mapMorningBriefingClaimPreview,
  MORNING_BRIEFING_HREF,
} from './morning-briefing.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('yönetici sabah bakışı LOCK', () => {
  it('72 saat önizleme dosya satırını Hasar dosyasına bağlar', () => {
    const rows = mapMorningBriefingClaimPreview([
      {
        id: 'abc',
        fileNo: 'HS-1',
        insuredName: 'Ayşe Demir',
        operationStatusLabel: 'Onay Bekliyor',
        latestRepairReport: { id: 'rap-9' },
        customer: { shortName: 'Doğanlar', email: 'musteri@ornek.com' },
        insuranceCompany: { name: 'Test Sigorta', contactEmail: 'sigorta@ornek.com' },
        propertyAddress: { district: 'Kadıköy', city: 'İstanbul' },
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fileNo, 'HS-1');
    assert.equal(rows[0].insured, 'Ayşe Demir');
    assert.equal(rows[0].statusLabel, 'Onay Bekliyor');
    assert.equal(rows[0].reportId, 'rap-9');
    assert.equal(rows[0].party, 'Doğanlar');
    assert.equal(rows[0].place, 'Kadıköy · İstanbul');
    assert.equal(rows[0].customerEmail, 'musteri@ornek.com');
    assert.match(rows[0].href, /\/panel\/hasar-dosyalari\/abc/);
  });
  it('sıfır satırı basmaz; dolu satır mevcut sayfaya gider', () => {
    assert.deepEqual(buildMorningBriefingItems({}), []);
    assert.deepEqual(
      buildMorningBriefingItems({
        pendingIncomingCount: 0,
        totalPendingAmount: 0,
        approval72h: 0,
        attendanceNotApproved: 0,
        inboxUnowned: 0,
      }),
      [],
    );

    const items = buildMorningBriefingItems({
      pendingIncomingCount: 2,
      totalPendingAmount: 150000,
      approval72h: 3,
      attendanceNotApproved: 1,
      inboxUnowned: 4,
    });
    assert.equal(items.length, 4);
    assert.equal(items[0].href, MORNING_BRIEFING_HREF.tahsilat);
    assert.equal(items[1].href, MORNING_BRIEFING_HREF.onay72);
    assert.equal(items[2].href, MORNING_BRIEFING_HREF.puantaj);
    assert.equal(items[3].href, MORNING_BRIEFING_HREF.kutu);
    assert.equal(items[1].value, '3 Dosya');
    assert.equal(items[1].preview, 'onay72');
    assert.equal(items[2].value, '1 Kişi');
    assert.equal(items[3].value, '4 Yazı');
    assert.match(items[0].value, /2 İş/);
    assert.equal(formatMorningBriefingCount(5, 'Dosya'), '5 Dosya');
  });

  it('yönetim paneline şerit eklenir; dönem tuşu ve KPI kabuğu bozulmaz', () => {
    const dash = readFileSync(join(here, 'ManagementDashboard.tsx'), 'utf8');
    const strip = readFileSync(join(here, 'MgmtMorningBriefing.tsx'), 'utf8');
    const header = readFileSync(join(here, 'MgmtHeader.tsx'), 'utf8');
    const panel = readFileSync(join(here, '../../../../app/panel/page.tsx'), 'utf8');
    assert.match(dash, /<MgmtHeader/);
    assert.match(dash, /<MgmtMorningBriefing \/>/);
    assert.match(dash, /<MgmtKpiRow/);
    assert.match(dash, /useManagementDashboardData\(range, activePreset\)/);
    assert.doesNotMatch(dash, /<MgmtMorningBriefing[^>]*range/);
    assert.match(header, /PERIOD_LABELS\[preset\]/);
    assert.match(header, /'bugun'/);
    assert.match(strip, /yonetici-sabah-bakisi/);
    assert.match(strip, /OpsFirstRunNotice/);
    assert.match(strip, /OPS_NOTICE\.yoneticiSabahBakisi/);
    assert.match(strip, /MGMT/);
    assert.match(strip, /Bekleyen İş/);
    assert.match(strip, /\/claim-files\/operation-stats/);
    assert.match(strip, /\/hr\/attendance\/day-end-summary/);
    assert.match(strip, /useFinanceBottlenecks/);
    assert.match(strip, /useOperationInboxStats/);
    assert.match(strip, /MgmtMorningBriefingPreview/);
    assert.match(strip, /yonetici-sabah-bakisi-onay72/);
    const preview = readFileSync(join(here, 'MgmtMorningBriefingPreview.tsx'), 'utf8');
    assert.match(preview, /SlidePanel/);
    assert.match(preview, /opsPreset: 'approval_72h'/);
    assert.match(preview, /Tümünü Gör/);
    assert.match(preview, /MORNING_BRIEFING_HREF\.onay72/);
    assert.match(preview, /OperationRowActions/);
    assert.match(preview, /kind="hasar"/);
    assert.match(preview, /width=\{640\}/);
    assert.match(preview, /ExpertFileNoteModal/);
    assert.match(preview, /OperationSendEmailModal/);
    assert.match(preview, /row-actions:hasar-dosyalari-v1/);
    const helper = readFileSync(join(here, 'morning-briefing.ts'), 'utf8');
    assert.match(helper, /'Dosya'/);
    assert.doesNotMatch(helper, /\$\{h72\} dosya/);
    assert.doesNotMatch(strip, />Bugün</);
    assert.doesNotMatch(strip, /onSelectPreset/);
    assert.doesNotMatch(strip, /Google/);
    assert.doesNotMatch(strip, /\/dev\//);
    assert.match(panel, /ManagementDashboard/);
    assert.doesNotMatch(panel, /\/dev\/sabah/);
  });
});
