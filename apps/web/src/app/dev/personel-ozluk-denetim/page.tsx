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

/**
 * Lokal tasarım önizleme — oturum gerektirmez.
 * URL: /dev/personel-ozluk-denetim
 */
export default function PersonelOzlukDenetimPreviewPage() {
  const [gateMode, setGateMode] = useState<AccessGateMode>('blocked');

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
                Puantaj Denetimi — Tasarım Önizleme
              </h1>
              <p className="text-sm text-content-secondary mt-1 max-w-2xl">
                Yumuşak giriş notu, izin gününde ekran pasif, vekalet seçimi ve
                mesai saatleri. Örnek veri — API henüz bağlı değil.
              </p>
            </div>
            <span className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
              Local Önizleme
            </span>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">
                1) Panele İlk Giriş — Kullanım Kilidi
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
            <ul className="text-xs text-content-tertiary space-y-1 list-disc list-inside">
              <li>Puantaj onaylanmadan diğer sayfalar aktif olmaz.</li>
              <li>
                Onaylı izin gününde ilgili personelin ekranı pasiftir (vekalet
                çalışır).
              </li>
              <li>İzin bitince önce “İzin Dönüşünü Onayla”, sonra puantaj.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              2) İzin Evrakı — Vekalet Seçimi
            </h2>
            <LeaveRequestProxyPreview />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              3) Mesai Saatleri (Sonraki Denetim)
            </h2>
            <WorkHoursPreviewNote />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-content-primary">
              4) Personel Ekranı — Gün Sonu Uyarısı
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
                Admin / yönetici / finans: birleşik özet. Personel yalnız kendi
                özetini görür.
              </p>
              <AdminAttendanceSupervisionPanel preview />
            </div>
          </section>
        </div>
      </main>
    </ToastProvider>
  );
}
