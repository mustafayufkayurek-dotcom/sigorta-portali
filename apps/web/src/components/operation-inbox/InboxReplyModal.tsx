'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  buildInboxReplyQuotePreview,
  INBOX_REPLY_ATTACH_ACCEPT,
  INBOX_REPLY_ATTACH_MAX_BYTES,
  INBOX_REPLY_ATTACH_MAX_FILES,
  isInboxReplyAttachmentAllowed,
  isInboxReplyImageAttachment,
  outboundMailSignal,
  platformMailCopyLineLabel,
  sanitizeInboxReplyAttachmentName,
} from '@sigorta/shared';
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

type PendingAttach = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
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
  const [pendingFiles, setPendingFiles] = useState<PendingAttach[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !messageId) {
      setDetail(null);
      setPendingFiles((prev) => {
        prev.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
      return;
    }
    setBody('');
    setReplyAll(false);
    setError('');
    setDetail(null);
    setSentNow(false);
    setFailedNow(false);
    setPendingFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
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

  const addFiles = (list: File[]) => {
    if (locked || list.length === 0) return;
    setError('');
    setPendingFiles((prev) => {
      const next = [...prev];
      let used = next.reduce((n, item) => n + item.file.size, 0);
      for (const file of list) {
        if (next.length >= INBOX_REPLY_ATTACH_MAX_FILES) {
          setError(`En fazla ${INBOX_REPLY_ATTACH_MAX_FILES} ek ekleyebilirsiniz.`);
          break;
        }
        if (!isInboxReplyAttachmentAllowed(file.name, file.type)) {
          setError('Bu dosya türü eklenemez. Fotoğraf, PDF veya Word / Excel belgesi seçin.');
          continue;
        }
        if (used + file.size > INBOX_REPLY_ATTACH_MAX_BYTES) {
          setError('Ek çok büyük. Fotoğraf veya belgeyi küçültüp tekrar deneyin.');
          continue;
        }
        used += file.size;
        const image = isInboxReplyImageAttachment(file.name, file.type);
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: image ? URL.createObjectURL(file) : null,
        });
      }
      return next;
    });
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

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
      const attachments =
        pendingFiles.length === 0
          ? undefined
          : await Promise.all(
              pendingFiles.map(async (item) => ({
                filename: sanitizeInboxReplyAttachmentName(item.file.name),
                contentType: item.file.type || undefined,
                contentBase64: await readFileAsBase64(item.file),
              })),
            );
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
        ...(attachments?.length ? { attachments } : {}),
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

        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Fotoğraf Veya Belge</p>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-1.5">
            Ek, asıl yazı ile birlikte gider. Kopyaya da düşer.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={INBOX_REPLY_ATTACH_ACCEPT}
            multiple
            className="sr-only"
            disabled={locked}
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={locked}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (locked) return;
              addFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ImagePlus className="h-4 w-4 text-slate-500" aria-hidden />
            Fotoğraf Veya Belge Ekle
          </button>
          {pendingFiles.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {pendingFiles.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5"
                >
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-12 w-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-slate-500" aria-hidden />
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">
                    {item.file.name}
                  </span>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Eki kaldır"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

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
