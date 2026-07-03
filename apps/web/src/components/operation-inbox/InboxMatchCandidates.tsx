'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

export interface MatchCandidate {
  type: 'claim' | 'emergency';
  id: string;
  fileNo: string;
  score: number;
  reason: string;
}

interface InboxMatchCandidatesProps {
  messageId: string;
  onLinkClaim: (claimFileId: string, fileNo: string) => void;
  onLinkEmergency: (emergencyCaseId: string, fileNo: string) => void;
  linking: boolean;
}

export function InboxMatchCandidates({
  messageId,
  onLinkClaim,
  onLinkEmergency,
  linking,
}: InboxMatchCandidatesProps) {
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<{ candidates: MatchCandidate[] }>(
        `/operation-inbox/messages/${messageId}/match-candidates`,
      );
      setCandidates(res.candidates ?? []);
    } catch {
      setError('Öneriler yüklenemedi');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-xs text-slate-400 mt-2">Önerilen dosyalar aranıyor…</p>
    );
  }

  if (error || candidates.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2.5">
      <p className="text-xs font-medium text-indigo-800 mb-2">Önerilen Dosyalar</p>
      <ul className="space-y-1.5">
        {candidates.map((c) => (
          <li
            key={`${c.type}:${c.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-2 border border-indigo-100/80"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-800">{c.fileNo}</span>
                <span className="badge badge-gray text-[10px]">
                  {c.type === 'claim' ? 'Hasar' : 'Acil'}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">{c.score} puan</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={c.reason}>
                {c.reason}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={
                  c.type === 'claim'
                    ? `/panel/hasar-dosyalari/${c.id}`
                    : `/panel/acil-yardim/${c.id}`
                }
                className="text-[11px] font-medium text-slate-500 hover:text-blue-600"
                target="_blank"
              >
                Görüntüle
              </Link>
              <button
                type="button"
                disabled={linking}
                onClick={() => {
                  if (c.type === 'claim') onLinkClaim(c.id, c.fileNo);
                  else onLinkEmergency(c.id, c.fileNo);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Bağla
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
