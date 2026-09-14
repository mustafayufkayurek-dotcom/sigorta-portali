'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  FaturaTalepleriSection,
  type TalepOzet,
} from '@/components/finance/FaturaTalepleriSection';
import { FinansKpiStrip } from '@/components/finance/FinansPanelUI';
import { resolveFaturaTalepFilter } from '@/utils/invoice-request-envelope';
import { FINANS_KART_YOL } from '@/utils/finans-merkez-kart';
import { HintIcon } from '@/components/ui/HintIcon';
import { formatTryAmount } from '@/utils/format-try-amount';

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

export default function FaturaTalepleriPage() {
  return (
    <Suspense fallback={(
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    >
      <FaturaTalepleriPageContent />
    </Suspense>
  );
}

function FaturaTalepleriPageContent() {
  const searchParams = useSearchParams();
  const talepFilter = resolveFaturaTalepFilter(searchParams.get('status'));
  const [talepOzet, setTalepOzet] = useState<TalepOzet>({
    total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, pendingIds: [],
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="Satış Fatura Talepleri" />

      <div>
        <h2 className="inline-flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-white">
          Satış Fatura Talepleri
          <HintIcon text="Kapanıştan gelen kesilecek iş. Resmi fatura başka programda kesilir; numarası yazılınca iş Faturalandı görünür." />
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tedarikçi ödemesi bu sayfada değildir.{' '}
          <Link href="/panel/finans/faturalar" className="font-medium text-brand-700 hover:underline">
            Kesilmiş faturalar
          </Link>
          {' · '}
          <Link href={FINANS_KART_YOL.tedarikciOdeme} className="font-medium text-brand-700 hover:underline">
            Tedarikçi Ödeme Kuyruğu
          </Link>
        </p>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          {
            label: 'Fatura bilgisi bekleyen',
            value: talepOzet.pendingCount > 0 ? String(talepOzet.pendingCount) : '—',
            accent: talepOzet.pendingCount > 0 ? 'text-amber-400' : 'text-slate-400',
          },
          {
            label: 'Bekleyen Tutar',
            value: talepOzet.pendingAmount > 0 ? fmtCurrency(talepOzet.pendingAmount) : '—',
            accent: talepOzet.pendingAmount > 0 ? 'text-slate-800' : 'text-slate-400',
          },
        ]}
      />

      <FaturaTalepleriSection
        key={talepFilter}
        initialFilter={talepFilter}
        onOzetChange={setTalepOzet}
      />
    </div>
  );
}
