import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  expectedDigitalApprovalCount,
  filePreApprovalItemChoices,
  isDigitalApprovalBundleReady,
  parseHasPreApprovalWork,
  parsePreApprovalJobs,
  PRE_APPROVAL_DIGITAL_KIND,
  claimFilePlaceLabel,
  repairCompletedMailCopy,
  PRE_APPROVAL_OTHER_JOB_ID,
  preApprovalApprovalLines,
  preApprovalJobsSelectionOk,
  preApprovalOtherTextOk,
} from './claim-pre-approval.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim pre-approval lock', () => {
  it('Hayır tek dijital onay; Evet ve iş seçilince iki onay gerekir', () => {
    assert.equal(parseHasPreApprovalWork(null), null);
    assert.equal(parseHasPreApprovalWork(false), false);
    assert.equal(parseHasPreApprovalWork(true), true);
    const jobs = parsePreApprovalJobs('[{"id":"wg1","name":"Söküm"}]');
    assert.equal(expectedDigitalApprovalCount(false, []), 1);
    assert.equal(expectedDigitalApprovalCount(true, jobs), 2);
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: true,
        preApproved: false,
      }),
      false,
    );
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: true,
        preApproved: true,
      }),
      true,
    );
    assert.equal(PRE_APPROVAL_DIGITAL_KIND, 'muvafakatname_on_is');
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: false,
        preApproved: false,
        insuredName: 'Ali Rıza Özcan',
      }),
      true,
    );
    assert.equal(expectedDigitalApprovalCount(true, jobs, '  ALİ RIZA ÖZCAN '), 0);
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: true,
        preApproved: false,
        insuredName: 'Mehmet Yılmaz',
      }),
      false,
    );
    assert.deepEqual(
      filePreApprovalItemChoices([
        { id: 'i1', jobDescription: 'Tavan sıva tamiri' },
        { id: 'i1', jobDescription: 'Tavan sıva tamiri' },
        { id: PRE_APPROVAL_OTHER_JOB_ID, jobDescription: 'Atlanır' },
      ]),
      [{ id: 'i1', name: 'Tavan sıva tamiri' }],
    );
    assert.equal(preApprovalJobsSelectionOk(true, []), false);
    assert.equal(
      preApprovalOtherTextOk([{ id: PRE_APPROVAL_OTHER_JOB_ID, name: '' }]),
      false,
    );
    assert.equal(
      preApprovalApprovalLines([
        { id: 'a', name: 'Duvar Onarımı Ve Boya' },
        { id: 'b', name: '  duvar onarımı ve boya  ' },
        { id: 'c', name: '' },
      ]).length,
      1,
    );
    const muvafakat = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/muvafakatname.template.ts'),
      'utf8',
    );
    assert.match(muvafakat, /belge_baslik/);
    assert.match(muvafakat, /on_is_bolumu/);
    assert.match(muvafakat, /İbraname ve Onarım Tutanağı/);
    const documents = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/file-documents.service.ts'),
      'utf8',
    );
    assert.match(documents, /MUVAFAKATNAME_TEMPLATE/);
    assert.match(documents, /preApprovalApprovalLines/);
    assert.match(documents, /Ön Onaylı İşler/);
    assert.match(documents, /Muvafakat Formu/);
    assert.match(documents, /Mutabakat \/ Muvafakat Onay Formu/);
    assert.match(documents, /refreshUnapprovedPreApproval/);
    assert.doesNotMatch(documents, /ON_IS_ONAY_TEMPLATE/);
    const evrak = readFileSync(
      join(here, '../../../apps/web/src/app/evrak/[token]/page.tsx'),
      'utf8',
    );
    assert.match(evrak, /muvafakatname_on_is/);
    assert.match(evrak, /Ön Onaylı İşler Muvafakat Formu/);
    assert.equal(
      preApprovalJobsSelectionOk(true, [{ id: PRE_APPROVAL_OTHER_JOB_ID, name: 'Enkaz kaldırma' }]),
      true,
    );
    assert.equal(
      expectedDigitalApprovalCount(true, [{ id: PRE_APPROVAL_OTHER_JOB_ID, name: '' }]),
      1,
    );
  });

  it('planlayıcı ön onay sorusu ve ikinci dijital belge durur', () => {
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    assert.match(steps, /ön onaylı iş var mı/);
    assert.match(steps, /PRE_APPROVAL_DIGITAL_KIND/);
    assert.match(steps, /muvafakatname_on_is|PRE_APPROVAL_DIGITAL_KIND/);
    assert.match(steps, /isHasarDigitalApprovalRelaxed/);
    assert.match(steps, /Sigortalıdan dijital onay istenmez/);
    assert.match(steps, /hasar-on-onay-diger/);
    assert.match(steps, /Örn\. enkaz kaldırma/);
    assert.match(steps, /toTitleCaseTR/);
    assert.match(steps, /Tedarikçi Hakedişi/);
    assert.match(steps, /Meridyen Operasyon Gideri/);
    assert.match(steps, /Kapanış Kararı/);
    assert.match(steps, /PlannerFileCostEntry/);
    assert.doesNotMatch(steps, /hasar-yonetim-gideri-yolu/);
    assert.doesNotMatch(steps, /sabit-giderler/);
    assert.doesNotMatch(steps, /gider-butce#meridyen-operasyon-gideri/);
    const costEntry = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/PlannerFileCostEntry.tsx'),
      'utf8',
    );
    assert.match(costEntry, /ClaimFileExpenseFormPanel/);
    assert.match(costEntry, /HasarFileHakedisPanel/);
    assert.match(costEntry, /hasar-meridyen-operasyon-gideri-yolu/);
    assert.match(costEntry, /Yeni Masraf Ekle/);
    assert.match(costEntry, /allowExtraWorkPlan=\{true\}/);
    const hakedis = readFileSync(
      join(here, '../../../apps/web/src/components/finance/HasarFileHakedisPanel.tsx'),
      'utf8',
    );
    assert.match(hakedis, /compact/);
    assert.match(hakedis, /hasar-on-onay-hakedis-yolu/);
    assert.match(steps, /hasar-asil-onarim-onay-pasif/);
    assert.match(steps, /Ön iş onayı gelince açılır/);
    const dto = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/dto/file-documents.dto.ts'),
      'utf8',
    );
    assert.match(dto, /muvafakatname_on_is/);
    assert.match(steps, /Dijital Onay Sözleşmeleri/);
    assert.match(steps, /Mutabakat ve muvafakat bu adımda istenir/);
    assert.match(steps, /Örn\. enkaz kaldırma/);
    assert.match(steps, /repair-reports\/\$\{reportId\}/);
    assert.doesNotMatch(steps, /get\(`\$\{API\}\/work-groups`/);
    assert.doesNotMatch(steps, /Bu dosyada tek dijital onay yeter/);
    const mandatory = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/mandatory-fields.ts'),
      'utf8',
    );
    assert.match(mandatory, /isHasarDigitalApprovalRelaxed/);
    const center = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-operation-center.service.ts'),
      'utf8',
    );
    assert.match(center, /isHasarDigitalApprovalRelaxed\(claim\.insuredName\)/);
    assert.match(center, /parseHasPreApprovalWork\(claim\.hasPreApprovalWork\)/);
    assert.match(center, /hasPreApprovalWork,/);
  });

  it('ön onaylı bitiş maili Onarım Tamamlandı yazmaz; sigortalı ve ilçe · il durur', () => {
    assert.equal(claimFilePlaceLabel('İstanbul', 'Üsküdar'), 'Üsküdar · İstanbul');
    assert.equal(claimFilePlaceLabel(null, null), '—');
    const pre = repairCompletedMailCopy({ fileNo: '353853', hasPreApprovalWork: true });
    assert.equal(pre.title, 'Ön Onaylı İş Tamamlandı');
    assert.match(pre.subject, /Ön onaylı iş bitti/);
    assert.doesNotMatch(pre.title, /Onarım Tamamlandı/);
    const full = repairCompletedMailCopy({ fileNo: '353853', hasPreApprovalWork: false });
    assert.equal(full.title, 'Onarım Tamamlandı');
    const email = readFileSync(
      join(here, '../../../apps/backend/src/modules/notifications/email/claim-event-email.service.ts'),
      'utf8',
    );
    assert.match(email, /repairCompletedMailCopy/);
    assert.match(email, /claimFilePlaceLabel/);
    assert.match(email, /\{ label: 'Sigortalı'/);
    assert.match(email, /\{ label: 'İl \/ İlçe'/);
    assert.doesNotMatch(email, /title: 'Onarım Tamamlandı'/);
  });
});
