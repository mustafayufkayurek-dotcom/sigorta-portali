'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
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

type MainTab = 'sigorta' | 'asistans';

type AssistanceFirm = {
  id: string;
  companyName: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'passive' | 'blacklisted';
  createdAt: string;
};

type AssistanceFormState = {
  companyName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  status: 'active' | 'passive';
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

const EMPTY_ASSISTANCE_FORM: AssistanceFormState = {
  companyName: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  status: 'active',
};

export default function SigortaSirketleriPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<MainTab>(
    searchParams.get('tab') === 'asistans' ? 'asistans' : 'sigorta',
  );
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
  const [assistanceFirms, setAssistanceFirms] = useState<AssistanceFirm[]>([]);
  const [assistanceLoading, setAssistanceLoading] = useState(true);
  const [assistanceStatusFilter, setAssistanceStatusFilter] = useState<
    'all' | 'active' | 'passive'
  >('all');
  const [assistanceModalOpen, setAssistanceModalOpen] = useState(false);
  const [editingAssistance, setEditingAssistance] = useState<AssistanceFirm | null>(null);
  const [assistanceForm, setAssistanceForm] = useState<AssistanceFormState>(EMPTY_ASSISTANCE_FORM);
  const [assistanceSaving, setAssistanceSaving] = useState(false);
  const [assistanceError, setAssistanceError] = useState('');
  const [assistanceArchiveTarget, setAssistanceArchiveTarget] = useState<AssistanceFirm | null>(
    null,
  );
  const [assistanceArchiving, setAssistanceArchiving] = useState(false);

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

  const fetchAssistanceFirms = useCallback(async () => {
    setAssistanceLoading(true);
    try {
      const response = await axios.get(`${API}/customers`, {
        headers: authHeader(),
        params: {
          customerType: 'corporate',
          subType: 'asistan_firmasi',
          limit: 1000,
        },
      });
      setAssistanceFirms(response.data.data ?? []);
    } catch (requestError) {
      console.error(requestError);
      setAssistanceError(formatSettingsApiError(requestError, 'Asistans firmaları yüklenemedi.'));
    } finally {
      setAssistanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    fetchAssistanceFirms();
  }, [fetchAssistanceFirms, fetchCompanies]);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'asistans' ? 'asistans' : 'sigorta');
  }, [searchParams]);

  const filteredCompanies = companies.filter(
    (company) => statusFilter === 'all' || company.status === statusFilter,
  );
  const filteredAssistanceFirms = assistanceFirms.filter(
    (firm) => assistanceStatusFilter === 'all' || firm.status === assistanceStatusFilter,
  );

  const selectTab = (tab: MainTab) => {
    setActiveTab(tab);
    router.replace(
      tab === 'asistans'
        ? '/panel/ayarlar/sigorta-sirketleri?tab=asistans'
        : '/panel/ayarlar/sigorta-sirketleri',
      { scroll: false },
    );
  };

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
        company.name.trim().toLocaleLowerCase('tr-TR') ===
          form.name.trim().toLocaleLowerCase('tr-TR'),
    );
    if (duplicate) {
      setError('Bu isimde bir sigorta şirketi zaten mevcut.');
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
      await axios.delete(`${API}/insurance-companies/${deleteTarget.id}`, {
        headers: authHeader(),
      });
      setDeleteTarget(null);
      await fetchCompanies();
    } catch (requestError) {
      setError(formatSettingsApiError(requestError, 'Sigorta şirketi pasifleştirilemedi.'));
    } finally {
      setDeleting(false);
    }
  };

  const openAssistanceCreate = () => {
    setEditingAssistance(null);
    setAssistanceForm({ ...EMPTY_ASSISTANCE_FORM });
    setAssistanceError('');
    setAssistanceModalOpen(true);
  };

  const openAssistanceEdit = (firm: AssistanceFirm) => {
    setEditingAssistance(firm);
    setAssistanceForm({
      companyName: firm.companyName ?? '',
      email: firm.email ?? '',
      phone: firm.phone ?? '',
      city: firm.city ?? '',
      address: firm.address ?? '',
      notes: firm.notes ?? '',
      status: firm.status === 'active' ? 'active' : 'passive',
    });
    setAssistanceError('');
    setAssistanceModalOpen(true);
  };

  const handleAssistanceSave = async () => {
    if (!assistanceForm.companyName.trim()) {
      setAssistanceError('Firma Adı zorunludur.');
      return;
    }
    const duplicate = assistanceFirms.some(
      (firm) =>
        firm.id !== editingAssistance?.id &&
        (firm.companyName ?? '').trim().toLocaleLowerCase('tr-TR') ===
          assistanceForm.companyName.trim().toLocaleLowerCase('tr-TR'),
    );
    if (duplicate) {
      setAssistanceError('Bu isimde bir asistans firması zaten mevcut.');
      return;
    }

    setAssistanceSaving(true);
    setAssistanceError('');
    const desiredStatus = assistanceForm.status;
    const payload = {
      companyName: assistanceForm.companyName.trim(),
      email: assistanceForm.email.trim() || null,
      phone: assistanceForm.phone.trim() || null,
      city: assistanceForm.city.trim() || null,
      address: assistanceForm.address.trim() || null,
      notes: assistanceForm.notes.trim() || null,
      customerType: 'corporate',
      entityType: 'corporate',
      subType: 'asistan_firmasi',
      serviceType: 'acil_yardim',
    };
    try {
      if (editingAssistance) {
        await axios.patch(`${API}/customers/${editingAssistance.id}`, payload, {
          headers: authHeader(),
        });
        // Durum değişikliğini güvenlik kontrolleriyle çalışan uçlara yönlendir
        if (editingAssistance.status !== desiredStatus) {
          const endpoint = desiredStatus === 'passive' ? 'archive' : 'reactivate';
          await axios.post(
            `${API}/customers/${editingAssistance.id}/${endpoint}`,
            {},
            { headers: authHeader() },
          );
        }
      } else {
        await axios.post(
          `${API}/customers`,
          { ...payload, status: desiredStatus },
          { headers: authHeader() },
        );
      }
      setAssistanceModalOpen(false);
      await fetchAssistanceFirms();
    } catch (requestError) {
      setAssistanceError(formatSettingsApiError(requestError));
    } finally {
      setAssistanceSaving(false);
    }
  };

  const handleAssistanceArchive = async () => {
    if (!assistanceArchiveTarget) return;
    setAssistanceArchiving(true);
    setAssistanceError('');
    try {
      await axios.post(
        `${API}/customers/${assistanceArchiveTarget.id}/archive`,
        {},
        { headers: authHeader() },
      );
      setAssistanceArchiveTarget(null);
      await fetchAssistanceFirms();
    } catch (requestError) {
      setAssistanceError(
        formatSettingsApiError(requestError, 'Asistans firması pasife alınamadı.'),
      );
    } finally {
      setAssistanceArchiving(false);
    }
  };

  const handleAssistanceReactivate = async (firm: AssistanceFirm) => {
    setAssistanceError('');
    try {
      await axios.post(`${API}/customers/${firm.id}/reactivate`, {}, { headers: authHeader() });
      await fetchAssistanceFirms();
    } catch (requestError) {
      setAssistanceError(
        formatSettingsApiError(requestError, 'Asistans firması aktifleştirilemedi.'),
      );
    }
  };

  return (
    <SettingsPageLayout
      title="Sigorta ve Asistans Firmaları"
      description="Operasyonda kullanılan sigorta şirketi ve asistans firması tanımlarını yönetin."
      addButtonText={activeTab === 'sigorta' ? 'Yeni Sigorta Şirketi' : 'Yeni Asistans Firması'}
      onAdd={activeTab === 'sigorta' ? openCreate : openAssistanceCreate}
    >
      <div className="mb-5 flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            { id: 'sigorta', label: 'Sigorta Şirketleri', count: companies.length },
            { id: 'asistans', label: 'Asistans Firmaları', count: assistanceFirms.length },
          ] as const
        ).map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-blue-300 dark:ring-slate-600'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs text-slate-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'sigorta' && (
        <>
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
                      <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                        {company.address}
                      </p>
                    )}
                  </SettingsTableTd>
                  <SettingsTableTd>
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{company.code}</code>
                  </SettingsTableTd>
                  <SettingsTableTd>{company.taxNumber || '—'}</SettingsTableTd>
                  <SettingsTableTd>
                    {company.contactEmail && (
                      <p className="text-xs text-slate-600">{company.contactEmail}</p>
                    )}
                    {company.contactPhone && (
                      <p className="text-xs text-slate-400">{company.contactPhone}</p>
                    )}
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
        </>
      )}

      {activeTab === 'asistans' && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(['all', 'active', 'passive'] as const).map((status) => {
              const count =
                status === 'all'
                  ? assistanceFirms.length
                  : assistanceFirms.filter((firm) => firm.status === status).length;
              const label = status === 'all' ? 'Tümü' : status === 'active' ? 'Aktif' : 'Pasif';
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => setAssistanceStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    assistanceStatusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {assistanceError && !assistanceModalOpen && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {assistanceError}
            </p>
          )}

          <SettingsTable
            loading={assistanceLoading}
            empty={filteredAssistanceFirms.length === 0}
            emptyText={
              assistanceStatusFilter === 'all'
                ? 'Henüz asistans firması eklenmemiş.'
                : `${assistanceStatusFilter === 'active' ? 'Aktif' : 'Pasif'} asistans firması bulunamadı.`
            }
          >
            <SettingsTableHead>
              <SettingsTableTh>Firma</SettingsTableTh>
              <SettingsTableTh>İletişim</SettingsTableTh>
              <SettingsTableTh>Şehir</SettingsTableTh>
              <SettingsTableTh>Durum</SettingsTableTh>
              <SettingsTableTh>Kayıt Tarihi</SettingsTableTh>
              <SettingsTableTh />
            </SettingsTableHead>
            <SettingsTableBody>
              {filteredAssistanceFirms.map((firm) => (
                <SettingsTableRow key={firm.id}>
                  <SettingsTableTd>
                    <p className="text-sm font-medium text-slate-800">{firm.companyName || '—'}</p>
                    {firm.address && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                        {firm.address}
                      </p>
                    )}
                  </SettingsTableTd>
                  <SettingsTableTd>
                    {firm.email && <p className="text-xs text-slate-600">{firm.email}</p>}
                    {firm.phone && <p className="text-xs text-slate-400">{firm.phone}</p>}
                    {!firm.email && !firm.phone && '—'}
                  </SettingsTableTd>
                  <SettingsTableTd>{firm.city || '—'}</SettingsTableTd>
                  <SettingsTableTd>
                    <StatusBadge active={firm.status === 'active'} />
                  </SettingsTableTd>
                  <SettingsTableTd className="text-slate-400">
                    {new Date(firm.createdAt).toLocaleDateString('tr-TR')}
                  </SettingsTableTd>
                  <SettingsTableActions>
                    <EditButton onClick={() => openAssistanceEdit(firm)} />
                    {firm.status === 'active' ? (
                      <DeleteButton
                        onClick={() => setAssistanceArchiveTarget(firm)}
                        title="Pasife Al"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssistanceReactivate(firm)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
                      >
                        Aktifleştir
                      </button>
                    )}
                  </SettingsTableActions>
                </SettingsTableRow>
              ))}
            </SettingsTableBody>
          </SettingsTable>
        </>
      )}

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

      <SettingsModal
        isOpen={assistanceModalOpen}
        onClose={() => setAssistanceModalOpen(false)}
        title={editingAssistance ? 'Asistans Firmasını Düzenle' : 'Yeni Asistans Firması'}
        onSave={handleAssistanceSave}
        saving={assistanceSaving}
        error={assistanceError}
        maxWidth="lg"
      >
        <div>
          <label className={labelCls}>Durum</label>
          <select
            className={`${inputCls} bg-white`}
            value={assistanceForm.status}
            onChange={(event) =>
              setAssistanceForm({
                ...assistanceForm,
                status: event.target.value as AssistanceFormState['status'],
              })
            }
          >
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Firma Adı *</label>
          <input
            className={inputCls}
            value={assistanceForm.companyName}
            onChange={(event) =>
              setAssistanceForm({ ...assistanceForm, companyName: event.target.value })
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>E-posta</label>
            <input
              type="email"
              className={inputCls}
              value={assistanceForm.email}
              onChange={(event) =>
                setAssistanceForm({ ...assistanceForm, email: event.target.value })
              }
            />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input
              className={inputCls}
              value={assistanceForm.phone}
              onChange={(event) =>
                setAssistanceForm({ ...assistanceForm, phone: event.target.value })
              }
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Şehir</label>
          <input
            className={inputCls}
            value={assistanceForm.city}
            onChange={(event) => setAssistanceForm({ ...assistanceForm, city: event.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Adres</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={assistanceForm.address}
            onChange={(event) =>
              setAssistanceForm({ ...assistanceForm, address: event.target.value })
            }
          />
        </div>
        <div>
          <label className={labelCls}>Notlar</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={assistanceForm.notes}
            onChange={(event) =>
              setAssistanceForm({ ...assistanceForm, notes: event.target.value })
            }
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

      <DeleteConfirmDialog
        isOpen={assistanceArchiveTarget !== null}
        onClose={() => setAssistanceArchiveTarget(null)}
        onConfirm={handleAssistanceArchive}
        deleting={assistanceArchiving}
        itemName={assistanceArchiveTarget?.companyName ?? undefined}
        title="Asistans Firmasını Pasife Al"
        description={`${assistanceArchiveTarget?.companyName ?? 'Bu asistans firması'} pasif duruma alınacak. Devam etmek istiyor musunuz?`}
        error={assistanceError}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
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
