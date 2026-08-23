'use client';

/**
 * Dosya Finans sekmesi — Finans → Masraf İzleme ile aynı masraf ekleme yöntemi.
 * Dosya kilitli; kayıt /expenses API’sine gider.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SlidePanel } from '@/components/SlidePanel';
import { ReceiptCameraModal, prefersNativeCameraCapture } from '@/components/ReceiptCameraModal';
import { API, authHeader } from '@/utils/api';
import { normalizeTrDateValue, isCompleteTrDateValue } from '@/utils/tr-date-input';
import { parseTrAmountInput, numberToTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import { financeOperationNo } from '@sigorta/shared';

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
  /** Dosya özelinde ekstra iş masrafı yok; yalnız Finans merkezinde açılır */
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
  const [expensePlan, setExpensePlan] = useState(PLAN_BUTCE);
  const [lastSavedOpNo, setLastSavedOpNo] = useState<string | null>(null);
  const [expenseCategoryParentId, setExpenseCategoryParentId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [description, setDescription] = useState('');
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
    setDescription('');
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

  useEffect(() => {
    if (!open) return;
    resetForm();
    let cancelled = false;
    setMetaLoading(true);
    setMetaError('');
    (async () => {
      try {
        const [treeRes, flatRes, trackRes] = await Promise.all([
          axios.get(`${API}/expense-categories`, { headers: authHeader() }),
          axios.get(`${API}/expense-categories/flat`, { headers: authHeader() }),
          axios.get(`${API}/expenses/budget-tracking`, {
            headers: authHeader(),
            params: { fileCaseId: claimFileId },
          }),
        ]);
        if (cancelled) return;
        setCategoryTree((treeRes.data?.data ?? []) as CategoryGroup[]);
        setCategoryFlat((flatRes.data?.data ?? []) as CategoryFlat[]);
        // Finans Masraf İzleme ile aynı şekil: { files, summary }
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
  }, [open, claimFileId, resetForm]);

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

  const masrafAmounts = useMemo(() => {
    const gross = parseTrAmountInput(amount) ?? 0;
    const rateRaw = String(vatRate ?? '').trim();
    const rate = rateRaw === '' ? 0 : (parseFloat(rateRaw) || 0);
    const matrah = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
    const vatAmount = Math.round((gross - matrah) * 100) / 100;
    return { gross, rate, matrah, vatAmount };
  }, [amount, vatRate]);

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
    if (!expenseCategoryParentId) blockers.push('Masraf grubu seçin');
    if (needsSubgroup && !expenseCategoryId) blockers.push('Masraf alt grubu seçin');
    if (masrafAmounts.gross <= 0) blockers.push('Geçerli tutar girin');
    if (!isCompleteTrDateValue(normalizeTrDateValue(date))) blockers.push('Geçerli tarih girin (GG.AA.YYYY)');
    return blockers;
  }, [
    expensePlan,
    planEligible,
    expenseCategoryParentId,
    needsSubgroup,
    expenseCategoryId,
    masrafAmounts.gross,
    date,
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

  const handleSave = async (mode: 'close' | 'new') => {
    setFormError('');
    if (!formCanSave) {
      setFormError(formSaveBlockers[0] ?? 'Eksik alanlar var.');
      return;
    }
    const dateIso = normalizeTrDateValue(date);
    if (masrafAmounts.gross <= 0 || !dateIso) return;

    const descParts: string[] = [];
    if (documentNo.trim()) descParts.push(`Belge No: ${documentNo.trim()}`);
    if (description.trim()) descParts.push(toTitleCaseTR(description.trim()));

    setSaving(true);
    try {
      const created = await axios.post(
        `${API}/expenses`,
        {
          fileCaseId: claimFileId,
          expensePlan: allowExtraWorkPlan ? expensePlan : PLAN_BUTCE,
          expenseCategoryId: expenseCategoryId || expenseCategoryParentId,
          operationSubject: 'HASAR_ONARIM',
          description: descParts.length ? descParts.join(' · ') : undefined,
          amount: masrafAmounts.gross,
          vatRate: masrafAmounts.rate,
          vatIncluded: true,
          date: dateIso,
          receiptImageUrl: receiptImageUrl || undefined,
        },
        { headers: authHeader() },
      );
      const createdId = created.data?.id ?? created.data?.data?.id;
      if (createdId) {
        setLastSavedOpNo(financeOperationNo('MSF', createdId, created.data?.createdAt ?? created.data?.data?.createdAt ?? dateIso));
      }
      onSaved?.();
      if (mode === 'new') {
        setDescription('');
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
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'Kayıt başarısız') : 'Kayıt başarısız';
      setFormError(String(msg));
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

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[11px] text-slate-500 shrink-0">İşlem No</span>
          <span className="text-sm font-mono font-medium text-slate-800">
            {lastSavedOpNo ?? 'Kayıt Sonrası Oluşur'}
          </span>
        </div>

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
            <label className={labelCls}>
              Bütçe Tipi <span className="text-status-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: PLAN_BUTCE, label: 'Dosya Bütçesi', activeCls: 'border-brand-600 bg-brand-50' },
                { value: PLAN_EK, label: 'Ek İşler', activeCls: 'border-status-warning bg-amber-50' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpensePlan(opt.value)}
                  className={`text-left rounded-lg border-2 px-3 py-2 transition-all ${
                    expensePlan === opt.value ? opt.activeCls : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className={`font-semibold text-xs ${expensePlan === opt.value ? 'text-slate-900' : 'text-slate-600'}`}>
                    {opt.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] text-slate-500 shrink-0">Bütçe Tipi</span>
            <span className="text-sm font-medium text-slate-800">Dosya Bütçesi</span>
          </div>
        )}

        <div>
          <label className={labelCls}>
            Tarih <span className="text-status-danger">*</span>
          </label>
          <TrDateInput className={inputCls} value={date} onChange={setDate} />
        </div>

        <div>
          <label className={labelCls}>
            Masraf Grubu / Alt Grubu <span className="text-status-danger">*</span>
          </label>
          {metaLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Masraf grupları yükleniyor…
            </div>
          ) : categoryTree.length === 0 && !metaError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-2">
              Masraf grubu yok. Arama satırına yazıp listeden ekleyebilir veya{' '}
              <a href="/panel/ayarlar/masraf-kategorileri" className="font-semibold underline">
                Ayarlar → Masraf Kategorileri
              </a>
              {' '}sayfasını kullanabilirsiniz.
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            />
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
                !expenseCategoryParentId
                  ? 'Önce grup seçin…'
                  : loadingChildren
                    ? 'Yükleniyor...'
                    : 'Alt grup ara...'
              }
              emptyText="Alt grup bulunamadı"
              disabled={loadingChildren || !expenseCategoryParentId}
              inputClassName={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Belge No</label>
          <input
            className={inputCls}
            placeholder="Fiş / Fatura no"
            value={documentNo}
            onChange={(e) => setDocumentNo(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>
              KDV Dahil Toplam <span className="text-status-danger">*</span>
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
          <label className={labelCls}>Açıklama</label>
          <input
            className={inputCls}
            placeholder="Masraf açıklaması"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v) setDescription(v);
            }}
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

      <div className="shrink-0 flex items-center justify-end gap-1.5 border-t border-slate-100 bg-white px-3 py-2 sm:px-4">
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
    </>
  );
}
