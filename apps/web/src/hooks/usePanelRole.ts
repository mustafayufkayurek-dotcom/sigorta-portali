'use client';

import { useEffect, useState } from 'react';

export function usePanelRoleCode(): string {
  const [roleCode, setRoleCode] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      setRoleCode(String(user?.role?.code ?? user?.roleCode ?? '').toLowerCase());
    } catch {
      setRoleCode('');
    }
  }, []);

  return roleCode;
}

export function isOfficeStaffRole(roleCode: string): boolean {
  return roleCode === 'office_staff' || roleCode === 'office staff';
}
