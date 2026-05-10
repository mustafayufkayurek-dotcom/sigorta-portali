'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API, authHeader } from '@/utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceRow {
  id: string;
  groupCode: string;
  groupName: string;
  subGroupCode: string;
  subGroupName: string;
  unitType: string;
  unitPrice: number;
}

interface Region {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  latestAdjustment?: { adjustmentPercent: number; effectiveDate: string } | null;
}

interface ZamHistory {
  id: string;
  type: 'global' | 'regional';
  adjustmentPercent?: number;
  regionalRates?: Record<string, number>;
  appliedBy?: string;
  appliedAt: string;
  notes?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
// const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'; // reserved

const REGION_COLORS: Record<string, string> = {
  MARMARA:      'bg-blue-100 text-blue-700',
  EGE:          'bg-cyan-100 text-cyan-700',
  AKDENIZ:      'bg-orange-100 text-orange-700',
  IC_ANADOLU:   'bg-slate-100 text-slate-700',
  KARADENIZ:    'bg-emerald-100 text-emerald-700',
  DOGU_ANADOLU: 'bg-purple-100 text-purple-700',
  GUNEYDOGU:    'bg-rose-100 text-rose-700',
};

const TR_REGIONS = [
  { code: 'MARMARA',      name: 'Marmara' },
  { code: 'EGE',          name: 'Ege' },
  { code: 'AKDENIZ',      name: 'Akdeniz' },
  { code: 'IC_ANADOLU',   name: 'İç Anadolu' },
  { code: 'KARADENIZ',    name: 'Karadeniz' },
  { code: 'DOGU_ANADOLU', name: 'Doğu Anadolu' },
  { code: 'GUNEYDOGU',    name: 'Güneydoğu Anadolu' },
];

type TabId = 'fiyat-tablosu' | 'bolgeler' | 'zam-gecmisi';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'fiyat-tablosu', label: 'Fiyat Tablosu',  icon: '📊' },
  { id: 'bolgeler',      label: 'Bölgeler',        icon: '🗺️' },
  { id: 'zam-gecmisi',   label: 'Zam Geçmişi',     icon: '📈' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FiyatYonetimiPage() {
  const [activeTab, setActiveTab] = useState<TabId>('fiyat-tablosu');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Fiyat Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-1">Fiyat tablosunu yükleyin, bölgesel zamları yönetin, geçmişi takip edin.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${idx > 0 ? 'border-l border-l-slate-100' : ''}`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'fiyat-tablosu' && <FiyatTablosuTab />}
        {activeTab === 'bolgeler'      && <BolgelerTab />}
        {activeTab === 'zam-gecmisi'   && <ZamGecmisiTab />}
      </div>
    </div>
  );
}

// ── Import Preview Types ───────────────────────────────────────────────────────

interface PreviewRow {
  rowIndex: number;
  groupCode: string;
  groupName: string;
  subGroupCode: string;
  subGroupName: string;
  unitType: string;
  unitPrice: number | null;
  errors: string[];
}

function parseCSVPreview(text: string): PreviewRow[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const result: PreviewRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const [groupCode, groupName, subGroupCode, subGroupName, unitType, unitPriceRaw] = cols.map(c => c.trim().replace(/^"|"$/g, ''));
    const errors: string[] = [];
    if (!groupCode) errors.push('Grup kodu boş');
    if (!subGroupCode) errors.push('Alt grup kodu boş');
    if (!subGroupName) errors.push('Alt grup adı boş');
    const unitPrice = unitPriceRaw ? parseFloat(unitPriceRaw.replace(',', '.')) : null;
    if (unitPriceRaw && isNaN(unitPrice as number)) errors.push('Birim fiyat sayısal değil');
    result.push({ rowIndex: i, groupCode: groupCode ?? '', groupName: groupName ?? '', subGroupCode: subGroupCode ?? '', subGroupName: subGroupName ?? '', unitType: unitType ?? '', unitPrice: unitPrice, errors });
  }
  return result;
}

// ── Fiyat Tablosu ─────────────────────────────────────────────────────────────

function FiyatTablosuTab() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Preview state
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Bulk delete state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // single row id
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Zam state
  const [globalZam, setGlobalZam] = useState('');
  const [showZamConfirm, setShowZamConfirm] = useState(false);
  const [showRegionalModal, setShowRegionalModal] = useState(false);
  const [applyingZam, setApplyingZam] = useState(false);
  const [zamError, setZamError] = useState('');
  const [zamSuccess, setZamSuccess] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/work-groups?includeSubGroups=true`, { headers: authHeader() });
      const groups = res.data.data ?? res.data ?? [];
      const flat: PriceRow[] = [];
      for (const g of groups) {
        for (const sg of (g.workSubGroups ?? [])) {
          flat.push({
            id: sg.id,
            groupCode: g.code,
            groupName: g.name,
            subGroupCode: sg.code,
            subGroupName: sg.name,
            unitType: sg.unitType,
            unitPrice: sg.unitPrice ?? 0,
          });
        }
      }
      setRows(flat);
    } catch { /* keep existing rows */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = rows.filter(r =>
    `${r.groupName} ${r.subGroupName} ${r.groupCode} ${r.subGroupCode}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Selection helpers
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(r => next.delete(r.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(r => next.add(r.id)); return next; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // ── Delete single
  const handleDeleteOne = async (id: string) => {
    setDeleting(true); setDeleteError('');
    try {
      await axios.delete(`${API}/work-groups/sub-groups/${id}`, { headers: authHeader() });
      setRows(prev => prev.filter(r => r.id !== id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (e: any) {
      setDeleteError(e.response?.data?.message ?? 'Silme işlemi başarısız.');
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  // ── Delete bulk
  const handleBulkDelete = async () => {
    setDeleting(true); setDeleteError('');
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map(id => axios.delete(`${API}/work-groups/sub-groups/${id}`, { headers: authHeader() }))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    setRows(prev => prev.filter(r => !ids.some((id, idx) => id === r.id && results[idx].status === 'fulfilled')));
    setSelected(new Set());
    setShowBulkDeleteConfirm(false);
    setDeleting(false);
    if (failed > 0) setDeleteError(`${failed} kayıt silinemedi.`);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setUploadError('Sadece Excel (.xlsx, .xls) veya CSV dosyası yükleyebilirsiniz.');
      return;
    }
    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      const preview = parseCSVPreview(text);
      if (preview.length === 0) { setUploadError('CSV dosyası geçerli veri içermiyor.'); return; }
      setPreviewRows(preview);
      setPendingFile(file);
    } else {
      await doUpload(file);
    }
  };

  const doUpload = async (file: File) => {
    setUploading(true); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`${API}/price-import/upload`, fd, { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } });
      await fetchRows();
    } catch (e: any) {
      setUploadError(e.response?.data?.message ?? 'Dosya yüklenirken hata oluştu.');
    } finally { setUploading(false); }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setPreviewRows(null);
    await doUpload(pendingFile);
    setPendingFile(null);
  };

  // ── xlsx template download
  const downloadTemplate = () => {
    const templateData = rows.length > 0
      ? rows.map(r => ({
          'İş Grubu Kodu': r.groupCode,
          'İş Kalemi Kodu': r.subGroupCode,
          'İş Kalemi Adı': r.subGroupName,
          'Birim': r.unitType,
          'Birim Fiyat (TL)': r.unitPrice,
          'KDV (%)': 18,
          'Açıklama': '',
        }))
      : [
          { 'İş Grubu Kodu': 'IG001', 'İş Kalemi Kodu': 'IG001-001', 'İş Kalemi Adı': 'Örnek Kalem 1', 'Birim': 'm²', 'Birim Fiyat (TL)': 0, 'KDV (%)': 18, 'Açıklama': '' },
          { 'İş Grubu Kodu': 'IG001', 'İş Kalemi Kodu': 'IG001-002', 'İş Kalemi Adı': 'Örnek Kalem 2', 'Birim': 'adet', 'Birim Fiyat (TL)': 0, 'KDV (%)': 18, 'Açıklama': '' },
          { 'İş Grubu Kodu': 'IG002', 'İş Kalemi Kodu': 'IG002-001', 'İş Kalemi Adı': 'Örnek Kalem 3', 'Birim': 'saat', 'Birim Fiyat (TL)': 0, 'KDV (%)': 18, 'Açıklama': '' },
        ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    ws['!cols'] = [
      { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fiyat Tablosu');
    XLSX.writeFile(wb, 'fiyat-tablosu-sablonu.xlsx');
  };

  const handleEditSave = async (rowId: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) { setZamError('Geçerli bir fiyat girin.'); return; }
    setSaving(true);
    try {
      await axios.put(`${API}/work-groups/sub-groups/${rowId}`, { unitPrice: price }, { headers: authHeader() });
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, unitPrice: price } : r));
      setEditingId(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const applyGlobalZam = async () => {
    const rate = parseFloat(globalZam);
    if (isNaN(rate) || rate <= 0 || rate > 200) { setZamError('Geçerli bir oran girin (1-200).'); return; }
    setApplyingZam(true); setZamError(''); setZamSuccess('');
    try {
      await axios.post(`${API}/price-adjustments/global`, { adjustmentPercent: rate, notes: `Genel zam %${rate}` }, { headers: authHeader() });
      await fetchRows();
      setShowZamConfirm(false);
      setGlobalZam('');
      setZamSuccess(`Tüm fiyatlara %${rate} zam uygulandı.`);
      setTimeout(() => setZamSuccess(''), 4000);
    } catch (e: any) {
      setZamError(e.response?.data?.message ?? 'Zam uygulanırken hata oluştu.');
    } finally { setApplyingZam(false); }
  };

  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      {(zamError || deleteError) && <ErrorAlert msg={zamError || deleteError} onClose={() => { setZamError(''); setDeleteError(''); }} />}
      {zamSuccess && <SuccessAlert msg={zamSuccess} />}

      {/* Excel Upload */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Excel'den Fiyat Yükle</h2>
            <p className="text-sm text-slate-500 mt-0.5">xlsx, xls veya csv formatında fiyat tablosu yükleyin.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Excel Şablonu İndir (.xlsx)
          </button>
        </div>
        <div className="px-6 py-5">
          {uploadError && <ErrorAlert msg={uploadError} onClose={() => setUploadError('')} />}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <span className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                <span className="text-sm text-slate-500">Yükleniyor...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Dosyayı sürükleyin veya tıklayın</p>
                <p className="text-xs text-slate-400">.xlsx · .xls · .csv</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
        </div>
      </div>

      {/* Fiyat Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-900">Ana Fiyat Tablosu</h2>
              <p className="text-sm text-slate-500 mt-0.5">{rows.length} kalem{someSelected ? ` · ${selected.size} seçili` : ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {someSelected && (
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {selected.size} Seçiliyi Sil
                </button>
              )}
              <input className={`${inputCls} w-56`} placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex items-center gap-2">
                <input
                  className={`${inputCls} w-28`}
                  type="number"
                  min="0"
                  max="200"
                  step="0.1"
                  value={globalZam}
                  onChange={(e) => setGlobalZam(e.target.value)}
                  placeholder="% Zam"
                />
                <button type="button" onClick={() => { if (!globalZam) return; setShowZamConfirm(true); }} disabled={!globalZam} className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors whitespace-nowrap">
                  Genele Zam Uygula
                </button>
                <button type="button" onClick={() => setShowRegionalModal(true)} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap">
                  Bölge Bazlı Zam
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? <TableSkeleton /> : filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              {search ? 'Arama sonucu bulunamadı.' : 'Henüz fiyat verisi yüklenmemiş. Excel dosyası yükleyin.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3">Grup</th>
                  <th className="text-left px-4 py-3">Kalem Kodu</th>
                  <th className="text-left px-4 py-3">Kalem Adı</th>
                  <th className="text-left px-4 py-3">Birim</th>
                  <th className="text-right px-4 py-3">Birim Fiyat (₺)</th>
                  <th className="px-4 py-3 w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/60 transition-colors ${selected.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono text-slate-600">{r.groupCode}</span>
                      <span className="ml-1.5 text-slate-500 text-xs">{r.groupName}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.subGroupCode}</td>
                    <td className="px-4 py-2.5 text-slate-800">{r.subGroupName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.unitType}</td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId === r.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            className={`${inputCls} w-28 text-right`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(r.id); if (e.key === 'Escape') setEditingId(null); }}
                          />
                          <button type="button" onClick={() => handleEditSave(r.id)} disabled={saving} className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">Kaydet</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-2.5 py-1.5 border border-slate-200 text-xs rounded-lg text-slate-500">İptal</button>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-800">{fmt(r.unitPrice)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingId !== r.id && (
                          <button type="button" onClick={() => { setEditingId(r.id); setEditPrice(String(r.unitPrice)); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r.id)}
                          disabled={deleting}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Global Zam Confirm Modal */}
      {showZamConfirm && (
        <ConfirmModal
          title="Genele Zam Uygula"
          message={`Tüm ${rows.length} fiyata %${globalZam} zam uygulamak istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          loading={applyingZam}
          onConfirm={applyGlobalZam}
          onCancel={() => setShowZamConfirm(false)}
          confirmLabel={`%${globalZam} Zam Uygula`}
        />
      )}

      {/* Single Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Kalem Sil"
          message="Bu fiyat kalemini silmek istediğinize emin misiniz?"
          loading={deleting}
          onConfirm={() => handleDeleteOne(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Sil"
          danger
        />
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title="Toplu Silme"
          message={`Seçili ${selected.size} kalem silinecek. Bu işlem geri alınamaz.`}
          loading={deleting}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          confirmLabel={`${selected.size} Kalemi Sil`}
          danger
        />
      )}

      {/* Regional Zam Modal */}
      {showRegionalModal && <RegionalZamModal onClose={() => setShowRegionalModal(false)} onApplied={() => { fetchRows(); setZamSuccess('Bölgesel zamlar uygulandı.'); setTimeout(() => setZamSuccess(''), 4000); }} />}

      {/* Import Preview Modal */}
      {previewRows && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setPreviewRows(null); setPendingFile(null); }} />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import Önizleme</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {previewRows.length} satır ·{' '}
                  <span className="text-red-600 font-medium">{previewRows.filter(r => r.errors.length > 0).length} hatalı</span> ·{' '}
                  <span className="text-green-600 font-medium">{previewRows.filter(r => r.errors.length === 0).length} geçerli</span>
                </p>
              </div>
              <button type="button" onClick={() => { setPreviewRows(null); setPendingFile(null); }} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Grup Kodu</th>
                    <th className="text-left px-3 py-2">Grup Adı</th>
                    <th className="text-left px-3 py-2">Alt Grup Kodu</th>
                    <th className="text-left px-3 py-2">Alt Grup Adı</th>
                    <th className="text-left px-3 py-2">Birim</th>
                    <th className="text-right px-3 py-2">Fiyat</th>
                    <th className="text-left px-3 py-2">Hatalar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previewRows.map(row => (
                    <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50' : 'bg-white hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-400">{row.rowIndex}</td>
                      <td className={`px-3 py-2 font-mono ${!row.groupCode ? 'text-red-500' : 'text-slate-700'}`}>{row.groupCode || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.groupName || '—'}</td>
                      <td className={`px-3 py-2 font-mono ${!row.subGroupCode ? 'text-red-500' : 'text-slate-700'}`}>{row.subGroupCode || '—'}</td>
                      <td className={`px-3 py-2 ${!row.subGroupName ? 'text-red-500' : 'text-slate-700'}`}>{row.subGroupName || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.unitType || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">{row.unitPrice != null ? row.unitPrice.toLocaleString('tr-TR') : <span className="text-slate-300">0</span>}</td>
                      <td className="px-3 py-2">
                        {row.errors.length > 0
                          ? <span className="text-red-600 font-medium">{row.errors.join(', ')}</span>
                          : <span className="text-green-500">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
              {previewRows.some(r => r.errors.length > 0) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Hatalı satırlar yükleme sırasında atlanabilir. Devam etmek istiyor musunuz?
                </p>
              )}
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => { setPreviewRows(null); setPendingFile(null); }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">İptal</button>
                <button type="button" onClick={confirmImport} disabled={uploading} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {uploading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {uploading ? 'Yükleniyor...' : `${previewRows.filter(r => r.errors.length === 0).length} Geçerli Satırı Yükle`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bölgeler ──────────────────────────────────────────────────────────────────

function BolgelerTab() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRegions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/regions`, { headers: authHeader() });
      const data: Region[] = res.data.data ?? res.data ?? [];
      // If no regions exist, bootstrap with Turkish regions
      if (data.length === 0) {
        setRegions(TR_REGIONS.map((r, i) => ({ id: `r-${i}`, name: r.name, code: r.code, isActive: true, latestAdjustment: null })));
      } else {
        setRegions(data);
      }
    } catch {
      setRegions(TR_REGIONS.map((r, i) => ({ id: `r-${i}`, name: r.name, code: r.code, isActive: true, latestAdjustment: null })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRegions(); }, [fetchRegions]);

  const toggleActive = async (r: Region) => {
    setSaving(r.id); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/regions/${r.id}`, { isActive: !r.isActive }, { headers: authHeader() });
      setRegions(prev => prev.map(x => x.id === r.id ? { ...x, isActive: !x.isActive } : x));
    } catch { setError('Güncelleme başarısız.'); }
    finally { setSaving(null); }
  };

  const clr = (code: string) => REGION_COLORS[code] ?? 'bg-slate-100 text-slate-700';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">Bölgeler</h2>
        <p className="text-sm text-slate-500 mt-0.5">Türkiye'nin 7 coğrafi bölgesini yönetin.</p>
      </div>
      <div className="px-6 py-5">
        {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
        {success && <SuccessAlert msg={success} />}
        {loading ? <RowSkeleton /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {regions.map(r => (
              <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${r.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/50 opacity-60'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${clr(r.code)}`}>{r.code}</span>
                    <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                  </div>
                  {r.latestAdjustment ? (
                    <p className="text-xs text-slate-400">
                      Son zam: %{r.latestAdjustment.adjustmentPercent} · {new Date(r.latestAdjustment.effectiveDate).toLocaleDateString('tr-TR')}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300">Henüz zam uygulanmamış</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={saving === r.id}
                  onClick={() => toggleActive(r)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${r.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${r.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Zam Geçmişi ───────────────────────────────────────────────────────────────

function ZamGecmisiTab() {
  const [history, setHistory] = useState<ZamHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/price-adjustments?limit=50`, { headers: authHeader() });
      setHistory(res.data.data ?? []);
    } catch { /* keep existing history */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const fmtDate = (d: string) => new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">Zam Geçmişi</h2>
        <p className="text-sm text-slate-500 mt-0.5">Uygulanan tüm genel ve bölgesel zamların kaydı.</p>
      </div>
      <div className="px-6 py-5">
        {loading ? <RowSkeleton /> : history.length === 0 ? (
          <EmptyState msg="Henüz zam uygulanmamış." />
        ) : (
          <div className="space-y-3">
            {history.map(h => (
              <div key={h.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${h.type === 'global' ? 'bg-amber-100' : 'bg-purple-100'}`}>
                  <span className="text-base">{h.type === 'global' ? '🌐' : '🗺️'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${h.type === 'global' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                      {h.type === 'global' ? 'Genel Zam' : 'Bölgesel Zam'}
                    </span>
                    {h.adjustmentPercent != null && (
                      <span className="text-sm font-bold text-slate-800">%{h.adjustmentPercent}</span>
                    )}
                  </div>
                  {h.type === 'regional' && h.regionalRates && (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {Object.entries(h.regionalRates).map(([code, rate]) => (
                        <span key={code} className={`px-2 py-0.5 rounded text-xs font-medium ${REGION_COLORS[code] ?? 'bg-slate-100 text-slate-600'}`}>
                          {code} %{rate}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{fmtDate(h.appliedAt)}</span>
                    {h.appliedBy && <span>· {h.appliedBy}</span>}
                    {h.notes && <span>· {h.notes}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Regional Zam Modal ────────────────────────────────────────────────────────

function RegionalZamModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApply = async () => {
    const parsed: Record<string, number> = {};
    for (const [code, v] of Object.entries(rates)) {
      if (!v.trim()) continue;
      const n = parseFloat(v);
      if (isNaN(n) || n <= 0 || n > 200) { setError(`${code} için geçerli bir oran girin (1-200).`); return; }
      parsed[code] = n;
    }
    if (Object.keys(parsed).length === 0) { setError('En az bir bölge için oran girin.'); return; }
    setApplying(true); setError('');
    try {
      await axios.post(`${API}/price-adjustments/regional`, { regionalRates: parsed, notes: 'Bölgesel zam' }, { headers: authHeader() });
      onApplied();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Zam uygulanırken hata oluştu.');
    } finally { setApplying(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Bölge Bazlı Zam Uygula</h3>
            <p className="text-xs text-slate-400 mt-0.5">Her bölge için ayrı zam oranı belirleyin. Boş bırakılanlar atlanır.</p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            {TR_REGIONS.map(r => (
              <div key={r.code} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-48 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${REGION_COLORS[r.code] ?? 'bg-slate-100 text-slate-700'}`}>{r.code}</span>
                  <span className="text-sm text-slate-700">{r.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    className={`${inputCls} w-28`}
                    type="number"
                    min="0"
                    max="200"
                    step="0.1"
                    placeholder="% oran"
                    value={rates[r.code] ?? ''}
                    onChange={(e) => setRates(p => ({ ...p, [r.code]: e.target.value }))}
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
          <button type="button" onClick={() => setShowConfirm(true)} className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors">
            Uygula
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Bölgesel Zam Uygula"
          message="Seçili bölgelere belirlediğiniz oranları uygulamak istediğinize emin misiniz?"
          loading={applying}
          onConfirm={handleApply}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, loading, onConfirm, onCancel, confirmLabel, danger }: { title: string; message: string; loading: boolean; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {loading ? 'İşleniyor...' : (confirmLabel ?? 'Onayla')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2 animate-pulse">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
    </div>
  );
}

function RowSkeleton() {
  return <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}</div>;
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      </div>
      <p className="text-sm text-slate-500">{msg}</p>
    </div>
  );
}

function ErrorAlert({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function SuccessAlert({ msg }: { msg: string }) {
  return (
    <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      {msg}
    </div>
  );
}
