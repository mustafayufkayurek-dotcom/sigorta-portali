'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  DeleteButton,
  EditButton,
  inputCls,
  labelCls,
  SettingsTable,
  SettingsTableActions,
  SettingsTableBody,
  SettingsTableHead,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableTh,
  StatusBadge,
} from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog, SettingsModal } from '@/components/settings/SettingsModal';
import {
  formatSettingsApiError,
  SETTINGS_API as API,
  settingsAuthHeader as authHeader,
} from '@/utils/settings-api';

type InsuranceCompany = {
  id: string;
  code: string;
  name: string;
  taxNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  createdAt: string;
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

const EMPTY_FORM: FormState = {
  name: '',
  taxNumber: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  status: 'active',
  notes: '',
};

export default function SigortaSirketleriPage() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InsuranceCompany | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerCompany, setDrawerCompany] = useState<InsuranceCompany | null>(null);
  const [drawerTab, setDrawerTab] = useState<'bilgi' | 'evraklar'>('bilgi');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/insurance-companies`, {
        headers: authHeader(),
        params: { status: 'all', limit: 1000 },
      });
      setCompanies(response.data.data ?? []);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filteredCompanies = companies.filter(
    (company) => statusFilter === 'all' || company.status === statusFilter,
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowModal(true);
  };

  const openEdit = (company: InsuranceCompany) => {
    setEditing(company);
    setForm({
      name: company.name,
      taxNumber: company.taxNumber ?? '',
      contactEmail: company.contactEmail ?? '',
      contactPhone: company.contactPhone ?? '',
      address: company.address ?? '',
      status: company.status,
      notes: company.notes ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Şirket Adı zorunludur.');
      return;
    }
    const duplicate = companies.some(
      (company) =>
        company.id !== editing?.id &&
        company.name.trim().toLocaleLowerCase('tr-TR') === form.name.trim().toLocaleLowerCase('tr-TR'),
    );
    if (duplicate) {
      setError('Bu isimde bir sigorta şirketi zaten mevcut.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.patch(`${API}/insurance-companies/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/insurance-companies`, form, { headers: authHeader() });
      }
      setShowModal(false);
      await fetchCompanies();
    } catch (requestError) {
      setError(formatSettingsApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/insurance-companies/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      await fetchCompanies();
    } catch (requestError) {
      setError(formatSettingsApiError(requestError, 'Sigorta şirketi pasifleştirilemedi.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Sigorta Şirketleri"
      description="Operasyonda kullanılan sigorta şirketi master kayıtlarını yönetin."
      addButtonText="Yeni Şirket"
      onAdd={openCreate}
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['all', 'active', 'inactive'] as const).map((status) => {
          const count =
            status === 'all'
              ? companies.length
              : companies.filter((company) => company.status === status).length;
          const label = status === 'all' ? 'Tümü' : status === 'active' ? 'Aktif' : 'Pasif';
          return (
            <button
              type="button"
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <SettingsTable
        loading={loading}
        empty={filteredCompanies.length === 0}
        emptyText={
          statusFilter === 'all'
            ? 'Henüz sigorta şirketi eklenmemiş.'
            : `${statusFilter === 'active' ? 'Aktif' : 'Pasif'} sigorta şirketi bulunamadı.`
        }
      >
        <SettingsTableHead>
          <SettingsTableTh>Şirket</SettingsTableTh>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Vergi No</SettingsTableTh>
          <SettingsTableTh>İletişim</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh>Kayıt Tarihi</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {filteredCompanies.map((company) => (
            <SettingsTableRow
              key={company.id}
              onClick={() => {
                setDrawerCompany(company);
                setDrawerTab('bilgi');
              }}
            >
              <SettingsTableTd>
                <p className="text-sm font-medium text-slate-800">{company.name}</p>
                {company.address && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{company.address}</p>
                )}
              </SettingsTableTd>
              <SettingsTableTd>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{company.code}</code>
              </SettingsTableTd>
              <SettingsTableTd>{company.taxNumber || '—'}</SettingsTableTd>
              <SettingsTableTd>
                {company.contactEmail && <p className="text-xs text-slate-600">{company.contactEmail}</p>}
                {company.contactPhone && <p className="text-xs text-slate-400">{company.contactPhone}</p>}
                {!company.contactEmail && !company.contactPhone && '—'}
              </SettingsTableTd>
              <SettingsTableTd>
                <StatusBadge active={company.status === 'active'} />
              </SettingsTableTd>
              <SettingsTableTd className="text-slate-400">
                {new Date(company.createdAt).toLocaleDateString('tr-TR')}
              </SettingsTableTd>
              <SettingsTableActions>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerCompany(company);
                    setDrawerTab('evraklar');
                  }}
                  className="rounded-lg p-1.5 text-xs text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                >
                  Evrak
                </button>
                <EditButton onClick={() => openEdit(company)} />
                <DeleteButton onClick={() => setDeleteTarget(company)} title="Pasife Al" />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Şirket Düzenle' : 'Yeni Sigorta Şirketi'}
        onSave={handleSave}
        saving={saving}
        error={error}
        maxWidth="lg"
      >
        <div>
          <label className={labelCls}>Durum</label>
          <select
            className={`${inputCls} bg-white`}
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as FormState['status'] })
            }
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Şirket Adı *</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Vergi No</label>
          <input
            className={inputCls}
            value={form.taxNumber}
            onChange={(event) => setForm({ ...form, taxNumber: event.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>E-posta</label>
            <input
              type="email"
              className={inputCls}
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input
              className={inputCls}
              value={form.contactPhone}
              onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Adres</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Notlar</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        itemName={deleteTarget?.name}
        title="Sigorta Şirketini Pasife Al"
        description={`${deleteTarget?.name ?? 'Bu sigorta şirketi'} pasif duruma alınacak. Devam etmek istiyor musunuz?`}
      />

      {drawerCompany && (
        <div className="fixed inset-0 z-50 flex bg-black/20">
          <button
            type="button"
            className="flex-1"
            aria-label="Detayı kapat"
            onClick={() => setDrawerCompany(null)}
          />
          <div className="flex w-full max-w-lg flex-col overflow-hidden border-l border-slate-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{drawerCompany.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{drawerCompany.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerCompany(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Kapat"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex border-b border-slate-100">
              {(['bilgi', 'evraklar'] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setDrawerTab(tab)}
                  className={`border-b-2 px-5 py-2.5 text-sm font-medium ${
                    drawerTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  {tab === 'bilgi' ? 'Şirket Bilgileri' : 'Evraklar'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {drawerTab === 'bilgi' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    { label: 'Vergi No', value: drawerCompany.taxNumber || '—' },
                    { label: 'E-posta', value: drawerCompany.contactEmail || '—' },
                    { label: 'Telefon', value: drawerCompany.contactPhone || '—' },
                    {
                      label: 'Kayıt Tarihi',
                      value: new Date(drawerCompany.createdAt).toLocaleDateString('tr-TR'),
                    },
                    { label: 'Adres', value: drawerCompany.address || '—' },
                    { label: 'Notlar', value: drawerCompany.notes || '—' },
                  ].map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-slate-400">{field.label}</p>
                      <p className="text-sm font-medium text-slate-800">{field.value}</p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      openEdit(drawerCompany);
                      setDrawerCompany(null);
                    }}
                    className="rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:col-span-2"
                  >
                    Düzenle
                  </button>
                </div>
              ) : (
                <EntityDocumentsTab
                  mode="entity"
                  entityType="insurance_company"
                  entityId={drawerCompany.id}
                  customerSubType="sigorta_sirketi"
                  title="Sigorta Şirketi Evrakları"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  );
}
