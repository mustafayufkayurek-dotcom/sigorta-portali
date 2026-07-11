'use client';

import { API, authHeader } from '@/utils/api';
import React, { useEffect, useState, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { toTitleCaseTR, formatDisplayLabel, resolveClaimIhbarKonusu } from '@/utils/text-helpers';
import { fmtDateTime } from '@/utils/date-helpers';
import { resolveDamageReasonOptions, type DamageReasonOption } from '@/utils/damage-reason-options';
import { buildRepairReportShareRecipients } from '@/utils/repair-report-share-recipients';
import dynamic from 'next/dynamic';
import SpeechToText from '@/components/SpeechToText';
import { getReportImageUrl } from '@/utils/upload-url';
import RepairReportReviseModal, { type ReviseReportPayload } from '@/components/damage-reports/RepairReportReviseModal';
import { RevisionHistoryStrip } from '@/components/damage-reports/RevisionHistoryStrip';
import VendorQuoteModal, { readVendorPriceMemory, writeVendorPriceMemory } from '@/components/damage-reports/VendorQuoteModal';
import {
  parseVendorQuoteData,
  buildVendorQuoteMetrajData,
  type VendorQuoteData,
} from '@/components/damage-reports/VendorQuotePopover';
import { resolveIhbarTarihi } from '@/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay';
import { resolveRepairReportExpertName } from '@sigorta/shared';
import RepairItemsModal, {
  type SelectedRepairItem,
  DAMAGE_SIZE_OPTIONS,
  damageTypeLabel,
  damageSizeLabel,
} from '@/components/damage-reports/RepairItemsModal';
import {
  inferQuickDamageTypesFromReport,
  filterQuickDamageTypeOptions,
  REPORT_IMAGE_CATEGORY_LABELS,
} from '@/utils/quick-repair-damage-types';
import { resolveInsuredDisplayName } from '@/utils/insured-display';
import { LEGAL_NOTE_TEMPLATES, buildSuggestedLegalNotesText } from '@/constants/legal-note-templates';

const ImageAnnotationEditor = dynamic(
  () => import('@/components/ImageAnnotationEditor'),
  { ssr: false }
);

/** Mahal/bölge — Title Case; "Kelime1 - Kelime2" formatı zorunlu */
function normalizeLocationLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed ? toTitleCaseTR(trimmed) : trimmed;
}

function formatLocationLabel(value: string): { formatted: string; warning?: string; valid: boolean } {
  const normalized = normalizeLocationLabel(value);
  if (!normalized) return { formatted: normalized, valid: true };
  if (normalized.includes(' - ')) return { formatted: normalized, valid: true };
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return {
      formatted: `${words[0]} - Genel`,
      warning: 'Mahal formatı "Kelime1 - Kelime2" olmalıdır; otomatik düzenlendi.',
      valid: false,
    };
  }
  const splitAt = Math.max(1, words.length - 1);
  return {
    formatted: `${words.slice(0, splitAt).join(' ')} - ${words.slice(splitAt).join(' ')}`,
    warning: 'Mahal formatı "Kelime1 - Kelime2" olmalıdır; otomatik düzenlendi.',
    valid: false,
  };
}

function validateAndFormatLocation(value: string): string {
  return formatLocationLabel(value).formatted;
}

function isValidLocationFormat(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed.includes(' - ') || formatLocationLabel(trimmed).formatted.includes(' - ');
}

const DEFAULT_DETECTION_SCOPES = [
  'Sigortalı Konut',
  'Ortak Alan',
  'Depo',
  'Dükkan',
  'Ofis',
] as const;

function formatDetectionScopeLabel(value: string): string {
  const trimmed = normalizeLocationLabel(value);
  return trimmed ? toTitleCaseTR(trimmed) : trimmed;
}

function rowSortKey(item: { metrajData?: unknown; location?: string | null; workGroupId?: string | null; workGroup?: { name?: string | null } | null }) {
  const scope = readMetrajDetectionScope(item.metrajData);
  const loc = item.location ?? '';
  const wg = item.workGroup?.name ?? item.workGroupId ?? '';
  return `${scope}\0${loc}\0${wg}`;
}

function readMetrajDetectionScope(metrajData: unknown): string {
  if (!metrajData || typeof metrajData !== 'object') return '';
  const scope = (metrajData as Record<string, unknown>).detectionScope;
  return typeof scope === 'string' ? normalizeLocationLabel(scope) : '';
}

function sortReportItems(items: any[]): any[] {
  return [...items].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b), 'tr'));
}

function rowStateSortKey(row: RowState & { workGroupId?: string }, workGroups: any[]): string {
  const wg = workGroups.find((w: any) => w.id === row.workGroupId)?.name ?? row.workGroupId ?? '';
  return `${row.detectionScope}\0${row.location}\0${wg}`;
}

function recomputeReportTotals(items: any[]) {
  const totalSupplierCost = items.reduce((s, i) => s + (Number(i.supplierTotal) || 0), 0);
  const totalSalesAmount = items.reduce((s, i) => {
    if (i.pricingType === 'lumpsum') return s + (Number(i.lumpSumPrice) || 0);
    return s + (Number(i.salesTotal) || 0);
  }, 0);
  const grossProfit = totalSalesAmount - totalSupplierCost;
  const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;
  const buildingDamageTotal = items.reduce((s, i) => {
    if ((i.damageCategory ?? 'bina') !== 'bina') return s;
    return s + (i.pricingType === 'lumpsum' ? (Number(i.lumpSumPrice) || 0) : (Number(i.salesTotal) || 0));
  }, 0);
  const goodsDamageTotal = items.reduce((s, i) => {
    if (i.damageCategory !== 'esya') return s;
    return s + (i.pricingType === 'lumpsum' ? (Number(i.lumpSumPrice) || 0) : (Number(i.salesTotal) || 0));
  }, 0);
  return { totalSupplierCost, totalSalesAmount, grossProfit, grossMarginPct, buildingDamageTotal, goodsDamageTotal };
}


function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL.';
}

type FileExpertInfo = {
  name: string;
  office?: string;
  missing: boolean;
};

function resolveFileExpertDisplay(report: any): FileExpertInfo {
  if (!report) return { name: '—', missing: true };
  const name = resolveRepairReportExpertName({
    inspectorName: report.inspectorName,
    expertOffice: report.expertOffice,
    claimFile: report.claimFile,
  });
  if (name) return { name, missing: false };
  const vendor = report.claimFile?.assignedInspectorVendor?.name?.trim();
  if (vendor) return { name: vendor, missing: false };
  const adjuster = report.claimFile?.assignedAdjuster
    ? `${report.claimFile.assignedAdjuster.firstName ?? ''} ${report.claimFile.assignedAdjuster.lastName ?? ''}`.trim()
    : '';
  if (adjuster) return { name: adjuster, missing: false };
  return { name: 'Atanmamış', missing: true };
}

function approvalActorName(user: any) {
  if (!user) return '—';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
}

function getEffectiveFindingsText(
  report: any,
  pendingFields: Record<string, string>,
  textareaEl: HTMLTextAreaElement | null,
): string {
  if (textareaEl?.value != null) return textareaEl.value.trim();
  if (pendingFields.findingsText != null) return pendingFields.findingsText.trim();
  return (report?.findingsText ?? '').trim();
}

function validateApprovalRequirements(report: any, findingsText: string): {
  ok: boolean;
  findingsError?: string;
  itemsError?: string;
} {
  if (!findingsText) {
    return { ok: false, findingsError: 'Tespit Bulguları doldurulmadan onaya gönderilemez.' };
  }
  const items = report?.items ?? [];
  if (items.length === 0) {
    return { ok: false, itemsError: 'En az bir onarım kalemi eklenmeden onaya gönderilemez.' };
  }
  const totalSales = items.reduce((sum: number, item: any) => sum + (Number(item.salesTotal) || 0), 0);
  const totalCost = items.reduce((sum: number, item: any) => sum + (Number(item.supplierTotal) || 0), 0);
  const totalLumpSum = items.reduce((sum: number, item: any) => {
    if (item.pricingType === 'lumpsum') return sum + (Number(item.lumpSumPrice) || 0);
    return sum;
  }, 0);
  if (totalSales <= 0 && totalCost <= 0 && totalLumpSum <= 0) {
    return { ok: false, itemsError: 'Maliyet veya satış tutarı girilmeden onaya gönderilemez.' };
  }
  return { ok: true };
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

const UNITS = ['Adet', 'Maktuen', 'm²', 'm³', 'm/tül', 'Takım', 'Asgari', 'Tam Gün', '1/2 gün', 'Çuval', 'Servis', 'Günlük', 'Yevmiye', 'Saat', 'Kamyon', 'Torba', 'Metre', 'Kutu'];

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-none ${color}`}>
      {text}
    </span>
  );
}

function IconDocumentDownload({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 18H15a2.25 2.25 0 002.25-2.25V9.75a2.25 2.25 0 00-2.25-2.25H8.25A2.25 2.25 0 006 9.75v10.5A2.25 2.25 0 008.25 22.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m0 0l-2.25-2.25M12 16.5l2.25-2.25" />
    </svg>
  );
}

function IconChevronDown({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Revizyon Geçmişi → RevisionHistoryStrip (paylaşımlı bileşen)

function SectionCard({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function FinancialSummaryBar({
  totalSupplierCost,
  totalSalesAmount,
  grossProfit,
  grossMarginPct,
}: {
  totalSupplierCost?: number | null;
  totalSalesAmount?: number | null;
  grossProfit?: number | null;
  grossMarginPct?: number | null;
}) {
  const margin = grossMarginPct ?? 0;
  const profit = grossProfit ?? 0;
  const marginValueClass = margin >= 20 ? 'text-emerald-300' : margin >= 10 ? 'text-amber-300' : 'text-rose-300';
  const marginChipClass = margin >= 20
    ? 'bg-emerald-500/15 border-emerald-400/30'
    : margin >= 10
      ? 'bg-amber-500/15 border-amber-400/30'
      : 'bg-rose-500/15 border-rose-400/30';

  const metrics = [
    { label: 'Maliyet', value: fmtCurrency(totalSupplierCost), valueClass: 'text-white' },
    { label: 'Satış', value: fmtCurrency(totalSalesAmount), valueClass: 'text-white' },
    {
      label: 'Kâr',
      value: fmtCurrency(grossProfit),
      valueClass: profit >= 0 ? 'text-emerald-300' : 'text-rose-300',
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap min-w-0">
      <div className="hidden md:flex items-center gap-2 pr-1 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
        <span className="text-xs font-semibold text-slate-300 tracking-wide">Finansal Özet</span>
      </div>
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg bg-white/10 border border-white/15 px-3 py-2 min-w-[6.5rem] sm:min-w-[7.5rem] flex flex-col items-center justify-center text-center"
        >
          <p className="text-[10px] font-medium text-slate-400 leading-none mb-1">{metric.label}</p>
          <p className={`text-sm sm:text-base font-bold leading-none tabular-nums ${metric.valueClass}`}>{metric.value}</p>
        </div>
      ))}
      <div className={`rounded-lg border px-3 py-2 min-w-[5.5rem] sm:min-w-[6rem] flex flex-col items-center justify-center text-center ${marginChipClass}`}>
        <p className="text-[10px] font-medium text-slate-400 leading-none mb-1">Marj</p>
        <p className={`text-sm sm:text-base font-bold leading-none tabular-nums ${marginValueClass}`}>
          %{margin.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

// ─── Dosya Bütçesi (iş grubu özeti) ───────────────────────────────────────────
interface WorkGroupProfitRow {
  workGroupId: string;
  workGroupName: string;
  vendorSummary: string;
  supplierTotal: number;
  salesTotal: number;
  profit: number;
  profitPct: number;
}

function summarizeWorkGroupVendors(items: any[], wgId: string): string {
  const preferred = new Set<string>();
  const alternatives = new Set<string>();
  for (const item of items) {
    const itemWgId = item.workGroupId ?? item.workGroup?.id ?? '__unknown__';
    if (itemWgId !== wgId) continue;
    const quotes = parseVendorQuoteData(item.metrajData);
    if (quotes.preferredVendorName?.trim()) {
      preferred.add(formatDisplayLabel(quotes.preferredVendorName.trim()));
    }
    for (const alt of quotes.alternatives ?? []) {
      if (alt.vendorName?.trim()) {
        alternatives.add(formatDisplayLabel(alt.vendorName.trim()));
      }
    }
  }
  if (preferred.size === 0 && alternatives.size === 0) return '—';
  const parts: string[] = [];
  if (preferred.size > 0) parts.push(Array.from(preferred).join(' · '));
  const altOnly = Array.from(alternatives).filter((n) => !Array.from(preferred).includes(n));
  if (altOnly.length > 0) parts.push(`Alt: ${altOnly.join(' · ')}`);
  return parts.join(' | ');
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
        vendorSummary: summarizeWorkGroupVendors(items, wgId),
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
          <span className="text-sm font-semibold text-slate-700">Dosya Bütçesi</span>
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
                <tr className="bg-slate-50 text-slate-400 text-[10px] tracking-wide">
                  <th className="text-center px-3 py-2 rounded-l-lg">İş Grubu</th>
                  <th className="text-left px-3 py-2">Tedarikçi</th>
                  <th className="text-right px-3 py-2">Maliyet</th>
                  <th className="text-right px-3 py-2">Satış Fiyatı</th>
                  <th className="text-right px-3 py-2">Kar</th>
                  <th className="text-right px-3 py-2 rounded-r-lg">Kar %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.workGroupId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{formatDisplayLabel(row.workGroupName)}</td>
                    <td className="px-3 py-2.5 text-left text-slate-600 text-[11px] leading-snug max-w-[180px]">{row.vendorSummary}</td>
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
                  <td className="px-3 py-3.5 text-white text-xs font-semibold rounded-bl-lg">
                    {grandProfit < 0 ? '⚠ Zarar' : 'Genel Toplam'}
                  </td>
                  <td className="px-3 py-3.5" />
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
            <p className="text-xs font-semibold text-slate-500 tracking-wider text-center mb-3">Genel Analiz</p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 tracking-wide mb-0.5">Toplam Satış</p>
                <p className="text-sm font-bold text-slate-800">{fmtCurrency(grandSales)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 tracking-wide mb-0.5">Toplam Tedarikçi</p>
                <p className="text-sm font-bold text-slate-600">{fmtCurrency(grandSupplier)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 tracking-wide mb-0.5">Toplam Kar</p>
                <p className={`text-sm font-bold ${grandProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtCurrency(grandProfit)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 tracking-wide mb-0.5">Kar Oranı</p>
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
                  Mahal/Bölge: <span className="bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">{formatDisplayLabel(location)}</span>
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
          <p className="text-xs font-semibold text-slate-500 tracking-wide mb-2">Hesaplama Türü</p>
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
    const trimmed = normalizeLocationLabel(newVal);
    if (!trimmed || !workGroupId) { setAddingNew(false); setNewVal(''); return; }
    setSaving(true);
    try {
      const result = await onAddNew(trimmed, workGroupId);
      onSelect(normalizeLocationLabel(result?.name ?? trimmed), result?.unitType ?? result?.defaultUnit);
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
          onSelect(normalizeLocationLabel(e.target.value), sg?.unitType ?? sg?.defaultUnit);
        }
      }}
    >
      <option value="">— İş Tanımı Seç —</option>
      {subGroups.map((sg: any) => (
        <option key={sg.id} value={sg.name ?? sg.id}>{formatDisplayLabel(sg.name)}</option>
      ))}
      <option value="__add_new__">+ Yeni İş Tanımı Ekle</option>
    </select>
  );
}

// ─── İş Grubu Seçici (inline yeni ekleme destekli) ───────────────────────────
function WorkGroupSelector({
  value,
  workGroups,
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
  workGroups: any[];
  onSelect: (workGroupId: string) => void;
  onAddNew: (name: string) => Promise<{ id: string; name: string }>;
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
    const trimmed = toTitleCaseTR(newVal.trim());
    if (!trimmed) { setAddingNew(false); setNewVal(''); return; }
    setSaving(true);
    try {
      const result = await onAddNew(trimmed);
      onSelect(result.id);
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
          placeholder="İş grubu adı..."
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
          onSelect(e.target.value);
        }
      }}
    >
      <option value="">—</option>
      {workGroups.map((wg: any) => (
        <option key={wg.id} value={wg.id}>{formatDisplayLabel(wg.name)}</option>
      ))}
      <option value="__add_new__">+ Yeni İş Grubu Ekle</option>
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

export interface EditableItemsTableHandle {
  quickAddRow: () => Promise<void>;
  saveAllDirtyRows: () => Promise<void>;
  hasDirtyRows: () => boolean;
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
  onDirtyChange?: (count: number) => void;
  onWorkGroupCreated?: (workGroup: any) => void;
}

interface RowState {
  workGroupId: string;
  location: string;
  detectionScope: string;
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
  metrajData: Record<string, unknown> | null;
  vendorQuotes: VendorQuoteData;
}

function rowFromItem(item: any): RowState {
  const vendorQuotes = parseVendorQuoteData(item.metrajData);
  return {
    workGroupId: item.workGroupId ?? '',
    location: item.location ? normalizeLocationLabel(item.location) : '',
    detectionScope: readMetrajDetectionScope(item.metrajData),
    jobDescription: item.jobDescription ? normalizeLocationLabel(item.jobDescription) : '',
    description: item.description ? normalizeLocationLabel(item.description) : '',
    quantity: String(item.quantity ?? '1'),
    unit: item.unit ?? 'm²',
    salesUnitPrice: String(item.salesUnitPrice ?? '0'),
    supplierUnitPrice: String(item.supplierUnitPrice ?? '0'),
    damageCategory: (item.damageCategory ?? 'bina') as 'bina' | 'esya',
    damageTypeId: item.damageTypeId ?? '',
    pricingType: (item.pricingType ?? 'unit') as 'unit' | 'lumpsum',
    lumpSumPrice: String(item.lumpSumPrice ?? '0'),
    metrajData: item.metrajData && typeof item.metrajData === 'object' ? item.metrajData : null,
    vendorQuotes,
  };
}

function emptyRow(location = ''): RowState {
  return {
    workGroupId: '', location, detectionScope: '', jobDescription: '', description: '', quantity: '1', unit: 'm²',
    salesUnitPrice: '0', supplierUnitPrice: '0', damageCategory: 'bina', damageTypeId: '',
    pricingType: 'unit', lumpSumPrice: '0', metrajData: null, vendorQuotes: {},
  };
}

function resolveMemorySupplierPrice(data: VendorQuoteData): string | null {
  const alts = data.alternatives ?? [];
  const preferred = data.preferredVendorName?.trim();
  if (preferred) {
    const match = alts.find((a) => a.vendorName.trim() === preferred && a.unitPrice.trim());
    if (match) return match.unitPrice.trim();
  }
  const first = alts.find((a) => a.unitPrice.trim());
  return first?.unitPrice.trim() ?? null;
}

function persistVendorMemoryFromRow(row: RowState) {
  if (!row.workGroupId || !row.jobDescription.trim()) return;
  const price = row.supplierUnitPrice?.trim();
  const vendor = row.vendorQuotes?.preferredVendorName?.trim();
  if (!price || price === '0') return;
  const alts = row.vendorQuotes?.alternatives?.length
    ? row.vendorQuotes.alternatives
    : vendor ? [{ vendorName: vendor, unitPrice: price }] : [{ vendorName: '', unitPrice: price }];
  writeVendorPriceMemory(row.workGroupId, row.jobDescription, {
    preferredVendorName: vendor,
    alternatives: alts,
  });
}

function mergeVendorMemoryIntoRow(row: RowState): RowState {
  if (!row.workGroupId || !row.jobDescription.trim()) return row;
  const stored = readVendorPriceMemory(row.workGroupId, row.jobDescription);
  if (!stored) return row;
  const hasQuotes = Boolean(
    row.vendorQuotes?.preferredVendorName?.trim()
    || row.vendorQuotes?.alternatives?.some((a) => a.vendorName.trim() || a.unitPrice.trim()),
  );
  const next: RowState = {
    ...row,
    vendorQuotes: hasQuotes ? row.vendorQuotes : stored,
  };
  const memoryPrice = resolveMemorySupplierPrice(stored);
  if (memoryPrice && (!next.supplierUnitPrice || next.supplierUnitPrice === '0')) {
    next.supplierUnitPrice = memoryPrice;
  }
  return next;
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
      if (onKeyDown) {
        onKeyDown(e);
        return;
      }
      if (e.key === 'Enter') e.preventDefault();
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

// ─── Mahal/Bölge — serbest metin + rapor içi öneriler (datalist)
function LocationInput({
  value,
  suggestions,
  onChange,
  onRegister,
  className,
  placeholder = 'Mahal/Bölge...',
  'data-cell': dataCell,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
  onRegister: (v: string) => void;
  className?: string;
  placeholder?: string;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const listId = React.useId();
  return (
    <>
      <input
        type="text"
        data-cell={dataCell}
        className={className}
        value={value}
        placeholder={placeholder}
        list={listId}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={() => {
          const { formatted, warning } = formatLocationLabel(value);
          if (formatted && formatted !== value) onChange(formatted);
          if (formatted) onRegister(formatted);
          if (warning) console.info(warning);
          onBlur?.();
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab' || e.key === 'Enter') {
            onKeyDown?.(e);
            return;
          }
          onKeyDown?.(e);
        }}
      />
      <datalist id={listId}>
        {suggestions.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>
    </>
  );
}

// ─── Tespit — öneri listesi (Sigortalı Konut vb.)
function DetectionScopeInput({
  value,
  suggestions,
  onChange,
  onRegister,
  className,
  placeholder = 'Sigortalı Konut...',
  'data-cell': dataCell,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
  onRegister: (v: string) => void;
  className?: string;
  placeholder?: string;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const listId = React.useId();
  return (
    <>
      <input
        type="text"
        data-cell={dataCell}
        className={className}
        value={value}
        placeholder={placeholder}
        list={listId}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={() => {
          const formatted = formatDetectionScopeLabel(value);
          if (formatted && formatted !== value) onChange(formatted);
          if (formatted) onRegister(formatted);
          onBlur?.();
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab' || e.key === 'Enter') {
            onKeyDown?.(e);
            return;
          }
          onKeyDown?.(e);
        }}
      />
      <datalist id={listId}>
        {suggestions.map((scope) => (
          <option key={scope} value={scope} />
        ))}
      </datalist>
    </>
  );
}

const EditableItemsTable = forwardRef<EditableItemsTableHandle, EditableItemsTableProps>(function EditableItemsTable(
  { items, workGroups, isEditable, viewMode, onSave, onDelete, onAdd, onDirtyChange, onWorkGroupCreated },
  ref,
) {
  const [rows, setRows] = useState<(RowState & { _id: string; _isDirty: boolean; _savedFlash: boolean })[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState<RowState>(emptyRow());
  const [addingDirty, setAddingDirty] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIdx: number | 'new'; col: string } | null>(null);
  const [subGroups, setSubGroups] = useState<Record<string, any[]>>({});
  const [loadingSubGroupIds, setLoadingSubGroupIds] = useState<Set<string>>(new Set());
  const [metrajModalRowId, setMetrajModalRowId] = useState<string | null>(null);
  const [locationList, setLocationList] = useState<string[]>([]);
  const [vendorModalRowId, setVendorModalRowId] = useState<string | null>(null);
  // Zam oranı state
  const [zamOraniInput, setZamOraniInput] = useState('');
  const [zamOraniUndoSnapshot, setZamOraniUndoSnapshot] = useState<{ id: string; salesUnitPrice: string; supplierUnitPrice: string }[] | null>(null);
  const [zamApplying, setZamApplying] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const addingDraftRef = useRef<RowState>(emptyRow());
  const [descriptionErrors, setDescriptionErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    addingDraftRef.current = addingRow;
  }, [addingRow]);

  // locationList + tespit önerileri
  const [detectionScopeList, setDetectionScopeList] = useState<string[]>([...DEFAULT_DETECTION_SCOPES]);
  useEffect(() => {
    const locs = Array.from(new Set(
      items
        .map((i: any) => i.location)
        .filter((l: string) => l && l.trim())
        .map((l: string) => normalizeLocationLabel(l)),
    )) as string[];
    setLocationList(locs);
    const scopes = Array.from(new Set([
      ...DEFAULT_DETECTION_SCOPES,
      ...items.map((i: any) => readMetrajDetectionScope(i.metrajData)).filter(Boolean),
    ])) as string[];
    setDetectionScopeList(scopes);
  }, [items]);

  const addLocationIfNew = (loc: string) => {
    const normalized = validateAndFormatLocation(loc);
    setLocationList((prev) => prev.includes(normalized) ? prev : [...prev, normalized]);
  };

  const addDetectionScopeIfNew = (scope: string) => {
    const normalized = formatDetectionScopeLabel(scope);
    if (!normalized) return;
    setDetectionScopeList((prev) => prev.includes(normalized) ? prev : [...prev, normalized]);
  };

  useEffect(() => {
    const draft = addingDraftRef.current;
    setRows((prev) => {
      const sorted = sortReportItems(items);
      return sorted.map((item) => {
        const existing = prev.find((r) => r._id === item.id);
        if (existing?._isDirty) return existing;
        return {
          ...rowFromItem(item),
          _id: item.id,
          _isDirty: false,
          _savedFlash: existing?._savedFlash ?? false,
        };
      });
    });
    if (draft.location?.trim() || draft.detectionScope?.trim() || addingDirty) {
      setAddingRow((prev) => ({
        ...prev,
        location: draft.location?.trim() ? draft.location : prev.location,
        detectionScope: draft.detectionScope?.trim() ? draft.detectionScope : prev.detectionScope,
        workGroupId: draft.workGroupId || prev.workGroupId,
        damageCategory: draft.damageCategory ?? prev.damageCategory,
        unit: draft.unit || prev.unit,
        damageTypeId: draft.damageTypeId || prev.damageTypeId,
      }));
    }
  }, [items]);

  const displayRows = useMemo(
    () => [...rows].sort((a, b) => rowStateSortKey(a, workGroups).localeCompare(rowStateSortKey(b, workGroups), 'tr')),
    [rows, workGroups],
  );

  useEffect(() => {
    const dirtyCount = rows.filter((r) => r._isDirty).length + (addingDirty ? 1 : 0);
    onDirtyChange?.(dirtyCount);
  }, [rows, addingDirty, onDirtyChange]);

  const buildRowPayload = (row: RowState) => {
    const isLumpsum = row.pricingType === 'lumpsum';
    const metrajBase = row.metrajData && typeof row.metrajData === 'object' ? { ...row.metrajData } : {};
    if (row.detectionScope.trim()) {
      metrajBase.detectionScope = row.detectionScope.trim();
    } else {
      delete metrajBase.detectionScope;
    }
    return {
      workGroupId: row.workGroupId || undefined,
      location: row.location ? validateAndFormatLocation(row.location) : undefined,
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
      metrajData: buildVendorQuoteMetrajData(metrajBase, row.vendorQuotes),
    };
  };

  const getEmbeddedSubGroups = useCallback((workGroupId: string): any[] | null => {
    const wg = workGroups.find((w: any) => w.id === workGroupId);
    if (!wg || !Array.isArray(wg.workSubGroups)) return null;
    return wg.workSubGroups;
  }, [workGroups]);

  const resolveSubGroups = useCallback((workGroupId: string): any[] => {
    if (!workGroupId) return [];
    const embedded = getEmbeddedSubGroups(workGroupId);
    if (embedded && embedded.length > 0) return embedded;
    return subGroups[workGroupId] ?? embedded ?? [];
  }, [getEmbeddedSubGroups, subGroups]);

  // work-groups listesindeki alt grupları önbelleğe al
  useEffect(() => {
    const seeded: Record<string, any[]> = {};
    for (const wg of workGroups) {
      if (Array.isArray(wg.workSubGroups) && wg.workSubGroups.length > 0) {
        seeded[wg.id] = wg.workSubGroups;
      }
    }
    if (Object.keys(seeded).length > 0) {
      setSubGroups((prev) => ({ ...seeded, ...prev }));
    }
  }, [workGroups]);

  // Mevcut kalemlerin iş grupları için alt grup yükle
  useEffect(() => {
    const ids = Array.from(new Set(items.map((i: any) => i.workGroupId).filter(Boolean))) as string[];
    for (const id of ids) {
      const embedded = getEmbeddedSubGroups(id);
      if (embedded && embedded.length > 0) continue;
      if (subGroups[id] !== undefined) continue;
      void loadSubGroups(id);
    }
  }, [items, workGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSubGroups = async (workGroupId: string) => {
    if (!workGroupId) return;
    const embedded = getEmbeddedSubGroups(workGroupId);
    if (embedded && embedded.length > 0) {
      setSubGroups((prev) => ({ ...prev, [workGroupId]: embedded }));
      return;
    }
    if (subGroups[workGroupId] !== undefined || loadingSubGroupIds.has(workGroupId)) return;
    setLoadingSubGroupIds((prev) => new Set(prev).add(workGroupId));
    try {
      const res = await axios.get(`${API}/work-groups/${workGroupId}/sub-groups`, { headers: authHeader() });
      const data = res.data.data || [];
      setSubGroups((prev) => ({ ...prev, [workGroupId]: data }));
    } catch {
      setSubGroups((prev) => ({ ...prev, [workGroupId]: embedded ?? [] }));
    } finally {
      setLoadingSubGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(workGroupId);
        return next;
      });
    }
  };

  // Inline yeni iş tanımı ekleme
  const createSubGroup = async (name: string, workGroupId: string): Promise<{ name: string; unitType?: string; defaultUnit?: string }> => {
    const code = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    const res = await axios.post(
      `${API}/work-groups/${workGroupId}/sub-groups`,
      { code, name: toTitleCaseTR(name.trim()), unitType: 'm²', sortOrder: 0 },
      { headers: authHeader() },
    );
    const newSg = res.data.data ?? res.data;
    // Mevcut sub-groups listesini güncelle
    setSubGroups((prev) => {
      const existing = prev[workGroupId] ?? [];
      return { ...prev, [workGroupId]: [...existing, newSg] };
    });
    return { name: newSg.name, unitType: newSg.unitType };
  };

  const createWorkGroup = async (name: string): Promise<{ id: string; name: string }> => {
    const code = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;
    const res = await axios.post(
      `${API}/work-groups`,
      { code, name: toTitleCaseTR(name.trim()), sortOrder: 99 },
      { headers: authHeader() },
    );
    const newWg = res.data.data ?? res.data;
    onWorkGroupCreated?.(newWg);
    return { id: newWg.id, name: newWg.name };
  };

  const updateRow = (id: string, field: keyof RowState, value: string | VendorQuoteData, opts?: { markDirty?: boolean }) => {
    const markDirty = opts?.markDirty ?? true;
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, [field]: value, _isDirty: markDirty ? true : r._isDirty } : r));
  };

  const updateRowCategory = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, ...patch, _isDirty: true } : r));
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
    if (!row.workGroupId || !row.jobDescription.trim()) {
      alert('Kaydetmek için İş Grubu ve İş Tanımı zorunludur.');
      return;
    }
    if (row.location.trim() && !isValidLocationFormat(row.location)) {
      alert('Mahal/Bölge formatı zorunlu: Kelime1 - Kelime2 (ör. Salon - Zemin)');
      focusCell(rows.findIndex((r) => r._id === id), 'location');
      return;
    }
    addingDraftRef.current = { ...addingDraftRef.current, ...addingRow };
    setSavingId(id);
    try {
      await onSave(id, buildRowPayload(row));
      persistVendorMemoryFromRow(row);
      setRows((prev) => prev.map((r) => r._id === id ? { ...r, _isDirty: false, _savedFlash: true } : r));
      setTimeout(() => setRows((prev) => prev.map((r) => r._id === id ? { ...r, _savedFlash: false } : r)), 900);
    } finally { setSavingId(null); }
  };

  const saveAllDirtyRows = useCallback(async () => {
    const dirty = rows.filter((r) => r._isDirty);
    for (const row of dirty) {
      if (!row.workGroupId || !row.jobDescription.trim()) continue;
      setSavingId(row._id);
      try {
        await onSave(row._id, buildRowPayload(row));
      } finally {
        setSavingId(null);
      }
    }
    if (dirty.length > 0) {
      setRows((prev) => prev.map((r) => r._isDirty ? { ...r, _isDirty: false, _savedFlash: true } : r));
      setTimeout(() => setRows((prev) => prev.map((r) => ({ ...r, _savedFlash: false }))), 900);
    }
  }, [rows, onSave]);

  const saveAddingRow = async () => {
    if (!addingRow.workGroupId || !addingRow.jobDescription) return;
    if (addingRow.location.trim() && !isValidLocationFormat(addingRow.location)) {
      alert('Mahal/Bölge formatı zorunlu: Kelime1 - Kelime2 (ör. Alt Kat - 5 Nolu Daire)');
      focusCell('new', 'location');
      return;
    }
    setAddingSaving(true);
    const draftSnapshot = { ...addingRow };
    addingDraftRef.current = draftSnapshot;
    const preservedLocation = draftSnapshot.location.trim()
      || rows[rows.length - 1]?.location?.trim()
      || '';
    const preservedDetection = draftSnapshot.detectionScope.trim()
      || rows[rows.length - 1]?.detectionScope?.trim()
      || '';
    try {
      const rowToSave = mergeVendorMemoryIntoRow(draftSnapshot);
      const isLumpsum = rowToSave.pricingType === 'lumpsum';
      await onAdd({
        workGroupId: rowToSave.workGroupId,
        location: rowToSave.location ? validateAndFormatLocation(rowToSave.location) : undefined,
        jobDescription: rowToSave.jobDescription,
        description: rowToSave.description || undefined,
        quantity: parseFloat(rowToSave.quantity) || 1,
        unit: rowToSave.unit,
        salesUnitPrice: parseFloat(rowToSave.salesUnitPrice) || 0,
        supplierUnitPrice: parseFloat(rowToSave.supplierUnitPrice) || 0,
        pricingType: rowToSave.pricingType,
        lumpSumPrice: isLumpsum ? parseFloat(rowToSave.lumpSumPrice) || 0 : undefined,
        damageCategory: rowToSave.damageCategory,
        damageTypeId: rowToSave.damageTypeId || undefined,
        metrajData: buildRowPayload(rowToSave).metrajData,
      });
      persistVendorMemoryFromRow(rowToSave);
      const nextAddingRow = {
        ...emptyRow(preservedLocation),
        detectionScope: preservedDetection,
        damageCategory: rowToSave.damageCategory,
        workGroupId: rowToSave.workGroupId,
        unit: rowToSave.unit,
        damageTypeId: rowToSave.damageTypeId,
      };
      addingDraftRef.current = nextAddingRow;
      setAddingRow(nextAddingRow);
      setAddingDirty(false);
      setActiveCell({ rowIdx: 'new', col: 'jobDescription' });
      setTimeout(() => focusCell('new', 'jobDescription'), 0);
    } finally { setAddingSaving(false); }
  };

  const persistAddingRowIfNeeded = async (): Promise<string> => {
    const carryLocation = addingRow.location;
    if (!addingDirty || !addingRow.workGroupId || !addingRow.jobDescription.trim()) {
      return carryLocation;
    }
    await saveAddingRow();
    return carryLocation;
  };

  const quickAddRow = useCallback(async () => {
    if (!isEditable || quickAdding) return;

    setQuickAdding(true);
    try {
      await saveAllDirtyRows();
      await persistAddingRowIfNeeded();

      const lastRow = displayRows.length > 0 ? displayRows[displayRows.length - 1] : null;
      const location = addingRow.location.trim()
        || lastRow?.location?.trim()
        || '';
      const detectionScope = addingRow.detectionScope.trim()
        || lastRow?.detectionScope?.trim()
        || '';
      const nextAddingRow = {
        ...emptyRow(location),
        detectionScope,
        damageCategory: (lastRow?.damageCategory ?? addingRow.damageCategory ?? 'bina') as 'bina' | 'esya',
        workGroupId: lastRow?.workGroupId ?? addingRow.workGroupId ?? '',
        unit: lastRow?.unit ?? addingRow.unit ?? 'm²',
        damageTypeId: lastRow?.damageTypeId ?? addingRow.damageTypeId ?? '',
        pricingType: lastRow?.pricingType ?? addingRow.pricingType ?? 'unit',
      };
      addingDraftRef.current = nextAddingRow;
      setAddingRow(nextAddingRow);
      setAddingDirty(false);
      setActiveCell({ rowIdx: 'new', col: lastRow?.workGroupId ? 'jobDescription' : 'workGroup' });
      const focusCol = lastRow?.workGroupId ? 'jobDescription' : 'workGroup';
      setTimeout(() => focusCell('new', focusCol), 0);
    } finally {
      setQuickAdding(false);
    }
  }, [isEditable, quickAdding, displayRows, addingRow, saveAllDirtyRows, persistAddingRowIfNeeded]);

  useImperativeHandle(ref, () => ({
    quickAddRow,
    saveAllDirtyRows,
    hasDirtyRows: () => rows.some((r) => r._isDirty),
  }), [quickAddRow, saveAllDirtyRows, rows]);


  const COLS = ['damageCategory', 'detectionScope', 'location', 'workGroup', 'jobDescription', 'description', 'quantity', 'unit', 'salesUnitPrice', ...(viewMode === 'internal' ? ['supplierUnitPrice'] : []), 'total'];

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
          location: row.location ? normalizeLocationLabel(row.location) : undefined,
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
          location: row.location ? normalizeLocationLabel(row.location) : undefined,
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
    if (activeCell?.rowIdx === rowIdx && activeCell?.col === col) return 0;
    return -1;
  };

  const focusCell = (rowIdx: number | 'new', col: string) => {
    setActiveCell({ rowIdx, col });
    const cellKey = rowIdx === 'new' ? `new-${col}` : `${rowIdx}-${col}`;
    requestAnimationFrame(() => {
      const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${cellKey}"]`);
      el?.focus();
    });
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

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === 'new') {
        if (addingDirty) void saveAddingRow();
        return;
      }
      if (rowId) void saveRow(rowId);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === 'new') {
        const canSave = addingDirty && addingRow.workGroupId && addingRow.jobDescription.trim();
        if (canSave && colIdx === editableCOLS.length - 1) {
          void saveAddingRow();
          return;
        }
      }
      if (colIdx < editableCOLS.length - 1) {
        focusCell(rowIdx, editableCOLS[colIdx + 1]);
      } else {
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
      e.preventDefault();
      if (e.shiftKey) {
        if (colIdx > 0) {
          focusCell(rowIdx, editableCOLS[colIdx - 1]);
        } else if (rowIdx === 'new') {
          if (rows.length > 0) focusCell(rows.length - 1, editableCOLS[editableCOLS.length - 1]);
        } else if ((rowIdx as number) > 0) {
          focusCell((rowIdx as number) - 1, editableCOLS[editableCOLS.length - 1]);
        } else {
          focusCell('new', editableCOLS[editableCOLS.length - 1]);
        }
      } else if (colIdx < editableCOLS.length - 1) {
        focusCell(rowIdx, editableCOLS[colIdx + 1]);
      } else if (rowIdx !== 'new') {
        const nextRowIdx = (rowIdx as number) + 1;
        if (nextRowIdx < rows.length) focusCell(nextRowIdx, editableCOLS[0]);
        else focusCell('new', editableCOLS[0]);
      } else {
        focusCell('new', editableCOLS[0]);
      }
    }
  };

  const tableColSpan = (isEditable ? 1 : 0) + 9 + (viewMode === 'internal' ? 1 : 0) + 1 + (isEditable ? 1 : 0);

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
    {rows.length === 0 && isEditable && (
      <div className="flex flex-col items-center justify-center py-8 px-4 mb-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
        <p className="text-sm text-slate-500 mb-3">Henüz onarım kalemi eklenmemiş.</p>
        <button
          type="button"
          disabled={quickAdding}
          onClick={() => { void quickAddRow(); }}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
        >
          {quickAdding ? 'Ekleniyor...' : '+ Kalem Ekle'}
        </button>
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
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 w-20">Kategori</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 min-w-[90px]">Tespit</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 min-w-[90px]">Mahal/Bölge</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 min-w-[120px]">İş Grubu</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 min-w-[160px]">İş Tanımı</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 min-w-[140px]">Açıklama <span className="text-red-500">*</span></th>
            <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-20">Miktar</th>
            <th className="px-2 py-2 text-center text-slate-500 font-medium border-r border-slate-100 w-20">Birim</th>
            <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-24">Satış Fiyatı</th>
            {viewMode === 'internal' && (
              <th className="px-2 py-2 text-right text-slate-500 font-medium border-r border-slate-100 w-28">
                Maliyet
              </th>
            )}
            <th className="px-2 py-2 text-right text-slate-500 font-medium w-28">Toplam</th>
            {isEditable && <th className="min-w-[108px] px-1 py-2 text-center text-slate-500 font-medium border-l border-slate-100">İşlem</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {displayRows.flatMap((row, rowIdx) => {
            const total = calcTotal(row);
            const isSaving = savingId === row._id;
            const wgName = workGroups.find((wg: any) => wg.id === row.workGroupId)?.name ?? '';
            const rowSubGroups = resolveSubGroups(row.workGroupId);
            const subGroupsLoading = row.workGroupId ? loadingSubGroupIds.has(row.workGroupId) : false;
            const supplierVal = parseFloat(row.supplierUnitPrice) || 0;
            const salesVal = parseFloat(row.salesUnitPrice) || 0;
            const isLoss = viewMode === 'internal' && supplierVal > 0 && supplierVal > salesVal;

            const prev = rowIdx > 0 ? displayRows[rowIdx - 1] : null;
            const prevWgName = prev ? (workGroups.find((wg: any) => wg.id === prev.workGroupId)?.name ?? '') : '';
            const scopeLabel = row.detectionScope ? formatDisplayLabel(row.detectionScope) : 'Belirtilmemiş';
            const locLabel = row.location ? formatDisplayLabel(row.location) : 'Belirtilmemiş';
            const wgLabel = wgName ? formatDisplayLabel(wgName) : 'Belirtilmemiş';
            const headerNodes: React.ReactNode[] = [];

            if (!prev || (prev.detectionScope || '') !== (row.detectionScope || '')) {
              headerNodes.push(
                <tr key={`g-scope-${row._id}`} className="bg-indigo-50/70 border-t-2 border-indigo-100">
                  <td colSpan={tableColSpan} className="px-3 py-1.5 text-[10px] font-semibold text-indigo-800">
                    Tespit: {scopeLabel}
                  </td>
                </tr>,
              );
            }
            if (!prev || (prev.location || '') !== (row.location || '') || (prev.detectionScope || '') !== (row.detectionScope || '')) {
              headerNodes.push(
                <tr key={`g-loc-${row._id}`} className="bg-slate-100/80">
                  <td colSpan={tableColSpan} className="px-4 py-1 text-[10px] font-medium text-slate-700">
                    Mahal/Bölge: {locLabel}
                  </td>
                </tr>,
              );
            }
            if (!prev || prevWgName !== wgName || (prev.location || '') !== (row.location || '')) {
              headerNodes.push(
                <tr key={`g-wg-${row._id}`} className="bg-slate-50/90">
                  <td colSpan={tableColSpan} className="px-5 py-0.5 text-[10px] text-slate-600">
                    İş Grubu: {wgLabel}
                  </td>
                </tr>,
              );
            }

            const dataRow = (
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
                      onBlur={() => { void saveRow(row._id); }}
                      onChange={(e) => {
                        updateRowCategory(row._id, {
                          damageCategory: e.target.value as 'bina' | 'esya',
                          workGroupId: '',
                          jobDescription: '',
                        });
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
                {/* Tespit */}
                <td className={tdCls(rowIdx, 'detectionScope')}>
                  {isEditable ? (
                    <DetectionScopeInput
                      data-cell={`${rowIdx}-detectionScope`}
                      className={cellCls(rowIdx, 'detectionScope', true)}
                      value={row.detectionScope}
                      suggestions={detectionScopeList}
                      onChange={(v) => updateRow(row._id, 'detectionScope', v)}
                      onRegister={addDetectionScopeIfNew}
                      tabIndex={getCellTabIndex(rowIdx, 'detectionScope')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'detectionScope' })}
                      onBlur={() => { if (row._isDirty) void saveRow(row._id); }}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'detectionScope', row._id)}
                    />
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.detectionScope || '—'}</span>
                  )}
                </td>
                {/* Mahal/Bölge */}
                <td className={tdCls(rowIdx, 'location')}>
                  {isEditable ? (
                    <LocationInput
                      data-cell={`${rowIdx}-location`}
                      className={cellCls(rowIdx, 'location', true)}
                      value={row.location}
                      suggestions={locationList}
                      onChange={(v) => updateRow(row._id, 'location', v)}
                      onRegister={addLocationIfNew}
                      tabIndex={getCellTabIndex(rowIdx, 'location')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'location' })}
                      onBlur={() => { if (row._isDirty) void saveRow(row._id); }}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'location', row._id)}
                    />
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.location ? formatDisplayLabel(row.location) : '—'}</span>
                  )}
                </td>
                {/* İş Grubu */}
                <td className={tdCls(rowIdx, 'workGroup')}>
                  {isEditable ? (
                    <WorkGroupSelector
                      data-cell={`${rowIdx}-workGroup`}
                      className={cellCls(rowIdx, 'workGroup', true)}
                      value={row.workGroupId}
                      workGroups={filterWorkGroupsByCategory(workGroups, row.damageCategory)}
                      tabIndex={getCellTabIndex(rowIdx, 'workGroup')}
                      onFocus={() => { setActiveCell({ rowIdx, col: 'workGroup' }); loadSubGroups(row.workGroupId); }}
                      onBlur={() => { saveRow(row._id); }}
                      onSelect={(workGroupId) => {
                        updateRow(row._id, 'workGroupId', workGroupId);
                        updateRow(row._id, 'jobDescription', '');
                        updateRow(row._id, 'unit', 'm²');
                        void loadSubGroups(workGroupId);
                      }}
                      onAddNew={createWorkGroup}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'workGroup', row._id)}
                    />
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{wgName ? formatDisplayLabel(wgName) : '—'}</span>
                  )}
                </td>
                {/* İş Tanımı — sub-group varsa dropdown + inline yeni ekleme */}
                <td className={tdCls(rowIdx, 'jobDescription')}>
                  {isEditable ? (
                    row.workGroupId ? (
                      subGroupsLoading ? (
                        <span className="px-2 text-xs text-slate-400 block py-3">Yükleniyor...</span>
                      ) : (
                      <WorkDefinitionSelector
                        data-cell={`${rowIdx}-jobDescription`}
                        className={`${cellCls(rowIdx, 'jobDescription', true)} font-medium`}
                        value={row.jobDescription}
                        subGroups={rowSubGroups}
                        workGroupId={row.workGroupId}
                        tabIndex={getCellTabIndex(rowIdx, 'jobDescription')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'jobDescription' })}
                        onBlur={() => { saveRow(row._id); }}
                        onSelect={(v, unit) => {
                          setRows((prev) => prev.map((r) => {
                            if (r._id !== row._id) return r;
                            const merged = mergeVendorMemoryIntoRow({
                              ...r,
                              jobDescription: v,
                              unit: unit ?? r.unit,
                            });
                            return { ...r, ...merged, _isDirty: true };
                          }));
                        }}
                        onAddNew={createSubGroup}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'jobDescription', row._id)}
                      />
                      )
                    ) : (
                      <span className="px-2 text-xs text-slate-400 block py-3">Önce İş Grubu seçin</span>
                    )
                  ) : (
                    <span className="px-2 text-xs font-medium text-slate-800 block py-3">{row.jobDescription ? formatDisplayLabel(row.jobDescription) : '—'}</span>
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
                      onBlur={() => { saveRow(row._id); }}
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
                      <div className="relative flex items-center justify-end h-10 px-1">
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
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 pointer-events-none select-none">TL.</span>
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-right">
                        <span className="text-xs text-slate-500 block">{fmtCurrency(parseFloat(row.supplierUnitPrice))}</span>
                        {row.vendorQuotes?.preferredVendorName && (
                          <span className="text-[9px] text-slate-400 block truncate">
                            {formatDisplayLabel(row.vendorQuotes.preferredVendorName)}
                          </span>
                        )}
                      </div>
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
                  <td className="min-w-[108px] border-l border-slate-100 text-center px-1 py-1">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled={isSaving || !row._isDirty}
                          onClick={() => void saveRow(row._id)}
                          className="h-7 px-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-0.5 transition-colors text-[10px] font-medium"
                          title="Satırı Kaydet (Ctrl+Enter)"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          ↵
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled={isSaving || !row._isDirty}
                          onClick={() => revertRow(row._id)}
                          className="h-7 w-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-colors"
                          title="Geri Al"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled={isSaving || row._isDirty}
                          onClick={() => onDelete(row._id)}
                          className="h-7 w-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-colors"
                          title="Sil"
                        >
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5.5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                          </svg>
                        </button>
                      </div>
                      {viewMode === 'internal' && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setVendorModalRowId(row._id)}
                          className="w-full px-1 py-0.5 rounded text-[10px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 truncate max-w-[96px]"
                          title={row.vendorQuotes?.preferredVendorName ? formatDisplayLabel(row.vendorQuotes.preferredVendorName) : 'Tedarikçi fiyatlarını karşılaştır'}
                        >
                          {row.vendorQuotes?.preferredVendorName
                            ? formatDisplayLabel(row.vendorQuotes.preferredVendorName)
                            : 'Tedarikçi'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
            return [...headerNodes, dataRow];
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
                  onBlur={() => undefined}
                  onChange={(e) => { setAddingRow((p) => ({ ...p, damageCategory: e.target.value as 'bina' | 'esya', workGroupId: '', jobDescription: '' })); setAddingDirty(true); }}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'damageCategory')}
                >
                  <option value="bina">Bina</option>
                  <option value="esya">Eşya</option>
                </select>
              </td>
              {/* Tespit */}
              <td className={tdCls('new', 'detectionScope')}>
                <DetectionScopeInput
                  data-cell="new-detectionScope"
                  className={cellCls('new', 'detectionScope', true)}
                  value={addingRow.detectionScope}
                  suggestions={detectionScopeList}
                  onChange={(v) => { setAddingRow((p) => ({ ...p, detectionScope: v })); setAddingDirty(true); }}
                  onRegister={addDetectionScopeIfNew}
                  tabIndex={getCellTabIndex('new', 'detectionScope')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'detectionScope' })}
                  onBlur={() => undefined}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'detectionScope')}
                />
              </td>
              {/* Mahal/Bölge */}
              <td className={tdCls('new', 'location')}>
                <LocationInput
                  data-cell="new-location"
                  className={cellCls('new', 'location', true)}
                  value={addingRow.location}
                  suggestions={locationList}
                  onChange={(v) => { setAddingRow((p) => ({ ...p, location: v })); setAddingDirty(true); }}
                  onRegister={addLocationIfNew}
                  tabIndex={getCellTabIndex('new', 'location')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'location' })}
                  onBlur={() => undefined}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'location')}
                />
              </td>
              {/* İş Grubu */}
              <td className={tdCls('new', 'workGroup')}>
                <WorkGroupSelector
                  data-cell="new-workGroup"
                  className={cellCls('new', 'workGroup', true)}
                  value={addingRow.workGroupId}
                  workGroups={filterWorkGroupsByCategory(workGroups, addingRow.damageCategory)}
                  tabIndex={getCellTabIndex('new', 'workGroup')}
                  onFocus={() => setActiveCell({ rowIdx: 'new', col: 'workGroup' })}
                  onBlur={() => undefined}
                  onSelect={(workGroupId) => {
                    setAddingRow((p) => ({ ...p, workGroupId, jobDescription: '', unit: 'm²' }));
                    setAddingDirty(true);
                    void loadSubGroups(workGroupId);
                  }}
                  onAddNew={createWorkGroup}
                  onKeyDown={(e) => handleCellKeyDown(e, 'new', 'workGroup')}
                />
              </td>
              {/* İş Tanımı — sub-group varsa dropdown + inline yeni ekleme */}
              <td className={tdCls('new', 'jobDescription')}>
                {!addingRow.workGroupId ? (
                  <span className="px-2 text-xs text-slate-400 block py-3">Önce İş Grubu seçin</span>
                ) : loadingSubGroupIds.has(addingRow.workGroupId) ? (
                  <span className="px-2 text-xs text-slate-400 block py-3">Yükleniyor...</span>
                ) : (
                  <WorkDefinitionSelector
                    data-cell="new-jobDescription"
                    className={`${cellCls('new', 'jobDescription', true)} font-medium placeholder:font-normal`}
                    value={addingRow.jobDescription}
                    subGroups={resolveSubGroups(addingRow.workGroupId)}
                    workGroupId={addingRow.workGroupId}
                    tabIndex={getCellTabIndex('new', 'jobDescription')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'jobDescription' })}
                    onBlur={() => undefined}
                    onSelect={(v, unit) => {
                      setAddingRow((p) => mergeVendorMemoryIntoRow({ ...p, jobDescription: v, unit: unit ?? p.unit }));
                      setAddingDirty(true);
                    }}
                    onAddNew={createSubGroup}
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
                  onBlur={() => { const tv = toTitleCaseTR(addingRow.description.trim()); if (tv !== addingRow.description) setAddingRow((p) => ({ ...p, description: tv })); }}
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
                  onBlur={() => undefined}
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
                  <div className="relative flex items-center justify-end h-10 px-1">
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
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 pointer-events-none select-none">TL.</span>
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
              {isEditable && (
                <td className="min-w-[108px] border-l border-slate-100 text-center px-1 py-1">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={addingSaving || !addingDirty || !addingRow.workGroupId || !addingRow.jobDescription.trim()}
                      onClick={() => void saveAddingRow()}
                      className="h-7 px-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-0.5 transition-colors text-[10px] font-medium"
                      title="Satırı Kaydet (Ctrl+Enter)"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ↵
                    </button>
                    {viewMode === 'internal' && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setVendorModalRowId('new')}
                        className="w-full px-1 py-0.5 rounded text-[10px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 truncate max-w-[96px]"
                        title="Tedarikçi fiyatlarını karşılaştır"
                      >
                        Tedarikçi
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )}
        </tbody>
      </table>
      {isEditable && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { void quickAddRow(); }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            + Kalem Ekle
          </button>
          <p className="text-[10px] text-slate-400">
            {addingSaving ? 'Kaydediliyor...' : (
              <>
                <span className="font-medium">Enter</span> sonraki hücre ·{' '}
                <span className="font-medium">Ctrl+Enter</span> satırı kaydeder ·{' '}
                <span className="font-medium">Tab</span> tablo içinde kalır ·{' '}
                Mahal: Kelime1 - Kelime2
              </>
            )}
          </p>
        </div>
      )}
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

    {/* Tedarikçi Karşılaştırma Modal */}
    {vendorModalRowId !== null && (() => {
      if (vendorModalRowId === 'new') {
        return (
          <VendorQuoteModal
            open
            onClose={() => setVendorModalRowId(null)}
            data={addingRow.vendorQuotes}
            workGroupId={addingRow.workGroupId}
            jobDescription={addingRow.jobDescription}
            onChange={(next) => { setAddingRow((p) => ({ ...p, vendorQuotes: next })); setAddingDirty(true); }}
            onApplyPrice={(price, vendorName) => {
              setAddingRow((p) => ({
                ...p,
                supplierUnitPrice: price,
                vendorQuotes: {
                  ...p.vendorQuotes,
                  preferredVendorName: vendorName.trim() ? normalizeLocationLabel(vendorName) : p.vendorQuotes.preferredVendorName,
                },
              }));
              setAddingDirty(true);
              setVendorModalRowId(null);
            }}
          />
        );
      }
      const activeRow = rows.find((r) => r._id === vendorModalRowId);
      if (!activeRow) return null;
      return (
        <VendorQuoteModal
          open
          onClose={() => setVendorModalRowId(null)}
          data={activeRow.vendorQuotes}
          workGroupId={activeRow.workGroupId}
          jobDescription={activeRow.jobDescription}
          onChange={(next) => updateRow(vendorModalRowId, 'vendorQuotes', next)}
          onApplyPrice={(price, vendorName) => {
            updateRow(vendorModalRowId, 'supplierUnitPrice', price);
            if (vendorName.trim()) {
              updateRow(vendorModalRowId, 'vendorQuotes', {
                ...activeRow.vendorQuotes,
                preferredVendorName: normalizeLocationLabel(vendorName),
              });
            }
            setTimeout(() => void saveRow(vendorModalRowId), 50);
            setVendorModalRowId(null);
          }}
        />
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
});

// KalemForm ve KalemKarti kaldırıldı — EditableItemsTable ile değiştirildi.

// ─── Acil Yardım Rapor Editörü ────────────────────────────────────────────────
function EmergencyReportEditor({
  report,
  reportId,
  claimId,
  workGroups,
  onReload,
  onWorkGroupCreated,
}: {
  report: any;
  reportId: string;
  claimId: string;
  workGroups: any[];
  onReload: () => void;
  onWorkGroupCreated?: (workGroup: any) => void;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
  const [uploading, setUploading] = useState(false);
  const [localReport, setLocalReport] = useState(report);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const findingsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const itemsTableRef = useRef<EditableItemsTableHandle>(null);
  const claimPath = `/panel/hasar-dosyalari/${claimId}`;

  useEffect(() => {
    setLocalReport(report);
  }, [report]);

  const isEditable = localReport.status === 'draft' || localReport.status === 'rejected';

  const totalSupplierCost = localReport.items?.reduce((s: number, i: any) => s + (i.supplierTotal ?? 0), 0) ?? 0;
  const totalSalesAmount = localReport.items?.reduce((s: number, i: any) => s + (i.salesTotal ?? 0), 0) ?? 0;
  const grossProfit = totalSalesAmount - totalSupplierCost;
  const grossMarginPct = totalSalesAmount > 0 ? (grossProfit / totalSalesAmount) * 100 : 0;

  const handleAddItem = async (data: any) => {
    const res = await axios.post(`${API}/repair-reports/${reportId}/items`, data, { headers: authHeader() });
    const newItem = res.data.data;
    setLocalReport((prev: any) => {
      const items = sortReportItems([...(prev?.items ?? []), newItem]);
      return { ...prev, items, ...recomputeReportTotals(items) };
    });
  };

  const handleUpdateItem = async (itemId: string, data: any) => {
    const res = await axios.put(`${API}/repair-report-items/${itemId}`, data, { headers: authHeader() });
    const updatedItem = res.data.data;
    setLocalReport((prev: any) => {
      const items = sortReportItems((prev?.items ?? []).map((item: any) => item.id === itemId ? updatedItem : item));
      return { ...prev, items, ...recomputeReportTotals(items) };
    });
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Bu kalemi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/repair-report-items/${itemId}`, { headers: authHeader() });
      setLocalReport((prev: any) => {
        const items = (prev?.items ?? []).filter((item: any) => item.id !== itemId);
        return { ...prev, items, ...recomputeReportTotals(items) };
      });
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: any[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'damage');
        const res = await axios.post(`${API}/repair-reports/${reportId}/images`, fd, { headers: authHeader() });
        if (res.data?.data) uploaded.push(res.data.data);
      }
      if (uploaded.length > 0) {
        setLocalReport((prev: any) => ({
          ...prev,
          images: [...(prev?.images ?? []), ...uploaded],
        }));
      }
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
      setLocalReport((prev: any) => ({
        ...prev,
        images: (prev?.images ?? []).filter((img: any) => img.id !== imageId),
      }));
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
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => router.push(claimPath)} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{report.reportNo}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Acil Yardım</span>
            <span className="text-xs text-slate-400">{fmtDateTime(report.reportDate ?? report.createdAt)}</span>
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
          <SectionCard
            title="İş Kalemleri"
          >
            <EditableItemsTable
              ref={itemsTableRef}
              items={localReport.items ?? []}
              workGroups={workGroups}
              damageTypes={[]}
              reportType={localReport.reportType ?? 'emergency'}
              isEditable={isEditable}
              viewMode={viewMode}
              onSave={handleUpdateItem}
              onDelete={handleDeleteItem}
              onAdd={handleAddItem}
              onWorkGroupCreated={onWorkGroupCreated}
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
                      src={getReportImageUrl(img.storageKey)}
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
  const handleWorkGroupCreated = useCallback((workGroup: any) => {
    if (!workGroup?.id) return;
    setWorkGroups((prev) => {
      if (prev.some((wg) => wg.id === workGroup.id)) return prev;
      return [...prev, workGroup].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || String(a.name).localeCompare(String(b.name), 'tr'));
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
  const [showAnnotation, setShowAnnotation] = useState<any>(null);
  const [damageFilter, setDamageFilter] = useState<string>('all');
  const [showDamageTypeModal, setShowDamageTypeModal] = useState(false);
  const [damageTypeForm, setDamageTypeForm] = useState({ code: '', name: '' });
  const [damageReasonOptions, setDamageReasonOptions] = useState<DamageReasonOption[]>([]);
  const [loadingDamageReasons, setLoadingDamageReasons] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppRecipientKey, setWhatsAppRecipientKey] = useState('');
  const [whatsAppManualMode, setWhatsAppManualMode] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestApprovalModal, setShowRequestApprovalModal] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [confirmSendWithoutImages, setConfirmSendWithoutImages] = useState(false);
  const [itemsApprovalError, setItemsApprovalError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showExternalApprovalModal, setShowExternalApprovalModal] = useState(false);
  const [externalApprovalForm, setExternalApprovalForm] = useState({
    approverType: 'expert' as 'expert' | 'insurance_company',
    approverName: '',
    approverEmail: '',
    approverPhone: '',
    channel: 'email' as 'email' | 'whatsapp',
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
  const itemsTableRef = useRef<EditableItemsTableHandle>(null);
  const [dirtyItemCount, setDirtyItemCount] = useState(0);
  const [sessionSaveCount, setSessionSaveCount] = useState(0);
  const [sessionCancelCount, setSessionCancelCount] = useState(0);
  const [showSaveReminderModal, setShowSaveReminderModal] = useState(false);
  const [writeElapsedLabel, setWriteElapsedLabel] = useState('');
  const lastWriteActivityRef = useRef<number>(Date.now());
  // Önerilen kalemler (şablon önerileri)
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [templateSuggestions, setTemplateSuggestions] = useState<any[]>([]);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState<Set<string>>(new Set());
  const [addingTemplateItems, setAddingTemplateItems] = useState(false);
  const [quickDamageTypes, setQuickDamageTypes] = useState<string[]>([]);
  const [quickDamageSize, setQuickDamageSize] = useState('MEDIUM');
  const [showQuickRepairModal, setShowQuickRepairModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revising, setRevising] = useState(false);
  const legalNotesRef = useRef<HTMLTextAreaElement>(null);
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
      const inferredQuickTypes = inferQuickDamageTypesFromReport(rRes.data.data);
      const storedQuickTypes = rRes.data.data?.quickDamageTypes ?? [];
      setQuickDamageTypes(storedQuickTypes.length > 0 ? storedQuickTypes : inferredQuickTypes);
      setQuickDamageSize(rRes.data.data?.quickDamageSize ?? 'MEDIUM');
      setWorkGroups(wgRes.data.data || []);

      // Load approval history
      try {
        const hRes = await axios.get(`${API}/repair-reports/${reportId}/approval-history`, { headers: authHeader() });
        const fromApi = hRes.data.data || [];
        setApprovalHistory(fromApi.length > 0 ? fromApi : (rRes.data.data?.approvalHistory ?? []));
      } catch (_) {
        setApprovalHistory(rRes.data.data?.approvalHistory ?? []);
      }

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

  useEffect(() => {
    if (!reportId || !report) return;
    const editable = report.status === 'draft' || report.status === 'rejected';
    if (!editable) return;
    const startedAt = new Date().toISOString();
    sessionStorage.setItem('report-write-started-at', JSON.stringify({
      reportId,
      claimFileId: claimId,
      startedAt,
      lastActivityAt: startedAt,
      // Personel analitiği için ileride backend/BI tüketecek (B-21)
    }));
  }, [report, reportId, claimId]);

  const touchWriteActivity = useCallback(() => {
    lastWriteActivityRef.current = Date.now();
    try {
      const raw = sessionStorage.getItem('report-write-started-at');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { reportId?: string; startedAt?: string };
      if (parsed.reportId !== reportId) return;
      sessionStorage.setItem('report-write-started-at', JSON.stringify({
        ...parsed,
        reportId,
        claimFileId: claimId,
        lastActivityAt: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
  }, [reportId, claimId]);

  useEffect(() => {
    const tick = () => {
      try {
        const raw = sessionStorage.getItem('report-write-started-at');
        if (!raw) {
          setWriteElapsedLabel('');
          return;
        }
        const parsed = JSON.parse(raw) as { reportId?: string; startedAt?: string };
        if (parsed.reportId !== reportId || !parsed.startedAt) {
          setWriteElapsedLabel('');
          return;
        }
        const mins = Math.floor((Date.now() - new Date(parsed.startedAt).getTime()) / 60000);
        setWriteElapsedLabel(mins < 1 ? '<1 dk' : `${mins} dk`);
      } catch {
        setWriteElapsedLabel('');
      }
    };
    tick();
    const interval = window.setInterval(tick, 30000);
    return () => window.clearInterval(interval);
  }, [reportId]);

  useEffect(() => {
    touchWriteActivity();
  }, [pendingFields, dirtyItemCount, touchWriteActivity]);

  useEffect(() => {
    const editable = report?.status === 'draft' || report?.status === 'rejected';
    if (!editable) return;
    const interval = window.setInterval(() => {
      const hasPending = Object.keys(pendingFields).length > 0;
      const idleMs = Date.now() - lastWriteActivityRef.current;
      if (hasPending && idleMs >= 2 * 60 * 1000) {
        setShowSaveReminderModal(true);
        lastWriteActivityRef.current = Date.now();
      }
      const hasDirtyItems = dirtyItemCount > 0;
      if (!hasPending && hasDirtyItems && idleMs >= 3 * 60 * 1000) {
        setShowSaveReminderModal(true);
        lastWriteActivityRef.current = Date.now();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [report?.status, pendingFields, dirtyItemCount]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingFields).length > 0 || dirtyItemCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pendingFields, dirtyItemCount]);

  useEffect(() => {
    if (!showShareMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showShareMenu]);

  const shareRecipients = useMemo(
    () => (report ? buildRepairReportShareRecipients(report) : []),
    [report],
  );

  const pendingInsurancePortalApproval = useMemo(
    () => externalApprovals.find(
      (ea) => ea.approverType === 'insurance_company'
        && ea.channel === 'in_app'
        && ea.status === 'pending'
        && new Date(ea.expiresAt) > new Date(),
    ),
    [externalApprovals],
  );

  const fileExpert = useMemo(() => resolveFileExpertDisplay(report), [report]);

  const insuredName = useMemo(
    () => resolveInsuredDisplayName(report?.claimFile),
    [report?.claimFile],
  );

  const quickDamageTypeOptions = useMemo(() => {
    const inferred = inferQuickDamageTypesFromReport(report);
    return filterQuickDamageTypeOptions(inferred);
  }, [report]);

  const latestSubmission = useMemo(
    () => approvalHistory.find((h) => h.action === 'pending_approval'),
    [approvalHistory],
  );

  const latestApprovalDecision = useMemo(
    () => approvalHistory.find((h) => h.action === 'approved' || h.action === 'rejected'),
    [approvalHistory],
  );

  const openWhatsAppModal = useCallback(() => {
    const first = shareRecipients[0];
    setWhatsAppRecipientKey(first?.key ?? '');
    setWhatsAppPhone(first?.phone ?? '');
    setWhatsAppManualMode(shareRecipients.length === 0);
    setShowWhatsApp(true);
    setShowShareMenu(false);
  }, [shareRecipients]);

  useEffect(() => {
    if (!report?.departmentId) {
      setDamageReasonOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingDamageReasons(true);
    void resolveDamageReasonOptions(report.departmentId)
      .then((options) => {
        if (!cancelled) setDamageReasonOptions(options);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingDamageReasons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report?.departmentId, report?.claimFile?.lossType, report?.claimFile?.claimSubjectId]);

  const handleRevise = () => setShowReviseModal(true);

  const confirmRevise = async (payload: ReviseReportPayload) => {
    setRevising(true);
    try {
      const res = await axios.post(
        `${API}/repair-reports/${reportId}/revise`,
        payload,
        { headers: authHeader() },
      );
      setShowReviseModal(false);
      router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${res.data.data.id}`);
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Revizyon Oluşturulamadı');
    } finally {
      setRevising(false);
    }
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
    try {
      await axios.post(`${API}/damage-reports/${reportId}/repair-items`, {
        damageTypes: quickDamageTypes,
        fileId: claimId,
        items: items.map((item) => ({ workSubGroupId: item.workSubGroupId, quantity: item.quantity, note: item.note })),
      }, { headers: authHeader() });
      if (quickDamageTypes.length > 0) {
        await axios.put(`${API}/repair-reports/${reportId}`, {
          quickDamageTypes,
          quickDamageSize,
        }, { headers: authHeader() });
      }
      await loadKeepScroll();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Hızlı onarım kalemleri eklenemedi. Lütfen tekrar deneyin.');
      throw err;
    }
  };

  const handleSendExternalApproval = async () => {
    if (!externalApprovalForm.approverName && !externalApprovalForm.approverEmail) {
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
    const findingsText = getEffectiveFindingsText(report, pendingFields, bulgularTextareaRef.current);
    const validation = validateApprovalRequirements(report, findingsText);
    if (!validation.ok) {
      if (validation.findingsError) setFindingsError(validation.findingsError);
      if (validation.itemsError) setItemsApprovalError(validation.itemsError);
      return;
    }
    const hasImages = (report?.images?.length ?? 0) > 0;
    if (!hasImages && !confirmSendWithoutImages) return;

    setRequestingApproval(true);
    try {
      if (Object.keys(pendingFields).length > 0) {
        await axios.put(`${API}/repair-reports/${reportId}`, pendingFields, { headers: authHeader() });
        setPendingFields({});
      }
      await axios.post(`${API}/repair-reports/${reportId}/request-approval`, {}, { headers: authHeader() });
      setShowRequestApprovalModal(false);
      setConfirmSendWithoutImages(false);
      setItemsApprovalError(null);
      await load();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Hata Oluştu'); }
    finally { setRequestingApproval(false); }
  };

  const beginRequestApproval = () => {
    const findingsText = getEffectiveFindingsText(report, pendingFields, bulgularTextareaRef.current);
    const validation = validateApprovalRequirements(report, findingsText);

    if (validation.findingsError) {
      setFindingsError(validation.findingsError);
      setItemsApprovalError(null);
      document.getElementById('tespit-bulgulari-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFindingsError(null);

    if (validation.itemsError) {
      setItemsApprovalError(validation.itemsError);
      document.getElementById('onarim-kalemleri-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setItemsApprovalError(null);
    setConfirmSendWithoutImages(false);
    setShowRequestApprovalModal(true);
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
    touchWriteActivity();
  };

  const handleSaveReport = async () => {
    setFindingsError(null);
    setSaving(true);
    try {
      await itemsTableRef.current?.saveAllDirtyRows();
      if (Object.keys(pendingFields).length > 0) {
        await axios.put(`${API}/repair-reports/${reportId}`, pendingFields, { headers: authHeader() });
        setPendingFields({});
      }
      setSessionSaveCount((n) => n + 1);
      await loadKeepScroll();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Kayıt Başarısız');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedReportFields = Object.keys(pendingFields).length > 0;

  const handleCancelChanges = () => {
    setSessionCancelCount((n) => n + 1);
    if (Object.keys(pendingFields).length === 0 && dirtyItemCount === 0) {
      router.push(claimPath);
      return;
    }
    if (!confirm('Kaydedilmemiş değişiklikler var. Değişiklikleri iptal etmek istiyor musunuz?')) return;
    setPendingFields({});
    void loadKeepScroll();
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
    const res = await axios.post(`${API}/repair-reports/${reportId}/items`, itemData, { headers: authHeader() });
    const newItem = res.data.data;
    setReport((prev: any) => {
      const items = sortReportItems([...(prev?.items ?? []), newItem]);
      return { ...prev, items, ...recomputeReportTotals(items) };
    });
  };

  const handleUpdateItemMain = async (itemId: string, data: any) => {
    const res = await axios.put(`${API}/repair-report-items/${itemId}`, data, { headers: authHeader() });
    const updatedItem = res.data.data;
    setReport((prev: any) => {
      const items = sortReportItems((prev?.items ?? []).map((item: any) => item.id === itemId ? updatedItem : item));
      return { ...prev, items, ...recomputeReportTotals(items) };
    });
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Bu kalemi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/repair-report-items/${itemId}`, { headers: authHeader() });
      setReport((prev: any) => {
        const items = (prev?.items ?? []).filter((item: any) => item.id !== itemId);
        return { ...prev, items, ...recomputeReportTotals(items) };
      });
    } catch (e) { console.error(e); }
  };

  const handleSaveAnnotation = async (imageId: string, blob: Blob) => {
    try {
      const fd = new FormData();
      fd.append('file', blob, `annotated-${imageId}.png`);
      fd.append('category', 'annotated');
      const res = await axios.post(`${API}/repair-reports/${reportId}/images`, fd, {
        headers: authHeader(),
      });
      const uploaded = res.data?.data;
      if (uploaded) {
        setReport((prev: any) => ({
          ...prev,
          images: (prev?.images ?? []).map((img: any) => img.id === imageId ? { ...img, ...uploaded, hasAnnotation: true } : img),
        }));
      }
      setShowAnnotation(null);
    } catch (e) {
      console.error(e);
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          await axios.put(`${API}/report-images/${imageId}/annotation`, { annotationData: ev.target?.result }, { headers: authHeader() });
          setShowAnnotation(null);
        };
        reader.readAsDataURL(blob);
      } catch (_) {
        alert('Anotasyon kaydedilemedi.');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingCat(category);
    const uploaded: any[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        const res = await axios.post(`${API}/repair-reports/${reportId}/images`, fd, {
          headers: authHeader(),
        });
        if (res.data?.data) uploaded.push(res.data.data);
      }
      if (uploaded.length > 0) {
        setReport((prev: any) => ({
          ...prev,
          images: [...(prev?.images ?? []), ...uploaded],
        }));
      }
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
      setReport((prev: any) => ({
        ...prev,
        images: (prev?.images ?? []).filter((img: any) => img.id !== imageId),
      }));
    } catch (e) { console.error(e); }
  };

  const handleDownloadPdf = async (view: 'internal' | 'external') => {
    try {
      const res = await axios.get(`${API}/repair-reports/${reportId}/pdf?view=${view}`, {
        headers: authHeader(), responseType: 'blob',
      });
      const contentType = String(res.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (res.data as Blob).text();
        let message = 'PDF indirilemedi.';
        try { message = JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
        alert(message);
        return;
      }
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const suffix = view === 'internal' ? 'Ic' : 'Dis';
      a.href = url; a.download = `hasar-raporu-${suffix}-${reportId}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      setShowShareMenu(false);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'PDF indirilemedi. Lütfen tekrar deneyin.');
      console.error(e);
    }
  };

  if (loading || !report) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;

  const imageCats = REPORT_IMAGE_CATEGORY_LABELS;
  const catColor: Record<string, string> = { before: 'bg-blue-100 text-blue-700', damage: 'bg-red-100 text-red-700', after: 'bg-green-100 text-green-700' };

  // Saha personeli maliyet gizleme
  const normalizedRoleCode = String(currentUser?.role?.code ?? currentUser?.roleCode ?? '').toLowerCase();
  const isFieldStaff = normalizedRoleCode === 'field_staff';
  // Saha personeli her zaman dış görünüm görsün
  const effectiveViewMode = isFieldStaff ? 'external' : viewMode;

  // Acil Yardım raporu ise ayrı editörü kullan
  const isEditable = (report.status === 'draft' || report.status === 'rejected') && !isFieldStaff;
  const canManageApproval = ['admin', 'ops_manager', 'manager'].includes(normalizedRoleCode);
  const showExternalChannelButton = ['approved', 'sent_for_external_approval', 'externally_rejected'].includes(report.status);

  if (report.reportType === 'emergency') {
    return (
      <EmergencyReportEditor
        report={report}
        reportId={reportId}
        claimId={claimId}
        workGroups={workGroups}
        onReload={load}
        onWorkGroupCreated={handleWorkGroupCreated}
      />
    );
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => {
          if (hasUnsavedReportFields || dirtyItemCount > 0) {
            setShowSaveReminderModal(true);
            return;
          }
          router.push(claimPath);
        }} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{report.reportNo}</h2>
          <p className="text-xs text-slate-400">
            {report.reportType === 'single' ? 'Tek Hasarlı' : 'Çok Hasarlı'} · {fmtDateTime(report.reportDate ?? report.createdAt)}
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
        {pendingInsurancePortalApproval && (
          <Badge text="Sigorta Portalında · Bekliyor" color="bg-indigo-100 text-indigo-700" />
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap relative z-10">
          {/* İş akışı */}
          {report.status === 'approved' && (
            <button type="button"
              onClick={handleRevise}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
            >
              Revize Et
            </button>
          )}
          {(report.status === 'draft' || report.status === 'rejected') && (
            <button type="button"
              onClick={beginRequestApproval}
              className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600"
            >
              Onaya Gönder
            </button>
          )}
          {report.status === 'pending_approval' && canManageApproval && (
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
          {showExternalChannelButton && (
            <button type="button"
              onClick={() => {
                setExternalApprovalForm((f) => ({
                  ...f,
                  approverType: 'expert',
                  channel: 'email',
                  approverName: report.expertOffice?.companyName ?? '',
                }));
                setShowExternalApprovalModal(true);
              }}
              className="text-xs border border-blue-200 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-100"
            >
              E-posta / WhatsApp ile Gönder
            </button>
          )}

          <div className="hidden sm:block h-6 w-px bg-slate-200" aria-hidden />

          {/* Görünüm */}
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

          {/* Paylaş */}
          <div className="relative" ref={shareMenuRef}>
            <button
              type="button"
              onClick={() => setShowShareMenu((v) => !v)}
              className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1.5"
            >
              <IconDocumentDownload />
              Paylaş
              <IconChevronDown />
            </button>
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl z-20">
                <button
                  type="button"
                  onClick={() => void handleDownloadPdf('external')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <IconDocumentDownload className="w-4 h-4 text-slate-500" />
                  PDF (Müşteri)
                </button>
                {!isFieldStaff && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf('internal')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <IconDocumentDownload className="w-4 h-4 text-indigo-500" />
                    PDF (İç)
                  </button>
                )}
                <button
                  type="button"
                  onClick={openWhatsAppModal}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onay durumu özeti */}
      {(latestSubmission || latestApprovalDecision) && report.status !== 'draft' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
          {latestSubmission && (
            <p>
              <span className="font-medium text-slate-800">Onaya Gönderildi:</span>{' '}
              {fmtDateTime(latestSubmission.createdAt)}
              {' · '}
              <span className="text-slate-600">Gönderen: {approvalActorName(latestSubmission.user)}</span>
              {!fileExpert.missing && (
                <>
                  {' · '}
                  <span className="text-slate-600">Dosya Eksperi: {fileExpert.name}</span>
                </>
              )}
            </p>
          )}
          {latestApprovalDecision?.action === 'approved' && (
            <p>
              <span className="font-medium text-green-800">Onaylandı:</span>{' '}
              {fmtDateTime(latestApprovalDecision.createdAt)}
              {' · '}
              <span className="text-slate-600">Onaylayan: {approvalActorName(latestApprovalDecision.user)}</span>
            </p>
          )}
          {latestApprovalDecision?.action === 'rejected' && (
            <p>
              <span className="font-medium text-red-800">Reddedildi:</span>{' '}
              {fmtDateTime(latestApprovalDecision.createdAt)}
              {' · '}
              <span className="text-slate-600">Reddeden: {approvalActorName(latestApprovalDecision.user)}</span>
              {latestApprovalDecision.reason && (
                <span className="block text-xs text-red-600 mt-0.5 italic">Neden: {latestApprovalDecision.reason}</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Dosya Bilgileri */}
      <SectionCard
        title="Dosya Bilgileri"
        action={
          report.reportType === 'multi' && isEditable ? (
            <button type="button" onClick={() => setShowDamageTypeModal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">+ Hasar Nedeni</button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Sigorta Şirketi', value: report.claimFile?.insuranceCompany?.name },
            { label: 'Hasar Dosya No', value: report.claimFile?.fileNo },
            { label: 'İhbar Tarihi', value: resolveIhbarTarihi(report.claimFile ?? {}) },
            { label: 'Hasar Konusu', value: resolveClaimIhbarKonusu(report.claimFile ?? {}) },
            { label: 'Sigortalı', value: insuredName },
            { label: 'Dosya Eksperi', value: fileExpert.missing ? 'Atanmamış' : fileExpert.name },
            { label: 'Hasar Adresi', value: report.claimFile?.propertyAddress ? `${report.claimFile.propertyAddress.addressLine}, ${report.claimFile.propertyAddress.city}` : undefined },
            {
              label: 'Hasar Nedeni',
              value: report.reportType === 'single'
                ? (report.damageTypes?.[0]?.damageTypeName ? formatDisplayLabel(report.damageTypes[0].damageTypeName) : undefined)
                : undefined,
            },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800">{f.value ?? '—'}</p>
            </div>
          ))}
        </div>
      <div className="mt-4">
          <RevisionHistoryStrip reportId={reportId as string} embedded compact />
        </div>
        {report.reportType === 'multi' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">Hasar Nedenleri</p>
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
          </div>
        )}
      </SectionCard>

      <SectionCard title="Hızlı Onarım Türü">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Hasar Türü</p>
            <div className="flex flex-wrap gap-2">
              {quickDamageTypeOptions.map((option) => {
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
            ⚡ Hızlı Onarım Türü Ekle
          </button>
          {quickDamageTypes.length > 0 && (
            <p className="text-xs text-slate-400">{quickDamageTypes.map(damageTypeLabel).join(' + ')} ({damageSizeLabel(quickDamageSize)}) için öneri alınacak.</p>
          )}
        </div>
      </SectionCard>

      {/* Tespit Bulguları */}
      <SectionCard title="Tespit Bulguları *" id="tespit-bulgulari-section">
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
      <SectionCard title="Onarım Kalemleri" id="onarim-kalemleri-section" action={
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
          ref={itemsTableRef}
          items={sortReportItems(damageFilter === 'all' ? (report.items ?? []) : (report.items ?? []).filter((i: any) => i.damageTypeId === damageFilter))}
          workGroups={workGroups}
          damageTypes={report.damageTypes ?? []}
          reportType={report.reportType}
          isEditable={isEditable}
          viewMode={effectiveViewMode}
          onSave={handleUpdateItemMain}
          onDelete={handleRemoveItem}
          onAdd={handleAddItem}
          onDirtyChange={setDirtyItemCount}
          onWorkGroupCreated={handleWorkGroupCreated}
        />
        {itemsApprovalError && (
          <p className="text-xs text-red-500 mt-3">{itemsApprovalError}</p>
        )}

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
                <p className="text-xs font-semibold text-slate-500 tracking-wide">Hasar Toplam Özeti</p>
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
            <p className="text-xs font-semibold text-slate-500 tracking-wide mb-3">Hasar Nedeni Bazlı Özet</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400">
                    <th className="text-center px-3 py-2">Hasar Nedeni</th>
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

      {/* Dosya Bütçesi — sadece tam görünümde */}
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
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" multiple className="hidden" disabled={uploadingCat !== null} onChange={(e) => handleImageUpload(e, cat)} />
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
                  src={getReportImageUrl(img.hasAnnotation && img.annotatedKey ? img.annotatedKey : img.storageKey)}
                  alt={img.caption ?? img.category}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" fill="%239ca3af" font-size="12">Yüklenemedi</text></svg>'; }}
                />
                <div className="absolute top-1.5 right-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm ${catColor[img.category] ?? 'bg-slate-100 text-slate-600'}`}>
                    {imageCats[img.category] ?? img.category}
                  </span>
                </div>
                {img.hasAnnotation && (
                  <div className="absolute top-1.5 left-1.5">
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

      {/* Yasal Notlar */}
      <SectionCard title="Yasal Notlar ve Uyarılar">
        {isEditable && (
          <>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Sigorta şirketi ve sigortalıya gidecek PDF&apos;te yer alacak uyarılar: KDV ve fiyat geçerliliği, garanti süresi,
              teminat/muafiyet sınırı, ön tespit bildirimi. Boş bırakırsanız PDF&apos;te sistem varsayılan metinleri kullanır;
              özelleştirmek için şablonları veya «Önerilen Notları Ekle»yi kullanın.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
            {LEGAL_NOTE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  const el = legalNotesRef.current;
                  if (!el) return;
                  const current = el.value.trim();
                  el.value = current ? `${current}\n\n${tpl.text}` : tpl.text;
                  handleUpdateField('legalNotes', el.value);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
              >
                {tpl.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const el = legalNotesRef.current;
                if (!el) return;
                el.value = buildSuggestedLegalNotesText();
                handleUpdateField('legalNotes', el.value);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
            >
              Önerilen Notları Ekle
            </button>
          </div>
          </>
        )}
        {!isEditable && !report.legalNotes?.trim() && (
          <p className="text-xs text-slate-400 mb-2 italic">Bu raporda özel yasal not girilmemiş; PDF&apos;te varsayılan metinler basılır.</p>
        )}
        <textarea
          ref={legalNotesRef}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-blue-300 resize-y min-h-[60px]"
          rows={3}
          placeholder="Yasal Uyarılar ve Notlar..."
          defaultValue={report.legalNotes ?? ''}
          onBlur={(e) => handleUpdateField('legalNotes', e.target.value)}
          readOnly={!isEditable}
        />
      </SectionCard>
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 shadow-[0_-8px_30px_rgba(15,23,42,0.35)] px-4 sm:px-6 py-3 z-30">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400 tabular-nums min-w-0">
            {isEditable && writeElapsedLabel && (
              <span>Süre: {writeElapsedLabel}</span>
            )}
            {isEditable && (
              <span>Kayıt: {sessionSaveCount} · İptal: {sessionCancelCount}</span>
            )}
          </div>
          <div className="flex items-center justify-center min-w-0">
            {effectiveViewMode === 'internal' && !isFieldStaff && (
              <FinancialSummaryBar
                totalSupplierCost={report.totalSupplierCost}
                totalSalesAmount={report.totalSalesAmount}
                grossProfit={report.grossProfit}
                grossMarginPct={report.grossMarginPct}
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            {isEditable && (
              <span className="lg:hidden text-[11px] text-slate-400 tabular-nums mr-1">
                {writeElapsedLabel && `${writeElapsedLabel} · `}Kayıt: {sessionSaveCount} · İptal: {sessionCancelCount}
              </span>
            )}
            {isEditable && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleCancelChanges()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-500 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  İptal ({sessionCancelCount})
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={handleSaveReport}
                  disabled={saving || !hasUnsavedReportFields}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                    hasUnsavedReportFields
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-slate-700 text-slate-400 cursor-default'
                  } disabled:opacity-50`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {saving ? 'Kaydediliyor...' : `Kaydet (${sessionSaveCount})`}
                </button>
              </>
            )}

            {/* Onaylanmış: Revize Et */}
            {!isEditable && report.status === 'approved' && (
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
            {!isEditable && report.status === 'externally_approved' && (
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
          imageUrl={getReportImageUrl(showAnnotation.hasAnnotation && showAnnotation.annotatedKey ? showAnnotation.annotatedKey : showAnnotation.storageKey)}
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
                <label className="text-xs text-slate-500 block mb-1">Hasar Nedeni</label>
                {loadingDamageReasons ? (
                  <p className="text-sm text-slate-400 py-2">Hasar nedenleri yükleniyor…</p>
                ) : damageReasonOptions.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Bu dosya için tanımlı hasar nedeni bulunamadı.
                  </p>
                ) : (
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={damageTypeForm.code}
                    onChange={(e) => {
                      const code = e.target.value;
                      const reason = damageReasonOptions.find((row) => row.code === code);
                      setDamageTypeForm({ code, name: reason?.name ?? code });
                    }}>
                    <option value="">Seçin...</option>
                    {damageReasonOptions.map((reason) => (
                      <option key={reason.code} value={reason.code}>{reason.name}</option>
                    ))}
                  </select>
                )}
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
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">WhatsApp ile Gönder</h3>
                <p className="text-xs text-slate-400">Alıcıyı seçin, rapor linki hazır gelsin</p>
              </div>
            </div>
            <div className="space-y-3">
              {shareRecipients.length > 0 && !whatsAppManualMode ? (
                <div>
                  <label className="text-xs text-slate-500 block mb-2">Alıcı</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {shareRecipients.map((recipient) => (
                      <label
                        key={recipient.key}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${whatsAppRecipientKey === recipient.key ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <input
                          type="radio"
                          name="whatsapp-recipient"
                          className="mt-0.5 text-green-600"
                          checked={whatsAppRecipientKey === recipient.key}
                          onChange={() => {
                            setWhatsAppRecipientKey(recipient.key);
                            setWhatsAppPhone(recipient.phone);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800">{recipient.label}</span>
                          {recipient.subtitle && (
                            <span className="block text-xs text-slate-500 truncate">{recipient.subtitle}</span>
                          )}
                          <span className="block text-xs text-slate-400 mt-0.5">+90 {recipient.phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4')}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsAppManualMode(true)}
                    className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Farklı Numara Gir
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Telefon Numarası</label>
                  <div className="flex gap-2">
                    <span className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600">+90</span>
                    <input
                      type="tel"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="5XX XXX XX XX"
                      value={whatsAppPhone}
                      onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                    />
                  </div>
                  {shareRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWhatsAppManualMode(false);
                        const first = shareRecipients[0];
                        setWhatsAppRecipientKey(first.key);
                        setWhatsAppPhone(first.phone);
                      }}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Dosyadan Alıcı Seç
                    </button>
                  )}
                  {shareRecipients.length === 0 && (
                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Bu dosyada kayıtlı telefon bulunamadı. Numarayı manuel girebilir veya boş bırakarak WhatsApp Web açabilirsiniz.
                    </p>
                  )}
                </div>
              )}
              <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800">
                WhatsApp Web açılır; rapor linki mesaj kutusunda hazır gelir.
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button"
                onClick={async () => {
                  try {
                    const res = await axios.get(`${API}/repair-reports/${reportId}/share-link`, { headers: authHeader() });
                    const { url } = res.data.data;
                    const digits = whatsAppPhone.replace(/\D/g, '');
                    const finalUrl = digits
                      ? `https://wa.me/90${digits}?text=${encodeURIComponent(`Hasar Onarım Raporu (${report.reportNo}): ${url}`)}`
                      : `https://wa.me/?text=${encodeURIComponent(`Hasar Onarım Raporu (${report.reportNo}): ${url}`)}`;
                    window.open(finalUrl, '_blank');
                    setShowWhatsApp(false);
                  } catch (e: any) {
                    alert(e?.response?.data?.message ?? 'Paylaşım linki alınamadı.');
                    console.error(e);
                  }
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

      {showRequestApprovalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Onaya Gönder — Son Teyit</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rapor onay sürecine alınmadan önce dosya eksperi ve gönderim bilgilerini kontrol edin.
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Dosya Eksperi</p>
                {fileExpert.missing ? (
                  <p className="text-sm font-semibold text-amber-700">Bu dosyada atanmış eksper bulunamadı</p>
                ) : (
                  <p className="text-sm font-semibold text-slate-900">{fileExpert.name}</p>
                )}
              </div>

              {fileExpert.missing ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-5">
                  Eksper atanmadan onaya göndermek operasyon riski oluşturabilir. Devam etmeden önce dosyada eksper atamasını kontrol edin.
                </div>
              ) : (
                <p className="text-sm text-slate-700 leading-6">
                  <span className="font-medium text-slate-900">{fileExpert.name}</span> dosya eksperi kapsamında
                  {' '}
                  <span className="font-medium">{report.reportNo}</span>
                  {' '}
                  numaralı rapor onay sürecine alınacaktır. Onay sonrası ilgili sigorta şirketi portalında otomatik görünecektir.
                </p>
              )}

              {(report.images?.length ?? 0) === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                  <p className="text-xs text-amber-800 leading-5">
                    Bu raporda henüz fotoğraf yok. Resim eklemeden onaya göndermek istediğinizden emin misiniz?
                  </p>
                  <label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmSendWithoutImages}
                      onChange={(e) => setConfirmSendWithoutImages(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300 text-amber-600"
                    />
                    <span>Resim eklemeden onaya göndermeyi onaylıyorum</span>
                  </label>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Onaya gönderme tarihi ve gönderen bilgisi rapor sayfasında kayıt altına alınır.
              </p>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleRequestApproval}
                disabled={requestingApproval || ((report.images?.length ?? 0) === 0 && !confirmSendWithoutImages)}
                className="flex-1 bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
              >
                {requestingApproval ? 'Gönderiliyor…' : 'Onaya Gönder'}
              </button>
              <button
                type="button"
                onClick={() => { setShowRequestApprovalModal(false); setConfirmSendWithoutImages(false); }}
                disabled={requestingApproval}
                className="flex-1 border border-slate-200 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
            <h3 className="text-base font-bold text-slate-900 mb-4">E-posta / WhatsApp ile Gönder</h3>

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
                  onChange={(e) => setExternalApprovalForm((f) => ({ ...f, channel: e.target.value as 'email' | 'whatsapp' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">E-posta</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Sigorta portalına gönderim iç onay sonrası otomatik yapılır.</p>
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
                  {formatDisplayLabel(report?.claimFile?.lossType)} türüne göre {templateSuggestions.flatMap((s: any) => s.items ?? []).length} kalem önerisi
                </p>
              </div>
              <button type="button" onClick={() => setShowSuggestModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-light leading-none">×</button>
            </div>

            {/* Item List */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {templateSuggestions.map((tpl: any) => (
                <div key={tpl.id}>
                  {templateSuggestions.length > 1 && (
                    <p className="text-xs font-semibold text-slate-500 tracking-wide mb-2">{tpl.name}</p>
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
                              <span className="text-sm font-medium text-slate-800">{formatDisplayLabel(item.jobDescription)}</span>
                              {item.workGroup && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{formatDisplayLabel(item.workGroup.name)}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.damageCategory === 'bina' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {item.damageCategory === 'bina' ? 'Bina' : 'Eşya'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                              {item.location && <span>{formatDisplayLabel(item.location)}</span>}
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
      {showReviseModal && (
        <RepairReportReviseModal
          reportNo={report.reportNo}
          versionNo={report.versionNo}
          submitting={revising}
          onClose={() => setShowReviseModal(false)}
          onConfirm={confirmRevise}
        />
      )}
      {showSaveReminderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Kaydetmeyi Unutmayın</h3>
            <p className="text-sm text-slate-600 mb-4">
              Raporda kaydedilmemiş değişiklikler var
              {hasUnsavedReportFields && dirtyItemCount > 0
                ? ' (metin alanları ve tablo satırları)'
                : hasUnsavedReportFields
                  ? ' (metin alanları)'
                  : dirtyItemCount > 0
                    ? ' (tablo satırları)'
                    : ''}.
              Yazımı tamamladıysanız kaydetmenizi öneririz.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSaveReminderModal(false);
                  void handleSaveReport();
                }}
                className="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSaveReminderModal(false);
                  setPendingFields({});
                  router.push(claimPath);
                }}
                className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Kaydetmeden Çık
              </button>
              <button
                type="button"
                onClick={() => setShowSaveReminderModal(false)}
                className="w-full rounded-lg py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Yazmaya Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

