'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, formatSettingsApiError, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { normalizeFormFreeText } from '@/utils/text-helpers';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { DepartmentDefinitionToolbar } from '@/components/settings/DepartmentTabSelector';
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
  SettingsRowIndexTh,
  SettingsRowIndexTd,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import {
  VENDOR_SERVICE_TABS,
  deriveServiceBranchTypes,
  documentEntityScopeLabel,
  documentTypeScopeBadges,
  parseServiceBranchTypes,
  parseStringList,
  serviceBranchTypeLabel,
  sortByNameTR,
  type DocumentEntityScope,
  type ServiceBranchTypeKey,
} from '@/utils/document-type-scope';
import { normalizeSearchTR } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';
import { mergeCustomerSubTypes, type CustomerSubTypeDef } from '@/utils/customer-form-helpers';


type DocumentType = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  status: string;
  entityScope?: string;
  serviceBranchTypes?: unknown;
  customerSubTypes?: unknown;
  departmentIds?: unknown;
  _count?: { vendorDocuments: number; entityDocuments?: number };
};

function resolveEditServiceBranchTypes(
  dt: DocumentType,
  activeVendorTab: ServiceBranchTypeKey,
  deptCodeById: Map<string, string>,
): ServiceBranchTypeKey[] {
  const derived = deriveServiceBranchTypes(dt.serviceBranchTypes, dt.departmentIds, deptCodeById);
  if (derived.length > 0) return derived;
  if ((dt.entityScope ?? 'vendor') === 'vendor') return ['hasar', 'acil_yardim'];
  return [activeVendorTab];
}

function resolveEditCustomerSubTypes(dt: DocumentType, activeCustomerTab: string): string[] {
  const explicit = parseStringList(dt.customerSubTypes);
  if (explicit.length > 0) return explicit;
  if ((dt.entityScope ?? 'vendor') === 'customer') return [activeCustomerTab];
  return [];
}

const SCOPE_MODES: { id: DocumentEntityScope; label: string; hint: string }[] = [
  { id: 'vendor', label: 'Tedarikçi Evrakları', hint: 'Hasar Onarım / Acil Yardım hizmet kapsamı' },
  { id: 'customer', label: 'Müşteri Evrakları', hint: 'Sigortalı, Sigorta Şirketi vb. müşteri tipleri' },
];

const emptyForm = () => ({
  code: '',
  name: '',
  description: '',
  isRequired: false,
  entityScope: 'vendor' as DocumentEntityScope,
  serviceBranchTypes: [] as ServiceBranchTypeKey[],
  customerSubTypes: [] as string[],
});

function ScopeTabBar({
  tabs,
  selectedId,
  onSelect,
  counts,
}: {
  tabs: { id: string; label: string; color: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = selectedId === tab.id;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors border ${
              active
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tab.color }} />
            {tab.label}
            {count !== undefined && (
              <span className={`text-xs ${active ? 'text-brand-600' : 'text-slate-400'}`}>({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function scopeBadges(dt: DocumentType, deptCodeById: Map<string, string>): string[] {
  return documentTypeScopeBadges(dt, deptCodeById);
}

export default function EvrakTurleriPage() {
  const { showToast } = useToast();
  const [scopeMode, setScopeMode] = useState<DocumentEntityScope>('vendor');
  const [vendorTab, setVendorTab] = useState<ServiceBranchTypeKey>('hasar');
  const [customerTab, setCustomerTab] = useState('');
  const [customerTypeCatalog, setCustomerTypeCatalog] = useState<CustomerSubTypeDef[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deptCodeById, setDeptCodeById] = useState<Map<string, string>>(new Map());

  const customerTabs = useMemo(
    () =>
      customerTypeCatalog.map((t) => ({
        id: t.value,
        label: t.label,
        color:
          t.color === 'blue' ? '#3B82F6'
            : t.color === 'orange' ? '#F97316'
              : t.color === 'green' ? '#22C55E'
                : t.color === 'purple' ? '#A855F7'
                  : '#64748B',
      })),
    [customerTypeCatalog],
  );

  useEffect(() => {
    axios
      .get(`${API}/system-settings/customer-sub-types`, { headers: authHeader() })
      .then((res) => {
        const rows = mergeCustomerSubTypes(res.data?.data ?? []);
        setCustomerTypeCatalog(rows);
        setCustomerTab((prev) => prev || rows[0]?.value || '');
      })
      .catch(() => {
        const rows = mergeCustomerSubTypes([]);
        setCustomerTypeCatalog(rows);
        setCustomerTab((prev) => prev || rows[0]?.value || '');
      });
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/departments`, { headers: authHeader() })
      .then((res) => {
        const map = new Map<string, string>();
        for (const dept of res.data.data ?? []) {
          if (dept?.id && dept?.code) map.set(dept.id, dept.code);
        }
        setDeptCodeById(map);
      })
      .catch(console.error);
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      if (scopeMode === 'vendor') {
        const entries = await Promise.all(
          VENDOR_SERVICE_TABS.map(async (tab) => {
            const res = await axios.get(`${API}/document-types`, {
              headers: authHeader(),
              params: { entityScope: 'vendor', serviceBranchType: tab.id },
            });
            return [tab.id, (res.data.data ?? []).length] as const;
          }),
        );
        setTabCounts(Object.fromEntries(entries));
      } else {
        const entries = await Promise.all(
          customerTabs.map(async (tab) => {
            const res = await axios.get(`${API}/document-types`, {
              headers: authHeader(),
              params: { entityScope: 'customer', customerSubType: tab.id },
            });
            return [tab.id, (res.data.data ?? []).length] as const;
          }),
        );
        setTabCounts(Object.fromEntries(entries));
      }
    } catch (e) {
      console.error(e);
    }
  }, [scopeMode, customerTabs]);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      if (scopeMode === 'customer' && !customerTab) {
        setTypes([]);
        return;
      }
      const params =
        scopeMode === 'vendor'
          ? { entityScope: 'vendor', serviceBranchType: vendorTab }
          : { entityScope: 'customer', customerSubType: customerTab };
      const res = await axios.get(`${API}/document-types`, { headers: authHeader(), params });
      const data: DocumentType[] = res.data.data ?? [];
      setTypes(sortByNameTR(data));
      const tabKey = scopeMode === 'vendor' ? vendorTab : customerTab;
      setTabCounts((prev) => ({ ...prev, [tabKey]: data.length }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scopeMode, vendorTab, customerTab]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const filteredTypes = useMemo(() => {
    const q = normalizeSearchTR(search.trim());
    if (!q) return types;
    return types.filter(
      (t) =>
        normalizeSearchTR(t.name).includes(q) ||
        normalizeSearchTR(t.description ?? '').includes(q) ||
        normalizeSearchTR(t.code).includes(q),
    );
  }, [types, search]);

  const activeTabLabel =
    scopeMode === 'vendor'
      ? `${documentEntityScopeLabel('vendor')} · ${serviceBranchTypeLabel(vendorTab)}`
      : `${documentEntityScopeLabel('customer')} · ${customerTypeCatalog.find((t) => t.value === customerTab)?.label ?? customerTab}`;

  const vendorFilterTabs = useMemo(
    () =>
      VENDOR_SERVICE_TABS.map((tab) => ({
        ...tab,
        label: `${documentEntityScopeLabel('vendor')} · ${tab.label}`,
      })),
    [],
  );

  const customerFilterTabs = useMemo(
    () =>
      customerTabs.map((tab) => ({
        ...tab,
        label: `${documentEntityScopeLabel('customer')} · ${tab.label}`,
      })),
    [customerTabs],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      entityScope: scopeMode,
      serviceBranchTypes: scopeMode === 'vendor' ? [vendorTab] : [],
      customerSubTypes: scopeMode === 'customer' ? [customerTab] : [],
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (dt: DocumentType) => {
    setEditing(dt);
    setForm({
      code: dt.code,
      name: dt.name,
      description: dt.description ?? '',
      isRequired: dt.isRequired,
      entityScope: (dt.entityScope ?? 'vendor') as DocumentEntityScope,
      serviceBranchTypes: resolveEditServiceBranchTypes(dt, vendorTab, deptCodeById),
      customerSubTypes: resolveEditCustomerSubTypes(dt, customerTab),
    });
    setError('');
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setForm((p) => ({ ...p, name }));
  };

  const toggleBranch = (id: ServiceBranchTypeKey) => {
    setForm((p) => {
      const current = parseServiceBranchTypes(p.serviceBranchTypes);
      return {
        ...p,
        serviceBranchTypes: current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id],
      };
    });
  };

  const toggleCustomerSub = (value: string) => {
    setForm((p) => ({
      ...p,
      customerSubTypes: p.customerSubTypes.includes(value)
        ? p.customerSubTypes.filter((x) => x !== value)
        : [...p.customerSubTypes, value],
    }));
  };

  const handleSave = async () => {
    const name = normalizeFormFreeText(form.name);
    if (!name) { setError('Ad alanı zorunludur'); return; }
    const branchTypes =
      form.entityScope === 'vendor' ? parseServiceBranchTypes(form.serviceBranchTypes) : [];
    if (form.entityScope === 'vendor' && branchTypes.length === 0) {
      setError('En az bir Meridyen hizmet türü seçin'); return;
    }
    if (form.entityScope === 'customer' && form.customerSubTypes.length === 0) {
      setError('En az bir müşteri tipi seçin'); return;
    }

    setSaving(true);
    setError('');
    const scopePayload = {
      entityScope: form.entityScope,
      serviceBranchTypes: branchTypes,
      customerSubTypes: form.entityScope === 'customer' ? form.customerSubTypes : [],
    };
    const payload = editing
      ? {
          name,
          description: form.description.trim() ? normalizeFormFreeText(form.description) : null,
          isRequired: form.isRequired,
          ...scopePayload,
        }
      : {
          name,
          description: form.description.trim() ? normalizeFormFreeText(form.description) : undefined,
          isRequired: form.isRequired,
          ...scopePayload,
        };
    try {
      if (editing) {
        await axios.put(`${API}/document-types/${editing.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/document-types`, payload, { headers: authHeader() });
      }
      setShowModal(false);
      await fetchTypes();
      await refreshCounts();
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/document-types/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      await fetchTypes();
      await refreshCounts();
    } catch (e: unknown) {
      showToast('error', formatSettingsApiError(e, 'Silinemedi'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
          title="Evrak Türleri"
          description="Meridyen hizmet türleri ve müşteri tiplerine göre evrak tanımları. Liste alfabetik sıralanır; sıra numarası otomatik atanır."
          backHref={TANIMLAR_BACK_HREF}
          backText={TANIMLAR_BACK_TEXT}
          headerExtra={
            <div className="flex items-center gap-2">
          <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm shadow-blue-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Evrak Türü Ekle
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl w-fit">
              {SCOPE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setScopeMode(mode.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scopeMode === mode.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              {SCOPE_MODES.find((m) => m.id === scopeMode)?.hint}
            </p>

            {scopeMode === 'vendor' ? (
              <ScopeTabBar
                tabs={vendorFilterTabs}
                selectedId={vendorTab}
                onSelect={(id) => setVendorTab(id as ServiceBranchTypeKey)}
                counts={tabCounts}
              />
            ) : (
              <ScopeTabBar
                tabs={customerFilterTabs}
                selectedId={customerTab}
                onSelect={setCustomerTab}
                counts={tabCounts}
              />
            )}

            <DepartmentDefinitionToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Evrak türü ara..."
              hierarchyChild="Evrak Türü"
            />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="font-semibold text-slate-900">
                  {activeTabLabel}
                  <span className="text-sm font-normal text-slate-400 ml-2">— Evrak Türleri</span>
                </p>
              </div>

              <SettingsTable
                loading={loading}
                empty={filteredTypes.length === 0}
                emptyText={
                  search.trim()
                    ? 'Arama sonucu bulunamadı.'
                    : 'Bu kapsam için henüz evrak türü tanımlanmamış.'
                }
              >
                <SettingsTableHead>
                  <SettingsRowIndexTh />
                  <SettingsTableTh>Ad</SettingsTableTh>
                  <SettingsTableTh>Kapsam</SettingsTableTh>
                  <SettingsTableTh>Açıklama</SettingsTableTh>
                  <SettingsTableTh className="text-center">Zorunlu</SettingsTableTh>
                  <SettingsTableTh className="text-center">Evrak Sayısı</SettingsTableTh>
                  <SettingsTableTh className="text-center">Durum</SettingsTableTh>
                  <SettingsTableTh />
                </SettingsTableHead>
                <SettingsTableBody>
                  {filteredTypes.map((dt, index) => {
                    const docCount =
                      (dt._count?.vendorDocuments ?? 0) + (dt._count?.entityDocuments ?? 0);
                    const badges =
                      (dt.entityScope ?? 'vendor') === 'customer'
                        ? (parseStringList(dt.customerSubTypes).length
                            ? parseStringList(dt.customerSubTypes).map(
                                (v) =>
                                  `${documentEntityScopeLabel('customer')} · ${customerTypeCatalog.find((t) => t.value === v)?.label ?? v}`,
                              )
                            : [`${documentEntityScopeLabel('customer')} · Tüm Müşteri Tipleri`])
                        : scopeBadges(dt, deptCodeById);
                    return (
                      <SettingsTableRow key={dt.id}>
                        <SettingsRowIndexTd index={index} />
                        <SettingsTableTd>
                          <span className="font-medium text-slate-900">{dt.name}</span>
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">{dt.code}</p>
                        </SettingsTableTd>
                        <SettingsTableTd>
                          <div className="flex flex-wrap gap-1">
                            {badges.map((b) => (
                              <span
                                key={b}
                                className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </SettingsTableTd>
                        <SettingsTableTd className="max-w-xs truncate text-slate-500">
                          {dt.description || '—'}
                        </SettingsTableTd>
                        <SettingsTableTd className="text-center">
                          {dt.isRequired ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Zorunlu</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </SettingsTableTd>
                        <SettingsTableTd className="text-center text-slate-600">{docCount}</SettingsTableTd>
                        <SettingsTableTd className="text-center">
                          <StatusBadge active={dt.status === 'active'} />
                        </SettingsTableTd>
                        <SettingsTableActions>
                          <EditButton onClick={() => openEdit(dt)} />
                          <DeleteButton onClick={() => setDeleteTarget(dt)} />
                        </SettingsTableActions>
                      </SettingsTableRow>
                    );
                  })}
                </SettingsTableBody>
              </SettingsTable>
            </div>
          </div>

          <SettingsModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={editing ? 'Evrak Türünü Düzenle' : 'Yeni Evrak Türü'}
            onSave={handleSave}
            saving={saving}
            error={error}
          >
            <div>
              <label className={labelCls}>Evrak Kapsamı *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SCOPE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    disabled={!!editing}
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        entityScope: mode.id,
                        serviceBranchTypes: mode.id === 'vendor' ? (p.serviceBranchTypes.length ? p.serviceBranchTypes : ['hasar']) : [],
                        customerSubTypes: mode.id === 'customer' ? (p.customerSubTypes.length ? p.customerSubTypes : ['insured']) : [],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      form.entityScope === mode.id
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {form.entityScope === 'vendor' ? (
              <div>
                <label className={labelCls}>Meridyen Hizmet Türleri *</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {VENDOR_SERVICE_TABS.map((tab) => (
                    <label
                      key={tab.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                        form.serviceBranchTypes.includes(tab.id)
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-brand-600"
                        checked={form.serviceBranchTypes.includes(tab.id)}
                        onChange={() => toggleBranch(tab.id)}
                      />
                      {tab.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Türü ilgili hizmete bağlayın. Listede yoksa önce Tanımlar’dan ekleyin.
                </p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Müşteri Tipi Kapsamı *</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {customerTypeCatalog.map((t) => (
                    <label
                      key={t.value}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                        form.customerSubTypes.includes(t.value)
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded accent-brand-600"
                        checked={form.customerSubTypes.includes(t.value)}
                        onChange={() => toggleCustomerSub(t.value)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Ad *</label>
              <input
                className={inputCls}
                placeholder="Örn: Muvafakatname, Kimlik Fotokopisi"
                value={form.name}
                autoComplete="off"
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={(e) => {
                  const v = normalizeFormFreeText(e.target.value);
                  if (v !== form.name) setForm((p) => ({ ...p, name: v }));
                }}
              />
            </div>
            {editing && (
              <div>
                <label className={labelCls}>Kod</label>
                <input className={`${inputCls} disabled:bg-slate-50`} value={form.code} disabled />
              </div>
            )}
            <div>
              <label className={labelCls}>Açıklama</label>
              <input
                className={inputCls}
                placeholder="İsteğe bağlı açıklama"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                onBlur={(e) => {
                  const v = normalizeFormFreeText(e.target.value);
                  if (v !== e.target.value.trim()) setForm((p) => ({ ...p, description: v }));
                }}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded accent-brand-600"
                  checked={form.isRequired}
                  onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))}
                />
                <span className="text-sm text-slate-700">Zorunlu Evrak</span>
              </label>
              <p className="text-xs text-slate-400 mt-1">Sıra numarası alfabetik dizilime göre otomatik atanır.</p>
            </div>
          </SettingsModal>

          <DeleteConfirmDialog
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirm}
            deleting={deleting}
            itemName={deleteTarget?.name}
            description={
              deleteTarget
                ? `Bu evrak türüne bağlı ${
                    (deleteTarget._count?.vendorDocuments ?? 0) + (deleteTarget._count?.entityDocuments ?? 0)
                  } evrak var. Yine de silmek istiyor musunuz?`
                : undefined
            }
          />
        </SettingsPageLayout>
  );
}
