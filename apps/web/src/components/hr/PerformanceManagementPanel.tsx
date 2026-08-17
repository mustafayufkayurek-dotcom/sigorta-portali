'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  X,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { PerformanceKpiBoard } from '@/components/hr/PerformanceKpiBoard';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  SortablePanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { formatTryAmount } from '@/utils/format-try-amount';



// ── Types ────────────────────────────────────────────────────────────────────

interface StaffWorkload {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: { name: string; code: string };
  activeCount: number;
  completedThisMonth: number;
  completedToday?: number;
  pendingApproval: number;
  assignments?: AssignedFile[];
}

interface ApprovalRequestEvent {
  id: string;
  type: string;
  message: string;
  at: string;
}

interface PendingApproval {
  id: string;
  fileNumber: string;
  claimFileId: string;
  assignedUserId: string;
  assignedUser?: { firstName: string; lastName: string };
  assignedBy?: { firstName: string; lastName: string } | null;
  jobType?: string;
  workType?: string;
  amount?: number | null;
  delayHours?: number;
  delayLabel?: string;
  createdAt: string;
  timeoutAt?: string;
  requestCount?: number;
  firstRequestedAt?: string;
  lastRequestedAt?: string;
  requests?: ApprovalRequestEvent[];
}

interface AssignmentRule {
  id: string;
  isActive: boolean;
  jobGroup?: { id: string; name: string };
  region?: string;
  assignedUser?: { id: string; firstName: string; lastName: string };
  priority?: number;
}

interface AssignedFile {
  id: string;
  fileNumber: string;
  status: string;
  customer?: { firstName?: string; lastName?: string; companyName?: string };
  createdAt: string;
}

interface TeamStats {
  totalActive: number;
  completedToday: number;
  avgClosingDays: number;
  timeoutThisWeek: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function workloadColor(count: number): { border: string; bg: string; badge: string; label: string; dot: string } {
  if (count <= 3) return {
    border: 'border-green-400',
    bg: 'bg-green-50',
    badge: 'bg-green-100 text-green-800',
    label: 'Müsait',
    dot: 'bg-green-500',
  };
  if (count <= 6) return {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-800',
    label: 'Normal',
    dot: 'bg-yellow-500',
  };
  return {
    border: 'border-red-400',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
    label: 'Aşırı Yük',
    dot: 'bg-status-danger',
  };
}

function waitingHours(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Az önce';
  if (hours < 24) return `${hours} saat`;
  return `${Math.floor(hours / 24)} gün`;
}

function formatDateTimeTR(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestTypeLabel(type: string): string {
  switch (type) {
    case 'ASSIGNMENT':
      return 'Onay Talebi';
    case 'REMINDER':
      return 'Hatırlatma';
    case 'TIMEOUT_WARNING':
      return 'Süre Uyarısı';
    case 'ESCALATION':
      return 'Eskalasyon';
    case 'OVERDUE':
      return 'Gecikme';
    default:
      return 'Bildirim';
  }
}

function normalizePendingApproval(raw: Record<string, unknown>): PendingApproval {
  const claimFile = (raw.claimFile as Record<string, unknown> | undefined) ?? undefined;
  const assignedTo = (raw.assignedTo as PendingApproval['assignedUser']) ?? undefined;
  const assignedUser = (raw.assignedUser as PendingApproval['assignedUser']) ?? assignedTo;
  const requests = (raw.requests as ApprovalRequestEvent[] | undefined) ?? undefined;
  const createdAt = String(raw.createdAt ?? '');
  return {
    id: String(raw.id ?? ''),
    fileNumber: String(raw.fileNumber ?? claimFile?.fileNo ?? ''),
    claimFileId: String(raw.claimFileId ?? claimFile?.id ?? ''),
    assignedUserId: String(raw.assignedUserId ?? (assignedTo as { id?: string } | undefined)?.id ?? ''),
    assignedUser: assignedUser ?? undefined,
    assignedBy: (raw.assignedBy as PendingApproval['assignedBy']) ?? null,
    jobType: (raw.jobType as string | undefined) ?? (raw.workType as string | undefined),
    workType: raw.workType as string | undefined,
    amount: (raw.amount as number | null | undefined) ?? null,
    delayHours: raw.delayHours as number | undefined,
    delayLabel: (raw.delayLabel as string | undefined) ?? (createdAt ? waitingHours(createdAt) : '—'),
    createdAt,
    timeoutAt: raw.timeoutAt as string | undefined,
    requestCount: (raw.requestCount as number | undefined) ?? requests?.length ?? (createdAt ? 1 : 0),
    firstRequestedAt: (raw.firstRequestedAt as string | undefined) ?? createdAt,
    lastRequestedAt: (raw.lastRequestedAt as string | undefined) ?? createdAt,
    requests:
      requests ??
      (createdAt
        ? [
            {
              id: `created-${String(raw.id ?? '')}`,
              type: 'ASSIGNMENT',
              message: 'Onay talebi oluşturuldu',
              at: createdAt,
            },
          ]
        : []),
  };
}

/** Lokal tasarım önizlemesi: /panel/personel-ozluk?tab=performance&tasarim=1 */
const DESIGN_PREVIEW_APPROVALS: PendingApproval[] = [
  {
    id: 'preview-1',
    fileNumber: 'HSR-2026-0142',
    claimFileId: 'preview-claim-1',
    assignedUserId: 'preview-user-1',
    assignedUser: { firstName: 'Ayşe', lastName: 'Yılmaz' },
    assignedBy: { firstName: 'Sistem', lastName: 'Yöneticisi' },
    amount: 48500,
    delayHours: 26,
    delayLabel: '1 gün',
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    timeoutAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    requestCount: 3,
    firstRequestedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    lastRequestedAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    requests: [
      {
        id: 'r1',
        type: 'ASSIGNMENT',
        message: 'Onay talebi oluşturuldu',
        at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      },
      {
        id: 'r2',
        type: 'REMINDER',
        message: 'Onay hatırlatması gönderildi',
        at: new Date(Date.now() - 12 * 3_600_000).toISOString(),
      },
      {
        id: 'r3',
        type: 'TIMEOUT_WARNING',
        message: 'Süre aşımı uyarısı',
        at: new Date(Date.now() - 4 * 3_600_000).toISOString(),
      },
    ],
  },
  {
    id: 'preview-2',
    fileNumber: 'ACL-2026-0088',
    claimFileId: 'preview-claim-2',
    assignedUserId: 'preview-user-2',
    assignedUser: { firstName: 'Mehmet', lastName: 'Demir' },
    assignedBy: { firstName: 'Sistem', lastName: 'Yöneticisi' },
    amount: 12300,
    delayHours: 5,
    delayLabel: '5 saat',
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    timeoutAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    requestCount: 1,
    firstRequestedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    lastRequestedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    requests: [
      {
        id: 'r4',
        type: 'ASSIGNMENT',
        message: 'Onay talebi oluşturuldu',
        at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
      },
    ],
  },
  {
    id: 'preview-3',
    fileNumber: 'HSR-2026-0201',
    claimFileId: 'preview-claim-3',
    assignedUserId: 'preview-user-3',
    assignedUser: { firstName: 'Elif', lastName: 'Kaya' },
    amount: null,
    delayHours: 0,
    delayLabel: 'Az önce',
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    timeoutAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    requestCount: 1,
    firstRequestedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    lastRequestedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    requests: [
      {
        id: 'r5',
        type: 'ASSIGNMENT',
        message: 'Onay talebi oluşturuldu',
        at: new Date(Date.now() - 20 * 60_000).toISOString(),
      },
    ],
  },
];

// ── Approval Detail Slide Panel ───────────────────────────────────────────────

function ApprovalDetailPanel({
  approval,
  onClose,
}: {
  approval: PendingApproval | null;
  onClose: () => void;
}) {
  if (!approval) return null;
  const staffName = approval.assignedUser
    ? `${approval.assignedUser.firstName} ${approval.assignedUser.lastName}`
    : '—';
  const requested = (approval.requestCount ?? 0) > 0 || (approval.requests?.length ?? 0) > 0;
  const events = approval.requests ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[100vw] flex-col bg-white shadow-2xl">
        <div className="border-b border-border bg-slate-50/80 px-6 py-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-content-primary">
                  {approval.fileNumber || 'Dosya'}
                </p>
                <p className="text-xs text-content-secondary">{staffName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-slate-100 hover:text-content-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-white px-3 py-2.5 text-center">
              <p className="text-xs text-content-tertiary">Bedel</p>
              <p className="mt-0.5 text-sm font-semibold text-content-primary">
                {approval.amount != null ? formatTryAmount(approval.amount, { fractionDigits: 0 }) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white px-3 py-2.5 text-center">
              <p className="text-xs text-content-tertiary">Gecikme</p>
              <p className="mt-0.5 text-sm font-semibold text-status-warning">
                {approval.delayLabel ?? waitingHours(approval.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-3 text-xs font-semibold text-content-secondary">Onay Talebi</p>
          {requested ? (
            <div className="mb-5 rounded-xl border border-border bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Talep Edilmiş
                </span>
                <span className="rounded-full bg-brand-600/10 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {approval.requestCount ?? events.length} Defa
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">İlk Talep</dt>
                  <dd className="font-medium text-content-primary">
                    {formatDateTimeTR(approval.firstRequestedAt ?? approval.createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">Son Talep</dt>
                  <dd className="font-medium text-content-primary">
                    {formatDateTimeTR(approval.lastRequestedAt ?? approval.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-dashed border-border bg-slate-50/40 px-4 py-6 text-center">
              <p className="text-sm font-medium text-content-secondary">Onay Talebi Kaydı Yok</p>
              <p className="mt-1 text-xs text-content-tertiary">Bu atama için henüz talep geçmişi bulunamadı.</p>
            </div>
          )}

          <p className="mb-3 text-xs font-semibold text-content-secondary">Talep Geçmişi</p>
          {events.length === 0 ? (
            <p className="text-sm text-content-tertiary">Kayıt bulunamadı.</p>
          ) : (
            <ol className="space-y-3">
              {events.map((ev, idx) => (
                <li
                  key={ev.id}
                  className="relative rounded-xl border border-border bg-white px-4 py-3 pl-10"
                >
                  <span className="absolute left-3 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-content-primary">{requestTypeLabel(ev.type)}</p>
                  <p className="mt-0.5 text-xs text-content-secondary">{formatDateTimeTR(ev.at)}</p>
                  {ev.message ? (
                    <p className="mt-1.5 text-xs text-content-tertiary">{ev.message}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

// ── Staff Detail Slide Panel ──────────────────────────────────────────────────

function StaffDetailPanel({ staff, onClose }: { staff: StaffWorkload | null; onClose: () => void }) {
  if (!staff) return null;
  const wl = workloadColor(staff.activeCount);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className={`px-6 py-5 border-b border-slate-100 ${wl.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold border-2 ${wl.border} bg-white`}>
                <span className={`${wl.dot === 'bg-green-500' ? 'text-green-600' : wl.dot === 'bg-yellow-500' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{staff.firstName} {staff.lastName}</p>
                <p className="text-xs text-slate-500">{staff.role?.name ?? 'Personel'}</p>

              </div>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/80 rounded-lg p-2.5 text-center border border-white">
              <p className="text-lg font-bold text-slate-800">{staff.activeCount}</p>
              <p className="text-xs text-slate-500">Aktif</p>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center border border-white">
              <p className="text-lg font-bold text-slate-800">{staff.completedThisMonth}</p>
              <p className="text-xs text-slate-500">Bu Ay</p>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center border border-white">
              <p className="text-lg font-bold text-slate-800">{staff.pendingApproval}</p>
              <p className="text-xs text-slate-500">Onay Bekliyor</p>
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold text-slate-500 tracking-wide mb-3">Atanmış Dosyalar</p>
          {!staff.assignments || staff.assignments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2 text-xl">📂</div>
              <p className="text-sm text-slate-400">Atanmış Dosya Yok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.assignments.map((f) => {
                const customerName = f.customer
                  ? (f.customer.companyName ?? `${f.customer.firstName ?? ''} ${f.customer.lastName ?? ''}`.trim())
                  : '—';
                const statusColor = f.status === 'open' ? 'bg-blue-50 text-blue-700' :
                  f.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700' :
                  f.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-700';
                const statusLabel = f.status === 'open' ? 'Açık' : f.status === 'in_progress' ? 'İşlemde' : f.status === 'closed' ? 'Kapalı' : f.status;
                return (
                  <div key={f.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{f.fileNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{customerName}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add Rule Modal ────────────────────────────────────────────────────────────

interface JobGroup { id: string; name: string }
interface UserOption { id: string; firstName: string; lastName: string }

function AddRuleModal({
  onClose,
  onSave,
  jobGroups,
  users,
}: {
  onClose: () => void;
  onSave: (data: { jobGroupId: string; region: string; userId: string; priority: number }) => Promise<void>;
  jobGroups: JobGroup[];
  users: UserOption[];
}) {
  const [form, setForm] = useState({ jobGroupId: '', region: '', userId: '', priority: 1 });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.jobGroupId || !form.userId) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-600 to-blue-700">
            <div>
              <h3 className="text-base font-semibold text-white">Yeni Kural Ekle</h3>
              <p className="text-blue-200 text-xs mt-0.5">Otomatik Atama Kuralı Tanımlayın</p>
            </div>
            <button type="button" onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">İş Grubu <span className="text-red-400">*</span></label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={form.jobGroupId} onChange={(e) => setForm((p) => ({ ...p, jobGroupId: e.target.value }))}>
                <option value="">Seçin...</option>
                {jobGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Bölge (Opsiyonel)</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                placeholder="Örn: İstanbul, Ankara..." value={form.region}
                onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Personel <span className="text-red-400">*</span></label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}>
                <option value="">Seçin...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Öncelik (1 = En Yüksek)</label>
              <input type="number" min={1} max={100} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-2 px-6 py-4 border-t border-slate-100 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSubmit} disabled={saving || !form.jobGroupId || !form.userId}
              className="px-5 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 flex items-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              Kuralı Kaydet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Geciken Dosyalar Tab ──────────────────────────────────────────────────────

type EscalationLevel = 'warning' | 'critical' | 'escalation';

interface OverdueAssignment {
  id: string;
  daysSinceUpdate: number;
  escalationLevel: EscalationLevel;
  updatedAt: string;
  claimFile: { id: string; fileNo: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string; email: string } | null;
}

const LEVEL_CONFIG: Record<EscalationLevel, { label: string; rowCls: string; badgeCls: string; dotCls: string }> = {
  warning: {
    label: 'Uyarı',
    rowCls: 'bg-yellow-50 border-l-4 border-yellow-400',
    badgeCls: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    dotCls: 'bg-yellow-400',
  },
  critical: {
    label: 'Kritik',
    rowCls: 'bg-red-50 border-l-4 border-status-danger',
    badgeCls: 'bg-red-100 text-red-800 border border-red-300',
    dotCls: 'bg-status-danger',
  },
  escalation: {
    label: 'Eskalasyon',
    rowCls: 'bg-slate-900 border-l-4 border-slate-700',
    badgeCls: 'bg-slate-800 text-slate-100 border border-slate-600',
    dotCls: 'bg-slate-400',
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'workload' | 'approvals' | 'rules' | 'assign' | 'overdue' | 'report-write';

interface ReportWriteUserStat {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  sessionCount: number;
  totalDurationSec: number;
  avgDurationSec: number;
  lastSessionAt: string;
}

const APPROVALS_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'staff', label: 'Personel', defaultWidth: 160, minWidth: 120 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 140, minWidth: 110 },
  { id: 'amount', label: 'Bedel', defaultWidth: 120, minWidth: 96 },
  { id: 'waiting', label: 'Gecikme Süresi', defaultWidth: 120, minWidth: 96 },
  { id: 'requests', label: 'Talep', defaultWidth: 90, minWidth: 72 },
];

const RULES_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'jobGroup', label: 'İş Grubu', defaultWidth: 160, minWidth: 120 },
  { id: 'region', label: 'Bölge', defaultWidth: 140, minWidth: 100 },
  { id: 'staff', label: 'Personel', defaultWidth: 160, minWidth: 120 },
  { id: 'priority', label: 'Öncelik', defaultWidth: 90, minWidth: 72 },
  { id: 'status', label: 'Durum', defaultWidth: 90, minWidth: 72 },
];

const OVERDUE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'staff', label: 'Personel', defaultWidth: 160, minWidth: 120 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'days', label: 'Gün Sayısı', defaultWidth: 100, minWidth: 80 },
  { id: 'lastAction', label: 'Son İşlem Tarihi', defaultWidth: 160, minWidth: 120 },
];

type PerformanceManagementPanelProps = {
  /** Personel sayfası içinde gömülü — üst başlık/breadcrumb yok */
  embedded?: boolean;
  /** Zorla tasarım önizleme (URL bağımsız) */
  preview?: boolean;
};

export function PerformanceManagementPanel({
  embedded = false,
  preview = false,
}: PerformanceManagementPanelProps) {
  const { showToast } = useToast();
  const approvalsTableColumns = usePanelTableColumns('table-cols:personel-onaylar', APPROVALS_TABLE_COLUMNS);
  const rulesTableColumns = usePanelTableColumns('table-cols:personel-kurallar', RULES_TABLE_COLUMNS);
  const overdueTableColumns = usePanelTableColumns('table-cols:personel-geciken', OVERDUE_TABLE_COLUMNS);

  const [activeTab, setActiveTab] = useState<Tab>('workload');
  const [workload, setWorkload] = useState<StaffWorkload[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [stats, setStats] = useState<TeamStats>({ totalActive: 0, completedToday: 0, avgClosingDays: 0, timeoutThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Geciken dosyalar
  const [overdueList, setOverdueList] = useState<OverdueAssignment[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<'all' | EscalationLevel>('all');
  const [escalationRules, setEscalationRules] = useState({ warningDays: 3, criticalDays: 7, escalationDays: 14 });

  const [selectedStaff, setSelectedStaff] = useState<StaffWorkload | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [designPreview, setDesignPreview] = useState(preview);

  // Quick assign
  const [assignSearch, setAssignSearch] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignPriority, setAssignPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assigning, setAssigning] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; fileNumber: string; customer?: { firstName?: string; lastName?: string; companyName?: string } }[]>([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Rules
  const [showAddRule, setShowAddRule] = useState(false);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // Bulk approve state
  const [approvingAll, setApprovingAll] = useState(false);
  const [approvalAction, setApprovalAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [writeStats, setWriteStats] = useState<ReportWriteUserStat[]>([]);
  const [writeStatsLoading, setWriteStatsLoading] = useState(false);
  const [clientSortApprovals, setClientSortApprovals] = useState<ClientSortState>(null);
  const [clientSortRules, setClientSortRules] = useState<ClientSortState>(null);
  const [clientSortOverdue, setClientSortOverdue] = useState<ClientSortState>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const [workloadError, setWorkloadError] = useState('');

  const loadWorkload = useCallback(async () => {
    setLoading(true);
    setWorkloadError('');
    try {
      const r = await axios.get(`${API}/task-assignments/team-workload`, { headers: authHeader() });
      const data: StaffWorkload[] = r.data.data ?? r.data ?? [];
      setWorkload(Array.isArray(data) ? data : []);
      setUserOptions(
        (Array.isArray(data) ? data : []).map((s) => ({
          id: s.userId,
          firstName: s.firstName,
          lastName: s.lastName,
        })),
      );

      const totalActive = data.reduce((sum, s) => sum + (s.activeCount ?? 0), 0);
      const completedToday = data.reduce(
        (sum, s) => sum + (s.completedToday ?? 0),
        0,
      );
      setStats((p) => ({ ...p, totalActive, completedToday }));
    } catch {
      setWorkload([]);
      setWorkloadError('İş yükü verisi alınamadı. Yenileyip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const r = await axios.get(`${API}/task-assignments/pending-approvals`, { headers: authHeader() });
      const rows = r.data.data ?? r.data ?? [];
      setPendingApprovals(
        Array.isArray(rows)
          ? rows.map((row: Record<string, unknown>) => normalizePendingApproval(row))
          : [],
      );
    } catch {
      setPendingApprovals([]);
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const r = await axios.get(`${API}/assignment-rules`, { headers: authHeader() });
      setRules(r.data.data ?? r.data ?? []);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const loadJobGroups = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/job-groups?limit=100`, { headers: authHeader() });
      setJobGroups(r.data.data ?? r.data ?? []);
    } catch { /* silent */ }
  }, []);

  const loadOverdue = useCallback(async () => {
    setOverdueLoading(true);
    try {
      const [overdueRes, rulesRes] = await Promise.all([
        axios.get(`${API}/task-assignments/overdue`, { headers: authHeader() }),
        axios.get(`${API}/task-assignments/escalation-rules`, { headers: authHeader() }),
      ]);
      setOverdueList(overdueRes.data.data ?? []);
      if (rulesRes.data.data) setEscalationRules(rulesRes.data.data);
    } catch {
      setOverdueList([]);
    } finally {
      setOverdueLoading(false);
    }
  }, []);

  const loadWriteStats = useCallback(async () => {
    setWriteStatsLoading(true);
    try {
      const r = await axios.get(`${API}/repair-reports/write-analytics?days=30`, { headers: authHeader() });
      setWriteStats(r.data.data?.byUser ?? []);
    } catch {
      setWriteStats([]);
    } finally {
      setWriteStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkload();
    loadApprovals();
  }, [loadWorkload, loadApprovals]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tasarim') === '1';
    const isPreview = preview || fromUrl;
    setDesignPreview(isPreview);
    if (isPreview) setActiveTab('approvals');
  }, [preview]);

  useEffect(() => {
    if (activeTab === 'rules') { loadRules(); loadJobGroups(); }
    if (activeTab === 'overdue') { loadOverdue(); }
    if (activeTab === 'report-write') { loadWriteStats(); }
  }, [activeTab, loadRules, loadJobGroups, loadOverdue, loadWriteStats]);

  // ── Search files for quick assign ───────────────────────────────────────────

  useEffect(() => {
    if (!assignSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await axios.get(`${API}/claim-files?search=${encodeURIComponent(assignSearch.trim())}&limit=10`, { headers: authHeader() });
        setSearchResults(r.data.data ?? []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [assignSearch]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    setApprovalAction({ id, action: 'approve' });
    setActionLoading(true);
    try {
      await axios.patch(`${API}/task-assignments/${id}/approve`, {}, { headers: authHeader() });
      showToast('success', 'Atama Onaylandı');
      setPendingApprovals((p) => p.filter((a) => a.id !== id));
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Onaylama Başarısız');
    } finally {
      setActionLoading(false);
      setApprovalAction(null);
    }
  };

  const handleReject = async (id: string) => {
    setApprovalAction({ id, action: 'reject' });
    setActionLoading(true);
    try {
      await axios.patch(`${API}/task-assignments/${id}/reject`, {}, { headers: authHeader() });
      showToast('success', 'Atama Reddedildi');
      setPendingApprovals((p) => p.filter((a) => a.id !== id));
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Reddetme Başarısız');
    } finally {
      setActionLoading(false);
      setApprovalAction(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      await Promise.all(pendingApprovals.map((a) =>
        axios.patch(`${API}/task-assignments/${a.id}/approve`, {}, { headers: authHeader() })
      ));
      showToast('success', `${pendingApprovals.length} Atama Onaylandı`);
      setPendingApprovals([]);
    } catch {
      showToast('error', 'Toplu Onay Başarısız');
    } finally {
      setApprovingAll(false);
    }
  };

  const handleToggleRule = async (id: string, current: boolean) => {
    try {
      await axios.patch(`${API}/assignment-rules/${id}`, { isActive: !current }, { headers: authHeader() });
      setRules((p) => p.map((r) => r.id === id ? { ...r, isActive: !current } : r));
      showToast('success', `Kural ${!current ? 'Aktif' : 'Pasif'} Edildi`);
    } catch {
      showToast('error', 'Kural Güncellenemedi');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await axios.delete(`${API}/assignment-rules/${id}`, { headers: authHeader() });
      setRules((p) => p.filter((r) => r.id !== id));
      showToast('success', 'Kural Silindi');
    } catch {
      showToast('error', 'Kural Silinemedi');
    }
  };

  const handleAddRule = async (data: { jobGroupId: string; region: string; userId: string; priority: number }) => {
    await axios.post(`${API}/assignment-rules`, data, { headers: authHeader() });
    showToast('success', 'Kural Eklendi');
    loadRules();
  };

  const handleAssign = async () => {
    if (!selectedFileId || !assignUserId) { showToast('warning', 'Dosya ve Personel Seçiniz'); return; }
    setAssigning(true);
    try {
      await axios.post(`${API}/task-assignments`, {
        claimFileId: selectedFileId,
        assignedUserId: assignUserId,
        priority: assignPriority,
      }, { headers: authHeader() });
      showToast('success', 'Dosya Başarıyla Atandı');
      setAssignSearch('');
      setSelectedFileId('');
      setAssignUserId('');
      setSearchResults([]);
      loadWorkload();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Atama Başarısız');
    } finally {
      setAssigning(false);
    }
  };

  // ── Geciken dosyalar helpers ─────────────────────────────────────────────────

  const overdueCounts = {
    warning: overdueList.filter((a) => a.escalationLevel === 'warning').length,
    critical: overdueList.filter((a) => a.escalationLevel === 'critical').length,
    escalation: overdueList.filter((a) => a.escalationLevel === 'escalation').length,
  };
  const overdueTotal = overdueCounts.warning + overdueCounts.critical + overdueCounts.escalation;
  const filteredOverdue = filterLevel === 'all' ? overdueList : overdueList.filter((a) => a.escalationLevel === filterLevel);

  const displayApprovals = useMemo(() => {
    if (designPreview && pendingApprovals.length === 0) return DESIGN_PREVIEW_APPROVALS;
    return pendingApprovals;
  }, [designPreview, pendingApprovals]);

  const sortedPendingApprovals = useMemo(
    () =>
      sortRowsByClientSort(displayApprovals, clientSortApprovals, (a, key) => {
        switch (key) {
          case 'fileNo': return a.fileNumber ?? a.claimFileId ?? '';
          case 'staff': return a.assignedUser ? `${a.assignedUser.firstName} ${a.assignedUser.lastName}` : '';
          case 'amount': return a.amount ?? -1;
          case 'waiting': return a.delayHours ?? new Date(a.createdAt).getTime();
          case 'requests': return a.requestCount ?? a.requests?.length ?? 0;
          default: return null;
        }
      }),
    [displayApprovals, clientSortApprovals],
  );

  const approvalCountForUi = displayApprovals.length;

  const sortedRules = useMemo(
    () =>
      sortRowsByClientSort(rules, clientSortRules, (rule, key) => {
        switch (key) {
          case 'jobGroup': return rule.jobGroup?.name ?? '';
          case 'region': return rule.region ?? '';
          case 'staff': return rule.assignedUser ? `${rule.assignedUser.firstName} ${rule.assignedUser.lastName}` : '';
          case 'priority': return rule.priority ?? 1;
          case 'status': return rule.isActive ? 1 : 0;
          default: return null;
        }
      }),
    [rules, clientSortRules],
  );

  const sortedFilteredOverdue = useMemo(
    () =>
      sortRowsByClientSort(filteredOverdue, clientSortOverdue, (a, key) => {
        switch (key) {
          case 'fileNo': return a.claimFile?.fileNo ?? '';
          case 'staff': return a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '';
          case 'status': return a.escalationLevel;
          case 'days': return a.daysSinceUpdate;
          case 'lastAction': return new Date(a.updatedAt).getTime();
          default: return null;
        }
      }),
    [filteredOverdue, clientSortOverdue],
  );

  // ── Stats helpers ────────────────────────────────────────────────────────────

  const available = workload.filter((s) => s.activeCount <= 3).length;
  const normal = workload.filter((s) => s.activeCount >= 4 && s.activeCount <= 6).length;
  const overloaded = workload.filter((s) => s.activeCount >= 7).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'workload',
      label: 'İş Yükü',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      key: 'approvals',
      label: 'Bekleyen Onaylar',
      badge: approvalCountForUi || undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'rules',
      label: 'Atama Kuralları',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'assign',
      label: 'Hızlı Atama',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      key: 'overdue' as Tab,
      label: 'Geciken Dosyalar',
      badge: overdueTotal || undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'report-write' as Tab,
      label: 'Rapor Yazım Süresi',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-6'}>
      {!embedded && (
        <>
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Personel</span>
        <span>/</span>
        <span className="text-slate-600 font-medium">Performans</span>
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Görev Ve Sorumluluk</h1>
            <p className="page-subtitle">Dosya Sorumlusu Çıktısı, Onay Ve İş Yükü</p>
          </div>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            onClick={() => { loadWorkload(); loadApprovals(); }}
            className="btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Yenile
          </button>
        </div>
      </div>
        </>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { loadWorkload(); loadApprovals(); }}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50"
          >
            Yenile
          </button>
        </div>
      )}

      <PerformanceKpiBoard preview={designPreview || preview} />

      <div className="space-y-4 border-t border-border pt-5">
        <div>
          <p className="text-sm font-semibold text-content-primary">Operasyon Yönetimi</p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            İş yükü, atama onayı ve dosya sorumlusu takibi
          </p>
        </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-slate-50/70 px-4 py-3">
          <p className="text-xs text-content-tertiary">Aktif Atama</p>
          <p className="mt-1 text-lg font-bold text-content-primary tabular-nums">
            {loading ? '—' : String(stats.totalActive)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-slate-50/70 px-4 py-3">
          <p className="text-xs text-content-tertiary">Bugün Tamamlanan</p>
          <p className="mt-1 text-lg font-bold text-content-primary tabular-nums">
            {loading ? '—' : String(stats.completedToday)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-slate-50/70 px-4 py-3">
          <p className="text-xs text-content-tertiary">Atama Onayı Bekleyen</p>
          <p className="mt-1 text-lg font-bold text-content-primary tabular-nums">
            {approvalsLoading ? '—' : String(approvalCountForUi)}
          </p>
        </div>
      </div>

      {designPreview ? (
        <div className="rounded-xl border border-brand-600/20 bg-brand-600/5 px-4 py-3 text-sm text-brand-800">
          Tasarım önizlemesi — örnek personel performans satırları gösteriliyor.
        </div>
      ) : null}

      {/* ── Pending Approvals Banner ─────────────────────────────────────────── */}
      {approvalCountForUi > 0 && activeTab !== 'approvals' && (
        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-status-warning/30 bg-status-warning/10 text-content-primary hover:bg-status-warning/15 transition-all text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-warning/20 text-status-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{approvalCountForUi} Atama Onay Bekliyor</p>
            <p className="mt-0.5 text-xs text-content-secondary">Tıklayarak Yönetin</p>
          </div>
          <svg className="w-4 h-4 text-content-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-0.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold px-1.5">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: İş Yükü ──────────────────────────────────────────────────── */}
        {activeTab === 'workload' && (
          <div className="p-6">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-5">
              <span className="text-xs text-slate-500 font-medium">Renk Kodu:</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Müsait (0–3)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Normal (4–6)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-full bg-status-danger inline-block" /> Aşırı Yük (7+)
              </span>
              <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
                <span className="font-medium text-green-700">{available} müsait</span>
                <span className="font-medium text-yellow-700">{normal} normal</span>
                <span className="font-medium text-red-700">{overloaded} yüklü</span>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-100 p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-200" />
                      <div className="flex-1">
                        <div className="h-3.5 bg-slate-200 rounded w-3/4 mb-1.5" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-10 bg-slate-100 rounded-lg" />
                      <div className="h-10 bg-slate-100 rounded-lg" />
                      <div className="h-10 bg-slate-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : workload.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  {workloadError ? 'Veri Alınamadı' : 'Personel Verisi Bulunamadı'}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {workloadError || 'Aktif ofis / saha personeli veya açık atama kaydı yok.'}
                </p>
                {workloadError ? (
                  <button
                    type="button"
                    onClick={() => loadWorkload()}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Tekrar Dene
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {workload.map((staff) => {
                  const wl = workloadColor(staff.activeCount);
                  return (
                    <button
                      key={staff.userId}
                      type="button"
                      onClick={() => setSelectedStaff(staff)}
                      className={`text-left rounded-xl border-2 p-4 hover:shadow-md transition-all cursor-pointer ${wl.border} ${wl.bg} hover:scale-[1.01]`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-sm font-bold text-slate-700 border border-slate-200 shadow-sm">
                            {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${wl.dot}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{staff.firstName} {staff.lastName}</p>
                          <p className="text-xs text-slate-500 truncate">{staff.role?.name ?? 'Personel'}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${wl.badge}`}>
                          {wl.label}
                        </span>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Aktif', value: staff.activeCount, strong: true },
                          { label: 'Bu Ay', value: staff.completedThisMonth, strong: false },
                          { label: 'Onay', value: staff.pendingApproval, strong: staff.pendingApproval > 0 },
                        ].map((m) => (
                          <div key={m.label} className="bg-white/70 rounded-lg p-2 text-center border border-white">
                            <p className={`text-base font-bold ${m.strong && m.value > 0 ? (m.label === 'Onay' ? 'text-orange-600' : 'text-slate-800') : 'text-slate-500'}`}>
                              {m.value}
                            </p>
                            <p className="text-xs text-slate-400">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Tıklayarak Detayları Görün
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Bekleyen Onaylar ────────────────────────────────────────── */}
        {activeTab === 'approvals' && (
          <div className="p-6">
            {approvalCountForUi > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-content-secondary">
                    <span className="font-bold text-status-warning">{approvalCountForUi}</span> Atama Onay Bekliyor
                  </p>
                  <p className="mt-0.5 text-xs text-content-tertiary">
                    Dosya satırına tıklayarak talep tarihi, saati ve tekrar sayısını görün
                  </p>
                </div>
                {!designPreview || pendingApprovals.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    disabled={approvingAll || (designPreview && pendingApprovals.length === 0)}
                    className="inline-flex items-center gap-2 rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {approvingAll ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Tümünü Onayla
                  </button>
                ) : null}
              </div>
            )}

            {approvalsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : approvalCountForUi === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-status-success/10 text-status-success">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="font-medium text-content-secondary">Bekleyen Onay Yok</p>
                <p className="mt-1 text-sm text-content-tertiary">Tüm Atamalar Onaylanmış Durumda</p>
                {process.env.NODE_ENV === 'development' ? (
                  <a
                    href="?tasarim=1"
                    className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Tasarım Önizlemesini Aç
                  </a>
                ) : null}
              </div>
            ) : (
              <TableColumnsProvider value={approvalsTableColumns}>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex justify-end gap-2 border-b border-border bg-slate-50/50 px-4 py-2">
                  <PanelTableColumnPicker tableColumns={approvalsTableColumns} />
                </div>
                <table className="w-full text-sm" style={panelTableLayoutStyle(approvalsTableColumns)}>
                  <thead>
                    <tr className="border-b border-border bg-slate-50/80">
                      <SortablePanelTableTh colId="staff" sortKey="staff" activeSortKey={clientSortApprovals?.key ?? null} sortDir={clientSortApprovals?.dir ?? 'asc'} onSort={(k) => setClientSortApprovals((p) => cycleClientSort(p, k))} className="px-4 py-3.5 text-center text-xs font-semibold text-content-tertiary">Personel</SortablePanelTableTh>
                      <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSortApprovals?.key ?? null} sortDir={clientSortApprovals?.dir ?? 'asc'} onSort={(k) => setClientSortApprovals((p) => cycleClientSort(p, k))} className="px-5 py-3.5 text-center text-xs font-semibold text-content-tertiary">Dosya No</SortablePanelTableTh>
                      <SortablePanelTableTh colId="amount" sortKey="amount" activeSortKey={clientSortApprovals?.key ?? null} sortDir={clientSortApprovals?.dir ?? 'asc'} onSort={(k) => setClientSortApprovals((p) => cycleClientSort(p, k))} className="px-4 py-3.5 text-center text-xs font-semibold text-content-tertiary">Bedel</SortablePanelTableTh>
                      <SortablePanelTableTh colId="waiting" sortKey="waiting" activeSortKey={clientSortApprovals?.key ?? null} sortDir={clientSortApprovals?.dir ?? 'asc'} onSort={(k) => setClientSortApprovals((p) => cycleClientSort(p, k))} className="px-4 py-3.5 text-center text-xs font-semibold text-content-tertiary">Gecikme Süresi</SortablePanelTableTh>
                      <SortablePanelTableTh colId="requests" sortKey="requests" activeSortKey={clientSortApprovals?.key ?? null} sortDir={clientSortApprovals?.dir ?? 'asc'} onSort={(k) => setClientSortApprovals((p) => cycleClientSort(p, k))} className="px-4 py-3.5 text-center text-xs font-semibold text-content-tertiary">Talep</SortablePanelTableTh>
                      <th className="w-36 px-4 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedPendingApprovals.map((a) => {
                      const isLoading = actionLoading && approvalAction?.id === a.id;
                      const isPreviewRow = a.id.startsWith('preview-');
                      const delayText = a.delayLabel ?? waitingHours(a.createdAt);
                      const delayUrgent = (a.delayHours ?? 0) >= 24;
                      return (
                        <tr
                          key={a.id}
                          className="cursor-pointer transition-colors hover:bg-brand-600/[0.03]"
                          onClick={() => setSelectedApproval(a)}
                        >
                          <PanelTableTd colId="staff" className="px-4 py-3.5 text-content-primary">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-content-secondary">
                                {a.assignedUser
                                  ? `${a.assignedUser.firstName.charAt(0)}${a.assignedUser.lastName.charAt(0)}`
                                  : '—'}
                              </span>
                              <span className="font-medium">
                                {a.assignedUser
                                  ? `${a.assignedUser.firstName} ${a.assignedUser.lastName}`
                                  : '—'}
                              </span>
                            </div>
                          </PanelTableTd>
                          <PanelTableTd colId="fileNo" className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
                              <FileText className="h-3.5 w-3.5 text-brand-600" />
                              {a.fileNumber || a.claimFileId?.slice(0, 8) || '—'}
                            </span>
                          </PanelTableTd>
                          <PanelTableTd colId="amount" className="px-4 py-3.5 text-center font-semibold tabular-nums text-content-primary">
                            {a.amount != null
                              ? formatTryAmount(a.amount, { fractionDigits: 0 })
                              : '—'}
                          </PanelTableTd>
                          <PanelTableTd colId="waiting" className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                delayUrgent
                                  ? 'bg-status-danger/10 text-status-danger'
                                  : 'bg-status-warning/10 text-status-warning'
                              }`}
                            >
                              <Clock3 className="h-3 w-3" />
                              {delayText}
                            </span>
                          </PanelTableTd>
                          <PanelTableTd colId="requests" className="px-4 py-3.5 text-center">
                            <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-bold text-brand-700">
                              {a.requestCount ?? a.requests?.length ?? 1}
                            </span>
                          </PanelTableTd>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedApproval(a)}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-600/10"
                              >
                                Detay
                              </button>
                              {!isPreviewRow ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(a.id)}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-1 rounded-lg bg-status-success/10 px-2.5 py-1.5 text-xs font-medium text-status-success transition-colors hover:bg-status-success/15 disabled:opacity-50"
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(a.id)}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-1 rounded-lg bg-status-danger/10 px-2.5 py-1.5 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/15 disabled:opacity-50"
                                  >
                                    Reddet
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </TableColumnsProvider>
            )}
          </div>
        )}

        {/* ── TAB: Atama Kuralları ─────────────────────────────────────────── */}
        {activeTab === 'rules' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <p className="text-sm text-slate-500">{rules.length} Kural Tanımlı</p>
              <div className="flex items-center gap-2">
                <PanelTableColumnPicker tableColumns={rulesTableColumns} />
                <button
                type="button"
                onClick={() => setShowAddRule(true)}
                className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 shadow-sm shadow-blue-200 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Yeni Kural
              </button>
              </div>
            </div>

            {rulesLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">📋</div>
                <p className="text-slate-500 font-medium">Atama Kuralı Yok</p>
                <p className="text-sm text-slate-400 mt-1">Yeni Kural Ekleyerek Otomasyonu Başlatın</p>
              </div>
            ) : (
              <TableColumnsProvider value={rulesTableColumns}>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm" style={panelTableLayoutStyle(rulesTableColumns)}>
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <SortablePanelTableTh colId="jobGroup" sortKey="jobGroup" activeSortKey={clientSortRules?.key ?? null} sortDir={clientSortRules?.dir ?? 'asc'} onSort={(k) => setClientSortRules((p) => cycleClientSort(p, k))} className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">İş Grubu</SortablePanelTableTh>
                      <SortablePanelTableTh colId="region" sortKey="region" activeSortKey={clientSortRules?.key ?? null} sortDir={clientSortRules?.dir ?? 'asc'} onSort={(k) => setClientSortRules((p) => cycleClientSort(p, k))} className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Bölge</SortablePanelTableTh>
                      <SortablePanelTableTh colId="staff" sortKey="staff" activeSortKey={clientSortRules?.key ?? null} sortDir={clientSortRules?.dir ?? 'asc'} onSort={(k) => setClientSortRules((p) => cycleClientSort(p, k))} className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Personel</SortablePanelTableTh>
                      <SortablePanelTableTh colId="priority" sortKey="priority" activeSortKey={clientSortRules?.key ?? null} sortDir={clientSortRules?.dir ?? 'asc'} onSort={(k) => setClientSortRules((p) => cycleClientSort(p, k))} className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Öncelik</SortablePanelTableTh>
                      <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={clientSortRules?.key ?? null} sortDir={clientSortRules?.dir ?? 'asc'} onSort={(k) => setClientSortRules((p) => cycleClientSort(p, k))} className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Durum</SortablePanelTableTh>
                      <th className="px-4 py-3.5 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                        <PanelTableTd colId="jobGroup" className="px-5 py-3.5">
                          <span className="font-medium text-slate-800">{rule.jobGroup?.name ?? '—'}</span>
                        </PanelTableTd>
                        <PanelTableTd colId="region" className="px-4 py-3.5 text-slate-500 text-xs">
                          {rule.region || <span className="text-slate-300">Tüm Bölgeler</span>}
                        </PanelTableTd>
                        <PanelTableTd colId="staff" className="px-4 py-3.5 text-slate-700">
                          {rule.assignedUser ? `${rule.assignedUser.firstName} ${rule.assignedUser.lastName}` : '—'}
                        </PanelTableTd>
                        <PanelTableTd colId="priority" className="px-4 py-3.5 text-center">
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                            #{rule.priority ?? 1}
                          </span>
                        </PanelTableTd>
                        <PanelTableTd colId="status" className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule.id, rule.isActive)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${rule.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                          </button>
                        </PanelTableTd>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </TableColumnsProvider>
            )}
          </div>
        )}

        {/* ── TAB: Hızlı Atama ────────────────────────────────────────────── */}
        {activeTab === 'assign' && (
          <div className="p-6 max-w-2xl">
            <p className="text-sm text-slate-500 mb-5">Dosya Arayın, Personel Seçin ve Hızlıca Atayın.</p>

            <div className="space-y-5">
              {/* File search */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Dosya No veya Müşteri Adı</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                    placeholder="Dosya Arayın..."
                    value={assignSearch}
                    onChange={(e) => { setAssignSearch(e.target.value); setSelectedFileId(''); }}
                  />
                  {searchLoading && (
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </div>
                {searchResults.length > 0 && !selectedFileId && (
                  <div className="mt-1.5 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden">
                    {searchResults.map((f) => {
                      const cName = f.customer
                        ? (f.customer.companyName ?? `${f.customer.firstName ?? ''} ${f.customer.lastName ?? ''}`.trim())
                        : '';
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setSelectedFileId(f.id); setAssignSearch(f.fileNumber ?? f.id.slice(0, 8)); setSearchResults([]); }}
                          className="w-full text-left flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <span className="text-sm font-medium text-slate-800">{f.fileNumber ?? f.id.slice(0, 8)}</span>
                          {cName && <span className="text-xs text-slate-400">{cName}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedFileId && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Dosya Seçildi
                  </p>
                )}
              </div>

              {/* Staff selector */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Personel Seç</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                >
                  <option value="">Personel Seçin...</option>
                  {workload.map((s) => {
                    const wl = workloadColor(s.activeCount);
                    return (
                      <option key={s.userId} value={s.userId}>
                        {s.firstName} {s.lastName} — {s.activeCount} aktif ({wl.label})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Öncelik</label>
                <div className="flex gap-2">
                  {([
                    { val: 'low', label: 'Düşük', color: 'bg-slate-100 text-slate-700 border-slate-200', active: 'bg-slate-600 text-white border-slate-600' },
                    { val: 'medium', label: 'Orta', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', active: 'bg-yellow-500 text-white border-yellow-500' },
                    { val: 'high', label: 'Yüksek', color: 'bg-red-50 text-red-700 border-red-200', active: 'bg-red-600 text-white border-red-600' },
                  ] as const).map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setAssignPriority(p.val)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${assignPriority === p.val ? p.active : p.color}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigning || !selectedFileId || !assignUserId}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 shadow-sm shadow-blue-200 transition-all"
              >
                {assigning ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                Atamayı Gerçekleştir
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: Geciken Dosyalar ────────────────────────────────────────── */}
        {activeTab === 'overdue' && (
          <div className="p-6">
            {/* Özet kartları */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(['warning', 'critical', 'escalation'] as EscalationLevel[]).map((level) => {
                const cfg = LEVEL_CONFIG[level];
                const count = overdueCounts[level];
                const dayThreshold = level === 'warning' ? escalationRules.warningDays : level === 'critical' ? escalationRules.criticalDays : escalationRules.escalationDays;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFilterLevel(filterLevel === level ? 'all' : level)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${filterLevel === level ? 'shadow-md scale-[1.01]' : ''} ${cfg.rowCls}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-3 h-3 rounded-full ${cfg.dotCls}`} />
                      <span className={`text-xs font-semibold tracking-wide ${level === 'escalation' ? 'text-slate-300' : level === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className={`text-3xl font-bold ${level === 'escalation' ? 'text-white' : level === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>{count}</p>
                    <p className={`text-xs mt-0.5 ${level === 'escalation' ? 'text-slate-400' : level === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>{dayThreshold}+ gün güncelleme yok</p>
                  </button>
                );
              })}
            </div>

            {/* Tablo */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">
                  {filterLevel === 'all' ? 'Tüm Geciken Dosyalar' : `${LEVEL_CONFIG[filterLevel].label} Seviyesi`}
                  <span className="ml-2 text-xs text-slate-400">({filteredOverdue.length} kayıt)</span>
                </span>
                <div className="flex items-center gap-3">
                  {filterLevel !== 'all' && (
                    <button type="button" onClick={() => setFilterLevel('all')} className="text-xs text-brand-600 hover:text-blue-700">
                      Filtreyi Temizle
                    </button>
                  )}
                  <PanelTableColumnPicker tableColumns={overdueTableColumns} />
                  <button type="button" onClick={loadOverdue} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Yenile
                  </button>
                </div>
              </div>

              {overdueLoading ? (
                <div className="py-16 text-center text-slate-400 text-sm">Yükleniyor...</div>
              ) : filteredOverdue.length === 0 ? (
                <div className="py-16 text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-slate-400">{filterLevel === 'all' ? 'Geciken Dosya Yok.' : 'Bu Seviyede Geciken Dosya Yok.'}</p>
                </div>
              ) : (
                <TableColumnsProvider value={overdueTableColumns}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={panelTableLayoutStyle(overdueTableColumns)}>
                    <thead>
                      <tr className="text-left bg-slate-50 text-xs font-semibold text-slate-500 tracking-wide">
                        <th className="px-4 py-3 w-8">&nbsp;</th>
                        <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-3">Dosya No</SortablePanelTableTh>
                        <SortablePanelTableTh colId="staff" sortKey="staff" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-3">Personel</SortablePanelTableTh>
                        <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-3">Durum</SortablePanelTableTh>
                        <SortablePanelTableTh colId="days" sortKey="days" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-3">Gün Sayısı</SortablePanelTableTh>
                        <SortablePanelTableTh colId="lastAction" sortKey="lastAction" activeSortKey={clientSortOverdue?.key ?? null} sortDir={clientSortOverdue?.dir ?? 'asc'} onSort={(k) => setClientSortOverdue((p) => cycleClientSort(p, k))} className="px-4 py-3">Son İşlem Tarihi</SortablePanelTableTh>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedFilteredOverdue.map((a) => {
                        const cfg = LEVEL_CONFIG[a.escalationLevel];
                        return (
                          <tr key={a.id} className={`${cfg.rowCls} ${a.escalationLevel === 'escalation' ? 'text-slate-100' : 'text-slate-800'}`}>
                            <td className="px-4 py-3">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dotCls}`} />
                            </td>
                            <PanelTableTd colId="fileNo" className="px-4 py-3 font-mono font-medium">
                              {a.claimFile?.fileNo ?? '-'}
                            </PanelTableTd>
                            <PanelTableTd colId="staff" className="px-4 py-3">
                              {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '-'}
                            </PanelTableTd>
                            <PanelTableTd colId="status" className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeCls}`}>
                                {cfg.label}
                              </span>
                            </PanelTableTd>
                            <PanelTableTd colId="days" className="px-4 py-3 font-bold tabular-nums">
                              {a.daysSinceUpdate} gün
                            </PanelTableTd>
                            <PanelTableTd colId="lastAction" className="px-4 py-3 tabular-nums text-xs">
                              {new Date(a.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </PanelTableTd>
                            <td className="px-4 py-3 text-right">
                              {a.claimFile?.id && (
                                <a
                                  href={`/panel/hasar-dosyalari/${a.claimFile.id}`}
                                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                >
                                  Dosyaya Git
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </TableColumnsProvider>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Rapor Yazım Süresi ─────────────────────────────────────── */}
        {activeTab === 'report-write' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Onarım Raporu Yazım Süresi Analizi</p>
                <p className="text-xs text-slate-500 mt-0.5">Son 30 gün — personel bazında ortalama süre</p>
              </div>
              <button type="button" onClick={loadWriteStats} className="btn-secondary text-xs">Yenile</button>
            </div>
            {writeStatsLoading ? (
              <p className="text-sm text-slate-400 py-10 text-center">Yükleniyor...</p>
            ) : writeStats.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center">Henüz kayıtlı yazım oturumu yok.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="px-4 py-3 text-left">Personel</th>
                      <th className="px-4 py-3 text-center">Oturum</th>
                      <th className="px-4 py-3 text-center">Ort. Süre</th>
                      <th className="px-4 py-3 text-center">Toplam Süre</th>
                      <th className="px-4 py-3 text-right">Son Oturum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {writeStats.map((row) => (
                      <tr key={row.userId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{row.sessionCount}</td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {row.avgDurationSec >= 60
                            ? `${Math.round(row.avgDurationSec / 60)} dk`
                            : `${row.avgDurationSec} sn`}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {row.totalDurationSec >= 3600
                            ? `${(row.totalDurationSec / 3600).toFixed(1)} sa`
                            : row.totalDurationSec >= 60
                              ? `${Math.round(row.totalDurationSec / 60)} dk`
                              : `${row.totalDurationSec} sn`}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                          {new Date(row.lastSessionAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* ── Detail Panels ───────────────────────────────────────────────────── */}
      {selectedStaff ? (
        <StaffDetailPanel staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
      ) : null}
      <ApprovalDetailPanel approval={selectedApproval} onClose={() => setSelectedApproval(null)} />

      {/* ── Add Rule Modal ───────────────────────────────────────────────────── */}
      {showAddRule && (
        <AddRuleModal
          onClose={() => setShowAddRule(false)}
          onSave={handleAddRule}
          jobGroups={jobGroups}
          users={userOptions}
        />
      )}
    </div>
  );
}
