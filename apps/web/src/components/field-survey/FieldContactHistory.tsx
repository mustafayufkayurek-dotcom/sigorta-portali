'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { reportCaughtError } from '@/utils/report-caught-error';

type ActivityRow = {
  id: string;
  action?: string | null;
  description?: string | null;
  createdAt?: string | null;
  metadata?: {
    channel?: string | null;
    phone?: string | null;
    message?: string | null;
    occurredAt?: string | null;
    recipientName?: string | null;
    status?: string | null;
  } | null;
  actor?: { firstName?: string | null; lastName?: string | null } | null;
};

const CONTACT_ACTIONS = new Set(['PHONE_CALL_RECORDED', 'WHATSAPP_STATUS_RECORDED']);

function formatWhen(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actorLabel(actor?: ActivityRow['actor']): string {
  const name = [actor?.firstName, actor?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Saha';
}

/** Dosyaya özel telefon / WhatsApp kayıtları (tarih-saat + mesaj) */
export function FieldContactHistory({
  claimId,
  refreshKey = 0,
}: {
  claimId: string;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-files/${claimId}/activity-log`, {
        headers: authHeader(),
      });
      const list: ActivityRow[] = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      const contactRows = list
        .filter((r) => CONTACT_ACTIONS.has(String(r.action ?? '')))
        .sort((a, b) => {
          const ta = new Date(a.metadata?.occurredAt ?? a.createdAt ?? 0).getTime();
          const tb = new Date(b.metadata?.occurredAt ?? b.createdAt ?? 0).getTime();
          return tb - ta;
        });
      // Eski mükerrer kayıtları listede birleştir (aynı kanal + telefon + mesaj, 2 dk)
      const deduped: ActivityRow[] = [];
      for (const row of contactRows) {
        const phone = String(row.metadata?.phone ?? '').replace(/\D/g, '');
        const msg = String(row.metadata?.message ?? '').trim();
        const t = new Date(row.metadata?.occurredAt ?? row.createdAt ?? 0).getTime();
        const isDup = deduped.some((prev) => {
          if (prev.action !== row.action) return false;
          const pPhone = String(prev.metadata?.phone ?? '').replace(/\D/g, '');
          const pMsg = String(prev.metadata?.message ?? '').trim();
          const pt = new Date(prev.metadata?.occurredAt ?? prev.createdAt ?? 0).getTime();
          const samePhone = !phone || !pPhone || phone === pPhone;
          const sameMsg = !msg || !pMsg || msg === pMsg;
          return samePhone && sameMsg && Math.abs(pt - t) < 120_000;
        });
        if (!isDup) deduped.push(row);
      }
      setRows(deduped.slice(0, 20));
    } catch (err) {
      reportCaughtError(err, 'İletişim kayıtları yüklenemedi.', { toast: false });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="mt-1" data-testid="saha-iletisim-gecmisi">
      <p className="text-[11px] font-medium text-slate-500">İletişim Kayıtları</p>
      {loading ? (
        <p className="mt-1 text-xs text-slate-400">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Henüz telefon veya WhatsApp kaydı yok.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => {
            const isWa = row.action === 'WHATSAPP_STATUS_RECORDED';
            const when = formatWhen(row.metadata?.occurredAt ?? row.createdAt);
            const msg = typeof row.metadata?.message === 'string' ? row.metadata.message.trim() : '';
            const rawDesc = (row.description ?? '').trim();
            // Eski «…: ready / opened» teknik durumunu kullanıcı diline çevir
            const title = (() => {
              if (!rawDesc) return isWa ? 'WhatsApp mesajı kaydedildi' : 'Telefon araması kaydedildi';
              if (/ready|opened|sent|failed/i.test(rawDesc) && /whatsapp|işlemi/i.test(rawDesc)) {
                return 'WhatsApp mesajı kaydedildi';
              }
              return rawDesc;
            })();
            return (
              <li
                key={row.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      isWa
                        ? 'bg-status-success/15 text-status-success'
                        : 'bg-brand-50 text-brand-800'
                    }`}
                  >
                    {isWa ? 'WhatsApp' : 'Telefon'}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-500">{when}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-800">{title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{actorLabel(row.actor)}</p>
                {msg ? (
                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                    {msg.length > 280 ? `${msg.slice(0, 277)}…` : msg}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
