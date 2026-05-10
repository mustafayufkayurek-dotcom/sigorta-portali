'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { EditButton, DeleteButton } from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

interface CustomerSubType {
  value: string;
  label: string;
  forType: 'individual' | 'corporate' | 'both';
  color: 'orange' | 'green' | 'purple' | 'blue' | 'gray';
}

const COLOR_OPTIONS: { val: CustomerSubType['color']; label: string; cls: string }[] = [
  { val: 'orange', label: 'Turuncu',  cls: 'bg-orange-100 text-orange-700 border-orange-300' },
  { val: 'green',  label: 'Yeşil',    cls: 'bg-green-100  text-green-700  border-green-300'  },
  { val: 'purple', label: 'Mor',      cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  { val: 'blue',   label: 'Mavi',     cls: 'bg-blue-100   text-blue-700   border-blue-300'   },
  { val: 'gray',   label: 'Gri',      cls: 'bg-slate-100   text-slate-700   border-slate-300'   },
];

const FOR_TYPE_OPTIONS: { val: CustomerSubType['forType']; label: string }[] = [
  { val: 'individual', label: 'Bireysel' },
  { val: 'corporate',  label: 'Kurumsal' },
  { val: 'both',       label: 'Her İkisi' },
];

const colorCls = (color: CustomerSubType['color']) =>
  COLOR_OPTIONS.find((c) => c.val === color)?.cls ?? 'bg-slate-100 text-slate-700 border-slate-300';

const emptyNew = (): Omit<CustomerSubType, 'value'> & { value: string } => ({
  value: '', label: '', forType: 'both', color: 'gray',
});

export default function MusteriTipleriPage() {
  const [types, setTypes] = useState<CustomerSubType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newItem, setNewItem] = useState<CustomerSubType>(emptyNew() as CustomerSubType);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<CustomerSubType | null>(null);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/customer-sub-types`, { headers: authHeader() });
      setTypes(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const persist = async (updated: CustomerSubType[]) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await axios.put(`${API}/system-settings/customer-sub-types`, { values: updated }, { headers: authHeader() });
      setTypes(updated);
      setSuccess('Kaydedildi');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Kaydedilemedi');
    } finally { setSaving(false); }
  };

  const slugify = (text: string) =>
    text.trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9_]/g, '');

  const handleAdd = async () => {
    if (!newItem.label.trim()) { setError('Görünen ad boş olamaz'); return; }
    const value = newItem.value.trim() || slugify(newItem.label);
    if (!value) { setError('Değer (slug) hesaplanamadı'); return; }
    if (types.some((t) => t.value === value)) { setError('Bu değer (slug) zaten mevcut'); return; }
    if (types.some((t) => t.label.trim().toLowerCase() === newItem.label.trim().toLowerCase())) { setError('Bu isimde bir kayıt zaten mevcut!'); return; }
    const item: CustomerSubType = { ...newItem, value };
    setNewItem(emptyNew() as CustomerSubType);
    setError('');
    await persist([...types, item]);
  };

  const handleDelete = async (idx: number) => {
    await persist(types.filter((_, i) => i !== idx));
    setDeleteIdx(null);
  };

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx);
    setEditItem({ ...types[idx] });
    setError('');
  };

  const handleEditSave = async (idx: number) => {
    if (!editItem) return;
    if (!editItem.label.trim()) { setError('Görünen ad boş olamaz'); return; }
    if (types.some((t, i) => i !== idx && t.value === editItem.value)) { setError('Bu slug zaten mevcut'); return; }
    if (types.some((t, i) => i !== idx && t.label.trim().toLowerCase() === editItem.label.trim().toLowerCase())) { setError('Bu isimde bir kayıt zaten mevcut!'); return; }
    const updated = types.map((t, i) => (i === idx ? editItem : t));
    setEditingIdx(null);
    setEditItem(null);
    await persist(updated);
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...types];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    await persist(updated);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === types.length - 1) return;
    const updated = [...types];
    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    await persist(updated);
  };

  return (
    <SettingsPageLayout
      title="Müşteri Tipleri"
      description="Müşteri ekleme formunda görünecek alt tip seçeneklerini yönetin"
    >

      {/* Yeni Ekle */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Yeni Müşteri Tipi Ekle</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Görünen Ad *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              placeholder="Örn: Eksper"
              value={newItem.label}
              onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Slug (opsiyonel)</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              placeholder="Otomatik"
              value={newItem.value}
              onChange={(e) => setNewItem((p) => ({ ...p, value: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Müşteri Tipi</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white"
              value={newItem.forType}
              onChange={(e) => setNewItem((p) => ({ ...p, forType: e.target.value as CustomerSubType['forType'] }))}
            >
              {FOR_TYPE_OPTIONS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Renk</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white"
              value={newItem.color}
              onChange={(e) => setNewItem((p) => ({ ...p, color: e.target.value as CustomerSubType['color'] }))}
            >
              {COLOR_OPTIONS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>}
            {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-1.5">{success}</p>}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newItem.label.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            + Ekle
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>
      ) : types.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">Henüz müşteri tipi tanımlanmamış.</p>
          <p className="text-slate-300 text-xs mt-1">Yukarıdan ilk tipi ekleyin.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="text-center px-4 py-3 w-10">Sıra</th>
                <th className="text-left px-5 py-3">Görünen Ad</th>
                <th className="text-left px-5 py-3">Slug</th>
                <th className="text-left px-5 py-3">Tip</th>
                <th className="text-left px-5 py-3">Renk</th>
                <th className="text-center px-5 py-3 w-24">Sırala</th>
                <th className="px-5 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {types.map((type, idx) => (
                <tr key={type.value} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>

                  {editingIdx === idx && editItem ? (
                    <>
                      <td className="px-5 py-3" colSpan={4}>
                        <div className="grid grid-cols-4 gap-2">
                          <input
                            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            value={editItem.label}
                            autoFocus
                            onChange={(e) => setEditItem((p) => p ? { ...p, label: e.target.value } : p)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditSave(idx); } if (e.key === 'Escape') { setEditingIdx(null); setEditItem(null); } }}
                          />
                          <input
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            value={editItem.value}
                            onChange={(e) => setEditItem((p) => p ? { ...p, value: e.target.value } : p)}
                          />
                          <select
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            value={editItem.forType}
                            onChange={(e) => setEditItem((p) => p ? { ...p, forType: e.target.value as CustomerSubType['forType'] } : p)}
                          >
                            {FOR_TYPE_OPTIONS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
                          </select>
                          <select
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                            value={editItem.color}
                            onChange={(e) => setEditItem((p) => p ? { ...p, color: e.target.value as CustomerSubType['color'] } : p)}
                          >
                            {COLOR_OPTIONS.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
                          </select>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorCls(type.color)}`}>
                          {type.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{type.value}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {FOR_TYPE_OPTIONS.find((o) => o.val === type.forType)?.label ?? type.forType}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] border ${colorCls(type.color)}`}>
                          {COLOR_OPTIONS.find((o) => o.val === type.color)?.label ?? type.color}
                        </span>
                      </td>
                    </>
                  )}

                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => handleMoveUp(idx)} disabled={idx === 0 || saving}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20 p-1 rounded hover:bg-slate-100" title="Yukarı">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => handleMoveDown(idx)} disabled={idx === types.length - 1 || saving}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-20 p-1 rounded hover:bg-slate-100" title="Aşağı">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </td>

                  <td className="px-5 py-3 text-right">
                    {editingIdx === idx ? (
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handleEditSave(idx)} disabled={saving}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          Kaydet
                        </button>
                        <button type="button" onClick={() => { setEditingIdx(null); setEditItem(null); }}
                          className="text-xs border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                          İptal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <EditButton onClick={() => handleEditStart(idx)} />
                        <DeleteButton onClick={() => setDeleteIdx(idx)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={deleteIdx !== null}
        onClose={() => setDeleteIdx(null)}
        onConfirm={() => deleteIdx !== null && handleDelete(deleteIdx)}
        deleting={saving}
        itemName={deleteIdx !== null ? types[deleteIdx]?.label : undefined}
      />
    </SettingsPageLayout>
  );
}
