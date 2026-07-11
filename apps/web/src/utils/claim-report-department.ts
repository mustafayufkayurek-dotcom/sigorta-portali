export type ReportDeptHint = {
  id: string;
  code: string;
  name: string;
  color: string;
  reportFormat: string;
};

export type ClaimReportDeptContext = {
  departmentId?: string | null;
  fileType?: string | null;
  department?: { id?: string | null; code?: string | null } | null;
  customer?: { subType?: string | null } | null;
};

export const DEPARTMENT_REPORT_LABEL: Record<string, string> = {
  'hasar-onarim': 'Hasar Onarım Raporu',
  'acil-yardim': 'Acil Yardım Raporu',
  'sovtaj': 'Sovtaj Raporu',
  'ozel-musteri': 'Özel Müşteri Raporu',
  'danismanlik': 'Danışmanlık Raporu',
};

/** Rapor sihirbazı Adım 1 — onaylı operasyon hatları (sıralı). */
export const OPERATION_LINE_DEFS = [
  { code: 'hasar-onarim', name: 'Hasar Onarım', reportFormat: 'repair' },
  { code: 'acil-yardim', name: 'Acil Yardım', reportFormat: 'emergency' },
  { code: 'sovtaj', name: 'Sovtaj', reportFormat: 'repair' },
  { code: 'ozel-musteri', name: 'Özel Müşteri', reportFormat: 'repair' },
  { code: 'danismanlik', name: 'Danışmanlık', reportFormat: 'repair' },
] as const;

function matchesOperationLineName(deptName: string, lineName: string): boolean {
  return deptName.trim().localeCompare(lineName, 'tr', { sensitivity: 'base' }) === 0;
}

/** Kod veya isimle eşleşen onaylı operasyon hatlarını döner; rapor formatını kanonikleştirir. */
export function resolveOperationLineDepartments<T extends ReportDeptHint>(
  departments: T[],
): Array<T & { code: string; reportFormat: string }> {
  return OPERATION_LINE_DEFS.flatMap((line) => {
    const dept =
      departments.find((d) => d.code === line.code) ??
      departments.find((d) => matchesOperationLineName(d.name, line.name));
    if (!dept) return [];
    return [{ ...dept, code: line.code, reportFormat: line.reportFormat }];
  });
}

/** Dosya bağlamından hedef departman kodunu çıkarır. */
export function inferClaimDepartmentCode(claim: ClaimReportDeptContext): string {
  const deptCode = (claim.department?.code ?? '').trim().toLowerCase();
  if (deptCode) return deptCode;

  const fileType = (claim.fileType ?? '').trim().toLowerCase();
  if (fileType.includes('acil') || fileType === 'acil_yardim') return 'acil-yardim';
  if (fileType.includes('sovtaj') || fileType === 'sovta') return 'sovtaj';
  if (fileType.includes('ozel') || fileType === 'ozel_operasyon' || fileType === 'private_customer') {
    return 'ozel-musteri';
  }
  if (fileType.includes('danisman')) return 'danismanlik';

  if ((claim.customer?.subType ?? '').trim().toLowerCase() === 'private_customer') {
    return 'ozel-musteri';
  }

  return 'hasar-onarim';
}

export function resolveClaimReportDepartment<T extends ReportDeptHint>(
  departments: T[],
  claim: ClaimReportDeptContext,
): T | null {
  if (claim.departmentId) {
    const byId = departments.find((d) => d.id === claim.departmentId);
    if (byId) return byId;
  }
  if (claim.department?.id) {
    const byNestedId = departments.find((d) => d.id === claim.department?.id);
    if (byNestedId) return byNestedId;
  }

  const code = inferClaimDepartmentCode(claim);
  return departments.find((d) => d.code === code) ?? null;
}

export function departmentReportLabel(code: string, reportFormat: string): string {
  return DEPARTMENT_REPORT_LABEL[code]
    ?? (reportFormat === 'emergency' ? 'Acil Yardım Raporu' : 'Hasar Onarım Raporu');
}
