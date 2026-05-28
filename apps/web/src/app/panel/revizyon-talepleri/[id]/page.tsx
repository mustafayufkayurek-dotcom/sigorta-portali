'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

function fmtDate(d: string) { return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type RevisionStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ESCALATED';
type RevisionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

type RevisionDetail = {
  id: string;
  reportId: string;
  status: RevisionStatus;
  priority: RevisionPriority;
  reason: string;
  reasonNote: string;
  deadlineAt: string | null;
  completedAt: string | null;
  responseNote: string | null;
  createdAt: string;
  report: { id: string; reportNo: string; status: string; versionNo: number; totalSalesAmount?: number };
  requestedBy: { id: string; firstName: string; lastName: string };
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  newReport: { id: string; reportNo: string; status: string; versionNo: number } | null;
  messages: Message[];
};

type Message = {
  id: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
};

type VersionItem = {
  id: string;
  reportNo: string;
  versionNo: number;
  status: string;
  createdAt: string;
  totalSalesAmount: number;
};

type DiffItem = {
  field: string;
  label: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  type: 'changed' | 'added' | 'removed';
};

type DiffData = {
  summary: { oldTotal: number; newTotal: number; difference: number };
  changes: DiffItem[];
};

// ─── Status / Priority helpers ────────────────────────────────────────────────

const STATUS_LABELS: Record<RevisionStatus, string> = {
  REQUESTED: 'Bekliyor', IN_PROGRESS: 'Devam Ediyor', COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi', ESCALATED: 'Eskalasyon',
};
const STATUS_BADGE: Record<RevisionStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 border border-slate-200',
  ESCALATED: 'bg-red-50 text-red-700 border border-red-200',
};
const PRIORITY_LABELS: Record<RevisionPriority, string> = {
  LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', CRITICAL: 'Kritik',
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

const TIMELINE_STEPS: { status: RevisionStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Talep Alındı' },
  { status: 'IN_PROGRESS', label: 'İnceleniyor' },
  { status: 'COMPLETED', label: 'Tamamlandı' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function RevisionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [msgInput, setMsgInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diff' | 'versions'>('diff');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: detail, isLoading, error: pageError } = useApiQuery<RevisionDetail>(
    ['revision-request', id],
    `revision-requests/${id}`,
  );

  const { data: versions = [] } = useApiQuery<VersionItem[]>(
    ['report-versions', detail?.report?.id],
    `repair-reports/${detail?.report?.id}/versions`,
    { enabled: !!detail?.report?.id },
  );

  const { data: diff } = useApiQuery<DiffData>(
    ['report-diff', detail?.report?.id, detail?.newReport?.id],
    `repair-reports/${detail?.report?.id}/diff?compareWith=${detail?.newReport?.id ?? ''}`,
    { enabled: !!(detail?.report?.id && detail?.newReport?.id) },
  );

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: ['revision-request', id] });
    queryClient.invalidateQueries({ queryKey: ['revision-requests'] });
  };

  const startMutation = useApiMutation<unknown, object>(
    `revision-requests/${id}/start-revision`,
    'post',
    { onSuccess: invalidateDetail },
  );

  const completeMutation = useApiMutation<unknown, { newReportId: string; responseNote?: string }>(
    `revision-requests/${id}/complete`,
    'post',
    { onSuccess: invalidateDetail },
  );

  const statusMutation = useApiMutation<unknown, { status: string; responseNote?: string }>(
    `revision-requests/${id}/status`,
    'patch',
    { onSuccess: invalidateDetail },
  );

  const messageMutation = useApiMutation<Message, { message: string }>(
    `revision-requests/${id}/messages`,
    'post',
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['revision-request', id] });
      },
    },
  );

  // Scroll to bottom on new messages
  const messages = detail?.messages ?? [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleAction = async (action: 'start' | 'approve' | 'reject') => {
    setActionError(null);
    try {
      if (action === 'start') {
        await startMutation.mutateAsync({});
      } else if (action === 'approve' && detail?.newReport) {
        await completeMutation.mutateAsync({ newReportId: detail.newReport.id });
      } else if (action === 'reject') {
        await statusMutation.mutateAsync({ status: 'REJECTED' });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setActionError(e?.message ?? 'İşlem sırasında hata oluştu.');
    }
  };

  const handleSendMessage = async () => {
    if (!msgInput.trim()) return;
    const content = msgInput.trim();
    setMsgInput('');
    try {
      await messageMutation.mutateAsync({ message: content });
    } catch {
      setMsgInput(content);
    }
  };

  const actionLoading = startMutation.isPending || completeMutation.isPending || statusMutation.isPending;

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="h-64 bg-slate-100 rounded-xl" />
            <div className="h-48 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-96 bg-slate-100 rounded-xl" />
          <div className="h-96 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (pageError || !detail) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-400">{pageError ? 'Revizyon talebi yüklenirken hata oluştu.' : 'Revizyon talebi bulunamadı.'}</p>
        <button type="button" onClick={() => router.push('/panel/revizyon-talepleri')} className="mt-4 text-sm text-blue-600 hover:text-blue-700">
          ← Geri Dön
        </button>
      </div>
    );
  }

  const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.status === detail.status);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => router.push('/panel/revizyon-talepleri')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">{detail.report?.reportNo ?? 'Rapor'}</h2>
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[detail.status]}`}>
              {detail.status === 'ESCALATED' && <span className="mr-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />}
              {STATUS_LABELS[detail.status]}
            </span>
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[detail.priority]}`}>
              {PRIORITY_LABELS[detail.priority]}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            v{detail.report?.versionNo ?? 1}
            {detail.newReport && <span className="ml-2">→ v{detail.newReport.versionNo} ({detail.newReport.reportNo})</span>}
          </p>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-5">

        {/* ── Left Panel: Revizyon Bilgileri ──────────────────────────────── */}
        <div className="space-y-4">
          {/* Talep Bilgileri */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              Talep Bilgileri
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Talep Eden</p>
                <p className="font-medium text-slate-700">{detail.requestedBy.firstName} {detail.requestedBy.lastName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Talep Tarihi</p>
                <p className="text-slate-700">{fmtDate(detail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Sebep</p>
                <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-xs font-medium">
                  {REASON_LABELS[detail.reason] ?? detail.reason}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Açıklama</p>
                <p className="text-slate-700 text-xs leading-relaxed">{detail.reasonNote}</p>
              </div>
              {detail.deadlineAt && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Son Tarih</p>
                  <p className={`text-sm font-medium ${new Date(detail.deadlineAt) < new Date() ? 'text-red-600' : 'text-slate-700'}`}>
                    {fmtDate(detail.deadlineAt)}
                  </p>
                </div>
              )}
              {detail.assignedTo && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Atanan</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold">
                      {detail.assignedTo.firstName.charAt(0)}
                    </div>
                    <span className="text-slate-700 text-sm">{detail.assignedTo.firstName} {detail.assignedTo.lastName}</span>
                  </div>
                </div>
              )}
              {detail.responseNote && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Yanıt Notu</p>
                  <p className="text-slate-700 text-xs leading-relaxed bg-slate-50 p-2 rounded-lg">{detail.responseNote}</p>
                </div>
              )}
            </div>
          </div>

          {/* Durum Akışı Timeline */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              Durum Akışı
            </h3>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const isDone = currentStepIndex > idx || (detail.status === step.status && step.status === 'COMPLETED');
                const isCurrent = detail.status === step.status;
                const isLast = idx === TIMELINE_STEPS.length - 1;
                return (
                  <div key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                        isDone || isCurrent
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-300'
                      }`}>
                        {isDone || isCurrent ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 h-6 mt-1 mb-1 ${isDone ? 'bg-blue-600' : 'bg-slate-100'}`} />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-blue-700' : isDone ? 'text-slate-700' : 'text-slate-300'}`}>
                        {step.label}
                      </p>
                      {isCurrent && <p className="text-xs text-blue-500 mt-0.5">Mevcut durum</p>}
                    </div>
                  </div>
                );
              })}
              {(detail.status === 'REJECTED' || detail.status === 'ESCALATED') && (
                <div className="flex gap-3 mt-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500 border-2 border-red-500 text-white">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-red-600">{STATUS_LABELS[detail.status]}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              Aksiyonlar
            </h3>
            {actionError && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {actionError}
              </div>
            )}
            <div className="space-y-2">
              {detail.status === 'REQUESTED' && (
                <button
                  type="button"
                  onClick={() => handleAction('start')}
                  disabled={actionLoading}
                  className="w-full bg-blue-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {actionLoading ? 'İşleniyor...' : 'Revizyonu Başlat'}
                </button>
              )}
              {(detail.status === 'REQUESTED' || detail.status === 'IN_PROGRESS') && (
                <>
                  {detail.status === 'IN_PROGRESS' && detail.newReport && (
                    <button
                      type="button"
                      onClick={() => handleAction('approve')}
                      disabled={actionLoading}
                      className="w-full bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      {actionLoading ? 'İşleniyor...' : 'Tamamla / Onayla'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="w-full bg-white text-red-600 border border-red-200 text-sm px-4 py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors font-medium"
                  >
                    {actionLoading ? 'İşleniyor...' : 'Reddet'}
                  </button>
                </>
              )}
              {(detail.status === 'COMPLETED' || detail.status === 'REJECTED') && (
                <p className="text-xs text-slate-400 text-center py-2">Bu revizyon talebi kapatıldı.</p>
              )}
            </div>
          </div>

          {/* Versiyon Geçmişi */}
          {versions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-purple-500" />
                Versiyon Geçmişi
              </h3>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${v.id === detail.report.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                    <div>
                      <p className="font-medium text-slate-700">v{v.versionNo} — {v.reportNo}</p>
                      <p className="text-slate-400">{fmtDate(v.createdAt)}</p>
                    </div>
                    <span className="text-slate-500">{fmtCurrency(v.totalSalesAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Middle Panel: Diff / Versions Tab ────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('diff')}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'diff' ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Değişiklik Özeti
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('versions')}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'versions' ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Versiyonlar ({versions.length})
              </button>
            </div>
            {diff && activeTab === 'diff' && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-400">Eski: <span className="font-semibold text-slate-700">{fmtCurrency(diff.summary.oldTotal)}</span></span>
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-slate-400">Yeni: <span className="font-semibold text-slate-700">{fmtCurrency(diff.summary.newTotal)}</span></span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${diff.summary.difference > 0 ? 'bg-green-50 text-green-700' : diff.summary.difference < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                  {diff.summary.difference > 0 ? '↑' : diff.summary.difference < 0 ? '↓' : '='} {fmtCurrency(Math.abs(diff.summary.difference))}
                </span>
              </div>
            )}
          </div>

          {activeTab === 'diff' && (
            <>
              {!diff ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  {detail.newReport ? 'Diff hesaplanıyor...' : 'Henüz revize rapor oluşturulmadı — diff mevcut değil.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kalem</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Eski</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Yeni</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {diff.changes.map((item, idx) => {
                        const rowBg = item.type === 'added' ? 'bg-emerald-50/60' : item.type === 'removed' ? 'bg-red-50/60' : item.type === 'changed' ? 'bg-amber-50/40' : '';
                        const numOld = typeof item.oldValue === 'number' ? item.oldValue : null;
                        const numNew = typeof item.newValue === 'number' ? item.newValue : null;
                        const diffVal = numOld != null && numNew != null ? numNew - numOld : null;

                        return (
                          <tr key={idx} className={rowBg}>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {item.type === 'added' && <span className="text-emerald-600 text-xs font-bold bg-emerald-100 px-1.5 rounded">+</span>}
                                {item.type === 'removed' && <span className="text-red-600 text-xs font-bold bg-red-100 px-1.5 rounded">−</span>}
                                {item.type === 'changed' && <span className="text-amber-600 text-xs font-bold bg-amber-100 px-1.5 rounded">~</span>}
                                <span className={`text-sm font-medium ${item.type === 'removed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {item.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-500">
                              {item.oldValue != null ? String(item.oldValue) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                              {item.newValue != null ? String(item.newValue) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {diffVal != null && diffVal !== 0 && (
                                <span className={`text-xs font-semibold ${diffVal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {diffVal > 0 ? '+' : ''}{diffVal}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Legend */}
              {diff && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 inline-block" /> Değişti</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-100 inline-block" /> Eklendi</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 inline-block" /> Silindi</span>
                </div>
              )}
            </>
          )}

          {activeTab === 'versions' && (
            <div className="p-5">
              {versions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Versiyon bilgisi yok</div>
              ) : (
                <div className="space-y-3">
                  {versions.map((v, idx) => (
                    <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        v{v.versionNo}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{v.reportNo}</p>
                        <p className="text-xs text-slate-400">{fmtDate(v.createdAt)} · {v.status}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{fmtCurrency(v.totalSalesAmount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Panel: Mesajlaşma Thread ───────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col" style={{ maxHeight: '75vh', minHeight: '400px' }}>
          <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              Mesajlaşma
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{messages.length} mesaj</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-300 text-xs py-8">Henüz mesaj yok</div>
            )}
            {messages.map((msg) => {
              const currentUserId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') ?? '{}')?.id : null;
              const isMe = msg.senderId === currentUserId;

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {!isMe && (
                      <span className="text-xs text-slate-400 ml-1">{msg.sender.firstName} {msg.sender.lastName}</span>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    }`}>
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-slate-300 mx-1">{fmtDateTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {(detail.status === 'REQUESTED' || detail.status === 'IN_PROGRESS' || detail.status === 'ESCALATED') && (
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100">
              <div className="flex items-end gap-2">
                <textarea
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Mesaj yazın... (Enter ile gönder)"
                  rows={2}
                  className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={messageMutation.isPending || !msgInput.trim()}
                  className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
