'use client';

/**
 * Acil Operasyon Planlayıcısı — canlı mount (/panel/acil-yardim/[id]).
 * Sağ çekmece + 6 kare özet. Hasar OperasyonPlanlayiciPanel kabuğu ile aynı dil.
 */

import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  OPERATOR_STEPS,
  PlannerStepBody,
  type OperatorStepKey,
  type PlannerStepBodyProps,
} from './planner-steps';
import { validateOperatorStep, type ApprovalState } from './planner-gates';

const C = { active: '#F59E0B', done: '#16A34A', pending: '#CBD5E1' } as const;

export type AcilPlannerStepStatus = 'done' | 'waiting' | 'future';

type Props = {
  stepStatuses: Record<OperatorStepKey, AcilPlannerStepStatus>;
  body: PlannerStepBodyProps;
  /** Kaydet sonrası adım durumunu güncellemek için üst bileşen */
  onSaved?: (step: OperatorStepKey) => void | Promise<void>;
};

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

export function AcilOperasyonPlanlayiciPanel({ stepStatuses, body, onSaved }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<OperatorStepKey>('ihbar');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    <div className="relative" data-testid="operasyon-ozet">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operasyon Planlama Özeti</h2>
            <p className="text-xs text-slate-500">
              Operasyon Durumu: {doneCount} / {steps.length} Tamamlandı
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            data-testid="acil-planlayici-ac"
          >
            Operasyon Planlayıcısı
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {steps.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setActiveStep(s.key);
                setDrawerOpen(true);
              }}
              className={`rounded-xl border px-2 py-2.5 text-left ${
                drawerOpen && activeStep === s.key
                  ? 'border-orange-200 bg-orange-50/70 ring-2 ring-orange-400'
                  : s.status === 'done'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-[10px] font-semibold text-slate-500">{s.n}</p>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-800">{s.label}</p>
            </button>
          ))}
        </div>
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
                <h2 className="text-base font-bold text-slate-950">Operasyon Planlayıcısı</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Tedarikçi, maliyet, onay, kapanış ve finans bu panelde.
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
                className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-3 pl-2 pr-1.5"
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
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <PlannerStepBody {...body} step={activeStep} />
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
}
