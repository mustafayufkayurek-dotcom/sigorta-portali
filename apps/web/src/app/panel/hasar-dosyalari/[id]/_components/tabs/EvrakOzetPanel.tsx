'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ClaimClosureConditions,
  getClaimClosureConditions,
} from '@/utils/fileDocumentApi';

type EvrakSubTab = 'ozet' | 'sozlesmeler';

const MUVAFAKAT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: 'Taslak', tone: 'neutral' },
  sent: { label: 'Gönderildi', tone: 'info' },
  viewed: { label: 'Görüntülendi', tone: 'warning' },
  digitally_approved: { label: 'Dijital Onaylı', tone: 'success' },
  physically_uploaded: { label: 'Tamamlandı', tone: 'success' },
};

type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const TONE_STYLES: Record<StatusTone, { badge: string; stripe: string; icon: string }> = {
  neutral: {
    badge: 'bg-slate-100 text-slate-600 ring-slate-200/80',
    stripe: 'bg-slate-300',
    icon: 'text-slate-400',
  },
  info: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-100',
    stripe: 'bg-blue-400',
    icon: 'text-blue-500',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-100',
    stripe: 'bg-amber-400',
    icon: 'text-amber-500',
  },
  success: {
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    stripe: 'bg-emerald-500',
    icon: 'text-emerald-500',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 ring-red-100',
    stripe: 'bg-red-400',
    icon: 'text-red-500',
  },
};

type StepBadge = { label: string; tone: StatusTone };

function resolveMuvafakatBadge(conds: ClaimClosureConditions): StepBadge {
  if (conds.muvafakatnameDigitallyApproved) {
    return { label: 'Tamamlandı', tone: 'success' };
  }
  if (conds.muvafakatnameStatus) {
    return MUVAFAKAT_STATUS[conds.muvafakatnameStatus] ?? {
      label: conds.muvafakatnameStatus,
      tone: 'neutral',
    };
  }
  return { label: 'Başlanmadı', tone: 'neutral' };
}

function resolveVendorBadge(conds: ClaimClosureConditions): StepBadge {
  if (conds.vendorContractSigned) {
    return { label: 'İmzalandı', tone: 'success' };
  }
  return { label: 'Bekliyor', tone: 'warning' };
}

function resolveKapamaBadge(conds: ClaimClosureConditions): StepBadge {
  if (conds.canCreateInvoiceRequest) {
    return { label: 'Hazır', tone: 'success' };
  }
  return { label: 'Eksik Koşul Var', tone: 'warning' };
}

function StatusBadge({ badge }: { badge: StepBadge }) {
  const styles = TONE_STYLES[badge.tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles.badge}`}
    >
      {badge.label}
    </span>
  );
}

function LifecycleStep({
  step,
  title,
  description,
  badge,
  actionLabel,
  onAction,
  done,
}: {
  step: number;
  title: string;
  description: string;
  badge: StepBadge;
  actionLabel?: string;
  onAction?: () => void;
  done?: boolean;
}) {
  const styles = TONE_STYLES[badge.tone];

  return (
    <div className="flex gap-3 px-4 py-3.5">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
            done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {done ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </div>
        <div className={`w-0.5 flex-1 min-h-[12px] mt-1 rounded-full ${styles.stripe} opacity-30`} />
      </div>

      <div className="flex-1 min-w-0 rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h5 className="text-sm font-semibold text-slate-800">{title}</h5>
          <StatusBadge badge={badge} />
        </div>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
          >
            {actionLabel}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function EvrakOzetPanel({
  claimId,
  onNavigate,
}: {
  claimId: string;
  onNavigate: (tab: EvrakSubTab) => void;
}) {
  const [conditions, setConditions] = useState<ClaimClosureConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const conds = await getClaimClosureConditions(claimId);
      setConditions(conds);
    } catch (e: unknown) {
      setConditions(null);
      setError(e instanceof Error ? e.message : 'Durum yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const isFresh =
    conditions &&
    !conditions.muvafakatnameStatus &&
    !conditions.vendorContractSigned &&
    !conditions.canCreateInvoiceRequest;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-5 py-10 text-center">
        <p className="text-sm text-slate-400">Evrak durumu kontrol ediliyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-xs text-red-700 underline"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!conditions) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
        <p className="text-sm text-slate-500">Evrak durumu alınamadı.</p>
      </div>
    );
  }

  const muvafakatBadge = resolveMuvafakatBadge(conditions);
  const vendorBadge = resolveVendorBadge(conditions);
  const kapamaBadge = resolveKapamaBadge(conditions);

  const muvafakatDone = conditions.muvafakatnameDigitallyApproved;
  const vendorDone = conditions.vendorContractSigned;

  const muvafakatDesc =
    conditions.muvafakatnameDigitallyApproved
      ? 'Dijital onay alındı. Gerekirse belgeden çıktı alabilirsiniz.'
      : !conditions.muvafakatnameStatus
        ? 'Sigortalı muvafakat formu henüz oluşturulmadı.'
        : conditions.muvafakatnameStatus === 'draft'
          ? 'Form oluşturuldu. WhatsApp ile sigortalıya gönderin veya çıktı alın.'
          : conditions.muvafakatnameStatus === 'sent' || conditions.muvafakatnameStatus === 'viewed'
            ? 'Link gönderildi. Sigortalının belgeyi okuyup onaylaması bekleniyor.'
            : 'Muvafakat süreci devam ediyor.';

  const vendorDesc = conditions.vendorContractSigned
    ? 'Tedarikçi sözleşmesi imzalandı ve dosyada mevcut.'
    : 'Atanan tedarikçi ile sözleşme imzalanması gerekiyor.';

  const kapamaDesc = conditions.canCreateInvoiceRequest
    ? 'Evrak ve rapor koşulları tamam. Finans → Faturalar sekmesinden fatura talebi oluşturabilirsiniz.'
    : 'Fatura talebi için onarım raporu, muvafakat formu ve tedarikçi sözleşmesi koşullarının tamamlanması gerekir.';

  return (
    <div className="space-y-4">
      {isFresh && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
          <p className="text-sm font-medium text-blue-900">Evrak Süreci Henüz Başlamadı</p>
          <p className="text-xs text-blue-700/80 mt-1">
            İlk adım olarak muvafakat formunu oluşturup sigortalıya gönderin.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('sozlesmeler')}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            Sözleşmeler &amp; Onaylar&apos;a Git
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <h4 className="text-sm font-semibold text-slate-800">Dosya Yaşam Döngüsü</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Evrak adımları sırayla tamamlanır. Her adımın altındaki bağlantıdan ilgili işleme gidebilirsiniz.
          </p>
        </div>

        <div className="py-1">
          <LifecycleStep
            step={1}
            title="Mutabakat / Muvafakat Formu"
            description={muvafakatDesc}
            badge={muvafakatBadge}
            actionLabel="Formu Yönet"
            onAction={() => onNavigate('sozlesmeler')}
            done={muvafakatDone}
          />
          <LifecycleStep
            step={2}
            title="Tedarikçi Sözleşmesi"
            description={vendorDesc}
            badge={vendorBadge}
            actionLabel="Sözleşmeye Git"
            onAction={() => onNavigate('sozlesmeler')}
            done={vendorDone}
          />
          <LifecycleStep
            step={3}
            title="Fatura Talebine Hazır mı"
            description={kapamaDesc}
            badge={kapamaBadge}
            done={conditions.canCreateInvoiceRequest}
          />
        </div>
      </div>
    </div>
  );
}

export type { EvrakSubTab };
