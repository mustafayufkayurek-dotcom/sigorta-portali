'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ClaimClosureConditions,
  getClaimClosureConditions,
} from '@/utils/fileDocumentApi';

type EvrakSubTab = 'ozet' | 'sozlesmeler' | 'arsiv' | 'kapama';

const MUVAFAKAT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: 'bg-slate-100 text-slate-600' },
  sent: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Görüntülendi', color: 'bg-amber-100 text-amber-700' },
  digitally_approved: { label: 'Dijital Onaylı', color: 'bg-emerald-100 text-emerald-700' },
  physically_uploaded: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' },
};

function resolveMuvafakatBadge(conds: ClaimClosureConditions): { label: string; color: string } {
  if (conds.muvafakatnamePhysicallyUploaded) {
    return { label: 'Tamamlandı', color: 'bg-green-100 text-green-700' };
  }
  if (conds.muvafakatnameDigitallyApproved) {
    return { label: 'Fiziki Evrak Bekliyor', color: 'bg-amber-100 text-amber-700' };
  }
  if (conds.muvafakatnameStatus) {
    return MUVAFAKAT_STATUS[conds.muvafakatnameStatus] ?? {
      label: conds.muvafakatnameStatus,
      color: 'bg-slate-100 text-slate-600',
    };
  }
  return { label: 'Başlanmadı', color: 'bg-slate-100 text-slate-500' };
}

function resolveVendorBadge(conds: ClaimClosureConditions): { label: string; color: string } {
  if (conds.vendorContractSigned) {
    return { label: 'İmzalandı', color: 'bg-green-100 text-green-700' };
  }
  return { label: 'Bekliyor', color: 'bg-amber-100 text-amber-700' };
}

function resolveKapamaBadge(conds: ClaimClosureConditions): { label: string; color: string } {
  if (conds.canCreateInvoiceRequest) {
    return { label: 'Hazır', color: 'bg-green-100 text-green-700' };
  }
  return { label: 'Eksik Koşul Var', color: 'bg-amber-100 text-amber-700' };
}

function ChecklistRow({
  label,
  description,
  badge,
  onClick,
}: {
  label: string;
  description?: string;
  badge: { label: string; color: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.color}`}>
        {badge.label}
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
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

  return (
    <div className="space-y-4">
      {isFresh && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center">
          <p className="text-sm text-slate-600">Evrak süreci henüz başlamadı.</p>
          <p className="text-xs text-slate-400 mt-1">
            Muvafakatname ve tedarikçi sözleşmesi için Sözleşmeler &amp; Onaylar sekmesine gidin.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-slate-700">Dosya Yaşam Döngüsü</h4>
          <p className="text-xs text-slate-400 mt-0.5">Satıra tıklayarak ilgili sekmeye gidebilirsiniz</p>
        </div>
        <div className="divide-y divide-slate-50">
          <ChecklistRow
            label="Muvafakatname"
            description={
              conditions.muvafakatnameDigitallyApproved && !conditions.muvafakatnamePhysicallyUploaded
                ? 'Dijital onay alındı, fiziki evrak yüklenmeli'
                : !conditions.muvafakatnameStatus
                  ? 'Sigortalı muvafakatnamesi oluşturulmadı'
                  : undefined
            }
            badge={muvafakatBadge}
            onClick={() => onNavigate('sozlesmeler')}
          />
          <ChecklistRow
            label="Tedarikçi Sözleşmesi"
            description={
              conditions.vendorContractSigned
                ? 'İmzalı sözleşme mevcut'
                : 'Tedarikçi sözleşmesi henüz imzalanmadı'
            }
            badge={vendorBadge}
            onClick={() => onNavigate('sozlesmeler')}
          />
          <ChecklistRow
            label="Kapama Hazır mı"
            description={
              conditions.canCreateInvoiceRequest
                ? 'Tüm kapama koşulları sağlandı'
                : 'Onarım raporu, muvafakatname veya sözleşme eksik olabilir'
            }
            badge={kapamaBadge}
            onClick={() => onNavigate('kapama')}
          />
        </div>
      </div>
    </div>
  );
}

export type { EvrakSubTab };
