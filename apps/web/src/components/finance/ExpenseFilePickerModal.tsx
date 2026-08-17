'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getCases, type EmergencyCase } from '@/utils/emergencyApi';
import { API, authHeader } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';
import { toTitleCaseTR } from '@/utils/text-helpers';

const PLAN_EK = 'EKSTRA_SATIS_MASRAFI';

export interface ExpensePickerHasarFile {
  id: string;
  fileNo: string;
  claimNo: string | null;
  description: string;
  hasApprovedBudget: boolean;
  hasEkBudget: boolean;
  lossType?: string | null;
  statusName?: string | null;
  city?: string | null;
  district?: string | null;
  customerSubType?: string | null;
  operationSubject?: 'HASAR_ONARIM' | 'OZEL_OPERASYON';
  segment?: 'hasar' | 'ozel_musteri';
}

interface Props {
  open: boolean;
  onClose: () => void;
  expensePlan: string;
  onSelectHasar: (file: ExpensePickerHasarFile) => void;
  initialSearch?: string;
}

type TabId = 'hasar' | 'ozel' | 'acil';

const URGENCY_LABEL: Record<string, string> = {
  DUSUK: 'Düşük',
  NORMAL: 'Normal',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
};

const STATUS_LABEL: Record<string, string> = {
  GELEN: 'Yeni İhbar',
  ATANDI: 'Tespit Aşamasında',
  SAHADA: 'Onarım Aşamasında',
  COZULDU: 'Dosya Kapatıldı',
  FATURALANDILDI: 'Finansa Aktarıldı',
};

function budgetHint(file: ExpensePickerHasarFile, expensePlan: string) {
  const ok = expensePlan === PLAN_EK ? file.hasEkBudget : file.hasApprovedBudget;
  const planLabel = expensePlan === PLAN_EK ? 'Ek İşler' : 'Dosya Bütçesi';
  if (ok) {
    return { tone: 'ok' as const, text: `${planLabel} uygun` };
  }
  return {
    tone: 'warn' as const,
    text: expensePlan === PLAN_EK ? 'Ek iş bütçesi yok' : 'Bütçe onayı gerekli',
  };
}

export function ExpenseFilePickerModal({
  open,
  onClose,
  expensePlan,
  onSelectHasar,
  initialSearch = '',
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('hasar');
  const [search, setSearch] = useState('');
  const [hasarRows, setHasarRows] = useState<ExpensePickerHasarFile[]>([]);
  const [ozelRows, setOzelRows] = useState<ExpensePickerHasarFile[]>([]);
  const [hasarTotal, setHasarTotal] = useState(0);
  const [ozelTotal, setOzelTotal] = useState(0);
  const [hasarPage, setHasarPage] = useState(1);
  const [ozelPage, setOzelPage] = useState(1);
  const [hasarLoading, setHasarLoading] = useState(false);
  const [ozelLoading, setOzelLoading] = useState(false);
  const [acilRows, setAcilRows] = useState<EmergencyCase[]>([]);
  const [acilLoading, setAcilLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadClaimSegment = useCallback(async (
    segment: 'hasar' | 'ozel_musteri',
    q: string,
    page: number,
  ) => {
    if (!getAccessToken()) return;
    const setLoading = segment === 'hasar' ? setHasarLoading : setOzelLoading;
    const setRows = segment === 'hasar' ? setHasarRows : setOzelRows;
    const setTotal = segment === 'hasar' ? setHasarTotal : setOzelTotal;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/expenses/browse-files`, {
        headers: authHeader(),
        params: { search: q.trim() || undefined, page, limit: 20, segment },
      });
      setRows((res.data?.data ?? []) as ExpensePickerHasarFile[]);
      setTotal(Number(res.data?.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAcil = useCallback(async (q: string) => {
    setAcilLoading(true);
    try {
      const res = await getCases({ search: q.trim() || undefined });
      setAcilRows(res.data);
    } catch {
      setAcilRows([]);
    } finally {
      setAcilLoading(false);
    }
  }, []);

  const handleSelectClaim = (row: ExpensePickerHasarFile) => {
    onSelectHasar(row);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    setTab('hasar');
    setSearch(initialSearch);
    setHasarPage(1);
    setOzelPage(1);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [open, initialSearch]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (tab === 'hasar') void loadClaimSegment('hasar', search, hasarPage);
      else if (tab === 'ozel') void loadClaimSegment('ozel_musteri', search, ozelPage);
      else void loadAcil(search);
    }, 260);
    return () => clearTimeout(timer);
  }, [open, tab, search, hasarPage, ozelPage, loadClaimSegment, loadAcil]);

  useEffect(() => {
    if (open) {
      setHasarPage(1);
      setOzelPage(1);
    }
  }, [search, open]);

  if (!open) return null;

  const claimRows = tab === 'ozel' ? ozelRows : hasarRows;
  const claimLoading = tab === 'ozel' ? ozelLoading : hasarLoading;
  const claimTotal = tab === 'ozel' ? ozelTotal : hasarTotal;
  const claimPage = tab === 'ozel' ? ozelPage : hasarPage;
  const setClaimPage = tab === 'ozel' ? setOzelPage : setHasarPage;
  const claimTotalPages = Math.max(1, Math.ceil(claimTotal / 20));

  const searchPlaceholder =
    tab === 'hasar'
      ? 'Dosya no, hasar no veya sigortalı adı...'
      : tab === 'ozel'
        ? 'Müşteri adı, telefon veya açıklama (dosya no ile arama yok)...'
        : 'Dosya no veya müşteri adı...';

  const renderClaimTable = (rows: ExpensePickerHasarFile[], isOzel: boolean) => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
        <tr className="text-left text-[11px] font-medium text-slate-500">
          <th className="px-4 py-2.5 font-semibold">{isOzel ? 'Müşteri / Dosya' : 'Dosya No'}</th>
          <th className="px-4 py-2.5 font-semibold">{isOzel ? 'Konu / Konum' : 'Sigortalı'}</th>
          {!isOzel && (
            <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Konum / Konu</th>
          )}
          <th className="px-4 py-2.5 font-semibold">Bütçe</th>
          <th className="px-4 py-2.5 font-semibold w-28" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => {
          const hint = budgetHint(row, expensePlan);
          return (
            <tr
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectClaim(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectClaim(row);
                }
              }}
              className="cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/20 focus:bg-blue-50/70 focus:outline-none"
            >
              <td className="px-4 py-3">
                {isOzel ? (
                  <>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {toTitleCaseTR(row.description) || '—'}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">{row.fileNo}</p>
                  </>
                ) : (
                  <>
                    <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{row.fileNo}</p>
                    {row.claimNo && (
                      <p className="text-[10px] text-slate-400">Hasar: {row.claimNo}</p>
                    )}
                  </>
                )}
                {row.statusName && (
                  <p className="text-[10px] text-slate-400">{row.statusName}</p>
                )}
              </td>
              <td className="px-4 py-3">
                {isOzel ? (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {[row.city, row.district].filter(Boolean).join(' / ') || '—'}
                    </p>
                    {row.lossType && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{row.lossType}</p>
                    )}
                  </>
                ) : (
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {row.description ? toTitleCaseTR(row.description) : '—'}
                  </p>
                )}
              </td>
              {!isOzel && (
                <td className="px-4 py-3 hidden sm:table-cell">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {[row.city, row.district].filter(Boolean).join(' / ') || '—'}
                  </p>
                  {row.lossType && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{row.lossType}</p>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  hint.tone === 'ok'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {hint.text}
                </span>
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectClaim(row)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Seç
                  </button>
                  <Link
                    href={`/panel/hasar-dosyalari/${row.id}`}
                    target="_blank"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600"
                    title="Dosya detayını yeni sekmede aç"
                  >
                    ↗
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Dosya Seç</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Satıra veya <strong className="font-semibold text-slate-600">Seç</strong> ile dosyayı masraf formuna bağlayın.
              Hasar onarım ve özel müşteri buradan; acil yardım gideri ilgili dosya sayfasından girilir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl font-light leading-none text-slate-400 hover:text-slate-600"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 pt-3 dark:border-slate-700">
          {([
            { id: 'hasar' as const, label: 'Hasar Onarım', hint: 'Sigorta / hasar dosyası' },
            { id: 'acil' as const, label: 'Acil Yardım', hint: 'Gider dosyadan girilir' },
            { id: 'ozel' as const, label: 'Özel Müşteri', hint: 'Müşteri adı ile ara' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border border-b-0 border-slate-200 bg-white text-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {t.label}
              <span className="ml-1.5 hidden text-[10px] font-normal text-slate-400 md:inline">— {t.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-50 px-5 py-3 dark:border-slate-800">
          <input
            ref={searchInputRef}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === 'hasar' && (
            <Link
              href="/panel/hasar-dosyalari"
              target="_blank"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Hasar listesini aç ↗
            </Link>
          )}
          {tab === 'ozel' && (
            <Link
              href="/panel/musteriler"
              target="_blank"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Müşteriler ↗
            </Link>
          )}
          {tab === 'acil' && (
            <Link
              href="/panel/operasyon?filter=acil"
              target="_blank"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
            >
              Acil yardım listesini aç ↗
            </Link>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {(tab === 'hasar' || tab === 'ozel') && (
            claimLoading ? (
              <p className="py-12 text-center text-sm text-slate-400">Yükleniyor...</p>
            ) : claimRows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                {search.trim()
                  ? tab === 'ozel'
                    ? 'Eşleşen özel müşteri dosyası bulunamadı.'
                    : 'Eşleşen hasar dosyası bulunamadı.'
                  : tab === 'ozel'
                    ? 'Müşteri adı veya telefon ile arayın.'
                    : 'Arama yapın veya son dosyaları görüntüleyin.'}
              </p>
            ) : (
              renderClaimTable(claimRows, tab === 'ozel')
            )
          )}

          {tab === 'acil' && (
            acilLoading ? (
              <p className="py-12 text-center text-sm text-slate-400">Yükleniyor...</p>
            ) : acilRows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                {search.trim() ? 'Eşleşen acil yardım dosyası bulunamadı.' : 'Arama yapın veya tüm dosyaları görüntüleyin.'}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-[11px] font-medium text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Dosya No</th>
                    <th className="px-4 py-2.5 font-semibold">Müşteri</th>
                    <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Adres / Konu</th>
                    <th className="px-4 py-2.5 font-semibold">Durum</th>
                    <th className="px-4 py-2.5 font-semibold w-36" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {acilRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-slate-500">{row.caseNo}</p>
                        {row.fileNo && (
                          <p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{row.fileNo}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {toTitleCaseTR(row.customerName)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{row.address}</p>
                        <p className="text-[10px] text-orange-600">{row.issueType}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        <span className="block text-[10px] text-slate-400">{URGENCY_LABEL[row.urgency] ?? row.urgency}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            router.push(`/panel/acil-yardim/${row.id}`);
                          }}
                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                        >
                          Gider ekle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {(tab === 'hasar' || tab === 'ozel') && claimTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">{claimTotal} dosya</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={claimPage <= 1 || claimLoading}
                onClick={() => setClaimPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40 dark:border-slate-600"
              >
                Önceki
              </button>
              <span className="text-xs text-slate-500">{claimPage} / {claimTotalPages}</span>
              <button
                type="button"
                disabled={claimPage >= claimTotalPages || claimLoading}
                onClick={() => setClaimPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40 dark:border-slate-600"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}

        {tab === 'ozel' && (
          <div className="border-t border-emerald-100 bg-emerald-50/80 px-5 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-xs text-emerald-900 dark:text-emerald-200">
              Özel müşteri dosyalarında arama <strong className="font-semibold">müşteri adı, telefon veya açıklama</strong> ile yapılır; dosya numarası ile arama yapılmaz.
            </p>
          </div>
        )}

        {tab === 'acil' && (
          <div className="border-t border-amber-100 bg-amber-50/80 px-5 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Acil yardım giderleri bu masraf formuna bağlanmaz. Doğru dosyayı bulup <strong className="font-semibold">Gider ekle</strong> ile dosya sayfasına gidin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
