'use client';

import { useMemo, useState } from 'react';
import { Eye, Mail, MoreVertical } from 'lucide-react';
import { AttendanceDayEndBanner } from './AttendanceDayEndBanner';
import { DAY_END_SUPERVISION_PREVIEW } from './attendance-day-end.preview';
import { useToast } from '@/contexts/ToastContext';

type DayKind = 'confirmed' | 'pending' | 'leave' | 'holiday' | 'weekend' | 'empty';

type MockDay = {
  day: number;
  kind: DayKind;
};

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200';

const KIND_CLASS: Record<DayKind, string> = {
  confirmed: 'bg-emerald-600 text-white border-emerald-800 font-semibold',
  pending: 'bg-red-600 text-white border-red-800 font-semibold',
  leave: 'bg-blue-700 text-white border-blue-900 font-semibold',
  holiday: 'bg-violet-700 text-white border-violet-900 font-semibold',
  weekend: 'bg-slate-200 text-slate-700 border-slate-400',
  empty: 'bg-transparent border-transparent text-transparent',
};

const KIND_LABEL: Record<DayKind, string> = {
  confirmed: 'Onayladı',
  pending: 'Onaylamadı',
  leave: 'İzinli',
  holiday: 'Tatil',
  weekend: 'Hafta Sonu',
  empty: '',
};

function buildMockMonth(year: number, month: number): MockDay[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0 Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Mon-first
  const cells: MockDay[] = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: 0, kind: 'empty' });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    let kind: DayKind = 'confirmed';
    if (dow === 0 || dow === 6) kind = 'weekend';
    else if (d === 15) kind = 'holiday';
    else if (d % 7 === 3) kind = 'pending';
    else if (d >= 11 && d <= 15) kind = 'leave';
    else if (d % 5 === 0) kind = 'pending';
    cells.push({ day: d, kind });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, kind: 'empty' });
  }

  return cells;
}

/**
 * Devam sekmesi — tasarım önizlemesi (API yok).
 */
export function HrAttendancePreviewPanel() {
  const { showToast } = useToast();
  const data = DAY_END_SUPERVISION_PREVIEW;
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id ?? '');
  const [month, setMonth] = useState(8);
  const [year, setYear] = useState(2026);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const employee = data.employees.find((e) => e.id === employeeId) ?? data.employees[0];
  const cells = useMemo(() => buildMockMonth(year, month), [year, month]);

  const kpi = useMemo(() => {
    const workDays = cells.filter((c) => c.day > 0 && c.kind !== 'weekend' && c.kind !== 'holiday' && c.kind !== 'empty');
    return {
      confirmed: workDays.filter((c) => c.kind === 'confirmed').length,
      pending: workDays.filter((c) => c.kind === 'pending').length,
      leave: workDays.filter((c) => c.kind === 'leave').length,
    };
  }, [cells]);

  const missing = data.employees.filter((e) => e.status === 'missing');

  return (
    <div className="space-y-4">
      {!bannerDismissed ? (
        <AttendanceDayEndBanner
          preview
          compact
          onDismiss={() => setBannerDismissed(true)}
          onGoAttendance={() => showToast('info', 'Önizleme — günlük onay akışı')}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-slate-50/60 px-4 py-3">
        <label className="text-xs font-medium text-content-tertiary">Personel</label>
        <select
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          {data.employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName}
              {emp.department ? ` · ${emp.department}` : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}. Ay
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Tasarım Önizleme · {employee?.fullName}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <h3 className="text-base font-semibold text-content-primary">Devam Özeti</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-4 sm:grid-cols-3 sm:p-5">
          {(
            [
              {
                label: 'Onaylı',
                hint: 'Onaylanan iş günü',
                value: kpi.confirmed,
                wrap: 'border-emerald-100 bg-emerald-50/40',
                icon: 'bg-emerald-100 text-emerald-700',
                valueCls: 'text-emerald-700',
              },
              {
                label: 'Onay Bekleyen',
                hint: 'Onaylanmayan iş günü',
                value: kpi.pending,
                wrap: 'border-red-100 bg-red-50/50',
                icon: 'bg-red-100 text-status-danger',
                valueCls: 'text-status-danger',
              },
              {
                label: 'İzinli',
                hint: 'İzinli iş günü',
                value: kpi.leave,
                wrap: 'border-slate-100 bg-slate-50/70',
                icon: 'bg-brand-50 text-brand-600',
                valueCls: 'text-content-primary',
              },
            ] as const
          ).map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border bg-white p-4 text-left ${card.wrap}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.icon}`}>
                  <span className="text-xs font-bold">{card.value}</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${card.valueCls}`}>{card.value}</p>
              </div>
              <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
              <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-content-primary">Aylık Devam Takvimi</p>
        </div>
        <div className="p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-content-tertiary">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => (
              <div
                key={`${cell.day}-${idx}`}
                title={cell.day ? KIND_LABEL[cell.kind] : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg border text-xs ${KIND_CLASS[cell.kind]}`}
              >
                {cell.day > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums">{cell.day}</span>
                    {cell.kind !== 'weekend' && cell.kind !== 'empty' ? (
                      <span className="mt-0.5 text-[9px] font-medium leading-tight">
                        {KIND_LABEL[cell.kind]}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-medium text-content-primary">
            {(
              [
                ['confirmed', 'Onayladı — yeşil'],
                ['pending', 'Onaylamadı — kırmızı'],
                ['leave', 'İzinli — mavi'],
                ['holiday', 'Tatil — mor'],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-sm border ${KIND_CLASS[k]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-content-primary">Onaylamayanlar</p>
          <span className="text-xs font-semibold text-status-danger">{missing.length} kişi</span>
        </div>
        {missing.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-content-tertiary">
            Onaylamayan personel yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th text-left">Personel</th>
                  <th className="table-th text-left">Departman</th>
                  <th className="table-th">Eksik Gün</th>
                  <th className="table-th">Son Onay</th>
                  <th
                    className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                    style={{ width: 120, minWidth: 120 }}
                  >
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="table-body">
                {missing.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="px-5 py-3">
                      <p className="font-medium text-content-primary">{row.fullName}</p>
                      <p className="text-xs text-content-tertiary">{row.roleLabel}</p>
                    </td>
                    <td className="px-5 py-3 text-content-secondary">{row.department}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-content-primary">
                      {row.missingDates.length}
                    </td>
                    <td className="px-4 py-3 text-center text-content-secondary">
                      {row.lastConfirmedDate
                        ? new Date(row.lastConfirmedDate).toLocaleDateString('tr-TR')
                        : '—'}
                    </td>
                    <td
                      className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                      style={{ width: 120, minWidth: 120 }}
                    >
                      <div className="relative flex items-center gap-0.5">
                        <button
                          type="button"
                          title="Görüntüle"
                          aria-label="Görüntüle"
                          className={iconBtnClass}
                          onClick={() => {
                            setEmployeeId(row.id);
                            showToast('info', `${row.fullName} devam takvimi seçildi`);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title="Hatırlatma Maili"
                          aria-label="Hatırlatma Maili"
                          className={iconBtnClass}
                          onClick={() =>
                            showToast('success', `${row.fullName} için hatırlatma (önizleme)`)
                          }
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title="Diğer"
                          aria-label="Diğer"
                          className={iconBtnClass}
                          onClick={() =>
                            setMenuOpenId((cur) => (cur === row.id ? null : row.id))
                          }
                        >
                          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        {menuOpenId === row.id ? (
                          <div className="absolute right-0 top-8 z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setMenuOpenId(null);
                                showToast('info', 'Devam kaydı — canlıda özlük panelinden açılır');
                              }}
                            >
                              Devam Kaydı
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
