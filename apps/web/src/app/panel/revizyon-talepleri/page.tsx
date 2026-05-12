'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApiQuery } from '@/hooks/useApi';
import { SearchInput } from '@/components/ui/SearchInput';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR');

// ─── Types ─────────────────────────────────────────────────────────────────────

type RevisionStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ESCALATED';
type RevisionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

type RevisionRequest = {
  id: string;
  reportId: string;
  status: RevisionStatus;
  priority: RevisionPriority;
  reason: string;
  reasonNote: string;
  deadlineAt: string | null;
  completedAt: string | null;
  createdAt: string;
  report: { id: string; reportNo: string; status: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  _count?: { messages: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RevisionStatus, string> = {
  REQUESTED: 'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi',
  ESCALATED: 'Eskalasyon',
};

const STATUS_BADGE: Record<RevisionStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 border border-slate-200',
  ESCALATED: 'bg-red-50 text-red-700 border border-red-200',
};

const PRIORITY_LABELS: Record<RevisionPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
};

const PRIORITY_BADGE: Record<RevisionPriority, string> = {
  LOW: 'bg-slate-50 text-slate-500 border border-slate-200',
  NORMAL: 'bg-blue-50 text-blue-600 border border-blue-200',
  HIGH: 'bg-orange-50 text-orange-600 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
};

const REASON_LABELS: Record<string, string> = {
  PRICE_ERROR: 'Fiyat Hatası',
  MISSING_ITEM: 'Eksik Kalem',
  SCOPE_CHANGE: 'Kapsam Değişikliği',
  CALCULATION_ERROR: 'Hesap Hatası',
  CUSTOMER_REQUEST: 'Müşteri Talebi',
  EXPERT_REQUEST: 'Eksper Talebi',
  OTHER: 'Diğer',
};

function remainingTime(deadline: string | null): { label: string; isOverdue: boolean } {
  if (!deadline) return { label: '—', isOverdue: false };
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  if (diffMs < 0) {
    const hours = Math.abs(Math.floor(diffMs / 3600000));
    if (hours < 24) return { label: `Süre Aşımı (${hours}sa)`, isOverdue: true };
    return { label: `Süre Aşımı (${Math.floor(hours / 24)}g)`, isOverdue: true };
  }
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return { label: `${hours}sa kaldı`, isOverdue: false };
  const days = Math.floor(hours / 24);
  return { label: `${days} gün kaldı`, isOverdue: false };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function RevisionRequestsPage() {
  const router = useRouter();

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    return new URLSearchParams(params).toString();
  }, [statusFilter, priorityFilter]);

  const { data: revisions = [], isLoading, error } = useApiQuery<RevisionRequest[]>(
    ['revision-requests', queryParams],
    `revision-requests${queryParams ? `?${queryParams}` : ''}`,
  );

  const { data: overdueData = [] } = useApiQuery<RevisionRequest[]>(
    ['revision-requests-overdue'],
    'revision-requests/overdue',
  );

  // Client-side search filter
  const filteredRevisions = useMemo(() => {
    const list = revisions;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) =>
      r.report?.reportNo?.toLowerCase().includes(q) ||
      r.reasonNote?.toLowerCase().includes(q) ||
      r.requestedBy?.firstName?.toLowerCase().includes(q) ||
      r.requestedBy?.lastName?.toLowerCase().includes(q) ||
      r.assignedTo?.firstName?.toLowerCase().includes(q) ||
      r.assignedTo?.lastName?.toLowerCase().includes(q)
    );
  }, [revisions, search]);

  // Status summary computed from all loaded data
  const statusSummary = useMemo(() => {
    const allList = revisions;
    const summary: Record<string, number> = { REQUESTED: 0, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0, ESCALATED: 0 };
    allList.forEach((r) => { if (summary[r.status] !== undefined) summary[r.status]++; });
    return summary;
  }, [revisions]);

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setSearch('');
  };

  const hasFilters = !!(statusFilter || priorityFilter || search);
  const overdueCount = overdueData.length;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Revizyon Talepleri</span>
      </nav>

      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Revizyon Talepleri</h2>
          {!isLoading && (
            <p className="text-sm text-slate-400 mt-0.5">
              {filteredRevisions.length} revizyon talebi
              {statusSummary.REQUESTED > 0 && <span className="ml-2 text-amber-600 font-medium">• {statusSummary.REQUESTED} bekliyor</span>}
              {overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">• {overdueCount} süre aşımı</span>}
            </p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-6">
        {(
          [
            { status: 'REQUESTED', label: 'Bekliyor', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { status: 'IN_PROGRESS', label: 'Devam Ediyor', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { status: 'COMPLETED', label: 'Tamamlandı', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { status: 'REJECTED', label: 'Reddedildi', color: 'bg-slate-50 border-slate-200 text-slate-500' },
            { status: 'ESCALATED', label: 'Eskalasyon', color: 'bg-red-50 border-red-200 text-red-700' },
          ] as { status: RevisionStatus; label: string; color: string }[]
        ).map(({ status, label, color }) => {
          const count = statusSummary[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              onClick={() => { setStatusFilter(statusFilter === status ? '' : status); }}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${color} ${statusFilter === status ? 'ring-2 ring-offset-1 ring-current' : ''}`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-48">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rapor no, kişi ara..."
            />
          </div>
          <div className="min-w-36">
            <label className="text-xs text-slate-500 block mb-1">Durum</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              {(Object.keys(STATUS_LABELS) as RevisionStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="min-w-32">
            <label className="text-xs text-slate-500 block mb-1">Öncelik</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">Tüm Öncelikler</option>
              {(Object.keys(PRIORITY_LABELS) as RevisionPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 border border-slate-200 px-3 py-2 rounded-lg hover:border-red-200 self-end">
              Temizle ×
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 mb-5">
          <p className="text-sm text-red-700">Revizyon talepleri yüklenirken hata oluştu.</p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="animate-pulse space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
                <div className="h-4 w-24 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-100 rounded" />
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredRevisions.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {hasFilters ? 'Filtrelere Uyan Revizyon Talebi Bulunamadı' : 'Bekleyen Revizyon Talebi Yok'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasFilters ? 'Farklı filtreler deneyin.' : 'Tüm revizyon talepleri tamamlandı.'}
            </p>
          </div>
        </div>
      ) : filteredRevisions.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Rapor No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Talep Eden</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Tarih</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Sebep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Öncelik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Durum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Süre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500 tracking-wide">Atanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRevisions.map((rev) => {
                const { label: timeLabel, isOverdue } = remainingTime(rev.deadlineAt);
                const isUrgent = rev.priority === 'CRITICAL' || rev.status === 'ESCALATED';
                return (
                  <tr
                    key={rev.id}
                    onClick={() => router.push(`/panel/revizyon-talepleri/${rev.id}`)}
                    className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${isUrgent ? 'border-l-4 border-red-400' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{rev.report?.reportNo ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {rev.requestedBy?.firstName?.charAt(0) ?? '?'}
                        </div>
                        <span className="text-sm text-slate-600">{rev.requestedBy?.firstName} {rev.requestedBy?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">{fmtDate(rev.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-slate-700 text-xs font-medium">{REASON_LABELS[rev.reason] ?? rev.reason}</p>
                        <p className="text-slate-400 text-xs mt-0.5 max-w-[200px] truncate">{rev.reasonNote}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[rev.priority]}`}>
                        {PRIORITY_LABELS[rev.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[rev.status]}`}>
                        {rev.status === 'ESCALATED' && (
                          <span className="mr-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        )}
                        {STATUS_LABELS[rev.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {rev.deadlineAt ? (
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                          {isOverdue && <span className="mr-1">⚠</span>}
                          {timeLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {rev.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {rev.assignedTo.firstName.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-600">{rev.assignedTo.firstName} {rev.assignedTo.lastName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">Atanmadı</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
