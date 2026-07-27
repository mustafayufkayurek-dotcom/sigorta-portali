'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  FinansEmptyState,
  FinansKpiStrip,
  FinansPanelCard,
} from '@/components/finance/FinansPanelUI';
import { API, authAxios } from '../claim-detail-utils';

type RevisionStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ESCALATED';
type RevisionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

type RevisionRequest = {
  id: string;
  reportNo: string;
  insuranceCompany: string;
  requestedBy: string;
  requestedAt: string;
  reasonCategory: string;
  reason: string;
  priority: RevisionPriority;
  status: RevisionStatus;
  deadlineAt: string | null;
  assignedTo: string | null;
  claimFileId: string;
  claimFileNo: string;
};

const REV_STATUS_LABELS: Record<RevisionStatus, string> = {
  REQUESTED: 'Talep Edildi',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi',
  ESCALATED: 'Eskalasyon',
};

const REV_STATUS_BADGE: Record<RevisionStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 border border-slate-200',
  ESCALATED: 'bg-red-50 text-red-700 border border-red-200',
};

const REV_PRIORITY_LABELS: Record<RevisionPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
};

const REV_PRIORITY_BADGE: Record<RevisionPriority, string> = {
  LOW: 'bg-slate-50 text-slate-500 border border-slate-200',
  NORMAL: 'bg-blue-50 text-brand-600 border border-blue-200',
  HIGH: 'bg-orange-50 text-orange-600 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
};

export function RevizyonTalepleriPanel({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authAxios<{ data: RevisionRequest[] }>({
        method: 'GET',
        url: `${API}/revision-requests?claimFileId=${claimId}&limit=50`,
      });
      setRevisions(r.data.data ?? []);
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 401) return;
      const message =
        axios.isAxiosError(e) && e.response?.data?.message
          ? String(e.response.data.message)
          : 'Revizyon talepleri yüklenemedi';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = revisions.filter((r) => r.status === 'REQUESTED').length;
  const escalatedCount = revisions.filter((r) => r.status === 'ESCALATED').length;

  return (
    <FinansPanelCard
      title="Sigorta Revizyon Talepleri"
      subtitle="Sigorta şirketinden gelen revizyon istekleri — rapor zinciri yukarıda listelenir"
      action={{
        label: 'Tüm Revizyonlar',
        onClick: () => router.push('/panel/revizyon-talepleri'),
        variant: 'neutral',
      }}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={load}
            className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 shrink-0"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {!loading && revisions.length > 0 && (
        <FinansKpiStrip
          items={[
            { label: 'Toplam Talep', value: String(revisions.length) },
            {
              label: 'Bekleyen',
              value: String(pendingCount),
              accent: pendingCount > 0 ? 'text-amber-400' : 'text-slate-400',
            },
            {
              label: 'Eskalasyon',
              value: String(escalatedCount),
              accent: escalatedCount > 0 ? 'text-red-400' : 'text-slate-400',
            },
          ]}
        />
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : revisions.length === 0 && !error ? (
        <FinansEmptyState
          title="Bekleyen Revizyon Talebi Yok"
          description="Sigorta şirketinden revizyon talebi geldiğinde burada görünür."
        />
      ) : (
        <div className="space-y-3">
          {revisions.map((rev) => {
            const isUrgent = rev.priority === 'CRITICAL' || rev.status === 'ESCALATED';
            return (
              <div
                key={rev.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/panel/revizyon-talepleri/${rev.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/panel/revizyon-talepleri/${rev.id}`);
                  }
                }}
                className={`rounded-xl border bg-white p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  isUrgent ? 'border-l-4 border-l-red-400 border-slate-100' : 'border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-slate-900">{rev.reportNo}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REV_STATUS_BADGE[rev.status]}`}>
                        {rev.status === 'ESCALATED' && (
                          <span className="mr-1 w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse inline-block" />
                        )}
                        {REV_STATUS_LABELS[rev.status]}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REV_PRIORITY_BADGE[rev.priority]}`}>
                        {REV_PRIORITY_LABELS[rev.priority]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{rev.reasonCategory}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xl">{rev.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">
                      {new Date(rev.requestedAt).toLocaleDateString('tr-TR')}
                    </p>
                    {rev.assignedTo && (
                      <p className="text-xs text-slate-500 mt-0.5">{rev.assignedTo}</p>
                    )}
                    {rev.deadlineAt && (() => {
                      const diffMs = new Date(rev.deadlineAt).getTime() - Date.now();
                      const isOverdue = diffMs < 0;
                      const hours = Math.abs(Math.floor(diffMs / 3600000));
                      const label = hours < 24 ? `${hours} Sa` : `${Math.floor(hours / 24)} G`;
                      return (
                        <p className={`text-xs mt-0.5 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                          {isOverdue ? `Süre Aşımı (${label})` : `${label} Kaldı`}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FinansPanelCard>
  );
}

/** @deprecated Raporlar sekmesi içinde RevizyonTalepleriPanel kullanın */
export function RevizuonlarTab({ claimId }: { claimId: string }) {
  return <RevizyonTalepleriPanel claimId={claimId} />;
}
