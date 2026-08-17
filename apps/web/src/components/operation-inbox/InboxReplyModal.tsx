'use client';

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

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

  useEffect(() => {
    if (open) {
      setBody('');
      setReplyAll(false);
      setError('');
    }
  }, [open, messageId]);

  if (!open || !messageId) return null;

  const canSend = !loading && body.trim().length >= 3;

  const handleSend = async () => {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      setError('Yanıt en az 3 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post<{
        sent: boolean;
        message: {
          id: string;
          status: 'ACTIONED';
          lastReplyAt?: string;
          lastReplyPreview?: string;
        };
      }>(`/operation-inbox/messages/${messageId}/reply`, {
        body: trimmed,
        replyAll,
      });
      onToast('success', 'E-posta yanıtı gönderildi');
      onClose();
      onSuccess(res.message ?? { id: messageId, status: 'ACTIONED', lastReplyPreview: trimmed.slice(0, 200) });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Yanıt gönderilemedi';
      setError(msg);
      onToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!loading) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">E-postayı Yanıtla</h3>
        <p className="text-sm text-slate-500 mb-4 truncate" title={subject}>
          Konu: {subject}
        </p>

        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Yanıt Metni
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Yanıtınızı yazın…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          disabled={loading}
        />

        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replyAll}
            onChange={(e) => setReplyAll(e.target.checked)}
            disabled={loading}
            className="rounded border-slate-300 text-brand-600 focus:ring-blue-500/30"
          />
          <span className="text-sm text-slate-600">Tümünü Yanıtla</span>
        </label>

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
            İptal
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
