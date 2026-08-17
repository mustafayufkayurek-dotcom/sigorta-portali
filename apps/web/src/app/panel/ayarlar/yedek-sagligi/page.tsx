'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  BACKUP_HEALTH_POLL_MS,
  formatBytes,
  formatClock,
  formatWhen,
  hoursSince,
  overallTone,
  restoreDisplay,
  watchdogTone,
  type BackupHealthPayload,
  type OverallTone,
} from './yedek-sagligi-view';

function toneLabel(tone: OverallTone): string {
  if (tone === 'healthy') return 'Sağlıklı';
  if (tone === 'warning') return 'Uyarı';
  return 'Kritik';
}

function toneClass(tone: OverallTone): string {
  if (tone === 'healthy') return 'text-status-success';
  if (tone === 'warning') return 'text-status-warning';
  return 'text-status-danger';
}

function toneDot(tone: OverallTone): string {
  if (tone === 'healthy') return '🟢';
  if (tone === 'warning') return '🟡';
  return '🔴';
}

function yesNo(ok?: boolean) {
  return ok ? 'Başarılı' : 'Başarısız';
}

export default function YedekSagligiPage() {
  const [data, setData] = useState<BackupHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/backup-health`, { headers: authHeader() });
      setData(res.data?.data ?? null);
      setError('');
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'Bu sayfa yalnızca yetkili admin kullanıcılarına açıktır.' : 'Yedek sağlık kaydı okunamadı.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = setInterval(() => {
      void load(true);
    }, BACKUP_HEALTH_POLL_MS);
    return () => {
      clearInterval(id);
    };
  }, [load]);

  const tone = overallTone(data);
  const hours = hoursSince(data?.lastSuccessAt);
  const wd = watchdogTone(hours);
  const restoreText = restoreDisplay(data);
  const rt = data?.restoreTest;

  return (
    <SettingsPageLayout
      title="Yedek Sağlığı"
      description="Veritabanı ve fotoğraf yedeğinin yerel, Backblaze ve watchdog durumu."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-secondary">
          Son güncelleme: {updatedAt ? formatClock(updatedAt) : '—'}
        </p>
        <button
          type="button"
          onClick={() => void load(false)}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Yenile
        </button>
      </div>
      {loading && <p className="text-sm text-content-secondary">Yükleniyor…</p>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-danger">{error}</div>
      )}
      {!loading && !error && (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface px-5 py-4">
            <p className={`text-lg font-semibold ${toneClass(tone)}`}>
              {toneDot(tone)} Genel Durum: {toneLabel(tone)}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-content-secondary sm:grid-cols-2">
              <p>Son Başarılı Backup: {formatWhen(data?.lastSuccessAt)}</p>
              <p>Son Backup Zamanı: {formatWhen(data?.recordedAt)}</p>
              <p>Son Başarılı Veritabanı Yedeği: {data?.result === 'SUCCESS' ? data?.db?.fileName || '—' : formatWhen(data?.lastSuccessAt)}</p>
              <p>Son Başarılı Uploads Yedeği: {data?.result === 'SUCCESS' ? data?.uploads?.fileName || '—' : '—'}</p>
              <p>Son B2 Doğrulaması: {data?.b2?.ok ? 'Başarılı' : 'Başarısız'}</p>
              <p>Kayıt Süresi: {data?.durationSeconds ?? 0} sn</p>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
              <p className="font-semibold text-content-primary">Veritabanı Yedeği</p>
              <p className="mt-2 text-content-secondary">Dosya Adı: {data?.db?.fileName || '—'}</p>
              <p className="text-content-secondary">Boyut: {formatBytes(data?.db?.bytes)}</p>
              <p className="text-content-secondary">Tarih/Saat: {formatWhen(data?.recordedAt)}</p>
              <p className="text-content-secondary">B2 Durumu: {yesNo(Boolean(data?.db?.uploadOk && data?.db?.remoteVerifyOk))}</p>
              <p className="text-content-secondary">Checksum Doğrulaması: {yesNo(Boolean(data?.db?.checksumOk))}</p>
            </section>
            <section className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
              <p className="font-semibold text-content-primary">Uploads Yedeği</p>
              <p className="mt-2 text-content-secondary">Dosya Adı: {data?.uploads?.fileName || '—'}</p>
              <p className="text-content-secondary">Boyut: {formatBytes(data?.uploads?.bytes)}</p>
              <p className="text-content-secondary">Tarih/Saat: {formatWhen(data?.recordedAt)}</p>
              <p className="text-content-secondary">B2 Durumu: {yesNo(Boolean(data?.uploads?.uploadOk && data?.uploads?.remoteVerifyOk))}</p>
              <p className="text-content-secondary">Checksum Doğrulaması: {yesNo(Boolean(data?.uploads?.checksumOk))}</p>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
            <p className="font-semibold text-content-primary">Restore Testi</p>
            <p className="mt-2 text-content-secondary">Sonuç: {rt?.status || 'Yok'}</p>
            <p className="text-content-secondary">Tarih: {formatWhen(rt?.testedAt)}</p>
            <p className="text-content-secondary">Dosya: {rt?.backupFile || '—'}</p>
            <p className="text-content-secondary">Özet: {restoreText}</p>
            {rt?.error ? <p className="text-status-danger">Hata: {rt.error}</p> : null}
          </section>

          <section className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
            <p className="font-semibold text-content-primary">Watchdog</p>
            <p className={`mt-2 font-semibold ${toneClass(wd)}`}>
              {toneDot(wd)} Watchdog Durumu: {wd === 'healthy' ? 'Geçti' : wd === 'warning' ? 'Uyarı' : 'Kritik'}
            </p>
            <p className="mt-1 text-content-secondary">Son Kontrol Zamanı: {formatWhen(data?.scheduler?.checkedAt || data?.recordedAt)}</p>
            <p className="text-content-secondary">
              Son Başarılı Backup Üzerinden Geçen Süre:{' '}
              {hours == null ? 'Bilinmiyor' : `${Math.max(0, Math.floor(hours))} saat`}
            </p>
            <p className="text-content-secondary">
              Warning / Critical: {wd === 'warning' ? 'Uyarı (24 Saat)' : wd === 'critical' ? 'Kritik (48 Saat)' : 'Yok'}
            </p>
            <p className="mt-2 text-content-tertiary">
              Zamanlayıcı kaydı (kayıt anı, Genel Durum hesabına girmez):{' '}
              {data?.scheduler?.ok === false ? 'Eksik' : data?.scheduler?.ok ? 'Tam' : '—'}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
            <p className="font-semibold text-content-primary">Son Hata</p>
            {data?.error || rt?.status === 'FAIL' ? (
              <>
                <p className="mt-2 text-status-danger">Hata Zamanı: {formatWhen(rt?.testedAt || data?.recordedAt)}</p>
                <p className="text-status-danger">Aşama: {rt?.status === 'FAIL' ? 'Restore Testi' : 'Off-Site Doğrulama'}</p>
                <p className="text-status-danger">Hata Mesajı: {rt?.error || data?.error}</p>
              </>
            ) : (
              <p className="mt-2 text-content-secondary">Kayıtlı hata yok.</p>
            )}
            {data?.notify?.emailError && (
              <p className="mt-1 text-status-warning">E-posta: {data.notify.emailError}</p>
            )}
          </section>
        </div>
      )}
    </SettingsPageLayout>
  );
}
