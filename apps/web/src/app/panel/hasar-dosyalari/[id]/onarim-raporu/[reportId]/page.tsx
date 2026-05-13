'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import dynamic from 'next/dynamic';
import SpeechToText from '@/components/SpeechToText';
import RepairItemsModal, { DAMAGE_SIZE_OPTIONS, DAMAGE_TYPE_OPTIONS, SelectedRepairItem, damageSizeLabel, damageTypeLabel } from '@/components/damage-reports/RepairItemsModal';

const ImageAnnotationEditor = dynamic(
  () => import('@/components/ImageAnnotationEditor'),
  { ssr: false }
);

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL.';
}

// ─── Güvenli Matematiksel İfade Parser ──────────────────────────────────────
function evaluateExpression(expr: string): number | null {
  const trimmed = expr.trim();
  // Sadece sayı, operatör ve parantez içeriyorsa işlem yap
  if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(trimmed)) return null;
  // Boş veya sadece operatörle bitiyorsa geçersiz
  if (!trimmed || /[\+\-\*\/]$/.test(trimmed)) return null;
  // Saf sayı ise çevir
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return null;

  try {
    // Token tabanlı güvenli parser
    const result = parseExpr(trimmed);
    if (!isFinite(result) || isNaN(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

function parseExpr(expr: string): number {
  let pos = 0;
  const s = expr.replace(/\s+/g, '');

  function parseNum(): number {
    if (pos >= s.length) throw new Error('Unexpected end');
    if (s[pos] === '(') {
      pos++; // '('
      const val = parseAddSub();
      if (s[pos] !== ')') throw new Error('Missing )');
      pos++; // ')'
      return val;
    }
    let numStr = '';
    if (s[pos] === '-') { numStr += '-'; pos++; }
    while (pos < s.length && /[\d\.]/.test(s[pos])) { numStr += s[pos++]; }
    if (!numStr || numStr === '-') throw new Error('Invalid number');
    return parseFloat(numStr);
  }

  function parseMulDiv(): number {
    let left = parseNum();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseNum();
      if (op === '*') left *= right;
      else { if (right === 0) throw new Error('Division by zero'); left /= right; }
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const right = parseMulDiv();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  const result = parseAddSub();
  if (pos !== s.length) throw new Error('Unexpected token');
  return result;
}

const DAMAGE_TYPE_CODES = [
  'Dahili Su', 'Yangın', 'Deprem', 'Sel-Seylap', 'Fırtına',
  'Heyelan', 'İnfilak', 'Taşıt Çarpması', 'Gemi-Tekne', 'İnşaat',
  'Cam Kırılması',
];

const UNITS = ['Adet', 'Maktuen', 'm²', 'm³', 'm/tül', 'Takım', 'Asgari', 'Tam Gün', '1/2 gün', 'Çuval', 'Servis', 'Günlük', 'Yevmiye', 'Saat', 'Kamyon', 'Torba', 'Metre', 'Kutu'];

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{text}</span>;
}

// ─── Revizyon Geçmişi Bileşeni ─────────────────────────────────────────────
type RevHistoryItem = {
  id: string;
  version: number;
  status: string;
  requestedAt: string | null;
  completedAt: string | null;
  reason: string | null;
  reasonCategory: string | null;
  requestedBy: string | null;
};

function RevisionHistory({ reportId }: { reportId: string; claimFileId: string }) {
  const [items, setItems] = useState<RevHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    fetch(`${API}/repair-reports/${reportId}/revision-history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setItems(json?.data ?? []); })
      .catch(() => {
        // Mock: show sample history
        setItems([
          {
            id: 'v1', version: 1, status: 'approved',
            requestedAt: null, completedAt: '2024-11-20T10:00:00Z',
            reason: null, reasonCategory: null, requestedBy: null,
          },
          {
            id: 'rev1', version: 2, status: 'revision',
            requestedAt: '2024-12-02T09:30:00Z', completedAt: null,
            reason: 'Malzeme listesine ek kalemler eklenmeli',
            reasonCategory: 'Eksik Kalem', requestedBy: 'Allianz Hasar Birimi',
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) return null;
  if (!items || items.length === 0) return null;

  const fmtD = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
        <h4 className="text-sm font-semibold text-slate-700">Revizyon Geçmişi</h4>
        <a href={`/panel/revizyon-talepleri?reportId=${reportId}`} className="text-xs text-blue-600 hover:text-blue-700">
          Tümünü Gör →
        </a>
      </div>
      <div className="relative">
        {/* Timeline vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-100" />
        <div className="space-y-4 ml-8">
          {items.map((item, idx) => (
            <div key={item.id} className="relative">
              {/* Dot */}
              <div className={`absolute -left-8 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 text-xs font-bold ${item.status === 'revision' ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-blue-100 border-blue-400 text-blue-700'}`}>
                {item.version ?? (idx + 1)}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">
                      {item.status === 'revision' ? 'Revizyon Talebi' : `v${item.version ?? (idx + 1)} — ${item.status === 'approved' ? 'Onaylandı' : 'Taslak'}`}
                    </span>
                    {item.reasonCategory && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                        {item.reasonCategory}
                      </span>
                    )}
                  </div>
                  {item.reason && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                  )}
                  {item.requestedBy && (
                    <p className="text-xs text-slate-400">Talep eden: {item.requestedBy}</p>
                  )}
                  <p className="text-xs text-slate-300 mt-0.5">
                    {item.requestedAt ? fmtD(item.requestedAt) : item.completedAt ? fmtD(item.completedAt) : ''}
                  </p>
                </div>
                {item.status === 'revision' && (
                  <a
                    href={`/panel/revizyon-talepleri/${item.id}`}
                    className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap flex-shrink-0"
                  >
                    Detay →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── İş Grubu Bazlı Kar Özeti ─────────────────────────────────────────────────
interface WorkGroupProfitRow {
  workGroupId: string;
  workGroupName: string;
  supplierTotal: number;
  salesTotal: number;
  profit: number;
  profitPct: number;
}

function WorkGroupProfitSummary({ items, workGroups }: { items: any[]; workGroups: any[] }) {
  const [open, setOpen] = useState(true);

  const rows: WorkGroupProfitRow[] = useMemo(() => {
    const map = new Map<string, { supplierTotal: number; salesTotal: number }>();

    for (const item of items) {
      const wgId = item.workGroupId ?? item.workGroup?.id ?? '__unknown__';
      const prev = map.get(wgId) ?? { supplierTotal: 0, salesTotal: 0 };
      const qty = item.quantity ?? 0;
      const isLumpsum = item.pricingType === 'lumpsum';
      // salesTotal/supplierTotal backend'den hesaplanmış olabilir veya olmayabilir; her iki durumu da ele al
      const salesAmt = isLumpsum
        ? (item.lumpSumPrice ?? 0)
        : ((item.salesTotal != null && item.salesTotal > 0) ? item.salesTotal : qty * (item.salesUnitPrice ?? 0));
      const supplierAmt = isLumpsum
        ? (item.lumpSumPrice ?? 0)
        : ((item.supplierTotal != null && item.supplierTotal > 0) ? item.supplierTotal : qty * (item.supplierUnitPrice ?? 0));
      map.set(wgId, {
        supplierTotal: prev.supplierTotal + supplierAmt,
        salesTotal: prev.salesTotal + salesAmt,
      });
    }

    const result: WorkGroupProfitRow[] = [];
    map.forEach((totals, wgId) => {
      // workGroup adını items içinden de çekebiliriz (workGroup.name relation'dan gelebilir)
      const wgFromItems = items.find((i: any) => (i.workGroupId ?? i.workGroup?.id) === wgId);
      const wg = workGroups.find((w: any) => w.id === wgId) ?? (wgFromItems?.workGroup ?? null);
      const profit = totals.salesTotal - totals.supplierTotal;
      const profitPct = totals.salesTotal > 0 ? (profit / totals.salesTotal) * 100 : 0;
      result.push({
        workGroupId: wgId,
        workGroupName: wg?.name ?? (wgId === '__unknown__' ? 'Belirtilmemiş' : wgId),
        supplierTotal: totals.supplierTotal,
        salesTotal: totals.salesTotal,
        profit,
        profitPct,
      });
    });

    return result.sort((a, b) => b.salesTotal - a.salesTotal);
  }, [items, workGroups]);

  const grandSupplier = rows.reduce((s, r) => s + r.supplierTotal, 0);
  const grandSales = rows.reduce((s, r) => s + r.salesTotal, 0);
  const grandProfit = grandSales - grandSupplier;
  const grandProfitPct = grandSales > 0 ? (grandProfit / grandSales) * 100 : 0;

  if (items.length === 0) return null;

  const profitColor = (pct: number) => pct >= 20 ? 'text-green-600' : pct >= 10 ? 'text-yellow-600' : pct >= 0 ? 'text-orange-600' : 'text-red-600';
  const profitBg = (pct: number) => pct >= 20 ? 'bg-green-50' : pct >= 10 ? 'bg-yellow-50' : pct >= 0 ? 'bg-orange-50' : 'bg-red-50';

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Başlık — tıklanınca açılır/kapanır */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">%</span>
          <span className="text-sm font-semibold text-slate-700">İş Grubu Bazlı Kar Özeti</span>
          <span className="text-xs text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Dahili</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${profitColor(grandProfitPct)}`}>
            %{grandProfitPct.toFixed(1)} Kar
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-indigo-50 px-5 pb-5 pt-3">
          <div className="overflow-x-auto">
            <style>{`
              @keyframes lossFlash {
                0%, 100% { background-color: #991b1b; }
                50% { background-color: #dc2626; }
              }
              .loss-flash { animation: lossFlash 1.6s ease-in-out infinite; }
            `}</style>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wide">
                  <th className="text-left px-3 py-2 rounded-l-lg">İş Grubu</th>
                  <th className="text-right px-3 py-2">Tedarikçi (TDR)</th>
                  <th className="text-right px-3 py-2">Satış Fiyatı</th>
                  <th className="text-right px-3 py-2">Kar</th>
                  <th className="text-right px-3 py-2 rounded-r-lg">Kar %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.workGroupId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{row.workGroupName}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{fmtCurrency(row.supplierTotal)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtCurrency(row.salesTotal)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtCurrency(row.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${profitBg(row.profitPct)} ${profitColor(row.profitPct)}`}>
                        %{row.profitPct.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`font-bold ${grandProfit < 0 ? 'loss-flash' : 'bg-slate-700'}`}>
                  <td className="px-3 py-3.5 text-white text-xs font-extrabold uppercase tracking-widest rounded-bl-lg">
                    {grandProfit < 0 ? '⚠ ZARAR' : 'GENEL TOPLAM'}
                  </td>
                  <td className="px-3 py-3.5 text-right text-slate-200 text-sm font-bold">{fmtCurrency(grandSupplier)}</td>
                  <td className="px-3 py-3.5 text-right text-white text-sm font-bold">{fmtCurrency(grandSales)}</td>
                  <td className="px-3 py-3.5 text-right text-sm font-bold text-red-200">{fmtCurrency(grandProfit)}</td>
                  <td className="px-3 py-3.5 text-right rounded-br-lg">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-extrabold ${grandProfit < 0 ? 'bg-red-900/60 text-red-100' : `${profitBg(grandProfitPct)} ${profitColor(grandProfitPct)}`}`}>
                      %{grandProfitPct.toFixed(1)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Genel Analiz */}
          <div className="mt-4 border-t border-indigo-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">Genel Analiz</p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Toplam Satış</p>
                <p className="text-sm font-bold text-slate-800">{fmtCurrency(grandSales)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Toplam Tedarikçi</p>
                <p className="text-sm font-bold text-slate-600">{fmtCurrency(grandSupplier)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Toplam Kar</p>
                <p className={`text-sm font-bold ${grandProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCurrency(grandProfit)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Kar Oranı</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-extrabold ${profitBg(grandProfitPct)} ${profitColor(grandProfitPct)}`}>
                  %{grandProfitPct.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metraj Hesaplama Asistanı Modal ─────────────────────────────────────────

type HesaplamaTuru = 'duvar_boyasi' | 'tavan_boyasi' | 'zemin_kaplama' | 'siva' | 'alcipan_tavan' | 'alcipan_duvar' | 'ozel';

interface Kesinti {
  id: string;
  tip: 'pencere' | 'kapi';
  adet: number;
  en: number;
  boy: number;
}

interface Oda {
  id: string;
  ad: string;
  en: string;
  boy: string;
  yukseklik: string;
  kesintiler: Kesinti[];
}

const ODA_ADLARI = ['Salon', 'Oturma Odası', 'Yatak Odası', 'Çocuk Odası', 'Mutfak', 'Banyo', 'WC', 'Koridor', 'Balkon', 'Depo', 'Diğer'];

function newOda(): Oda {
  return { id: Math.random().toString(36).slice(2), ad: 'Salon', en: '', boy: '', yukseklik: '2.80', kesintiler: [] };
}

function newKesinti(tip: 'pencere' | 'kapi'): Kesinti {
  return tip === 'pencere'
    ? { id: Math.random().toString(36).slice(2), tip: 'pencere', adet: 1, en: 1.2, boy: 1.5 }
    : { id: Math.random().toString(36).slice(2), tip: 'kapi', adet: 1, en: 0.9, boy: 2.1 };
}

function parseN(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

interface OdaHesap {
  zeminTavan: number;
  brutDuvar: number;
  toplamCevre: number;
  toplamKesinti: number;
  netDuvar: number;
}

function hesaplaOda(oda: Oda): OdaHesap {
  const en = parseN(oda.en);
  const boy = parseN(oda.boy);
  const yuk = parseN(oda.yukseklik);
  const zeminTavan = en * boy;
  const brutDuvar = (2 * en + 2 * boy) * yuk;
  const toplamCevre = 2 * (en + boy);
  const toplamKesinti = oda.kesintiler.reduce((s, k) => s + k.adet * k.en * k.boy, 0);
  const netDuvar = Math.max(0, brutDuvar - toplamKesinti);
  return { zeminTavan, brutDuvar, toplamCevre, toplamKesinti, netDuvar };
}

function odaUyarisi(oda: Oda): string[] {
  const uyarilar: string[] = [];
  const en = parseN(oda.en);
  const boy = parseN(oda.boy);
  const yuk = parseN(oda.yukseklik);
  if (en > 0 && (en < 0.5 || en > 30)) uyarilar.push('En değeri 0.5m–30m aralığında olmalıdır.');
  if (boy > 0 && (boy < 0.5 || boy > 30)) uyarilar.push('Boy değeri 0.5m–30m aralığında olmalıdır.');
  if (yuk > 0 && (yuk < 2 || yuk > 5)) uyarilar.push('Yükseklik 2m–5m aralığında olmalıdır.');
  const h = hesaplaOda(oda);
  if (h.toplamKesinti > h.brutDuvar && h.brutDuvar > 0) uyarilar.push('Kesinti toplamı brüt duvar alanından büyük!');
  return uyarilar;
}

function MetrajHesaplamaModal({ onClose, onAktar, location }: { onClose: () => void; onAktar: (deger: string) => void; location?: string }) {
  const [odalar, setOdalar] = useState<Oda[]>([newOda()]);
  const [hesaplamaTuru, setHesaplamaTuru] = useState<HesaplamaTuru>('duvar_boyasi');
  const [ozelFormul, setOzelFormul] = useState('');

  const tumUyarilar = odalar.flatMap((o) => odaUyarisi(o));

  const odaToplami = (oda: Oda): number => {
    const h = hesaplaOda(oda);
    switch (hesaplamaTuru) {
      case 'duvar_boyasi': return h.netDuvar;
      case 'tavan_boyasi': return h.zeminTavan;
      case 'zemin_kaplama': return h.zeminTavan;
      case 'siva': return h.netDuvar;
      case 'alcipan_tavan': return h.zeminTavan;
      case 'alcipan_duvar': return h.netDuvar;
      case 'ozel': {
        const sonuc = evaluateExpression(ozelFormul);
        return sonuc !== null ? sonuc : 0;
      }
      default: return 0;
    }
  };

  const genelToplam = hesaplamaTuru === 'ozel'
    ? (evaluateExpression(ozelFormul) ?? 0)
    : odalar.reduce((s, o) => s + odaToplami(o), 0);

  const updateOda = (id: string, patch: Partial<Oda>) => {
    setOdalar((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
  };

  const addKesinti = (odaId: string, tip: 'pencere' | 'kapi') => {
    setOdalar((prev) => prev.map((o) => o.id === odaId ? { ...o, kesintiler: [...o.kesintiler, newKesinti(tip)] } : o));
  };

  const updateKesinti = (odaId: string, kId: string, patch: Partial<Kesinti>) => {
    setOdalar((prev) => prev.map((o) =>
      o.id === odaId ? { ...o, kesintiler: o.kesintiler.map((k) => k.id === kId ? { ...k, ...patch } : k) } : o
    ));
  };

  const removeKesinti = (odaId: string, kId: string) => {
    setOdalar((prev) => prev.map((o) =>
      o.id === odaId ? { ...o, kesintiler: o.kesintiler.filter((k) => k.id !== kId) } : o
    ));
  };

  const removeOda = (id: string) => {
    setOdalar((prev) => prev.filter((o) => o.id !== id));
  };

  const hesaplamaTuruLabel: Record<HesaplamaTuru, string> = {
    duvar_boyasi: 'Duvar Boyası',
    tavan_boyasi: 'Tavan Boyası',
    zemin_kaplama: 'Zemin Kaplama',
    siva: 'Sıva',
    alcipan_tavan: 'Alçıpan (Tavan)',
    alcipan_duvar: 'Alçıpan (Duvar)',
    ozel: 'Özel Formül',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">📐</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Metraj Hesaplama Asistanı</h3>
              {location && (
                <p className="text-xs text-blue-600 font-medium mt-0.5">
                  Mahal/Bölge: <span className="bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">{location}</span>
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Hesaplama Türü */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hesaplama Türü</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(hesaplamaTuruLabel) as HesaplamaTuru[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHesaplamaTuru(t)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${hesaplamaTuru === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {hesaplamaTuruLabel[t]}
              </button>
            ))}
          </div>
          {hesaplamaTuru === 'ozel' && (
            <div className="mt-2">
              <label className="text-xs text-slate-500 block mb-1">Özel Formül (örn: 12.5 * 2 + 8)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Formülü girin..."
                value={ozelFormul}
                onChange={(e) => setOzelFormul(e.target.value)}
              />
              {ozelFormul && evaluateExpression(ozelFormul) !== null && (
                <p className="text-xs text-blue-600 mt-1 font-mono">= {fmt2(evaluateExpression(ozelFormul)!)} m²</p>
              )}
            </div>
          )}
        </div>

        {/* Genel Uyarılar */}
        {tumUyarilar.length > 0 && (
          <div className="mx-6 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
            {tumUyarilar.map((u, i) => (
              <p key={i} className="text-xs text-red-700 font-medium">⚠ {u}</p>
            ))}
          </div>
        )}

        {/* Oda Listesi */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {odalar.map((oda, odaIdx) => {
            const h = hesaplaOda(oda);
            const toplamBuOda = odaToplami(oda);
            const uyarilar = odaUyarisi(oda);
            const hasError = uyarilar.length > 0;

            return (
              <div key={oda.id} className={`border rounded-xl p-4 space-y-3 ${hasError ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-slate-50/40'}`}>
                {/* Oda Başlık */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">{odaIdx + 1}.</span>
                  <select
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={ODA_ADLARI.includes(oda.ad) ? oda.ad : 'Diğer'}
                    onChange={(e) => {
                      if (e.target.value !== 'Diğer') updateOda(oda.id, { ad: e.target.value });
                    }}
                  >
                    {ODA_ADLARI.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input
                    type="text"
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Oda adı..."
                    value={oda.ad}
                    onChange={(e) => updateOda(oda.id, { ad: e.target.value })}
                  />
                  {odalar.length > 1 && (
                    <button type="button" onClick={() => removeOda(oda.id)} className="text-slate-300 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5.5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                  )}
                </div>

                {/* Boyutlar */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { field: 'en', label: 'En (m)', placeholder: '0.00' },
                    { field: 'boy', label: 'Boy (m)', placeholder: '0.00' },
                    { field: 'yukseklik', label: 'Yükseklik (m)', placeholder: '2.80' },
                  ] as const).map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs text-slate-500 block mb-1">{label}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder={placeholder}
                        value={(oda as any)[field]}
                        onChange={(e) => updateOda(oda.id, { [field]: e.target.value } as any)}
                      />
                    </div>
                  ))}
                </div>

                {/* Formüller — her zaman görünür */}
                {parseN(oda.en) > 0 && parseN(oda.boy) > 0 && (
                  <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-blue-600 mb-1.5">Otomatik Hesaplamalar</p>
                    <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Zemin/Tavan Alanı:</span>
                        <span className="text-slate-700 font-semibold">
                          {fmt2(parseN(oda.en))} × {fmt2(parseN(oda.boy))} = <span className="text-blue-700">{fmt2(h.zeminTavan)} m²</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Brüt Duvar Alanı:</span>
                        <span className="text-slate-700 font-semibold">
                          (2×{fmt2(parseN(oda.en))} + 2×{fmt2(parseN(oda.boy))}) × {fmt2(parseN(oda.yukseklik))} = <span className="text-blue-700">{fmt2(h.brutDuvar)} m²</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Toplam Çevre:</span>
                        <span className="text-slate-700 font-semibold">
                          2×({fmt2(parseN(oda.en))}+{fmt2(parseN(oda.boy))}) = <span className="text-blue-700">{fmt2(h.toplamCevre)} mt</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Kesintiler */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-600">Kesintiler</p>
                    <button type="button" onClick={() => addKesinti(oda.id, 'pencere')}
                      className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-lg hover:bg-sky-200 font-medium">+ Pencere</button>
                    <button type="button" onClick={() => addKesinti(oda.id, 'kapi')}
                      className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg hover:bg-amber-200 font-medium">+ Kapı</button>
                  </div>
                  {oda.kesintiler.length > 0 && (
                    <div className="space-y-1.5">
                      {oda.kesintiler.map((k) => (
                        <div key={k.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${k.tip === 'pencere' ? 'bg-sky-50 border border-sky-100' : 'bg-amber-50 border border-amber-100'}`}>
                          <span className={`text-xs font-medium w-14 flex-shrink-0 ${k.tip === 'pencere' ? 'text-sky-700' : 'text-amber-700'}`}>
                            {k.tip === 'pencere' ? 'Pencere' : 'Kapı'}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">Adet:</div>
                          <input type="number" min="1" step="1"
                            className="w-12 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white text-center"
                            value={k.adet}
                            onChange={(e) => updateKesinti(oda.id, k.id, { adet: parseInt(e.target.value) || 1 })}
                          />
                          <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">En:</div>
                          <input type="number" min="0" step="0.01"
                            className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white text-center"
                            value={k.en}
                            onChange={(e) => updateKesinti(oda.id, k.id, { en: parseFloat(e.target.value) || 0 })}
                          />
                          <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">Boy:</div>
                          <input type="number" min="0" step="0.01"
                            className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white text-center"
                            value={k.boy}
                            onChange={(e) => updateKesinti(oda.id, k.id, { boy: parseFloat(e.target.value) || 0 })}
                          />
                          <span className="text-xs font-mono text-slate-500 ml-auto flex-shrink-0">
                            {k.adet} × ({fmt2(k.en)} × {fmt2(k.boy)}) = <span className="font-semibold text-slate-700">{fmt2(k.adet * k.en * k.boy)} m²</span>
                          </span>
                          <button type="button" onClick={() => removeKesinti(oda.id, k.id)} className="text-slate-300 hover:text-red-500 ml-1">×</button>
                        </div>
                      ))}
                      <div className="flex justify-between items-center px-2 pt-1 font-mono text-xs">
                        <span className="text-slate-500">Toplam Kesinti:</span>
                        <span className={`font-semibold ${h.toplamKesinti > h.brutDuvar && h.brutDuvar > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {fmt2(h.toplamKesinti)} m²
                        </span>
                      </div>
                      {parseN(oda.en) > 0 && parseN(oda.boy) > 0 && (
                        <div className="flex justify-between items-center px-2 font-mono text-xs">
                          <span className="text-slate-500">Net Duvar Alanı:</span>
                          <span className="font-bold text-emerald-700">{fmt2(h.brutDuvar)} − {fmt2(h.toplamKesinti)} = {fmt2(h.netDuvar)} m²</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bu oda toplamı */}
                {parseN(oda.en) > 0 && parseN(oda.boy) > 0 && hesaplamaTuru !== 'ozel' && (
                  <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-indigo-700">{oda.ad} — {hesaplamaTuruLabel[hesaplamaTuru]}</span>
                    <span className="text-sm font-bold text-indigo-800">{fmt2(toplamBuOda)} m²</span>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setOdalar((prev) => [...prev, newOda()])}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors font-medium"
          >
            + Oda Ekle
          </button>
        </div>

        {/* Footer — Toplam ve Aktar */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500">Toplam Alan ({hesaplamaTuruLabel[hesaplamaTuru]})</p>
              <p className={`text-2xl font-bold ${genelToplam < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {genelToplam < 0 ? (
                  <span className="text-red-600 text-base font-semibold">Hata: Negatif Sonuç</span>
                ) : (
                  <>{fmt2(genelToplam)} <span className="text-base font-medium text-slate-500">m²</span></>
                )}
              </p>
              {hesaplamaTuru !== 'ozel' && odalar.length > 1 && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {odalar.map((o) => `${fmt2(odaToplami(o))}`).join(' + ')} = {fmt2(genelToplam)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm hover:bg-slate-50">
                İptal
              </button>
              <button
                type="button"
                disabled={genelToplam <= 0 || tumUyarilar.some((u) => u.includes('büyük'))}
                onClick={() => { onAktar(fmt2(genelToplam)); onClose(); }}
                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Miktarı Rapora Yansıt ({fmt2(genelToplam)} m²)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── İş Tanımı Seçici (inline yeni ekleme destekli) ──────────────────────────
function WorkDefinitionSelector({
  value,
  subGroups,
  workGroupId,
  onSelect,
  onAddNew,
  className,
  'data-cell': dataCell,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  subGroups: any[];
  workGroupId: string;
  onSelect: (v: string, unit?: string) => void;
  onAddNew: (name: string, workGroupId: string) => Promise<any>;
  className?: string;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingNew) inputRef.current?.focus();
  }, [addingNew]);

  const commit = async () => {
    const trimmed = newVal.trim();
    if (!trimmed || !workGroupId) { setAddingNew(false); setNewVal(''); return; }
    setSaving(true);
    try {
      const result = await onAddNew(trimmed, workGroupId);
      onSelect(result?.name ?? trimmed, result?.defaultUnit);
    } catch { /* ignore */ } finally {
      setSaving(false);
      setAddingNew(false);
      setNewVal('');
    }
  };

  if (addingNew) {
    return (
      <div className="flex items-center gap-1 px-1 w-full">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 h-8 border border-blue-300 rounded px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="İş tanımı adı..."
          value={newVal}
          disabled={saving}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); }
          }}
          onBlur={commit}
        />
        <button type="button" onClick={() => { setAddingNew(false); setNewVal(''); }} className="text-slate-400 hover:text-red-500 flex-shrink-0 text-xs">×</button>
      </div>
    );
  }

  return (
    <select
      data-cell={dataCell}
      className={className}
      value={value}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onChange={(e) => {
        if (e.target.value === '__add_new__') {
          setAddingNew(true);
        } else {
          const sg = subGroups.find((s: any) => (s.name ?? s.id) === e.target.value);
          onSelect(e.target.value, sg?.defaultUnit);
        }
      }}
    >
      <option value="">— Serbest Giriş —</option>
      {subGroups.map((sg: any) => (
        <option key={sg.id} value={sg.name ?? sg.id}>{sg.name}</option>
      ))}
      <option value="__add_new__">+ Yeni İş Tanımı Ekle</option>
    </select>
  );
}

// ─── Excel-benzeri Inline Editable Tablo ─────────────────────────────────────
// Eşya kategorisine ait iş grubu kodları — bu kategoride sadece bu gruplar gösterilir
const ESYA_WORK_GROUP_CODES = ['esya', 'mobilya', 'diger', 'temizlik', 'teknik_temizlik'];

function filterWorkGroupsByCategory(workGroups: any[], damageCategory: string): any[] {
  if (damageCategory === 'esya') {
    return workGroups.filter((wg: any) => ESYA_WORK_GROUP_CODES.includes(wg.code));
  }
  // Bina: eşya iş grubunu çıkar
  return workGroups.filter((wg: any) => wg.code !== 'esya' && wg.code !== 'mobilya');
}

interface EditableItemsTableProps {
  items: any[];
  workGroups: any[];
  damageTypes: any[];
  reportType: string;
  isEditable: boolean;
  viewMode: 'internal' | 'external';
  onSave: (itemId: string, data: any) => Promise<void>;
  onDelete: (itemId: string) => void;
  onAdd: (data: any) => Promise<void>;
}

interface RowState {
  workGroupId: string;
  location: string;
  jobDescription: string;
  description: string;
  quantity: string;
  unit: string;
  salesUnitPrice: string;
  supplierUnitPrice: string;
  damageCategory: 'bina' | 'esya';
  damageTypeId: string;
  pricingType: 'unit' | 'lumpsum';
  lumpSumPrice: string;
}

function rowFromItem(item: any): RowState {
  return {
    workGroupId: item.workGroupId ?? '',
    location: item.location ?? '',
    jobDescription: item.jobDescription ?? '',
    description: item.description ?? '',
    quantity: String(item.quantity ?? '1'),
    unit: item.unit ?? 'm²',
    salesUnitPrice: String(item.salesUnitPrice ?? '0'),
    supplierUnitPrice: String(item.supplierUnitPrice ?? '0'),
    damageCategory: (item.damageCategory ?? 'bina') as 'bina' | 'esya',
    damageTypeId: item.damageTypeId ?? '',
    pricingType: (item.pricingType ?? 'unit') as 'unit' | 'lumpsum',
    lumpSumPrice: String(item.lumpSumPrice ?? '0'),
  };
}

function emptyRow(): RowState {
  return { workGroupId: '', location: '', jobDescription: '', description: '', quantity: '1', unit: 'm²', salesUnitPrice: '0', supplierUnitPrice: '0', damageCategory: 'bina', damageTypeId: '', pricingType: 'unit', lumpSumPrice: '0' };
}

// ─── Hesap Makinesi Input ─────────────────────────────────────────────────────
function CalcInput({
  value,
  onChange,
  onCommit,
  className,
  placeholder,
  'data-cell': dataCell,
  tabIndex,
  onFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFormula = /[\+\-\*\/\(\)]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value.trim());

  const handleFocus = () => {
    setDraft(value);
    setEditing(true);
    onFocus?.();
    // Focus anında tüm metni seç; böylece 0 veya mevcut değerin üzerine direkt yazılabilir
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = (raw: string) => {
    setEditing(false);
    const evaluated = evaluateExpression(raw);
    const final = evaluated !== null ? evaluated.toString() : raw;
    onChange(final);
    onCommit(final);
  };

  const handleBlur = () => {
    commit(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      commit(draft);
    } else if (e.key === 'Escape') {
      setEditing(false);
      setDraft(value);
    }
    onKeyDown?.(e);
  };

  const displayValue = editing ? draft : value;

  return (
    <div className="relative flex items-center w-full h-10">
      {isFormula && !editing && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-indigo-400 bg-indigo-50 rounded px-0.5 leading-none select-none">fx</span>
      )}
      <input
        ref={inputRef}
        data-cell={dataCell}
        type="text"
        className={`${className} ${isFormula && !editing ? 'pl-6' : ''}`}
        value={displayValue}
        placeholder={placeholder}
        tabIndex={tabIndex}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

// ─── Mahal/Bölge Seçici ──────────────────────────────────────────────────────
function LocationSelector({
  value,
  locations,
  onSelect,
  onAddNew,
  className,
  'data-cell': dataCell,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  locations: string[];
  onSelect: (v: string) => void;
  onAddNew: (v: string) => void;
  className?: string;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingNew) inputRef.current?.focus();
  }, [addingNew]);

  if (addingNew) {
    return (
      <div className="flex items-center gap-1 px-1 w-full">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 h-8 border border-blue-300 rounded px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Mahal adı..."
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const trimmed = newVal.trim();
              if (trimmed) { onAddNew(trimmed); onSelect(trimmed); }
              setAddingNew(false);
              setNewVal('');
            } else if (e.key === 'Escape') {
              setAddingNew(false);
              setNewVal('');
            }
          }}
          onBlur={() => {
            const trimmed = newVal.trim();
            if (trimmed) { onAddNew(trimmed); onSelect(trimmed); }
            setAddingNew(false);
            setNewVal('');
          }}
        />
        <button
          type="button"
          onClick={() => { setAddingNew(false); setNewVal(''); }}
          className="text-slate-400 hover:text-red-500 flex-shrink-0 text-xs"
        >×</button>
      </div>
    );
  }

  return (
    <select
      data-cell={dataCell}
      className={className}
      value={value}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onChange={(e) => {
        if (e.target.value === '__add_new__') {
          setAddingNew(true);
        } else {
          onSelect(e.target.value);
        }
      }}
    >
      <option value="">—</option>
      {locations.map((loc) => (
        <option key={loc} value={loc}>{loc}</option>
      ))}
      <option value="__add_new__">+ Yeni Mahal/Bölge Ekle</option>
    </select>
  );
}

function EditableItemsTable({ items, workGroups, isEditable, viewMode, onSave, onDelete, onAdd }: EditableItemsTableProps) {
  const [rows, setRows] = useState<(RowState & { _id: string; _isDirty: boolean; _savedFlash: boolean })[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState<RowState>(emptyRow());
  const [addingDirty, setAddingDirty] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIdx: number | 'new'; col: string } | null>(null);
  const [subGroups, setSubGroups] = useState<Record<string, any[]>>({}); // workGroupId -> subgroups
  const [addingSubGroups, setAddingSubGroups] = useState<any[]>([]);
  const [metrajModalRowId, setMetrajModalRowId] = useState<string | null>(null); // rowId veya 'new'
  const [locationList, setLocationList] = useState<string[]>([]);
  // Zam oranı state
  const [zamOraniInput, setZamOraniInput] = useState('');
  const [zamOraniUndoSnapshot, setZamOraniUndoSnapshot] = useState<{ id: string; salesUnitPrice: string; supplierUnitPrice: string }[] | null>(null);
  const [zamApplying, setZamApplying] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const [descriptionErrors, setDescriptionErrors] = useState<Set<string>>(new Set());

  // locationList'i items'tan türet ve güncel tut
  useEffect(() => {
    const locs = Array.from(new Set(
      items.map((i: any) => i.location).filter((l: string) => l && l.trim())
    )) as string[];
    setLocationList(locs);
  }, [items]);

  const addLocationIfNew = (loc: string) => {
    setLocationList((prev) => prev.includes(loc) ? prev : [...prev, loc]);
  };

  useEffect(() => {
    setRows(items.map((item) => ({ ...rowFromItem(item), _id: item.id, _isDirty: false, _savedFlash: false })));
  }, [items]);

  // sub-group yükleme
  const loadSubGroups = async (workGroupId: string) => {
    if (!workGroupId || subGroups[workGroupId] !== undefined) return;
    try {
      const res = await axios.get(`${API}/work-groups/${workGroupId}/sub-groups`, { headers: authHeader() });
      const data = res.data.data || [];
      setSubGroups((prev) => ({ ...prev, [workGroupId]: data }));
    } catch {
      setSubGroups((prev) => ({ ...prev, [workGroupId]: [] }));
    }
  };

  const loadAddingSubGroups = async (workGroupId: string) => {
    if (!workGroupId) { setAddingSubGroups([]); return; }
    try {
      const res = await axios.get(`${API}/work-groups/${workGroupId}/sub-groups`, { headers: authHeader() });
      setAddingSubGroups(res.data.data || []);
    } catch {
      setAddingSubGroups([]);
    }
  };

  // Inline yeni iş tanımı ekleme
  const createSubGroup = async (name: string, workGroupId: string): Promise<{ name: string }> => {
    const code = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    const res = await axios.post(
      `${API}/work-groups/${workGroupId}/sub-groups`,
      { code, name, unitType: 'm²', sortOrder: 0 },
      { headers: authHeader() },
    );
    const newSg = res.data.data ?? res.data;
    // Mevcut sub-groups listesini güncelle
    setSubGroups((prev) => {
      const existing = prev[workGroupId] ?? [];
      return { ...prev, [workGroupId]: [...existing, newSg] };
    });
    setAddingSubGroups((prev) => [...prev, newSg]);
    return { name: newSg.name };
  };

  const updateRow = (id: string, field: keyof RowState, value: string) => {
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, [field]: value, _isDirty: true } : r));
  };

  const revertRow = (id: string) => {
    const original = items.find((i: any) => i.id === id);
    if (original) {
      setRows((prev) => prev.map((r) => r._id === id ? { ...rowFromItem(original), _id: id, _isDirty: false, _savedFlash: false } : r));
    }
  };

  const saveRow = async (id: string) => {
    const row = rows.find((r) => r._id === id);
    if (!row || !row._isDirty) return;
    setSavingId(id);
    try {
      const isLumpsum = row.pricingType === 'lumpsum';
      await onSave(id, {
        workGroupId: row.workGroupId || undefined,
        location: row.location || undefined,
        jobDescription: row.jobDescription,
        description: row.description || undefined,
        quantity: parseFloat(row.quantity) || 1,
        unit: row.unit,
        salesUnitPrice: parseFloat(row.salesUnitPrice) || 0,
        supplierUnitPrice: parseFloat(row.supplierUnitPrice) || 0,
        pricingType: row.pricingType,
        lumpSumPrice: isLumpsum ? parseFloat(row.lumpSumPrice) || 0 : undefined,
        damageCategory: row.damageCategory,
        damageTypeId: row.damageTypeId || undefined,
      });
      setRows((prev) => prev.map((r) => r._id === id ? { ...r, _isDirty: false, _savedFlash: true } : r));
      setTimeout(() => setRows((prev) => prev.map((r) => r._id === id ? { ...r, _savedFlash: false } : r)), 900);
    } finally { setSavingId(null); }
  };

  const saveAddingRow = async () => {
    if (!addingRow.workGroupId || !addingRow.jobDescription) return;
    setAddingSaving(true);
    try {
      const isLumpsum = addingRow.pricingType === 'lumpsum';
      await onAdd({
        workGroupId: addingRow.workGroupId,
        location: addingRow.location || undefined,
        jobDescription: addingRow.jobDescription,
        description: addingRow.description || undefined,
        quantity: parseFloat(addingRow.quantity) || 1,
        unit: addingRow.unit,
        salesUnitPrice: parseFloat(addingRow.salesUnitPrice) || 0,
        supplierUnitPrice: parseFloat(addingRow.supplierUnitPrice) || 0,
        pricingType: addingRow.pricingType,
        lumpSumPrice: isLumpsum ? parseFloat(addingRow.lumpSumPrice) || 0 : undefined,
        damageCategory: addingRow.damageCategory,
        damageTypeId: addingRow.damageTypeId || undefined,
      });
      setAddingRow(emptyRow());
      setAddingDirty(false);
      setAddingSubGroups([]);
    } finally { setAddingSaving(false); }
  };

  const COLS = ['damageCategory', 'location', 'workGroup', 'jobDescription', 'description', 'quantity', 'unit', 'salesUnitPrice', ...(viewMode === 'internal' ? ['supplierUnitPrice'] : []), 'total'];

  // Zam Oranı Uygula
  const handleApplyZamOrani = async () => {
    const pct = parseFloat(zamOraniInput.replace(',', '.'));
    if (isNaN(pct) || pct === 0) return;
    const multiplier = 1 + pct / 100;
    // Undo snapshot
    setZamOraniUndoSnapshot(rows.map((r) => ({ id: r._id, salesUnitPrice: r.salesUnitPrice, supplierUnitPrice: r.supplierUnitPrice })));
    setZamApplying(true);
    try {
      for (const row of rows) {
        const newSales = ((parseFloat(row.salesUnitPrice) || 0) * multiplier);
        const newSupplier = ((parseFloat(row.supplierUnitPrice) || 0) * multiplier);
        const salesStr = String(Math.round(newSales * 100) / 100);
        const supplierStr = String(Math.round(newSupplier * 100) / 100);
        await onSave(row._id, {
          workGroupId: row.workGroupId || undefined,
          location: row.location || undefined,
          jobDescription: row.jobDescription,
          description: row.description || undefined,
          quantity: parseFloat(row.quantity) || 1,
          unit: row.unit,
          salesUnitPrice: parseFloat(salesStr),
          supplierUnitPrice: parseFloat(supplierStr),
          pricingType: row.pricingType,
          lumpSumPrice: row.pricingType === 'lumpsum' ? parseFloat(row.lumpSumPrice) || 0 : undefined,
          damageCategory: row.damageCategory,
          damageTypeId: row.damageTypeId || undefined,
        });
      }
    } finally {
      setZamApplying(false);
    }
  };

  const handleUndoZamOrani = async () => {
    if (!zamOraniUndoSnapshot) return;
    setZamApplying(true);
    try {
      for (const snap of zamOraniUndoSnapshot) {
        const row = rows.find((r) => r._id === snap.id);
        if (!row) continue;
        await onSave(snap.id, {
          workGroupId: row.workGroupId || undefined,
          location: row.location || undefined,
          jobDescription: row.jobDescription,
          description: row.description || undefined,
          quantity: parseFloat(row.quantity) || 1,
          unit: row.unit,
          salesUnitPrice: parseFloat(snap.salesUnitPrice) || 0,
          supplierUnitPrice: parseFloat(snap.supplierUnitPrice) || 0,
          pricingType: row.pricingType,
          lumpSumPrice: row.pricingType === 'lumpsum' ? parseFloat(row.lumpSumPrice) || 0 : undefined,
          damageCategory: row.damageCategory,
          damageTypeId: row.damageTypeId || undefined,
        });
      }
      setZamOraniUndoSnapshot(null);
      setZamOraniInput('');
    } finally {
      setZamApplying(false);
    }
  };

  const getCellTabIndex = (rowIdx: number | 'new', col: string) => {
    const colIdx = COLS.indexOf(col);
    const rIdx = rowIdx === 'new' ? rows.length : rowIdx as number;
    return rIdx * COLS.length + colIdx + 1;
  };

  const focusCell = (rowIdx: number | 'new', col: string) => {
    const cellKey = rowIdx === 'new' ? `new-${col}` : `${rowIdx}-${col}`;
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${cellKey}"]`);
    el?.focus();
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIdx: number | 'new', col: string, rowId?: string) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (rowId) revertRow(rowId);
      (e.target as HTMLElement).blur();
      return;
    }

    const editableCOLS = COLS.filter((c) => c !== 'total');
    const colIdx = editableCOLS.indexOf(col);

    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowId) saveRow(rowId);
      if (rowIdx === 'new') saveAddingRow();
      // Enter: sağdaki sütuna geç; son sütundaysa alt satırın ilk sütununa
      if (colIdx < editableCOLS.length - 1) {
        focusCell(rowIdx, editableCOLS[colIdx + 1]);
      } else if (rowIdx !== 'new') {
        const nextRowIdx = (rowIdx as number) + 1;
        if (nextRowIdx < rows.length) focusCell(nextRowIdx, editableCOLS[0]);
        else focusCell('new', editableCOLS[0]);
      }
      return;
    }

    if (e.key === 'ArrowRight' && !e.shiftKey) {
      const editableCOLS2 = COLS.filter((c) => c !== 'total');
      const colIdx2 = editableCOLS2.indexOf(col);
      if (colIdx2 < editableCOLS2.length - 1) {
        e.preventDefault();
        focusCell(rowIdx, editableCOLS2[colIdx2 + 1]);
      }
      return;
    }

    if (e.key === 'ArrowLeft' && !e.shiftKey) {
      const editableCOLS2 = COLS.filter((c) => c !== 'total');
      const colIdx2 = editableCOLS2.indexOf(col);
      if (colIdx2 > 0) {
        e.preventDefault();
        focusCell(rowIdx, editableCOLS2[colIdx2 - 1]);
      }
      return;
    }

    if (e.key === 'ArrowDown' && rowIdx !== 'new') {
      e.preventDefault();
      const nextRowIdx = (rowIdx as number) + 1;
      if (nextRowIdx < rows.length) focusCell(nextRowIdx, col);
      else focusCell('new', col);
      return;
    }

    if (e.key === 'ArrowUp' && rowIdx !== 'new') {
      e.preventDefault();
      const prevRowIdx = (rowIdx as number) - 1;
      if (prevRowIdx >= 0) focusCell(prevRowIdx, col);
      return;
    }

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift+Tab: önceki hücre
        if (colIdx > 0) {
          e.preventDefault();
          focusCell(rowIdx, editableCOLS[colIdx - 1]);
        } else if (rowIdx !== 'new' && (rowIdx as number) > 0) {
          e.preventDefault();
          focusCell((rowIdx as number) - 1, editableCOLS[editableCOLS.length - 1]);
        }
      } else {
        // Tab: sonraki hücre; son kolonda alt satıra geç
        if (colIdx < editableCOLS.length - 1) {
          e.preventDefault();
          focusCell(rowIdx, editableCOLS[colIdx + 1]);
        } else if (rowIdx !== 'new') {
          e.preventDefault();
          const nextRowIdx = (rowIdx as number) + 1;
          if (nextRowIdx < rows.length) focusCell(nextRowIdx, editableCOLS[0]);
          else focusCell('new', editableCOLS[0]);
        }
      }
    }
  };

  const cellCls = (rowIdx: number | 'new', col: string, editable: boolean) => {
    const isActive = activeCell?.rowIdx === rowIdx && activeCell?.col === col;
    const base = 'w-full h-10 px-2 text-xs bg-transparent outline-none border-0';
    const activeCls = isActive && editable ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/40 rounded' : '';
    const readonlyCls = !editable ? 'text-slate-400 cursor-default select-none' : 'text-slate-800';
    return `${base} ${activeCls} ${readonlyCls}`;
  };

  const tdCls = (rowIdx: number | 'new', col: string) => {
    const isActive = activeCell?.rowIdx === rowIdx && activeCell?.col === col;
    return `border-r border-slate-100 last:border-r-0 ${isActive ? 'bg-blue-50/20' : ''}`;
  };

  const calcTotal = (row: RowState) => {
    if (row.pricingType === 'lumpsum') return parseFloat(row.lumpSumPrice || '0');
    return (parseFloat(row.quantity || '0') || 0) * (parseFloat(row.salesUnitPrice || '0') || 0);
  };

  return (
    <>
    {/* Zam Oranı Toolbar */}
    {isEditable && rows.length > 0 && (
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Revize Et:</span>
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <span className="text-xs text-slate-400">%</span>
          <input
            type="number"
            value={zamOraniInput}
            onChange={(e) => setZamOraniInput(e.target.value)}
            placeholder="15"
            className="w-14 text-xs outline-none bg-transparent text-slate-800"
            min="0"
            max="999"
            step="0.1"
          />
        </div>
        <button
          type="button"
          disabled={zamApplying || !zamOraniInput || parseFloat(zamOraniInput.replace(',', '.')) === 0}
          onClick={handleApplyZamOrani}
          className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {zamApplying ? 'Uygulanıyor...' : 'Revize Et'}
        </button>
        {zamOraniUndoSnapshot && (
          <button
            type="button"
            disabled={zamApplying}
            onClick={handleUndoZamOrani}
            className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            ↩ Geri Al
          </button>
        )}
      </div>
    )}
    <div ref={tableRef} className="overflow-x-auto rounded-lg border border-slate-200">
      <style>{`
        @keyframes savedFlash {
          0% { background-color: #dcfce7; }
          100% { background-color: transparent; }
        }
        .saved-flash { animation: savedFlash 0.9s ease-out forwards; }
      `}</style>
      <table className="w-full text-xs border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {isEditable && <th className="w-8 px-2 py-2 text-center text-slate-400 font-medium border-r border-slate-100">#</th>}
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 w-20">Kategori</th>
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 min-w-[90px]">Mahal/Bölge</th>
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 min-w-[120px]">İş Grubu</th>
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 min-w-[160px]">İş Tanımı</th>
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 min-w-[140px]">Açıklama <span className="text-red-500">*</span></th>
            <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-20">Miktar</th>
            <th className="px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-100 w-20">Birim</th>
            <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-24">Satış Fiyatı</th>
            {viewMode === 'internal' && (
              <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-24">
                <span title="Tedarikçi Fiyatı" className="cursor-help underline decoration-dashed underline-offset-2">Tdr Fiyatı</span>
              </th>
            )}
            <th className="px-2 py-2 text-right text-slate-500 font-medium w-28">Toplam</th>
            {isEditable && <th className="w-8 border-l border-slate-100"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIdx) => {
            const total = calcTotal(row);
            const isSaving = savingId === row._id;
            const wgName = workGroups.find((wg: any) => wg.id === row.workGroupId)?.name ?? '';
            const rowSubGroups = subGroups[row.workGroupId] ?? null;
            const hasSubs = rowSubGroups && rowSubGroups.length > 0;
            const supplierVal = parseFloat(row.supplierUnitPrice) || 0;
            const salesVal = parseFloat(row.salesUnitPrice) || 0;
            const isLoss = viewMode === 'internal' && supplierVal > 0 && supplierVal > salesVal;
            return (
              <tr key={row._id} className={`group transition-colors ${row._savedFlash ? 'saved-flash' : rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/10 ${row._isDirty ? 'border-l-2 border-l-amber-400' : ''}`}>
                {isEditable && (
                  <td className="w-8 px-1 text-center border-r border-slate-100">
                    <span className="text-slate-300 text-xs">{rowIdx + 1}</span>
                  </td>
                )}
                {/* Hasar Kategorisi */}
                <td className={tdCls(rowIdx, 'damageCategory')}>
                  {isEditable ? (
                    <select
                      data-cell={`${rowIdx}-damageCategory`}
                      className={cellCls(rowIdx, 'damageCategory', true)}
                      value={row.damageCategory}
                      tabIndex={getCellTabIndex(rowIdx, 'damageCategory')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'damageCategory' })}
                      onBlur={() => { setActiveCell(null); saveRow(row._id); }}
                      onChange={(e) => {
                        updateRow(row._id, 'damageCategory', e.target.value);
                        updateRow(row._id, 'workGroupId', '');
                        updateRow(row._id, 'jobDescription', '');
                      }}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'damageCategory', row._id)}
                    >
                      <option value="bina">Bina</option>
                      <option value="esya">Eşya</option>
                    </select>
                  ) : (
                    <span className={`px-2 text-xs block py-3 font-medium ${row.damageCategory === 'esya' ? 'text-teal-700' : 'text-orange-700'}`}>
                      {row.damageCategory === 'esya' ? 'Eşya' : 'Bina'}
                    </span>
                  )}
                </td>
                {/* Mahal/Bölge */}
                <td className={tdCls(rowIdx, 'location')}>
                  {isEditable ? (
                    <LocationSelector
                      data-cell={`${rowIdx}-location`}
                      className={cellCls(rowIdx, 'location', true)}
                      value={row.location}
                      locations={locationList}
                      onSelect={(v) => { updateRow(row._id, 'location', v); setTimeout(() => saveRow(row._id), 50); }}
                      onAddNew={addLocationIfNew}
                      tabIndex={getCellTabIndex(rowIdx, 'location')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'location' })}
                      onBlur={() => { setActiveCell(null); saveRow(row._id); }}
                      onKeyDown={(e) => handleCellKeyDown(e as React.KeyboardEvent<HTMLInputElement>, rowIdx, 'location', row._id)}
                    />
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.location || '—'}</span>
                  )}
                </td>
                {/* İş Grubu */}
                <td className={tdCls(rowIdx, 'workGroup')}>
                  {isEditable ? (
                    <select
                      data-cell={`${rowIdx}-workGroup`}
                      className={cellCls(rowIdx, 'workGroup', true)}
                      value={row.workGroupId}
                      tabIndex={getCellTabIndex(rowIdx, 'workGroup')}
                      onFocus={() => { setActiveCell({ rowIdx, col: 'workGroup' }); loadSubGroups(row.workGroupId); }}
                      onBlur={() => { setActiveCell(null); saveRow(row._id); }}
                      onChange={(e) => {
                        updateRow(row._id, 'workGroupId', e.target.value);
                        updateRow(row._id, 'jobDescription', '');
                        updateRow(row._id, 'unit', 'm²');
                        loadSubGroups(e.target.value);
                      }}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'workGroup', row._id)}
                    >
                      <option value="">—</option>
                      {filterWorkGroupsByCategory(workGroups, row.damageCategory).map((wg: any) => <option key={wg.id} value={wg.id}>{wg.name}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{wgName || '—'}</span>
                  )}
                </td>
                {/* İş Tanımı — sub-group varsa dropdown + inline yeni ekleme */}
                <td className={tdCls(rowIdx, 'jobDescription')}>
                  {isEditable ? (
                    hasSubs ? (
                      <WorkDefinitionSelector
                        data-cell={`${rowIdx}-jobDescription`}
                        className={`${cellCls(rowIdx, 'jobDescription', true)} font-medium`}
                        value={row.jobDescription}
                        subGroups={rowSubGroups!}
                        workGroupId={row.workGroupId}
                        tabIndex={getCellTabIndex(rowIdx, 'jobDescription')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'jobDescription' })}
                        onBlur={() => { setActiveCell(null); saveRow(row._id); }}
                        onSelect={(v, unit) => {
                          updateRow(row._id, 'jobDescription', v);
                          if (unit) updateRow(row._id, 'unit', unit);
                        }}
                        onAddNew={createSubGroup}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'jobDescription', row._id)}
                      />
                    ) : (
                      <input
                        data-cell={`${rowIdx}-jobDescription`}
                        className={`${cellCls(rowIdx, 'jobDescription', true)} font-medium`}
                        value={row.jobDescription}
                        placeholder="İş tanımı..."
                        tabIndex={getCellTabIndex(rowIdx, 'jobDescription')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'jobDescription' })}
                        onBlur={() => { setActiveCell(null); const tv = toTitleCaseTR(row.jobDescription.trim()); if (tv !== row.jobDescription) updateRow(row._id, 'jobDescription', tv); saveRow(row._id); }}
                        onChange={(e) => updateRow(row._id, 'jobDescription', e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'jobDescription', row._id)}
                      />
                    )
                  ) : (
                    <span className="px-2 text-xs font-medium text-slate-800 block py-3">{row.jobDescription || '—'}</span>
                  )}
                </td>
                {/* Açıklama */}
                <td className={`${tdCls(rowIdx, 'description')} ${descriptionErrors.has(row._id) ? 'bg-red-50/30' : ''}`}>
                  {isEditable ? (
                    <input
                      data-cell={`${rowIdx}-description`}
                      className={`${cellCls(rowIdx, 'description', true)} ${descriptionErrors.has(row._id) ? 'placeholder:text-red-400' : ''}`}
                      value={row.description}
                      placeholder={descriptionErrors.has(row._id) ? 'Zorunlu alan!' : 'Açıklama...'}
                      tabIndex={getCellTabIndex(rowIdx, 'description')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'description' })}
                      onBlur={() => {
                        setActiveCell(null);
                        const titleVal = toTitleCaseTR(row.description.trim());
                        if (titleVal !== row.description) updateRow(row._id, 'description', titleVal);
                        if (!row.description.trim()) {
                          setDescriptionErrors((prev) => new Set([...prev, row._id]));
                        } else {
                          setDescriptionErrors((prev) => { const n = new Set(prev); n.delete(row._id); return n; });
                          saveRow(row._id);
                        }
                      }}
                      onChange={(e) => {
                        updateRow(row._id, 'description', e.target.value);
                        if (e.target.value.trim()) setDescriptionErrors((prev) => { const n = new Set(prev); n.delete(row._id); return n; });
                      }}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'description', row._id)}
                    />
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.description || '—'}</span>
                  )}
                </td>
                {/* Miktar — CalcInput */}
                <td className={`${tdCls(rowIdx, 'quantity')} text-right`}>
                  {isEditable ? (
                    <div className="flex items-center w-full">
                      <CalcInput
                        data-cell={`${rowIdx}-quantity`}
                        className={`${cellCls(rowIdx, 'quantity', true)} text-right flex-1`}
                        value={row.quantity}
                        onChange={(v) => updateRow(row._id, 'quantity', v)}
                        onCommit={() => setTimeout(() => saveRow(row._id), 50)}
                        tabIndex={getCellTabIndex(rowIdx, 'quantity')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'quantity' })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'quantity', row._id)}
                      />
                      <button
                        type="button"
                        title="Metraj Hesaplama Asistanı"
                        onClick={() => setMetrajModalRowId(row._id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5"
                      >
                        📐
                      </button>
                    </div>
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3 text-right">{row.quantity}</span>
                  )}
                </td>
                {/* Birim */}
                <td className={tdCls(rowIdx, 'unit')}>
                  {isEditable ? (
                    <select
                      data-cell={`${rowIdx}-unit`}
                      className={cellCls(rowIdx, 'unit', true)}
                      value={row.unit}
                      tabIndex={getCellTabIndex(rowIdx, 'unit')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'unit' })}
                      onBlur={() => { setActiveCell(null); saveRow(row._id); }}
                      onChange={(e) => updateRow(row._id, 'unit', e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'unit', row._id)}
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.unit}</span>
                  )}
                </td>
                {/* Satış Fiyatı — CalcInput */}
                <td className={`${tdCls(rowIdx, 'salesUnitPrice')} text-right ${isLoss ? 'bg-red-50/30' : ''}`}>
                  {isEditable ? (
                    <div className="relative flex items-center">
                      <CalcInput
                        data-cell={`${rowIdx}-salesUnitPrice`}
                        className={`${cellCls(rowIdx, 'salesUnitPrice', true)} text-right pr-10 ${isLoss ? '!ring-2 !ring-inset !ring-red-400 !rounded' : ''}`}
                        value={row.salesUnitPrice}
                        onChange={(v) => updateRow(row._id, 'salesUnitPrice', v)}
                        onCommit={() => setTimeout(() => saveRow(row._id), 50)}
                        tabIndex={getCellTabIndex(rowIdx, 'salesUnitPrice')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'salesUnitPrice' })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'salesUnitPrice', row._id)}
                      />
                      <div className="absolute right-1 flex items-center gap-0.5 pointer-events-none">
                        {isLoss && <span title="Tedarikçi fiyatı satış fiyatından yüksek — bu kalemde zarar var" className="text-red-500 pointer-events-auto cursor-help text-xs">⚠</span>}
                        <span className="text-[10px] font-medium text-slate-400 select-none">TL.</span>
                      </div>
                    </div>
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3 text-right">{fmtCurrency(parseFloat(row.salesUnitPrice))}</span>
                  )}
                </td>
                {/* TDR (Tedarikçi Fiyatı, internal only) — CalcInput */}
                {viewMode === 'internal' && (
                  <td className={`${tdCls(rowIdx, 'supplierUnitPrice')} text-right ${isLoss ? 'bg-red-50/30' : ''}`}>
                    {isEditable ? (
                      <div className="relative flex items-center">
                        <CalcInput
                          data-cell={`${rowIdx}-supplierUnitPrice`}
                          className={`${cellCls(rowIdx, 'supplierUnitPrice', true)} text-right pr-8 text-slate-500 ${isLoss ? '!ring-2 !ring-inset !ring-orange-400 !rounded' : ''}`}
                          value={row.supplierUnitPrice}
                          onChange={(v) => updateRow(row._id, 'supplierUnitPrice', v)}
                          onCommit={() => setTimeout(() => saveRow(row._id), 50)}
                          tabIndex={getCellTabIndex(rowIdx, 'supplierUnitPrice')}
                          onFocus={() => setActiveCell({ rowIdx, col: 'supplierUnitPrice' })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'supplierUnitPrice', row._id)}
                        />
                        <span className="absolute right-2 text-[10px] font-medium text-slate-400 pointer-events-none select-none">TL.</span>
                      </div>
                    ) : (
                      <span className="px-2 text-xs text-slate-500 block py-3 text-right">{fmtCurrency(parseFloat(row.supplierUnitPrice))}</span>
                    )}
                  </td>
                )}
                {/* Toplam (read-only, computed) */}
                <td className="px-2 py-3 text-right border-l border-slate-100">
                  {isSaving ? (
                    <span className="text-slate-300 text-xs">...</span>
                  ) : (
                    <span className={`text-xs font-semibold ${row._isDirty ? 'text-amber-600' : 'text-slate-800'}`}>
                      {fmtCurrency(total)}
                    </span>
                  )}
                </td>
                {isEditable && (
                  <td className="w-8 border-l border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => onDelete(row._id)}
                      className="transition-opacity w-6 h-6 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center mx-auto"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5.5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}

          {/* Yeni Kalem Satırı */}
          {isEditable && (
            <tr className={`bg-blue-50/20 border-t-2 border-blue-100 ${addingDirty ? 'border-l-2 border-l-blue-400' : ''}`}>
              <td className="w-8 px-1 text-center border-r border-slate-100">
                <span className="text-blue-300 text-xs">+</span>
              </td>
              {/* Hasar Kategorisi */}
              <td className={tdCls('new', 'damageCategory')}>
                <select
                  data-cell="new-damageCategory"
                  className={cellCls('new', 'damageCategory', true)}
                  value={addingRow.damageCategory}
                  tabIndex={getCellTabIndex('new', 'damageCategory')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'damageCategory' })}
                  onBlur={() => setActiveCell(null)}
                  onChange={(e) => { setAddingRow((p) => ({ ...p, damageCategory: e.target.value as 'bina' | 'esya', workGroupId: '', jobDescription: '' })); setAddingDirty(true); }}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'damageCategory')}
                >
                  <option value="bina">Bina</option>
                  <option value="esya">Eşya</option>
                </select>
              </td>
              {/* Mahal/Bölge */}
              <td className={tdCls('new', 'location')}>
                <LocationSelector
                  data-cell="new-location"
                  className={cellCls('new', 'location', true)}
                  value={addingRow.location}
                  locations={locationList}
                  onSelect={(v) => { setAddingRow((p) => ({ ...p, location: v })); setAddingDirty(true); }}
                  onAddNew={addLocationIfNew}
                  tabIndex={getCellTabIndex('new', 'location')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'location' })}
                  onBlur={() => setActiveCell(null)}
                  onKeyDown={(e) => handleCellKeyDown(e as React.KeyboardEvent<HTMLInputElement>, 'new', 'location')}
                />
              </td>
              {/* İş Grubu */}
              <td className={tdCls('new', 'workGroup')}>
                <select
                  data-cell="new-workGroup"
                  className={cellCls('new', 'workGroup', true)}
                  value={addingRow.workGroupId}
                  tabIndex={getCellTabIndex('new', 'workGroup')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'workGroup' })}
                  onBlur={() => setActiveCell(null)}
                  onChange={(e) => {
                    setAddingRow((p) => ({ ...p, workGroupId: e.target.value, jobDescription: '', unit: 'm²' }));
                    setAddingDirty(true);
                    loadAddingSubGroups(e.target.value);
                  }}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'workGroup')}
                >
                  <option value="">— Seç —</option>
                  {filterWorkGroupsByCategory(workGroups, addingRow.damageCategory).map((wg: any) => <option key={wg.id} value={wg.id}>{wg.name}</option>)}
                </select>
              </td>
              {/* İş Tanımı — sub-group varsa dropdown + inline yeni ekleme */}
              <td className={tdCls('new', 'jobDescription')}>
                {addingSubGroups.length > 0 ? (
                  <WorkDefinitionSelector
                    data-cell="new-jobDescription"
                    className={`${cellCls('new', 'jobDescription', true)} font-medium placeholder:font-normal`}
                    value={addingRow.jobDescription}
                    subGroups={addingSubGroups}
                    workGroupId={addingRow.workGroupId}
                    tabIndex={getCellTabIndex('new', 'jobDescription')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'jobDescription' })}
                    onBlur={() => setActiveCell(null)}
                    onSelect={(v, unit) => {
                      setAddingRow((p) => ({ ...p, jobDescription: v, unit: unit ?? p.unit }));
                      setAddingDirty(true);
                    }}
                    onAddNew={createSubGroup}
                    onKeyDown={(e) => handleCellKeyDown(e, 'new', 'jobDescription')}
                  />
                ) : (
                  <input
                    data-cell="new-jobDescription"
                    className={`${cellCls('new', 'jobDescription', true)} font-medium placeholder:font-normal`}
                    value={addingRow.jobDescription}
                    placeholder="İş tanımı yazın..."
                    tabIndex={getCellTabIndex('new', 'jobDescription')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'jobDescription' })}
                    onBlur={() => { setActiveCell(null); const tv = toTitleCaseTR(addingRow.jobDescription.trim()); if (tv !== addingRow.jobDescription) setAddingRow((p) => ({ ...p, jobDescription: tv })); }}
                    onChange={(e) => { setAddingRow((p) => ({ ...p, jobDescription: e.target.value })); setAddingDirty(true); }}
                    onKeyDown={(e) => handleCellKeyDown(e, 'new', 'jobDescription')}
                  />
                )}
              </td>
              {/* Açıklama */}
              <td className={tdCls('new', 'description')}>
                <input
                  data-cell="new-description"
                  className={`${cellCls('new', 'description', true)} ${addingDirty && !addingRow.description.trim() ? 'placeholder:text-red-400' : ''}`}
                  value={addingRow.description}
                  placeholder={addingDirty && !addingRow.description.trim() ? 'Zorunlu!' : 'Açıklama...'}
                  tabIndex={getCellTabIndex('new', 'description')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'description' })}
                  onBlur={() => { setActiveCell(null); const tv = toTitleCaseTR(addingRow.description.trim()); if (tv !== addingRow.description) setAddingRow((p) => ({ ...p, description: tv })); }}
                  onChange={(e) => { setAddingRow((p) => ({ ...p, description: e.target.value })); setAddingDirty(true); }}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'description')}
                />
              </td>
              {/* Miktar — CalcInput */}
              <td className={`${tdCls('new', 'quantity')} text-right`}>
                <div className="flex items-center w-full">
                  <CalcInput
                    data-cell="new-quantity"
                    className={`${cellCls('new', 'quantity', true)} text-right flex-1`}
                    value={addingRow.quantity}
                    onChange={(v) => { setAddingRow((p) => ({ ...p, quantity: v })); setAddingDirty(true); }}
                    onCommit={() => {}}
                    tabIndex={getCellTabIndex('new', 'quantity')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'quantity' })}
                    onKeyDown={(e) => handleCellKeyDown(e, 'new', 'quantity')}
                  />
                  <button
                    type="button"
                    title="Metraj Hesaplama Asistanı"
                    onClick={() => setMetrajModalRowId('new')}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-0.5"
                  >
                    📐
                  </button>
                </div>
              </td>
              {/* Birim */}
              <td className={tdCls('new', 'unit')}>
                <select
                  data-cell="new-unit"
                  className={cellCls('new', 'unit', true)}
                  value={addingRow.unit}
                  tabIndex={getCellTabIndex('new', 'unit')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'unit' })}
                  onBlur={() => setActiveCell(null)}
                  onChange={(e) => { setAddingRow((p) => ({ ...p, unit: e.target.value })); setAddingDirty(true); }}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'unit')}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              {/* Satış Fiyatı — CalcInput */}
              <td className={`${tdCls('new', 'salesUnitPrice')} text-right`}>
                <div className="relative flex items-center">
                  <CalcInput
                    data-cell="new-salesUnitPrice"
                    className={`${cellCls('new', 'salesUnitPrice', true)} text-right pr-8`}
                    value={addingRow.salesUnitPrice}
                    onChange={(v) => { setAddingRow((p) => ({ ...p, salesUnitPrice: v })); setAddingDirty(true); }}
                    onCommit={() => {}}
                    tabIndex={getCellTabIndex('new', 'salesUnitPrice')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'salesUnitPrice' })}
                    onKeyDown={(e) => handleCellKeyDown(e, 'new', 'salesUnitPrice')}
                  />
                  <span className="absolute right-2 text-[10px] font-medium text-slate-400 pointer-events-none select-none">TL.</span>
                </div>
              </td>
              {/* TDR (Tedarikçi Fiyatı) — CalcInput */}
              {viewMode === 'internal' && (
                <td className={`${tdCls('new', 'supplierUnitPrice')} text-right`}>
                  <div className="relative flex items-center">
                    <CalcInput
                      data-cell="new-supplierUnitPrice"
                      className={`${cellCls('new', 'supplierUnitPrice', true)} text-right pr-8 text-slate-500`}
                      value={addingRow.supplierUnitPrice}
                      onChange={(v) => { setAddingRow((p) => ({ ...p, supplierUnitPrice: v })); setAddingDirty(true); }}
                      onCommit={() => {}}
                      tabIndex={getCellTabIndex('new', 'supplierUnitPrice')}
                      onFocus={() => setActiveCell({ rowIdx: 'new', col: 'supplierUnitPrice' })}
                      onKeyDown={(e) => handleCellKeyDown(e, 'new', 'supplierUnitPrice')}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-slate-400 pointer-events-none select-none">TL.</span>
                  </div>
                </td>
              )}
              {/* Toplam preview */}
              <td className="px-2 py-3 text-right border-l border-slate-100">
                {addingDirty && (
                  <span className="text-xs text-blue-600 font-semibold">
                    {fmtCurrency(calcTotal(addingRow))}
                  </span>
                )}
              </td>
              {/* Ekle butonu */}
              <td className="w-8 border-l border-slate-100 text-center">
                {addingDirty && (
                  <button
                    type="button"
                    disabled={addingSaving || !addingRow.workGroupId || !addingRow.jobDescription}
                    onClick={saveAddingRow}
                    className="w-6 h-6 rounded bg-blue-600 text-white text-xs font-bold flex items-center justify-center mx-auto hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    title="Ekle (Enter)"
                  >
                    {addingSaving ? '...' : '✓'}
                  </button>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && !isEditable && (
        <div className="text-center py-8 text-slate-400 text-sm">Henüz Kalem Eklenmemiş.</div>
      )}
    </div>

    {/* Zarar Uyarısı */}
    {(() => {
      const lossCount = rows.filter((r) => {
        const sup = parseFloat(r.supplierUnitPrice || '0');
        const sal = parseFloat(r.salesUnitPrice || '0');
        return sup > 0 && sup > sal;
      }).length;
      if (lossCount === 0) return null;
      return (
        <div className="mt-2 flex items-center gap-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-sm">⚠</span>
          <span className="text-xs font-medium">{lossCount} kalemde zarar: Tedarikçi fiyatı satış fiyatından yüksek</span>
        </div>
      );
    })()}

    {/* Metraj Hesaplama Modal */}
    {metrajModalRowId !== null && (
      <MetrajHesaplamaModal
        onClose={() => setMetrajModalRowId(null)}
        location={
          metrajModalRowId === 'new'
            ? addingRow.location || undefined
            : rows.find((r) => r._id === metrajModalRowId)?.location || undefined
        }
        onAktar={(deger) => {
          if (metrajModalRowId === 'new') {
            setAddingRow((p) => ({ ...p, quantity: deger }));
            setAddingDirty(true);
          } else {
            updateRow(metrajModalRowId, 'quantity', deger);
            setTimeout(() => saveRow(metrajModalRowId), 50);
          }
        }}
      />
    )}
    </>
  );
}

// KalemForm ve KalemKarti kaldırıldı — EditableItemsTable ile değiştirildi.

// ─── Acil Yardım Rapor Editörü ────────────────────────────────────────────────
function EmergencyReportEditor({
  report,
  reportId,
  claimId,
  workGroups,
  onReload,
}: {
  report: any;
  reportId: string;
  claimId: string;
  workGroups: any[];
  onReload: () => void;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const findingsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const claimPath = `/panel/hasar-dosyalari/${claimId}`;

  const isEditable = report.status === 'draft' || report.status === 'rejected';

  const totalSupplierCost = report.items?.reduce((s: number, i: any) => s + (i.supplierTotal ?? 0), 0) ?? 0;
  const totalSalesAmount = report.items?.reduce((s: number, i: any) => s + (i.salesTotal ?? 0), 0) ?? 0;
  const grossProfit = totalSalesAmount - totalSupplierCost;
  const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;

  const handleAddItem = async (data: any) => {
    await axios.post(`${API}/repair-reports/${reportId}/items`, data, { headers: authHeader() });
    onReload();
  };

  const handleUpdateItem = async (itemId: string, data: any) => {
    await axios.put(`${API}/repair-report-items/${itemId}`, data, { headers: authHeader() });
    onReload();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Bu kalemi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/repair-report-items/${itemId}`, { headers: authHeader() });
      onReload();
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'damage');
        await axios.post(`${API}/repair-reports/${reportId}/images`, fd, { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } });
      }
      onReload();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      console.error(err);
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await axios.delete(`${API}/report-images/${imageId}`, { headers: authHeader() });
      onReload();
    } catch (e) { console.error(e); }
  };

  const handleDownloadPdf = async (view: 'internal' | 'external') => {
    try {
      const res = await axios.get(`${API}/repair-reports/${reportId}/pdf?view=${view}`, { headers: authHeader(), responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `acil-yardim-raporu-${reportId}-${view}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const handleSubmitReport = async () => {
    if (!confirm('Raporu sunmak istediğinizden emin misiniz?')) return;
    try {
      await axios.post(`${API}/repair-reports/${reportId}/submit`, {}, { headers: authHeader() });
      onReload();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => router.push(claimPath)} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{report.reportNo}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Acil Yardım</span>
            <span className="text-xs text-slate-400">{new Date(report.reportDate ?? report.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <Badge
          text={report.status === 'draft' ? 'Taslak' : 'Sunuldu'}
          color={report.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}
        />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Müşteri Görünümü / Tam Görünüm toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setViewMode('internal')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'internal' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="TDR, Marj ve Kâr sütunları görünür (şirket içi kullanım)"
            >
              Tam Görünüm
            </button>
            <button
              type="button"
              onClick={() => setViewMode('external')}
              className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${viewMode === 'external' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="TDR, Marj ve Kâr gizli — müşteriye gösterilecek görünüm"
            >
              Müşteri Görünümü
            </button>
          </div>
          <button type="button" onClick={() => handleDownloadPdf('external')} className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1" title="Müşteri PDF&apos;i — TDR/Marj/Kâr gizli">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            PDF (Müşteri)
          </button>
          {viewMode === 'internal' && <button type="button" onClick={() => handleDownloadPdf('internal')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1" title="İç PDF — TDR/Marj/Kâr dahil">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            PDF (İç)
          </button>}
          {isEditable && <button type="button" onClick={handleSubmitReport} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">Sun</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Sol: Ana içerik */}
        <div className="col-span-2 space-y-5">

          {/* Rapor Bilgileri */}
          <SectionCard title="Rapor Bilgileri">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Bulgular</label>
                <div className="relative">
                  <textarea
                    ref={findingsTextareaRef}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-12 text-base font-bold italic bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y min-h-[72px] placeholder:font-normal placeholder:not-italic placeholder:text-sm"
                    rows={3}
                    defaultValue={report.findingsText ?? ''}
                    disabled={!isEditable}
                    onBlur={(e) => {
                      if (e.target.value !== (report.findingsText ?? '')) {
                        axios.put(`${API}/repair-reports/${reportId}`, { findingsText: e.target.value }, { headers: authHeader() });
                      }
                    }}
                  />
                  {isEditable && (
                    <div className="absolute bottom-2 right-2">
                      <SpeechToText
                        size="sm"
                        onTranscript={(text) => {
                          const el = findingsTextareaRef.current;
                          if (!el) return;
                          el.value = el.value ? el.value + ' ' + text : text;
                          el.dispatchEvent(new Event('input', { bubbles: true }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* İş Kalemleri */}
          <SectionCard title="İş Kalemleri">
            <EditableItemsTable
              items={report.items ?? []}
              workGroups={workGroups}
              damageTypes={[]}
              reportType={report.reportType ?? 'emergency'}
              isEditable={isEditable}
              viewMode={viewMode}
              onSave={handleUpdateItem}
              onDelete={handleDeleteItem}
              onAdd={handleAddItem}
            />
          </SectionCard>

          {/* Fotoğraflar */}
          <SectionCard
            title="Fotoğraflar"
            action={
              isEditable ? (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className={`text-xs text-white px-3 py-1.5 rounded-lg ${uploading ? 'bg-slate-400 cursor-wait' : 'bg-slate-600 hover:bg-slate-700'}`}>{uploading ? 'Yükleniyor...' : '+ Fotoğraf'}</button>
                </>
              ) : undefined
            }
          >
            {!report.images?.length ? (
              <div className="text-center py-6 text-slate-400 text-sm">Fotoğraf Yok.</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {report.images.map((img: any) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-100">
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/uploads/report-images/${img.storageKey}`}
                      alt={img.fileName ?? img.category}
                      className="w-full h-28 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" fill="%239ca3af" font-size="12">Yüklenemedi</text></svg>'; }}
                    />
                    {isEditable && (
                      <button type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>

        {/* Sağ: Kâr Özeti Paneli */}
        <div className="col-span-1 space-y-4">

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Kâr Özeti</h4>

            {viewMode === 'internal' ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tedarikçi Maliyeti</span>
                  <span className="font-medium text-slate-800">{fmtCurrency(report.totalSupplierCost ?? totalSupplierCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Toplam Satış</span>
                  <span className="font-medium text-slate-800">{fmtCurrency(report.totalSalesAmount ?? totalSalesAmount)}</span>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Brüt Kâr</span>
                    <span className={`font-semibold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCurrency(report.grossProfit ?? grossProfit)}</span>
                  </div>
                </div>
                <div className={`rounded-xl p-4 text-center ${(report.grossMarginPct ?? grossMarginPct) < 10 ? 'bg-red-50' : (report.grossMarginPct ?? grossMarginPct) < 20 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <p className={`text-2xl font-bold ${(report.grossMarginPct ?? grossMarginPct) < 10 ? 'text-red-600' : (report.grossMarginPct ?? grossMarginPct) < 20 ? 'text-yellow-600' : 'text-green-600'}`}>
                    %{(report.grossMarginPct ?? grossMarginPct).toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Brüt Marj</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Toplam Tutar</span>
                  <span className="font-semibold text-slate-800">{fmtCurrency(report.totalSalesAmount ?? totalSalesAmount)}</span>
                </div>
                <p className="text-xs text-slate-400 text-center">Maliyet Bilgileri Gizlenmiştir</p>
              </div>
            )}

            <div className="text-xs text-slate-400 text-center border-t border-slate-50 pt-2">
              {report.items?.length ?? 0} kalem
            </div>
          </div>

          {/* Durum */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Rapor Durumu</p>
            <Badge
              text={report.status === 'draft' ? 'Taslak' : 'Sunuldu'}
              color={report.status === 'draft' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}
            />
            {isEditable && (
              <button type="button" onClick={handleSubmitReport} className="w-full mt-3 bg-emerald-600 text-white py-2 rounded-lg text-xs hover:bg-emerald-700">
                Onayla / Sun
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Sticky Bottom Bar — Emergency */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg px-6 py-3 z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
          {viewMode === 'internal' && (
            <div className="flex items-center gap-4 flex-1 flex-wrap text-sm">
              <span className="text-slate-500">Satış: <strong className="text-slate-800">{fmtCurrency(report.totalSalesAmount ?? totalSalesAmount)}</strong></span>
              <span className="text-slate-500">Kâr: <strong className={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtCurrency(report.grossProfit ?? grossProfit)}</strong></span>
            </div>
          )}
          {viewMode === 'external' && <div className="flex-1" />}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => router.push(claimPath)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              ← Geri
            </button>
            {isEditable && (
              <button type="button" onClick={handleSubmitReport}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                Onayla / Sun
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Main Report Page ──────────────────────────────────────────────────────────
export default function RepairReportPage() {
  const { id: claimId, reportId } = useParams<{ id: string; reportId: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [workGroups, setWorkGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
  const [showAnnotation, setShowAnnotation] = useState<any>(null);
  const [damageFilter, setDamageFilter] = useState<string>('all');
  const [showDamageTypeModal, setShowDamageTypeModal] = useState(false);
  const [damageTypeForm, setDamageTypeForm] = useState({ code: '', name: '' });
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showExternalApprovalModal, setShowExternalApprovalModal] = useState(false);
  const [externalApprovalForm, setExternalApprovalForm] = useState({
    approverType: 'expert' as 'expert' | 'insurance_company',
    approverName: '',
    approverEmail: '',
    approverPhone: '',
    channel: 'email' as 'email' | 'whatsapp' | 'in_app',
    expiresInHours: 72,
  });
  const [externalApprovals, setExternalApprovals] = useState<any[]>([]);
  const [sendingExternal, setSendingExternal] = useState(false);
  // Dirty state for save/cancel
  const [pendingFields, setPendingFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingCat, setUploadingCat] = useState<string | null>(null);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const bulgularTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Önerilen kalemler (şablon önerileri)
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [templateSuggestions, setTemplateSuggestions] = useState<any[]>([]);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState<Set<string>>(new Set());
  const [addingTemplateItems, setAddingTemplateItems] = useState(false);
  const [quickDamageTypes, setQuickDamageTypes] = useState<string[]>([]);
  const [quickDamageSize, setQuickDamageSize] = useState('MEDIUM');
  const [showQuickRepairModal, setShowQuickRepairModal] = useState(false);
  // claimId used for back navigation
  const claimPath = `/panel/hasar-dosyalari/${claimId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, wgRes] = await Promise.all([
        axios.get(`${API}/repair-reports/${reportId}`, { headers: authHeader() }),
        axios.get(`${API}/work-groups`, { headers: authHeader() }),
      ]);
      setReport(rRes.data.data);
      setQuickDamageTypes(rRes.data.data?.quickDamageTypes ?? []);
      setQuickDamageSize(rRes.data.data?.quickDamageSize ?? 'MEDIUM');
      setWorkGroups(wgRes.data.data || []);

      // Load approval history
      try {
        const hRes = await axios.get(`${API}/repair-reports/${reportId}/approval-history`, { headers: authHeader() });
        setApprovalHistory(hRes.data.data || []);
      } catch (_) {}

      // Load version history
      try {
        const vRes = await axios.get(`${API}/repair-reports/${reportId}/versions`, { headers: authHeader() });
        setVersions(vRes.data.data || []);
      } catch (_) {}

      // Load external approvals
      try {
        const eaRes = await axios.get(`${API}/repair-reports/${reportId}/external-approvals`, { headers: authHeader() });
        setExternalApprovals(eaRes.data.data || []);
      } catch (_) {}

      // Load current user
      try {
        const uRes = await axios.get(`${API}/auth/me`, { headers: authHeader() });
        setCurrentUser(uRes.data.data ?? uRes.data.user ?? uRes.data);
      } catch (_) {}

      // Load template suggestions based on claim lossType
      const reportData = rRes.data.data;
      const lossType = reportData?.claimFile?.lossType;
      if (lossType) {
        try {
          const stRes = await axios.get(`${API}/report-templates/suggest?serviceType=${encodeURIComponent(lossType)}`, { headers: authHeader() });
          const suggestions: any[] = stRes.data.data ?? [];
          if (suggestions.length > 0) {
            setTemplateSuggestions(suggestions);
            // Auto-open modal on first load if report is draft and has no items yet
            if (reportData.status === 'draft' && (reportData.items?.length ?? 0) === 0) {
              const allItems = suggestions.flatMap((s: any) => s.items ?? []);
              setSelectedTemplateItems(new Set(allItems.map((it: any) => it.id)));
              setShowSuggestModal(true);
            }
          }
        } catch (_) {}
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const handleRevise = async () => {
    if (!confirm('Onaylı raporun revizyonunu oluşturmak istediğinizden emin misiniz?\nEski versiyon değişmeden saklanacak, yeni bir taslak açılacak.')) return;
    try {
      const res = await axios.post(`${API}/repair-reports/${reportId}/revise`, {}, { headers: authHeader() });
      router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${res.data.data.id}`);
    } catch (e: any) { alert(e.response?.data?.message ?? 'Revizyon Oluşturulamadı'); }
  };

  const handleOpenSuggestModal = async () => {
    // Refresh suggestions when button clicked
    const lossType = report?.claimFile?.lossType;
    if (lossType && templateSuggestions.length === 0) {
      try {
        const stRes = await axios.get(`${API}/report-templates/suggest?serviceType=${encodeURIComponent(lossType)}`, { headers: authHeader() });
        const suggestions: any[] = stRes.data.data ?? [];
        setTemplateSuggestions(suggestions);
        const allItems = suggestions.flatMap((s: any) => s.items ?? []);
        setSelectedTemplateItems(new Set(allItems.map((it: any) => it.id)));
      } catch (_) {}
    } else if (templateSuggestions.length > 0 && selectedTemplateItems.size === 0) {
      const allItems = templateSuggestions.flatMap((s: any) => s.items ?? []);
      setSelectedTemplateItems(new Set(allItems.map((it: any) => it.id)));
    }
    setShowSuggestModal(true);
  };

  const handleAddSuggestedItems = async () => {
    if (selectedTemplateItems.size === 0) return;
    setAddingTemplateItems(true);
    try {
      const allItems = templateSuggestions.flatMap((s: any) => s.items ?? []);
      const toAdd = allItems.filter((it: any) => selectedTemplateItems.has(it.id));
      for (const item of toAdd) {
        await axios.post(`${API}/repair-reports/${reportId}/items`, {
          workGroupId: item.workGroupId,
          damageCategory: item.damageCategory ?? 'bina',
          location: item.location,
          jobDescription: item.jobDescription,
          description: item.description,
          quantity: item.defaultQuantity ?? 1,
          unit: item.defaultUnit ?? 'adet',
          pricingType: item.pricingType ?? 'unit',
        }, { headers: authHeader() });
      }
      setShowSuggestModal(false);
      setSelectedTemplateItems(new Set());
      load();
    } catch (e) { console.error(e); }
    finally { setAddingTemplateItems(false); }
  };

  const handleAddQuickRepairItems = async (items: SelectedRepairItem[]) => {
    await axios.post(`${API}/damage-reports/${reportId}/repair-items`, {
      damageTypes: quickDamageTypes,
      fileId: claimId,
      items: items.map((item) => ({ workSubGroupId: item.workSubGroupId, quantity: item.quantity, note: item.note })),
    }, { headers: authHeader() });
    await axios.put(`${API}/repair-reports/${reportId}`, {
      quickDamageTypes,
      quickDamageSize,
    }, { headers: authHeader() });
    await loadKeepScroll();
  };

  const handleSendExternalApproval = async () => {
    if (!externalApprovalForm.approverName && !externalApprovalForm.approverEmail && externalApprovalForm.channel !== 'in_app') {
      alert('Lütfen En Az Ad Soyad veya E-posta Giriniz'); return;
    }
    setSendingExternal(true);
    try {
      const res = await axios.post(`${API}/repair-reports/${reportId}/send-external-approval`, externalApprovalForm, { headers: authHeader() });
      const { publicUrl, whatsappUrl } = res.data.data;
      setShowExternalApprovalModal(false);
      setExternalApprovalForm({ approverType: 'expert', approverName: '', approverEmail: '', approverPhone: '', channel: 'email', expiresInHours: 72 });
      load();
      if (externalApprovalForm.channel === 'whatsapp' && whatsappUrl) {
        window.open(whatsappUrl, '_blank');
      } else {
        alert(`Dış Onay Başarıyla Gönderildi.\nOnay Linki: ${publicUrl}`);
      }
    } catch (e: any) { alert(e.response?.data?.message ?? 'Gönderim Başarısız'); }
    finally { setSendingExternal(false); }
  };

  const handleRequestApproval = async () => {
    if (!confirm('Raporu onaya göndermek istediğinizden emin misiniz?')) return;
    try {
      await axios.post(`${API}/repair-reports/${reportId}/request-approval`, {}, { headers: authHeader() });
      load();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Hata Oluştu'); }
  };

  const handleApprove = async () => {
    if (!confirm('Raporu onaylamak istediğinizden emin misiniz?')) return;
    try {
      await axios.post(`${API}/repair-reports/${reportId}/approve`, {}, { headers: authHeader() });
      load();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Hata Oluştu'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { alert('Lütfen Red Nedeni Giriniz'); return; }
    try {
      await axios.post(`${API}/repair-reports/${reportId}/reject`, { reason: rejectReason }, { headers: authHeader() });
      setShowRejectModal(false);
      setRejectReason('');
      load();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Hata Oluştu'); }
  };

  const handleUpdateField = (field: string, value: string) => {
    setPendingFields((prev) => ({ ...prev, [field]: value }));
    setReport((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSaveReport = async () => {
    if (Object.keys(pendingFields).length === 0) return;
    setFindingsError(null);
    setSaving(true);
    try {
      await axios.put(`${API}/repair-reports/${reportId}`, pendingFields, { headers: authHeader() });
      setPendingFields({});
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Kayıt Başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    if (Object.keys(pendingFields).length === 0) {
      router.push(claimPath);
      return;
    }
    if (!confirm('Kaydedilmemiş değişiklikler var. Değişiklikleri iptal etmek istiyor musunuz?')) return;
    setPendingFields({});
    load();
  };

  const handleAddDamageType = async () => {
    if (!damageTypeForm.code) return;
    try {
      await axios.post(`${API}/repair-reports/${reportId}/damage-types`, {
        damageTypeCode: damageTypeForm.code,
        damageTypeName: damageTypeForm.name || damageTypeForm.code,
      }, { headers: authHeader() });
      setShowDamageTypeModal(false);
      setDamageTypeForm({ code: '', name: '' });
      load();
    } catch (e) { console.error(e); }
  };

  const handleRemoveDamageType = async (dtId: string) => {
    try {
      await axios.delete(`${API}/report-damage-types/${dtId}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const loadKeepScroll = useCallback(async () => {
    const scrollY = window.scrollY;
    await load();
    requestAnimationFrame(() => { window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior }); });
  }, [load]);

  const handleAddItem = async (itemData: any) => {
    await axios.post(`${API}/repair-reports/${reportId}/items`, itemData, { headers: authHeader() });
    loadKeepScroll();
  };

  const handleUpdateItemMain = async (itemId: string, data: any) => {
    await axios.put(`${API}/repair-report-items/${itemId}`, data, { headers: authHeader() });
    loadKeepScroll();
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Bu kalemi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/repair-report-items/${itemId}`, { headers: authHeader() });
      loadKeepScroll();
    } catch (e) { console.error(e); }
  };

  const handleSaveAnnotation = async (imageId: string, blob: Blob) => {
    try {
      const fd = new FormData();
      fd.append('file', blob, `annotated-${imageId}.png`);
      fd.append('category', 'annotated');
      await axios.post(`${API}/repair-reports/${reportId}/images`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setShowAnnotation(null);
      load();
    } catch (e) {
      console.error(e);
      // Fallback: try annotation endpoint if upload fails
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          await axios.put(`${API}/report-images/${imageId}/annotation`, { annotationData: ev.target?.result }, { headers: authHeader() });
          setShowAnnotation(null);
          load();
        };
        reader.readAsDataURL(blob);
      } catch (_) {}
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingCat(category);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        await axios.post(`${API}/repair-reports/${reportId}/images`, fd, {
          headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        });
      }
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      console.error(err);
    } finally {
      setUploadingCat(null);
    }
    e.target.value = '';
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await axios.delete(`${API}/report-images/${imageId}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleDownloadPdf = async (view: 'internal' | 'external') => {
    try {
      const res = await axios.get(`${API}/repair-reports/${reportId}/pdf?view=${view}`, {
        headers: authHeader(), responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const suffix = view === 'internal' ? 'IC' : 'DIS';
      a.href = url; a.download = `hasar-raporu-${suffix}-${reportId}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const handleSubmitReport = async () => {
    // Tespit Bulguları zorunlu kontrolü
    const currentFindings = (pendingFields.findingsText ?? report?.findingsText ?? '').trim();
    if (!currentFindings) {
      setFindingsError('Tespit Bulguları alanı boş bırakılamaz. Lütfen doldurunuz.');
      return;
    }
    if (!confirm('Raporu sigorta şirketine sunmak istediğinizden emin misiniz?')) return;
    try {
      await axios.post(`${API}/repair-reports/${reportId}/submit`, {}, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading || !report) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;

  const imageCats: Record<string, string> = { before: 'Öncesi', damage: 'Hasar', after: 'Sonrası' };
  const catColor: Record<string, string> = { before: 'bg-blue-100 text-blue-700', damage: 'bg-red-100 text-red-700', after: 'bg-green-100 text-green-700' };

  // Saha personeli maliyet gizleme
  const normalizedRoleCode = String(currentUser?.role?.code ?? currentUser?.roleCode ?? '').toLowerCase();
  const isFieldStaff = normalizedRoleCode === 'field_staff';
  // Saha personeli her zaman dış görünüm görsün
  const effectiveViewMode = isFieldStaff ? 'external' : viewMode;

  // Acil Yardım raporu ise ayrı editörü kullan
  const isEditable = (report.status === 'draft' || report.status === 'rejected') && !isFieldStaff;

  if (report.reportType === 'emergency') {
    return (
      <EmergencyReportEditor
        report={report}
        reportId={reportId}
        claimId={claimId}
        workGroups={workGroups}
        onReload={load}
      />
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => router.push(claimPath)} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{report.reportNo}</h2>
          <p className="text-xs text-slate-400">
            {report.reportType === 'single' ? 'Tek Hasarlı' : 'Çok Hasarlı'} · {new Date(report.reportDate ?? report.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Badge
          text={
            report.status === 'draft' ? 'Taslak' :
            report.status === 'pending_approval' ? 'Onay Bekliyor' :
            report.status === 'approved' ? 'Onaylandı' :
            report.status === 'rejected' ? 'Reddedildi' :
            report.status === 'sent_for_external_approval' ? 'Dış Onay Bekliyor' :
            report.status === 'externally_approved' ? 'Dışarıdan Onaylandı' :
            report.status === 'externally_rejected' ? 'Dışarıdan Reddedildi' :
            'Sunuldu'
          }
          color={
            report.status === 'draft' ? 'bg-slate-100 text-slate-600' :
            report.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
            report.status === 'approved' ? 'bg-green-100 text-green-700' :
            report.status === 'rejected' ? 'bg-red-100 text-red-700' :
            report.status === 'sent_for_external_approval' ? 'bg-indigo-100 text-indigo-700' :
            report.status === 'externally_approved' ? 'bg-emerald-100 text-emerald-700' :
            report.status === 'externally_rejected' ? 'bg-rose-100 text-rose-700' :
            'bg-blue-100 text-blue-700'
          }
        />
        {report.versionNo > 1 && (
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">v{report.versionNo}</span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Revize Et */}
          {report.status === 'approved' && (
            <button type="button"
              onClick={handleRevise}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
            >
              Revize Et
            </button>
          )}
          {/* Dış Onaya Gönder */}
          {(report.status === 'approved' || report.status === 'sent_for_external_approval' || report.status === 'externally_rejected') && (
            <button type="button"
              onClick={() => setShowExternalApprovalModal(true)}
              className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800"
            >
              Dış Onaya Gönder
            </button>
          )}
          {/* Onay workflow butonları */}
          {(report.status === 'draft' || report.status === 'rejected') && (
            <button type="button"
              onClick={handleRequestApproval}
              className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600"
            >
              Onaya Gönder
            </button>
          )}
          {report.status === 'pending_approval' && currentUser?.role?.code && ['admin', 'ops_manager', 'manager'].includes(currentUser.role.code) && (
            <>
              <button type="button"
                onClick={handleApprove}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
              >
                Onayla
              </button>
              <button type="button"
                onClick={() => setShowRejectModal(true)}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700"
              >
                Reddet
              </button>
            </>
          )}
          {/* Müşteri Görünümü / Tam Görünüm toggle */}
          {!isFieldStaff && (
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setViewMode('internal')}
                className={`px-3 py-1.5 transition-colors ${effectiveViewMode === 'internal' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="TDR, Marj ve Kâr sütunları görünür (şirket içi kullanım)"
              >
                Tam Görünüm
              </button>
              <button
                type="button"
                onClick={() => setViewMode('external')}
                className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${effectiveViewMode === 'external' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="TDR, Marj ve Kâr gizli — müşteriye gösterilecek görünüm"
              >
                Müşteri Görünümü
              </button>
            </div>
          )}
          <button type="button" onClick={() => handleDownloadPdf('external')} className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1" title="Müşteri PDF — TDR/Marj/Kâr gizli">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            PDF (Müşteri)
          </button>
          {!isFieldStaff && effectiveViewMode === 'internal' && (
            <button type="button" onClick={() => handleDownloadPdf('internal')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1" title="İç PDF — TDR/Marj/Kâr dahil">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              PDF (İç)
            </button>
          )}
          <button type="button"
            onClick={() => setShowWhatsApp(true)}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          {isEditable && (
            <button type="button" onClick={handleSubmitReport} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">Sigorta&apos;ya Sun</button>
          )}
        </div>
      </div>

      {/* Dosya Bilgileri */}
      <SectionCard title="Dosya Bilgileri">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Sigorta Şirketi', value: report.claimFile?.insuranceCompany?.name },
            { label: 'Hasar Dosya No', value: report.claimFile?.fileNo },
            { label: 'Hasar Konusu', value: report.claimFile?.lossType },
            { label: 'Sigortalı', value: report.claimFile?.customer?.fullName ?? report.claimFile?.customer?.companyName },
            { label: 'Hasar Adresi', value: report.claimFile?.propertyAddress ? `${report.claimFile.propertyAddress.addressLine}, ${report.claimFile.propertyAddress.city}` : undefined },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800">{f.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Hasar Nedeni — Tek Hasarlı banner */}
      {report.reportType === 'single' && (report.damageTypes?.length ?? 0) > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">TH</span>
          <div>
            <p className="text-xs text-blue-500 font-medium">Hasar Nedeni</p>
            <p className="text-sm font-semibold text-blue-800">{report.damageTypes[0]?.damageTypeName ?? '—'}</p>
          </div>
        </div>
      )}

      {/* Hasar Nedenleri (multi only) */}
      {report.reportType === 'multi' && (
        <SectionCard title="Hasar Nedenleri" action={
          isEditable && (
            <button type="button" onClick={() => setShowDamageTypeModal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ Ekle</button>
          )
        }>
          {!(report.damageTypes?.length) ? (
            <p className="text-slate-400 text-sm">Henüz Hasar Nedeni Eklenmemiş.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.damageTypes.map((dt: any) => (
                <span key={dt.id} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-medium">
                  {dt.damageTypeName}
                  {isEditable && (
                    <button type="button" onClick={() => handleRemoveDamageType(dt.id)} className="text-red-400 hover:text-red-700 ml-1">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Tespit Bulguları */}
      <SectionCard title="Hızlı Onarım Kalemleri">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Hasar Türü(leri)</p>
            <div className="flex flex-wrap gap-2">
              {DAMAGE_TYPE_OPTIONS.map((option) => {
                const active = quickDamageTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!isEditable}
                    onClick={() => setQuickDamageTypes((prev) => active ? prev.filter((value) => value !== option.value) : [...prev, option.value])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'} disabled:opacity-60`}
                  >
                    {active ? '✓ ' : ''}{option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Hasar Büyüklüğü</p>
            <div className="flex flex-wrap gap-3">
              {DAMAGE_SIZE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="radio" disabled={!isEditable} checked={quickDamageSize === option.value} onChange={() => setQuickDamageSize(option.value)} className="text-blue-600" />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!isEditable || quickDamageTypes.length === 0}
            onClick={() => setShowQuickRepairModal(true)}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ⚡ Hızlı Onarım Kalemleri Ekle
          </button>
          {quickDamageTypes.length > 0 && (
            <p className="text-xs text-slate-400">{quickDamageTypes.map(damageTypeLabel).join(' + ')} ({damageSizeLabel(quickDamageSize)}) için öneri alınacak.</p>
          )}
        </div>
      </SectionCard>

      {/* Tespit Bulguları */}
      <SectionCard title="Tespit Bulguları *">
        <div className={`border rounded-lg overflow-hidden ${findingsError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}`}>
          <div className="px-3 pt-2.5 pb-0.5 bg-slate-50 border-b border-slate-100">
            <span className="text-base font-bold italic text-slate-800 select-none">
              Riziko adreste yapılan incelemeler sonucunda;
            </span>
          </div>
          <div className="relative">
            <textarea
              ref={bulgularTextareaRef}
              className="w-full px-3 py-2 pr-12 text-sm text-slate-800 focus:outline-none resize-y min-h-[80px] bg-white"
              rows={3}
              placeholder="bulgular buraya yazılır..."
              defaultValue={report.findingsText ?? ''}
              readOnly={!isEditable}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) setFindingsError(null);
                else if (isEditable) setFindingsError('Tespit Bulguları zorunludur.');
                handleUpdateField('findingsText', e.target.value);
              }}
            />
            {isEditable && (
              <div className="absolute bottom-2 right-2">
                <SpeechToText
                  size="sm"
                  onTranscript={(text) => {
                    const el = bulgularTextareaRef.current;
                    if (!el) return;
                    el.value = el.value ? el.value + ' ' + text : text;
                    if (el.value.trim()) setFindingsError(null);
                    handleUpdateField('findingsText', el.value);
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {findingsError && <p className="text-xs text-red-500 mt-1">{findingsError}</p>}
      </SectionCard>

      {/* Onarım Kalemleri */}
      <SectionCard title="Onarım Kalemleri" action={
        isEditable && templateSuggestions.length > 0 ? (
          <button
            type="button"
            onClick={handleOpenSuggestModal}
            className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Önerilen Kalemler
          </button>
        ) : undefined
      }>
        {/* Hasar nedeni filtresi */}
        {report.reportType === 'multi' && (report.damageTypes?.length ?? 0) > 0 && (
          <div className="flex gap-1 mb-4 flex-wrap">
            <button type="button" onClick={() => setDamageFilter('all')}
              className={`px-3 py-1 text-xs rounded-lg ${damageFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Tümü
            </button>
            {report.damageTypes.map((dt: any) => (
              <button type="button" key={dt.id} onClick={() => setDamageFilter(dt.id)}
                className={`px-3 py-1 text-xs rounded-lg ${damageFilter === dt.id ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                {dt.damageTypeName}
              </button>
            ))}
          </div>
        )}

        <EditableItemsTable
          items={damageFilter === 'all' ? (report.items ?? []) : (report.items ?? []).filter((i: any) => i.damageTypeId === damageFilter)}
          workGroups={workGroups}
          damageTypes={report.damageTypes ?? []}
          reportType={report.reportType}
          isEditable={isEditable}
          viewMode={effectiveViewMode}
          onSave={handleUpdateItemMain}
          onDelete={handleRemoveItem}
          onAdd={handleAddItem}
        />

        {/* Toplamlar */}
        {(() => {
          const allItems = report.items ?? [];
          const clientBina = allItems.filter((i: any) => (i.damageCategory ?? 'bina') === 'bina')
            .reduce((s: number, i: any) => s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : (i.salesTotal ?? 0)), 0);
          const clientEsya = allItems.filter((i: any) => i.damageCategory === 'esya')
            .reduce((s: number, i: any) => s + (i.pricingType === 'lumpsum' ? (i.lumpSumPrice ?? 0) : (i.salesTotal ?? 0)), 0);
          const buildingTotal = (report.buildingDamageTotal ?? 0) > 0 ? report.buildingDamageTotal : clientBina;
          const goodsTotal = (report.goodsDamageTotal ?? 0) > 0 ? report.goodsDamageTotal : clientEsya;
          const grandTotal = (report.totalSalesAmount ?? 0) > 0 ? report.totalSalesAmount : (clientBina + clientEsya);
          return (
            <div className="mt-5 border-t-2 border-slate-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hasar Toplam Özeti</p>
                {isEditable && Object.keys(pendingFields).length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveReport}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {saving ? 'Kaydediliyor...' : `Kaydet (${Object.keys(pendingFields).length})`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-orange-600 font-medium mb-1">Bina Hasar Toplamı</p>
                  <p className="text-xl font-bold text-orange-700">{fmtCurrency(buildingTotal)}</p>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-teal-600 font-medium mb-1">Eşya Hasar Toplamı</p>
                  <p className="text-xl font-bold text-teal-700">{fmtCurrency(goodsTotal)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-slate-400 font-medium mb-1">Rapor Genel Toplam</p>
                  <p className="text-xl font-bold text-white">{fmtCurrency(grandTotal)}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Hasar nedeni bazlı özet (multi only) */}
        {report.reportType === 'multi' && (report.damageTypes?.length ?? 0) > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Hasar Nedeni Bazlı Özet</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase">
                    <th className="text-left px-3 py-2">Hasar Nedeni</th>
                    {effectiveViewMode === 'internal' && <th className="text-right px-3 py-2">Maliyet</th>}
                    <th className="text-right px-3 py-2">Satış</th>
                    {effectiveViewMode === 'internal' && <th className="text-right px-3 py-2">Kâr</th>}
                    {effectiveViewMode === 'internal' && <th className="text-right px-3 py-2">Marj%</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.damageTypes.map((dt: any) => {
                    const dtItems = (report.items ?? []).filter((i: any) => i.damageTypeId === dt.id);
                    const dtSales = dtItems.reduce((s: number, i: any) => s + i.salesTotal, 0);
                    const dtSupplier = dtItems.reduce((s: number, i: any) => s + i.supplierTotal, 0);
                    const dtMargin = dtSales > 0 ? ((dtSales - dtSupplier) / dtSales) * 100 : 0;
                    const mColor = dtMargin >= 20 ? 'text-green-600' : dtMargin >= 10 ? 'text-yellow-600' : 'text-red-600';
                    return (
                      <tr key={dt.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-800">{dt.damageTypeName}</td>
                        {effectiveViewMode === 'internal' && <td className="px-3 py-2 text-right text-slate-500">{fmtCurrency(dtSupplier)}</td>}
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(dtSales)}</td>
                        {effectiveViewMode === 'internal' && <td className="px-3 py-2 text-right text-slate-700">{fmtCurrency(dtSales - dtSupplier)}</td>}
                        {effectiveViewMode === 'internal' && <td className={`px-3 py-2 text-right font-semibold ${mColor}`}>%{dtMargin.toFixed(1)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* İş Grubu Bazlı Kar Özeti — sadece iç görünümde */}
      {effectiveViewMode === 'internal' && !isFieldStaff && (
        <WorkGroupProfitSummary items={report.items ?? []} workGroups={workGroups} />
      )}

      {/* Fotoğraflar */}
      <SectionCard title="Fotoğraflar">
        {isEditable && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['before', 'damage', 'after'] as const).map((cat) => (
              <label key={cat} className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg transition-colors ${uploadingCat === cat ? 'bg-blue-200 text-blue-700 cursor-wait' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                {uploadingCat === cat ? 'Yükleniyor...' : `+ ${imageCats[cat]}`}
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingCat !== null} onChange={(e) => handleImageUpload(e, cat)} />
              </label>
            ))}
          </div>
        )}
        {!(report.images?.length) ? (
          <p className="text-slate-400 text-sm">Henüz Fotoğraf Eklenmemiş.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {report.images.map((img: any) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/uploads/report-images/${img.hasAnnotation && img.annotatedKey ? img.annotatedKey : img.storageKey}`}
                  alt={img.caption ?? img.category}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" fill="%239ca3af" font-size="12">Yüklenemedi</text></svg>'; }}
                />
                <div className="absolute top-1.5 left-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${catColor[img.category] ?? 'bg-slate-100 text-slate-600'}`}>
                    {imageCats[img.category] ?? img.category}
                  </span>
                </div>
                {img.hasAnnotation && (
                  <div className="absolute top-1.5 right-6">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">✎</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                  <button type="button" onClick={() => setShowAnnotation(img)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700">İşaretle</button>
                  {isEditable && <button type="button" onClick={() => handleDeleteImage(img.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700">Sil</button>}
                </div>
                {img.caption && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">{img.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Revizyon Geçmişi */}
      <RevisionHistory reportId={reportId as string} claimFileId={claimId as string} />

      {/* Yasal Notlar */}
      <SectionCard title="Yasal Notlar ve Uyarılar">
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-blue-300 resize-y min-h-[60px]"
          rows={3}
          placeholder="Yasal Uyarılar ve Notlar..."
          defaultValue={report.legalNotes ?? ''}
          onBlur={(e) => handleUpdateField('legalNotes', e.target.value)}
          readOnly={!isEditable}
        />
      </SectionCard>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg px-6 py-3 z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
          {/* Kâr Özeti — sadece iç görünümde ve saha personeli değilse */}
          {effectiveViewMode === 'internal' && !isFieldStaff && (
            <div className="flex items-center gap-4 flex-1 flex-wrap text-sm">
              <span className="text-slate-500">Maliyet: <strong className="text-slate-800">{fmtCurrency(report.totalSupplierCost)}</strong></span>
              <span className="text-slate-500">Satış: <strong className="text-slate-800">{fmtCurrency(report.totalSalesAmount)}</strong></span>
              <span className="text-slate-500">Kâr: <strong className={report.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtCurrency(report.grossProfit)}</strong></span>
              <span className="text-slate-500">Marj: <strong className={report.grossMarginPct >= 20 ? 'text-green-600' : report.grossMarginPct >= 10 ? 'text-yellow-600' : 'text-red-600'}>%{(report.grossMarginPct ?? 0).toFixed(1)}</strong></span>
            </div>
          )}
          {effectiveViewMode === 'external' && <div className="flex-1" />}

          {/* Aksiyon Butonları */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Taslak veya Reddedildi: Kaydet + İptal */}
            {(report.status === 'draft' || report.status === 'rejected') && (
              <>
                <button
                  type="button"
                  onClick={handleCancelChanges}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveReport}
                  disabled={saving || Object.keys(pendingFields).length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {saving ? 'Kaydediliyor...' : Object.keys(pendingFields).length > 0 ? `Kaydet (${Object.keys(pendingFields).length})` : 'Kaydet'}
                </button>
              </>
            )}

            {/* Onaylanmış: Revize Et */}
            {report.status === 'approved' && (
              <button
                type="button"
                onClick={handleRevise}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Revize Et
              </button>
            )}

            {/* Externally approved: Revize Et */}
            {report.status === 'externally_approved' && (
              <button
                type="button"
                onClick={handleRevise}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Revize Et
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Annotation Editor — Fabric.js */}
      {showAnnotation && (
        <ImageAnnotationEditor
          imageUrl={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/uploads/report-images/${showAnnotation.hasAnnotation && showAnnotation.annotatedKey ? showAnnotation.annotatedKey : showAnnotation.storageKey}`}
          imageId={showAnnotation.id}
          reportId={reportId}
          onSave={(blob) => handleSaveAnnotation(showAnnotation.id, blob)}
          onClose={() => setShowAnnotation(null)}
        />
      )}

      {/* Hasar Nedeni Ekleme Modal */}
      {showDamageTypeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Hasar Nedeni Ekle</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Hasar Konusu</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={damageTypeForm.code}
                  onChange={(e) => setDamageTypeForm({ code: e.target.value, name: e.target.value })}>
                  <option value="">Seçin...</option>
                  {DAMAGE_TYPE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleAddDamageType} disabled={!damageTypeForm.code}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Ekle</button>
              <button type="button" onClick={() => setShowDamageTypeModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Paylaşım Modal */}
      {showWhatsApp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">WhatsApp ile Gönder</h3>
                <p className="text-xs text-slate-400">Raporu WhatsApp üzerinden paylaşın</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Telefon Numarası</label>
                <div className="flex gap-2">
                  <span className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600">+90</span>
                  <input
                    type="tel"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="5XX XXX XX XX"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Boş Bırakırsanız Alıcısız WhatsApp Web Açılır
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
                <strong>Nasıl Çalışır?</strong> WhatsApp Web Veya Masaüstü Uygulaması Açılır. Rapor Linki Mesaj Kutusunda Hazır Gelir, Göndermek için Tıklamanız Yeterli.
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button"
                onClick={async () => {
                  try {
                    const res = await axios.get(`${API}/repair-reports/${reportId}/share-link`, { headers: authHeader() });
                    const { url, whatsappUrl } = res.data.data;
                    const phone = whatsAppPhone ? `90${whatsAppPhone}` : '';
                    const finalUrl = phone
                      ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hasar Onarım Raporu (${report.reportNo}): ${url}`)}`
                      : whatsappUrl;
                    window.open(finalUrl, '_blank');
                    setShowWhatsApp(false);
                  } catch (e) { console.error(e); }
                }}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700"
              >
                WhatsApp Aç
              </button>
              <button type="button"
                onClick={() => setShowWhatsApp(false)}
                className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Red Nedeni Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Raporu Reddet</h3>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Red Nedeni *</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y min-h-[80px]"
                rows={4}
                placeholder="Red Nedenini Açıklayınız..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Reddet
              </button>
              <button type="button"
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dış Onay Geçmişi */}
      {externalApprovals.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-indigo-700 mb-3 border-b border-slate-100 pb-2">Dış Onay Talepleri</h4>
          <div className="space-y-2">
            {externalApprovals.map((ea: any) => (
              <div key={ea.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-slate-50">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  ea.status === 'approved' ? 'bg-green-100 text-green-700' :
                  ea.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  ea.status === 'expired' ? 'bg-slate-200 text-slate-500' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {ea.status === 'approved' ? 'Onaylandı' : ea.status === 'rejected' ? 'Reddedildi' : ea.status === 'expired' ? 'Süresi Doldu' : 'Bekliyor'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {ea.approverName || (ea.approver ? `${ea.approver.firstName} ${ea.approver.lastName}` : '—')}
                    <span className="ml-2 text-xs text-slate-400">{ea.approverType === 'expert' ? 'Eksper' : 'Sigorta Şirketi'}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {ea.channel === 'email' ? 'E-posta' : ea.channel === 'whatsapp' ? 'WhatsApp' : 'Sistem İçi'} · {new Date(ea.sentAt).toLocaleString('tr-TR')}
                    {ea.expiresAt && ` · Son: ${new Date(ea.expiresAt).toLocaleDateString('tr-TR')}`}
                  </p>
                  {ea.comments && <p className="text-xs text-red-600 mt-0.5 italic">Yorum: {ea.comments}</p>}
                </div>
                {ea.sentBy && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {ea.sentBy.firstName} {ea.sentBy.lastName} Tarafından Gönderildi
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revizyon Geçmişi */}
      {versions.length > 1 && (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h4 className="text-sm font-semibold text-purple-700">Revizyon Geçmişi</h4>
            <button type="button"
              onClick={() => setShowVersionHistory((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {showVersionHistory ? 'Gizle' : `${versions.length} Versiyon Göster`}
            </button>
          </div>
          {showVersionHistory && (
            <div className="space-y-2">
              {versions.map((v: any) => {
                const isCurrent = v.id === reportId;
                return (
                  <div key={v.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isCurrent ? 'bg-purple-50 border border-purple-200' : 'hover:bg-slate-50'}`}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isCurrent ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
                      v{v.versionNo}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{v.reportNo}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(v.createdAt).toLocaleDateString('tr-TR')}
                        {v.revisedBy && ` · ${v.revisedBy.firstName} ${v.revisedBy.lastName} Tarafından Revize Edildi`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === 'approved' ? 'bg-green-100 text-green-700' :
                      v.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                      v.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                      v.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {v.status === 'approved' ? 'Onaylandı' : v.status === 'draft' ? 'Taslak' : v.status === 'pending_approval' ? 'Onay Bekliyor' : v.status === 'rejected' ? 'Reddedildi' : 'Sunuldu'}
                    </span>
                    {!isCurrent && (
                      <a
                        href={`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${v.id}`}
                        className="text-xs text-purple-600 hover:underline flex-shrink-0"
                      >
                        Aç
                      </a>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-purple-500 flex-shrink-0">Mevcut</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Onay Geçmişi */}
      {approvalHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">Onay Geçmişi</h4>
          <div className="space-y-2">
            {approvalHistory.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  h.action === 'approved' ? 'bg-green-500' : h.action === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div className="flex-1">
                  <span className="text-sm text-slate-800 font-medium">
                    {h.user?.firstName} {h.user?.lastName}
                  </span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    h.action === 'approved' ? 'bg-green-100 text-green-700' :
                    h.action === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {h.action === 'approved' ? 'Onayladı' : h.action === 'rejected' ? 'Reddetti' : h.action === 'revision_created' ? 'Revizyon Oluşturdu' : 'Onaya Gönderdi'}
                  </span>
                  <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  {h.reason && <p className="text-xs text-red-600 mt-0.5 italic">Neden: {h.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dış Onaya Gönder Modal ─────────────────────────────────────── */}
      {showExternalApprovalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">Dış Onaya Gönder</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Onaylayıcı Tipi</label>
                <select
                  value={externalApprovalForm.approverType}
                  onChange={(e) => setExternalApprovalForm((f) => ({ ...f, approverType: e.target.value as 'expert' | 'insurance_company' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expert">Eksper</option>
                  <option value="insurance_company">Sigorta Şirketi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gönderim Kanalı</label>
                <select
                  value={externalApprovalForm.channel}
                  onChange={(e) => setExternalApprovalForm((f) => ({ ...f, channel: e.target.value as 'email' | 'whatsapp' | 'in_app' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">E-posta</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_app">Sistem İçi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={externalApprovalForm.approverName}
                  onChange={(e) => setExternalApprovalForm((f) => ({ ...f, approverName: e.target.value }))}
                  onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setExternalApprovalForm((f) => ({ ...f, approverName: v })); }}
                  placeholder="Onaylayıcının Adı Soyadı"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {externalApprovalForm.channel === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">E-posta</label>
                  <input
                    type="email"
                    value={externalApprovalForm.approverEmail}
                    onChange={(e) => setExternalApprovalForm((f) => ({ ...f, approverEmail: e.target.value }))}
                    placeholder="ornek@sigorta.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {externalApprovalForm.channel === 'whatsapp' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Telefon Numarası</label>
                  <input
                    type="tel"
                    value={externalApprovalForm.approverPhone}
                    onChange={(e) => setExternalApprovalForm((f) => ({ ...f, approverPhone: e.target.value }))}
                    placeholder="05xx xxx xx xx"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Geçerlilik Süresi (Saat)</label>
                <select
                  value={externalApprovalForm.expiresInHours}
                  onChange={(e) => setExternalApprovalForm((f) => ({ ...f, expiresInHours: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={24}>24 Saat</option>
                  <option value={48}>48 Saat</option>
                  <option value={72}>72 Saat (Varsayılan)</option>
                  <option value={120}>5 Gün</option>
                  <option value={168}>7 Gün</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button"
                onClick={() => setShowExternalApprovalModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-sm hover:bg-slate-50"
              >
                İptal
              </button>
              <button type="button"
                onClick={handleSendExternalApproval}
                disabled={sendingExternal}
                className="flex-1 bg-blue-700 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
              >
                {sendingExternal ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Önerilen Kalemler Modal */}
      {showSuggestModal && templateSuggestions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Önerilen İş Kalemleri</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {report?.claimFile?.lossType} türüne göre {templateSuggestions.flatMap((s: any) => s.items ?? []).length} kalem önerisi
                </p>
              </div>
              <button type="button" onClick={() => setShowSuggestModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-light leading-none">×</button>
            </div>

            {/* Item List */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {templateSuggestions.map((tpl: any) => (
                <div key={tpl.id}>
                  {templateSuggestions.length > 1 && (
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{tpl.name}</p>
                  )}
                  <div className="space-y-1">
                    {(tpl.items ?? []).map((item: any) => {
                      const checked = selectedTemplateItems.has(item.id);
                      return (
                        <label key={item.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedTemplateItems((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">{item.jobDescription}</span>
                              {item.workGroup && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.workGroup.name}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.damageCategory === 'bina' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {item.damageCategory === 'bina' ? 'Bina' : 'Eşya'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                              {item.location && <span>{item.location}</span>}
                              <span>{item.defaultQuantity} {item.defaultUnit}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allItems = templateSuggestions.flatMap((s: any) => s.items ?? []);
                    setSelectedTemplateItems(new Set(allItems.map((it: any) => it.id)));
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Tümünü Seç
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateItems(new Set())}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Seçimi Temizle
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowSuggestModal(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleAddSuggestedItems}
                  disabled={selectedTemplateItems.size === 0 || addingTemplateItems}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingTemplateItems ? 'Ekleniyor...' : `Seçilenleri Ekle (${selectedTemplateItems.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <RepairItemsModal
        open={showQuickRepairModal}
        damageTypes={quickDamageTypes}
        damageSize={quickDamageSize}
        fileId={claimId}
        onClose={() => setShowQuickRepairModal(false)}
        onAdd={handleAddQuickRepairItems}
      />
    </div>
  );
}

