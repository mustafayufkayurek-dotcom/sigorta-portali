'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, UserPlus, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  isCompleteTrDateValue,
  normalizeTrDateValue,
  isoToTrDateDisplay,
} from '@/utils/tr-date-input';

const BLOOD_TYPES = [
  '0 Rh-',
  '0 Rh+',
  'A Rh-',
  'A Rh+',
  'B Rh-',
  'B Rh+',
  'AB Rh-',
  'AB Rh+',
] as const;

type RoleOption = {
  id: string;
  code: string;
  name: string;
};

type CandidateUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: RoleOption | null;
};

type EmployeeRow = {
  id: string;
  userId: string;
  personnelNo?: string | null;
  identityNo?: string | null;
  birthDate?: string | null;
  personalGsm?: string | null;
  companyGsm?: string | null;
  bloodType?: string | null;
  hireDate?: string | null;
  jobTitle?: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role?: RoleOption | null;
  };
};

export type PersonelEkleSaved = {
  profileId: string;
  userId: string;
  fullName: string;
  /** Kaydet Ve Yeni — panel açık kalır, dosya otomatik açılmaz */
  keepOpen?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  preview?: boolean;
  /** Güncelleme için kullanıcıyı önceden seç */
  initialUserId?: string | null;
  onSaved?: (row: PersonelEkleSaved) => void;
};

const PREVIEW_ROLES: RoleOption[] = [
  { id: 'r-office', code: 'office_staff', name: 'Dosya Sorumlusu' },
  { id: 'r-field', code: 'field_staff', name: 'Saha Personeli' },
  { id: 'r-finance', code: 'finance', name: 'Finans' },
  { id: 'r-manager', code: 'manager', name: 'Müdür' },
];

const PREVIEW_CANDIDATES: CandidateUser[] = [
  {
    id: 'c1',
    firstName: 'Deniz',
    lastName: 'Yurt',
    email: 'deniz.yurt@meridyen.local',
    role: PREVIEW_ROLES[0],
  },
];

/**
 * Personel Ekle — operasyonel özlük kartı.
 * Görevi: sistem rollerinden seçilir; kayıtta kullanıcı rolü güncellenir.
 */
export function PersonelEklePanel({
  open,
  onClose,
  preview = false,
  initialUserId = null,
  onSaved,
}: Props) {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<CandidateUser[]>(
    preview ? PREVIEW_CANDIDATES : [],
  );
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>(preview ? PREVIEW_ROLES : []);
  const [userId, setUserId] = useState(preview ? 'c1' : '');
  const [roleId, setRoleId] = useState(preview ? PREVIEW_ROLES[0].id : '');
  const [hireDate, setHireDate] = useState('');
  const [personnelNo, setPersonnelNo] = useState('');
  const [identityNo, setIdentityNo] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [personalGsm, setPersonalGsm] = useState('');
  const [companyGsm, setCompanyGsm] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const isUpdate = useMemo(
    () => employees.some((e) => e.userId === userId),
    [employees, userId],
  );

  const previewEntitlement = useMemo(() => {
    if (!isCompleteTrDateValue(hireDate)) return null;
    const iso = normalizeTrDateValue(hireDate);
    const hire = new Date(`${iso}T12:00:00Z`);
    const asOf = new Date();
    let years = asOf.getFullYear() - hire.getFullYear();
    const md = asOf.getMonth() - hire.getMonth();
    if (md < 0 || (md === 0 && asOf.getDate() < hire.getDate())) years -= 1;
    years = Math.max(0, years);
    if (years < 1) return { years, days: 0, label: '1 yıl dolmadan hak yok' };
    if (years <= 5) return { years, days: 14, label: '1–5 yıl → 14 iş günü' };
    if (years <= 15) return { years, days: 20, label: '5+ – 15 yıl → 20 iş günü' };
    return { years, days: 26, label: '15+ yıl → 26 iş günü' };
  }, [hireDate]);

  const resetContactFields = () => {
    setPersonnelNo('');
    setIdentityNo('');
    setBirthDate('');
    setPersonalGsm('');
    setCompanyGsm('');
    setBloodType('');
    setHireDate('');
  };

  const applyUserDefaultRole = (
    nextUserId: string,
    candList: CandidateUser[],
    empList: EmployeeRow[],
  ) => {
    const cand = candList.find((c) => c.id === nextUserId);
    if (cand?.role?.id) {
      setRoleId(cand.role.id);
      return;
    }
    const emp = empList.find((e) => e.userId === nextUserId);
    if (emp?.user.role?.id) {
      setRoleId(emp.user.role.id);
      return;
    }
    setRoleId('');
  };

  useEffect(() => {
    if (!open || !initialUserId) return;
    setUserId(initialUserId);
  }, [open, initialUserId]);

  useEffect(() => {
    if (!open) return;
    if (preview) {
      setCandidates(PREVIEW_CANDIDATES);
      setRoles(PREVIEW_ROLES);
      setUserId(initialUserId || 'c1');
      setRoleId(PREVIEW_ROLES[0].id);
      setPersonnelNo('PRV-1099');
      setIdentityNo('12345678901');
      setBirthDate('15.05.1990');
      setPersonalGsm('0532 111 22 33');
      setCompanyGsm('0532 444 55 66');
      setBloodType('A Rh+');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [cand, emp, roleList] = await Promise.all([
          apiClient.get<CandidateUser[]>('hr/employees/candidates'),
          apiClient.get<EmployeeRow[]>('hr/employees'),
          apiClient.get<RoleOption[]>('hr/employees/roles'),
        ]);
        if (!alive) return;
        setCandidates(Array.isArray(cand) ? cand : []);
        setEmployees(Array.isArray(emp) ? emp : []);
        setRoles(Array.isArray(roleList) ? roleList : []);
      } catch (e) {
        showToast(
          'error',
          e instanceof Error ? e.message : 'Personel listesi alınamadı',
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, preview, showToast, initialUserId]);

  useEffect(() => {
    if (!userId) return;
    const emp = employees.find((e) => e.userId === userId);
    if (!emp) return;
    setPersonnelNo(emp.personnelNo?.trim() || '');
    setIdentityNo(emp.identityNo?.trim() || '');
    setPersonalGsm(emp.personalGsm?.trim() || '');
    setCompanyGsm(emp.companyGsm?.trim() || '');
    setBloodType(emp.bloodType?.trim() || '');
    if (emp.user.role?.id) setRoleId(emp.user.role.id);
    if (emp.birthDate) {
      setBirthDate(isoToTrDateDisplay(emp.birthDate.slice(0, 10)));
    }
    if (emp.hireDate) {
      setHireDate(isoToTrDateDisplay(emp.hireDate.slice(0, 10)));
    }
  }, [userId, employees]);

  const filteredCandidates = useMemo(() => {
    const q = userSearch.trim().toLocaleLowerCase('tr-TR');
    const list = [
      ...candidates,
      ...employees.map((e) => ({
        id: e.userId,
        firstName: e.user.firstName,
        lastName: e.user.lastName,
        email: e.user.email,
        role: e.user.role ?? null,
        _update: true as const,
      })),
    ];
    if (!q) return list;
    return list.filter((c) => {
      const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.role?.name ?? ''}`.toLocaleLowerCase(
        'tr-TR',
      );
      return hay.includes(q);
    });
  }, [candidates, employees, userSearch]);

  const resolveName = () => {
    const cand = candidates.find((c) => c.id === userId);
    const emp = employees.find((e) => e.userId === userId);
    if (cand) return `${cand.firstName} ${cand.lastName}`;
    if (emp) return `${emp.user.firstName} ${emp.user.lastName}`;
    return 'Personel';
  };

  const handleSave = async (mode: 'close' | 'new' = 'close') => {
    if (!userId) {
      showToast('warning', 'Kullanıcı Seçin');
      return;
    }
    if (!roleId) {
      showToast('warning', 'Görevi Seçin');
      return;
    }
    if (!personnelNo.trim()) {
      showToast('warning', 'Sicil No Zorunludur');
      return;
    }
    const tc = identityNo.replace(/\D/g, '');
    if (!/^\d{11}$/.test(tc)) {
      showToast('warning', 'T.C. Kimlik No 11 Haneli Olmalıdır');
      return;
    }
    if (!isCompleteTrDateValue(birthDate)) {
      showToast('warning', 'Geçerli Doğum Tarihi Girin (GG.AA.YYYY)');
      return;
    }
    if (!personalGsm.trim()) {
      showToast('warning', 'Kişisel GSM No Zorunludur');
      return;
    }
    if (!companyGsm.trim()) {
      showToast('warning', 'Şirket GSM No Zorunludur');
      return;
    }
    if (!bloodType) {
      showToast('warning', 'Kan Grubu Seçin');
      return;
    }
    if (!isCompleteTrDateValue(hireDate)) {
      showToast('warning', 'Geçerli İşe Giriş Tarihi Girin (GG.AA.YYYY)');
      return;
    }

    const fullName = resolveName();

    if (preview) {
      showToast('success', 'Önizleme — Personel Kartı Kaydedildi');
      onSaved?.({
        profileId: 'p1',
        userId,
        fullName,
        keepOpen: mode === 'new' && !isUpdate,
      });
      if (mode === 'new' && !isUpdate) {
        resetContactFields();
        setUserId('');
        setRoleId('');
        return;
      }
      onClose();
      return;
    }

    setSaving(true);
    try {
      const data = await apiClient.post<{
        profile: { id: string };
      }>('hr/employees', {
        userId,
        roleId,
        hireDate: normalizeTrDateValue(hireDate),
        personnelNo: personnelNo.trim(),
        identityNo: identityNo.replace(/\D/g, ''),
        birthDate: normalizeTrDateValue(birthDate),
        personalGsm: personalGsm.trim(),
        companyGsm: companyGsm.trim(),
        bloodType,
      });
      showToast('success', 'Personel Kartı Kaydedildi');
      onSaved?.({
        profileId: data.profile.id,
        userId,
        fullName,
        keepOpen: mode === 'new' && !isUpdate,
      });
      if (mode === 'new' && !isUpdate) {
        resetContactFields();
        setUserId('');
        setRoleId('');
        // Aday listesini yenile (eklenen kullanıcı düşer)
        try {
          const [cand, emp, roleList] = await Promise.all([
            apiClient.get<CandidateUser[]>('hr/employees/candidates'),
            apiClient.get<EmployeeRow[]>('hr/employees'),
            apiClient.get<RoleOption[]>('hr/employees/roles'),
          ]);
          setCandidates(Array.isArray(cand) ? cand : []);
          setEmployees(Array.isArray(emp) ? emp : []);
          setRoles(Array.isArray(roleList) ? roleList : []);
        } catch {
          /* liste yenileme sessiz */
        }
        return;
      }
      resetContactFields();
      setUserId('');
      setRoleId('');
      onClose();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Kayıt Başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const fieldClass =
    'w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm';

  return (
    <>
      <button
        type="button"
        aria-label="Kapat"
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <UserPlus className="h-5 w-5 text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content-primary">
                {isUpdate ? 'Personel Kartını Güncelle' : 'Personel Ekle'}
              </p>
              <p className="mt-0.5 text-xs text-content-tertiary">
                Operasyonel özlük kartı
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 text-content-secondary hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Kullanıcı Ara
              </label>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Ad, soyad veya e-posta"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Kullanıcı
              </label>
              <select
                className={fieldClass}
                value={userId}
                onChange={(e) => {
                  const next = e.target.value;
                  setUserId(next);
                  if (!employees.some((emp) => emp.userId === next)) {
                    resetContactFields();
                  }
                  applyUserDefaultRole(next, candidates, employees);
                }}
              >
                <option value="">Seçin</option>
                {filteredCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {'_update' in c && c._update ? ' (güncelle)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Görevi
              </label>
              <select
                className={fieldClass}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
                aria-required
                aria-label="Görevi"
              >
                <option value="">Seçin</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-content-tertiary">
                Listede yoksa{' '}
                {preview ? (
                  <span className="font-medium text-content-secondary">Ayarlar → Roller</span>
                ) : (
                  <Link
                    href="/panel/ayarlar/roller"
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Ayarlar → Roller
                  </Link>
                )}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Sicil No
              </label>
              <input
                className={fieldClass}
                value={personnelNo}
                onChange={(e) => setPersonnelNo(e.target.value)}
                placeholder="Zorunlu"
                required
                aria-required
                aria-label="Sicil No"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                T.C. Kimlik No
              </label>
              <input
                className={fieldClass}
                value={identityNo}
                onChange={(e) => setIdentityNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="11 hane"
                inputMode="numeric"
                required
                aria-required
                aria-label="T.C. Kimlik No"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Kişisel GSM No
              </label>
              <input
                className={fieldClass}
                value={personalGsm}
                onChange={(e) => setPersonalGsm(e.target.value)}
                placeholder="05XX XXX XX XX"
                inputMode="tel"
                required
                aria-required
                aria-label="Kişisel GSM No"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Şirket GSM No
              </label>
              <input
                className={fieldClass}
                value={companyGsm}
                onChange={(e) => setCompanyGsm(e.target.value)}
                placeholder="05XX XXX XX XX"
                inputMode="tel"
                required
                aria-required
                aria-label="Şirket GSM No"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Kan Grubu
              </label>
              <select
                className={fieldClass}
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                required
                aria-required
                aria-label="Kan Grubu"
              >
                <option value="">Seçin</option>
                {BLOOD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Doğum Tarihi
              </label>
              <TrDateInput
                value={birthDate}
                onChange={setBirthDate}
                className={fieldClass}
                aria-label="Doğum tarihi"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                İşe Giriş Tarihi
              </label>
              <TrDateInput
                value={hireDate}
                onChange={setHireDate}
                className={fieldClass}
                aria-label="İşe giriş tarihi"
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              {previewEntitlement ? (
                <div className="flex w-full items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-xs text-content-secondary">
                  <CalendarPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <p>
                    Tahmini hakediş:{' '}
                    <strong className="text-content-primary">
                      {previewEntitlement.days} iş günü
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="pb-2 text-[11px] text-content-tertiary">
                  Geçerli işe giriş tarihi girilince hakediş görünür
                </p>
              )}
            </div>

          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          {isUpdate ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('close')}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Personel Kartını Güncelle'}
            </button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave('close')}
                className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50 disabled:opacity-50"
              >
                Kaydet Ve Kapat
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave('new')}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet Ve Yeni'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/** @deprecated Eski satır form — PersonelEklePanel kullanın */
export function AdminEmployeeOnboardPanel({ preview = false }: { preview?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-content-tertiary">
      Personel ekleme satır formundan taşındı.{' '}
      <button
        type="button"
        className="font-semibold text-brand-600 hover:text-brand-700"
        onClick={() => setOpen(true)}
      >
        Personel Ekle
      </button>
      <PersonelEklePanel open={open} onClose={() => setOpen(false)} preview={preview} />
    </div>
  );
}
