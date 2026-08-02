'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Pencil } from 'lucide-react';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  applyTakeoffLineItemOverride,
  createTakeoffRun,
  fmtTakeoffDate,
  formatTakeoffQuantity,
  getTakeoffRun,
  listTakeoffRuns,
} from './smart-takeoff-api';
import type { TakeoffLineItem, TakeoffRun } from './smart-takeoff.types';
import { TakeoffExplanationDrawer } from './TakeoffExplanationDrawer';
import { TakeoffOverrideDrawer } from './TakeoffOverrideDrawer';

type SmartTakeoffPanelProps = {
  claimFileId: string;
  canUpdate?: boolean;
  refreshKey?: number;
};

export function SmartTakeoffPanel({
  claimFileId,
  canUpdate = false,
  refreshKey = 0,
}: SmartTakeoffPanelProps) {
  const [runs, setRuns] = useState<TakeoffRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<TakeoffRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainItem, setExplainItem] = useState<TakeoffLineItem | null>(null);
  const [overrideItem, setOverrideItem] = useState<TakeoffLineItem | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listTakeoffRuns(claimFileId);
      setRuns(list);
      setSelectedRunId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setRuns([]);
      setSelectedRunId(null);
      setActiveRun(null);
      setError(getApiErrorMessage(err, 'Metraj koşumları yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [claimFileId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns, refreshKey]);

  useEffect(() => {
    if (!selectedRunId) {
      setActiveRun(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void getTakeoffRun(claimFileId, selectedRunId)
      .then((run) => {
        if (!cancelled) setActiveRun(run);
      })
      .catch((err) => {
        if (!cancelled) {
          setActiveRun(null);
          setError(getApiErrorMessage(err, 'Koşum detayı yüklenemedi.'));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [claimFileId, selectedRunId]);

  const lineItems = useMemo(
    () => activeRun?.lineItems ?? [],
    [activeRun?.lineItems],
  );

  const handleCreateRun = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createTakeoffRun(claimFileId);
      await loadRuns();
      setSelectedRunId(created.id);
      setActiveRun(created);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Metraj koşumu oluşturulamadı.'));
    } finally {
      setCreating(false);
    }
  };

  const handleOverrideSubmit = async (quantityOverride: number, reason: string) => {
    if (!activeRun || !overrideItem) return;
    setOverrideSaving(true);
    setError(null);
    try {
      const updated = await applyTakeoffLineItemOverride(
        claimFileId,
        activeRun.id,
        overrideItem.id,
        { quantityOverride, reason },
      );
      setActiveRun((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lineItems: prev.lineItems.map((li) => (li.id === updated.id ? updated : li)),
        };
      });
      setOverrideItem(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Manuel düzeltme kaydedilemedi.'));
    } finally {
      setOverrideSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Operasyon iş kalemleri yükleniyor…
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Operasyon İş Kalemleri</p>
            <p className="text-xs text-slate-500">
              Akıllı ölçülerden üretilen metraj · açıklanabilir hesap
            </p>
          </div>
          {canUpdate ? (
            <LoadingButton type="button" loading={creating} onClick={() => void handleCreateRun()}>
              Metraj Koşumu Oluştur
            </LoadingButton>
          ) : null}
        </div>

        {error ? (
          <p className="border-b border-status-danger/20 bg-status-danger/5 px-4 py-2 text-xs text-status-danger">
            {error}
          </p>
        ) : null}

        {!runs.length ? (
          <div className="px-4 py-4">
            <p className="text-sm text-slate-600">
              Henüz metraj koşumu yok. Dosyada uygun akıllı ölçü varsa koşum oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
              <span className="text-xs text-slate-500">Koşum</span>
              <div className="relative">
                <select
                  value={selectedRunId ?? ''}
                  onChange={(e) => setSelectedRunId(e.target.value || null)}
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      #{run.runNumber} · {fmtTakeoffDate(run.createdAt)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {activeRun ? (
                <span className="text-xs text-slate-400">
                  Kural sürümü: {activeRun.ruleVersionTag}
                </span>
              ) : null}
            </div>

            {detailLoading ? (
              <p className="px-4 py-4 text-sm text-slate-500">İş kalemleri yükleniyor…</p>
            ) : lineItems.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Bu koşumda iş kalemi yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">İş Kalemi</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Operasyon Kodu</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Miktar</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Durum</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{item.displayName}</p>
                          <p className="text-xs text-slate-500">{item.explanation.measureSummary || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.operationItemCode}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {formatTakeoffQuantity(item.quantityFinal, item.unit)}
                          </p>
                          {item.hasOverride ? (
                            <p className="text-xs text-slate-400 line-through">
                              {formatTakeoffQuantity(item.quantityEngine, item.unit)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {item.hasOverride ? (
                            <span className="inline-flex rounded-lg bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                              Düzeltilmiş
                            </span>
                          ) : (
                            <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              Motor
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setExplainItem(item)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                            >
                              <Info className="h-3.5 w-3.5" />
                              Açıklama
                            </button>
                            {canUpdate ? (
                              <button
                                type="button"
                                onClick={() => setOverrideItem(item)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Düzelt
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <TakeoffExplanationDrawer
        open={Boolean(explainItem)}
        lineItem={explainItem}
        onClose={() => setExplainItem(null)}
      />

      <TakeoffOverrideDrawer
        open={Boolean(overrideItem)}
        lineItem={overrideItem}
        saving={overrideSaving}
        onClose={() => setOverrideItem(null)}
        onSubmit={handleOverrideSubmit}
      />
    </>
  );
}
