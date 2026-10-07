'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { suggestAutoCode } from '@/utils/auto-code';
import { normalizeFormFreeText, normalizeSearchTR } from '@/utils/text-helpers';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
  inputCls,
  SettingsFieldLabel,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatSettingsApiError } from '@/utils/settings-api';
import { repairDamageCategorySettingsLabel } from '@sigorta/shared';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const MAHAL_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'kategori', label: 'Kategori', defaultWidth: 280, minWidth: 160, alwaysVisible: true },
  { id: 'mahal', label: 'Mahal/Bölge', defaultWidth: 320, minWidth: 140, alwaysVisible: true },
  { id: 'actions', label: 'İşlemler', defaultWidth: 96, minWidth: 80, pin: 'end', alwaysVisible: true, resizable: false },
];

type ClaimLocation = {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  status: string;
  parentId?: string | null;
  categoryId?: string | null;
  category?: { id: string; code: string; name: string } | null;
  children?: { id: string; name: string; status: string }[];
};

type DamageCategory = {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  status: string;
};

type MahalGroup = {
  label: string;
  categoryIds: string[];
  locIds: string[];
};

function mahalBolgeLabel(mahal: string, bolge?: string) {
  const a = mahal.trim();
  const b = (bolge ?? '').trim();
  if (a && b) return `${a} - ${b}`;
  return a;
}

function splitMahalBolge(raw: string): { mahalName: string; bolgeName: string } {
  const n = normalizeFormFreeText(raw);
  if (!n) return { mahalName: '', bolgeName: '' };
  const slash = n.split(/\s*\/\s*/).filter(Boolean);
  if (slash.length >= 2) {
    return { mahalName: slash[0], bolgeName: slash.slice(1).join(' / ') };
  }
  const dash = n.split(/\s*-\s*/).filter(Boolean);
  if (dash.length >= 2) {
    return { mahalName: dash[0], bolgeName: dash.slice(1).join(' - ') };
  }
  return { mahalName: n, bolgeName: '' };
}

function canonicalMahalBolge(raw: string) {
  const { mahalName, bolgeName } = splitMahalBolge(raw);
  return mahalBolgeLabel(mahalName, bolgeName);
}

function CategoryBalloon({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const cls = selected
    ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-slate-50 text-slate-700 border-slate-200';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${cls} hover:border-brand-400`}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      {label}
    </span>
  );
}

export default function MahallerPage() {
  const { showToast } = useToast();
  const tableColumns = usePanelTableColumns('table-cols:mahal-kategori', MAHAL_TABLE_COLUMNS);
  const [locations, setLocations] = useState<ClaimLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<DamageCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  const [showBind, setShowBind] = useState(false);
  const [bindCategoryIds, setBindCategoryIds] = useState<string[]>([]);
  const [bindMahalBolge, setBindMahalBolge] = useState('');
  const [bindSaving, setBindSaving] = useState(false);
  const [bindError, setBindError] = useState('');
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSaving, setNewCatSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MahalGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-locations`, { headers: authHeader() });
      setLocations(res.data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await axios.get(`${API}/claim-damage-categories`, { headers: authHeader() });
      setCategories(res.data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchCategories();
  }, [fetchLocations, fetchCategories]);

  const groups: MahalGroup[] = (() => {
    const map = new Map<string, MahalGroup>();
    for (const loc of locations) {
      const kids = loc.children ?? [];
      const labels = kids.length === 0 ? [canonicalMahalBolge(loc.name)] : kids.map((c) => canonicalMahalBolge(mahalBolgeLabel(loc.name, c.name)));
      for (const label of labels) {
        if (!label) continue;
        const prev = map.get(label) ?? { label, categoryIds: [], locIds: [] };
        if (loc.id && !prev.locIds.includes(loc.id)) prev.locIds.push(loc.id);
        if (loc.categoryId && !prev.categoryIds.includes(loc.categoryId)) prev.categoryIds.push(loc.categoryId);
        map.set(label, prev);
      }
    }
    const order = new Map(categories.map((c, i) => [c.id, i]));
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        categoryIds: [...g.categoryIds].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  })();

  const uniqueMahalBolgeLabels = groups.map((g) => g.label);

  const filteredGroups = useMemo(() => {
    const q = normalizeSearchTR(search);
    if (!q) return groups;
    return groups.filter((group) => {
      if (normalizeSearchTR(group.label).includes(q)) return true;
      return group.categoryIds.some((id) => {
        const cat = categories.find((c) => c.id === id);
        return cat ? normalizeSearchTR(repairDamageCategorySettingsLabel(cat)).includes(q) : false;
      });
    });
  }, [groups, search, categories]);

  const openTanımla = (group?: MahalGroup) => {
    setBindError('');
    setBindMahalBolge(group?.label ?? '');
    setBindCategoryIds(group?.categoryIds ?? []);
    setNewCatOpen(false);
    setNewCatName('');
    setShowBind(true);
  };

  const toggleCategory = (id: string) => {
    setBindCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = categories.length > 0 && categories.every((c) => bindCategoryIds.includes(c.id));

  const addNewCategory = async () => {
    const name = normalizeFormFreeText(newCatName);
    if (!name) {
      setBindError('Kategori adı yazın');
      return;
    }
    setNewCatSaving(true);
    setBindError('');
    try {
      const res = await axios.post(
        `${API}/claim-damage-categories`,
        { name, code: suggestAutoCode('', name) },
        { headers: authHeader() },
      );
      const created = res.data.data ?? res.data;
      await fetchCategories();
      if (created?.id) setBindCategoryIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNewCatName('');
      setNewCatOpen(false);
    } catch (e: unknown) {
      setBindError(formatSettingsApiError(e, getApiErrorMessage(e, 'Kategori eklenemedi')));
    } finally {
      setNewCatSaving(false);
    }
  };

  const handleBind = async () => {
    const { mahalName, bolgeName } = splitMahalBolge(bindMahalBolge);
    if (!mahalName) {
      setBindError('Mahal/Bölge yazın');
      return;
    }
    if (bindCategoryIds.length === 0) {
      setBindError('Kategori seçin');
      return;
    }
    setBindSaving(true);
    setBindError('');
    try {
      await axios.post(
        `${API}/claim-locations/bind`,
        {
          categoryIds: bindCategoryIds,
          mahalName,
          bolgeName: bolgeName || undefined,
        },
        { headers: authHeader() },
      );
      setShowBind(false);
      fetchLocations();
    } catch (e: unknown) {
      setBindError(formatSettingsApiError(e, getApiErrorMessage(e, 'Kaydedilemedi')));
    } finally {
      setBindSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await Promise.all(
        deleteTarget.locIds.map((id) => axios.delete(`${API}/claim-locations/${id}`, { headers: authHeader() })),
      );
      setDeleteTarget(null);
      fetchLocations();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  const categoryById = (id: string) => categories.find((c) => c.id === id);

  return (
    <TableColumnsProvider value={tableColumns}>
    <SettingsPageLayout
      title="Mahal Ve Kategori"
      description="Hasar raporunda kullanılan mahal/bölge ve kategori."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      addButtonText="Tanımla"
      onAdd={() => openTanımla()}
      headerExtra={<PanelTableColumnPicker tableColumns={tableColumns} />}
    >
      {loading || catLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Yükleniyor...
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-slate-500">Henüz mahal bağlı değil.</p>
        </div>
      ) : (
        <>
        <div className="filter-bar">
          <div className="panel-filter-bar">
            <div className="relative min-w-[18rem] flex-1 max-w-md">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mahal veya kategori ara..."
                className="panel-filter-control w-full pl-9"
              />
            </div>
          </div>
        </div>
        <div className="table-container">
          <PanelTableScroll>
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <PanelTableColGroup />
              <thead className="table-head-row portal-table-head">
                <tr>
                  <PanelOrderedHeaderRow tableColumns={tableColumns} />
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.prefs.orderedVisibleColumns.length} className="px-5 py-10 text-center text-sm text-slate-500">
                      Aramaya uyan mahal yok.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group) => (
                  <tr key={group.label} data-mahal-satir className="table-row">
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      const line = 'border-r border-slate-100 last:border-r-0';
                      if (col.id === 'kategori') {
                        return (
                          <PanelTableTd key={col.id} colId="kategori" wrap align="center" className={`table-td-center ${line}`}>
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {group.categoryIds.length === 0 ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                group.categoryIds.map((id) => {
                                  const cat = categoryById(id);
                                  return (
                                    <CategoryBalloon
                                      key={id}
                                      label={cat ? repairDamageCategorySettingsLabel(cat) : id}
                                    />
                                  );
                                })
                              )}
                            </div>
                          </PanelTableTd>
                        );
                      }
                      if (col.id === 'mahal') {
                        return (
                          <PanelTableTd key={col.id} colId="mahal" align="center" className={`table-td-center font-semibold text-slate-900 ${line}`}>
                            {group.label}
                          </PanelTableTd>
                        );
                      }
                      return (
                        <PanelTableTd key={col.id} colId="actions" align="center" className="table-td-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <EditButton onClick={() => openTanımla(group)} />
                            <DeleteButton onClick={() => setDeleteTarget(group)} />
                          </div>
                        </PanelTableTd>
                      );
                    })}
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </PanelTableScroll>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            {search.trim()
              ? `${filteredGroups.length} / ${groups.length} kayıt`
              : `${groups.length} kayıt`}
          </div>
        </div>
        </>
      )}

      <SettingsModal
        isOpen={showBind}
        onClose={() => setShowBind(false)}
        title="Tanımla"
        onSave={handleBind}
        saving={bindSaving}
        saveLabel="Kaydet"
        maxWidth="lg"
        error={bindError}
      >
        <div>
          <SettingsFieldLabel help="Rapordaki gibi tek yazı. Örn. salon - duvar.">
            Mahal/Bölge *
          </SettingsFieldLabel>
          <input
            className={inputCls}
            list="mahal-bolge-oneri"
            value={bindMahalBolge}
            autoComplete="off"
            name="mahal-bolge"
            onChange={(e) => setBindMahalBolge(e.target.value)}
            onBlur={(e) => setBindMahalBolge(canonicalMahalBolge(e.target.value))}
            placeholder="Örn. salon - duvar"
          />
          <datalist id="mahal-bolge-oneri">
            {uniqueMahalBolgeLabels.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div>
          <SettingsFieldLabel help="Birini veya birkaçını işaretleyin. Tümü, Bina, Eşya ve Mali Mesuliyet altına birden yazar.">
            Kategori *
          </SettingsFieldLabel>
          <div className="flex flex-wrap gap-2" data-kategori-balon>
            <CategoryBalloon
              label="Tümü"
              selected={allSelected}
              onClick={() => setBindCategoryIds(allSelected ? [] : categories.map((c) => c.id))}
            />
            {categories.map((cat) => (
              <CategoryBalloon
                key={cat.id}
                label={repairDamageCategorySettingsLabel(cat)}
                selected={bindCategoryIds.includes(cat.id)}
                onClick={() => toggleCategory(cat.id)}
              />
            ))}
            <CategoryBalloon
              label="+ Yeni"
              selected={newCatOpen}
              onClick={() => {
                setNewCatOpen((v) => !v);
                setBindError('');
              }}
            />
          </div>
          {newCatOpen && (
            <div className="mt-3 flex items-center gap-2">
              <input
                className={inputCls}
                name="yeni-kategori-ad"
                value={newCatName}
                autoComplete="off"
                placeholder="Örn. demirbaş"
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addNewCategory();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void addNewCategory()}
                disabled={newCatSaving}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {newCatSaving ? 'Ekleniyor...' : 'Ekle'}
              </button>
            </div>
          )}
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
        itemName={deleteTarget?.label}
      />
    </SettingsPageLayout>
    </TableColumnsProvider>
  );
}
