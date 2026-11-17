'use client';

/**
 * Cari kart özeti — masraf formunda satırın altında açılır/kapanır.
 * Formu örtmez; Gizle ile aynı yere döner.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { cariBakiyeMetin } from '@sigorta/shared';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';

type CariOzet = {
  id: string;
  name: string;
  kindLabel: string;
  notes: string | null;
  cardLast4: string | null;
  cardLabel: string | null;
  toplamBorc: number;
  toplamAlacak: number;
  netBakiye: number;
  linkedVendorId: string | null;
};

type CariHareket = {
  id: string;
  entryDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  sourceKind: string;
};

function money(n: number) {
  return formatTryAmount(n, { fractionDigits: 2 });
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('tr-TR');
}

function sourceLabel(kind: string) {
  switch (kind) {
    case 'acilis':
      return 'Açılış';
    case 'manuel':
      return 'Manuel';
    case 'masraf':
      return 'Masraf';
    case 'odeme':
      return 'Ödeme';
    case 'tahsilat':
      return 'Tahsilat';
    case 'gelir':
      return 'Gelir';
    case 'fatura':
      return 'Fatura';
    case 'maas':
      return 'Maaş';
    case 'sabit':
      return 'Sabit Gider';
    default:
      return kind || '—';
  }
}

export function CariHesapOzetModal({
  open,
  accountId,
  onClose,
}: {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
}) {
  const [ozet, setOzet] = useState<CariOzet | null>(null);
  const [hareketler, setHareketler] = useState<CariHareket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !accountId) {
      setOzet(null);
      setHareketler([]);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/finance/party-accounts/${accountId}/statement`, { headers: authHeader() })
      .then((res) => {
        if (cancelled) return;
        const account = res.data?.data?.account as Record<string, unknown> | undefined;
        const rawLines = (res.data?.data?.lines ?? []) as Array<Record<string, unknown>>;
        if (!account?.id) {
          setOzet(null);
          setHareketler([]);
          setError('Cari kart bulunamadı');
          return;
        }
        setOzet({
          id: String(account.id),
          name: String(account.name ?? ''),
          kindLabel: String(account.kindLabel ?? ''),
          notes: (account.notes as string | null) ?? null,
          cardLast4: (account.cardLast4 as string | null) ?? null,
          cardLabel: (account.cardLabel as string | null) ?? null,
          toplamBorc: Number(account.toplamBorc) || 0,
          toplamAlacak: Number(account.toplamAlacak) || 0,
          netBakiye: Number(account.netBakiye) || 0,
          linkedVendorId: (account.linkedVendorId as string | null) ?? null,
        });
        setHareketler(
          rawLines.map((line, i) => ({
            id: String(line.id ?? `line-${i}`),
            entryDate: String(line.entryDate ?? ''),
            description: String(line.description ?? ''),
            debitAmount: Number(line.debitAmount) || 0,
            creditAmount: Number(line.creditAmount) || 0,
            sourceKind: String(line.sourceKind ?? ''),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setOzet(null);
          setHareketler([]);
          setError('Cari özeti yüklenemedi');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, accountId]);

  if (!open) return null;

  return (
    <div
      className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80"
      data-testid="masraf-cari-ozet"
      role="region"
      aria-label="Cari Kart Özeti"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Cari Kart Özeti</p>
          <p className="text-[11px] text-slate-500">Masraf formu açık kalır</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="masraf-cari-ozet-geri"
        >
          Gizle
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        {loading ? (
          <p className="text-sm text-slate-500">Cari özeti yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-status-danger" role="alert">
            {error}
          </p>
        ) : ozet ? (
          <div className="space-y-3" data-testid="masraf-cari-ozet-icerik">
            <div>
              <p className="text-sm font-semibold text-slate-900">{ozet.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {ozet.kindLabel}
                {ozet.cardLast4 ? ` · ****${ozet.cardLast4}` : ''}
                {ozet.cardLabel ? ` · ${ozet.cardLabel}` : ''}
              </p>
            </div>
            {ozet.notes ? (
              <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700">
                {ozet.notes}
              </p>
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <p className="text-[10px] font-medium text-slate-500">Borç</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                  {money(ozet.toplamBorc)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <p className="text-[10px] font-medium text-slate-500">Alacak</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                  {money(ozet.toplamAlacak)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <p className="text-[10px] font-medium text-slate-500">Bakiye</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                  {cariBakiyeMetin(ozet.netBakiye, money)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Son Hareketler</p>
              {hareketler.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz hareket yok.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2.5 py-1.5 font-medium">Tarih</th>
                        <th className="px-2.5 py-1.5 font-medium">Açıklama</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Borç</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Alacak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hareketler.slice(0, 6).map((h) => (
                        <tr key={h.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-600">
                            {dateLabel(h.entryDate)}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-700">
                            <span className="block max-w-[10rem] truncate">
                              {h.description || sourceLabel(h.sourceKind)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                            {h.debitAmount > 0 ? money(h.debitAmount) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                            {h.creditAmount > 0 ? money(h.creditAmount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {ozet.linkedVendorId ? (
                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      `/panel/tedarikciler/${ozet.linkedVendorId}`,
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Tedarikçi (Yeni Sekme)
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  window.open(
                    `/panel/finans/cariler/${encodeURIComponent(ozet.id)}`,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                data-testid="masraf-cari-ozet-ekstre"
              >
                Tam Ekstre (Yeni Sekme)
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Cari seçilmedi</p>
        )}
      </div>
    </div>
  );
}
