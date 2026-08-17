'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { formatDisplayLabel } from '@/utils/text-helpers';

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

type SubGroupMeta = {
  workGroupId: string;
  workGroupName: string;
  workGroupSortOrder: number;
  subGroupName: string;
  subGroupSortOrder: number;
};

type GroupedSubGroup = {
  workSubGroupId: string;
  subGroupName: string;
  subGroupSortOrder: number;
  items: Suggestion[];
};

type GroupedWorkGroup = {
  workGroupId: string;
  workGroupName: string;
  workGroupSortOrder: number;
  subGroups: GroupedSubGroup[];
};

const UNKNOWN_GROUP_ID = '__unknown__';

function buildSubGroupLookup(workGroups: any[]): Map<string, SubGroupMeta> {
  const map = new Map<string, SubGroupMeta>();
  for (const wg of workGroups) {
    for (const sg of wg.workSubGroups ?? []) {
      map.set(sg.id, {
        workGroupId: wg.id,
        workGroupName: wg.name ?? '',
        workGroupSortOrder: wg.sortOrder ?? 0,
        subGroupName: sg.name ?? '',
        subGroupSortOrder: sg.sortOrder ?? 0,
      });
    }
  }
  return map;
}

function groupSuggestions(items: Suggestion[], workGroups: any[]): GroupedWorkGroup[] {
  const lookup = buildSubGroupLookup(workGroups);
  const byWorkGroup = new Map<string, GroupedWorkGroup>();

  for (const item of items) {
    const meta = lookup.get(item.workSubGroupId);
    const workGroupId = meta?.workGroupId ?? UNKNOWN_GROUP_ID;
    const workGroupName = meta?.workGroupName ?? 'Diğer';
    const workGroupSortOrder = meta?.workGroupSortOrder ?? 9999;
    const subGroupName = meta?.subGroupName ?? item.name;
    const subGroupSortOrder = meta?.subGroupSortOrder ?? 9999;

    if (!byWorkGroup.has(workGroupId)) {
      byWorkGroup.set(workGroupId, {
        workGroupId,
        workGroupName,
        workGroupSortOrder,
        subGroups: [],
      });
    }

    const group = byWorkGroup.get(workGroupId)!;
    let subGroup = group.subGroups.find((sg) => sg.workSubGroupId === item.workSubGroupId);
    if (!subGroup) {
      subGroup = {
        workSubGroupId: item.workSubGroupId,
        subGroupName,
        subGroupSortOrder,
        items: [],
      };
      group.subGroups.push(subGroup);
    }
    subGroup.items.push(item);
  }

  return Array.from(byWorkGroup.values())
    .sort((a, b) => {
      const orderDiff = a.workGroupSortOrder - b.workGroupSortOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.workGroupName.localeCompare(b.workGroupName, 'tr-TR');
    })
    .map((group) => ({
      ...group,
      subGroups: [...group.subGroups].sort((a, b) => {
        const orderDiff = a.subGroupSortOrder - b.subGroupSortOrder;
        if (orderDiff !== 0) return orderDiff;
        return a.subGroupName.localeCompare(b.subGroupName, 'tr-TR');
      }),
    }));
}

export function damageTypeLabel(value: string) {
  return DAMAGE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function damageSizeLabel(value: string) {
  return DAMAGE_SIZE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function RepairItemRow({
  item,
  checked,
  quantity,
  note,
  onToggle,
  onQuantityChange,
  onNoteChange,
}: {
  item: Suggestion;
  checked: boolean;
  quantity: number;
  note: string;
  onToggle: () => void;
  onQuantityChange: (value: number) => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <div className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[32px_1fr_90px_120px_1fr_110px] md:items-center ${checked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-slate-50'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
      <div>
        <p className="text-sm font-semibold text-slate-800">{formatDisplayLabel(item.name)}</p>
        <p className="text-xs text-slate-400">{item.code}</p>
      </div>
      <span className="text-xs font-medium text-slate-500">{item.unitType}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={quantity}
        onChange={(event) => onQuantityChange(Number(event.target.value))}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Opsiyonel not"
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <span className="rounded-full bg-white px-2 py-1 text-center text-[11px] text-slate-500">{item.usageCount} kez kullanıldı</span>
    </div>
  );
}

export default function RepairItemsModal({
  open,
  damageTypes,
  damageSize,
  fileId,
  damageTypeLabels,
  workGroups: workGroupsProp,
  onClose,
  onAdd,
}: {
  open: boolean;
  damageTypes: string[];
  damageSize: string;
  fileId?: string;
  damageTypeLabels?: Record<string, string>;
  workGroups?: any[];
  onClose: () => void;
  onAdd: (items: SelectedRepairItem[]) => Promise<void>;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [workGroups, setWorkGroups] = useState<any[]>(workGroupsProp ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (workGroupsProp?.length) {
      setWorkGroups(workGroupsProp);
      return;
    }
    axios.get(`${API}/work-groups`, { headers: authHeader() })
      .then((res) => setWorkGroups(res.data.data ?? []))
      .catch(() => setWorkGroups([]));
  }, [open, workGroupsProp]);

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

  const grouped = useMemo(() => groupSuggestions(filtered, workGroups), [filtered, workGroups]);

  if (!open) return null;

  const labelForType = (value: string) => damageTypeLabels?.[value] ?? damageTypeLabel(value);

  const toggleItem = (workSubGroupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workSubGroupId)) next.delete(workSubGroupId);
      else next.add(workSubGroupId);
      return next;
    });
  };

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
              <p className="mt-1 text-xs text-slate-500">{damageTypes.map(labelForType).join(' + ')} ({damageSizeLabel(damageSize)})</p>
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
            <div className="space-y-6">
              {grouped.map((group) => (
                <section key={group.workGroupId}>
                  <h4 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1.5">
                    {formatDisplayLabel(group.workGroupName)}
                  </h4>
                  <div className="mt-3 space-y-4">
                    {group.subGroups.map((subGroup) => (
                      <div key={subGroup.workSubGroupId}>
                        <p className="text-xs font-medium text-slate-500 mb-2 pl-1">
                          {formatDisplayLabel(subGroup.subGroupName)}
                        </p>
                        <div className="space-y-2">
                          {subGroup.items.map((item) => (
                            <RepairItemRow
                              key={item.workSubGroupId}
                              item={item}
                              checked={selected.has(item.workSubGroupId)}
                              quantity={quantities[item.workSubGroupId] ?? item.suggestedQuantity ?? 1}
                              note={notes[item.workSubGroupId] ?? ''}
                              onToggle={() => toggleItem(item.workSubGroupId)}
                              onQuantityChange={(value) => setQuantities((prev) => ({ ...prev, [item.workSubGroupId]: value }))}
                              onNoteChange={(value) => setNotes((prev) => ({ ...prev, [item.workSubGroupId]: value }))}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Eşleşen kalem bulunamadı.</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">İptal</button>
          <button type="button" onClick={handleAdd} disabled={selected.size === 0 || saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Seçilenleri Ekle ({selected.size})</button>
        </div>
      </div>
    </div>
  );
}
