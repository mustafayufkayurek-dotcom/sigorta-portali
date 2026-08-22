'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import SpeechToText from '@/components/SpeechToText';
import {
  FinansActionButton,
  FinansEmptyState,
  FinansFieldLabel,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { useToast } from '@/contexts/ToastContext';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { mergeClaimFileNotes, type ClaimFileNoteRow } from '@/utils/merge-claim-file-notes';
import { API, authAxios } from '../claim-detail-utils';

type NoteType =
  | 'manager_instruction'
  | 'general'
  | 'operations'
  | 'finance'
  | 'adjuster'
  | 'field'
  | 'field_correction';

type FilterKey = 'all' | 'manager_instruction' | 'general';

type NoteRecord = ClaimFileNoteRow & { noteType: NoteType };

const NOTE_TYPE_LABELS: Record<string, string> = {
  manager_instruction: 'Talimat',
  general: 'Dosya Notu',
  operations: 'Operasyon',
  finance: 'Finans',
  adjuster: 'Eksper',
  field: 'Saha',
  field_correction: 'Düzeltme',
};

const COMPOSER_NOTE_TYPES: { value: 'manager_instruction' | 'general'; label: string }[] = [
  { value: 'manager_instruction', label: 'Talimat' },
  { value: 'general', label: 'Dosya Notu' },
];

const FILTER_CHIPS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'manager_instruction', label: 'Talimat' },
  { id: 'general', label: 'Dosya Notu' },
];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function authorName(author?: { firstName?: string; lastName?: string }) {
  const name = [author?.firstName, author?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Bilinmeyen';
}

function NoteFeedItem({ note }: { note: NoteRecord }) {
  const isTalimat = note.noteType === 'manager_instruction';
  const isCorrection = note.noteType === 'field_correction';
  const label = NOTE_TYPE_LABELS[note.noteType] ?? note.noteType;

  if (isTalimat) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">
              !
            </span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {label}
            </span>
            <span className="truncate text-xs font-semibold text-amber-800">
              {authorName(note.author)}
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{formatTimestamp(note.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap pl-8 text-sm text-slate-800">{note.content}</p>
      </div>
    );
  }

  const isGeneral = note.noteType === 'general';
  return (
    <div
      className={`rounded-xl border p-4 ${
        isCorrection
          ? 'border-sky-100 bg-sky-50/70'
          : isGeneral
            ? 'border-blue-100 bg-white'
            : 'border-slate-100 bg-white'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isCorrection
                ? 'bg-sky-100 text-sky-800'
                : isGeneral
                  ? 'bg-blue-50 text-brand-600'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </span>
          <span className="text-xs font-medium text-slate-600">{authorName(note.author)}</span>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{formatTimestamp(note.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{note.content}</p>
    </div>
  );
}

export function IletisimGunluguPanel({
  claimId,
  variant = 'office',
}: {
  claimId: string;
  /** Saha: talimat/composer sadeleştirilir; ofis evrak dili yok */
  variant?: 'office' | 'field';
}) {
  const { showToast } = useToast();
  const isField = variant === 'field';
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<'manager_instruction' | 'general'>('general');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [asCorrection, setAsCorrection] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, timelineRes] = await Promise.all([
        authAxios<{ data: NoteRecord[] }>({
          method: 'GET',
          url: `${API}/notes?claimFileId=${claimId}&limit=100`,
        }).catch(() => null),
        authAxios<NoteRecord[] | { data?: NoteRecord[] }>({
          method: 'GET',
          url: `${API}/claim-files/${claimId}/notes`,
        }).catch(() => null),
      ]);
      const fromNotes = notesRes?.data?.data ?? [];
      const rawTimeline = timelineRes?.data;
      const fromTimeline = Array.isArray(rawTimeline)
        ? rawTimeline
        : Array.isArray(rawTimeline?.data)
          ? rawTimeline.data
          : [];
      setNotes(mergeClaimFileNotes(fromNotes, fromTimeline) as NoteRecord[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredNotes = useMemo(() => {
    if (filter === 'all') return notes;
    return notes.filter((n) => n.noteType === filter);
  }, [notes, filter]);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (isField) {
        await authAxios({
          method: 'POST',
          url: `${API}/claim-files/${claimId}/notes`,
          data: { content: trimmed, noteType: asCorrection ? 'field_correction' : 'field' },
        });
      } else {
        await authAxios({
          method: 'POST',
          url: `${API}/notes`,
          data: { claimFileId: claimId, content: trimmed, noteType },
        });
      }
      setContent('');
      setAsCorrection(false);
      showToast('success', 'Kayıt eklendi');
      load();
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 401) return;
      const message =
        axios.isAxiosError(e) && e.response?.data?.message
          ? String(e.response.data.message)
          : 'Kayıt eklenemedi';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const emptyTitle = isField
    ? 'Henüz Tespit Notu Yok'
    : filter === 'all'
      ? 'Henüz Kayıt Yok'
      : filter === 'manager_instruction'
        ? 'Talimat Bulunamadı'
        : 'Dosya Notu Bulunamadı';

  const emptyDescription = isField
    ? 'Sahada gördüğünüz durumu buraya yazabilirsiniz.'
    : filter === 'all'
      ? 'Yukarıdaki formu kullanarak talimat veya dosya notu ekleyebilirsiniz.'
      : 'Bu filtreye uygun kayıt yok. Farklı bir filtre seçin veya yeni kayıt ekleyin.';

  return (
    <div className="space-y-4" data-testid={isField ? 'saha-tespit-notlari' : undefined}>
      <FinansPanelCard
        title={isField ? 'Tespit Notu Ekle' : 'Kayıt Ekle'}
        subtitle={isField ? 'Ofis ile ortak görünür' : 'Talimat veya dosya notu'}
      >
        <div className={`grid grid-cols-1 items-start gap-3 ${isField ? '' : 'md:grid-cols-2'}`}>
          {!isField ? (
            <div>
              <FinansFieldLabel>Kayıt Türü</FinansFieldLabel>
              <select
                className={finansInputClass}
                value={noteType}
                onChange={(e) =>
                  setNoteType(e.target.value as 'manager_instruction' | 'general')
                }
              >
                {COMPOSER_NOTE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={isField ? '' : undefined}>
            <FinansFieldLabel required>İçerik</FinansFieldLabel>
            <div className="relative">
              <textarea
                className={`${finansInputClass} resize-none pr-14`}
                rows={3}
                placeholder={isField ? 'Tespit notu yazın...' : 'Talimat veya not yazın...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => {
                  const v = toTitleCaseTR(content.trim());
                  if (v !== content.trim()) setContent(v);
                }}
              />
              <div className="absolute bottom-2 right-2">
                <SpeechToText
                  size="sm"
                  onTranscript={(text) =>
                    setContent((prev) => (prev ? `${prev} ${text}` : text))
                  }
                />
              </div>
            </div>
          </div>
          <div className={`flex flex-wrap items-center justify-end gap-3 ${isField ? '' : 'md:col-span-2'}`}>
            {isField ? (
              <label className="mr-auto inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={asCorrection}
                  onChange={(e) => setAsCorrection(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  data-testid="tespit-notu-duzeltme"
                />
                Düzeltme
              </label>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </FinansPanelCard>

      {!isField ? (
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((chip) => (
            <FinansActionButton
              key={chip.id}
              label={chip.label}
              variant="neutral"
              active={filter === chip.id}
              onClick={() => setFilter(chip.id)}
            />
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : filteredNotes.length === 0 ? (
        <FinansEmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <NoteFeedItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
