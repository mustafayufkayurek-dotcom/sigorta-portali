'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, ListChecks, Plus, Settings2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { MondayMeetingBriefingBand } from './monday-meeting-briefing-band';
import {
  type MondayMeetingNote,
  type MondayMeetingPayload,
  type MondayMeetingTemplate,
  useMondayMeetingData,
} from './use-monday-meeting-data';

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
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
        note.completed
          ? 'border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40'
          : 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
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

type MondayMeetingNotesProps = {
  mode?: 'widget' | 'page';
  showBriefing?: boolean;
};

export function MondayMeetingNotes({
  mode = 'widget',
  showBriefing = false,
}: MondayMeetingNotesProps) {
  const isPage = mode === 'page';
  const { data, loading, sessionArchivedIds, stats, setData, notesRef } = useMondayMeetingData();
  const [showOlderNotes, setShowOlderNotes] = useState(false);
  const [showTemplates, setShowTemplates] = useState(isPage);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState<MondayMeetingTemplate[]>([]);

  const effectiveDraftTemplates = useMemo(() => {
    if (draftTemplates.length > 0) return draftTemplates;
    return data?.templates ?? [];
  }, [draftTemplates, data?.templates]);

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

  const applyPayload = (payload: MondayMeetingPayload) => {
    setData(payload);
    setDraftTemplates(payload.templates ?? []);
    notesRef.current = payload.notes ?? [];
  };

  const toggleNote = async (id: string) => {
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API}/system-settings/monday-meeting/notes/${id}/toggle`,
        {},
        { headers: authHeader() },
      );
      applyPayload((res.data?.data ?? res.data) as MondayMeetingPayload);
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
      applyPayload((res.data?.data ?? res.data) as MondayMeetingPayload);
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
        { templates: effectiveDraftTemplates },
        { headers: authHeader() },
      );
      applyPayload((res.data?.data ?? res.data) as MondayMeetingPayload);
      if (!isPage) setShowTemplates(false);
    } finally {
      setSaving(false);
    }
  };

  const briefingBand =
    isPage && showBriefing ? (
      <MondayMeetingBriefingBand
        data={data}
        loading={loading}
        openAgenda={stats.openAgenda}
        completedThisWeek={stats.completedThisWeek}
        activeTemplates={stats.activeTemplates}
        readiness={stats.readiness}
      />
    ) : null;

  if (loading && !isPage) {
    return (
      <div className="mt-2 animate-pulse rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (loading && isPage) {
    return (
      <div className="space-y-4">
        {briefingBand}
        <div className="animate-pulse rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900">
          <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {briefingBand}
        <p className="text-sm text-slate-500">Toplantı notları yüklenemedi.</p>
      </div>
    );
  }

  const templatesPanel = (
    <div
      className={`rounded-2xl border border-blue-100/80 bg-blue-50/30 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 ${isPage ? 'h-full' : 'mb-2'}`}
    >
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Her Pazartesi otomatik listelenecek mutatap konular.
      </p>
      <ul className="space-y-2">
        {effectiveDraftTemplates.map((tpl, idx) => (
          <li key={tpl.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tpl.active}
              onChange={(e) => {
                const next = [...effectiveDraftTemplates];
                next[idx] = { ...tpl, active: e.target.checked };
                setDraftTemplates(next);
              }}
              className="rounded border-slate-300"
            />
            <input
              type="text"
              value={tpl.text}
              onChange={(e) => {
                const next = [...effectiveDraftTemplates];
                next[idx] = { ...tpl, text: e.target.value };
                setDraftTemplates(next);
              }}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (!v) return;
                const next = [...effectiveDraftTemplates];
                next[idx] = { ...tpl, text: v };
                setDraftTemplates(next);
              }}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setDraftTemplates((prev) => {
              const base = prev.length > 0 ? prev : effectiveDraftTemplates;
              return [
                ...base,
                {
                  id: `mm-tpl-draft-${Date.now()}`,
                  text: '',
                  sortOrder: (base.length + 1) * 10,
                  active: true,
                },
              ];
            })
          }
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          + Konu Ekle
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveTemplates()}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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
        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
      <button
        type="button"
        disabled={saving || !newNote.trim()}
        onClick={() => void addNote()}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Ekle
      </button>
    </div>
  );

  const archiveCount = archivedThisWeek.length + olderNotes.length;

  const notesBody = (
    <>
      {isPage ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Bu Hafta Gündem
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {agendaNotes.length}
              </span>
            </div>
            {agendaNotes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
                Gündemde not yok. Yeni not ekleyin veya eski notlara bakın.
              </p>
            ) : (
              <ul className="space-y-2">
                {agendaNotes.map((note) => (
                  <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                ))}
              </ul>
            )}
            {addNoteRow}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Mutatap Konular
              </h3>
            </div>
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
        <div className={`${isPage ? 'mt-6 border-t border-slate-100 pt-5 dark:border-slate-800' : 'mt-3 border-t border-slate-200 pt-2'}`}>
          <button
            type="button"
            onClick={() => setShowOlderNotes((v) => !v)}
            className="mb-3 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {showOlderNotes ? 'Eski Notları Gizle' : `Eski Notları Göster (${archiveCount})`}
          </button>
          {showOlderNotes ? (
            <div className="space-y-4">
              {archivedThisWeek.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Bu Hafta Tamamlanan</p>
                  <ul className="space-y-2">
                    {archivedThisWeek.map((note) => (
                      <NoteRow key={note.id} note={note} saving={saving} onToggle={(id) => void toggleNote(id)} />
                    ))}
                  </ul>
                </div>
              ) : null}
              {olderNotes.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Önceki Haftalar</p>
                  <ul className="space-y-2">
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
    </>
  );

  if (isPage) {
    return (
      <div className="space-y-4">
        {briefingBand}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Toplantı Notları
              </h2>
              <span className="text-xs text-slate-400">
                {agendaNotes.length} gündem · {archiveCount} eski
              </span>
            </div>
          </div>
          <div className="p-5 sm:p-6">{notesBody}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-700 dark:bg-slate-800/30">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-brand-600" />
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Toplantı Notları
          </h2>
          <span className="text-xs text-slate-400">
            {agendaNotes.length} gündem · {archiveCount} eski
          </span>
        </div>
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
      {notesBody}
    </div>
  );
}
