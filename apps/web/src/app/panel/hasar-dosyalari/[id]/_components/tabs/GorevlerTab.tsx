'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { API, authAxios } from '../claim-detail-utils';
import { FinansFormPanel } from '@/components/finance/FinansPanelUI';
import { Badge, CollapsibleSectionCard } from '../claim-detail-ui';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';

// ─── Tab: Dosya Görevleri & Hatırlatmalar ─────────────────────────────────────

type TaskFilter = 'all' | 'open' | 'overdue' | 'completed';

type TaskRecord = {
  id: string;
  title: string;
  description?: string | null;
  taskType: string;
  priority: string;
  status: string;
  dueAt?: string | null;
  completedAt?: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
};

const TASK_TYPE_LABEL: Record<string, string> = {
  reminder: 'Hatırlatma',
  follow_up: 'Takip',
  call: 'Arama',
  document: 'Evrak',
  closure: 'Kapanış',
  other: 'Diğer',
  document_collection: 'Evrak Toplama',
  expert_assignment: 'Eksper Atama',
  site_visit: 'Saha Ziyareti',
  collection_followup: 'Tahsilat Takibi',
  appointment: 'Randevu',
  repair_tracking: 'Onarım Takibi',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const FILTER_TABS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'open', label: 'Açık' },
  { id: 'overdue', label: 'Gecikmiş' },
  { id: 'completed', label: 'Tamamlanan' },
];

function getCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    for (const key of ['user', 'currentUser']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      if (u?.id) return u.id;
    }
  } catch { /* ignore */ }
  return '';
}

function getDefaultAssigneeId(claim: any): string {
  return (
    claim?.assignedOfficeUser?.id
    ?? claim?.currentResponsibleUser?.id
    ?? getCurrentUserId()
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return 'Tarih Yok';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOpenTask(t: TaskRecord): boolean {
  return t.status === 'pending' || t.status === 'in_progress';
}

function isOverdueTask(t: TaskRecord, todayStart: Date): boolean {
  if (!isOpenTask(t) || !t.dueAt) return false;
  return new Date(t.dueAt) < todayStart;
}

function isTodayTask(t: TaskRecord, todayStart: Date, todayEnd: Date): boolean {
  if (!isOpenTask(t) || !t.dueAt) return false;
  const due = new Date(t.dueAt);
  return due >= todayStart && due <= todayEnd;
}

function isUpcomingTask(t: TaskRecord, todayEnd: Date): boolean {
  if (!isOpenTask(t)) return false;
  if (!t.dueAt) return true;
  return new Date(t.dueAt) > todayEnd;
}

function applyDatePreset(preset: 'today' | 'tomorrow' | 'monday' | 'week'): string {
  const target = new Date();
  switch (preset) {
    case 'today':
      if (target.getHours() >= 17) target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      break;
    case 'tomorrow':
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      break;
    case 'monday': {
      target.setHours(9, 0, 0, 0);
      const day = target.getDay();
      const daysToAdd = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
      target.setDate(target.getDate() + daysToAdd);
      break;
    }
    case 'week':
      target.setDate(target.getDate() + 7);
      target.setHours(9, 0, 0, 0);
      break;
  }
  return toDatetimeLocalValue(target);
}

function TaskCard({
  task,
  accent,
  actionLoading,
  onComplete,
  onInProgress,
  onCancel,
}: {
  task: TaskRecord;
  accent?: 'red' | 'amber' | 'default';
  actionLoading: string | null;
  onComplete: (id: string) => void;
  onInProgress: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const borderClass =
    accent === 'red'
      ? 'border-red-200 bg-red-50/30'
      : accent === 'amber'
        ? 'border-amber-200 bg-amber-50/20'
        : 'border-slate-100';

  const canAct = isOpenTask(task);

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-slate-800">{task.title}</span>
            <Badge
              text={PRIORITY_LABEL[task.priority] ?? task.priority}
              color={PRIORITY_COLOR[task.priority] ?? 'bg-slate-100 text-slate-600'}
            />
            <Badge
              text={STATUS_LABEL[task.status] ?? task.status}
              color={STATUS_COLOR[task.status] ?? 'bg-slate-100 text-slate-600'}
            />
          </div>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            <span>{TASK_TYPE_LABEL[task.taskType] ?? task.taskType}</span>
            <span>Hatırlatma: {fmtDateTime(task.dueAt)}</span>
            {task.assignedUser && (
              <span>
                Sorumlu: {task.assignedUser.firstName} {task.assignedUser.lastName}
              </span>
            )}
          </div>
        </div>
        {canAct && (
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <button
              type="button"
              onClick={() => onComplete(task.id)}
              disabled={actionLoading === `${task.id}-complete`}
              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === `${task.id}-complete` ? '...' : 'Tamamla'}
            </button>
            {task.status === 'pending' && (
              <button
                type="button"
                onClick={() => onInProgress(task.id)}
                disabled={actionLoading === `${task.id}-progress`}
                className="px-2.5 py-1 text-xs border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                {actionLoading === `${task.id}-progress` ? '...' : 'Devam Ediyor'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onCancel(task.id)}
              disabled={actionLoading === `${task.id}-cancel`}
              className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading === `${task.id}-cancel` ? '...' : 'İptal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskSection({ title, subtitle, tasks, accent, actionLoading, onComplete, onInProgress, onCancel }: {
  title: string;
  subtitle?: string;
  tasks: TaskRecord[];
  accent?: 'red' | 'amber' | 'default';
  actionLoading: string | null;
  onComplete: (id: string) => void;
  onInProgress: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (!tasks.length) return null;
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            accent={accent}
            actionLoading={actionLoading}
            onComplete={onComplete}
            onInProgress={onInProgress}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  );
}

export function GorevlerTab({ claimId, claim }: { claimId: string; claim: any }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    taskType: 'reminder',
    priority: 'medium',
    assignedUserId: '',
  });

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const todayEnd = useMemo(() => endOfDay(new Date()), []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authAxios<{ data: TaskRecord[] }>({
        method: 'GET',
        url: `${API}/tasks?claimFileId=${claimId}&limit=100`,
      });
      setTasks(r.data.data || []);
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 401) return;
      console.error(e);
      setError(e?.response?.data?.message ?? 'Görevler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!showForm) return;
    const defaultAssignee = getDefaultAssigneeId(claim);
    setForm((prev) => ({
      ...prev,
      assignedUserId: prev.assignedUserId || defaultAssignee,
    }));
    void authAxios<{ data: any[] }>({
      method: 'GET',
      url: `${API}/users?limit=100`,
    })
      .then((r) => setUsers(r.data.data || []))
      .catch(() => setUsers([]));
  }, [showForm, claim]);

  const counts = useMemo(() => {
    const open = tasks.filter(isOpenTask);
    return {
      open: open.length,
      today: tasks.filter((t) => isTodayTask(t, todayStart, todayEnd)).length,
      overdue: tasks.filter((t) => isOverdueTask(t, todayStart)).length,
    };
  }, [tasks, todayStart, todayEnd]);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'open':
        return tasks.filter(isOpenTask);
      case 'overdue':
        return tasks.filter((t) => isOverdueTask(t, todayStart));
      case 'completed':
        return tasks.filter((t) => t.status === 'completed');
      default:
        return tasks;
    }
  }, [tasks, filter, todayStart]);

  const grouped = useMemo(() => {
    const overdue = filteredTasks.filter((t) => isOverdueTask(t, todayStart));
    const today = filteredTasks.filter((t) => isTodayTask(t, todayStart, todayEnd));
    const upcoming = filteredTasks.filter((t) => isUpcomingTask(t, todayEnd));
    const completed = filteredTasks.filter((t) => t.status === 'completed');
    return { overdue, today, upcoming, completed };
  }, [filteredTasks, todayStart, todayEnd]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      dueAt: '',
      taskType: 'reminder',
      priority: 'medium',
      assignedUserId: getDefaultAssigneeId(claim),
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('warning', 'Lütfen Görev Başlığını Giriniz.');
      return;
    }
    setSaving(true);
    try {
      await authAxios({
        method: 'POST',
        url: `${API}/tasks`,
        data: {
          claimFileId: claimId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          taskType: form.taskType,
          priority: form.priority,
          assignedUserId: form.assignedUserId || undefined,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        },
      });
      setShowForm(false);
      resetForm();
      loadTasks();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Kayıt başarısız'));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    setActionLoading(`${taskId}-complete`);
    try {
      await authAxios({ method: 'POST', url: `${API}/tasks/${taskId}/complete` });
      loadTasks();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Tamamlanamadı'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleInProgress = async (taskId: string) => {
    setActionLoading(`${taskId}-progress`);
    try {
      await authAxios({ method: 'PATCH', url: `${API}/tasks/${taskId}`, data: { status: 'in_progress' } });
      loadTasks();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Durum güncellenemedi'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (taskId: string) => {
    if (!confirm('Bu hatırlatmayı iptal etmek istediğinize emin misiniz?')) return;
    setActionLoading(`${taskId}-cancel`);
    try {
      await authAxios({ method: 'DELETE', url: `${API}/tasks/${taskId}` });
      loadTasks();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'İptal edilemedi'));
    } finally {
      setActionLoading(null);
    }
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const hasVisibleTasks =
    grouped.overdue.length + grouped.today.length + grouped.upcoming.length + grouped.completed.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            Açık <span className="font-semibold">{counts.open}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Bugün <span className="font-semibold">{counts.today}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            Gecikmiş <span className="font-semibold">{counts.overdue}</span>
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                filter === tab.id
                  ? 'bg-slate-800 font-medium text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : openCreateForm())}
          className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-sm text-white hover:bg-blue-700"
        >
          {showForm ? 'Formu Kapat' : '+ Hatırlatma Ekle'}
        </button>
      </div>

      {showForm && (
        <FinansFormPanel
          title="Yeni Hatırlatma / Görev"
          onCancel={() => setShowForm(false)}
          onSubmit={handleSave}
          saving={saving}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Başlık</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Örn. Tespitçi ile tekrar görüş"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Açıklama (Opsiyonel)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setForm({ ...form, description: v });
                }}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Hatırlatma Tarihi</label>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  ['today', 'Bugün'],
                  ['tomorrow', 'Yarın'],
                  ['monday', 'Pazartesi'],
                  ['week', '1 Hafta'],
                ] as const).map(([preset, label]) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setForm({ ...form, dueAt: applyDatePreset(preset) })}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Görev Tipi</label>
              <select
                value={form.taskType}
                onChange={(e) => setForm({ ...form, taskType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {Object.entries(TASK_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Öncelik</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Sorumlu Kişi</label>
              <select
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Seçiniz —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          </div>
        </FinansFormPanel>
      )}

      {/* List */}
      {loading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Yükleniyor...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 text-center">
          {error}
          <button type="button" onClick={loadTasks} className="block mx-auto mt-2 text-xs underline">
            Tekrar Dene
          </button>
        </div>
      ) : !hasVisibleTasks ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {filter === 'all' ? 'Henüz Görev Eklenmedi' : 'Bu Filtrede Görev Yok'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === 'all'
              ? 'Tespitçi araması, evrak takibi veya kişisel hatırlatmalar ekleyebilirsiniz.'
              : 'Farklı bir filtre seçin veya yeni hatırlatma ekleyin.'}
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Hatırlatma Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <TaskSection
            title="Gecikmiş"
            subtitle="Hatırlatma tarihi geçmiş açık görevler"
            tasks={grouped.overdue}
            accent="red"
            actionLoading={actionLoading}
            onComplete={handleComplete}
            onInProgress={handleInProgress}
            onCancel={handleCancel}
          />
          <TaskSection
            title="Bugün"
            subtitle="Bugün hatırlatılması gereken görevler"
            tasks={grouped.today}
            accent="amber"
            actionLoading={actionLoading}
            onComplete={handleComplete}
            onInProgress={handleInProgress}
            onCancel={handleCancel}
          />
          <TaskSection
            title="Yaklaşan"
            subtitle="Gelecek tarihli veya tarihsiz açık görevler"
            tasks={grouped.upcoming}
            actionLoading={actionLoading}
            onComplete={handleComplete}
            onInProgress={handleInProgress}
            onCancel={handleCancel}
          />
          {grouped.completed.length > 0 && (
            <CollapsibleSectionCard
              title="Tamamlanan"
              subtitle={`${grouped.completed.length} tamamlanmış görev`}
              defaultOpen={filter === 'completed'}
            >
              <div className="space-y-2 pt-2">
                {grouped.completed.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    actionLoading={actionLoading}
                    onComplete={handleComplete}
                    onInProgress={handleInProgress}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </CollapsibleSectionCard>
          )}
        </div>
      )}
    </div>
  );
}
