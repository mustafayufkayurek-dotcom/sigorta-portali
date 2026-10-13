'use client';

import { useState } from 'react';
import axios from 'axios';
import { Wrench } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useToast } from '@/contexts/ToastContext';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import { FieldHelpTip } from '@/components/ui/FieldHelpTip';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  canOpenHasarExtraRepair,
  extraRepairReasonOk,
} from '@sigorta/shared';
import { UI_ACTION_TIMEOUT_MS } from '@/utils/ui-action-timeout';

export type HasarEkOnarimKayit = {
  id: string;
  description?: string | null;
  status?: string | null;
  estimatedAmount?: number | null;
  repairReportId?: string | null;
};

export function HasarEkOnarimPanel({
  claim,
  onUpdated,
  onWriteReport,
}: {
  claim: {
    id: string;
    closedAt?: string | null;
    currentStatus?: { code?: string | null; isClosedState?: boolean | null } | null;
    extraRepair?: HasarEkOnarimKayit | null;
    extraRepairOpen?: boolean | null;
  };
  onUpdated: () => void;
  onWriteReport: () => void;
}) {
  const { showToast } = useToast();
  const { confirm, dialog } = usePanelConfirm();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const fileClosed = Boolean(
    claim.closedAt
    || claim.currentStatus?.isClosedState
    || String(claim.currentStatus?.code ?? '').toLowerCase() === 'closed',
  );
  const fileCancelled = String(claim.currentStatus?.code ?? '').toLowerCase() === 'cancelled';
  const extraOpen = Boolean(claim.extraRepairOpen && claim.extraRepair?.id);
  const canOpen = canOpenHasarExtraRepair({
    fileClosed,
    fileCancelled,
    extraRepairOpen: extraOpen,
  });

  if (!fileClosed || fileCancelled) return null;

  const openRepair = async () => {
    if (!extraRepairReasonOk(reason)) {
      showToast('error', 'Ek onarım için gerekçe yazınız.');
      return;
    }
    const parsed = amount.trim() ? parseTrAmountInput(amount) : null;
    if (amount.trim() && (parsed == null || parsed < 0)) {
      showToast('error', 'Tutar okunamadı.');
      return;
    }
    const ok = await confirm({
      title: 'Ek Onarım',
      message: 'İlk kapanış durur. Yeni dosya açılmaz. Ek iş bu dosyada yürür.',
      confirmLabel: 'Ek Onarım Aç',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await axios.post(
        `${API}/claim-files/${claim.id}/extra-works/extra-repair`,
        { reason: reason.trim(), estimatedAmount: parsed ?? undefined },
        { headers: authHeader(), timeout: UI_ACTION_TIMEOUT_MS },
      );
      setReason('');
      setAmount('');
      showToast('success', 'Ek onarım açıldı. Raporlar’da ek rapor yazılır.');
      onUpdated();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Ek onarım açılamadı.'));
    } finally {
      setBusy(false);
    }
  };

  const completeRepair = async () => {
    if (!claim.extraRepair?.id) return;
    const ok = await confirm({
      title: 'Ek Onarımı Bitir',
      message: 'Ek iş bitti. Dosya yine kapalı kalır.',
      confirmLabel: 'Bitir',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await axios.post(
        `${API}/claim-files/${claim.id}/extra-works/${claim.extraRepair.id}/complete-repair`,
        {},
        { headers: authHeader(), timeout: UI_ACTION_TIMEOUT_MS },
      );
      showToast('success', 'Ek onarım bitti.');
      onUpdated();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Ek onarım bitirilmedi.'));
    } finally {
      setBusy(false);
    }
  };

  const rejectRepair = async () => {
    if (!claim.extraRepair?.id) return;
    if (!extraRepairReasonOk(cancelReason)) {
      showToast('error', 'İptal için açıklama yazınız.');
      return;
    }
    const ok = await confirm({
      title: 'Ek Onarımı İptal Et',
      message: 'Dosya kapalı kalır. İlk kapanış silinmez.',
      confirmLabel: 'İptal Et',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await axios.post(
        `${API}/claim-files/${claim.id}/extra-works/${claim.extraRepair.id}/reject-repair`,
        { reason: cancelReason.trim() },
        { headers: authHeader(), timeout: UI_ACTION_TIMEOUT_MS },
      );
      setCancelReason('');
      showToast('success', 'Ek onarım iptal. Dosya kapalı durur.');
      onUpdated();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Ek onarım iptal edilmedi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5"
      data-testid="hasar-ek-onarim"
    >
      {dialog}
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Wrench className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
            <span>Ek Onarım</span>
            <FieldHelpTip text="Yeni dosya açılmaz. İlk kapanış, fatura ve onay durur. Ek rapor ayrı onaya gider." />
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Kapalı dosyada ek iş bu kayda yazılır.</p>
        </div>
      </div>
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarEkOnarim.id}
        title={OPS_NOTICE.hasarEkOnarim.title}
        body={OPS_NOTICE.hasarEkOnarim.body}
        testId="hasar-ek-onarim-seridi"
      />
      {extraOpen && claim.extraRepair ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
            Kapalı · Ek Onarım
          </p>
          <p className="text-sm text-slate-800">{claim.extraRepair.description}</p>
          {claim.extraRepair.estimatedAmount != null ? (
            <p className="text-xs text-slate-500">
              Tahmini tutar: {claim.extraRepair.estimatedAmount.toLocaleString('tr-TR')} TL
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">İptal açıklaması</span>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Örn. eksper ek işi kabul etmedi"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onWriteReport}
              className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Ek Rapor Yaz
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void completeRepair()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Ek Onarımı Bitir
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void rejectRepair()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              İptal Et
            </button>
          </div>
        </div>
      ) : canOpen ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
            Dosya kapatıldı. Sigorta, eksper ve broker kapanış maili alır.
          </p>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700">
              Gerekçe
              <FieldHelpTip text="Sigortalı veya eksperden gelen ek iş. Kısa ve açık yazın." />
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReason((v) => toTitleCaseTR(v))}
              rows={3}
              placeholder="Örn. söküm sonrası ek boya"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Tahmini tutar (isteğe bağlı)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Örn. 12.500"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openRepair()}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Ek Onarım Aç
          </button>
        </div>
      ) : null}
    </section>
  );
}
