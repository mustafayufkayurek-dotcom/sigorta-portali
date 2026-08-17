'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ExpenseFilePickerModal, type ExpensePickerHasarFile } from '@/components/finance/ExpenseFilePickerModal';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { SlidePanel } from '@/components/SlidePanel';
import { ReceiptCameraModal, prefersNativeCameraCapture } from '@/components/ReceiptCameraModal';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableSummaryFoot,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { normalizeTrDateValue, isCompleteTrDateValue } from '@/utils/tr-date-input';
import { parseTrAmountInput, numberToTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { getAccessToken } from '@/utils/auth-session';
import { financeOperationNo } from '@sigorta/shared';

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
  blockReason?: 'NO_BUDGET' | null;
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
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 100, minWidth: 80 },
  { id: 'expensePlan', label: 'Bütçe Tipi', defaultWidth: 96, minWidth: 80 },
  { id: 'expenseGroupName', label: 'Masraf Grubu', defaultWidth: 112, minWidth: 88 },
  { id: 'expenseSubgroupName', label: 'Alt Grup', defaultWidth: 108, minWidth: 88 },
  { id: 'description', label: 'Açıklama', defaultWidth: 200, minWidth: 120 },
  { id: 'amount', label: 'Tutar', defaultWidth: 100, minWidth: 88 },
  { id: 'date', label: 'Tarih', defaultWidth: 96, minWidth: 88 },
];

interface Expense {
  id:                  string;
  createdAt?:          string;
  fileCaseId:          string;
  fileNo:              string;
  expensePlan:         string;
  expenseGroupName:    string;
  expenseSubgroupName: string;
  expenseCategoryId:   string;
  expenseCategoryParentId: string;
  description:         string;
  amount:              number;
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
  ok: { label: 'Normal', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  warning: { label: 'Dikkat', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  over: { label: 'Aşım', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  no_budget: { label: 'Bütçe yok', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
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

const EMPTY_FORM = {
  fileCaseId: '',
  expensePlan: PLAN_BUTCE,
  expenseCategoryParentId: '',
  expenseCategoryId: '',
  description: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  receiptImageUrl: '',
  operationSubject: 'HASAR_ONARIM' as string,
};

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
  // Veriler
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [files,    setFiles]    = useState<FileOption[]>([]);
  const [categoryTree, setCategoryTree] = useState<ExpenseCategoryGroup[]>([]);
  const [categoryFlat, setCategoryFlat] = useState<ExpenseCategoryFlat[]>([]);
  const [categoryChildren, setCategoryChildren] = useState<{ id: string; name: string }[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loading,  setLoading]  = useState(true);

  const tableColumns = usePanelTableColumns('table-cols:finans-masraflar', EXPENSE_TABLE_COLUMNS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);

  const sortedExpenses = useMemo(
    () =>
      sortRowsByClientSort(expenses, clientSort, (e, key) => {
        switch (key) {
          case 'fileNo':
            return e.fileNo;
          case 'expensePlan':
            return PLAN_META[e.expensePlan]?.label ?? e.expensePlan;
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
  const [fFile,     setFFile]     = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo,   setFDateTo]   = useState('');

  // ── Dosyaları yükle ────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (search = '') => {
    if (!getAccessToken()) return;
    try {
      const res = await axios.get(`${API}/expenses/eligible-files`, {
        headers: authHeader(),
        params: search ? { search } : {},
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
  }, []);

  const loadFileLookup = useCallback(async (search = '') => {
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
        params: { q },
      });
      setFileLookup((res.data?.data ?? { found: false }) as FileLookupResult);
    } catch {
      setFileLookup(null);
    } finally {
      setFileLookupLoading(false);
    }
  }, []);

  const handleFileQueryChange = useCallback((query: string) => {
    if (fileSearchDebounceRef.current) clearTimeout(fileSearchDebounceRef.current);
    fileSearchDebounceRef.current = setTimeout(() => {
      setFileSearch(query);
      void loadFiles(query);
      void loadFileLookup(query);
    }, 280);
  }, [loadFiles, loadFileLookup]);

  useEffect(() => {
    if (showForm && !fileSearch) {
      void loadFiles('');
    }
  }, [showForm, fileSearch, loadFiles]);

  useEffect(() => () => {
    if (fileSearchDebounceRef.current) clearTimeout(fileSearchDebounceRef.current);
  }, []);

  const loadCategories = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const [treeRes, flatRes] = await Promise.all([
        axios.get(`${API}/expense-categories`, { headers: authHeader() }),
        axios.get(`${API}/expense-categories/flat`, { headers: authHeader() }),
      ]);
      setCategoryTree((treeRes.data?.data ?? []) as ExpenseCategoryGroup[]);
      setCategoryFlat((flatRes.data?.data ?? []) as ExpenseCategoryFlat[]);
    } catch {
      setCategoryTree([]);
      setCategoryFlat([]);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

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

  const load = useCallback(async () => {
    if (!getAccessToken()) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (fPlan)     params['expensePlan'] = fPlan;
      if (fFile)     params['fileCaseId']  = fFile;
      const dateFrom = normalizeTrDateValue(fDateFrom);
      const dateTo   = normalizeTrDateValue(fDateTo);
      if (dateFrom) params['dateFrom'] = dateFrom;
      if (dateTo)   params['dateTo']   = dateTo;

      const res = await axios.get(`${API}/expenses`, { headers: authHeader(), params });
      const trackRes = await axios.get(`${API}/expenses/budget-tracking`, { headers: authHeader(), params });
      setBudgetFiles((trackRes.data?.files ?? []) as BudgetFileRow[]);
      setBudgetSummary((trackRes.data?.summary ?? null) as BudgetSummary | null);
      const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[];
      setExpenses(rows.map((e) => {
        const cat = parseExpenseCategoryFromRow(e);
        return {
          id:          String(e['id']),
          createdAt:   e['createdAt'] ? String(e['createdAt']) : undefined,
          fileCaseId:  String(e['fileCaseId'] ?? (e['fileCase'] as Record<string, unknown>)?.['id'] ?? ''),
          fileNo:      String(e['fileNo'] ?? (e['fileCase'] as Record<string, unknown>)?.['fileNo'] ?? ''),
          expensePlan: String(e['expensePlan'] ?? ''),
          expenseGroupName: cat.groupName,
          expenseSubgroupName: cat.subName,
          expenseCategoryId: cat.categoryId,
          expenseCategoryParentId: cat.parentId,
          description: String(e['description'] ?? ''),
          amount:      Number(e['amount'] ?? 0),
          date:        String(e['date'] ?? ''),
        };
      }));
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [fPlan, fFile, fDateFrom, fDateTo]);

  useEffect(() => { load(); }, [load]);

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

    if (!form.fileCaseId)  return setFormError('Hasar dosyası seçimi zorunludur.');
    if (!form.expensePlan) return setFormError('Bütçe tipi seçimi zorunludur.');
    if (!form.expenseCategoryParentId) return setFormError('Masraf grubu seçimi zorunludur.');
    const needsSubgroup = categoryChildren.length > 0 || allSubgroups.some((s) => s.parentId === form.expenseCategoryParentId);
    if (needsSubgroup && !form.expenseCategoryId) {
      return setFormError('Masraf alt grubu seçimi zorunludur.');
    }
    const amountNum = parseTrAmountInput(form.amount);
    if (amountNum == null || amountNum <= 0) return setFormError('Geçerli bir tutar giriniz.');
    const dateIso = normalizeTrDateValue(form.date);
    if (!isCompleteTrDateValue(dateIso)) return setFormError('Geçerli bir tarih giriniz (GG.AA.YYYY).');

    const fileOpt = files.find((f) => f.id === form.fileCaseId);
    if (form.expensePlan === PLAN_BUTCE && !fileOpt?.hasApprovedBudget && !editId) {
      return setFormError('Onaylı bütçesi olmayan dosyaya masraf girilemez.');
    }
    if (form.expensePlan === PLAN_EK && !fileOpt?.hasEkBudget && !editId) {
      return setFormError('Ek iş satış bütçesi tanımlı olmayan dosyaya ek iş masrafı girilemez.');
    }

    setSaving(true);
    try {
      const payload = {
        fileCaseId: form.fileCaseId,
        expensePlan: form.expensePlan,
        expenseCategoryId: form.expenseCategoryId || form.expenseCategoryParentId,
        operationSubject: form.operationSubject || 'HASAR_ONARIM',
        description: form.description ? toTitleCaseTR(form.description.trim()) : undefined,
        amount:      amountNum,
        date:        dateIso,
        receiptImageUrl: form.receiptImageUrl || undefined,
      };
      if (editId) {
        await axios.put(`${API}/expenses/${editId}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expenses`, payload, { headers: authHeader() });
      }

      if (!editId && mode === 'new') {
        setForm({
          ...EMPTY_FORM,
          fileCaseId:  form.fileCaseId,
          expensePlan: form.expensePlan,
          expenseCategoryParentId: form.expenseCategoryParentId,
          expenseCategoryId: form.expenseCategoryId,
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
    setForm({
      fileCaseId: e.fileCaseId,
      expensePlan: e.expensePlan,
      expenseCategoryParentId: e.expenseCategoryParentId,
      expenseCategoryId: e.expenseCategoryId,
      description: e.description,
      amount: numberToTrAmountInput(e.amount),
      date: e.date?.slice(0, 10) ?? '',
      receiptImageUrl: '',
      operationSubject: e.operationSubject ?? 'HASAR_ONARIM',
    });
    resetReceiptScan();
    openExpenseForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu masrafı silmek istediğinize emin misiniz?')) return;
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
    const filtered = files.filter((f) =>
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
  }, [files, form.expensePlan, form.fileCaseId, editId, expenses]);

  const formFileEligible = useMemo(() => {
    if (!form.fileCaseId) return false;
    const f = files.find((x) => x.id === form.fileCaseId);
    if (!f) return Boolean(editId);
    return form.expensePlan === PLAN_EK ? f.hasEkBudget : f.hasApprovedBudget;
  }, [form.fileCaseId, form.expensePlan, files, editId]);

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
    if (!form.fileCaseId) {
      blockers.push('Hasar dosyası seçin (dosya no veya sigortalı adı ile arayın)');
    } else if (!formFileEligible) {
      blockers.push(
        form.expensePlan === PLAN_EK
          ? 'Seçilen dosyada ek iş satış bütçesi yok'
          : 'Seçilen dosyada onaylı bütçe yok',
      );
    }
    if (!form.expenseCategoryParentId) blockers.push('Masraf grubu seçin');
    if (needsExpenseSubgroup && !form.expenseCategoryId) blockers.push('Masraf alt grubu seçin');
    const amountNum = parseTrAmountInput(form.amount);
    if (amountNum == null || amountNum <= 0) blockers.push('Geçerli bir tutar girin');
    const dateIso = normalizeTrDateValue(form.date);
    if (!isCompleteTrDateValue(dateIso)) blockers.push('Geçerli bir tarih girin (GG.AA.YYYY)');
    return blockers;
  }, [
    form.fileCaseId,
    form.expensePlan,
    form.expenseCategoryParentId,
    form.expenseCategoryId,
    form.amount,
    form.date,
    formFileEligible,
    needsExpenseSubgroup,
  ]);

  const formCanSave = formSaveBlockers.length === 0 && (Boolean(editId) || selectableFiles.length > 0);

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
      resetReceiptScan();
    }
    setAnalyticsOpen(false);
    setShowForm(true);
  };

  const closeExpenseForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFileSearch('');
    setFileLookup(null);
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
  const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 min-h-screen bg-white -mx-4 -my-6 px-4 py-6 sm:-m-6 sm:p-6">

      <FinansSubpageBreadcrumb current="Masraflar" />

      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Masraf İzleme</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Dosya bütçelerine karşı gerçekleşen masrafları izleyin; sapmayı anında görün
          </p>
        </div>
        <button
          onClick={() => (showForm ? closeExpenseForm() : openExpenseForm())}
          className="flex items-center gap-1.5 text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 shadow-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? 'Formu Kapat' : 'Masraf Ekle'}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Bütçe disiplini</p>
        <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">
          Masraf yalnızca <strong>onaylı bütçesi</strong> olan hasar dosyalarına (Dosya Bütçesi) veya{' '}
          <strong>ek iş satışı kayıtlı</strong> dosyalara (Ek İşler) girilebilir. Bütçe yoksa önce hasar dosyası → Finans → Bütçe adımını tamamlayın.
        </p>
      </div>

      {/* KPI şeridi — bütçe odaklı */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Toplam Bütçe</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmt(budgetSummary?.totalBudgetLimit ?? 0)}</p>
          <p className="text-[10px] text-slate-400">{budgetSummary?.fileCount ?? 0} dosya</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${PLAN_META[PLAN_BUTCE].cardCls}`}>
          <p className="text-[11px] font-medium text-brand-600 dark:text-blue-400">Harcanan (Bütçe)</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(budgetSummary?.totalSpentButce ?? butceTotal)}</p>
          <p className="text-[10px] text-blue-400">
            {budgetSummary?.usagePercent != null ? `%${budgetSummary.usagePercent} kullanım` : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Kalan Bütçe</p>
          <p className={`text-lg font-bold ${(budgetSummary?.totalRemaining ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
            {fmt(budgetSummary?.totalRemaining ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400">plan − harcama</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${(budgetSummary?.totalVariance ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Bütçe Sapması</p>
          <p className={`text-lg font-bold ${(budgetSummary?.totalVariance ?? 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'}`}>
            {(budgetSummary?.totalVariance ?? 0) > 0 ? '+' : ''}{fmt(budgetSummary?.totalVariance ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400">
            {(budgetSummary?.overBudgetFileCount ?? 0) > 0
              ? `${budgetSummary?.overBudgetFileCount} dosya aşımda`
              : 'sapma yok'}
          </p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${PLAN_META[PLAN_EK].cardCls}`}>
          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Ek İş Masrafı</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(budgetSummary?.totalSpentEk ?? ekTotal)}</p>
          <p className="text-[10px] text-amber-400">{expenses.length} kalem</p>
        </div>
      </div>

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
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{row.fileNo}</span>
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
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[row.status].cls}`}>
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
      <SlidePanel open={showForm} onClose={closeExpenseForm} title={editId ? 'Masrafı Düzenle' : 'Yeni Masraf Ekle'} width={520}>
        <div className="p-5 space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          {!editId && (
            <FileDropZone
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              disabled={scanning}
              clickToOpen={false}
              onFiles={(files) => {
                const file = files.find((f) => f.type.startsWith('image/'));
                if (file) void handleReceiptScan(file);
              }}
              className="rounded-xl border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 transition-colors"
              activeClassName="border-blue-400 bg-blue-100/80 dark:bg-blue-900/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Akıllı Fiş / Fatura Okuma</p>
                  <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1">
                    Kamerayla fişi çekin, galeriden seçin veya fiş görselini buraya sürükleyin; tutar, tarih ve açıklama otomatik doldurulur.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                    className="inline-flex items-center gap-1.5 text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 font-medium transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {scanning ? 'Okunuyor...' : 'Kamerayla Tara'}
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => receiptFileInputRef.current?.click()}
                    className="text-sm border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl hover:bg-blue-100/60 dark:hover:bg-blue-900/30 disabled:opacity-50 font-medium transition-colors"
                  >
                    Dosyadan Seç
                  </button>
                </div>
              </div>
              {scanInfo && (
                <p className="mt-3 text-xs text-blue-800 dark:text-blue-200 bg-white/70 dark:bg-slate-900/40 rounded-lg px-3 py-2">
                  {scanInfo}
                </p>
              )}
              {(receiptPreview || form.receiptImageUrl) && (
                <div className="mt-3 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptPreview ?? form.receiptImageUrl}
                    alt="Yüklenen fiş"
                    className="h-24 w-auto rounded-lg border border-blue-200 dark:border-blue-800 object-cover"
                  />
                  <p className="text-[11px] text-blue-700/70 dark:text-blue-300/70">
                    Görsel kaydedildi. Alanları kontrol edip dosyayı seçtikten sonra kaydedin.
                  </p>
                </div>
              )}
            </FileDropZone>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Hasar Dosyası — arama ile seçim */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                İlgili Dosya / Sigortalı <span className="text-status-danger">*</span>
              </label>
              <div className="flex gap-2">
                <SearchableSelect
                  className="min-w-0 flex-1"
                  inputClassName={inputCls}
                  options={fileSelectOptions}
                  value={form.fileCaseId}
                  onChange={(id) => setForm({ ...form, fileCaseId: id })}
                  onQueryChange={handleFileQueryChange}
                  placeholder="Dosya no, hasar no veya sigortalı adı yazın..."
                  emptyText={
                    fileLookupLoading
                      ? 'Aranıyor...'
                      : fileLookup?.found && !fileLookup.canEnterExpense
                        ? 'Dosya bulundu — bütçe onayı gerekli (aşağıya bakın)'
                        : 'Uygun dosya bulunamadı — listeden seçin veya bütçe onaylayın'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowFilePicker(true)}
                  className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
                  title="Hasar onarım, acil yardım veya özel müşteri listesinden dosya seç"
                >
                  Dosyadan Seç
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                Dosya numarasını hatırlamıyorsanız &quot;Dosyadan Seç&quot; ile hasar onarım, acil yardım veya özel müşteri listesinden seçin. Özel müşteride arama müşteri adı ile yapılır.
              </p>
              {form.fileCaseId && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {(() => {
                    const sel = files.find((f) => f.id === form.fileCaseId);
                    if (!sel) return null;
                    return (
                      <>
                        Seçili: <span className="font-medium text-slate-700 dark:text-slate-200">{sel.fileNo}</span>
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
                    Dosya sistemde kayıtlı ancak onaylı bütçe veya ek iş satışı yok. Masraf girebilmek için önce bütçe oluşturup onaylatın.
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
                <div className={`mt-3 rounded-xl border px-4 py-3 ${
                  selectedFileBudget.status === 'over'
                    ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
                    : selectedFileBudget.status === 'warning'
                      ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'
                      : 'border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {selectedFileBudget.fileNo} — Bütçe Durumu
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[selectedFileBudget.status].cls}`}>
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

            <div className="md:col-span-2">
              <label className={labelCls}>İşlem No</label>
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
                    : 'Kayıt Sonrası Oluşur'
                }
              />
            </div>

            {/* Bütçe Tipi — Dosya Bütçesi / Ek İşler */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                Bütçe Tipi <span className="text-status-danger">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: PLAN_BUTCE, label: 'Dosya Bütçesi', sub: 'Normal bütçe kapsamındaki masraflar', icon: '📁', activeCls: 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' },
                  { value: PLAN_EK,   label: 'Ek İşler',       sub: 'Bütçe dışı ek iş masrafları',        icon: '➕', activeCls: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setForm((f) => {
                        const file = files.find((x) => x.id === f.fileCaseId);
                        const fileOk = file && (opt.value === PLAN_EK ? file.hasEkBudget : file.hasApprovedBudget);
                        return {
                          ...f,
                          expensePlan: opt.value,
                          fileCaseId: fileOk ? f.fileCaseId : '',
                        };
                      });
                    }}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
                      form.expensePlan === opt.value
                        ? opt.activeCls
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <p className={`font-semibold text-sm mt-1 ${form.expensePlan === opt.value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>
                Masraf Grubu / Alt Grubu <span className="text-status-danger">*</span>
              </label>
              {categoryTree.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                  Masraf grupları yüklenemedi veya henüz tanımlı değil.{' '}
                  <a href="/panel/ayarlar/masraf-kategorileri" className="font-semibold underline">
                    Ayarlar → Masraf Kategorileri
                  </a>
                  {' '}sayfasından &quot;Varsayılanları Yükle&quot; ile başlayabilirsiniz.
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Masraf Grubu</label>
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
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Masraf Alt Grubu</label>
                    {form.expenseCategoryParentId && categoryChildren.length === 0 && allSubgroups.length === 0 && !loadingChildren ? (
                      <div className={`${inputCls} text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50`}>
                        Bu grupta alt grup tanımlı değil — grup doğrudan kullanılacak.
                        {' '}
                        <a href="/panel/ayarlar/masraf-kategorileri" className="text-brand-600 underline">
                          Alt grup ekle
                        </a>
                      </div>
                    ) : form.expenseCategoryParentId && categoryChildren.length === 0 && allSubgroups.length > 0 ? (
                      <SearchableSelect
                        options={subgroupOptions}
                        value={form.expenseCategoryId}
                        onChange={handleSubgroupPick}
                        placeholder="Tüm alt gruplarda ara..."
                        emptyText="Alt grup bulunamadı"
                        inputClassName={inputCls}
                      />
                    ) : form.expenseCategoryParentId ? (
                      <SearchableSelect
                        options={subgroupOptions}
                        value={form.expenseCategoryId}
                        onChange={handleSubgroupPick}
                        placeholder={loadingChildren ? 'Yükleniyor...' : 'Alt grup ara...'}
                        emptyText={loadingChildren ? 'Yükleniyor...' : 'Alt grup bulunamadı'}
                        disabled={loadingChildren}
                        inputClassName={inputCls}
                      />
                    ) : (
                      <SearchableSelect
                        options={subgroupOptions}
                        value={form.expenseCategoryId}
                        onChange={handleSubgroupPick}
                        placeholder="Önce grup seçin veya alt grup ara..."
                        emptyText="Alt grup bulunamadı"
                        inputClassName={inputCls}
                      />
                    )}
                  </div>
                </div>
                {allSubgroups.length === 0 && categoryTree.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Sistemde henüz masraf alt grubu yok. Ayarlar → Masraf Kategorileri → ilgili gruba &quot;Alt Grup Ekle&quot; ile tanımlayın
                    veya &quot;Varsayılanları Yükle&quot; ile hazır seti getirin.
                  </p>
                )}
                </>
              )}
            </div>

            {/* Açıklama */}
            <div className="md:col-span-2">
              <label className={labelCls}>Açıklama</label>
              <input
                className={inputCls}
                placeholder="Masraf açıklaması (örn: Çatı kaplama malzemesi)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setForm((f) => ({ ...f, description: v }));
                }}
              />
            </div>

            {/* Tutar */}
            <div>
              <label className={labelCls}>Tutar (TL) <span className="text-status-danger">*</span></label>
              <TrAmountInput
                className={inputCls}
                placeholder="0"
                value={form.amount}
                onChange={(amount) => setForm({ ...form, amount })}
              />
            </div>

            {/* Tarih */}
            <div>
              <label className={labelCls}>Tarih <span className="text-status-danger">*</span></label>
              <TrDateInput
                className={inputCls}
                value={form.date}
                onChange={(date) => setForm({ ...form, date })}
              />
            </div>
          </div>

          {!formCanSave && formSaveBlockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Kaydetmek için eksikler:</p>
              <ul className="space-y-1">
                {formSaveBlockers.map((b) => (
                  <li key={b} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                    <span className="text-status-danger mt-0.5">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={closeExpenseForm}
              className="text-sm text-slate-500 dark:text-slate-400 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              İptal
            </button>
            {editId ? (
              <button
                type="button"
                onClick={() => handleSave('close')}
                disabled={saving || !formCanSave}
                className="text-sm bg-brand-600 text-white px-6 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 font-medium transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Güncelle'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave('close')}
                  disabled={saving || !formCanSave}
                  className="text-sm text-slate-600 dark:text-slate-300 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Kaydet ve Kapat
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('new')}
                  disabled={saving || !formCanSave}
                  className="text-sm bg-brand-600 text-white px-6 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 font-medium transition-colors"
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

      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        {/* Kategori */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-1">
          {[{ v: '', l: 'Tümü' }, { v: PLAN_BUTCE, l: 'Dosya Bütçesi' }, { v: PLAN_EK, l: 'Ek İşler' }].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => setFPlan(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                fPlan === v
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

      {/* Liste Tablosu */}
      <TableColumnsProvider value={tableColumns}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Masraf Listesi</p>
            <span className="text-xs text-slate-400 dark:text-slate-500">{expenses.length} kayıt</span>
          </div>
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Yükleniyor...</div>
        ) : expenses.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-slate-400 dark:text-slate-500">Henüz veri bulunmamaktadır.</p>
            <button type="button" onClick={() => openExpenseForm()}
              className="mt-3 text-xs text-brand-600 dark:text-blue-400 hover:underline">
              + İlk masrafı ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-700/40 text-left">
                  <SortablePanelTableTh colId="operationNo" sortKey="id" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">İşlem No</SortablePanelTableTh>
                  <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Dosya No</SortablePanelTableTh>
                  <SortablePanelTableTh colId="expensePlan" sortKey="expensePlan" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Bütçe Tipi</SortablePanelTableTh>
                  <SortablePanelTableTh colId="expenseGroupName" sortKey="expenseGroupName" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Masraf Grubu</SortablePanelTableTh>
                  <SortablePanelTableTh colId="expenseSubgroupName" sortKey="expenseSubgroupName" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Alt Grup</SortablePanelTableTh>
                  <SortablePanelTableTh colId="description" sortKey="description" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Açıklama</SortablePanelTableTh>
                  <SortablePanelTableTh colId="amount" sortKey="amount" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 text-center">Tutar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="date" sortKey="date" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Tarih</SortablePanelTableTh>
                  <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 text-right w-[72px]">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {sortedExpenses.map((e) => {
                  const meta = PLAN_META[e.expensePlan] ?? PLAN_META[PLAN_BUTCE];
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <PanelTableTd colId="operationNo" className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {financeOperationNo('MSF', e.id, e.createdAt ?? e.date)}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="fileNo" className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {e.fileNo || '—'}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="expensePlan" className="px-5 py-3.5 max-w-0">
                        <span className={`inline-flex max-w-full truncate items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="expenseGroupName" className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 max-w-0">
                        <span className="block truncate">{e.expenseGroupName ? toTitleCaseTR(e.expenseGroupName) : '—'}</span>
                      </PanelTableTd>
                      <PanelTableTd colId="expenseSubgroupName" className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {e.expenseSubgroupName ? toTitleCaseTR(e.expenseSubgroupName) : '—'}
                      </PanelTableTd>
                      <PanelTableTd colId="description" className="px-5 py-3.5 text-slate-600 dark:text-slate-300" title={e.description || undefined}>
                        {e.description ? toTitleCaseTR(e.description) : <span className="text-slate-300 dark:text-slate-600 italic">Açıklama yok</span>}
                      </PanelTableTd>
                      <PanelTableTd colId="amount" className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {fmt(e.amount)}
                      </PanelTableTd>
                      <PanelTableTd colId="date" className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {fmtDate(e.date)}
                      </PanelTableTd>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => handleEdit(e)} title="Düzenle"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => handleDelete(e.id)} title="Sil"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
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
          </div>
        )}
      </div>
      </TableColumnsProvider>
    </div>
  );
}
