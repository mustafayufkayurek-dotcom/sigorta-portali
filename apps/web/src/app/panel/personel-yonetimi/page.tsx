'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '@/contexts/ToastContext';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffWorkload {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: { name: string; code: string };
  activeCount: number;
  completedThisMonth: number;
  pendingApproval: number;
  assignments?: AssignedFile[];
}

interface PendingApproval {
  id: string;
  fileNumber: string;
  claimFileId: string;
  assignedUserId: string;
  assignedUser?: { firstName: string; lastName: string };
  jobType?: string;
  workType?: string;
  createdAt: string;
  timeoutAt?: string;
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
    dot: 'bg-red-500',
  };
}

function waitingHours(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Az önce';
  if (hours < 24) return `${hours} saat`;
  return `${Math.floor(hours / 24)} gün`;
}

function TimeoutCountdown({ timeoutAt }: { timeoutAt?: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!timeoutAt) return;
    const update = () => {
      const diff = new Date(timeoutAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Zaman aşımı!'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setRemaining(`${h}s ${m}d`);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [timeoutAt]);

  if (!timeoutAt) return null;
  const isUrgent = new Date(timeoutAt).getTime() - Date.now() < 3_600_000;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {remaining}
    </span>
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
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700">
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
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2">
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
    rowCls: 'bg-red-50 border-l-4 border-red-500',
    badgeCls: 'bg-red-100 text-red-800 border border-red-300',
    dotCls: 'bg-red-500',
  },
  escalation: {
    label: 'Eskalasyon',
    rowCls: 'bg-slate-900 border-l-4 border-slate-700',
    badgeCls: 'bg-slate-800 text-slate-100 border border-slate-600',
    dotCls: 'bg-slate-400',
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'workload' | 'approvals' | 'rules' | 'assign' | 'overdue';

const APPROVALS_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'staff', label: 'Personel', defaultWidth: 160, minWidth: 120 },
  { id: 'jobType', label: 'İş Tipi', defaultWidth: 120, minWidth: 96 },
  { id: 'waiting', label: 'Bekleme', defaultWidth: 100, minWidth: 80 },
  { id: 'timeout', label: 'Timeout', defaultWidth: 100, minWidth: 80 },
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

export default function PersonelYonetimiPage() {
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

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadWorkload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/task-assignments/team-workload`, { headers: authHeader() });
      const data: StaffWorkload[] = r.data.data ?? r.data ?? [];
      setWorkload(data);
      setUserOptions(data.map((s) => ({ id: s.userId, firstName: s.firstName, lastName: s.lastName })));

      // Derive stats
      const totalActive = data.reduce((sum, s) => sum + (s.activeCount ?? 0), 0);
      const completedToday = data.reduce((sum, s) => sum + (s.completedThisMonth ?? 0), 0);
      setStats((p) => ({ ...p, totalActive, completedToday }));
    } catch {
      setWorkload([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const r = await axios.get(`${API}/task-assignments/pending-approvals`, { headers: authHeader() });
      setPendingApprovals(r.data.data ?? r.data ?? []);
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

  useEffect(() => {
    loadWorkload();
    loadApprovals();
  }, [loadWorkload, loadApprovals]);

  useEffect(() => {
    if (activeTab === 'rules') { loadRules(); loadJobGroups(); }
    if (activeTab === 'overdue') { loadOverdue(); }
  }, [activeTab, loadRules, loadJobGroups, loadOverdue]);

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
      badge: pendingApprovals.length || undefined,
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
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
            {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Personel Yönetimi</span>
      </nav>

<div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Personel Yönetimi</h2>
            <p className="page-subtitle">İş Yükü Takibi, Atama ve Onay Yönetimi</p>
          </div>
        </div>
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

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card card-accent-blue">
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700">{stats.totalActive}</p>
          <p className="text-xs text-slate-400 mt-0.5">Toplam Aktif Atama</p>
        </div>
        <div className="stat-card card-accent-emerald">
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-green-700">{stats.completedToday}</p>
          <p className="text-xs text-slate-400 mt-0.5">Bugün Tamamlanan</p>
        </div>
        <div className="stat-card card-accent-purple">
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-50">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-700">{stats.avgClosingDays ? `${stats.avgClosingDays} gün` : '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">Ort. Kapama Süresi</p>
        </div>
        <div className="stat-card card-accent-orange">
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-50">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-700">{pendingApprovals.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Onay Bekleyen</p>
        </div>
      </div>

      {/* ── Pending Approvals Banner ─────────────────────────────────────────── */}
      {pendingApprovals.length > 0 && activeTab !== 'approvals' && (
        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 hover:border-orange-300 transition-all text-left"
        >
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{pendingApprovals.length} Atama Onay Bekliyor</p>
            <p className="text-xs text-orange-600 mt-0.5">Tıklayarak Yönetin</p>
          </div>
          <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
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
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Aşırı Yük (7+)
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
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">👥</div>
                <p className="text-slate-500 font-medium">Personel Verisi Bulunamadı</p>
                <p className="text-xs text-slate-500 mt-1.5">Backend Endpoint&apos;i Kontrol Edin</p>
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
            {pendingApprovals.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600 font-medium">
                  <span className="text-orange-600 font-bold">{pendingApprovals.length}</span> Atama Onay Bekliyor
                </p>
                <button
                  type="button"
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {approvingAll ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Tümünü Onayla
                </button>
              </div>
            )}

            {approvalsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">✅</div>
                <p className="text-slate-500 font-medium">Bekleyen Onay Yok</p>
                <p className="text-sm text-slate-400 mt-1">Tüm Atamalar Onaylanmış Durumda</p>
              </div>
            ) : (
              <TableColumnsProvider value={approvalsTableColumns}>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <div className="flex justify-end gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                  <PanelTableColumnPicker tableColumns={approvalsTableColumns} />
                </div>
                <table className="w-full text-sm" style={panelTableLayoutStyle(approvalsTableColumns)}>
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <PanelTableTh colId="fileNo" className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Dosya No</PanelTableTh>
                      <PanelTableTh colId="staff" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Personel</PanelTableTh>
                      <PanelTableTh colId="jobType" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">İş Tipi</PanelTableTh>
                      <PanelTableTh colId="waiting" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Bekleme</PanelTableTh>
                      <PanelTableTh colId="timeout" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Timeout</PanelTableTh>
                      <th className="px-4 py-3.5 w-32" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pendingApprovals.map((a) => {
                      const isLoading = actionLoading && approvalAction?.id === a.id;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <PanelTableTd colId="fileNo" className="px-5 py-3.5">
                            <span className="font-semibold text-slate-800">{a.fileNumber ?? a.claimFileId?.slice(0, 8) ?? '—'}</span>
                          </PanelTableTd>
                          <PanelTableTd colId="staff" className="px-4 py-3.5 text-slate-700">
                            {a.assignedUser ? `${a.assignedUser.firstName} ${a.assignedUser.lastName}` : '—'}
                          </PanelTableTd>
                          <PanelTableTd colId="jobType" className="px-4 py-3.5">
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {a.jobType ?? a.workType ?? 'Genel'}
                            </span>
                          </PanelTableTd>
                          <PanelTableTd colId="waiting" className="px-4 py-3.5 text-center text-xs text-slate-500">
                            {waitingHours(a.createdAt)}
                          </PanelTableTd>
                          <PanelTableTd colId="timeout" className="px-4 py-3.5 text-center">
                            <TimeoutCountdown timeoutAt={a.timeoutAt} />
                          </PanelTableTd>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => handleApprove(a.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 font-medium"
                              >
                                {isLoading && approvalAction?.action === 'approve' ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(a.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 font-medium"
                              >
                                {isLoading && approvalAction?.action === 'reject' ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                                Reddet
                              </button>
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
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
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
                      <PanelTableTh colId="jobGroup" className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">İş Grubu</PanelTableTh>
                      <PanelTableTh colId="region" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Bölge</PanelTableTh>
                      <PanelTableTh colId="staff" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Personel</PanelTableTh>
                      <PanelTableTh colId="priority" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Öncelik</PanelTableTh>
                      <PanelTableTh colId="status" className="text-center px-4 py-3.5 text-xs font-semibold text-slate-500 tracking-wide">Durum</PanelTableTh>
                      <th className="px-4 py-3.5 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rules.map((rule) => (
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
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-200 transition-all"
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
                    <button type="button" onClick={() => setFilterLevel('all')} className="text-xs text-blue-600 hover:text-blue-700">
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
                        <PanelTableTh colId="fileNo" className="px-4 py-3">Dosya No</PanelTableTh>
                        <PanelTableTh colId="staff" className="px-4 py-3">Personel</PanelTableTh>
                        <PanelTableTh colId="status" className="px-4 py-3">Durum</PanelTableTh>
                        <PanelTableTh colId="days" className="px-4 py-3">Gün Sayısı</PanelTableTh>
                        <PanelTableTh colId="lastAction" className="px-4 py-3">Son İşlem Tarihi</PanelTableTh>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOverdue.map((a) => {
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
      </div>

      {/* ── Staff Detail Panel ───────────────────────────────────────────────── */}
      {selectedStaff && (
        <StaffDetailPanel staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
      )}

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
