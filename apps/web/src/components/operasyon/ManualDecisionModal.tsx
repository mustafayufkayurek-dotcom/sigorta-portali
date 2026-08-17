'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, RefreshCw, X, XCircle } from 'lucide-react';
import { toTitleCaseTR } from '@/utils/text-helpers';

export type ManualDecisionAction = 'approve' | 'reject' | 'revise';

const ACTION_META: Record<
  ManualDecisionAction,
  {
    title: string;
    submitLabel: string;
    submittingLabel: string;
    accent: string;
    iconBg: string;
    Icon: typeof CheckCircle2;
    hint: string;
    placeholder: string;
    reasonLabel: string;
  }
> = {
  approve: {
    title: 'Manuel Onay',
    submitLabel: 'Onayı Kaydet',
    submittingLabel: 'Kaydediliyor…',
    accent: 'bg-brand-600 hover:bg-brand-700',
    iconBg: 'bg-status-success/10 text-status-success',
    Icon: CheckCircle2,
    hint: 'Müşterinin sözlü onayı dosya ve rapor sürecine işlenir. Yönetici ile müşteri bilgilendirilir.',
    placeholder: 'Örn. Müşteri Telefonla Onay Verdi. Görüşme Saati: 11:20 · Yetkili: Ayşe Yılmaz',
    reasonLabel: 'Karar Gerekçesi',
  },
  reject: {
    title: 'Manuel Red',
    submitLabel: 'Reddi Kaydet',
    submittingLabel: 'Kaydediliyor…',
    accent: 'bg-status-danger hover:opacity-90',
    iconBg: 'bg-status-danger/10 text-status-danger',
    Icon: XCircle,
    hint: 'Müşterinin sözlü reddi dosya ve rapor sürecine işlenir. Yönetici ile müşteri bilgilendirilir.',
    placeholder: 'Örn. Müşteri Telefonla Reddetti. Görüşme Saati: 11:20 · Yetkili: Ayşe Yılmaz',
    reasonLabel: 'Karar Gerekçesi',
  },
  revise: {
    title: 'Manuel Revizyon',
    submitLabel: 'Revizyona Git',
    submittingLabel: 'Revizyon Açılıyor…',
    accent: 'bg-brand-600 hover:bg-brand-700',
    iconBg: 'bg-status-warning/10 text-status-warning',
    Icon: RefreshCw,
    hint: 'Revizyon gerekçesini yazın. Devam ettiğinizde rapor revizyon adımı açılır; düzenleme mevcut revizyon sayfasında sürer. Yönetici ile müşteri bilgilendirilir.',
    placeholder: 'Örn. Müşteri Telefonla Revizyon İstedi. Eksik Kalem: Mutfak Dolabı · Görüşme Saati: 11:20',
    reasonLabel: 'Revizyon Gerekçesi',
  },
};

const MIN_REASON = 10;

export type ManualDecisionModalProps = {
  open: boolean;
  action: ManualDecisionAction | null;
  fileNo?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function ManualDecisionModal({
  open,
  action,
  fileNo,
  submitting = false,
  onClose,
  onConfirm,
}: ManualDecisionModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open, action]);

  if (!open || !action) return null;
  const meta = ACTION_META[action];
  const Icon = meta.Icon;
  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= MIN_REASON && !submitting;

  async function handleSubmit() {
    if (trimmed.length < MIN_REASON) {
      setError(`Açıklama en az ${MIN_REASON} karakter olmalıdır.`);
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Kapat"
        onClick={onClose}
        disabled={submitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-content-primary">{meta.title}</h2>
            <p className="mt-0.5 text-xs text-content-tertiary">
              {fileNo ? `Dosya No: ${fileNo}` : 'Sözlü Müşteri Kararı'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-content-tertiary hover:bg-slate-100 hover:text-content-primary"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-content-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p>{meta.hint}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-content-primary">
              {meta.reasonLabel} <span className="text-status-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              onBlur={() => {
                const v = toTitleCaseTR(reason.trim());
                if (v) setReason(v);
              }}
              rows={4}
              placeholder={meta.placeholder}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              disabled={submitting}
            />
            <p className="mt-1 text-[11px] text-content-tertiary">
              En az {MIN_REASON} karakter · {trimmed.length}/{MIN_REASON}
            </p>
            {error ? <p className="mt-1 text-xs font-medium text-status-danger">{error}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-slate-50/80 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-secondary hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${meta.accent}`}
          >
            {submitting ? meta.submittingLabel : meta.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
