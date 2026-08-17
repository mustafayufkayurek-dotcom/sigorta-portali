'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';



// ─── Types ────────────────────────────────────────────────────────────────────
interface TimelineEntry {
  type: 'transition' | 'waiting' | 'note';
  date: string;
  data: any;
}

interface CurrentStageData {
  status: { id: string; code: string; name: string; color: string; maxDurationHours: number | null };
  enteredAt: string;
  elapsedMinutes: number;
  maxMinutes: number | null;
  slaStatus: 'ok' | 'warning' | 'critical' | 'escalation';
  slaThresholds: { warningPct: number; criticalPct: number; escalationPct: number };
  activeWaitings: any[];
  currentResponsibleRole: string | null;
  currentResponsibleUserId: string | null;
  pendingActionOwner: string | null;
  lastActivityAt: string | null;
  lastHumanActionAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} gün ${rh} sa` : `${d} gün`;
}

function roleLabel(role: string | null): string {
  const map: Record<string, string> = {
    operasyon_sorumlusu: 'Operasyon Sorumlusu',
    saha_personeli: 'Saha Personeli',
    eksper: 'Eksper',
    sigorta_temsilcisi: 'Sigorta Temsilcisi',
    finans_sorumlusu: 'Finans Sorumlusu',
    yonetici: 'Yönetici/Admin',
  };
  return role ? (map[role] || role) : '—';
}

const SLA_CONFIG = {
  ok: { label: 'Normal', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-status-success' },
  warning: { label: 'Uyarı', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-status-warning' },
  critical: { label: 'Kritik', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  escalation: { label: 'Aşım', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-status-danger' },
};

// ─── Current Stage Card ───────────────────────────────────────────────────────
export function CurrentStageCard({ data }: { data: CurrentStageData }) {
  const sla = SLA_CONFIG[data.slaStatus];
  const progress = data.maxMinutes ? Math.min((data.elapsedMinutes / data.maxMinutes) * 100, 100) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: data.status.color }} />
          <h3 className="text-lg font-semibold text-slate-800">{data.status.name}</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${sla.color}`}>
          <span className={`w-2 h-2 rounded-full ${sla.dot}`} />
          {sla.label}
        </span>
      </div>

      {/* Duration & SLA Progress */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Bu Aşamada</p>
          <p className="text-sm font-semibold text-slate-800">{fmtDuration(data.elapsedMinutes)}</p>
        </div>
        {data.maxMinutes && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Maks Süre</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDuration(data.maxMinutes)}</p>
          </div>
        )}
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Sorumlu Rol</p>
          <p className="text-sm font-semibold text-slate-800">{roleLabel(data.currentResponsibleRole)}</p>
        </div>
        {data.lastActivityAt && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Son Aktivite</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDateTime(data.lastActivityAt)}</p>
          </div>
        )}
      </div>

      {/* SLA Progress Bar */}
      {progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>SLA İlerlemesi</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.slaStatus === 'ok' ? 'bg-status-success' :
                data.slaStatus === 'warning' ? 'bg-status-warning' :
                data.slaStatus === 'critical' ? 'bg-orange-500' : 'bg-status-danger'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{Math.round(data.slaThresholds.warningPct * 100)}% Uyarı</span>
            <span>{Math.round(data.slaThresholds.criticalPct * 100)}% Kritik</span>
            <span>{Math.round(data.slaThresholds.escalationPct * 100)}% Aşım</span>
          </div>
        </div>
      )}

      {/* Active Waitings */}
      {data.activeWaitings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Aktif Beklemeler</p>
          {data.activeWaitings.map((w) => (
            <div key={w.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="w-2 h-2 rounded-full bg-status-warning mt-1.5 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">{w.reason?.replace(/_/g, ' ')}</p>
                {w.description && <p className="text-xs text-amber-600 mt-0.5">{w.description}</p>}
                <p className="text-xs text-status-warning mt-1">
                  {fmtDuration(Math.floor((Date.now() - new Date(w.startedAt).getTime()) / 60000))} süredir bekleniyor
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline Event ───────────────────────────────────────────────────────────
function TimelineEvent({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const iconConfig = {
    transition: { bg: 'bg-blue-500', icon: '→' },
    waiting: { bg: 'bg-status-warning', icon: '⏳' },
    note: { bg: 'bg-slate-400', icon: '📝' },
  };
  const config = iconConfig[entry.type];

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center text-white text-sm flex-shrink-0`}>
          {config.icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        {entry.type === 'transition' && (
          <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.data.fromStatus && (
                <>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: entry.data.fromStatus.color + '20', color: entry.data.fromStatus.color }}>
                    {entry.data.fromStatus.name}
                  </span>
                  <span className="text-slate-400">→</span>
                </>
              )}
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: entry.data.toStatus.color + '20', color: entry.data.toStatus.color }}>
                {entry.data.toStatus.name}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>{fmtDateTime(entry.date)}</span>
              {entry.data.changedByUser && (
                <span className="text-slate-600 font-medium">{entry.data.changedByUser.firstName} {entry.data.changedByUser.lastName}</span>
              )}
              {entry.data.durationMinutes != null && (
                <span className="bg-slate-100 px-1.5 py-0.5 rounded">{fmtDuration(entry.data.durationMinutes)}</span>
              )}
            </div>
            {entry.data.note && <p className="mt-1 text-xs text-slate-600">{entry.data.note}</p>}
          </div>
        )}

        {entry.type === 'waiting' && (
          <div className={`border rounded-lg p-3 ${entry.data.resolvedAt ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${entry.data.resolvedAt ? 'text-slate-700' : 'text-amber-800'}`}>
                {entry.data.reason?.replace(/_/g, ' ')}
              </p>
              {entry.data.resolvedAt ? (
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">Çözüldü</span>
              ) : (
                <span className="text-xs text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded animate-pulse">Bekliyor</span>
              )}
            </div>
            {entry.data.description && <p className="text-xs text-slate-600 mt-1">{entry.data.description}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>Başlangıç: {fmtDateTime(entry.data.startedAt)}</span>
              {entry.data.resolvedAt && <span>Çözüm: {fmtDateTime(entry.data.resolvedAt)}</span>}
            </div>
          </div>
        )}

        {entry.type === 'note' && (
          <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-700">
                {entry.data.author?.firstName} {entry.data.author?.lastName}
              </span>
              <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                {entry.data.noteType === 'operations' ? 'Operasyon' :
                 entry.data.noteType === 'finance' ? 'Finans' :
                 entry.data.noteType === 'adjuster' ? 'Eksper' :
                 entry.data.noteType === 'field' ? 'Saha' : 'Genel'}
              </span>
            </div>
            <p className="text-sm text-slate-600">{entry.data.content}</p>
            <p className="text-xs text-slate-400 mt-1">{fmtDateTime(entry.date)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Note Form ────────────────────────────────────────────────────────────
function AddNoteForm({ claimFileId, onNoteAdded }: { claimFileId: string; onNoteAdded: () => void }) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/claim-files/${claimFileId}/notes`, { content, noteType }, { headers: authHeader() });
      setContent('');
      onNoteAdded();
    } catch (e) {
      console.error('Not eklenemedi', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">İç Not Ekle</h4>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ekip notu yazın..."
        className="w-full border border-slate-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
        >
          <option value="general">Genel</option>
          <option value="operations">Operasyon</option>
          <option value="finance">Finans</option>
          <option value="adjuster">Eksper</option>
          <option value="field">Saha</option>
        </select>
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Not Ekle'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ProcessTimelineProps {
  claimFileId: string;
  readOnly?: boolean;
  hiddenNoteTypes?: string[];
}

export default function ProcessTimeline({
  claimFileId,
  readOnly = false,
  hiddenNoteTypes = [],
}: ProcessTimelineProps) {
  const [currentStage, setCurrentStage] = useState<CurrentStageData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stageRes, timelineRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimFileId}/current-stage`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimFileId}/timeline`, { headers: authHeader() }),
      ]);
      setCurrentStage(stageRes.data.data ?? stageRes.data);
      const tl = timelineRes.data.data ?? timelineRes.data;
      const entries = Array.isArray(tl) ? tl : [];
      const hidden = new Set(hiddenNoteTypes);
      setTimeline(
        hidden.size === 0
          ? entries
          : entries.filter(
              (entry) =>
                entry.type !== 'note' || !hidden.has(entry.data?.noteType),
            ),
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimFileId, hiddenNoteTypes]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-slate-100 rounded-xl" />
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={loadData} className="mt-2 text-xs text-red-700 underline">Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Stage */}
      {currentStage && <CurrentStageCard data={currentStage} />}

      {/* Add Note */}
      {!readOnly && <AddNoteForm claimFileId={claimFileId} onNoteAdded={loadData} />}

      {/* Timeline */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Süreç Geçmişi</h4>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Henüz süreç kaydı yok</p>
        ) : (
          <div className="space-y-0">
            {[...timeline].reverse().map((entry, idx) => (
              <TimelineEvent key={`${entry.type}-${idx}`} entry={entry} isLast={idx === timeline.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
