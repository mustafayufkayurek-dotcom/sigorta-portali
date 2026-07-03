'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { API, authHeader } from '@/utils/api';
import { InboxReplyModal } from '@/components/operation-inbox/InboxReplyModal';
import { useToast } from '@/contexts/ToastContext';

interface InboundAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string | null;
}

interface InboundEmailRow {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  receivedAt: string;
  aiSummary: string | null;
  bodyPreview: string | null;
  mailbox: 'IHBAR' | 'HASAR';
  attachments: InboundAttachment[];
}

interface Props {
  claimFileId?: string;
  emergencyCaseId?: string;
}

const MAILBOX_LABELS = { IHBAR: 'İhbar', HASAR: 'Hasar' } as const;

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function openAttachment(storageKey: string) {
  const res = await axios.get(`${API}/uploads/signed-url`, {
    headers: authHeader(),
    params: { storageKey },
  });
  const url = res.data?.data?.url;
  if (url) window.open(url, '_blank');
}

export function InboundEmailCorrespondencePanel({ claimFileId, emergencyCaseId }: Props) {
  const { showToast } = useToast();
  const [items, setItems] = useState<InboundEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyModal, setReplyModal] = useState<{ messageId: string; subject: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = claimFileId
        ? `/operation-inbox/messages/by-claim/${claimFileId}`
        : `/operation-inbox/messages/by-emergency/${emergencyCaseId}`;
      const res = await apiClient.get<{ items: InboundEmailRow[]; total: number }>(path);
      setItems(res.items ?? []);
    } catch {
      setError('E-posta yazışmaları yüklenemedi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [claimFileId, emergencyCaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="text-slate-400 py-8 text-center text-sm">Yükleniyor…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-600">Bağlı E-posta Yok</p>
        <p className="text-xs text-slate-400 mt-1">
          Operasyon gelen kutusundan bu dosyaya bağlanan e-postalar burada görünür.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InboxReplyModal
        open={!!replyModal}
        messageId={replyModal?.messageId ?? null}
        subject={replyModal?.subject ?? ''}
        onClose={() => setReplyModal(null)}
        onSuccess={(_updated) => { void load(); }}
        onToast={showToast}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">E-posta Yazışmaları</h3>
        <span className="text-xs text-slate-400">{items.length} kayıt</span>
      </div>

      {items.map((row) => (
        <article
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-900 truncate" title={row.subject}>
                {row.subject}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {row.fromName ? `${row.fromName} · ${row.fromAddress}` : row.fromAddress}
              </p>
            </div>
            <span className="badge badge-blue shrink-0">{MAILBOX_LABELS[row.mailbox]}</span>
          </div>

          {row.aiSummary && (
            <p className="text-xs text-slate-600 mt-2">{row.aiSummary}</p>
          )}

          {row.bodyPreview && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{row.bodyPreview}</p>
          )}

          <p className="text-[11px] text-slate-400 mt-2">{fmtDateTime(row.receivedAt)}</p>

          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setReplyModal({ messageId: row.id, subject: row.subject })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Yanıtla
            </button>
          </div>

          {row.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {row.attachments.map((att) => (
                att.storageKey ? (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => void openAttachment(att.storageKey!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    📎 {att.fileName}
                    <span className="text-slate-400">({formatBytes(att.sizeBytes)})</span>
                  </button>
                ) : (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-2 py-1 text-[11px] text-slate-400"
                  >
                    📎 {att.fileName}
                  </span>
                )
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
