'use client';

import { useEffect, useState } from 'react';
import { updateCase, type EmergencyCase } from '@/utils/emergencyApi';
import { isFieldStaffRole, usePanelRoleCode } from '@/hooks/usePanelRole';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { PANEL_CARD_BASE } from '@/components/panel/PanelCard';
import { getApiErrorMessage } from '@/utils/api-error';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';

function personName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

function personInitial(user?: { firstName?: string | null; lastName?: string | null } | null) {
  const name = personName(user);
  return name ? name.charAt(0).toLocaleUpperCase('tr-TR') : '—';
}

function canAssignSaha(roleCode: string) {
  if (isFieldStaffRole(roleCode)) return false;
  const role = roleCode.trim().toLowerCase().replace(/-/g, '_');
  return role === 'admin' || role === 'office_staff' || role === 'manager' || role === 'ops_manager';
}

type StaffRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
};

export function AcilSahaAssignCard({
  vaka,
  onAssigned,
}: {
  vaka: EmergencyCase;
  onAssigned: (next: EmergencyCase) => void;
}) {
  const roleCode = usePanelRoleCode();
  const canAssign = canAssignSaha(roleCode);
  const assigned = vaka.assignedFieldUser ?? null;
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedId, setSelectedId] = useState(assigned?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedId(assigned?.id ?? '');
  }, [assigned?.id]);

  useEffect(() => {
    if (!open || !canAssign) return;
    let cancelled = false;
    setLoadingStaff(true);
    fetch('/api/v1/claim-files/assignable-staff?role=field_staff', { credentials: 'include' })
      .then(async (response) => {
        if (cancelled) return;
        const json = await response.json().catch(() => null);
        const list = json?.data ?? json ?? [];
        setStaff(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setStaff([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canAssign]);

  async function handleSave() {
    if (!selectedId) {
      setError('Saha kaydı seçin.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await updateCase(vaka.id, { assignedFieldUserId: selectedId } as Partial<EmergencyCase>);
      onAssigned(res.data);
      setOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Saha ataması kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  const name = personName(assigned);

  return (
    <div className="space-y-3">
      {canAssign ? (
        <OpsFirstRunNotice
          noticeId={OPS_NOTICE.acilSahaDosyaAtama.id}
          title={OPS_NOTICE.acilSahaDosyaAtama.title}
          body={OPS_NOTICE.acilSahaDosyaAtama.body}
          testId="acil-saha-dosya-atama-ilk-kullanim-seridi"
        />
      ) : null}
    <div className={PANEL_CARD_BASE} data-testid="acil-saha-atama">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">Saha Operasyonu</p>
          <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              {personInitial(assigned)}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-base font-semibold ${name ? 'text-slate-900' : 'italic text-slate-400'}`}>
                {name || 'Seçilmedi'}
              </p>
              <p className="text-[11px] text-slate-500">Meridyen saha kaydı. Tedarikçi ayrıdır.</p>
            </div>
          </div>
          {assigned?.phone ? (
            <div className="mt-2">
              <PhoneContactActions phone={assigned.phone} accent="teal" size="sm" />
            </div>
          ) : null}
        </div>
        {canAssign ? (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setError('');
            }}
            className="shrink-0 text-[11px] font-medium text-teal-700 hover:text-teal-900"
          >
            {open ? 'Kapat' : 'Değiştir'}
          </button>
        ) : null}
      </div>
      {open && canAssign ? (
        <div className="border-t border-slate-100 px-4 py-3">
          {loadingStaff ? (
            <p className="text-xs text-slate-500">Saha kayıtları yükleniyor...</p>
          ) : staff.length === 0 ? (
            <p className="text-xs text-slate-500">Kullanıcılar’da Meridyen Saha Operasyonu kaydı yok.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Saha Operasyonu"
              >
                <option value="">Saha kaydı seçin</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {personName(row) || row.email || row.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor...' : 'Ata'}
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
    </div>
  );
}
