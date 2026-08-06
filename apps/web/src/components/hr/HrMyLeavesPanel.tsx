'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Hourglass,
  Paperclip,
  Pencil,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { useToast } from '@/contexts/ToastContext';
import { countBusinessDaysInclusive, toTrDateLabel } from '@/utils/hr-leave-workdays';
import { TrDateInput } from '@/components/ui/TrDateInput';

type LeaveStatus = 'draft' | 'pending' | 'approved' | 'rejected';

type LeaveRow = {
  id: string;
  leaveType: string;
  leaveTypeLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  dayCount: number;
  reason: string | null;
  status: LeaveStatus;
  proxyName?: string | null;
  hasDocument?: boolean;
};

const LEAVE_TYPES = [
  { code: 'annual', label: 'Yıllık Ücretli İzin' },
  { code: 'sick', label: 'Hastalık / Raporlu İzin' },
  { code: 'maternity', label: 'Analık İzni' },
  { code: 'paternity', label: 'Babalık İzni' },
  { code: 'marriage', label: 'Evlilik İzni' },
  { code: 'bereavement', label: 'Ölüm İzni' },
  { code: 'unpaid', label: 'Ücretsiz İzin' },
];

const PROXY_OPTIONS = [
  { id: 'u1', name: 'Mehmet Kara', role: 'Saha Personeli' },
  { id: 'u2', name: 'Ayşe Demir', role: 'Dosya Sorumlusu' },
  { id: 'u3', name: 'Zeynep Aksoy', role: 'Dosya Sorumlusu' },
  { id: 'u4', name: 'Burak Çelik', role: 'Dosya Sorumlusu' },
];

const STATUS_LABEL: Record<LeaveStatus, string> = {
  draft: 'Taslak',
  pending: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const STATUS_BADGE: Record<LeaveStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-status-warning/15 text-status-warning',
  approved: 'bg-status-success/15 text-status-success',
  rejected: 'bg-status-danger/15 text-status-danger',
};

/** Önizleme — 4857 m.53: 8 yıl kıdem → 20 iş günü hakediş */
const ENTITLEMENT = { total: 20, used: 1, rule: '5 yıldan fazla – 15 yıl → 20 iş günü' };

const PREVIEW_ROWS: LeaveRow[] = [
  {
    id: 'ml1',
    leaveType: 'annual',
    leaveTypeLabel: 'Yıllık Ücretli İzin',
    startDateLabel: '11.08.2026',
    endDateLabel: '15.08.2026',
    dayCount: 5,
    reason: 'Aile Ziyareti',
    status: 'pending',
    proxyName: 'Mehmet Kara',
    hasDocument: true,
  },
  {
    id: 'ml2',
    leaveType: 'sick',
    leaveTypeLabel: 'Hastalık / Raporlu İzin',
    startDateLabel: '20.07.2026',
    endDateLabel: '21.07.2026',
    dayCount: 2,
    reason: 'Raporlu',
    status: 'approved',
    proxyName: 'Ayşe Demir',
    hasDocument: true,
  },
  {
    id: 'ml3',
    leaveType: 'annual',
    leaveTypeLabel: 'Yıllık Ücretli İzin',
    startDateLabel: '01.06.2026',
    endDateLabel: '05.06.2026',
    dayCount: 5,
    reason: null,
    status: 'rejected',
    proxyName: null,
    hasDocument: false,
  },
];

const iconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200';

type Props = {
  preview?: boolean;
};

/**
 * Personel izin talepleri — liste + yeni talep (vekalet + fiziki evrak zorunlu).
 */
export function HrMyLeavesPanel({ preview = true }: Props) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LeaveRow[]>(PREVIEW_ROWS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
    proxyId: '',
  });
  const [docFileName, setDocFileName] = useState<string | null>(null);

  const pendingDays = rows
    .filter((r) => r.status === 'pending' && r.leaveType === 'annual')
    .reduce((s, r) => s + r.dayCount, 0);
  const remaining = ENTITLEMENT.total - ENTITLEMENT.used - pendingDays;

  const workDayCalc = useMemo(
    () => countBusinessDaysInclusive(form.startDate, form.endDate),
    [form.startDate, form.endDate],
  );

  const remainingAfterRequest =
    workDayCalc && form.leaveType === 'annual'
      ? remaining - workDayCalc.workDays
      : null;

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return rows;
    return rows.filter((r) => r.leaveType === typeFilter);
  }, [rows, typeFilter]);

  const resetForm = () => {
    setForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '', proxyId: '' });
    setDocFileName(null);
    setEditId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    if (!form.startDate.trim() || !form.endDate.trim()) {
      showToast('error', 'Başlangıç Ve Bitiş Tarihi Seçin');
      return;
    }
    const calc = countBusinessDaysInclusive(form.startDate, form.endDate);
    if (!calc || calc.workDays < 1) {
      showToast('error', 'Geçerli Tarih Aralığı Ve En Az 1 İş Günü Gerekli');
      return;
    }
    if (!form.proxyId) {
      showToast('error', 'Vekalet İçin Personel Seçin');
      return;
    }
    if (!docFileName) {
      showToast('error', 'Fiziki İzin Evrakı Zorunludur (Rapor / Form Tarama)');
      return;
    }
    if (form.leaveType === 'annual' && remainingAfterRequest != null && remainingAfterRequest < 0) {
      showToast('error', 'Kalan İzin Gününden Fazla Talep Edilemez');
      return;
    }
    const type = LEAVE_TYPES.find((t) => t.code === form.leaveType);
    const proxy = PROXY_OPTIONS.find((p) => p.id === form.proxyId);
    const payload: LeaveRow = {
      id: editId ?? `local-${Date.now()}`,
      leaveType: form.leaveType,
      leaveTypeLabel: type?.label ?? 'İzin',
      startDateLabel: toTrDateLabel(form.startDate),
      endDateLabel: toTrDateLabel(form.endDate),
      dayCount: calc.workDays,
      reason: form.reason.trim() ? toTitleCaseTR(form.reason.trim()) : null,
      status: 'pending',
      proxyName: proxy?.name ?? null,
      hasDocument: true,
    };
    setRows((list) => {
      if (editId) return list.map((r) => (r.id === editId ? payload : r));
      return [payload, ...list];
    });
    showToast(
      'success',
      editId
        ? 'İzin Talebi Güncellendi — Yöneticiye Bildirim (Önizleme)'
        : 'İzin Talebi Gönderildi — Yöneticiye Mail (Önizleme)',
    );
    resetForm();
  };

  const startEdit = (row: LeaveRow) => {
    if (row.status !== 'pending') {
      showToast('info', 'Yalnız Onay Bekleyen Talepler Düzenlenebilir');
      return;
    }
    setEditId(row.id);
    setForm({
      leaveType: row.leaveType,
      startDate: row.startDateLabel,
      endDate: row.endDateLabel,
      reason: row.reason ?? '',
      proxyId: PROXY_OPTIONS.find((p) => p.name === row.proxyName)?.id ?? '',
    });
    setDocFileName(row.hasDocument ? 'mevcut-evrak.pdf' : null);
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <h3 className="text-base font-semibold text-content-primary">İzin Bakiyesi</h3>
          <p className="mt-0.5 text-xs text-content-tertiary">{ENTITLEMENT.rule}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 sm:grid-cols-4 sm:p-5">
          {(
            [
              {
                label: 'Hakedilen',
                hint: 'İş kanunu hesabı',
                value: ENTITLEMENT.total,
                icon: Wallet,
                wrap: 'border-slate-100 bg-slate-50/70',
                iconCls: 'bg-brand-50 text-brand-600',
                valueCls: 'text-content-primary',
              },
              {
                label: 'Kullanılan',
                hint: 'Onaylı gün',
                value: ENTITLEMENT.used,
                icon: CheckCircle2,
                wrap: 'border-slate-100 bg-slate-50/70',
                iconCls: 'bg-slate-200 text-slate-600',
                valueCls: 'text-content-primary',
              },
              {
                label: 'Onay Bekleyen',
                hint: 'Bekleyen talep',
                value: pendingDays,
                icon: Hourglass,
                wrap: 'border-amber-100 bg-amber-50/40',
                iconCls: 'bg-amber-100 text-status-warning',
                valueCls: 'text-status-warning',
              },
              {
                label: 'Kalan',
                hint: 'Kullanılabilir',
                value: remaining,
                icon: CalendarDays,
                wrap: 'border-emerald-100 bg-emerald-50/40',
                iconCls: 'bg-emerald-100 text-emerald-700',
                valueCls: 'text-emerald-700',
              },
            ] as const
          ).map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`rounded-xl border bg-white p-4 text-left ${card.wrap}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconCls}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${card.valueCls}`}>{card.value}</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-content-primary">İzin Taleplerim</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  typeFilter === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                }`}
              >
                Tümü
              </button>
              {LEAVE_TYPES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setTypeFilter(t.code)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                    typeFilter === t.code
                      ? 'bg-brand-600 text-white'
                      : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-content-tertiary">
              Bu filtrede izin talebi yok.
            </div>
          ) : (
            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="table-head-row">
                    <tr>
                      <th className="table-th text-left">Tür</th>
                      <th className="table-th">Başlangıç</th>
                      <th className="table-th">Bitiş</th>
                      <th className="table-th">İş Günü</th>
                      <th className="table-th">Durum</th>
                      <th
                        className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                        style={{ width: 100, minWidth: 100 }}
                      >
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {filtered.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="table-row">
                          <td className="px-5 py-3">
                            <p className="font-medium text-content-primary">{row.leaveTypeLabel}</p>
                            {row.proxyName ? (
                              <p className="text-xs text-content-tertiary">Vekil: {row.proxyName}</p>
                            ) : null}
                            {row.reason ? (
                              <p className="text-xs text-content-secondary">{row.reason}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-center text-content-secondary">
                            {row.startDateLabel}
                          </td>
                          <td className="px-4 py-3 text-center text-content-secondary">
                            {row.endDateLabel}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.dayCount}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[row.status]}`}
                            >
                              {STATUS_LABEL[row.status]}
                            </span>
                          </td>
                          <td
                            className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-2.5 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                            style={{ width: 100, minWidth: 100 }}
                          >
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                title="İzin Evrakları"
                                aria-label="İzin Evrakları"
                                className={iconBtnClass}
                                onClick={() =>
                                  setExpandedId((cur) => (cur === row.id ? null : row.id))
                                }
                              >
                                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {row.status === 'pending' ? (
                                <button
                                  type="button"
                                  title="Düzenle"
                                  aria-label="Düzenle"
                                  className={iconBtnClass}
                                  onClick={() => startEdit(row)}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {expandedId === row.id ? (
                          <tr>
                            <td colSpan={6} className="border-t border-border bg-slate-50/50 px-4 py-3">
                              <p className="text-xs text-content-secondary">
                                {row.hasDocument
                                  ? 'Fiziki izin evrakı yüklü (önizleme).'
                                  : 'Evrak eksik — talep tamamlanmamış sayılır.'}
                              </p>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="h-fit space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
              <UserPlus className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-primary">
                {editId ? 'İzin Talebini Düzenle' : 'Yeni İzin Talebi'}
              </h3>
              <p className="text-[11px] text-content-tertiary">Vekalet · Fiziki Evrak Zorunlu</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                İzin Tipi
              </label>
              <select
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                value={form.leaveType}
                onChange={(e) => setForm((p) => ({ ...p, leaveType: e.target.value }))}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-content-tertiary">
                Türler 4857 sayılı İş Kanunu izinleri ile sınırlıdır — «Diğer» yoktur.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Başlangıç Tarihi
              </label>
              <TrDateInput
                value={form.startDate}
                onChange={(startDate) => setForm((p) => ({ ...p, startDate }))}
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                aria-label="İzin başlangıç tarihi"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Bitiş Tarihi
              </label>
              <TrDateInput
                value={form.endDate}
                onChange={(endDate) => setForm((p) => ({ ...p, endDate }))}
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                aria-label="İzin bitiş tarihi"
              />
            </div>

            <div
              className={`rounded-xl border px-3 py-2.5 text-xs ${
                workDayCalc
                  ? remainingAfterRequest != null && remainingAfterRequest < 0
                    ? 'border-status-danger/30 bg-status-danger/5 text-status-danger'
                    : 'border-brand-100 bg-brand-50/50 text-content-secondary'
                  : 'border-dashed border-border bg-slate-50 text-content-tertiary'
              }`}
            >
              {workDayCalc ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-content-primary">
                    <CalendarDays className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                    {workDayCalc.workDays} İş Günü
                  </p>
                  <p className="mt-0.5">
                    Takvim {workDayCalc.calendarDays} gün · Hafta tatili (Cmt–Paz) düşüldü:{' '}
                    {workDayCalc.weekendDays} gün
                  </p>
                  {form.leaveType === 'annual' && remainingAfterRequest != null ? (
                    <p className="mt-1 font-medium">
                      Bu talep sonrası kalan:{' '}
                      <span
                        className={
                          remainingAfterRequest < 0
                            ? 'text-status-danger'
                            : 'text-status-success'
                        }
                      >
                        {remainingAfterRequest} gün
                      </span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  Takvimden başlangıç ve bitiş tarihini seçin. İş günü otomatik hesaplanır;
                  Cumartesi–Pazar düşülür.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Vekaleten Görevlendireceğim <span className="text-status-danger">*</span>
              </label>
              <select
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                value={form.proxyId}
                onChange={(e) => setForm((p) => ({ ...p, proxyId: e.target.value }))}
              >
                <option value="">— Vekil Seçin —</option>
                {PROXY_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Açıklama
              </label>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setForm((p) => ({ ...p, reason: v }));
                }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-content-tertiary">
                Fiziki İzin Evrakı <span className="text-status-danger">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setDocFileName(f ? f.name : null);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-3 py-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {docFileName ? docFileName : 'PDF / Görsel Yükle (Zorunlu)'}
              </button>
            </div>

            <button
              type="button"
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Clock3 className="h-4 w-4" />
              {editId ? 'Güncelle Ve Onaya Gönder' : 'Onaya Gönder'}
            </button>
            {editId ? (
              <button
                type="button"
                onClick={resetForm}
                className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-content-secondary hover:bg-slate-50"
              >
                Düzenlemeyi İptal
              </button>
            ) : null}
            {preview ? (
              <p className="text-[10px] text-content-tertiary">
                Önizleme — mail ve arşiv canlıda bağlanır.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
