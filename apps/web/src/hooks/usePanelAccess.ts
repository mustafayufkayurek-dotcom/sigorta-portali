'use client';

import { useEffect, useState } from 'react';
import type { OperationAreaCode } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import {
  canAccessAcilYardim,
  panelShowsFinanceWidgets,
  readStoredPanelUser,
  userOperationArea,
} from '@/utils/panel-access';
import { isFieldStaffRole, isFinanceRole, isOfficeStaffRole } from '@/hooks/usePanelRole';

export function usePanelAccess() {
  const [roleCode, setRoleCode] = useState('');
  const [operationArea, setOperationArea] = useState<OperationAreaCode>('');

  useEffect(() => {
    const user = readStoredPanelUser();
    if (!user) return;
    setRoleCode(String(user.role?.code ?? '').toLowerCase());
    setOperationArea(userOperationArea(user));
  }, []);

  return {
    roleCode,
    operationArea,
    isOfficeStaff: isOfficeStaffRole(roleCode),
    isFieldStaff: isFieldStaffRole(roleCode),
    isFinance: isFinanceRole(roleCode),
    showAcilYardim: canAccessAcilYardim(roleCode, operationArea),
    showFinanceWidgets: panelShowsFinanceWidgets(roleCode),
  };
}
