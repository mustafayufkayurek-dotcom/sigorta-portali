'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { WalletCards } from 'lucide-react';
import {
  COLLECTION_PARTY,
  canOfferHasarSalesInvoiceRequest,
  hasarInvoiceRequestGoneLabel,
  isInsuredCollectionParty,
  parseCollectionParty,
  type CollectionParty,
} from '@sigorta/shared';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { useToast } from '@/contexts/ToastContext';
import { API, authHeader } from '@/utils/api';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  createInvoiceRequest,
  getInvoiceRequestsByClaimFile,
} from '@/utils/invoiceRequestApi';
import { usePlanner } from './planner-context';

function partyDisplayName(party: CollectionParty, insuredName: string, insurerName: string): string {
  if (party === COLLECTION_PARTY.insured) {
    const name = insuredName.trim();
    return name && name !== '—' ? name : 'Sigortalı adı dosyada yok';
  }
  const name = insurerName.trim();
  return name && name !== '—' ? name : 'Şirket adı dosyada yok';
}

export function HasarSalesInvoiceRequestCard() {
  const { claim, mode, canEdit, refreshClaim, setClaim } = usePlanner();
  const { showToast } = useToast();
  const approved = claim.stepStatuses.approved === 'done';
  const amount = Number(claim.report.totalAmount) || 0;
  const showBox = canOfferHasarSalesInvoiceRequest({
    reportApproved: approved,
    totalAmount: amount,
  });

  const [party, setParty] = useState<CollectionParty>(
    parseCollectionParty(claim.collectionParty) ?? COLLECTION_PARTY.insuranceCompany,
  );
  const [sent, setSent] = useState(false);
  const [sentParty, setSentParty] = useState<CollectionParty | null>(
    parseCollectionParty(claim.collectionParty),
  );
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(Boolean(claim.claimId) && mode !== 'preview');

  useEffect(() => {
    const next = parseCollectionParty(claim.collectionParty);
    if (next && !sent) setParty(next);
  }, [claim.collectionParty, sent]);

  useEffect(() => {
    if (!claim.claimId || mode === 'preview') return;
    let cancelled = false;
    getInvoiceRequestsByClaimFile(claim.claimId)
      .then((reqs) => {
        if (cancelled) return;
        const active = reqs.find((r) => ['pending', 'approved', 'invoiced'].includes(r.status));
        if (!active) return;
        setSent(true);
        const fromNotes = /Sigortalı/i.test(String(active.notes ?? ''))
          ? COLLECTION_PARTY.insured
          : parseCollectionParty(claim.collectionParty);
        setSentParty(fromNotes ?? COLLECTION_PARTY.insuranceCompany);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [claim.claimId, claim.collectionParty, mode]);

  if (!showBox && !sent) return null;

  const submit = async () => {
    if (!claim.claimId || mode === 'preview' || !canEdit || saving || sent) return;
    setSaving(true);
    try {
      await axios.patch(
        `${API}/claim-files/${claim.claimId}`,
        { collectionParty: party },
        { headers: authHeader() },
      );
      const insured = isInsuredCollectionParty(party);
      await createInvoiceRequest({
        serviceType: 'claim',
        claimFileId: claim.claimId,
        fileNo: claim.fileNo,
        insuranceCompanyId: insured ? undefined : (claim.insuranceCompanyId ?? undefined),
        insuranceCompanyName: insured
          ? partyDisplayName(COLLECTION_PARTY.insured, claim.insuredName, claim.insurer)
          : partyDisplayName(COLLECTION_PARTY.insuranceCompany, claim.insuredName, claim.insurer),
        totalAmount: amount,
        workItemsSummary: [{ description: 'Onaylı rapor satış tutarı', amount }],
        notes: insured
          ? `Fatura kime: Sigortalı — ${partyDisplayName(COLLECTION_PARTY.insured, claim.insuredName, claim.insurer)}`
          : `Fatura kime: Sigorta Şirketi — ${partyDisplayName(COLLECTION_PARTY.insuranceCompany, claim.insuredName, claim.insurer)}`,
      });
      setSent(true);
      setSentParty(party);
      setClaim((prev) => ({ ...prev, collectionParty: party }));
      await refreshClaim();
      showToast(
        'success',
        insured
          ? 'Talep finansa gitti. Fatura sigortalıya kesilir.'
          : 'Talep finansa gitti. Fatura sigorta şirketine kesilir.',
      );
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message
        : e instanceof Error
          ? e.message
          : null;
      const text = typeof msg === 'string' ? msg : 'Talep gönderilemedi';
      if (/zaten bekleyen/i.test(text)) {
        setSent(true);
        setSentParty(party);
        showToast('success', hasarInvoiceRequestGoneLabel(party));
      } else {
        showToast('error', text.replace(/^\d+:\s*/, ''));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="hasar-satis-faturasi-talebi">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
        <WalletCards className="h-3.5 w-3.5 text-slate-500" />
        Satış faturası talebi
      </p>
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarSigortaliOdemeli.id}
        title={OPS_NOTICE.hasarSigortaliOdemeli.title}
        body={OPS_NOTICE.hasarSigortaliOdemeli.body}
        testId="hasar-sigortali-odemeli-seridi"
        compact
        className="mb-2"
      />
      {sent ? (
        <p className="text-xs font-semibold text-emerald-800" data-testid="hasar-satis-faturasi-talep-gitti">
          {hasarInvoiceRequestGoneLabel(sentParty)}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">Fatura kime kesilsin?</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {([COLLECTION_PARTY.insuranceCompany, COLLECTION_PARTY.insured] as const).map((option) => {
              const selected = party === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!canEdit || saving}
                  data-testid={`hasar-fatura-kime-${option}`}
                  onClick={() => setParty(option)}
                  className={`rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${
                    selected
                      ? 'border-brand-600 bg-brand-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-[11px] font-semibold">
                    {option === COLLECTION_PARTY.insured ? 'Sigortalı' : 'Sigorta Şirketi'}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {partyDisplayName(option, claim.insuredName, claim.insurer)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">Tutar: {claim.report.total} · onaylı rapordan</p>
          <button
            type="button"
            disabled={!canEdit || saving || checking || mode === 'preview'}
            data-testid="hasar-finansa-talep-et"
            onClick={() => void submit()}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Gönderiliyor…' : 'Finansa talep et'}
          </button>
        </div>
      )}
    </div>
  );
}
