'use client';

/**
 * Cariler’deki Yeni Cari Hesap kaydı — masraf ekranında aynı yöntem.
 * Masraf formu kapanmaz; kayıt bitince cari seçilir.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  cariSirketFormAltYazi,
  cariSirketFormBaslik,
  isCariKarsiTarafTur,
} from '@sigorta/shared';
import {
  CariHesapFormFields,
  newCariHesapForm,
  type CariHesapFormValues,
} from '@/components/finance/CariHesapFormFields';
import { FinansActionButton, FinansModal } from '@/components/finance/FinansPanelUI';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { formatPhoneGrouped } from '@/utils/validators';

export function CariHesapCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (account: { id: string; name: string; kindLabel: string }) => void;
}) {
  const [form, setForm] = useState<CariHesapFormValues>(() => newCariHesapForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(newCariHesapForm());
    setError('');
    setSaving(false);
  }, [open]);

  const handleSave = async () => {
    if (isCariKarsiTarafTur(form.kind)) {
      setError('Cari Hesap (müşteri / tedarikçi) Müşteriler veya Tedarikçiler’den açılır.');
      return;
    }
    const name = toTitleCaseTR(form.name.trim());
    if (name.length < 2) {
      setError('Cari Hesap Adı Zorunludur');
      return;
    }
    const notes = form.notes ? toTitleCaseTR(form.notes.trim()) : '';
    if (!notes) {
      setError('Açıklama Zorunludur');
      return;
    }
    if (form.kind === 'banka' && !form.bankName.trim()) {
      setError('Banka Adı Zorunludur');
      return;
    }
    const openingAmount = parseTrAmountInput(form.openingAmount) ?? 0;
    setSaving(true);
    setError('');
    try {
      const contactPhone = form.contactPhone.trim()
        ? formatPhoneGrouped(form.contactPhone.trim()) || form.contactPhone.trim()
        : '';
      const contactEmail = form.contactEmail.trim().toLowerCase();
      const res = await axios.post(
        `${API}/finance/party-accounts`,
        {
          name,
          kind: form.kind,
          cardLast4: form.cardLast4 || undefined,
          cardLabel: form.cardLabel ? toTitleCaseTR(form.cardLabel.trim()) : undefined,
          bankName: form.bankName ? toTitleCaseTR(form.bankName.trim()) : undefined,
          branchName: form.branchName ? toTitleCaseTR(form.branchName.trim()) : undefined,
          iban: form.iban.replace(/\s+/g, '').toUpperCase() || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          notes,
          openingAmount: openingAmount > 0 ? openingAmount : undefined,
          openingDirection: openingAmount > 0 ? form.openingDirection : undefined,
        },
        { headers: authHeader() },
      );
      const created = res.data?.data as
        | { id?: string; name?: string; kindLabel?: string }
        | undefined;
      if (!created?.id) {
        setError('Cari kaydedildi ama seçilemedi');
        return;
      }
      onCreated({
        id: created.id,
        name: String(created.name ?? name),
        kindLabel: String(created.kindLabel ?? ''),
      });
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Kayıt yapılamadı'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinansModal
      open={open}
      title={cariSirketFormBaslik(form.kind)}
      subtitle={cariSirketFormAltYazi(form.kind)}
      size="lg"
      testId="masraf-cari-kart-ac"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FinansActionButton
            label="İptal"
            onClick={onClose}
            variant="neutral"
            showPlus={false}
            disabled={saving}
          />
          <button
            type="button"
            disabled={saving || isCariKarsiTarafTur(form.kind)}
            onClick={() => {
              void handleSave();
            }}
            className="inline-flex items-center rounded-lg border border-brand-600 bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
            data-testid="masraf-cari-kart-kaydet"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <CariHesapFormFields form={form} setForm={setForm} showOpening />
      </div>
    </FinansModal>
  );
}
