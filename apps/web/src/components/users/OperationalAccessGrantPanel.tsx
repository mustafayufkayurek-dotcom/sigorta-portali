'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export type OperationalScopeKey = 'acil_yardim' | 'hasar';

/** Senaryo A: ek modül. Senaryo B: izin vekaleti. */
export type AuthorizationFlow = 'extra_access' | 'leave_substitute';

interface OperationalAccessGrantPanelProps {
  userId: string;
  compact?: boolean;
  /** İlk açılışta önerilen sekme (rol ipucu; admin değiştirebilir) */
  defaultFlow?: AuthorizationFlow;
}

const SCOPE_LABELS: Record<OperationalScopeKey, string> = {
  acil_yardim: 'Acil Yardım',
  hasar: 'Hasar',
};

const EXTRA_ACCESS_SCOPES: OperationalScopeKey[] = ['acil_yardim', 'hasar'];

const FLOW_OPTIONS: Array<{ id: AuthorizationFlow; label: string; hint: string }> = [
  {
    id: 'extra_access',
    label: 'Ek Yetki',
    hint: 'Kendi adına ek modül. Rol değişmez.',
  },
  {
    id: 'leave_substitute',
    label: 'İzin Vekaleti',
    hint: 'Başkasının yerine bakma. Dosyada «X adına» görünür.',
  },
];

function isTestOrSmokeUser(u: { firstName?: string; lastName?: string; email?: string }): boolean {
  const haystack = `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email ?? ''}`.toLowerCase();
  return /smoke|test\s*user|@test\.|\.test@|demo@|qa-|sandbox/.test(haystack);
}

function scopeMatchesGrant(scope: OperationalScopeKey, grantScope: string): boolean {
  if (grantScope === 'both') return true;
  return grantScope === scope;
}

function scopeLabel(scope: string): string {
  if (scope === 'both') return 'Hasar ve Acil Yardım';
  return SCOPE_LABELS[scope as OperationalScopeKey] ?? scope;
}

/** Rol için önerilen ilk sekme; admin istediğinde diğerine geçebilir. */
export function resolveDefaultAuthorizationFlow(
  roleCode?: string | null,
  userTask?: string,
): AuthorizationFlow {
  const code = String(roleCode ?? '').toLowerCase();
  if (code === 'finance' || code === 'finans' || code === 'accountant') return 'extra_access';
  if (code === 'office_staff') return 'leave_substitute';
  if (userTask === 'finance') return 'extra_access';
  if (userTask === 'operations') return 'leave_substitute';
  return 'extra_access';
}

function ToggleSwitch({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        active ? 'bg-blue-600' : 'bg-slate-300'
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function OperationalAccessGrantPanel({
  userId,
  compact = false,
  defaultFlow,
}: OperationalAccessGrantPanelProps) {
  const [grants, setGrants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingScope, setTogglingScope] = useState<OperationalScopeKey | null>(null);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<AuthorizationFlow>(defaultFlow ?? 'extra_access');
  const [principalUserId, setPrincipalUserId] = useState('');
  const [scopeType, setScopeType] = useState<'acil_yardim' | 'hasar' | 'both'>('acil_yardim');
  const [note, setNote] = useState('');

  const loadGrants = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/operational-access-grants`, {
      headers: authHeader(),
      params: { granteeUserId: userId },
    })
      .then((r) => setGrants(r.data?.data ?? []))
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadGrants(); }, [loadGrants]);

  useEffect(() => {
    if (defaultFlow) setFlow(defaultFlow);
  }, [defaultFlow, userId]);

  useEffect(() => {
    axios.get(`${API}/users`, { headers: authHeader(), params: { limit: 200 } })
      .then((r) => setUsers(r.data?.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const eligiblePrincipals = useMemo(
    () => users.filter((u) => {
      if (u.id === userId) return false;
      if (isTestOrSmokeUser(u)) return false;
      return String(u.role?.code ?? '').toLowerCase() === 'office_staff';
    }),
    [users, userId],
  );

  const activeFunctionGrants = useMemo(
    () => grants.filter((g) => g.isActive && g.grantType === 'function_delegation'),
    [grants],
  );

  const activePersonGrants = useMemo(
    () => grants.filter((g) => g.isActive && g.grantType === 'person_delegation'),
    [grants],
  );

  const activeFunctionGrant = useCallback(
    (scope: OperationalScopeKey) => grants.find(
      (g) => g.isActive
        && g.grantType === 'function_delegation'
        && scopeMatchesGrant(scope, g.scopeType),
    ),
    [grants],
  );

  async function createGrant(payload: {
    grantType: string;
    scopeType: string;
    principalUserId?: string;
    reason?: string;
  }) {
    await axios.post(`${API}/operational-access-grants`, {
      granteeUserId: userId,
      grantType: payload.grantType,
      principalUserId: payload.grantType === 'person_delegation' ? payload.principalUserId : undefined,
      scopeType: payload.scopeType,
      accessLevel: 'manage',
      validFrom: new Date().toISOString(),
      reason: payload.reason?.trim() || undefined,
    }, { headers: authHeader() });
  }

  async function handleDeactivate(grantId: string) {
    await axios.patch(`${API}/operational-access-grants/${grantId}/deactivate`, {}, { headers: authHeader() });
    loadGrants();
  }

  async function toggleExtraAccess(scope: OperationalScopeKey, enabled: boolean) {
    setTogglingScope(scope);
    setError('');
    try {
      const existing = activeFunctionGrant(scope);
      if (enabled && !existing) {
        await createGrant({ grantType: 'function_delegation', scopeType: scope });
      } else if (!enabled && existing) {
        await handleDeactivate(existing.id);
      }
      loadGrants();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Yetki güncellenemedi');
    } finally {
      setTogglingScope(null);
    }
  }

  async function handleLeaveSubstitute(e: React.FormEvent) {
    e.preventDefault();
    if (!principalUserId) {
      setError('Kimin yerine bakılacağı seçilmelidir.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createGrant({
        grantType: 'person_delegation',
        scopeType,
        principalUserId,
        reason: note,
      });
      setPrincipalUserId('');
      setNote('');
      loadGrants();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'İzin vekaleti kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  const cardClass = `rounded-xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'}`;
  const selectedFlowMeta = FLOW_OPTIONS.find((f) => f.id === flow);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={cardClass}>
        <h4 className={`font-semibold text-slate-800 ${compact ? 'text-sm mb-3' : 'text-base mb-4'}`}>
          Yetkilendirme Yönetimi
        </h4>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {FLOW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => { setFlow(option.id); setError(''); }}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                flow === option.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">{option.hint}</span>
            </button>
          ))}
        </div>

        {selectedFlowMeta && (
          <p className="text-xs leading-5 text-slate-500 mb-4">
            Seçili yapı: <span className="font-medium text-slate-700">{selectedFlowMeta.label}</span>
            {' — '}
            {selectedFlowMeta.hint}
          </p>
        )}

        {flow === 'extra_access' ? (
          loading ? (
            <p className="text-sm text-slate-500">Yükleniyor…</p>
          ) : (
            <div className="space-y-2">
              {EXTRA_ACCESS_SCOPES.map((scope) => {
                const active = Boolean(activeFunctionGrant(scope));
                return (
                  <div
                    key={scope}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{SCOPE_LABELS[scope]} Dosya Yönetimi</p>
                      <p className="text-xs text-slate-500">Kullanıcı kendi adına işlem yapar</p>
                    </div>
                    <ToggleSwitch
                      active={active}
                      disabled={togglingScope === scope}
                      onToggle={() => toggleExtraAccess(scope, !active)}
                    />
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <form onSubmit={handleLeaveSubstitute} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kimin Yerine?</label>
              <select
                value={principalUserId}
                onChange={(e) => setPrincipalUserId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Dosya sorumlusu seçin…</option>
                {eligiblePrincipals.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dosya Türü</label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as typeof scopeType)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="acil_yardim">Acil Yardım</option>
                <option value="hasar">Hasar</option>
                <option value="both">Hasar ve Acil Yardım</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opsiyonel (ör. yıllık izin)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !principalUserId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'İzin Vekaleti Ver'}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className={cardClass}>
        <h4 className={`font-semibold text-slate-800 ${compact ? 'text-xs mb-3' : 'text-sm mb-4'}`}>
          Aktif Kayıtlar
        </h4>
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : activeFunctionGrants.length === 0 && activePersonGrants.length === 0 ? (
          <p className="text-sm text-slate-500">Aktif yetki veya vekalet kaydı yok.</p>
        ) : (
          <div className="space-y-2">
            {activeFunctionGrants.map((grant) => (
              <div key={grant.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Ek Yetki · {scopeLabel(grant.scopeType)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Kendi adına dosya yönetimi</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivate(grant.id).catch(() => setError('Kayıt kaldırılamadı'))}
                  className="text-xs font-medium text-red-600 hover:text-red-800 shrink-0"
                >
                  Kaldır
                </button>
              </div>
            ))}
            {activePersonGrants.map((grant) => (
              <div key={grant.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    İzin Vekaleti · {grant.principalUser
                      ? `${grant.principalUser.firstName} ${grant.principalUser.lastName} adına`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{scopeLabel(grant.scopeType)} dosyaları</p>
                  {grant.reason && <p className="text-xs text-slate-500 mt-0.5">Not: {grant.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivate(grant.id).catch(() => setError('Vekalet kaldırılamadı'))}
                  className="text-xs font-medium text-red-600 hover:text-red-800 shrink-0"
                >
                  Kaldır
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
