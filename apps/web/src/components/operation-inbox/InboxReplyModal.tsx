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
  parseMailAddressList,
  platformMailCopyLineLabel,
  sanitizeInboxReplyAttachmentName,
} from '@sigorta/shared';
import { shrinkInboxReplyAttachment } from '@/utils/inbox-reply-image';
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
  const [addingFiles, setAddingFiles] = useState(false);
  const [extraTo, setExtraTo] = useState<string[]>([]);
  const [kimeDraft, setKimeDraft] = useState('');
  const [cardReminder, setCardReminder] = useState('');
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
    setExtraTo([]);
    setKimeDraft('');
    setCardReminder('');
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

  useEffect(() => {
    if (!open || !messageId) return;
    const emails = parseMailAddressList(
      [detail?.fromAddress, ...extraTo, kimeDraft].filter(Boolean).join(' '),
    );
    if (!emails.length) {
      setCardReminder('');
      return;
    }
    const t = window.setTimeout(() => {
      void apiClient
        .post<{ reminder: string | null }>('/operation-inbox/recipient-card-hints', {
          emails,
          messageId,
        })
        .then((res) => setCardReminder(res.reminder || ''))
        .catch(() => setCardReminder(''));
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, messageId, extraTo, kimeDraft, detail?.fromAddress]);

  if (!open || !messageId) return null;

  const locked = loading || addingFiles || sentNow || signal === 'read' || signal === 'replied' || signal === 'failed';
  const canSend = !locked && body.trim().length >= 3;

  const addFiles = async (list: File[]) => {
    if (locked || list.length === 0) return;
    setError('');
    setAddingFiles(true);
    try {
      const current = pendingFiles;
      const next = [...current];
      let used = next.reduce((n, item) => n + item.file.size, 0);
      let limitHit = false;
      for (const file of list) {
        if (next.length >= INBOX_REPLY_ATTACH_MAX_FILES) {
          limitHit = true;
          break;
        }
        if (!isInboxReplyAttachmentAllowed(file.name, file.type)) {
          setError('Bu dosya türü eklenemez. Fotoğraf, PDF veya Word / Excel belgesi seçin.');
          continue;
        }
        const ready = await shrinkInboxReplyAttachment(file, INBOX_REPLY_ATTACH_MAX_BYTES - used);
        if (used + ready.size > INBOX_REPLY_ATTACH_MAX_BYTES) {
          setError('Ek çok büyük. Fotoğraf veya belgeyi küçültüp tekrar deneyin.');
          continue;
        }
        used += ready.size;
        const image = isInboxReplyImageAttachment(ready.name, ready.type);
        next.push({
          id: `${ready.name}-${ready.size}-${ready.lastModified}-${Math.random().toString(36).slice(2)}`,
          file: ready,
          previewUrl: image ? URL.createObjectURL(ready) : null,
        });
      }
      if (limitHit) {
        setError(`En fazla ${INBOX_REPLY_ATTACH_MAX_FILES} ek ekleyebilirsiniz.`);
      }
      setPendingFiles(next);
    } finally {
      setAddingFiles(false);
    }
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
        ...(extraTo.length ? { extraTo } : {}),
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

        <label className="block text-xs font-medium text-slate-600 mb-1.5">Kime</label>
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            {detail?.fromAddress && (
              <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {detail.fromAddress}
              </span>
            )}
            {extraTo.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs text-slate-800"
              >
                {email}
                {!locked && (
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-800"
                    aria-label="Adresi kaldır"
                    onClick={() => setExtraTo((prev) => prev.filter((item) => item !== email))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            <input
              type="text"
              value={kimeDraft}
              disabled={locked}
              placeholder="Adres ekle"
              className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none"
              onChange={(e) => setKimeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ',') return;
                e.preventDefault();
                const added = parseMailAddressList(kimeDraft);
                if (!added.length) return;
                setExtraTo((prev) => [...new Set([...prev, ...added])]);
                setKimeDraft('');
              }}
              onBlur={() => {
                const added = parseMailAddressList(kimeDraft);
                if (!added.length) return;
                setExtraTo((prev) => [...new Set([...prev, ...added])]);
                setKimeDraft('');
              }}
            />
          </div>
          <p className="mt-1 px-1 text-[11px] text-slate-500">
            Birden fazla adres yazabilirsiniz. Enter veya virgül ile eklenir.
          </p>
        </div>
        {cardReminder && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-sm text-amber-950">{cardReminder}</p>
          </div>
        )}

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
            Ek, asıl yazı ile birlikte gider. Fotoğraflar gönderime uygun küçültülür.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={INBOX_REPLY_ATTACH_ACCEPT}
            multiple
            className="sr-only"
            disabled={locked}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
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
              void addFiles(Array.from(e.dataTransfer.files ?? []));
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
