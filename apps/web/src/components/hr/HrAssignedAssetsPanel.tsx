'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Laptop,
  Package,
  Plus,
  Smartphone,
  Tablet,
  UserRound,
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
  /** Belirli personelin zimmeti — verilirse kuşbakış yerine personel listesi. */
  employeeProfileId?: string;
  employeeName?: string;
  canAdd?: boolean;
  onOpenEmployee?: (employeeProfileId: string, employeeName: string) => void;
};

/**
 * Zimmetli demirbaş — Admin/Finans kuşbakışı + Zimmet Ekle.
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
        /* önizleme / yetki yoksa varsayılan kalsın */
      });
    return () => {
      alive = false;
    };
  }, []);

  const scoped = useMemo(() => {
    if (categoryFilter === 'all') return rows;
    return rows.filter((a) => a.category === categoryFilter);
  }, [rows, categoryFilter]);

  const byEmployee = useMemo(() => {
    const map = new Map<string, AssignedAssetPreview[]>();
    for (const row of scoped) {
      const key = row.employeeProfileId || row.employeeName;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [scoped]);

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
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
              <Package className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-primary">
                {employeeProfileId || employeeName ? 'Zimmetli Demirbaşlar' : 'Zimmet Kuşbakışı'}
              </h3>
              <p className="text-xs text-content-secondary mt-0.5 max-w-xl">
                {employeeName
                  ? `${employeeName} adına zimmetlenen demirbaşlar.`
                  : 'Admin ve Finans — tüm personelin zimmetli demirbaşları tek bakışta.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {preview && (
              <span className="text-[10px] font-semibold tracking-wide text-content-tertiary">
                Önizleme
              </span>
            )}
            {canAdd && (
              <button
                type="button"
                onClick={() => openForm()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Zimmet Ekle
              </button>
            )}
          </div>
        </div>

        {!employeeProfileId && !employeeName && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] text-content-tertiary">Toplam Zimmet</p>
              <p className="text-lg font-semibold text-content-primary">{totals.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] text-content-tertiary">Cep Telefonu</p>
              <p className="text-lg font-semibold text-content-primary">{totals.phones}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] text-content-tertiary">Dizüstü</p>
              <p className="text-lg font-semibold text-content-primary">{totals.laptops}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] text-content-tertiary">Personel</p>
              <p className="text-lg font-semibold text-content-primary">{totals.employees}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              categoryFilter === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-surface border border-border text-content-secondary hover:bg-surface-muted'
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
                  : 'bg-surface border border-border text-content-secondary hover:bg-surface-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {savedNote && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-content-secondary">
          {savedNote}
        </div>
      )}

      {!preview && assetsQuery.isLoading ? (
        <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
      ) : !preview && assetsQuery.isError ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          Zimmet listesi yüklenemedi.
        </div>
      ) : scoped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm text-content-tertiary">Bu filtrede zimmet kaydı yok.</p>
          {canAdd && (
            <button
              type="button"
              onClick={() => openForm()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              İlk Zimmeti Ekle
            </button>
          )}
        </div>
      ) : employeeProfileId || employeeName ? (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {scoped.map((asset) => {
            const meta = categoryMeta(String(asset.category));
            const Icon = meta.icon;
            return (
              <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <Icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content-primary">{asset.name}</p>
                    <p className="text-[11px] text-content-tertiary mt-0.5">
                      {meta.label} · Marka: {asset.brand} · Model: {asset.model}
                    </p>
                    <p className="text-[11px] text-content-secondary mt-1">
                      Seri No: {asset.serialNo} · Zimmet: {formatDate(asset.assignedAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {byEmployee.map(([key, list]) => {
            const first = list[0];
            const name = first?.employeeName ?? '—';
            const profileId = first?.employeeProfileId ?? key;
            return (
              <div key={key} className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface-muted/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-content-tertiary" />
                    <div>
                      <p className="text-sm font-medium text-content-primary">{name}</p>
                      <p className="text-[11px] text-content-tertiary">{first?.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-content-secondary">
                      {list.length} demirbaş
                    </span>
                    {canAdd && (
                      <button
                        type="button"
                        onClick={() => openForm(profileId)}
                        className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 px-3 py-1.5 text-xs font-semibold hover:bg-brand-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Zimmet Ekle
                      </button>
                    )}
                    {onOpenEmployee && first?.employeeProfileId && (
                      <button
                        type="button"
                        onClick={() => onOpenEmployee(first.employeeProfileId!, name)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-content-secondary hover:bg-surface-muted"
                      >
                        Özlük Dosyası
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {list.map((asset) => {
                    const meta = categoryMeta(String(asset.category));
                    const Icon = meta.icon;
                    return (
                      <div key={asset.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <Icon className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                        <p className="text-xs font-medium text-content-primary min-w-[140px]">
                          {meta.label}
                        </p>
                        <p className="text-xs text-content-secondary flex-1 min-w-[160px]">
                          {asset.brand} {asset.model}
                        </p>
                        <p className="text-[11px] text-content-tertiary font-mono">
                          {asset.serialNo}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
