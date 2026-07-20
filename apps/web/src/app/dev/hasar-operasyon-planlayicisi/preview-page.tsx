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
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
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
            className="fixed inset-0 z-40 bg-slate-900/20"
            aria-label="Kapat"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl sm:max-w-lg">
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Operasyon Planlayıcısı</h2>
                <p className="text-[11px] text-slate-500">
                  {activeMeta.n}. Adım · {activeMeta.label}
                </p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-1.5">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
              {PLANNER_STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStep(s.id)}
                  className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
                    activeStep === s.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500'
                  }`}
                >
                  {s.n}. {s.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {renderStepContent(activeStep)}
            </div>
            <div className="border-t px-4 py-3">
              {saveNotice ? (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {saveNotice}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold"
                  onClick={() => setDrawerOpen(false)}
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    const r = await saveStep(activeStep);
                    setSaveNotice(r.message);
                  }}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
