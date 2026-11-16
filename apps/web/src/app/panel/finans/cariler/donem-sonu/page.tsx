'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { FileSpreadsheet, Lock } from 'lucide-react';
import { cariBakiyeMetin } from '@sigorta/shared';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatTryAmount } from '@/utils/format-try-amount';
import { downloadCsv } from '@/utils/download-csv';
import { useToast } from '@/contexts/ToastContext';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import {
  FinansActionButton,
  FinansEmptyState,
  FinansKpiStrip,
  FinansPanelCard,
} from '@/components/finance/FinansPanelUI';
import { FINANS_KART_YOL } from '@/utils/finans-merkez-kart';

type YearRow = {
  year: number;
  closed: boolean;
  canConfirm: boolean;
  isSuggested?: boolean;
  asOfDate: string;
  closedAt: string | null;
  closedByName: string | null;
  lineCount: number | null;
};

type KapanisLine = {
  accountId: string;
  accountName: string;
  accountKind: string;
  kindLabel: string;
  toplamBorc: number;
  toplamAlacak: number;
  netBakiye: number;
  bakiyeLabel: string;
};

type KapanisDetail = {
  year: number;
  asOfDate: string;
  closed: boolean;
  canConfirm: boolean;
  closedAt: string | null;
  closedByName: string | null;
  note: string | null;
  lines: KapanisLine[];
  totals: { toplamBorc: number; toplamAlacak: number; netBakiye: number };
};

function money(n: number) {
  return formatTryAmount(n, { fractionDigits: 2 });
}

function moneyCell(n: number) {
  if (!n) return '—';
  return money(n);
}

function formatClosedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16);
  }
}

/**
 * Mali yıl kapanış ekranı — cari bakiyeleri kilitlemek içindir.
 * Açık dosya / fatura talebi disiplini panel uyarısındadır (FinansDonemDisiplinModal);
 * bu sayfada tekrarlanmaz, yıl kilidini kesmez.
 */
export default function FinansDonemSonuPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm, dialog } = usePanelConfirm();
  const [years, setYears] = useState<YearRow[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [suggestedYear, setSuggestedYear] = useState<number | null>(null);
  const [lastPostingDate, setLastPostingDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<KapanisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  const loadYears = () => {
    setLoading(true);
    setError('');
    axios
      .get(`${API}/finance/party-accounts/donem-kapanis`, { headers: authHeader() })
      .then((r) => {
        const data = r.data?.data;
        const list = (data?.years ?? []) as YearRow[];
        const suggested =
          typeof data?.suggestedYear === 'number'
            ? data.suggestedYear
            : list.find((y) => y.isSuggested)?.year ?? null;
        setYears(list);
        setSuggestedYear(suggested);
        setLastPostingDate(
          typeof data?.lastPostingDate === 'string' ? data.lastPostingDate : null,
        );
        const pick =
          list.find((y) => y.year === suggested && (y.canConfirm || !y.closed)) ||
          list.find((y) => y.isSuggested) ||
          list.find((y) => y.canConfirm) ||
          list.find((y) => y.closed) ||
          list[0] ||
          null;
        if (pick) setSelectedYear(pick.year);
      })
      .catch(() => setError('Dönem listesi yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear == null) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    axios
      .get(`${API}/finance/party-accounts/donem-kapanis/${selectedYear}`, {
        headers: authHeader(),
      })
      .then((r) => setDetail(r.data?.data ?? null))
      .catch(() => {
        setDetail(null);
        showToast('error', 'Kapanış bakiyeleri yüklenemedi');
      })
      .finally(() => setDetailLoading(false));
  }, [selectedYear, showToast]);

  const confirmClose = async () => {
    if (!detail || !detail.canConfirm || closing) return;
    const lineNote =
      detail.lines.length > 0
        ? `${detail.lines.length} cari satırın ${detail.asOfDate} bakiyesi kilitlenecek.`
        : 'Cari hareket yok; yıl yine kilitlenecek.';
    const ok = await confirm({
      title: 'Mali Yılı Kapat',
      message: [
        `${detail.year} mali yılı kilitlensin mi?`,
        '',
        lineNote,
        '',
        'Kapalı yıla hareket yazılamaz. Yeni dönem açılmaz; bakiyeler başka yıla aktarılmaz.',
      ].join('\n'),
      confirmLabel: 'Dönemi Kapat',
      cancelLabel: 'Vazgeç',
      danger: true,
    });
    if (!ok) return;
    setClosing(true);
    try {
      const res = await axios.post(
        `${API}/finance/party-accounts/donem-kapanis/${detail.year}`,
        {},
        { headers: authHeader() },
      );
      setDetail(res.data?.data ?? null);
      loadYears();
      showToast('success', `${detail.year} mali yılı kapatıldı`);
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Kapanış kaydedilemedi'));
    } finally {
      setClosing(false);
    }
  };

  const exportExcel = () => {
    if (!detail || detail.lines.length === 0) {
      showToast('warning', 'Aktarılacak satır yok');
      return;
    }
    downloadCsv(
      `donem-sonu-kapanis-${detail.year}.csv`,
      [
        ['Cari Hesap', 'Tür', 'Borç', 'Alacak', 'Bakiye'],
        ...detail.lines.map((line) => [
          line.accountName,
          line.kindLabel,
          String(line.toplamBorc || 0),
          String(line.toplamAlacak || 0),
          cariBakiyeMetin(line.netBakiye, (n) => String(n)),
        ]),
      ],
    );
    showToast('success', 'Excel Dosyası İndiriliyor');
  };

  return (
    <div className="space-y-5 min-h-screen bg-white dark:bg-slate-900 p-6">
      {dialog}
      <FinansSubpageBreadcrumb
        current="Dönem Sonu"
        backHref="/panel/finans"
        backLabel="Finans Merkezi"
      />
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.finansDonemSonu.id}
        title={OPS_NOTICE.finansDonemSonu.title}
        body={OPS_NOTICE.finansDonemSonu.body}
        testId="finans-donem-sonu-seridi"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Mali Yıl Kapanışı</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            31 Aralık bakiyeleri · Yeni dönem açılmaz · Aktarım yok
            {lastPostingDate ? ` · Son kayıt ${lastPostingDate}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!detail || detail.lines.length === 0}
            data-testid="donem-sonu-excel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            Excel&apos;e Aktar
          </button>
          {detail?.canConfirm ? (
            <FinansActionButton
              label={closing ? 'Kilitleniyor…' : 'Dönemi Kapat'}
              onClick={() => {
                void confirmClose();
              }}
              variant="primary"
              disabled={closing}
            />
          ) : null}
        </div>
      </div>

      {error ? (
        <FinansEmptyState title="Yüklenemedi" description={error} />
      ) : loading ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" data-testid="donem-sonu-yil-secici">
            {years.map((row) => {
              const selected = selectedYear === row.year;
              let badge = '';
              if (row.closed) badge = 'Kapalı';
              else if (row.isSuggested || row.year === suggestedYear) badge = 'Önerilen';
              return (
                <button
                  key={row.year}
                  type="button"
                  onClick={() => setSelectedYear(row.year)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    selected
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : row.isSuggested || row.year === suggestedYear
                        ? 'border-amber-300 bg-amber-50 text-amber-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {row.closed ? <Lock className="h-3 w-3" strokeWidth={2} /> : null}
                  {row.year}
                  {badge ? ` · ${badge}` : ''}
                </button>
              );
            })}
          </div>

          {detailLoading ? (
            <p className="text-sm text-slate-500">Bakiyeler yükleniyor…</p>
          ) : detail ? (
            <>
              <FinansKpiStrip
                tone="light"
                items={[
                  { label: 'Toplam Borç', value: money(detail.totals.toplamBorc) },
                  { label: 'Toplam Alacak', value: money(detail.totals.toplamAlacak) },
                  {
                    label: 'Net Bakiye',
                    value: cariBakiyeMetin(detail.totals.netBakiye, money),
                  },
                ]}
              />

              <FinansPanelCard
                title={`${detail.year} Kapanış Bakiyeleri`}
                subtitle={
                  detail.closed
                    ? `Kilitli · ${detail.asOfDate}${
                        detail.closedByName ? ` · ${detail.closedByName}` : ''
                      }${detail.closedAt ? ` · ${formatClosedAt(detail.closedAt)}` : ''}`
                    : `Önizleme · ${detail.asOfDate}${
                        detail.canConfirm
                          ? ' · Dönemi kapatabilirsiniz'
                          : ' · Dönem bitince kapatılır'
                      }`
                }
              >
                {detail.lines.length === 0 ? (
                  <div data-testid="donem-sonu-bos-hal">
                    <FinansEmptyState
                      title="Cari Hareket Yok"
                      description="Bu yıl için bakiyesi olan cari hesap bulunamadı. Gerekirse Cariler ve Masrafları kontrol edin; hareket olmasa da yılı kilitleyebilirsiniz."
                    />
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                      <Link href={FINANS_KART_YOL.cariler} className="text-brand-700 underline">
                        Cariler
                      </Link>
                      <Link href={FINANS_KART_YOL.masraflar} className="text-brand-700 underline">
                        Masraflar
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm" data-testid="donem-sonu-tablo">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                          <th className="px-3 py-2 font-medium">Cari Hesap</th>
                          <th className="px-3 py-2 font-medium">Tür</th>
                          <th className="px-3 py-2 font-medium text-right">Borç</th>
                          <th className="px-3 py-2 font-medium text-right">Alacak</th>
                          <th className="px-3 py-2 font-medium text-right">Bakiye</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((line) => (
                          <tr
                            key={line.accountId}
                            className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                            onClick={() =>
                              router.push(`${FINANS_KART_YOL.cariler}/${line.accountId}`)
                            }
                            data-testid={`donem-sonu-satir-${line.accountId}`}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {line.accountName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{line.kindLabel}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                              {moneyCell(line.toplamBorc)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                              {moneyCell(line.toplamAlacak)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">
                              {cariBakiyeMetin(line.netBakiye, money)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FinansPanelCard>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
