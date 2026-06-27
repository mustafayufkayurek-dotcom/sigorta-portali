'use client';

import { useEffect, useState, useCallback } from 'react';
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

type HizmetTuru = { id: string; name: string; type: string; isActive: boolean; sortOrder: number };

const HIZMET_TABS = [
  { id: 'hasar', name: 'Hasar Hizmet Türleri', color: '#3B82F6' },
  { id: 'acil_yardim', name: 'Acil Yardım Hizmet Türleri', color: '#EF4444' },
] as const;

const emptyForm = () => ({ name: '', type: 'hasar' as 'hasar' | 'acil_yardim', sortOrder: 0 });

export default function HizmetTurleriPage() {
  const [activeTab, setActiveTab] = useState<'hasar' | 'acil_yardim'>('hasar');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<HizmetTuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HizmetTuru | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<HizmetTuru | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seedError, setSeedError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/service-branches/admin`, { headers: authHeader() });
      setItems(r.data.data ?? []);
    } catch { /* mevcut liste kalsın */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError('');
    try {
      const res = await axios.post(`${API}/service-branches/seed`, {}, { headers: authHeader() });
      await load();
      if (res.data?.data?.message?.includes?.('Zaten seed')) {
        setSeedError('Varsayılan hizmet türleri zaten yüklü.');
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null;
      setSeedError(msg ?? 'Varsayılanlar yüklenemedi. Oturum ve yetkinizi kontrol edin.');
    } finally { setSeeding(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm(), type: activeTab });
    setError('');
    setShowModal(true);
  };

  const openEdit = (item: HizmetTuru) => {
    setEditing(item);
    setForm({ name: item.name, type: item.type as 'hasar' | 'acil_yardim', sortOrder: item.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Hizmet türü adı zorunludur'); return; }
    const duplicate = items.find((b) =>
      b.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      b.type === form.type &&
      (!editing || b.id !== editing.id),
    );
    if (duplicate) { setError('Bu isimde bir hizmet türü zaten mevcut!'); return; }
    setSaving(true);
    try {
      if (editing) {
        await axios.patch(`${API}/service-branches/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/service-branches`, form, { headers: authHeader() });
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleToggle = async (item: HizmetTuru) => {
    try {
      await axios.patch(`${API}/service-branches/${item.id}`, { isActive: !item.isActive }, { headers: authHeader() });
      await load();
    } catch { /* sessizce geç */ }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/service-branches/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      await load();
    } catch { /* sessizce geç */ }
    finally { setDeleting(false); }
  };

  const filtered = items
    .filter((b) => b.type === activeTab)
    .filter((b) => !search.trim() || b.name.toLowerCase().includes(search.toLowerCase()));

  const tabCounts = {
    hasar: items.filter((b) => b.type === 'hasar').length,
    acil_yardim: items.filter((b) => b.type === 'acil_yardim').length,
  };

  return (
    <SettingsPageLayout
      title="Hizmet Türleri"
      description="Hasar ve acil yardım hizmet türlerini yönetin (Konut Yangın, Dahili Su, Acil Su vb.)"
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          {items.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
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
            Hizmet Türü Ekle
          </button>
        </div>
      }
    >
      {seedError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {seedError}
        </div>
      )}

      <div className="mb-4">
        <DepartmentTabSelector
          departments={HIZMET_TABS.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
          selectedId={activeTab}
          onSelect={(t) => setActiveTab(t.id as 'hasar' | 'acil_yardim')}
          counts={tabCounts}
          emptyHref="/panel/ayarlar/hizmet-turleri"
        />
      </div>

      <DepartmentDefinitionToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Hizmet türü ara..."
        hierarchyChild={activeTab === 'hasar' ? 'Hasar hizmet türü' : 'Acil yardım hizmet türü'}
      />

      <SettingsTable loading={loading} empty={filtered.length === 0} emptyText={`Henüz ${activeTab === 'hasar' ? 'hasar hizmet türü' : 'acil yardım hizmet türü'} yok`}>
        <SettingsTableHead>
          <SettingsTableTh className="w-16 text-center">Sıra</SettingsTableTh>
          <SettingsTableTh>Hizmet Türü</SettingsTableTh>
          <SettingsTableTh className="text-center">Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr')).map((b, idx) => (
            <SettingsTableRow key={b.id}>
              <SettingsTableTd className="text-center">{idx + 1}</SettingsTableTd>
              <SettingsTableTd>
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: activeTab === 'hasar' ? '#3B82F6' : '#EF4444' }}
                  />
                  <span className={`font-medium ${b.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{b.name}</span>
                </div>
              </SettingsTableTd>
              <SettingsTableTd className="text-center">
                <button type="button" onClick={() => handleToggle(b)}>
                  <StatusBadge active={b.isActive} />
                </button>
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(b)} />
                <DeleteButton onClick={() => setDeleteTarget(b)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Hizmet Türünü Düzenle' : 'Yeni Hizmet Türü'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <div>
          <label className={labelCls}>Hizmet Türü Adı *</label>
          <input className={inputCls}
            placeholder="Örn: Konut Yangın"
            value={form.name}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(''); }}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>İş Kolu</label>
          <div className="flex gap-2">
            {(['hasar', 'acil_yardim'] as const).map((type) => (
              <button key={type} type="button"
                onClick={() => setForm((p) => ({ ...p, type }))}
                className={`flex-1 py-2 px-3 rounded-xl text-sm border transition-all font-medium ${
                  form.type === type
                    ? type === 'hasar' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                {type === 'hasar' ? 'Hasar' : 'Acil Yardım'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Sıra Numarası</label>
          <input type="number" min={0} className={inputCls}
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
          />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
      />
    </SettingsPageLayout>
  );
}
