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

type Department = { id: string; code: string; name: string; color: string; reportFormat: string; isSystem: boolean };
type FileSubject = { id: string; code: string; name: string; sortOrder: number; isSystem: boolean; status: string };

const emptyForm = { code: '', name: '', sortOrder: 0, status: 'active' };

export default function DosyaKonulariPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [subjects, setSubjects] = useState<FileSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FileSubject | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileSubject | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => {
        const depts = r.data.data ?? [];
        setDepartments(depts);
        if (depts.length > 0) setSelectedDept(depts[0]);
      })
      .catch(console.error);
  }, []);

  const fetchSubjects = useCallback(async (deptId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/departments/${deptId}/file-subjects`, { headers: authHeader() });
      setSubjects(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedDept) fetchSubjects(selectedDept.id);
  }, [selectedDept, fetchSubjects]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: FileSubject) => {
    setEditing(s);
    setForm({ code: s.code, name: s.name, sortOrder: s.sortOrder, status: s.status });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { setError('Kod ve Ad zorunludur'); return; }
    if (!selectedDept) return;
    const dupName = subjects.find((s) =>
      s.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || s.id !== editing.id)
    );
    if (dupName) { setError('Bu isimde bir dosya konusu zaten mevcut!'); return; }
    const dupCode = subjects.find((s) =>
      s.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || s.id !== editing.id)
    );
    if (dupCode) { setError('Bu kodda bir dosya konusu zaten mevcut!'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`${API}/department-file-subjects/${editing.id}`,
          { code: form.code, name: form.name, sortOrder: form.sortOrder, status: form.status },
          { headers: authHeader() });
      } else {
        await axios.post(`${API}/departments/${selectedDept.id}/file-subjects`,
          { code: form.code, name: form.name, sortOrder: form.sortOrder },
          { headers: authHeader() });
      }
      setShowModal(false);
      fetchSubjects(selectedDept.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleToggleStatus = async (s: FileSubject) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await axios.put(`${API}/department-file-subjects/${s.id}`, { status: newStatus }, { headers: authHeader() });
      if (selectedDept) fetchSubjects(selectedDept.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Durum değiştirilemedi');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/department-file-subjects/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      if (selectedDept) fetchSubjects(selectedDept.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally { setDeleting(false); }
  };

  return (
    <SettingsPageLayout
      title="Dosya Konuları"
      description="Her Departman için Dosya Konularını Tanımlayın"
    >

      <div className="grid grid-cols-4 gap-5">
        {/* Sol: Departman Listesi */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase">Departmanlar</p>
            </div>
            <div className="divide-y divide-slate-50">
              {departments.map((d) => (
                <button type="button" key={d.id} onClick={() => setSelectedDept(d)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-colors ${selectedDept?.id === d.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className={`text-sm ${selectedDept?.id === d.id ? 'font-medium text-blue-700' : 'text-slate-700'}`}>{d.name}</span>
                </button>
              ))}
              {departments.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  <a href="/panel/ayarlar/departmanlar" className="text-blue-600 hover:underline">Önce Departman Oluşturun</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ: Dosya Konuları */}
        <div className="col-span-3">
          {!selectedDept ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
              Sol Taraftan Bir Departman Seçin
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedDept.color }} />
                  <p className="font-medium text-slate-800">{selectedDept.name}</p>
                  <span className="text-sm text-slate-400">— Dosya Konuları</span>
                </div>
                <button type="button" onClick={openCreate}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                  + Konu Ekle
                </button>
              </div>

              <SettingsTable loading={loading} empty={subjects.length === 0} emptyText="Bu Departman için Henüz Dosya Konusu Tanımlanmamış.">
                <SettingsTableHead>
                  <SettingsTableTh className="w-16">Sıra</SettingsTableTh>
                  <SettingsTableTh>Konu Adı</SettingsTableTh>
                  <SettingsTableTh>Kod</SettingsTableTh>
                  <SettingsTableTh>Durum</SettingsTableTh>
                  <SettingsTableTh />
                </SettingsTableHead>
                <SettingsTableBody>
                  {subjects.map((s) => (
                    <SettingsTableRow key={s.id}>
                      <SettingsTableTd className="w-16">{s.sortOrder}</SettingsTableTd>
                      <SettingsTableTd>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{s.name}</span>
                          {s.isSystem && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Sistem</span>}
                        </div>
                      </SettingsTableTd>
                      <SettingsTableTd>
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{s.code}</code>
                      </SettingsTableTd>
                      <SettingsTableTd>
                        <button type="button" onClick={() => handleToggleStatus(s)}>
                          <StatusBadge active={s.status === 'active'} />
                        </button>
                      </SettingsTableTd>
                      <SettingsTableActions>
                        <EditButton onClick={() => openEdit(s)} />
                        {!s.isSystem && <DeleteButton onClick={() => setDeleteTarget(s)} />}
                      </SettingsTableActions>
                    </SettingsTableRow>
                  ))}
                </SettingsTableBody>
              </SettingsTable>
            </div>
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Dosya Konusu Düzenle' : 'Yeni Dosya Konusu'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <div>
          <label className={labelCls}>Kod *</label>
          <input className={inputCls}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
            placeholder="KONU_KODU"
          />
        </div>
        <div>
          <label className={labelCls}>Konu Adı *</label>
          <input className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Dosya Konusu Adı"
          />
        </div>
        <div>
          <label className={labelCls}>Sıra</label>
          <input type="number" className={inputCls}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
          />
        </div>
        {editing && (
          <div>
            <label className={labelCls}>Durum</label>
            <select className={`${inputCls} bg-white`}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        )}
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
