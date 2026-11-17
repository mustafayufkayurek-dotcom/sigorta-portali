'use client';

/**
 * Cariler sayfasındaki Yeni Cari Hesap alanları — tek kaynak.
 * Masraf / dosya masrafı aynı formu açar; masraf işleminden kopmaz.
 * Finans’tan yalnız şirket carisi (kart / banka / vergi…).
 * Karşı taraf → Müşteriler / Tedarikçiler kartından doğar.
 */
import {
  CARI_ACILIS_YON_LABEL,
  CARI_SIRKET_TUR_GRUPLARI,
  CARI_TUR_LABEL,
  cariVarsayilanAcilisYon,
  type CariAcilisYon,
  type CariTur,
} from '@sigorta/shared';
import { FinansFieldLabel, finansInputClass } from '@/components/finance/FinansPanelUI';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { formatPhoneGrouped } from '@/utils/validators';

export type CariHesapFormValues = {
  name: string;
  kind: CariTur;
  cardLast4: string;
  cardLabel: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  openingAmount: string;
  openingDirection: CariAcilisYon;
};

export const CARI_HESAP_EMPTY_FORM: CariHesapFormValues = {
  name: '',
  kind: 'kredi_karti',
  cardLast4: '',
  cardLabel: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
  openingAmount: '',
  openingDirection: 'borc',
};

export function newCariHesapForm(kind: CariTur = 'kredi_karti'): CariHesapFormValues {
  return {
    ...CARI_HESAP_EMPTY_FORM,
    kind,
    openingDirection: cariVarsayilanAcilisYon(kind),
  };
}

export function CariHesapFormFields({
  form,
  setForm,
  showOpening = true,
}: {
  form: CariHesapFormValues;
  setForm: (
    next: CariHesapFormValues | ((prev: CariHesapFormValues) => CariHesapFormValues),
  ) => void;
  /** Yeni kayıtta açılış tutarı / borç-alacak */
  showOpening?: boolean;
}) {
  const kartAlani = form.kind === 'kredi_karti';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="cari-hesap-form-alanlari">
      <div>
        <FinansFieldLabel required>Cari Hesap Adı</FinansFieldLabel>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={() =>
            setForm((f) => ({ ...f, name: f.name ? toTitleCaseTR(f.name.trim()) : '' }))
          }
          className={finansInputClass}
          placeholder="Örn. garanti kredi kartı"
        />
      </div>
      <div>
        <FinansFieldLabel required>Hesap Türü</FinansFieldLabel>
        <select
          value={form.kind}
          onChange={(e) => {
            const kind = e.target.value as CariTur;
            setForm((f) => ({
              ...f,
              kind,
              openingDirection: cariVarsayilanAcilisYon(kind),
            }));
          }}
          className={finansInputClass}
          data-testid="cari-hesap-tur"
        >
          {CARI_SIRKET_TUR_GRUPLARI.map((grup) => (
            <optgroup key={grup.label} label={grup.label}>
              {grup.kinds.map((value) => (
                <option key={value} value={value}>
                  {CARI_TUR_LABEL[value]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500">
          Müşteri veya tedarikçi kartı Müşteriler / Tedarikçiler sayfasından açılır.
        </p>
      </div>
      <div className="sm:col-span-2">
        <FinansFieldLabel required>Açıklama</FinansFieldLabel>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          onBlur={() =>
            setForm((f) => ({ ...f, notes: f.notes ? toTitleCaseTR(f.notes.trim()) : '' }))
          }
          className={finansInputClass}
          placeholder="Örn. ekstre kesim tarihi ayın 5’i"
          data-testid="cari-aciklama"
        />
      </div>
      <div>
        <FinansFieldLabel>Telefon</FinansFieldLabel>
        <input
          type="tel"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          onBlur={() =>
            setForm((f) => ({
              ...f,
              contactPhone: f.contactPhone.trim()
                ? formatPhoneGrouped(f.contactPhone.trim()) || f.contactPhone.trim()
                : '',
            }))
          }
          className={finansInputClass}
          placeholder="532 133 4144"
          data-testid="cari-telefon"
        />
      </div>
      <div>
        <FinansFieldLabel>E-posta</FinansFieldLabel>
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          className={finansInputClass}
          placeholder="ornek@firma.com"
          data-testid="cari-eposta"
        />
      </div>
      {kartAlani ? (
        <>
          <div>
            <FinansFieldLabel>Kart Son 4 Hane</FinansFieldLabel>
            <input
              type="text"
              inputMode="numeric"
              value={form.cardLast4}
              onChange={(e) =>
                setForm({ ...form, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })
              }
              className={finansInputClass}
              placeholder="1234"
            />
          </div>
          <div>
            <FinansFieldLabel>Kart Etiketi</FinansFieldLabel>
            <input
              type="text"
              value={form.cardLabel}
              onChange={(e) => setForm({ ...form, cardLabel: e.target.value })}
              onBlur={() =>
                setForm((f) => ({
                  ...f,
                  cardLabel: f.cardLabel ? toTitleCaseTR(f.cardLabel.trim()) : '',
                }))
              }
              className={finansInputClass}
              placeholder="Örn. ofis kartı"
            />
          </div>
        </>
      ) : null}
      {showOpening ? (
        <>
          <div>
            <FinansFieldLabel>Açılış Tutarı</FinansFieldLabel>
            <input
              type="text"
              inputMode="decimal"
              value={form.openingAmount}
              onChange={(e) => setForm({ ...form, openingAmount: e.target.value })}
              onBlur={() =>
                setForm((f) => {
                  const n = parseTrAmountInput(f.openingAmount);
                  return {
                    ...f,
                    openingAmount: n != null && n > 0 ? numberToTrAmountInput(n) : '',
                  };
                })
              }
              className={finansInputClass}
              placeholder="0"
            />
          </div>
          <div>
            <FinansFieldLabel>Borç / Alacak</FinansFieldLabel>
            <select
              value={form.openingDirection}
              onChange={(e) =>
                setForm({ ...form, openingDirection: e.target.value as CariAcilisYon })
              }
              className={finansInputClass}
              data-testid="cari-acilis-yon"
            >
              {(Object.entries(CARI_ACILIS_YON_LABEL) as [CariAcilisYon, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Borç: cari bize borçlu · Alacak: biz cariye borçluyuz
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
