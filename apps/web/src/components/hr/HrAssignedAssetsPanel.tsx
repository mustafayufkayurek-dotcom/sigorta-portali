'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Laptop,
  Package,
  Plus,
  Smartphone,
  Tablet,
  Users,
  X,
} from 'lucide-react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { apiClient } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';

export type AssetCategory = 'phone' | 'laptop' | 'tablet' | 'other';

export type AssignedAssetPreview = {
  id: string;
  employeeProfileId?: string | null;
  employeeName: string;
  department: string;
  category: AssetCategory | string;
  name: string;
  brand: string;
  model: string;
  serialNo: string;
  assignedAt: string;
};

type EmployeeOption = {
  id: string;
  user: { firstName: string; lastName: string };
  department?: { name: string } | null;
};

const CATEGORY_ICONS: Record<string, typeof Smartphone> = {
  phone: Smartphone,
  laptop: Laptop,
  tablet: Tablet,
  other: Package,
};

const DEFAULT_CATEGORY_OPTIONS: Array<{ code: AssetCategory | string; label: string }> = [
  { code: 'phone', label: 'Cep Telefonu' },
  { code: 'laptop', label: 'Dizüstü' },
  { code: 'tablet', label: 'Tablet' },
  { code: 'other', label: 'Diğer' },
];

function categoryMeta(code: string) {
  const fallback = DEFAULT_CATEGORY_OPTIONS.find((c) => c.code === code);
  return {
    label: fallback?.label ?? toTitleCaseTR(code.replace(/_/g, ' ')),
    icon: CATEGORY_ICONS[code] ?? Package,
  };
}

export const ASSIGNED_ASSETS_PREVIEW: AssignedAssetPreview[] = [
  {
    id: 'a1',
    employeeProfileId: 'p1',
    employeeName: 'Ayşe Yılmaz',
    department: 'Dosya Sorumlusu',
    category: 'phone',
    name: 'Apple iPhone 15 Pro',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    serialNo: 'F2LX9K8M3Q',
    assignedAt: '2026-03-15',
  },
  {
    id: 'a2',
    employeeProfileId: 'p1',
    employeeName: 'Ayşe Yılmaz',
    department: 'Dosya Sorumlusu',
    category: 'laptop',
    name: 'Apple MacBook Air M2',
    brand: 'Apple',
    model: 'MacBook Air M2',
    serialNo: 'C02YQ1ABJG5H',
    assignedAt: '2026-03-15',
  },
  {
    id: 'a3',
    employeeProfileId: 'p2',
    employeeName: 'Mehmet Kara',
    department: 'Saha Personeli',
    category: 'phone',
    name: 'Samsung Galaxy A55',
    brand: 'Samsung',
    model: 'Galaxy A55',
    serialNo: 'R58T30ABCDE',
    assignedAt: '2026-04-02',
  },
];

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

type FormState = {
  employeeProfileId: string;
  category: string;
  brand: string;
  model: string;
  serialNo: string;
};

type Props = {
  preview?: boolean;
  /** Belirli personelin zimmeti — verilirse genel liste yerine personel listesi. */
  employeeProfileId?: string;
  employeeName?: string;
  canAdd?: boolean;
  onOpenEmployee?: (employeeProfileId: string, employeeName: string) => void;
};

/**
 * Zimmetli demirbaş — Admin/Finans genel liste + Zimmet Ekle.
 * Canlıda mevcut `fixed_assets` tablosu kullanılır (şema değişikliği yok).
 */
export function HrAssignedAssetsPanel({
  preview = false,
  employeeProfileId,
  employeeName,
  canAdd = true,
  onOpenEmployee,
}: Props) {
  const { showToast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewRows, setPreviewRows] = useState<AssignedAssetPreview[]>(ASSIGNED_ASSETS_PREVIEW);
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORY_OPTIONS);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    employeeProfileId: employeeProfileId ?? '',
    category: 'phone',
    brand: '',
    model: '',
    serialNo: '',
  });
  const [formError, setFormError] = useState('');
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const assetsQuery = useApiQuery<AssignedAssetPreview[]>(
    ['hr-assets', employeeProfileId || 'all'],
    'hr/assets',
    {
      params: employeeProfileId ? { employeeProfileId } : undefined,
      enabled: !preview,
    },
  );

  const employeesQuery = useApiQuery<EmployeeOption[]>(
    ['hr-employees-list-assets'],
    'hr/employees',
    { enabled: !preview && canAdd && !employeeProfileId },
  );

  const liveRows = Array.isArray(assetsQuery.data) ? assetsQuery.data : [];
  const rows = preview ? previewRows : liveRows;
  const employeeOptions = Array.isArray(employeesQuery.data) ? employeesQuery.data : [];

  useEffect(() => {
    if (preview) return;
    let alive = true;
    apiClient
      .get<Array<{ code: string; label: string; active?: boolean }>>('system-settings/hr-asset-categories')
      .then((data) => {
        if (!alive) return;
        const active = (Array.isArray(data) ? data : []).filter((c) => c.active !== false);
        if (active.length > 0) {
          setCategoryOptions(active.map((c) => ({ code: c.code, label: c.label })));
        }
      })
      .catch(() => {
        /* yetki yoksa varsayılan kalsın */
      });
    return () => {
      alive = false;
    };
  }, [preview]);

  const scoped = useMemo(() => {
    if (categoryFilter === 'all') return rows;
    return rows.filter((a) => a.category === categoryFilter);
  }, [rows, categoryFilter]);

  const totals = useMemo(() => {
    const phones = rows.filter((a) => a.category === 'phone').length;
    const laptops = rows.filter((a) => a.category === 'laptop').length;
    return {
      total: rows.length,
      phones,
      laptops,
      tablets: rows.filter((a) => a.category === 'tablet').length,
      employees: new Set(rows.map((a) => a.employeeProfileId || a.employeeName)).size,
    };
  }, [rows]);

  const openForm = (prefillEmployeeId?: string) => {
    setForm({
      employeeProfileId: prefillEmployeeId || employeeProfileId || employeeOptions[0]?.id || '',
      category: categoryOptions[0]?.code || 'phone',
      brand: '',
      model: '',
      serialNo: '',
    });
    setFormError('');
    setSavedNote(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    const brand = toTitleCaseTR(form.brand.trim());
    const model = toTitleCaseTR(form.model.trim());
    const serialNo = form.serialNo.trim().toUpperCase();
    if (!preview && !form.employeeProfileId) {
      setFormError('Personel seçin.');
      return;
    }
    if (!brand || !model) {
      setFormError('Marka ve model zorunludur.');
      return;
    }
    if (!serialNo) {
      setFormError('Seri no zorunludur.');
      return;
    }

    if (preview) {
      const emp = employeeOptions.find((e) => e.id === form.employeeProfileId);
      const name = emp
        ? `${emp.user.firstName} ${emp.user.lastName}`.trim()
        : employeeName || 'Önizleme Personeli';
      const next: AssignedAssetPreview = {
        id: `local-${Date.now()}`,
        employeeProfileId: form.employeeProfileId || 'preview',
        employeeName: name,
        department: emp?.department?.name ?? '—',
        category: form.category,
        name: `${brand} ${model}`,
        brand,
        model,
        serialNo,
        assignedAt: new Date().toISOString().slice(0, 10),
      };
      setPreviewRows((prev) => [next, ...prev]);
      setFormOpen(false);
      setSavedNote(`${next.name} · ${next.serialNo} zimmetlendi (önizleme).`);
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('hr/assets', {
        employeeProfileId: form.employeeProfileId,
        category: form.category,
        brand,
        model,
        serialNumber: serialNo,
      });
      setFormOpen(false);
      setSavedNote(`${brand} ${model} zimmetlendi.`);
      showToast('success', 'Zimmet Kaydedildi');
      await assetsQuery.refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Zimmet kaydedilemedi';
      setFormError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <Package className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-content-primary">
                {employeeProfileId || employeeName ? 'Zimmetli Demirbaşlar' : 'Zimmet'}
              </h3>
              <p className="mt-0.5 max-w-xl text-xs text-content-tertiary">
                {employeeName
                  ? `${employeeName} Adına Zimmetlenen Demirbaşlar`
                  : 'Admin Ve Finans — Tüm Personelin Zimmetli Demirbaşları'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {preview ? (
              <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-content-tertiary">
                Tasarım Önizleme
              </span>
            ) : null}
            {canAdd ? (
              <button
                type="button"
                onClick={() => openForm()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                Zimmet Ekle
              </button>
            ) : null}
          </div>
        </div>

        {!employeeProfileId && !employeeName ? (
          <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 sm:grid-cols-4 sm:p-5">
            {(
              [
                {
                  key: 'total',
                  label: 'Toplam Zimmet',
                  hint: 'Kayıtlı demirbaş',
                  value: totals.total,
                  icon: Package,
                  tone: 'brand' as const,
                },
                {
                  key: 'phone',
                  label: 'Cep Telefonu',
                  hint: 'Aktif zimmet',
                  value: totals.phones,
                  icon: Smartphone,
                  tone: 'brand' as const,
                },
                {
                  key: 'laptop',
                  label: 'Dizüstü',
                  hint: 'Aktif zimmet',
                  value: totals.laptops,
                  icon: Laptop,
                  tone: 'brand' as const,
                },
                {
                  key: 'people',
                  label: 'Personel',
                  hint: 'Zimmeti olan',
                  value: totals.employees,
                  icon: Users,
                  tone: 'brand' as const,
                },
              ] as const
            ).map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className="rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-content-primary">
                      {card.value}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
                  <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              categoryFilter === 'all'
                ? 'bg-brand-600 text-white'
                : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
            }`}
          >
            Tümü
          </button>
          {categoryOptions.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setCategoryFilter(item.code)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                categoryFilter === item.code
                  ? 'bg-brand-600 text-white'
                  : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {savedNote ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-content-secondary">
          {savedNote}
        </div>
      ) : null}

      {!preview && assetsQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : !preview && assetsQuery.isError ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          Zimmet listesi yüklenemedi.
        </div>
      ) : scoped.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-content-tertiary">Bu filtrede zimmet kaydı yok.</p>
          {canAdd ? (
            <button
              type="button"
              onClick={() => openForm()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              İlk Zimmeti Ekle
            </button>
          ) : null}
        </div>
      ) : employeeProfileId || employeeName ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {scoped.map((asset) => {
            const meta = categoryMeta(String(asset.category));
            const Icon = meta.icon;
            return (
              <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <Icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content-primary">{asset.name}</p>
                    <p className="mt-0.5 text-[11px] text-content-tertiary">
                      {meta.label} · Marka: {asset.brand} · Model: {asset.model}
                    </p>
                    <p className="mt-1 text-[11px] text-content-secondary">
                      Seri No: {asset.serialNo} · Zimmet: {formatDate(asset.assignedAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th text-left">Personel</th>
                  <th className="table-th text-left">Tür</th>
                  <th className="table-th text-left">Demirbaş</th>
                  <th className="table-th text-left">Seri No</th>
                  <th className="table-th">Zimmet</th>
                  <th
                    className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                    style={{ width: 168, minWidth: 168 }}
                  >
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="table-body">
                {scoped.map((asset) => {
                  const meta = categoryMeta(String(asset.category));
                  const Icon = meta.icon;
                  return (
                    <tr key={asset.id} className="table-row">
                      <td className="px-5 py-3">
                        <p className="font-medium text-content-primary">{asset.employeeName}</p>
                        <p className="text-xs text-content-tertiary">{asset.department}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-content-secondary">
                          <Icon className="h-3.5 w-3.5 text-brand-600" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-content-secondary">
                        {asset.brand} {asset.model}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-content-tertiary">
                        {asset.serialNo}
                      </td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {formatDate(asset.assignedAt)}
                      </td>
                      <td
                        className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                        style={{ width: 168, minWidth: 168 }}
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          {onOpenEmployee && asset.employeeProfileId ? (
                            <button
                              type="button"
                              title="Özlük Dosyası"
                              aria-label="Özlük Dosyası"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              onClick={() =>
                                onOpenEmployee(asset.employeeProfileId!, asset.employeeName)
                              }
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                              Özlük
                            </button>
                          ) : null}
                          {canAdd ? (
                            <button
                              type="button"
                              title="Zimmet Ekle"
                              aria-label="Zimmet Ekle"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                              onClick={() => openForm(asset.employeeProfileId ?? undefined)}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                              Ekle
                            </button>
                          ) : null}
                          {!onOpenEmployee && !canAdd ? (
                            <span className="text-xs text-content-tertiary">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-content-primary">Zimmet Ekle</h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-content-tertiary hover:text-content-secondary"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-content-secondary">
              Personel adına demirbaş zimmetleyin. Marka, model ve seri no zorunludur.
            </p>

            {!employeeProfileId && (
              <div>
                <label className="block text-xs font-medium text-content-tertiary mb-1">Personel</label>
                <select
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
                  value={form.employeeProfileId}
                  onChange={(e) => setForm((p) => ({ ...p, employeeProfileId: e.target.value }))}
                >
                  <option value="">Personel seçin</option>
                  {employeeOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.user.firstName} {e.user.lastName}
                      {e.department ? ` · ${e.department.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-content-tertiary mb-1">Kategori</label>
              <select
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-content-tertiary mb-1">Marka</label>
                <input
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm"
                  placeholder="Örn. Apple"
                  value={form.brand}
                  onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                  onBlur={(e) => setForm((p) => ({ ...p, brand: toTitleCaseTR(e.target.value.trim()) }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-tertiary mb-1">Model</label>
                <input
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm"
                  placeholder="Örn. Iphone 15 Pro"
                  value={form.model}
                  onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                  onBlur={(e) => setForm((p) => ({ ...p, model: toTitleCaseTR(e.target.value.trim()) }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-content-tertiary mb-1">Seri No</label>
              <input
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-mono"
                placeholder="Örn. F2LX9K8M3Q"
                value={form.serialNo}
                onChange={(e) => setForm((p) => ({ ...p, serialNo: e.target.value }))}
              />
            </div>

            {formError && <p className="text-xs text-status-danger">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-content-secondary hover:bg-surface-muted"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
