'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function storageKey(weekKey: string) {
  return `mm-archived-${weekKey}`;
}

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

function NoteRow({
  note,
  saving,
  onToggle,
}: {
  note: MondayMeetingNote;
  saving: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
        note.completed
          ? 'border-slate-100 bg-slate-50/80'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <NoteCheckCircle
        completed={note.completed}
        onToggle={() => !saving && onToggle(note.id)}
      />
      <span
        className={`min-w-0 flex-1 text-sm leading-snug ${
          note.completed
            ? 'text-slate-500 line-through decoration-slate-400'
            : 'font-medium text-slate-800 dark:text-slate-100'
        }`}
      >
        {note.text}
        {note.templateId ? (
          <span className="ml-1.5 text-[10px] font-normal text-slate-400">(Mutatap)</span>
        ) : null}
      </span>
    </li>
  );
}

export function MondayMeetingNotes({ mode = 'widget' }: { mode?: 'widget' | 'page' }) {
  const isPage = mode === 'page';
  const [data, setData] = useState<MondayMeetingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOlderNotes, setShowOlderNotes] = useState(false);
  const [showTemplates, setShowTemplates] = useState(isPage);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState<MondayMeetingTemplate[]>([]);
  const [sessionArchivedIds, setSessionArchivedIds] = useState<Set<string>>(() => new Set());

  const notesRef = useRef<MondayMeetingNote[]>([]);
  const weekKeyRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/monday-meeting`, { headers: authHeader() });
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
      setDraftTemplates(payload.templates ?? []);
      notesRef.current = payload.notes ?? [];
      weekKeyRef.current = payload.weekKey;
      try {
        const raw = sessionStorage.getItem(storageKey(payload.weekKey));
        if (raw) setSessionArchivedIds(new Set(JSON.parse(raw) as string[]));
      } catch {
        setSessionArchivedIds(new Set());
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    notesRef.current = data.notes;
    weekKeyRef.current = data.weekKey;
  }, [data]);

  useEffect(() => {
    return () => {
      const weekKey = weekKeyRef.current;
      if (!weekKey) return;
      const completedIds = notesRef.current
        .filter((n) => n.weekKey === weekKey && n.completed)
        .map((n) => n.id);
      sessionStorage.setItem(storageKey(weekKey), JSON.stringify(completedIds));
    };
  }, []);

  const weekNotes = useMemo(() => {
    if (!data) return [];
    return data.notes
      .filter((n) => n.weekKey === data.weekKey)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [data]);

  const agendaNotes = useMemo(
    () => weekNotes.filter((n) => !n.completed || !sessionArchivedIds.has(n.id)),
    [weekNotes, sessionArchivedIds],
  );

  const archivedThisWeek = useMemo(
    () => weekNotes.filter((n) => n.completed && sessionArchivedIds.has(n.id)),
    [weekNotes, sessionArchivedIds],
  );

  const olderNotes = useMemo(() => {
    if (!data) return [];
    return data.notes
      .filter((n) => n.weekKey !== data.weekKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

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
      notesRef.current = payload.notes ?? [];
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
      notesRef.current = payload.notes ?? [];
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
      if (!isPage) setShowTemplates(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700 ${isPage ? '' : 'mt-2'}`}>
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">Toplantı notları yüklenemedi.</p>;
  }

  const templatesPanel = (
    <div className={`rounded-xl border border-blue-100 bg-white p-3 dark:border-blue-900/40 dark:bg-slate-900 ${isPage ? 'h-full' : 'mb-2'}`}>
      <p className="mb-2 text-xs text-slate-500">
        Her Pazartesi otomatik listelenecek mutatap konular.
      </p>
      <ul className="space-y-1.5">
        {draftTemplates.map((tpl, idx) => (
          <li key={tpl.id} className="flex items-center gap-2">
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
              className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
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
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          + Konu Ekle
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveTemplates()}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Mutatapları Kaydet
        </button>
      </div>
    </div>
  );

  const addNoteRow = (
    <div className="flex gap-2">
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
        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
      <button
        type="button"
        disabled={saving || !newNote.trim()}
        onClick={() => void addNote()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Ekle
      </button>
    </div>
  );

  const archiveCount = archivedThisWeek.length + olderNotes.length;

  return (
    <div
      className={
        isPage
          ? 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
          : 'mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-700 dark:bg-slate-800/30'
      }
    >
      <div className={`flex flex-wrap items-center justify-between gap-2 ${isPage ? 'border-b border-slate-100 px-4 py-3' : 'mb-2'}`}>
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-blue-600" />
          <h2 className={`font-semibold text-slate-800 dark:text-slate-100 ${isPage ? 'text-sm' : 'text-xs'}`}>
            Toplantı Notları
          </h2>
          <span className="text-xs text-slate-400">
            {agendaNotes.length} gündem · {archiveCount} eski
          </span>
        </div>
        {!isPage ? (
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            <Settings2 className="h-3 w-3" />
            Mutatap Konular
            {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : null}
      </div>

      <div className={isPage ? 'p-4' : ''}>
        {isPage ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">Bu Hafta Gündem</p>
              {agendaNotes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                  Gündemde not yok. Yeni not ekleyin veya eski notlara bakın.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {agendaNotes.map((note) => (
                    <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                  ))}
                </ul>
              )}
              {addNoteRow}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Mutatap Konular</p>
              {templatesPanel}
            </div>
          </div>
        ) : (
          <>
            {showTemplates ? templatesPanel : null}
            {agendaNotes.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">Gündemde not yok.</p>
            ) : (
              <ul className="space-y-1">
                {agendaNotes.map((note) => (
                  <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                ))}
              </ul>
            )}
            <div className="mt-2">{addNoteRow}</div>
          </>
        )}

        {archiveCount > 0 ? (
          <div className={`${isPage ? 'mt-5 border-t border-slate-100 pt-4' : 'mt-3 border-t border-slate-200 pt-2'}`}>
            <button
              type="button"
              onClick={() => setShowOlderNotes((v) => !v)}
              className="mb-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              {showOlderNotes ? 'Eski Notları Gizle' : `Eski Notları Göster (${archiveCount})`}
            </button>
            {showOlderNotes ? (
              <div className="space-y-3">
                {archivedThisWeek.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-slate-500">Bu Hafta Tamamlanan</p>
                    <ul className="space-y-1.5">
                      {archivedThisWeek.map((note) => (
                        <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                      ))}
                    </ul>
                  </div>
                ) : null}
                {olderNotes.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-slate-500">Önceki Haftalar</p>
                    <ul className="space-y-1.5">
                      {olderNotes.map((note) => (
                        <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
