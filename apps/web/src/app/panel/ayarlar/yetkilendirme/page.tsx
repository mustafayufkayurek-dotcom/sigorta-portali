'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';

type Capability = { id: string; label: string };
type CapabilityGroup = { id: string; title: string; capabilities: Capability[] };
type RoleRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  _count?: { users: number };
};

/**
 * Bu ekranda yalnızca iç operasyon görevleri — portal / eksper yüzü yok.
 * (Tedarikçi işlemleri için anlamlı roller)
 */
const MANAGED_ROLE_CODES = new Set([
  'finance',
  'finans',
  'office_staff',
  'manager',
  'accountant',
  'ops_manager',
]);

function normalizeRoleCode(code: string): string {
  return code.trim().toLowerCase().replace(/-/g, '_');
}

function isManagedOpsRole(code: string): boolean {
  return MANAGED_ROLE_CODES.has(normalizeRoleCode(code));
}

/** Ürün dili: office_staff → Dosya Sorumlusu (DB adı Ofis Personeli kalabilir) */
function displayRoleName(role: RoleRow): string {
  if (normalizeRoleCode(role.code) === 'office_staff') return 'Dosya Sorumlusu';
  return role.name;
}

/** Alan Zorunlulukları ile aynı kayan düğme */
function SlideToggle({
  on,
  disabled,
  onToggle,
  testId,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      data-testid={testId}
      className={`relative h-5 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        on ? 'bg-brand-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export default function YetkilendirmePage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [catalog, setCatalog] = useState<CapabilityGroup[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const opsRoles = useMemo(
    () => roles.filter((r) => isManagedOpsRole(r.code)),
    [roles],
  );

  const selectedRole = useMemo(
    () => opsRoles.find((r) => r.id === selectedRoleId) ?? null,
    [opsRoles, selectedRoleId],
  );

  const loadRoles = useCallback(async () => {
    const res = await axios.get(`${API}/roles`, { headers: authHeader() });
    const list: RoleRow[] = res.data.data ?? [];
    setRoles(list);
    return list;
  }, []);

  const loadCatalog = useCallback(async () => {
    const res = await axios.get(`${API}/roles/capability-catalog`, { headers: authHeader() });
    setCatalog(res.data.data ?? []);
  }, []);

  const loadCapabilities = useCallback(async (roleId: string) => {
    const res = await axios.get(`${API}/roles/${roleId}/capabilities`, { headers: authHeader() });
    setSelectedIds(res.data.data?.capabilityIds ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [list] = await Promise.all([loadRoles(), loadCatalog()]);
        if (cancelled) return;
        const managed = list.filter((r) => isManagedOpsRole(r.code));
        const prefer =
          managed.find((r) => ['finance', 'finans'].includes(normalizeRoleCode(r.code)))
          ?? managed[0]
          ?? null;
        if (prefer) {
          setSelectedRoleId(prefer.id);
          await loadCapabilities(prefer.id);
        }
      } catch {
        if (!cancelled) setError('Yetkilendirme bilgileri yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadRoles, loadCatalog, loadCapabilities]);

  async function selectRole(roleId: string) {
    setSelectedRoleId(roleId);
    setFlash(null);
    setError('');
    try {
      await loadCapabilities(roleId);
    } catch {
      setError('Bu görevin işlemleri yüklenemedi.');
    }
  }

  function toggleCapability(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setFlash(null);
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      await axios.put(
        `${API}/roles/${selectedRoleId}/capabilities`,
        { capabilityIds: selectedIds },
        { headers: authHeader() },
      );
      setFlash('Değişiklikler kaydedildi.');
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.message ?? 'Kaydedilemedi.')
        : 'Kaydedilemedi.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageLayout
      title="Yetkilendirme"
      description="İç operasyon görevlerinin tedarikçi işlemlerini buradan yönetin."
    >
      {loading ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="space-y-4" data-testid="yetkilendirme-sayfa">
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-3.5 py-2.5 text-sm text-slate-700">
            Değişiklikler kaydedildikten sonra ilgili görevdeki kullanıcılar için geçerli olur.
            Portal ve eksper yüzü bu listede yer almaz.
          </div>

          {error && (
            <p className="text-sm text-status-danger bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
              {error}
            </p>
          )}
          {flash && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2" data-testid="yetkilendirme-kayit-ok">
              {flash}
            </p>
          )}

          {/* Alan Zorunlulukları sekmeleri ile aynı yatay görev seçimi */}
          <div
            className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2"
            data-testid="yetkilendirme-rol-sekmeleri"
          >
            {opsRoles.map((r) => {
              const active = r.id === selectedRoleId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { void selectRole(r.id); }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                  data-testid={`yetkilendirme-rol-${r.code}`}
                >
                  {displayRoleName(r)}
                </button>
              );
            })}
            {opsRoles.length === 0 && (
              <p className="text-sm text-slate-500 px-1 py-2">Yönetilebilir görev bulunamadı.</p>
            )}
          </div>

          {selectedRole && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-base font-bold text-slate-900">
                  {displayRoleName(selectedRole)}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  İşlemleri açıp kapatın, ardından kaydedin.
                </p>
              </div>

              <div className="divide-y divide-slate-100 px-4 sm:px-5">
                {catalog.map((group) => (
                  <div key={group.id} className="py-4 space-y-3" data-testid={`yetkilendirme-grup-${group.id}`}>
                    <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                    <ul className="space-y-0">
                      {group.capabilities.map((cap) => {
                        const on = selectedIds.includes(cap.id);
                        return (
                          <li
                            key={cap.id}
                            className="flex items-center justify-between gap-4 py-3 border-t border-slate-50 first:border-t-0"
                          >
                            <span className="text-sm font-medium text-slate-800 min-w-0">
                              {cap.label}
                            </span>
                            <SlideToggle
                              on={on}
                              disabled={!selectedRoleId || saving}
                              onToggle={() => toggleCapability(cap.id)}
                              testId={`yetkilendirme-cap-${cap.id}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {catalog.length === 0 && (
                  <p className="py-4 text-sm text-slate-500">Henüz yönetilebilir işlem yok.</p>
                )}
              </div>

              <div className="flex justify-end border-t border-slate-100 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  disabled={saving || !selectedRoleId}
                  onClick={() => { void handleSave(); }}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  data-testid="yetkilendirme-kaydet"
                >
                  {saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SettingsPageLayout>
  );
}
