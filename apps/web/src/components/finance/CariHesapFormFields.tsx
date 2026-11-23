'use client';

/**
 * Cariler sayfasındaki Yeni Cari Hesap alanları — tek kaynak.
 * Masraf / dosya masrafı aynı formu açar; masraf işleminden kopmaz.
 * Finans’tan yalnız şirket carisi (kart / banka / kasa / vergi…).
 * Karşı taraf (müşteri / tedarikçi cari) → Müşteriler / Tedarikçiler kartından doğar.
 * Tür değişince alanlar Logo / Xero gibi değişir.
 */
import {
  CARI_ACILIS_YON_LABEL,
  CARI_SIRKET_TUR_GRUPLARI,
  CARI_TUR_LABEL,
  cariSirketAciklamaPlaceholder,
  cariSirketAdPlaceholder,
  cariSirketAlanProfili,
  cariSirketTurYardim,
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
  bankName: string;
  branchName: string;
  iban: string;
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
  bankName: '',
  branchName: '',
  iban: '',
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

function formatIbanDisplay(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  return compact.replace(/(.{4})/g, '$1 ').trim();
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
  const profil = cariSirketAlanProfili(form.kind);
  const iletisimGoster =
    profil === 'kredi_karti' || profil === 'kredi' || profil === 'vergi' || profil === 'sgk' || profil === 'diger';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="cari-hesap-form-alanlari">
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
              // Tür değişince alakasız kart alanlarını temizle
              cardLast4: kind === 'kredi_karti' ? f.cardLast4 : '',
              cardLabel:
                kind === 'kredi_karti' || kind === 'kasa' || kind === 'vergi' || kind === 'sgk'
                  ? f.cardLabel
                  : '',
              bankName:
                kind === 'banka' || kind === 'kredi' || kind === 'vergi' ? f.bankName : '',
              branchName: kind === 'banka' ? f.branchName : '',
              iban: kind === 'banka' ? f.iban : '',
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
        <p className="mt-1 text-[11px] text-slate-500" data-testid="cari-tur-yardim">
          {cariSirketTurYardim(form.kind)}
        </p>
      </div>
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
          placeholder={cariSirketAdPlaceholder(form.kind)}
          data-testid="cari-hesap-adi"
        />
      </div>

      {profil === 'banka' ? (
        <>
          <div>
            <FinansFieldLabel required>Banka Adı</FinansFieldLabel>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              onBlur={() =>
                setForm((f) => ({
                  ...f,
                  bankName: f.bankName ? toTitleCaseTR(f.bankName.trim()) : '',
                }))
              }
              className={finansInputClass}
              placeholder="Örn. garanti bbva"
              data-testid="cari-banka-adi"
            />
          </div>
          <div>
            <FinansFieldLabel>Şube</FinansFieldLabel>
            <input
              type="text"
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              onBlur={() =>
                setForm((f) => ({
                  ...f,
                  branchName: f.branchName ? toTitleCaseTR(f.branchName.trim()) : '',
                }))
              }
              className={finansInputClass}
              placeholder="Örn. ankara çankaya"
              data-testid="cari-banka-sube"
            />
          </div>
          <div className="sm:col-span-2">
            <FinansFieldLabel>IBAN</FinansFieldLabel>
            <input
              type="text"
              value={form.iban}
              onChange={(e) =>
                setForm({
                  ...form,
                  iban: e.target.value.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 34),
                })
              }
              onBlur={() =>
                setForm((f) => ({
                  ...f,
                  iban: f.iban ? formatIbanDisplay(f.iban) : '',
                }))
              }
              className={finansInputClass}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              data-testid="cari-banka-iban"
              autoComplete="off"
            />
          </div>
        </>
      ) : null}

      {profil === 'kasa' ? (
        <div className="sm:col-span-2">
          <FinansFieldLabel>Kasa Yeri / Etiket</FinansFieldLabel>
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
            placeholder="Örn. ofis kasa / şantiye kasa"
            data-testid="cari-kasa-etiket"
          />
        </div>
      ) : null}

      {profil === 'kredi_karti' ? (
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
              data-testid="cari-kart-son4"
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
              data-testid="cari-kart-etiket"
            />
          </div>
        </>
      ) : null}

      {profil === 'kredi' ? (
        <div className="sm:col-span-2">
          <FinansFieldLabel>Kredi Veren Banka / Kurum</FinansFieldLabel>
          <input
            type="text"
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            onBlur={() =>
              setForm((f) => ({
                ...f,
                bankName: f.bankName ? toTitleCaseTR(f.bankName.trim()) : '',
              }))
            }
            className={finansInputClass}
            placeholder="Örn. ziraat bankası"
            data-testid="cari-kredi-kurum"
          />
        </div>
      ) : null}

      {profil === 'vergi' ? (
        <div className="sm:col-span-2">
          <FinansFieldLabel>Vergi Dairesi</FinansFieldLabel>
          <input
            type="text"
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            onBlur={() =>
              setForm((f) => ({
                ...f,
                bankName: f.bankName ? toTitleCaseTR(f.bankName.trim()) : '',
              }))
            }
            className={finansInputClass}
            placeholder="Örn. çankaya vergi dairesi"
            data-testid="cari-vergi-dairesi"
          />
        </div>
      ) : null}

      {profil === 'sgk' ? (
        <div className="sm:col-span-2">
          <FinansFieldLabel>İşyeri / Sicil No</FinansFieldLabel>
          <input
            type="text"
            value={form.cardLabel}
            onChange={(e) => setForm({ ...form, cardLabel: e.target.value })}
            className={finansInputClass}
            placeholder="Örn. işyeri sicil no"
            data-testid="cari-sgk-sicil"
          />
        </div>
      ) : null}

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
          placeholder={cariSirketAciklamaPlaceholder(form.kind)}
          data-testid="cari-aciklama"
        />
      </div>

      {iletisimGoster ? (
        <>
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
              {profil === 'banka' || profil === 'kasa'
                ? 'Banka / kasa bakiyesi genelde Alacak (bizdeki nakit) ile açılır.'
                : 'Borç: cari bize borçlu · Alacak: biz cariye borçluyuz'}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
