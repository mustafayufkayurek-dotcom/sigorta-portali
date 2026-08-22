'use client';

/**
 * Acil Operasyon Planlayıcısı — canlı mount (/panel/acil-yardim/[id]).
 * Sağ çekmece + özet kareler. Yerleşim Hasar özetine yakın; başlık/içerik Acil’e özgü.
 */

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BadgeCheck,
  Check,
  ClipboardCheck,
  Landmark,
  PhoneCall,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  OPERATOR_STEPS,
  PlannerStepBody,
  type OperatorStepKey,
  type PlannerStepBodyProps,
} from './planner-steps';
import { validateOperatorStep, type ApprovalState } from './planner-gates';
import { formatTryAmount, parseTrAmount } from '@/utils/format-try-amount';

const C = { active: '#F59E0B', done: '#16A34A', pending: '#CBD5E1' } as const;

export type AcilPlannerStepStatus = 'done' | 'waiting' | 'future';

export type AcilOperasyonPlanlayiciHandle = {
  openStep: (step: OperatorStepKey) => void;
};

type Props = {
  stepStatuses: Record<OperatorStepKey, AcilPlannerStepStatus>;
  body: PlannerStepBodyProps;
  /** Kaydet sonrası adım durumunu güncellemek için üst bileşen */
  onSaved?: (step: OperatorStepKey) => void | Promise<void>;
  /** Canlı: kayıtlı tedarikçi listesi (RecommendedVendorsTabs) bu adımda */
  vendorStep?: ReactNode;
  /** Canlı: dijital onaylı evrak onay adımında */
  approvalStep?: ReactNode;
  /** Canlı: sigortalı haber + işe başlama */
  operationStep?: ReactNode;
  /** Canlı: kapanış fotoğrafları bu adımda */
  closingStep?: ReactNode;
};

const STEP_ICONS: Record<OperatorStepKey, LucideIcon> = {
  ihbar: PhoneCall,
  tedarikci_maliyet: Wrench,
  onay: BadgeCheck,
  kapanis: ClipboardCheck,
  finans: Landmark,
};

function stepIconTone(status: AcilPlannerStepStatus, active: boolean) {
  if (active) return { wrap: 'bg-orange-100 text-orange-700', icon: 'text-orange-700' };
  if (status === 'done') return { wrap: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-700' };
  if (status === 'waiting') return { wrap: 'bg-amber-100 text-amber-700', icon: 'text-amber-700' };
  return { wrap: 'bg-slate-100 text-slate-500', icon: 'text-slate-500' };
}

function StepGlyph({
  step,
  status,
  active,
}: {
  step: OperatorStepKey;
  status: AcilPlannerStepStatus;
  active?: boolean;
}) {
  const Icon = STEP_ICONS[step];
  const tone = stepIconTone(status, Boolean(active));
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.wrap}`} aria-hidden>
      <Icon className={`h-5 w-5 ${tone.icon}`} strokeWidth={2} />
    </span>
  );
}

function statusTone(status: AcilPlannerStepStatus, active: boolean) {
  if (active) return 'ring-2 ring-orange-400 border-orange-200 bg-orange-50/70';
  if (status === 'done') return 'border-emerald-200 bg-emerald-50/40';
  if (status === 'waiting') return 'border-amber-200 bg-amber-50/40';
  return 'border-slate-200 bg-white';
}

function statusLabel(status: AcilPlannerStepStatus, active: boolean) {
  if (status === 'done') return 'Tamamlandı';
  if (active || status === 'waiting') return 'İşlem Bekliyor';
  return 'Bekliyor';
}

function FlowStepDot({
  status,
  active,
  n,
}: {
  status: AcilPlannerStepStatus;
  active: boolean;
  n: number;
}) {
  if (status === 'done' && !active) {
    return (
      <span
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{ backgroundColor: C.done }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (active || status === 'waiting') {
    return (
      <span
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-4 ring-orange-200"
        style={{ backgroundColor: C.active }}
      >
        {n}
      </span>
    );
  }
  return (
    <span
      className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
      style={{ backgroundColor: '#94A3B8' }}
    >
      {n}
    </span>
  );
}

function approvalLabel(state: ApprovalState): string {
  if (state === 'onaylandi') return 'Onaylandı';
  if (state === 'reddedildi') return 'Reddedildi';
  return 'Onay bekleniyor';
}

function stepResultLine(key: OperatorStepKey, body: PlannerStepBodyProps): string {
  if (key === 'ihbar') return body.file.insured || body.file.fileNo || 'Kayıt alındı';
  if (key === 'tedarikci_maliyet') {
    if (!body.assignedVendor && !body.assigned) return 'Atanmadı';
    const name = body.assignedVendor?.name || 'Atandı';
    const alis = parseTrAmount(body.alis);
    const satis = parseTrAmount(body.satis);
    if (alis != null && satis != null && alis > 0 && satis > 0) {
      return `${name} · ${formatTryAmount(alis, { fractionDigits: 0 })}`;
    }
    return `${name} · tutar yok`;
  }
  if (key === 'onay') {
    if (body.approvalState === 'onaylandi') return 'Onaylandı, işte';
    return approvalLabel(body.approvalState as ApprovalState);
  }
  if (key === 'kapanis') {
    if (body.fileClosed) return 'Dosya kapandı';
    if (body.workStartOk) return 'İş bitti, kapanış yok';
    return 'Kapanış yok';
  }
  if (body.financeSent) return body.hakedisAt ? `Aktarıldı · ${body.hakedisAt}` : 'Finansa aktarıldı';
  if (body.fileClosed) return 'Aktarım bekliyor';
  return 'Finans bekliyor';
}

export const AcilOperasyonPlanlayiciPanel = forwardRef<AcilOperasyonPlanlayiciHandle, Props>(
  function AcilOperasyonPlanlayiciPanel({ stepStatuses, body, onSaved, vendorStep, approvalStep, operationStep, closingStep }, ref) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeStep, setActiveStep] = useState<OperatorStepKey>('ihbar');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useImperativeHandle(ref, () => ({
      openStep: (step: OperatorStepKey) => {
        setActiveStep(step);
        setDrawerOpen(true);
        setSaveError(null);
      },
    }));

    const steps = useMemo(
      () =>
        OPERATOR_STEPS.map((s, i) => ({
          ...s,
          n: i + 1,
          status: stepStatuses[s.key] ?? 'future',
        })),
      [stepStatuses],
    );

    const activeMeta = steps.find((s) => s.key === activeStep) ?? steps[0];
    const doneCount = steps.filter((s) => s.status === 'done').length;
    const nextStep = steps.find((s) => s.status === 'waiting') ?? steps.find((s) => s.status === 'future');
    const nextJob = body.financeSent
      ? {
          title: 'Operasyon tamam',
          detail: body.hakedisAt
            ? `Hakediş verildi · ${body.hakedisAt}. Vade uygulanmaz.`
            : 'Finansa aktarım kaydı oluştu.',
          step: 'finans' as OperatorStepKey,
          cta: 'Finans adımını aç',
        }
      : nextStep
        ? {
            title: `Sıradaki iş · ${nextStep.label}`,
            detail:
              nextStep.key === 'tedarikci_maliyet' && !body.assignedVendor && !body.assigned
                ? 'Önce tedarikçiyi atayın.'
                : nextStep.hint,
            step: nextStep.key,
            cta: `${nextStep.label} adımını aç`,
          }
        : {
            title: 'Operasyon tamam',
            detail: 'Bu dosyada sıradaki operasyon işi yok.',
            step: 'finans' as OperatorStepKey,
            cta: 'Özeti aç',
          };

    async function saveCurrentStep() {
      setSaveError(null);
      const gate = validateOperatorStep(activeStep, {
        assigned: body.assigned,
        alis: body.alis,
        satis: body.satis,
        workStartOk: body.workStartOk,
        fileClosed: body.fileClosed,
        financeSent: body.financeSent,
        approvalState: body.approvalState as ApprovalState,
        approvalText: body.approvalText,
        digitalDocsOk: body.digitalDocsOk,
        vendorPaid: body.vendorPaid,
      });
      if (gate) {
        setSaveError(gate);
        return;
      }
      setSaving(true);
      try {
        await onSaved?.(activeStep);
        setSaveError(null);
      } catch (err: unknown) {
        setSaveError((err as Error)?.message || 'Kaydedilemedi.');
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="relative space-y-3" data-testid="operasyon-ozet">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Operasyon özeti</h2>
              <p className="text-xs text-slate-500">
                Operasyon Durumu: {doneCount} / {steps.length} Tamamlandı
              </p>
            </div>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {steps.map((s) => {
              const active = drawerOpen && activeStep === s.key;
              const isNext = !body.financeSent && s.key === nextJob.step;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setActiveStep(s.key);
                    setDrawerOpen(true);
                  }}
                  className={`rounded-xl border px-2.5 py-3 text-left transition ${statusTone(s.status, active)}${
                    isNext ? ' acil-siradaki-pulse border-amber-400' : ''
                  }`}
                  data-testid={`acil-ozet-adim-${s.key}`}
                  data-next={isNext ? '1' : '0'}
                >
                  <div className="flex items-start justify-between gap-2">
                    <StepGlyph step={s.key} status={s.status} active={active} />
                    <span className="text-[10px] font-semibold tabular-nums text-slate-400">{s.n}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-slate-800">{s.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-600">{stepResultLine(s.key, body)}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{statusLabel(s.status, active)}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${
            body.financeSent
              ? 'border-slate-200'
              : 'acil-siradaki-pulse border-amber-400'
          }`}
          data-testid="acil-siradaki-is"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sıradaki iş</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{nextJob.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{nextJob.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveStep(nextJob.step);
              setDrawerOpen(true);
            }}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            data-testid="acil-planlayici-ac"
          >
            {body.financeSent ? nextJob.cta : doneCount === 0 ? 'Operasyonu Başlat' : nextJob.cta}
          </button>
        </div>

        {drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Kapat"
              className="fixed inset-0 z-40 bg-slate-900/30"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-2xl"
              data-testid="acil-planlayici-cekmece"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950">Operasyonu Başlat</h2>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Tedarikçi, maliyet, onay talep akışı, kapanış ve finans bu panelde.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1">
                <nav
                  className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-3 pl-2 pr-1.5"
                  aria-label="Operasyon Akışı"
                >
                  <ol className="relative flex flex-col gap-0.5">
                    {steps.map((s, idx) => {
                      const active = activeStep === s.key;
                      const done = s.status === 'done';
                      return (
                        <li key={s.key} className="relative">
                          {idx < steps.length - 1 ? (
                            <span
                              className="pointer-events-none absolute left-[18px] top-8 h-[calc(100%-8px)] w-0.5"
                              style={{ backgroundColor: done && !active ? C.done : C.pending }}
                              aria-hidden
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStep(s.key);
                              setSaveError(null);
                            }}
                            className={`relative flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left ${
                              active ? 'bg-orange-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <FlowStepDot status={s.status} active={active} n={s.n} />
                            <span className="min-w-0 pt-0.5">
                              <span
                                className={`block text-[12px] font-semibold leading-snug ${
                                  active ? 'text-slate-950' : 'text-slate-700'
                                }`}
                              >
                                {s.label}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">{s.hint}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {activeMeta.n}. {activeMeta.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{activeMeta.hint}</p>
                    {activeStep === 'tedarikci_maliyet' && !body.assignedVendor && !body.assigned ? (
                      <p
                        className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800"
                        data-testid="acil-once-tedarikci"
                      >
                        Önce tedarikçiyi atayın.
                      </p>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    {activeStep === 'tedarikci_maliyet' && vendorStep ? (
                      <div className="space-y-3">
                        {vendorStep}
                        <PlannerStepBody {...body} step={activeStep} skipVendorPicker />
                      </div>
                    ) : activeStep === 'onay' && approvalStep ? (
                      <div className="space-y-3">
                        <PlannerStepBody {...body} step={activeStep} />
                        {approvalStep}
                      </div>
                    ) : activeStep === 'kapanis' && closingStep ? (
                      <div className="space-y-3">
                        {closingStep}
                        <PlannerStepBody {...body} step={activeStep} />
                      </div>
                    ) : (
                      <PlannerStepBody {...body} step={activeStep} />
                    )}
                  </div>
                  <div className="shrink-0 border-t border-slate-200 px-4 py-3">
                    {saveError ? (
                      <p className="mb-2 text-[11px] text-amber-800" data-testid="planlayici-kaydet-hata">
                        {saveError}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setDrawerOpen(false)}
                        data-testid="planlayici-iptal"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        onClick={() => void saveCurrentStep()}
                        disabled={saving}
                        data-testid="planlayici-kaydet"
                      >
                        {saving ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </div>
    );
  },
);
