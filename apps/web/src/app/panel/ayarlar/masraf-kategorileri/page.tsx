'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { EditButton, DeleteButton, StatusBadge } from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type ExpenseCategory = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children?: ExpenseCategory[];
  _count?: { costEntries: number };
};

const emptyParentForm = { code: '', name: '', sortOrder: 0 };
const emptyChildForm = { code: '', name: '', sortOrder: 0 };

export default function MasrafKategorileriPage() {
  const [tree, setTree] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ExpenseCategory | null>(null);

  // Parent modal
  const [showParentModal, setShowParentModal] = useState(false);
  const [editingParent, setEditingParent] = useState<ExpenseCategory | null>(null);
  const [parentForm, setParentForm] = useState({ ...emptyParentForm });

  // Child modal
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ExpenseCategory | null>(null);
  const [childForm, setChildForm] = useState({ ...emptyChildForm });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteParentTarget, setDeleteParentTarget] = useState<ExpenseCategory | null>(null);
  const [deleteChildTarget, setDeleteChildTarget] = useState<ExpenseCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/expense-categories`, { headers: authHeader() });
      const data: ExpenseCategory[] = res.data.data ?? [];
      setTree(data);
      if (data.length > 0 && !selectedParent) {
        setSelectedParent(data[0]);
      } else if (selectedParent) {
        const refreshed = data.find((d) => d.id === selectedParent.id);
        if (refreshed) setSelectedParent(refreshed);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedParent]);

  useEffect(() => { fetchTree(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/expense-categories/seed`, {}, { headers: authHeader() });
      await fetchTree();
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  // ── Ana Grup ───────────────────────────────────────────────────────────────

  const openCreateParent = () => {
    setEditingParent(null);
    setParentForm({ ...emptyParentForm });
    setError('');
    setShowParentModal(true);
  };

  const openEditParent = (cat: ExpenseCategory) => {
    setEditingParent(cat);
    setParentForm({ code: cat.code, name: cat.name, sortOrder: cat.sortOrder });
    setError('');
    setShowParentModal(true);
  };

  const handleSaveParent = async () => {
    if (!parentForm.name || (!editingParent && !parentForm.code)) {
      setError('Kod ve Ad zorunludur');
      return;
    }
    const dupName = tree.find((t) =>
      t.name.trim().toLowerCase() === parentForm.name.trim().toLowerCase() && (!editingParent || t.id !== editingParent.id)
    );
    if (dupName) { setError('Bu isimde bir ana grup zaten mevcut!'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingParent) {
        await axios.patch(`${API}/expense-categories/${editingParent.id}`, { name: parentForm.name, sortOrder: parentForm.sortOrder }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expense-categories`, { ...parentForm }, { headers: authHeader() });
      }
      setShowParentModal(false);
      await fetchTree();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleDeleteParent = async (cat: ExpenseCategory) => {
    setDeleteParentTarget(cat);
  };

  const confirmDeleteParent = async () => {
    if (!deleteParentTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/expense-categories/${deleteParentTarget.id}`, { headers: authHeader() });
      setSelectedParent(null);
      setDeleteParentTarget(null);
      await fetchTree();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  // ── Alt Kategori ──────────────────────────────────────────────────────────

  const openCreateChild = () => {
    if (!selectedParent) return;
    setEditingChild(null);
    setChildForm({ ...emptyChildForm });
    setError('');
    setShowChildModal(true);
  };

  const openEditChild = (cat: ExpenseCategory) => {
    setEditingChild(cat);
    setChildForm({ code: cat.code, name: cat.name, sortOrder: cat.sortOrder });
    setError('');
    setShowChildModal(true);
  };

  const handleSaveChild = async () => {
    if (!childForm.name || (!editingChild && !childForm.code)) {
      setError('Kod ve Ad zorunludur');
      return;
    }
    if (!selectedParent) return;
    const dupName = selectedChildren.find((c) =>
      c.name.trim().toLowerCase() === childForm.name.trim().toLowerCase() && (!editingChild || c.id !== editingChild.id)
    );
    if (dupName) { setError('Bu isimde bir alt kategori zaten mevcut!'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingChild) {
        await axios.patch(`${API}/expense-categories/${editingChild.id}`, { name: childForm.name, sortOrder: childForm.sortOrder }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/expense-categories`, { ...childForm, parentId: selectedParent.id }, { headers: authHeader() });
      }
      setShowChildModal(false);
      await fetchTree();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleDeleteChild = async (cat: ExpenseCategory) => {
    setDeleteChildTarget(cat);
  };

  const confirmDeleteChild = async () => {
    if (!deleteChildTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/expense-categories/${deleteChildTarget.id}`, { headers: authHeader() });
      setDeleteChildTarget(null);
      await fetchTree();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  const selectedChildren = selectedParent?.children ?? [];

  return (
    <SettingsPageLayout
      title="Masraf Kategorileri"
      description="Gider Girişlerinde Kullanılan Hiyerarşik Kategori Ağacını Yönetin"
      addButtonText="+ Yeni Ana Grup"
      onAdd={openCreateParent}
      headerExtra={
        tree.length === 0 ? (
          <button type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="border border-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >

            {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
          </button>
        ) : undefined
      }
    >

      {loading ? (
        <div className="text-center text-slate-400 py-12">Yükleniyor...</div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <p className="text-slate-400 mb-3">Henüz masraf kategorisi tanımlanmamış.</p>
          <button type="button" onClick={handleSeed} disabled={seeding} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
            Varsayılan Kategorileri Yükle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {/* Sol: Ana Gruplar */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Ana Gruplar</p>
              </div>
              <div className="divide-y divide-slate-50">
                {tree.map((cat) => (
                  <div
                    key={cat.id}
                    className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selectedParent?.id === cat.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedParent(cat)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                      <span className={`text-sm truncate ${selectedParent?.id === cat.id ? 'font-medium text-blue-700' : 'text-slate-700'}`}>{cat.name}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{cat.children?.length ?? 0}</span>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <EditButton onClick={() => openEditParent(cat)} />
                      <DeleteButton onClick={() => handleDeleteParent(cat)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ: Alt Kategoriler */}
          <div className="col-span-3">
            {!selectedParent ? (
              <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
                Sol Taraftan Bir Ana Grup Seçin
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                    <p className="font-medium text-slate-800">{selectedParent.name}</p>
                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selectedParent.code}</code>
                    <span className="text-sm text-slate-400">— Alt Kategoriler</span>
                  </div>
                  <button type="button" onClick={openCreateChild} className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700">
                    + Alt Kategori Ekle
                  </button>
                </div>

                {selectedChildren.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="mb-2">Bu ana grup için henüz alt kategori tanımlanmamış.</p>
                    <button type="button" onClick={openCreateChild} className="text-sm text-orange-600 hover:underline">
                      İlk Alt Kategoriyi Ekle
                    </button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kategori Adı</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sıra</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durum</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedChildren.map((child) => (
                        <tr key={child.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <span className="text-sm font-medium text-slate-800">{child.name}</span>
                          </td>
                          <td className="px-5 py-3">
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{child.code}</code>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-500">{child.sortOrder}</td>
                          <td className="px-5 py-3">
                            <StatusBadge active={child.isActive} />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              <EditButton onClick={() => openEditChild(child)} />
                              <DeleteButton onClick={() => handleDeleteChild(child)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ana Grup Modal */}
      {showParentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-5">
              {editingParent ? 'Ana Grup Düzenle' : 'Yeni Ana Grup'}
            </h3>
            <div className="space-y-4">
              {!editingParent && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Kod <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                  <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                    value={parentForm.code}
                    onChange={(e) => setParentForm({ ...parentForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    placeholder="KATEGORI_KODU"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                  value={parentForm.name}
                  onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })}
                  placeholder="Kategori Adı"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sıra</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                  value={parentForm.sortOrder}
                  onChange={(e) => setParentForm({ ...parentForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowParentModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
              <button type="button" onClick={handleSaveParent} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alt Kategori Modal */}
      {showChildModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-5">
              {editingChild ? 'Alt Kategori Düzenle' : `Alt Kategori Ekle — ${selectedParent?.name}`}
            </h3>
            <div className="space-y-4">
              {!editingChild && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Kod <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                    value={childForm.code}
                    onChange={(e) => setChildForm({ ...childForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    placeholder="ALT_KATEGORI_KODU"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                  value={childForm.name}
                  onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                  placeholder="Alt Kategori Adı"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sıra</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                  value={childForm.sortOrder}
                  onChange={(e) => setChildForm({ ...childForm, sortOrder: Number(e.target.value) })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowChildModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">İptal</button>
              <button type="button" onClick={handleSaveChild} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={deleteParentTarget !== null}
        onClose={() => setDeleteParentTarget(null)}
        onConfirm={confirmDeleteParent}
        deleting={deleting}
        itemName={deleteParentTarget?.name}
      />
      <DeleteConfirmDialog
        isOpen={deleteChildTarget !== null}
        onClose={() => setDeleteChildTarget(null)}
        onConfirm={confirmDeleteChild}
        deleting={deleting}
        itemName={deleteChildTarget?.name}
      />
    </SettingsPageLayout>
  );
}
