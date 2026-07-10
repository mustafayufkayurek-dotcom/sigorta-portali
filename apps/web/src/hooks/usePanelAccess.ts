'use client';

import { roleCodesMatch } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { usePanelUser } from '@/contexts/PanelUserContext';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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

function readAccessState(contextUser?: PanelUserLike | null) {
  const user = resolvePanelUser(contextUser ?? null);
  const roleCode = String(user?.role?.code ?? '').toLowerCase();
  return {
    roleCode,
    operationArea: userOperationArea(user),
    operationalAccessGrants: user?.operationalAccessGrants ?? [],
  };
}

function isManagementRole(roleCode: string): boolean {
  return roleCodesMatch(roleCode, 'admin') || roleCodesMatch(roleCode, 'manager');
}

export function usePanelAccess() {
  const contextUser = usePanelUser();
  const [state, setState] = useState(() => readAccessState(contextUser));

  const syncAccessState = useCallback(() => {
    setState(readAccessState(contextUser));
  }, [contextUser]);

  useLayoutEffect(() => {
    syncAccessState();
  }, [syncAccessState]);

  useEffect(() => {
    const onUserUpdated = () => syncAccessState();
    window.addEventListener('meridyen:user-updated', onUserUpdated);
    window.addEventListener('storage', onUserUpdated);
    return () => {
      window.removeEventListener('meridyen:user-updated', onUserUpdated);
      window.removeEventListener('storage', onUserUpdated);
    };
  }, [syncAccessState]);

  const { roleCode, operationArea, operationalAccessGrants } = state;

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
}

export function notifyPanelUserUpdated(user?: PanelUserLike | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  window.dispatchEvent(new Event('meridyen:user-updated'));
}
