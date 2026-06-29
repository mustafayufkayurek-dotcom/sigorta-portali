'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { API, authHeader } from '@/utils/api';
import { getAccessToken } from '@/utils/auth-session';

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const ALLOCATION_METHODS = [
  { value: 'equal', label: 'Eşit Dağıtım (Varsayılan)' },
  { value: 'proportional_revenue', label: 'Gelir Orantılı' },
  { value: 'hybrid', label: 'Hibrit (%50 eşit + %50 gelir)' },
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

interface PreviewFile {
  targetType?: 'claim' | 'emergency';
  fileCaseId?: string;
  emergencyCaseId?: string;
  fileNo: string;
  fileType?: string;
  fileTypeLabel?: string;
  allocatedAmount: number;
  approvedBudget: number;
}

interface AllocationReminder {
  year: number;
  month: number;
  periodLabel: string;
  totalNet: number;
  urgency: 'month_end' | 'overdue';
  message: string;
  needsSync?: boolean;
}

export default function SabitGiderlerPage() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(() => {
    const q = searchParams.get('year');
    return q ? Number(q) : CURRENT_YEAR;
  });
  const [month, setMonth] = useState(() => {
    const q = searchParams.get('month');
    return q ? Number(q) : CURRENT_MONTH;
  });
  const [allocating, setAllocating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [allocMethod, setAllocMethod] = useState('equal');
  const [totals, setTotals] = useState(0);
  const [preview, setPreview] = useState<{
    fileCount: number;
    perFileShare: number;
    files: PreviewFile[];
    breakdown?: { hasar: number; ozelOperasyon: number; acilYardim: number };
  } | null>(null);
  const [reminders, setReminders] = useState<AllocationReminder[]>([]);
  const [periodStatus, setPeriodStatus] = useState<{
    needsAllocation?: boolean;
    needsSync?: boolean;
    allocationComplete?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    if (!getAccessToken()) return;
    setLoading(true);
    setError('');
    try {
      const [entriesRes, totalRes, previewRes, reminderRes, statusRes] = await Promise.all([
        axios.get(`${API}/finance/overhead/entries`, { headers: authHeader(), params: { year, month } }),
        axios.get(`${API}/finance/overhead/entries/totals`, { headers: authHeader(), params: { year, month } }),
        axios.get(`${API}/finance/overhead/preview`, {
          headers: authHeader(),
          params: { year, month, allocationMethod: allocMethod },
        }),
        axios.get(`${API}/finance/overhead/allocation-reminder`, { headers: authHeader() }),
        axios.get(`${API}/finance/overhead/period-status`, { headers: authHeader(), params: { year, month } }),
      ]);
      setEntries(entriesRes.data.data ?? entriesRes.data ?? []);
      setTotals(totalRes.data ?? 0);
      setPreview(previewRes.data ?? null);
      setReminders(reminderRes.data?.reminders ?? []);
      setPeriodStatus(statusRes.data ?? null);
    } catch {
      setError('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [year, month, allocMethod]);

  useEffect(() => {
    const qYear = searchParams.get('year');
    const qMonth = searchParams.get('month');
    if (qYear) setYear(Number(qYear));
    if (qMonth) setMonth(Number(qMonth));
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleSyncPool = async () => {
    setSyncing(true);
    try {
      const r = await axios.post(
        `${API}/finance/overhead/sync-from-expenses`,
        { year, month },
        { headers: authHeader() },
      );
      alert(`Havuzdan ${r.data.synced} kategori aktarıldı. Toplam (KDV hariç): ${fmtCurrency(r.data.totalNet)}`);
      load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? 'Senkron başarısız') : 'Senkron başarısız';
      alert(String(msg));
    } finally {
      setSyncing(false);
    }
  };

  const handleAllocate = async () => {
    const methodLabel = ALLOCATION_METHODS.find((m) => m.value === allocMethod)?.label;
    const breakdown = preview?.breakdown;
    const targetSummary = breakdown
      ? `${breakdown.hasar} hasar, ${breakdown.ozelOperasyon} özel operasyon, ${breakdown.acilYardim} acil yardım`
      : `${preview?.fileCount ?? 0} dosya`;
    if (!window.confirm(`${year}/${month} — ${fmtCurrency(totals)} (KDV hariç) ${methodLabel} ile ${targetSummary} hedefine dağıtılsın mı?`)) return;
    setAllocating(true);
    try {
      const r = await axios.post(
        `${API}/finance/overhead/allocate`,
        { year, month, allocationMethod: allocMethod },
        { headers: authHeader() },
      );
      alert(`${r.data.allocated} dosyaya dağıtıldı. Toplam: ${fmtCurrency(r.data.totalOverhead)} (KDV hariç)`);
      load();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? 'Dağıtım başarısız') : 'Dağıtım başarısız';
      alert(String(msg));
    } finally {
      setAllocating(false);
    }
  };

  const months = [
    { v: 1, l: 'Ocak' }, { v: 2, l: 'Şubat' }, { v: 3, l: 'Mart' },
    { v: 4, l: 'Nisan' }, { v: 5, l: 'Mayıs' }, { v: 6, l: 'Haziran' },
    { v: 7, l: 'Temmuz' }, { v: 8, l: 'Ağustos' }, { v: 9, l: 'Eylül' },
    { v: 10, l: 'Ekim' }, { v: 11, l: 'Kasım' }, { v: 12, l: 'Aralık' },
  ];

  const isAllocated = entries.some((e: any) => e.isAllocated);
  const isViewingCurrentMonth = year === CURRENT_YEAR && month === CURRENT_MONTH;
  const today = new Date().getDate();
  const overdueReminders = reminders.filter((r) => r.urgency === 'overdue');
  const currentMonthReminders = reminders.filter((r) => r.urgency === 'month_end');
  const activeRemindersForPeriod = reminders.filter((r) => r.year === year && r.month === month);

  const distributionDone = entries.length > 0 && isAllocated;
  const monthEndChecklistDue = isViewingCurrentMonth && today >= 25 && !distributionDone;

  const showPendingBanner =
    monthEndChecklistDue
    || activeRemindersForPeriod.length > 0
    || overdueReminders.length > 0
    || currentMonthReminders.length > 0
    || (!isAllocated && (entries.length > 0 || periodStatus?.needsSync || periodStatus?.needsAllocation));

  const breakdownText = useMemo(() => {
    if (!preview?.breakdown) return null;
    const parts: string[] = [];
    if (preview.breakdown.hasar > 0) parts.push(`${preview.breakdown.hasar} hasar`);
    if (preview.breakdown.ozelOperasyon > 0) parts.push(`${preview.breakdown.ozelOperasyon} özel operasyon`);
    if (preview.breakdown.acilYardim > 0) parts.push(`${preview.breakdown.acilYardim} acil yardım`);
    return parts.join(' · ');
  }, [preview?.breakdown]);

  return (
    <div className="space-y-6 min-h-screen bg-white -mx-4 -my-6 px-4 py-6 sm:-m-6 sm:p-6">
      <FinansSubpageBreadcrumb current="Sabit Giderler" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Yönetim Giderleri & Dağıtım</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Masraf havuzundaki kira, maaş, araç vb. (KDV hariç) → hasar, özel operasyon ve acil yardım dosyalarına eşit pay
          </p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 dark:bg-slate-800 dark:border-slate-600">
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 dark:bg-slate-800 dark:border-slate-600">
            {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
      </div>

      {showPendingBanner && (
        <div className="space-y-2">
          {overdueReminders.map((r) => (
            <div
              key={`overdue-${r.year}-${r.month}`}
              className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100">Gecikmiş dağıtım — {r.periodLabel}</p>
                  <p className="text-xs text-red-800/90 dark:text-red-200/90 mt-0.5">{r.message}</p>
                </div>
              </div>
              {!(r.year === year && r.month === month) && (
                <Link
                  href={`/panel/finans/sabit-giderler?year=${r.year}&month=${r.month}`}
                  className="text-xs font-medium bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 shrink-0"
                >
                  Döneme git
                </Link>
              )}
            </div>
          ))}
          {(activeRemindersForPeriod.length > 0 ? activeRemindersForPeriod : currentMonthReminders).map((r) => (
            r.urgency === 'overdue' ? null : (
              <div
                key={`month-${r.year}-${r.month}`}
                className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Ay sonu dağıtım hatırlatması — {r.periodLabel}
                    </p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">{r.message}</p>
                  </div>
                </div>
              </div>
            )
          ))}
          {monthEndChecklistDue
            && activeRemindersForPeriod.length === 0
            && currentMonthReminders.length === 0
            && overdueReminders.length === 0
            && !(entries.length > 0 && !isAllocated) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Ay sonu dağıtım kontrolü — {months.find((m) => m.v === month)?.l} {year}
                  </p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                    Masraf İzleme&apos;de yönetim gideri havuzunu kontrol edin. Kayıt varsa{' '}
                    <strong>Havuzdan Aktar</strong> → <strong>Dağıt</strong> adımlarını ay kapanmadan tamamlayın.
                    {preview && preview.fileCount > 0
                      ? ` Bu dönemde ${preview.fileCount} dosya dağıtım hedefi tanımlı.`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
          {!isAllocated && entries.length > 0 && activeRemindersForPeriod.length === 0 && currentMonthReminders.length === 0 && overdueReminders.length === 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Bu dönemin gideri dağıtılmadı</p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                    {periodStatus?.needsSync
                      ? 'Önce Masraf İzleme havuzundan aktarın, ardından dosyalara dağıtın.'
                      : `${fmtCurrency(totals)} tutarı dosyalara eşit pay ile dağıtılmayı bekliyor.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/20 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">İş akışı</p>
        <p className="text-xs text-blue-800/90 dark:text-blue-200/90 mt-1">
          1) Giderleri{' '}
          <Link href="/panel/finans/masraflar" className="underline font-medium">Masraf İzleme</Link>
          {' '}→ Yönetim Giderleri havuzuna kaydedin → 2) <strong>Havuzdan Aktar</strong> → 3) Eşit dağıtım ile tüm operasyon dosyalarına paylaştırın.
          Danışmanlık hattı dosya numarası taşımadığı için dağıtıma dahil değildir.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500">Toplam (KDV hariç)</p>
          <p className="text-xl font-bold">{fmtCurrency(totals)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500">Kategori</p>
          <p className="text-xl font-bold">{entries.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500">Hedef dosya</p>
          <p className="text-xl font-bold">{preview?.fileCount ?? 0}</p>
          {breakdownText && <p className="text-[10px] text-slate-400 mt-1">{breakdownText}</p>}
        </div>
        <div className={`rounded-lg border p-4 ${isAllocated ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-[11px] text-slate-500">Dosya başı pay (eşit)</p>
          <p className="text-xl font-bold">{fmtCurrency(preview?.perFileShare ?? 0)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 flex-wrap gap-2">
          <p className="text-sm font-semibold">{year}/{String(month).padStart(2, '0')} — Havuz Özeti</p>
          <button
            type="button"
            onClick={handleSyncPool}
            disabled={syncing || isAllocated}
            className="text-xs border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {syncing ? 'Aktarılıyor...' : 'Havuzdan Aktar'}
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Yükleniyor...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            Bu dönem için aktarılmış kayıt yok. Masraf İzleme havuzundan <strong>Havuzdan Aktar</strong> ile getirin.
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {entries.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{e.expenseCategory?.name ?? '—'}</p>
                  {e.description && <p className="text-xs text-slate-400">{e.description}</p>}
                  <p className="text-[10px] text-slate-400">KDV %{e.vatRate ?? 20}{e.grossAmount ? ` · Brüt ${fmtCurrency(e.grossAmount)}` : ''}</p>
                </div>
                <div className="text-right">
                  {e.isAllocated && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mr-2">Dağıtıldı</span>}
                  <span className="text-sm font-bold">{fmtCurrency(e.amount)}</span>
                  <p className="text-[10px] text-slate-400">KDV hariç</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isAllocated && entries.length > 0 && preview && preview.fileCount > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
          <p className="text-sm font-semibold">Dosyalara Dağıtım Önizlemesi</p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={allocMethod}
              onChange={(e) => setAllocMethod(e.target.value)}
              className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 flex-1 min-w-[200px] dark:bg-slate-900"
            >
              {ALLOCATION_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAllocate}
              disabled={allocating}
              className="text-sm bg-orange-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {allocating ? 'Dağıtılıyor...' : `${fmtCurrency(totals)} Dağıt`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/40 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Dosya</th>
                  <th className="px-3 py-2 text-left">Tür</th>
                  <th className="px-3 py-2 text-right">Pay (KDV hariç)</th>
                  <th className="px-3 py-2 text-right">Referans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {preview.files.map((f) => (
                  <tr key={`${f.targetType ?? 'claim'}-${f.fileNo}`}>
                    <td className="px-3 py-2 font-mono font-semibold">{f.fileNo}</td>
                    <td className="px-3 py-2 text-slate-600">{f.fileTypeLabel ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-orange-700">{fmtCurrency(f.allocatedAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmtCurrency(f.approvedBudget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview?.fileCount === 0 && entries.length > 0 && !isAllocated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Dağıtım için uygun aktif dosya bulunamadı. Hasar dosyalarında onaylı bütçe veya acil yardım vakalarında aktif kayıt olmalıdır.
        </div>
      )}
    </div>
  );
}
