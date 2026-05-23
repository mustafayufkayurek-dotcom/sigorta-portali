'use client';

import axios from 'axios';
import { API, authHeader } from '@/utils/api';

export const TEST_NOTE_PRIORITIES = ['P0', 'P1', 'P2', 'KARAR_GEREKLI'] as const;
export const TEST_NOTE_STATUSES = ['YENI', 'INCELEMEDE', 'DUZELTME_BEKLIYOR', 'CANLIDA', 'KABUL', 'BACKLOG'] as const;
export const WORK_ITEM_SOURCES = ['TEST_NOTU', 'KULLANICI_TALEBI', 'TEKNIK', 'DANISMAN'] as const;
export const WORK_ITEM_STATUSES = ['ACIK', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'IPTAL'] as const;

export type TestPriority = (typeof TEST_NOTE_PRIORITIES)[number];
export type TestStatus = (typeof TEST_NOTE_STATUSES)[number];
export type WorkSource = (typeof WORK_ITEM_SOURCES)[number];
export type WorkStatus = (typeof WORK_ITEM_STATUSES)[number];

export type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
};

export type TestNoteFormat = {
  id: string;
  testNoteId: string;
  sorunOzeti: string;
  beklenenDavranis: string;
  etkiSinifi: string;
  oncelik: TestPriority;
  muhendislikTalimati: string;
  kabulKriteri: string;
  kanitBeklentisi: string;
  onayli: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TestNote = {
  id: string;
  testNo: string;
  ekranModul: string;
  kullaniciGozlemi: string;
  beklenenDavranis: string;
  ekranGoruntusu?: string | null;
  oncelik: TestPriority;
  durum: TestStatus;
  tekrarDurumu: boolean;
  isArchived: boolean;
  managerIslemNotu?: string | null;
  islemTarihi?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  format?: TestNoteFormat | null;
};

export type WorkItem = {
  id: string;
  siraNo: number;
  konu: string;
  kaynak: WorkSource;
  oncelik: TestPriority;
  sorumluId?: string | null;
  hedefTarih?: string | null;
  hatirlatmaTarih?: string | null;
  durum: WorkStatus;
  kullaniciYorumu?: string | null;
  kanit?: string | null;
  kapanisNotu?: string | null;
  managerIslemNotu?: string | null;
  islemTarihi?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  sorumlu?: UserSummary | null;
};

type ListResponse<T> = {
  success: boolean;
  data: T[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
};

function paramsClean(input: Record<string, string | number | boolean | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== '' && value !== undefined));
}

export async function fetchTestNotes(filters: Record<string, string | number | boolean | undefined>) {
  const response = await axios.get<ListResponse<TestNote>>(`${API}/test-notes`, {
    headers: authHeader(),
    params: paramsClean(filters),
  });
  return response.data;
}

export async function createTestNote(payload: Record<string, unknown>) {
  const response = await axios.post(`${API}/test-notes`, payload, { headers: authHeader() });
  return response.data;
}

export async function updateTestNote(id: string, payload: Record<string, unknown>) {
  const response = await axios.patch(`${API}/test-notes/${id}`, payload, { headers: authHeader() });
  return response.data;
}

export async function deleteTestNote(id: string) {
  const response = await axios.delete(`${API}/test-notes/${id}`, { headers: authHeader() });
  return response.data;
}

export async function generateConsultantFormat(id: string) {
  const response = await axios.post(`${API}/test-notes/${id}/generate-format`, {}, { headers: authHeader() });
  return response.data;
}

export async function fetchWorkItems(filters: Record<string, string | number | boolean | undefined>) {
  const response = await axios.get<ListResponse<WorkItem>>(`${API}/work-items`, {
    headers: authHeader(),
    params: paramsClean(filters),
  });
  return response.data;
}

export async function createWorkItem(payload: Record<string, unknown>) {
  const response = await axios.post(`${API}/work-items`, payload, { headers: authHeader() });
  return response.data;
}

export async function updateWorkItem(id: string, payload: Record<string, unknown>) {
  const response = await axios.patch(`${API}/work-items/${id}`, payload, { headers: authHeader() });
  return response.data;
}

export async function deleteWorkItem(id: string) {
  const response = await axios.delete(`${API}/work-items/${id}`, { headers: authHeader() });
  return response.data;
}

export async function fetchUsers() {
  const response = await axios.get(`${API}/users`, {
    headers: authHeader(),
    params: { page: 1, limit: 200 },
  });
  return response.data?.data ?? [];
}

export async function downloadBlob(url: string, params: Record<string, string | number | boolean | undefined>, fileName: string) {
  const response = await axios.get(url, {
    headers: authHeader(),
    params: paramsClean(params),
    responseType: 'blob',
  });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}