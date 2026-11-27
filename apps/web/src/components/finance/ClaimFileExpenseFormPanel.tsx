'use client';

/**
 * Dosya Finans sekmesi — Finans → Masraf İzleme ile aynı masraf ekleme yöntemi.
 * Dosya kilitli; kayıt /expenses API’sine gider.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { readSelectVendorId } from '@/utils/panel-return-bridge';
import { takeClaimFileExpenseDraft } from '@/utils/masraf-form-draft';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SlidePanel } from '@/components/SlidePanel';
import { ReceiptCameraModal, prefersNativeCameraCapture } from '@/components/ReceiptCameraModal';
import { CariHesapCreateModal } from '@/components/finance/CariHesapCreateModal';
import { CariHesapOzetModal } from '@/components/finance/CariHesapOzetModal';
import { MasrafHatirlaChips } from '@/components/finance/MasrafHatirlaChips';
import { VendorQuickCreateModal } from '@/components/finance/VendorQuickCreateModal';
import {
  readMasrafAciklamaHatirla,
  readMasrafBelgeSahibiHatirla,
  rememberMasrafAciklama,
  rememberMasrafBelgeSahibi,
} from '@/utils/masraf-aciklama-hatirla';
import {
  ExpenseDocumentReviewModal,
  parseExpenseDocumentReviewFromError,
} from '@/components/finance/ExpenseDocumentReviewModal';
import { API, authHeader } from '@/utils/api';
import { normalizeTrDateValue, isCompleteTrDateValue } from '@/utils/tr-date-input';
import { parseTrAmountInput, numberToTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { suggestAutoCode } from '@/utils/auto-code';
import { computeAlphabeticSortOrder } from '@/utils/definition-sort-order';
import { ACIKLAMA_YARDIM } from '@/utils/aciklama-yardim';
import { formatTryAmount } from '@/utils/format-try-amount';
import {
  financeOperationNo,
  mergeMasrafOdemeKaynaklari,
  masrafPendingVendorOptionId,
  normalizeMasrafAciklamaForSave,
  parseMasrafPendingVendorId,
  resolveFinansIslemTarihiDonemDurum,
  type ExpenseDocumentReviewPayload,
} from '@sigorta/shared';
import { FinansTarihDonemUyariIkon } from '@/components/finance/FinansTarihDonemUyariIkon';
import { pushFinansVerimlilikAnalizUyari } from '@/utils/finans-verimlilik-analiz-uyari';

const PLAN_BUTCE = 'BUTCELENEN';
const PLAN_EK = 'EKSTRA_SATIS_MASRAFI';

type CategoryGroup = { id: string; name: string; children?: { id: string; name: string }[] };
type CategoryFlat = { id: string; name: string; parentId: string | null; level: number };

type FileEligibility = {
  hasApprovedBudget: boolean;
  hasEkBudget: boolean;
  fileNo?: string;
};

const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
const requiredHint = (
  <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
);
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600';

export type ClaimFileExpenseFormPanelProps = {
  open: boolean;
  onClose: () => void;
  claimFileId: string;
  fileLabel?: string;
  onSaved?: () => void;
  /** true: kendi SlidePanel’i yok — üst panel sekmesi içinde kullanılır */
  embedded?: boolean;
  /** Dosya özelinde ekstra iş masrafı da seçilir */
  allowExtraWorkPlan?: boolean;
};

export function ClaimFileExpenseFormPanel({
  open,
  onClose,
  claimFileId,
  fileLabel,
  onSaved,
  embedded = false,
  allowExtraWorkPlan = false,
}: ClaimFileExpenseFormPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openBootKeyRef = useRef('');
  const [expensePlan, setExpensePlan] = useState(PLAN_BUTCE);
  const [lastSavedOpNo, setLastSavedOpNo] = useState<string | null>(null);
  const [expenseCategoryParentId, setExpenseCategoryParentId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [partyAccountId, setPartyAccountId] = useState('');
  const [partyAccounts, setPartyAccounts] = useState<
    {
      id: string;
      name: string;
      kindLabel: string;
      linkedVendorId: string | null;
      cardLast4: string | null;
      pendingVendorId?: string;
    }[]
  >([]);
  const [odemeKaynakEnsuring, setOdemeKaynakEnsuring] = useState(false);
  const [showCariCreate, setShowCariCreate] = useState(false);
  const [showVendorQuickCreate, setShowVendorQuickCreate] = useState(false);
  const [cariOzetId, setCariOzetId] = useState<string | null>(null);
  const [aciklamaHatirla, setAciklamaHatirla] = useState<string[]>([]);
  const [belgeSahibiHatirla, setBelgeSahibiHatirla] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState<'group' | 'sub' | null>(null);
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [categoryDraftError, setCategoryDraftError] = useState('');
  const [categoryDraftSaving, setCategoryDraftSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<'' | 'Kasa Fişi' | 'Fatura'>('');
  const [documentOwner, setDocumentOwner] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [amount, setAmount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [categoryTree, setCategoryTree] = useState<CategoryGroup[]>([]);
  const [categoryFlat, setCategoryFlat] = useState<CategoryFlat[]>([]);
  const [categoryChildren, setCategoryChildren] = useState<{ id: string; name: string }[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [eligibility, setEligibility] = useState<FileEligibility | null>(null);
  const [budgetHint, setBudgetHint] = useState<{
    budgetLimit: number;
    spentButce: number;
    remainingButce: number;
    ekBudgetLimit: number;
    spentEk: number;
    remainingEk: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [docReview, setDocReview] = useState<ExpenseDocumentReviewPayload | null>(null);
  const [pendingSaveMode, setPendingSaveMode] = useState<'close' | 'new' | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setExpensePlan(PLAN_BUTCE);
    setExpenseCategoryParentId('');
    setExpenseCategoryId('');
    setPartyAccountId('');
    setShowCariCreate(false);
    setCategoryDraft(null);
    setCategoryDraftName('');
    setCategoryDraftError('');
    setDescription('');
    setDocumentType('');
    setDocumentOwner('');
    setDocumentNo('');
    setAmount('');
    setVatRate('');
    setDate(new Date().toISOString().slice(0, 10));
    setReceiptImageUrl('');
    setFormError('');
    setScanInfo('');
    setReceiptPreview(null);
    setLastSavedOpNo(null);
  }, []);

  const loadCategories = useCallback(async () => {
    const [treeRes, flatRes] = await Promise.all([
      axios.get(`${API}/expense-categories`, { headers: authHeader() }),
      axios.get(`${API}/expense-categories/flat`, { headers: authHeader() }),
    ]);
    setCategoryTree((treeRes.data?.data ?? []) as CategoryGroup[]);
    setCategoryFlat((flatRes.data?.data ?? []) as CategoryFlat[]);
  }, []);

  const loadPartyAccounts = useCallback(async () => {
    const paRes = await axios.get(`${API}/finance/party-accounts?ensureVendors=1`, {
      headers: authHeader(),
    });
    const accounts = (paRes.data?.data ?? []) as Array<{
      id: string;
      name: string;
      kindLabel: string;
      kind?: string;
      linkedVendorId?: string | null;
      cardLast4?: string | null;
    }>;

    const vendors: Array<{ id: string; name: string; status?: string | null }> = [];
    try {
      let page = 1;
      let totalPages = 1;
      do {
        const vendorRes = await axios.get(`${API}/vendors`, {
          headers: authHeader(),
          params: { status: 'active', page, limit: 150 },
        });
        const batch = (vendorRes.data?.data ?? []) as Array<{
          id: string;
          name: string;
          status?: string | null;
        }>;
        vendors.push(...batch);
        const meta = vendorRes.data?.meta as { totalPages?: number } | undefined;
        totalPages = Math.max(1, Number(meta?.totalPages) || 1);
        page += 1;
      } while (page <= totalPages && page <= 50);
    } catch {
      /* vendor.view yoksa yalnız cari listesi */
    }

    setPartyAccounts(
      mergeMasrafOdemeKaynaklari({
        accounts: accounts.map((r) => ({
          id: r.id,
          name: r.name,
          kindLabel: r.kindLabel,
          kind: String(r.kind ?? ''),
          linkedVendorId: r.linkedVendorId ?? null,
          cardLast4: r.cardLast4 ?? null,
        })),
        vendors,
      }),
    );
  }, []);

  const handleOdemeKaynakChange = async (optionId: string) => {
    const pendingVendorId = parseMasrafPendingVendorId(optionId);
    if (!pendingVendorId) {
      setPartyAccountId(optionId);
      return;
    }
    setOdemeKaynakEnsuring(true);
    setFormError('');
    try {
      const res = await axios.post(
        `${API}/finance/party-accounts/ensure-vendor`,
        { vendorId: pendingVendorId },
        { headers: authHeader() },
      );
      const account = res.data?.data as { id?: string } | undefined;
      await loadPartyAccounts();
      if (!account?.id) {
        setFormError('Tedarikçi carisi açılamadı.');
        return;
      }
      setPartyAccountId(account.id);
    } catch {
      setFormError('Tedarikçi carisi açılamadı.');
    } finally {
      setOdemeKaynakEnsuring(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setAciklamaHatirla(readMasrafAciklamaHatirla());
    setBelgeSahibiHatirla(readMasrafBelgeSahibiHatirla());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const bootKey = `${claimFileId}:${open ? '1' : '0'}`;
    if (!open) {
      openBootKeyRef.current = '';
      return;
    }
    if (openBootKeyRef.current === bootKey) return;
    openBootKeyRef.current = bootKey;

    const draft = takeClaimFileExpenseDraft(claimFileId);
    if (draft) {
      setExpensePlan(draft.expensePlan || PLAN_BUTCE);
      setExpenseCategoryParentId(draft.expenseCategoryParentId || '');
      setExpenseCategoryId(draft.expenseCategoryId || '');
      setPartyAccountId(draft.partyAccountId || '');
      setDescription(draft.description || '');
      setDocumentType((draft.documentType as '' | 'Kasa Fişi' | 'Fatura') || '');
      setDocumentOwner(draft.documentOwner || '');
      setDocumentNo(draft.documentNo || '');
      setAmount(draft.amount || '');
      setVatRate(draft.vatRate || '');
      setDate(draft.date || new Date().toISOString().slice(0, 10));
      setReceiptImageUrl(draft.receiptImageUrl || '');
      setFormError('');
    } else {
      resetForm();
    }
    let cancelled = false;
    setMetaLoading(true);
    setMetaError('');
    (async () => {
      try {
        const [trackRes] = await Promise.all([
          axios.get(`${API}/expenses/budget-tracking`, {
            headers: authHeader(),
            params: { fileCaseId: claimFileId },
          }),
          loadCategories(),
          loadPartyAccounts(),
        ]);
        if (cancelled) return;
        const trackFiles = (trackRes.data?.files ?? trackRes.data?.data?.files ?? []) as Array<Record<string, unknown>>;
        const row = trackFiles.find((f) => String(f['fileCaseId'] ?? f['id'] ?? '') === claimFileId)
          ?? trackFiles[0]
          ?? null;
        if (row) {
          const budgetLimit = Number(row['budgetLimit'] ?? 0);
          const ekBudgetLimit = Number(row['ekBudgetLimit'] ?? 0);
          setEligibility({
            hasApprovedBudget: budgetLimit > 0 || Boolean(row['hasApprovedBudget']),
            hasEkBudget: ekBudgetLimit > 0 || Boolean(row['hasEkBudget']),
            fileNo: String(row['fileNo'] ?? ''),
          });
          setBudgetHint({
            budgetLimit,
            spentButce: Number(row['spentButce'] ?? row['spent'] ?? 0),
            remainingButce: Number(row['remainingButce'] ?? row['remaining'] ?? 0),
            ekBudgetLimit,
            spentEk: Number(row['spentEk'] ?? 0),
            remainingEk: Number(row['remainingEk'] ?? 0),
          });
        } else {
          setEligibility({ hasApprovedBudget: false, hasEkBudget: false });
          setBudgetHint(null);
        }
        const pendingVendor = readSelectVendorId(searchParams);
        if (pendingVendor) {
          await handleOdemeKaynakChange(masrafPendingVendorOptionId(pendingVendor));
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('selectVendorId');
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setCategoryTree([]);
          setCategoryFlat([]);
          setEligibility({ hasApprovedBudget: false, hasEkBudget: false });
          setBudgetHint(null);
          const msg = axios.isAxiosError(err)
            ? (err.response?.data?.message ?? err.message ?? 'Veriler yüklenemedi')
            : 'Veriler yüklenemedi';
          setMetaError(String(msg));
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open açılışında bir kez
  }, [open, claimFileId, resetForm, loadCategories, loadPartyAccounts, searchParams]);

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
    if (!expenseCategoryParentId) {
      setCategoryChildren([]);
      return;
    }
    const fromTree = categoryTree.find((g) => g.id === expenseCategoryParentId)?.children ?? [];
    if (fromTree.length > 0) {
      setCategoryChildren(fromTree);
      return;
    }
    let cancelled = false;
    setLoadingChildren(true);
    axios
      .get(`${API}/expense-categories/${expenseCategoryParentId}`, { headers: authHeader() })
      .then((res) => {
        if (!cancelled) setCategoryChildren((res.data?.data?.children ?? []) as { id: string; name: string }[]);
      })
      .catch(() => { if (!cancelled) setCategoryChildren([]); })
      .finally(() => { if (!cancelled) setLoadingChildren(false); });
    return () => { cancelled = true; };
  }, [expenseCategoryParentId, categoryTree]);

  const groupOptions = useMemo(
    () => categoryTree.map((g) => ({ value: g.id, label: g.name })),
    [categoryTree],
  );

  const subgroupOptions = useMemo(() => {
    if (expenseCategoryParentId && categoryChildren.length > 0) {
      return categoryChildren.map((c) => ({ value: c.id, label: c.name }));
    }
    return allSubgroups.map((s) => ({
      value: s.id,
      label: s.name,
      hint: s.parentName ? `Grup: ${s.parentName}` : undefined,
    }));
  }, [expenseCategoryParentId, categoryChildren, allSubgroups]);

  const needsSubgroup =
    categoryChildren.length > 0
    || allSubgroups.some((s) => s.parentId === expenseCategoryParentId);

  const planEligible =
    expensePlan === PLAN_EK
      ? Boolean(eligibility?.hasEkBudget)
      : Boolean(eligibility?.hasApprovedBudget);

  const selectedParty = useMemo(
    () => partyAccounts.find((p) => p.id === partyAccountId) ?? null,
    [partyAccounts, partyAccountId],
  );

  const masrafAmounts = useMemo(() => {
    const gross = parseTrAmountInput(amount) ?? 0;
    const rateRaw = String(vatRate ?? '').trim();
    const rate = rateRaw === '' ? 0 : (parseFloat(rateRaw) || 0);
    const matrah = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
    const vatAmount = Math.round((gross - matrah) * 100) / 100;
    return { gross, rate, matrah, vatAmount };
  }, [amount, vatRate]);

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
    if (categoryDraft === 'sub' && !expenseCategoryParentId) {
      setCategoryDraftError('Önce masraf grubunu seçin.');
      return;
    }
    const siblings = categoryDraft === 'group'
      ? categoryTree
      : allSubgroups.filter((s) => s.parentId === expenseCategoryParentId);
    if (siblings.some((s) => s.name.trim().toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      setCategoryDraftError('Bu ad zaten duruyor.');
      return;
    }
    setCategoryDraftSaving(true);
    setCategoryDraftError('');
    const sortOrder = computeAlphabeticSortOrder(name, siblings);
    const baseCode = suggestAutoCode(categoryDraft === 'group' ? 'EXP' : 'ALT', name);
    const parentId = categoryDraft === 'sub' ? expenseCategoryParentId : undefined;
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
        setExpenseCategoryParentId(createdId);
        setExpenseCategoryId('');
      } else if (createdId) {
        setExpenseCategoryId(createdId);
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

  const formSaveBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!expensePlan) blockers.push('Masraf yeri seçin');
    if (!planEligible) {
      blockers.push(
        expensePlan === PLAN_EK
          ? 'Bu dosyada ek iş bütçesi yok'
          : 'Bu dosyada onaylı bütçe yok',
      );
    }
    if (!partyAccountId) blockers.push('Ödeme kaynağı cari seçin');
    if (!expenseCategoryParentId) blockers.push('Masraf kalemi (grup) seçin');
    if (needsSubgroup && !expenseCategoryId) blockers.push('Masraf kalemi (alt grup) seçin');
    if (masrafAmounts.gross <= 0) blockers.push('Geçerli tutar girin');
    if (!description.trim()) blockers.push(ACIKLAMA_YARDIM.masraf);
    if (!isCompleteTrDateValue(normalizeTrDateValue(date))) blockers.push('Geçerli tarih girin (GG.AA.YYYY)');
    return blockers;
  }, [
    expensePlan,
    planEligible,
    partyAccountId,
    expenseCategoryParentId,
    needsSubgroup,
    expenseCategoryId,
    masrafAmounts.gross,
    date,
    description,
  ]);

  const formCanSave = formSaveBlockers.length === 0;

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
    setReceiptPreview(URL.createObjectURL(file));
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
        receiptImageUrl?: string | null;
        message?: string;
        configured?: boolean;
      };
      if (data.amount != null && data.amount > 0) setAmount(numberToTrAmountInput(data.amount));
      if (data.date) setDate(data.date.slice(0, 10));
      if (data.description) setDescription(data.description);
      if (data.receiptImageUrl) setReceiptImageUrl(data.receiptImageUrl);
      setScanInfo(
        data.message
          ?? (data.configured === false
            ? 'Fiş kaydedildi. Otomatik okuma için sistem yöneticisi OpenAI anahtarı tanımlamalı.'
            : 'Belge işlendi — alanları kontrol edin.'),
      );
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Fiş okunamadı') : 'Fiş okunamadı';
      setFormError(String(msg));
      resetReceiptScan();
    } finally {
      setScanning(false);
    }
  };

  const startReceiptCapture = () => {
    if (prefersNativeCameraCapture()) {
      receiptCameraInputRef.current?.click();
      return;
    }
    setShowCameraModal(true);
  };

  const handleSave = async (
    mode: 'close' | 'new',
    opts?: { documentConflictOverrideReason?: string },
  ) => {
    setFormError('');
    if (!formCanSave) {
      setFormError(formSaveBlockers[0] ?? 'Eksik alanlar var.');
      return;
    }
    const dateIso = normalizeTrDateValue(date);
    if (masrafAmounts.gross <= 0 || !dateIso) return;

    const descParts: string[] = [];
    if (description.trim()) descParts.push(toTitleCaseTR(description.trim()));
    const hasDoc = Boolean(documentType || documentNo.trim());

    setSaving(true);
    try {
      const payload = {
        fileCaseId: claimFileId,
        partyAccountId,
        expensePlan: allowExtraWorkPlan ? expensePlan : PLAN_BUTCE,
        expenseCategoryId: expenseCategoryId || expenseCategoryParentId,
        operationSubject: 'HASAR_ONARIM',
        description: descParts.length ? descParts.join(' · ') : undefined,
        amount: masrafAmounts.gross,
        vatRate: masrafAmounts.rate,
        vatIncluded: true,
        hasTaxDocument: hasDoc,
        receiptDocumentType: documentType || null,
        receiptDocumentNo: documentNo.trim() || null,
        receiptDocumentOwner: documentOwner.trim()
          ? toTitleCaseTR(documentOwner.trim())
          : null,
        date: dateIso,
        receiptImageUrl: receiptImageUrl || undefined,
        ...(opts?.documentConflictOverrideReason
          ? { documentConflictOverrideReason: opts.documentConflictOverrideReason }
          : {}),
      };

      if (!opts?.documentConflictOverrideReason && hasDoc && documentNo.trim()) {
        try {
          const pre = await axios.post(
            `${API}/expenses/document-review`,
            {
              hasTaxDocument: true,
              receiptDocumentNo: documentNo.trim(),
              partyAccountId,
              fileCaseId: claimFileId,
              operationSubject: 'HASAR_ONARIM',
            },
            { headers: authHeader() },
          );
          const body = pre.data?.data ?? pre.data;
          if (body?.needsReview && body?.review) {
            setDocReview(body.review);
            setPendingSaveMode(mode);
            setFormError('');
            return;
          }
        } catch {
          /* 409 yedeği */
        }
      }

      const created = await axios.post(
        `${API}/expenses`,
        payload,
        { headers: authHeader() },
      );
      setDocReview(null);
      setPendingSaveMode(null);
      const createdId = created.data?.id ?? created.data?.data?.id;
      if (createdId) {
        setLastSavedOpNo(financeOperationNo('MSF', createdId, created.data?.createdAt ?? created.data?.data?.createdAt ?? dateIso));
      }
      pushFinansVerimlilikAnalizUyari({
        kind: 'dosya',
        label: fileLabel || eligibility?.fileNo || 'Dosya',
      });
      if (description.trim()) {
        setAciklamaHatirla(rememberMasrafAciklama(description));
      }
      if (documentOwner.trim()) {
        setBelgeSahibiHatirla(rememberMasrafBelgeSahibi(documentOwner));
      }
      onSaved?.();
      if (mode === 'new') {
        setDescription('');
        setDocumentType('');
        setDocumentOwner('');
        setDocumentNo('');
        setAmount('');
        setVatRate('');
        setDate(new Date().toISOString().slice(0, 10));
        setReceiptImageUrl('');
        resetReceiptScan();
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const review = parseExpenseDocumentReviewFromError(err);
      if (review) {
        setDocReview(review);
        setPendingSaveMode(mode);
        setFormError('');
        return;
      }
      const raw = axios.isAxiosError(err) ? err.response?.data?.message : null;
      const msg =
        typeof raw === 'string'
          ? raw
          : 'Kayıt başarısız';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

  const formBody = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="claim-file-expense-form">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 sm:px-4">
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700" role="alert">
            {formError}
          </div>
        )}
        {metaError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700" role="alert">
            {metaError}
          </div>
        )}

        <FileDropZone
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
          disabled={scanning}
          clickToOpen={false}
          onFiles={(files) => {
            const file = files.find((f) => f.type.startsWith('image/'));
            if (file) void handleReceiptScan(file);
          }}
          className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-3 py-2.5 transition-colors"
          activeClassName="border-brand-400 bg-brand-50"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">Fiş / Fatura Okuma</p>
              <p className="text-[11px] text-slate-500">Kamera veya dosya — tutar ve tarih otomatik dolar</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                className="inline-flex items-center text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-semibold"
              >
                {scanning ? 'Okunuyor…' : 'Kamerayla Tara'}
              </button>
              <button
                type="button"
                disabled={scanning}
                onClick={() => receiptFileInputRef.current?.click()}
                className="text-xs border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 font-medium"
              >
                Dosyadan Seç
              </button>
            </div>
          </div>
          {scanInfo && (
            <p className="mt-2 text-[11px] text-slate-600 bg-white/80 rounded-md px-2 py-1.5">{scanInfo}</p>
          )}
          {(receiptPreview || receiptImageUrl) && (
            <div className="mt-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptPreview ?? receiptImageUrl}
                alt="Yüklenen fiş"
                className="h-14 w-auto rounded-md border border-slate-200 object-cover"
              />
              <p className="text-[11px] text-slate-500">Görsel kaydedildi — alanları kontrol edin.</p>
            </div>
          )}
        </FileDropZone>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[11px] text-slate-500 shrink-0">Dosya</span>
          <span className="text-sm font-medium text-slate-800 truncate">
            {fileLabel || eligibility?.fileNo || 'Bu Dosya'}
          </span>
        </div>

        {lastSavedOpNo ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" data-testid="claim-file-islem-no">
            <span className="text-[11px] text-slate-500 shrink-0">İşlem No</span>
            <span className="text-sm font-mono font-medium text-slate-800">
              {lastSavedOpNo}
            </span>
          </div>
        ) : null}

        {budgetHint && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-[10px] text-slate-500">Plan</p>
                <p className="font-semibold text-slate-800">
                  {fmt(expensePlan === PLAN_EK ? budgetHint.ekBudgetLimit : budgetHint.budgetLimit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Harcanan</p>
                <p className="font-semibold text-brand-700">
                  {fmt(expensePlan === PLAN_EK ? budgetHint.spentEk : budgetHint.spentButce)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Kalan</p>
                <p className="font-semibold text-status-success">
                  {fmt(expensePlan === PLAN_EK ? budgetHint.remainingEk : budgetHint.remainingButce)}
                </p>
              </div>
            </div>
          </div>
        )}

        {allowExtraWorkPlan ? (
          <div>
            <label className={labelCls} htmlFor="claim-file-expense-plan">
              Masraf yeri {requiredHint}
            </label>
            <select
              id="claim-file-expense-plan"
              value={expensePlan}
              onChange={(e) => setExpensePlan(e.target.value)}
              className={inputCls}
              data-testid="claim-file-expense-plan"
            >
              <option value={PLAN_BUTCE}>Bütçelenen</option>
              <option value={PLAN_EK}>Ek İş</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] text-slate-500 shrink-0">Masraf yeri</span>
            <span className="text-sm font-medium text-slate-800">Bütçelenen</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} htmlFor="claim-file-belge-turu">
              Belge Türü
            </label>
            <select
              id="claim-file-belge-turu"
              className={inputCls}
              value={documentType}
              onChange={(e) =>
                setDocumentType(e.target.value as '' | 'Kasa Fişi' | 'Fatura')
              }
              data-testid="claim-file-belge-turu"
            >
              <option value="">Seçiniz...</option>
              <option value="Kasa Fişi">Kasa Fişi</option>
              <option value="Fatura">Fatura</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="claim-file-belge-sahibi">
              Belge Sahibi
            </label>
            <input
              id="claim-file-belge-sahibi"
              className={inputCls}
              list="claim-file-belge-sahibi-hatirla"
              placeholder="Örn. manav"
              value={documentOwner}
              onChange={(e) => setDocumentOwner(e.target.value)}
              onBlur={() => {
                const v = documentOwner.trim();
                if (!v) return;
                const next = toTitleCaseTR(v);
                if (next !== documentOwner) setDocumentOwner(next);
              }}
              data-testid="claim-file-belge-sahibi"
              autoComplete="off"
            />
            <datalist id="claim-file-belge-sahibi-hatirla">
              {belgeSahibiHatirla.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <MasrafHatirlaChips
              items={belgeSahibiHatirla}
              testId="claim-file-belge-sahibi-hatirla-liste"
              onPick={setDocumentOwner}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <label className="mb-0 text-xs font-medium text-slate-600">
              Tarih {requiredHint}
            </label>
            {(() => {
              const dateIso = normalizeTrDateValue(date);
              if (!isCompleteTrDateValue(dateIso)) return null;
              const durum = resolveFinansIslemTarihiDonemDurum(dateIso);
              if (durum.kind === 'ok') return null;
              return (
                <FinansTarihDonemUyariIkon
                  message={durum.message}
                  closed={durum.kind === 'closed'}
                  testId="claim-file-tarih-donem-uyari"
                />
              );
            })()}
          </div>
          <TrDateInput className={inputCls} value={date} onChange={setDate} />
        </div>

        <div>
          <label className={labelCls} htmlFor="claim-file-fis-no">
            Fiş No
          </label>
          <input
            id="claim-file-fis-no"
            className={inputCls}
            placeholder="Örn. 1425"
            value={documentNo}
            onChange={(e) => setDocumentNo(e.target.value)}
            data-testid="claim-file-fis-no"
          />
        </div>

        <div data-testid="claim-file-masraf-kalem">
          <label className={labelCls}>
            Masraf Kalemi {requiredHint}
          </label>
          {metaLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Masraf kalemleri yükleniyor…
            </div>
          ) : categoryTree.length === 0 && !metaError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-2">
              Masraf kalemi yok. Satırdan ekleyebilir veya{' '}
              <a href="/panel/ayarlar/masraf-kategorileri" className="font-semibold underline">
                Ayarlar → Masraf Kategorileri
              </a>
              {' '}sayfasını kullanabilirsiniz.
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Masraf Grubu</label>
              <SearchableSelect
                options={groupOptions}
                value={expenseCategoryParentId}
                onChange={(id) => {
                  setExpenseCategoryParentId(id);
                  setExpenseCategoryId('');
                }}
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
              <label className="block text-[11px] text-slate-500 mb-1">Masraf Alt Grubu</label>
              <SearchableSelect
                options={subgroupOptions}
                value={expenseCategoryId}
                onChange={(subId) => {
                  const global = allSubgroups.find((s) => s.id === subId);
                  if (global) {
                    setExpenseCategoryParentId(global.parentId);
                    setExpenseCategoryId(subId);
                    return;
                  }
                  setExpenseCategoryId(subId);
                }}
                placeholder={
                  expenseCategoryParentId
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
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-[11px] text-slate-500 mb-1">
                {categoryDraft === 'group' ? 'Yeni Masraf Grubu' : 'Yeni Alt Grup'}
              </label>
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
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Aynı ad Ayarlar → Masraf Kategorileri listesinde de durur.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div data-testid="claim-file-masraf-cari">
          <label className={labelCls}>
            Ödeme Kaynağı (Cari) {requiredHint}
          </label>
          <div className="flex flex-wrap gap-2">
            <SearchableSelect
              className="min-w-0 flex-1"
              inputClassName={inputCls}
              options={partyAccounts.map((row) => ({
                value: row.id,
                label: `${row.name} · ${row.kindLabel}`,
              }))}
              value={partyAccountId}
              onChange={(id) => { void handleOdemeKaynakChange(id); }}
              disabled={odemeKaynakEnsuring}
              placeholder="Kredi kartı veya tedarikçi ara..."
              emptyText="Tedarikçi veya cari bulunamadı — Tedarikçiler’den kart açın"
              loading={odemeKaynakEnsuring}
              loadingText="Tedarikçi carisi açılıyor…"
            />
            <button
              type="button"
              onClick={() => setShowCariCreate(true)}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              data-testid="claim-file-yeni-cari"
            >
              + Yeni Cari
            </button>
            <button
              type="button"
              onClick={() => setShowVendorQuickCreate(true)}
              className="shrink-0 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100"
              data-testid="dosya-masraf-yeni-tedarikci"
            >
              + Yeni Tedarikçi
            </button>
          </div>
          {selectedParty ? (
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
              data-testid="claim-file-masraf-cari-kart"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{selectedParty.name}</p>
                <p className="text-xs text-slate-500">
                  {selectedParty.kindLabel}
                  {selectedParty.cardLast4 ? ` · ****${selectedParty.cardLast4}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCariOzetId((cur) => (cur === selectedParty.id ? null : selectedParty.id))
                  }
                  className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
                  data-testid="claim-file-cari-ozet-ac"
                >
                  {cariOzetId === selectedParty.id ? 'Cari Özeti Gizle' : 'Cari Kartı Aç'}
                </button>
              </div>
            </div>
          ) : null}
          <CariHesapOzetModal
            open={Boolean(cariOzetId)}
            accountId={cariOzetId}
            onClose={() => setCariOzetId(null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>
              KDV Dahil Toplam {requiredHint}
            </label>
            <TrAmountInput className={inputCls} placeholder="0" value={amount} onChange={setAmount} />
          </div>
          <div>
            <label className={labelCls}>KDV Oranı (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputCls}
              placeholder="Boş = KDV yok"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Matrah (Otomatik)</label>
          <input
            type="text"
            readOnly
            className={`${inputCls} bg-slate-50 font-semibold text-slate-800`}
            value={fmt(masrafAmounts.matrah)}
          />
          <p className="mt-1 text-[10px] text-slate-500">
            KDV oranı boşsa matrah = KDV dahil toplam
          </p>
        </div>

        <div>
          <label className={labelCls}>Açıklama {requiredHint}</label>
          <input
            className={inputCls}
            list="claim-file-masraf-aciklama-hatirla"
            placeholder={ACIKLAMA_YARDIM.masraf}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => {
              const v = normalizeMasrafAciklamaForSave(e.target.value);
              if (v) setDescription(v);
            }}
            data-testid="claim-file-masraf-aciklama"
            autoComplete="off"
          />
          <datalist id="claim-file-masraf-aciklama-hatirla">
            {aciklamaHatirla.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <MasrafHatirlaChips
            items={aciklamaHatirla}
            testId="claim-file-masraf-aciklama-hatirla-liste"
            onPick={setDescription}
          />
        </div>

        {!formCanSave && formSaveBlockers.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Kaydetmek için eksikler:</p>
            <ul className="space-y-0.5">
              {formSaveBlockers.map((b) => (
                <li key={b} className="text-[11px] text-slate-500 flex items-start gap-1">
                  <span className="text-status-danger">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 pb-8 pt-3.5 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 px-3 py-1.5 border border-slate-300 rounded-xl hover:bg-slate-50 font-semibold"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => { void handleSave('close'); }}
          disabled={saving || !formCanSave}
          className="text-xs text-slate-600 px-3 py-1.5 border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 font-semibold"
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={() => { void handleSave('new'); }}
          disabled={saving || !formCanSave}
          className="text-xs bg-brand-600 text-white px-4 py-1.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 font-semibold"
          data-testid="claim-file-expense-kaydet"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet ve Yeni'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {embedded ? (
        open ? formBody : null
      ) : (
        <SlidePanel open={open} onClose={onClose} title="Yeni Masraf Ekle" width={520} scrollContent={false}>
          {formBody}
        </SlidePanel>
      )}

      <ReceiptCameraModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file) => void handleReceiptScan(file)}
      />

      <CariHesapCreateModal
        open={showCariCreate}
        onClose={() => setShowCariCreate(false)}
        onCreated={(account) => {
          void loadPartyAccounts().then(() => {
            setPartyAccountId(account.id);
            setFormError('');
          });
        }}
      />

      <VendorQuickCreateModal
        open={showVendorQuickCreate}
        onClose={() => setShowVendorQuickCreate(false)}
        onCreated={(partyAccountIdNext) => {
          void loadPartyAccounts().then(() => {
            setPartyAccountId(partyAccountIdNext);
            setFormError('');
          });
        }}
      />

      <ExpenseDocumentReviewModal
        open={Boolean(docReview)}
        review={docReview}
        saving={saving}
        onCancel={() => {
          setDocReview(null);
          setPendingSaveMode(null);
        }}
        onEditDocumentNo={() => {
          setDocReview(null);
          setPendingSaveMode(null);
          setFormError('');
          window.requestAnimationFrame(() => {
            const el = document.getElementById('claim-file-fis-no');
            if (el instanceof HTMLInputElement) {
              el.focus();
              el.select();
            }
          });
        }}
        onOpenExisting={() => {
          setDocReview(null);
          setPendingSaveMode(null);
          onClose();
          router.push('/panel/finans/masraflar');
        }}
        onContinueWithReason={(reason) => {
          const mode = pendingSaveMode ?? 'close';
          void handleSave(mode, { documentConflictOverrideReason: reason });
        }}
      />
    </>
  );
}
