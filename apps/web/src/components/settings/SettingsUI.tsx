'use client';

import React from 'react';

// ── Status Badge ───────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function StatusBadge({
  active,
  activeLabel = 'Aktif',
  inactiveLabel = 'Pasif',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-500'}`}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

// ── Icon Buttons ───────────────────────────────────────────────────────────────

interface EditButtonProps {
  onClick: () => void;
  title?: string;
}

export function EditButton({ onClick, title = 'Düzenle' }: EditButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </button>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  title?: string;
}

export function DeleteButton({ onClick, title = 'Sil' }: DeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-status-danger dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}

// ── Settings Table ─────────────────────────────────────────────────────────────

interface SettingsTableProps {
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}

export function SettingsTable({
  loading,
  empty,
  emptyText = 'Kayıt bulunamadı.',
  children,
}: SettingsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Yükleniyor...
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-16 text-center">
        <svg className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm text-slate-400 dark:text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  );
}

export function SettingsTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function SettingsTableTh({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 sm:px-5 ${className}`}
    >
      {children}
    </th>
  );
}

/** Tablo satır sırası (1..n); sayfalı listelerde pageOffset kullanın. */
export function settingsRowIndexValue(index: number, pageOffset = 0): number {
  return pageOffset + index + 1;
}

export function SettingsRowIndexTh({ className = '' }: { className?: string }) {
  return (
    <SettingsTableTh className={`w-16 text-center ${className}`.trim()}>
      Sıra
    </SettingsTableTh>
  );
}

export function SettingsRowIndexTd({
  index,
  pageOffset = 0,
  className = '',
}: {
  index: number;
  pageOffset?: number;
  className?: string;
}) {
  return (
    <SettingsTableTd
      className={`text-center text-slate-500 tabular-nums text-sm ${className}`.trim()}
    >
      {settingsRowIndexValue(index, pageOffset)}
    </SettingsTableTd>
  );
}

export function SettingsTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">{children}</tbody>;
}

export function SettingsTableRow({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function SettingsTableTd({
  children,
  className = '',
  title,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-3.5 text-sm text-slate-700 dark:text-slate-300 sm:px-5 ${className}`}
      title={title}
    >
      {children}
    </td>
  );
}

// ── Actions Cell ───────────────────────────────────────────────────────────────

export function SettingsTableActions({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right sm:px-5">
      <div
        className="flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </td>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500';

export const labelCls = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';
