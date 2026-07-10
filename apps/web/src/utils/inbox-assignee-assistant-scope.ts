import { departmentCodeMatchesArea } from '@/app/panel/kullanicilar/_lib/user-invite-config';

export interface AssistantCompanyOption {
  id: string;
  name: string;
}

export interface AssigneeAssistantScope {
  mode: 'all' | 'specific' | 'unknown';
  customerIds: string[];
  label: string;
}

interface ResponsibilityAssignmentRow {
  coverageType?: string;
  coverageConfig?: { customerIds?: string[] };
  department?: { code?: string };
  isActive?: boolean;
}

export function parseAssigneeAssistantScope(
  assignments: ResponsibilityAssignmentRow[],
  companyNameById: Map<string, string>,
): AssigneeAssistantScope {
  const acilRows = assignments.filter(
    (row) => row.isActive !== false && departmentCodeMatchesArea(row.department?.code, 'acil'),
  );
  if (acilRows.length === 0) {
    return { mode: 'unknown', customerIds: [], label: 'Acil yardım kapsamı tanımlı değil' };
  }
  if (acilRows.some((row) => row.coverageType === 'all')) {
    return { mode: 'all', customerIds: [], label: 'Tüm Asistan Firmaları' };
  }

  const customerIds = Array.from(
    new Set(
      acilRows.flatMap((row) => {
        const cfg = row.coverageConfig as { customerIds?: string[] } | undefined;
        return cfg?.customerIds ?? [];
      }),
    ),
  );

  if (customerIds.length === 0) {
    return { mode: 'all', customerIds: [], label: 'Tüm Asistan Firmaları' };
  }

  const names = customerIds
    .map((id) => companyNameById.get(id))
    .filter((name): name is string => Boolean(name));

  return {
    mode: 'specific',
    customerIds,
    label: names.length > 0 ? names.join(', ') : `${customerIds.length} asistan firması`,
  };
}
