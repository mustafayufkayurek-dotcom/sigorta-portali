'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
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
import { DepartmentTabSelector, DepartmentDefinitionToolbar } from '@/components/settings/DepartmentTabSelector';
import { suggestAutoCode } from '@/utils/auto-code';
import { normalizeFormFreeText } from '@/utils/text-helpers';
import { persistAlphabeticSortOrders, sortByNameTR } from '@/utils/definition-sort-order';


const HIZMET_TABS = [
  { id: 'hasar', name: 'Hasar Onarım Kolları', color: '#3B82F6' },
  { id: 'acil', name: 'Acil Yardım Kolları', color: '#EF4444' },
] as const;

type VendorAcilBranch = {
  id: string;
  name: string;
  type: string;
  scope: string;
  isActive: boolean;
  sortOrder: number;
};

type WorkGroupRow = {
  id: string;
  name: string;
  code?: string;
  status: string;
  sortOrder: number;
  isSystem?: boolean;
};

const emptyAcilForm = () => ({ name: '' });
const emptyHasarForm = () => ({ name: '' });

export default function TedarikciHizmetKollariPage() {
  const [activeTab, setActiveTab] = useState<'hasar' | 'acil'>('hasar');
  const [search, setSearch] = useState('');
  const [acilItems, setAcilItems] = useState<VendorAcilBranch[]>([]);
  const [workGroups, setWorkGroups] = useState<WorkGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAcil, setEditingAcil] = useState<VendorAcilBranch | null>(null);
  const [editingHasar, setEditingHasar] = useState<WorkGroupRow | null>(null);
  const [acilForm, setAcilForm] = useState(emptyAcilForm());
  const [hasarForm, setHasarForm] = useState(emptyHasarForm());
  const [error, setError] = useState('');
  const [deleteAcilTarget, setDeleteAcilTarget] = useState<VendorAcilBranch | null>(null);
  const [deleteHasarTarget, setDeleteHasarTarget] = useState<WorkGroupRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [seedError, setSeedError] = useState('');

  const syncAcilSortOrders = useCallback(async (list: VendorAcilBranch[]) => {
    await persistAlphabeticSortOrders(list, (id, sortOrder) =>
      axios.patch(`${API}/service-branches/${id}`, { sortOrder }, { headers: authHeader() }),
    );
  }, []);

  const syncHasarSortOrders = useCallback(async (list: WorkGroupRow[]) => {
    await persistAlphabeticSortOrders(list, (id, sortOrder) =>
      axios.put(`${API}/work-groups/${id}`, { sortOrder }, { headers: authHeader() }),
    );
  }, []);

  const loadAcil = useCallback(async () => {
    const r = await axios.get(`${API}/service-branches/admin`, {
      headers: authHeader(),
      params: { type: 'acil_yardim', scope: 'vendor' },
    });
    const data: VendorAcilBranch[] = r.data.data ?? [];
    await syncAcilSortOrders(data);
    const r2 = await axios.get(`${API}/service-branches/admin`, {
      headers: authHeader(),
      params: { type: 'acil_yardim', scope: 'vendor' },
    });
    setAcilItems(r2.data.data ?? data);
  }, [syncAcilSortOrders]);

  const loadWorkGroups = useCallback(async () => {
    const r = await axios.get(`${API}/work-groups`, { headers: authHeader() });
    const data: WorkGroupRow[] = r.data.data ?? [];
    await syncHasarSortOrders(data);
    const r2 = await axios.get(`${API}/work-groups`, { headers: authHeader() });
    setWorkGroups(r2.data.data ?? data);
  }, [syncHasarSortOrders]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadAcil(), loadWorkGroups()]);
    } catch {
      /* mevcut liste kalsın */
    } finally {
      setLoading(false);
    }
  }, [loadAcil, loadWorkGroups]);

  useEffect(() => { load(); }, [load]);

  const handleSeedAcil = async () => {
    setSeeding(true);
    setSeedError('');
    try {
      const res = await axios.post(`${API}/service-branches/seed-vendor-acil`, {}, { headers: authHeader() });
      await loadAcil();
      if (res.data?.data?.message?.includes?.('zaten seed')) {
        setSeedError('Varsayılan tedarikçi acil hizmet kolları zaten yüklü.');
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null;
      setSeedError(msg ?? 'Varsayılanlar yüklenemedi.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedHasar = async () => {
    setSeeding(true);
    setSeedError('');
    try {
      await axios.post(`${API}/work-groups/seed`, {}, { headers: authHeader() });
      await loadWorkGroups();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null;
      setSeedError(msg ?? 'Varsayılan iş grupları yüklenemedi.');
    } finally {
      setSeeding(false);
    }
  };

  const openAdd = () => {
    setError('');
    if (activeTab === 'acil') {
      setEditingAcil(null);
      setEditingHasar(null);
      setAcilForm(emptyAcilForm());
    } else {
      setEditingHasar(null);
      setEditingAcil(null);
      setHasarForm(emptyHasarForm());
    }
    setShowModal(true);
  };

  const openEditAcil = (item: VendorAcilBranch) => {
    setEditingAcil(item);
    setEditingHasar(null);
    setAcilForm({ name: item.name });
    setError('');
    setShowModal(true);
  };

  const openEditHasar = (item: WorkGroupRow) => {
    setEditingHasar(item);
    setEditingAcil(null);
    setHasarForm({ name: item.name });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (activeTab === 'acil' || editingAcil) {
        const name = normalizeFormFreeText(acilForm.name);
        if (!name) { setError('Hizmet kolu adı zorunludur'); setSaving(false); return; }
        const payload = {
          name,
          type: 'acil_yardim',
          scope: 'vendor',
        };
        if (editingAcil) {
          await axios.patch(`${API}/service-branches/${editingAcil.id}`, payload, { headers: authHeader() });
        } else {
          await axios.post(`${API}/service-branches`, payload, { headers: authHeader() });
        }
        await loadAcil();
      } else {
        const name = normalizeFormFreeText(hasarForm.name);
        if (!name) { setError('Hizmet kolu adı zorunludur'); setSaving(false); return; }
        if (editingHasar) {
          await axios.put(`${API}/work-groups/${editingHasar.id}`, {
            name,
          }, { headers: authHeader() });
        } else {
          await axios.post(`${API}/work-groups`, {
            code: suggestAutoCode('WG', name),
            name,
          }, { headers: authHeader() });
        }
        await loadWorkGroups();
      }
      setShowModal(false);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null;
      setError(msg ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAcil = async (item: VendorAcilBranch) => {
    try {
      await axios.patch(`${API}/service-branches/${item.id}`, { isActive: !item.isActive }, { headers: authHeader() });
      await loadAcil();
    } catch { /* sessizce geç */ }
  };

  const handleToggleHasar = async (item: WorkGroupRow) => {
    try {
      await axios.put(`${API}/work-groups/${item.id}`, {
        status: item.status === 'active' ? 'inactive' : 'active',
      }, { headers: authHeader() });
      await loadWorkGroups();
    } catch { /* sessizce geç */ }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      if (deleteAcilTarget) {
        await axios.delete(`${API}/service-branches/${deleteAcilTarget.id}`, { headers: authHeader() });
        setDeleteAcilTarget(null);
        await loadAcil();
      }
      if (deleteHasarTarget) {
        await axios.delete(`${API}/work-groups/${deleteHasarTarget.id}`, { headers: authHeader() });
        setDeleteHasarTarget(null);
        await loadWorkGroups();
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null;
      setDeleteError(msg ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const filteredAcil = sortByNameTR(
    acilItems
      .filter((b) => b.type === 'acil_yardim')
      .filter((b) => !search.trim() || b.name.toLowerCase().includes(search.toLowerCase())),
  );

  const filteredHasar = sortByNameTR(
    workGroups.filter((g) =>
      !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  const tabCounts = {
    hasar: workGroups.filter((g) => g.status === 'active').length,
    acil: acilItems.filter((b) => b.isActive).length,
  };

  const isAcilModal = editingAcil !== null || (showModal && activeTab === 'acil' && editingHasar === null);
  const modalForm = isAcilModal ? acilForm : hasarForm;
  const setModalForm = isAcilModal ? setAcilForm : setHasarForm;

  return (
    <SettingsPageLayout
          title="Tedarikçi Hizmet Kolları"
          description="Tedarikçi tanımlama kartında görünen uzmanlık alanları. Meridyen hizmet branşları ile karıştırılmaz."
          backHref={TANIMLAR_BACK_HREF}
          backText={TANIMLAR_BACK_TEXT}
          headerExtra={
            <div className="flex items-center gap-2">
          {activeTab === 'acil' && acilItems.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedAcil}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {seeding ? 'Yükleniyor...' : 'Varsayılan Acil Kollarını Yükle'}
                </button>
              )}
              {activeTab === 'hasar' && workGroups.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedHasar}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {seeding ? 'Yükleniyor...' : 'Varsayılan Hasar Kollarını Yükle'}
                </button>
              )}
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {activeTab === 'acil' ? 'Acil Hizmet Kolu Ekle' : 'Hasar Hizmet Kolu Ekle'}
              </button>
            </div>
          }
        >
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed">
            <strong>Ayrım:</strong> Bu ekran yalnızca <strong>tedarikçi kartı</strong> içindir (sıvacı, boyacı, çilingir vb.).
            Dosya konuları (hasar / acil branş listeleri) için{' '}
            <Link href="/panel/ayarlar/dosya-konulari" className="underline font-medium">Dosya Konuları</Link>
            {' '}sayfasını kullanın. Hasar kolları maliyet kalemleri için{' '}
            <Link href="/panel/ayarlar/is-gruplari" className="underline font-medium">İş Grupları</Link>
            {' '}ekranında alt grup fiyatlandırması yapılır.
          </div>

          <div className="mb-4">
            <DepartmentTabSelector
              departments={HIZMET_TABS.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
              selectedId={activeTab}
              onSelect={(t) => { setActiveTab(t.id as 'hasar' | 'acil'); setSearch(''); }}
              counts={tabCounts}
            />
          </div>

          <DepartmentDefinitionToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={activeTab === 'hasar' ? 'Hasar hizmet kolu ara...' : 'Acil hizmet kolu ara...'}
            hierarchyChild={activeTab === 'hasar' ? 'Tedarikçi hasar hizmet kolu (iş grubu)' : 'Tedarikçi acil hizmet kolu'}
          />

          {seedError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {seedError}
            </div>
          )}

          {activeTab === 'hasar' ? (
            <SettingsTable loading={loading} empty={filteredHasar.length === 0} emptyText="Henüz hasar hizmet kolu yok">
              <SettingsTableHead>
                <SettingsRowIndexTh className="w-16" />
                <SettingsTableTh>Tedarikçi Hasar Hizmet Kolu</SettingsTableTh>
                <SettingsTableTh className="text-center">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredHasar.map((g, idx) => (
                    <SettingsTableRow key={g.id}>
                      <SettingsRowIndexTd index={idx} />
                      <SettingsTableTd>
                        <span className={`font-medium ${g.status === 'active' ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {g.name}
                        </span>
                      </SettingsTableTd>
                      <SettingsTableTd className="text-center">
                        <button type="button" onClick={() => handleToggleHasar(g)}>
                          <StatusBadge active={g.status === 'active'} />
                        </button>
                      </SettingsTableTd>
                      <SettingsTableActions>
                          <EditButton onClick={() => openEditHasar(g)} />
                          <DeleteButton onClick={() => { setDeleteHasarTarget(g); setDeleteError(''); }} />
                        </SettingsTableActions>
                    </SettingsTableRow>
                  ))}
              </SettingsTableBody>
            </SettingsTable>
          ) : (
            <SettingsTable loading={loading} empty={filteredAcil.length === 0} emptyText="Henüz tedarikçi acil hizmet kolu yok">
              <SettingsTableHead>
                <SettingsRowIndexTh className="w-16" />
                <SettingsTableTh>Tedarikçi Acil Hizmet Kolu</SettingsTableTh>
                <SettingsTableTh className="text-center">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredAcil.map((b, idx) => (
                    <SettingsTableRow key={b.id}>
                      <SettingsRowIndexTd index={idx} />
                      <SettingsTableTd>
                        <span className={`font-medium ${b.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {b.name}
                        </span>
                      </SettingsTableTd>
                      <SettingsTableTd className="text-center">
                        <button type="button" onClick={() => handleToggleAcil(b)}>
                          <StatusBadge active={b.isActive} />
                        </button>
                      </SettingsTableTd>
                      <SettingsTableActions>
                          <EditButton onClick={() => openEditAcil(b)} />
                          <DeleteButton onClick={() => { setDeleteAcilTarget(b); setDeleteError(''); }} />
                        </SettingsTableActions>
                    </SettingsTableRow>
                  ))}
              </SettingsTableBody>
            </SettingsTable>
          )}

          <SettingsModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={
              isAcilModal
                ? (editingAcil ? 'Acil Hizmet Kolunu Düzenle' : 'Yeni Tedarikçi Acil Hizmet Kolu')
                : (editingHasar ? 'Hasar Hizmet Kolunu Düzenle' : 'Yeni Tedarikçi Hasar Hizmet Kolu')
            }
            onSave={handleSave}
            saving={saving}
            error={error}
          >
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Hizmet Kolu Adı *</label>
                <input
                  className={inputCls}
                  placeholder={isAcilModal ? 'Örn: Elektrikçi, Su Tesisatçısı' : 'Örn: Sıva, Boya, Mobilya'}
                  value={modalForm.name}
                  onChange={(e) => setModalForm((p) => ({ ...p, name: e.target.value }))}
                  onBlur={(e) => {
                    const v = normalizeFormFreeText(e.target.value);
                    if (v !== e.target.value.trim()) setModalForm((p) => ({ ...p, name: v }));
                  }}
                />
              </div>
            </div>
          </SettingsModal>

          <DeleteConfirmDialog
            isOpen={deleteAcilTarget !== null || deleteHasarTarget !== null}
            onClose={() => { setDeleteAcilTarget(null); setDeleteHasarTarget(null); setDeleteError(''); }}
            onConfirm={handleDelete}
            deleting={deleting}
            itemName={deleteAcilTarget?.name ?? deleteHasarTarget?.name}
            error={deleteError}
          />
        </SettingsPageLayout>
  );
}
