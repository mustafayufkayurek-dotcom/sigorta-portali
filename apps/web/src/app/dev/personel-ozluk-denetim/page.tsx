'use client';

import { useState } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { AttendanceDayEndBanner } from '@/components/hr/AttendanceDayEndBanner';
import { AdminAttendanceSupervisionPanel } from '@/components/hr/AdminAttendanceSupervisionPanel';
import {
  AttendanceAccessGate,
  type AccessGateMode,
} from '@/components/hr/AttendanceAccessGate';
import { LeaveRequestProxyPreview } from '@/components/hr/LeaveRequestProxyPreview';
import { WorkHoursPreviewNote } from '@/components/hr/WorkHoursPreviewNote';
import {
  WorkHoursNoticeModal,
  type WorkHoursNoticeMode,
} from '@/components/hr/WorkHoursNoticeModal';

/**
 * Lokal tasarım önizleme — oturum gerektirmez.
 * URL: /dev/personel-ozluk-denetim
 */
export default function PersonelOzlukDenetimPreviewPage() {
  const [gateMode, setGateMode] = useState<AccessGateMode>('blocked');
  const [noticeMode, setNoticeMode] = useState<WorkHoursNoticeMode>('late_entry');
  const [noticeOpen, setNoticeOpen] = useState(true);

  const noticePreview: Record<
    WorkHoursNoticeMode,
    {
      clockLabel: string;
      expectedLabel?: string;
      closedReasonLabel?: string;
      workDateLabel: string;
    }
  > = {
    late_entry: {
      clockLabel: '09:20',
      expectedLabel: 'Beklenen mesai başlangıcı: 08:30',
      workDateLabel: '3 Ağustos 2026 · Pazartesi',
    },
    early_exit: {
      clockLabel: '17:05',
      expectedLabel: 'Beklenen mesai bitişi: 18:00',
      workDateLabel: '3 Ağustos 2026 · Pazartesi',
    },
    closed: {
      clockLabel: '13:01',
      expectedLabel: 'Cumartesi mesai: 08:30 – 13:00',
      closedReasonLabel: 'Mesai bitişinden (13:00) sonra sisteme giriş kapalıdır.',
      workDateLabel: '8 Ağustos 2026 · Cumartesi',
    },
  };

  return (
    <ToastProvider>
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-content-tertiary mb-1">
                Geliştirme / Personel Özlük
              </p>
              <h1 className="text-2xl font-bold text-content-primary">
                Personel Kuşbaşı Denetim — Önizleme
              </h1>
              <p className="text-sm text-content-secondary mt-1 max-w-2xl">
                Admin ekranı: süreç CTA yok, kişisel devam yok. KPI pencereleri ve personel
                listesi. Örnek veri.
              </p>
            </div>
            <span className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
              Local Önizleme
            </span>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">
                1) Mesai Popup Penceresi
              </h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'late_entry' as const, label: 'Geç Giriş 09:20' },
                    { key: 'early_exit' as const, label: 'Erken Çıkış 17:05' },
                    { key: 'closed' as const, label: 'Cumartesi 13:01 Kapalı' },
                  ]
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setNoticeMode(item.key);
                      setNoticeOpen(true);
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      noticeMode === item.key && noticeOpen
                        ? 'bg-brand-600 text-white'
                        : 'bg-white border border-border text-content-secondary hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-center">
              <p className="text-sm text-content-secondary">
                Popup açıkken arka plan kararır. Aşağıdaki düğmelerden senaryo seçin.
              </p>
              <p className="mt-2 text-xs text-content-tertiary">
                Geç giriş / erken çıkış: büyük saat + uyarı ikonu, masum dil, Devam Et.
                Pazar · resmi tatil · Cumartesi 13:01+: giriş kapalı, yöneticiniz ile irtibata geçin.
              </p>
              {!noticeOpen ? (
                <button
                  type="button"
                  onClick={() => setNoticeOpen(true)}
                  className="mt-4 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Popup’ı Tekrar Aç
                </button>
              ) : null}
            </div>
            <WorkHoursNoticeModal
              open={noticeOpen}
              mode={noticeMode}
              preview
              clockLabel={noticePreview[noticeMode].clockLabel}
              workDateLabel={noticePreview[noticeMode].workDateLabel}
              expectedLabel={noticePreview[noticeMode].expectedLabel}
              closedReasonLabel={noticePreview[noticeMode].closedReasonLabel}
              onContinue={() => setNoticeOpen(false)}
              onClose={() => setNoticeOpen(false)}
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">
                2) Panele İlk Giriş — Puantaj Kilidi
              </h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'blocked', label: 'Puantaj Yok' },
                    { key: 'on_leave', label: 'İzinli' },
                    { key: 'leave_return', label: 'İzin Dönüşü' },
                    { key: 'open', label: 'Onaylı' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGateMode(item.key)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      gateMode === item.key
                        ? 'bg-brand-600 text-white'
                        : 'bg-white border border-border text-content-secondary hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <AttendanceAccessGate
              preview
              mode={gateMode}
              onConfirmAttendance={() => setGateMode('open')}
              onConfirmLeaveReturn={() => setGateMode('blocked')}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              3) İzin Evrakı — Vekalet Seçimi
            </h2>
            <LeaveRequestProxyPreview />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              4) Mesai Kuralları (Kaynak)
            </h2>
            <WorkHoursPreviewNote preview />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              5) Puantaj Onay Uyarısı (Ayrı)
            </h2>
            <AttendanceDayEndBanner preview />
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100 overflow-x-auto">
              {['Özet Ve Denetim', 'Puantaj', 'İzinlerim', 'İzin Onay'].map(
                (label) => (
                  <div
                    key={label}
                    className={`px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 ${
                      label === 'Özet Ve Denetim'
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-slate-400'
                    }`}
                  >
                    {label}
                    {label === 'Özet Ve Denetim' && (
                      <span className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">
                        4
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
            <div className="p-6">
              <h2 className="sr-only">Özet Ve Denetim</h2>
              <p className="mb-4 text-xs text-content-tertiary">
                Admin tarafında geç/erken sayıları ve kişi detayı (denetim).
                Personele doğrudan “mesai ihlali” mesajı gitmez.
              </p>
              <AdminAttendanceSupervisionPanel preview />
            </div>
          </section>
        </div>
      </main>
    </ToastProvider>
  );
}
