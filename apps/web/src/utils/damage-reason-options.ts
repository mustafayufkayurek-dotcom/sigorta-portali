import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export type DamageReasonOption = { code: string; name: string };

type DeptRow = { id: string; code: string; name: string; color: string; reportFormat: string };
type FileSubjectRow = { code: string; name: string; status: string; sortOrder: number };
type ClaimContext = { lossType?: string | null; claimSubjectId?: string | null };
type ClaimSubjectRow = { id: string; code: string; name: string };

function normalizeLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').replace(/-/g, ' ');
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await axios.get<{ data: T }>(url, { headers: authHeader() });
  return res.data.data;
}

export async function fetchActiveFileSubjects(departmentId: string): Promise<DamageReasonOption[]> {
  const rows = await apiGet<FileSubjectRow[]>(`${API}/departments/${departmentId}/file-subjects`);
  return (rows ?? [])
    .filter((row) => row.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ code: row.code, name: row.name }));
}

export async function resolveClaimSubjectCode(claimContext: ClaimContext | null): Promise<string | null> {
  if (!claimContext) return null;

  if (claimContext.claimSubjectId) {
    try {
      const subject = await apiGet<ClaimSubjectRow>(`${API}/claim-subjects/${claimContext.claimSubjectId}`);
      return subject?.code ?? null;
    } catch {
      /* claimSubjectId geçersiz olabilir; lossType ile devam */
    }
  }

  const lossType = claimContext.lossType?.trim();
  if (!lossType) return null;

  const subjects = await apiGet<ClaimSubjectRow[]>(`${API}/claim-subjects/active`);
  const normalizedLossType = normalizeLookupKey(lossType);
  const match = (subjects ?? []).find((subject) => {
    const normalizedName = normalizeLookupKey(subject.name);
    const normalizedCode = normalizeLookupKey(subject.code);
    return normalizedName === normalizedLossType || normalizedCode === normalizedLossType;
  });
  return match?.code ?? null;
}

export async function resolveDamageReasonOptions(
  departmentId: string,
  claimContext: ClaimContext | null,
): Promise<DamageReasonOption[]> {
  const departments = await apiGet<DeptRow[]>(`${API}/departments`);
  const selectedDept = departments.find((dept) => dept.id === departmentId);
  if (!selectedDept) return [];

  const subjectCode = await resolveClaimSubjectCode(claimContext);
  if (subjectCode) {
    const subjectDept = departments.find((dept) => dept.code === subjectCode);
    if (subjectDept) {
      const subjectReasons = await fetchActiveFileSubjects(subjectDept.id);
      if (subjectReasons.length > 0) return subjectReasons;
    }
  }

  return fetchActiveFileSubjects(selectedDept.id);
}
