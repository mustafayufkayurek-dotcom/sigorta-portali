'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { ClaimFileExpenseFormPanel } from '@/components/finance/ClaimFileExpenseFormPanel';
import { HasarFileHakedisPanel } from '@/components/finance/HasarFileHakedisPanel';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';

const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

export function PlannerFileCostEntry({
  claimId,
  fileLabel,
  reportId,
  supplierCostHint,
  canEdit,
  section = 'all',
}: {
  claimId: string;
  fileLabel?: string;
  reportId?: string | null;
  supplierCostHint?: number | null;
  canEdit: boolean;
  section?: 'all' | 'hakedis' | 'gider';
}) {
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/expenses`, {
        headers: authHeader(),
        params: { fileCaseId: claimId, limit: 200 },
      });
      setExpenses(res.data?.data ?? res.data ?? []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    if (section === 'hakedis') return;
    void load();
  }, [load, section]);

  const butceTotal = expenses.reduce(
    (s, e) => (e.expensePlan === 'EKSTRA_SATIS_MASRAFI' ? s : s + Number(e.amount ?? 0)),
    0,
  );

  const showHakedis = section === 'all' || section === 'hakedis';
  const showGider = section === 'all' || section === 'gider';

  return (
    <div className="space-y-3" data-testid="hasar-planner-dosya-gideri">
      {showGider ? (
        <OpsFirstRunNotice
          noticeId={OPS_NOTICE.hasarMasrafButceEk.id}
          title={OPS_NOTICE.hasarMasrafButceEk.title}
          body={OPS_NOTICE.hasarMasrafButceEk.body}
          testId="hasar-planner-masraf-seridi"
        />
      ) : null}
      {showHakedis ? (
        <HasarFileHakedisPanel
          claimId={claimId}
          reportId={reportId}
          supplierCostHint={supplierCostHint}
          compact
          hideCompactTitle={section !== 'all'}
        />
      ) : null}
      {showGider ? (
      <div id="meridyen-operasyon-gideri" className="space-y-2">
        <div className={`flex items-center gap-2 ${section === 'all' ? 'justify-between' : 'justify-end'}`}>
          {section === 'all' ? (
            <p className="text-xs font-semibold text-slate-800">Meridyen Operasyon Gideri</p>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              data-testid="hasar-meridyen-operasyon-gideri-yolu"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
            >
              Yeni Masraf Ekle
            </button>
          ) : null}
        </div>
        <p className="text-[11px] tabular-nums text-slate-600">
          Bütçelenen {fmt(butceTotal)}
        </p>
        {loading ? (
          <p className="text-xs text-slate-400">Yükleniyor...</p>
        ) : expenses.length === 0 ? (
          <p className="text-xs text-slate-600">Bu dosyada henüz masraf yok.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.slice(0, 8).map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-xs text-slate-700">
                <span className="min-w-0 truncate">{e.description || 'Masraf'}</span>
                <span className="shrink-0 font-semibold tabular-nums">{fmt(Number(e.amount ?? 0))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      ) : null}
      {showGider ? (
      <ClaimFileExpenseFormPanel
        open={open}
        onClose={() => setOpen(false)}
        claimFileId={claimId}
        fileLabel={fileLabel}
        allowExtraWorkPlan={true}
        onSaved={() => {
          void load();
        }}
      />
      ) : null}
    </div>
  );
}
