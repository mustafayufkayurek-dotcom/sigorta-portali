'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getCase, updateCase, updateCaseStatus, addCostEntry, getCostEntries, deleteCostEntry, updateCostEntry,
  getEmergencyVendors, createVendorQuick, getRecommendedVendors,
  EmergencyCase, EmergencyCostEntry, EmergencyStatus, VendorOption, VendorRecommendation,
} from '@/utils/emergencyApi';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import { InboundEmailCorrespondencePanel } from '@/components/operation-inbox/InboundEmailCorrespondencePanel';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { DelegationBanner } from '@/components/delegation/DelegationBanner';
import {
  isHistoricalEmergencyFile,
  readHistoricalFinanceOptIn,
  writeHistoricalFinanceOptIn,
} from './historical-file';

const STATUS_STEPS: EmergencyStatus[] = ['GELEN', 'ATANDI', 'SAHADA', 'COZULDU', 'FATURALANDILDI'];
const PROCESS_STRIP_LABELS: Record<EmergencyStatus, string> = {
  GELEN: 'İhbar',
  ATANDI: 'Tedarikçi Atandı',
  SAHADA: 'Sahada',
  COZULDU: 'Dosya Kapandı',
  FATURALANDILDI: 'Finansa Aktarıldı',
};

const CURRENT_TASK_TITLES: Record<string, string> = {
  ihbar: 'Dosya Açıldı',
  atama: 'Tedarikçi Ataması Bekleniyor',
  maliyet: 'Tedarikçi Maliyeti Bekleniyor',
  onay: 'Asistans Onayı Bekleniyor',
  saha: 'İşe Başlama Bekleniyor',
  kapanis: 'Dosya Kapanışı Bekleniyor',
  finans: 'Finansa Aktarım Bekleniyor',
  hakedis: 'Hakediş Bekleniyor',
  odeme: 'Ödeme Bekleniyor',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
  draft: 'Taslak',
};

type BottomTab = 'gecmis' | 'finans' | null;
type ApprovalChannel = 'whatsapp' | 'email' | 'both';

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL.';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function deriveCurrentTask(
  vaka: EmergencyCase,
  opts?: { historicalExempt?: boolean },
): { title: string; detail?: string } {
  if (opts?.historicalExempt) {
    return {
      title: 'Tarihsel Dosya',
      detail: 'Yeni finans akışı, hakediş ve cari zorunlu değildir.',
    };
  }
  const chain = vaka.operationChain;
  if (chain) {
    const current =
      chain.steps.find((s) => s.state === 'current')
      ?? chain.steps.find((s) => s.state === 'blocked');
    if (current) {
      return {
        title: CURRENT_TASK_TITLES[current.key] ?? `${current.label} Bekleniyor`,
        detail: current.note,
      };
    }
    return { title: chain.currentStageLabel };
  }
  const fallback: Record<EmergencyStatus, string> = {
    GELEN: 'Tedarikçi Ataması Bekleniyor',
    ATANDI: 'Tedarikçi Maliyeti Bekleniyor',
    SAHADA: 'Dosya Kapanışı Bekleniyor',
    COZULDU: 'Finansa Aktarım Bekleniyor',
    FATURALANDILDI: 'Finans Tamamlandı',
  };
  return { title: fallback[vaka.status] };
}

function customerLabel(vaka: EmergencyCase): string {
  const c = vaka.customer;
  if (!c) return vaka.customerName;
  return (
    c.companyName
    || c.fullName
    || [c.firstName, c.lastName].filter(Boolean).join(' ')
    || vaka.customerName
  );
}

// ─── Inline Vendor Selector (Finans sekmesi) ─────────────────────────────────

interface VendorSelectorProps {
  value: VendorOption | null;
  onChange: (v: VendorOption | null) => void;
}

function VendorSelector({ value, onChange }: VendorSelectorProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<VendorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', identityNo: '', address: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOptions = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getEmergencyVendors(q || undefined);
      setOptions(res.data);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchOptions(search);
  }, [open, search, fetchOptions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleAddVendor(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!addForm.name.trim()) { setAddError('Bu alan zorunludur'); return; }
    if (!addForm.phone.trim()) { setAddError('Bu alan zorunludur'); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await createVendorQuick({
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        identityNo: addForm.identityNo.trim() || undefined,
        address: addForm.address.trim() || undefined,
        type: 'hizmet',
        category: 'acil',
      });
      onChange(res.data);
      setOpen(false);
      setShowAddForm(false);
      setSearch('');
      setAddForm({ name: '', phone: '', identityNo: '', address: '' });
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowAddForm(false); }}
        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {value ? value.name : 'Tedarikçi Seçin (Opsiyonel)'}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-slate-400 hover:text-red-500 text-xs ml-2 cursor-pointer"
          >
            ✕
          </span>
        ) : (
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {showAddForm ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Yeni Tedarikçi Ekle</p>
              {addError && <p className="text-xs text-red-600">{addError}</p>}
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ad *"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
              <input
                type="tel"
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Telefon *"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleAddVendor} disabled={addLoading} className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {addLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg">
                  Geri
                </button>
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="py-4 text-center text-xs text-slate-400">Yükleniyor...</div>
              ) : options.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400">Sonuç bulunamadı</div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{opt.name}</span>
                    {opt.phone && <span className="text-xs text-slate-400 ml-2">{opt.phone}</span>}
                  </button>
                ))
              )}
              <div className="border-t border-slate-100 p-2">
                <button type="button" onClick={() => setShowAddForm(true)} className="w-full text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1.5">
                  Yeni Tedarikçi Ekle
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_COST_FORM = { description: '', amount: '', entryDate: new Date().toISOString().slice(0, 10) };

export default function AcilDosyaDetayPage() {
  const params = useParams();
  const id = params?.id as string;

  const [vaka, setVaka] = useState<EmergencyCase | null>(null);
  const [costs, setCosts] = useState<EmergencyCostEntry[]>([]);
  const [costSummary, setCostSummary] = useState({ totalGelir: 0, totalGider: 0, netKar: 0 });
  const [loading, setLoading] = useState(true);

  const [vendorRecs, setVendorRecs] = useState<VendorRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  const [alisFiyati, setAlisFiyati] = useState('');
  const [satisFiyati, setSatisFiyati] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalChannel, setApprovalChannel] = useState<ApprovalChannel>('whatsapp');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);

  const [bottomTab, setBottomTab] = useState<BottomTab>(null);

  const [showGelirForm, setShowGelirForm] = useState(false);
  const [gelirForm, setGelirForm] = useState(EMPTY_COST_FORM);
  const [gelirLoading, setGelirLoading] = useState(false);
  const [gelirError, setGelirError] = useState<string | null>(null);

  const [showGiderForm, setShowGiderForm] = useState(false);
  const [giderForm, setGiderForm] = useState(EMPTY_COST_FORM);
  const [giderVendor, setGiderVendor] = useState<VendorOption | null>(null);
  const [giderLoading, setGiderLoading] = useState(false);
  const [giderError, setGiderError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', entryDate: '' });
  const [editVendor, setEditVendor] = useState<VendorOption | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /** Tarihsel dosyayı yeni finans dönemine manuel dahil et (localStorage; migration yok). */
  const [financeOptIn, setFinanceOptIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseRes, costRes] = await Promise.all([getCase(id), getCostEntries(id)]);
      setVaka(caseRes.data);
      setCosts(costRes.data);
      setCostSummary(costRes.summary);
      const gelir = costRes.data.find((c) => c.entryType === 'gelir');
      const gider = costRes.data.find((c) => c.entryType === 'gider');
      if (gelir) setSatisFiyati((prev) => prev || String(gelir.amount));
      if (gider) setAlisFiyati((prev) => prev || String(gider.amount));
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    setFinanceOptIn(readHistoricalFinanceOptIn(id));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setRecsLoading(true);
    getRecommendedVendors(id, 3)
      .then((res) => setVendorRecs(res.data ?? []))
      .catch(() => setVendorRecs([]))
      .finally(() => setRecsLoading(false));
  }, [id]);

  async function refreshCosts() {
    const res = await getCostEntries(id);
    setCosts(res.data);
    setCostSummary(res.summary);
  }

  async function handleAssignVendor(vendorId: string) {
    setAssignLoading(true);
    try {
      const res = await updateCase(id, { assignedVendorId: vendorId } as Partial<EmergencyCase>);
      setVaka(res.data);
      if (res.data.status === 'GELEN') {
        const statusRes = await updateCaseStatus(id, 'ATANDI');
        setVaka(statusRes.data);
      } else {
        await load();
      }
    } catch {
      // sessiz
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleApprovalSubmit() {
    setApprovalBusy(true);
    setApprovalMsg(null);
    try {
      const alis = Number(alisFiyati);
      const satis = Number(satisFiyati);
      if (!alisFiyati || isNaN(alis) || alis <= 0) {
        setApprovalMsg('Tedarikçi alış fiyatı girin');
        return;
      }
      if (!satisFiyati || isNaN(satis) || satis <= 0) {
        setApprovalMsg('Meridyen satış fiyatı girin');
        return;
      }

      const hasGider = costs.some((c) => c.entryType === 'gider');
      const hasGelir = costs.some((c) => c.entryType === 'gelir');
      const today = new Date().toISOString().slice(0, 10);

      if (!hasGider) {
        await addCostEntry(id, {
          entryType: 'gider',
          description: 'Tedarikçi Alış Fiyatı',
          amount: alis,
          entryDate: today,
          vendorId: vaka?.assignedVendorId ?? undefined,
        });
      }
      if (!hasGelir) {
        await addCostEntry(id, {
          entryType: 'gelir',
          description: 'Meridyen Satış Fiyatı',
          amount: satis,
          entryDate: today,
        });
      }
      await refreshCosts();
      await load();

      const channelLabel =
        approvalChannel === 'whatsapp' ? 'WhatsApp'
        : approvalChannel === 'email' ? 'E-posta'
        : 'WhatsApp + E-posta';
      setApprovalMsg(`Onay talebi oluşturuldu (${channelLabel}). Gönderim bağlantısı sonraki adımda tamamlanacak.`);
      setShowApprovalModal(false);
    } catch (err: any) {
      setApprovalMsg(err.message ?? 'Onay talebi oluşturulamadı');
    } finally {
      setApprovalBusy(false);
    }
  }

  async function handleAddGelir(e: React.FormEvent) {
    e.preventDefault();
    if (!gelirForm.description.trim()) { setGelirError('Açıklama zorunludur'); return; }
    if (!gelirForm.amount || isNaN(Number(gelirForm.amount)) || Number(gelirForm.amount) <= 0) { setGelirError('Geçerli bir tutar girin'); return; }
    setGelirLoading(true);
    setGelirError(null);
    try {
      await addCostEntry(id, {
        entryType: 'gelir',
        description: gelirForm.description.trim(),
        amount: Number(gelirForm.amount),
        entryDate: gelirForm.entryDate,
      });
      setGelirForm(EMPTY_COST_FORM);
      setShowGelirForm(false);
      await refreshCosts();
    } catch (err: any) {
      setGelirError(err.message ?? 'Bir hata oluştu');
    } finally {
      setGelirLoading(false);
    }
  }

  async function handleAddGider(e: React.FormEvent) {
    e.preventDefault();
    if (!giderForm.description.trim()) { setGiderError('Açıklama zorunludur'); return; }
    if (!giderForm.amount || isNaN(Number(giderForm.amount)) || Number(giderForm.amount) <= 0) { setGiderError('Geçerli bir tutar girin'); return; }
    setGiderLoading(true);
    setGiderError(null);
    try {
      await addCostEntry(id, {
        entryType: 'gider',
        description: giderForm.description.trim(),
        amount: Number(giderForm.amount),
        entryDate: giderForm.entryDate,
        vendorId: giderVendor?.id,
      });
      setGiderForm(EMPTY_COST_FORM);
      setGiderVendor(null);
      setShowGiderForm(false);
      await refreshCosts();
    } catch (err: any) {
      setGiderError(err.message ?? 'Bir hata oluştu');
    } finally {
      setGiderLoading(false);
    }
  }

  async function handleDeleteCost(costId: string) {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
    try {
      await deleteCostEntry(id, costId);
      await refreshCosts();
    } catch { /* sessiz */ }
  }

  function handleStartEdit(c: EmergencyCostEntry) {
    setEditingId(c.id);
    setEditForm({
      description: c.description,
      amount: String(c.amount),
      entryDate: c.entryDate.slice(0, 10),
    });
    setEditVendor(c.vendor ? { id: c.vendor.id, name: c.vendor.name } : null);
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent, c: EmergencyCostEntry) {
    e.preventDefault();
    if (!editForm.description.trim()) { setEditError('Açıklama zorunludur'); return; }
    if (!editForm.amount || isNaN(Number(editForm.amount)) || Number(editForm.amount) <= 0) { setEditError('Geçerli bir tutar girin'); return; }
    setEditLoading(true);
    setEditError(null);
    try {
      await updateCostEntry(id, c.id, {
        description: editForm.description.trim(),
        amount: Number(editForm.amount),
        entryDate: editForm.entryDate,
        vendorId: c.entryType === 'gider' ? (editVendor?.id ?? null) : undefined,
      });
      setEditingId(null);
      await refreshCosts();
    } catch (err: any) {
      setEditError(err.message ?? 'Bir hata oluştu');
    } finally {
      setEditLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!vaka) {
    return <div className="text-center py-20 text-slate-500">Dosya bulunamadı.</div>;
  }

  const isHistorical = isHistoricalEmergencyFile(vaka.createdAt, vaka.fileDate);
  const historicalExempt = isHistorical && !financeOptIn;
  const task = deriveCurrentTask(vaka, { historicalExempt });
  const currentIdx = STATUS_STEPS.indexOf(vaka.status);
  const googleQuery = [vaka.city, vaka.district, vaka.issueType, 'acil yardım'].filter(Boolean).join(' ');
  const showGoogleSearch = !recsLoading && vendorRecs.length === 0 && !vaka.assignedVendorId;
  const assigneeName = vaka.assignedUser
    ? `${vaka.assignedUser.firstName} ${vaka.assignedUser.lastName}`.trim()
    : '—';
  const karOrani = costSummary.totalGelir > 0
    ? ((costSummary.netKar / costSummary.totalGelir) * 100)
    : 0;

  function handleHistoricalFinanceOptIn() {
    writeHistoricalFinanceOptIn(id, true);
    setFinanceOptIn(true);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8" data-testid="acil-dosya-detay">
      {/* 1. Dosya Başlığı */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-start gap-3">
          <Link
            href="/panel/operasyon?filter=acil"
            className="mt-0.5 p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Geri"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                {vaka.fileNo || vaka.caseNo}
              </h1>
              {vaka.fileNo && vaka.caseNo !== vaka.fileNo && (
                <span className="text-xs text-slate-400 font-mono">{vaka.caseNo}</span>
              )}
              {isHistorical && (
                <span
                  data-testid="tarihsel-dosya-badge"
                  className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200"
                >
                  Tarihsel Dosya
                </span>
              )}
            </div>
            {isHistorical && historicalExempt && (
              <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="tarihsel-dosya-muafiyet">
                <p className="text-[11px] text-slate-500">
                  01.07.2026 öncesi dosya — yeni finans akışı zorunlu değil.
                </p>
                <button
                  type="button"
                  onClick={handleHistoricalFinanceOptIn}
                  className="text-[11px] font-medium text-blue-700 hover:text-blue-800 underline-offset-2 hover:underline"
                  data-testid="tarihsel-finans-optin"
                >
                  Tarihsel Dosyayı Yeni Finans Dönemine Dahil Et
                </button>
              </div>
            )}
            {isHistorical && financeOptIn && (
              <p className="mt-2 text-[11px] text-emerald-700" data-testid="tarihsel-finans-optin-active">
                Yeni finans dönemine dahil edildi.
              </p>
            )}
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Müşteri (Asistans)</dt>
                <dd className="font-medium text-slate-800 truncate">{customerLabel(vaka)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Sigortalı</dt>
                <dd className="font-medium text-slate-800 truncate">—</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Hizmet Türü</dt>
                <dd className="font-medium text-blue-700">{vaka.issueType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Dosya Sorumlusu</dt>
                <dd className="font-medium text-slate-800">{assigneeName}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">Adres</dt>
                <dd className="font-medium text-slate-800">
                  {vaka.address}{vaka.city ? `, ${vaka.city}` : ''}{vaka.district ? ` / ${vaka.district}` : ''}
                </dd>
              </div>
            </dl>
            {vaka.activeDelegation && (
              <div className="mt-2">
                <DelegationBanner delegation={vaka.activeDelegation} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Güncel İşlem — ANA ODAK */}
      <div
        className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm p-5"
        data-testid="guncel-islem"
      >
        <p className="text-[11px] font-semibold text-blue-600 tracking-wide">Güncel İşlem</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 leading-snug">{task.title}</h2>
        {task.detail && (
          <p className="mt-1.5 text-sm text-slate-600">{task.detail}</p>
        )}
        {vaka.assignedVendor && (
          <p className="mt-2 text-xs text-slate-500">
            Atanan Tedarikçi: <span className="font-semibold text-slate-700">{vaka.assignedVendor.name}</span>
          </p>
        )}
      </div>

      {/* 3. Tedarikçi Önerileri */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid="tedarikci-onerileri">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-800">Tedarikçi Önerileri</p>
          {vaka.assignedVendor && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Atandı
            </span>
          )}
        </div>
        {recsLoading ? (
          <p className="text-xs text-slate-400 py-3 text-center">Öneriler yükleniyor...</p>
        ) : vendorRecs.length > 0 ? (
          <ul className="space-y-2">
            {vendorRecs.slice(0, 3).map((v, idx) => (
              <li
                key={v.id}
                className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${
                  vaka.assignedVendorId === v.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{v.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {[
                      v.avgServiceScore != null ? `Kalite ${v.avgServiceScore}` : null,
                      v.avgCost != null ? `Maliyet ${Number(v.avgCost).toLocaleString('tr-TR')} ₺` : null,
                      v.avgResponseTime != null ? `Müdahale ${v.avgResponseTime} sa` : null,
                      vaka.city ? `Bölge ${vaka.city}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!vaka.assignedVendorId && (
                  <button
                    type="button"
                    disabled={assignLoading}
                    onClick={() => handleAssignVendor(v.id)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Ata
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 py-2">Uygun tedarikçi önerisi yok.</p>
        )}
        {showGoogleSearch && (
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Google&apos;da Ara
          </a>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Atama zorunlu değildir.</p>
      </div>

      {/* 4. Maliyet ve Onay */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3" data-testid="maliyet-onay">
        <p className="text-sm font-semibold text-slate-800">Maliyet Ve Onay</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Tedarikçi Alış Fiyatı
              <span className="ml-1 text-[10px] text-slate-400">(İç Kullanım)</span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={alisFiyati}
              onChange={(e) => setAlisFiyati(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Meridyen Satış Fiyatı
              <span className="ml-1 text-[10px] text-amber-600">(Dışarıya Gönderilir)</span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={satisFiyati}
              onChange={(e) => setSatisFiyati(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Satış fiyatı asistansa iletilir; alış fiyatı yalnızca Meridyen iç kullanımındadır.
        </p>
        {approvalMsg && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{approvalMsg}</p>
        )}
        <button
          type="button"
          onClick={() => { setShowApprovalModal(true); setApprovalMsg(null); }}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800"
        >
          Onay Talebi Oluştur
        </button>
      </div>

      {/* 5. WhatsApp / İletişim */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3" data-testid="whatsapp-iletisim">
        <div>
          <p className="text-sm font-semibold text-slate-800">WhatsApp</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Ana iletişim: yazışma, foto ve belge. Otomatik algı metni sonraki sürümde; tek dokunuş onay için hazır UI.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 max-h-64 overflow-auto">
          <InboundEmailCorrespondencePanel emergencyCaseId={vaka.id} />
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">Belgeler</p>
          <FileDocumentPanel
            entityType="emergency_case"
            entityId={vaka.id}
            documentKind="matbu_evrak"
          />
        </div>
      </div>

      {/* 6–7. Sekmeler: Dosya Geçmişi / Finans (ilk ekranda kapalı) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="alt-sekmeler">
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setBottomTab(bottomTab === 'gecmis' ? null : 'gecmis')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              bottomTab === 'gecmis' ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Dosya Geçmişi
          </button>
          <button
            type="button"
            onClick={() => setBottomTab(bottomTab === 'finans' ? null : 'finans')}
            className={`flex-1 py-3 text-sm font-semibold border-l border-slate-100 transition-colors ${
              bottomTab === 'finans' ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Finans
          </button>
        </div>

        {bottomTab === 'gecmis' && (
          <div className="p-4 space-y-3 text-sm">
            {vaka.operationChain ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-xs text-slate-400">Yazışma</p>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {vaka.operationChain.inbox.messageCount} yazışma · {vaka.operationChain.inbox.attachmentCount} ek
                    </p>
                    {vaka.operationChain.inbox.lastReceivedAt && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Son: {fmtDateTime(vaka.operationChain.inbox.lastReceivedAt)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-xs text-slate-400">Evrak</p>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {vaka.operationChain.documents.totalCount} evrak · {vaka.operationChain.documents.whatsappSentCount} WhatsApp
                    </p>
                  </div>
                </div>
                {vaka.notes && (
                  <div>
                    <p className="text-xs text-slate-400">Notlar</p>
                    <p className="text-slate-700 mt-0.5">{vaka.notes}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  Dosya tarihi: {fmtDate(vaka.fileDate ?? vaka.createdAt)} · Oluşturuldu: {fmtDate(vaka.createdAt)}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">Geçmiş özeti henüz yok.</p>
            )}
          </div>
        )}

        {bottomTab === 'finans' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-green-50 border border-green-100 px-2 py-2">
                <p className="text-[10px] text-green-600 font-medium">Gelir</p>
                <p className="text-xs font-bold text-green-700 mt-0.5">{fmtCurrency(costSummary.totalGelir)}</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 px-2 py-2">
                <p className="text-[10px] text-red-600 font-medium">Gider</p>
                <p className="text-xs font-bold text-red-700 mt-0.5">{fmtCurrency(costSummary.totalGider)}</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-2 py-2">
                <p className="text-[10px] text-blue-600 font-medium">Net Kâr</p>
                <p className="text-xs font-bold text-blue-700 mt-0.5">{fmtCurrency(costSummary.netKar)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2">
                <p className="text-[10px] text-slate-500 font-medium">Kâr Oranı</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">%{karOrani.toFixed(1)}</p>
              </div>
            </div>

            {vaka.operationChain && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                {historicalExempt ? (
                  <p data-testid="tarihsel-finans-muaf">
                    Hakediş: Zorunlu Değil · Ödeme / Cari: Zorunlu Değil
                  </p>
                ) : (
                  <p>
                    Hakediş: {vaka.operationChain.vendorStatementReady ? 'Şema Bloklu' : 'Beklemede'}
                    {' · '}
                    Ödeme / Cari: {vaka.operationChain.paymentReady ? 'Şema Bloklu' : 'Beklemede'}
                  </p>
                )}
                <p>
                  Fatura talebi: {vaka.operationChain.finance.invoiceRequestCount}
                  {' · '}
                  Taslak: {vaka.operationChain.finance.invoiceDraftCount}
                  {(vaka.operationChain.finance.latestInvoiceRequestStatus || vaka.operationChain.finance.latestInvoiceDraftStatus) && (
                    <> · Son: {INVOICE_STATUS_LABELS[vaka.operationChain.finance.latestInvoiceRequestStatus ?? '']
                      ?? vaka.operationChain.finance.latestInvoiceRequestStatus
                      ?? INVOICE_STATUS_LABELS[vaka.operationChain.finance.latestInvoiceDraftStatus ?? '']
                      ?? vaka.operationChain.finance.latestInvoiceDraftStatus}</>
                  )}
                </p>
                <p className="text-slate-400">KDV özeti: sonraki sürümde.</p>
              </div>
            )}

            {/* Gelir / Gider — finans sekmesinde */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-green-700">Gelir</span>
                  <button
                    type="button"
                    onClick={() => { setShowGelirForm((v) => !v); setShowGiderForm(false); }}
                    className="text-xs font-medium text-green-600"
                  >
                    {showGelirForm ? 'Kapat' : 'Ekle'}
                  </button>
                </div>
                {showGelirForm && (
                  <form onSubmit={handleAddGelir} className="px-3 py-2 bg-green-50 space-y-1.5 border-b border-green-100">
                    {gelirError && <p className="text-xs text-red-600">{gelirError}</p>}
                    <input type="text" value={gelirForm.description} onChange={(e) => setGelirForm((f) => ({ ...f, description: e.target.value }))} placeholder="Açıklama" className="w-full px-2 py-1.5 text-xs border rounded-lg" />
                    <div className="flex gap-1.5">
                      <input type="number" step="0.01" value={gelirForm.amount} onChange={(e) => setGelirForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Tutar" className="flex-1 px-2 py-1.5 text-xs border rounded-lg" />
                      <TrDateInput value={gelirForm.entryDate} onChange={(entryDate) => setGelirForm((f) => ({ ...f, entryDate }))} className="flex-1 px-2 py-1.5 text-xs border rounded-lg" />
                    </div>
                    <button type="submit" disabled={gelirLoading} className="w-full py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                      {gelirLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </form>
                )}
                {costs.filter((c) => c.entryType === 'gelir').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz gelir yok</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {costs.filter((c) => c.entryType === 'gelir').map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        {editingId === c.id ? (
                          <form onSubmit={(e) => handleSaveEdit(e, c)} className="w-full space-y-1.5">
                            {editError && <p className="text-xs text-red-600">{editError}</p>}
                            <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded" />
                            <div className="flex gap-1">
                              <button type="submit" disabled={editLoading} className="flex-1 py-1 bg-blue-600 text-white text-[10px] rounded">Kaydet</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] border rounded">İptal</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{c.description}</p>
                              <p className="text-[10px] text-slate-400">{fmtDate(c.entryDate)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-bold text-green-600">+{fmtCurrency(c.amount)}</span>
                              <button type="button" onClick={() => handleStartEdit(c)} className="text-[10px] text-slate-400 hover:text-blue-600">Düzenle</button>
                              <button type="button" onClick={() => handleDeleteCost(c.id)} className="text-[10px] text-slate-400 hover:text-red-600">Sil</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-red-700">Gider</span>
                  <button
                    type="button"
                    onClick={() => { setShowGiderForm((v) => !v); setShowGelirForm(false); }}
                    className="text-xs font-medium text-red-600"
                  >
                    {showGiderForm ? 'Kapat' : 'Ekle'}
                  </button>
                </div>
                {showGiderForm && (
                  <form onSubmit={handleAddGider} className="px-3 py-2 bg-red-50 space-y-1.5 border-b border-red-100">
                    {giderError && <p className="text-xs text-red-600">{giderError}</p>}
                    <input type="text" value={giderForm.description} onChange={(e) => setGiderForm((f) => ({ ...f, description: e.target.value }))} placeholder="Açıklama" className="w-full px-2 py-1.5 text-xs border rounded-lg" />
                    <div className="flex gap-1.5">
                      <input type="number" step="0.01" value={giderForm.amount} onChange={(e) => setGiderForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Tutar" className="flex-1 px-2 py-1.5 text-xs border rounded-lg" />
                      <TrDateInput value={giderForm.entryDate} onChange={(entryDate) => setGiderForm((f) => ({ ...f, entryDate }))} className="flex-1 px-2 py-1.5 text-xs border rounded-lg" />
                    </div>
                    <VendorSelector value={giderVendor} onChange={setGiderVendor} />
                    <button type="submit" disabled={giderLoading} className="w-full py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                      {giderLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </form>
                )}
                {costs.filter((c) => c.entryType === 'gider').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz gider yok</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {costs.filter((c) => c.entryType === 'gider').map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        {editingId === c.id ? (
                          <form onSubmit={(e) => handleSaveEdit(e, c)} className="w-full space-y-1.5">
                            {editError && <p className="text-xs text-red-600">{editError}</p>}
                            <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded" />
                            <VendorSelector value={editVendor} onChange={setEditVendor} />
                            <div className="flex gap-1">
                              <button type="submit" disabled={editLoading} className="flex-1 py-1 bg-blue-600 text-white text-[10px] rounded">Kaydet</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] border rounded">İptal</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{c.description}</p>
                              <p className="text-[10px] text-slate-400">
                                {fmtDate(c.entryDate)}
                                {c.vendor ? ` · ${c.vendor.name}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-bold text-red-600">-{fmtCurrency(c.amount)}</span>
                              <button type="button" onClick={() => handleStartEdit(c)} className="text-[10px] text-slate-400 hover:text-blue-600">Düzenle</button>
                              <button type="button" onClick={() => handleDeleteCost(c.id)} className="text-[10px] text-slate-400 hover:text-red-600">Sil</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!historicalExempt && (
              <ClosureConditionsPanel
                serviceType="emergency"
                entityId={vaka.id}
                fileNo={vaka.caseNo}
                totalAmount={costs.reduce((s, c) => s + c.amount, 0)}
                workItemsSummary={[]}
              />
            )}
          </div>
        )}
      </div>

      {/* 8. Süreç — bilgi amaçlı kompakt strip */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 py-3" data-testid="surec-strip">
        <p className="text-[11px] font-semibold text-slate-400 mb-2 px-1">Süreç</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {STATUS_STEPS.map((s, i) => {
            const isActive = s === vaka.status;
            const isDone = i < currentIdx;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                {i > 0 && <span className="text-slate-300 text-xs px-0.5">→</span>}
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}
                >
                  {PROCESS_STRIP_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Onay kanalı modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Onay Talebi Oluştur</h3>
            <p className="text-xs text-slate-500">
              Satış fiyatı ({satisFiyati || '—'} TL.) seçilen kanala iletilir. Alış fiyatı gönderilmez.
            </p>
            <fieldset className="space-y-2">
              {([
                { id: 'whatsapp' as const, label: 'WhatsApp' },
                { id: 'email' as const, label: 'E-posta' },
                { id: 'both' as const, label: 'WhatsApp + E-posta' },
              ]).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                    approvalChannel === opt.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalChannel"
                    checked={approvalChannel === opt.id}
                    onChange={() => setApprovalChannel(opt.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={approvalBusy}
                onClick={handleApprovalSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {approvalBusy ? 'Gönderiliyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
