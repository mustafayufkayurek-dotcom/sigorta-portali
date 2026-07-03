'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { TrDateInput } from '@/components/ui/TrDateInput';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import { OnlineCollectionLinksPanel } from '@/components/finance/OnlineCollectionLinksPanel';
import {
  FinansActionButton,
  FinansDataTable,
  FinansEmptyState,
  FinansFieldLabel,
  FinansFormPanel,
  FinansFormSection,
  FinansKpiStrip,
  FinansPanelCard,
  finansFileInputClass,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { useToast } from '@/contexts/ToastContext';
import SpeechToText from '@/components/SpeechToText';
import { API, authHeader, fmtCurrency, fmtDate } from '../claim-detail-utils';
import { VendorSuggestPanel } from '../VendorSuggestPanel';

export function ButceTab({ claimId, claimCity }: { claimId: string; claimCity?: string }) {
  const { showToast } = useToast();
  const [versions, setVersions] = useState<any[]>([]);
  const [costEntries, setCostEntries] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [expenseCategoryTree, setExpenseCategoryTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [itemForm, setItemForm] = useState({ vendorId: '', category: 'labor', description: '', unit: 'adet', quantity: '1', unitPrice: '', vatRate: '18' });
  const [costForm, setCostForm] = useState({ vendorId: '', category: 'labor', expenseCategoryParentId: '', expenseCategoryId: '', description: '', amount: '', vatRate: '18', entryDate: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [itemManualVendor, setItemManualVendor] = useState(false);
  const [costManualVendor, setCostManualVendor] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);

  const CATEGORIES: Record<string, string> = { labor: 'İşçilik', material: 'Malzeme', subcontractor: 'Taşeron', logistics: 'Lojistik', equipment: 'Ekipman' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes, vndRes, ecRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/budget-versions`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/cost-entries`, { headers: authHeader() }),
        axios.get(`${API}/vendors?status=active&limit=100`, { headers: authHeader() }),
        axios.get(`${API}/expense-categories`, { headers: authHeader() }),
      ]);
      const loadedVersions = vRes.data.data || [];
      setVersions(loadedVersions);
      setCostEntries(cRes.data.data || []);
      setVendors(vndRes.data.data || []);
      setExpenseCategoryTree(ecRes.data.data || []);
      setActiveVersionId((prev) => {
        if (prev && loadedVersions.some((v: any) => v.id === prev)) return prev;
        const approved = loadedVersions.find((v: any) => v.status === 'approved');
        return approved?.id ?? loadedVersions[0]?.id ?? null;
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const ensureBudgetVersion = async (): Promise<string | null> => {
    if (activeVersionId) return activeVersionId;
    try {
      const res = await axios.post(`${API}/claim-files/${claimId}/budget-versions`, {}, { headers: authHeader() });
      const newId = res.data?.data?.id;
      if (newId) {
        setActiveVersionId(newId);
        await load();
        return newId;
      }
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Bütçe oluşturulamadı');
    }
    return null;
  };

  const handleSubmitVersion = async (id: string) => {
    try {
      await axios.post(`${API}/budget-versions/${id}/submit`, {}, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleReviewVersion = async (id: string, status: string) => {
    try {
      await axios.post(`${API}/budget-versions/${id}/review`, { status }, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleAddItem = async () => {
    const versionId = activeVersionId ?? await ensureBudgetVersion();
    if (!versionId) return;
    setSaving(true);
    try {
      await axios.post(`${API}/budget-versions/${versionId}/items`, {
        ...itemForm,
        quantity: parseFloat(itemForm.quantity),
        unitPrice: parseFloat(itemForm.unitPrice),
        vatRate: parseFloat(itemForm.vatRate),
        vendorId: itemForm.vendorId || undefined,
      }, { headers: authHeader() });
      setShowItemModal(false);
      setItemForm({ vendorId: '', category: 'labor', description: '', unit: 'adet', quantity: '1', unitPrice: '', vatRate: '18' });
      load();
      showToast('success', 'Bütçe Kalemi Eklendi');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Kalem eklenemedi');
    } finally { setSaving(false); }
  };

  const handleAddCost = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/claim-files/${claimId}/cost-entries`, {
        vendorId: costForm.vendorId || undefined,
        category: costForm.category,
        expenseCategoryId: costForm.expenseCategoryId || undefined,
        description: costForm.description,
        amount: parseFloat(costForm.amount),
        vatRate: parseFloat(costForm.vatRate),
        entryDate: costForm.entryDate,
      }, { headers: authHeader() });
      setShowCostModal(false);
      setCostForm({ vendorId: '', category: 'labor', expenseCategoryParentId: '', expenseCategoryId: '', description: '', amount: '', vatRate: '18', entryDate: new Date().toISOString().split('T')[0] });
      load();
      showToast('success', 'Maliyet Kaydedildi');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Maliyet eklenemedi');
    } finally { setSaving(false); }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await axios.delete(`${API}/budget-items/${itemId}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleRemoveCost = async (id: string) => {
    try {
      await axios.delete(`${API}/cost-entries/${id}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="text-slate-400 py-8 text-center text-sm">Yükleniyor…</div>;

  const activeVersion = versions.find((v) => v.id === activeVersionId);
  const totalBudget = activeVersion?.totalAmount ?? 0;
  const totalCosts = costEntries.reduce((s: number, c: any) => s + c.amount, 0);
  const variance = totalCosts - totalBudget;

  const versionStatusLabel: Record<string, string> = {
    draft: 'Taslak',
    submitted: 'Onay Bekliyor',
    revision: 'Revizyon',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
  };

  return (
    <div className="space-y-4">
      <FinansKpiStrip
        items={[
          { label: 'Toplam Bütçe', value: fmtCurrency(totalBudget), accent: 'text-blue-400' },
          { label: 'Toplam Gerçekleşen', value: fmtCurrency(totalCosts), accent: 'text-amber-400' },
          {
            label: 'Fark',
            value: `${variance >= 0 ? '+' : ''}${fmtCurrency(variance)}`,
            accent: variance > 0 ? 'text-red-400' : variance < 0 ? 'text-emerald-400' : 'text-white',
          },
        ]}
      />

      <FinansPanelCard
        title="Bütçe Kalemleri"
        subtitle={
          activeVersion
            ? `Planlanan · sürüm ${activeVersion.versionNo} · ${versionStatusLabel[activeVersion.status] ?? activeVersion.status}`
            : 'Dosya bütçe planı — kalemler ve iç onay akışı'
        }
        action={{
          label: 'Kalem Ekle',
          onClick: async () => {
            if (!activeVersionId) {
              const id = await ensureBudgetVersion();
              if (!id) return;
            }
            setShowItemModal(true);
          },
          variant: 'primary',
        }}
      >
        {!activeVersion ? (
          <FinansEmptyState
            title="Henüz Bütçe Oluşturulmadı"
            description="İlk bütçe kalemini eklemek için Bütçe Başlat veya Kalem Ekle kullanın."
          />
        ) : (
          <>
            {['draft', 'revision'].includes(activeVersion.status) && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <p className="text-xs text-slate-500 flex-1 min-w-[200px]">
                  Bütçe taslağı hazır — yönetici onayına gönderin.
                </p>
                <FinansActionButton
                  label="Onaya Gönder"
                  onClick={() => handleSubmitVersion(activeVersion.id)}
                  variant="success"
                />
              </div>
            )}
            {activeVersion.status === 'submitted' && (
              <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                <p className="text-xs text-blue-800 w-full mb-1">Yönetici onayı bekleniyor</p>
                <FinansActionButton label="Onayla" onClick={() => handleReviewVersion(activeVersion.id, 'approved')} variant="success" />
                <FinansActionButton label="Reddet" onClick={() => handleReviewVersion(activeVersion.id, 'rejected')} variant="neutral" />
                <FinansActionButton label="Revizyon İste" onClick={() => handleReviewVersion(activeVersion.id, 'revision')} variant="neutral" />
              </div>
            )}

            <p className="text-xs text-slate-500 mb-3">
              Planlanan toplam: <span className="font-semibold text-slate-700">{fmtCurrency(activeVersion.totalAmount)}</span>
            </p>

            {!activeVersion.items?.length ? (
              <FinansEmptyState
                title="Henüz Kalem Eklenmedi"
                description="İlk bütçe kalemini eklemek için Kalem Ekle butonunu kullanın."
              />
            ) : (
              <FinansDataTable>
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2.5">Açıklama</th>
                    <th className="text-left px-3 py-2.5">Kategori</th>
                    <th className="text-right px-3 py-2.5">Miktar</th>
                    <th className="text-right px-3 py-2.5">Birim Fiyat</th>
                    <th className="text-right px-3 py-2.5">KDV</th>
                    <th className="text-right px-3 py-2.5">Toplam</th>
                    <th className="px-3 py-2.5 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeVersion.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{item.description}</td>
                      <td className="px-3 py-2.5 text-slate-500">{CATEGORIES[item.category] ?? item.category}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">%{item.vatRate}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtCurrency(item.totalAmount)}</td>
                      <td className="px-3 py-2.5">
                        {['draft', 'revision'].includes(activeVersion.status) && (
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Sil</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </FinansDataTable>
            )}
          </>
        )}

        {!activeVersion && (
          <div className="mt-3 flex justify-center">
            <FinansActionButton label="Bütçe Başlat" onClick={() => ensureBudgetVersion()} variant="primary" />
          </div>
        )}
      </FinansPanelCard>

      <FinansPanelCard
        title="Gerçekleşen Maliyetler"
        subtitle="Dosyada fiilen oluşan gider kayıtları — operasyon ve finans takibi"
        action={{
          label: 'Maliyet Ekle',
          onClick: () => setShowCostModal(true),
          variant: 'primary',
        }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={groupByCategory}
              onChange={(e) => setGroupByCategory(e.target.checked)}
            />
            Kategoriye Göre Grupla
          </label>
          <span className="text-xs text-slate-500">
            Toplam: <span className="font-semibold tabular-nums text-slate-800">{fmtCurrency(totalCosts)}</span>
          </span>
        </div>

        {!costEntries.length ? (
          <FinansEmptyState
            title="Maliyet Kaydı Bulunamadı"
            description="Saha gideri, malzeme veya tedarikçi maliyeti eklemek için Maliyet Ekle butonunu kullanın."
          />
        ) : groupByCategory ? (
            (() => {
              // Kategoriye göre grupla
              type GroupMap = Record<string, { parentName: string; parentId: string; children: Record<string, { childName: string; entries: any[] }> }>;
              const groups: GroupMap = {};
              const noCategory: any[] = [];
              for (const c of costEntries) {
                if (!c.expenseCategory) {
                  noCategory.push(c);
                } else {
                  const parent = c.expenseCategory.parent ?? c.expenseCategory;
                  const child = c.expenseCategory.parent ? c.expenseCategory : null;
                  const pid = parent.id;
                  const cid = child?.id ?? '__direct__';
                  if (!groups[pid]) groups[pid] = { parentName: parent.name, parentId: pid, children: {} };
                  if (!groups[pid].children[cid]) groups[pid].children[cid] = { childName: child?.name ?? parent.name, entries: [] };
                  groups[pid].children[cid].entries.push(c);
                }
              }
              return (
                <div className="space-y-4">
                  {Object.values(groups).map((group) => {
                    const groupTotal = Object.values(group.children).flatMap(ch => ch.entries).reduce((s: number, e: any) => s + e.amount, 0);
                    return (
                      <div key={group.parentId} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between">
                          <span className="text-sm font-semibold text-orange-800">{group.parentName}</span>
                          <span className="text-sm font-bold text-orange-700">{fmtCurrency(groupTotal)}</span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-50">
                            {Object.values(group.children).map((ch) =>
                              ch.entries.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2 text-xs text-slate-400 w-36">{ch.childName}</td>
                                  <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                                  <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                                  <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                                  <td className="px-3 py-2">
                                    <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  {noCategory.length > 0 && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Kategorisiz</span>
                        <span className="text-sm font-bold text-slate-500">{fmtCurrency(noCategory.reduce((s: number, e: any) => s + e.amount, 0))}</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {noCategory.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-xs text-slate-400 w-36">{CATEGORIES[c.category] ?? c.category}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                              <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                              <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                              <td className="px-3 py-2">
                                <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-700">Genel Toplam: {fmtCurrency(totalCosts)}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="text-left px-3 py-2">Tarih</th>
                  <th className="text-left px-3 py-2">Açıklama</th>
                  <th className="text-left px-3 py-2">Kategori</th>
                  <th className="text-left px-3 py-2">Tedarikçi</th>
                  <th className="text-right px-3 py-2">Tutar</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {costEntries.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {c.expenseCategory
                        ? (c.expenseCategory.parent ? `${c.expenseCategory.parent.name} › ${c.expenseCategory.name}` : c.expenseCategory.name)
                        : (CATEGORIES[c.category] ?? c.category)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </FinansPanelCard>

      {/* Kalem Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Bütçe Kalemi Ekle</h3>
            <div className="space-y-3">
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.category} onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input placeholder="Açıklama" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setItemForm((p) => ({ ...p, description: v })); }} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Miktar" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.quantity} onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))} />
                <input placeholder="Birim (Adet, m², vb.)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))} />
                <input placeholder="Birim Fiyat (₺)" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.unitPrice} onChange={(e) => setItemForm((p) => ({ ...p, unitPrice: e.target.value }))} />
                <input placeholder="KDV %" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.vatRate} onChange={(e) => setItemForm((p) => ({ ...p, vatRate: e.target.value }))} />
              </div>
              {itemManualVendor ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500">Tedarikçi (Manuel)</label>
                    <button type="button" onClick={() => setItemManualVendor(false)} className="text-xs text-indigo-600 hover:underline">Önerilerden Seç</button>
                  </div>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.vendorId} onChange={(e) => setItemForm((p) => ({ ...p, vendorId: e.target.value }))}>
                    <option value="">Tedarikçi Seçin (Opsiyonel)</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ) : (
                <VendorSuggestPanel
                  city={claimCity}
                  category={itemForm.category}
                  selectedVendorId={itemForm.vendorId}
                  onSelect={(vid) => setItemForm((p) => ({ ...p, vendorId: vid }))}
                  onManual={() => setItemManualVendor(true)}
                />
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleAddItem} disabled={saving || !itemForm.description || !itemForm.unitPrice} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Ekle'}
              </button>
              <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Maliyet Modal */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Gerçekleşen Maliyet Ekle</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tarih</label>
                <TrDateInput className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full" value={costForm.entryDate} onChange={(entryDate) => setCostForm((p) => ({ ...p, entryDate }))} />
              </div>
              {expenseCategoryTree.length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ana Kategori</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      value={costForm.expenseCategoryParentId}
                      onChange={(e) => setCostForm((p) => ({ ...p, expenseCategoryParentId: e.target.value, expenseCategoryId: '' }))}
                    >
                      <option value="">— Seçiniz —</option>
                      {expenseCategoryTree.map((cat: any) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  {costForm.expenseCategoryParentId && (() => {
                    const parent = expenseCategoryTree.find((c: any) => c.id === costForm.expenseCategoryParentId);
                    const children: any[] = parent?.children ?? [];
                    if (children.length === 0) return null;
                    return (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Alt Kategori</label>
                        <select
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          value={costForm.expenseCategoryId}
                          onChange={(e) => setCostForm((p) => ({ ...p, expenseCategoryId: e.target.value }))}
                        >
                          <option value="">— Seçiniz —</option>
                          {children.map((ch: any) => (
                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Kategori</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.category} onChange={(e) => setCostForm((p) => ({ ...p, category: e.target.value }))}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Açıklama</label>
                <div className="relative flex items-center gap-1">
                  <input placeholder="Açıklama" className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-12 text-sm" value={costForm.description} onChange={(e) => setCostForm((p) => ({ ...p, description: e.target.value }))} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setCostForm((p) => ({ ...p, description: v })); }} />
                  <div className="absolute right-1.5">
                    <SpeechToText
                      size="sm"
                      onTranscript={(text) => setCostForm((p) => ({ ...p, description: p.description ? p.description + ' ' + text : text }))}
                    />
                  </div>
                </div>
              </div>
              {costManualVendor ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500">Tedarikçi (Manuel)</label>
                    <button type="button" onClick={() => setCostManualVendor(false)} className="text-xs text-indigo-600 hover:underline">Önerilerden Seç</button>
                  </div>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.vendorId} onChange={(e) => setCostForm((p) => ({ ...p, vendorId: e.target.value }))}>
                    <option value="">Tedarikçi Seçin (Opsiyonel)</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ) : (
                <VendorSuggestPanel
                  city={claimCity}
                  category={costForm.category}
                  selectedVendorId={costForm.vendorId}
                  onSelect={(vid) => setCostForm((p) => ({ ...p, vendorId: vid }))}
                  onManual={() => setCostManualVendor(true)}
                />
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">KDV Oranı (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm"
                    value={costForm.vatRate}
                    onChange={(e) => setCostForm((p) => ({ ...p, vatRate: e.target.value }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tutar (₺)</label>
                <input type="number" min="0" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.amount} onChange={(e) => setCostForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleAddCost} disabled={saving || !costForm.description || !costForm.amount || !costForm.entryDate} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Ekle'}
              </button>
              <button type="button" onClick={() => setShowCostModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INVOICE_TYPE_LABEL: Record<string, string> = { sales: 'Satış', purchase: 'Alış' };
const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', partial: 'Kısmi', cancelled: 'İptal', overdue: 'Vadesi Geçti',
};
const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700', overdue: 'bg-red-200 text-red-800',
};

export function FaturalarTab({ claimId, claim }: { claimId: string; claim: any }) {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoiceType: 'sales',
    counterpartyType: 'insurance_company',
    currency: 'TRY',
    subtotalAmount: '',
    vatRate: '20',
    invoiceDate: new Date().toISOString().substring(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const computedAmounts = useMemo(() => {
    const subtotal = parseFloat(form.subtotalAmount) || 0;
    const rate = parseFloat(form.vatRate) || 0;
    const vatAmount = Math.round(subtotal * rate / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
    return { subtotal, vatAmount, totalAmount };
  }, [form.subtotalAmount, form.vatRate]);

  const resetForm = () => ({
    invoiceType: 'sales',
    counterpartyType: 'insurance_company',
    currency: 'TRY',
    subtotalAmount: '',
    vatRate: '20',
    invoiceDate: new Date().toISOString().substring(0, 10),
    notes: '',
  });

  const validateInvoiceForm = (): string | null => {
    if (!form.invoiceDate) return 'Fatura Tarihi Zorunludur';
    if (!form.subtotalAmount || computedAmounts.subtotal <= 0) return 'Ara Toplam Sıfırdan Büyük Olmalıdır';
    if (computedAmounts.totalAmount <= 0) return 'Genel Toplam Geçersiz';
    const expectedTotal = Math.round((computedAmounts.subtotal + computedAmounts.vatAmount) * 100) / 100;
    if (Math.abs(expectedTotal - computedAmounts.totalAmount) > 0.01) return 'Tutar Hesaplaması Tutarsız';
    return null;
  };

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/claim-files/${claimId}/invoices`, { headers: authHeader() })
      .then((r) => setInvoices(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const validationError = validateInvoiceForm();
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/invoices`, {
        invoiceType: form.invoiceType,
        counterpartyType: form.counterpartyType,
        currency: form.currency,
        invoiceDate: form.invoiceDate,
        subtotalAmount: computedAmounts.subtotal,
        vatAmount: computedAmounts.vatAmount,
        withholdingAmount: 0,
        totalAmount: computedAmounts.totalAmount,
        notes: form.notes.trim() || undefined,
        claimFileId: claimId,
      }, { headers: authHeader() });
      setShowForm(false);
      setForm(resetForm());
      load();
      showToast('success', 'Fatura Kaydedildi');
    } catch (e: any) { showToast('error', e?.response?.data?.message ?? 'Hata Oluştu'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await axios.patch(`${API}/invoices/${id}/status`, { status }, { headers: authHeader() });
      load();
    } catch (e: any) { showToast('error', e?.response?.data?.message ?? 'Hata'); }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Yükleniyor…</div>;

  const salesTotal = invoices
    .filter((i) => i.invoiceType === 'sales')
    .reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const purchaseTotal = invoices
    .filter((i) => i.invoiceType === 'purchase')
    .reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const pendingCount = invoices.filter((i) => ['draft', 'sent'].includes(i.status)).length;

  return (
    <div className="space-y-4">
      <FinansPanelCard
        title="Fatura Talebi"
        subtitle="Sigorta şirketine kesilecek fatura için talep oluşturun. Evrak durumunu Evraklar → Özet sekmesinden takip edebilirsiniz."
      >
        <ClosureConditionsPanel
          serviceType="claim"
          entityId={claimId}
          fileNo={claim?.fileNo ?? ''}
          insuranceCompanyId={claim?.insuranceCompanyId}
          insuranceCompanyName={claim?.insuranceCompany?.name}
          totalAmount={claim?.budget?.totalAmount ?? 0}
          workItemsSummary={[]}
          showClosureChecklist={false}
          showInvoiceRequest
          showSurvey
        />
      </FinansPanelCard>

      <FinansPanelCard
        title="Kesilen Faturalar"
        subtitle="Dosyaya bağlı satış ve alış faturaları — durum takibi ve tahsilat bağlantısı"
        action={{
          label: showForm ? 'Formu Kapat' : 'Yeni Fatura',
          onClick: () => setShowForm((v) => !v),
          variant: 'primary',
          active: showForm,
        }}
      >
        <FinansKpiStrip
          items={[
            { label: 'Satış (Gelir)', value: fmtCurrency(salesTotal), accent: 'text-emerald-400' },
            { label: 'Alış (Gider)', value: fmtCurrency(purchaseTotal), accent: 'text-amber-400' },
            {
              label: 'Bekleyen',
              value: String(pendingCount),
              accent: pendingCount > 0 ? 'text-blue-400' : 'text-slate-400',
            },
            {
              label: 'Fatura Sayısı',
              value: String(invoices.length),
              accent: invoices.length > 0 ? 'text-white' : 'text-slate-400',
            },
          ]}
        />

        {showForm && (
          <FinansFormPanel
            title="Yeni Fatura"
            onCancel={() => setShowForm(false)}
            onSubmit={handleSave}
            saving={saving}
          >
            <div className="space-y-4">
              <FinansFormSection title="Fatura Bilgileri">
                <div>
                  <FinansFieldLabel>Fatura Tipi</FinansFieldLabel>
                  <select
                    value={form.invoiceType}
                    onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
                    className={finansInputClass}
                  >
                    <option value="sales">Satış (Gelir)</option>
                    <option value="purchase">Alış (Gider)</option>
                  </select>
                </div>
                <div>
                  <FinansFieldLabel required>Fatura Tarihi</FinansFieldLabel>
                  <TrDateInput
                    value={form.invoiceDate}
                    onChange={(invoiceDate) => setForm({ ...form, invoiceDate })}
                    className={finansInputClass}
                  />
                </div>
                <div>
                  <FinansFieldLabel>Karşı Taraf Tipi</FinansFieldLabel>
                  <select
                    value={form.counterpartyType}
                    onChange={(e) => setForm({ ...form, counterpartyType: e.target.value })}
                    className={finansInputClass}
                  >
                    <option value="insurance_company">Sigorta Şirketi</option>
                    <option value="vendor">Tedarikçi</option>
                    <option value="customer">Müşteri</option>
                  </select>
                </div>
              </FinansFormSection>

              <FinansFormSection title="Tutar Bilgileri">
                <div>
                  <FinansFieldLabel required>Ara Toplam (KDV Hariç)</FinansFieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.subtotalAmount}
                    onChange={(e) => setForm({ ...form, subtotalAmount: e.target.value })}
                    className={finansInputClass}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <FinansFieldLabel>KDV Oranı (%)</FinansFieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.vatRate}
                    onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                    className={finansInputClass}
                  />
                </div>
                <div>
                  <FinansFieldLabel>KDV Tutarı</FinansFieldLabel>
                  <input
                    type="text"
                    readOnly
                    value={fmtCurrency(computedAmounts.vatAmount)}
                    className={`${finansInputClass} bg-slate-50 text-slate-700`}
                  />
                </div>
                <div>
                  <FinansFieldLabel>Genel Toplam</FinansFieldLabel>
                  <input
                    type="text"
                    readOnly
                    value={fmtCurrency(computedAmounts.totalAmount)}
                    className={`${finansInputClass} bg-slate-50 font-semibold text-slate-800`}
                  />
                </div>
              </FinansFormSection>

              <FinansFormSection title="Not">
                <div className="sm:col-span-2">
                  <FinansFieldLabel>Notlar</FinansFieldLabel>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    onBlur={(e) => {
                      const v = toTitleCaseTR(e.target.value.trim());
                      if (v) setForm({ ...form, notes: v });
                    }}
                    className={finansInputClass}
                    placeholder="Opsiyonel"
                  />
                </div>
              </FinansFormSection>
            </div>
          </FinansFormPanel>
        )}

        {invoices.length === 0 ? (
          <FinansEmptyState
            title="Henüz Fatura Eklenmemiş"
            description="Satış veya alış faturası kaydetmek için Yeni Fatura butonunu kullanın."
          />
        ) : (
          <FinansDataTable>
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2.5">Fatura No</th>
                <th className="text-left px-3 py-2.5">Tip</th>
                <th className="text-left px-3 py-2.5">Tarih</th>
                <th className="text-right px-3 py-2.5">Ara Toplam</th>
                <th className="text-right px-3 py-2.5">Toplam</th>
                <th className="text-left px-3 py-2.5">Durum</th>
                <th className="text-left px-3 py-2.5">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{inv.invoiceNo}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.invoiceType === 'sales' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {INVOICE_TYPE_LABEL[inv.invoiceType] ?? inv.invoiceType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtCurrency(inv.subtotalAmount)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">{fmtCurrency(inv.totalAmount)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {inv.status === 'draft' && (
                      <button type="button" onClick={() => handleStatusChange(inv.id, 'sent')} className="text-xs text-blue-600 hover:underline mr-2">
                        Gönder
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button type="button" onClick={() => handleStatusChange(inv.id, 'paid')} className="text-xs text-green-600 hover:underline mr-2">
                        Ödendi
                      </button>
                    )}
                    {!['cancelled', 'paid'].includes(inv.status) && (
                      <button type="button" onClick={() => handleStatusChange(inv.id, 'cancelled')} className="text-xs text-red-500 hover:underline">
                        İptal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </FinansDataTable>
        )}
      </FinansPanelCard>
    </div>
  );
}

const PAYMENT_TYPE_LABEL: Record<string, string> = { incoming: 'Gelen', outgoing: 'Giden' };
const PAYMENT_METHOD_LABEL: Record<string, string> = { eft: 'EFT', havale: 'Havale', credit_card: 'Kredi Kartı', cash: 'Nakit', offset: 'Mahsuplaşma' };

export function TahsilatlarTab({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({
    paymentType: 'incoming',
    method: 'eft',
    payerType: 'insurance_company',
    payerId: '',
    amount: 0,
    currency: 'TRY',
    paymentDate: new Date().toISOString().substring(0, 10),
    status: 'completed',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/claim-files/${claimId}/payments`, { headers: authHeader() }),
      axios.get(`${API}/claim-files/${claimId}/invoices`, { headers: authHeader() }),
      axios.get(`${API}/vendors?limit=200&status=active`, { headers: authHeader() }),
    ]).then(([pr, ir, vr]) => {
      setPayments(pr.data.data ?? []);
      setInvoices(ir.data.data ?? []);
      setVendors(vr.data.data?.vendors ?? vr.data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const uploadReceiptForPayment = async (paymentId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    await axios.post(`${API}/payments/${paymentId}/receipt`, fd, {
      headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleSave = async () => {
    if (form.paymentType === 'outgoing' && form.payerType === 'vendor' && !form.payerId) {
      showToast('error', 'Tedarikçi ödemesi için tedarikçi seçiniz');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, claimFileId: claimId };
      if (payload.payerType !== 'vendor') delete payload.payerId;
      const res = await axios.post(`${API}/payments`, payload, { headers: authHeader() });
      const paymentId = res.data?.data?.id;
      if (paymentId && receiptFile && form.paymentType === 'outgoing' && form.payerType === 'vendor') {
        await uploadReceiptForPayment(paymentId, receiptFile);
      }
      setShowForm(false);
      setReceiptFile(null);
      setForm({
        paymentType: 'incoming',
        method: 'eft',
        payerType: 'insurance_company',
        payerId: '',
        amount: 0,
        currency: 'TRY',
        paymentDate: new Date().toISOString().substring(0, 10),
        status: 'completed',
      });
      load();
    } catch (e: any) { showToast('error', e?.response?.data?.message ?? 'Hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleReceiptUploadExisting = async (paymentId: string, file: File) => {
    setUploadingReceiptId(paymentId);
    try {
      await uploadReceiptForPayment(paymentId, file);
      load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Dekont yüklenemedi');
    } finally {
      setUploadingReceiptId(null);
    }
  };

  const openReceipt = async (paymentId: string) => {
    try {
      const res = await axios.get(`${API}/payments/${paymentId}/receipt/download`, { headers: authHeader() });
      const url = res.data?.data?.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('error', 'Dekont açılamadı');
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Yükleniyor…</div>;

  const incomingTotal = payments
    .filter((p) => p.paymentType === 'incoming')
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const outgoingTotal = payments
    .filter((p) => p.paymentType === 'outgoing')
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <OnlineCollectionLinksPanel claimFileId={claimId} />

      <FinansPanelCard
        title="Tahsilatlar & Ödemeler"
        subtitle="Gelen tahsilat ve giden ödemeler — fatura ve dekont bağlantıları"
        action={{
          label: showForm ? 'Formu Kapat' : 'Yeni Ödeme',
          onClick: () => setShowForm((v) => !v),
          variant: 'primary',
          active: showForm,
        }}
      >
        <FinansKpiStrip
          items={[
            { label: 'Gelen Tahsilat', value: fmtCurrency(incomingTotal), accent: 'text-emerald-400' },
            { label: 'Giden Ödeme', value: fmtCurrency(outgoingTotal), accent: 'text-amber-400' },
            {
              label: 'Kayıt Sayısı',
              value: String(payments.length),
              accent: payments.length > 0 ? 'text-white' : 'text-slate-400',
            },
          ]}
        />

        {showForm && (
          <FinansFormPanel
            title="Yeni Ödeme Kaydı"
            onCancel={() => {
              setShowForm(false);
              setReceiptFile(null);
            }}
            onSubmit={handleSave}
            saving={saving}
          >
            <div className="space-y-4">
              <FinansFormSection title="Ödeme Bilgileri">
                <div>
                  <FinansFieldLabel>Ödeme Yönü</FinansFieldLabel>
                  <select
                    value={form.paymentType}
                    onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                    className={finansInputClass}
                  >
                    <option value="incoming">Gelen (Tahsilat)</option>
                    <option value="outgoing">Giden (Ödeme)</option>
                  </select>
                </div>
                <div>
                  <FinansFieldLabel required>Ödeme Tarihi</FinansFieldLabel>
                  <TrDateInput
                    value={form.paymentDate}
                    onChange={(paymentDate) => setForm({ ...form, paymentDate })}
                    className={finansInputClass}
                  />
                </div>
                <div>
                  <FinansFieldLabel required>Tutar (TRY)</FinansFieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className={finansInputClass}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <FinansFieldLabel>Ödeme Yöntemi</FinansFieldLabel>
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                    className={finansInputClass}
                  >
                    <option value="eft">EFT</option>
                    <option value="havale">Havale</option>
                    <option value="credit_card">Kredi Kartı</option>
                    <option value="cash">Nakit</option>
                    <option value="offset">Mahsuplaşma</option>
                  </select>
                </div>
              </FinansFormSection>

              <FinansFormSection title="Karşı Taraf">
                <div>
                  <FinansFieldLabel>Karşı Taraf Tipi</FinansFieldLabel>
                  <select
                    value={form.payerType}
                    onChange={(e) => setForm({ ...form, payerType: e.target.value, payerId: '' })}
                    className={finansInputClass}
                  >
                    <option value="insurance_company">Sigorta Şirketi</option>
                    <option value="vendor">Tedarikçi</option>
                    <option value="customer">Müşteri</option>
                  </select>
                </div>
                {form.paymentType === 'outgoing' && form.payerType === 'vendor' ? (
                  <div>
                    <FinansFieldLabel required>Tedarikçi</FinansFieldLabel>
                    <select
                      value={form.payerId ?? ''}
                      onChange={(e) => setForm({ ...form, payerId: e.target.value })}
                      className={finansInputClass}
                    >
                      <option value="">Tedarikçi Seçin…</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="hidden sm:block" aria-hidden />
                )}
              </FinansFormSection>

              <FinansFormSection title="Bağlantılar ve Not">
                <div>
                  <FinansFieldLabel>Bağlı Fatura</FinansFieldLabel>
                  <select
                    value={form.invoiceId ?? ''}
                    onChange={(e) => setForm({ ...form, invoiceId: e.target.value || undefined })}
                    className={finansInputClass}
                  >
                    <option value="">Seçiniz…</option>
                    {invoices.filter((i) => !['cancelled', 'paid'].includes(i.status)).map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} ({fmtCurrency(inv.totalAmount)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FinansFieldLabel>Referans No</FinansFieldLabel>
                  <input
                    type="text"
                    value={form.referenceNo ?? ''}
                    onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                    className={finansInputClass}
                    placeholder="Dekont / havale referansı"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FinansFieldLabel>Not</FinansFieldLabel>
                  <input
                    type="text"
                    value={form.note ?? ''}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    onBlur={(e) => {
                      const v = toTitleCaseTR(e.target.value.trim());
                      if (v) setForm({ ...form, note: v });
                    }}
                    className={finansInputClass}
                    placeholder="Kısa açıklama"
                  />
                </div>
                {form.paymentType === 'outgoing' && form.payerType === 'vendor' && (
                  <div className="sm:col-span-2">
                    <FinansFieldLabel>Ödeme Dekontu</FinansFieldLabel>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      className={finansFileInputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Dekont yüklendiğinde tedarikçi ekstresine otomatik yansır.
                    </p>
                  </div>
                )}
              </FinansFormSection>
            </div>
          </FinansFormPanel>
        )}

        {payments.length === 0 ? (
          <FinansEmptyState
            title="Henüz Ödeme Kaydı Yok"
            description="Tahsilat veya tedarikçi ödemesi eklemek için Yeni Ödeme butonunu kullanın."
          />
        ) : (
          <FinansDataTable>
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2.5">Tarih</th>
                <th className="text-left px-3 py-2.5">Yön</th>
                <th className="text-left px-3 py-2.5">Yöntem</th>
                <th className="text-left px-3 py-2.5">Bağlı Fatura</th>
                <th className="text-right px-3 py-2.5">Tutar</th>
                <th className="text-left px-3 py-2.5">Ref No</th>
                <th className="text-left px-3 py-2.5">Dekont</th>
                <th className="text-left px-3 py-2.5">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(p.paymentDate)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentType === 'incoming' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{PAYMENT_TYPE_LABEL[p.paymentType] ?? p.paymentType}</span></td>
                  <td className="px-3 py-2.5 text-slate-600">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{p.invoice?.invoiceNo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800">{fmtCurrency(p.amount)}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{p.referenceNo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.paymentType === 'outgoing' && p.payerType === 'vendor' ? (
                      p.receiptStorageKey ? (
                        <button type="button" onClick={() => openReceipt(p.id)} className="text-indigo-600 hover:underline">
                          {p.receiptFileName ?? 'Dekont'}
                        </button>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploadingReceiptId === p.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReceiptUploadExisting(p.id, f);
                              e.target.value = '';
                            }}
                          />
                          {uploadingReceiptId === p.id ? 'Yükleniyor…' : 'Dekont Yükle'}
                        </label>
                      )
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs truncate max-w-[120px]">{p.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </FinansDataTable>
        )}
      </FinansPanelCard>
    </div>
  );
}

export function GelirlerTab({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [extraWorks, setExtraWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    revenueType: 'file_fee',
    collectionSource: 'insurance_company',
    description: '',
    amount: '',
    vatRate: '0',
    entryDate: new Date().toISOString().split('T')[0],
    extraWorkItemId: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, ewRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/revenues`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/extra-works`, { headers: authHeader() }),
      ]);
      setRevenues(revRes.data.data ?? revRes.data ?? []);
      setExtraWorks(ewRes.data.data ?? ewRes.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.entryDate) {
      showToast('error', 'Tarih Zorunludur');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('error', 'Tutar Sıfırdan Büyük Olmalıdır');
      return;
    }
    if (!form.description.trim()) {
      showToast('error', 'Açıklama Zorunludur');
      return;
    }
    if (form.revenueType === 'extra_work' && !form.extraWorkItemId) {
      showToast('error', 'Ekstra İş Tipi İçin Ekstra İş Seçilmesi Zorunludur');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/revenues`,
        {
          revenueType: form.revenueType,
          collectionSource: form.collectionSource,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          vatRate: parseFloat(form.vatRate),
          entryDate: form.entryDate,
          extraWorkItemId: form.revenueType === 'extra_work' ? form.extraWorkItemId : undefined,
        },
        { headers: authHeader() },
      );
      setShowForm(false);
      setForm({ revenueType: 'file_fee', collectionSource: 'insurance_company', description: '', amount: '', vatRate: '0', entryDate: new Date().toISOString().split('T')[0], extraWorkItemId: '' });
      load();
      showToast('success', 'Gelir Kaydedildi');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Gelir Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = (s: string) => s === 'insurance_company' ? 'Sigorta Şirketi' : 'Sigortalı';
  const typeLabel = (t: string) => t === 'file_fee' ? 'Dosya Bedeli' : 'Ekstra İş';
  const statusLabel = (s: string) => ({
    draft: 'Taslak',
    confirmed: 'Onaylandı',
    collected: 'Tahsil Edildi',
    cancelled: 'İptal',
  }[s] ?? s);
  const statusColor = (s: string) => ({
    draft: 'bg-slate-100 text-slate-600',
    confirmed: 'bg-blue-100 text-blue-700',
    collected: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-slate-100 text-slate-600');

  const totalRevenue = revenues.filter(r => r.status !== 'cancelled').reduce((s: number, r: any) => s + r.totalAmount, 0);
  const totalCollected = revenues.reduce((s: number, r: any) => s + (r.collectedAmount ?? 0), 0);
  const remainingBalance = totalRevenue - totalCollected;

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  return (
    <FinansPanelCard
      title="Gelir Kayıtları"
      subtitle="Dosya bedeli ve ekstra iş gelirleri — tahsilat durumu özette"
      action={{
        label: showForm ? 'Formu Kapat' : 'Gelir Ekle',
        onClick: () => setShowForm((v) => !v),
        variant: 'primary',
        active: showForm,
      }}
    >
      <FinansKpiStrip
        items={[
          { label: 'Toplam Gelir', value: fmtCurrency(totalRevenue) },
          { label: 'Tahsil Edilen', value: fmtCurrency(totalCollected), accent: 'text-emerald-400' },
          {
            label: 'Kalan Bakiye',
            value: fmtCurrency(remainingBalance),
            accent: remainingBalance > 0 ? 'text-amber-400' : 'text-white',
          },
        ]}
      />

      {showForm && (
        <FinansFormPanel
          title="Yeni Gelir Kaydı"
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          saving={saving}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FinansFieldLabel required>Tarih</FinansFieldLabel>
              <TrDateInput value={form.entryDate} onChange={(entryDate) => setForm({...form, entryDate})} className={finansInputClass} />
            </div>
            <div>
              <FinansFieldLabel>Gelir Tipi</FinansFieldLabel>
              <select value={form.revenueType} onChange={e => setForm({...form, revenueType: e.target.value, extraWorkItemId: ''})} className={finansInputClass}>
                <option value="file_fee">Dosya Bedeli</option>
                <option value="extra_work">Ekstra İş</option>
              </select>
            </div>
            <div>
              <FinansFieldLabel>Tahsilat Kaynağı</FinansFieldLabel>
              <select value={form.collectionSource} onChange={e => setForm({...form, collectionSource: e.target.value})} className={finansInputClass}>
                <option value="insurance_company">Sigorta Şirketi</option>
                <option value="insured">Sigortalı</option>
              </select>
            </div>
            <div>
              <FinansFieldLabel required>Tutar (TL)</FinansFieldLabel>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={finansInputClass} placeholder="0,00" />
            </div>
            <div>
              <FinansFieldLabel>KDV (%)</FinansFieldLabel>
              <input type="number" min="0" max="100" value={form.vatRate} onChange={e => setForm({...form, vatRate: e.target.value})} className={finansInputClass} placeholder="0" />
            </div>
            {form.revenueType === 'extra_work' && (
              <div className="sm:col-span-2">
                <FinansFieldLabel required>Ekstra İş</FinansFieldLabel>
                <select value={form.extraWorkItemId} onChange={e => setForm({...form, extraWorkItemId: e.target.value})} className={finansInputClass}>
                  <option value="">Seçiniz…</option>
                  {extraWorks.map((ew: any) => (
                    <option key={ew.id} value={ew.id}>{ew.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <FinansFieldLabel required>Açıklama</FinansFieldLabel>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, description: v}); }} className={finansInputClass} placeholder="Gelir açıklaması" />
            </div>
          </div>
        </FinansFormPanel>
      )}

      {revenues.length === 0 ? (
        <FinansEmptyState
          title="Henüz Gelir Kaydı Yok"
          description="Dosya bedeli veya ekstra iş geliri eklemek için Gelir Ekle butonunu kullanın."
        />
      ) : (
        <FinansDataTable>
          <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2.5 w-8" />
              <th className="text-left px-3 py-2.5">Tarih</th>
              <th className="text-left px-3 py-2.5">Gelir Tipi</th>
              <th className="text-left px-3 py-2.5">Tahsilat Kaynağı</th>
              <th className="text-right px-3 py-2.5">Tutar</th>
              <th className="text-left px-3 py-2.5">Açıklama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {revenues.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(r.entryDate)}</td>
                <td className="px-3 py-2.5 text-slate-700">
                  {typeLabel(r.revenueType)}
                  {r.extraWorkItem && <span className="text-xs text-purple-600 ml-1">({r.extraWorkItem.title})</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{sourceLabel(r.collectionSource)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                  {fmtCurrency(r.totalAmount)}
                  {r.collectedAmount > 0 && <span className="block text-[10px] font-normal text-green-600">Tahsil: {fmtCurrency(r.collectedAmount)}</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{r.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </FinansDataTable>
      )}
    </FinansPanelCard>
  );
}

export function EkstraIslerTab({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', agreedAt: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [miniPL, setMiniPL] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/extra-works`, { headers: authHeader() });
      setItems(r.data.data ?? r.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const loadMiniPL = async (id: string) => {
    if (miniPL[id]) return;
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/extra-works/${id}/pl`, { headers: authHeader() });
      setMiniPL(prev => ({ ...prev, [id]: r.data }));
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadMiniPL(id);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/extra-works`,
        { title: form.title, description: form.description || undefined, agreedAt: form.agreedAt || undefined },
        { headers: authHeader() },
      );
      setShowForm(false);
      setForm({ title: '', description: '', agreedAt: '' });
      load();
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Ekstra iş kaydedilemedi');
    } finally { setSaving(false); }
  };

  const statusColor = (s: string) => ({
    draft: 'bg-slate-100 text-slate-600',
    approved: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-slate-100 text-slate-600');

  const statusLabel = (s: string) => ({ draft: 'Taslak', approved: 'Onaylı', completed: 'Tamamlandı', cancelled: 'İptal' }[s] ?? s);

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  return (
    <FinansPanelCard
      title="Ekstra İşler"
      subtitle="Dosya kapsamı dışı ek işler — gelir ve gider mini özeti"
      action={{
        label: showForm ? 'Formu Kapat' : 'Ekstra İş Ekle',
        onClick: () => setShowForm((v) => !v),
        variant: 'primary',
        active: showForm,
      }}
    >
      {showForm && (
        <FinansFormPanel
          title="Yeni Ekstra İş"
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
          saving={saving}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FinansFieldLabel required>İş Tanımı</FinansFieldLabel>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, title: v}); }} className={finansInputClass} placeholder="Örn: Mutfak Dolap Değişimi" />
            </div>
            <div>
              <FinansFieldLabel>Anlaşma Tarihi</FinansFieldLabel>
              <TrDateInput value={form.agreedAt} onChange={(agreedAt) => setForm({...form, agreedAt})} className={finansInputClass} />
            </div>
            <div>
              <FinansFieldLabel>Notlar</FinansFieldLabel>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, description: v}); }} className={finansInputClass} placeholder="Opsiyonel" />
            </div>
          </div>
        </FinansFormPanel>
      )}

      {items.length === 0 ? (
        <FinansEmptyState
          title="Henüz Ekstra İş Yok"
          description="Kapsam dışı iş tanımı eklemek için Ekstra İş Ekle butonunu kullanın."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const pl = miniPL[item.id];
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between py-3 px-4 bg-white cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(item.status)}`}>{statusLabel(item.status)}</span>
                    <span className="text-sm font-medium text-slate-800">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {pl && (
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-700">G: {fmtCurrency(pl.totalRevenue)}</span>
                        <span className="text-red-600">M: {fmtCurrency(pl.totalCost)}</span>
                        <span className={pl.netProfit >= 0 ? 'text-green-800 font-bold' : 'text-red-700 font-bold'}>
                          K: {fmtCurrency(pl.netProfit)} (%{pl.netMarginPct.toFixed(1)})
                        </span>
                      </div>
                    )}
                    <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isExpanded && pl && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Toplam Gelir</p>
                        <p className="text-base font-bold text-green-700">{fmtCurrency(pl.totalRevenue)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Toplam Gider</p>
                        <p className="text-base font-bold text-red-600">{fmtCurrency(pl.totalCost)}</p>
                      </div>
                      <div className={`rounded-lg p-3 border ${pl.netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-xs text-slate-500 mb-1">Net Kâr</p>
                        <p className={`text-base font-bold ${pl.netProfit >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmtCurrency(pl.netProfit)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FinansPanelCard>
  );
}
