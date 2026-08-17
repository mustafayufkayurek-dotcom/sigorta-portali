'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export type MondayMeetingTemplate = {
  id: string;
  text: string;
  sortOrder: number;
  active: boolean;
};

export type MondayMeetingNote = {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  weekKey: string;
  templateId: string | null;
};

export type MondayMeetingPayload = {
  templates: MondayMeetingTemplate[];
  notes: MondayMeetingNote[];
  initialized: boolean;
  weekKey: string;
};

function storageKey(weekKey: string) {
  return `mm-archived-${weekKey}`;
}

export function formatWeekLabel(weekKey: string): string {
  const monday = new Date(`${weekKey}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const weekNo = getIsoWeekNumber(monday);
  return `Hafta ${weekNo} · ${fmt(monday)} – ${fmt(sunday)}`;
}

function getIsoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export type MeetingReadiness = 'ready' | 'pending' | 'empty';

export function computeMeetingStats(
  data: MondayMeetingPayload | null,
  sessionArchivedIds: Set<string>,
) {
  if (!data) {
    return {
      openAgenda: 0,
      completedThisWeek: 0,
      activeTemplates: 0,
      readiness: 'empty' as MeetingReadiness,
    };
  }

  const weekNotes = data.notes.filter((n) => n.weekKey === data.weekKey);
  const openAgenda = weekNotes.filter(
    (n) => !n.completed || !sessionArchivedIds.has(n.id),
  ).length;
  const completedThisWeek = weekNotes.filter((n) => n.completed).length;
  const activeTemplates = data.templates.filter((t) => t.active).length;

  let readiness: MeetingReadiness = 'pending';
  if (weekNotes.length === 0) {
    readiness = 'empty';
  } else if (openAgenda === 0 && completedThisWeek > 0) {
    readiness = 'ready';
  }

  return { openAgenda, completedThisWeek, activeTemplates, readiness };
}

export function useMondayMeetingData() {
  const [data, setData] = useState<MondayMeetingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionArchivedIds, setSessionArchivedIds] = useState<Set<string>>(() => new Set());
  const notesRef = useRef<MondayMeetingNote[]>([]);
  const weekKeyRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/monday-meeting`, { headers: authHeader() });
      const payload = (res.data?.data ?? res.data) as MondayMeetingPayload;
      setData(payload);
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

  const stats = useMemo(
    () => computeMeetingStats(data, sessionArchivedIds),
    [data, sessionArchivedIds],
  );

  return {
    data,
    loading,
    sessionArchivedIds,
    stats,
    setData,
    reload: load,
    notesRef,
  };
}
