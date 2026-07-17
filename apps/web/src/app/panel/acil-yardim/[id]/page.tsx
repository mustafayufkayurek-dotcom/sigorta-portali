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
import { AlternativeVendorServicePanel } from '@/components/vendor-discovery/AlternativeVendorServicePanel';
import {
  ACIL_STAGES,
  AcilLocalFlow,
  appendFlowHistory,
  buildClosureEmailPreview,
  buildVendorWhatsAppText,
  buildWorkStartWhatsAppText,
  deriveAcilStageIndex,
  emptyAcilLocalFlow,
  readAcilLocalFlow,
  stageTaskTitle,
  writeAcilLocalFlow,
} from './acil-workflow';

const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
  draft: 'Taslak',
};

type BottomTab = 'iletisim' | 'gecmis' | 'finans' | null;
type ApprovalChannel = 'whatsapp' | 'email' | 'both';

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function insuredLabel(vaka: EmergencyCase): string {
  // Sigortalı alanı şemada ayrı değil; notlardan veya boş gösterilir.
  const note = (vaka.notes || '').trim();
  const m = note.match(/sigortal[ıi]\s*[:：]\s*(.+)/i);
  if (m?.[1]) return m[1].split(/[\n|]/)[0].trim().slice(0, 80);
  return '—';
}

function statusLabel(status: EmergencyStatus): string {
  const map: Record<EmergencyStatus, string> = {
    GELEN: 'İhbar',
    ATANDI: 'Tedarikçi Atandı',
    SAHADA: 'Saha',
    COZULDU: 'Dosya Kapatıldı',
    FATURALANDILDI: 'Finansa Aktarıldı',
  };
  return map[status];
}

function openWhatsApp(phone: string | null | undefined, text: string) {
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.startsWith('90') ? digits : digits ? `90${digits.replace(/^0/, '')}` : '';
  const url = withCountry
    ? `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
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
  const [flow, setFlow] = useState<AcilLocalFlow>(emptyAcilLocalFlow);
  const [costEditDraft, setCostEditDraft] = useState('');
  const [showClosureEmail, setShowClosureEmail] = useState(false);
  const [financeResult, setFinanceResult] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [financeBusy, setFinanceBusy] = useState(false);
  const [actionFlash, setActionFlash] = useState<string | null>(null);

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

  const [financeOptIn, setFinanceOptIn] = useState(false);

  const persistFlow = useCallback((next: AcilLocalFlow) => {
    setFlow(next);
    if (id) writeAcilLocalFlow(id, next);
  }, [id]);

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
    const saved = readAcilLocalFlow(id);
    setFlow(saved);
    if (saved.detectedCostTl != null) setCostEditDraft(String(saved.detectedCostTl));
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
      persistFlow(appendFlowHistory(flow, `Tedarikçi atandı: ${res.data.assignedVendor?.name ?? vendorId}`));
      setActionFlash('Tedarikçi atandı. WhatsApp ile gönderebilirsiniz.');
    } catch {
      // sessiz
    } finally {
      setAssignLoading(false);
    }
  }

  function handleWhatsAppSend() {
    if (!vaka) return;
    const fileNo = vaka.fileNo || vaka.caseNo;
    const text = buildVendorWhatsAppText({
      fileNo,
      issueType: vaka.issueType,
      insuredLabel: insuredLabel(vaka),
      phone: vaka.customerPhone || '',
      address: vaka.address,
      city: vaka.city,
      district: vaka.district,
      notes: vaka.notes,
    });
    const vendorPhone = (vaka.assignedVendor as { phone?: string } | null | undefined)?.phone;
    openWhatsApp(vendorPhone, text);
    const next = appendFlowHistory(flow, 'WhatsApp mesajı hazırlandı ve gönderim penceresi açıldı');
    // Maliyet algısı stub — mesaj aşamayı değiştirmez; yalnızca öneri kartı
    if (next.detectedCostTl == null && !next.costConfirmed) {
      next.detectedCostTl = 2500;
      setCostEditDraft('2500');
    }
    persistFlow(next);
    setActionFlash('WhatsApp mesajı hazırlandı. Geçmişe kaydedildi.');
  }

  async function confirmDetectedCost() {
    const amount = Number(costEditDraft || flow.detectedCostTl || 0);
    if (!amount || amount <= 0) {
      setActionFlash('Geçerli bir tutar girin');
      return;
    }
    setAlisFiyati(String(amount));
    const hasGider = costs.some((c) => c.entryType === 'gider');
    if (!hasGider) {
      try {
        await addCostEntry(id, {
          entryType: 'gider',
          description: 'Tedarikçi Alış Fiyatı',
          amount,
          entryDate: new Date().toISOString().slice(0, 10),
          vendorId: vaka?.assignedVendorId ?? undefined,
        });
        await refreshCosts();
      } catch {
        /* lokal alan yine set */
      }
    }
    persistFlow(appendFlowHistory(
      { ...flow, costConfirmed: true, detectedCostTl: amount },
      `Tedarikçi maliyeti onaylandı: ${fmtCurrency(amount)}`,
    ));
    setActionFlash('Tedarikçi maliyeti onaylandı.');
  }

  function rejectDetectedCost() {
    setCostEditDraft(String(flow.detectedCostTl ?? ''));
    setActionFlash('Tutarı düzeltip onaylayın. Aşama otomatik değişmez.');
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
      const next = appendFlowHistory(
        {
          ...flow,
          costConfirmed: true,
          approvalRequested: true,
          approvalDetected: true,
        },
        `Onay talebi oluşturuldu (${channelLabel})`,
      );
      persistFlow(next);
      setApprovalMsg(`Onay talebi oluşturuldu (${channelLabel}).`);
      setShowApprovalModal(false);
      setActionFlash(`Onay talebi: ${channelLabel}`);
    } catch (err: any) {
      setApprovalMsg(err.message ?? 'Onay talebi oluşturulamadı');
    } finally {
      setApprovalBusy(false);
    }
  }

  function handleCustomerApproval(accept: boolean) {
    if (accept) {
      persistFlow(appendFlowHistory(
        { ...flow, customerApproved: true, approvalDetected: false },
        'Müşteri onayı kaydedildi',
      ));
      setActionFlash('Müşteri onayı kaydedildi. İşe başlama mesajı hazırlayabilirsiniz.');
    } else {
      persistFlow(appendFlowHistory(
        { ...flow, approvalDetected: false, approvalRequested: true },
        'Onay reddedildi / düzeltme bekleniyor',
      ));
      setActionFlash('Onay kaydedilmedi. Gerekirse yeni onay talebi oluşturun.');
    }
  }

  function handleWorkStartMessage() {
    if (!vaka) return;
    const fileNo = vaka.fileNo || vaka.caseNo;
    const text = buildWorkStartWhatsAppText(fileNo, vaka.issueType);
    const vendorPhone = (vaka.assignedVendor as { phone?: string } | null | undefined)?.phone;
    openWhatsApp(vendorPhone, text);
    persistFlow(appendFlowHistory(
      { ...flow, workStartPrepared: true },
      'İşe başlama mesajı hazırlandı',
    ));
    setActionFlash('İşe başlama mesajı hazırlandı.');
  }

  async function handleServiceComplete() {
    try {
      if (vaka && (vaka.status === 'GELEN' || vaka.status === 'ATANDI')) {
        const res = await updateCaseStatus(id, 'SAHADA');
        setVaka(res.data);
      }
    } catch { /* local devam */ }
    persistFlow(appendFlowHistory(
      { ...flow, serviceCompleted: true, workStartPrepared: true, customerApproved: true },
      'Hizmet tamamlandı olarak işaretlendi',
    ));
    setActionFlash('Hizmet tamamlandı.');
  }

  async function handleCloseFile() {
    const saleOk = Number(satisFiyati) > 0 || costSummary.totalGelir > 0;
    const approvalOk = flow.customerApproved || flow.approvalRequested;
    if (!saleOk) {
      setActionFlash('Onaylı satış fiyatı eksik. Dosya kapatılamaz.');
      return;
    }
    setCloseBusy(true);
    try {
      const res = await updateCaseStatus(id, 'COZULDU');
      setVaka(res.data);
      persistFlow(appendFlowHistory(
        { ...flow, fileClosed: true, serviceCompleted: true },
        'Dosya kapatıldı',
      ));
      setShowClosureEmail(true);
      setActionFlash(approvalOk
        ? 'Dosya kapatıldı. Kapanış e-postasını önizleyin.'
        : 'Dosya kapatıldı. Müşteri onayı kaydı eksik olabilir — e-postayı kontrol edin.');
    } catch (err: any) {
      setActionFlash(err.message ?? 'Dosya kapatılamadı');
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleFinanceTransfer() {
    setFinanceBusy(true);
    setFinanceResult(null);
    try {
      const res = await updateCaseStatus(id, 'FATURALANDILDI');
      setVaka(res.data);
      const claimBlocked = Boolean(res.data.operationChain?.constraints?.vendorStatementRequiresClaimFile);
      const blockers = res.data.operationChain?.blockerReasons ?? [];
      const hakedisBlocked = claimBlocked || blockers.some((b) => /hakediş|claimFile|cari/i.test(b));
      const result = hakedisBlocked
        ? 'Finansa Aktarıldı. Tedarikçi hakedişi ve cari bağlantısı bu dosya için henüz tamamlanamadı.'
        : 'Finansa Aktarıldı.';
      setFinanceResult(result);
      persistFlow(appendFlowHistory(
        { ...flow, financeTransferred: true, fileClosed: true },
        result,
      ));
      setActionFlash(result);
    } catch (err: any) {
      setFinanceResult(err.message ?? 'Finansa aktarım yapılamadı');
    } finally {
      setFinanceBusy(false);
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
  const hasAlis = costSummary.totalGider > 0 || flow.costConfirmed || Number(alisFiyati) > 0;
  const stageIdx = deriveAcilStageIndex({
    status: vaka.status,
    hasVendor: Boolean(vaka.assignedVendorId),
    hasAlis,
    flow,
  });
  const task = historicalExempt
    ? { title: 'Tarihsel Dosya', detail: 'Yeni finans akışı, hakediş ve cari zorunlu değildir.' }
    : stageTaskTitle(stageIdx);
  const showAlternativeService = !recsLoading && vendorRecs.length === 0 && !vaka.assignedVendorId;
  const assigneeName = vaka.assignedUser
    ? `${vaka.assignedUser.firstName} ${vaka.assignedUser.lastName}`.trim()
    : '—';
  const karOrani = costSummary.totalGelir > 0
    ? ((costSummary.netKar / costSummary.totalGelir) * 100)
    : 0;
  const fileNo = vaka.fileNo || vaka.caseNo;
  const phone = vaka.customerPhone || '—';
  const insured = insuredLabel(vaka);
  const guncelDurum = ACIL_STAGES[stageIdx]?.label ?? statusLabel(vaka.status);
  const showCostDetect = Boolean(vaka.assignedVendorId) && flow.detectedCostTl != null && !flow.costConfirmed;
  const showApprovalDetect = flow.approvalDetected && !flow.customerApproved;
  const salePriceNum = Number(satisFiyati) || costSummary.totalGelir || null;
  const closureMail = buildClosureEmailPreview({
    fileNo,
    insuredLabel: insured,
    issueType: vaka.issueType,
    salePrice: salePriceNum,
    closedAt: fmtDate(new Date().toISOString()),
    summary: vaka.notes?.trim().slice(0, 120) || 'Hizmet tamamlandı',
  });
  const closeChecklist = {
    sale: Number(satisFiyati) > 0 || costSummary.totalGelir > 0,
    photos: (vaka.operationChain?.documents.totalCount ?? 0) > 0 || (vaka.operationChain?.inbox.attachmentCount ?? 0) > 0,
    docs: Boolean(vaka.operationChain?.documents.hasApprovedMatbuEvrak) || (vaka.operationChain?.documents.totalCount ?? 0) > 0,
    approval: flow.customerApproved,
  };

  function handleHistoricalFinanceOptIn() {
    writeHistoricalFinanceOptIn(id, true);
    setFinanceOptIn(true);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 sm:pb-8 overflow-x-hidden" data-testid="acil-dosya-detay">
      {/* 1. Dosya Başlığı */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid="dosya-basligi">
        <div className="flex items-start gap-3">
          <Link
            href="/panel/operasyon?filter=acil"
            className="mt-1 p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Geri"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Müşteri (Asistans)</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight truncate">
              {customerLabel(vaka)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-mono font-semibold text-slate-700">{fileNo}</span>
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
                <dt className="text-xs text-slate-400">Dosya No</dt>
                <dd className="font-medium text-slate-800 font-mono truncate">{fileNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Sigortalı</dt>
                <dd className="font-medium text-slate-800 truncate">{insured}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Hizmet Türü</dt>
                <dd className="font-medium text-blue-700">{vaka.issueType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Telefon</dt>
                <dd className="font-medium text-slate-800">{phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Dosya Sorumlusu</dt>
                <dd className="font-medium text-slate-800">{assigneeName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Açılış Tarihi</dt>
                <dd className="font-medium text-slate-800">{fmtDate(vaka.fileDate ?? vaka.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">Adres</dt>
                <dd className="font-medium text-slate-800">
                  {vaka.address}{vaka.city ? `, ${vaka.city}` : ''}{vaka.district ? ` / ${vaka.district}` : ''}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">Güncel Durum</dt>
                <dd className="font-semibold text-blue-700" data-testid="guncel-durum">{guncelDurum}</dd>
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

      {/* 2. Acil aşamalar strip */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 py-3" data-testid="surec-strip">
        <p className="text-[11px] font-semibold text-slate-400 mb-2 px-1">Dosya Aşamaları</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
          {ACIL_STAGES.map((s, i) => {
            const isActive = i === stageIdx;
            const isDone = i < stageIdx;
            return (
              <div key={s.key} className="flex items-center gap-1 shrink-0">
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
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Güncel İşlem — ANA ODAK */}
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
        {actionFlash && (
          <p className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2" data-testid="aksiyon-bildirim">
            {actionFlash}
          </p>
        )}
      </div>

      {/* 3. Önerilen Tedarikçiler */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid="tedarikci-onerileri">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-800">Önerilen Tedarikçiler</p>
          {vaka.assignedVendor && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
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
                data-testid="tedarikci-oneri"
              >
                <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{v.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {[
                      vaka.city ? `Bölge ${vaka.city}` : null,
                      vaka.issueType ? `Hizmet ${vaka.issueType}` : null,
                      v.avgServiceScore != null ? `Kalite ${v.avgServiceScore}` : null,
                      v.avgCost != null ? `Ortalama Maliyet ${Number(v.avgCost).toLocaleString('tr-TR')} ₺` : null,
                      v.avgResponseTime != null ? `Müdahale ${v.avgResponseTime} sa` : null,
                      `Tamamlanan ${v.completedFileCount ?? 0}`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!vaka.assignedVendorId && (
                  <button
                    type="button"
                    disabled={assignLoading}
                    onClick={() => handleAssignVendor(v.id)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    data-testid="tedarikci-ata"
                  >
                    Dosyaya Ata
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 py-2">Uygun tedarikçi önerisi yok.</p>
        )}
        {!recsLoading && !vaka.assignedVendorId && (
          <AlternativeVendorServicePanel
            city={vaka.city ?? undefined}
            district={vaka.district ?? undefined}
            serviceType={vaka.issueType ?? undefined}
            category="acil"
            autoExpandWhenEmpty={showAlternativeService}
            onAssigned={async (vendor) => {
              await handleAssignVendor(vendor.id);
            }}
          />
        )}
        <p className="mt-2 text-[11px] text-slate-400">Atama zorunlu değildir.</p>
      </div>

      {/* 4. WhatsApp ile Gönder — ata sonrası */}
      {vaka.assignedVendorId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2" data-testid="whatsapp-gonder">
          <p className="text-sm font-semibold text-slate-800">WhatsApp İle Gönder</p>
          <p className="text-[11px] text-slate-500">
            Dosya bilgisi otomatik hazırlanır. Serbest mesaj dosya aşamasını değiştirmez.
          </p>
          <button
            type="button"
            onClick={handleWhatsAppSend}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            data-testid="whatsapp-gonder-btn"
          >
            WhatsApp İle Gönder
          </button>
        </div>
      )}

      {/* 5. Tedarikçi maliyeti algılama */}
      {showCostDetect && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3" data-testid="maliyet-algilandi">
          <p className="text-sm font-semibold text-slate-800">
            Tedarikçi maliyeti algılandı:{' '}
            <span className="text-amber-800">{fmtCurrency(Number(costEditDraft || flow.detectedCostTl || 0))}</span>
          </p>
          <p className="text-[11px] text-slate-500">Onaylanmadan maliyet kesinleşmez.</p>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={costEditDraft}
            onChange={(e) => setCostEditDraft(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="maliyet-duzelt-input"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDetectedCost()}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
              data-testid="maliyet-onayla"
            >
              Onayla
            </button>
            <button
              type="button"
              onClick={rejectDetectedCost}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              data-testid="maliyet-duzelt"
            >
              Düzelt
            </button>
          </div>
        </div>
      )}

      {/* 6. Maliyet ve Onay */}
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
              data-testid="alis-fiyati"
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
              data-testid="satis-fiyati"
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
          data-testid="onay-talebi-olustur"
        >
          Onay Talebi Oluştur
        </button>
      </div>

      {/* 7. Asistans onayı */}
      {showApprovalDetect && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4 space-y-3" data-testid="asistans-onay-algilandi">
          <p className="text-sm font-semibold text-slate-800">
            Onay algılandı. Müşteri onayı olarak kaydedilsin mi?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleCustomerApproval(true)}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
              data-testid="asistans-onayla"
            >
              Onayla
            </button>
            <button
              type="button"
              onClick={() => handleCustomerApproval(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              data-testid="asistans-reddet"
            >
              Reddet
            </button>
          </div>
        </div>
      )}

      {flow.customerApproved && !flow.workStartPrepared && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid="ise-baslama">
          <button
            type="button"
            onClick={handleWorkStartMessage}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
            data-testid="ise-baslama-mesaji"
          >
            İşe Başlama Mesajı Hazırla
          </button>
        </div>
      )}

      {/* 8–10. Tamamlama / Kapat / Finansa Aktar */}
      {(flow.workStartPrepared || flow.serviceCompleted || stageIdx >= 4) && !flow.serviceCompleted && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid="hizmet-tamamla">
          <button
            type="button"
            onClick={() => void handleServiceComplete()}
            className="w-full py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold"
            data-testid="hizmet-tamamlandi-btn"
          >
            Hizmet Tamamlandı
          </button>
        </div>
      )}

      {(flow.serviceCompleted || stageIdx >= 5) && !flow.fileClosed && vaka.status !== 'COZULDU' && vaka.status !== 'FATURALANDILDI' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3" data-testid="dosya-kapat">
          <p className="text-sm font-semibold text-slate-800">Dosya Kapanış Kontrolü</p>
          <ul className="text-xs text-slate-600 space-y-1">
            <li className={closeChecklist.sale ? 'text-emerald-700' : 'text-amber-700'}>
              {closeChecklist.sale ? '✓' : '•'} Onaylı satış fiyatı {closeChecklist.sale ? 'mevcut' : 'eksik'}
            </li>
            <li className={closeChecklist.photos ? 'text-emerald-700' : 'text-slate-500'}>
              {closeChecklist.photos ? '✓' : '•'} Fotoğraf / yazışma ekleri {closeChecklist.photos ? 'bağlı' : 'henüz yok (opsiyonel)'}
            </li>
            <li className={closeChecklist.docs ? 'text-emerald-700' : 'text-slate-500'}>
              {closeChecklist.docs ? '✓' : '•'} Belge {closeChecklist.docs ? 'mevcut' : 'henüz yok (opsiyonel)'}
            </li>
            <li className={closeChecklist.approval ? 'text-emerald-700' : 'text-amber-700'}>
              {closeChecklist.approval ? '✓' : '•'} Müşteri onayı {closeChecklist.approval ? 'kayıtlı' : 'eksik'}
            </li>
          </ul>
          <button
            type="button"
            disabled={closeBusy || !closeChecklist.sale}
            onClick={() => void handleCloseFile()}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            data-testid="dosyayi-kapat-btn"
          >
            {closeBusy ? 'Kapatılıyor...' : 'Dosyayı Kapat'}
          </button>
        </div>
      )}

      {(flow.fileClosed || vaka.status === 'COZULDU') && vaka.status !== 'FATURALANDILDI' && !flow.financeTransferred && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2" data-testid="finansa-aktar">
          <button
            type="button"
            onClick={() => setShowClosureEmail(true)}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            data-testid="kapanis-email-onizle"
          >
            Kapanış E-postasını Önizle
          </button>
          <button
            type="button"
            disabled={financeBusy}
            onClick={() => void handleFinanceTransfer()}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            data-testid="finansa-aktar-btn"
          >
            {financeBusy ? 'Aktarılıyor...' : 'Finansa Aktar'}
          </button>
        </div>
      )}

      {(flow.financeTransferred || vaka.status === 'FATURALANDILDI') && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="finansa-aktarildi">
          <p className="text-sm font-semibold text-emerald-800">Finansa Aktarıldı</p>
          {financeResult && (
            <p className="mt-1 text-xs text-emerald-700" data-testid="finans-sonuc">{financeResult}</p>
          )}
          {!financeResult && vaka.operationChain?.constraints?.vendorStatementRequiresClaimFile && (
            <p className="mt-1 text-xs text-emerald-700" data-testid="finans-sonuc">
              Finansa Aktarıldı. Tedarikçi hakedişi ve cari bağlantısı bu dosya için henüz tamamlanamadı.
            </p>
          )}
        </div>
      )}

      {/* 11. Sekmeler — ilk ekranda kapalı */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" data-testid="alt-sekmeler">
        <div className="flex border-b border-slate-100">
          {([
            { id: 'iletisim' as const, label: 'WhatsApp / Belge' },
            { id: 'gecmis' as const, label: 'Dosya Geçmişi' },
            { id: 'finans' as const, label: 'Finans' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBottomTab(bottomTab === tab.id ? null : tab.id)}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors border-l border-slate-100 first:border-l-0 ${
                bottomTab === tab.id ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
              }`}
              data-testid={`sekme-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {bottomTab === 'iletisim' && (
          <div className="p-4 space-y-3" data-testid="sekme-iletisim-icerik">
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
        )}

        {bottomTab === 'gecmis' && (
          <div className="p-4 space-y-3 text-sm" data-testid="sekme-gecmis-icerik">
            {flow.history.length > 0 && (
              <ul className="space-y-2">
                {flow.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="text-xs text-slate-600 border-b border-slate-50 pb-2">
                    <span className="text-slate-400">{fmtDateTime(h.at)}</span>
                    <p className="mt-0.5 font-medium text-slate-800">{h.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {vaka.operationChain ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-xs text-slate-400">Yazışma</p>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {vaka.operationChain.inbox.messageCount} yazışma · {vaka.operationChain.inbox.attachmentCount} ek
                    </p>
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
              </>
            ) : flow.history.length === 0 ? (
              <p className="text-xs text-slate-400">Geçmiş özeti henüz yok.</p>
            ) : null}
          </div>
        )}

        {bottomTab === 'finans' && (
          <div className="p-4 space-y-4" data-testid="sekme-finans-icerik">
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
                    Durum özeti: satış {costSummary.totalGelir > 0 ? 'var' : 'yok'}
                    {' · '}
                    alış {costSummary.totalGider > 0 ? 'var' : 'yok'}
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
              </div>
            )}

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

      {/* 12. Mobil sabit alt çubuk */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-2 flex gap-2"
        data-testid="mobil-alt-cubuk"
      >
        {vaka.assignedVendorId ? (
          <button
            type="button"
            onClick={handleWhatsAppSend}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
          >
            WhatsApp
          </button>
        ) : (
          <button
            type="button"
            onClick={() => document.querySelector('[data-testid="tedarikci-onerileri"]')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
          >
            Tedarikçi
          </button>
        )}
        <button
          type="button"
          onClick={() => { setShowApprovalModal(true); setApprovalMsg(null); }}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          Onay Talebi
        </button>
        <button
          type="button"
          onClick={() => setBottomTab(bottomTab === 'iletisim' ? null : 'iletisim')}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          Yazışma
        </button>
      </div>

      {/* Onay kanalı modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="onay-talebi-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Onay Talebi Oluştur</h3>
            <p className="text-xs text-slate-500">
              Satış fiyatı ({satisFiyati || '—'} TL) seçilen kanala iletilir. Alış fiyatı gönderilmez.
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
                data-testid="onay-talebi-gonder"
              >
                {approvalBusy ? 'Gönderiliyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kapanış e-posta önizleme — alış YOK */}
      {showClosureEmail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="kapanis-email-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">Kapanış E-postası Önizleme</h3>
            <p className="text-xs text-slate-500">Konu: {closureMail.subject}</p>
            <pre
              className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3"
              data-testid="kapanis-email-govde"
            >
              {closureMail.body}
            </pre>
            <p className="text-[11px] text-amber-700" data-testid="kapanis-alis-yok">
              Tedarikçi alış fiyatı bu e-postada yer almaz.
            </p>
            <button
              type="button"
              onClick={() => {
                persistFlow(appendFlowHistory(flow, 'Kapanış e-postası önizlendi'));
                setShowClosureEmail(false);
                setActionFlash('Kapanış e-postası önizlendi. Alış fiyatı gönderilmez.');
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              Önizlemeyi Onayla
            </button>
            <button
              type="button"
              onClick={() => setShowClosureEmail(false)}
              className="w-full py-2 rounded-xl border border-slate-200 text-sm text-slate-600"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
