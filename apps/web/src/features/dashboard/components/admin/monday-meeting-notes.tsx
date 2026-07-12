'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, ListChecks, Plus, Settings2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';

type MondayMeetingTemplate = {
  id: string;
  text: string;
  sortOrder: number;
  active: boolean;
};

type MondayMeetingNote = {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  weekKey: string;
  templateId: string | null;
};

type MondayMeetingPayload = {
  templates: MondayMeetingTemplate[];
  notes: MondayMeetingNote[];
  initialized: boolean;
  weekKey: string;
};

function NoteCheckCircle({
  completed,
  onToggle,
}: {
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={completed ? 'Notu geri al' : 'Notu tamamla'}
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        completed
          ? 'border-slate-500 bg-slate-500'
          : 'border-slate-400 bg-white hover:border-blue-500 dark:bg-slate-900'
      }`}
    >
      {completed ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
    </button>
  );
}

export function MondayMeetingNotes() {
  const [data, setData] = useState<MondayMeetingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState<MondayMeetingTemplate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/monday-meeting`, { headers: authHeader() });
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
      setDraftTemplates(payload.templates ?? []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weekNotes = useMemo(() => {
    if (!data) return [];
    return data.notes
      .filter((n) => n.weekKey === data.weekKey)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [data]);

  const activeNotes = weekNotes.filter((n) => !n.completed);
  const archivedNotes = weekNotes.filter((n) => n.completed);
  const visibleNotes = showArchived ? weekNotes : activeNotes;

  const toggleNote = async (id: string) => {
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API}/system-settings/monday-meeting/notes/${id}/toggle`,
        {},
        { headers: authHeader() },
      );
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
      setDraftTemplates(payload.templates ?? []);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    const text = toTitleCaseTR(newNote.trim());
    if (!text) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/system-settings/monday-meeting/notes`,
        { text },
        { headers: authHeader() },
      );
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
      setNewNote('');
    } finally {
      setSaving(false);
    }
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      const res = await axios.put(
        `${API}/system-settings/monday-meeting/templates`,
        { templates: draftTemplates },
        { headers: authHeader() },
      );
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
      setDraftTemplates(payload.templates ?? []);
      setShowTemplates(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-2 animate-pulse rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="mt-2 text-xs text-slate-500">Toplantı notları yüklenemedi.</p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-700 dark:bg-slate-800/30">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-blue-600" />
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Toplantı Notları</h4>
          <span className="text-[10px] text-slate-400">
            {activeNotes.length} aktif · {archivedNotes.length} tamamlanan
          </span>
        </div>
        <div className="flex items-center gap-2">
          {archivedNotes.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {showArchived ? 'Eski Notları Gizle' : 'Eski Notları Göster'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            <Settings2 className="h-3 w-3" />
            Mutatap Konular
            {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {showTemplates ? (
        <div className="mb-2 rounded-lg border border-blue-100 bg-white p-2 dark:border-blue-900/40 dark:bg-slate-900">
          <p className="mb-1.5 text-[10px] text-slate-500">
            Her Pazartesi toplantısında otomatik listelenecek mutatap konular. Yeni haftada aktif olanlar not olarak eklenir.
          </p>
          <ul className="space-y-1">
            {draftTemplates.map((tpl, idx) => (
              <li key={tpl.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={tpl.active}
                  onChange={(e) => {
                    const next = [...draftTemplates];
                    next[idx] = { ...tpl, active: e.target.checked };
                    setDraftTemplates(next);
                  }}
                  className="rounded border-slate-300"
                />
                <input
                  type="text"
                  value={tpl.text}
                  onChange={(e) => {
                    const next = [...draftTemplates];
                    next[idx] = { ...tpl, text: e.target.value };
                    setDraftTemplates(next);
                  }}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (!v) return;
                    const next = [...draftTemplates];
                    next[idx] = { ...tpl, text: v };
                    setDraftTemplates(next);
                  }}
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setDraftTemplates((prev) => [
                  ...prev,
                  {
                    id: `mm-tpl-draft-${Date.now()}`,
                    text: '',
                    sortOrder: (prev.length + 1) * 10,
                    active: true,
                  },
                ])
              }
              className="text-[10px] font-medium text-blue-600 hover:underline"
            >
              + Konu Ekle
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTemplates()}
              className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
            >
              Mutatapları Kaydet
            </button>
          </div>
        </div>
      ) : null}

      {visibleNotes.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">
          {showArchived ? 'Bu hafta için not yok.' : 'Tüm notlar tamamlandı. Eski notları göster ile arşive bakabilirsiniz.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {visibleNotes.map((note) => (
            <li
              key={note.id}
              className={`flex items-start justify-center gap-2 rounded-md px-1 py-1 text-center ${
                note.completed ? 'opacity-60' : ''
              }`}
            >
              <NoteCheckCircle
                completed={note.completed}
                onToggle={() => !saving && void toggleNote(note.id)}
              />
              <span
                className={`flex-1 text-xs leading-snug ${
                  note.completed
                    ? 'text-slate-400 line-through decoration-slate-400'
                    : 'font-medium text-slate-800 dark:text-slate-100'
                }`}
              >
                {note.text}
                {note.templateId ? (
                  <span className="ml-1 text-[9px] font-normal text-slate-400">(Mutatap)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-1.5">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Yeni toplantı notu…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addNote();
          }}
          onBlur={(e) => {
            const v = toTitleCaseTR(e.target.value.trim());
            if (v !== e.target.value.trim()) setNewNote(v);
          }}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
        />
        <button
          type="button"
          disabled={saving || !newNote.trim()}
          onClick={() => void addNote()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Ekle
        </button>
      </div>
    </div>
  );
}
