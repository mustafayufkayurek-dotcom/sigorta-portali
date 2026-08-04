'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import axios from 'axios';

type LeaveType = { code: string; label: string; active: boolean };

const FALLBACK_LEAVE_TYPES: LeaveType[] = [
  { code: 'annual', label: 'Yıllık İzin', active: true },
  { code: 'sick', label: 'Hastalık İzni', active: true },
  { code: 'unpaid', label: 'Ücretsiz İzin', active: true },
  { code: 'other', label: 'Diğer', active: true },
];

const PROXY_OPTIONS = [
  { id: 'u1', name: 'Mehmet Kara', role: 'Saha Personeli' },
  { id: 'u2', name: 'Ayşe Demir', role: 'Dosya Sorumlusu' },
  { id: 'u3', name: 'Zeynep Aksoy', role: 'Dosya Sorumlusu' },
  { id: 'u4', name: 'Burak Çelik', role: 'Dosya Sorumlusu' },
];

type Step = 'form' | 'pending_admin' | 'admin_approved';

/**
 * İzin evrağında vekalet seçimi — admin onayından sonra devreye girer.
 * İzin türleri: Ayarlar → Tanımlar → Personel
 */
export function LeaveRequestProxyPreview() {
  const [proxyId, setProxyId] = useState('u1');
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(FALLBACK_LEAVE_TYPES);
  const [step, setStep] = useState<Step>('form');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/system-settings/hr-leave-types`, {
          headers: authHeader(),
        });
        const rows = (res.data?.data ?? []) as LeaveType[];
        const active = rows.filter((r) => r.active !== false);
        if (alive && active.length > 0) {
          setLeaveTypes(active);
          setLeaveType(active[0].code);
        }
      } catch {
        /* önizleme: varsayılan liste */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const proxy = PROXY_OPTIONS.find((p) => p.id === proxyId);
  const selectedLeave = leaveTypes.find((t) => t.code === leaveType);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
              <UserPlus className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-content-primary">
                İzin Evrakı — Vekalet Seçimi
              </p>
              <p className="text-xs text-content-tertiary">
                Tasarım Önizleme · Admin onayından sonra devreye girer
              </p>
            </div>
          </div>
          <Link
            href="/panel/ayarlar/personel"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            İzin Türlerini Tanımla →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-content-tertiary mb-1">
              İzin Tipi
            </label>
            <select
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              value={leaveType}
              disabled={step !== 'form'}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              {leaveTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-content-tertiary mb-1">
              Vekaleten Görevlendireceğim
            </label>
            <select
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm disabled:opacity-60"
              value={proxyId}
              disabled={step !== 'form'}
              onChange={(e) => setProxyId(e.target.value)}
            >
              {PROXY_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.role}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-content-secondary rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
          İzin türleri Ayarlar → Tanımlar Merkezi → Personel ekranından
          eklenir. Vekalet seçimi admin onayına düşer; onaylanınca
          devreye girer.
        </p>

        {step === 'form' && (
          <button
            type="button"
            onClick={() => setStep('pending_admin')}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Onaya Gönder
          </button>
        )}

        {step === 'pending_admin' && (
          <p className="text-sm font-medium text-status-warning rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            Admin Onayı Bekleniyor — {selectedLeave?.label ?? 'İzin'} · Vekil:{' '}
            {proxy?.name}. Henüz devreye girmedi.
          </p>
        )}

        {step === 'admin_approved' && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-sm text-content-secondary">
              Admin onayladı. Vekil{' '}
              <span className="font-semibold">{proxy?.name}</span> devreye
              girdi; izinli personelin ekranı pasif.
            </p>
          </div>
        )}
      </div>

      {(step === 'pending_admin' || step === 'admin_approved') && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <p className="text-sm font-semibold text-content-primary">
            Admin — Vekalet Onay Kuyruğu
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-content-primary">
                Selin Arslan · {selectedLeave?.label ?? 'İzin'}
              </p>
              <p className="text-xs text-content-tertiary mt-0.5">
                Önerilen Vekil: {proxy?.name} — {proxy?.role}
              </p>
            </div>
            {step === 'pending_admin' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('admin_approved')}
                  className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-content-secondary hover:bg-slate-50"
                >
                  Reddet
                </button>
              </div>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                Onaylandı
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
