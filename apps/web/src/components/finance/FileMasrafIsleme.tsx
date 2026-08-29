'use client';

/**
 * Dosya gideri — Finans Masraf İzleme ile aynı yöntem.
 * Bütçelenen veya ek iş seçilir; kâr ayrı ve toplu görünür.
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { ClaimFileExpenseFormPanel } from '@/components/finance/ClaimFileExpenseFormPanel';
import { canDeleteClaimFinance } from '@/components/finance/can-delete-claim-finance';
import { HasarFileHakedisPanel } from '@/components/finance/HasarFileHakedisPanel';
import { FinansEmptyState, FinansMetricGrid, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { financeOperationNo } from '@sigorta/shared';

const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

export function FileMasrafIsleme({
  claimId,
  fileLabel,
  reportId,
  supplierCostHint,
}: {
  claimId: string;
  fileLabel?: string;
  reportId?: string | null;
  supplierCostHint?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canDelete = canDeleteClaimFinance();

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
  const butceTotal = expenses.reduce(
    (s, e) => (e.expensePlan === 'EKSTRA_SATIS_MASRAFI' ? s : s + Number(e.amount ?? 0)),
    0,
  );
  const ekTotal = expenses.reduce(
    (s, e) => (e.expensePlan === 'EKSTRA_SATIS_MASRAFI' ? s + Number(e.amount ?? 0) : s),
    0,
  );

  return (
    <div className="space-y-4">
      <HasarFileHakedisPanel claimId={claimId} reportId={reportId} supplierCostHint={supplierCostHint} />
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarHakedisGider.id}
        title={OPS_NOTICE.hasarHakedisGider.title}
        body={OPS_NOTICE.hasarHakedisGider.body}
        testId="hasar-hakedis-gider-seridi"
      />
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarMasrafButceEk.id}
        title={OPS_NOTICE.hasarMasrafButceEk.title}
        body={OPS_NOTICE.hasarMasrafButceEk.body}
        testId="hasar-masraf-butce-ek-seridi"
      />
      <FinansPanelCard
        title="Masraf İşleme"
        subtitle="Bütçelenen veya ek iş — aynı yöntem"
        action={{
          label: 'Yeni Masraf Ekle',
          onClick: () => setOpen(true),
          variant: 'primary',
        }}
      >
        <FinansMetricGrid
          items={[
            { label: 'Bütçelenen', value: fmt(butceTotal) },
            { label: 'Ek İş', value: fmt(ekTotal) },
            { label: 'Toplam', value: fmt(total) },
          ]}
        />

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
              <li key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="mr-2 font-mono text-[11px] text-slate-400">
                    {financeOperationNo('MSF', e.id, e.createdAt ?? e.date)}
                  </span>
                  {e.description || 'Masraf'}
                  {e.expensePlan === 'EKSTRA_SATIS_MASRAFI' ? (
                    <span className="ml-2 text-[10px] font-medium text-amber-700">Ek iş</span>
                  ) : (
                    <span className="ml-2 text-[10px] font-medium text-slate-400">Bütçelenen</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums text-slate-800">
                    {fmt(Number(e.amount ?? 0))}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      title="Sil"
                      onClick={async () => {
                        if (!window.confirm('Bu masraf silinsin mi?')) return;
                        try {
                          await axios.delete(`${API}/expenses/${e.id}`, { headers: authHeader() });
                          void load();
                        } catch {
                          /* toast yok — yükleme yenilenir */
                        }
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
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
        allowExtraWorkPlan={true}
        onSaved={() => { void load(); }}
      />
    </div>
  );
}
