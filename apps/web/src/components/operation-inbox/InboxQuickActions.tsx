'use client';

import Link from 'next/link';
import type { ParsedInboxEmailContent } from '@/utils/inbound-email-content-parser';
import {
  buildInboxCustomerPrefill,
  openCustomerPrefillFromInbox,
} from '@/utils/inbox-customer-prefill';

interface CustomerMatch {
  status: 'found' | 'ambiguous' | 'not_found';
  customer?: { id: string; name: string };
}

interface InboxQuickActionsProps {
  messageId: string;
  mailbox: 'IHBAR' | 'HASAR';
  subject: string;
  status: string;
  fromName?: string | null;
  fromAddress?: string;
  suggestedAction?: string | null;
  linkedClaimId?: string | null;
  linkedEmergencyId?: string | null;
  parsed: ParsedInboxEmailContent;
  customerMatch?: CustomerMatch | null;
  onOpenClaim: () => void;
  onOpenEmergency: () => void;
  onLinkFile: () => void;
  onReply: () => void;
  onAssign: () => void;
  onArchive: () => void;
  onOpenClaimWithCustomer?: () => void;
}

const SENDER_LABELS: Record<ParsedInboxEmailContent['senderProfile'], string> = {
  remed: 'Remed İhbar',
  safran: 'Safran Operasyon',
  insurance: 'Sigorta Portalı',
  unknown: 'Bilinmeyen Gönderen',
};

export function InboxQuickActions({
  messageId,
  mailbox,
  status,
  fromName,
  fromAddress,
  suggestedAction,
  linkedClaimId,
  linkedEmergencyId,
  parsed,
  customerMatch,
  onOpenClaim,
  onOpenEmergency,
  onLinkFile,
  onReply,
  onAssign,
  onArchive,
  onOpenClaimWithCustomer,
}: InboxQuickActionsProps) {
  const isClosed = status === 'ACTIONED' || status === 'ARCHIVED';
  const isLinked = !!linkedClaimId || !!linkedEmergencyId;
  const isReply = parsed.subjectParts?.claimNo != null || suggestedAction === 'LINK_EXISTING';
  const customerSearch = parsed.phone?.replace(/\D/g, '') || parsed.customerName || '';
  const customerFound = customerMatch?.status === 'found' && customerMatch.customer;
  const showCustomerCreate =
    parsed.senderProfile === 'remed'
    || (!customerFound && !!(parsed.customerName || parsed.phone || fromName));

  const handleCustomerCreate = () => {
    const payload = buildInboxCustomerPrefill({
      fromName: fromName ?? null,
      fromAddress: fromAddress ?? '',
      parsed,
      messageId,
    });
    if (payload) {
      openCustomerPrefillFromInbox(payload);
      return;
    }
    window.open(`/panel/musteriler?search=${encodeURIComponent(customerSearch)}`, '_blank', 'noopener,noreferrer');
  };

  if (isClosed && isLinked) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
        <p className="text-xs text-slate-500">Bu yazışma dosyaya bağlandı. Aksiyonlar dosya sayfasından sürdürülebilir.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-indigo-900">Pratik İşlemler</p>
        {parsed.senderProfile !== 'unknown' && (
          <span className="badge badge-purple text-[10px]">{SENDER_LABELS[parsed.senderProfile]}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isLinked && mailbox === 'HASAR' && (
          <button
            type="button"
            onClick={onOpenClaim}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Hasar Dosyası Aç
          </button>
        )}

        {!isLinked && mailbox === 'IHBAR' && (
          <button
            type="button"
            onClick={onOpenEmergency}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            Acil Dosya Aç
          </button>
        )}

        {!isLinked && isReply && (
          <button
            type="button"
            onClick={onLinkFile}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Dosyaya Bağla
          </button>
        )}

        {!isLinked && !isReply && (
          <button
            type="button"
            onClick={onLinkFile}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-violet-700 border border-violet-200 hover:bg-violet-50 transition-colors"
          >
            Mevcut Dosyaya Bağla
          </button>
        )}

        {showCustomerCreate && (
          <>
            {onOpenClaimWithCustomer && mailbox === 'HASAR' && (
              <button
                type="button"
                onClick={onOpenClaimWithCustomer}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Hasar Aç ve Müşteri Oluştur
              </button>
            )}
            <button
              type="button"
              onClick={handleCustomerCreate}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Müşteri Ekle / Ara
            </button>
          </>
        )}

        {customerFound && customerMatch?.customer && (
          <Link
            href={`/panel/musteriler?search=${encodeURIComponent(customerMatch.customer.name)}`}
            target="_blank"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors inline-flex items-center"
          >
            Müşteri: {customerMatch.customer.name}
          </Link>
        )}

        <button
          type="button"
          onClick={onReply}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
        >
          Yanıtla
        </button>

        <button
          type="button"
          onClick={onAssign}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors"
        >
          Ata
        </button>

        <button
          type="button"
          onClick={onArchive}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Yoksay
        </button>
      </div>

      {parsed.senderProfile === 'remed' && !isLinked && (
        <p className="text-[11px] text-indigo-700/80 leading-relaxed">
          Remed ihbar formu algılandı. Müşteri Ekle ile Remed kartı ve gönderen personel (ör. {fromName?.trim() || 'Tuğçe İşlek'}) otomatik doldurulur; yalnızca görevini seçmeniz yeterli.
        </p>
      )}
    </div>
  );
}
