'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Mail } from 'lucide-react';
import {
  APPROVAL_72H_OWNER_PROMPT_BODY,
  buildApproval72hOwnerRelationNote,
} from '@sigorta/shared';
import { apiClient } from '@/lib/api-client';

type ReminderRecipient = {
  id: string;
  email: string;
  name: string;
  role: string;
  party: string;
  preferred?: boolean;
};

type ReminderOptions = {
  claimFileId: string;
  fileNo: string;
  insuredName?: string | null;
  title: string;
  message: string;
  fromDisplayName: string;
  recipients: ReminderRecipient[];
  preferredEmails: string[];
};

type Props = {
  claimId: string;
  fileNo?: string | null;
  insuredName?: string | null;
  /** Oturum soyadı — Sn. hitabı. */
  viewerLastName?: string | null;
  viewerFullName?: string | null;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
};

function resolveViewerName(): { lastName?: string; fullName?: string } {
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return {};
    const u = JSON.parse(raw) as {
      lastName?: string | null;
      firstName?: string | null;
      name?: string | null;
      fullName?: string | null;
    };
    const lastName = String(u.lastName ?? '').trim() || undefined;
    const fullName =
      String(u.fullName ?? u.name ?? '').trim()
      || [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
      || undefined;
    return { lastName, fullName };
  } catch {
    return {};
  }
}

function RelationNote({
  lastName,
  fullName,
}: {
  lastName?: string | null;
  fullName?: string | null;
}) {
  const note = buildApproval72hOwnerRelationNote({ lastName, fullName });
  return (
    <div
      className="rounded-lg border border-sky-100 bg-sky-50/80 px-2.5 py-2 text-[11px] leading-relaxed text-sky-950"
      data-testid="approval-72h-relation-note"
    >
      {note}
    </div>
  );
}

export function Approval72hReminderDialog({
  claimId,
  fileNo,
  insuredName,
  viewerLastName,
  viewerFullName,
  open,
  onClose,
  onSent,
}: Props) {
  const [step, setStep] = useState<'ask' | 'recipients'>('ask');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ReminderOptions | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const reset = useCallback(() => {
    setStep('ask');
    setLoading(false);
    setSending(false);
    setError(null);
    setOptions(null);
    setSelected([]);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setStep('ask');
    setError(null);
  }, [open, claimId, reset]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ReminderOptions>(
        `/claim-files/${claimId}/approval-72h-reminder`,
      );
      if (!data?.recipients) {
        throw new Error('Alıcı listesi alınamadı.');
      }
      setOptions(data);
      const preferred = (data.preferredEmails?.length
        ? data.preferredEmails
        : data.recipients.filter((r) => r.preferred).map((r) => r.email));
      setSelected(preferred.length ? preferred : data.recipients.slice(0, 1).map((r) => r.email));
      setStep('recipients');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      setError(msg || (err instanceof Error ? err.message : 'Alıcı listesi yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  const toggleEmail = (email: string) => {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  };

  const send = async () => {
    if (!selected.length) {
      setError('En az bir onay muhatabı seçin.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiClient.post(`/claim-files/${claimId}/approval-72h-reminder`, { emails: selected });
      onSent?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      setError(msg || (err instanceof Error ? err.message : 'Hatırlatma gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const shownFileNo = options?.fileNo || fileNo || '—';
  const shownInsured = String(insuredName ?? options?.insuredName ?? '').trim();
  const storedViewer = resolveViewerName();
  const relationLastName = viewerLastName ?? storedViewer.lastName;
  const relationFullName = viewerFullName ?? storedViewer.fullName;

  if (step === 'ask') {
    return createPortal(
      <div className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="approval-72h-ask-title"
          className="flex max-h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-4 sm:py-4">
            <div className="mb-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-700" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h3 id="approval-72h-ask-title" className="text-sm font-semibold text-slate-800">
                  Onay Süresi Geçti
                </h3>
                <p className="text-xs font-semibold text-slate-800">
                  Dosya No: {shownFileNo}
                </p>
                {shownInsured ? (
                  <p className="text-[11px] text-slate-500">Sigortalı: {shownInsured}</p>
                ) : null}
              </div>
            </div>
            <p className="mb-2.5 text-xs leading-relaxed text-slate-600">
              {APPROVAL_72H_OWNER_PROMPT_BODY}
            </p>
            <RelationNote lastName={relationLastName} fullName={relationFullName} />
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-3.5 py-3 sm:px-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Şimdilik Kapalı
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (loading) return;
                void loadOptions();
              }}
              className="flex-1 rounded-md bg-brand-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Hazırlanıyor…' : 'Hatırlatma Maili Gönder'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-72h-recipients-title"
        className="flex max-h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-4 sm:py-4">
          <div className="mb-3 flex items-start gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
              <Mail className="h-3.5 w-3.5 text-orange-700" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3 id="approval-72h-recipients-title" className="text-sm font-semibold text-slate-800">
                Hatırlatma Alıcısı
              </h3>
              <p className="text-xs font-semibold text-slate-800">
                Dosya No: {shownFileNo}
              </p>
              {shownInsured ? (
                <p className="text-[11px] text-slate-500">Sigortalı: {shownInsured}</p>
              ) : null}
              <p className="text-[11px] text-slate-500">
                Gönderen: {options?.fromDisplayName || 'Meridyen'}
              </p>
            </div>
          </div>

          <p className="mb-2 text-xs leading-relaxed text-slate-600">
            Hatırlatma mailinin gideceği onay muhatabını tedbiren işaretleyin. Ana müşteri kartı
            varsayılan değildir; broker veya eksper tercihe göredir.
          </p>

          <div className="mb-2.5">
            <RelationNote lastName={relationLastName} fullName={relationFullName} />
          </div>

          {loading ? (
            <p className="text-xs text-slate-500">Alıcılar yükleniyor…</p>
          ) : options?.recipients?.length ? (
            <ul className="space-y-1.5">
              {options.recipients.map((row) => {
                const checked = selected.includes(row.email);
                return (
                  <li key={row.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-2.5 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-orange-700 focus:ring-orange-600/30"
                        checked={checked}
                        onChange={() => toggleEmail(row.email)}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-800">{row.name}</span>
                        <span className="block text-[11px] text-slate-500">{row.role}</span>
                        <span className="block truncate text-[11px] text-slate-600">{row.email}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>Dosyada gönderilecek broker / eksper / sigorta adresi yok.</span>
            </div>
          )}

          {error ? (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-3.5 py-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 rounded-md border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || loading || !selected.length}
            className="flex-1 rounded-md bg-orange-700 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-800 disabled:opacity-60"
          >
            {sending ? 'Gönderiliyor…' : 'Hatırlatmayı Gönder'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
