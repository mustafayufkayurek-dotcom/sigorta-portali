'use client';

import { API, authHeader, authAxios, ensureSessionBeforeMutation } from '@/utils/api';
import React, { useEffect, useState, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { toTitleCaseTR, formatDisplayLabel, resolveClaimIhbarKonusu, formatHasarAdresi } from '@/utils/text-helpers';
import { fmtDateTime, formatReportDuration, toWhatsAppLink } from '@/utils/date-helpers';
import { resolveDamageReasonOptions, type DamageReasonOption } from '@/utils/damage-reason-options';
import { buildRepairReportShareRecipients, type ClaimVendorSource } from '@/utils/repair-report-share-recipients';
import dynamic from 'next/dynamic';
import SpeechToText from '@/components/SpeechToText';
import { getReportImageUrl } from '@/utils/upload-url';
import ReportImageGallery, { type PendingReportImageUpload } from '@/components/damage-reports/ReportImageGallery';
import RepairReportReviseModal, { type ReviseReportPayload } from '@/components/damage-reports/RepairReportReviseModal';
import { CommercialPricingDrawer } from '@/components/damage-reports/CommercialPricingDrawer';
import { ClaimFileHeaderStatusCluster } from '@/components/damage-reports/ClaimFileHeaderStatusCluster';
import { ClaimFileHeaderActionsMenu } from '@/components/operasyon/ClaimFileHeaderActionsMenu';
import type { ManualDecisionAction } from '@/components/operasyon/ManualDecisionModal';
import { FieldSurveyBriefModal } from '@/components/field-survey/FieldSurveyBriefModal';
import { FieldSurveyBriefList } from '@/components/field-survey/FieldSurveyBriefList';
import { getApiErrorMessage } from '@/utils/api-error';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import VendorQuoteModal, { readVendorPriceMemory, writeVendorPriceMemory } from '@/components/damage-reports/VendorQuoteModal';
import {
  parseVendorQuoteData,
  buildVendorQuoteMetrajData,
  type VendorQuoteData,
} from '@/components/damage-reports/VendorQuotePopover';
import { claimListFileNo } from '@/utils/claim-list-column-fields';
import { resolveIhbarTarihi } from '@/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay';
import { resolveFileExpertDisplay, REPAIR_REPORT_MAX_REVISION_MESSAGE, canCreateRepairReportRevision, canStartRepairReportRevisionFromStatus, isRepairReportRevision } from '@sigorta/shared';
import RepairItemsModal, {
  type SelectedRepairItem,
  DAMAGE_SIZE_OPTIONS,
  damageSizeLabel,
} from '@/components/damage-reports/RepairItemsModal';
import {
  inferQuickDamageTypesFromReport,
  buildQuickDamageDisplayOptions,
  quickDamageTypeDisplayLabel,
  REPORT_IMAGE_CATEGORY_LABELS,
  REPORT_IMAGE_CATEGORY_KEYS,
} from '@/utils/quick-repair-damage-types';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import {
  repairReportStatusBadge,
  repairReportStatusLabel,
} from '@/utils/repair-report-status';
import { editingDraftFromCellValue, normalizeCellNumericInput } from '@/utils/repair-report-number-input';
import { formatTrAmountInput, numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { LEGAL_NOTE_TEMPLATES, buildSuggestedLegalNotesText } from '@/constants/legal-note-templates';
import { useToast } from '@/contexts/ToastContext';
import { useNavigationGuard } from '@/contexts/NavigationGuardContext';

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

function sortReportItems(items: any[] | null | undefined): any[] {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b), 'tr'));
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

function SectionCard({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-slate-50 px-5 py-3 border-b border-slate-100">
        <h4 className="shrink-0 text-sm font-semibold text-slate-700">{title}</h4>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FinancialSummaryBar({
  totalSupplierCost,
  totalSalesAmount,
  grossProfit,
  grossMarginPct,
  tone = 'light',
}: {
  totalSupplierCost?: number | null;
  totalSalesAmount?: number | null;
  grossProfit?: number | null;
  grossMarginPct?: number | null;
  tone?: 'dark' | 'light';
}) {
  const isLight = tone === 'light';
  const margin = grossMarginPct ?? 0;
  const profit = grossProfit ?? 0;
  const marginValueClass = isLight
    ? margin >= 20
      ? 'text-emerald-700'
      : margin >= 10
        ? 'text-amber-700'
        : 'text-rose-700'
    : margin >= 20
      ? 'text-emerald-300'
      : margin >= 10
        ? 'text-amber-300'
        : 'text-rose-300';
  const marginChipClass = isLight
    ? margin >= 20
      ? 'bg-emerald-50 border-emerald-200'
      : margin >= 10
        ? 'bg-amber-50 border-amber-200'
        : 'bg-rose-50 border-rose-200'
    : margin >= 20
      ? 'bg-status-success/15 border-emerald-400/30'
      : margin >= 10
        ? 'bg-status-warning/15 border-amber-400/30'
        : 'bg-rose-500/15 border-rose-400/30';

  const chipClass = isLight
    ? 'rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 min-w-[6.5rem] sm:min-w-[7.5rem] flex flex-col items-center justify-center text-center'
    : 'rounded-lg bg-white/10 border border-white/15 px-3 py-2 min-w-[6.5rem] sm:min-w-[7.5rem] flex flex-col items-center justify-center text-center';
  const labelClass = isLight ? 'text-[10px] font-medium text-slate-500 leading-none mb-1' : 'text-[10px] font-medium text-slate-400 leading-none mb-1';
  const valueBase = isLight ? 'text-slate-800' : 'text-white';
  const profitClass = isLight
    ? profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
    : profit >= 0 ? 'text-emerald-300' : 'text-rose-300';

  const metrics = [
    { label: 'Maliyet', value: fmtCurrency(totalSupplierCost), valueClass: valueBase },
    { label: 'Satış', value: fmtCurrency(totalSalesAmount), valueClass: valueBase },
    {
      label: 'Kâr',
      value: fmtCurrency(grossProfit),
      valueClass: profitClass,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap min-w-0">
      <div className="hidden md:flex items-center gap-2 pr-1 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" aria-hidden />
        <span className={`text-xs font-semibold tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Finansal Özet</span>
      </div>
      {metrics.map((metric) => (
        <div key={metric.label} className={chipClass}>
          <p className={labelClass}>{metric.label}</p>
          <p className={`text-sm sm:text-base font-bold leading-none tabular-nums ${metric.valueClass}`}>{metric.value}</p>
        </div>
      ))}
      <div className={`rounded-lg border px-3 py-2 min-w-[5.5rem] sm:min-w-[6rem] flex flex-col items-center justify-center text-center ${marginChipClass}`}>
        <p className={labelClass}>Marj</p>
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
    <div id="dosya-butcesi" className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden scroll-mt-24">
      {/* Başlık — tıklanınca açılır/kapanır */}
      <button
        type="button"
        className="relative w-full flex items-center justify-center px-5 py-3.5 hover:bg-indigo-50/40 transition-colors text-center"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">%</span>
          <span className="text-sm font-semibold text-slate-700">Dosya Bütçesi</span>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`absolute right-5 w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
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
                  <th className="text-center px-3 py-2">Tedarikçi</th>
                  <th className="text-center px-3 py-2">Maliyet</th>
                  <th className="text-center px-3 py-2">Satış Fiyatı</th>
                  <th className="text-center px-3 py-2">Kar</th>
                  <th className="text-center px-3 py-2 rounded-r-lg">Kar %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.workGroupId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-800 text-center">{formatDisplayLabel(row.workGroupName)}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600 text-[11px] leading-snug max-w-[180px]">{row.vendorSummary}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{fmtCurrency(row.supplierTotal)}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-800">{fmtCurrency(row.salesTotal)}</td>
                    <td className={`px-3 py-2.5 text-center font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtCurrency(row.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${profitBg(row.profitPct)} ${profitColor(row.profitPct)}`}>
                        %{row.profitPct.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`font-bold ${grandProfit < 0 ? 'loss-flash' : 'bg-slate-700'}`}>
                  <td className="px-3 py-3.5 text-white text-xs font-semibold rounded-bl-lg text-center">
                    {grandProfit < 0 ? '⚠ Zarar' : 'Genel Toplam'}
                  </td>
                  <td className="px-3 py-3.5" />
                  <td className="px-3 py-3.5 text-center text-slate-200 text-sm font-bold">{fmtCurrency(grandSupplier)}</td>
                  <td className="px-3 py-3.5 text-center text-white text-sm font-bold">{fmtCurrency(grandSales)}</td>
                  <td className="px-3 py-3.5 text-center text-sm font-bold text-red-200">{fmtCurrency(grandProfit)}</td>
                  <td className="px-3 py-3.5 text-center rounded-br-lg">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-extrabold ${grandProfit < 0 ? 'bg-red-900/60 text-red-100' : `${profitBg(grandProfitPct)} ${profitColor(grandProfitPct)}`}`}>
                      %{grandProfitPct.toFixed(1)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metraj Hesaplama Asistanı Modal ─────────────────────────────────────────

type HesaplamaTuru =
  | 'duvar_boyasi'
  | 'tavan_boyasi'
  | 'zemin_kaplama'
  | 'siva'
  | 'alcipan_tavan'
  | 'alcipan_duvar'
  | 'supurgelik'
  | 'kartonpiyer'
  | 'pvc_dograma'
  | 'ozel';

interface MetrajEntry {
  id: string;
  room: string;
  calcType: string;
  area: number;
  formula: string;
  compact: string;
}

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

type PvcTip = 'pencere' | 'kapi' | 'surme' | 'balkon';

const ODA_ADLARI = ['Salon', 'Oturma Odası', 'Yatak Odası', 'Çocuk Odası', 'Mutfak', 'Banyo', 'WC', 'Koridor', 'Balkon', 'Depo', 'Diğer'];

const HESAPLAMA_TURU_LABEL: Record<HesaplamaTuru, string> = {
  duvar_boyasi: 'Duvar Boyası',
  tavan_boyasi: 'Tavan Boyası',
  zemin_kaplama: 'Zemin Kaplama',
  siva: 'Sıva',
  alcipan_tavan: 'Alçıpan (Tavan)',
  alcipan_duvar: 'Alçıpan (Duvar)',
  supurgelik: 'Süpürgelik',
  kartonpiyer: 'Kartonpiyer',
  pvc_dograma: 'PVC Doğrama',
  ozel: 'Özel Formül',
};

const PVC_TIP_LABEL: Record<PvcTip, string> = {
  pencere: 'Pencere',
  kapi: 'Kapı',
  surme: 'Sürme',
  balkon: 'Balkon',
};

function needsHeight(tur: HesaplamaTuru): boolean {
  return tur === 'duvar_boyasi' || tur === 'siva' || tur === 'alcipan_duvar';
}

function isAlanTuru(tur: HesaplamaTuru): boolean {
  return tur === 'tavan_boyasi' || tur === 'zemin_kaplama' || tur === 'alcipan_tavan';
}

function isMetretulTuru(tur: HesaplamaTuru): boolean {
  return tur === 'supurgelik' || tur === 'kartonpiyer';
}

function metrajBirim(tur: string): string {
  return tur === 'supurgelik' || tur === 'kartonpiyer' ? 'mt' : 'm²';
}

function pvcKanatCarpan(kanat: number): number {
  if (kanat <= 1) return 1;
  if (kanat === 2) return 1.05;
  if (kanat === 3) return 1.12;
  return 1.18;
}

/** Profil + mahal yüksekliğinden önerilen maliyet katsayısı (metretül işler). */
function onerilenMaliyetKatsayi(profilCm: number, mahalM: number): number {
  let k = 1;
  if (profilCm > 12) k = 1.2;
  else if (profilCm > 8) k = 1.1;
  if (mahalM > 3) k = Math.min(1.3, Math.round((k + 0.1) * 100) / 100);
  return k;
}

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

function readMetrajEntries(metrajData: unknown): MetrajEntry[] {
  if (!metrajData || typeof metrajData !== 'object') return [];
  const raw = (metrajData as Record<string, unknown>).entries;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
    .map((e) => ({
      id: String(e.id ?? Math.random().toString(36).slice(2)),
      room: String(e.room ?? ''),
      calcType: String(e.calcType ?? ''),
      area: typeof e.area === 'number' ? e.area : parseFloat(String(e.area ?? 0)) || 0,
      formula: String(e.formula ?? ''),
      compact: String(e.compact ?? ''),
    }))
    .filter((e) => e.area > 0);
}

function metrajEntriesTotal(entries: MetrajEntry[]): number {
  return entries.reduce((s, e) => s + e.area, 0);
}

function withMetrajEntries(
  existing: Record<string, unknown> | null | undefined,
  entries: MetrajEntry[],
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  if (entries.length === 0) {
    delete base.entries;
  } else {
    base.entries = entries.map((e) => ({
      id: e.id,
      room: e.room,
      calcType: e.calcType,
      area: e.area,
      formula: e.formula,
      compact: e.compact,
    }));
  }
  return base;
}

interface OdaHesap {
  zeminTavan: number;
  brutDuvar: number;
  toplamCevre: number;
  toplamKesinti: number;
  netDuvar: number;
  kapiGenislik: number;
  netSupurgelik: number;
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
  const kapiGenislik = oda.kesintiler
    .filter((k) => k.tip === 'kapi')
    .reduce((s, k) => s + k.adet * k.en, 0);
  const netSupurgelik = Math.max(0, toplamCevre - kapiGenislik);
  return { zeminTavan, brutDuvar, toplamCevre, toplamKesinti, netDuvar, kapiGenislik, netSupurgelik };
}

function odaUyarisi(oda: Oda, tur: HesaplamaTuru): string[] {
  const uyarilar: string[] = [];
  const en = parseN(oda.en);
  const boy = parseN(oda.boy);
  const yuk = parseN(oda.yukseklik);
  if (en > 0 && (en < 0.5 || en > 30)) uyarilar.push('En değeri 0.5m–30m aralığında olmalıdır.');
  if (boy > 0 && (boy < 0.5 || boy > 30)) uyarilar.push('Boy değeri 0.5m–30m aralığında olmalıdır.');
  if (needsHeight(tur) && yuk > 0 && (yuk < 2 || yuk > 5)) uyarilar.push('Yükseklik 2m–5m aralığında olmalıdır.');
  const h = hesaplaOda(oda);
  if (needsHeight(tur) && h.toplamKesinti > h.brutDuvar && h.brutDuvar > 0) {
    uyarilar.push('Kesinti toplamı brüt duvar alanından büyük!');
  }
  if (tur === 'supurgelik' && h.kapiGenislik > h.toplamCevre && h.toplamCevre > 0) {
    uyarilar.push('Kapı genişliği toplamı çevreden büyük!');
  }
  return uyarilar;
}

function buildOdaMetrajEntry(
  oda: Oda,
  tur: HesaplamaTuru,
  area: number,
  opts?: { maliyetKatsayi?: number; netMtul?: number; profilCm?: number },
): MetrajEntry {
  const en = parseN(oda.en);
  const boy = parseN(oda.boy);
  const yuk = parseN(oda.yukseklik);
  const h = hesaplaOda(oda);
  const room = oda.ad.trim() || 'Mahal';
  const unit = metrajBirim(tur);
  const katsayi = opts?.maliyetKatsayi;
  const netMtul = opts?.netMtul;
  let formula: string;
  if (isAlanTuru(tur)) {
    formula = `${room} en ${fmt2(en)} × boy ${fmt2(boy)} = ${fmt2(area)} ${unit}`;
  } else if (tur === 'kartonpiyer') {
    const base = `${room} 2×(${fmt2(en)}+${fmt2(boy)})`;
    formula = katsayi && katsayi !== 1 && netMtul != null
      ? `${base} = ${fmt2(netMtul)} mt × katsayı ${fmt2(katsayi)} = ${fmt2(area)} ${unit}`
      : `${base} = ${fmt2(area)} ${unit}`;
  } else if (tur === 'supurgelik') {
    const base = h.kapiGenislik > 0
      ? `${room} 2×(${fmt2(en)}+${fmt2(boy)}) − kapı ${fmt2(h.kapiGenislik)}`
      : `${room} 2×(${fmt2(en)}+${fmt2(boy)})`;
    formula = katsayi && katsayi !== 1 && netMtul != null
      ? `${base} = ${fmt2(netMtul)} mt × katsayı ${fmt2(katsayi)} = ${fmt2(area)} ${unit}`
      : `${base} = ${fmt2(area)} ${unit}`;
  } else if (h.toplamKesinti > 0) {
    formula = `${room} (2×${fmt2(en)}+2×${fmt2(boy)})×${fmt2(yuk)} − ${fmt2(h.toplamKesinti)} = ${fmt2(area)} ${unit}`;
  } else {
    formula = `${room} (2×${fmt2(en)}+2×${fmt2(boy)})×${fmt2(yuk)} = ${fmt2(area)} ${unit}`;
  }
  if (opts?.profilCm && opts.profilCm > 0 && isMetretulTuru(tur)) {
    formula += ` (profil ${fmt2(opts.profilCm)} cm)`;
  }
  return {
    id: Math.random().toString(36).slice(2),
    room,
    calcType: tur,
    area,
    formula,
    compact: `${room} ${fmt2(area)} ${unit}`,
  };
}

function buildPvcMetrajEntry(input: {
  tip: PvcTip;
  en: number;
  boy: number;
  adet: number;
  kanat: number;
  includeCam: boolean;
  includePervaz: boolean;
  includeDenizlik: boolean;
}): MetrajEntry | null {
  const { tip, en, boy, adet, kanat, includeCam, includePervaz, includeDenizlik } = input;
  if (en <= 0 || boy <= 0 || adet <= 0) return null;
  const carpan = pvcKanatCarpan(kanat);
  const alan = en * boy * adet;
  const area = alan * carpan;
  const tipLabel = PVC_TIP_LABEL[tip];
  const extras: string[] = [];
  if (includeCam) extras.push(`cam ${fmt2(alan)} m²`);
  if (includePervaz) extras.push(`pervaz ${fmt2(2 * (en + boy) * adet)} mt`);
  if (includeDenizlik && tip === 'pencere') extras.push(`denizlik ${fmt2(en * adet)} mt`);
  const extraStr = extras.length ? ` · ${extras.join(' · ')}` : '';
  const formula =
    `${tipLabel} ${fmt2(en)}×${fmt2(boy)}×${adet} adet × kanat×${fmt2(carpan)} = ${fmt2(area)} m²${extraStr}`;
  return {
    id: Math.random().toString(36).slice(2),
    room: tipLabel,
    calcType: 'pvc_dograma',
    area,
    formula,
    compact: `${tipLabel} ${fmt2(area)} m²`,
  };
}

function MetrajHesaplamaModal({
  onClose,
  onEntriesChange,
  location,
  initialEntries = [],
}: {
  onClose: () => void;
  onEntriesChange: (entries: MetrajEntry[], totalQty: string) => void;
  location?: string;
  initialEntries?: MetrajEntry[];
}) {
  const [odalar, setOdalar] = useState<Oda[]>([newOda()]);
  const [hesaplamaTuru, setHesaplamaTuru] = useState<HesaplamaTuru>('duvar_boyasi');
  const [ozelFormul, setOzelFormul] = useState('');
  const [eklenenler, setEklenenler] = useState<MetrajEntry[]>(initialEntries);

  // Metretül maliyet katsayısı
  const [profilYukseklikCm, setProfilYukseklikCm] = useState('8');
  const [mahalYukseklikM, setMahalYukseklikM] = useState('');
  const [maliyetKatsayi, setMaliyetKatsayi] = useState(1);
  const [katsayiUygulandi, setKatsayiUygulandi] = useState(false);

  // PVC doğrama
  const [pvcTip, setPvcTip] = useState<PvcTip>('pencere');
  const [pvcEn, setPvcEn] = useState('');
  const [pvcBoy, setPvcBoy] = useState('');
  const [pvcAdet, setPvcAdet] = useState('1');
  const [pvcKanat, setPvcKanat] = useState(1);
  const [pvcCam, setPvcCam] = useState(true);
  const [pvcPervaz, setPvcPervaz] = useState(true);
  const [pvcDenizlik, setPvcDenizlik] = useState(true);

  const showHeight = needsHeight(hesaplamaTuru);
  const birimEtiket = isMetretulTuru(hesaplamaTuru) ? 'mt' : 'm²';
  const tumUyarilar = odalar.flatMap((o) => odaUyarisi(o, hesaplamaTuru));
  const onerilenKatsayi = onerilenMaliyetKatsayi(parseN(profilYukseklikCm), parseN(mahalYukseklikM));

  const odaToplami = (oda: Oda): number => {
    const h = hesaplaOda(oda);
    let net = 0;
    switch (hesaplamaTuru) {
      case 'duvar_boyasi': net = h.netDuvar; break;
      case 'tavan_boyasi': net = h.zeminTavan; break;
      case 'zemin_kaplama': net = h.zeminTavan; break;
      case 'siva': net = h.netDuvar; break;
      case 'alcipan_tavan': net = h.zeminTavan; break;
      case 'alcipan_duvar': net = h.netDuvar; break;
      case 'supurgelik': net = h.netSupurgelik; break;
      case 'kartonpiyer': net = h.toplamCevre; break;
      case 'pvc_dograma':
      case 'ozel':
      default: return 0;
    }
    if (isMetretulTuru(hesaplamaTuru) && katsayiUygulandi) {
      return net * maliyetKatsayi;
    }
    return net;
  };

  const syncEntries = (next: MetrajEntry[]) => {
    setEklenenler(next);
    onEntriesChange(next, fmt2(metrajEntriesTotal(next)));
  };

  const raporaEkleOda = (oda: Oda) => {
    if (isMetretulTuru(hesaplamaTuru) && !katsayiUygulandi) return;
    const h = hesaplaOda(oda);
    const netMtul = hesaplamaTuru === 'supurgelik' ? h.netSupurgelik : h.toplamCevre;
    const area = odaToplami(oda);
    const uyarilar = odaUyarisi(oda, hesaplamaTuru);
    if (area <= 0 || uyarilar.some((u) => u.includes('büyük'))) return;
    syncEntries([
      ...eklenenler,
      buildOdaMetrajEntry(oda, hesaplamaTuru, area, isMetretulTuru(hesaplamaTuru)
        ? {
            maliyetKatsayi,
            netMtul,
            profilCm: parseN(profilYukseklikCm),
          }
        : undefined),
    ]);
  };

  const raporaEkleOzel = () => {
    const sonuc = evaluateExpression(ozelFormul);
    if (sonuc === null || sonuc <= 0) return;
    const formulaText = ozelFormul.trim();
    syncEntries([
      ...eklenenler,
      {
        id: Math.random().toString(36).slice(2),
        room: 'Özel Formül',
        calcType: 'ozel',
        area: sonuc,
        formula: `${formulaText} = ${fmt2(sonuc)} m²`,
        compact: `Özel ${fmt2(sonuc)} m²`,
      },
    ]);
  };

  const raporaEklePvc = () => {
    const entry = buildPvcMetrajEntry({
      tip: pvcTip,
      en: parseN(pvcEn),
      boy: parseN(pvcBoy),
      adet: Math.max(1, Math.round(parseN(pvcAdet)) || 1),
      kanat: pvcKanat,
      includeCam: pvcCam,
      includePervaz: pvcPervaz,
      includeDenizlik: pvcDenizlik,
    });
    if (!entry) return;
    syncEntries([...eklenenler, entry]);
  };

  const removeEklenen = (id: string) => {
    syncEntries(eklenenler.filter((e) => e.id !== id));
  };

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

  const setHesaplamaTuruSafe = (t: HesaplamaTuru) => {
    setHesaplamaTuru(t);
    setKatsayiUygulandi(false);
    setMaliyetKatsayi(1);
    if (t === 'supurgelik') {
      setOdalar((prev) => prev.map((o) => ({
        ...o,
        kesintiler: o.kesintiler.filter((k) => k.tip === 'kapi'),
      })));
    } else if (t === 'kartonpiyer' || isAlanTuru(t) || t === 'pvc_dograma') {
      setOdalar((prev) => prev.map((o) => ({ ...o, kesintiler: [] })));
    }
  };

  const uygulaKatsayi = () => {
    const k = onerilenKatsayi;
    setMaliyetKatsayi(k);
    setKatsayiUygulandi(true);
  };

  const eklenenToplam = metrajEntriesTotal(eklenenler);
  const ozelSonuc = hesaplamaTuru === 'ozel' ? evaluateExpression(ozelFormul) : null;
  const pvcCarpan = pvcKanatCarpan(pvcKanat);
  const pvcAlanHam = parseN(pvcEn) * parseN(pvcBoy) * Math.max(1, Math.round(parseN(pvcAdet)) || 1);
  const pvcAlan = pvcAlanHam * pvcCarpan;
  const footerBirim = eklenenler.length > 0
    ? (eklenenler.every((e) => metrajBirim(e.calcType) === 'mt') ? 'mt' : 'm²')
    : birimEtiket;

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
                <p className="text-xs text-brand-600 font-medium mt-0.5">
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
            {(Object.keys(HESAPLAMA_TURU_LABEL) as HesaplamaTuru[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHesaplamaTuruSafe(t)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${hesaplamaTuru === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {HESAPLAMA_TURU_LABEL[t]}
              </button>
            ))}
          </div>
          {hesaplamaTuru === 'ozel' && (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-slate-500 block mb-1">Özel Formül (örn: 12.5 * 2 + 8)</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Formülü girin..."
                  value={ozelFormul}
                  onChange={(e) => setOzelFormul(e.target.value)}
                />
                {ozelSonuc !== null && (
                  <p className="text-xs text-brand-600 mt-1 font-mono">= {fmt2(ozelSonuc)} m²</p>
                )}
              </div>
              <button
                type="button"
                disabled={ozelSonuc === null || ozelSonuc <= 0}
                onClick={raporaEkleOzel}
                className="flex-shrink-0 bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Rapora Ekle
              </button>
            </div>
          )}

          {isMetretulTuru(hesaplamaTuru) && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-900">
                Yükseklik Maliyeti — {HESAPLAMA_TURU_LABEL[hesaplamaTuru]}
              </p>
              <p className="text-[11px] text-amber-800">
                Metretül çevre formülüne oda yüksekliği girmez; ancak profil veya mahal yüksekliği birim maliyeti artırır.
                Katsayıyı hesaba uygulamadan Rapora Ekle kilitlidir.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="block text-[11px] font-medium text-slate-700">
                  Profil Yüksekliği (Cm)
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={profilYukseklikCm}
                    onChange={(e) => {
                      setProfilYukseklikCm(e.target.value);
                      setKatsayiUygulandi(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-[11px] font-medium text-slate-700">
                  Mahal Yüksekliği (M)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mahalYukseklikM}
                    onChange={(e) => {
                      setMahalYukseklikM(e.target.value);
                      setKatsayiUygulandi(false);
                    }}
                    placeholder="Opsiyonel"
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex flex-col justify-end">
                  <p className="text-[11px] text-slate-600">Önerilen Katsayı</p>
                  <p className="text-sm font-bold text-slate-900">{fmt2(onerilenKatsayi)}</p>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={uygulaKatsayi}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ${
                      katsayiUygulandi
                        ? 'bg-status-success/15 text-status-success ring-1 ring-status-success/30'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {katsayiUygulandi ? `Uygulandı (×${fmt2(maliyetKatsayi)})` : 'Katsayıyı Hesaba Uygula'}
                  </button>
                </div>
              </div>
              {!katsayiUygulandi && (
                <p className="text-[11px] font-medium text-amber-900">
                  Önce katsayıyı uygulayın; aksi halde mahal Rapora Ekle yapılamaz.
                </p>
              )}
            </div>
          )}

          {hesaplamaTuru === 'pvc_dograma' && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
              <p className="text-xs font-semibold text-slate-700">PVC Doğrama — Açıklık Metrajı</p>
              <p className="text-[11px] text-slate-500">
                Miktar = en × boy × adet × kanat çarpanı (m²). Cam / pervaz / denizlik Metraj Özeti formülüne eklenir.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Tip
                  <select
                    value={pvcTip}
                    onChange={(e) => setPvcTip(e.target.value as PvcTip)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(PVC_TIP_LABEL) as PvcTip[]).map((t) => (
                      <option key={t} value={t}>{PVC_TIP_LABEL[t]}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-slate-600">
                  En (M)
                  <input type="number" min="0" step="0.01" value={pvcEn} onChange={(e) => setPvcEn(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-[11px] font-medium text-slate-600">
                  Boy (M)
                  <input type="number" min="0" step="0.01" value={pvcBoy} onChange={(e) => setPvcBoy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-[11px] font-medium text-slate-600">
                  Adet
                  <input type="number" min="1" step="1" value={pvcAdet} onChange={(e) => setPvcAdet(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-[11px] font-medium text-slate-600">
                  Kanat
                  <select
                    value={pvcKanat}
                    onChange={(e) => setPvcKanat(parseInt(e.target.value, 10) || 1)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} (×{fmt2(pvcKanatCarpan(n))})</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-700">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={pvcCam} onChange={(e) => setPvcCam(e.target.checked)} className="accent-brand-600" />
                  Cam (M²)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={pvcPervaz} onChange={(e) => setPvcPervaz(e.target.checked)} className="accent-brand-600" />
                  Pervaz (Mt)
                </label>
                {pvcTip === 'pencere' && (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={pvcDenizlik} onChange={(e) => setPvcDenizlik(e.target.checked)} className="accent-brand-600" />
                    Denizlik (Mt)
                  </label>
                )}
              </div>
              {pvcAlan > 0 && (
                <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Doğrama:</span>
                    <span className="font-semibold text-brand-700">{fmt2(pvcAlanHam)} × {fmt2(pvcCarpan)} = {fmt2(pvcAlan)} m²</span>
                  </div>
                  {pvcCam && (
                    <div className="flex justify-between text-slate-600">
                      <span>Cam:</span><span>{fmt2(pvcAlanHam)} m²</span>
                    </div>
                  )}
                  {pvcPervaz && (
                    <div className="flex justify-between text-slate-600">
                      <span>Pervaz:</span>
                      <span>{fmt2(2 * (parseN(pvcEn) + parseN(pvcBoy)) * Math.max(1, Math.round(parseN(pvcAdet)) || 1))} mt</span>
                    </div>
                  )}
                  {pvcDenizlik && pvcTip === 'pencere' && (
                    <div className="flex justify-between text-slate-600">
                      <span>Denizlik:</span>
                      <span>{fmt2(parseN(pvcEn) * Math.max(1, Math.round(parseN(pvcAdet)) || 1))} mt</span>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                disabled={pvcAlan <= 0}
                onClick={raporaEklePvc}
                className="bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Rapora Ekle
              </button>
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
          {hesaplamaTuru !== 'ozel' && hesaplamaTuru !== 'pvc_dograma' && odalar.map((oda, odaIdx) => {
            const h = hesaplaOda(oda);
            const toplamBuOda = odaToplami(oda);
            const netMtulBase = hesaplamaTuru === 'supurgelik' ? h.netSupurgelik : h.toplamCevre;
            const uyarilar = odaUyarisi(oda, hesaplamaTuru);
            const hasError = uyarilar.length > 0;
            const canAdd = toplamBuOda > 0
              && !uyarilar.some((u) => u.includes('büyük'))
              && (!isMetretulTuru(hesaplamaTuru) || katsayiUygulandi);
            const isListeAdi = ODA_ADLARI.includes(oda.ad) && oda.ad !== 'Diğer';
            const selectValue = isListeAdi ? oda.ad : 'Diğer';
            const dimFields = showHeight
              ? ([
                  { field: 'en', label: 'En (m)', placeholder: '0.00' },
                  { field: 'boy', label: 'Boy (m)', placeholder: '0.00' },
                  { field: 'yukseklik', label: 'Yükseklik (m)', placeholder: '2.80' },
                ] as const)
              : ([
                  { field: 'en', label: 'En (m)', placeholder: '0.00' },
                  { field: 'boy', label: 'Boy (m)', placeholder: '0.00' },
                ] as const);

            return (
              <div key={oda.id} className={`border rounded-xl p-4 space-y-3 ${hasError ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-slate-50/40'}`}>
                {/* Oda adı — tek select; Diğer’de serbest metin */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">{odaIdx + 1}.</span>
                  <select
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white min-w-[140px] focus:outline-none focus:ring-1 focus:ring-brand-600"
                    value={selectValue}
                    onChange={(e) => {
                      if (e.target.value === 'Diğer') updateOda(oda.id, { ad: '' });
                      else updateOda(oda.id, { ad: e.target.value });
                    }}
                  >
                    {ODA_ADLARI.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {selectValue === 'Diğer' && (
                    <input
                      type="text"
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                      placeholder="Mahal adı yazın..."
                      value={oda.ad}
                      onChange={(e) => updateOda(oda.id, { ad: e.target.value })}
                    />
                  )}
                  {odalar.length > 1 && (
                    <button type="button" onClick={() => removeOda(oda.id)} className="text-slate-300 hover:text-status-danger w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 ml-auto">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5.5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                    </button>
                  )}
                </div>

                {/* Boyutlar + Rapora Ekle */}
                <div className="flex items-end gap-2">
                  <div className={`grid gap-2 flex-1 ${showHeight ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {dimFields.map(({ field, label, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs text-slate-500 block mb-1">{label}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                          placeholder={placeholder}
                          value={(oda as any)[field]}
                          onChange={(e) => updateOda(oda.id, { [field]: e.target.value } as any)}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={() => raporaEkleOda(oda)}
                    className="flex-shrink-0 bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Rapora Ekle
                  </button>
                </div>

                {/* Tür bazlı otomatik hesap */}
                {parseN(oda.en) > 0 && parseN(oda.boy) > 0 && (
                  <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-brand-600 mb-1.5">Otomatik Hesaplamalar</p>
                    <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                      {isAlanTuru(hesaplamaTuru) && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Zemin/Tavan Alanı:</span>
                          <span className="text-slate-700 font-semibold">
                            {fmt2(parseN(oda.en))} × {fmt2(parseN(oda.boy))} = <span className="text-brand-700">{fmt2(h.zeminTavan)} m²</span>
                          </span>
                        </div>
                      )}
                      {isMetretulTuru(hesaplamaTuru) && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Çevre (Metretül):</span>
                            <span className="text-slate-700 font-semibold">
                              2×({fmt2(parseN(oda.en))}+{fmt2(parseN(oda.boy))}) = <span className="text-brand-700">{fmt2(h.toplamCevre)} mt</span>
                            </span>
                          </div>
                          {hesaplamaTuru === 'supurgelik' && h.kapiGenislik > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Net Süpürgelik:</span>
                              <span className="font-bold text-emerald-700">{fmt2(h.toplamCevre)} − {fmt2(h.kapiGenislik)} = {fmt2(h.netSupurgelik)} mt</span>
                            </div>
                          )}
                        </>
                      )}
                      {needsHeight(hesaplamaTuru) && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Brüt Duvar Alanı:</span>
                            <span className="text-slate-700 font-semibold">
                              (2×{fmt2(parseN(oda.en))} + 2×{fmt2(parseN(oda.boy))}) × {fmt2(parseN(oda.yukseklik))} = <span className="text-brand-700">{fmt2(h.brutDuvar)} m²</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Toplam Çevre:</span>
                            <span className="text-slate-700 font-semibold">
                              2×({fmt2(parseN(oda.en))}+{fmt2(parseN(oda.boy))}) = <span className="text-brand-700">{fmt2(h.toplamCevre)} mt</span>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Kesintiler — duvar: pencere+kapı; süpürgelik: yalnız kapı */}
                {(needsHeight(hesaplamaTuru) || hesaplamaTuru === 'supurgelik') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-600">
                        {hesaplamaTuru === 'supurgelik' ? 'Kapı Kesintisi' : 'Kesintiler'}
                      </p>
                      {needsHeight(hesaplamaTuru) && (
                        <button type="button" onClick={() => addKesinti(oda.id, 'pencere')}
                          className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-lg hover:bg-sky-200 font-medium">+ Pencere</button>
                      )}
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
                            <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                              {hesaplamaTuru === 'supurgelik' ? 'Genişlik:' : 'En:'}
                            </div>
                            <input type="number" min="0" step="0.01"
                              className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white text-center"
                              value={k.en}
                              onChange={(e) => updateKesinti(oda.id, k.id, { en: parseFloat(e.target.value) || 0 })}
                            />
                            {hesaplamaTuru !== 'supurgelik' && (
                              <>
                                <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">Boy:</div>
                                <input type="number" min="0" step="0.01"
                                  className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white text-center"
                                  value={k.boy}
                                  onChange={(e) => updateKesinti(oda.id, k.id, { boy: parseFloat(e.target.value) || 0 })}
                                />
                              </>
                            )}
                            <span className="text-xs font-mono text-slate-500 ml-auto flex-shrink-0">
                              {hesaplamaTuru === 'supurgelik'
                                ? <>{k.adet} × {fmt2(k.en)} = <span className="font-semibold text-slate-700">{fmt2(k.adet * k.en)} mt</span></>
                                : <>{k.adet} × ({fmt2(k.en)} × {fmt2(k.boy)}) = <span className="font-semibold text-slate-700">{fmt2(k.adet * k.en * k.boy)} m²</span></>}
                            </span>
                            <button type="button" onClick={() => removeKesinti(oda.id, k.id)} className="text-slate-300 hover:text-status-danger ml-1">×</button>
                          </div>
                        ))}
                        {needsHeight(hesaplamaTuru) && (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Bu oda toplamı */}
                {parseN(oda.en) > 0 && parseN(oda.boy) > 0 && (
                  <div className="flex justify-between items-center bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">{oda.ad || 'Mahal'} — {HESAPLAMA_TURU_LABEL[hesaplamaTuru]}</span>
                    <span className="text-sm font-bold text-slate-900 text-right">
                      {isMetretulTuru(hesaplamaTuru) && katsayiUygulandi && maliyetKatsayi !== 1 ? (
                        <>
                          <span className="block text-[10px] font-medium text-slate-500">{fmt2(netMtulBase)} mt × {fmt2(maliyetKatsayi)}</span>
                          {fmt2(toplamBuOda)} {birimEtiket}
                        </>
                      ) : (
                        <>{fmt2(toplamBuOda)} {birimEtiket}</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {hesaplamaTuru !== 'ozel' && hesaplamaTuru !== 'pvc_dograma' && (
            <button
              type="button"
              onClick={() => setOdalar((prev) => [...prev, newOda()])}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm text-slate-500 hover:border-blue-300 hover:text-brand-600 hover:bg-blue-50/30 transition-colors font-medium"
            >
              + Oda Ekle
            </button>
          )}

          {/* Rapora eklenenler */}
          {eklenenler.length > 0 && (
            <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-brand-700">Rapora Eklenenler</p>
              {eklenenler.map((e) => (
                <div key={e.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-700 truncate">{e.formula}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {HESAPLAMA_TURU_LABEL[e.calcType as HesaplamaTuru] ?? e.calcType}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-brand-700 flex-shrink-0">{fmt2(e.area)} {metrajBirim(e.calcType)}</span>
                  <button
                    type="button"
                    onClick={() => removeEklenen(e.id)}
                    className="text-slate-300 hover:text-status-danger flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50"
                    title="Kaldır"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Eklenen toplam + Tamam */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Rapora Eklenen Toplam</p>
              <p className="text-2xl font-bold text-slate-900">
                {fmt2(eklenenToplam)} <span className="text-base font-medium text-slate-500">{footerBirim}</span>
              </p>
              {eklenenler.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{eklenenler.length} mahal</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function sameWorkLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr');
}

function findExistingSubGroup(subGroups: any[], name: string): any | undefined {
  const needle = normalizeLocationLabel(name);
  return subGroups.find((s: any) => sameWorkLabel(String(s.name ?? s.id ?? ''), needle));
}

// ─── İş Tanımı Seçici (inline yeni ekleme destekli) ──────────────────────────
function WorkDefinitionSelector({
  value,
  subGroups,
  workGroupId,
  onSelect,
  onAddNew,
  onNotify,
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
  onNotify?: (type: 'error' | 'warning' | 'success', message: string) => void;
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
    const existing = findExistingSubGroup(subGroups, trimmed);
    if (existing) {
      onNotify?.('warning', 'Bu iş tanımı zaten tanımlı. Yeni kayıt açılmaz; listeden seçildi.');
      onSelect(normalizeLocationLabel(existing.name ?? trimmed), existing.unitType ?? existing.defaultUnit);
      setAddingNew(false);
      setNewVal('');
      return;
    }
    setSaving(true);
    try {
      const result = await onAddNew(trimmed, workGroupId);
      onSelect(normalizeLocationLabel(result?.name ?? trimmed), result?.unitType ?? result?.defaultUnit);
      onNotify?.('success', 'İş tanımı eklendi.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(data) ? data[0] : (data || 'İş tanımı eklenemedi.');
      onNotify?.('error', msg);
      return;
    } finally {
      setSaving(false);
    }
    setAddingNew(false);
    setNewVal('');
  };

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 220 });

  const placeMenu = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 220) });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => placeMenu();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

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
        <button type="button" onClick={() => { setAddingNew(false); setNewVal(''); }} className="text-slate-400 hover:text-status-danger flex-shrink-0 text-xs">×</button>
      </div>
    );
  }

  const selectedLabel = value ? formatDisplayLabel(value) : '— İş Tanımı Seç —';

  return (
    <div ref={wrapRef} className="relative min-w-0 w-full">
      <button
        type="button"
        data-cell={dataCell}
        className={`${className ?? ''} min-w-0 w-full text-left truncate`}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
          if (e.key === 'Escape') setOpen(false);
          onKeyDown?.(e);
        }}
        onClick={() => setOpen((v) => !v)}
      >
        {selectedLabel}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[90] max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-0.5 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <button
            type="button"
            className="block w-full px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-50"
            onClick={() => { onSelect(''); setOpen(false); }}
          >
            — İş Tanımı Seç —
          </button>
          {subGroups.map((sg: any) => (
            <button
              type="button"
              key={sg.id}
              className={`block w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${(sg.name ?? sg.id) === value ? 'bg-slate-50 font-medium' : 'text-slate-800'}`}
              onClick={() => {
                onSelect(normalizeLocationLabel(sg.name ?? sg.id), sg?.unitType ?? sg?.defaultUnit);
                setOpen(false);
              }}
            >
              {formatDisplayLabel(sg.name)}
            </button>
          ))}
          <button
            type="button"
            className="block w-full border-t border-red-100 px-2 py-1.5 text-left text-xs font-semibold text-status-danger hover:bg-red-50"
            onClick={() => { setOpen(false); setAddingNew(true); }}
          >
            + Yeni İş Kalemi Ekle
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Tespit Alanı Seçici (inline yeni tanım — sistem ayarlarına kaydedilir) ───
function DetectionScopeSelector({
  value,
  scopes,
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
  scopes: string[];
  onSelect: (v: string) => void;
  onAddNew: (name: string) => Promise<{ name: string }>;
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
    const trimmed = formatDetectionScopeLabel(newVal);
    if (!trimmed) {
      setAddingNew(false);
      setNewVal('');
      return;
    }
    setSaving(true);
    try {
      const result = await onAddNew(trimmed);
      onSelect(formatDetectionScopeLabel(result?.name ?? trimmed));
    } catch {
      /* ignore */
    } finally {
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
          placeholder="Tespit alanı adı..."
          value={newVal}
          disabled={saving}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              setAddingNew(false);
              setNewVal('');
            }
          }}
          onBlur={() => void commit()}
        />
        <button
          type="button"
          onClick={() => {
            setAddingNew(false);
            setNewVal('');
          }}
          className="text-slate-400 hover:text-status-danger flex-shrink-0 text-xs"
        >
          ×
        </button>
      </div>
    );
  }

  const options = Array.from(
    new Set([
      ...scopes,
      ...(value ? [value] : []),
    ].map((s) => formatDetectionScopeLabel(s)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'tr'));

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
          onSelect(formatDetectionScopeLabel(e.target.value));
        }
      }}
    >
      <option value="">— Tespit Alanı Seç —</option>
      {options.map((scope) => (
        <option key={scope} value={scope}>
          {formatDisplayLabel(scope)}
        </option>
      ))}
      <option value="__add_new__">+ Yeni Tespit Alanı Ekle</option>
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
    const existing = workGroups.find((w: any) => sameWorkLabel(String(w.name ?? ''), trimmed));
    if (existing) {
      onSelect(existing.id);
      setAddingNew(false);
      setNewVal('');
      return;
    }
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
        <button type="button" onClick={() => { setAddingNew(false); setNewVal(''); }} className="text-slate-400 hover:text-status-danger flex-shrink-0 text-xs">×</button>
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
  prepareGlobalSave: () => Promise<void>;
  discardEmptyDraft: () => void;
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
  onNotify?: (type: 'error' | 'warning' | 'success', message: string) => void;
  onConfirm?: (message: string) => Promise<boolean>;
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

function isRowPersistableFields(row: RowState) {
  return Boolean(row.workGroupId && row.jobDescription.trim() && row.detectionScope.trim());
}

function isAddingRowMeaningfullyEmpty(row: RowState) {
  const sales = parseFloat(row.salesUnitPrice || '0') || 0;
  const supplier = parseFloat(row.supplierUnitPrice || '0') || 0;
  return !row.detectionScope.trim()
    && !row.location.trim()
    && !row.workGroupId
    && !row.jobDescription.trim()
    && !row.description.trim()
    && sales === 0
    && supplier === 0;
}

function describeAddingRowGap(row: RowState): { message: string; focusCol: string } | null {
  if (!row.detectionScope.trim()) {
    return { message: 'Tespit Alanı zorunludur.', focusCol: 'detectionScope' };
  }
  if (!row.workGroupId) {
    return { message: 'İş Grubu zorunludur.', focusCol: 'workGroup' };
  }
  if (!row.jobDescription.trim()) {
    return { message: 'İş Tanımı zorunludur.', focusCol: 'jobDescription' };
  }
  return null;
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

const VENDOR_PRICE_TOLERANCE = 0.15;

function isVendorPriceWithinTolerance(entered: number, memoryPrice: number): boolean {
  if (!memoryPrice || memoryPrice <= 0 || !entered || entered <= 0) return true;
  const diff = Math.abs(entered - memoryPrice) / memoryPrice;
  return diff <= VENDOR_PRICE_TOLERANCE;
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
function looksLikeCalcFormula(raw: string): boolean {
  return /[+\-*/()]/.test(raw) && !/^-?\d+([.,]\d+)?$/.test(raw.trim());
}

function formulaForEval(raw: string): string {
  return raw.replace(/,/g, '.');
}

function CalcInput({
  value,
  onChange,
  onCommit,
  className,
  placeholder,
  amountFormat,
  shadowCalc,
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
  /** Satış/maliyet: yazarken binlik nokta (15.600) göster */
  amountFormat?: boolean;
  /** Miktar: 2+ yazınca hücre altında gölge satırda hesap */
  shadowCalc?: boolean;
  'data-cell'?: string;
  tabIndex?: number;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [shadowOpen, setShadowOpen] = useState(false);
  const [formula, setFormula] = useState('');
  const [shadowPos, setShadowPos] = useState({ top: 0, left: 0, width: 240 });
  const inputRef = useRef<HTMLInputElement>(null);
  const shadowRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const committingRef = useRef(false);
  const isFormula = looksLikeCalcFormula(value);

  const toAmountDraft = (raw: string): string => {
    const base = editingDraftFromCellValue(raw);
    if (!base) return '';
    if (!amountFormat || looksLikeCalcFormula(base)) return base;
    const n = parseFloat(base);
    return Number.isFinite(n) ? numberToTrAmountInput(n) : base;
  };

  const placeShadow = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setShadowPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width + 88, 320),
    });
  };

  const openShadow = (initial: string) => {
    setFormula(initial);
    setShadowOpen(true);
    setDraft(toAmountDraft(value));
    placeShadow();
    requestAnimationFrame(() => {
      shadowRef.current?.focus();
      const el = shadowRef.current;
      if (el) el.setSelectionRange(initial.length, initial.length);
    });
  };

  const handleFocus = () => {
    const initialDraft = toAmountDraft(value);
    setDraft(initialDraft);
    setEditing(true);
    onFocus?.();
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      if (initialDraft === '') {
        el.setSelectionRange(0, 0);
      } else {
        el.select();
      }
    });
  };

  const commit = (raw: string) => {
    if (committingRef.current) return;
    committingRef.current = true;
    setEditing(false);
    const evaluated = evaluateExpression(formulaForEval(raw));
    let final: string;
    if (evaluated !== null) {
      final = String(evaluated);
    } else if (amountFormat && !looksLikeCalcFormula(raw)) {
      const tr = parseTrAmountInput(raw);
      final = tr !== null ? String(Math.round(tr * 100) / 100) : normalizeCellNumericInput(raw);
    } else {
      final = normalizeCellNumericInput(raw);
    }
    onChange(final);
    onCommit(final);
    requestAnimationFrame(() => {
      committingRef.current = false;
    });
  };

  const commitShadow = () => {
    const evaluated = evaluateExpression(formulaForEval(formula));
    if (evaluated === null) return false;
    setShadowOpen(false);
    setFormula('');
    commit(String(evaluated));
    return true;
  };

  const closeShadow = () => {
    setShadowOpen(false);
    setFormula('');
    setEditing(false);
    setDraft(toAmountDraft(value));
  };

  const handleBlur = () => {
    if (committingRef.current || !editing || shadowOpen) return;
    commit(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (shadowOpen) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      commit(draft);
      if (onKeyDown) {
        onKeyDown(e);
        return;
      }
      if (e.key === 'Enter') e.preventDefault();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setDraft(toAmountDraft(value));
    }
    onKeyDown?.(e);
  };

  useEffect(() => {
    if (!shadowOpen) return;
    const onScroll = () => placeShadow();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [shadowOpen]);

  const idleDisplay =
    amountFormat && value && !looksLikeCalcFormula(value)
      ? (() => {
          const n = parseFloat(value);
          return Number.isFinite(n) ? numberToTrAmountInput(n) : value;
        })()
      : value;
  const displayValue = editing && !shadowOpen ? draft : idleDisplay;
  const shadowPreview = evaluateExpression(formulaForEval(formula));

  return (
    <div ref={wrapRef} className="relative flex items-center w-full min-h-11">
      {isFormula && !editing && !shadowOpen && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-indigo-400 bg-indigo-50 rounded px-0.5 leading-none select-none">fx</span>
      )}
      <input
        ref={inputRef}
        data-cell={dataCell}
        type="text"
        inputMode={amountFormat && !editing ? 'decimal' : undefined}
        className={`${className} ${isFormula && !editing ? 'pl-6' : ''}`}
        value={displayValue}
        placeholder={placeholder}
        tabIndex={tabIndex}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => {
          const next = e.target.value;
          if (shadowCalc && looksLikeCalcFormula(next)) {
            openShadow(next);
            return;
          }
          if (amountFormat && !looksLikeCalcFormula(next) && !/[+\-*/()]/.test(next)) {
            setDraft(formatTrAmountInput(next));
          } else {
            setDraft(next);
          }
        }}
        onKeyDown={handleKeyDown}
      />
      {shadowOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[80] rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-lg"
          style={{ top: shadowPos.top, left: shadowPos.left, width: shadowPos.width }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">fx</span>
            <input
              ref={shadowRef}
              type="text"
              className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={formula}
              aria-label="Miktar hesabı"
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!commitShadow()) return;
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeShadow();
                }
              }}
              onBlur={() => {
                if (!commitShadow()) closeShadow();
              }}
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
              {shadowPreview !== null ? `= ${shadowPreview}` : '= …'}
            </span>
            <button
              type="button"
              title="Onayla"
              aria-label="Onayla"
              disabled={shadowPreview === null}
              onClick={() => { void commitShadow(); }}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title="İptal"
              aria-label="İptal"
              onClick={closeShadow}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-status-danger"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>,
        document.body,
      )}
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

const KALEM_COL_WIDTHS_KEY = 'onarim-kalem-col-widths-v1';
const KALEM_DEFAULT_COL_WIDTHS: Record<string, number> = {
  idx: 36,
  damageCategory: 88,
  detectionScope: 110,
  location: 120,
  workGroup: 140,
  jobDescription: 170,
  description: 180,
  quantity: 88,
  unit: 88,
  sales: 130,
  cost: 130,
  total: 120,
  actions: 108,
};

function loadKalemColWidths(): Record<string, number> {
  if (typeof window === 'undefined') return { ...KALEM_DEFAULT_COL_WIDTHS };
  try {
    const raw = window.localStorage.getItem(KALEM_COL_WIDTHS_KEY);
    if (!raw) return { ...KALEM_DEFAULT_COL_WIDTHS };
    const parsed = JSON.parse(raw) as Record<string, number>;
    return { ...KALEM_DEFAULT_COL_WIDTHS, ...parsed };
  } catch {
    return { ...KALEM_DEFAULT_COL_WIDTHS };
  }
}

function KalemColResizeHandle({
  colKey,
  onResize,
}: {
  colKey: string;
  onResize: (colKey: string, nextWidth: number) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Sütun genişliğini ayarla"
      className="absolute right-0 top-0 z-40 h-full w-1.5 cursor-col-resize select-none hover:bg-brand-600/40"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const th = (e.currentTarget as HTMLElement).closest('th');
        const startW = th?.getBoundingClientRect().width ?? KALEM_DEFAULT_COL_WIDTHS[colKey] ?? 100;
        const onMove = (ev: MouseEvent) => {
          const next = Math.max(56, Math.min(420, Math.round(startW + (ev.clientX - startX))));
          onResize(colKey, next);
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }}
    />
  );
}

const EditableItemsTable = forwardRef<EditableItemsTableHandle, EditableItemsTableProps>(function EditableItemsTable(
  { items, workGroups, isEditable, viewMode, onSave, onDelete, onAdd, onDirtyChange, onWorkGroupCreated, onNotify, onConfirm },
  ref,
) {
  const notify = onNotify ?? ((_type: 'error' | 'warning' | 'success', _message: string) => {});
  const askConfirm = onConfirm ?? (async (_message: string) => window.confirm(_message));
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
  const [colWidths, setColWidths] = useState<Record<string, number>>(loadKalemColWidths);
  const tableRef = useRef<HTMLDivElement>(null);

  const resizeCol = useCallback((colKey: string, nextWidth: number) => {
    setColWidths((prev) => {
      const next = { ...prev, [colKey]: nextWidth };
      try {
        window.localStorage.setItem(KALEM_COL_WIDTHS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const thCls = (extra = '') =>
    `sticky top-0 z-30 relative px-2 py-2 text-center text-slate-500 font-medium border-b border-r border-slate-200 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0] ${extra}`;
  const addingDraftRef = useRef<RowState>(emptyRow());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [descriptionErrors, setDescriptionErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    addingDraftRef.current = addingRow;
  }, [addingRow]);

  // locationList + tespit alanları (sistem tanımları + rapor içi)
  const [detectionScopeList, setDetectionScopeList] = useState<string[]>([...DEFAULT_DETECTION_SCOPES]);

  useEffect(() => {
    axios
      .get(`${API}/system-settings/tespit-alanlari`, { headers: authHeader() })
      .then((res) => {
        const entries = (res.data?.data ?? res.data ?? []) as { name?: string }[];
        const names = entries.map((e) => formatDetectionScopeLabel(e.name ?? '')).filter(Boolean);
        if (names.length > 0) {
          setDetectionScopeList((prev) => Array.from(new Set([...names, ...prev])));
        }
      })
      .catch(() => { /* varsayılan liste */ });
  }, []);

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
    setDetectionScopeList((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const createDetectionScope = async (name: string): Promise<{ name: string }> => {
    const res = await axios.post(
      `${API}/system-settings/tespit-alanlari`,
      { name: toTitleCaseTR(name.trim()) },
      { headers: authHeader() },
    );
    const entry = res.data?.data ?? res.data;
    const label = formatDetectionScopeLabel(entry?.name ?? name);
    addDetectionScopeIfNew(label);
    return { name: label };
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
    const code = `IS_TANIM_${Date.now()}`;
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

  const updateRowFields = (id: string, patch: Partial<RowState>, opts?: { markDirty?: boolean }) => {
    const markDirty = opts?.markDirty ?? true;
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, ...patch, _isDirty: markDirty ? true : r._isDirty } : r));
  };

  const updateRowCategory = (id: string, patch: Partial<RowState>) => {
    updateRowFields(id, patch);
  };

  const isRowDirty = (id: string) => Boolean(rowsRef.current.find((r) => r._id === id)?._isDirty);

  const flushActiveCellEdits = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && tableRef.current?.contains(active)) {
      active.blur();
    }
  };

  const revertRow = (id: string) => {
    const original = items.find((i: any) => i.id === id);
    if (original) {
      setRows((prev) => prev.map((r) => r._id === id ? { ...rowFromItem(original), _id: id, _isDirty: false, _savedFlash: false } : r));
    }
  };

  const isRowPersistable = (row: RowState) => isRowPersistableFields(row);

  const saveRow = async (
    id: string,
    fieldOverrides?: Partial<RowState>,
    opts?: { explicit?: boolean; skipRevertIfIncomplete?: boolean },
  ) => {
    const baseRow = rowsRef.current.find((r) => r._id === id);
    if (!baseRow) return;
    const row = fieldOverrides ? { ...baseRow, ...fieldOverrides, _isDirty: true } : baseRow;
    if (!row._isDirty) return;
    if (!isRowPersistable(row)) {
      if (!row.detectionScope.trim()) {
        if (opts?.explicit) {
          notify('error', 'Tespit Alanı zorunludur.');
          focusCell(rowsRef.current.findIndex((r) => r._id === id), 'detectionScope');
        }
      } else if (opts?.explicit && !row.jobDescription.trim()) {
        notify('error', 'İş Tanımı zorunludur.');
        focusCell(rowsRef.current.findIndex((r) => r._id === id), 'jobDescription');
      }
      if (opts?.skipRevertIfIncomplete) return;
      if (opts?.explicit) return;
      revertRow(id);
      return;
    }
    if (row.location.trim() && !isValidLocationFormat(row.location)) {
      notify('error', 'Mahal/Bölge formatı zorunlu: Kelime1 - Kelime2 (ör. Salon - Zemin)');
      focusCell(rowsRef.current.findIndex((r) => r._id === id), 'location');
      return;
    }

    if (row.workGroupId && row.jobDescription.trim()) {
      const stored = readVendorPriceMemory(row.workGroupId, row.jobDescription);
      const memoryPriceRaw = stored ? resolveMemorySupplierPrice(stored) : null;
      const memoryPrice = memoryPriceRaw ? parseFloat(memoryPriceRaw) : 0;
      const entered = parseFloat(row.supplierUnitPrice || '0');
      if (memoryPrice > 0 && entered > 0 && !isVendorPriceWithinTolerance(entered, memoryPrice)) {
        const memLabel = memoryPrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
        const ok = await askConfirm(`Hafızadaki ${memLabel} TL — devam?`);
        if (!ok) {
          setVendorModalRowId(id);
          return;
        }
      }
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

  const tryAutoSaveRow = (id: string, fieldOverrides?: Partial<RowState>) => {
    void saveRow(id, fieldOverrides, { skipRevertIfIncomplete: true });
  };

  const explicitSaveRow = (id: string) => {
    flushActiveCellEdits();
    setTimeout(() => {
      void saveRow(id, undefined, { explicit: true });
    }, 0);
  };

  const saveAllDirtyRows = useCallback(async () => {
    const dirty = rows.filter((r) => r._isDirty);
    for (const row of dirty) {
      if (!isRowPersistable(row)) {
        revertRow(row._id);
        continue;
      }
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
    const draft = addingDraftRef.current;
    if (!draft.workGroupId || !draft.jobDescription) return;
    if (!draft.detectionScope.trim()) {
      notify('error', 'Tespit Alanı zorunludur.');
      focusCell('new', 'detectionScope');
      return;
    }
    if (draft.location.trim() && !isValidLocationFormat(draft.location)) {
      notify('error', 'Mahal/Bölge formatı zorunlu: Kelime1 - Kelime2 (ör. Alt Kat - 5 Nolu Daire)');
      focusCell('new', 'location');
      return;
    }
    setAddingSaving(true);
    const draftSnapshot = { ...draft };
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
    const draft = addingDraftRef.current;
    const carryLocation = draft.location;
    if (!addingDirty || !isRowPersistableFields(draft)) {
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

  const resetAddingDraft = useCallback((preservedLocation = '') => {
    const nextAddingRow = emptyRow(preservedLocation);
    addingDraftRef.current = nextAddingRow;
    setAddingRow(nextAddingRow);
    setAddingDirty(false);
  }, []);

  const explicitSaveAddingRow = async () => {
    flushActiveCellEdits();
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    const draft = addingDraftRef.current;
    if (isAddingRowMeaningfullyEmpty(draft)) return;
    const gap = describeAddingRowGap(draft);
    if (gap) {
      notify('warning', `${gap.message} Satır kaydedilmedi.`);
      focusCell('new', gap.focusCol);
      return;
    }
    if (draft.location.trim() && !isValidLocationFormat(draft.location)) {
      notify('error', 'Mahal/Bölge formatı zorunlu: Kelime1 - Kelime2 (ör. Salon - Zemin)');
      focusCell('new', 'location');
      return;
    }
    await saveAddingRow();
  };

  const prepareGlobalSave = useCallback(async () => {
    flushActiveCellEdits();
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    const draft = addingDraftRef.current;
    if (!addingDirty) return;
    if (isAddingRowMeaningfullyEmpty(draft)) {
      resetAddingDraft(draft.location.trim());
      return;
    }
    if (isRowPersistableFields(draft)) {
      await saveAddingRow();
      return;
    }
    const gap = describeAddingRowGap(draft);
    notify(
      'warning',
      gap
        ? `Son satır eksik (${gap.message.replace(/\.$/, '')}). Bu satır kaydedilmedi; diğer kayıtlar devam ediyor.`
        : 'Son satır eksik bırakıldı. Bu satır kaydedilmedi; diğer kayıtlar devam ediyor.',
    );
    resetAddingDraft(draft.location.trim());
  }, [addingDirty, notify, resetAddingDraft]);

  const discardEmptyDraft = useCallback(() => {
    const draft = addingDraftRef.current;
    if (!isAddingRowMeaningfullyEmpty(draft)) return;
    resetAddingDraft(draft.location.trim());
  }, [resetAddingDraft]);

  useImperativeHandle(ref, () => ({
    quickAddRow,
    saveAllDirtyRows,
    prepareGlobalSave,
    discardEmptyDraft,
    hasDirtyRows: () => rows.some((r) => r._isDirty) || addingDirty,
  }), [quickAddRow, saveAllDirtyRows, prepareGlobalSave, discardEmptyDraft, rows, addingDirty]);


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
        const salesStr = String(Math.round(newSales * 100) / 100);
        await onSave(row._id, {
          workGroupId: row.workGroupId || undefined,
          location: row.location ? normalizeLocationLabel(row.location) : undefined,
          jobDescription: row.jobDescription,
          description: row.description || undefined,
          quantity: parseFloat(row.quantity) || 1,
          unit: row.unit,
          salesUnitPrice: parseFloat(salesStr),
          // Tedarikçi teklifi maliyet referansıdır; ticari revizyonla değiştirilmez.
          supplierUnitPrice: parseFloat(row.supplierUnitPrice) || 0,
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
        void explicitSaveAddingRow();
        return;
      }
      if (rowId) explicitSaveRow(rowId);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === 'new') {
        const canSave = addingDirty;
        if (canSave && colIdx === editableCOLS.length - 1) {
          void explicitSaveAddingRow();
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
      } else {
        const sourceRow = rowIdx === 'new' ? addingRow : rows[rowIdx as number];
        if (rowIdx !== 'new' && rowId && isRowDirty(rowId)) {
          tryAutoSaveRow(rowId);
        }
        const nextAddingRow = {
          ...emptyRow(sourceRow?.location?.trim() || ''),
          detectionScope: sourceRow?.detectionScope?.trim() || '',
          damageCategory: (sourceRow?.damageCategory ?? 'bina') as 'bina' | 'esya',
          workGroupId: sourceRow?.workGroupId ?? '',
          unit: sourceRow?.unit ?? 'm²',
          damageTypeId: sourceRow?.damageTypeId ?? '',
          pricingType: sourceRow?.pricingType ?? 'unit',
        };
        addingDraftRef.current = nextAddingRow;
        setAddingRow(nextAddingRow);
        setAddingDirty(false);
        focusCell('new', editableCOLS[0]);
      }
    }
  };

  // ONARIM_TABLO_SADE_KILIT: grup şerit satırları (Tespit:/Mahal:/İş Grubu:) yasak — sade hücre tablosu.
  // Regresyon: apps/web/src/utils/onarim-raporu-tablo.lock.spec.ts + .cursor/rules/onarim-raporu-tablo-kilidi.mdc

  const cellCls = (rowIdx: number | 'new', col: string, editable: boolean) => {
    const isActive = activeCell?.rowIdx === rowIdx && activeCell?.col === col;
    const isAmountCol = col === 'salesUnitPrice' || col === 'supplierUnitPrice';
    const base = `w-full ${isAmountCol ? 'h-11 px-2.5 text-sm font-medium' : 'h-10 px-2 text-xs'} bg-transparent outline-none border-0`;
    const activeCls = isActive && editable ? 'ring-2 ring-inset ring-brand-600 bg-blue-50/40 rounded' : '';
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
          className="text-xs bg-status-warning text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
          className="text-xs font-medium text-brand-600 hover:text-blue-800 hover:underline disabled:opacity-50"
        >
          {quickAdding ? 'Ekleniyor...' : '+ Kalem Ekle'}
        </button>
      </div>
    )}
    {/*
      Mustafa UX (v329): tablo üzerinde mouse wheel → SAYFA değil TABLO kayar;
      satırlar kolon başlıklarının ALTINA girer (sticky thead).
      v328 Option B yanlıştır: max-h yok → sayfa scroll → sticky hissedilmez.
      Kök: tablo kendi max-h + overflow-y-auto scrollport’u; sticky th bu porta bağlı.
      border-collapse sticky’yi kırar → border-separate. overscroll-contain: zincirleme sayfa kaymasını keser.
    */}
    <div ref={tableRef} className="rounded-lg border border-slate-200">
      <style>{`
        @keyframes savedFlash {
          0% { background-color: #dcfce7; }
          100% { background-color: transparent; }
        }
        .saved-flash { animation: savedFlash 0.9s ease-out forwards; }
      `}</style>
      <div
        data-kalem-scrollport="v329"
        className="max-h-[50vh] overflow-y-auto overflow-x-auto overscroll-contain"
      >
      <table className="w-full text-xs border-separate border-spacing-0 table-fixed min-w-[980px]">
        <colgroup>
          {isEditable && <col style={{ width: colWidths.idx }} />}
          <col style={{ width: colWidths.damageCategory }} />
          <col style={{ width: colWidths.detectionScope }} />
          <col style={{ width: colWidths.location }} />
          <col style={{ width: colWidths.workGroup }} />
          <col style={{ width: colWidths.jobDescription }} />
          <col style={{ width: colWidths.description }} />
          <col style={{ width: colWidths.quantity }} />
          <col style={{ width: colWidths.unit }} />
          <col style={{ width: colWidths.sales }} />
          {viewMode === 'internal' && <col style={{ width: colWidths.cost }} />}
          <col style={{ width: colWidths.total }} />
          {isEditable && <col style={{ width: colWidths.actions }} />}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            {isEditable && (
              <th className={thCls('text-slate-400 border-r')}>
                #
                <KalemColResizeHandle colKey="idx" onResize={resizeCol} />
              </th>
            )}
            <th className={thCls()}>
              Kategori
              <KalemColResizeHandle colKey="damageCategory" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Tespit Alanı <span className="text-status-danger">*</span>
              <KalemColResizeHandle colKey="detectionScope" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Mahal/Bölge
              <KalemColResizeHandle colKey="location" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              İş Grubu
              <KalemColResizeHandle colKey="workGroup" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              İş Tanımı
              <KalemColResizeHandle colKey="jobDescription" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Açıklama <span className="text-status-danger">*</span>
              <KalemColResizeHandle colKey="description" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Miktar
              <KalemColResizeHandle colKey="quantity" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Birim
              <KalemColResizeHandle colKey="unit" onResize={resizeCol} />
            </th>
            <th className={thCls()}>
              Satış Fiyatı
              <KalemColResizeHandle colKey="sales" onResize={resizeCol} />
            </th>
            {viewMode === 'internal' && (
              <th className={thCls()}>
                Maliyet
                <KalemColResizeHandle colKey="cost" onResize={resizeCol} />
              </th>
            )}
            <th className={thCls('border-r-0')}>
              Toplam
              <KalemColResizeHandle colKey="total" onResize={resizeCol} />
            </th>
            {isEditable && (
              <th className={thCls('border-l border-r-0')}>
                İşlem
                <KalemColResizeHandle colKey="actions" onResize={resizeCol} />
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {displayRows.map((row, rowIdx) => {
            const total = calcTotal(row);
            const isSaving = savingId === row._id;
            const wgName = workGroups.find((wg: any) => wg.id === row.workGroupId)?.name ?? '';
            const rowSubGroups = resolveSubGroups(row.workGroupId);
            const subGroupsLoading = row.workGroupId ? loadingSubGroupIds.has(row.workGroupId) : false;
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
                      onBlur={() => { tryAutoSaveRow(row._id); }}
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
                    <DetectionScopeSelector
                      data-cell={`${rowIdx}-detectionScope`}
                      className={cellCls(rowIdx, 'detectionScope', true)}
                      value={row.detectionScope}
                      scopes={detectionScopeList}
                      onSelect={(v) => updateRow(row._id, 'detectionScope', v)}
                      onAddNew={createDetectionScope}
                      tabIndex={getCellTabIndex(rowIdx, 'detectionScope')}
                      onFocus={() => setActiveCell({ rowIdx, col: 'detectionScope' })}
                      onBlur={() => { tryAutoSaveRow(row._id); }}
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
                      onBlur={() => { tryAutoSaveRow(row._id); }}
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
                      onBlur={() => { tryAutoSaveRow(row._id); }}
                      onSelect={(workGroupId) => {
                        updateRowFields(row._id, {
                          workGroupId,
                          jobDescription: '',
                          unit: 'm²',
                        });
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
                        onBlur={() => { tryAutoSaveRow(row._id); }}
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
                        onNotify={onNotify}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'jobDescription', row._id)}
                      />
                      )
                    ) : (
                      <span className="px-2 text-xs font-medium text-status-danger block py-3">Önce İş Grubu seçin</span>
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
                        const current = rowsRef.current.find((r) => r._id === row._id);
                        const desc = current?.description ?? row.description;
                        const titleVal = toTitleCaseTR(desc.trim());
                        if (titleVal !== desc) updateRow(row._id, 'description', titleVal);
                        if (!desc.trim()) {
                          setDescriptionErrors((prev) => new Set([...prev, row._id]));
                        } else {
                          setDescriptionErrors((prev) => { const n = new Set(prev); n.delete(row._id); return n; });
                          tryAutoSaveRow(row._id);
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
                    <div className="w-full">
                      <div className="flex items-center w-full">
                        <CalcInput
                          data-cell={`${rowIdx}-quantity`}
                          shadowCalc
                          className={`${cellCls(rowIdx, 'quantity', true)} text-right flex-1`}
                          value={row.quantity}
                          onChange={(v) => updateRow(row._id, 'quantity', v)}
                          onCommit={(v) => setTimeout(() => tryAutoSaveRow(row._id, { quantity: v }), 50)}
                          tabIndex={getCellTabIndex(rowIdx, 'quantity')}
                          onFocus={() => setActiveCell({ rowIdx, col: 'quantity' })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'quantity', row._id)}
                        />
                        <button
                          type="button"
                          title="Metraj Hesaplama Asistanı"
                          onClick={() => setMetrajModalRowId(row._id)}
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-blue-50 rounded transition-colors ml-0.5"
                        >
                          📐
                        </button>
                      </div>
                      {(() => {
                        const entryCount = readMetrajEntries(row.metrajData).length;
                        return entryCount > 0 ? (
                          <p className="text-[10px] text-brand-600 font-medium text-right pr-7 mt-0.5">
                            Metraj: {entryCount} mahal
                          </p>
                        ) : null;
                      })()}
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
                      onBlur={() => { tryAutoSaveRow(row._id); }}
                      onChange={(e) => updateRow(row._id, 'unit', e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'unit', row._id)}
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 text-xs text-slate-700 block py-3">{row.unit}</span>
                  )}
                </td>
                {/* Satış Fiyatı — CalcInput (geniş + binlik ayraç) */}
                <td className={`${tdCls(rowIdx, 'salesUnitPrice')} text-right min-w-[148px] ${isLoss ? 'bg-red-50/40' : ''}`}>
                  {isEditable ? (
                    <div className="relative flex items-center min-h-11">
                      <CalcInput
                        data-cell={`${rowIdx}-salesUnitPrice`}
                        amountFormat
                        className={`${cellCls(rowIdx, 'salesUnitPrice', true)} text-right pr-12 ${isLoss ? '!ring-2 !ring-inset !ring-status-danger !rounded-md' : ''}`}
                        value={row.salesUnitPrice}
                        onChange={(v) => updateRow(row._id, 'salesUnitPrice', v)}
                        onCommit={(v) => setTimeout(() => tryAutoSaveRow(row._id, { salesUnitPrice: v }), 50)}
                        tabIndex={getCellTabIndex(rowIdx, 'salesUnitPrice')}
                        onFocus={() => setActiveCell({ rowIdx, col: 'salesUnitPrice' })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'salesUnitPrice', row._id)}
                      />
                      <div className="absolute right-1.5 flex items-center gap-1 pointer-events-none">
                        {isLoss && (
                          <span
                            title="Tedarikçi fiyatı satış fiyatından yüksek — bu kalemde zarar var"
                            className="pointer-events-auto cursor-help inline-flex items-center rounded bg-status-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-danger"
                          >
                            Zarar
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-500 select-none">TL</span>
                      </div>
                    </div>
                  ) : (
                    <span className="px-2 text-sm text-slate-700 block py-3 text-right">{fmtCurrency(parseFloat(row.salesUnitPrice))}</span>
                  )}
                </td>
                {/* Maliyet (Tedarikçi Fiyatı, internal only) — CalcInput */}
                {viewMode === 'internal' && (
                  <td className={`${tdCls(rowIdx, 'supplierUnitPrice')} text-right min-w-[148px] ${isLoss ? 'bg-status-warning/10' : ''}`}>
                    {isEditable ? (
                      <div className="relative flex items-center justify-end min-h-11 px-1">
                        <CalcInput
                          data-cell={`${rowIdx}-supplierUnitPrice`}
                          amountFormat
                          className={`${cellCls(rowIdx, 'supplierUnitPrice', true)} text-right pr-10 text-slate-600 ${isLoss ? '!ring-2 !ring-inset !ring-status-warning !rounded-md' : ''}`}
                          value={row.supplierUnitPrice}
                          onChange={(v) => updateRow(row._id, 'supplierUnitPrice', v)}
                          onCommit={(v) => setTimeout(() => tryAutoSaveRow(row._id, { supplierUnitPrice: v }), 50)}
                          tabIndex={getCellTabIndex(rowIdx, 'supplierUnitPrice')}
                          onFocus={() => setActiveCell({ rowIdx, col: 'supplierUnitPrice' })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 'supplierUnitPrice', row._id)}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none select-none">TL</span>
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-right">
                        <span className="text-sm text-slate-500 block">{fmtCurrency(parseFloat(row.supplierUnitPrice))}</span>
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
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={isSaving || !row._isDirty}
                        onClick={() => explicitSaveRow(row._id)}
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
                <DetectionScopeSelector
                  data-cell="new-detectionScope"
                  className={cellCls('new', 'detectionScope', true)}
                  value={addingRow.detectionScope}
                  scopes={detectionScopeList}
                  onSelect={(v) => { setAddingRow((p) => ({ ...p, detectionScope: v })); setAddingDirty(true); }}
                  onAddNew={createDetectionScope}
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
                  <span className="px-2 text-xs font-medium text-status-danger block py-3">Önce İş Grubu seçin</span>
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
                    onNotify={onNotify}
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
                <div className="w-full">
                  <div className="flex items-center w-full">
                    <CalcInput
                      data-cell="new-quantity"
                      shadowCalc
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
                      className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-blue-50 rounded transition-colors ml-0.5"
                    >
                      📐
                    </button>
                  </div>
                  {(() => {
                    const entryCount = readMetrajEntries(addingRow.metrajData).length;
                    return entryCount > 0 ? (
                      <p className="text-[10px] text-brand-600 font-medium text-right pr-7 mt-0.5">
                        Metraj: {entryCount} mahal
                      </p>
                    ) : null;
                  })()}
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
              <td className={`${tdCls('new', 'salesUnitPrice')} text-right min-w-[148px]`}>
                <div className="relative flex items-center min-h-11">
                  <CalcInput
                    data-cell="new-salesUnitPrice"
                    amountFormat
                    className={`${cellCls('new', 'salesUnitPrice', true)} text-right pr-10`}
                    value={addingRow.salesUnitPrice}
                    onChange={(v) => { setAddingRow((p) => ({ ...p, salesUnitPrice: v })); setAddingDirty(true); }}
                    onCommit={() => {}}
                    tabIndex={getCellTabIndex('new', 'salesUnitPrice')}
                    onFocus={() => setActiveCell({ rowIdx: 'new', col: 'salesUnitPrice' })}
                    onKeyDown={(e) => handleCellKeyDown(e, 'new', 'salesUnitPrice')}
                  />
                  <span className="absolute right-2 text-xs font-semibold text-slate-500 pointer-events-none select-none">TL</span>
                </div>
              </td>
              {/* Maliyet (Tedarikçi Fiyatı) — CalcInput */}
              {viewMode === 'internal' && (
                <td className={`${tdCls('new', 'supplierUnitPrice')} text-right min-w-[148px]`}>
                  <div className="relative flex items-center justify-end min-h-11 px-1">
                    <CalcInput
                      data-cell="new-supplierUnitPrice"
                      amountFormat
                      className={`${cellCls('new', 'supplierUnitPrice', true)} text-right pr-10 text-slate-600`}
                      value={addingRow.supplierUnitPrice}
                      onChange={(v) => { setAddingRow((p) => ({ ...p, supplierUnitPrice: v })); setAddingDirty(true); }}
                      onCommit={() => {}}
                      tabIndex={getCellTabIndex('new', 'supplierUnitPrice')}
                      onFocus={() => setActiveCell({ rowIdx: 'new', col: 'supplierUnitPrice' })}
                      onKeyDown={(e) => handleCellKeyDown(e, 'new', 'supplierUnitPrice')}
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none select-none">TL</span>
                  </div>
                </td>
              )}
              {/* Toplam preview */}
              <td className="px-2 py-3 text-right border-l border-slate-100">
                {addingDirty && (
                  <span className="text-xs text-brand-600 font-semibold">
                    {fmtCurrency(calcTotal(addingRow))}
                  </span>
                )}
              </td>
              {isEditable && (
                <td className="min-w-[108px] border-l border-slate-100 text-center px-1 py-1">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={addingSaving || !addingDirty}
                      onClick={() => void explicitSaveAddingRow()}
                      className="h-7 px-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-default flex items-center justify-center gap-0.5 transition-colors text-[10px] font-medium"
                      title="Satırı Kaydet (Ctrl+Enter)"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ↵
                    </button>
                  </div>
                </td>
              )}
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {isEditable && (
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { void quickAddRow(); }}
            className="text-xs font-medium text-brand-600 hover:text-blue-800 hover:underline"
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
    {/* Tedarikçi pazarlık modalı (maliyet hafızası uyumsuzluğunda) */}
    {vendorModalRowId !== null && vendorModalRowId !== 'new' && (() => {
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
            setTimeout(() => tryAutoSaveRow(vendorModalRowId), 50);
            setVendorModalRowId(null);
          }}
        />
      );
    })()}

    {/* Metraj Hesaplama Modal */}
    {metrajModalRowId !== null && (() => {
      const sourceRow = metrajModalRowId === 'new'
        ? addingRow
        : rows.find((r) => r._id === metrajModalRowId);
      const initialEntries = readMetrajEntries(sourceRow?.metrajData);
      return (
        <MetrajHesaplamaModal
          onClose={() => setMetrajModalRowId(null)}
          location={sourceRow?.location || undefined}
          initialEntries={initialEntries}
          onEntriesChange={(entries, totalQty) => {
            if (metrajModalRowId === 'new') {
              setAddingRow((p) => ({
                ...p,
                quantity: totalQty,
                metrajData: withMetrajEntries(p.metrajData, entries),
              }));
              setAddingDirty(true);
            } else {
              const current = rowsRef.current.find((r) => r._id === metrajModalRowId);
              const nextMetraj = withMetrajEntries(current?.metrajData, entries);
              updateRowFields(metrajModalRowId, {
                quantity: totalQty,
                metrajData: nextMetraj,
              });
              setTimeout(() => tryAutoSaveRow(metrajModalRowId, {
                quantity: totalQty,
                metrajData: nextMetraj,
              }), 50);
            }
          }}
        />
      );
    })()}
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
  const { showToast } = useToast();
  const notify = useCallback((type: 'error' | 'warning' | 'success', message: string) => {
    showToast(type, message);
  }, [showToast]);
  const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
  const [uploadingCat, setUploadingCat] = useState<string | null>(null);
  const [pendingImageUploads, setPendingImageUploads] = useState<PendingReportImageUpload[]>([]);
  const [localReport, setLocalReport] = useState(report);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!(await ensureSessionBeforeMutation())) {
      notify('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
      e.target.value = '';
      return;
    }
    const queue = files.map((file, index) => ({
      tempId: `upload-${Date.now()}-${index}-${file.name}`,
      category,
    }));
    setPendingImageUploads((prev) => [...prev, ...queue]);
    setUploadingCat(category);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { tempId } = queue[i];
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        const res = await authAxios<{ data: any }>({
          method: 'POST',
          url: `${API}/repair-reports/${reportId}/images`,
          data: fd,
        });
        if (res.data?.data) {
          setLocalReport((prev: any) => ({
            ...prev,
            images: [...(prev?.images ?? []), res.data.data],
          }));
        }
        setPendingImageUploads((prev) => prev.filter((p) => p.tempId !== tempId));
      }
    } catch (err: any) {
      notify('error', err?.response?.data?.message ?? 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      console.error(err);
    } finally {
      setUploadingCat(null);
      setPendingImageUploads((prev) => prev.filter((p) => !queue.some((q) => q.tempId === p.tempId)));
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

  const handleDeleteMissingImages = async (imageIds: string[]) => {
    for (const imageId of imageIds) {
      try {
        await axios.delete(`${API}/report-images/${imageId}`, { headers: authHeader() });
      } catch (e) {
        console.error(e);
      }
    }
    const gone = new Set(imageIds);
    setLocalReport((prev: any) => ({
      ...prev,
      images: (prev?.images ?? []).filter((img: any) => !gone.has(img.id)),
    }));
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

  const openPdfPreview = async (view: 'internal' | 'external') => {
    try {
      const res = await axios.get(`${API}/repair-reports/${reportId}/pdf?view=${view}`, { headers: authHeader(), responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
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
          text={repairReportStatusLabel(report.status)}
          color={repairReportStatusBadge(report.status)}
        />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Müşteri Görünümü / Tam Görünüm toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('internal');
                void openPdfPreview('internal');
              }}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'internal' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="Tam görünüm PDF önizlemesi — TDR, Marj ve Kâr dahil"
            >
              Tam Görünüm
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('external');
                void openPdfPreview('external');
              }}
              className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${viewMode === 'external' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="Müşteri görünümü PDF önizlemesi — TDR, Marj ve Kâr gizli"
            >
              Müşteri Görünümü
            </button>
          </div>
          <button type="button" onClick={() => handleDownloadPdf('external')} className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1" title="Müşteri PDF&apos;i — TDR/Marj/Kâr gizli">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            PDF (Müşteri)
          </button>
          {viewMode === 'internal' && <button type="button" onClick={() => handleDownloadPdf('internal')} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 flex items-center gap-1" title="İç PDF — TDR/Marj/Kâr dahil">
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
          <SectionCard title="Fotoğraflar">
            {isEditable && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {REPORT_IMAGE_CATEGORY_KEYS.map((cat) => (
                  <label
                    key={cat}
                    className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg transition-colors ${uploadingCat === cat ? 'bg-blue-200 text-blue-700 cursor-wait' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    {uploadingCat === cat ? 'Yükleniyor...' : `+ ${REPORT_IMAGE_CATEGORY_LABELS[cat]}`}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                      multiple
                      className="hidden"
                      disabled={uploadingCat !== null}
                      onChange={(e) => handleImageUpload(e, cat)}
                    />
                  </label>
                ))}
              </div>
            )}
            {!localReport.images?.length && !pendingImageUploads.length ? (
              <div className="text-center py-6 text-slate-400 text-sm">Fotoğraf Yok.</div>
            ) : (
              <ReportImageGallery
                images={localReport.images ?? []}
                pendingUploads={pendingImageUploads}
                isEditable={isEditable}
                fileNo={localReport.claimFile?.fileNo ?? localReport.fileNo}
                onDelete={(imageId) => void handleDeleteImage(imageId)}
                onDeleteMany={handleDeleteMissingImages}
              />
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
              text={repairReportStatusLabel(report.status)}
              color={repairReportStatusBadge(report.status)}
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg px-4 sm:px-6 py-3 z-30">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="hidden lg:block" />
          <div className="flex items-center justify-center min-w-0">
            {viewMode === 'internal' && (
              <div className="flex items-center gap-4 flex-wrap text-sm">
                <span className="text-slate-500">Satış: <strong className="text-slate-800">{fmtCurrency(localReport.totalSalesAmount ?? totalSalesAmount)}</strong></span>
                <span className="text-slate-500">Kâr: <strong className={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtCurrency(localReport.grossProfit ?? grossProfit)}</strong></span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
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
  const { showToast } = useToast();
  const { registerGuard, tryNavigate, showSaveReminder, allowUnloadRef } = useNavigationGuard();
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  const askConfirm = useCallback((message: string) => new Promise<boolean>((resolve) => {
    setConfirmDialog({ message, resolve });
  }), []);
  const notify = useCallback((type: 'error' | 'warning' | 'success', message: string) => {
    showToast(type, message);
  }, [showToast]);
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
  const [budgetQuotesOpen, setBudgetQuotesOpen] = useState(false);
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
  const [selectedVendorKeys, setSelectedVendorKeys] = useState<string[]>([]);
  const [claimVendors, setClaimVendors] = useState<ClaimVendorSource[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [fieldSurveyOpen, setFieldSurveyOpen] = useState(false);
  const [fieldSurveyRefreshKey, setFieldSurveyRefreshKey] = useState(0);
  const [dosyaBilgiOpen, setDosyaBilgiOpen] = useState(true);
  const [showRequestApprovalModal, setShowRequestApprovalModal] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [confirmSendWithoutImages, setConfirmSendWithoutImages] = useState(false);
  const [itemsApprovalError, setItemsApprovalError] = useState<string | null>(null);
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
  const [pendingImageUploads, setPendingImageUploads] = useState<PendingReportImageUpload[]>([]);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const bulgularTextareaRef = useRef<HTMLTextAreaElement>(null);
  const itemsTableRef = useRef<EditableItemsTableHandle>(null);
  const [dirtyItemCount, setDirtyItemCount] = useState(0);
  const [sessionSaveCount, setSessionSaveCount] = useState(0);
  const [sessionCancelCount, setSessionCancelCount] = useState(0);
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

      try {
        const vcRes = await axios.get(`${API}/vendor-contracts?claimFileId=${claimId}`, { headers: authHeader() });
        const contracts: any[] = vcRes.data.data ?? [];
        const vendors: ClaimVendorSource[] = [];
        const seen = new Set<string>();
        for (const contract of contracts) {
          const vendor = contract.vendor;
          if (!vendor?.id || seen.has(vendor.id)) continue;
          seen.add(vendor.id);
          vendors.push({
            id: vendor.id,
            name: vendor.name ?? contract.vendorName ?? 'Tedarikçi',
            phone: vendor.phone ?? contract.vendorPhone,
            authorizedPhone: vendor.authorizedPhone,
          });
        }
        setClaimVendors(vendors);
      } catch (_) {
        setClaimVendors([]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [reportId, claimId]);

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
    }));
    void axios.post(`${API}/repair-reports/${reportId}/write-session`, {
      startedAt,
      claimFileId: claimId,
    }, { headers: authHeader() }).catch(() => {});
  }, [report, reportId, claimId]);

  useEffect(() => {
    if (!reportId) return;
    const closeSession = () => {
      try {
        const raw = sessionStorage.getItem('report-write-started-at');
        if (!raw) return;
        const parsed = JSON.parse(raw) as { reportId?: string };
        if (parsed.reportId !== reportId) return;
        const endedAt = new Date().toISOString();
        navigator.sendBeacon?.(
          `${API}/repair-reports/${reportId}/write-session/close`,
          new Blob([JSON.stringify({ endedAt })], { type: 'application/json' }),
        );
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', closeSession);
    return () => {
      closeSession();
      window.removeEventListener('beforeunload', closeSession);
      void axios.post(`${API}/repair-reports/${reportId}/write-session/close`, {
        endedAt: new Date().toISOString(),
      }, { headers: authHeader() }).catch(() => {});
    };
  }, [reportId]);

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
        showSaveReminder();
        lastWriteActivityRef.current = Date.now();
      }
      const hasDirtyItems = dirtyItemCount > 0;
      if (!hasPending && hasDirtyItems && idleMs >= 3 * 60 * 1000) {
        showSaveReminder();
        lastWriteActivityRef.current = Date.now();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [report?.status, pendingFields, dirtyItemCount, showSaveReminder]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowUnloadRef.current) return;
      if (Object.keys(pendingFields).length > 0 || dirtyItemCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pendingFields, dirtyItemCount, allowUnloadRef]);

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
    () => (report ? buildRepairReportShareRecipients(report, claimVendors) : []),
    [report, claimVendors],
  );

  const defaultRecipients = useMemo(
    () => shareRecipients.filter((r) => r.group !== 'vendor'),
    [shareRecipients],
  );

  const vendorRecipients = useMemo(
    () => shareRecipients.filter((r) => r.group === 'vendor'),
    [shareRecipients],
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

  const fileExpert = useMemo(
    () => resolveFileExpertDisplay(report ? {
      inspectorName: report.inspectorName,
      expertOffice: report.expertOffice,
      claimFile: report.claimFile,
    } : null),
    [report],
  );

  const insuredName = useMemo(
    () => resolveHasarInsuredName(report?.claimFile ?? {}),
    [report?.claimFile],
  );

  const quickDamageDisplayOptions = useMemo(
    () => buildQuickDamageDisplayOptions(report),
    [report],
  );

  const quickDamageTypeLabels = useMemo(
    () => Object.fromEntries(quickDamageDisplayOptions.map((opt) => [opt.value, opt.label])),
    [quickDamageDisplayOptions],
  );

  useEffect(() => {
    if (!report || quickDamageTypes.length > 0) return;
    const inferred = inferQuickDamageTypesFromReport(report);
    if (inferred.length > 0) setQuickDamageTypes(inferred);
  }, [report, quickDamageTypes.length]);

  const latestSubmission = useMemo(
    () => approvalHistory.find((h) => h.action === 'pending_approval'),
    [approvalHistory],
  );

  /** Rapor oluşturma → onaya sunum süresi (revizyon sonrası döngü bazlı) */
  const reportCycleStartAt = useMemo(() => {
    if (!report) return null;
    return (report.revisedAt ?? report.createdAt) as string;
  }, [report]);

  const reportCycleSubmission = useMemo(() => {
    if (!reportCycleStartAt) return null;
    const startMs = new Date(reportCycleStartAt).getTime();
    let latest: (typeof approvalHistory)[number] | null = null;
    for (const h of approvalHistory) {
      if (h.action !== 'pending_approval') continue;
      const ts = new Date(h.createdAt).getTime();
      if (ts < startMs - 2000) continue;
      if (!latest || ts > new Date(latest.createdAt).getTime()) latest = h;
    }
    return latest;
  }, [approvalHistory, reportCycleStartAt]);

  const [creationToApprovalLabel, setCreationToApprovalLabel] = useState('');

  useEffect(() => {
    if (!reportCycleStartAt) {
      setCreationToApprovalLabel('');
      return undefined;
    }
    const update = () => {
      const startMs = new Date(reportCycleStartAt).getTime();
      if (reportCycleSubmission) {
        const endMs = new Date(reportCycleSubmission.createdAt).getTime();
        setCreationToApprovalLabel(formatReportDuration(endMs - startMs));
        return;
      }
      setCreationToApprovalLabel(formatReportDuration(Date.now() - startMs));
    };
    update();
    if (reportCycleSubmission) return undefined;
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [reportCycleStartAt, reportCycleSubmission]);

  const latestApprovalDecision = useMemo(
    () => approvalHistory.find((h) => h.action === 'approved' || h.action === 'rejected'),
    [approvalHistory],
  );

  const openWhatsAppModal = useCallback(() => {
    const first = defaultRecipients[0];
    setWhatsAppRecipientKey(first?.key ?? '');
    setWhatsAppPhone(first?.phone ?? '');
    setWhatsAppManualMode(defaultRecipients.length === 0);
    setSelectedVendorKeys([]);
    setShowWhatsApp(true);
    setShowShareMenu(false);
  }, [defaultRecipients]);

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

  const handleRevise = () => {
    if (!canStartRepairReportRevisionFromStatus(report?.status)) {
      notify('error', 'Bu rapor durumunda revizyon başlatılamaz');
      return;
    }
    if (!canCreateRepairReportRevision(report?.versionNo ?? 0)) {
      notify('error', REPAIR_REPORT_MAX_REVISION_MESSAGE);
      return;
    }
    setShowReviseModal(true);
  };

  const confirmRevise = async (payload: ReviseReportPayload) => {
    if (!canStartRepairReportRevisionFromStatus(report?.status)) {
      notify('error', 'Bu rapor durumunda revizyon başlatılamaz');
      return;
    }
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
      notify('error', e.response?.data?.message ?? 'Revizyon Oluşturulamadı');
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
      notify('error', err?.response?.data?.message ?? 'Hızlı onarım kalemleri eklenemedi. Lütfen tekrar deneyin.');
      throw err;
    }
  };

  const handleSendExternalApproval = async () => {
    if (!externalApprovalForm.approverName && !externalApprovalForm.approverEmail) {
      notify('warning', 'Lütfen En Az Ad Soyad veya E-posta Giriniz'); return;
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
        notify('success', `Dış Onay Başarıyla Gönderildi. Onay Linki: ${publicUrl}`);
      }
    } catch (e: any) { notify('error', e.response?.data?.message ?? 'Gönderim Başarısız'); }
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
    } catch (e: any) { notify('error', e.response?.data?.message ?? 'Hata Oluştu'); }
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

  const handleUpdateField = (field: string, value: string) => {
    setPendingFields((prev) => ({ ...prev, [field]: value }));
    setReport((prev: any) => ({ ...prev, [field]: value }));
    touchWriteActivity();
  };

  const handleSaveReport = async () => {
    setFindingsError(null);
    setSaving(true);
    try {
      await itemsTableRef.current?.prepareGlobalSave();
      await itemsTableRef.current?.saveAllDirtyRows();
      if (Object.keys(pendingFields).length > 0) {
        await axios.put(`${API}/repair-reports/${reportId}`, pendingFields, { headers: authHeader() });
        setPendingFields({});
      }
      setSessionSaveCount((n) => n + 1);
      await loadKeepScroll();
    } catch (e: any) {
      notify('error', e.response?.data?.message ?? 'Kayıt Başarısız');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedReportFields = Object.keys(pendingFields).length > 0;

  const saveReminderDetail = useMemo(() => {
    if (hasUnsavedReportFields && dirtyItemCount > 0) return 'both' as const;
    if (hasUnsavedReportFields) return 'fields' as const;
    if (dirtyItemCount > 0) return 'items' as const;
    return 'none' as const;
  }, [hasUnsavedReportFields, dirtyItemCount]);

  const handleCancelChanges = async () => {
    setSessionCancelCount((n) => n + 1);
    if (Object.keys(pendingFields).length === 0 && dirtyItemCount === 0) {
      router.push(claimPath);
      return;
    }
    if (!(await askConfirm('Kaydedilmemiş değişiklikler var. Değişiklikleri iptal etmek istiyor musunuz?'))) return;
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

  useEffect(() => {
    registerGuard({
      hasUnsaved: () => Object.keys(pendingFields).length > 0 || dirtyItemCount > 0,
      detail: saveReminderDetail,
      saving,
      onSave: handleSaveReport,
      onDiscard: async () => {
        setPendingFields({});
        await loadKeepScroll();
      },
    });
    return () => registerGuard(null);
  }, [pendingFields, dirtyItemCount, saving, saveReminderDetail, registerGuard, handleSaveReport, loadKeepScroll]);

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

  const handleApplyCommercialRevision = async (rates: Record<string, number>) => {
    try {
      for (const item of report?.items ?? []) {
        const workGroupId = item.workGroupId ?? item.workGroup?.id ?? '__other__';
        const percentage = rates[workGroupId] ?? 0;
        if (!percentage) continue;
        const multiplier = 1 + percentage / 100;
        const isLumpSum = item.pricingType === 'lumpsum';
        await handleUpdateItemMain(item.id, {
          workGroupId: item.workGroupId || undefined,
          location: item.location ? normalizeLocationLabel(item.location) : undefined,
          jobDescription: item.jobDescription,
          description: item.description || undefined,
          quantity: Number(item.quantity) || 1,
          unit: item.unit,
          salesUnitPrice: isLumpSum ? Number(item.salesUnitPrice ?? 0) : Math.round(Number(item.salesUnitPrice ?? 0) * multiplier * 100) / 100,
          // Tedarikçi teklifi maliyet referansıdır; ticari revizyonla değiştirilmez.
          supplierUnitPrice: Number(item.supplierUnitPrice ?? 0),
          pricingType: item.pricingType,
          lumpSumPrice: isLumpSum ? Math.round(Number(item.lumpSumPrice ?? 0) * multiplier * 100) / 100 : undefined,
          damageCategory: item.damageCategory,
          damageTypeId: item.damageTypeId || undefined,
        });
      }
      showToast('success', 'Ticari revizyon uygulandı. Tedarikçi teklifleri korunmuştur.');
    } catch (error: unknown) {
      showToast('error', getApiErrorMessage(error, 'Ticari revizyon uygulanamadı.'));
      throw error;
    }
  };

  /**
   * İş grubu tedarikçi teklifini birim fiyatlı kalemlere oransal dağıtır.
   * Metraj/miktar ve satış fiyatı değişmez. Götürü (lumpsum) kalemlerde
   * tedarikçi maliyeti şema gereği satışla aynıdır; bu yüzden onlara dokunulmaz.
   */
  const handleApplySupplierGroupQuote = async (
    workGroupId: string,
    quoteTotal: number,
    options?: { quiet?: boolean },
  ) => {
    const groupItems = (report?.items ?? []).filter(
      (item: any) => (item.workGroupId ?? item.workGroup?.id ?? '__other__') === workGroupId,
    );
    const unitItems = groupItems.filter((item: any) => item.pricingType !== 'lumpsum');
    if (unitItems.length === 0) return;
    const currentTotal = unitItems.reduce((sum: number, item: any) => {
      return sum + Number(
        item.supplierTotal ?? Number(item.quantity ?? 0) * Number(item.supplierUnitPrice ?? 0),
      );
    }, 0);
    try {
      for (const item of unitItems) {
        const itemSupplier = Number(
          item.supplierTotal ?? Number(item.quantity ?? 0) * Number(item.supplierUnitPrice ?? 0),
        );
        const share = currentTotal > 0 ? itemSupplier / currentTotal : 1 / unitItems.length;
        const newItemTotal = Math.round(quoteTotal * share * 100) / 100;
        const qty = Number(item.quantity) || 1;
        await handleUpdateItemMain(item.id, {
          workGroupId: item.workGroupId || undefined,
          location: item.location ? normalizeLocationLabel(item.location) : undefined,
          jobDescription: item.jobDescription,
          description: item.description || undefined,
          quantity: qty,
          unit: item.unit,
          salesUnitPrice: Number(item.salesUnitPrice ?? 0),
          supplierUnitPrice: Math.round((newItemTotal / qty) * 100) / 100,
          pricingType: item.pricingType,
          damageCategory: item.damageCategory,
          damageTypeId: item.damageTypeId || undefined,
        });
      }
      if (!options?.quiet) {
        showToast('success', 'Tedarikçi teklifi iş grubuna uygulandı.');
      }
    } catch (error: unknown) {
      showToast('error', getApiErrorMessage(error, 'Tedarikçi teklifi uygulanamadı.'));
      throw error;
    }
  };

  /**
   * Tek adım: teklifleri rapora yazar + rapor bütçesine iş grubu satırı olarak aktarır + onaya gönderir.
   * Metraj/miktar değişmez. Schema/migration yok (mevcut BudgetVersion API).
   */
  const handleApproveAndTransferToHakedis = async (quotes: Record<string, number>) => {
    const entries = Object.entries(quotes).filter(([, amount]) => Number(amount) > 0);
    if (entries.length === 0) {
      showToast('error', 'Aktarılacak tedarikçi teklifi bulunamadı.');
      return;
    }

    try {
      const flagsRes = await axios.get(`${API}/claim-operation-center/${claimId}`, { headers: authHeader() });
      const flags = flagsRes.data?.data?.flowFlags ?? flagsRes.data?.flowFlags;
      if (flags && flags.repairPhotosReady === false) {
        showToast('error', 'Her tedarikçinin onarım bitiş resmi yok. Hakediş açılamaz.');
        return;
      }
      for (const [workGroupId, amount] of entries) {
        await handleApplySupplierGroupQuote(workGroupId, amount, { quiet: true });
      }

      const [ctxRes, verRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/budget-supplier-context`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/budget-versions/for-repair-report/${reportId}`, {
          headers: authHeader(),
        }),
      ]);
      const suppliers = (ctxRes.data?.data?.suppliers ?? ctxRes.data?.suppliers ?? []) as Array<{
        id: string;
        name: string;
        paymentDueDays?: number | null;
      }>;
      const vendor = suppliers[0];
      if (!vendor?.id) {
        showToast('error', 'Önce dosyaya tedarikçi atayın. Sonra tekrar Onayla ve Hakedişe Aktar deneyin.');
        return;
      }
      if (vendor.paymentDueDays !== 15 && vendor.paymentDueDays !== 30) {
        showToast(
          'error',
          `${vendor.name} kartında hakediş ödeme vadesi (15 veya 30 gün) seçili değil. Önce tedarikçi kartını güncelleyin.`,
        );
        return;
      }

      let version = verRes.data?.data ?? verRes.data;
      if (!version?.id) {
        showToast('error', 'Dosya bütçesi hazırlanamadı.');
        return;
      }

      if (!['draft', 'revision'].includes(String(version.status))) {
        const created = await axios.post(
          `${API}/claim-files/${claimId}/budget-versions`,
          {
            notes: `repairReportId:${reportId}`,
            copyFromVersionId: version.id,
          },
          { headers: authHeader() },
        );
        version = created.data?.data ?? created.data;
      }

      if (!version?.id || !['draft', 'revision'].includes(String(version.status))) {
        showToast('error', 'Bütçe düzenlenebilir durumda değil. Finans bütçe sekmesinden kontrol edin.');
        return;
      }

      const existingItems = (version.items ?? []) as Array<{
        id: string;
        vendorId?: string | null;
        category?: string | null;
      }>;

      for (const [workGroupId, amount] of entries) {
        const wgName =
          workGroups.find((g: any) => g.id === workGroupId)?.name
          || (report?.items ?? []).find((i: any) => (i.workGroupId ?? i.workGroup?.id) === workGroupId)?.workGroup?.name
          || 'İş Grubu';
        const description = toTitleCaseTR(`Pazarlık Onayı — ${wgName}`);
        const match = existingItems.find(
          (it) => it.vendorId === vendor.id && String(it.category || '').toLowerCase() === wgName.toLowerCase(),
        );
        if (match?.id) {
          await axios.patch(
            `${API}/budget-items/${match.id}`,
            {
              vendorId: vendor.id,
              category: wgName,
              description,
              quantity: 1,
              unitPrice: amount,
              vatRate: 0,
              unit: 'Kalem',
            },
            { headers: authHeader() },
          );
        } else {
          const added = await axios.post(
            `${API}/budget-versions/${version.id}/items`,
            {
              vendorId: vendor.id,
              category: wgName,
              workGroupName: wgName,
              description,
              quantity: 1,
              unitPrice: amount,
              vatRate: 0,
              unit: 'Kalem',
            },
            { headers: authHeader() },
          );
          const item = added.data?.data ?? added.data;
          if (item?.id) existingItems.push({ id: item.id, vendorId: vendor.id, category: wgName });
        }
      }

      await axios.post(`${API}/budget-versions/${version.id}/submit`, {}, { headers: authHeader() });
      showToast('success', 'Teklifler onaylandı ve hakediş hazırlığına aktarıldı.');
      setBudgetQuotesOpen(false);
    } catch (error: unknown) {
      showToast('error', getApiErrorMessage(error, 'Hakedişe aktarım yapılamadı.'));
      throw error;
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!(await askConfirm('Bu kalemi silmek istediğinizden emin misiniz?'))) return;
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
        notify('error', 'Anotasyon kaydedilemedi.');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!(await ensureSessionBeforeMutation())) {
      notify('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
      e.target.value = '';
      return;
    }
    const queue = files.map((file, index) => ({
      tempId: `upload-${Date.now()}-${index}-${file.name}`,
      category,
    }));
    setPendingImageUploads((prev) => [...prev, ...queue]);
    setUploadingCat(category);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { tempId } = queue[i];
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', category);
        const res = await authAxios<{ data: any }>({
          method: 'POST',
          url: `${API}/repair-reports/${reportId}/images`,
          data: fd,
        });
        if (res.data?.data) {
          setReport((prev: any) => ({
            ...prev,
            images: [...(prev?.images ?? []), res.data.data],
          }));
        }
        setPendingImageUploads((prev) => prev.filter((p) => p.tempId !== tempId));
      }
    } catch (err: any) {
      notify('error', err?.response?.data?.message ?? 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      console.error(err);
    } finally {
      setUploadingCat(null);
      setPendingImageUploads((prev) => prev.filter((p) => !queue.some((q) => q.tempId === p.tempId)));
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

  const handleDeleteMissingImages = async (imageIds: string[]) => {
    for (const imageId of imageIds) {
      try {
        await axios.delete(`${API}/report-images/${imageId}`, { headers: authHeader() });
      } catch (e) {
        console.error(e);
      }
    }
    const gone = new Set(imageIds);
    setReport((prev: any) => ({
      ...prev,
      images: (prev?.images ?? []).filter((img: any) => !gone.has(img.id)),
    }));
    notify('success', `${imageIds.length} Kayıp Fotoğraf Kaydı Temizlendi. Yeniden yükleyebilirsiniz.`);
  };

  const handleDownloadPdf = async (view: 'internal' | 'external') => {
    if (!(await ensureSessionBeforeMutation())) {
      notify('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
      return;
    }
    try {
      const res = await authAxios<Blob>({
        method: 'GET',
        url: `${API}/repair-reports/${reportId}/pdf?view=${view}`,
        responseType: 'blob',
      });
      const contentType = String(res.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (res.data as Blob).text();
        let message = 'PDF indirilemedi.';
        try { message = JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
        notify('error', message);
        return;
      }
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const suffix = view === 'internal' ? 'Ic' : 'Dis';
      a.href = url; a.download = `hasar-raporu-${suffix}-${reportId}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      setShowShareMenu(false);
      notify('success', 'PDF indiriliyor…');
    } catch (e: any) {
      let message = 'PDF indirilemedi. Lütfen tekrar deneyin.';
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          message = JSON.parse(text)?.message ?? message;
        } catch { /* ignore */ }
      } else if (e?.response?.data?.message) {
        message = e.response.data.message;
      }
      notify('error', message);
      console.error(e);
    }
  };

  const openPdfPreview = async (view: 'internal' | 'external') => {
    if (!(await ensureSessionBeforeMutation())) {
      notify('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
      return;
    }
    try {
      const res = await authAxios<Blob>({
        method: 'GET',
        url: `${API}/repair-reports/${reportId}/pdf?view=${view}`,
        responseType: 'blob',
      });
      const contentType = String(res.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (res.data as Blob).text();
        let message = 'PDF önizleme açılamadı.';
        try { message = JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
        notify('error', message);
        return;
      }
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      notify('success', view === 'internal' ? 'Tam görünüm önizlemesi açıldı.' : 'Müşteri görünümü önizlemesi açıldı.');
    } catch (e: any) {
      let message = 'PDF önizleme açılamadı.';
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          message = JSON.parse(text)?.message ?? message;
        } catch { /* ignore */ }
      } else if (e?.response?.data?.message) {
        message = e.response.data.message;
      }
      notify('error', message);
      console.error(e);
    }
  };

  if (loading || !report) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;

  const imageCats = REPORT_IMAGE_CATEGORY_LABELS;

  // Saha personeli maliyet gizleme
  const normalizedRoleCode = String(currentUser?.role?.code ?? currentUser?.roleCode ?? '').toLowerCase();
  const isFieldStaff = normalizedRoleCode === 'field_staff';
  // Saha personeli her zaman dış görünüm görsün
  const effectiveViewMode = isFieldStaff ? 'external' : viewMode;

  // Acil Yardım raporu ise ayrı editörü kullan
  const isEditable = (report.status === 'draft' || report.status === 'rejected') && !isFieldStaff;
  const canReviseThisReport =
    !isFieldStaff
    && canStartRepairReportRevisionFromStatus(report.status)
    && canCreateRepairReportRevision(report.versionNo ?? 0);
  const showExternalChannelButton = ['approved', 'sent_for_external_approval', 'externally_rejected'].includes(report.status);
  const canEditFieldSurvey = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
      if (!raw) return false;
      const u = JSON.parse(raw);
      return Array.isArray(u?.permissions) && u.permissions.includes('claim_file.update');
    } catch {
      return false;
    }
  })();

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

  const reportActionButtons = (
    <>
      {report.reportType === 'multi' && isEditable && (
        <button type="button" onClick={() => setShowDamageTypeModal(true)} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700">+ Hasar Nedeni</button>
      )}
      {canReviseThisReport && (
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
      {!isFieldStaff && (
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => {
              setViewMode('internal');
              void openPdfPreview('internal');
            }}
            className={`px-3 py-1.5 transition-colors ${effectiveViewMode === 'internal' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Tam görünüm PDF önizlemesi — TDR, Marj ve Kâr dahil"
          >
            Tam Görünüm
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('external');
              void openPdfPreview('external');
            }}
            className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${effectiveViewMode === 'external' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Müşteri görünümü PDF önizlemesi — TDR, Marj ve Kâr gizli"
          >
            Müşteri Görünümü
          </button>
        </div>
      )}
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
    </>
  );

  return (
    <div className="space-y-5 pb-28">
      {/* Header — sol kimlik · sağ durum + aşamalar + işlemler */}
      <div className="flex items-start gap-3 flex-wrap">
        <button type="button" onClick={() => {
          tryNavigate(() => router.push(claimPath), 'leave');
        }} className="text-slate-400 hover:text-slate-700 text-sm shrink-0 mt-1">← Geri</button>
        <div className="min-w-0 flex-1 basis-[12rem]">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{claimListFileNo(report.claimFile)}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {report.claimFile?.insuranceCompany?.name && (
              <span className="text-xs text-slate-500">
                Sigorta Şirketi: <span className="font-semibold text-slate-700">{report.claimFile.insuranceCompany.name}</span>
              </span>
            )}
            <span className="text-xs text-slate-500">
              Eksper: <span className={`font-semibold ${fileExpert.missing ? 'text-amber-700' : 'text-slate-700'}`}>
                {fileExpert.missing ? 'Atanmamış' : fileExpert.name}
              </span>
            </span>
          </div>
          {insuredName !== '—' && (
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {insuredName}
              {typeof report?.claimFile?.insuredPhone === 'string' && report.claimFile.insuredPhone.trim() && (
                <>
                  <span className="text-slate-300 mx-1.5">·</span>
                  <a
                    href={`tel:${report.claimFile.insuredPhone.replace(/\s/g, '')}`}
                    className="text-slate-600 hover:text-blue-700 hover:underline tabular-nums"
                  >
                    {report.claimFile.insuredPhone.trim()}
                  </a>
                </>
              )}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            {fmtDateTime(report.reportDate ?? report.createdAt)}
          </p>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 max-w-full flex-col items-end gap-2">
          <ClaimFileHeaderStatusCluster
            statusBadge={
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${repairReportStatusBadge(report.status)}`}>
                {repairReportStatusLabel(report.status)}
              </span>
            }
            extraBadges={
              <>
                {isRepairReportRevision(report.versionNo) && (
                  <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">v{report.versionNo}</span>
                )}
                {pendingInsurancePortalApproval && (
                  <Badge text="Sigorta Portalında · Bekliyor" color="bg-indigo-100 text-indigo-700" />
                )}
              </>
            }
            actionsMenu={
              <ClaimFileHeaderActionsMenu
                fileNo={report.claimFile?.fileNo}
                reportId={reportId as string}
                showManualDecision
                onStartRevision={canReviseThisReport ? handleRevise : undefined}
                startRevisionDisabled={!canReviseThisReport}
                onManualDecision={async (action: ManualDecisionAction, reason: string) => {
                  if (action === 'revise') return;
                  try {
                    await axios.post(
                      `${API}/claim-operation-center/${claimId}/manual-decision`,
                      { action, reason },
                      { headers: authHeader() },
                    );
                    notify(
                      'success',
                      action === 'approve'
                        ? 'Manuel onay kaydedildi. Yönetici ve müşteri bilgilendirildi.'
                        : 'Manuel red kaydedildi. Yönetici ve müşteri bilgilendirildi.',
                    );
                    await load();
                  } catch (e) {
                    notify('error', getApiErrorMessage(e, 'Manuel karar kaydedilemedi'));
                    throw e;
                  }
                }}
              />
            }
            stageSource={{
              reportStatus: report.status,
              claimFile: report.claimFile,
            }}
          />
          {/* Dosya Bilgileri gizliyken aksiyonlar Dosya Akışı altına iner */}
          {!dosyaBilgiOpen && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {reportActionButtons}
            </div>
          )}
        </div>
      </div>

      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.hasarRaporSonDegisiklik.id}
        title={OPS_NOTICE.hasarRaporSonDegisiklik.title}
        body={OPS_NOTICE.hasarRaporSonDegisiklik.body}
        testId="hasar-rapor-ilk-kullanim-seridi"
      />

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
              <span className="font-medium text-green-800">
                {String(latestApprovalDecision.reason ?? '').includes('Sözlü Müşteri')
                  ? 'Manuel Onay:'
                  : 'Onaylandı:'}
              </span>{' '}
              {fmtDateTime(latestApprovalDecision.createdAt)}
              {' · '}
              <span className="text-slate-600">Onaylayan: {approvalActorName(latestApprovalDecision.user)}</span>
              {latestApprovalDecision.reason && (
                <span className="block text-xs text-slate-600 mt-0.5">
                  Gerekçe: {latestApprovalDecision.reason}
                </span>
              )}
            </p>
          )}
          {latestApprovalDecision?.action === 'rejected' && (
            <p>
              <span className="font-medium text-red-800">
                {String(latestApprovalDecision.reason ?? '').includes('Sözlü Müşteri')
                  ? 'Manuel Red:'
                  : 'Reddedildi:'}
              </span>{' '}
              {fmtDateTime(latestApprovalDecision.createdAt)}
              {' · '}
              <span className="text-slate-600">Reddeden: {approvalActorName(latestApprovalDecision.user)}</span>
              {latestApprovalDecision.reason && (
                <span className="block text-xs text-slate-600 mt-0.5">
                  Gerekçe: {latestApprovalDecision.reason}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Dosya Bilgileri — Gizle/Göster; gizliyken aksiyonlar Dosya Akışı altında */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-slate-50 px-5 py-3 ${dosyaBilgiOpen ? 'border-b border-slate-100' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <h4 className="shrink-0 text-sm font-semibold text-slate-700">Dosya Bilgileri</h4>
            <button
              type="button"
              onClick={() => setDosyaBilgiOpen((v) => !v)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0"
            >
              {dosyaBilgiOpen ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {dosyaBilgiOpen && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {reportActionButtons}
            </div>
          )}
        </div>
        {dosyaBilgiOpen && (
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Sigorta Şirketi', value: report.claimFile?.insuranceCompany?.name },
                { label: 'Hasar Dosya No', value: report.claimFile?.fileNo },
                { label: 'İhbar Tarihi', value: resolveIhbarTarihi(report.claimFile ?? {}) },
                { label: 'Hasar Konusu', value: resolveClaimIhbarKonusu(report.claimFile ?? {}) },
                { label: 'Dosya Eksperi', value: fileExpert.missing ? 'Atanmamış' : fileExpert.name },
                { label: 'Hasar Adresi', value: formatHasarAdresi(report.claimFile?.propertyAddress), wide: true },
                {
                  label: 'Hasar Türü',
                  value: report.reportType === 'single'
                    ? (report.damageTypes?.[0]?.damageTypeName ? formatDisplayLabel(report.damageTypes[0].damageTypeName) : undefined)
                    : undefined,
                },
              ].filter((f) => !f.wide).map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-slate-400">{f.label}</p>
                  <p className="text-sm font-medium text-slate-800">{f.value ?? '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-400">Hasar Adresi</p>
              <p className="text-sm font-medium text-slate-800">{formatHasarAdresi(report.claimFile?.propertyAddress)}</p>
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
          </div>
        )}
      </div>

      {/* Tespit Bulguları — Hızlı Onarım Türü'nün üstünde */}
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
        {findingsError && <p className="text-xs text-status-danger mt-1">{findingsError}</p>}
      </SectionCard>

      <SectionCard title="Hızlı Onarım Türü">
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-4 md:gap-8 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <p className="text-xs font-semibold text-slate-600 shrink-0">Hasar Türü</p>
                {quickDamageDisplayOptions.map((option) => {
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
                {quickDamageDisplayOptions.length === 0 && (
                  <p className="text-xs text-slate-400">Dosya konusu / hasar türü tanımlı değil.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-xs font-semibold text-slate-600 shrink-0">Hasar Büyüklüğü</p>
                {DAMAGE_SIZE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="radio" disabled={!isEditable} checked={quickDamageSize === option.value} onChange={() => setQuickDamageSize(option.value)} className="text-brand-600" />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={!isEditable || quickDamageTypes.length === 0}
                onClick={() => setShowQuickRepairModal(true)}
                className="rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⚡ Hızlı Onarım Türü Ekle
              </button>
              {canEditFieldSurvey && (
                <button
                  type="button"
                  onClick={() => setFieldSurveyOpen(true)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Saha Keşif Ölçüsü
                </button>
              )}
            </div>
          </div>
          {quickDamageTypes.length > 0 && (
            <p className="text-xs text-slate-400">{quickDamageTypes.map((v) => quickDamageTypeDisplayLabel(v, quickDamageTypeLabels)).join(' + ')} ({damageSizeLabel(quickDamageSize)}) için öneri alınacak.</p>
          )}
        </div>
      </SectionCard>

      <FieldSurveyBriefList
        claimFileId={claimId}
        refreshKey={fieldSurveyRefreshKey}
        canDelete={canEditFieldSurvey}
      />

      <FieldSurveyBriefModal
        open={fieldSurveyOpen}
        onClose={() => setFieldSurveyOpen(false)}
        claimFileId={claimId}
        claimFileNo={report.claimFile?.fileNo ?? report.fileNo}
        defaultPhone={
          report.claimFile?.assignedSuppliers?.[0]?.phone
          ?? report.claimFile?.assignedSupplier?.phone
          ?? report.claimFile?.customer?.phone
          ?? report.claimFile?.insuredPhone
          ?? null
        }
        onSaved={() => setFieldSurveyRefreshKey((k) => k + 1)}
      />

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
          onNotify={notify}
          onConfirm={askConfirm}
        />
        {itemsApprovalError && (
          <p className="text-xs text-status-danger mt-3">{itemsApprovalError}</p>
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

      {/* İş grubu kâr özeti — sadece tam görünümde */}
      {effectiveViewMode === 'internal' && !isFieldStaff && (
        <WorkGroupProfitSummary items={report.items ?? []} workGroups={workGroups} />
      )}

      {effectiveViewMode === 'internal' && !isFieldStaff && (
        <CommercialPricingDrawer
          open={budgetQuotesOpen}
          onClose={() => setBudgetQuotesOpen(false)}
          items={report.items ?? []}
          workGroups={workGroups}
          canEdit={isEditable}
          reportId={reportId}
          claimFileId={claimId}
          onApplyCommercialRevision={handleApplyCommercialRevision}
          onApplySupplierGroupQuote={handleApplySupplierGroupQuote}
          onApproveAndTransferToHakedis={handleApproveAndTransferToHakedis}
        />
      )}

      {/* Fotoğraflar */}
      <SectionCard title="Fotoğraflar">
        {isEditable && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {REPORT_IMAGE_CATEGORY_KEYS.map((cat) => (
              <label key={cat} className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg transition-colors ${uploadingCat === cat ? 'bg-blue-200 text-blue-700 cursor-wait' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                {uploadingCat === cat ? 'Yükleniyor...' : `+ ${imageCats[cat]}`}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" multiple className="hidden" disabled={uploadingCat !== null} onChange={(e) => handleImageUpload(e, cat)} />
              </label>
            ))}
          </div>
        )}
        {!(report.images?.length) && !pendingImageUploads.length ? (
          <p className="text-slate-400 text-sm">Henüz Fotoğraf Eklenmemiş.</p>
        ) : (
          <ReportImageGallery
            images={report.images ?? []}
            pendingUploads={pendingImageUploads}
            isEditable={isEditable}
            fileNo={report.claimFile?.fileNo ?? report.fileNo}
            onDelete={(imageId) => void handleDeleteImage(imageId)}
            onDeleteMany={handleDeleteMissingImages}
            onAnnotate={(img) => setShowAnnotation(img)}
          />
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
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-status-success/35 bg-white/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(15,23,42,0.12)] px-4 sm:px-6 lg:px-8 py-3">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-3 lg:gap-4">
          <div className="hidden lg:flex flex-col gap-0.5 min-w-0 justify-self-start max-w-[280px]">
            <p className="text-[10px] font-semibold text-slate-600 tracking-wide">Rapor Oluşturma Analizi</p>
            <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 tabular-nums leading-snug">
              {creationToApprovalLabel && (
                <span className="font-medium text-slate-700">
                  {reportCycleSubmission
                    ? `Oluşturma → Onay: ${creationToApprovalLabel}`
                    : `Oluşturma: ${creationToApprovalLabel}`}
                  {!reportCycleSubmission && (
                    <span className="font-normal text-slate-400"> · Onay bekliyor</span>
                  )}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0">
                {isEditable && writeElapsedLabel && (
                  <span>Oturum: {writeElapsedLabel}</span>
                )}
                {isEditable && (
                  <span>Kayıt: {sessionSaveCount} · İptal: {sessionCancelCount}</span>
                )}
                {reportCycleSubmission && (
                  <span className="text-[10px] text-slate-400">
                    {fmtDateTime(reportCycleSubmission.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-0 justify-self-center w-full lg:w-auto">
            {effectiveViewMode === 'internal' && !isFieldStaff && (
              <FinancialSummaryBar
                tone="light"
                totalSupplierCost={report.totalSupplierCost}
                totalSalesAmount={report.totalSalesAmount}
                grossProfit={report.grossProfit}
                grossMarginPct={report.grossMarginPct}
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0 justify-self-end w-full lg:w-auto">
            {isEditable && (
              <span className="lg:hidden text-[11px] text-slate-500 tabular-nums mr-1 leading-tight">
                {creationToApprovalLabel && (
                  <span className="block">
                    {reportCycleSubmission
                      ? `Oluşturma → Onay: ${creationToApprovalLabel}`
                      : `Oluşturma: ${creationToApprovalLabel}`}
                  </span>
                )}
                {writeElapsedLabel && `Oturum: ${writeElapsedLabel} · `}Kayıt: {sessionSaveCount} · İptal: {sessionCancelCount}
              </span>
            )}
            {!isEditable && creationToApprovalLabel && reportCycleSubmission && (
              <span className="lg:hidden text-[11px] text-slate-500 tabular-nums mr-1">
                Oluşturma → Onay: {creationToApprovalLabel}
              </span>
            )}
            {effectiveViewMode === 'internal' && !isFieldStaff && (
              <button
                type="button"
                onClick={() => setBudgetQuotesOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-brand-500 bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition-colors shadow-sm"
                title="Bütçe ve satınalma panelini aç"
              >
                Bütçe & Satınalma
              </button>
            )}
            {isEditable && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleCancelChanges()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
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
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-400 cursor-default'
                  } disabled:opacity-50`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {saving ? 'Kaydediliyor...' : `Kaydet (${sessionSaveCount})`}
                </button>
              </>
            )}

            {/* Kilitli rapor: Revize Et (onaylı, dış onay bekleyen, sunulmuş) */}
            {!isEditable && canReviseThisReport && (
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
                className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50">Ekle</button>
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
              {defaultRecipients.length > 0 && !whatsAppManualMode ? (
                <div>
                  <label className="text-xs text-slate-500 block mb-2">Alıcı</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {defaultRecipients.map((recipient) => (
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
                            setSelectedVendorKeys([]);
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
                  {defaultRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWhatsAppManualMode(false);
                        const first = defaultRecipients[0];
                        setWhatsAppRecipientKey(first.key);
                        setWhatsAppPhone(first.phone);
                      }}
                      className="mt-2 text-xs text-brand-600 hover:text-blue-700"
                    >
                      Dosyadan Alıcı Seç
                    </button>
                  )}
                  {defaultRecipients.length === 0 && vendorRecipients.length === 0 && (
                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Bu dosyada kayıtlı telefon bulunamadı. Numarayı manuel girebilir veya boş bırakarak WhatsApp Web açabilirsiniz.
                    </p>
                  )}
                </div>
              )}

              {vendorRecipients.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-2">Dosya Tedarikçileri</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {vendorRecipients.map((recipient) => (
                      <label
                        key={recipient.key}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${selectedVendorKeys.includes(recipient.key) ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 text-emerald-600 rounded"
                          checked={selectedVendorKeys.includes(recipient.key)}
                          onChange={() => {
                            setSelectedVendorKeys((prev) => (
                              prev.includes(recipient.key)
                                ? prev.filter((k) => k !== recipient.key)
                                : [...prev, recipient.key]
                            ));
                            setWhatsAppRecipientKey('');
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800">{recipient.label}</span>
                          <span className="block text-xs text-slate-400 mt-0.5">+90 {recipient.phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4')}</span>
                        </span>
                      </label>
                    ))}
                  </div>
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
                    const message = `Hasar Onarım Raporu (${report.reportNo}): ${url}`;
                    const vendorPhones = vendorRecipients
                      .filter((r) => selectedVendorKeys.includes(r.key))
                      .map((r) => r.phone);
                    const phones = vendorPhones.length > 0
                      ? vendorPhones
                      : [whatsAppPhone.replace(/\D/g, '')].filter(Boolean);
                    if (phones.length === 0) {
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
                    } else {
                      for (const digits of phones) {
                        const wa = toWhatsAppLink(digits, message);
                        if (wa) window.open(wa, '_blank');
                      }
                    }
                    setShowWhatsApp(false);
                  } catch (e: any) {
                    notify('error', e?.response?.data?.message ?? 'Paylaşım linki alınamadı.');
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
                  h.action === 'approved' ? 'bg-green-500' : h.action === 'rejected' ? 'bg-status-danger' : 'bg-yellow-500'
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
                    {h.action === 'approved'
                      ? (String(h.reason ?? '').includes('Sözlü Müşteri') ? 'Manuel Onay' : 'Onayladı')
                      : h.action === 'rejected'
                        ? (String(h.reason ?? '').includes('Sözlü Müşteri') ? 'Manuel Red' : 'Reddetti')
                        : h.action === 'revision_created'
                          ? (String(h.reason ?? '').includes('Sözlü Müşteri') ? 'Manuel Revizyon' : 'Revizyon Oluşturdu')
                          : 'Onaya Gönderdi'}
                  </span>
                  <p className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('tr-TR')}</p>
                  {h.reason && (
                    <p className="text-xs text-slate-600 mt-0.5">Gerekçe: {h.reason}</p>
                  )}
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
                            className="w-4 h-4 text-brand-600 rounded border-slate-300 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-800">{formatDisplayLabel(item.jobDescription)}</span>
                              {item.workGroup && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{formatDisplayLabel(item.workGroup.name)}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.damageCategory === 'bina' ? 'bg-blue-50 text-brand-600' : 'bg-amber-50 text-amber-600'}`}>
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
                  className="text-xs text-brand-600 hover:underline"
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
                  className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
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
        damageTypeLabels={quickDamageTypeLabels}
        workGroups={workGroups}
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
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Onay</h3>
            <p className="text-sm text-slate-600 mb-5 whitespace-pre-wrap">{confirmDialog.message}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  confirmDialog.resolve(true);
                  setConfirmDialog(null);
                }}
                className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm hover:bg-brand-700"
              >
                Evet
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
                className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
