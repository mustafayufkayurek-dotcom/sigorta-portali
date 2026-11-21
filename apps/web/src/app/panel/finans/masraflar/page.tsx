'use client';

import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { FieldLabel } from '@/components/ui/FieldHelpTip';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ExpenseFilePickerModal, type ExpensePickerHasarFile } from '@/components/finance/ExpenseFilePickerModal';
import { CariHesapCreateModal } from '@/components/finance/CariHesapCreateModal';
import { CariHesapOzetModal } from '@/components/finance/CariHesapOzetModal';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansHedefBaglamSeridi } from '@/components/finance/FinansHedefBaglamSeridi';
import { FinansActionButton, FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FINANS_KART_YOL, hedefCiroDonYol, isHedefCiroDon } from '@/utils/finans-merkez-kart';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_MASRAF_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';
import { SlidePanel } from '@/components/SlidePanel';
import { ReceiptCameraModal, prefersNativeCameraCapture } from '@/components/ReceiptCameraModal';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  PanelTableSummaryFoot,
  PanelListToolbarPickers,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { normalizeTrDateValue, isCompleteTrDateValue, isoToTrDateDisplay } from '@/utils/tr-date-input';
import { parseTrAmountInput, numberToTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { suggestAutoCode } from '@/utils/auto-code';
import { computeAlphabeticSortOrder } from '@/utils/definition-sort-order';
import { API, authHeader } from '@/utils/api';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import { formatTryAmount } from '@/utils/format-try-amount';
import { getAccessToken } from '@/utils/auth-session';
import {
  financeOperationNo,
  DEFAULT_MASRAF_KDV_ORANLARI,
  EXPENSE_LANE_LABEL,
  EXPENSE_LANE_SELECT_GROUPS,
  expenseDocumentModeFromFlag,
  expenseLaneFromSubject,
  expenseSubjectForLane,
  finansIslemTarihiDonemUyarisi,
  hasTaxDocumentFromMode,
  isCustomerExpenseLane,
  isFileExpenseLane,
  isHariciExpenseLane,
  normalizeMasrafKdvOranlari,
  parseExpenseLane,
  splitGrossVat,
  type ExpenseDocumentMode,
  type ExpenseLane,
} from '@sigorta/shared';
import { financeIsoPeriod } from '@/utils/finans-merkez-kart';

type FileWorkGroupAuditLine = {
  workGroupId: string;
  workGroupName: string;
  budgeted: number;
  spent: number;
  remaining: number;
  source: 'butce' | 'rapor_alis';
  jobDefinitions: string[];
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : formatTryAmount(Number(n), { fractionDigits: 0 });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Plan sabitleri (Backend ExpensePlan enum) ─────────────────────────────────
const PLAN_BUTCE  = 'BUTCELENEN';
const PLAN_EK     = 'EKSTRA_SATIS_MASRAFI';

const PLAN_META: Record<string, { label: string; short: string; badgeCls: string; cardCls: string; barCls: string }> = {
  [PLAN_BUTCE]: {
    label:    'Dosya Bütçesi',
    short:    'Bütçe',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cardCls:  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    barCls:   'bg-blue-500',
  },
  [PLAN_EK]: {
    label:    'Ek İşler',
    short:    'Ek',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    cardCls:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    barCls:   'bg-amber-400',
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface FileOption {
  id:          string;
  fileNo:      string;
  description: string;
  hasApprovedBudget: boolean;
  hasEkBudget: boolean;
}

interface FileLookupResult {
  found: boolean;
  query?: string;
  id?: string;
  fileNo?: string;
  claimNo?: string | null;
  description?: string;
  hasApprovedBudget?: boolean;
  hasEkBudget?: boolean;
  canEnterExpense?: boolean;
  blockReason?: 'NO_BUDGET' | 'CUSTOMER_LANE' | 'WRONG_LANE' | null;
}

interface ExpenseCategoryGroup {
  id:       string;
  name:     string;
  children?: { id: string; name: string }[];
}

interface ExpenseCategoryFlat {
  id:       string;
  name:     string;
  parentId: string | null;
  level:    number;
}

const EXPENSE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'operationNo', label: 'İşlem No', defaultWidth: 128, minWidth: 110 },
  { id: 'fileNo', label: 'Dosya / Müşteri', defaultWidth: 180, minWidth: 120 },
  { id: 'expensePlan', label: 'Bütçe Tipi', defaultWidth: 96, minWidth: 80 },
  { id: 'expenseGroupName', label: 'Masraf Grubu', defaultWidth: 112, minWidth: 88 },
  { id: 'expenseSubgroupName', label: 'Alt Grup', defaultWidth: 108, minWidth: 88 },
  { id: 'description', label: 'Açıklama', defaultWidth: 200, minWidth: 120 },
  { id: 'amount', label: 'Tutar', defaultWidth: 100, minWidth: 88 },
  { id: 'date', label: 'Tarih', defaultWidth: 96, minWidth: 88 },
  FINANS_ACTIONS_COLUMN,
];

interface Expense {
  id:                  string;
  createdAt?:          string;
  fileCaseId:          string;
  fileNo:              string;
  customerId:          string;
  customerName:        string;
  partyAccountId:      string;
  expenseLane:         ExpenseLane;
  expensePlan:         string;
  expenseGroupName:    string;
  expenseSubgroupName: string;
  expenseCategoryId:   string;
  expenseCategoryParentId: string;
  description:         string;
  amount:              number;
  vatRate:             number;
  hasTaxDocument:      boolean;
  date:                string;
  operationSubject?:   string;
}

interface BudgetFileRow {
  fileCaseId: string;
  fileNo: string;
  budgetLimit: number;
  budgetSource: 'approved' | 'version' | 'none';
  spentButce: number;
  spentEk: number;
  remainingButce: number;
  varianceButce: number;
  usagePercent: number | null;
  ekBudgetLimit: number;
  remainingEk: number;
  varianceEk: number;
  ekUsagePercent: number | null;
  status: 'ok' | 'warning' | 'over' | 'no_budget';
}

interface BudgetSummary {
  totalBudgetLimit: number;
  totalSpentButce: number;
  totalSpentEk: number;
  totalRemaining: number;
  totalVariance: number;
  usagePercent: number | null;
  overBudgetFileCount: number;
  fileCount: number;
}

const BUDGET_SOURCE_LABEL: Record<string, string> = {
  approved: 'Onaylı bütçe',
  version: 'Onaylı bütçe versiyonu',
  none: 'Onaylı bütçe yok',
};

const STATUS_META: Record<BudgetFileRow['status'], { label: string; cls: string }> = {
  ok: { label: 'Uygun', cls: 'text-slate-600 dark:text-slate-300' },
  warning: { label: 'Sınıra yakın', cls: 'text-slate-700 dark:text-slate-200' },
  over: { label: 'Bütçe aşıldı', cls: 'text-status-danger' },
  no_budget: { label: 'Bütçe yok', cls: 'text-slate-500 dark:text-slate-400' },
};

const GROUP_ENUM_LABELS: Record<string, string> = {
  YONETIM_GIDERLERI:   'Yönetim Giderleri',
  OPERASYON_GIDERLERI: 'Operasyon Giderleri',
  ONARIM_GIDERLERI:    'Onarım Giderleri',
  MHY_OZEL_GIDERLER:   'MHY Özel Giderler',
};

function parseExpenseCategoryFromRow(e: Record<string, unknown>) {
  const cat = e['expenseCategory'] as Record<string, unknown> | undefined;
  if (cat) {
    const parent = cat['parent'] as Record<string, unknown> | undefined;
    if (parent) {
      return {
        groupName: String(parent['name'] ?? ''),
        subName: String(cat['name'] ?? ''),
        categoryId: String(cat['id'] ?? ''),
        parentId: String(parent['id'] ?? ''),
      };
    }
    return {
      groupName: String(cat['name'] ?? ''),
      subName: '—',
      categoryId: String(cat['id'] ?? ''),
      parentId: String(cat['id'] ?? ''),
    };
  }
  const groupKey = String(e['expenseGroup'] ?? '');
  return {
    groupName: GROUP_ENUM_LABELS[groupKey] ?? groupKey,
    subName: String(e['expenseSubgroup'] ?? '—'),
    categoryId: '',
    parentId: '',
  };
}

const BELGE_TURU_OPTIONS = ['Kasa Fişi', 'Fatura'] as const;

const EMPTY_FORM = {
  expenseLane: '' as ExpenseLane | '',
  fileCaseId: '',
  customerId: '',
  partyAccountId: '',
  expensePlan: PLAN_BUTCE,
  expenseCategoryParentId: '',
  expenseCategoryId: '',
  workGroupId: '',
  workSubGroupName: '',
  documentMode: 'belgeli' as ExpenseDocumentMode,
  documentType: '' as '' | (typeof BELGE_TURU_OPTIONS)[number],
  documentNo: '',
  description: '',
  amount: '',
  vatRate: String(DEFAULT_MASRAF_KDV_ORANLARI[DEFAULT_MASRAF_KDV_ORANLARI.length - 1] ?? 20),
  date: new Date().toISOString().slice(0, 10),
  receiptImageUrl: '',
  operationSubject: 'HASAR_ONARIM' as string,
};

function composeMasrafDescription(form: {
  documentType: string;
  documentNo: string;
  description: string;
}) {
  const parts: string[] = [];
  if (form.documentType) parts.push(form.documentType);
  const docNo = form.documentNo.trim();
  if (docNo) parts.push(`Belge No: ${docNo}`);
  const desc = form.description.trim();
  if (desc) parts.push(toTitleCaseTR(desc));
  return parts.length ? parts.join(' · ') : undefined;
}

const getFileDescription = (file: Record<string, unknown>) => {
  const customer = (file['customer'] ?? {}) as Record<string, unknown>;
  const customerName =
    file['insuredName'] ??
    customer['fullName'] ??
    customer['companyName'] ??
    [customer['firstName'], customer['lastName']].filter(Boolean).join(' ');
  return String(customerName || file['description'] || file['claimNo'] || '');
};

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function MasraflarPage() {
  const searchParams = useSearchParams();
  const { confirm, dialog } = usePanelConfirm();
  // Veriler
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [files,    setFiles]    = useState<FileOption[]>([]);
  const [categoryTree, setCategoryTree] = useState<ExpenseCategoryGroup[]>([]);
  const [categoryFlat, setCategoryFlat] = useState<ExpenseCategoryFlat[]>([]);
  const [categoryChildren, setCategoryChildren] = useState<{ id: string; name: string }[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [workGroups, setWorkGroups] = useState<FileWorkGroupAuditLine[]>([]);
  const [masrafKdvOranlari, setMasrafKdvOranlari] = useState<number[]>([...DEFAULT_MASRAF_KDV_ORANLARI]);
  const [loading,  setLoading]  = useState(true);

  const tableColumns = usePanelTableColumns('table-cols:finans-masraflar', EXPENSE_TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:finans-masraflar-v1', FINANS_MASRAF_ROW_ACTIONS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.masraflar, 10),
  );

  const sortedExpenses = useMemo(
    () =>
      sortRowsByClientSort(expenses, clientSort, (e, key) => {
        switch (key) {
          case 'fileNo':
            return e.customerName || e.fileNo;
          case 'expensePlan':
            return isCustomerExpenseLane(e.expenseLane) || isHariciExpenseLane(e.expenseLane)
              ? EXPENSE_LANE_LABEL[e.expenseLane]
              : (PLAN_META[e.expensePlan]?.label ?? e.expensePlan);
          case 'expenseGroupName':
            return e.expenseGroupName;
          case 'expenseSubgroupName':
            return e.expenseSubgroupName;
          case 'description':
            return e.description;
          case 'amount':
            return e.amount;
          case 'date':
            return e.date;
          default:
            return null;
        }
      }),
    [expenses, clientSort],
  );
  const pagedExpenses = sliceFinansPage(sortedExpenses, page, pageSize);

  // Form
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [fileLookup, setFileLookup] = useState<FileLookupResult | null>(null);
  const [fileLookupLoading, setFileLookupLoading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const fileSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanning,   setScanning]   = useState(false);
  const [scanInfo,   setScanInfo]   = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [budgetFiles, setBudgetFiles] = useState<BudgetFileRow[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);

  // Filtreler
  const [fPlan,     setFPlan]     = useState('');
  const [fLane,     setFLane]     = useState<'' | ExpenseLane>('');
  const [fFile,     setFFile]     = useState('');
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string }[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [partyAccounts, setPartyAccounts] = useState<
    { id: string; name: string; kindLabel: string; kind: string; linkedVendorId: string | null; cardLast4: string | null }[]
  >([]);
  const [showCariCreate, setShowCariCreate] = useState(false);
  const [cariOzetId, setCariOzetId] = useState<string | null>(null);
  const [lastSavedOpNo, setLastSavedOpNo] = useState('');
  const [fDateFrom, setFDateFrom] = useState(() => {
    const y = Number(searchParams.get('year'));
    const m = Number(searchParams.get('month') ?? '0');
    if (!y) return '';
    return isoToTrDateDisplay(financeIsoPeriod(y, m).dateFrom);
  });
  const [fDateTo,   setFDateTo]   = useState(() => {
    const y = Number(searchParams.get('year'));
    const m = Number(searchParams.get('month') ?? '0');
    if (!y) return '';
    return isoToTrDateDisplay(financeIsoPeriod(y, m).dateTo);
  });

  // ── Dosyaları yükle ────────────────────────────────────────────────────────
  useEffect(() => {
    const y = Number(searchParams.get('year'));
    const m = Number(searchParams.get('month') ?? '0');
    if (!y) return;
    const period = financeIsoPeriod(y, m);
    setFDateFrom(isoToTrDateDisplay(period.dateFrom));
    setFDateTo(isoToTrDateDisplay(period.dateTo));
  }, [searchParams]);

  const loadFiles = useCallback(async (search = '', lane: ExpenseLane | '' = form.expenseLane) => {
    if (!getAccessToken()) return;
    try {
      const res = await axios.get(`${API}/expenses/eligible-files`, {
        headers: authHeader(),
        params: {
          ...(search ? { search } : {}),
          ...(lane ? { lane } : {}),
        },
      });
      const rows = (res.data?.data ?? []) as Record<string, unknown>[];
      setFiles(rows.map((f) => ({
        id:          String(f['id']),
        fileNo:      String(f['fileNo'] ?? f['claimNo'] ?? ''),
        description: String(f['description'] ?? getFileDescription(f)),
        hasApprovedBudget: Boolean(f['hasApprovedBudget']),
        hasEkBudget: Boolean(f['hasEkBudget']),
      })));
    } catch {
      setFiles([]);
    }
  }, [form.expenseLane]);

  const loadFileLookup = useCallback(async (search = '', lane: ExpenseLane | '' = form.expenseLane) => {
    const q = search.trim();
    if (!getAccessToken() || q.length < 2) {
      setFileLookup(null);
      setFileLookupLoading(false);
      return;
    }
    setFileLookupLoading(true);
    try {
      const res = await axios.get(`${API}/expenses/file-lookup`, {
        headers: authHeader(),
        params: { q, ...(lane ? { lane } : {}) },
      });
      setFileLookup((res.data?.data ?? { found: false }) as FileLookupResult);
    } catch {
      setFileLookup(null);
    } finally {
      setFileLookupLoading(false);
    }
  }, [form.expenseLane]);

  const handleFileQueryChange = useCallback((query: string) => {
    if (fileSearchDebounceRef.current) clearTimeout(fileSearchDebounceRef.current);
    fileSearchDebounceRef.current = setTimeout(() => {
      setFileSearch(query);
      void loadFiles(query);
      void loadFileLookup(query);
    }, 280);
  }, [loadFiles, loadFileLookup]);

  useEffect(() => {
    if (showForm && isFileExpenseLane(form.expenseLane) && !fileSearch) {
      void loadFiles('', form.expenseLane);
    }
  }, [showForm, fileSearch, form.expenseLane, loadFiles]);

  useEffect(() => () => {
    if (fileSearchDebounceRef.current) clearTimeout(fileSearchDebounceRef.current);
  }, []);

  const loadCategories = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const [treeRes, flatRes, kdvRes] = await Promise.all([
        axios.get(`${API}/expense-categories`, { headers: authHeader() }),
        axios.get(`${API}/expense-categories/flat`, { headers: authHeader() }),
        axios
          .get(`${API}/finance/analytics/masraf-kdv-oranlari`, { headers: authHeader() })
          .catch(() => ({ data: { data: [...DEFAULT_MASRAF_KDV_ORANLARI] } })),
      ]);
      setCategoryTree((treeRes.data?.data ?? []) as ExpenseCategoryGroup[]);
      setCategoryFlat((flatRes.data?.data ?? []) as ExpenseCategoryFlat[]);
      const rates = normalizeMasrafKdvOranlari(kdvRes.data?.data ?? kdvRes.data);
      setMasrafKdvOranlari(rates);
      setForm((f) => {
        if (rates.some((r) => String(r) === f.vatRate)) return f;
        return {
          ...f,
          vatRate: String(rates[rates.length - 1] ?? DEFAULT_MASRAF_KDV_ORANLARI[2] ?? 20),
        };
      });
    } catch {
      setCategoryTree([]);
      setCategoryFlat([]);
      setMasrafKdvOranlari([...DEFAULT_MASRAF_KDV_ORANLARI]);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const loadPartyAccounts = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const res = await axios.get(`${API}/finance/party-accounts`, { headers: authHeader() });
      const rows = (res.data?.data ?? []) as Array<{
        id: string;
        name: string;
        kindLabel: string;
        kind?: string;
        linkedVendorId?: string | null;
        cardLast4?: string | null;
      }>;
      setPartyAccounts(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          kindLabel: r.kindLabel,
          kind: String(r.kind ?? ''),
          linkedVendorId: r.linkedVendorId ?? null,
          cardLast4: r.cardLast4 ?? null,
        })),
      );
    } catch {
      setPartyAccounts([]);
    }
  }, []);

  useEffect(() => {
    void loadPartyAccounts();
  }, [loadPartyAccounts]);

  const parentNameById = useMemo(() => {
    const map = new Map<string, string>();
    categoryTree.forEach((g) => map.set(g.id, g.name));
    categoryFlat.filter((c) => c.level === 1).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categoryTree, categoryFlat]);

  const allSubgroups = useMemo(
    () =>
      categoryFlat
        .filter((c) => c.level === 2 && c.parentId)
        .map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parentId as string,
          parentName: parentNameById.get(c.parentId as string) ?? '',
        })),
    [categoryFlat, parentNameById],
  );

  useEffect(() => {
    if (!form.expenseCategoryParentId) {
      setCategoryChildren([]);
      return;
    }
    const fromTree = categoryTree.find((g) => g.id === form.expenseCategoryParentId)?.children ?? [];
    if (fromTree.length > 0) {
      setCategoryChildren(fromTree);
      return;
    }
    let cancelled = false;
    setLoadingChildren(true);
    axios
      .get(`${API}/expense-categories/${form.expenseCategoryParentId}`, { headers: authHeader() })
      .then((res) => {
        if (cancelled) return;
        setCategoryChildren((res.data?.data?.children ?? []) as { id: string; name: string }[]);
      })
      .catch(() => {
        if (!cancelled) setCategoryChildren([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingChildren(false);
      });
    return () => { cancelled = true; };
  }, [form.expenseCategoryParentId, categoryTree]);

  const groupOptions = useMemo(
    () => categoryTree.map((g) => ({ value: g.id, label: g.name })),
    [categoryTree],
  );

  const subgroupOptions = useMemo(() => {
    if (form.expenseCategoryParentId && categoryChildren.length > 0) {
      return categoryChildren.map((c) => ({ value: c.id, label: c.name }));
    }
    return allSubgroups.map((s) => ({
      value: s.id,
      label: s.name,
      hint: s.parentName ? `Grup: ${s.parentName}` : undefined,
    }));
  }, [form.expenseCategoryParentId, categoryChildren, allSubgroups]);

  const handleSubgroupPick = (subId: string) => {
    const global = allSubgroups.find((s) => s.id === subId);
    if (global) {
      setForm((f) => ({
        ...f,
        expenseCategoryParentId: global.parentId,
        expenseCategoryId: subId,
      }));
      return;
    }
    setForm((f) => ({ ...f, expenseCategoryId: subId }));
  };

  const [categoryDraft, setCategoryDraft] = useState<'group' | 'sub' | null>(null);
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [categoryDraftError, setCategoryDraftError] = useState('');
  const [categoryDraftSaving, setCategoryDraftSaving] = useState(false);
  const [kdvDraftOpen, setKdvDraftOpen] = useState(false);
  const [kdvDraft, setKdvDraft] = useState('');
  const [kdvDraftError, setKdvDraftError] = useState('');
  const [kdvDraftSaving, setKdvDraftSaving] = useState(false);

  const openCategoryDraft = (kind: 'group' | 'sub') => {
    setCategoryDraft(kind);
    setCategoryDraftName('');
    setCategoryDraftError('');
  };

  const saveCategoryDraft = async () => {
    const name = toTitleCaseTR(categoryDraftName.trim());
    if (!name) {
      setCategoryDraftError(categoryDraft === 'sub' ? 'Alt grup adı yazın.' : 'Masraf grubu adı yazın.');
      return;
    }
    if (categoryDraft === 'sub' && !form.expenseCategoryParentId) {
      setCategoryDraftError('Önce masraf grubunu seçin.');
      return;
    }
    const siblings = categoryDraft === 'group'
      ? categoryTree
      : allSubgroups.filter((s) => s.parentId === form.expenseCategoryParentId);
    if (siblings.some((s) => s.name.trim().toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      setCategoryDraftError('Bu ad zaten duruyor.');
      return;
    }
    setCategoryDraftSaving(true);
    setCategoryDraftError('');
    const sortOrder = computeAlphabeticSortOrder(name, siblings);
    const baseCode = suggestAutoCode(categoryDraft === 'group' ? 'EXP' : 'ALT', name);
    const parentId = categoryDraft === 'sub' ? form.expenseCategoryParentId : undefined;
    const postCategory = (code: string) => axios.post(`${API}/expense-categories`, {
      code,
      name,
      sortOrder,
      ...(parentId ? { parentId } : {}),
    }, { headers: authHeader() });
    try {
      let res;
      try {
        res = await postCategory(baseCode);
      } catch (first: unknown) {
        const raw = axios.isAxiosError(first) ? first.response?.data?.message : '';
        const message = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
        if (!/kod/i.test(message)) throw first;
        res = await postCategory(`${baseCode}_${Date.now().toString(36).slice(-4).toUpperCase()}`);
      }
      const createdId = String((res.data?.data as { id?: string } | undefined)?.id ?? '');
      await loadCategories();
      if (categoryDraft === 'group' && createdId) {
        setForm((f) => ({ ...f, expenseCategoryParentId: createdId, expenseCategoryId: '' }));
      } else if (createdId) {
        setForm((f) => ({ ...f, expenseCategoryId: createdId }));
      }
      setCategoryDraft(null);
      setCategoryDraftName('');
    } catch (e: unknown) {
      const raw = axios.isAxiosError(e) ? e.response?.data?.message : '';
      const message = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
      setCategoryDraftError(message || 'Kaydedilemedi.');
    } finally {
      setCategoryDraftSaving(false);
    }
  };

  const openKdvDraft = () => {
    setKdvDraftOpen(true);
    setKdvDraft('');
    setKdvDraftError('');
  };

  const saveKdvDraft = async () => {
    const n = Number(String(kdvDraft).replace(',', '.').trim());
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setKdvDraftError('Geçerli bir oran girin (0–100).');
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    if (masrafKdvOranlari.some((r) => r === rounded)) {
      setKdvDraftError('Bu oran zaten listede.');
      return;
    }
    setKdvDraftSaving(true);
    setKdvDraftError('');
    try {
      const next = normalizeMasrafKdvOranlari([...masrafKdvOranlari, rounded]);
      const res = await axios.post(
        `${API}/finance/analytics/masraf-kdv-oranlari`,
        { rates: next },
        { headers: authHeader() },
      );
      const rates = normalizeMasrafKdvOranlari(res.data?.data ?? next);
      setMasrafKdvOranlari(rates);
      setForm((f) => ({ ...f, vatRate: String(rounded) }));
      setKdvDraftOpen(false);
      setKdvDraft('');
    } catch (e: unknown) {
      const raw = axios.isAxiosError(e) ? e.response?.data?.message : '';
      const message = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
      setKdvDraftError(message || 'Oran kaydedilemedi.');
    } finally {
      setKdvDraftSaving(false);
    }
  };

  const load = useCallback(async () => {
    if (!getAccessToken()) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (fLane) params['operationSubject'] = expenseSubjectForLane(fLane);
      else if (fPlan) params['expensePlan'] = fPlan;
      if (fFile)     params['fileCaseId']  = fFile;
      const dateFrom = normalizeTrDateValue(fDateFrom);
      const dateTo   = normalizeTrDateValue(fDateTo);
      if (dateFrom) params['dateFrom'] = dateFrom;
      if (dateTo)   params['dateTo']   = dateTo;

      const budgetParams: Record<string, string> = {};
      if (!fLane && fPlan) budgetParams['expensePlan'] = fPlan;
      if (!fLane && fFile) budgetParams['fileCaseId'] = fFile;
      if (dateFrom) budgetParams['dateFrom'] = dateFrom;
      if (dateTo) budgetParams['dateTo'] = dateTo;

      const res = await axios.get(`${API}/expenses`, { headers: authHeader(), params });
      const trackRes = await axios.get(`${API}/expenses/budget-tracking`, { headers: authHeader(), params: budgetParams });
      setBudgetFiles((trackRes.data?.files ?? []) as BudgetFileRow[]);
      setBudgetSummary((trackRes.data?.summary ?? null) as BudgetSummary | null);
      const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[];
      setExpenses(rows.map((e) => {
        const cat = parseExpenseCategoryFromRow(e);
        const customer = (e['customer'] ?? {}) as Record<string, unknown>;
        const customerName = String(
          customer['shortName']
          ?? customer['companyName']
          ?? customer['fullName']
          ?? [customer['firstName'], customer['lastName']].filter(Boolean).join(' ')
          ?? '',
        );
        const expenseLane = expenseLaneFromSubject(e['operationSubject']);
        return {
          id:          String(e['id']),
          createdAt:   e['createdAt'] ? String(e['createdAt']) : undefined,
          fileCaseId:  String(e['fileCaseId'] ?? (e['fileCase'] as Record<string, unknown>)?.['id'] ?? ''),
          fileNo:      String(e['fileNo'] ?? (e['fileCase'] as Record<string, unknown>)?.['fileNo'] ?? ''),
          customerId:  String(e['customerId'] ?? customer['id'] ?? ''),
          customerName,
          partyAccountId: String(e['partyAccountId'] ?? ''),
          expenseLane,
          operationSubject: String(e['operationSubject'] ?? ''),
          expensePlan: String(e['expensePlan'] ?? ''),
          expenseGroupName: cat.groupName,
          expenseSubgroupName: cat.subName,
          expenseCategoryId: cat.categoryId,
          expenseCategoryParentId: cat.parentId,
          description: String(e['description'] ?? ''),
          amount:      Number(e['amount'] ?? 0),
          vatRate:     Number(e['vatRate'] ?? 20),
          hasTaxDocument: e['hasTaxDocument'] !== false,
          date:        String(e['date'] ?? ''),
        };
      }));
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [fPlan, fLane, fFile, fDateFrom, fDateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showForm || !isCustomerExpenseLane(form.expenseLane)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      axios
        .get(`${API}/expenses/expense-customers`, {
          headers: authHeader(),
          params: { lane: form.expenseLane, q: customerQuery.trim() || undefined },
        })
        .then((res) => {
          if (cancelled) return;
          const rows = (res.data?.data ?? []) as { id: string; name: string }[];
          setCustomerOptions((prev) => {
            const selected = prev.find((row) => row.id === form.customerId);
            if (selected && !rows.some((row) => row.id === selected.id)) return [selected, ...rows];
            return rows;
          });
        })
        .catch(() => {
          if (!cancelled) setCustomerOptions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showForm, form.expenseLane, form.customerId, customerQuery]);

  useEffect(() => {
    if (!form.fileCaseId || !showForm) return;
    if (budgetFiles.some((f) => f.fileCaseId === form.fileCaseId)) return;
    let cancelled = false;
    axios
      .get(`${API}/expenses/budget-tracking`, {
        headers: authHeader(),
        params: { fileCaseId: form.fileCaseId },
      })
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data?.files ?? []) as BudgetFileRow[];
        if (rows.length === 0) return;
        setBudgetFiles((prev) => {
          if (prev.some((p) => p.fileCaseId === form.fileCaseId)) return prev;
          return [...prev, ...rows];
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.fileCaseId, showForm, budgetFiles]);

  useEffect(() => {
    if (!form.fileCaseId || !showForm || form.expensePlan !== PLAN_BUTCE) {
      setWorkGroups([]);
      return;
    }
    let cancelled = false;
    axios
      .get(`${API}/expenses/work-group-audit`, {
        headers: authHeader(),
        params: { fileCaseId: form.fileCaseId },
      })
      .then((res) => {
        if (!cancelled) setWorkGroups((res.data?.groups ?? res.data?.data?.groups ?? []) as FileWorkGroupAuditLine[]);
      })
      .catch(() => {
        if (!cancelled) setWorkGroups([]);
      });
    return () => { cancelled = true; };
  }, [form.fileCaseId, showForm, form.expensePlan]);

  const resetReceiptScan = () => {
    setScanInfo('');
    setReceiptPreview(null);
    if (receiptCameraInputRef.current) receiptCameraInputRef.current.value = '';
    if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
  };

  const handleReceiptScan = async (file: File) => {
    setFormError('');
    setScanInfo('');
    setScanning(true);
    const previewUrl = URL.createObjectURL(file);
    setReceiptPreview(previewUrl);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/expenses/scan-receipt`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data as {
        amount?: number | null;
        date?: string | null;
        description?: string | null;
        merchant?: string | null;
        receiptImageUrl?: string | null;
        message?: string;
        configured?: boolean;
      };

      setForm((prev) => ({
        ...prev,
        amount: data.amount != null && data.amount > 0 ? numberToTrAmountInput(data.amount) : prev.amount,
        date: data.date ? data.date.slice(0, 10) : prev.date,
        description: data.description || prev.description,
        receiptImageUrl: data.receiptImageUrl ?? prev.receiptImageUrl,
      }));
      setScanInfo(data.message ?? (data.configured === false
        ? 'Fiş kaydedildi. Otomatik okuma için sistem yöneticisi OpenAI anahtarı tanımlamalı.'
        : 'Belge işlendi — alanları kontrol edin.'));
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Fiş okunamadı') : 'Fiş okunamadı';
      setFormError(String(msg));
      resetReceiptScan();
    } finally {
      setScanning(false);
    }
  };

  // ── Kaydet ─────────────────────────────────────────────────────────────────
  type SaveMode = 'close' | 'new';

  const handleSave = async (mode: SaveMode = 'close') => {
    setFormError('');

    if (!form.expenseLane) return setFormError('Masraf yolunu seçin.');
    const customerLane = isCustomerExpenseLane(form.expenseLane);
    const hariciLane = isHariciExpenseLane(form.expenseLane);
    const fileLane = isFileExpenseLane(form.expenseLane);
    const hasarLane = form.expenseLane === 'hasar';
    if (fileLane && !form.fileCaseId) {
      return setFormError(
        form.expenseLane === 'tespit'
          ? 'Hasar Tespit dosyası seçimi zorunludur.'
          : 'Hasar Onarım dosyası seçimi zorunludur.',
      );
    }
    if (customerLane && !form.customerId) return setFormError('Müşteri seçimi zorunludur.');
    if (!form.partyAccountId) return setFormError('Ödeme kaynağı cari seçimi zorunludur.');
    if (hasarLane && !form.expensePlan) return setFormError('Bütçe tipi seçimi zorunludur.');
    if (!form.expenseCategoryParentId) return setFormError('Masraf kalemi (grup) seçimi zorunludur.');
    {
      const needsSubgroup =
        categoryChildren.length > 0
        || allSubgroups.some((s) => s.parentId === form.expenseCategoryParentId);
      if (needsSubgroup && !form.expenseCategoryId) {
        return setFormError('Masraf kalemi (alt grup) seçimi zorunludur.');
      }
    }
    const amountNum = parseTrAmountInput(form.amount);
    if (amountNum == null || amountNum <= 0) return setFormError('Geçerli bir tutar giriniz.');
    const vatRateNum = Number(form.vatRate);
    if (!Number.isFinite(vatRateNum) || vatRateNum < 0) return setFormError('KDV oranı seçiniz.');
    const dateIso = normalizeTrDateValue(form.date);
    if (!isCompleteTrDateValue(dateIso)) return setFormError('Geçerli bir tarih giriniz (GG.AA.YYYY).');
    if (form.documentMode === 'belgeli' && hariciLane && !form.documentType) {
      return setFormError('Harici masraf için belge türü seçiniz.');
    }

    const fileOpt = files.find((f) => f.id === form.fileCaseId);
    if (hasarLane && form.expensePlan === PLAN_BUTCE && !fileOpt?.hasApprovedBudget && workGroups.length === 0 && !editId) {
      return setFormError('Onaylı bütçesi olmayan dosyaya masraf girilemez.');
    }
    if (hasarLane && form.expensePlan === PLAN_EK && !fileOpt?.hasEkBudget && !editId) {
      return setFormError('Ek iş satış bütçesi tanımlı olmayan dosyaya ek iş masrafı girilemez.');
    }

    setSaving(true);
    try {
      const payload = {
        fileCaseId: fileLane ? form.fileCaseId : undefined,
        customerId: customerLane ? form.customerId : undefined,
        partyAccountId: form.partyAccountId,
        expensePlan: hasarLane ? form.expensePlan : undefined,
        expenseCategoryId: form.expenseCategoryId || form.expenseCategoryParentId,
        operationSubject: expenseSubjectForLane(form.expenseLane as ExpenseLane),
        description: composeMasrafDescription(form),
        amount:      amountNum,
        vatRate:     vatRateNum,
        vatIncluded: true,
        hasTaxDocument: hasTaxDocumentFromMode(form.documentMode),
        date:        dateIso,
        receiptImageUrl: form.receiptImageUrl || undefined,
      };
      if (editId) {
        await axios.put(`${API}/expenses/${editId}`, payload, { headers: authHeader() });
        setLastSavedOpNo(
          financeOperationNo(
            'MSF',
            editId,
            expenses.find((e) => e.id === editId)?.createdAt ?? dateIso,
          ),
        );
      } else {
        const created = await axios.post(`${API}/expenses`, payload, { headers: authHeader() });
        const createdId = String(created.data?.id ?? created.data?.data?.id ?? '');
        if (createdId) {
          setLastSavedOpNo(
            financeOperationNo(
              'MSF',
              createdId,
              created.data?.createdAt ?? created.data?.data?.createdAt ?? dateIso,
            ),
          );
        }
      }

      if (!editId && mode === 'new') {
        setForm({
          ...EMPTY_FORM,
          expenseLane: form.expenseLane,
          fileCaseId:  fileLane ? form.fileCaseId : '',
          customerId: customerLane ? form.customerId : '',
          partyAccountId: form.partyAccountId,
          expensePlan: form.expensePlan,
          expenseCategoryParentId: form.expenseCategoryParentId,
          expenseCategoryId: form.expenseCategoryId,
          documentMode: form.documentMode,
          vatRate: form.vatRate,
          date:        new Date().toISOString().slice(0, 10),
        });
        setEditId(null);
        setFormError('');
        resetReceiptScan();
        setShowForm(true);
      } else {
        setShowForm(false);
        setEditId(null);
        setForm({ ...EMPTY_FORM });
        setFormError('');
        resetReceiptScan();
      }
      load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Kayıt başarısız') : 'Kayıt başarısız';
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (e: Expense) => {
    setEditId(e.id);
    const subgroup = String(e.expenseSubgroupName ?? '');
    const [groupName, ...jobParts] = subgroup.split(' · ');
    const matchedGroup = workGroups.find((g) => g.workGroupName === groupName.trim());
    setCustomerQuery('');
    if (e.customerId && e.customerName) {
      setCustomerOptions([{ id: e.customerId, name: e.customerName }]);
    }
    setForm({
      ...EMPTY_FORM,
      expenseLane: e.expenseLane,
      fileCaseId: e.fileCaseId,
      customerId: e.customerId,
      partyAccountId: e.partyAccountId,
      expensePlan: e.expensePlan || PLAN_BUTCE,
      expenseCategoryParentId: e.expenseCategoryParentId,
      expenseCategoryId: e.expenseCategoryId,
      workGroupId: matchedGroup?.workGroupId ?? '',
      workSubGroupName: jobParts.join(' · ').trim(),
      documentMode: expenseDocumentModeFromFlag(e.hasTaxDocument),
      description: e.description,
      amount: numberToTrAmountInput(e.amount),
      vatRate: String(e.vatRate ?? 20),
      date: e.date?.slice(0, 10) ?? '',
      receiptImageUrl: '',
      operationSubject: expenseSubjectForLane(e.expenseLane),
    });
    resetReceiptScan();
    openExpenseForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm('Bu masrafı silmek istediğinize emin misiniz?'))) return;
    try {
      await axios.delete(`${API}/expenses/${id}`, { headers: authHeader() });
      load();
    } catch {
      // Panel oturum yönetimi hataları üst layout'ta ele alınır
    }
  };

  // ── Hesaplamalar ───────────────────────────────────────────────────────────
  const butceTotal = expenses.reduce((s, e) => e.expensePlan === PLAN_BUTCE ? s + e.amount : s, 0);
  const ekTotal    = expenses.reduce((s, e) => e.expensePlan === PLAN_EK    ? s + e.amount : s, 0);
  const grandTotal = butceTotal + ekTotal;
  const butcePct   = grandTotal > 0 ? Math.round((butceTotal / grandTotal) * 100) : 0;
  const ekPct      = 100 - butcePct;

  const pieMax = Math.max(butceTotal, ekTotal, 1);

  const selectedFileBudget = useMemo(
    () => budgetFiles.find((f) => f.fileCaseId === form.fileCaseId) ?? null,
    [budgetFiles, form.fileCaseId],
  );

  const selectableFiles = useMemo(() => {
    const filtered = form.expenseLane === 'tespit'
      ? files
      : files.filter((f) =>
        form.expensePlan === PLAN_EK ? f.hasEkBudget : f.hasApprovedBudget,
      );
    if (form.fileCaseId && !filtered.some((f) => f.id === form.fileCaseId)) {
      const current = files.find((f) => f.id === form.fileCaseId);
      if (current) return [...filtered, current];
      const exp = editId ? expenses.find((e) => e.id === editId) : null;
      if (exp?.fileCaseId === form.fileCaseId) {
        return [
          ...filtered,
          {
            id: exp.fileCaseId,
            fileNo: exp.fileNo,
            description: '',
            hasApprovedBudget: true,
            hasEkBudget: true,
          },
        ];
      }
    }
    return filtered;
  }, [files, form.expenseLane, form.expensePlan, form.fileCaseId, editId, expenses]);

  const formFileEligible = useMemo(() => {
    if (!form.fileCaseId) return false;
    if (form.expenseLane === 'tespit') return true;
    const f = files.find((x) => x.id === form.fileCaseId);
    if (!f) return Boolean(editId);
    return form.expensePlan === PLAN_EK ? f.hasEkBudget : (f.hasApprovedBudget || workGroups.length > 0);
  }, [form.fileCaseId, form.expenseLane, form.expensePlan, files, editId, workGroups.length]);

  const fileSelectOptions = useMemo(
    () =>
      selectableFiles.map((f) => ({
        value: f.id,
        label: `${f.fileNo}${f.description ? ` — ${f.description}` : ''}`,
        hint:
          form.expensePlan === PLAN_EK
            ? f.hasEkBudget ? 'Ek iş bütçesi mevcut' : 'Ek iş bütçesi yok'
            : f.hasApprovedBudget ? 'Onaylı bütçe mevcut' : 'Onaylı bütçe yok',
      })),
    [selectableFiles, form.expensePlan],
  );

  const needsExpenseSubgroup = useMemo(() => {
    if (!form.expenseCategoryParentId) return false;
    return (
      categoryChildren.length > 0
      || allSubgroups.some((s) => s.parentId === form.expenseCategoryParentId)
    );
  }, [form.expenseCategoryParentId, categoryChildren, allSubgroups]);

  const formSaveBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!form.expenseLane) {
      blockers.push('Masraf yolunu seçin');
    } else if (isCustomerExpenseLane(form.expenseLane)) {
      if (!form.customerId) blockers.push('Müşteri seçin');
    } else if (isFileExpenseLane(form.expenseLane)) {
      if (!form.fileCaseId) {
        blockers.push(
          form.expenseLane === 'tespit'
            ? 'Hasar Tespit dosyası seçin'
            : 'Hasar Onarım dosyası seçin (dosya no veya sigortalı adı ile arayın)',
        );
      } else if (form.expenseLane === 'hasar' && !formFileEligible) {
        blockers.push(
          form.expensePlan === PLAN_EK
            ? 'Seçilen dosyada ek iş satış bütçesi yok'
            : 'Seçilen dosyada onaylı bütçe yok',
        );
      }
    }
    if (!form.partyAccountId) blockers.push('Ödeme kaynağı cari seçin');
    if (form.expenseLane) {
      if (!form.expenseCategoryParentId) blockers.push('Masraf grubu seçin');
      if (needsExpenseSubgroup && !form.expenseCategoryId) blockers.push('Masraf alt grubu seçin');
    }
    const amountNum = parseTrAmountInput(form.amount);
    if (amountNum == null || amountNum <= 0) blockers.push('Geçerli bir tutar girin');
    if (!form.vatRate) blockers.push('KDV oranı seçin');
    if (!form.description.trim()) blockers.push('Açıklama yazın');
    const dateIso = normalizeTrDateValue(form.date);
    if (!isCompleteTrDateValue(dateIso)) blockers.push('Geçerli bir tarih girin (GG.AA.YYYY)');
    return blockers;
  }, [
    form.expenseLane,
    form.fileCaseId,
    form.customerId,
    form.partyAccountId,
    form.expensePlan,
    form.expenseCategoryParentId,
    form.expenseCategoryId,
    form.amount,
    form.vatRate,
    form.date,
    form.description,
    formFileEligible,
    needsExpenseSubgroup,
  ]);

  const formCanSave = formSaveBlockers.length === 0 && (
    form.expenseLane === 'hasar'
      ? (Boolean(editId) || selectableFiles.length > 0)
      : form.expenseLane === 'tespit'
        ? (Boolean(editId) || Boolean(form.fileCaseId) || selectableFiles.length > 0)
        : Boolean(form.expenseLane)
  );

  const masrafVatSplit = useMemo(() => {
    const amountNum = parseTrAmountInput(form.amount) ?? 0;
    const rate = Number(form.vatRate);
    return splitGrossVat(amountNum, Number.isFinite(rate) ? rate : 0);
  }, [form.amount, form.vatRate]);

  const masrafTarihDonemUyarisi = useMemo(() => {
    const dateIso = normalizeTrDateValue(form.date);
    if (!isCompleteTrDateValue(dateIso)) return null;
    return finansIslemTarihiDonemUyarisi(dateIso);
  }, [form.date]);

  useEffect(() => {
    if (form.fileCaseId || editId || !fileSearch.trim()) return;
    const q = fileSearch.trim();
    const digits = q.replace(/\D/g, '');
    const exact = files.filter((f) => {
      const fn = f.fileNo.replace(/\s+/g, '').toLowerCase();
      return fn === digits.toLowerCase() || f.fileNo.toLowerCase() === q.toLowerCase();
    });
    if (exact.length !== 1) return;
    const f = exact[0];
    const planOk = form.expensePlan === PLAN_EK ? f.hasEkBudget : f.hasApprovedBudget;
    if (planOk) {
      setForm((prev) => (prev.fileCaseId === f.id ? prev : { ...prev, fileCaseId: f.id }));
    }
  }, [files, fileSearch, form.fileCaseId, form.expensePlan, editId]);

  const projectedBudgetWarning = useMemo(() => {
    if (!selectedFileBudget || !form.amount) return null;
    const addAmount = parseTrAmountInput(form.amount);
    if (!addAmount || addAmount <= 0) return null;
    if (form.expensePlan === PLAN_BUTCE && selectedFileBudget.budgetLimit > 0) {
      const projected = selectedFileBudget.spentButce + addAmount;
      const remaining = selectedFileBudget.budgetLimit - projected;
      if (remaining < 0) {
        return `Bu kayıt sonrası dosya bütçesi ${fmt(Math.abs(remaining))} aşılacak.`;
      }
      if (selectedFileBudget.budgetLimit > 0 && projected / selectedFileBudget.budgetLimit >= 0.85) {
        return `Bütçenin %${Math.round((projected / selectedFileBudget.budgetLimit) * 100)}'i kullanılmış olacak.`;
      }
    }
    if (form.expensePlan === PLAN_EK && selectedFileBudget.ekBudgetLimit > 0) {
      const projected = selectedFileBudget.spentEk + addAmount;
      const remaining = selectedFileBudget.ekBudgetLimit - projected;
      if (remaining < 0) {
        return `Ek iş bütçesi ${fmt(Math.abs(remaining))} aşılacak.`;
      }
    }
    return null;
  }, [selectedFileBudget, form.amount, form.expensePlan]);

  const handlePickHasarFile = useCallback((file: ExpensePickerHasarFile) => {
    const opt: FileOption = {
      id: file.id,
      fileNo: file.fileNo,
      description: file.description,
      hasApprovedBudget: file.hasApprovedBudget,
      hasEkBudget: file.hasEkBudget,
    };
    setFiles((prev) => (prev.some((f) => f.id === file.id) ? prev : [opt, ...prev]));
    setForm((f) => ({
      ...f,
      fileCaseId: file.id,
      operationSubject: file.operationSubject ?? 'HASAR_ONARIM',
    }));
    setFileSearch(file.segment === 'ozel_musteri' ? file.description : file.fileNo);
    setFileLookup(null);
    setShowFilePicker(false);
  }, []);

  const openExpenseForm = (forEdit = false) => {
    if (!forEdit) {
      setEditId(null);
      setForm({ ...EMPTY_FORM });
      setFormError('');
      setFileSearch('');
      setFileLookup(null);
      setLastSavedOpNo('');
      setShowCariCreate(false);
      setCariOzetId(null);
      resetReceiptScan();
    }
    setAnalyticsOpen(false);
    setShowForm(true);
  };

  /** Sabit Giderler → Masraf Ekle: form aynı sayfada açılır. */
  useEffect(() => {
    if (searchParams.get('yeni') !== '1') return;
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFileSearch('');
    setFileLookup(null);
    setLastSavedOpNo('');
    setShowCariCreate(false);
    setCariOzetId(null);
    setAnalyticsOpen(false);
    setShowForm(true);
  }, [searchParams]);

  const closeExpenseForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFileSearch('');
    setFileLookup(null);
    setLastSavedOpNo('');
    setShowCariCreate(false);
    setCariOzetId(null);
    setKdvDraftOpen(false);
    setKdvDraft('');
    setKdvDraftError('');
    resetReceiptScan();
  };

  const startReceiptCapture = () => {
    if (prefersNativeCameraCapture()) {
      receiptCameraInputRef.current?.click();
    } else {
      setShowCameraModal(true);
    }
  };

  // CSS sınıfları
  const inputCls = 'w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
  const fieldLabelCls = 'mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400';
  const requiredHint = (
    <span className="text-xs font-normal text-slate-400">(Zorunlu)</span>
  );

  const masrafYoluHelp = !form.expenseLane
    ? 'Sol menüdeki gibi seçilir: Hasar Onarım ve Hasar Tespit dosyaya; Danışmanlık, Poliçe Yönetimi ve Acil Yardım müşteriye yazılır. Yönetim gideri de seçilen müşteri veya dosyaya yansır; sahipsizse havuza düşer. Harici Masraf kayıp KDV telafisidir.'
    : form.expenseLane === 'hasar'
      ? 'Hasar Onarım dosyası seçilir. Bu kayıt Hasar bütçe kartına girer. Yönetim kalemi de bu dosyanın kâr–zararına yazılır.'
      : form.expenseLane === 'tespit'
        ? 'Hasar Tespit dosyası seçilir. Tespit masrafı dosyaya yazılır; onarım bütçe kartına girmez.'
        : form.expenseLane === 'harici'
          ? 'Piyasadan toplanan fiş ve fatura. Belgeli kayıt kayıp KDV telafisine yazılır; KDV Raporu’nda görülür.'
          : 'Müşteri seçilir. Yönetim gideri dahil tüm kalemler bu müşterinin kâr–zararına yazılır; dosya bütçe kartına girmez.';

  const belgeDurumuHelp = form.documentMode === 'belgesiz'
    ? 'Belgesiz masrafın KDV’si kayıp KDV’ye yazılır; dönem ve yıl bazında KDV Raporu’nda görülür.'
    : form.expenseLane === 'harici'
      ? 'Harici belgeli masraf kayıp KDV telafisine yazılır.'
      : 'Belgeli masrafın KDV’si indirilecek KDV’ye yazılır.';

  const hedefBaglam = isHedefCiroDon(searchParams.get('don'));
  const baglamYear = Number(searchParams.get('year')) || new Date().getFullYear();
  const baglamMonth = Number(searchParams.get('month')) || new Date().getMonth() + 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 min-h-screen bg-white -mx-4 -my-6 px-4 py-6 sm:-m-6 sm:p-6">

      <FinansSubpageBreadcrumb
        current="Masraflar"
        backHref={hedefBaglam ? hedefCiroDonYol(baglamYear, baglamMonth) : undefined}
        backLabel={hedefBaglam ? 'Hedef Ciroya Dön' : undefined}
      />
      {hedefBaglam ? (
        <FinansHedefBaglamSeridi
          year={baglamYear}
          month={baglamMonth}
          aciklama="Şirket genel yönetim giderini havuza yazın (müşteri/dosya seçmeden). Müşteriye veya dosyaya aitse ilgili yolu seçip oraya yazın. Bitince Hedef Ciroya dönün."
        />
      ) : null}

      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Masraf İzleme</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Üst kartlar yalnız Hasar dosyasını toplar. Danışmanlık ve asistans bu kartlara girmez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={FINANS_KART_YOL.kdvRaporu}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="masraf-kdv-raporu-link"
          >
            KDV Raporu
          </Link>
          <Link
            href={FINANS_KART_YOL.masrafKategorileri}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="masraf-kategori-ayar-link"
          >
            Masraf Kategorileri
          </Link>
          <FinansActionButton
            label={showForm ? 'Formu Kapat' : 'Masraf Ekle'}
            onClick={() => (showForm ? closeExpenseForm() : openExpenseForm())}
            variant={showForm ? 'neutral' : 'primary'}
            active={showForm}
            showPlus={!showForm}
          />
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Bütçe Disiplini</p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">
              Hasar dosyaya, danışmanlık/asistans müşteriye yazılır. Harici ve belgesiz KDV kayıp / telafi olarak KDV Raporu’na düşer.
            </p>
          </div>
          <Link
            href={FINANS_KART_YOL.kdvRaporu}
            className="shrink-0 text-xs font-semibold text-amber-900 underline hover:text-amber-950"
          >
            Kayıp KDV’yi Gör
          </Link>
        </div>
      </div>

      <FinansKpiStrip
        tone="light"
        items={[
          { label: 'Toplam Bütçe', value: fmt(budgetSummary?.totalBudgetLimit ?? 0), accent: (budgetSummary?.totalBudgetLimit ?? 0) > 0 ? 'text-slate-800' : 'text-slate-400' },
          { label: 'Harcanan (Bütçe)', value: fmt(budgetSummary?.totalSpentButce ?? butceTotal), accent: (budgetSummary?.totalSpentButce ?? butceTotal) > 0 ? 'text-blue-400' : 'text-slate-400' },
          {
            label: 'Kalan Bütçe',
            value: fmt(budgetSummary?.totalRemaining ?? 0),
            accent: (budgetSummary?.totalRemaining ?? 0) < 0 ? 'text-red-400' : (budgetSummary?.totalRemaining ?? 0) > 0 ? 'text-emerald-400' : 'text-slate-400',
          },
          {
            label: 'Bütçe Sapması',
            value: `${(budgetSummary?.totalVariance ?? 0) > 0 ? '+' : ''}${fmt(budgetSummary?.totalVariance ?? 0)}`,
            accent: (budgetSummary?.totalVariance ?? 0) > 0 ? 'text-red-400' : 'text-slate-800',
          },
          { label: 'Ek İş Masrafı', value: fmt(budgetSummary?.totalSpentEk ?? ekTotal), accent: (budgetSummary?.totalSpentEk ?? ekTotal) > 0 ? 'text-amber-400' : 'text-slate-400' },
        ]}
      />

      {/* Özet analiz — katlanır (QuickBooks / Xero progressive disclosure) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAnalyticsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bütçe Sapma Analizi</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dosya bazlı plan, harcama, kalan ve sapma
              {!analyticsOpen && budgetSummary && (
                <span className={`ml-2 ${budgetSummary.totalVariance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  · Sapma {fmt(budgetSummary.totalVariance)}
                </span>
              )}
            </p>
          </div>
          <svg
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {analyticsOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-700 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kategori Dağılımı</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Dosya Bütçesi vs Ek İşler</p>
              {grandTotal === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Veri yok</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0 w-20 h-20">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="4" strokeDasharray="100" />
                      <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4"
                        strokeDasharray={`${butcePct} ${100 - butcePct}`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100">%{butcePct}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { plan: PLAN_BUTCE, value: butceTotal, pct: butcePct },
                      { plan: PLAN_EK, value: ekTotal, pct: ekPct },
                    ].map(({ plan, value }) => {
                      const m = PLAN_META[plan];
                      const barW = pieMax > 0 ? Math.round((value / pieMax) * 100) : 0;
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-xs font-semibold ${plan === PLAN_BUTCE ? 'text-brand-600' : 'text-amber-600'}`}>{m.label}</span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmt(value)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full ${m.barCls}`} style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dosya Bazlı Bütçe İzleme</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                Onaylı bütçe / tahmini maliyet ile gerçekleşen masraf karşılaştırması
              </p>
              {budgetFiles.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Henüz bütçe veya masraf verisi yok</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700 max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/40">
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="px-3 py-1.5 text-center text-slate-500 font-medium">Dosya</th>
                        <th className="px-3 py-1.5 text-right text-slate-500 font-medium">Plan</th>
                        <th className="px-3 py-1.5 text-right text-blue-500 font-medium">Harcanan</th>
                        <th className="px-3 py-1.5 text-right text-emerald-600 font-medium">Kalan</th>
                        <th className="px-3 py-1.5 text-right text-slate-500 font-medium">Sapma</th>
                        <th className="px-3 py-1.5 text-center text-slate-500 font-medium">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {budgetFiles.map((row) => (
                        <tr
                          key={row.fileCaseId}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 cursor-pointer"
                          onClick={() => setFFile(row.fileCaseId)}
                        >
                          <td className="px-3 py-1.5">
                            <Link
                              href={`/panel/hasar-dosyalari/${row.fileCaseId}`}
                              className="font-mono font-semibold text-brand-700 hover:underline"
                              onClick={(ev) => ev.stopPropagation()}
                              title="Dosyayı aç"
                            >
                              {row.fileNo}
                            </Link>
                            <p className="text-[10px] text-slate-400">{BUDGET_SOURCE_LABEL[row.budgetSource]}</p>
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">{row.budgetLimit > 0 ? fmt(row.budgetLimit) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-blue-700 font-semibold whitespace-nowrap">
                            {fmt(row.spentButce)}
                            {row.usagePercent != null && (
                              <span className="block text-[10px] text-blue-400">%{row.usagePercent}</span>
                            )}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap ${row.remainingButce < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {row.budgetLimit > 0 ? fmt(row.remainingButce) : '—'}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap ${row.varianceButce > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {row.budgetLimit > 0 ? (row.varianceButce > 0 ? `+${fmt(row.varianceButce)}` : fmt(row.varianceButce)) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`text-xs font-medium ${STATUS_META[row.status].cls}`}>
                              {STATUS_META[row.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Masraf formu — yan panel */}
      <SlidePanel
        open={showForm}
        onClose={closeExpenseForm}
        title={editId ? 'Masrafı Düzenle' : 'Yeni Masraf Ekle'}
        width={520}
        scrollContent={false}
      >
        <div
          className="grid h-full min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
          data-testid="masraf-form-kabuk"
        >
          {/* Akıllı fiş — başlığın hemen altında sabit */}
          <div className="shrink-0 border-b border-slate-100 bg-white px-3 pb-2 pt-0 sm:px-4" data-testid="masraf-akilli-fis">
            <FileDropZone
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              disabled={scanning}
              clickToOpen={false}
              onFiles={(files) => {
                const file = files.find((f) => f.type.startsWith('image/'));
                if (file) void handleReceiptScan(file);
              }}
              className="rounded-lg border border-dashed border-brand-200 bg-brand-50/50 px-3 py-1.5 transition-colors dark:border-brand-800 dark:bg-brand-950/20"
              activeClassName="border-brand-400 bg-brand-100/80 dark:bg-brand-900/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Akıllı Fiş / Fatura Okuma</p>
                  <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                    Fişi çekin, seçin veya sürükleyin. Tutar, tarih ve açıklama dolar.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    ref={receiptCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleReceiptScan(file);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={receiptFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleReceiptScan(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={startReceiptCapture}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {scanning ? 'Okunuyor...' : 'Kamerayla Tara'}
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => receiptFileInputRef.current?.click()}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Dosyadan Seç
                  </button>
                </div>
              </div>
              {scanInfo && (
                <p className="mt-1.5 rounded-md bg-white/80 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  {scanInfo}
                </p>
              )}
              {(receiptPreview || form.receiptImageUrl) && (
                <div className="mt-1.5 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptPreview ?? form.receiptImageUrl}
                    alt="Yüklenen fiş"
                    className="h-12 w-auto rounded-md border border-slate-200 object-cover dark:border-slate-600"
                  />
                  <p className="text-[11px] text-brand-700/80 dark:text-brand-300/80">
                    Okundu — tutar ve tarihi kontrol edin.
                  </p>
                </div>
              )}
            </FileDropZone>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pt-2 pb-3 sm:px-4">
          {formError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">

            <div className="md:col-span-2" data-testid="masraf-yolu-select">
              <FieldLabel
                htmlFor="finans-masraf-yolu"
                className={fieldLabelCls}
                help={masrafYoluHelp}
                testId="masraf-yolu-help"
              >
                Masraf Yolu {requiredHint}
              </FieldLabel>
              <select
                id="finans-masraf-yolu"
                className={inputCls}
                aria-label="Masraf Yolu"
                value={form.expenseLane}
                onChange={(e) => {
                  void (async () => {
                    const raw = e.target.value;
                    if (!raw) {
                      setForm((prev) => ({
                        ...prev,
                        expenseLane: '',
                        operationSubject: '',
                        fileCaseId: '',
                        customerId: '',
                        workGroupId: '',
                        workSubGroupName: '',
                      }));
                      setCustomerQuery('');
                      setFileLookup(null);
                      return;
                    }
                    const next = parseExpenseLane(raw);
                    if (!next) return;
                    if (
                      form.expenseLane &&
                      form.expenseLane !== next &&
                      (form.fileCaseId || form.customerId)
                    ) {
                      const ok = await confirm('Masraf yolu değişince seçili dosya veya müşteri kalkar.');
                      if (!ok) return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      expenseLane: next,
                      operationSubject: expenseSubjectForLane(next),
                      fileCaseId: '',
                      customerId: '',
                      workGroupId: '',
                      workSubGroupName: '',
                    }));
                    setCustomerQuery('');
                    setFileLookup(null);
                    setFiles([]);
                  })();
                }}
              >
                <option value="">Seçiniz...</option>
                {EXPENSE_LANE_SELECT_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.id} value={opt.id} data-testid={`masraf-yolu-${opt.id}`}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {isCustomerExpenseLane(form.expenseLane) && (
              <div className="md:col-span-2">
                <FieldLabel
                  className={fieldLabelCls}
                  help={
                    form.expenseLane === 'asistans'
                      ? 'Acil Yardım masrafı asistans firması kartına yazılır.'
                      : 'Danışmanlık veya Poliçe Yönetimi müşteri kartı seçilir.'
                  }
                >
                  Müşteri {requiredHint}
                </FieldLabel>
                <SearchableSelect
                  className="min-w-0"
                  inputClassName={inputCls}
                  options={customerOptions.map((row) => ({ value: row.id, label: row.name }))}
                  value={form.customerId}
                  onChange={(id) => setForm({ ...form, customerId: id })}
                  onQueryChange={setCustomerQuery}
                  placeholder={
                    form.expenseLane === 'asistans'
                      ? 'Asistans firması ara...'
                      : form.expenseLane === 'police'
                        ? 'Poliçe müşterisi ara...'
                        : 'Danışmanlık müşterisi ara...'
                  }
                  emptyText="Müşteri bulunamadı"
                />
              </div>
            )}

            {form.expenseLane && (
              <div className="md:col-span-2" data-testid="masraf-cari-kaynak">
                <FieldLabel
                  className={fieldLabelCls}
                  help="Ödemenin çıktığı kredi kartı veya tedarikçi cari. Yoksa Yeni Cari ile açılır."
                >
                  Ödeme Kaynağı (Cari) {requiredHint}
                </FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <SearchableSelect
                    className="min-w-0 flex-1"
                    inputClassName={inputCls}
                    options={partyAccounts.map((row) => ({
                      value: row.id,
                      label: `${row.name} · ${row.kindLabel}`,
                    }))}
                    value={form.partyAccountId}
                    onChange={(id) => setForm({ ...form, partyAccountId: id })}
                    placeholder="Kredi kartı veya tedarikçi cari ara..."
                    emptyText="Cari bulunamadı — Yeni Cari ile açın"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCariCreate(true)}
                    className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    data-testid="masraf-yeni-cari"
                  >
                    + Yeni Cari
                  </button>
                </div>
                {(() => {
                  const selected = partyAccounts.find((row) => row.id === form.partyAccountId);
                  if (!selected) return null;
                  return (
                    <div
                      className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      data-testid="masraf-cari-kart"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{selected.name}</p>
                        <p className="text-xs text-slate-500">
                          {selected.kindLabel}
                          {selected.cardLast4 ? ` · ****${selected.cardLast4}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/panel/finans/cariler/${encodeURIComponent(selected.id)}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          data-testid="masraf-cari-sayfa"
                        >
                          Cari Sayfası
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setCariOzetId((cur) => (cur === selected.id ? null : selected.id))
                          }
                          className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
                          data-testid="masraf-cari-ozet-ac"
                        >
                          {cariOzetId === selected.id ? 'Cari Özeti Gizle' : 'Cari Kartı Aç'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <CariHesapOzetModal
                  open={Boolean(cariOzetId)}
                  accountId={cariOzetId}
                  onClose={() => setCariOzetId(null)}
                />
              </div>
            )}

            {/* Hasar Onarım / Hasar Tespit — dosya seçimi */}
            {isFileExpenseLane(form.expenseLane) && (
            <div className="md:col-span-2">
              <FieldLabel
                className={fieldLabelCls}
                help={
                  form.expenseLane === 'tespit'
                    ? 'Hasar Tespit dosya no veya sigortalı adı ile arayın.'
                    : 'Dosya no veya sigortalı adı ile arayın. Hatırlamıyorsanız Dosyadan Seç ile listeden alın.'
                }
                testId="masraf-dosya-help"
              >
                İlgili Dosya / Sigortalı {requiredHint}
              </FieldLabel>
              <div className="flex gap-2">
                <SearchableSelect
                  className="min-w-0 flex-1"
                  inputClassName={inputCls}
                  options={fileSelectOptions}
                  value={form.fileCaseId}
                  onChange={(id) => setForm({ ...form, fileCaseId: id })}
                  onQueryChange={handleFileQueryChange}
                  placeholder={
                    form.expenseLane === 'tespit'
                      ? 'Tespit dosya no veya sigortalı adı yazın...'
                      : 'Dosya no, hasar no veya sigortalı adı yazın...'
                  }
                  emptyText={
                    fileLookupLoading
                      ? 'Aranıyor...'
                      : fileLookup?.found && !fileLookup.canEnterExpense
                        ? 'Dosya bulundu — bütçe onayı gerekli (aşağıya bakın)'
                        : 'Uygun dosya bulunamadı — listeden seçin veya bütçe onaylayın'
                  }
                />
                {form.expenseLane === 'hasar' ? (
                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
                    title="Hasar Onarım listesinden dosya seç"
                  >
                    Dosyadan Seç
                  </button>
                ) : null}
              </div>
              {form.fileCaseId && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {(() => {
                    const sel = files.find((f) => f.id === form.fileCaseId);
                    if (!sel) return null;
                    return (
                      <>
                        Seçili:{' '}
                        <Link
                          href={`/panel/hasar-dosyalari/${sel.id}`}
                          className="font-medium text-brand-700 underline hover:text-brand-800"
                          data-testid="masraf-secili-dosya-link"
                        >
                          {sel.fileNo}
                        </Link>
                        {sel.description ? ` — ${sel.description}` : ''}
                      </>
                    );
                  })()}
                </p>
              )}
              {fileLookup?.found && !fileLookup.canEnterExpense && !form.fileCaseId && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {fileLookup.fileNo}
                    {fileLookup.description ? ` — ${fileLookup.description}` : ''}
                  </p>
                  {fileLookup.claimNo && (
                    <p className="text-xs text-slate-500 mt-0.5">Hasar no: {fileLookup.claimNo}</p>
                  )}
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-2">
                    {fileLookup.blockReason === 'CUSTOMER_LANE'
                      ? 'Bu dosya Hasar Onarım değildir. Danışmanlık, Poliçe Yönetimi veya Acil Yardım masrafı müşteriye yazılır.'
                      : fileLookup.blockReason === 'WRONG_LANE'
                        ? (form.expenseLane === 'tespit'
                          ? 'Bu dosya Hasar Tespit değildir. Hasar Onarım için Masraf Yolu’nda Hasar Onarım seçin.'
                          : 'Bu dosya Hasar Tespit’tir. Masraf Yolu’nda Hasar Tespit seçin.')
                        : 'Dosya sistemde kayıtlı ancak onaylı bütçe veya ek iş satışı yok. Masraf girebilmek için önce bütçe oluşturup onaylatın.'}
                  </p>
                  <a
                    href={fileLookup.id ? `/panel/hasar-dosyalari/${fileLookup.id}` : '/panel/hasar-dosyalari'}
                    className="mt-2 inline-block text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                  >
                    Hasar dosyası → Finans → Bütçe sekmesine git
                  </a>
                </div>
              )}
              {fileLookup?.found === false && fileSearch.trim().length >= 2 && !fileLookupLoading && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  &quot;{fileSearch.trim()}&quot; ile eşleşen hasar dosyası bulunamadı.
                </p>
              )}
              {selectableFiles.length === 0 && !fileLookup?.found && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Onaylı bütçeli dosya bulunamadı.{' '}
                  <a href="/panel/hasar-dosyalari" className="font-semibold underline">
                    Hasar dosyaları
                  </a>
                  {' '}→ ilgili dosya → Finans → Bütçe sekmesinden bütçe oluşturup onaylatın.
                </p>
              )}
              {form.fileCaseId && !formFileEligible && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                  Bu dosya seçilen bütçe tipi için uygun değil. Dosya Bütçesi için onaylı bütçe, Ek İşler için ek satış kaydı gerekir.
                </p>
              )}
              {selectedFileBudget && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      <Link
                        href={`/panel/hasar-dosyalari/${form.fileCaseId}`}
                        className="text-brand-700 underline hover:text-brand-800"
                      >
                        {selectedFileBudget.fileNo}
                      </Link>
                      {' '}— Bütçe Durumu
                    </p>
                    <span className={`text-xs font-medium ${STATUS_META[selectedFileBudget.status].cls}`}>
                      {STATUS_META[selectedFileBudget.status].label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Plan</p>
                      <p className="text-sm font-bold">{selectedFileBudget.budgetLimit > 0 ? fmt(selectedFileBudget.budgetLimit) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Harcanan</p>
                      <p className="text-sm font-bold text-blue-700">{fmt(form.expensePlan === PLAN_EK ? selectedFileBudget.spentEk : selectedFileBudget.spentButce)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Kalan</p>
                      <p className={`text-sm font-bold ${(form.expensePlan === PLAN_EK ? selectedFileBudget.remainingEk : selectedFileBudget.remainingButce) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {form.expensePlan === PLAN_EK
                          ? (selectedFileBudget.ekBudgetLimit > 0 ? fmt(selectedFileBudget.remainingEk) : '—')
                          : (selectedFileBudget.budgetLimit > 0 ? fmt(selectedFileBudget.remainingButce) : '—')}
                      </p>
                    </div>
                  </div>
                  {selectedFileBudget.budgetLimit > 0 && form.expensePlan === PLAN_BUTCE && (
                    <div className="mt-2 h-1.5 rounded-full bg-white/80 dark:bg-slate-900/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${selectedFileBudget.usagePercent != null && selectedFileBudget.usagePercent > 100 ? 'bg-status-danger' : selectedFileBudget.usagePercent != null && selectedFileBudget.usagePercent >= 85 ? 'bg-amber-400' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(selectedFileBudget.usagePercent ?? 0, 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1.5">{BUDGET_SOURCE_LABEL[selectedFileBudget.budgetSource]}</p>
                </div>
              )}
              {projectedBudgetWarning && (
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  {projectedBudgetWarning}
                </p>
              )}
            </div>
            )}

            {(editId || lastSavedOpNo) ? (
              <div className="md:col-span-2" data-testid="masraf-islem-no">
                <FieldLabel className={fieldLabelCls}>İşlem No</FieldLabel>
                <input
                  readOnly
                  className={`${inputCls} bg-slate-50 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-200`}
                  value={
                    editId
                      ? financeOperationNo(
                          'MSF',
                          editId,
                          expenses.find((e) => e.id === editId)?.createdAt
                            ?? expenses.find((e) => e.id === editId)?.date,
                        )
                      : lastSavedOpNo
                  }
                />
                {!editId && lastSavedOpNo ? (
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Son kayıt: {lastSavedOpNo}
                  </p>
                ) : null}
              </div>
            ) : null}

            {form.expenseLane ? (
              <div className="md:col-span-2" data-testid="masraf-belge-modu">
                <FieldLabel
                  className={fieldLabelCls}
                  help={(
                    <>
                      {belgeDurumuHelp}{' '}
                      <Link href={FINANS_KART_YOL.kdvRaporu} className="font-semibold text-brand-700 underline">
                        KDV Raporu
                      </Link>
                    </>
                  )}
                  testId="masraf-belge-help"
                >
                  Belge Durumu {requiredHint}
                </FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'belgeli' as const, label: 'Belgeli' },
                      { id: 'belgesiz' as const, label: 'Belgesiz' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          documentMode: opt.id,
                          documentType: opt.id === 'belgesiz' ? '' : f.documentType,
                          documentNo: opt.id === 'belgesiz' ? '' : f.documentNo,
                        }))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        form.documentMode === opt.id
                          ? 'border-brand-500 bg-brand-50 text-brand-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                      data-testid={`masraf-belge-${opt.id}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {form.documentMode === 'belgeli' ? (
              <>
                <div>
                  <FieldLabel htmlFor="finans-masraf-belge-turu" className={fieldLabelCls}>
                    Belge Türü
                    {form.expenseLane === 'harici' ? requiredHint : null}
                  </FieldLabel>
                  <select
                    id="finans-masraf-belge-turu"
                    className={inputCls}
                    value={form.documentType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        documentType: e.target.value as typeof form.documentType,
                      })
                    }
                    data-testid="masraf-belge-turu"
                  >
                    <option value="">Seçiniz...</option>
                    {BELGE_TURU_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="finans-masraf-belge-no" className={fieldLabelCls}>
                    Belge No
                  </FieldLabel>
                  <input
                    id="finans-masraf-belge-no"
                    className={inputCls}
                    placeholder="Örn. 1425"
                    value={form.documentNo}
                    onChange={(e) => setForm({ ...form, documentNo: e.target.value })}
                    data-testid="masraf-belge-no"
                  />
                </div>
              </>
            ) : null}

            {form.expenseLane === 'hasar' ? (
              <div>
                <FieldLabel
                  htmlFor="finans-masraf-plan"
                  className={fieldLabelCls}
                  help={
                    form.expensePlan === PLAN_EK
                      ? 'Ek iş bütçesine yazılır; kâr ayrı görünür.'
                      : 'Onaylı dosya bütçesine yazılır.'
                  }
                >
                  Masraf Yeri {requiredHint}
                </FieldLabel>
                <select
                  id="finans-masraf-plan"
                  value={form.expensePlan}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((f) => {
                      const file = files.find((x) => x.id === f.fileCaseId);
                      const fileOk = file && (next === PLAN_EK ? file.hasEkBudget : file.hasApprovedBudget);
                      return {
                        ...f,
                        expensePlan: next,
                        fileCaseId: fileOk ? f.fileCaseId : '',
                      };
                    });
                  }}
                  className={inputCls}
                  data-testid="finans-masraf-plan"
                >
                  <option value={PLAN_BUTCE}>Bütçelenen</option>
                  <option value={PLAN_EK}>Ek İş</option>
                </select>
              </div>
            ) : null}

            <div data-testid="masraf-tarih-alan" className={form.expenseLane === 'hasar' ? '' : 'md:col-span-2'}>
              <FieldLabel className={fieldLabelCls} help="İşlem tarihi mali döneme yazılır.">
                Tarih {requiredHint}
              </FieldLabel>
              <TrDateInput
                className={inputCls}
                value={form.date}
                onChange={(date) => setForm({ ...form, date })}
              />
              {masrafTarihDonemUyarisi ? (
                <p
                  className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                  data-testid="masraf-tarih-donem-uyari"
                  role="status"
                >
                  {masrafTarihDonemUyarisi}
                </p>
              ) : null}
            </div>

            {form.expenseLane && (
            <div className="md:col-span-2" data-testid="masraf-kalem-alanlari">
              <FieldLabel
                className={fieldLabelCls}
                help={(
                  <>
                    Grup ve alt grup Ayarlar listesinde de durur.{' '}
                    <Link href={FINANS_KART_YOL.masrafKategorileri} className="font-semibold text-brand-700 underline">
                      Masraf Kategorileri
                    </Link>
                  </>
                )}
              >
                Masraf Kalemi {requiredHint}
              </FieldLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">Masraf Grubu</p>
                    <SearchableSelect
                      options={groupOptions}
                      value={form.expenseCategoryParentId}
                      onChange={(id) => setForm({
                        ...form,
                        expenseCategoryParentId: id,
                        expenseCategoryId: '',
                      })}
                      placeholder="Masraf grubu ara..."
                      emptyText="Masraf grubu bulunamadı"
                      inputClassName={inputCls}
                      createAction={{
                        label: '+ Yeni Masraf Grubu Ekle',
                        onSelect: () => openCategoryDraft('group'),
                      }}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">Masraf Alt Grubu</p>
                    <SearchableSelect
                      options={subgroupOptions}
                      value={form.expenseCategoryId}
                      onChange={handleSubgroupPick}
                      placeholder={
                        form.expenseCategoryParentId
                          ? (loadingChildren ? 'Yükleniyor...' : 'Alt grup ara...')
                          : 'Önce grup seçin veya alt grup ara...'
                      }
                      emptyText="Alt grup bulunamadı"
                      disabled={loadingChildren}
                      inputClassName={inputCls}
                      createAction={{
                        label: '+ Yeni Alt Grup Ekle',
                        onSelect: () => openCategoryDraft('sub'),
                      }}
                    />
                  </div>
                </div>
                {categoryDraft ? (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800">
                    <p className="mb-1 text-[11px] text-slate-500">
                      {categoryDraft === 'group' ? 'Yeni Masraf Grubu' : 'Yeni Alt Grup'}
                    </p>
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder={categoryDraft === 'group' ? 'Örn. çatı malzemesi' : 'Örn. membran'}
                        value={categoryDraftName}
                        autoFocus
                        onChange={(e) => setCategoryDraftName(e.target.value)}
                        onBlur={(e) => {
                          const v = toTitleCaseTR(e.target.value.trim());
                          if (v) setCategoryDraftName(v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveCategoryDraft();
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={categoryDraftSaving}
                        onClick={() => { void saveCategoryDraft(); }}
                        className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {categoryDraftSaving ? 'Kaydediliyor' : 'Ekle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCategoryDraft(null); setCategoryDraftError(''); }}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600"
                      >
                        Vazgeç
                      </button>
                    </div>
                    {categoryDraftError ? (
                      <p className="mt-1.5 text-xs text-status-danger">{categoryDraftError}</p>
                    ) : null}
                  </div>
                ) : null}
            </div>
            )}

            <div>
              <FieldLabel className={fieldLabelCls} help="Girilen tutar KDV dahildir. Matrah ve KDV aşağıda ayrılır.">
                Tutar — KDV Dahil (TL) {requiredHint}
              </FieldLabel>
              <TrAmountInput
                className={inputCls}
                placeholder="0"
                value={form.amount}
                onChange={(amount) => setForm({ ...form, amount })}
              />
            </div>

            <div data-testid="masraf-kdv-oran-alan">
              <FieldLabel
                htmlFor="finans-masraf-kdv-oran"
                className={fieldLabelCls}
                help={(
                  <>
                    Liste Ayarlar’dan gelir; burada da yeni oran eklenir.{' '}
                    <Link href={FINANS_KART_YOL.masrafKategorileri} className="font-semibold text-brand-700 underline">
                      Masraf Kategorileri
                    </Link>
                  </>
                )}
                testId="masraf-kdv-oran-help"
              >
                KDV Oranı {requiredHint}
              </FieldLabel>
              <div className="flex gap-2">
                <select
                  id="finans-masraf-kdv-oran"
                  className={inputCls}
                  value={form.vatRate}
                  onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                  data-testid="masraf-kdv-oran"
                >
                  {masrafKdvOranlari.map((rate) => (
                    <option key={rate} value={String(rate)}>
                      %{rate}
                    </option>
                  ))}
                </select>
                {!kdvDraftOpen ? (
                  <button
                    type="button"
                    onClick={openKdvDraft}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    data-testid="masraf-kdv-oran-ekle-ac"
                  >
                    + Oran
                  </button>
                ) : null}
              </div>
              {kdvDraftOpen ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800">
                  <p className="mb-1 text-[11px] text-slate-500">Yeni KDV Oranı</p>
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="Örn. 8"
                      value={kdvDraft}
                      autoFocus
                      onChange={(e) => setKdvDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void saveKdvDraft();
                        }
                      }}
                      data-testid="masraf-kdv-oran-ekle-input"
                    />
                    <button
                      type="button"
                      disabled={kdvDraftSaving}
                      onClick={() => { void saveKdvDraft(); }}
                      className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      data-testid="masraf-kdv-oran-ekle"
                    >
                      {kdvDraftSaving ? 'Kaydediliyor' : 'Ekle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setKdvDraftOpen(false); setKdvDraftError(''); }}
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
                    >
                      Vazgeç
                    </button>
                  </div>
                  {kdvDraftError ? (
                    <p className="mt-1.5 text-xs text-status-danger">{kdvDraftError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/40" data-testid="masraf-kdv-ozet">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-500">Matrah</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatTryAmount(masrafVatSplit.matrah)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">KDV</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatTryAmount(masrafVatSplit.vatAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Genel Toplam</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatTryAmount(masrafVatSplit.genelToplam)}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <FieldLabel className={fieldLabelCls}>Açıklama {requiredHint}</FieldLabel>
              <input
                className={inputCls}
                placeholder="Örn. çatı kaplama malzemesi"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setForm((f) => ({ ...f, description: v }));
                }}
              />
            </div>
          </div>

          {!formCanSave && formSaveBlockers.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Kaydetmek için eksikler:</p>
              <ul className="space-y-1">
                {formSaveBlockers.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="mt-0.5 text-status-danger">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>

          <div
            className="sticky bottom-0 z-20 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-3 py-3.5 pb-[max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))] shadow-[0_-6px_16px_rgba(15,23,42,0.1)] sm:px-4 dark:border-slate-700 dark:bg-slate-900"
            data-testid="masraf-form-footer"
          >
            <button
              type="button"
              onClick={closeExpenseForm}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              İptal
            </button>
            {editId ? (
              <button
                type="button"
                onClick={() => handleSave('close')}
                disabled={saving || !formCanSave}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Güncelle'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave('close')}
                  disabled={saving || !formCanSave}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Kaydet ve Kapat
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('new')}
                  disabled={saving || !formCanSave}
                  className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet ve Yeni'}
                </button>
              </>
            )}
          </div>
        </div>
      </SlidePanel>

      <ReceiptCameraModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file) => void handleReceiptScan(file)}
      />

      <ExpenseFilePickerModal
        open={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        expensePlan={form.expensePlan}
        initialSearch={fileSearch}
        onSelectHasar={handlePickHasarFile}
      />

      <CariHesapCreateModal
        open={showCariCreate}
        onClose={() => setShowCariCreate(false)}
        onCreated={(account) => {
          void loadPartyAccounts().then(() => {
            setForm((f) => ({ ...f, partyAccountId: account.id }));
            setFormError('');
          });
        }}
      />

      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        {/* Kategori */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-1">
          {[
            { v: '', lane: '' as const, l: 'Tümü' },
            { v: PLAN_BUTCE, lane: '' as const, l: 'Dosya Bütçesi' },
            { v: PLAN_EK, lane: '' as const, l: 'Ek İşler' },
            { v: '', lane: 'danismanlik' as const, l: EXPENSE_LANE_LABEL.danismanlik },
            { v: '', lane: 'tespit' as const, l: EXPENSE_LANE_LABEL.tespit },
            { v: '', lane: 'police' as const, l: EXPENSE_LANE_LABEL.police },
            { v: '', lane: 'asistans' as const, l: EXPENSE_LANE_LABEL.asistans },
            { v: '', lane: 'harici' as const, l: 'Harici' },
          ].map(({ v, lane, l }) => (
            <button
              key={`${lane}-${v}-${l}`}
              type="button"
              onClick={() => {
                setFLane(lane);
                setFPlan(lane ? '' : v);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                (lane ? fLane === lane : !fLane && fPlan === v)
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Dosya */}
        <select
          value={fFile}
          onChange={(e) => setFFile(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="">Tüm Dosyalar</option>
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.fileNo}{f.description ? ` — ${f.description}` : ''}
            </option>
          ))}
        </select>

        {/* Tarih aralığı */}
        <div className="flex items-center gap-2">
          <TrDateInput
            value={fDateFrom}
            onChange={setFDateFrom}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 w-[7.5rem]"
            aria-label="Başlangıç tarihi"
          />
          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
          <TrDateInput
            value={fDateTo}
            onChange={setFDateTo}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 w-[7.5rem]"
            aria-label="Bitiş tarihi"
          />
          {(fDateFrom || fDateTo) && (
            <button type="button" onClick={() => { setFDateFrom(''); setFDateTo(''); }}
              className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300">Temizle</button>
          )}
        </div>
      </div>

      <TableColumnsProvider value={tableColumns}>
      <FinansPanelCard title="Masraf Listesi" subtitle={`${expenses.length} kayıt`} noPadding>
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
          <PanelListToolbarPickers>
            <PanelTableColumnPicker tableColumns={tableColumns} />
            <PortalRowActionsPicker
              catalog={FINANS_MASRAF_ROW_ACTIONS}
              pinnedIds={rowActions.pinnedIds}
              onToggle={rowActions.toggle}
              onReset={rowActions.reset}
            />
          </PanelListToolbarPickers>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Yükleniyor...</div>
        ) : expenses.length === 0 ? (
          <div className="p-4">
            <FinansEmptyState title="Masraf kaydı yok." description="Onaylı bütçesi olan dosyaya masraf burada durur." />
            <div className="mt-3 text-center">
              <button type="button" onClick={() => openExpenseForm()} className="text-sm font-medium text-brand-600 hover:underline">
                Masraf ekle
              </button>
            </div>
          </div>
        ) : (
          <>
          <PanelTableScroll>
            <table className="text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <PanelTableColGroup />
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-700/40 text-left">
                  <PanelOrderedHeaderRow
                    tableColumns={tableColumns}
                    thClass={(id) =>
                      id === 'actions'
                        ? 'px-2 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 text-center'
                        : id === 'amount'
                          ? 'px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 text-center'
                          : 'px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400'
                    }
                    unsortableIds={['actions']}
                    sortKey={clientSort?.key ?? null}
                    sortDir={clientSort?.dir ?? 'asc'}
                    onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                    sortKeyFor={(id) => (id === 'operationNo' ? 'id' : id)}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {pagedExpenses.slice.map((e) => {
                  const meta = PLAN_META[e.expensePlan] ?? PLAN_META[PLAN_BUTCE];
                  const cells: Record<string, ReactNode> = {
                    operationNo: (
                      <PanelTableTd key="operationNo" colId="operationNo" className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {financeOperationNo('MSF', e.id, e.createdAt ?? e.date)}
                        </span>
                      </PanelTableTd>
                    ),
                    fileNo: (
                      <PanelTableTd key="fileNo" colId="fileNo" className="px-5 py-3.5" title={e.customerName || e.fileNo || undefined}>
                        {e.fileCaseId && e.fileNo ? (
                          <Link
                            href={`/panel/hasar-dosyalari/${e.fileCaseId}`}
                            className="font-mono text-xs font-semibold text-brand-700 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded hover:underline"
                          >
                            {e.fileNo}
                          </Link>
                        ) : e.customerId && e.customerName ? (
                          <Link
                            href={`/panel/musteriler/${e.customerId}`}
                            className="text-xs font-medium text-brand-700 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded hover:underline"
                          >
                            {e.customerName}
                          </Link>
                        ) : (
                          <span className={`${e.customerName ? 'text-xs font-medium' : 'font-mono text-xs font-semibold'} text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded`}>
                            {e.customerName || e.fileNo || '—'}
                          </span>
                        )}
                      </PanelTableTd>
                    ),
                    expensePlan: (
                      <PanelTableTd key="expensePlan" colId="expensePlan" className="px-5 py-3.5 max-w-0">
                        <span className={`inline-flex max-w-full truncate items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          e.expenseLane === 'asistans'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                            : e.expenseLane === 'danismanlik'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                              : e.expenseLane === 'harici'
                                ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                                : meta.badgeCls
                        }`}>
                          {isCustomerExpenseLane(e.expenseLane) || isHariciExpenseLane(e.expenseLane)
                            ? EXPENSE_LANE_LABEL[e.expenseLane]
                            : meta.label}
                        </span>
                      </PanelTableTd>
                    ),
                    expenseGroupName: (
                      <PanelTableTd key="expenseGroupName" colId="expenseGroupName" className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 max-w-0">
                        <span className="block truncate">{e.expenseGroupName ? toTitleCaseTR(e.expenseGroupName) : '—'}</span>
                      </PanelTableTd>
                    ),
                    expenseSubgroupName: (
                      <PanelTableTd key="expenseSubgroupName" colId="expenseSubgroupName" className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {e.expenseSubgroupName ? toTitleCaseTR(e.expenseSubgroupName) : '—'}
                      </PanelTableTd>
                    ),
                    description: (
                      <PanelTableTd key="description" colId="description" className="px-5 py-3.5 text-slate-600 dark:text-slate-300" title={e.description || undefined}>
                        {e.description ? toTitleCaseTR(e.description) : <span className="text-slate-300 dark:text-slate-600 italic">Açıklama yok</span>}
                      </PanelTableTd>
                    ),
                    amount: (
                      <PanelTableTd key="amount" colId="amount" className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {fmt(e.amount)}
                      </PanelTableTd>
                    ),
                    date: (
                      <PanelTableTd key="date" colId="date" className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {fmtDate(e.date)}
                      </PanelTableTd>
                    ),
                    actions: (
                      <PanelTableTd key="actions" colId="actions" className="px-2 py-3.5">
                        <PinnableRowActions
                          rowId={e.id}
                          menuEvent="finans-masraf-menu-open"
                          testId="masraf-satir-islemler"
                          menuTestId="finans-masraf-menu"
                          moreTestId="finans-masraf-more"
                          pinnedIds={rowActions.pinnedIds}
                          items={[
                            {
                              id: 'edit',
                              label: 'Düzenle',
                              onClick: () => handleEdit(e),
                              icon: (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              ),
                            },
                            {
                              id: 'delete',
                              label: 'Sil',
                              onClick: () => { void handleDelete(e.id); },
                              danger: true,
                              icon: (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              ),
                            },
                          ]}
                        />
                      </PanelTableTd>
                    ),
                  };
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}
                    </tr>
                  );
                })}
              </tbody>
              <PanelTableSummaryFoot
                tableColumns={tableColumns}
                valueColId="amount"
                value={fmt(grandTotal)}
              />
            </table>
          </PanelTableScroll>
            <FinansTablePager
              page={pagedExpenses.safePage}
              pageSize={pageSize}
              total={pagedExpenses.total}
              storageKey={FINANS_TABLE_PAGE_KEYS.masraflar}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            />
          </>
        )}
      </FinansPanelCard>
      </TableColumnsProvider>
      {dialog}
    </div>
  );
}
