'use client';

import { useCallback, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { openWhatsAppChat, toWhatsAppLink } from '@/utils/date-helpers';
import { formatPhoneGrouped } from '@/utils/validators';
import { buildFieldInsuredWhatsAppMessage } from '@/utils/field-insured-whatsapp-message';
import { reportCaughtError } from '@/utils/report-caught-error';

type ClaimLite = {
  id: string;
  fileNo?: string | null;
  insuredName?: string | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
};

type Props = {
  claim: ClaimLite;
  phone: string | null | undefined;
  className?: string;
  /** Kart tıklamasını engellemek için */
  stopPropagation?: boolean;
  /** Yan panel / dar alan — kısa Ara + WhatsApp */
  compact?: boolean;
  onLogged?: () => void;
};

async function recordContactEvent(body: {
  claimId: string;
  channel: 'phone' | 'whatsapp';
  phone: string;
  recipientName: string | null;
  message?: string | null;
  status: 'called' | 'opened';
}) {
  await axios.post(
    `${API}/claim-operation-center/${body.claimId}/contact-events`,
    {
      channel: body.channel,
      recipientType: 'insured',
      recipientName: body.recipientName,
      phone: body.phone,
      message: body.message ?? null,
      status: body.status,
      result: body.channel === 'phone' ? 'Arama başlatıldı' : 'WhatsApp açıldı',
    },
    { headers: authHeader() },
  );
}

/**
 * Saha: sigortalı Ara + WhatsApp; her işlem dosya activity log’una (tarih/saat + mesaj) yazılır.
 */
export function FieldInsuredContactActions({
  claim,
  phone,
  className = '',
  stopPropagation = true,
  compact = false,
  onLogged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const trimmed = phone?.trim() ?? '';
  const displayPhone = trimmed ? formatPhoneGrouped(trimmed) : '';
  const recipientName = claim.insuredName?.trim() || null;
  const waMessage = buildFieldInsuredWhatsAppMessage({
    fileNo: claim.fileNo,
    insuredName: claim.insuredName,
    propertyAddress: claim.propertyAddress,
  });
  const waLink = trimmed ? toWhatsAppLink(trimmed, waMessage) : null;
  const telHref = trimmed ? `tel:${trimmed.replace(/\s/g, '')}` : null;

  const guard = (e: React.SyntheticEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const logAnd = useCallback(
    async (channel: 'phone' | 'whatsapp', then: () => void) => {
      if (!trimmed || busy) return;
      setBusy(true);
      try {
        await recordContactEvent({
          claimId: claim.id,
          channel,
          phone: trimmed,
          recipientName,
          message: channel === 'whatsapp' ? waMessage : null,
          status: channel === 'phone' ? 'called' : 'opened',
        });
        onLogged?.();
      } catch (err) {
        reportCaughtError(err, 'İletişim kaydı yazılamadı; işlem yine de açılıyor.', {
          toastType: 'warning',
        });
      } finally {
        then();
        // Mobilde touch+click çift tetiklemeyi engelle
        window.setTimeout(() => setBusy(false), 1200);
      }
    },
    [busy, claim.id, onLogged, recipientName, trimmed, waMessage],
  );

  if (!trimmed || !telHref) {
    if (compact) return null;
    return <p className={`text-sm text-slate-400 ${className}`}>Telefon Yok</p>;
  }

  const btnPad = compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs';

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      data-testid="saha-iletisim-aksiyon"
      onClick={guard}
      onKeyDown={guard}
    >
      <a
        href={telHref}
        className={`inline-flex items-center gap-1 rounded-lg bg-brand-600 font-semibold text-white hover:bg-brand-700 ${btnPad}`}
        aria-label="Sigortalıyı ara"
        data-testid="saha-telefon-ara"
        title={displayPhone}
        onClick={(e) => {
          guard(e);
          void logAnd('phone', () => {
            window.location.href = telHref;
          });
        }}
      >
        Ara
        {!compact ? (
          <span className="tabular-nums font-medium opacity-90">{displayPhone}</span>
        ) : null}
      </a>
      {waLink ? (
        <button
          type="button"
          disabled={busy}
          className={`inline-flex items-center gap-1 rounded-lg border border-status-success/40 bg-status-success/10 font-semibold text-status-success hover:bg-status-success/15 disabled:opacity-50 ${btnPad}`}
          aria-label="WhatsApp mesajı gönder"
          data-testid="saha-whatsapp-gonder"
          onClick={(e) => {
            guard(e);
            void logAnd('whatsapp', () => {
              openWhatsAppChat(trimmed, waMessage);
            });
          }}
        >
          WhatsApp
        </button>
      ) : null}
    </div>
  );
}
