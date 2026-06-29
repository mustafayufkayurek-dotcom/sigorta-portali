'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { TrDateInput } from '@/components/ui/TrDateInput';
import ProcessTimeline from '@/components/timeline/ProcessTimeline';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import SpeechToText from '@/components/SpeechToText';
import { OnlineCollectionLinksPanel } from '@/components/finance/OnlineCollectionLinksPanel';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function normalizeRoleCode(roleCode?: string | null): string | null {
  if (!roleCode) return null;
  return String(roleCode).trim().toLowerCase().replace(/\s+/g, '_');
}

function getCurrentUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of ['user', 'currentUser']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const roleCode = normalizeRoleCode(u?.role?.code ?? u?.roleCode);
      if (roleCode) return roleCode;
    }
    return null;
  } catch { return null; }
}

type FinVisRoleKey = 'manager' | 'finance' | 'office_staff' | 'field_staff';
type FinVisUserOverride = 'allow' | 'deny';
type FinVisRoleMode = 'all' | 'none' | 'custom';
type FinVisConfig = {
  roles: Record<FinVisRoleKey, boolean>;
  userOverrides: Record<string, FinVisUserOverride>;
  roleModes?: Partial<Record<FinVisRoleKey, FinVisRoleMode>>;
};

const FIN_VIS_SELECT_CLASS = 'text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white min-w-0 max-w-full flex-1';

function getAssigneeDropdownValue(
  roleKey: 'office_staff' | 'field_staff',
  config: FinVisConfig,
  assignees: { id: string }[],
): string {
  if (assignees.length === 0) return 'all';
  const mode = inferAssigneeRoleMode(roleKey, config, assignees);
  if (mode === 'all') return 'all';
  if (mode === 'none') return 'none';

  const allowed = assignees.filter((a) => config.userOverrides[a.id] === 'allow');
  const denied = assignees.filter((a) => config.userOverrides[a.id] === 'deny');

  if (allowed.length === 1 && denied.length === 0) {
    return `allow:${allowed[0].id}`;
  }
  if (denied.length === 1 && allowed.length === 0) {
    return assignees.length === 1 ? 'none' : `deny:${denied[0].id}`;
  }
  return 'none';
}

function applyAssigneeDropdownChange(
  roleKey: 'office_staff' | 'field_staff',
  value: string,
  assignees: { id: string }[],
  config: FinVisConfig,
): FinVisConfig {
  const roleModes = { ...(config.roleModes ?? {}) };
  let userOverrides = clearAssigneeOverrides({ ...config.userOverrides }, assignees);
  const roles = { ...config.roles };

  if (value === 'all') {
    roles[roleKey] = true;
    roleModes[roleKey] = 'all';
    userOverrides = clearAssigneeOverrides(userOverrides, assignees);
  } else if (value === 'none') {
    roles[roleKey] = false;
    roleModes[roleKey] = 'none';
    userOverrides = clearAssigneeOverrides(userOverrides, assignees);
  } else if (value.startsWith('deny:')) {
    const id = value.slice(5);
    if (assignees.length === 1) {
      roles[roleKey] = false;
      roleModes[roleKey] = 'none';
      userOverrides = clearAssigneeOverrides(userOverrides, assignees);
    } else {
      roles[roleKey] = true;
      roleModes[roleKey] = 'custom';
      userOverrides[id] = 'deny';
    }
  } else if (value.startsWith('allow:')) {
    const id = value.slice(6);
    roles[roleKey] = false;
    roleModes[roleKey] = 'custom';
    userOverrides[id] = 'allow';
  }

  return { roles, roleModes, userOverrides };
}

const DEFAULT_FIN_VIS_CONFIG: FinVisConfig = {
  roles: { manager: true, finance: true, office_staff: true, field_staff: false },
  userOverrides: {},
};

function resolveFinVisConfig(claim: any): FinVisConfig {
  if (claim?.financialVisibilityConfig?.roles) {
    const c = claim.financialVisibilityConfig;
    return {
      roles: { ...DEFAULT_FIN_VIS_CONFIG.roles, ...c.roles },
      userOverrides: { ...(c.userOverrides ?? {}) },
      roleModes: c.roleModes ? { ...c.roleModes } : undefined,
    };
  }
  if (claim?.hideFinancialFromAssignees) {
    return {
      roles: { manager: true, finance: true, office_staff: false, field_staff: false },
      userOverrides: {},
      roleModes: { office_staff: 'none', field_staff: 'none' },
    };
  }
  return { ...DEFAULT_FIN_VIS_CONFIG, userOverrides: {} };
}

function collectOfficeAssignees(claim: any): { id: string; name: string; label: string }[] {
  const rows: { id: string; name: string; label: string }[] = [];
  const push = (user: any, label: string) => {
    if (!user?.id) return;
    if (rows.some((r) => r.id === user.id)) return;
    rows.push({
      id: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—',
      label,
    });
  };
  push(claim.assignedOfficeUser, 'Dosya sorumlusu');
  push(claim.currentResponsibleUser, 'Güncel sorumlu');
  return rows;
}

function inferAssigneeRoleMode(
  roleKey: 'office_staff' | 'field_staff',
  config: FinVisConfig,
  assignees: { id: string }[],
): FinVisRoleMode {
  if (config.roleModes?.[roleKey]) return config.roleModes[roleKey]!;
  if (config.roles[roleKey]) return 'all';
  if (assignees.length === 0) return config.roles[roleKey] ? 'all' : 'none';
  if (assignees.some((a) => config.userOverrides[a.id])) return 'custom';
  return 'none';
}

function clearAssigneeOverrides(
  userOverrides: Record<string, FinVisUserOverride>,
  assignees: { id: string }[],
): Record<string, FinVisUserOverride> {
  const next = { ...userOverrides };
  for (const a of assignees) delete next[a.id];
  return next;
}

function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

// ─── Gruplandırılmış Tab Yapısı ───────────────────────────────────────────────
type GroupTab = 'genel-bilgiler' | 'raporlar' | 'evraklar' | 'finans' | 'iletisim' | 'takip' | 'revizyonlar' | 'is-akisi';

const GROUP_TABS: { id: GroupTab; label: string; icon: string }[] = [
  { id: 'genel-bilgiler', label: 'Genel Bilgiler', icon: '📋' },
  { id: 'raporlar',       label: 'Raporlar',       icon: '📊' },
  { id: 'evraklar',       label: 'Evraklar',        icon: '📁' },
  { id: 'finans',         label: 'Finans',           icon: '💰' },
  { id: 'iletisim',       label: 'İletişim',         icon: '💬' },
  { id: 'takip',          label: 'Takip',            icon: '✅' },
  { id: 'is-akisi',       label: 'İş Akışı',        icon: '🔄' },
  { id: 'revizyonlar',    label: 'Revizyonlar',      icon: '↩' },
];

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{text}</span>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

// ─── Tedarikçi Maliyeti ve Kar Özeti Kartı ────────────────────────────────────
function TedarikciKarOzetiCard({ claimId }: { claimId: string }) {
  const [data, setData] = useState<{ totalSales: number; totalSupplier: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/claim-files/${claimId}/repair-reports`, { headers: authHeader() })
      .then((r) => {
        const reports: any[] = r.data.data || [];
        let totalSales = 0;
        let totalSupplier = 0;
        for (const report of reports) {
          for (const item of report.items ?? []) {
            const qty = item.quantity ?? 1;
            const sales = item.salesTotal != null ? item.salesTotal : qty * (item.salesUnitPrice ?? 0);
            const supplier = item.supplierTotal != null ? item.supplierTotal : qty * (item.supplierUnitPrice ?? 0);
            totalSales += sales;
            totalSupplier += supplier;
          }
        }
        setData({ totalSales, totalSupplier });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return (
    <SectionCard title="Tedarikçi Maliyeti ve Kâr Özeti">
      <p className="text-xs text-slate-400">Yükleniyor...</p>
    </SectionCard>
  );

  if (!data) return null;

  const grossProfit = data.totalSales - data.totalSupplier;
  const profitRate = data.totalSales > 0 ? (grossProfit / data.totalSales) * 100 : 0;
  const isProfit = grossProfit >= 0;

  return (
    <SectionCard title="Tedarikçi Maliyeti ve Kâr Özeti">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Toplam Satış Fiyatı</p>
          <p className="text-sm font-semibold text-slate-800">{fmtCurrency(data.totalSales)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Toplam Tedarikçi Maliyeti</p>
          <p className="text-sm font-semibold text-slate-800">{fmtCurrency(data.totalSupplier)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Brüt Kâr</p>
          <p className={`text-sm font-semibold ${isProfit ? 'text-green-700' : 'text-red-600'}`}>{fmtCurrency(grossProfit)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Kâr Oranı</p>
          <p className={`text-sm font-semibold ${isProfit ? 'text-green-700' : 'text-red-600'}`}>%{profitRate.toFixed(1)}</p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Tab: Genel ────────────────────────────────────────────────────────────────
function GenelTab({ claim, isFieldStaff, userRoleCode, onClaimUpdated }: { claim: any; isFieldStaff: boolean; userRoleCode: string | null; onClaimUpdated?: (patch: Partial<any>) => void }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggLoading, setSuggLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [currentOfficeUser, setCurrentOfficeUser] = useState(claim.assignedOfficeUser);
  const [finVisConfig, setFinVisConfig] = useState<FinVisConfig>(() => resolveFinVisConfig(claim));
  const [savingFinVis, setSavingFinVis] = useState(false);
  const canViewFinancials = claim.canViewFinancials !== false;
  const canManageFinVisibility = claim.canManageFinancialVisibility === true
    || userRoleCode === 'admin'
    || userRoleCode === 'manager'
    || userRoleCode === 'ops_manager';
  const officeAssignees = collectOfficeAssignees(claim);

  useEffect(() => {
    setFinVisConfig(resolveFinVisConfig(claim));
  }, [claim.id, claim.financialVisibilityConfig, claim.hideFinancialFromAssignees]);

  useEffect(() => {
    if (!claim?.id) return;
    setSuggLoading(true);
    axios.get(`${API}/claim-files/${claim.id}/suggest-responsible`, { headers: authHeader() })
      .then((r) => setSuggestions(r.data.data || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggLoading(false));
  }, [claim?.id]);

  const handleAssign = async (userId: string) => {
    setAssigning(userId);
    try {
      await axios.post(`${API}/claim-files/${claim.id}/assign`, { assignedOfficeUserId: userId }, { headers: authHeader() });
      const assigned = suggestions.find((s) => s.user.id === userId);
      if (assigned) setCurrentOfficeUser(assigned.user);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Atama başarısız');
    } finally {
      setAssigning(null);
    }
  };

  const saveFinVisConfig = async (next: FinVisConfig) => {
    setSavingFinVis(true);
    setFinVisConfig(next);
    try {
      const payload = {
        financialVisibilityConfig: {
          roles: next.roles,
          roleModes: next.roleModes,
          userOverrides: Object.fromEntries(
            Object.entries(next.userOverrides).filter(([, v]) => v === 'allow' || v === 'deny'),
          ),
        },
      };
      await axios.patch(`${API}/claim-files/${claim.id}`, payload, { headers: authHeader() });
      onClaimUpdated?.({
        financialVisibilityConfig: payload.financialVisibilityConfig,
        hideFinancialFromAssignees: false,
      });
    } catch (e: any) {
      setFinVisConfig(resolveFinVisConfig(claim));
      alert(e?.response?.data?.message ?? 'Ayar kaydedilemedi');
    } finally {
      setSavingFinVis(false);
    }
  };

  const handleFinVisRoleSelect = (key: 'manager' | 'finance', canView: boolean) => {
    void saveFinVisConfig({
      ...finVisConfig,
      roles: { ...finVisConfig.roles, [key]: canView },
    });
  };

  const handleAssigneeDropdown = (
    roleKey: 'office_staff' | 'field_staff',
    value: string,
    assignees: { id: string }[],
  ) => {
    void saveFinVisConfig(applyAssigneeDropdownChange(roleKey, value, assignees, finVisConfig));
  };

  const officeDropdownValue = getAssigneeDropdownValue('office_staff', finVisConfig, officeAssignees);

  const fields = [
    { label: 'Dosya No', value: claim.fileNo },
    { label: 'Poliçe No', value: claim.policyNo },
    { label: 'Hasar No', value: claim.claimNo },
    { label: 'Branş', value: claim.productBranch },
    { label: 'Hasar Tipi', value: claim.lossType },
    { label: 'Hasar Tarihi', value: fmtDate(claim.incidentDate) },
    { label: 'İhbar Tarihi', value: fmtDate(claim.notificationDate) },
    { label: 'Sigorta Şirketi', value: claim.insuranceCompany?.name },
    { label: 'Durum', value: claim.currentStatus?.name },
    { label: 'Öncelik', value: claim.priority },
    { label: 'Mülk Tipi', value: claim.propertyType ?? '—' },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
  ];

  return (
    <div className="space-y-5">
      <SectionCard title="Dosya Bilgileri">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800">{f.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Dosya Sorumlusu */}
      <SectionCard title="Dosya Sorumlusu">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400">Mevcut Sorumlu</p>
            <p className="text-sm font-medium text-slate-800">
              {currentOfficeUser ? `${currentOfficeUser.firstName} ${currentOfficeUser.lastName}` : '— Atanmamış —'}
            </p>
          </div>
          {suggLoading ? (
            <p className="text-xs text-slate-400">Öneriler Yükleniyor...</p>
          ) : suggestions.length > 0 ? (
            <div>
              <p className="text-xs text-slate-500 mb-2">Bölgeye Göre Öneriler:</p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.user.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.user.firstName} {s.user.lastName}</p>
                      <p className="text-xs text-slate-400">
                        {s.province?.name}{s.district ? ` / ${s.district.name}` : ''} · {s.activeFileCount} aktif dosya
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => handleAssign(s.user.id)}
                      disabled={assigning === s.user.id || currentOfficeUser?.id === s.user.id}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                      {assigning === s.user.id ? 'Atanıyor...' : currentOfficeUser?.id === s.user.id ? 'Atandı' : 'Ata'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {canManageFinVisibility && (
        <SectionCard title="Finansal Özet Erişimi">
          <p className="text-xs text-slate-500 mb-3">
            Bu dosyada finansal özet erişimini yönetin. Yönetici hesapları her zaman erişebilir.
          </p>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 shrink-0">Finans / Muhasebe</span>
              <select
                className={FIN_VIS_SELECT_CLASS}
                value={finVisConfig.roles.finance ? 'yes' : 'no'}
                disabled={savingFinVis}
                onChange={(e) => handleFinVisRoleSelect('finance', e.target.value === 'yes')}
              >
                <option value="yes">Görüntüleyebilir</option>
                <option value="no">Görüntüleyemez</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 shrink-0">Yönetici / Müdür</span>
              <select
                className={FIN_VIS_SELECT_CLASS}
                value={finVisConfig.roles.manager ? 'yes' : 'no'}
                disabled={savingFinVis}
                onChange={(e) => handleFinVisRoleSelect('manager', e.target.value === 'yes')}
              >
                <option value="yes">Görüntüleyebilir</option>
                <option value="no">Görüntüleyemez</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600 shrink-0">Dosya sorumlusu</span>
              {officeAssignees.length === 0 ? (
                <span className="text-xs text-slate-400">Sorumlu atanmamış</span>
              ) : (
                <select
                  className={FIN_VIS_SELECT_CLASS}
                  value={officeDropdownValue}
                  disabled={savingFinVis}
                  onChange={(e) => handleAssigneeDropdown('office_staff', e.target.value, officeAssignees)}
                >
                  <option value="all">Tüm sorumlular — erişim açık</option>
                  <option value="none">Tüm sorumlular — erişim kapalı</option>
                  <option disabled>──────────</option>
                  {officeAssignees.map((p) => (
                    <option key={`allow-${p.id}`} value={`allow:${p.id}`}>
                      {p.name} — erişim açık
                    </option>
                  ))}
                  {officeAssignees.map((p) => (
                    <option key={`deny-${p.id}`} value={`deny:${p.id}`}>
                      {p.name} — erişim kapalı
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {savingFinVis && <p className="text-xs text-slate-400 mt-2">Ayar kaydediliyor…</p>}
        </SectionCard>
      )}

      {claim.customer && (
        <SectionCard title="Müşteri">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div><p className="text-xs text-slate-400">Ad / Unvan</p><p className="text-sm font-medium text-slate-800">{claim.customer.fullName ?? claim.customer.companyName}</p></div>
            <div><p className="text-xs text-slate-400">Telefon</p><p className="text-sm font-medium text-slate-800">{claim.customer.phone ?? '—'}</p></div>
            <div><p className="text-xs text-slate-400">E-Posta</p><p className="text-sm font-medium text-slate-800">{claim.customer.email ?? '—'}</p></div>
          </div>
        </SectionCard>
      )}

      {!isFieldStaff && canViewFinancials && (
      <SectionCard title="Finansal Özet">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {[
            { label: 'İlk Rezerv', value: fmtCurrency(claim.initialReserveAmount) },
            { label: 'Tahmini Maliyet', value: fmtCurrency(claim.estimatedCostAmount) },
            { label: 'Onaylı Bütçe', value: fmtCurrency(claim.approvedBudgetAmount) },
            { label: 'Gerçekleşen', value: fmtCurrency(claim.actualCostAmount) },
            { label: 'Faturalanan', value: fmtCurrency(claim.invoicedAmount) },
            { label: 'Tahsil Edilen', value: fmtCurrency(claim.collectedAmount) },
          ].map((f) => (
            <div key={f.label}><p className="text-xs text-slate-400">{f.label}</p><p className="text-sm font-medium text-slate-800">{f.value}</p></div>
          ))}
        </div>
      </SectionCard>
      )}

      {!isFieldStaff && canViewFinancials && (userRoleCode === 'admin' || userRoleCode === 'office_staff') && (
        <TedarikciKarOzetiCard claimId={claim.id} />
      )}

      {!isFieldStaff && !canViewFinancials && (
        <SectionCard title="Finansal Özet">
          <p className="text-sm text-slate-500">
            Bu dosyada finansal özet, erişim kısıtı nedeniyle görüntülenemiyor.
          </p>
        </SectionCard>
      )}

      {claim.statusHistory?.length > 0 && (
        <SectionCard title="Durum Geçmişi">
          <div className="space-y-3">
            {claim.statusHistory.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <span className="text-slate-500">{new Date(h.changedAt).toLocaleString('tr-TR')}</span>
                  {' · '}
                  <span className="font-medium">{h.fromStatus?.name ?? '—'} → {h.toStatus?.name}</span>
                  {' · '}
                  <span className="text-slate-500">{h.changedByUser?.firstName} {h.changedByUser?.lastName}</span>
                  {h.note && <p className="text-slate-400 text-xs mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Tab: Görevler ────────────────────────────────────────────────────────────
function GorevlerTab({ claimId }: { claimId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/tasks?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setTasks(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!tasks.length) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">Henüz Görev Eklenmedi</p>
        <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait görev bulunmuyor.</p>
      </div>
    </div>
  );

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <div key={t.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">{t.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.taskType} · {fmtDate(t.dueAt)}</p>
          </div>
          <Badge text={t.status} color={statusColor[t.status] ?? 'bg-slate-100 text-slate-600'} />
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Notlar ───────────────────────────────────────────────────────────────
function NotlarTab({ claimId }: { claimId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/notes?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setNotes(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!notes.length) return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">Henüz Not Eklenmedi</p>
        <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait not bulunmuyor.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{n.noteType}</span>
            <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('tr-TR')}</span>
          </div>
          <p className="text-sm text-slate-700">{n.content}</p>
          <p className="text-xs text-slate-400 mt-1">{n.author?.firstName} {n.author?.lastName}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Dokümanlar ──────────────────────────────────────────────────────────
// Helpers for DokumanlarTab
function _docFileIcon(ext: string) {
  const e = (ext || '').replace('.', '').toLowerCase();
  if (e === 'pdf') return { bg: 'bg-red-50', text: 'text-red-600' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) return { bg: 'bg-green-50', text: 'text-green-600' };
  if (['doc', 'docx'].includes(e)) return { bg: 'bg-blue-50', text: 'text-blue-700' };
  if (['xls', 'xlsx'].includes(e)) return { bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (e === 'dwg') return { bg: 'bg-orange-50', text: 'text-orange-600' };
  if (e === 'dxf') return { bg: 'bg-violet-50', text: 'text-violet-600' };
  return { bg: 'bg-slate-100', text: 'text-slate-600' };
}

function _isCADExt(ext: string) {
  const e = (ext || '').replace('.', '').toLowerCase();
  return e === 'dwg' || e === 'dxf';
}

function _isPreviewable(mimeType: string) {
  return mimeType?.startsWith('image/') || mimeType === 'application/pdf';
}

function _fmtBytes(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const DwgDxfViewerModal = dynamic(
  () => import('@/components/DwgDxfViewerModal').then((m) => m.DwgDxfViewerModal),
  { ssr: false }
);

function DokumanlarTab({ claimId }: { claimId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [cadDoc, setCadDoc] = useState<any | null>(null);
  const [cadUrl, setCadUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocs = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/documents?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setDocs(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = '.' + (file.name.split('.').pop() || '');
      // Step 1: get presigned URL
      const presignRes = await axios.post(`${API}/uploads/presign`, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        ownerType: 'claim_file',
        ownerId: claimId,
      }, { headers: authHeader() });
      const { presignedUrl, storageKey } = presignRes.data.data;

      // Step 2: PUT to presigned URL (or local)
      if (presignedUrl.includes('localhost')) {
        // local: use our API
        const fd = new FormData();
        fd.append('file', file);
        await axios.post(`${API}/uploads/${storageKey}`, fd, {
          headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      }

      // Step 3: create document record
      await axios.post(`${API}/documents`, {
        claimFileId: claimId,
        fileName: file.name,
        fileExtension: ext,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        storageKey,
        documentType: null,
        category: 'document',
      }, { headers: authHeader() });

      loadDocs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Yükleme başarısız');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getDocUrl = async (storageKey: string): Promise<string> => {
    const r = await axios.get(`${API}/uploads/signed-url?storageKey=${encodeURIComponent(storageKey)}`, { headers: authHeader() });
    return r.data.data.url;
  };

  const handleDownload = async (doc: any) => {
    const fileName = doc.fileAsset?.fileName || 'dosya';
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { alert('İndirilemiyor'); }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`"${fileName}" silinsin mi?`)) return;
    try {
      await axios.delete(`${API}/documents/${docId}`, { headers: authHeader() });
      loadDocs();
    } catch { alert('Silinemedi'); }
  };

  const handlePreview = async (doc: any) => {
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      setPreviewDoc({ ...doc, _url: url });
    } catch { alert('Önizleme açılamadı'); }
  };

  const handleCADView = async (doc: any) => {
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      setCadUrl(url);
      setCadDoc(doc);
    } catch { alert('Görüntüleyici açılamadı'); }
  };

  return (
    <div className="space-y-4">
      {/* Upload panel */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Evraklar — Yükle</h4>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={(el) => { fileInputRef.current = el; }}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
            onChange={handleUpload}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {uploading ? 'Yükleniyor...' : 'Dosya Seç'}
          </button>
          <span className="text-xs text-slate-400">PDF, JPG, PNG, DOC, XLS, <span className="font-semibold text-orange-600">DWG</span>, <span className="font-semibold text-violet-600">DXF</span> desteklenir</span>
        </div>
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Evraklar</h4>
          {docs.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">{docs.length} dosya</span>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center"><p className="text-slate-400 text-sm">Yükleniyor...</p></div>
        ) : docs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-slate-400 text-sm">Henüz Evrak Yüklenmemiş.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {docs.map((d) => {
              const fa = d.fileAsset;
              const ext = (fa?.fileExtension || '').replace('.', '').toLowerCase();
              const icon = _docFileIcon(fa?.fileExtension || '');
              const canPreview = _isPreviewable(fa?.mimeType || '');
              const canViewCAD = _isCADExt(fa?.fileExtension || '');
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors duration-100 group">
                  <div className={`w-9 h-9 rounded-lg ${icon.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`${icon.text} text-[10px] font-bold tracking-tight`}>{ext.toUpperCase() || 'FILE'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate leading-snug">{fa?.fileName || '—'}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {d.documentType && <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-medium">{d.documentType}</span>}
                      {fa?.fileSize && <span className="text-xs text-slate-400">{_fmtBytes(fa.fileSize)}</span>}
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">v{d.versionNo}</span>
                      {d.createdAt && <><span className="text-slate-300 text-xs">·</span><span className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('tr-TR')}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                      <button type="button" title="Önizle" onClick={() => handlePreview(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    {canViewCAD && (
                      <button type="button" title="CAD Görüntüle" onClick={() => handleCADView(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    <button type="button" title="İndir" onClick={() => handleDownload(d)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button type="button" title="Sil" onClick={() => handleDelete(d.id, fa?.fileName || '')}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-red-50 text-red-500 hover:bg-red-100 border-red-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SozlesmelerSection claimId={claimId} />

      {/* Preview modal (PDF/Image) */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setPreviewDoc(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 truncate">{previewDoc.fileAsset?.fileName}</p></div>
              <button type="button" onClick={() => { handleDownload(previewDoc); setPreviewDoc(null); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                İndir
              </button>
              <button type="button" onClick={() => setPreviewDoc(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0 bg-slate-50">
              {previewDoc.fileAsset?.mimeType === 'application/pdf' ? (
                <iframe src={previewDoc._url} className="w-full h-full" style={{ minHeight: '62vh' }} title={previewDoc.fileAsset?.fileName} />
              ) : (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewDoc._url} alt={previewDoc.fileAsset?.fileName} className="max-w-full max-h-full object-contain rounded-xl shadow-md" style={{ maxHeight: 'calc(92vh - 100px)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DWG/DXF viewer modal */}
      {cadDoc && cadUrl && (
        <DwgDxfViewerModal
          doc={{
            id: cadDoc.id,
            fileName: cadDoc.fileAsset?.fileName || '',
            fileExtension: cadDoc.fileAsset?.fileExtension || '',
            fileSize: cadDoc.fileAsset?.fileSize || 0,
            storageKey: cadDoc.fileAsset?.storageKey || '',
            createdAt: cadDoc.createdAt || '',
            uploadedBy: cadDoc.fileAsset?.uploadedBy || null,
          }}
          fileUrl={cadUrl}
          onClose={() => { setCadDoc(null); setCadUrl(''); }}
          onDownload={() => handleDownload(cadDoc)}
        />
      )}
    </div>
  );
}


// ─── Tedarikçi Sözleşmeleri Bölümü ────────────────────────────────────────────
const CONTRACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:         { label: 'Taslak',            color: 'bg-slate-100 text-slate-700' },
  ready:         { label: 'Hazır',             color: 'bg-blue-100 text-blue-700' },
  sent:          { label: 'Gönderildi',        color: 'bg-amber-100 text-amber-700' },
  vendor_signed: { label: 'İmzalandı',         color: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'İptal Edildi',      color: 'bg-red-100 text-red-700' },
};

function SozlesmelerSection({ claimId }: { claimId: string }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState<{ id: string; phone: string } | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/vendor-contracts?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setContracts(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSendWhatsapp = async () => {
    if (!whatsappModal) return;
    setWaSending(true);
    try {
      const r = await axios.post(
        `${API}/vendor-contracts/${whatsappModal.id}/send-whatsapp`,
        { phone: whatsappModal.phone },
        { headers: authHeader() },
      );
      setWaLink(r.data.data.waUrl);
      load();
    } catch { alert('Hata oluştu'); }
    finally { setWaSending(false); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Bu sözleşmeyi iptal etmek istediğinize emin misiniz?')) return;
    setCancelling(id);
    try {
      await axios.delete(`${API}/vendor-contracts/${id}`, { headers: authHeader() });
      load();
    } catch { alert('İptal sırasında hata oluştu'); }
    finally { setCancelling(null); }
  };

  const handleDownloadPdf = (id: string, contractNo: string) => {
    const link = document.createElement('a');
    link.href = `${API}/vendor-contracts/${id}/pdf`;
    link.setAttribute('download', `sozlesme_${contractNo}.pdf`);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700 tracking-wide">Tedarikçi Sözleşmeleri</h3>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Sözleşme Oluştur
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">Yükleniyor…</div>
      ) : contracts.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-400">Henüz sözleşme oluşturulmamış.</p>
          <button type="button" onClick={() => setShowCreate(true)} className="mt-2 text-xs text-indigo-600 hover:underline font-medium">İlk sözleşmeyi oluştur</button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const st = CONTRACT_STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-slate-100 text-slate-600' };
            return (
              <div key={c.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{c.contractNo}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    {c.status === 'sent' && c.reminderCount > 0 && (
                      <span className="text-xs text-amber-600 font-medium">{c.reminderCount} hatırlatma</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {c.vendor?.name} · {new Date(c.contractDate).toLocaleDateString('tr-TR')}
                    {c.signDeadlineAt && c.status !== 'vendor_signed' && c.status !== 'cancelled' && (
                      <span className="ml-2 text-red-500">Son imza: {new Date(c.signDeadlineAt).toLocaleDateString('tr-TR')}</span>
                    )}
                    {c.signedAt && (
                      <span className="ml-2 text-green-600">İmzalandı: {new Date(c.signedAt).toLocaleDateString('tr-TR')}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(c.id, c.contractNo)}
                    title="PDF İndir"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                  {c.status !== 'cancelled' && c.status !== 'vendor_signed' && (
                    <button
                      type="button"
                      onClick={() => setWhatsappModal({ id: c.id, phone: c.vendor?.phone ?? '' })}
                      title="WhatsApp Gönder"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  )}
                  {c.status !== 'cancelled' && c.status !== 'vendor_signed' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(c.id)}
                      disabled={cancelling === c.id}
                      title="İptal Et"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateContractModal
          claimId={claimId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* WhatsApp Modal */}
      {whatsappModal && !waLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">WhatsApp ile Gönder</h3>
            <label className="block text-xs font-medium text-slate-600 mb-1">Telefon Numarası</label>
            <input
              type="tel"
              value={whatsappModal.phone}
              onChange={(e) => setWhatsappModal({ ...whatsappModal, phone: e.target.value })}
              placeholder="05xx xxx xx xx"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setWhatsappModal(null)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
              <button
                type="button"
                onClick={handleSendWhatsapp}
                disabled={waSending || !whatsappModal.phone}
                className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {waSending ? 'Kaydediliyor…' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WA Link Modal */}
      {waLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <p className="text-sm font-medium text-slate-800 mb-1">Sözleşme Linki Hazır</p>
            <p className="text-xs text-slate-500 mb-4">Aşağıdaki butona tıklayarak WhatsApp'ı açın ve mesajı gönderin.</p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors mb-2"
            >
              WhatsApp'ta Aç
            </a>
            <button type="button" onClick={() => { setWaLink(null); setWhatsappModal(null); }} className="text-xs text-slate-500 hover:text-slate-700">Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateContractModal({ claimId, onClose, onCreated }: {
  claimId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [form, setForm] = useState({
    vendorId: '',
    repairReportId: '',
    startDate: '',
    deliveryDate: '',
    signDeadlineDays: 3,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/vendors?limit=200&status=active`, { headers: authHeader() }),
      axios.get(`${API}/repair-reports?claimFileId=${claimId}&limit=50`, { headers: authHeader() }),
    ]).then(([vr, rr]) => {
      setVendors(vr.data.data?.vendors ?? vr.data.data ?? []);
      setReports(rr.data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [claimId]);

  const handleSubmit = async () => {
    if (!form.vendorId) { setError('Tedarikçi seçiniz'); return; }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API}/vendor-contracts`, {
        claimFileId: claimId,
        vendorId: form.vendorId,
        repairReportId: form.repairReportId || undefined,
        startDate: form.startDate || undefined,
        deliveryDate: form.deliveryDate || undefined,
        signDeadlineDays: form.signDeadlineDays,
      }, { headers: authHeader() });
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Sözleşme oluşturulamadı');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-slate-800 mb-5">Sözleşme Oluştur</h3>

        {loading ? (
          <div className="py-6 text-center text-sm text-slate-400">Yükleniyor…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tedarikçi <span className="text-red-500">*</span></label>
              <select
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Tedarikçi seçin —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {reports.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Onarım Raporu (iş kalemleri için)</label>
                <select
                  value={form.repairReportId}
                  onChange={(e) => setForm({ ...form, repairReportId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— Rapor seçin (opsiyonel) —</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>{r.reportNo} — {new Date(r.createdAt).toLocaleDateString('tr-TR')}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Başlangıç Tarihi</label>
                <TrDateInput value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Teslim Tarihi</label>
                <TrDateInput value={form.deliveryDate} onChange={(deliveryDate) => setForm({ ...form, deliveryDate })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">İmza Son Tarihi (gün)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={form.signDeadlineDays}
                onChange={(e) => setForm({ ...form, signDeadlineDays: parseInt(e.target.value) || 3 })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-slate-400 mt-1">Tedarikçinin sözleşmeyi imzalaması için verilen gün sayısı</p>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">İptal</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {submitting ? 'Oluşturuluyor…' : 'Sözleşme Oluştur'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Akıllı Tedarikçi Öneri Paneli ────────────────────────────────────────────
function VendorSuggestPanel({
  city,
  category,
  selectedVendorId,
  onSelect,
  onManual,
}: {
  city?: string;
  category: string;
  selectedVendorId: string;
  onSelect: (vendorId: string) => void;
  onManual: () => void;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ category });
    if (city) params.set('city', city);
    setLoading(true);
    axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
      .then((r) => setSuggestions(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [city, category]);

  return (
    <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700">Önerilen Tedarikçiler {city ? `(${city})` : ''}</p>
        <button type="button" onClick={onManual} className="text-xs text-slate-500 hover:text-slate-700 underline">Manuel Seç</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 py-2 text-center">Yükleniyor...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-slate-400 py-2 text-center">Bu Kriterlerde Tedarikçi Bulunamadı.</p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {suggestions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${selectedVendorId === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{v.name}</span>
                <span className={`text-xs ${selectedVendorId === v.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {v.stats?.completedJobs ?? 0} iş
                  {v.stats?.availableCapacity != null && ` · K:${v.stats.availableCapacity}`}
                </span>
              </div>
              {v.stats?.avgAmount != null && (
                <p className={`text-xs mt-0.5 ${selectedVendorId === v.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  Ort. {v.stats.avgAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bütçe ───────────────────────────────────────────────────────────────
function ButceTab({ claimId, claimCity }: { claimId: string; claimCity?: string }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [costEntries, setCostEntries] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [expenseCategoryTree, setExpenseCategoryTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'versions' | 'costs'>('versions');
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [itemForm, setItemForm] = useState({ vendorId: '', category: 'labor', description: '', unit: 'adet', quantity: '1', unitPrice: '', vatRate: '18' });
  const [costForm, setCostForm] = useState({ vendorId: '', category: 'labor', expenseCategoryParentId: '', expenseCategoryId: '', description: '', amount: '', vatRate: '18', invoiceNo: '', entryDate: '' });
  const [saving, setSaving] = useState(false);
  const [itemManualVendor, setItemManualVendor] = useState(false);
  const [costManualVendor, setCostManualVendor] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);

  const CATEGORIES: Record<string, string> = { labor: 'İşçilik', material: 'Malzeme', subcontractor: 'Taşeron', logistics: 'Lojistik', equipment: 'Ekipman' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes, vndRes, ecRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/budget-versions`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/cost-entries`, { headers: authHeader() }),
        axios.get(`${API}/vendors?status=active&limit=100`, { headers: authHeader() }),
        axios.get(`${API}/expense-categories`, { headers: authHeader() }),
      ]);
      setVersions(vRes.data.data || []);
      setCostEntries(cRes.data.data || []);
      setVendors(vndRes.data.data || []);
      setExpenseCategoryTree(ecRes.data.data || []);
      if (!activeVersionId && vRes.data.data?.length) setActiveVersionId(vRes.data.data[0].id);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [claimId, activeVersionId]);

  useEffect(() => { load(); }, [load]);

  const handleCreateVersion = async () => {
    try {
      const lastVersionId = versions[0]?.id;
      await axios.post(`${API}/claim-files/${claimId}/budget-versions`, lastVersionId ? { copyFromVersionId: lastVersionId } : {}, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleSubmitVersion = async (id: string) => {
    try {
      await axios.post(`${API}/budget-versions/${id}/submit`, {}, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleReviewVersion = async (id: string, status: string) => {
    try {
      await axios.post(`${API}/budget-versions/${id}/review`, { status }, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleAddItem = async () => {
    if (!activeVersionId) return;
    setSaving(true);
    try {
      await axios.post(`${API}/budget-versions/${activeVersionId}/items`, {
        ...itemForm,
        quantity: parseFloat(itemForm.quantity),
        unitPrice: parseFloat(itemForm.unitPrice),
        vatRate: parseFloat(itemForm.vatRate),
        vendorId: itemForm.vendorId || undefined,
      }, { headers: authHeader() });
      setShowItemModal(false);
      setItemForm({ vendorId: '', category: 'labor', description: '', unit: 'adet', quantity: '1', unitPrice: '', vatRate: '18' });
      load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleAddCost = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/claim-files/${claimId}/cost-entries`, {
        ...costForm,
        amount: parseFloat(costForm.amount),
        vatRate: parseFloat(costForm.vatRate),
        vendorId: costForm.vendorId || undefined,
        expenseCategoryId: costForm.expenseCategoryId || undefined,
      }, { headers: authHeader() });
      setShowCostModal(false);
      setCostForm({ vendorId: '', category: 'labor', expenseCategoryParentId: '', expenseCategoryId: '', description: '', amount: '', vatRate: '18', invoiceNo: '', entryDate: '' });
      load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await axios.delete(`${API}/budget-items/${itemId}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleRemoveCost = async (id: string) => {
    try {
      await axios.delete(`${API}/cost-entries/${id}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;

  const versionStatusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    submitted: 'bg-blue-100 text-blue-700',
    revision: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const activeVersion = versions.find((v) => v.id === activeVersionId);
  const totalCosts = costEntries.reduce((s: number, c: any) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-slate-100 rounded-xl p-1 w-fit">
        {([['versions', 'Bütçe Versiyonları'], ['costs', 'Gerçekleşen Maliyetler']] as const).map(([id, label]) => (
          <button type="button" key={id} onClick={() => setSubTab(id)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${subTab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {subTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {versions.map((v) => (
                <button type="button" key={v.id} onClick={() => setActiveVersionId(v.id)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${activeVersionId === v.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  v{v.versionNo} <Badge text={v.status} color={versionStatusColor[v.status]} />
                </button>
              ))}
            </div>
            <button type="button" onClick={handleCreateVersion} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">+ Yeni Versiyon</button>
          </div>

          {activeVersion && (
            <SectionCard title={`Versiyon ${activeVersion.versionNo} – Toplam: ${fmtCurrency(activeVersion.totalAmount)}`}>
              <div className="flex gap-2 mb-4">
                {['draft', 'revision'].includes(activeVersion.status) && (
                  <>
                    <button type="button" onClick={() => setShowItemModal(true)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">+ Kalem Ekle</button>
                    <button type="button" onClick={() => handleSubmitVersion(activeVersion.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">Sigorta&apos;ya Sun</button>
                  </>
                )}
                {activeVersion.status === 'submitted' && (
                  <>
                    <button type="button" onClick={() => handleReviewVersion(activeVersion.id, 'approved')} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg">Onayla</button>
                    <button type="button" onClick={() => handleReviewVersion(activeVersion.id, 'rejected')} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg">Reddet</button>
                    <button type="button" onClick={() => handleReviewVersion(activeVersion.id, 'revision')} className="text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg">Revizyon İste</button>
                  </>
                )}
              </div>

              {!activeVersion.items?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 17h.01M15 17h.01M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Henüz Kalem Eklenmedi</p>
                  <p className="text-xs text-slate-400 mt-0.5">İlk kaleminizi ekleyin.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="text-left px-3 py-2">Açıklama</th>
                      <th className="text-left px-3 py-2">Kategori</th>
                      <th className="text-right px-3 py-2">Miktar</th>
                      <th className="text-right px-3 py-2">Birim Fiyat</th>
                      <th className="text-right px-3 py-2">KDV</th>
                      <th className="text-right px-3 py-2">Toplam</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeVersion.items.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-800">{item.description}</td>
                        <td className="px-3 py-2 text-slate-500">{CATEGORIES[item.category] ?? item.category}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">%{item.vatRate}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(item.totalAmount)}</td>
                        <td className="px-3 py-2">
                          {['draft', 'revision'].includes(activeVersion.status) && (
                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {subTab === 'costs' && (
        <SectionCard title={`Gerçekleşen Maliyetler – Toplam: ${fmtCurrency(totalCosts)}`}>
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
              />
              Kategoriye Göre Grupla
            </label>
            <button type="button" onClick={() => setShowCostModal(true)} className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">+ Maliyet Ekle</button>
          </div>
          {!costEntries.length ? (
            <p className="text-slate-400 text-sm">Maliyet Kaydı Bulunamadı.</p>
          ) : groupByCategory ? (
            (() => {
              // Kategoriye göre grupla
              type GroupMap = Record<string, { parentName: string; parentId: string; children: Record<string, { childName: string; entries: any[] }> }>;
              const groups: GroupMap = {};
              const noCategory: any[] = [];
              for (const c of costEntries) {
                if (!c.expenseCategory) {
                  noCategory.push(c);
                } else {
                  const parent = c.expenseCategory.parent ?? c.expenseCategory;
                  const child = c.expenseCategory.parent ? c.expenseCategory : null;
                  const pid = parent.id;
                  const cid = child?.id ?? '__direct__';
                  if (!groups[pid]) groups[pid] = { parentName: parent.name, parentId: pid, children: {} };
                  if (!groups[pid].children[cid]) groups[pid].children[cid] = { childName: child?.name ?? parent.name, entries: [] };
                  groups[pid].children[cid].entries.push(c);
                }
              }
              return (
                <div className="space-y-4">
                  {Object.values(groups).map((group) => {
                    const groupTotal = Object.values(group.children).flatMap(ch => ch.entries).reduce((s: number, e: any) => s + e.amount, 0);
                    return (
                      <div key={group.parentId} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between">
                          <span className="text-sm font-semibold text-orange-800">{group.parentName}</span>
                          <span className="text-sm font-bold text-orange-700">{fmtCurrency(groupTotal)}</span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-50">
                            {Object.values(group.children).map((ch) =>
                              ch.entries.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2 text-xs text-slate-400 w-36">{ch.childName}</td>
                                  <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                                  <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                                  <td className="px-3 py-2 text-slate-500">{c.invoiceNo ?? '—'}</td>
                                  <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                                  <td className="px-3 py-2">
                                    <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  {noCategory.length > 0 && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Kategorisiz</span>
                        <span className="text-sm font-bold text-slate-500">{fmtCurrency(noCategory.reduce((s: number, e: any) => s + e.amount, 0))}</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {noCategory.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-xs text-slate-400 w-36">{CATEGORIES[c.category] ?? c.category}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                              <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                              <td className="px-3 py-2 text-slate-500">{c.invoiceNo ?? '—'}</td>
                              <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                              <td className="px-3 py-2">
                                <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-700">Genel Toplam: {fmtCurrency(totalCosts)}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="text-left px-3 py-2">Açıklama</th>
                  <th className="text-left px-3 py-2">Kategori</th>
                  <th className="text-left px-3 py-2">Tedarikçi</th>
                  <th className="text-right px-3 py-2">Tutar</th>
                  <th className="text-left px-3 py-2">Fatura</th>
                  <th className="text-left px-3 py-2">Tarih</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {costEntries.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-800">{c.description}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {c.expenseCategory
                        ? (c.expenseCategory.parent ? `${c.expenseCategory.parent.name} › ${c.expenseCategory.name}` : c.expenseCategory.name)
                        : (CATEGORIES[c.category] ?? c.category)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{c.vendor?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtCurrency(c.amount)}</td>
                    <td className="px-3 py-2 text-slate-500">{c.invoiceNo ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtDate(c.entryDate)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => handleRemoveCost(c.id)} className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      )}

      {/* Kalem Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Bütçe Kalemi Ekle</h3>
            <div className="space-y-3">
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.category} onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input placeholder="Açıklama" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.description} onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setItemForm((p) => ({ ...p, description: v })); }} />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Miktar" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.quantity} onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))} />
                <input placeholder="Birim (Adet, m², vb.)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))} />
                <input placeholder="Birim Fiyat (₺)" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.unitPrice} onChange={(e) => setItemForm((p) => ({ ...p, unitPrice: e.target.value }))} />
                <input placeholder="KDV %" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.vatRate} onChange={(e) => setItemForm((p) => ({ ...p, vatRate: e.target.value }))} />
              </div>
              {itemManualVendor ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500">Tedarikçi (Manuel)</label>
                    <button type="button" onClick={() => setItemManualVendor(false)} className="text-xs text-indigo-600 hover:underline">Önerilerden Seç</button>
                  </div>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={itemForm.vendorId} onChange={(e) => setItemForm((p) => ({ ...p, vendorId: e.target.value }))}>
                    <option value="">Tedarikçi Seçin (Opsiyonel)</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ) : (
                <VendorSuggestPanel
                  city={claimCity}
                  category={itemForm.category}
                  selectedVendorId={itemForm.vendorId}
                  onSelect={(vid) => setItemForm((p) => ({ ...p, vendorId: vid }))}
                  onManual={() => setItemManualVendor(true)}
                />
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleAddItem} disabled={saving || !itemForm.description || !itemForm.unitPrice} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Ekle'}
              </button>
              <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Maliyet Modal */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Gerçekleşen Maliyet Ekle</h3>
            <div className="space-y-3">
              {/* 2-level category picker */}
              {expenseCategoryTree.length > 0 ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ana Kategori</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      value={costForm.expenseCategoryParentId}
                      onChange={(e) => setCostForm((p) => ({ ...p, expenseCategoryParentId: e.target.value, expenseCategoryId: '' }))}
                    >
                      <option value="">— Seçiniz —</option>
                      {expenseCategoryTree.map((cat: any) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  {costForm.expenseCategoryParentId && (() => {
                    const parent = expenseCategoryTree.find((c: any) => c.id === costForm.expenseCategoryParentId);
                    const children: any[] = parent?.children ?? [];
                    if (children.length === 0) return null;
                    return (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Alt Kategori</label>
                        <select
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                          value={costForm.expenseCategoryId}
                          onChange={(e) => setCostForm((p) => ({ ...p, expenseCategoryId: e.target.value }))}
                        >
                          <option value="">— Seçiniz —</option>
                          {children.map((ch: any) => (
                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.category} onChange={(e) => setCostForm((p) => ({ ...p, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              <div className="relative flex items-center gap-1">
                <input placeholder="Açıklama" className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-12 text-sm" value={costForm.description} onChange={(e) => setCostForm((p) => ({ ...p, description: e.target.value }))} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setCostForm((p) => ({ ...p, description: v })); }} />
                <div className="absolute right-1.5">
                  <SpeechToText
                    size="sm"
                    onTranscript={(text) => setCostForm((p) => ({ ...p, description: p.description ? p.description + ' ' + text : text }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Tutar (₺)" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.amount} onChange={(e) => setCostForm((p) => ({ ...p, amount: e.target.value }))} />
                <input placeholder="KDV %" type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.vatRate} onChange={(e) => setCostForm((p) => ({ ...p, vatRate: e.target.value }))} />
                <input placeholder="Fatura No" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.invoiceNo} onChange={(e) => setCostForm((p) => ({ ...p, invoiceNo: e.target.value }))} />
                <TrDateInput className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full" value={costForm.entryDate} onChange={(entryDate) => setCostForm((p) => ({ ...p, entryDate }))} />
              </div>
              {costManualVendor ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-500">Tedarikçi (Manuel)</label>
                    <button type="button" onClick={() => setCostManualVendor(false)} className="text-xs text-indigo-600 hover:underline">Önerilerden Seç</button>
                  </div>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={costForm.vendorId} onChange={(e) => setCostForm((p) => ({ ...p, vendorId: e.target.value }))}>
                    <option value="">Tedarikçi Seçin (Opsiyonel)</option>
                    {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ) : (
                <VendorSuggestPanel
                  city={claimCity}
                  category={costForm.category}
                  selectedVendorId={costForm.vendorId}
                  onSelect={(vid) => setCostForm((p) => ({ ...p, vendorId: vid }))}
                  onManual={() => setCostManualVendor(true)}
                />
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={handleAddCost} disabled={saving || !costForm.description || !costForm.amount || !costForm.entryDate} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Ekle'}
              </button>
              <button type="button" onClick={() => setShowCostModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Onarım Raporu ───────────────────────────────────────────────────────
const DAMAGE_CODES = [
  'Dahili Su', 'Yangın', 'Deprem', 'Sel-Seylap', 'Fırtına',
  'Heyelan', 'İnfilak', 'Taşıt Çarpması', 'Gemi-Tekne', 'İnşaat', 'Cam Kırılması',
];

type WizardStep = 'department' | 'type' | 'config';

type DeptOption = { id: string; code: string; name: string; color: string; reportFormat: string };

function YeniRaporWizard({
  claimId,
  onCreated,
  onClose,
}: {
  claimId: string;
  onCreated: (reportId: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('department');
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [selectedDept, setSelectedDept] = useState<DeptOption | null>(null);
  const [reportType, setReportType] = useState<'single' | 'multi' | 'emergency' | null>(null);
  // single
  const [singleDamageCode, setSingleDamageCode] = useState('');
  // multi
  const [multiDamageCodes, setMultiDamageCodes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => setDepartments(r.data.data ?? []))
      .catch(console.error);
  }, []);

  const toggleMultiCode = (code: string) => {
    setMultiDamageCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleDeptSelect = (dept: DeptOption) => {
    setSelectedDept(dept);
    setReportType(null);
    setSingleDamageCode('');
    setMultiDamageCodes([]);
  };

  const proceedFromDept = () => {
    if (!selectedDept) return;
    if (selectedDept.reportFormat === 'emergency') {
      setReportType('emergency');
      setStep('config');
    } else {
      setStep('type');
    }
  };

  const canProceed = () => {
    if (step === 'department') return selectedDept !== null;
    if (step === 'type') return reportType !== null;
    if (reportType === 'emergency') return true;
    if (reportType === 'single') return singleDamageCode !== '';
    if (reportType === 'multi') return multiDamageCodes.length >= 2;
    return false;
  };

  const handleCreate = async () => {
    if (!reportType || !selectedDept) return;
    setCreating(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/claim-files/${claimId}/repair-reports`,
        {
          reportType,
          reportDate: new Date().toISOString(),
          departmentId: selectedDept.id,
        },
        { headers: authHeader() },
      );
      const created = res.data.data;
      if (!created?.id) throw new Error('Rapor oluşturulamadı');

      // Add damage types for repair reports
      if (reportType === 'single' && singleDamageCode) {
        await axios.post(
          `${API}/repair-reports/${created.id}/damage-types`,
          { damageTypeCode: singleDamageCode, damageTypeName: singleDamageCode, sortOrder: 0 },
          { headers: authHeader() },
        );
      } else if (reportType === 'multi') {
        await Promise.all(
          multiDamageCodes.map((code, idx) =>
            axios.post(
              `${API}/repair-reports/${created.id}/damage-types`,
              { damageTypeCode: code, damageTypeName: code, sortOrder: idx },
              { headers: authHeader() },
            ),
          ),
        );
      }
      onCreated(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Hata oluştu');
    } finally { setCreating(false); }
  };

  /* ── Adım 0: Departman Seçimi ── */
  if (step === 'department') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Adım 1</span>
            <h3 className="text-base font-semibold text-slate-800">Departman Seçin</h3>
          </div>
          <p className="text-sm text-slate-500 mb-5">Hangi Departman için Rapor Oluşturuyorsunuz?</p>

          {departments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <p>Henüz Departman Tanımlanmamış.</p>
              <a href="/panel/ayarlar/departmanlar" className="text-blue-600 hover:underline mt-1 block">Departman Oluşturmak için Tıklayın</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {departments.filter((d) => d.reportFormat === 'repair').map((d) => (
                <button type="button"
                  key={d.id}
                  onClick={() => handleDeptSelect(d)}
                  className={`border-2 rounded-xl p-4 text-left transition-all ${
                    selectedDept?.id === d.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg mb-2.5 flex items-center justify-center text-white text-xs font-bold" style={{ background: d.color }}>
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Hasar Onarım Raporu</p>
                </button>
              ))}
              {departments.filter((d) => d.reportFormat === 'emergency').map((d) => (
                <button type="button"
                  key={d.id}
                  onClick={() => handleDeptSelect(d)}
                  className={`border-2 rounded-xl p-4 text-left transition-all ${
                    selectedDept?.id === d.id
                      ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                      : 'border-slate-200 hover:border-red-300 hover:bg-red-50/40'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg mb-2.5 flex items-center justify-center text-white text-xs font-bold" style={{ background: d.color }}>
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Acil Yardım Raporu</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button type="button"
              onClick={proceedFromDept}
              disabled={!selectedDept}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Devam →
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Adım 2: Tür Seçimi (sadece Hasar Onarım için) ── */
  if (step === 'type') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Adım 2/3</span>
            <h3 className="text-base font-semibold text-slate-800">Rapor Türü Seçin</h3>
            <button type="button" onClick={() => setStep('department')} className="ml-auto text-xs text-slate-400 hover:text-slate-600">← Geri</button>
          </div>
          <p className="text-sm text-slate-500 mb-5">Hasar Dosyasının Yapısına Uygun Türü Seçin.</p>

          <div className="grid grid-cols-2 gap-4">
            <button type="button"
              onClick={() => setReportType('single')}
              className={`border-2 rounded-xl p-5 text-left transition-all ${
                reportType === 'single'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm mb-3">TH</div>
              <p className="font-semibold text-slate-800 text-sm mb-1">Tek Hasarlı</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Tek Hasar Nedeni</li>
                <li>• Basit, Hızlı Giriş</li>
                <li>• Doğrudan İş Kalemleri</li>
              </ul>
            </button>

            <button type="button"
              onClick={() => setReportType('multi')}
              className={`border-2 rounded-xl p-5 text-left transition-all ${
                reportType === 'multi'
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm mb-3">ÇH</div>
              <p className="font-semibold text-slate-800 text-sm mb-1">Çok Hasarlı</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• 2+ Hasar Nedeni</li>
                <li>• Kalem Bazlı Hasar Atama</li>
                <li>• Neden Bazlı Özet Tablo</li>
              </ul>
            </button>
          </div>

          <div className="flex gap-2 mt-5">
            <button type="button"
              onClick={() => { if (reportType) setStep('config'); }}
              disabled={!reportType}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Devam →
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Adım 3: Yapılandırma ── */
  const isEmergency = reportType === 'emergency';
  const stepLabel = isEmergency ? 'Adım 2/2' : 'Adım 3/3';
  const stepTitle = isEmergency ? 'Acil Yardım Raporu Bilgileri' : (reportType === 'single' ? 'Hasar Nedeni & Bilgiler' : 'Hasar Nedenleri Seçin');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{stepLabel}</span>
          <h3 className="text-base font-semibold text-slate-800">{stepTitle}</h3>
          <button type="button" onClick={() => isEmergency ? setStep('department') : setStep('type')} className="ml-auto text-xs text-slate-400 hover:text-slate-600">← Geri</button>
        </div>

        {isEmergency ? (
          /* ── ACİL YARDIM config ── */
          <div className="space-y-4 mt-4">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
              Acil Yardım Raporu — Hızlı Giriş Formatı
            </div>
            <p className="text-xs text-slate-500">Eksper ofisi ve raporlayan bilgileri otomatik atanacak.</p>
          </div>
        ) : reportType === 'single' ? (
          /* ── TEK HASARLI config ── */
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-2">Hasar Nedeni *</label>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_CODES.map((code) => (
                  <button type="button"
                    key={code}
                    onClick={() => setSingleDamageCode(code)}
                    className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                      singleDamageCode === code
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── ÇOK HASARLI config ── */
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Hasar Nedenlerini Seçin{' '}
                <span className="text-slate-400 font-normal">(En Az 2 Seçin)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DAMAGE_CODES.map((code) => {
                  const selected = multiDamageCodes.includes(code);
                  return (
                    <button type="button"
                      key={code}
                      onClick={() => toggleMultiCode(code)}
                      className={`text-left px-3 py-2 rounded-lg text-xs border flex items-center gap-2 transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-xs ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                        {selected ? '✓' : ''}
                      </span>
                      {code}
                    </button>
                  );
                })}
              </div>
              {multiDamageCodes.length > 0 && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  {multiDamageCodes.length} hasar nedeni seçildi: {multiDamageCodes.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button type="button"
            onClick={handleCreate}
            disabled={creating || !canProceed()}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Oluşturuluyor...' : 'Raporu Oluştur'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

function OnarimRaporuTab({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-files/${claimId}/repair-reports`, { headers: authHeader() });
      setReports(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (reportId: string) => {
    setShowWizard(false);
    router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${reportId}`);
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button"
          onClick={() => setShowWizard(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Yeni Rapor Oluştur
        </button>
      </div>

      {!reports.length ? (
        <div className="text-slate-400 py-8 text-center bg-white rounded-xl border border-slate-100">
          Henüz Onarım Raporu Oluşturulmamış.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${r.reportType === 'multi' ? 'bg-indigo-50 text-indigo-600' : r.reportType === 'emergency' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  {r.reportType === 'multi' ? 'ÇH' : r.reportType === 'emergency' ? 'AY' : 'TH'}
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{r.reportNo}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.reportType === 'single' ? 'Tek Hasarlı' : r.reportType === 'multi' ? 'Çok Hasarlı' : 'Acil Yardım'}
                    {' · '}
                    {new Date(r.reportDate ?? r.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {r._count && ` · ${r._count.items} kalem · ${r._count.images} fotoğraf`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge text={r.status === 'draft' ? 'Taslak' : r.status === 'submitted' ? 'Sunuldu' : 'Onaylı'} color={statusColor[r.status] ?? 'bg-slate-100 text-slate-600'} />
                <button type="button"
                  onClick={() => router.push(`/panel/hasar-dosyalari/${claimId}/onarim-raporu/${r.id}`)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  Aç
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showWizard && (
        <YeniRaporWizard claimId={claimId} onCreated={handleCreated} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}

// ─── Tab: Faturalar ────────────────────────────────────────────────────────────
const INVOICE_TYPE_LABEL: Record<string, string> = { sales: 'Satış', purchase: 'Alış' };
const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', partial: 'Kısmi', cancelled: 'İptal', overdue: 'Vadesi Geçti',
};
const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700', overdue: 'bg-red-200 text-red-800',
};

function FaturalarTab({ claimId }: { claimId: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ invoiceType: 'sales', counterpartyType: 'insurance_company', currency: 'TRY', subtotalAmount: 0, vatAmount: 0, withholdingAmount: 0, totalAmount: 0, invoiceDate: new Date().toISOString().substring(0, 10) });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/claim-files/${claimId}/invoices`, { headers: authHeader() })
      .then((r) => setInvoices(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/invoices`, { ...form, claimFileId: claimId }, { headers: authHeader() });
      setShowForm(false);
      setForm({ invoiceType: 'sales', counterpartyType: 'insurance_company', currency: 'TRY', subtotalAmount: 0, vatAmount: 0, withholdingAmount: 0, totalAmount: 0, invoiceDate: new Date().toISOString().substring(0, 10) });
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await axios.patch(`${API}/invoices/${id}/status`, { status }, { headers: authHeader() });
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Hata'); }
  };

  if (loading) return <div className="py-12 text-center text-slate-400">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Faturalar</h3>
        <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">+ Yeni Fatura</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="font-medium text-slate-800 text-sm">Yeni Fatura</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fatura Tipi</label>
              <select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="sales">Satış (Gelir)</option>
                <option value="purchase">Alış (Gider)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fatura Tarihi</label>
              <TrDateInput value={form.invoiceDate} onChange={(invoiceDate) => setForm({ ...form, invoiceDate })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Vade Tarihi</label>
              <TrDateInput value={form.dueDate ?? ''} onChange={(dueDate) => setForm({ ...form, dueDate })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Karşı Taraf Tipi</label>
              <select value={form.counterpartyType} onChange={(e) => setForm({ ...form, counterpartyType: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="insurance_company">Sigorta Şirketi</option>
                <option value="vendor">Tedarikçi</option>
                <option value="customer">Müşteri</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ara Toplam (TRY)</label>
              <input type="number" value={form.subtotalAmount} onChange={(e) => setForm({ ...form, subtotalAmount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">KDV Tutarı (TRY)</label>
              <input type="number" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stopaj Tutarı (TRY)</label>
              <input type="number" value={form.withholdingAmount} onChange={(e) => setForm({ ...form, withholdingAmount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Toplam Tutar (TRY)</label>
              <input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Notlar</label>
              <input type="text" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({ ...form, notes: v }); }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">Henüz Fatura Eklenmemiş</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Fatura No</th>
                <th className="text-left px-4 py-3">Tip</th>
                <th className="text-left px-4 py-3">Tarih</th>
                <th className="text-left px-4 py-3">Vade</th>
                <th className="text-right px-4 py-3">Tutar</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-left px-4 py-3">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{inv.invoiceNo}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.invoiceType === 'sales' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{INVOICE_TYPE_LABEL[inv.invoiceType] ?? inv.invoiceType}</span></td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.dueDate ? fmtDate(inv.dueDate) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLOR[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</span></td>
                  <td className="px-4 py-3">
                    {inv.status === 'draft' && <button type="button" onClick={() => handleStatusChange(inv.id, 'sent')} className="text-xs text-blue-600 hover:underline mr-2">Gönder</button>}
                    {inv.status === 'sent' && <button type="button" onClick={() => handleStatusChange(inv.id, 'paid')} className="text-xs text-green-600 hover:underline mr-2">Ödendi</button>}
                    {!['cancelled', 'paid'].includes(inv.status) && <button type="button" onClick={() => handleStatusChange(inv.id, 'cancelled')} className="text-xs text-red-500 hover:underline">İptal</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tahsilatlar ──────────────────────────────────────────────────────────
const PAYMENT_TYPE_LABEL: Record<string, string> = { incoming: 'Gelen', outgoing: 'Giden' };
const PAYMENT_METHOD_LABEL: Record<string, string> = { eft: 'EFT', havale: 'Havale', credit_card: 'Kredi Kartı', cash: 'Nakit', offset: 'Mahsuplaşma' };

function TahsilatlarTab({ claimId }: { claimId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({
    paymentType: 'incoming',
    method: 'eft',
    payerType: 'insurance_company',
    payerId: '',
    amount: 0,
    currency: 'TRY',
    paymentDate: new Date().toISOString().substring(0, 10),
    status: 'completed',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/claim-files/${claimId}/payments`, { headers: authHeader() }),
      axios.get(`${API}/claim-files/${claimId}/invoices`, { headers: authHeader() }),
      axios.get(`${API}/vendors?limit=200&status=active`, { headers: authHeader() }),
    ]).then(([pr, ir, vr]) => {
      setPayments(pr.data.data ?? []);
      setInvoices(ir.data.data ?? []);
      setVendors(vr.data.data?.vendors ?? vr.data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const uploadReceiptForPayment = async (paymentId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    await axios.post(`${API}/payments/${paymentId}/receipt`, fd, {
      headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleSave = async () => {
    if (form.paymentType === 'outgoing' && form.payerType === 'vendor' && !form.payerId) {
      alert('Tedarikçi ödemesi için tedarikçi seçiniz');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, claimFileId: claimId };
      if (payload.payerType !== 'vendor') delete payload.payerId;
      const res = await axios.post(`${API}/payments`, payload, { headers: authHeader() });
      const paymentId = res.data?.data?.id;
      if (paymentId && receiptFile && form.paymentType === 'outgoing' && form.payerType === 'vendor') {
        await uploadReceiptForPayment(paymentId, receiptFile);
      }
      setShowForm(false);
      setReceiptFile(null);
      setForm({
        paymentType: 'incoming',
        method: 'eft',
        payerType: 'insurance_company',
        payerId: '',
        amount: 0,
        currency: 'TRY',
        paymentDate: new Date().toISOString().substring(0, 10),
        status: 'completed',
      });
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleReceiptUploadExisting = async (paymentId: string, file: File) => {
    setUploadingReceiptId(paymentId);
    try {
      await uploadReceiptForPayment(paymentId, file);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Dekont yüklenemedi');
    } finally {
      setUploadingReceiptId(null);
    }
  };

  const openReceipt = async (paymentId: string) => {
    try {
      const res = await axios.get(`${API}/payments/${paymentId}/receipt/download`, { headers: authHeader() });
      const url = res.data?.data?.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Dekont açılamadı');
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <OnlineCollectionLinksPanel claimFileId={claimId} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Tahsilatlar & Ödemeler</h3>
        <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">+ Yeni Ödeme</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h4 className="font-medium text-slate-800 text-sm">Yeni Ödeme Kaydı</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ödeme Yönü</label>
              <select value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="incoming">Gelen (Tahsilat)</option>
                <option value="outgoing">Giden (Ödeme)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ödeme Tarihi</label>
              <TrDateInput value={form.paymentDate} onChange={(paymentDate) => setForm({ ...form, paymentDate })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tutar (TRY)</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ödeme Yöntemi</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="eft">EFT</option>
                <option value="havale">Havale</option>
                <option value="credit_card">Kredi Kartı</option>
                <option value="cash">Nakit</option>
                <option value="offset">Mahsuplaşma</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Karşı Taraf Tipi</label>
              <select value={form.payerType} onChange={(e) => setForm({ ...form, payerType: e.target.value, payerId: '' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="insurance_company">Sigorta Şirketi</option>
                <option value="vendor">Tedarikçi</option>
                <option value="customer">Müşteri</option>
              </select>
            </div>
            {form.paymentType === 'outgoing' && form.payerType === 'vendor' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tedarikçi *</label>
                <select value={form.payerId ?? ''} onChange={(e) => setForm({ ...form, payerId: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Tedarikçi Seçin —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bağlı Fatura (opsiyonel)</label>
              <select value={form.invoiceId ?? ''} onChange={(e) => setForm({ ...form, invoiceId: e.target.value || undefined })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— Seçiniz —</option>
                {invoices.filter((i) => !['cancelled', 'paid'].includes(i.status)).map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNo} ({fmtCurrency(inv.totalAmount)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referans No</label>
              <input type="text" value={form.referenceNo ?? ''} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Not</label>
              <input type="text" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({ ...form, note: v }); }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            {form.paymentType === 'outgoing' && form.payerType === 'vendor' && (
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Ödeme Dekontu</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium"
                />
                <p className="text-xs text-slate-400 mt-1">Dekont yüklendiğinde tedarikçinin Ödemeler / Ekstre sayfasına otomatik yansır.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">Henüz Ödeme Kaydı Eklenmemiş</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Tarih</th>
                <th className="text-left px-4 py-3">Yön</th>
                <th className="text-left px-4 py-3">Yöntem</th>
                <th className="text-left px-4 py-3">Bağlı Fatura</th>
                <th className="text-right px-4 py-3">Tutar</th>
                <th className="text-left px-4 py-3">Ref No</th>
                <th className="text-left px-4 py-3">Dekont</th>
                <th className="text-left px-4 py-3">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{fmtDate(p.paymentDate)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.paymentType === 'incoming' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{PAYMENT_TYPE_LABEL[p.paymentType] ?? p.paymentType}</span></td>
                  <td className="px-4 py-3 text-slate-600">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.invoice?.invoiceNo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.referenceNo ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {p.paymentType === 'outgoing' && p.payerType === 'vendor' ? (
                      p.receiptStorageKey ? (
                        <button type="button" onClick={() => openReceipt(p.id)} className="text-indigo-600 hover:underline">
                          {p.receiptFileName ?? 'Dekont'}
                        </button>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploadingReceiptId === p.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReceiptUploadExisting(p.id, f);
                              e.target.value = '';
                            }}
                          />
                          {uploadingReceiptId === p.id ? 'Yükleniyor...' : '+ Dekont yükle'}
                        </label>
                      )
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[120px]">{p.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Randevular ──────────────────────────────────────────────────────────

const APPOINTMENT_TYPE_LABEL: Record<string, string> = {
  customer_visit: 'Sigortalı Ziyareti',
  inspection: 'Keşif',
  site_visit: 'Saha Ziyareti',
  meeting: 'Toplantı',
  other: 'Diğer',
};

const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  planned: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  planned: 'Planlandı',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

function RandevularTab({ claimId, claim }: { claimId: string; claim: any }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: 'customer_visit',
    scheduledAt: '',
    scheduledEnd: '',
    location: '',
    notes: '',
    assignedUserId: '',
    vendorId: '',
  });
  const [notifLoading, setNotifLoading] = useState<string | null>(null);

  const loadAppointments = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/adjusters/appointments/claim/${claimId}`, { headers: authHeader() })
      .then((r) => setAppointments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  useEffect(() => {
    if (!showForm) return;
    // Tedarikçi önerisi
    const city = claim?.propertyAddress?.city;
    if (city) {
      axios.get(`${API}/vendors/suggest?city=${encodeURIComponent(city)}`, { headers: authHeader() })
        .then((r) => setVendors(r.data.data || []))
        .catch(() => setVendors([]));
    }
    // Kullanıcı listesi
    axios.get(`${API}/users?limit=100`, { headers: authHeader() })
      .then((r) => setUsers(r.data.data || []))
      .catch(() => setUsers([]));
  }, [showForm, claim]);

  const handleSave = async () => {
    if (!form.scheduledAt) return alert('Lütfen randevu tarih/saatini giriniz.');
    setSaving(true);
    try {
      await axios.post(`${API}/adjusters/appointments`, {
        claimFileId: claimId,
        ...form,
        assignedUserId: form.assignedUserId || undefined,
        vendorId: form.vendorId || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
      }, { headers: authHeader() });
      setShowForm(false);
      setForm({ type: 'customer_visit', scheduledAt: '', scheduledEnd: '', location: '', notes: '', assignedUserId: '', vendorId: '' });
      loadAppointments();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (apptId: string, status: string) => {
    try {
      await axios.patch(`${API}/adjusters/appointments/${apptId}/status`, { status }, { headers: authHeader() });
      loadAppointments();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Durum güncellenemedi');
    }
  };

  const handleSendNotification = async (apptId: string, channel: 'sms' | 'whatsapp') => {
    setNotifLoading(`${apptId}-${channel}`);
    try {
      const r = await axios.post(`${API}/adjusters/appointments/${apptId}/send-notification`, { channel }, { headers: authHeader() });
      if (channel === 'whatsapp' && r.data.data?.waUrl) {
        window.open(r.data.data.waUrl, '_blank');
      } else {
        alert('SMS bildirimleri gönderildi.');
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Bildirim gönderilemedi');
    } finally {
      setNotifLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Randevular</h3>
        <button type="button" onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {showForm ? 'İptal' : '+ Randevu Ekle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-700">Yeni Randevu</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Randevu Tipi</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {Object.entries(APPOINTMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Başlangıç Tarih/Saat</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bitiş Tarih/Saat (opsiyonel)</label>
              <input type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sorumlu Personel</label>
              <select value={form.assignedUserId} onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— Seçiniz —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tedarikçi (opsiyonel)</label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— Seçiniz —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} {v.stats?.activeJobs != null ? `(${v.stats.activeJobs} aktif iş)` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Konum</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Adres veya Konum" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Notlar</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({ ...form, notes: v }); }} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">Henüz Randevu Eklenmemiş</div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-slate-800">{APPOINTMENT_TYPE_LABEL[appt.type] ?? appt.type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APPOINTMENT_STATUS_COLOR[appt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}
                    </span>
                    {appt.notifiedAt && <span className="text-xs text-slate-400">Bildirim: {new Date(appt.notifiedAt).toLocaleDateString('tr-TR')}</span>}
                  </div>
                  <p className="text-sm text-slate-600">
                    {new Date(appt.scheduledAt).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {appt.scheduledEnd && ` — ${new Date(appt.scheduledEnd).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {appt.location && <p className="text-xs text-slate-400 mt-0.5">Konum: {appt.location}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                    {appt.assignedUser && <span>Sorumlu: {appt.assignedUser.firstName} {appt.assignedUser.lastName}</span>}
                    {appt.vendor && <span>Tedarikçi: {appt.vendor.name}</span>}
                    {appt.adjuster && <span>Eksper: {appt.adjuster.name}</span>}
                  </div>
                  {appt.notes && <p className="text-xs text-slate-400 mt-1 italic">{appt.notes}</p>}
                  {/* Check-in / Check-out bilgisi */}
                  {appt.checkedInAt && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="text-green-600 font-medium">
                        Check-in: {new Date(appt.checkedInAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {appt.checkedInLatitude && appt.checkedInLongitude && (
                        <a
                          href={`https://www.google.com/maps?q=${appt.checkedInLatitude},${appt.checkedInLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 underline"
                        >
                          Haritada Gör
                        </a>
                      )}
                      {appt.checkedOutAt && (
                        <>
                          <span className="text-red-500 font-medium">
                            Check-out: {new Date(appt.checkedOutAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>
                            Süre: {Math.round((new Date(appt.checkedOutAt).getTime() - new Date(appt.checkedInAt).getTime()) / 60_000)} dk
                          </span>
                        </>
                      )}
                      {!appt.checkedOutAt && (
                        <span className="text-orange-500 font-medium">Sahada (Devam Ediyor)</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  {/* Durum geçişi */}
                  {appt.status === 'planned' && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'confirmed')} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Onayla</button>
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'cancelled')} className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">İptal</button>
                    </div>
                  )}
                  {appt.status === 'confirmed' && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'completed')} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Tamamlandı</button>
                      <button type="button" onClick={() => handleStatusChange(appt.id, 'cancelled')} className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">İptal</button>
                    </div>
                  )}
                  {/* Bildirim butonları — confirmed randevularda aktif */}
                  <div className="flex gap-1">
                    <button type="button"
                      onClick={() => handleSendNotification(appt.id, 'sms')}
                      disabled={appt.status !== 'confirmed' || notifLoading === `${appt.id}-sms`}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={appt.status !== 'confirmed' ? 'Yalnızca onaylanmış randevular için aktif' : 'SMS Gönder'}
                    >
                      {notifLoading === `${appt.id}-sms` ? '...' : 'SMS'}
                    </button>
                    <button type="button"
                      onClick={() => handleSendNotification(appt.id, 'whatsapp')}
                      disabled={appt.status !== 'confirmed' || notifLoading === `${appt.id}-whatsapp`}
                      className="px-2.5 py-1 text-xs border border-green-200 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={appt.status !== 'confirmed' ? 'Yalnızca onaylanmış randevular için aktif' : 'WhatsApp Gönder'}
                    >
                      {notifLoading === `${appt.id}-whatsapp` ? '...' : 'WhatsApp'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Finansal Özet ────────────────────────────────────────────────────────
function FinansalOzetTab({ claimId }: { claimId: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    axios.get(`${API}/claim-files/${claimId}/financial-summary`, { headers: authHeader() })
      .then((r) => setSummary(r.data.data))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 403) setRestricted(true);
      })
      .finally(() => setLoading(false));
  }, [claimId]);

  if (loading) return <div className="py-12 text-center text-slate-400">Yükleniyor...</div>;

  if (restricted) return (
    <div className="bg-white rounded-xl border border-amber-100 py-12 text-center text-sm text-amber-800 px-6">
      Bu dosyada finansal özet görüntüleme yetkiniz yok. Yönetici kısıtlaması aktif olabilir.
    </div>
  );

  if (!summary) return (
    <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
      Finansal Özet Hesaplanmamış. Fatura veya Ödeme Ekleyince Otomatik Oluşur.
    </div>
  );

  const isProfit = summary.grossProfit >= 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Fiili Gelir</p>
          <p className="text-xl font-bold text-slate-800">{fmtCurrency(summary.actualRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">Tahmini: {fmtCurrency(summary.estimatedRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Fiili Gider</p>
          <p className="text-xl font-bold text-slate-800">{fmtCurrency(summary.actualCost)}</p>
          <p className="text-xs text-slate-400 mt-1">Tahmini: {fmtCurrency(summary.estimatedCost)}</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-slate-500 mb-1">Brüt Kâr</p>
          <p className={`text-xl font-bold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>{fmtCurrency(summary.grossProfit)}</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-slate-500 mb-1">Kâr Marjı</p>
          <p className={`text-xl font-bold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>{summary.grossMarginPct.toFixed(1)}%</p>
        </div>
      </div>
      <p className="text-xs text-slate-400">Son hesaplama: {fmtDate(summary.lastCalculatedAt)}</p>
    </div>
  );
}

// ─── Faz 3: P&L — Gelir Listesi ──────────────────────────────────────────────
function GelirlerTab({ claimId }: { claimId: string }) {
  const [revenues, setRevenues] = useState<any[]>([]);
  const [extraWorks, setExtraWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    revenueType: 'file_fee',
    collectionSource: 'insurance_company',
    description: '',
    amount: '',
    vatRate: '0',
    entryDate: new Date().toISOString().split('T')[0],
    extraWorkItemId: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, ewRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimId}/revenues`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/extra-works`, { headers: authHeader() }),
      ]);
      setRevenues(revRes.data.data ?? revRes.data ?? []);
      setExtraWorks(ewRes.data.data ?? ewRes.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.amount || !form.entryDate) return;
    if (form.revenueType === 'extra_work' && !form.extraWorkItemId) {
      alert('Ekstra iş tipi için ekstra iş seçilmesi zorunludur');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/revenues`,
        {
          revenueType: form.revenueType,
          collectionSource: form.collectionSource,
          description: form.description || undefined,
          amount: parseFloat(form.amount),
          vatRate: parseFloat(form.vatRate),
          entryDate: form.entryDate,
          extraWorkItemId: form.revenueType === 'extra_work' ? form.extraWorkItemId : undefined,
        },
        { headers: authHeader() },
      );
      setShowForm(false);
      setForm({ revenueType: 'file_fee', collectionSource: 'insurance_company', description: '', amount: '', vatRate: '0', entryDate: new Date().toISOString().split('T')[0], extraWorkItemId: '' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Gelir kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = (s: string) => s === 'insurance_company' ? 'Sigorta Şirketi' : 'Sigortalı';
  const typeLabel = (t: string) => t === 'file_fee' ? 'Dosya Bedeli' : 'Ekstra İş';
  const statusColor = (s: string) => ({
    draft: 'bg-slate-100 text-slate-600',
    confirmed: 'bg-blue-100 text-blue-700',
    collected: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-slate-100 text-slate-600');

  const totalRevenue = revenues.filter(r => r.status !== 'cancelled').reduce((s: number, r: any) => s + r.totalAmount, 0);
  const totalCollected = revenues.reduce((s: number, r: any) => s + (r.collectedAmount ?? 0), 0);

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  return (
    <SectionCard title="Gelir Kayıtları">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">Toplam Gelir: <strong className="text-slate-800">{fmtCurrency(totalRevenue)}</strong></span>
          <span className="text-slate-500">Tahsilat: <strong className="text-green-700">{fmtCurrency(totalCollected)}</strong></span>
          <span className="text-slate-500">Bakiye: <strong className="text-orange-600">{fmtCurrency(totalRevenue - totalCollected)}</strong></span>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
          + Gelir Ekle
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Gelir Tipi</label>
              <select value={form.revenueType} onChange={e => setForm({...form, revenueType: e.target.value, extraWorkItemId: ''})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                <option value="file_fee">Dosya Bedeli</option>
                <option value="extra_work">Ekstra İş</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tahsilat Kaynağı</label>
              <select value={form.collectionSource} onChange={e => setForm({...form, collectionSource: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                <option value="insurance_company">Sigorta Şirketi</option>
                <option value="insured">Sigortalı</option>
              </select>
            </div>
            {form.revenueType === 'extra_work' && (
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Ekstra İş <span className="text-red-500">*</span></label>
                <select value={form.extraWorkItemId} onChange={e => setForm({...form, extraWorkItemId: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2">
                  <option value="">Seçiniz...</option>
                  {extraWorks.map((ew: any) => (
                    <option key={ew.id} value={ew.id}>{ew.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tutar (TL)</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">KDV (%)</label>
              <input type="number" value={form.vatRate} onChange={e => setForm({...form, vatRate: e.target.value})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tarih</label>
              <TrDateInput value={form.entryDate} onChange={(entryDate) => setForm({...form, entryDate})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Açıklama</label>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, description: v}); }} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="Opsiyonel" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
            <button onClick={handleSubmit} disabled={saving} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {revenues.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Henüz gelir kaydı yok</p>
      ) : (
        <div className="space-y-2">
          {revenues.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status}</span>
                <span className="text-xs font-medium text-slate-700">{typeLabel(r.revenueType)}</span>
                {r.extraWorkItem && <span className="text-xs text-purple-600">— {r.extraWorkItem.title}</span>}
                <span className="text-xs text-slate-400">• {sourceLabel(r.collectionSource)}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{fmtCurrency(r.totalAmount)}</p>
                {r.collectedAmount > 0 && <p className="text-xs text-green-600">Tahsil: {fmtCurrency(r.collectedAmount)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Faz 3: P&L — Ekstra İşler ───────────────────────────────────────────────
function EkstraIslerTab({ claimId }: { claimId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', agreedAt: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [miniPL, setMiniPL] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/extra-works`, { headers: authHeader() });
      setItems(r.data.data ?? r.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const loadMiniPL = async (id: string) => {
    if (miniPL[id]) return;
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/extra-works/${id}/pl`, { headers: authHeader() });
      setMiniPL(prev => ({ ...prev, [id]: r.data }));
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadMiniPL(id);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/extra-works`,
        { title: form.title, description: form.description || undefined, agreedAt: form.agreedAt || undefined },
        { headers: authHeader() },
      );
      setShowForm(false);
      setForm({ title: '', description: '', agreedAt: '' });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Ekstra iş kaydedilemedi');
    } finally { setSaving(false); }
  };

  const statusColor = (s: string) => ({
    draft: 'bg-slate-100 text-slate-600',
    approved: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-slate-100 text-slate-600');

  const statusLabel = (s: string) => ({ draft: 'Taslak', approved: 'Onaylı', completed: 'Tamamlandı', cancelled: 'İptal' }[s] ?? s);

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  return (
    <SectionCard title="Ekstra İşler">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">
          + Ekstra İş Ekle
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">İş Tanımı <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, title: v}); }} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="Örn: Mutfak dolap değişimi" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Anlaşma Tarihi</label>
              <TrDateInput value={form.agreedAt} onChange={(agreedAt) => setForm({...form, agreedAt})} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Notlar</label>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm({...form, description: v}); }} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" placeholder="Opsiyonel" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
            <button onClick={handleSubmit} disabled={saving} className="text-xs bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Henüz ekstra iş yok</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const pl = miniPL[item.id];
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between py-3 px-4 bg-white cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(item.status)}`}>{statusLabel(item.status)}</span>
                    <span className="text-sm font-medium text-slate-800">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {pl && (
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-700">G: {fmtCurrency(pl.totalRevenue)}</span>
                        <span className="text-red-600">M: {fmtCurrency(pl.totalCost)}</span>
                        <span className={pl.netProfit >= 0 ? 'text-green-800 font-bold' : 'text-red-700 font-bold'}>
                          K: {fmtCurrency(pl.netProfit)} (%{pl.netMarginPct.toFixed(1)})
                        </span>
                      </div>
                    )}
                    <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isExpanded && pl && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Toplam Gelir</p>
                        <p className="text-base font-bold text-green-700">{fmtCurrency(pl.totalRevenue)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">Toplam Gider</p>
                        <p className="text-base font-bold text-red-600">{fmtCurrency(pl.totalCost)}</p>
                      </div>
                      <div className={`rounded-lg p-3 border ${pl.netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-xs text-slate-500 mb-1">Net Kâr</p>
                        <p className={`text-base font-bold ${pl.netProfit >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmtCurrency(pl.netProfit)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Faz 3: P&L — Dosya Net P&L Özeti ────────────────────────────────────────
function PLOzetTab({ claimId }: { claimId: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/financial-summary`, { headers: authHeader() });
      setSummary(r.data.data ?? r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await axios.post(`${API}/finance/analytics/recalculate/${claimId}`, {}, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
    finally { setRecalculating(false); }
  };

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  const s = summary;
  const isProfit = !s || s.netProfit >= 0;

  return (
    <SectionCard title="Dosya P&L Özeti">
      <div className="flex justify-end mb-3">
        <button onClick={handleRecalculate} disabled={recalculating} className="text-xs text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50">
          {recalculating ? 'Hesaplanıyor...' : 'Yeniden Hesapla'}
        </button>
      </div>

      {!s ? (
        <p className="text-sm text-slate-400 py-4 text-center">Henüz hesaplanmamış</p>
      ) : (
        <div className="space-y-4">
          {/* Gelir kırılımı */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Gelir</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Dosya Bedeli</span><span className="font-medium">{fmtCurrency(s.fileFeeRevenue ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Ekstra İşler</span><span className="font-medium">{fmtCurrency(s.extraWorkRevenue ?? 0)}</span></div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 mt-1"><span>Toplam Gelir</span><span className="text-blue-700">{fmtCurrency(s.totalRevenue ?? s.actualRevenue ?? 0)}</span></div>
            </div>
          </div>
          {/* Gider kırılımı */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Gider</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Tedarikçi Hakediş</span><span className="font-medium">{fmtCurrency(s.vendorCost ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Saha Giderleri (Ulaşım + Denetim)</span><span className="font-medium">{fmtCurrency(s.fieldExpenseCost ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Malzeme</span><span className="font-medium">{fmtCurrency(s.materialCost ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Diğer Değişken</span><span className="font-medium">{fmtCurrency((s.communicationCost ?? 0) + (s.otherVariableCost ?? 0))}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sabit Gider Payı</span><span className="font-medium">{fmtCurrency(s.overheadShare ?? 0)}</span></div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 mt-1"><span>Toplam Gider</span><span className="text-red-600">{fmtCurrency(s.totalCost ?? s.actualCost ?? 0)}</span></div>
            </div>
          </div>
          {/* Net kâr */}
          <div className={`rounded-lg p-4 ${isProfit ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-base font-bold ${isProfit ? 'text-green-800' : 'text-red-700'}`}>Net Kâr / Zarar</span>
              <div className="text-right">
                <p className={`text-xl font-bold ${isProfit ? 'text-green-800' : 'text-red-700'}`}>{fmtCurrency(s.netProfit ?? s.grossProfit ?? 0)}</p>
                <p className={`text-sm ${isProfit ? 'text-green-600' : 'text-red-500'}`}>%{(s.netMarginPct ?? s.grossMarginPct ?? 0).toFixed(1)} kâr marjı</p>
              </div>
            </div>
          </div>
          {/* Tahsilat */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Tahsilat</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sigortacıdan Tahsil</span><span className="font-medium text-green-700">{fmtCurrency(s.collectedFromInsurer ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sigortalıdan Tahsil</span><span className="font-medium text-green-700">{fmtCurrency(s.collectedFromInsured ?? 0)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>Kalan Bakiye</span><span className="text-orange-600">{fmtCurrency(s.outstandingBalance ?? 0)}</span></div>
            </div>
          </div>
          <p className="text-xs text-slate-400">Son hesaplama: {fmtDate(s.lastCalculatedAt)}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Tab: Yönetici Talimatları ────────────────────────────────────────────────
function TalimatlarTab({ claimId }: { claimId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/notes?claimFileId=${claimId}&noteType=manager_instruction`, { headers: authHeader() });
      setNotes(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/notes`, { claimFileId: claimId, content: content.trim(), noteType: 'manager_instruction' }, { headers: authHeader() });
      setContent('');
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Talimat kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Yeni Talimat Girişi */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs">!</span>
          Yönetici Talimatı / Notu Ekle
        </h4>
        <div className="relative">
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-14 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
            rows={3}
            placeholder="Personele talimat veya açıklama yazın..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="absolute bottom-2 right-2">
            <SpeechToText
              size="sm"
              onTranscript={(text) => setContent((prev) => prev ? prev + ' ' + text : text)}
            />
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Talimat Kaydet'}
          </button>
        </div>
      </div>

      {/* Talimat Listesi */}
      {loading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Yükleniyor...</div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-semibold text-slate-500">Henüz Talimat Eklenmedi</p>
          <p className="text-xs text-slate-400 mt-1">Yukarıdaki formu kullanarak talimat ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold shrink-0">!</span>
                  <span className="text-xs font-semibold text-amber-700">
                    {n.author?.firstName} {n.author?.lastName}
                  </span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(n.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap pl-8">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Yazışmalar ──────────────────────────────────────────────────────────
interface ChatMessage {
  timestamp: string;
  sender: string;
  message: string;
  mediaRef?: boolean;
}

interface ChatArchive {
  id: string;
  label: string;
  uploadedAt: string;
  messageCount: number;
  uploadedBy: { id: string; firstName: string; lastName: string };
}

interface ChatArchiveDetail extends Omit<ChatArchive, 'messageCount'> {
  messageCount: number;
  parsedMessages: ChatMessage[];
  rawContent: string;
}

function ChatBubble({ msg, isSelf }: { msg: ChatMessage; isSelf: boolean }) {
  const time = new Date(msg.timestamp).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${isSelf ? 'bg-green-100 rounded-tr-sm' : 'bg-white rounded-tl-sm border border-slate-100'}`}>
        {!isSelf && (
          <p className="text-xs font-bold text-green-700 mb-0.5">{msg.sender}</p>
        )}
        {msg.mediaRef ? (
          <p className="text-xs text-slate-400 italic flex items-center gap-1">
            <span>📎</span> Medya dosyası
          </p>
        ) : (
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.message}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5 text-right">{time}</p>
      </div>
    </div>
  );
}

function YazismalarTab({ claimId }: { claimId: string }) {
  const [archives, setArchives] = useState<ChatArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArchive, setSelectedArchive] = useState<ChatArchiveDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selfSender, setSelfSender] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/chat-archives?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setArchives(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleOpenArchive = async (id: string) => {
    setLoadingDetail(true);
    try {
      const r = await axios.get(`${API}/chat-archives/${id}`, { headers: authHeader() });
      const detail: ChatArchiveDetail = r.data.data;
      setSelectedArchive(detail);
      // Auto-detect self sender from first message
      if (detail.parsedMessages?.length > 0) {
        setSelfSender(detail.parsedMessages[0].sender);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu yazışmayı silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/chat-archives/${id}`, { headers: authHeader() });
      if (selectedArchive?.id === id) setSelectedArchive(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Silinemedi'); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadLabel.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('claimFileId', claimId);
      formData.append('label', uploadLabel.trim());
      await axios.post(`${API}/chat-archives/upload`, formData, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setShowUploadModal(false);
      setUploadLabel('');
      setUploadFile(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Yükleme başarısız'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Yazışmalar</h3>
        <button type="button"
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + Yazışma Yükle
        </button>
      </div>

      {/* Archive list */}
      {archives.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Henüz Yazışma Yüklenmemiş
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {archives.map((a) => (
            <div
              key={a.id}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:border-green-300 hover:shadow-sm ${selectedArchive?.id === a.id ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-100'}`}
              onClick={() => handleOpenArchive(a.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">💬</span>
                    <p className="font-medium text-slate-800 text-sm truncate">{a.label}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {a.messageCount} mesaj · {new Date(a.uploadedAt).toLocaleDateString('tr-TR')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Yükleyen: {a.uploadedBy.firstName} {a.uploadedBy.lastName}
                  </p>
                </div>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message viewer */}
      {loadingDetail && (
        <div className="text-slate-400 py-4 text-center text-sm">Mesajlar yükleniyor...</div>
      )}
      {selectedArchive && !loadingDetail && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{selectedArchive.label}</p>
              <p className="text-xs text-slate-400">{selectedArchive.messageCount} mesaj</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500">Benim Mesajlarım (Sağ):</label>
                <select
                  className="text-xs border border-slate-200 rounded px-2 py-1"
                  value={selfSender}
                  onChange={(e) => setSelfSender(e.target.value)}
                >
                  {Array.from(new Set(selectedArchive.parsedMessages.map((m) => m.sender))).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => setSelectedArchive(null)} className="text-xs text-slate-400 hover:text-slate-600">Kapat ×</button>
            </div>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto space-y-0.5">
            {selectedArchive.parsedMessages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} isSelf={msg.sender === selfSender} />
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Yazışma Yükle</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Etiket *</label>
                <input
                  type="text"
                  placeholder="Müşteri ile Yazışma"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">WhatsApp .txt Dosyası *</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${dragOver ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.name.endsWith('.txt')) setUploadFile(f);
                  }}
                  onClick={() => document.getElementById('chat-file-input')?.click()}
                >
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-medium text-green-700">{uploadFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-500">Dosyayı Buraya Sürükleyin veya Tıklayın</p>
                      <p className="text-xs text-slate-400 mt-1">Yalnızca .txt Dosyası</p>
                    </div>
                  )}
                </div>
                <input
                  id="chat-file-input"
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadLabel.trim()}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
              <button type="button"
                onClick={() => { setShowUploadModal(false); setUploadLabel(''); setUploadFile(null); }}
                className="flex-1 border border-slate-200 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Revizyonlar Tab ──────────────────────────────────────────────────────────

type RevisionStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ESCALATED';
type RevisionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

type RevisionRequest = {
  id: string;
  reportNo: string;
  insuranceCompany: string;
  requestedBy: string;
  requestedAt: string;
  reasonCategory: string;
  reason: string;
  priority: RevisionPriority;
  status: RevisionStatus;
  deadlineAt: string | null;
  assignedTo: string | null;
  claimFileId: string;
  claimFileNo: string;
};

const REV_STATUS_LABELS: Record<RevisionStatus, string> = {
  REQUESTED: 'Talep Edildi',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi',
  ESCALATED: 'Eskalasyon',
};

const REV_STATUS_BADGE: Record<RevisionStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 border border-slate-200',
  ESCALATED: 'bg-red-50 text-red-700 border border-red-200',
};

const REV_PRIORITY_LABELS: Record<RevisionPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
};

const REV_PRIORITY_BADGE: Record<RevisionPriority, string> = {
  LOW: 'bg-slate-50 text-slate-500 border border-slate-200',
  NORMAL: 'bg-blue-50 text-blue-600 border border-blue-200',
  HIGH: 'bg-orange-50 text-orange-600 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
};

function RevizuonlarTab({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    axios.get(`${API}/revision-requests?claimFileId=${claimId}&limit=50`, { headers: authHeader() })
      .then((r) => setRevisions(r.data.data ?? []))
      .catch((e: any) => setError(e?.response?.data?.message ?? 'Revizyonlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = revisions.filter((r) => r.status === 'REQUESTED').length;
  const escalatedCount = revisions.filter((r) => r.status === 'ESCALATED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Revizyon Talepleri</h3>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {revisions.length} revizyon
              {pendingCount > 0 && <span className="ml-2 text-amber-600 font-medium">• {pendingCount} bekliyor</span>}
              {escalatedCount > 0 && <span className="ml-2 text-red-600 font-medium">• {escalatedCount} eskalasyon</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push(`/panel/revizyon-talepleri`)}
          className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Tüm Revizyonlar →
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={load} className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">Tekrar Dene</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : revisions.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">Bekleyen Revizyon Talebi Yok</p>
          <p className="text-xs text-slate-400 mt-1">Bu dosyaya ait revizyon talebi bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((rev) => {
            const isUrgent = rev.priority === 'CRITICAL' || rev.status === 'ESCALATED';
            return (
              <div
                key={rev.id}
                onClick={() => router.push(`/panel/revizyon-talepleri/${rev.id}`)}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${isUrgent ? 'border-l-4 border-red-400 border-y-gray-100 border-r-gray-100' : 'border-slate-100'}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-slate-900">{rev.reportNo}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REV_STATUS_BADGE[rev.status]}`}>
                        {rev.status === 'ESCALATED' && (
                          <span className="mr-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        )}
                        {REV_STATUS_LABELS[rev.status]}
                      </span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REV_PRIORITY_BADGE[rev.priority]}`}>
                        {REV_PRIORITY_LABELS[rev.priority]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{rev.reasonCategory}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xl">{rev.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{new Date(rev.requestedAt).toLocaleDateString('tr-TR')}</p>
                    {rev.assignedTo && <p className="text-xs text-slate-500 mt-0.5">{rev.assignedTo}</p>}
                    {rev.deadlineAt && (() => {
                      const diffMs = new Date(rev.deadlineAt).getTime() - Date.now();
                      const isOverdue = diffMs < 0;
                      const hours = Math.abs(Math.floor(diffMs / 3600000));
                      const label = hours < 24 ? `${hours}sa` : `${Math.floor(hours / 24)}g`;
                      return (
                        <p className={`text-xs mt-0.5 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                          {isOverdue ? `⚠ Süre Aşımı (${label})` : `${label} kaldı`}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ClaimFileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GroupTab>('genel-bilgiler');
  const [userRoleCode, setUserRoleCode] = useState<string | null>(null);

  useEffect(() => {
    setUserRoleCode(getCurrentUserRole());
  }, []);

  const isFieldStaff = userRoleCode === 'field_staff';
  const canViewFinancials = claim?.canViewFinancials !== false;

  useEffect(() => {
    if (!id) return;
    axios.get(`${API}/claim-files/${id}`, { headers: authHeader() })
      .then((r) => setClaim(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;
  if (!claim) return <div className="text-slate-400 py-16 text-center">Dosya Bulunamadı.</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button type="button" onClick={() => router.push('/panel/hasar-dosyalari')} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{claim.fileNo}</h2>
          <p className="text-sm text-slate-400">{claim.insuranceCompany?.name} · {claim.claimNo}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: claim.currentStatus?.color ?? '#6B7280' }} />
          <span className="text-sm font-medium text-slate-700">{claim.currentStatus?.name}</span>
        </span>
      </div>

      {/* Müşteri Bilgileri Bandı — tüm sekmelerde sabit */}
      {claim.customer && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {(claim.customer.fullName ?? claim.customer.companyName ?? '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-blue-400 font-medium tracking-wide leading-none mb-0.5">Müşteri</p>
              <p className="text-sm font-semibold text-blue-800 truncate">{claim.customer.fullName ?? claim.customer.companyName ?? '—'}</p>
            </div>
          </div>
          {claim.customer.phone && (
            <div className="min-w-0">
              <p className="text-xs text-blue-400 leading-none mb-0.5">Telefon</p>
              <a href={`tel:${claim.customer.phone}`} className="text-sm font-medium text-blue-700 hover:underline">{claim.customer.phone}</a>
            </div>
          )}
          {claim.customer.email && (
            <div className="min-w-0">
              <p className="text-xs text-blue-400 leading-none mb-0.5">E-posta</p>
              <a href={`mailto:${claim.customer.email}`} className="text-sm font-medium text-blue-700 hover:underline truncate">{claim.customer.email}</a>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6 flex-wrap">
        {GROUP_TABS.filter((tab) => {
          if (isFieldStaff && tab.id === 'finans') return false;
          if (tab.id === 'finans' && !canViewFinancials) return false;
          return true;
        }).map((tab) => (
          <button type="button" key={tab.id} onClick={() => setActiveGroup(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeGroup === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeGroup === 'genel-bilgiler' && (
        <GenelTab
          claim={claim}
          isFieldStaff={isFieldStaff}
          userRoleCode={userRoleCode}
          onClaimUpdated={(patch) => setClaim((c: any) => ({ ...c, ...patch }))}
        />
      )}
      {activeGroup === 'raporlar' && (
        <div className="space-y-6">
          <OnarimRaporuTab claimId={id!} />
        </div>
      )}
      {activeGroup === 'evraklar' && (
        <div className="space-y-6">
          <DokumanlarTab claimId={id!} />
          {/* Muvafakatname — Dosya Kapama */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">
              Muvafakatname
            </h4>
            <FileDocumentPanel
              entityType="claim_file"
              entityId={id!}
              documentKind="muvafakatname"
            />
          </div>
          {/* Kapama Koşulları + Fatura Talebi */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">
              Dosya Kapama & Fatura Talebi
            </h4>
            <ClosureConditionsPanel
              serviceType="claim"
              entityId={id!}
              fileNo={claim?.fileNo ?? ''}
              insuranceCompanyId={claim?.insuranceCompanyId}
              insuranceCompanyName={claim?.insuranceCompany?.name}
              totalAmount={claim?.budget?.totalAmount ?? 0}
              workItemsSummary={[]}
            />
          </div>
        </div>
      )}
      {activeGroup === 'finans' && !isFieldStaff && canViewFinancials && (
        <div className="space-y-6">
          <PLOzetTab claimId={id!} />
          <GelirlerTab claimId={id!} />
          <EkstraIslerTab claimId={id!} />
          <ButceTab claimId={id!} claimCity={claim?.propertyAddress?.city} />
          <FaturalarTab claimId={id!} />
          <TahsilatlarTab claimId={id!} />
          <FinansalOzetTab claimId={id!} />
        </div>
      )}
      {activeGroup === 'iletisim' && (
        <div className="space-y-6">
          <TalimatlarTab claimId={id!} />
          <NotlarTab claimId={id!} />
          <YazismalarTab claimId={id!} />
        </div>
      )}
      {activeGroup === 'takip' && (
        <div className="space-y-6">
          <GorevlerTab claimId={id!} />
          <RandevularTab claimId={id!} claim={claim} />
        </div>
      )}
      {activeGroup === 'is-akisi' && (
        <div className="space-y-6">
          <IsAkisiTab claimId={id!} claim={claim} isFieldStaff={isFieldStaff} userRoleCode={userRoleCode} />
        </div>
      )}
      {activeGroup === 'revizyonlar' && <RevizuonlarTab claimId={id!} />}
    </div>
  );
}

// ─── Tab: İş Akışı ────────────────────────────────────────────────────────────

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'Tedarikçi Atandı',
  APPOINTMENT_SCHEDULED: 'Randevu Planlandı',
  APPOINTMENT_UPDATED: 'Randevu Güncellendi',
  INSPECTION_DONE: 'Tespit Yapıldı',
  COST_REPORT_SUBMITTED: 'Maliyet Raporu Gönderildi',
  ATTACHMENT_ADDED: 'Ek Yüklendi',
  STATUS_CHANGED: 'Durum Değişti',
  NOTE_ADDED: 'Not Eklendi',
};

const ACTIVITY_ACTION_COLORS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'bg-purple-100 text-purple-700 border-purple-200',
  APPOINTMENT_SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPOINTMENT_UPDATED: 'bg-blue-50 text-blue-600 border-blue-100',
  INSPECTION_DONE: 'bg-amber-100 text-amber-700 border-amber-200',
  COST_REPORT_SUBMITTED: 'bg-green-100 text-green-700 border-green-200',
  ATTACHMENT_ADDED: 'bg-slate-100 text-slate-600 border-slate-200',
  STATUS_CHANGED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  NOTE_ADDED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function IsAkisiTab({ claimId, claim, userRoleCode }: { claimId: string; claim: any; isFieldStaff?: boolean; userRoleCode: string | null }) {
  const [subTab, setSubTab] = useState<'surec' | 'tedarikci' | 'randevu' | 'gecmis'>('surec');
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(claim?.assignedSupplierId ?? '');
  const [assignNote, setAssignNote] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignError, setAssignError] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptDate, setApptDate] = useState('');
  const [apptNote, setApptNote] = useState('');
  const [apptSaving, setApptSaving] = useState(false);
  const [apptError, setApptError] = useState('');
  const [apptSuccess, setApptSuccess] = useState('');

  const isAdminOrOffice = userRoleCode === 'admin' || userRoleCode === 'office_staff';

  const loadLog = useCallback(() => {
    setLogLoading(true);
    axios.get(`${API}/claim-files/${claimId}/activity-log`, { headers: authHeader() })
      .then((r) => setActivityLog(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLogLoading(false));
  }, [claimId]);

  const loadAppointments = useCallback(() => {
    setApptLoading(true);
    axios.get(`${API}/claim-files/${claimId}/appointments`, { headers: authHeader() })
      .then((r) => setAppointments(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setApptLoading(false));
  }, [claimId]);

  const loadVendors = useCallback(() => {
    setVendorsLoading(true);
    axios.get(`${API}/claim-files/${claimId}/vendors/nearby`, { headers: authHeader() })
      .then((r) => setVendors(r.data.data ?? []))
      .catch(() => {
        // fallback: load all vendors
        axios.get(`${API}/vendors?status=active&limit=50`, { headers: authHeader() })
          .then((r2) => setVendors(r2.data.data?.vendors ?? r2.data.data ?? []))
          .catch(console.error);
      })
      .finally(() => setVendorsLoading(false));
  }, [claimId]);

  useEffect(() => {
    if (subTab === 'tedarikci') loadVendors();
    if (subTab === 'randevu') loadAppointments();
    if (subTab === 'gecmis') loadLog();
  }, [subTab, loadVendors, loadAppointments, loadLog]);

  const handleAssignSupplier = async () => {
    if (!selectedVendorId) { setAssignError('Tedarikçi seçiniz.'); return; }
    setAssigning(true); setAssignError(''); setAssignSuccess('');
    try {
      await axios.post(`${API}/claim-files/${claimId}/assign-supplier`, { supplierId: selectedVendorId, note: assignNote }, { headers: authHeader() });
      setAssignSuccess('Tedarikçi başarıyla atandı.');
      loadLog();
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Tedarikçi atanamadı.');
    } finally { setAssigning(false); }
  };

  const handleCreateAppointment = async () => {
    if (!apptDate) { setApptError('Randevu tarihi/saati seçiniz.'); return; }
    setApptSaving(true); setApptError(''); setApptSuccess('');
    try {
      await axios.post(`${API}/claim-files/${claimId}/appointments`, { scheduledDate: apptDate, notes: apptNote }, { headers: authHeader() });
      setApptSuccess('Randevu oluşturuldu.');
      setApptDate(''); setApptNote('');
      loadAppointments(); loadLog();
    } catch (e: any) {
      setApptError(e?.response?.data?.message ?? 'Randevu oluşturulamadı.');
    } finally { setApptSaving(false); }
  };

  const apptStatusLabel: Record<string, string> = { planned: 'Planlandı', completed: 'Tamamlandı', cancelled: 'İptal' };
  const apptStatusColor: Record<string, string> = { planned: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          ['surec', 'Süreç Timeline'],
          ['tedarikci', 'Tedarikçi Atama'],
          ['randevu', 'Randevular'],
          ['gecmis', 'Hareket Geçmişi'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSubTab(id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${subTab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Süreç Timeline */}
      {subTab === 'surec' && (
        <ProcessTimeline claimFileId={claimId} />
      )}

      {/* Tedarikçi Atama */}
      {subTab === 'tedarikci' && (
        <SectionCard title="Tedarikçi Atama">
          {claim?.assignedSupplier && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-purple-50 border border-purple-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {claim.assignedSupplier.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-800">{claim.assignedSupplier.name}</p>
                <p className="text-xs text-purple-600">
                  Mevcut atanmış tedarikçi
                  {claim.supplierAssignedAt && ` · ${new Date(claim.supplierAssignedAt).toLocaleDateString('tr-TR')}`}
                </p>
              </div>
            </div>
          )}

          {isAdminOrOffice ? (
            <div className="space-y-4">
              {assignError && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{assignError}</div>}
              {assignSuccess && <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{assignSuccess}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  {claim?.propertyAddress?.city ? `${claim.propertyAddress.city} bölgesindeki tedarikçiler` : 'Tedarikçi Seç'}
                </label>
                {vendorsLoading ? (
                  <p className="text-xs text-slate-400">Tedarikçiler yükleniyor...</p>
                ) : vendors.length === 0 ? (
                  <p className="text-xs text-slate-400">Uygun tedarikçi bulunamadı. Lütfen tedarikçi ekleyin.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {vendors.map((v) => (
                      <button key={v.id} type="button" onClick={() => setSelectedVendorId(v.id)}
                        className={`text-left px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedVendorId === v.id ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'}`}>
                        <p className="font-semibold leading-tight">{v.name}</p>
                        <p className={`text-xs mt-0.5 ${selectedVendorId === v.id ? 'text-purple-200' : 'text-slate-400'}`}>
                          {v.city}{v.district ? ` / ${v.district}` : ''} · {v.type}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Not (opsiyonel)</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Atama notu..." />
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={handleAssignSupplier} disabled={assigning || !selectedVendorId}
                  className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 transition-colors flex items-center gap-2">
                  {assigning && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {assigning ? 'Atanıyor...' : 'Tedarikçi Ata'}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              Tedarikçi atama yetkiniz bulunmuyor.
            </div>
          )}
        </SectionCard>
      )}

      {/* Randevular */}
      {subTab === 'randevu' && (
        <div className="space-y-4">
          <SectionCard title="Randevu Oluştur">
            {apptError && <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{apptError}</div>}
            {apptSuccess && <div className="mb-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{apptSuccess}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tarih / Saat <span className="text-red-500">*</span></label>
                <input type="datetime-local" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Not</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={apptNote} onChange={(e) => setApptNote(e.target.value)} placeholder="Randevu notları..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleCreateAppointment} disabled={apptSaving || !apptDate}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {apptSaving && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                {apptSaving ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Randevular">
            {apptLoading ? (
              <p className="text-sm text-slate-400 py-4 text-center">Yükleniyor...</p>
            ) : appointments.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">Henüz randevu oluşturulmamış.</div>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">
                          {new Date(a.scheduledDate).toLocaleString('tr-TR')}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${apptStatusColor[a.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {apptStatusLabel[a.status] ?? a.status}
                        </span>
                      </div>
                      {a.notes && <p className="text-xs text-slate-500 mt-1">{a.notes}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {a.createdBy?.firstName} {a.createdBy?.lastName} · {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Hareket Geçmişi */}
      {subTab === 'gecmis' && (
        <SectionCard title="Hareket Geçmişi">
          {logLoading ? (
            <p className="text-sm text-slate-400 py-8 text-center">Yükleniyor...</p>
          ) : activityLog.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Henüz hareket kaydı yok.</p>
              <p className="text-xs text-slate-400 mt-1">Tedarikçi atama, randevu ve tespit işlemleri burada görünecek.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-4 pl-10">
                {activityLog.map((log) => {
                  const actionColor = ACTIVITY_ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                  const actionLabel = ACTIVITY_ACTION_LABELS[log.action] ?? log.action;
                  return (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-10 top-2.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      </div>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${actionColor}`}>
                            {actionLabel}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(log.createdAt).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{log.description}</p>
                        {log.actor && (
                          <p className="text-xs text-slate-400 mt-1">
                            {log.actor.firstName} {log.actor.lastName} · {log.actorRole}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
