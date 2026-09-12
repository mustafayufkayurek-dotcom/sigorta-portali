'use client';

import type { OutboundMailSignal } from '@sigorta/shared';

const SENT_ON: OutboundMailSignal[] = ['sent', 'read', 'replied'];

function sentLabel(signal: OutboundMailSignal): string {
  if (signal === 'sending') return 'Gönderiliyor';
  if (signal === 'failed') return 'Gönderilemedi';
  if (SENT_ON.includes(signal)) return 'Gönderildi';
  return 'Gönderilmedi';
}

function sentClass(signal: OutboundMailSignal): string {
  if (signal === 'sending') return 'badge badge-blue';
  if (signal === 'failed') return 'badge badge-red';
  if (SENT_ON.includes(signal)) return 'badge badge-green';
  return 'badge badge-gray';
}

function seenLabel(signal: OutboundMailSignal): string {
  if (signal === 'replied') return 'Yanıt geldi';
  if (signal === 'read') return 'Okundu';
  return 'Okunmadı';
}

function seenClass(signal: OutboundMailSignal): string {
  if (signal === 'replied' || signal === 'read') return 'badge badge-green';
  return 'badge badge-gray';
}

interface Props {
  signal: OutboundMailSignal;
  compact?: boolean;
}

export function OutboundMailSignalStrip({ signal, compact = false }: Props) {
  return (
    <div className={compact ? '' : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={sentClass(signal)}>{sentLabel(signal)}</span>
        <span className={seenClass(signal)}>{seenLabel(signal)}</span>
      </div>
      {!compact && signal === 'sent' && (
        <p className="text-[11px] text-slate-500 mt-1.5">
          Kesin teyit: karşı tarafın Alındı yazması. Outlook okundu bilgisine bağlı değiliz.
        </p>
      )}
      {!compact && signal === 'replied' && (
        <p className="text-[11px] text-emerald-800 mt-1.5">
          Karşı taraf yazdı. Maili görmüştür.
        </p>
      )}
      {!compact && signal === 'failed' && (
        <p className="text-[11px] text-red-700 mt-1.5">
          Kutu maili geri çevirdi. Adresi kontrol edip yeniden gönderin.
        </p>
      )}
    </div>
  );
}
