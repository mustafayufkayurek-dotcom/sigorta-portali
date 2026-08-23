'use client';

/**
 * Dosya gideri — Finans Masraf İzleme ile aynı yöntem.
 * Ekstra iş bu ekranda yoktur.
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { ClaimFileExpenseFormPanel } from '@/components/finance/ClaimFileExpenseFormPanel';
import { canDeleteClaimFinance } from '@/components/finance/can-delete-claim-finance';
import { FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
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
  const [hakedis, setHakedis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canDelete = canDeleteClaimFinance();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, hak] = await Promise.allSettled([
        axios.get(`${API}/expenses`, {
          headers: authHeader(),
          params: { fileCaseId: claimId, limit: 200 },
        }),
        axios.get(`${API}/vendor-statements`, {
          headers: authHeader(),
          params: { claimFileId: claimId, limit: 50 },
        }),
      ]);
      setExpenses(res.status === 'fulfilled' ? (res.value.data?.data ?? res.value.data ?? []) : []);
      setHakedis(hak.status === 'fulfilled' ? (hak.value.data?.data ?? hak.value.data ?? []) : []);
    } catch {
      setExpenses([]);
      setHakedis([]);
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
        <FinansKpiStrip
          tone="light"
          items={[
            { label: 'Toplam Masraf', value: fmt(total) },
            { label: 'Kayıt', value: String(expenses.length) },
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

      <FinansPanelCard
        title="Tedarikçi Hakedişleri"
        subtitle="Onarım raporundan hakedişe aktarılan ekstreler burada durur"
      >
        {hakedis.length === 0 ? (
          <FinansEmptyState
            title="Bu dosyada hakediş yok"
            description="Onarım raporunda Onayla ve Hakedişe Aktar ile hazırlanır. Liste burada görünür."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {hakedis.map((s: any) => (
              <li key={s.id} className="flex justify-between gap-2 py-2.5 text-sm">
                <span className="text-slate-700">
                  {s.statementNo} · {s.vendor?.name ?? 'Tedarikçi'}
                </span>
                <span className="text-xs font-medium text-slate-500">{s.status}</span>
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
