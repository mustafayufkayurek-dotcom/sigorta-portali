'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { shrinkInboxReplyAttachment } from '@/utils/inbox-reply-image';
import {
  INBOX_REPLY_ATTACH_ACCEPT,
  INBOX_REPLY_ATTACH_MAX_BYTES,
  INBOX_REPLY_ATTACH_MAX_FILES,
  isInboxReplyAttachmentAllowed,
  isInboxReplyImageAttachment,
  outboundMailSignal,
  sanitizeInboxReplyAttachmentName,
} from '@sigorta/shared';
import { OutboundMailSignalStrip } from '@/components/operation-inbox/OutboundMailSignalStrip';
import {
  InboxLinkFilePickerModal,
  type LinkPickerHasarFile,
} from '@/components/operation-inbox/InboxLinkFilePickerModal';
import type { EmergencyCase } from '@/utils/emergencyApi';

type InboundMailbox = 'IHBAR' | 'HASAR';

interface InboxComposeModalProps {
  open: boolean;
  defaultMailbox?: InboundMailbox;
  onClose: () => void;
  onSuccess: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

const MAILBOX_OPTIONS: { value: InboundMailbox; label: string }[] = [
  { value: 'IHBAR', label: 'İhbar (ihbar@)' },
  { value: 'HASAR', label: 'Hasar (hasar@)' },
];

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

export function InboxComposeModal({
  open,
  defaultMailbox = 'HASAR',
  onClose,
  onSuccess,
  onToast,
}: InboxComposeModalProps) {
  const [mailbox, setMailbox] = useState<InboundMailbox>(defaultMailbox);
  const [toInput, setToInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentNow, setSentNow] = useState(false);
  const [failedNow, setFailedNow] = useState(false);

  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkedClaim, setLinkedClaim] = useState<LinkPickerHasarFile | null>(null);
  const [linkedEmergency, setLinkedEmergency] = useState<EmergencyCase | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingAttach[]>([]);
  const [addingFiles, setAddingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMailbox(defaultMailbox);
    setToInput('');
    setSubject('');
    setBody('');
    setLinkedClaim(null);
    setLinkedEmergency(null);
    setPendingFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    setAddingFiles(false);
    setError('');
    setSentNow(false);
    setFailedNow(false);
  }, [open, defaultMailbox]);

  if (!open) return null;

  const parseRecipients = (raw: string): string[] =>
    raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const locked = loading || addingFiles || sentNow;

  const canSend =
    !locked
    && parseRecipients(toInput).length > 0
    && subject.trim().length > 0
    && body.trim().length >= 3;

  const addFiles = async (list: File[]) => {
    if (locked || list.length === 0) return;
    setError('');
    setAddingFiles(true);
    try {
      const next = [...pendingFiles];
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

  const signal = outboundMailSignal({
    sending: loading,
    failed: failedNow,
    lastReplyAt: sentNow ? new Date().toISOString() : null,
  });

  const handleSend = async () => {
    const to = parseRecipients(toInput);
    if (to.length === 0) {
      setError('En az bir alıcı e-posta adresi girin.');
      return;
    }
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (trimmedSubject.length === 0 || trimmedBody.length < 3) {
      setError('Konu ve mesaj metni zorunludur.');
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
      await apiClient.post('/operation-inbox/compose', {
        mailbox,
        to,
        subject: trimmedSubject,
        body: trimmedBody,
        claimFileId: linkedClaim?.id,
        emergencyCaseId: linkedEmergency?.id,
        ...(attachments?.length ? { attachments } : {}),
      });
      setSentNow(true);
      onToast('success', 'E-posta gönderildi');
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'E-posta gönderilemedi';
      setFailedNow(true);
      setError(msg);
      onToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const linkedLabel = linkedClaim
    ? `Hasar: ${linkedClaim.fileNo}`
    : linkedEmergency
      ? `Acil: ${linkedEmergency.caseNo ?? linkedEmergency.fileNo}`
      : null;

  return (
    <>
      <InboxLinkFilePickerModal
        open={linkPickerOpen}
        onClose={() => setLinkPickerOpen(false)}
        preferredTab={mailbox === 'IHBAR' ? 'acil' : 'hasar'}
        onSelectClaim={(file) => {
          setLinkedClaim(file);
          setLinkedEmergency(null);
          setLinkPickerOpen(false);
        }}
        onSelectEmergency={(file) => {
          setLinkedEmergency(file);
          setLinkedClaim(null);
          setLinkPickerOpen(false);
        }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!loading) onClose(); }}
        />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Yeni E-posta</h3>
          <p className="text-sm text-slate-500 mb-3">
            Paylaşımlı kutudan yeni e-posta gönderin.
          </p>
          <div className="mb-4">
            <OutboundMailSignalStrip signal={signal} />
          </div>

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Gönderen Kutu
          </label>
          <select
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value as InboundMailbox)}
            disabled={loading || sentNow}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          >
            {MAILBOX_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Kime
          </label>
          <input
            type="text"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="ornek@firma.com, diger@firma.com"
            disabled={loading || sentNow}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Konu
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v) setSubject(v);
            }}
            disabled={loading || sentNow}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Mesaj
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Mesajınızı yazın…"
            disabled={loading || sentNow}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{item.file.name}</span>
                    {!locked && (
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-status-danger"
                        onClick={() => removeFile(item.id)}
                      >
                        Kaldır
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLinkPickerOpen(true)}
              disabled={loading || sentNow}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Dosya Bağla (İsteğe Bağlı)
            </button>
            {linkedLabel && (
              <span className="text-xs text-brand-600 font-medium">{linkedLabel}</span>
            )}
            {(linkedClaim || linkedEmergency) && (
              <button
                type="button"
                onClick={() => { setLinkedClaim(null); setLinkedEmergency(null); }}
                className="text-xs text-slate-400 hover:text-status-danger"
              >
                Kaldır
              </button>
            )}
          </div>
          {(linkedClaim || linkedEmergency) && (
            <p className="text-[11px] text-slate-500 mt-2">
              Dosya sorumlusunun adresi görünür kopyaya yazılır. Gizli kopya yok.
            </p>
          )}

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
              {sentNow ? 'Kapat' : 'İptal'}
            </button>
            {!sentNow && (
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
    </>
  );
}
