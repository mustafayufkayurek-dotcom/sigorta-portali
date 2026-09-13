'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { buildInboxReplyQuotePreview, outboundMailSignal, platformMailCopyLineLabel } from '@sigorta/shared';
import { OutboundMailSignalStrip } from '@/components/operation-inbox/OutboundMailSignalStrip';

interface ReplyMessageDetail {
  fromAddress: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  bodyHtml: string | null;
  bodyText: string | null;
  bodyPreview: string | null;
  lastReplyAt?: string | null;
  lastReplyReadAt?: string | null;
  lastReplyFailedAt?: string | null;
  lastCounterpartReplyAt?: string | null;
  fileOwnerCopy?: { email: string; name: string; roleCode?: string | null } | null;
  platformMailCopy?: { email: string; name: string; roleCode?: string | null } | null;
}

interface InboxReplyModalProps {
  open: boolean;
  messageId: string | null;
  subject: string;
  onClose: () => void;
  onSuccess: (updated: {
    id: string;
    status: 'ACTIONED';
    lastReplyAt?: string;
    lastReplyPreview?: string;
    lastReplyReadAt?: string;
  }) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export function InboxReplyModal({
  open,
  messageId,
  subject,
  onClose,
  onSuccess,
  onToast,
}: InboxReplyModalProps) {
  const [body, setBody] = useState('');
  const [replyAll, setReplyAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ReplyMessageDetail | null>(null);
  const [sentNow, setSentNow] = useState(false);
  const [failedNow, setFailedNow] = useState(false);

  useEffect(() => {
    if (!open || !messageId) {
      setDetail(null);
      return;
    }
    setBody('');
    setReplyAll(false);
    setError('');
    setDetail(null);
    setSentNow(false);
    setFailedNow(false);
    void apiClient
      .get<ReplyMessageDetail>(`/operation-inbox/messages/${messageId}`)
      .then((res) => setDetail(res))
      .catch(() => setDetail(null));
  }, [open, messageId]);

  useEffect(() => {
    if (!open || !messageId || !sentNow) return;
    const tick = () => {
      void apiClient
        .get<ReplyMessageDetail>(`/operation-inbox/messages/${messageId}`)
        .then((res) => setDetail(res))
        .catch(() => undefined);
    };
    const id = window.setInterval(tick, 8000);
    return () => window.clearInterval(id);
  }, [open, messageId, sentNow]);

  const signal = outboundMailSignal({
    sending: loading,
    failed: failedNow,
    lastReplyAt: sentNow ? new Date().toISOString() : detail?.lastReplyAt,
    lastReplyReadAt: detail?.lastReplyReadAt,
    lastReplyFailedAt: detail?.lastReplyFailedAt,
    lastCounterpartReplyAt: detail?.lastCounterpartReplyAt,
  });

  const quotePreview = useMemo(
    () =>
      detail
        ? buildInboxReplyQuotePreview({
            replyText: body,
            fromName: detail.fromName,
            fromAddress: detail.fromAddress,
            receivedAt: detail.receivedAt,
            subject: detail.subject || subject,
            bodyHtml: detail.bodyHtml,
            bodyText: detail.bodyText,
            bodyPreview: detail.bodyPreview,
          })
        : '',
    [detail, body, subject],
  );

  if (!open || !messageId) return null;

  const locked = loading || sentNow || signal === 'read' || signal === 'replied' || signal === 'failed';
  const canSend = !locked && body.trim().length >= 3;

  const handleSend = async () => {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      setError('Yanıt en az 3 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    setError('');
    setFailedNow(false);
    try {
      const res = await apiClient.post<{
        sent: boolean;
        message: {
          id: string;
          status: 'ACTIONED';
          lastReplyAt?: string;
          lastReplyPreview?: string;
          lastReplyReadAt?: string;
        };
      }>(`/operation-inbox/messages/${messageId}/reply`, {
        body: trimmed,
        replyAll,
      });
      setSentNow(true);
      onToast('success', 'E-posta yanıtı gönderildi');
      onSuccess(res.message ?? { id: messageId, status: 'ACTIONED', lastReplyPreview: trimmed.slice(0, 200) });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Yanıt gönderilemedi';
      setFailedNow(true);
      setError(msg);
      onToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!loading) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-800 mb-1">E-postayı Yanıtla</h3>
        <p className="text-sm text-slate-500 mb-3 truncate" title={subject}>
          Konu: {subject}
        </p>

        {(detail?.platformMailCopy || detail?.fileOwnerCopy) && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-700">Platform Mail Kopyası</p>
            <p className="text-sm text-slate-800 mt-0.5">
              {platformMailCopyLineLabel(
                (detail.platformMailCopy || detail.fileOwnerCopy)?.roleCode,
              )}{' '}
              · {(detail.platformMailCopy || detail.fileOwnerCopy)?.name} ·{' '}
              {(detail.platformMailCopy || detail.fileOwnerCopy)?.email}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Sizin kutunuza asıl yazı ile birlikte gider. Asıl yazı gitmezse kopya da gitmez. Gizli kopya yok.
            </p>
          </div>
        )}

        <div className="mb-4">
          <OutboundMailSignalStrip signal={signal} />
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Yanıt Metni
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Yanıtınızı yazın…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          disabled={locked}
        />

        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replyAll}
            onChange={(e) => setReplyAll(e.target.checked)}
            disabled={locked}
            className="rounded border-slate-300 text-brand-600 focus:ring-blue-500/30"
          />
          <span className="text-sm text-slate-600">Tümünü Yanıtla</span>
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">Alıcıda yazışma geçmişi</p>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-1.5">
            Önceki yazı gönderilen mailin altında durur. Logolar ve tekrarlayan imza düşer.
          </p>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap">
            {quotePreview || 'Bu iletide geçmiş metin yok.'}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            {sentNow || signal === 'read' || signal === 'replied' ? 'Kapat' : 'İptal'}
          </button>
          {!sentNow && signal !== 'read' && signal !== 'replied' && (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
