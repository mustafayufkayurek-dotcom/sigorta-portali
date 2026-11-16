'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useToast } from '@/contexts/ToastContext';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import { finansDonemUyariDismissKey } from '@/utils/finans-merkez-kart';

type MaliDonemUyari = {
  kind: 'mali_donem';
  year: number;
  month: number;
  periodKey: string;
  label: string;
  asOfDate: string;
  lastPostingDate?: string;
  promptOnDate?: string;
};

type MaliYilUyari = {
  kind: 'mali_yil';
  year: number;
  label: string;
  asOfDate: string;
};

type Disiplin = {
  openFileCount: number;
  closedWithoutInvoiceCount: number;
  hasarOpenCount?: number;
  acilOpenCount?: number;
  openFilesHref: string;
  openAcilHref?: string;
  invoiceRequestsHref: string;
};

function istanbulTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isDismissed(kind: 'mali_donem' | 'mali_yil', key: string): boolean {
  try {
    return window.localStorage.getItem(finansDonemUyariDismissKey(kind, key, istanbulTodayIso())) === '1';
  } catch {
    return false;
  }
}

function dismiss(kind: 'mali_donem' | 'mali_yil', key: string) {
  try {
    window.localStorage.setItem(finansDonemUyariDismissKey(kind, key, istanbulTodayIso()), '1');
  } catch {
    /* yok say */
  }
}

/**
 * Ofis ve finans: takvim + son gelir/gider tarihine göre
 * mali dönem / yıl kapatma ve dosya-fatura disiplin pop-up’ı.
 */
export function FinansDonemDisiplinModal({
  enabled,
  canClosePeriod = false,
}: {
  enabled: boolean;
  /** Dönem / yıl kilidi yalnız finans (payment.update). */
  canClosePeriod?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm, dialog } = usePanelConfirm();
  const [open, setOpen] = useState(false);
  const [maliDonem, setMaliDonem] = useState<MaliDonemUyari | null>(null);
  const [maliYil, setMaliYil] = useState<MaliYilUyari | null>(null);
  const [disiplin, setDisiplin] = useState<Disiplin | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!enabled) return;
    axios
      .get(`${API}/finance/party-accounts/donem-kapanis`, { headers: authHeader() })
      .then((r) => {
        const data = r.data?.data;
        const donem = data?.uyariMaliDonem as MaliDonemUyari | null | undefined;
        const yil = data?.uyariMaliYil as MaliYilUyari | null | undefined;
        const d = data?.disiplin as Disiplin | null | undefined;
        const nextDonem =
          donem?.kind === 'mali_donem' && !isDismissed('mali_donem', donem.periodKey)
            ? donem
            : null;
        const nextYil =
          yil?.kind === 'mali_yil' && !isDismissed('mali_yil', String(yil.year)) ? yil : null;
        setMaliDonem(nextDonem);
        setMaliYil(nextYil);
        setDisiplin(d ?? null);
        setOpen(Boolean(nextDonem || nextYil));
      })
      .catch(() => {
        setOpen(false);
      });
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const closeSession = () => {
    if (maliDonem) dismiss('mali_donem', maliDonem.periodKey);
    if (maliYil) dismiss('mali_yil', String(maliYil.year));
    setOpen(false);
  };

  const kapatDonem = async () => {
    if (!maliDonem || saving || !canClosePeriod) return;
    const ok = await confirm({
      title: 'Mali Dönemi Kapat',
      message: `${maliDonem.label} mali dönemi kilitlensin mi?\n\nSon kayıt: ${maliDonem.lastPostingDate ?? '—'}\nKapalı döneme hareket yazılamaz.`,
      confirmLabel: 'Dönemi Kapat',
      cancelLabel: 'Vazgeç',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/finance/party-accounts/donem-kapanis/${maliDonem.year}/${maliDonem.month}`,
        {},
        { headers: authHeader() },
      );
      showToast('success', `${maliDonem.label} mali dönemi kapatıldı`);
      dismiss('mali_donem', maliDonem.periodKey);
      setMaliDonem(null);
      load();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Mali dönem kapatılamadı'));
    } finally {
      setSaving(false);
    }
  };

  if (!enabled || !open) return <>{dialog}</>;

  const hasarOpen = disiplin?.hasarOpenCount ?? 0;
  const acilOpen = disiplin?.acilOpenCount ?? 0;
  const hasOpenFiles = Boolean(disiplin && disiplin.openFileCount > 0);
  const hasInvoiceGap = Boolean(disiplin && disiplin.closedWithoutInvoiceCount > 0);

  return (
    <>
      {dialog}
      <div
        className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finans-donem-disiplin-title"
        data-testid="finans-donem-disiplin-modal"
      >
        <div className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:bg-slate-800">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <h2
              id="finans-donem-disiplin-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Dönem Ve Görev Denetimi
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Takvim ve son gelir / gider kaydı okundu. Dönem kapanmadan önce açık işi bitirin;
              kapalı dosyada fatura talebi yoksa talep açın. Gelir ve gider aksamasın.
            </p>

            <ol
              className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200"
              data-testid="finans-disiplin-oneri-sirasi"
            >
              <li>Açık Hasar ve Acil dosyayı kapatın.</li>
              <li>Kapalı dosyada fatura talebi yoksa talep edin.</li>
              <li>
                {canClosePeriod
                  ? 'Mali dönemi (gerekirse yılı) kapatın.'
                  : 'Finans mali dönemi kapatsın; siz dosya ve talebi tamamlayın.'}
              </li>
              <li>Sonra tahsilat, ödeme ve masrafa devam edin.</li>
            </ol>

            {maliDonem ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-semibold">Mali Dönem · {maliDonem.label}</p>
                <p className="mt-1 text-amber-900">
                  Son kayıt {maliDonem.lastPostingDate ?? '—'} · denetim{' '}
                  {maliDonem.promptOnDate ?? maliDonem.asOfDate}
                </p>
                {canClosePeriod ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void kapatDonem()}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      data-testid="finans-disiplin-donem-kapat"
                    >
                      Dönemi Kapat
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">
                    Dönem kilidi finans personelindedir. Sizin işiniz: dosya ve fatura talebi.
                  </p>
                )}
              </div>
            ) : null}

            {maliYil ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-semibold">Mali Yıl · {maliYil.label}</p>
                <p className="mt-1 text-amber-900">
                  {maliYil.asOfDate} bakiyeleri Dönem Sonu sayfasında kilitlenir.
                </p>
                {canClosePeriod ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        closeSession();
                        router.push('/panel/finans/cariler/donem-sonu');
                      }}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                      data-testid="finans-disiplin-yil-kapat"
                    >
                      Dönem Sonuna Git
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">
                    Yıl kilidi finans personelindedir; siz dosya ve fatura talebini bitirin.
                  </p>
                )}
              </div>
            ) : null}

            {hasOpenFiles || hasInvoiceGap ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {hasOpenFiles ? (
                  <li className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600">
                    <p className="font-medium">Açık dosya: {disiplin!.openFileCount}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Hasar {hasarOpen} · Acil {acilOpen}. Kapanması gereken işi kapatın.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {hasarOpen > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 underline"
                          onClick={() => {
                            closeSession();
                            router.push(disiplin!.openFilesHref);
                          }}
                          data-testid="finans-disiplin-acik-dosya"
                        >
                          Açık Hasar
                        </button>
                      ) : null}
                      {acilOpen > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 underline"
                          onClick={() => {
                            closeSession();
                            router.push(disiplin!.openAcilHref || '/panel/operasyon?filter=acil');
                          }}
                          data-testid="finans-disiplin-acik-acil"
                        >
                          Açık Acil
                        </button>
                      ) : null}
                    </div>
                  </li>
                ) : null}
                {hasInvoiceGap ? (
                  <li className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600">
                    <p className="font-medium">
                      Kapalı dosyada fatura talebi yok: {disiplin!.closedWithoutInvoiceCount}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Gelir için talep açın.</p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-brand-700 underline"
                      onClick={() => {
                        closeSession();
                        router.push(disiplin!.invoiceRequestsHref);
                      }}
                      data-testid="finans-disiplin-fatura"
                    >
                      Fatura Taleplerine Git
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Açık dosya ve eksik fatura talebi yok. Dönem kilidine geçilebilir.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-3 border-t border-slate-100 px-4 py-4 sm:px-5 dark:border-slate-700">
            <button
              type="button"
              onClick={closeSession}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              data-testid="finans-disiplin-devam"
            >
              Şimdilik Devam Et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
