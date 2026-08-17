'use client';

/**
 * Dosya gideri — Finans Masraf İzleme ile aynı yöntem.
 * Ekstra iş bu ekranda yoktur.
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ClaimFileExpenseFormPanel } from '@/components/finance/ClaimFileExpenseFormPanel';
import { FinansEmptyState, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { financeOperationNo } from '@sigorta/shared';

const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

export function FileMasrafIsleme({
  claimId,
  fileLabel,
}: {
  claimId: string;
  fileLabel?: string;
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

  useEffect(() => { void load(); }, [load]);

  const total = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);

  return (
    <>
      <FinansPanelCard
        title="Masraf İşleme"
        subtitle="Dosya bütçesi masrafları — Finans ile aynı yöntem"
        action={{
          label: 'Yeni Masraf Ekle',
          onClick: () => setOpen(true),
          variant: 'primary',
        }}
      >
        <div className="mb-3 rounded-lg bg-slate-800 px-4 py-2.5 text-white">
          <div className="flex flex-wrap gap-6 text-xs">
            <div>
              <p className="text-slate-300">Toplam Masraf</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(total)}</p>
            </div>
            <div>
              <p className="text-slate-300">Kayıt</p>
              <p className="text-sm font-semibold tabular-nums">{expenses.length}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Yükleniyor...</p>
        ) : expenses.length === 0 ? (
          <FinansEmptyState
            title="Henüz Masraf Yok"
            description="Masraf eklemek için Yeni Masraf Ekle butonunu kullanın."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.map((e: any) => (
              <li key={e.id} className="flex justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="mr-2 font-mono text-[11px] text-slate-400">
                    {financeOperationNo('MSF', e.id, e.createdAt ?? e.date)}
                  </span>
                  {e.description || 'Masraf'}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {fmt(Number(e.amount ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </FinansPanelCard>

      <ClaimFileExpenseFormPanel
        open={open}
        onClose={() => setOpen(false)}
        claimFileId={claimId}
        fileLabel={fileLabel}
        allowExtraWorkPlan={false}
        onSaved={() => { void load(); }}
      />
    </>
  );
}
