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
  const code = normalizeNavRoleCode(roleCode);
  return code === 'office_staff';
}

export function isFieldStaffRole(roleCode: string): boolean {
  const code = normalizeNavRoleCode(roleCode);
  return code === 'field_staff';
}

const FINANCE_ROLE_CODES = new Set(['finance', 'finans', 'accountant']);

export function isFinanceRole(roleCode: string): boolean {
  return FINANCE_ROLE_CODES.has(normalizeNavRoleCode(roleCode));
}

function normalizeNavRoleCode(code: string): string {
  return String(code ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

/** Sidebar/route rol listesinde seed kodları ile legacy büyük harf eşleşmesi */
export function roleAllowedForNav(roleCode: string, allowedRoles: string[]): boolean {
  const normalized = normalizeNavRoleCode(roleCode);
  return allowedRoles.some((allowed) => {
    const entry = normalizeNavRoleCode(allowed);
    if (entry === normalized) return true;
    if (FINANCE_ROLE_CODES.has(entry) && FINANCE_ROLE_CODES.has(normalized)) return true;
    return false;
  });
}
