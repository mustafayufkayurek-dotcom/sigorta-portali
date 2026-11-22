'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  FINANS_ODEME_YONTEM_HAVALE_EFT,
  FINANS_ODEME_YONTEM_OPTIONS,
  resolveFinansIslemTarihiDonemDurum,
} from '@sigorta/shared';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { isCompleteTrDateValue, normalizeTrDateValue } from '@/utils/tr-date-input';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/contexts/ToastContext';
import {
  FinansFieldLabel,
  FinansModal,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { FinansTarihDonemUyariIkon } from '@/components/finance/FinansTarihDonemUyariIkon';

type MusteriCariSecenek = {
  id: string;
  name: string;
  linkedCustomerId: string;
};

export function CariTahsilatAlModal({
  open,
  onClose,
  onSaved,
  fixedCustomer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Cari detaydan açılınca müşteri sabit */
  fixedCustomer?: { customerId: string; label: string } | null;
}) {
  const { showToast } = useToast();
  const [options, setOptions] = useState<MusteriCariSecenek[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(FINANS_ODEME_YONTEM_HAVALE_EFT);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const tarihDonemDurum = (() => {
    const dateIso = normalizeTrDateValue(paymentDate);
    if (!isCompleteTrDateValue(dateIso)) return { kind: 'ok' as const };
    return resolveFinansIslemTarihiDonemDurum(dateIso);
  })();

  useEffect(() => {
    if (!open) return;
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setAmount('');
    setMethod(FINANS_ODEME_YONTEM_HAVALE_EFT);
    setNote('');
    if (fixedCustomer?.customerId) {
      setCustomerId(fixedCustomer.customerId);
      return;
    }
    setCustomerId('');
    setLoadingOptions(true);
    axios
      .get(`${API}/finance/party-accounts`, {
        headers: authHeader(),
        params: { kind: 'musteri', activeOnly: 'true' },
      })
      .then((r) => {
        const rows = (r.data?.data ?? []) as Array<{
          id: string;
          name: string;
          linkedCustomerId?: string | null;
        }>;
        setOptions(
          rows
            .filter((row) => row.linkedCustomerId)
            .map((row) => ({
              id: row.id,
              name: row.name,
              linkedCustomerId: String(row.linkedCustomerId),
            })),
        );
      })
      .catch(() => setOptions([]))
      .finally(() => setLoadingOptions(false));
  }, [open, fixedCustomer?.customerId]);

  const save = async () => {
    const payerId = fixedCustomer?.customerId || customerId;
    const tutar = parseTrAmountInput(amount) ?? 0;
    if (!payerId) {
      showToast('warning', 'Müşteri Seçin');
      return;
    }
    if (tutar <= 0) {
      showToast('warning', 'Tutar Girin');
      return;
    }
    const dateIso = normalizeTrDateValue(paymentDate);
    if (!isCompleteTrDateValue(dateIso)) {
      showToast('warning', 'Tarih Zorunludur');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/payments`,
        {
          paymentType: 'incoming',
          payerType: 'customer',
          payerId,
          paymentDate: dateIso,
          amount: tutar,
          method,
          status: 'completed',
          note: note.trim() || undefined,
        },
        { headers: authHeader() },
      );
      showToast('success', 'Tahsilat Kaydedildi · Cariye İşlendi');
      onSaved();
      onClose();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Tahsilat kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinansModal
      open={open}
      title="Tahsilat Ekle"
      subtitle="Tutar müşteri carisine yazılır. Dosya bakiyesine dokunulmaz."
      testId="cari-tahsilat-al-modal"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            data-testid="cari-tahsilat-al-kaydet"
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {fixedCustomer ? (
          <div>
            <FinansFieldLabel>Müşteri</FinansFieldLabel>
            <p
              className={`${finansInputClass} bg-slate-50 font-medium text-slate-800`}
              data-testid="cari-tahsilat-al-musteri-sabit"
            >
              {fixedCustomer.label}
            </p>
          </div>
        ) : (
          <div data-testid="cari-tahsilat-al-musteri">
            <FinansFieldLabel required>Müşteri Carisi</FinansFieldLabel>
            <SearchableSelect
              inputClassName={finansInputClass}
              options={options.map((row) => ({
                value: row.linkedCustomerId,
                label: row.name,
              }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder={loadingOptions ? 'Yükleniyor…' : 'Müşteri cari ara…'}
              emptyText="Bağlı müşterisi olan cari bulunamadı"
            />
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-600">
              Tarih <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
            </label>
            {tarihDonemDurum.kind !== 'ok' ? (
              <FinansTarihDonemUyariIkon
                message={tarihDonemDurum.message}
                closed={tarihDonemDurum.kind === 'closed'}
                testId="cari-tahsilat-tarih-donem-uyari"
              />
            ) : null}
          </div>
          <TrDateInput
            value={paymentDate}
            onChange={setPaymentDate}
            className={finansInputClass}
          />
        </div>
        <div>
          <FinansFieldLabel required>Tutar</FinansFieldLabel>
          <TrAmountInput
            value={amount}
            onChange={setAmount}
            className={finansInputClass}
            placeholder=""
          />
        </div>
        <div>
          <FinansFieldLabel required>Yöntem</FinansFieldLabel>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={finansInputClass}
            data-testid="cari-tahsilat-al-yontem"
          >
            {FINANS_ODEME_YONTEM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FinansFieldLabel>Not</FinansFieldLabel>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={finansInputClass}
            placeholder="Örn. banka dekont no"
          />
        </div>
      </div>
    </FinansModal>
  );
}
