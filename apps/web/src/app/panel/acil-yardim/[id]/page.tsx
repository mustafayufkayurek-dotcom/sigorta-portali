'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getCase, updateCaseStatus, addCostEntry, getCostEntries, deleteCostEntry, updateCostEntry,
  getEmergencyVendors, createVendorQuick,
  EmergencyCase, EmergencyCostEntry, EmergencyStatus, EmergencyUrgency, VendorOption,
} from '@/utils/emergencyApi';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import { TrDateInput } from '@/components/ui/TrDateInput';

const STATUS_STEPS: EmergencyStatus[] = ['GELEN', 'ATANDI', 'SAHADA', 'COZULDU', 'FATURALANDILDI'];
const STATUS_LABELS: Record<EmergencyStatus, string> = {
  GELEN: 'Gelen',
  ATANDI: 'Atandı',
  SAHADA: 'Sahada',
  COZULDU: 'Çözüldü',
  FATURALANDILDI: 'Faturalandı',
};
const URGENCY_LABELS: Record<EmergencyUrgency, string> = {
  DUSUK: 'Düşük',
  NORMAL: 'Normal',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
};
const URGENCY_COLOR: Record<EmergencyUrgency, string> = {
  DUSUK: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  YUKSEK: 'bg-orange-50 text-orange-700',
  KRITIK: 'bg-red-100 text-red-700',
};

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL.';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Inline Vendor Selector ───────────────────────────────────────────────────

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
    if (open) {
      fetchOptions(search);
    }
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
          {value ? value.name : 'Tedarikçi seçin (opsiyonel)'}
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
              <div>
                <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  Ad <span className="text-red-400">*</span>
                  <span className="ml-auto text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Zorunlu Alan</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVendor(e as any); } }}
                  placeholder="Ad *"
                  className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!addForm.name.trim() && addError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  Telefon <span className="text-red-400">*</span>
                  <span className="ml-auto text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Zorunlu Alan</span>
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVendor(e as any); } }}
                  placeholder="05XX XXX XX XX *"
                  className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!addForm.phone.trim() && addError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">TC / Vergi No <span className="text-slate-400 text-[10px]">(opsiyonel)</span></label>
                <input
                  type="text"
                  value={addForm.identityNo}
                  onChange={(e) => setAddForm((f) => ({ ...f, identityNo: e.target.value }))}
                  placeholder="TC Kimlik veya Vergi No"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Adres <span className="text-slate-400 text-[10px]">(opsiyonel)</span></label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Açık Adres"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddVendor}
                  disabled={addLoading}
                  className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <span className="font-medium">{opt.name}</span>
                    {opt.phone && <span className="text-xs text-slate-400 ml-2">{opt.phone}</span>}
                  </button>
                ))
              )}
              <div className="border-t border-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
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

// Separate form state for income and expense to avoid shared-state bugs
const EMPTY_COST_FORM = { description: '', amount: '', entryDate: new Date().toISOString().slice(0, 10) };

export default function VakaDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [vaka, setVaka] = useState<EmergencyCase | null>(null);
  const [costs, setCosts] = useState<EmergencyCostEntry[]>([]);
  const [costSummary, setCostSummary] = useState({ totalGelir: 0, totalGider: 0, netKar: 0 });
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  // ─── Gelir form state (separate from gider) ───────────────────────────────
  const [showGelirForm, setShowGelirForm] = useState(false);
  const [gelirForm, setGelirForm] = useState(EMPTY_COST_FORM);
  const [gelirLoading, setGelirLoading] = useState(false);
  const [gelirError, setGelirError] = useState<string | null>(null);

  // ─── Gider form state (separate from gelir) ───────────────────────────────
  const [showGiderForm, setShowGiderForm] = useState(false);
  const [giderForm, setGiderForm] = useState(EMPTY_COST_FORM);
  const [giderVendor, setGiderVendor] = useState<VendorOption | null>(null);
  const [giderLoading, setGiderLoading] = useState(false);
  const [giderError, setGiderError] = useState<string | null>(null);

  // ─── Edit state ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', entryDate: '' });
  const [editVendor, setEditVendor] = useState<VendorOption | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseRes, costRes] = await Promise.all([getCase(id), getCostEntries(id)]);
      setVaka(caseRes.data);
      setCosts(costRes.data);
      setCostSummary(costRes.summary);
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(newStatus: EmergencyStatus) {
    setStatusLoading(true);
    try {
      const res = await updateCaseStatus(id, newStatus);
      setVaka(res.data);
      if (newStatus === 'COZULDU') {
        router.push(`/panel/acil-yardim/finans?caseId=${id}`);
      }
    } catch {
      // sessiz
    } finally {
      setStatusLoading(false);
    }
  }

  async function refreshCosts() {
    const res = await getCostEntries(id);
    setCosts(res.data);
    setCostSummary(res.summary);
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
    e.stopPropagation();
    if (!giderForm.description.trim()) { setGiderError('Açıklama zorunludur'); return; }
    if (!giderForm.amount || isNaN(Number(giderForm.amount)) || Number(giderForm.amount) <= 0) { setGiderError('Geçerli bir tutar girin'); return; }
    if (!giderForm.entryDate) { setGiderError('Tarih zorunludur'); return; }
    setGiderLoading(true);
    setGiderError(null);
    try {
      const payload = {
        entryType: 'gider' as const,
        description: giderForm.description.trim(),
        amount: Number(giderForm.amount),
        entryDate: giderForm.entryDate,
        vendorId: giderVendor?.id,
      };
      console.log('[handleAddGider] payload:', payload);
      await addCostEntry(id, payload);
      setGiderForm(EMPTY_COST_FORM);
      setGiderVendor(null);
      setShowGiderForm(false);
      await refreshCosts();
    } catch (err: any) {
      console.error('[handleAddGider] error:', err);
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
    } catch {}
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

  function handleCancelEdit() {
    setEditingId(null);
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
    return (
      <div className="text-center py-20 text-slate-500">Dosya bulunamadı.</div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(vaka.status);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <Link href="/panel/acil-yardim" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Acil Yardım Operasyon Akışı</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {vaka.fileNo && <span className="text-xs font-mono text-slate-500">Dosya No: {vaka.fileNo}</span>}
            <span className="text-xs font-mono text-slate-400">{vaka.caseNo}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${URGENCY_COLOR[vaka.urgency]}`}>
              {URGENCY_LABELS[vaka.urgency]}
            </span>
            {vaka.overdueLevel !== 'none' && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                vaka.overdueLevel === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {vaka.overdueLevel === 'critical' ? '15+ gün' : '7+ gün'} faturasız
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 truncate mt-1">{vaka.customerName}</h1>
          <p className="text-xs text-slate-500 mt-1">Bu ekran yalnız Acil Yardım dosyalarının durum, maliyet ve evrak akışını yönetir.</p>
        </div>
      </div>

      {/* Durum Stepper */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Acil Yardım Süreç Durumu</p>
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((s, i) => {
            const isActive = s === vaka.status;
            const isDone = i < currentIdx;
            return (
              <button
                key={s}
                type="button"
                disabled={statusLoading || isActive}
                onClick={() => handleStatusChange(s)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDone
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dosya Bilgileri */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dosya Bilgileri</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Sorun Türü</p>
            <p className="font-medium text-blue-700">{vaka.issueType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Telefon</p>
            <p className="font-medium">{vaka.customerPhone ?? '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400">Adres</p>
            <p className="font-medium">{vaka.address}{vaka.city ? `, ${vaka.city}` : ''}</p>
          </div>
          {vaka.notes && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400">Notlar</p>
              <p className="text-sm text-slate-700">{vaka.notes}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400">Dosya Tarihi</p>
            <p className="font-medium">{fmtDate(vaka.fileDate ?? vaka.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Oluşturuldu</p>
            <p className="font-medium">{fmtDate(vaka.createdAt)}</p>
          </div>
          {vaka.resolvedAt && (
            <div>
              <p className="text-xs text-slate-400">Çözüm Tarihi</p>
              <p className="font-medium">{fmtDate(vaka.resolvedAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Kar Analizi Özeti */}
      <style>{`
        @keyframes lossFlash {
          0%, 100% { background-color: #991b1b; }
          50% { background-color: #dc2626; }
        }
        .loss-flash { animation: lossFlash 1.6s ease-in-out infinite; }
      `}</style>
      {(() => {
        const karOrani = costSummary.totalGelir > 0
          ? ((costSummary.netKar / costSummary.totalGelir) * 100)
          : 0;
        const isLoss = costSummary.netKar < 0;
        return (
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isLoss ? 'border-red-300' : 'border-slate-100'}`}>
            <div className={`px-4 py-2.5 flex items-center gap-2 ${isLoss ? 'loss-flash' : 'bg-slate-700'}`}>
              <span className="text-white text-xs font-extrabold uppercase tracking-widest">
                {isLoss ? '⚠ ZARAR' : 'Kar Analizi'}
              </span>
              {!isLoss && (
                <span className={`ml-auto text-sm font-extrabold px-2.5 py-0.5 rounded-full ${karOrani >= 20 ? 'bg-green-100 text-green-700' : karOrani >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                  %{karOrani.toFixed(1)} Kar Oranı
                </span>
              )}
              {isLoss && (
                <span className="ml-auto text-sm font-extrabold px-2.5 py-0.5 rounded-full bg-red-900/60 text-red-100">
                  %{Math.abs(karOrani).toFixed(1)} Zarar
                </span>
              )}
            </div>
            <div className="bg-white grid grid-cols-4 divide-x divide-slate-100">
              <div className="p-3 text-center">
                <p className="text-xs text-green-600 font-medium mb-0.5">Toplam Gelir</p>
                <p className="text-sm font-bold text-green-700">{fmtCurrency(costSummary.totalGelir)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-red-600 font-medium mb-0.5">Toplam Gider</p>
                <p className="text-sm font-bold text-red-700">{fmtCurrency(costSummary.totalGider)}</p>
              </div>
              <div className="p-3 text-center">
                <p className={`text-xs font-medium mb-0.5 ${isLoss ? 'text-red-600' : 'text-blue-600'}`}>Net Kâr</p>
                <p className={`text-sm font-bold ${isLoss ? 'text-red-700' : 'text-blue-700'}`}>{fmtCurrency(costSummary.netKar)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-slate-500 font-medium mb-0.5">Kar Oranı</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-extrabold ${isLoss ? 'bg-red-100 text-red-700' : karOrani >= 20 ? 'bg-green-100 text-green-700' : karOrani >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                  %{karOrani.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gelir / Gider Kayıtları — tek görünümde iki sütun */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* ── Gelir Sütunu ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Başlık */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Gelir
              {costs.filter((c) => c.entryType === 'gelir').length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  {costs.filter((c) => c.entryType === 'gelir').length}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !showGelirForm;
                setShowGelirForm(next);
                if (next) {
                  setShowGiderForm(false);
                  setGelirForm(EMPTY_COST_FORM);
                  setGelirError(null);
                }
              }}
              className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showGelirForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
              </svg>
              {showGelirForm ? 'Kapat' : 'Ekle'}
            </button>
          </div>

          {/* Gelir Ekleme Formu */}
          {showGelirForm && (
            <form onSubmit={handleAddGelir} className="px-3 py-2 bg-green-50 border-b border-green-100">
              {gelirError && <p className="text-xs text-red-600 mb-1.5">{gelirError}</p>}
              <input
                type="text"
                value={gelirForm.description}
                onChange={(e) => setGelirForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Açıklama"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white mb-1.5"
              />
              <div className="flex gap-1.5 mb-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={gelirForm.amount}
                  onChange={(e) => setGelirForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Tutar (₺)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                />
                <TrDateInput
                  value={gelirForm.entryDate}
                  onChange={(entryDate) => setGelirForm((f) => ({ ...f, entryDate }))}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={gelirLoading}
                  className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {gelirLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowGelirForm(false); setGelirError(null); }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 bg-white transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {/* Gelir Listesi */}
          {(() => {
            const gelirList = costs.filter((c) => c.entryType === 'gelir');
            if (gelirList.length === 0) {
              return <p className="text-xs text-slate-400 text-center py-3">Henüz gelir kaydı yok</p>;
            }
            return (
              <div className="divide-y divide-slate-50">
                {gelirList.map((c) => (
                  <div key={c.id} className="px-3">
                    {editingId === c.id ? (
                      <form
                        onSubmit={(e) => handleSaveEdit(e, c)}
                        className="py-2 space-y-1.5"
                      >
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Açıklama"
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!editForm.description.trim() && editError ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="Tutar (₺)"
                            className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${(!editForm.amount || Number(editForm.amount) <= 0) && editError ? 'border-red-400' : 'border-slate-200'}`}
                          />
                          <TrDateInput
                            value={editForm.entryDate}
                            onChange={(entryDate) => setEditForm((f) => ({ ...f, entryDate }))}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={editLoading} className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
                          </button>
                          <button type="button" onClick={handleCancelEdit} className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100">
                            İptal
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-800 font-medium truncate">{c.description}</p>
                          <p className="text-[10px] text-slate-400">{fmtDate(c.entryDate)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-xs font-bold text-green-600">+{fmtCurrency(c.amount)}</span>
                          <button type="button" onClick={() => handleStartEdit(c)} className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Düzenle">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteCost(c.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Sil">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Gider Sütunu ── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Başlık */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Gider
              {costs.filter((c) => c.entryType === 'gider').length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  {costs.filter((c) => c.entryType === 'gider').length}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !showGiderForm;
                setShowGiderForm(next);
                if (next) {
                  setShowGelirForm(false);
                  setGiderForm(EMPTY_COST_FORM);
                  setGiderVendor(null);
                  setGiderError(null);
                }
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showGiderForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
              </svg>
              {showGiderForm ? 'Kapat' : 'Ekle'}
            </button>
          </div>

          {/* Gider Ekleme Formu */}
          {showGiderForm && (
            <form onSubmit={handleAddGider} className="px-3 py-2 bg-red-50 border-b border-red-100">
              {giderError && <p className="text-xs text-red-600 mb-1.5">{giderError}</p>}
              <input
                type="text"
                value={giderForm.description}
                onChange={(e) => setGiderForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Açıklama"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white mb-1.5"
              />
              <div className="flex gap-1.5 mb-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={giderForm.amount}
                  onChange={(e) => setGiderForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Tutar (₺)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                />
                <TrDateInput
                  value={giderForm.entryDate}
                  onChange={(entryDate) => setGiderForm((f) => ({ ...f, entryDate }))}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                />
              </div>
              <div className="mb-1.5">
                <VendorSelector value={giderVendor} onChange={setGiderVendor} />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={giderLoading}
                  className="flex-1 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {giderLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowGiderForm(false); setGiderVendor(null); setGiderError(null); }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 bg-white transition-colors"
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {/* Gider Listesi */}
          {(() => {
            const giderList = costs.filter((c) => c.entryType === 'gider');
            if (giderList.length === 0) {
              return <p className="text-xs text-slate-400 text-center py-3">Henüz gider kaydı yok</p>;
            }
            return (
              <div className="divide-y divide-slate-50">
                {giderList.map((c) => (
                  <div key={c.id} className="px-3">
                    {editingId === c.id ? (
                      <form
                        onSubmit={(e) => handleSaveEdit(e, c)}
                        className="py-2 space-y-1.5"
                      >
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Açıklama"
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!editForm.description.trim() && editError ? 'border-red-400' : 'border-slate-200'}`}
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="Tutar (₺)"
                            className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${(!editForm.amount || Number(editForm.amount) <= 0) && editError ? 'border-red-400' : 'border-slate-200'}`}
                          />
                          <TrDateInput
                            value={editForm.entryDate}
                            onChange={(entryDate) => setEditForm((f) => ({ ...f, entryDate }))}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <VendorSelector value={editVendor} onChange={setEditVendor} />
                        </div>
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={editLoading} className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {editLoading ? 'Kaydediliyor...' : 'Kaydet'}
                          </button>
                          <button type="button" onClick={handleCancelEdit} className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100">
                            İptal
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-800 font-medium truncate">{c.description}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[10px] text-slate-400">{fmtDate(c.entryDate)}</p>
                            {c.vendor && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                {c.vendor.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-xs font-bold text-red-600">-{fmtCurrency(c.amount)}</span>
                          <button type="button" onClick={() => handleStartEdit(c)} className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Düzenle">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteCost(c.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Sil">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Matbu Evrak */}
      {vaka && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">
            Matbu Evrak
          </h3>
          <FileDocumentPanel
            entityType="emergency_case"
            entityId={vaka.id}
            documentKind="matbu_evrak"
          />
        </div>
      )}

      {/* Kapama Koşulları + Fatura Talebi */}
      {vaka && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">
            Dosya Kapama & Fatura Talebi
          </h3>
          <ClosureConditionsPanel
            serviceType="emergency"
            entityId={vaka.id}
            fileNo={vaka.caseNo}
            totalAmount={costs.reduce((s, c) => s + c.amount, 0)}
            workItemsSummary={[]}
          />
        </div>
      )}
    </div>
  );
}
