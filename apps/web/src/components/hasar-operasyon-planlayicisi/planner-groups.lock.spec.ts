/**
 * Planlayıcı Hasar Tespit / Onarım / Kapanış grupları.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/planner-groups.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLANNER_GROUPS, PLANNER_STEPS, PLANNER_VISIBLE_STEPS } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar planner groups lock', () => {
  it('dijital onay onarımın başında, muvafakat ayrı sayfa değil', () => {
    assert.equal(PLANNER_GROUPS.find((g) => g.id === 'onay')?.label, 'Hasar Tespit Aşaması');
    const onarim = PLANNER_VISIBLE_STEPS.filter((s) => s.group === 'onarim');
    assert.equal(onarim[0]?.id, 'digital_approval');
    assert.equal(onarim[1]?.id, 'repair_whatsapp');
    assert.equal(onarim[1]?.label, 'Onarım Planlama');
    assert.equal(onarim[2]?.label, 'Onarım Bitiş');
    assert.equal(PLANNER_STEPS.find((s) => s.id === 'muvafakat')?.hidden, true);
    assert.equal(PLANNER_STEPS.find((s) => s.id === 'whatsapp')?.hidden, true);
    assert.equal(PLANNER_VISIBLE_STEPS.find((s) => s.id === 'approved')?.label, 'Dosya Onaylandı');
    assert.ok(PLANNER_VISIBLE_STEPS.some((s) => s.id === 'docs_upload'));
    assert.equal(PLANNER_VISIBLE_STEPS.find((s) => s.id === 'file_close')?.label, 'Dosyayı Kapat');
    assert.equal(PLANNER_VISIBLE_STEPS.find((s) => s.id === 'file_close')?.group, 'kapanis');
    const stepsSrc = readFileSync(join(here, 'steps.tsx'), 'utf8');
    const card = readFileSync(join(here, 'HasarSalesInvoiceRequestCard.tsx'), 'utf8');
    assert.match(stepsSrc, /ön onaylı iş var mı/);
    assert.match(stepsSrc, /PRE_APPROVAL_DIGITAL_KIND/);
    assert.match(stepsSrc, /PlannerFileCostEntry/);
    const digitalSlice = stepsSrc.slice(
      stepsSrc.indexOf('function StepDigitalApproval'),
      stepsSrc.indexOf('function StepReportWriting'),
    );
    const closeSlice = stepsSrc.slice(stepsSrc.indexOf('function StepFileClose'));
    assert.doesNotMatch(digitalSlice, /PlannerFileCostEntry/);
    assert.match(digitalSlice, /Dijital Onay Sözleşmeleri/);
    assert.doesNotMatch(digitalSlice, /Tedarikçi Hakedişi/);
    assert.match(closeSlice, /PlannerFileCostEntry/);
    assert.match(closeSlice, /Dosya Kapanışı/);
    assert.match(closeSlice, /Tedarikçi Hakedişi/);
    assert.match(closeSlice, /Meridyen Operasyon Gideri/);
    assert.match(closeSlice, /Kapanış Kararı/);
    assert.match(closeSlice, /Fatura Edilecek İş/);
    assert.match(closeSlice, /Hizmet İptali/);
    assert.doesNotMatch(closeSlice, /title="Dosya kapanışı"/);
    assert.doesNotMatch(closeSlice, /title="Hizmet iptal"/);
    assert.doesNotMatch(closeSlice, /window\.location\.assign\(financeGider\)/);
    assert.match(stepsSrc, /PlannerVendorContractGuide/);
    assert.match(card, /Satış faturası talebi/);
    assert.match(card, /Finansa talep et/);
    assert.doesNotMatch(card, /Yeni Fatura/);
  });

  it('çekmece ve özet grupları basar, sıradaki işlem listesi yok', () => {
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    const steps = readFileSync(join(here, 'steps.tsx'), 'utf8');
    assert.match(panel, /hasar-planner-groups/);
    assert.match(panel, /onarima-cevir/);
    assert.match(panel, /border-2 border-orange-400/);
    assert.match(panel, /opacity-60/);
    assert.match(panel, /relative z-\[2\]/);
    assert.match(panel, /flex flex-col gap-2/);
    assert.doesNotMatch(panel, /uppercase tracking-wide/);
    assert.doesNotMatch(panel, /xl:grid-cols-8/);
    assert.doesNotMatch(panel, /sm:grid-cols-4/);
    assert.doesNotMatch(panel, /İlerleme Özeti/);
    assert.match(steps, /SpeechToText/);
    assert.doesNotMatch(steps, /Görüşme Notu/);
    assert.doesNotMatch(steps, /Tahmini Süre/);
    assert.doesNotMatch(steps, /Onaylayan Taraf Türü/);
  });

  it('Operasyon gövdesinde manuel yükleme formu yok; liste listOnly', () => {
    const collect = readFileSync(join(here, 'OperasyonEvrakToplamaPanel.tsx'), 'utf8');
    const stepsSrc = readFileSync(join(here, 'steps.tsx'), 'utf8');
    assert.match(collect, /Tespit Ve Onarım/);
    assert.match(collect, /listOnly/);
    assert.match(collect, /readOnly/);
    assert.doesNotMatch(collect, /Dosya Seç Ve Yükle/);
    assert.match(stepsSrc, /function StepDocsUpload/);
    assert.match(stepsSrc, /function StepFileClose/);
    assert.match(stepsSrc, /Kalan onarım yok/);
    assert.match(stepsSrc, /CLOSE_BILLABLE_QUESTION/);
    assert.match(stepsSrc, /grup=finans/);
    assert.match(stepsSrc, /Onarıma dön/);
    assert.match(stepsSrc, /hasar-ofis-dosya-kapat-seridi/);
    assert.match(stepsSrc, /ClaimManualDocumentsPanel/);
    assert.match(stepsSrc, /onUploaded/);
    assert.match(stepsSrc, /refreshClaim/);
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    assert.match(panel, /hasar-kapanis-butce-ozet/);
    const ctx = readFileSync(join(here, 'planner-context.tsx'), 'utf8');
    assert.match(ctx, /office-close/);
    assert.match(ctx, /office-cancel/);
    assert.match(ctx, /closeMissing/);
    assert.match(stepsSrc, /hasar-ofis-dosya-iptal/);
    assert.match(stepsSrc, /Dosyayı İptal Et/);
    assert.match(stepsSrc, /hasarCancelReasonOk\(reason\)/);
    assert.match(stepsSrc, /İptal nedeni \(zorunlu\)/);
  });

  it('tespitçi ataması zorunlu değildir; sıra kilitlemez', () => {
    const stepsSrc = readFileSync(join(here, 'steps.tsx'), 'utf8');
    const ctx = readFileSync(join(here, 'planner-context.tsx'), 'utf8');
    const rules = readFileSync(join(here, 'planner-live-rules.ts'), 'utf8');
    const mandatory = readFileSync(join(here, 'mandatory-fields.ts'), 'utf8');
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    assert.doesNotMatch(stepsSrc, /Kaydet için bir tespitçi atanmalıdır/);
    assert.doesNotMatch(stepsSrc, /Tespitçiye WhatsApp gönderimi zorunlu/);
    assert.match(stepsSrc, /Tespitçi zorunlu değil/);
    assert.match(ctx, /Tespitçi atanmadı\. Gerektiğinde dosya sorumlusu atayabilir/);
    assert.doesNotMatch(ctx, /Tespitçi seçiniz/);
    assert.match(mandatory, /case 'inspector':\s*return \[\];/);
    assert.match(rules, /id === 'inspector'/);
    assert.match(panel, /hasar-tespitci-opsiyonel-seridi/);
    assert.match(panel, /OPS_NOTICE\.hasarTespitciOpsiyonel/);
    assert.match(rules, /Tespitçi ataması zorunlu değil/);
  });
});
