'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '../claim-detail-utils';
import { SectionCard } from '../claim-detail-ui';
import { FinansMetrikHucre } from '../FinansRaporOzeti';

// ─── Revizyonlar Tab ──────────────────────────────────────────────────────────

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
  NORMAL: 'bg-blue-50 text-blue-600 border border-blue-200',
  HIGH: 'bg-orange-50 text-orange-600 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
};

export function RevizuonlarTab({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    axios.get(`${API}/revision-requests?claimFileId=${claimId}&limit=50`, { headers: authHeader() })
      .then((r) => setRevisions(r.data.data ?? []))
      .catch((e: any) => setError(e?.response?.data?.message ?? 'Revizyonlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = revisions.filter((r) => r.status === 'REQUESTED').length;
  const escalatedCount = revisions.filter((r) => r.status === 'ESCALATED').length;

  return (
    <div className="space-y-4">
      {!loading && revisions.length > 0 && (
        <div className="grid grid-cols-3 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <FinansMetrikHucre metrik={{ label: 'Toplam', value: String(revisions.length) }} />
          <FinansMetrikHucre metrik={{ label: 'Bekleyen', value: String(pendingCount), accent: pendingCount > 0 ? 'text-amber-700' : undefined }} />
          <FinansMetrikHucre metrik={{ label: 'Eskalasyon', value: String(escalatedCount), accent: escalatedCount > 0 ? 'text-red-700' : undefined }} />
        </div>
      )}

      <SectionCard title="Revizyon Talepleri">
        <div className="flex items-center justify-end mb-4 -mt-2">
          <button
            type="button"
            onClick={() => router.push(`/panel/revizyon-talepleri`)}
            className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Tüm Revizyonlar
          </button>
        </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={load} className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">Tekrar Dene</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : revisions.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">Bekleyen Revizyon Talebi Yok</p>
          <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait revizyon talebi bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((rev) => {
            const isUrgent = rev.priority === 'CRITICAL' || rev.status === 'ESCALATED';
            return (
              <div
                key={rev.id}
                onClick={() => router.push(`/panel/revizyon-talepleri/${rev.id}`)}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${isUrgent ? 'border-l-4 border-red-400 border-y-gray-100 border-r-gray-100' : 'border-slate-100'}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-slate-900">{rev.reportNo}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REV_STATUS_BADGE[rev.status]}`}>
                        {rev.status === 'ESCALATED' && (
                          <span className="mr-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
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
                    <p className="text-xs text-slate-400">{new Date(rev.requestedAt).toLocaleDateString('tr-TR')}</p>
                    {rev.assignedTo && <p className="text-xs text-slate-500 mt-0.5">{rev.assignedTo}</p>}
                    {rev.deadlineAt && (() => {
                      const diffMs = new Date(rev.deadlineAt).getTime() - Date.now();
                      const isOverdue = diffMs < 0;
                      const hours = Math.abs(Math.floor(diffMs / 3600000));
                      const label = hours < 24 ? `${hours}sa` : `${Math.floor(hours / 24)}g`;
                      return (
                        <p className={`text-xs mt-0.5 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                          {isOverdue ? `⚠ Süre Aşımı (${label})` : `${label} kaldı`}
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
      </SectionCard>
    </div>
  );
}
