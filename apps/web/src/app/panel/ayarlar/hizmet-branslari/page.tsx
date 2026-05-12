'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
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

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type ServiceBranch = { id: string; name: string; type: string; isActive: boolean; sortOrder: number };

const emptyForm = () => ({ name: '', type: 'hasar' as 'hasar' | 'acil_yardim', sortOrder: 0 });

export default function HizmetBranslaPage() {
  const [activeTab, setActiveTab] = useState<'hasar' | 'acil_yardim'>('hasar');
  const [branches, setBranches] = useState<ServiceBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ServiceBranch | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServiceBranch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/service-branches/admin`, { headers: authHeader() });
      setBranches(r.data.data ?? []);
    } catch { /* keep existing branches */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/service-branches/seed`, {}, { headers: authHeader() });
      await load();
    } catch { /* sessizce geç */ }
    finally { setSeeding(false); }
  };

  const openAdd = () => {
    setEditingBranch(null);
    setForm({ ...emptyForm(), type: activeTab });
    setError('');
    setShowModal(true);
  };

  const openEdit = (b: ServiceBranch) => {
    setEditingBranch(b);
    setForm({ name: b.name, type: b.type as 'hasar' | 'acil_yardim', sortOrder: b.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Branş adı zorunludur'); return; }
    const duplicate = branches.find((b) =>
      b.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      b.type === form.type &&
      (!editingBranch || b.id !== editingBranch.id)
    );
    if (duplicate) { setError('Bu isimde bir branş zaten mevcut!'); return; }
    setSaving(true);
    try {
      if (editingBranch) {
        await axios.patch(`${API}/service-branches/${editingBranch.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/service-branches`, form, { headers: authHeader() });
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleToggle = async (b: ServiceBranch) => {
    try {
      await axios.patch(`${API}/service-branches/${b.id}`, { isActive: !b.isActive }, { headers: authHeader() });
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

  const filtered = branches.filter((b) => b.type === activeTab);

  return (
    <SettingsPageLayout
      title="Hizmet Branşları"
      description="Hasar ve Acil Yardım Branş Yönetimi"
      addButtonText="+ Yeni Branş"
      onAdd={openAdd}
      headerExtra={
        branches.length === 0 ? (
          <button type="button" onClick={handleSeed} disabled={seeding}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">

            {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
          </button>
        ) : undefined
      }
    >
      {/* Tab */}
      <div className="flex border-b border-slate-200 mb-4">
        {[
          { key: 'hasar', label: 'Hasar Branşları', color: 'blue' },
          { key: 'acil_yardim', label: 'Acil Yardım Branşları', color: 'orange' },
        ].map(({ key, label, color }) => (
          <button key={key} type="button"
            onClick={() => setActiveTab(key as 'hasar' | 'acil_yardim')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === key
                ? color === 'blue' ? 'border-blue-600 text-blue-600' : 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              activeTab === key ? (color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700') : 'bg-slate-100 text-slate-500'
            }`}>
              {branches.filter((b) => b.type === key).length}
            </span>
          </button>
        ))}
      </div>

      <SettingsTable loading={loading} empty={filtered.length === 0} emptyText={`Henüz ${activeTab === 'hasar' ? 'Hasar Branşı' : 'Acil Yardım Branşı'} Yok`}>
        <SettingsTableHead>
          <SettingsTableTh className="w-16 text-center">Sıra</SettingsTableTh>
          <SettingsTableTh>Branş Adı</SettingsTableTh>
          <SettingsTableTh className="text-center">Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr')).map((b, idx) => (
            <SettingsTableRow key={b.id}>
              <SettingsTableTd className="text-center">{idx + 1}</SettingsTableTd>
              <SettingsTableTd>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${activeTab === 'hasar' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    {activeTab === 'hasar' ? '🔧' : '🚨'}
                  </div>
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
        title={editingBranch ? 'Branşı Düzenle' : 'Yeni Branş Ekle'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <div>
          <label className={labelCls}>Branş Adı *</label>
          <input className={inputCls}
            placeholder="Örn: Yangın"
            value={form.name}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(''); }}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Hizmet Türü</label>
          <div className="flex gap-2">
            {(['hasar', 'acil_yardim'] as const).map((type) => (
              <button key={type} type="button"
                onClick={() => setForm((p) => ({ ...p, type }))}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all font-medium ${
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
