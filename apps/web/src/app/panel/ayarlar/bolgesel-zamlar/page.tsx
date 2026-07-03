'use client';

import { useEffect, useState, useCallback } from 'react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import {
  SettingsTable,
  SettingsTableHead,
  SettingsTableTh,
  SettingsTableBody,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableActions,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { API, authHeader } from '@/utils/api';


// ─── Tipler ──────────────────────────────────────────────────────────────────
type RegionAdjustment = {
  id: string;
  regionId: string;
  adjustmentPercent: number;
  effectiveDate: string;
  notes?: string;
  createdAt: string;
};

type Region = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  latestAdjustment: RegionAdjustment | null;
};

type HistoryItem = {
  id: string;
  adjustmentPercent: number;
  effectiveDate: string;
  notes?: string;
  createdAt: string;
};

const REGION_COLORS: Record<string, string> = {
  MARMARA: 'bg-blue-100 text-blue-700',
  EGE: 'bg-cyan-100 text-cyan-700',
  AKDENIZ: 'bg-orange-100 text-orange-700',
  IC_ANADOLU: 'bg-slate-100 text-slate-700',
  KARADENIZ: 'bg-emerald-100 text-emerald-700',
  DOGU_ANADOLU: 'bg-purple-100 text-purple-700',
  GUNEYDOGU_ANADOLU: 'bg-rose-100 text-rose-700',
};

export default function BolgeselZamlarPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Tekil zam modal
  const [zamModal, setZamModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [zamForm, setZamForm] = useState({ adjustmentPercent: '', effectiveDate: todayStr(), notes: '' });
  const [zamSaving, setZamSaving] = useState(false);
  const [zamError, setZamError] = useState('');

  // Toplu zam modal
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkForm, setBulkForm] = useState({ adjustmentPercent: '', effectiveDate: todayStr(), notes: '' });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Geçmiş modal
  const [historyModal, setHistoryModal] = useState(false);
  const [historyRegion, setHistoryRegion] = useState<Region | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Veri Yükleme ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/regions`, { headers: authHeader() });
      const json = await res.json();
      setRegions(json.data ?? []);
    } catch {
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Seed ──────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch(`${API}/regions/seed`, { method: 'POST', headers: authHeader() });
      await load();
    } finally {
      setSeeding(false);
    }
  };

  // ─── Tekil Zam ─────────────────────────────────────────────────────────────
  const openZamModal = (r: Region) => {
    setSelectedRegion(r);
    setZamForm({
      adjustmentPercent: r.latestAdjustment ? String(r.latestAdjustment.adjustmentPercent) : '',
      effectiveDate: todayStr(),
      notes: '',
    });
    setZamError('');
    setZamModal(true);
  };

  const saveZam = async () => {
    if (!selectedRegion) return;
    const pct = Number(zamForm.adjustmentPercent);
    if (isNaN(pct)) { setZamError('Geçerli bir yüzde değeri girin'); return; }
    if (!zamForm.effectiveDate) { setZamError('Geçerlilik tarihi zorunludur'); return; }
    setZamSaving(true); setZamError('');
    try {
      const res = await fetch(`${API}/regions/${selectedRegion.id}/adjustment`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustmentPercent: pct, effectiveDate: zamForm.effectiveDate, notes: zamForm.notes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Hata oluştu');
      setZamModal(false);
      await load();
    } catch (e: any) {
      setZamError(e.message ?? 'Kayıt başarısız');
    } finally {
      setZamSaving(false);
    }
  };

  // ─── Toplu Zam ─────────────────────────────────────────────────────────────
  const openBulkModal = () => {
    setBulkSelected(new Set(regions.map((r) => r.id)));
    setBulkForm({ adjustmentPercent: '', effectiveDate: todayStr(), notes: '' });
    setBulkError('');
    setBulkModal(true);
  };

  const toggleBulkRegion = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveBulk = async () => {
    if (bulkSelected.size === 0) { setBulkError('En az bir bölge seçin'); return; }
    const pct = Number(bulkForm.adjustmentPercent);
    if (isNaN(pct)) { setBulkError('Geçerli bir yüzde değeri girin'); return; }
    if (!bulkForm.effectiveDate) { setBulkError('Geçerlilik tarihi zorunludur'); return; }
    setBulkSaving(true); setBulkError('');
    try {
      const res = await fetch(`${API}/regions/bulk-adjustment`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionIds: Array.from(bulkSelected),
          adjustmentPercent: pct,
          effectiveDate: bulkForm.effectiveDate,
          notes: bulkForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Hata oluştu');
      setBulkModal(false);
      await load();
    } catch (e: any) {
      setBulkError(e.message ?? 'Kayıt başarısız');
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── Zam Geçmişi ───────────────────────────────────────────────────────────
  const openHistory = async (r: Region) => {
    setHistoryRegion(r);
    setHistoryLoading(true);
    setHistoryModal(true);
    try {
      const res = await fetch(`${API}/regions/${r.id}/adjustment-history`, { headers: authHeader() });
      const json = await res.json();
      setHistory(json.data?.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fmtPct = (p: number) => `%${p > 0 ? '+' : ''}${p}`;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SettingsPageLayout
      title="Bölgesel Zamlar"
      description="Türkiye bölgelerine göre yüzdelik zam oranı tanımlayın. Zam uygulandığında: baz fiyat × (1 + zam oranı) = nihai fiyat."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          {regions.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {seeding ? 'Yükleniyor...' : '7 Bölgeyi Yükle'}
            </button>
          )}
          {regions.length > 0 && (
            <button
              onClick={openBulkModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Toplu Zam Uygula
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : regions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Henüz bölge tanımlanmamış</p>
          <p className="text-xs text-slate-400 mb-4">Türkiye&apos;nin 7 coğrafi bölgesini eklemek için düğmeye tıklayın.</p>
          <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            {seeding ? 'Yükleniyor...' : '7 Bölgeyi Yükle'}
          </button>
        </div>
      ) : (
        <>
          {/* Özet kartları */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Toplam Bölge</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{regions.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Zam Tanımlı</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{regions.filter((r) => r.latestAdjustment).length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Ortalama Zam</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {regions.filter((r) => r.latestAdjustment).length > 0
                  ? `%${(regions.reduce((s, r) => s + (r.latestAdjustment ? Number(r.latestAdjustment.adjustmentPercent) : 0), 0) / regions.filter((r) => r.latestAdjustment).length).toFixed(1)}`
                  : '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">En Yüksek Zam</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {regions.some((r) => r.latestAdjustment)
                  ? `%${Math.max(...regions.filter((r) => r.latestAdjustment).map((r) => Number(r.latestAdjustment!.adjustmentPercent)))}`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Tablo */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <SettingsTable>
              <SettingsTableHead>
                <SettingsTableTh>Bölge</SettingsTableTh>
                <SettingsTableTh>Mevcut Zam Oranı</SettingsTableTh>
                <SettingsTableTh>Son Geçerlilik Tarihi</SettingsTableTh>
                <SettingsTableTh>İşlemler</SettingsTableTh>
              </SettingsTableHead>
              <SettingsTableBody>
                {regions.map((r) => (
                  <SettingsTableRow key={r.id}>
                    <SettingsTableTd>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${REGION_COLORS[r.code] ?? 'bg-slate-100 text-slate-700'}`}>
                        {r.name}
                      </span>
                    </SettingsTableTd>
                    <SettingsTableTd>
                      {r.latestAdjustment ? (
                        <span className={`text-sm font-bold ${Number(r.latestAdjustment.adjustmentPercent) > 0 ? 'text-emerald-600' : Number(r.latestAdjustment.adjustmentPercent) < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {fmtPct(Number(r.latestAdjustment.adjustmentPercent))}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Tanımlı değil</span>
                      )}
                    </SettingsTableTd>
                    <SettingsTableTd>
                      {r.latestAdjustment ? (
                        <span className="text-sm text-slate-600">{fmtDate(r.latestAdjustment.effectiveDate)}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </SettingsTableTd>
                    <SettingsTableTd>
                      <SettingsTableActions>
                        <button
                          onClick={() => openHistory(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Geçmiş
                        </button>
                        <button
                          onClick={() => openZamModal(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                          </svg>
                          Zam Uygula
                        </button>
                      </SettingsTableActions>
                    </SettingsTableTd>
                  </SettingsTableRow>
                ))}
              </SettingsTableBody>
            </SettingsTable>
          </div>
        </>
      )}

      {/* Tekil Zam Modal */}
      <SettingsModal
        isOpen={zamModal}
        onClose={() => setZamModal(false)}
        title={`${selectedRegion?.name ?? ''} — Zam Uygula`}
        onSave={saveZam}
        saving={zamSaving}
        saveLabel="Zam Uygula"
      >
        <div className="space-y-4">
          {zamError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{zamError}</div>
          )}
          {selectedRegion?.latestAdjustment && (
            <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              Mevcut oran: <strong>{fmtPct(Number(selectedRegion.latestAdjustment.adjustmentPercent))}</strong>
              {' '}({fmtDate(selectedRegion.latestAdjustment.effectiveDate)} tarihli)
            </div>
          )}
          <div>
            <label className={labelCls}>Zam Oranı (%) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <div className="relative">
              <input
                type="number"
                className={inputCls}
                value={zamForm.adjustmentPercent}
                onChange={(e) => setZamForm((f) => ({ ...f, adjustmentPercent: e.target.value }))}
                placeholder="15"
                step="0.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Pozitif değer = zam artışı. Örn: 15 → baz fiyat × 1.15</p>
          </div>
          <div>
            <label className={labelCls}>Geçerlilik Tarihi <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <TrDateInput className={inputCls} value={zamForm.effectiveDate} onChange={(effectiveDate) => setZamForm((f) => ({ ...f, effectiveDate }))} />
          </div>
          <div>
            <label className={labelCls}>Not</label>
            <input className={inputCls} value={zamForm.notes} onChange={(e) => setZamForm((f) => ({ ...f, notes: e.target.value }))} placeholder="İsteğe bağlı açıklama" />
          </div>
        </div>
      </SettingsModal>

      {/* Toplu Zam Modal */}
      <SettingsModal
        isOpen={bulkModal}
        onClose={() => setBulkModal(false)}
        title="Toplu Zam Uygula"
        onSave={saveBulk}
        saving={bulkSaving}
        saveLabel="Seçili Bölgelere Uygula"
      >
        <div className="space-y-4">
          {bulkError && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{bulkError}</div>
          )}

          {/* Bölge seçimi */}
          <div>
            <label className={labelCls}>Bölge Seçimi</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {regions.map((r) => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(r.id)}
                    onChange={() => toggleBulkRegion(r.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{r.name}</span>
                  {r.latestAdjustment && (
                    <span className="ml-auto text-xs text-slate-400">{fmtPct(Number(r.latestAdjustment.adjustmentPercent))}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={() => setBulkSelected(new Set(regions.map((r) => r.id)))} className="text-xs text-blue-600 hover:underline">Tümünü Seç</button>
              <span className="text-slate-300">|</span>
              <button type="button" onClick={() => setBulkSelected(new Set())} className="text-xs text-slate-500 hover:underline">Seçimi Kaldır</button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Zam Oranı (%) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <div className="relative">
              <input
                type="number"
                className={inputCls}
                value={bulkForm.adjustmentPercent}
                onChange={(e) => setBulkForm((f) => ({ ...f, adjustmentPercent: e.target.value }))}
                placeholder="15"
                step="0.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Geçerlilik Tarihi <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <TrDateInput className={inputCls} value={bulkForm.effectiveDate} onChange={(effectiveDate) => setBulkForm((f) => ({ ...f, effectiveDate }))} />
          </div>
          <div>
            <label className={labelCls}>Not</label>
            <input className={inputCls} value={bulkForm.notes} onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Toplu zam açıklaması" />
          </div>

          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <strong>{bulkSelected.size}</strong> bölgeye {bulkForm.adjustmentPercent ? `%${bulkForm.adjustmentPercent}` : '—'} oranında zam uygulanacak.
          </div>
        </div>
      </SettingsModal>

      {/* Geçmiş Modal */}
      <SettingsModal
        isOpen={historyModal}
        onClose={() => setHistoryModal(false)}
        title={`${historyRegion?.name ?? ''} — Zam Geçmişi`}
      >
        <div className="min-h-[200px]">
          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">Bu bölge için henüz zam kaydı yok.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${Number(h.adjustmentPercent) > 0 ? 'bg-emerald-100 text-emerald-700' : Number(h.adjustmentPercent) < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {fmtPct(Number(h.adjustmentPercent))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">Geçerlilik: {fmtDate(h.effectiveDate)}</p>
                    {h.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{h.notes}</p>}
                  </div>
                  {i === 0 && (
                    <span className="shrink-0 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Güncel</span>
                  )}
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsModal>
    </SettingsPageLayout>
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
