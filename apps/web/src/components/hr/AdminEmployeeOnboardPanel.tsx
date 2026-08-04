'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, UserPlus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  isCompleteTrDateValue,
  normalizeTrDateValue,
  isoToTrDateDisplay,
} from '@/utils/tr-date-input';

type CandidateUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: { code: string; name: string } | null;
};

type EmployeeRow = {
  id: string;
  userId: string;
  personnelNo?: string | null;
  hireDate?: string | null;
  user: { firstName: string; lastName: string; email: string };
  leaveEntitlement?: { totalDays: number; completedYears: number; ruleLabel: string };
  leaveBalance?: { remainingDays: number; totalDays: number };
};

type Props = {
  preview?: boolean;
};

const PREVIEW_CANDIDATES: CandidateUser[] = [
  {
    id: 'c1',
    firstName: 'Deniz',
    lastName: 'Yurt',
    email: 'deniz.yurt@meridyen.local',
    role: { code: 'office_staff', name: 'Dosya Sorumlusu' },
  },
];

/**
 * Admin: kullanıcıyı özlük kartına bağla + işe giriş tarihi → İş Kanunu izin hakedişi.
 * Kıdem/ihbar sonraki faz.
 */
export function AdminEmployeeOnboardPanel({ preview = false }: Props) {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<CandidateUser[]>(
    preview ? PREVIEW_CANDIDATES : [],
  );
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [userId, setUserId] = useState(preview ? 'c1' : '');
  const [hireDate, setHireDate] = useState('');
  const [personnelNo, setPersonnelNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(
    preview
      ? 'Örnek: 2018 giriş → 8 yıl → 20 iş günü hakediş (önizleme).'
      : null,
  );

  const previewEntitlement = useMemo(() => {
    if (!preview || !isCompleteTrDateValue(hireDate)) return null;
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
  }, [preview, hireDate]);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    (async () => {
      try {
        const [cand, emp] = await Promise.all([
          apiClient.get<CandidateUser[]>('hr/employees/candidates'),
          apiClient.get<EmployeeRow[]>('hr/employees'),
        ]);
        if (!alive) return;
        setCandidates(Array.isArray(cand) ? cand : []);
        setEmployees(Array.isArray(emp) ? emp : []);
        if (Array.isArray(cand) && cand[0]) setUserId(cand[0].id);
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
  }, [preview, showToast]);

  const handleSave = async () => {
    if (!userId) {
      showToast('warning', 'Kullanıcı Seçin');
      return;
    }
    if (!isCompleteTrDateValue(hireDate)) {
      showToast('warning', 'Geçerli İşe Giriş Tarihi Girin (GG.AA.YYYY)');
      return;
    }

    if (preview) {
      setLastResult(
        previewEntitlement
          ? `Önizleme: ${previewEntitlement.years} yıl → ${previewEntitlement.days} iş günü (${previewEntitlement.label})`
          : 'Önizleme kaydı',
      );
      showToast('success', 'Önizleme — Hakediş Hesaplandı');
      return;
    }

    setSaving(true);
    try {
      const data = await apiClient.post<{
        leaveEntitlement: { totalDays: number; completedYears: number; ruleLabel: string };
        leaveBalance: { remainingDays: number; totalDays: number };
        note: string;
      }>('hr/employees', {
        userId,
        hireDate: normalizeTrDateValue(hireDate),
        personnelNo: personnelNo.trim() || null,
      });
      setLastResult(
        `${data.leaveEntitlement.completedYears} yıl hizmet → ${data.leaveEntitlement.totalDays} iş günü. ${data.leaveEntitlement.ruleLabel}. Kalan: ${data.leaveBalance.remainingDays} gün.`,
      );
      showToast('success', 'Personel Kartı Kaydedildi');
      const [cand, emp] = await Promise.all([
        apiClient.get<CandidateUser[]>('hr/employees/candidates'),
        apiClient.get<EmployeeRow[]>('hr/employees'),
      ]);
      setCandidates(Array.isArray(cand) ? cand : []);
      setEmployees(Array.isArray(emp) ? emp : []);
      setUserId('');
      setHireDate('');
      setPersonnelNo('');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Kayıt Başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <UserPlus className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-content-primary">
                Personel Ekle / İşe Giriş
              </p>
              {preview && (
                <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Tasarım Önizleme
                </span>
              )}
            </div>
            <p className="text-xs text-content-tertiary mt-1">
              İşe giriş tarihine göre 4857 İş Kanunu yıllık izin hakedişi
              hesaplanır. Kıdem / ihbar sonraki fazdır.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-content-tertiary mb-1">
            Kullanıcı
          </label>
          <select
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Seçin</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.role?.name ?? c.email}
              </option>
            ))}
            {!preview &&
              employees.map((e) => (
                <option key={`e-${e.userId}`} value={e.userId}>
                  {e.user.firstName} {e.user.lastName} (güncelle)
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-content-tertiary mb-1">
            İşe Giriş Tarihi
          </label>
          <TrDateInput
            value={hireDate}
            onChange={setHireDate}
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
            aria-label="İşe giriş tarihi"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-content-tertiary mb-1">
            Sicil No
          </label>
          <input
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
            value={personnelNo}
            onChange={(e) => setPersonnelNo(e.target.value)}
            placeholder="Opsiyonel"
          />
        </div>
      </div>

      {previewEntitlement && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5 text-sm text-content-secondary">
          <CalendarPlus className="h-4 w-4 shrink-0 mt-0.5 text-brand-600" />
          <p>
            Tahmini hakediş: <strong>{previewEntitlement.days} iş günü</strong> (
            {previewEntitlement.label})
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Kaydediliyor...' : 'Kaydet Ve Hakediş Hesapla'}
      </button>

      {lastResult && (
        <p className="text-xs text-brand-800 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
          {lastResult}
        </p>
      )}

      {!preview && employees.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                  Personel
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                  İşe Giriş
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                  Hakediş
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                  Kalan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    {row.user.firstName} {row.user.lastName}
                  </td>
                  <td className="px-3 py-2">
                    {row.hireDate ? isoToTrDateDisplay(row.hireDate.slice(0, 10)) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.leaveEntitlement
                      ? `${row.leaveEntitlement.totalDays} gün (${row.leaveEntitlement.completedYears} yıl)`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.leaveBalance ? `${row.leaveBalance.remainingDays} gün` : '—'}
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
