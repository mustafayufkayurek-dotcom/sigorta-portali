'use client';

import { useCallback, useEffect, useState } from 'react';
import { proposePersonelYasalHesap, type PersonelYasalHesapSonuc } from '@sigorta/shared';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { formatTryAmount } from '@/utils/format-try-amount';
import { TrAmountInput } from '@/components/ui/TrAmountInput';

type YasalHesapPayload = {
  profileId: string;
  userId: string;
  fullName: string;
  hireDate?: string | null;
  monthlyGrossSalary: number | null;
  oneri: PersonelYasalHesapSonuc;
  kabul: (PersonelYasalHesapSonuc & { periodLabel?: string }) | null;
  kabulAt?: string | null;
  accountantEmail?: string;
  uyari?: string;
};

type Props = {
  employeeProfileId: string;
  hireDateLabel?: string | null;
  preview?: boolean;
};

const UYARI_METNI =
  'Personel gideri bütçelenir. Rakamlar yol göstericidir; resmi bordro yerine geçmez. Kabul edince bu ayın net ücreti personel carisine yazılır; gerektiğinde mali müşavire gönderilir.';

function formatDateTr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR');
}

function resolveHireIso(
  hireDate?: string | Date | null,
  hireDateLabel?: string | null,
): string | null {
  if (hireDate) {
    const s = hireDate.toString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  if (hireDateLabel && /^\d{2}\.\d{2}\.\d{4}$/.test(hireDateLabel)) {
    return hireDateLabel.split('.').reverse().join('-');
  }
  return null;
}

/**
 * Personel ücret hesabı (C8) — brüt kaydedilir; hesap özeti açık kalır; Kabul / mali müşavir personeldedir.
 */
export function HrPersonelUcretPanel({
  employeeProfileId,
  hireDateLabel,
  preview = false,
}: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<YasalHesapPayload | null>(null);
  const [brutInput, setBrutInput] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(async () => {
    if (preview) {
      const oneri = proposePersonelYasalHesap({
        brutAylik: 50_000,
        iseGiris: '2020-01-15',
      });
      setData({
        profileId: employeeProfileId,
        userId: 'preview',
        fullName: 'Önizleme',
        hireDate: '2020-01-15',
        monthlyGrossSalary: 50_000,
        oneri,
        kabul: null,
        accountantEmail: '',
        uyari: UYARI_METNI,
      });
      setBrutInput(numberToTrAmountInput(50_000));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const row = await apiClient.get<YasalHesapPayload>(
        `hr/employees/${employeeProfileId}/yasal-hesap`,
      );
      setData(row);
      setBrutInput(
        row.monthlyGrossSalary != null && row.monthlyGrossSalary > 0
          ? numberToTrAmountInput(row.monthlyGrossSalary)
          : '',
      );
      setEmailTo(row.accountantEmail?.trim() || '');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Ücret bilgisi yüklenemedi. Lütfen tekrar deneyin.',
      );
    } finally {
      setLoading(false);
    }
  }, [employeeProfileId, preview]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedBrut = parseTrAmountInput(brutInput);
  const hasBrut = parsedBrut != null && parsedBrut > 0.005;
  const hireIso = resolveHireIso(data?.hireDate, hireDateLabel);
  const liveOneri = proposePersonelYasalHesap({
    brutAylik: hasBrut ? parsedBrut! : 0,
    iseGiris: hireIso,
  });
  const hesapHazir = hasBrut && liveOneri.kabulEdilebilir;

  const amountText = (n: number) =>
    hesapHazir ? formatTryAmount(n) : formatTryAmount(null);

  const saveBrutIfNeeded = async (): Promise<number | null> => {
    if (!hasBrut || parsedBrut == null) return null;
    const saved = data?.monthlyGrossSalary ?? null;
    if (saved != null && Math.abs(saved - parsedBrut) < 0.005) {
      return parsedBrut;
    }
    const row = await apiClient.patch<{
      monthlyGrossSalary: number;
      oneri: PersonelYasalHesapSonuc;
    }>(`hr/employees/${employeeProfileId}/ucret`, {
      monthlyGrossSalary: parsedBrut,
    });
    setData((prev) =>
      prev
        ? {
            ...prev,
            monthlyGrossSalary: row.monthlyGrossSalary,
            oneri: row.oneri,
          }
        : prev,
    );
    return row.monthlyGrossSalary;
  };

  const handleSaveBrut = async () => {
    if (preview) {
      showToast('info', 'Önizlemede kayıt yapılmaz.');
      return;
    }
    if (!hasBrut || parsedBrut == null) {
      showToast('error', 'Kaydetmek için aylık brüt ücreti girin.');
      return;
    }
    setSaving(true);
    try {
      await saveBrutIfNeeded();
      showToast('success', 'Aylık brüt ücret kaydedildi.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Ücret kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    if (preview) {
      showToast('info', 'Önizlemede kabul yapılmaz.');
      return;
    }
    if (!hesapHazir) {
      showToast('error', 'Kabul etmek için önce aylık brüt ücreti girin.');
      return;
    }
    setAccepting(true);
    try {
      await saveBrutIfNeeded();
      const result = await apiClient.post<{
        message: string;
        kabulAt?: string;
        kabul?: YasalHesapPayload['kabul'];
      }>(`hr/employees/${employeeProfileId}/yasal-hesap/accept`, {});
      setData((prev) =>
        prev
          ? {
              ...prev,
              kabul: result.kabul ?? prev.kabul,
              kabulAt: result.kabulAt ?? prev.kabulAt,
              oneri: liveOneri,
              monthlyGrossSalary: liveOneri.brutAylik,
            }
          : prev,
      );
      showToast(
        'success',
        result.message || 'Hesap kabul edildi. Bu ayın net ücreti personel carisine yazıldı.',
      );
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Hesap kabul edilemedi.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSendAccountant = async () => {
    if (preview) {
      showToast('info', 'Önizlemede gönderim yapılmaz.');
      return;
    }
    if (!hesapHazir) {
      showToast('error', 'Göndermek için önce aylık brüt ücreti girin.');
      return;
    }
    const to = emailTo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showToast('error', 'Geçerli bir e-posta adresi girin.');
      return;
    }
    setSending(true);
    try {
      await saveBrutIfNeeded();
      const result = await apiClient.post<{ success: boolean; message: string }>(
        `hr/employees/${employeeProfileId}/yasal-hesap/send-accountant`,
        { to, message: emailMessage.trim() || undefined },
      );
      if (!result.success) {
        showToast('error', result.message);
        return;
      }
      showToast('success', result.message || 'Özet mali müşavire gönderildi.');
      setEmailOpen(false);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Özet gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-content-tertiary" data-testid="personel-ucret-yukleniyor">
        Ücret bilgisi yükleniyor…
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-3" data-testid="personel-ucret-hata">
        <p className="text-sm text-status-danger">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="personel-ucret-panel">
      <p className="text-xs leading-relaxed text-content-tertiary">{UYARI_METNI}</p>

      <div>
        <label
          htmlFor="personel-brut-ucret"
          className="mb-1.5 block text-sm font-medium text-content-primary"
        >
          Aylık Brüt Ücret
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1" data-testid="personel-brut-input">
            <TrAmountInput
              id="personel-brut-ucret"
              value={brutInput}
              onChange={setBrutInput}
              placeholder="Örn. 50.000"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-content-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveBrut()}
            disabled={saving}
            className="shrink-0 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50 disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-content-primary">Hesap Özeti</p>
        {!hesapHazir ? (
          <p className="mb-2 text-xs text-content-tertiary">
            Brüt ücret girilince tutarlar dolar. Boş satırlar henüz hesaplanmamıştır.
          </p>
        ) : null}
        <dl
          className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-slate-50/80 p-3 text-sm sm:grid-cols-2"
          data-testid="personel-hesap-ozeti"
        >
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">Net Aylık</dt>
            <dd
              className="font-semibold tabular-nums text-content-primary"
              data-testid="personel-net-aylik"
            >
              {amountText(liveOneri.netAylik)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">İşveren Toplam Maliyet</dt>
            <dd className="font-semibold tabular-nums text-content-primary">
              {amountText(liveOneri.isverenToplamMaliyet)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">İşçi SGK</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.isciSgk)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">İşveren SGK</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.isverenSgk)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">Gelir Vergisi (Tahmini)</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.gelirVergisiTahmini)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">Damga Vergisi</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.damga)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">Kıdem Tazminatı</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.kidemTazminati)}
              {hesapHazir ? (
                hireIso ? (
                  <span className="ml-1 text-xs font-normal text-content-tertiary">
                    ({liveOneri.kidemYil} yıl)
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-content-tertiary">
                    (işe giriş tarihi yok)
                  </span>
                )
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-content-tertiary">İhbar Tazminatı</dt>
            <dd className="font-medium tabular-nums text-content-primary">
              {amountText(liveOneri.ihbarTazminati)}
              {hesapHazir ? (
                hireIso ? (
                  <span className="ml-1 text-xs font-normal text-content-tertiary">
                    ({liveOneri.ihbarHafta} hafta)
                  </span>
                ) : (
                  <span className="ml-1 text-xs font-normal text-content-tertiary">
                    (işe giriş tarihi yok)
                  </span>
                )
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      {data?.kabulAt ? (
        <p className="text-xs text-content-secondary" data-testid="personel-yasal-kabul-izi">
          Son kabul: {formatDateTr(data.kabulAt)}
          {data.kabul && 'periodLabel' in data.kabul && data.kabul.periodLabel
            ? ` · ${data.kabul.periodLabel}`
            : ''}
          {data.kabul?.netAylik != null
            ? ` · Net ${formatTryAmount(Number(data.kabul.netAylik))}`
            : ''}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={accepting || !hesapHazir}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          data-testid="personel-yasal-kabul"
        >
          {accepting ? 'Kabul Ediliyor…' : 'Kabul'}
        </button>
        <button
          type="button"
          onClick={() => setEmailOpen((v) => !v)}
          disabled={!hesapHazir}
          className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50 disabled:opacity-60"
          data-testid="personel-yasal-mali-musteri"
        >
          Mali Müşavire Gönder
        </button>
      </div>

      {emailOpen ? (
        <div className="space-y-3 rounded-xl border border-border bg-white p-3">
          <p className="text-xs text-content-tertiary">
            Hesap özeti seçtiğiniz adrese e-posta olarak gider. Kabul yerine geçmez.
          </p>
          <div>
            <label
              htmlFor="personel-yasal-email"
              className="mb-1.5 block text-sm font-medium text-content-primary"
            >
              Alıcı E-posta
            </label>
            <input
              id="personel-yasal-email"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              data-testid="personel-yasal-email-input"
            />
          </div>
          <div>
            <label
              htmlFor="personel-yasal-email-not"
              className="mb-1.5 block text-sm font-medium text-content-primary"
            >
              Not (İsteğe Bağlı)
            </label>
            <textarea
              id="personel-yasal-email-not"
              rows={2}
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSendAccountant()}
            disabled={sending}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {sending ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
