'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export const DAMAGE_TYPE_OPTIONS = [
  { value: 'FIRE_HOME', label: 'Yangın-Konut' },
  { value: 'FIRE_INDUSTRIAL', label: 'Yangın-Endüstriyel' },
  { value: 'WATER_INTERNAL', label: 'Su Hasarı' },
  { value: 'VEHICLE_IMPACT', label: 'Taşıt Çarpması' },
  { value: 'NATURAL_DISASTER', label: 'Doğal Afet' },
  { value: 'EARTHQUAKE', label: 'Deprem' },
];

export const DAMAGE_SIZE_OPTIONS = [
  { value: 'SMALL', label: 'Küçük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'LARGE', label: 'Büyük' },
];

type Suggestion = {
  templateId: string;
  workSubGroupId: string;
  code: string;
  name: string;
  unitType: string;
  unitPrice: number;
  suggestedQuantity: number;
  usageCount: number;
};

export type SelectedRepairItem = Suggestion & { quantity: number; note?: string };

export function damageTypeLabel(value: string) {
  return DAMAGE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function damageSizeLabel(value: string) {
  return DAMAGE_SIZE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default function RepairItemsModal({
  open,
  damageTypes,
  damageSize,
  fileId,
  onClose,
  onAdd,
}: {
  open: boolean;
  damageTypes: string[];
  damageSize: string;
  fileId?: string;
  onClose: () => void;
  onAdd: (items: SelectedRepairItem[]) => Promise<void>;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || damageTypes.length === 0) return;
    setLoading(true);
    setError(null);
    axios.post(`${API}/damage-repair-templates/suggestions`, { damageTypes, damageSize, fileId }, { headers: authHeader() })
      .then((res) => {
        const nextItems = res.data.data?.items ?? res.data.items ?? [];
        setItems(nextItems);
        setSelected(new Set(nextItems.map((item: Suggestion) => item.workSubGroupId)));
        setQuantities(Object.fromEntries(nextItems.map((item: Suggestion) => [item.workSubGroupId, item.suggestedQuantity ?? 1])));
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message ?? 'Öneriler yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [open, damageTypes.join(','), damageSize, fileId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    if (!term) return items;
    return items.filter((item) => `${item.name} ${item.code}`.toLocaleLowerCase('tr-TR').includes(term));
  }, [items, search]);

  if (!open) return null;

  const handleAdd = async () => {
    const selectedItems = items
      .filter((item) => selected.has(item.workSubGroupId))
      .map((item) => ({ ...item, quantity: quantities[item.workSubGroupId] ?? item.suggestedQuantity ?? 1, note: notes[item.workSubGroupId] }));
    if (!selectedItems.length) return;
    setSaving(true);
    try {
      await onAdd(selectedItems);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Hızlı Onarım Türü</h3>
              <p className="mt-1 text-xs text-slate-500">{damageTypes.map(damageTypeLabel).join(' + ')} ({damageSizeLabel(damageSize)})</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kalem adı veya kod ara..." className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
            <button type="button" onClick={() => setSelected(new Set(items.map((item) => item.workSubGroupId)))} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">Tümünü Seç</button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Seçimi Temizle</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className="py-10 text-center text-sm text-slate-400">Öneriler yükleniyor...</p> : error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const checked = selected.has(item.workSubGroupId);
                return (
                  <div key={item.workSubGroupId} className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[32px_1fr_90px_120px_1fr_110px] md:items-center ${checked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-slate-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setSelected((prev) => { const next = new Set(prev); next.has(item.workSubGroupId) ? next.delete(item.workSubGroupId) : next.add(item.workSubGroupId); return next; })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.code}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{item.unitType}</span>
                    <input type="number" min="0" step="0.01" value={quantities[item.workSubGroupId] ?? 1} onChange={(event) => setQuantities((prev) => ({ ...prev, [item.workSubGroupId]: Number(event.target.value) }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    <input value={notes[item.workSubGroupId] ?? ''} onChange={(event) => setNotes((prev) => ({ ...prev, [item.workSubGroupId]: event.target.value }))} placeholder="Opsiyonel not" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    <span className="rounded-full bg-white px-2 py-1 text-center text-[11px] text-slate-500">{item.usageCount} kez kullanıldı</span>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Eşleşen kalem bulunamadı.</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">İptal</button>
          <button type="button" onClick={handleAdd} disabled={selected.size === 0 || saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Seçilenleri Ekle ({selected.size})</button>
        </div>
      </div>
    </div>
  );
}