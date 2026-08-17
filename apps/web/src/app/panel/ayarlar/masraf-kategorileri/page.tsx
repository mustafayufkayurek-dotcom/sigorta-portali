'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader, formatSettingsApiError } from '@/utils/settings-api';
import { suggestAutoCode, applyNameWithAutoCode, blurNameWithAutoCode } from '@/utils/auto-code';
import { normalizeFormFreeText } from '@/utils/text-helpers';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
  StatusBadge,
  SettingsTable,
  SettingsTableHead,
  SettingsTableTh,
  SettingsTableBody,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableActions,
  SettingsRowIndexTh,
  SettingsRowIndexTd,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { computeAlphabeticSortOrder } from '@/utils/definition-sort-order';
import { useToast } from '@/contexts/ToastContext';


type ExpenseItem = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  _count?: { costEntries: number };
};

type ExpenseGroup = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  children?: ExpenseItem[];
  _count?: { costEntries: number };
};

const emptyGroupForm = { code: '', name: '' };
const emptyItemForm = { code: '', name: '', parentId: '' };

export default function MasrafKategorileriPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [groupModal, setGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState<ExpenseGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ ...emptyGroupForm });
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [deleteGroup, setDeleteGroup] = useState<ExpenseGroup | null>(null);

  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<ExpenseItem | null>(null);
  const [itemParentId, setItemParentId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ ...emptyItemForm });
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');
  const [deleteItem, setDeleteItem] = useState<ExpenseItem | null>(null);

  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/expense-categories`, {
        headers: authHeader(),
        params: { includeInactive: true },
      });
      const data: ExpenseGroup[] = res.data.data ?? [];
      setGroups(data);
      setExpandedGroups((prev) => {
        if (prev.size > 0) return prev;
        return new Set(data.slice(0, 2).map((g) => g.id));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/expense-categories/seed`, {}, { headers: authHeader() });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredGroups = search.trim()
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.children?.some((c) => c.name.toLowerCase().includes(search.toLowerCase())),
      )
    : groups;

  const parentGroup = (id: string | null) => groups.find((g) => g.id === id) ?? null;

  // ── Masraf Grubu ───────────────────────────────────────────────────────────────

  const openAddGroup = () => {
    setEditGroup(null);
    setGroupForm({ ...emptyGroupForm });
    setGroupError('');
    setGroupModal(true);
  };

  const openEditGroup = (g: ExpenseGroup) => {
    setEditGroup(g);
    setGroupForm({ code: g.code, name: g.name });
    setGroupError('');
    setGroupModal(true);
  };

  const saveGroup = async () => {
    const name = normalizeFormFreeText(groupForm.name);
    if (!name) {
      setGroupError('Masraf grubu adı zorunludur');
      return;
    }
    const code = editGroup ? groupForm.code : suggestAutoCode('EXP', name);
    const dupName = groups.find((g) =>
      g.name.trim().toLowerCase() === name.toLowerCase() && (!editGroup || g.id !== editGroup.id),
    );
    if (dupName) {
      setGroupError('Bu isimde bir masraf grubu zaten mevcut');
      return;
    }
    setGroupSaving(true);
    setGroupError('');
    const sortOrder = computeAlphabeticSortOrder(name, groups, editGroup?.id);
    try {
      if (editGroup) {
        await axios.patch(`${API}/expense-categories/${editGroup.id}`, {
          name,
          sortOrder,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expense-categories`, {
          code,
          name,
          sortOrder,
        }, { headers: authHeader() });
      }
      setGroupModal(false);
      await load();
    } catch (e: unknown) {
      setGroupError(formatSettingsApiError(e));
    } finally {
      setGroupSaving(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/expense-categories/${deleteGroup.id}`, { headers: authHeader() });
      setDeleteGroup(null);
      await load();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  const toggleGroupStatus = async (g: ExpenseGroup) => {
    try {
      await axios.patch(`${API}/expense-categories/${g.id}`, { isActive: !g.isActive }, { headers: authHeader() });
      await load();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Durum değiştirilemedi'));
    }
  };

  // ── Masraf Alt Grubu ──────────────────────────────────────────────────────────

  const openAddItem = (parentId: string) => {
    setEditItem(null);
    setItemParentId(parentId);
    setItemForm({ ...emptyItemForm, parentId });
    setItemError('');
    setItemModal(true);
    setExpandedGroups((prev) => new Set(prev).add(parentId));
  };

  const openEditItem = (item: ExpenseItem, parentId: string) => {
    setEditItem(item);
    setItemParentId(parentId);
    setItemForm({ code: item.code, name: item.name, parentId });
    setItemError('');
    setItemModal(true);
  };

  const saveItem = async () => {
    const name = normalizeFormFreeText(itemForm.name);
    if (!name) {
      setItemError('Masraf alt grubu adı zorunludur');
      return;
    }
    if (!itemForm.parentId) {
      setItemError('Bağlanacağı masraf grubu seçilmelidir');
      return;
    }
    const parent = parentGroup(itemForm.parentId);
    const code = editItem ? itemForm.code : suggestAutoCode(parent?.code ?? 'EXP', name);
    const siblings = parent?.children ?? [];
    const dupName = siblings.find((c) =>
      c.name.trim().toLowerCase() === name.toLowerCase() && (!editItem || c.id !== editItem.id),
    );
    if (dupName) {
      setItemError('Seçili masraf grubunda aynı isimde bir alt grup zaten mevcut');
      return;
    }
    setItemSaving(true);
    setItemError('');
    const sortOrder = computeAlphabeticSortOrder(name, siblings, editItem?.id);
    try {
      if (editItem) {
        await axios.patch(`${API}/expense-categories/${editItem.id}`, {
          name,
          sortOrder,
          parentId: itemForm.parentId,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expense-categories`, {
          code,
          name,
          sortOrder,
          parentId: itemForm.parentId,
        }, { headers: authHeader() });
      }
      setItemModal(false);
      await load();
    } catch (e: unknown) {
      setItemError(formatSettingsApiError(e));
    } finally {
      setItemSaving(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/expense-categories/${deleteItem.id}`, { headers: authHeader() });
      setDeleteItem(null);
      await load();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  const toggleItemStatus = async (item: ExpenseItem) => {
    try {
      await axios.patch(`${API}/expense-categories/${item.id}`, { isActive: !item.isActive }, { headers: authHeader() });
      await load();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Durum değiştirilemedi'));
    }
  };

  const selectedParentForModal = parentGroup(itemForm.parentId || itemParentId);

  return (
    <SettingsPageLayout
      title="Masraf Kategorileri"
      description="Masraf grupları ve alt grupları hiyerarşik olarak yönetin. Her alt grup mutlaka bir masraf grubuna bağlanır."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          {groups.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
            </button>
          )}
          <button
            type="button"
            onClick={openAddGroup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Masraf Grubu Ekle
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Masraf grubu veya alt grup ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="text-xs text-slate-500">
          Hiyerarşi: <span className="font-medium text-slate-700">Masraf Grubu</span>
          {' → '}
          <span className="font-medium text-slate-700">Masraf Alt Grubu</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Henüz masraf kategorisi yok</p>
          <p className="text-xs text-slate-400 mb-4">Masraf grubu ekleyerek başlayın veya varsayılan seti yükleyin.</p>
          <button type="button" onClick={handleSeed} disabled={seeding} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
            {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isOpen = expandedGroups.has(group.id);
            const itemCount = group.children?.length ?? 0;
            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-brand-600' : 'bg-slate-100'}`}>
                      <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{group.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{group.code}</span>
                        {!group.isActive && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Pasif</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Masraf grubu · {itemCount} alt grup</p>
                    </div>
                    <span className="ml-auto text-xs text-slate-400 shrink-0 hidden sm:inline">
                      {group._count?.costEntries ?? 0} kayıt
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAddItem(group.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-brand-600 hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Alt Grup Ekle
                    </button>
                    <button type="button" onClick={() => toggleGroupStatus(group)}>
                      <StatusBadge active={group.isActive} />
                    </button>
                    <EditButton onClick={() => openEditGroup(group)} />
                    <DeleteButton onClick={() => setDeleteGroup(group)} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {!group.children || group.children.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-xs text-slate-500 mb-1">
                          <span className="font-medium text-slate-700">{group.name}</span> grubuna henüz masraf alt grubu eklenmemiş.
                        </p>
                        <button type="button" onClick={() => openAddItem(group.id)} className="mt-2 text-xs text-brand-600 hover:underline font-medium">
                          İlk masraf alt grubuni ekle
                        </button>
                      </div>
                    ) : (
                      <SettingsTable>
                        <SettingsTableHead>
                          <SettingsRowIndexTh />
                          <SettingsTableTh>Masraf Alt Grubu</SettingsTableTh>
                          <SettingsTableTh className="text-center">Kayıt</SettingsTableTh>
                          <SettingsTableTh>Durum</SettingsTableTh>
                          <SettingsTableTh>İşlemler</SettingsTableTh>
                        </SettingsTableHead>
                        <SettingsTableBody>
                          {group.children.map((item, itemIndex) => (
                            <SettingsTableRow key={item.id}>
                              <SettingsRowIndexTd index={itemIndex} />
                              <SettingsTableTd>
                                <div>
                                  <span className="text-sm font-medium text-slate-900">{item.name}</span>
                                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.code}</p>
                                </div>
                              </SettingsTableTd>
                              <SettingsTableTd className="text-center text-sm text-slate-600">{item._count?.costEntries ?? 0}</SettingsTableTd>
                              <SettingsTableTd>
                                <button type="button" onClick={() => toggleItemStatus(item)}>
                                  <StatusBadge active={item.isActive} />
                                </button>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <SettingsTableActions>
                                  <EditButton onClick={() => openEditItem(item, group.id)} />
                                  <DeleteButton onClick={() => setDeleteItem(item)} />
                                </SettingsTableActions>
                              </SettingsTableTd>
                            </SettingsTableRow>
                          ))}
                        </SettingsTableBody>
                      </SettingsTable>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SettingsModal
        isOpen={groupModal}
        onClose={() => setGroupModal(false)}
        title={editGroup ? 'Masraf Grubu Düzenle' : 'Yeni Masraf Grubu'}
        onSave={saveGroup}
        saving={groupSaving}
        error={groupError}
      >
        <div>
          <label className={labelCls}>Masraf Grubu Adı *</label>
          <input
            className={inputCls}
            value={groupForm.name}
            onChange={(e) => setGroupForm((f) => applyNameWithAutoCode(f, e.target.value, !!editGroup, 'EXP'))}
            onBlur={() => setGroupForm((f) => blurNameWithAutoCode(f, !!editGroup, 'EXP'))}
            placeholder="Örn: Tedarikçi Hakediş, Malzeme Gideri"
          />
        </div>
        {editGroup && (
          <div>
            <label className={labelCls}>Kod</label>
            <input className={`${inputCls} disabled:bg-slate-50`} value={groupForm.code} disabled />
          </div>
        )}
      </SettingsModal>

      <SettingsModal
        isOpen={itemModal}
        onClose={() => setItemModal(false)}
        title={editItem ? 'Masraf Alt Grubu Düzenle' : 'Yeni Masraf Alt Grubu'}
        onSave={saveItem}
        saving={itemSaving}
        error={itemError}
      >
        <div>
          <label className={labelCls}>Masraf Grubu *</label>
          <select
            className={`${inputCls} bg-white`}
            value={itemForm.parentId}
            onChange={(e) => setItemForm((f) => ({ ...f, parentId: e.target.value }))}
          >
            <option value="">Masraf grubu seçin...</option>
            {groups.filter((g) => g.isActive).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Bu alt grup hangi masraf grubuna bağlanacak? Örn: Yakıt → Operasyon Giderleri
          </p>
        </div>

        {selectedParentForModal && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">{selectedParentForModal.name}</span>
              {' '}
              masraf grubuna bağlanacak
            </p>
            <p className="text-[11px] text-brand-600/80 mt-0.5 font-mono">{selectedParentForModal.code}</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Masraf Alt Grubu Adı *</label>
          <input
            className={inputCls}
            value={itemForm.name}
            onChange={(e) =>
              setItemForm((f) =>
                applyNameWithAutoCode(
                  f,
                  e.target.value,
                  !!editItem,
                  selectedParentForModal?.code ?? 'EXP',
                ),
              )
            }
            onBlur={() =>
              setItemForm((f) =>
                blurNameWithAutoCode(f, !!editItem, selectedParentForModal?.code ?? 'EXP'),
              )
            }
            placeholder="Örn: Yedek Parça, Yakıt, Aidat"
          />
        </div>
        {editItem && (
          <div>
            <label className={labelCls}>Kod</label>
            <input className={`${inputCls} disabled:bg-slate-50`} value={itemForm.code} disabled />
          </div>
        )}
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteGroup !== null}
        onClose={() => setDeleteGroup(null)}
        onConfirm={confirmDeleteGroup}
        deleting={deleting}
        itemName={deleteGroup?.name}
        description={
          deleteGroup && (deleteGroup.children?.length ?? 0) > 0
            ? 'Bu masraf grubunun altında alt gruplar var. Önce alt grupları silin veya taşıyın.'
            : undefined
        }
      />
      <DeleteConfirmDialog
        isOpen={deleteItem !== null}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDeleteItem}
        deleting={deleting}
        itemName={deleteItem?.name}
        description={
          deleteItem && (deleteItem._count?.costEntries ?? 0) > 0
            ? `Bu alt gruba bağlı ${deleteItem._count?.costEntries} kayıt var. Alt grup pasife alınacaktır.`
            : undefined
        }
      />
    </SettingsPageLayout>
  );
}
