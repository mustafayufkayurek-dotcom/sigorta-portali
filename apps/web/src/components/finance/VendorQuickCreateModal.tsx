'use client';

/**
 * Masraf / dosya masrafında Yeni Tedarikçi — sayfa kapanmaz.
 * Ofis / sabit hizmet kartı (doğalgaz, internet…). Kayıt bitince Ödeme Kaynağı seçilir.
 * Saha operasyon kartı için Tedarikçiler listesindeki tam form durur.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ContactPhoneField } from '@/components/ContactPhoneField';
import { FinansActionButton, FinansModal } from '@/components/finance/FinansPanelUI';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  OFIS_VENDOR_TYPE_QUICK_PICKS,
  applyVendorTitleCaseBlur,
  isVendorTypeOther,
  vendorIncompleteWritingConfirmMessage,
  vendorWritingLiveHint,
} from '@/utils/vendor-form-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';

type EntityType = 'individual' | 'corporate';

type QuickForm = {
  entityType: EntityType;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  phoneType: 'gsm' | 'landline';
  email: string;
  type: string;
  typeCustom: string;
  taxNumber: string;
};

function emptyQuickForm(): QuickForm {
  return {
    entityType: 'corporate',
    firstName: '',
    lastName: '',
    name: '',
    phone: '',
    phoneType: 'gsm',
    email: '',
    type: '',
    typeCustom: '',
    taxNumber: '',
  };
}

const inp =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600/30';

export function VendorQuickCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (partyAccountId: string, vendorName: string) => void;
}) {
  const { confirm, dialog } = usePanelConfirm();
  const [form, setForm] = useState<QuickForm>(emptyQuickForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [writeNotice, setWriteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyQuickForm());
    setError('');
    setSaving(false);
    setWriteNotice(null);
  }, [open]);

  const displayName =
    form.entityType === 'individual'
      ? `${form.firstName} ${form.lastName}`.trim()
      : form.name.trim();

  const blurTitle = (field: keyof QuickForm, raw: string) => {
    const { value, notice } = applyVendorTitleCaseBlur(raw);
    setForm((p) => {
      const next = { ...p, [field]: value } as QuickForm;
      if (field === 'firstName' || field === 'lastName') {
        next.name =
          `${field === 'firstName' ? value : next.firstName} ${field === 'lastName' ? value : next.lastName}`.trim();
      }
      return next;
    });
    if (notice) {
      setWriteNotice(notice);
      window.setTimeout(() => setWriteNotice(null), 3500);
    }
  };

  const handleSave = async () => {
    setError('');
    const phone = form.phone.trim();
    if (!phone) {
      setError('Telefon zorunludur');
      return;
    }
    if (form.entityType === 'individual') {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setError('Ad ve soyad zorunludur');
        return;
      }
    } else if (!form.name.trim()) {
      setError('Şirket unvanı zorunludur');
      return;
    }
    if (!form.type.trim()) {
      setError('Hizmet türü seçin');
      return;
    }
    if (isVendorTypeOther(form.type) && !form.typeCustom.trim()) {
      setError('Tür açıklamasını yazın');
      return;
    }

    const incomplete = vendorIncompleteWritingConfirmMessage({
      entityType: form.entityType,
      firstName: form.firstName,
      lastName: form.lastName,
      name: form.name,
    });
    if (incomplete) {
      const ok = await confirm({
        title: 'Yazım Kontrolü',
        message: incomplete,
        confirmLabel: 'Devam Et',
        cancelLabel: 'Düzenle',
        danger: false,
      });
      if (!ok) return;
    }

    const typeLabel = isVendorTypeOther(form.type)
      ? toTitleCaseTR(form.typeCustom.trim())
      : toTitleCaseTR(form.type.trim());
    const name =
      form.entityType === 'individual'
        ? toTitleCaseTR(`${form.firstName} ${form.lastName}`.trim())
        : toTitleCaseTR(form.name.trim());

    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/vendors`,
        {
          entityType: form.entityType,
          name,
          phone,
          email: form.email.trim() || null,
          authorizedPhone: phone,
          type: typeLabel,
          category: 'ofis',
          canActAsInspector: false,
          cariRol: 'tedarikci',
          taxNumber: form.entityType === 'corporate' ? form.taxNumber.trim() || null : null,
          identityNo: null,
          paymentDueDays: null,
          serviceAreas: [],
          workGroupIds: [],
          serviceBranches: [],
          contacts: [],
          contactInfos: [],
        },
        { headers: authHeader() },
      );
      const vendor = res.data?.data ?? res.data;
      const vendorId = String(vendor?.id ?? '');
      if (!vendorId) {
        setError('Tedarikçi kaydedildi ama seçilemedi');
        return;
      }
      const ensure = await axios.post(
        `${API}/finance/party-accounts/ensure-vendor`,
        { vendorId },
        { headers: authHeader() },
      );
      const account = ensure.data?.data as { id?: string } | undefined;
      if (!account?.id) {
        setError('Tedarikçi carisi açılamadı. Listeyi yenileyip seçin.');
        return;
      }
      onCreated(account.id, name);
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Tedarikçi kaydedilemedi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {dialog}
      <FinansModal
        open={open}
        title="Yeni Tedarikçi"
        subtitle="Masraf sayfasından çıkmadan Ofis / sabit hizmet kartı. Ödeme Kaynağı’na eklenir."
        size="lg"
        testId="masraf-tedarikci-hizli-ac"
        onBackdropClose={saving ? undefined : onClose}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinansActionButton
              label="İptal"
              onClick={onClose}
              variant="neutral"
              showPlus={false}
              disabled={saving}
            />
            <FinansActionButton
              label={saving ? 'Kaydediliyor…' : 'Kaydet Ve Seç'}
              onClick={() => {
                void handleSave();
              }}
              variant="primary"
              showPlus={false}
              disabled={saving}
              testId="masraf-tedarikci-hizli-kaydet"
            />
          </div>
        }
      >
        <div className="space-y-4" data-testid="masraf-tedarikci-hizli-form">
          {writeNotice ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
              role="status"
            >
              {writeNotice}
            </p>
          ) : null}
          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Kart Türü</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { v: 'corporate' as const, l: 'Şirket' },
                  { v: 'individual' as const, l: 'Şahıs' },
                ] as const
              ).map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, entityType: v }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    form.entityType === v
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {form.entityType === 'individual' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Ad</label>
                <input
                  className={inp}
                  value={form.firstName}
                  placeholder="Ad"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      firstName: e.target.value,
                      name: `${e.target.value} ${p.lastName}`.trim(),
                    }))
                  }
                  onBlur={(e) => blurTitle('firstName', e.target.value)}
                />
                {vendorWritingLiveHint(form.firstName) ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {vendorWritingLiveHint(form.firstName)}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Soyad</label>
                <input
                  className={inp}
                  value={form.lastName}
                  placeholder="Soyad"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      lastName: e.target.value,
                      name: `${p.firstName} ${e.target.value}`.trim(),
                    }))
                  }
                  onBlur={(e) => blurTitle('lastName', e.target.value)}
                />
                {vendorWritingLiveHint(form.lastName) ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {vendorWritingLiveHint(form.lastName)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Şirket Unvanı</label>
              <input
                className={inp}
                value={form.name}
                placeholder="Şirket Unvanı"
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                onBlur={(e) => blurTitle('name', e.target.value)}
              />
              {vendorWritingLiveHint(form.name) ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  {vendorWritingLiveHint(form.name)}
                </p>
              ) : null}
            </div>
          )}

          {displayName ? (
            <p className="text-[11px] text-slate-500">
              Kayıt adı:{' '}
              <span className="font-medium text-slate-700">{toTitleCaseTR(displayName)}</span>
            </p>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Telefon</label>
            <ContactPhoneField
              phone={form.phone}
              phoneType={form.phoneType}
              extensionNo=""
              onPhoneChange={(v) => setForm((p) => ({ ...p, phone: v }))}
              onPhoneTypeChange={(t) => setForm((p) => ({ ...p, phoneType: t }))}
              onExtensionChange={() => undefined}
              compact
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">E-posta</label>
            <input
              type="email"
              className={inp}
              value={form.email}
              placeholder="ornek@mail.com"
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          {form.entityType === 'corporate' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Vergi No</label>
              <input
                className={inp}
                value={form.taxNumber}
                placeholder="10 haneli vergi no"
                inputMode="numeric"
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    taxNumber: e.target.value.replace(/\D/g, '').slice(0, 11),
                  }))
                }
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Hizmet Türü</label>
            <SearchableSelect
              options={[
                ...OFIS_VENDOR_TYPE_QUICK_PICKS.map((t) => ({ value: t, label: t })),
                { value: 'Diğer', label: 'Diğer' },
              ]}
              value={
                !form.type.trim()
                  ? ''
                  : (OFIS_VENDOR_TYPE_QUICK_PICKS as readonly string[]).includes(form.type)
                    ? form.type
                    : 'Diğer'
              }
              onChange={(next) => {
                if (next === 'Diğer') {
                  setForm((p) => ({ ...p, type: 'Diğer', typeCustom: '' }));
                  return;
                }
                setForm((p) => ({ ...p, type: next, typeCustom: '' }));
              }}
              placeholder="Hizmet Türü Seçin..."
              emptyText="Tür bulunamadı."
              inputClassName={`${inp} bg-white`}
            />
            {!!form.type.trim() &&
            !(OFIS_VENDOR_TYPE_QUICK_PICKS as readonly string[]).includes(form.type) ? (
              <input
                className={`${inp} mt-2`}
                placeholder="Örn. doğalgaz abonelik, fiber internet..."
                value={isVendorTypeOther(form.type) ? form.typeCustom : form.type}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isVendorTypeOther(form.type)) {
                    setForm((p) => ({ ...p, typeCustom: v }));
                  } else {
                    setForm((p) => ({ ...p, type: v }));
                  }
                }}
                onBlur={(e) => {
                  if (isVendorTypeOther(form.type)) {
                    const { value, notice } = applyVendorTitleCaseBlur(e.target.value);
                    setForm((p) => ({ ...p, typeCustom: value }));
                    if (notice) setWriteNotice(notice);
                  }
                }}
              />
            ) : null}
          </div>

          <p className="text-[11px] leading-snug text-slate-500">
            Bu kayıt Ofis / sabit hizmet tedarikçisidir. Saha operasyon kartı için Tedarikçiler
            listesinden tam formu kullanın.
          </p>
        </div>
      </FinansModal>
    </>
  );
}
