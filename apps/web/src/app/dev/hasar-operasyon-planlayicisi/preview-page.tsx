'use client';

/**
 * Hasar Operasyon Planlayıcısı — lokal UX önizleme
 * Production’da notFound. Canlı mount: /panel/hasar-dosyalari/[id]?grup=operasyon
 */

import { notFound } from 'next/navigation';
import { useState } from 'react';
import { X } from 'lucide-react';
import { PLANNER_STEPS, type StepId } from '@/components/hasar-operasyon-planlayicisi/types';
import { renderStepContent } from '@/components/hasar-operasyon-planlayicisi/steps';
import {
  PlannerProvider,
  usePlanner,
} from '@/components/hasar-operasyon-planlayicisi/planner-context';
import { previewSnapshot } from '@/components/hasar-operasyon-planlayicisi/claim-snapshot';

export default function HasarOperasyonPlanlayicisiPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <PlannerProvider mode="preview" canEdit initialClaim={previewSnapshot()}>
      <PreviewShell />
    </PlannerProvider>
  );
}

function PreviewShell() {
  const { claim, saveStep, saving } = usePlanner();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeStep, setActiveStep] = useState<StepId>('supplier');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const activeMeta = PLANNER_STEPS.find((s) => s.id === activeStep) ?? PLANNER_STEPS[2];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
        Lokal Önizleme · Production Route Bağlı Değil · Canlı:{' '}
        <span className="font-semibold">/panel/hasar-dosyalari/[id]?grup=operasyon</span>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">Hasar Dosyaları › {claim.fileNo}</p>
              <h1 className="text-lg font-bold text-slate-900">{claim.fileNo}</h1>
              <p className="text-sm text-slate-600">
                {claim.insuredName} · {claim.lossType}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Operasyon Planlayıcısı
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {PLANNER_STEPS.map((s) => {
              const status = claim.stepStatuses[s.id] ?? s.status;
              const active = drawerOpen && activeStep === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveStep(s.id);
                    setDrawerOpen(true);
                  }}
                  className={`rounded-xl border px-2 py-2 text-left text-[11px] ${
                    active
                      ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-500'
                      : status === 'done'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="font-semibold text-slate-800">
                    {s.n}. {s.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/30"
            aria-label="Kapat"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Operasyon Planlayıcısı</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Adım Adım İlerleyerek Operasyona Yön Verin.
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
                className="flex w-[200px] shrink-0 flex-col border-r border-slate-200 bg-white py-3 pl-2 pr-1.5"
                aria-label="Operasyon Akışı"
              >
                <ol className="relative flex flex-col gap-0.5">
                  {PLANNER_STEPS.map((s, idx) => {
                    const active = activeStep === s.id;
                    const done = s.status === 'done';
                    const waiting = active || s.status === 'waiting';
                    return (
                      <li key={s.id} className="relative">
                        {idx < PLANNER_STEPS.length - 1 ? (
                          <span
                            className={`pointer-events-none absolute left-[18px] top-8 h-[calc(100%-8px)] w-0.5 ${
                              done && !active ? 'bg-status-success' : 'bg-slate-200'
                            }`}
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActiveStep(s.id)}
                          className={`relative flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left ${
                            active ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${
                              done && !active
                                ? 'bg-status-success'
                                : waiting
                                  ? 'bg-orange-500 ring-4 ring-orange-200'
                                  : 'bg-slate-400'
                            }`}
                          >
                            {s.n}
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span
                              className={`flex items-start gap-1 text-[11px] font-semibold leading-snug ${
                                done && !active
                                  ? 'text-emerald-700'
                                  : waiting
                                    ? 'text-orange-700'
                                    : 'text-slate-500'
                              }`}
                            >
                              <span className="min-w-0 flex-1">{s.label}</span>
                              {done && !active ? (
                                <span className="mt-0.5 text-emerald-600">✓</span>
                              ) : null}
                            </span>
                            <span
                              className={`mt-0.5 block text-[10px] font-medium ${
                                done && !active
                                  ? 'text-emerald-600'
                                  : waiting
                                    ? 'text-orange-600'
                                    : 'text-slate-400'
                              }`}
                            >
                              {done && !active
                                ? 'Tamamlandı'
                                : waiting
                                  ? 'İşlem Bekliyor'
                                  : 'Bekliyor'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <div className="flex min-w-0 flex-1 flex-col bg-white">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {activeMeta.n}. Adım
                  </p>
                  <h3 className="text-sm font-bold text-slate-950">{activeMeta.label}</h3>
                  <div className="mt-3">{renderStepContent(activeStep)}</div>
                </div>
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
                  {saveNotice ? (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {saveNotice}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
                      onClick={() => setDrawerOpen(false)}
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={async () => {
                        const r = await saveStep(activeStep);
                        setSaveNotice(r.message);
                      }}
                    >
                      Kaydet
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
