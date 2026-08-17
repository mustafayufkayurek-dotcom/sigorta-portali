'use client';

import { roleCodesMatch } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { usePanelUser } from '@/contexts/PanelUserContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canAccessAcilYardim,
  hasActiveFunctionDelegation,
  panelShowsFinanceWidgets,
  readStoredPanelUser,
  userOperationArea,
  type PanelUserLike,
} from '@/utils/panel-access';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole } from '@/hooks/usePanelRole';

function resolvePanelUser(contextUser: PanelUserLike | null | undefined): PanelUserLike | null {
  return contextUser ?? readStoredPanelUser();
}

function isManagementRole(roleCode: string): boolean {
  return roleCodesMatch(roleCode, 'admin') || roleCodesMatch(roleCode, 'manager');
}

export function usePanelAccess() {
  const contextUser = usePanelUser();
  const [storageTick, setStorageTick] = useState(0);

  const syncFromStorage = useCallback(() => {
    setStorageTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const onUserUpdated = () => syncFromStorage();
    window.addEventListener('meridyen:user-updated', onUserUpdated);
    window.addEventListener('storage', onUserUpdated);
    return () => {
      window.removeEventListener('meridyen:user-updated', onUserUpdated);
      window.removeEventListener('storage', onUserUpdated);
    };
  }, [syncFromStorage]);

  const access = useMemo(() => {
    void storageTick;
    const user = resolvePanelUser(contextUser);
    const roleCode = String(user?.role?.code ?? '').toLowerCase();
    const operationArea = userOperationArea(user);
    const operationalAccessGrants = user?.operationalAccessGrants ?? [];

    return {
      roleCode,
      operationArea,
      operationalAccessGrants,
      isManagement: isManagementRole(roleCode),
      isOfficeStaff: isOfficeStaffRole(roleCode),
      isFieldStaff: isFieldStaffRole(roleCode),
      isFinance: isFinanceRole(roleCode),
      showAcilYardim: canAccessAcilYardim(roleCode, operationArea, operationalAccessGrants),
      showFinanceWidgets: panelShowsFinanceWidgets(roleCode),
      showFinanceExtraAccessAcil:
        isFinanceRole(roleCode) && hasActiveFunctionDelegation(operationalAccessGrants, 'acil_yardim'),
      showFinanceExtraAccessHasar:
        isFinanceRole(roleCode) && hasActiveFunctionDelegation(operationalAccessGrants, 'hasar'),
    };
  }, [contextUser, storageTick]);

  return access;
}

export function notifyPanelUserUpdated(user?: PanelUserLike | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  window.dispatchEvent(new Event('meridyen:user-updated'));
}
