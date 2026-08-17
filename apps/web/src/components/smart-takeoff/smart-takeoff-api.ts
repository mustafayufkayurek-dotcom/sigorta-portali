'use client';

import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import type { TakeoffLineItem, TakeoffRun } from './smart-takeoff.types';

function unwrap<T>(payload: unknown): T {
  const p = payload as { data?: T };
  return (p?.data ?? payload) as T;
}

export async function listTakeoffRuns(claimFileId: string): Promise<TakeoffRun[]> {
  const res = await axios.get(`${API}/claim-files/${claimFileId}/smart-takeoff/runs`, {
    headers: authHeader(),
  });
  const data = unwrap<TakeoffRun[]>(res.data);
  return Array.isArray(data) ? data : [];
}

export async function getTakeoffRun(claimFileId: string, runId: string): Promise<TakeoffRun> {
  const res = await axios.get(`${API}/claim-files/${claimFileId}/smart-takeoff/runs/${runId}`, {
    headers: authHeader(),
  });
  return unwrap<TakeoffRun>(res.data);
}

export async function createTakeoffRun(
  claimFileId: string,
  body?: { note?: string; measureElementIds?: string[] },
): Promise<TakeoffRun> {
  const res = await axios.post(`${API}/claim-files/${claimFileId}/smart-takeoff/runs`, body ?? {}, {
    headers: authHeader(),
  });
  return unwrap<TakeoffRun>(res.data);
}

export async function applyTakeoffLineItemOverride(
  claimFileId: string,
  runId: string,
  lineItemId: string,
  body: { quantityOverride: number; reason: string },
): Promise<TakeoffLineItem> {
  const res = await axios.patch(
    `${API}/claim-files/${claimFileId}/smart-takeoff/runs/${runId}/line-items/${lineItemId}/override`,
    body,
    { headers: authHeader() },
  );
  return unwrap<TakeoffLineItem>(res.data);
}

export function formatTakeoffQuantity(value: number, unit: string): string {
  const formatted = Number.isFinite(value)
    ? value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
    : '—';
  return `${formatted} ${unit}`;
}

export function fmtTakeoffDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
