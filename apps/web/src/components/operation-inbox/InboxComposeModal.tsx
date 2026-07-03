'use client';

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { toTitleCaseTR } from '@/utils/text-helpers';
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

  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkedClaim, setLinkedClaim] = useState<LinkPickerHasarFile | null>(null);
  const [linkedEmergency, setLinkedEmergency] = useState<EmergencyCase | null>(null);

  useEffect(() => {
    if (!open) return;
    setMailbox(defaultMailbox);
    setToInput('');
    setSubject('');
    setBody('');
    setLinkedClaim(null);
    setLinkedEmergency(null);
    setError('');
  }, [open, defaultMailbox]);

  if (!open) return null;

  const parseRecipients = (raw: string): string[] =>
    raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const canSend =
    !loading
    && parseRecipients(toInput).length > 0
    && subject.trim().length > 0
    && body.trim().length >= 3;

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
    try {
      await apiClient.post('/operation-inbox/compose', {
        mailbox,
        to,
        subject: trimmedSubject,
        body: trimmedBody,
        claimFileId: linkedClaim?.id,
        emergencyCaseId: linkedEmergency?.id,
      });
      onToast('success', 'E-posta gönderildi');
      onClose();
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'E-posta gönderilemedi';
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
          <p className="text-sm text-slate-500 mb-4">
            Paylaşımlı kutudan yeni e-posta gönderin.
          </p>

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Gönderen Kutu
          </label>
          <select
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value as InboundMailbox)}
            disabled={loading}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          >
            {MAILBOX_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Alıcı
          </label>
          <input
            type="text"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            placeholder="ornek@firma.com, diger@firma.com"
            disabled={loading}
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
            disabled={loading}
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
            disabled={loading}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLinkPickerOpen(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Dosya Bağla (İsteğe Bağlı)
            </button>
            {linkedLabel && (
              <span className="text-xs text-blue-600 font-medium">{linkedLabel}</span>
            )}
            {(linkedClaim || linkedEmergency) && (
              <button
                type="button"
                onClick={() => { setLinkedClaim(null); setLinkedEmergency(null); }}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Kaldır
              </button>
            )}
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
              İptal
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
