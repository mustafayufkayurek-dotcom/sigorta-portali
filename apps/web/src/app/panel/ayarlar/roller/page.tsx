'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  EditButton,
  DeleteButton,
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
import { normalizeFormFreeText } from '@/utils/text-helpers';


type Role = { id: string; code: string; name: string; description?: string | null; _count?: { users: number } };

const emptyForm = { name: '', code: '', description: '' };

export default function RollerPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setShowModal(true); };
  const openEdit = (r: Role) => { setEditing(r); setForm({ name: r.name, code: r.code, description: r.description ?? '' }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    const name = normalizeFormFreeText(form.name);
    const description = form.description.trim() ? normalizeFormFreeText(form.description) : '';
    if (!name) { setError('Rol Adı zorunludur'); return; }
    if (!form.code.trim()) { setError('Kod zorunludur'); return; }
    if (!/^[A-Z_]+$/.test(form.code)) { setError('Kod yalnızca büyük harf ve alt çizgi (_) içerebilir'); return; }
    const dupName = roles.find((r) =>
      r.name.trim().toLowerCase() === name.toLowerCase() && (!editing || r.id !== editing.id)
    );
    if (dupName) { setError('Bu isimde bir rol zaten mevcut!'); return; }
    const dupCode = roles.find((r) =>
      r.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || r.id !== editing.id)
    );
    if (dupCode) { setError('Bu kodda bir rol zaten mevcut!'); return; }
    const payload = { name, code: form.code, description: description || undefined };
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/roles/${editing.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/roles`, payload, { headers: authHeader() });
      }
      setShowModal(false); fetchRoles();
    } catch (e: any) { setError(e.response?.data?.message ?? 'Bir hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await axios.delete(`${API}/roles/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null); fetchRoles();
    } catch (e: any) { setDeleteError(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  return (
    <SettingsPageLayout
      title="Rol Yönetimi"
      description="Sistem rollerini ve yetkilerini yönetin"
      addButtonText="+ Yeni Rol"
      onAdd={openCreate}
    >

      <div className="mb-4">
        <input className={`${inputCls} max-w-xs`}
          placeholder="Rol ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <SettingsTable loading={loading} empty={filtered.length === 0}
        emptyText={search ? 'Arama kriterlerine uyan rol bulunamadı.' : 'Henüz rol tanımlanmamış.'}>
        <SettingsTableHead>
          <SettingsTableTh>Rol Adı</SettingsTableTh>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh>Kullanıcı Sayısı</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {filtered.map((r) => (
            <SettingsTableRow key={r.id}>
              <SettingsTableTd><p className="text-sm font-medium text-slate-800">{r.name}</p></SettingsTableTd>
              <SettingsTableTd>
                <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{r.code}</code>
              </SettingsTableTd>
              <SettingsTableTd>
                <p className="text-sm text-slate-500">{r.description || <span className="text-slate-300 italic">—</span>}</p>
              </SettingsTableTd>
              <SettingsTableTd>
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <span className="font-medium">{r._count?.users ?? 0}</span>
                  <span className="text-slate-400">kullanıcı</span>
                </span>
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(r)} />
                <DeleteButton onClick={() => { setDeleteTarget(r); setDeleteError(''); }} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Rol Düzenle' : 'Yeni Rol'}
        onSave={handleSave} saving={saving} error={error}>
        <div>
          <label className={labelCls}>Rol Adı <span className="text-red-500">*</span></label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setForm((p) => ({ ...p, name: v })); }} placeholder="Örn: Muhasebe Yöneticisi" />
        </div>
        <div>
          <label className={labelCls}>Kod <span className="text-red-500">*</span></label>
          <input className={`${inputCls} font-mono ${editing ? 'bg-slate-50 text-slate-400' : ''}`}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') })}
            placeholder="ORNEK_KOD"
            disabled={!!editing}
          />
          {!editing && <p className="text-xs text-slate-400 mt-1">Yalnızca büyük harf ve alt çizgi kullanın. Oluşturulduktan sonra değiştirilemez.</p>}
        </div>
        <div>
          <label className={labelCls}>Açıklama</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            onBlur={(e) => { const v = normalizeFormFreeText(e.target.value); if (v !== e.target.value.trim()) setForm((p) => ({ ...p, description: v })); }}
            placeholder="Opsiyonel açıklama" />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
        error={deleteError}
        description={
          (deleteTarget?._count?.users ?? 0) > 0
            ? `Bu role ${deleteTarget?._count?.users} kullanıcı atanmış. Silme işlemi engellenecektir.`
            : undefined
        }
      />
    </SettingsPageLayout>
  );
}
