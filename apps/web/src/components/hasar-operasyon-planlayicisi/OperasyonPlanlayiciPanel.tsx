'use client';

/**
 * Hasar Operasyon Planlayıcısı — production mount (hasar dosyası Operasyon sekmesi)
 * /dev önizleme ayrı kalır. Rapor yazım sayfasına dokunulmaz.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, CheckCircle2, Circle, Clock3, X } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { PLANNER_STEPS, type StepId, type StepStatus } from './types';
import { renderStepContent } from './steps';
import { PlannerProvider, usePlanner } from './planner-context';
import {
  mapLiveSnapshot,
  type PlannerClaimSnapshot,
  type PlannerInspector,
  type PlannerSupplier,
} from './claim-snapshot';

/** FINAL referans — sol kenar akış renkleri */
const C = {
  active: '#F59E0B',
  activeSoft: '#FFFBEB',
  activeRing: '#FDBA74',
  done: '#16A34A',
  doneSoft: '#ECFDF5',
  pending: '#CBD5E1',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E5E7EB',
  pageBg: '#FFFFFF',
} as const;

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === 'waiting') return <Clock3 className="h-3.5 w-3.5 text-amber-600" />;
  return <Circle className="h-3.5 w-3.5 text-slate-300" />;
}

function statusTone(status: StepStatus, active: boolean) {
  if (active) return 'ring-2 ring-orange-400 border-orange-200 bg-orange-50/70';
  if (status === 'done') return 'border-emerald-200 bg-emerald-50/40';
  if (status === 'waiting') return 'border-amber-200 bg-amber-50/40';
  return 'border-slate-200 bg-white';
}

function stepStatusLabel(status: StepStatus, active: boolean) {
  if (status === 'done') return 'Tamamlandı';
  if (active || status === 'waiting') return 'İşlem Bekliyor';
  return 'Bekliyor';
}

function FlowStepDot({
  status,
  active,
  n,
}: {
  status: StepStatus;
  active: boolean;
  n: number;
}) {
  if (status === 'done' && !active) {
    return (
      <span
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{ backgroundColor: C.done }}
      >
        {n}
      </span>
    );
  }
  if (active || status === 'waiting') {
    return (
      <span
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-4"
        style={{ backgroundColor: C.active, boxShadow: `0 0 0 4px ${C.activeRing}55` }}
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

type Props = {
  claimId: string;
  claimFile: any;
  canEdit: boolean;
  onGoToReports: () => void;
  onClaimUpdated?: (patch: Record<string, unknown>) => void;
};

function PlanlayiciInner({
  drawerOpen,
  setDrawerOpen,
  activeStep,
  setActiveStep,
}: {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  activeStep: StepId;
  setActiveStep: (v: StepId) => void;
}) {
  const { claim, saveStep, saving, canEdit } = usePlanner();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const steps = useMemo(
    () =>
      PLANNER_STEPS.map((s) => ({
        ...s,
        status: claim.stepStatuses[s.id] ?? s.status,
      })),
    [claim.stepStatuses],
  );

  const activeMeta = steps.find((s) => s.id === activeStep) ?? steps[0];

  const onSave = async () => {
    const result = await saveStep(activeStep);
    setSaveNotice(result.message);
  };

  return (
    <div className="relative">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operasyon Planlama Özeti</h2>
            <p className="text-xs text-slate-500">
              Operasyon Durumu: {claim.completedCount} / {claim.totalCount} Tamamlandı
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Operasyon Planlayıcısı
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {steps.map((s) => {
            const active = activeStep === s.id && drawerOpen;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveStep(s.id);
                  setDrawerOpen(true);
                }}
                className={`rounded-xl border px-2 py-2.5 text-left transition ${statusTone(s.status, active)}`}
              >
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={s.status} />
                  <span className="text-[10px] font-semibold text-slate-500">{s.n}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-800">{s.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {s.status === 'done'
                    ? 'Tamamlandı'
                    : s.status === 'waiting'
                      ? 'İşlem Bekliyor'
                      : 'Bekliyor'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">İlerleme Özeti</h3>
          <ul className="mt-3 space-y-2">
            {claim.progressLines.map((line) => (
              <li key={line.text} className="flex items-start gap-2 text-xs text-slate-700">
                <StatusIcon status={line.state === 'done' ? 'done' : line.state === 'waiting' ? 'waiting' : 'future'} />
                <div>
                  <p className="font-medium">{line.text}</p>
                  {line.when ? <p className="text-[10px] text-slate-400">{line.when}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Dosyada Kimler Var?</h3>
          <ul className="mt-3 space-y-2">
            {claim.people.map((p) => (
              <li key={`${p.role}-${p.name}`} className="flex items-center gap-2 text-xs">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  {p.initials}
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {p.role} · {p.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
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
          {/*
            FINAL referans: sol kenar dikey akış (turuncu aktif / yeşil tamam / gri bekleyen).
            Üstte yatay adım sekmesi YOK. Panel ~ max-w-xl (lokal ölçü).
          */}
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
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* Sol kenar akış — FINAL referans */}
              <nav
                className="flex w-[200px] shrink-0 flex-col border-r border-slate-200 bg-white py-3 pl-2 pr-1.5"
                aria-label="Operasyon Akışı"
              >
                <ol className="relative flex flex-col gap-0.5">
                  {steps.map((s, idx) => {
                    const active = activeStep === s.id;
                    const done = s.status === 'done';
                    const waiting = active || s.status === 'waiting';
                    const lineDone = done && !active;
                    return (
                      <li key={s.id} className="relative">
                        {idx < steps.length - 1 ? (
                          <span
                            className="pointer-events-none absolute left-[18px] top-8 h-[calc(100%-8px)] w-0.5"
                            style={{
                              backgroundColor: lineDone ? C.done : C.pending,
                            }}
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActiveStep(s.id)}
                          className={`relative flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left transition ${
                            active
                              ? 'bg-orange-50 ring-1 ring-orange-200'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <FlowStepDot status={s.status} active={active} n={s.n} />
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
                                <Check
                                  className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600"
                                  strokeWidth={3}
                                />
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
                              {stepStatusLabel(s.status, active)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Sağ içerik */}
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
                    <p
                      className={`mb-2 rounded-lg px-3 py-2 text-xs ${
                        saveNotice.includes('eksik') ||
                        saveNotice.includes('değil') ||
                        saveNotice.includes('başarısız') ||
                        saveNotice.includes('yetkiniz') ||
                        saveNotice.includes('engellendi')
                          ? 'border border-amber-200 bg-amber-50 text-amber-900'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {saveNotice}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setDrawerOpen(false)}
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      disabled={saving || !canEdit}
                      className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      onClick={onSave}
                    >
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                  {!canEdit ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Bu Dosyada Düzenleme Yetkiniz Yok.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export function OperasyonPlanlayiciPanel({
  claimId,
  claimFile,
  canEdit,
  onGoToReports,
  onClaimUpdated,
}: Props) {
  const [snapshot, setSnapshot] = useState<PlannerClaimSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeStep, setActiveStep] = useState<StepId>('insured_appointment');

  /** Parent claim / callback her render’da değişir — load bağımlılığına alma (flicker döngüsü). */
  const claimFileRef = useRef(claimFile);
  claimFileRef.current = claimFile;
  const onClaimUpdatedRef = useRef(onClaimUpdated);
  onClaimUpdatedRef.current = onClaimUpdated;

  const load = useCallback(
    async (opts?: { soft?: boolean; notifyParent?: boolean }): Promise<PlannerClaimSnapshot | void> => {
      setError(null);
      if (!opts?.soft) setLoading(true);
      try {
        const [opRes, inspRes, vendorRes] = await Promise.all([
          axios.get(`${API}/claim-operation-center/${claimId}`, { headers: authHeader() }),
          axios
            .get(`${API}/claim-files/${claimId}/vendors/nearby?purpose=inspector`, {
              headers: authHeader(),
            })
            .catch(() => ({ data: null })),
          axios
            .get(`${API}/claim-files/${claimId}/vendors/nearby?purpose=supplier`, {
              headers: authHeader(),
            })
            .catch(() => ({ data: null })),
        ]);

        const op = opRes.data?.data ?? opRes.data;
        const inspRaw = inspRes.data?.data ?? inspRes.data;
        const vendorRaw = vendorRes.data?.data ?? vendorRes.data;
        const inspList: PlannerInspector[] = Array.isArray(inspRaw)
          ? inspRaw.slice(0, 12).map((v: any) => ({
              id: v.id,
              name: v.name ?? v.companyName ?? 'Tespitçi',
              region: v.district ?? v.city ?? '—',
              available: true,
              score: Number(v.rating ?? 0),
              lastWork: '—',
              completedJobs: Number(v.jobCount ?? 0),
              phone: v.phone ?? '',
            }))
          : [];
        const vendorList: PlannerSupplier[] = Array.isArray(vendorRaw)
          ? vendorRaw.slice(0, 12).map((v: any) => ({
              id: v.id,
              name: v.name ?? v.companyName ?? 'Tedarikçi',
              serviceGroup: v.workGroups?.[0]?.name ?? 'Hizmet',
              place: [v.district, v.city].filter(Boolean).join(' / ') || '—',
              rating: v.rating != null ? String(v.rating) : '—',
              avail: 'Müsait' as const,
              phone: v.phone ?? undefined,
            }))
          : [];

        const next = mapLiveSnapshot(op, claimFileRef.current, inspList, vendorList);
        setSnapshot(next);
        if (opts?.notifyParent) {
          onClaimUpdatedRef.current?.({});
        }
        return next;
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ??
          (e?.response?.status === 404
            ? 'Operasyon merkezi verisi bulunamadı. Migration uygulanmış mı?'
            : 'Operasyon verisi yüklenemedi.');
        setError(typeof msg === 'string' ? msg : 'Operasyon verisi yüklenemedi.');
        if (!opts?.soft) setSnapshot(null);
      } finally {
        setLoading(false);
      }
    },
    [claimId],
  );

  const softRefresh = useCallback(
    () => load({ soft: true, notifyParent: true }),
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !snapshot) {
    return <p className="py-10 text-center text-sm text-slate-400">Operasyon planlayıcısı yükleniyor...</p>;
  }

  if ((error || !snapshot) && !loading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
        <p>{error ?? 'Veri yok.'}</p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-blue-700 hover:underline"
          onClick={() => {
            void load();
          }}
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  if (!snapshot) {
    return <p className="py-10 text-center text-sm text-slate-400">Operasyon planlayıcısı yükleniyor...</p>;
  }

  return (
    <PlannerProvider
      mode="live"
      canEdit={canEdit}
      claimId={claimId}
      initialClaim={snapshot}
      onRefresh={softRefresh}
      onGoToReports={onGoToReports}
    >
      <PlanlayiciInner
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
      />
    </PlannerProvider>
  );
}
