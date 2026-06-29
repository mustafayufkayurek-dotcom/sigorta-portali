'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}
function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

type InsuranceCompany = {
  id: string;
  code: string;
  name: string;
  taxNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: 'active' | 'inactive';
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  taxNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: 'active' | 'inactive';
  notes: string;
};

const emptyForm: FormState = {
  name: '',
  taxNumber: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  status: 'active',
  notes: '',
};

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Şirket', defaultWidth: 200, minWidth: 140 },
  { id: 'code', label: 'Kod', defaultWidth: 100, minWidth: 72 },
  { id: 'taxNo', label: 'Vergi No', defaultWidth: 120, minWidth: 96 },
  { id: 'contact', label: 'İletişim', defaultWidth: 160, minWidth: 120 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
  { id: 'createdAt', label: 'Kayıt Tarihi', defaultWidth: 120, minWidth: 96 },
];

export default function SigortaSirketleriPage() {
  const tableColumns = usePanelTableColumns('table-cols:sigorta-sirketleri', TABLE_COLUMNS);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InsuranceCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/insurance-companies`, { headers: authHeader() });
      setCompanies(res.data.data ?? res.data ?? []);
    } catch (e) {
      console.error('Sigorta şirketleri yüklenemedi:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filtered = companies.filter((c) =>
    statusFilter === 'all' ? true : c.status === statusFilter,
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: InsuranceCompany) => {
    setEditing(c);
    setForm({
      name: c.name,
      taxNumber: c.taxNumber ?? '',
      contactEmail: c.contactEmail ?? '',
      contactPhone: c.contactPhone ?? '',
      address: c.address ?? '',
      status: c.status,
      notes: c.notes ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Şirket Adı Zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.patch(`${API}/insurance-companies/${editing.id}`, form, {
          headers: authHeader(),
        });
      } else {
        await axios.post(`${API}/insurance-companies`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchCompanies();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError(e.response?.data?.message ?? 'Bir hata oluştu.');
      } else {
        setError('Bir hata oluştu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/insurance-companies/${deleteTarget.id}`, {
        headers: authHeader(),
      });
      setDeleteTarget(null);
      fetchCompanies();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        alert(e.response?.data?.message ?? 'Silinemedi.');
      } else {
        alert('Silinemedi.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';

  return (
    <TableColumnsProvider value={tableColumns}>
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sigorta Şirketleri</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Sistemdeki Sigorta Şirketlerini Görüntüleyin ve Yönetin
          </p>
        </div>
        <button type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + Yeni Şirket
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 items-center flex-wrap">
        {(['all', 'active', 'inactive'] as const).map((s) => (
          <button type="button"
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              statusFilter === s
                ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? 'Tümü' : s === 'active' ? 'Aktif' : 'Pasif'}
            {s !== 'all' && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {companies.filter((c) => c.status === s).length}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-slate-400">
            {statusFilter === 'all'
              ? 'Henüz Sigorta Şirketi Eklenmemiş.'
              : `${statusFilter === 'active' ? 'Aktif' : 'Pasif'} Şirket Bulunamadı.`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full" style={panelTableLayoutStyle(tableColumns)}>
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <PanelTableTh colId="name" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  Şirket
                </PanelTableTh>
                <PanelTableTh colId="code" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  Kod
                </PanelTableTh>
                <PanelTableTh colId="taxNo" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  Vergi No
                </PanelTableTh>
                <PanelTableTh colId="contact" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  İletişim
                </PanelTableTh>
                <PanelTableTh colId="status" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  Durum
                </PanelTableTh>
                <PanelTableTh colId="createdAt" className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                  Kayıt Tarihi
                </PanelTableTh>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50">
                  <PanelTableTd colId="name" className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.address && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{c.address}</p>
                    )}
                  </PanelTableTd>
                  <PanelTableTd colId="code" className="px-5 py-3.5">
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.code}</code>
                  </PanelTableTd>
                  <PanelTableTd colId="taxNo" className="px-5 py-3.5 text-sm text-slate-600">{c.taxNumber || '—'}</PanelTableTd>
                  <PanelTableTd colId="contact" className="px-5 py-3.5">
                    <div className="space-y-0.5">
                      {c.contactEmail && (
                        <p className="text-xs text-slate-600">{c.contactEmail}</p>
                      )}
                      {c.contactPhone && (
                        <p className="text-xs text-slate-400">{c.contactPhone}</p>
                      )}
                      {!c.contactEmail && !c.contactPhone && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </PanelTableTd>
                  <PanelTableTd colId="status" className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </PanelTableTd>
                  <PanelTableTd colId="createdAt" className="px-5 py-3.5 text-sm text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString('tr-TR')}
                  </PanelTableTd>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button type="button"
                        onClick={() => openEdit(c)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Düzenle
                      </button>
                      <button type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-slate-800">
              {editing ? 'Şirket Düzenle' : 'Yeni Sigorta Şirketi'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Durum</label>
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
                  }
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Pasif</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Şirket Adı *</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Şirket Adı"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Vergi No</label>
                <input
                  className={inputCls}
                  value={form.taxNumber}
                  onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                  placeholder="0000000000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">E-posta</label>
                  <input
                    className={inputCls}
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="info@sirket.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Telefon</label>
                  <input
                    className={inputCls}
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+90 212 000 00 00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Adres</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Şirket Adresi"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Notlar</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Opsiyonel Notlar"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
              <button type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-slate-800">Şirket Silinsin mi?</h3>
            <p className="mb-5 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{deleteTarget.name}</span> Adlı Sigorta
              Şirketini Silmek İstediğinizden Emin Misiniz? Bu İşlem Geri Alınamaz.
            </p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
              <button type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TableColumnsProvider>
  );
}
