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

type DocumentType = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  status: string;
  _count?: { vendorDocuments: number };
};

const emptyForm = { code: '', name: '', description: '', isRequired: false, sortOrder: 0 };

export default function EvrakTurleriPage() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/document-types`, { headers: authHeader() });
      setTypes(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (dt: DocumentType) => {
    setEditing(dt);
    setForm({ code: dt.code, name: dt.name, description: dt.description ?? '', isRequired: dt.isRequired, sortOrder: dt.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('Kod ve Ad alanları zorunludur'); return; }
    const dupName = types.find((t) =>
      t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || t.id !== editing.id)
    );
    if (dupName) { setError('Bu isimde bir evrak türü zaten mevcut!'); return; }
    const dupCode = types.find((t) =>
      t.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || t.id !== editing.id)
    );
    if (dupCode) { setError('Bu kodda bir evrak türü zaten mevcut!'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`${API}/document-types/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/document-types`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchTypes();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/document-types/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchTypes();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Silinemedi');
    } finally { setDeleting(false); }
  };

  return (
    <SettingsPageLayout
      title="Evrak Türleri"
      description="Tedarikçilerden Talep Edilecek Belge Türlerini Yönetin"
      addButtonText="+ Yeni Evrak Türü"
      onAdd={openCreate}
    >

      <SettingsTable loading={loading} empty={types.length === 0} emptyText="Henüz evrak türü tanımlanmamış.">
        <SettingsTableHead>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Ad</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh className="text-center">Zorunlu</SettingsTableTh>
          <SettingsTableTh className="text-center">Sıra</SettingsTableTh>
          <SettingsTableTh className="text-center">Evrak Sayısı</SettingsTableTh>
          <SettingsTableTh className="text-center">Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {types.map((dt) => (
            <SettingsTableRow key={dt.id}>
              <SettingsTableTd>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{dt.code}</span>
              </SettingsTableTd>
              <SettingsTableTd className="font-medium text-slate-800">{dt.name}</SettingsTableTd>
              <SettingsTableTd className="max-w-xs truncate text-slate-500">{dt.description || '—'}</SettingsTableTd>
              <SettingsTableTd className="text-center">
                {dt.isRequired ? (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Zorunlu</span>
                ) : <span className="text-xs text-slate-400">—</span>}
              </SettingsTableTd>
              <SettingsTableTd className="text-center text-slate-600">{dt.sortOrder}</SettingsTableTd>
              <SettingsTableTd className="text-center text-slate-600">{dt._count?.vendorDocuments ?? 0}</SettingsTableTd>
              <SettingsTableTd className="text-center">
                <StatusBadge active={dt.status === 'active'} />
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(dt)} />
                <DeleteButton onClick={() => setDeleteTarget(dt)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Evrak Türünü Düzenle' : 'Yeni Evrak Türü'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <div>
          <label className={labelCls}>Kod *</label>
          <input className={inputCls}
            placeholder="Örn: VERGI_LEVHASI"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
          />
        </div>
        <div>
          <label className={labelCls}>Ad *</label>
          <input className={inputCls}
            placeholder="Örn: Vergi Levhası"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Açıklama</label>
          <input className={inputCls}
            placeholder="İsteğe Bağlı Açıklama"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sıra No</label>
            <input type="number" className={inputCls}
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded"
                checked={form.isRequired}
                onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))}
              />
              <span className="text-sm text-slate-700">Zorunlu Evrak</span>
            </label>
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
        description={
          deleteTarget && (deleteTarget._count?.vendorDocuments ?? 0) > 0
            ? `Bu evrak türüne bağlı ${deleteTarget._count?.vendorDocuments} evrak var. Yine de silmek istiyor musunuz?`
            : undefined
        }
      />
    </SettingsPageLayout>
  );
}
