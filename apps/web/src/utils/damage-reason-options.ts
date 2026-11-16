import axios from 'axios';
import { matchDepartmentForFileSubjects } from '@sigorta/shared';
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

/** Operasyon hattının kendi dosya konularını döner. Başka hattın listesi karışmaz. */
export async function resolveDamageReasonOptions(
  departmentId: string,
): Promise<DamageReasonOption[]> {
  return fetchActiveFileSubjects(departmentId);
}

async function subjectNamesForCode(
  departments: DeptRow[],
  departmentCode: string,
): Promise<string[]> {
  const dept = matchDepartmentForFileSubjects(departments, departmentCode);
  if (!dept) return [];
  const rows = await fetchActiveFileSubjects(dept.id);
  return rows.map((row) => row.name).filter(Boolean);
}

/** Yeni Dosya / düzenle: seçilen hattın Ayarlar → Dosya Konuları. Hasar Tespit boşsa Hasar Onarım yedeği. */
export async function fetchDepartmentFileSubjectNames(departmentCode: string): Promise<string[]> {
  const departments = await apiGet<DeptRow[]>(`${API}/departments`);
  const primary = await subjectNamesForCode(departments, departmentCode);
  if (primary.length > 0) return primary;
  const folded = String(departmentCode ?? '').trim().toLocaleLowerCase('tr-TR');
  if (folded === 'hasar-tespit') {
    return subjectNamesForCode(departments, 'hasar-onarim');
  }
  return [];
}

export async function fetchInboxFileSubjectNames(
  kind: 'claim' | 'emergency',
): Promise<string[]> {
  const code = kind === 'emergency' ? 'acil-yardim' : 'hasar-onarim';
  try {
    const departments = await apiGet<DeptRow[]>(`${API}/departments`);
    const dept = matchDepartmentForFileSubjects(departments, code);
    if (dept) {
      const rows = await fetchActiveFileSubjects(dept.id);
      if (rows.length > 0) return rows.map((r) => r.name);
    }
  } catch {
    /* katalog yoksa claim-subjects */
  }
  try {
    const category = kind === 'emergency' ? 'acil_yardim' : 'hasar';
    const rows = await apiGet<Array<{ name: string }>>(`${API}/claim-subjects/active?category=${category}`);
    return (rows ?? []).map((r) => r.name).filter(Boolean);
  } catch {
    return [];
  }
}
