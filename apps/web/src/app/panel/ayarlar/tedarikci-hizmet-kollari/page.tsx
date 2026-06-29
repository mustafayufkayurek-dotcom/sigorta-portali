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
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { DepartmentTabSelector, DepartmentDefinitionToolbar } from '@/components/settings/DepartmentTabSelector';
import type { TableColumnDef } from '@/components/ui/TableColumnPicker';
import { SettingsTableColumnsProvider, SettingsTableColumnPicker } from '@/components/settings/SettingsTableColumns';
import { suggestAutoCode } from '@/utils/auto-code';

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'sort', label: 'Sıra', defaultWidth: 64, minWidth: 48 },
  { id: 'name', label: 'Hizmet Kolu', defaultWidth: 220, minWidth: 140 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

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

const emptyAcilForm = () => ({ name: '', sortOrder: 0 });
const emptyHasarForm = () => ({ name: '', sortOrder: 0 });

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
  const [seedError, setSeedError] = useState('');

  const loadAcil = useCallback(async () => {
    const r = await axios.get(`${API}/service-branches/admin`, {
      headers: authHeader(),
      params: { type: 'acil_yardim', scope: 'vendor' },
    });
    setAcilItems(r.data.data ?? []);
  }, []);

  const loadWorkGroups = useCallback(async () => {
    const r = await axios.get(`${API}/work-groups`, { headers: authHeader() });
    setWorkGroups(r.data.data ?? []);
  }, []);

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
    setAcilForm({ name: item.name, sortOrder: item.sortOrder });
    setError('');
    setShowModal(true);
  };

  const openEditHasar = (item: WorkGroupRow) => {
    setEditingHasar(item);
    setEditingAcil(null);
    setHasarForm({ name: item.name, sortOrder: item.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (activeTab === 'acil' || editingAcil) {
        if (!acilForm.name.trim()) { setError('Hizmet kolu adı zorunludur'); setSaving(false); return; }
        const payload = {
          name: acilForm.name.trim(),
          type: 'acil_yardim',
          scope: 'vendor',
          sortOrder: acilForm.sortOrder,
        };
        if (editingAcil) {
          await axios.patch(`${API}/service-branches/${editingAcil.id}`, payload, { headers: authHeader() });
        } else {
          await axios.post(`${API}/service-branches`, payload, { headers: authHeader() });
        }
        await loadAcil();
      } else {
        if (!hasarForm.name.trim()) { setError('Hizmet kolu adı zorunludur'); setSaving(false); return; }
        if (editingHasar) {
          await axios.put(`${API}/work-groups/${editingHasar.id}`, {
            name: hasarForm.name.trim(),
            sortOrder: hasarForm.sortOrder,
          }, { headers: authHeader() });
        } else {
          await axios.post(`${API}/work-groups`, {
            code: suggestAutoCode('WG', hasarForm.name.trim()),
            name: hasarForm.name.trim(),
            sortOrder: hasarForm.sortOrder,
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
    } catch { /* sessizce geç */ }
    finally { setDeleting(false); }
  };

  const filteredAcil = acilItems
    .filter((b) => b.type === 'acil_yardim')
    .filter((b) => !search.trim() || b.name.toLowerCase().includes(search.toLowerCase()));

  const filteredHasar = workGroups.filter((g) =>
    !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()),
  );

  const tabCounts = {
    hasar: workGroups.filter((g) => g.status === 'active').length,
    acil: acilItems.filter((b) => b.isActive).length,
  };

  const isAcilModal = editingAcil !== null || (showModal && activeTab === 'acil' && editingHasar === null);
  const modalForm = isAcilModal ? acilForm : hasarForm;
  const setModalForm = isAcilModal ? setAcilForm : setHasarForm;

  return (
    <SettingsTableColumnsProvider columns={TABLE_COLUMNS}>
      {(tableColumns) => (
        <SettingsPageLayout
          title="Tedarikçi Hizmet Kolları"
          description="Tedarikçi tanımlama kartında görünen uzmanlık alanları. Meridyen hizmet branşları ile karıştırılmaz."
          backHref={TANIMLAR_BACK_HREF}
          backText={TANIMLAR_BACK_TEXT}
          headerExtra={
            <div className="flex items-center gap-2">
              <SettingsTableColumnPicker tableColumns={tableColumns} />
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
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
            Meridyen operasyon branşları için{' '}
            <Link href="/panel/ayarlar/hizmet-turleri" className="underline font-medium">Meridyen Hizmet Branşları</Link>
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
                <SettingsTableTh colId="sort" className="w-16 text-center">Sıra</SettingsTableTh>
                <SettingsTableTh colId="name">Tedarikçi Hasar Hizmet Kolu</SettingsTableTh>
                <SettingsTableTh colId="status" className="text-center">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredHasar
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'))
                  .map((g, idx) => (
                    <SettingsTableRow key={g.id}>
                      <SettingsTableTd colId="sort" className="text-center">{idx + 1}</SettingsTableTd>
                      <SettingsTableTd colId="name">
                        <span className={`font-medium ${g.status === 'active' ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {g.name}
                        </span>
                      </SettingsTableTd>
                      <SettingsTableTd colId="status" className="text-center">
                        <button type="button" onClick={() => handleToggleHasar(g)}>
                          <StatusBadge active={g.status === 'active'} />
                        </button>
                      </SettingsTableTd>
                      <SettingsTableTd>
                        <SettingsTableActions>
                          <EditButton onClick={() => openEditHasar(g)} />
                          {!g.isSystem && (
                            <DeleteButton onClick={() => setDeleteHasarTarget(g)} />
                          )}
                        </SettingsTableActions>
                      </SettingsTableTd>
                    </SettingsTableRow>
                  ))}
              </SettingsTableBody>
            </SettingsTable>
          ) : (
            <SettingsTable loading={loading} empty={filteredAcil.length === 0} emptyText="Henüz tedarikçi acil hizmet kolu yok">
              <SettingsTableHead>
                <SettingsTableTh colId="sort" className="w-16 text-center">Sıra</SettingsTableTh>
                <SettingsTableTh colId="name">Tedarikçi Acil Hizmet Kolu</SettingsTableTh>
                <SettingsTableTh colId="status" className="text-center">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredAcil
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'))
                  .map((b, idx) => (
                    <SettingsTableRow key={b.id}>
                      <SettingsTableTd colId="sort" className="text-center">{idx + 1}</SettingsTableTd>
                      <SettingsTableTd colId="name">
                        <span className={`font-medium ${b.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {b.name}
                        </span>
                      </SettingsTableTd>
                      <SettingsTableTd colId="status" className="text-center">
                        <button type="button" onClick={() => handleToggleAcil(b)}>
                          <StatusBadge active={b.isActive} />
                        </button>
                      </SettingsTableTd>
                      <SettingsTableTd>
                        <SettingsTableActions>
                          <EditButton onClick={() => openEditAcil(b)} />
                          <DeleteButton onClick={() => setDeleteAcilTarget(b)} />
                        </SettingsTableActions>
                      </SettingsTableTd>
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
                />
              </div>
              <div>
                <label className={labelCls}>Sıra</label>
                <input
                  type="number"
                  className={inputCls}
                  value={modalForm.sortOrder}
                  onChange={(e) => setModalForm((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
          </SettingsModal>

          <DeleteConfirmDialog
            isOpen={deleteAcilTarget !== null || deleteHasarTarget !== null}
            onClose={() => { setDeleteAcilTarget(null); setDeleteHasarTarget(null); }}
            onConfirm={handleDelete}
            deleting={deleting}
            itemName={deleteAcilTarget?.name ?? deleteHasarTarget?.name}
          />
        </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
