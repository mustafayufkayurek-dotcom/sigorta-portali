'use client';

import { useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { workHoursGateApplies } from '@sigorta/shared';
import { ToggleSwitch } from '@/components/users/OperationalAccessGrantPanel';

export function WorkHoursGateToggle({
  userId,
  roleCode,
  portalCustomerId,
  restrictedOverride,
  compact = false,
  canEdit = true,
  onSaved,
}: {
  userId?: string;
  roleCode?: string | null;
  portalCustomerId?: string | null;
  restrictedOverride?: boolean | null;
  compact?: boolean;
  canEdit?: boolean;
  onSaved?: (restricted: boolean) => void;
}) {
  const [override, setOverride] = useState<boolean | null | undefined>(restrictedOverride);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const active = workHoursGateApplies({
    roleCode,
    portalCustomerId,
    restrictedOverride: override,
  });

  async function toggle() {
    if (!canEdit || saving) return;
    const next = !active;
    setSaving(true);
    setError('');
    try {
      if (userId) {
        await axios.patch(
          `${API}/users/${userId}`,
          { workHoursRestricted: next },
          { headers: authHeader() },
        );
      }
      setOverride(next);
      onSaved?.(next);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Kayıt güncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  const cardClass = `rounded-xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'}`;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Mesai Saati Kısıtı</p>
          <p className="text-xs text-slate-500">
            Açıkken mesai dışında panele girmez. Kapalıyken mesai bitiminden sonra da girer.
          </p>
        </div>
        <ToggleSwitch active={active} disabled={!canEdit || saving} onToggle={toggle} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
