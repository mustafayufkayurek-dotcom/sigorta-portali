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

const FORMAT_LABELS: Record<string, string> = {
  repair: 'Hasar Onarım',
  emergency: 'Acil Yardım',
};

const FORMAT_COLORS: Record<string, string> = {
  repair: 'bg-blue-100 text-blue-700',
  emergency: 'bg-red-100 text-red-700',
};

type Department = {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  reportFormat: string;
  sortOrder: number;
  isSystem: boolean;
  status: string;
  _count?: { fileSubjects: number; claimFiles: number };
};

const emptyForm = { code: '', name: '', description: '', color: '#6366F1', reportFormat: 'repair', sortOrder: 0 };

export default function DepartmanlarPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/departments`, { headers: authHeader() });
      setDepartments(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ code: d.code, name: d.name, description: d.description ?? '', color: d.color, reportFormat: d.reportFormat, sortOrder: d.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { setError('Kod ve Ad zorunludur'); return; }
    const dupName = departments.find((d) =>
      d.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || d.id !== editing.id)
    );
    if (dupName) { setError('Bu isimde bir departman zaten mevcut!'); return; }
    const dupCode = departments.find((d) =>
      d.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || d.id !== editing.id)
    );
    if (dupCode) { setError('Bu kodda bir departman zaten mevcut!'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`${API}/departments/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/departments`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchDepartments();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await axios.delete(`${API}/departments/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchDepartments();
    } catch (e: any) {
      setDeleteError(e.response?.data?.message ?? 'Silinemedi');
    } finally { setDeleting(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.get(`${API}/departments/seed`, { headers: authHeader() });
      fetchDepartments();
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  return (
    <SettingsPageLayout
      title="Departman Yönetimi"
      description="Rapor Formatları ve Dosya Konularını Departman Bazlı Yönetin"
      addButtonText="+ Yeni Departman"
      onAdd={openCreate}
      headerExtra={
        <button type="button" onClick={handleSeed} disabled={seeding}
          className="border border-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50">

          {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
        </button>
      }
    >
      <SettingsTable loading={loading} empty={departments.length === 0} emptyText="Henüz departman tanımlanmamış.">
        <SettingsTableHead>
          <SettingsTableTh>Departman</SettingsTableTh>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Rapor Formatı</SettingsTableTh>
          <SettingsTableTh>Dosya Konuları</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {departments.map((d) => (
            <SettingsTableRow key={d.id}>
              <SettingsTableTd>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                  </div>
                  {d.isSystem && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sistem</span>}
                </div>
              </SettingsTableTd>
              <SettingsTableTd>
                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{d.code}</code>
              </SettingsTableTd>
              <SettingsTableTd>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FORMAT_COLORS[d.reportFormat] ?? 'bg-slate-100 text-slate-600'}`}>
                  {FORMAT_LABELS[d.reportFormat] ?? d.reportFormat}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>{d._count?.fileSubjects ?? 0} konu</SettingsTableTd>
              <SettingsTableTd>
                <StatusBadge active={d.status === 'active'} />
              </SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(d)} />
                {!d.isSystem && <DeleteButton onClick={() => { setDeleteTarget(d); setDeleteError(''); }} />}
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Departman Düzenle' : 'Yeni Departman'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <div>
          <label className={labelCls}>Kod <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
          <input className={`${inputCls} disabled:bg-slate-50`}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
            placeholder="DEPARTMAN_KODU"
            disabled={!!editing}
          />
        </div>
        <div>
          <label className={labelCls}>Ad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
          <input className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Departman Adı"
          />
        </div>
        <div>
          <label className={labelCls}>Açıklama</label>
          <input className={inputCls}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Opsiyonel Açıklama"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Rapor Formatı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
            <select className={`${inputCls} bg-white`}
              value={form.reportFormat}
              onChange={(e) => setForm({ ...form, reportFormat: e.target.value })}
            >
              <option value="repair">Hasar Onarım</option>
              <option value="emergency">Acil Yardım</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Renk</label>
            <div className="flex items-center gap-2">
              <input type="color"
                className="w-10 h-9 border border-slate-200 rounded-lg cursor-pointer p-0.5"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <input className={inputCls}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
        error={deleteError}
      />
    </SettingsPageLayout>
  );
}
