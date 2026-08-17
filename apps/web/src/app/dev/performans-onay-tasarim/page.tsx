'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { formatTryAmount } from '@/utils/format-try-amount';

type RequestEvent = { id: string; type: string; message: string; at: string };

type PreviewApproval = {
  id: string;
  fileNumber: string;
  amount: number | null;
  delayHours: number;
  delayLabel: string;
  assignedUser: { firstName: string; lastName: string };
  requestCount: number;
  firstRequestedAt: string;
  lastRequestedAt: string;
  requests: RequestEvent[];
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function formatDateTimeTR(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestTypeLabel(type: string) {
  switch (type) {
    case 'ASSIGNMENT':
      return 'Onay Talebi';
    case 'REMINDER':
      return 'Hatırlatma';
    case 'TIMEOUT_WARNING':
      return 'Süre Uyarısı';
    default:
      return 'Bildirim';
  }
}

const ROWS: PreviewApproval[] = [
  {
    id: '1',
    fileNumber: 'HSR-2026-0142',
    amount: 48500,
    delayHours: 26,
    delayLabel: '1 gün',
    assignedUser: { firstName: 'Ayşe', lastName: 'Yılmaz' },
    requestCount: 3,
    firstRequestedAt: hoursAgo(26),
    lastRequestedAt: hoursAgo(4),
    requests: [
      { id: 'a', type: 'ASSIGNMENT', message: 'Onay talebi oluşturuldu', at: hoursAgo(26) },
      { id: 'b', type: 'REMINDER', message: 'Onay hatırlatması gönderildi', at: hoursAgo(12) },
      { id: 'c', type: 'TIMEOUT_WARNING', message: 'Süre aşımı uyarısı', at: hoursAgo(4) },
    ],
  },
  {
    id: '2',
    fileNumber: 'ACL-2026-0088',
    amount: 12300,
    delayHours: 5,
    delayLabel: '5 saat',
    assignedUser: { firstName: 'Mehmet', lastName: 'Demir' },
    requestCount: 1,
    firstRequestedAt: hoursAgo(5),
    lastRequestedAt: hoursAgo(5),
    requests: [
      { id: 'd', type: 'ASSIGNMENT', message: 'Onay talebi oluşturuldu', at: hoursAgo(5) },
    ],
  },
  {
    id: '3',
    fileNumber: 'HSR-2026-0201',
    amount: null,
    delayHours: 0,
    delayLabel: 'Az önce',
    assignedUser: { firstName: 'Elif', lastName: 'Kaya' },
    requestCount: 1,
    firstRequestedAt: hoursAgo(0.3),
    lastRequestedAt: hoursAgo(0.3),
    requests: [
      { id: 'e', type: 'ASSIGNMENT', message: 'Onay talebi oluşturuldu', at: hoursAgo(0.3) },
    ],
  },
];

/**
 * Lokal tasarım önizleme — oturum gerektirmez.
 * URL: /dev/performans-onay-tasarim
 */
export default function PerformansOnayTasarimPreviewPage() {
  const [selected, setSelected] = useState<PreviewApproval | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-content-tertiary">
              Geliştirme / Performans Yönetimi
            </p>
            <h1 className="text-2xl font-bold text-content-primary">
              Bekleyen Onaylar — Tasarım Önizleme
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-content-secondary">
              KPI pencereleri (ikon + ortalama), onay listesi (personel, dosya, bedel, gecikme) ve
              dosya detayında talep tarihi / tekrar sayısı. Örnek veri.
            </p>
          </div>
          <span className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
            Local Önizleme
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: 'Toplam Aktif Atama',
              value: '22',
              icon: Users,
              iconClass: 'bg-brand-600/10 text-brand-600',
              valueClass: 'text-content-primary',
            },
            {
              label: 'Bugün Tamamlanan',
              value: '0',
              icon: CheckCircle2,
              iconClass: 'bg-status-success/10 text-status-success',
              valueClass: 'text-content-primary',
            },
            {
              label: 'Ort. Kapama Süresi',
              value: '—',
              icon: Timer,
              iconClass: 'bg-slate-100 text-content-secondary',
              valueClass: 'text-content-primary',
            },
            {
              label: 'Onay Bekleyen',
              value: String(ROWS.length),
              icon: AlertTriangle,
              iconClass: 'bg-status-warning/10 text-status-warning',
              valueClass: 'text-status-warning',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="relative rounded-xl border border-border bg-white px-4 pb-5 pt-4 text-center shadow-sm"
              >
                <div
                  className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg ${card.iconClass}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <p className="px-6 text-xs font-medium text-content-tertiary">{card.label}</p>
                <p className={`mt-2 text-2xl font-bold tracking-tight ${card.valueClass}`}>
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-semibold text-content-primary">Bekleyen Onaylar</p>
            <p className="mt-0.5 text-xs text-content-tertiary">
              Dosya satırına tıklayarak talep geçmişini açın
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/80">
                  {['Personel', 'Dosya No', 'Bedel', 'Gecikme Süresi', 'Talep', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3.5 text-center text-xs font-semibold text-content-tertiary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ROWS.map((a) => {
                  const delayUrgent = a.delayHours >= 24;
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition-colors hover:bg-brand-600/[0.03]"
                      onClick={() => setSelected(a)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-content-secondary">
                            {a.assignedUser.firstName.charAt(0)}
                            {a.assignedUser.lastName.charAt(0)}
                          </span>
                          <span className="font-medium text-content-primary">
                            {a.assignedUser.firstName} {a.assignedUser.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
                          <FileText className="h-3.5 w-3.5 text-brand-600" />
                          {a.fileNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold tabular-nums">
                        {a.amount != null
                          ? formatTryAmount(a.amount, { fractionDigits: 0 })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            delayUrgent
                              ? 'bg-status-danger/10 text-status-danger'
                              : 'bg-status-warning/10 text-status-warning'
                          }`}
                        >
                          <Clock3 className="h-3 w-3" />
                          {a.delayLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-bold text-brand-700">
                          {a.requestCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-600/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(a);
                          }}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[100vw] flex-col bg-white shadow-2xl">
            <div className="border-b border-border bg-slate-50/80 px-6 py-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-content-primary">
                      {selected.fileNumber}
                    </p>
                    <p className="text-xs text-content-secondary">
                      {selected.assignedUser.firstName} {selected.assignedUser.lastName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-white px-3 py-2.5 text-center">
                  <p className="text-xs text-content-tertiary">Bedel</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {selected.amount != null
                      ? formatTryAmount(selected.amount, { fractionDigits: 0 })
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-white px-3 py-2.5 text-center">
                  <p className="text-xs text-content-tertiary">Gecikme</p>
                  <p className="mt-0.5 text-sm font-semibold text-status-warning">
                    {selected.delayLabel}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="mb-3 text-xs font-semibold text-content-secondary">Onay Talebi</p>
              <div className="mb-5 rounded-xl border border-border bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Talep Edilmiş
                  </span>
                  <span className="rounded-full bg-brand-600/10 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    {selected.requestCount} Defa
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-tertiary">İlk Talep</dt>
                    <dd className="font-medium">{formatDateTimeTR(selected.firstRequestedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-tertiary">Son Talep</dt>
                    <dd className="font-medium">{formatDateTimeTR(selected.lastRequestedAt)}</dd>
                  </div>
                </dl>
              </div>
              <p className="mb-3 text-xs font-semibold text-content-secondary">Talep Geçmişi</p>
              <ol className="space-y-3">
                {selected.requests.map((ev, idx) => (
                  <li
                    key={ev.id}
                    className="relative rounded-xl border border-border bg-white px-4 py-3 pl-10"
                  >
                    <span className="absolute left-3 top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-semibold">{requestTypeLabel(ev.type)}</p>
                    <p className="mt-0.5 text-xs text-content-secondary">
                      {formatDateTimeTR(ev.at)}
                    </p>
                    <p className="mt-1.5 text-xs text-content-tertiary">{ev.message}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
