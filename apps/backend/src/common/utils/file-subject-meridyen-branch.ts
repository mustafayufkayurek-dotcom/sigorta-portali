export type MeridyenBranchType = 'hasar' | 'acil_yardim';

export interface DepartmentBranchHint {
  code: string;
  reportFormat: string;
}

export interface FileSubjectBranchRow {
  id: string;
  name: string;
  sortOrder: number;
  status: string;
}

export interface MeridyenServiceBranchView {
  id: string;
  name: string;
  type: MeridyenBranchType;
  scope: 'meridyen';
  isActive: boolean;
  sortOrder: number;
}

export function departmentToMeridyenType(dept: DepartmentBranchHint): MeridyenBranchType {
  if (dept.code === 'acil-yardim' || dept.reportFormat === 'emergency') {
    return 'acil_yardim';
  }
  return 'hasar';
}

export function mapFileSubjectToMeridyenBranch(
  subject: FileSubjectBranchRow,
  dept: DepartmentBranchHint,
): MeridyenServiceBranchView {
  return {
    id: subject.id,
    name: subject.name,
    type: departmentToMeridyenType(dept),
    scope: 'meridyen',
    isActive: subject.status === 'active',
    sortOrder: subject.sortOrder,
  };
}
