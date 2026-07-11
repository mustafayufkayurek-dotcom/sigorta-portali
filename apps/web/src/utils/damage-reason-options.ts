import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export type DamageReasonOption = { code: string; name: string };

type DeptRow = { id: string; code: string; name: string; color: string; reportFormat: string };
type FileSubjectRow = { code: string; name: string; status: string; sortOrder: number };

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

/** Operasyon hattının dosya konularını hasar nedeni listesi olarak döner. */
export async function resolveDamageReasonOptions(
  departmentId: string,
): Promise<DamageReasonOption[]> {
  const reasons = await fetchActiveFileSubjects(departmentId);
  if (reasons.length > 0) return reasons;

  const departments = await apiGet<DeptRow[]>(`${API}/departments`);
  const selected = departments.find((dept) => dept.id === departmentId);
  const hasarDept = departments.find((dept) => dept.code === 'hasar-onarim');
  if (hasarDept && selected?.code !== 'hasar-onarim') {
    return fetchActiveFileSubjects(hasarDept.id);
  }

  return [];
}
