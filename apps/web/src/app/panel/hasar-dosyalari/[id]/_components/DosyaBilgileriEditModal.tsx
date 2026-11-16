'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { useToast } from '@/contexts/ToastContext';
import { toTitleCaseTR, resolveClaimIhbarKonusu } from '@/utils/text-helpers';
import { customerDisplayName } from '@/utils/customer-form-helpers';
import { HASAR_EXPERT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import { FieldHelpTip } from '@/components/ui/FieldHelpTip';
import { PhoneInput } from '@/components/PhoneInput';
import { parseInternationalPhone } from '@/data/country-codes';
import { applyClaimAddressPlace, readClaimAddressPlace } from '@/utils/claim-address-place';
import { CLAIM_PRIORITY_OPTIONS, isClaimPriority } from '@/utils/claim-priority';
import { fetchDepartmentFileSubjectNames } from '@/utils/damage-reason-options';
import {
  CLAIM_FILE_CHANNELS,
  HASAR_FILE_INSURANCE_CATALOG_QUERY,
  departmentCodeForNewClaim,
  parseClaimServiceKind,
} from '@sigorta/shared';

type PickRow = { id: string; name: string };

function rowsFromPayload(payload: unknown): unknown[] {
  const nested = payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data?: unknown }).data
    : payload;
  return Array.isArray(nested) ? nested : [];
}

function customersToPickRows(payload: unknown): PickRow[] {
  return rowsFromPayload(payload)
    .map((row) => {
      const c = row as CustomerLite & { shortName?: string | null };
      return { id: String(c.id ?? '').trim(), name: customerDisplayName(c) };
    })
    .filter((row) => row.id && row.name && row.name !== '—')
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function withCurrent(rows: PickRow[], current: PickRow | null): PickRow[] {
  if (!current?.id || rows.some((row) => row.id === current.id)) return rows;
  return [current, ...rows];
}

function currentCustomerRow(c: (CustomerLite & { shortName?: string | null }) | null | undefined): PickRow | null {
  if (!c?.id) return null;
  return { id: c.id, name: customerDisplayName(c) };
}

type OfficeUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: { code?: string | null } | null;
};

type CustomerLite = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function findProvinceCode(cityName: string | null | undefined): string {
  const needle = (cityName ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!needle || needle === 'belirtilmemiş') return '';
  const match = STATIC_PROVINCES.find((p) => p.name.toLocaleLowerCase('tr-TR') === needle);
  return match?.code ?? '';
}

function isBlankFileSubject(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  return !text || text === '—' || /^belirtilmemi[sş]$/i.test(text);
}

function departmentCodeForClaim(claim: any): string {
  // Hizmet hattı esas: eski department=danismanlik kaydı Tadilat listesini basmaz.
  const source = String(claim?.customerSource ?? 'expert');
  const customerSource = source === 'private' || source === 'broker' || source === 'insurance'
    ? source
    : 'expert';
  return departmentCodeForNewClaim({
    customerSource,
    serviceKind: parseClaimServiceKind(claim?.serviceKind),
    consultancyServiceType: claim?.consultancyServiceType ?? null,
  });
}

function initialDosyaKonusu(claim: any): string {
  const konu = resolveClaimIhbarKonusu(claim);
  if (!isBlankFileSubject(konu)) return konu;
  const raw = String(claim?.lossType ?? '').trim();
  return isBlankFileSubject(raw) ? '' : raw;
}

function officeUserLabel(u: OfficeUser | null | undefined): string {
  if (!u) return '';
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || u.email || u.id;
}

const fieldCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60';

export function DosyaBilgileriEditModal({
  claim,
  onClose,
  onSaved,
}: {
  claim: any;
  onClose: () => void;
  onSaved: (patch: Partial<any>) => void;
}) {
  const { showToast } = useToast();
  const addr = claim.propertyAddress ?? {};

  const [insuredName, setInsuredName] = useState(
    () => resolveHasarInsuredName(claim) !== '—' ? resolveHasarInsuredName(claim) : (claim.insuredName ?? ''),
  );
  const [insuredPhone, setInsuredPhone] = useState(claim.insuredPhone ?? '');
  const [siteContactName, setSiteContactName] = useState(claim.siteContactName ?? '');
  const [siteContactPhone, setSiteContactPhone] = useState(claim.siteContactPhone ?? '');
  const [siteContactEmail, setSiteContactEmail] = useState(claim.siteContactEmail ?? '');
  const [policyNo, setPolicyNo] = useState(claim.policyNo ?? '');
  const [lossType, setLossType] = useState(() => initialDosyaKonusu(claim));
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [subjectsLoadFailed, setSubjectsLoadFailed] = useState(false);
  const [description, setDescription] = useState(claim.description ?? '');
  const [priority, setPriority] = useState(() => {
    const saved = String(claim.priority ?? '').toLowerCase();
    return isClaimPriority(saved) ? saved : '';
  });
  const [cityCode, setCityCode] = useState(() => findProvinceCode(addr.city));
  const [city, setCity] = useState(addr.city && addr.city !== 'Belirtilmemiş' ? addr.city : '');
  const [district, setDistrict] = useState(addr.district ?? '');
  const [addressLine, setAddressLine] = useState(addr.addressLine ?? '');
  const [customer, setCustomer] = useState<CustomerLite | null>(claim.customer ?? null);
  const [assignedOfficeUserId, setAssignedOfficeUserId] = useState(claim.assignedOfficeUserId ?? '');
  const [insuranceCompanyId, setInsuranceCompanyId] = useState(claim.insuranceCompanyId ?? '');
  const [channelBrokerCustomerId, setChannelBrokerCustomerId] = useState(claim.channelBrokerCustomerId ?? '');
  const [channelAgencyCustomerId, setChannelAgencyCustomerId] = useState(claim.channelAgencyCustomerId ?? '');
  const [insuranceCompanies, setInsuranceCompanies] = useState<PickRow[]>([]);
  const [brokerFirms, setBrokerFirms] = useState<PickRow[]>([]);
  const [agencyFirms, setAgencyFirms] = useState<PickRow[]>([]);
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const districts = useMemo(
    () => (cityCode ? (STATIC_DISTRICTS[cityCode] ?? []) : []),
    [cityCode],
  );

  useEffect(() => {
    let cancelled = false;
    const code = departmentCodeForClaim(claim);
    void fetchDepartmentFileSubjectNames(code)
      .then((names) => {
        if (cancelled) return;
        setSubjectOptions(names);
        setSubjectsLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSubjectOptions([]);
        setSubjectsLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [claim]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/claim-files/assignable-staff`, {
        headers: authHeader(),
        params: { role: 'office_staff', includeDelegates: 'hasar' },
      })
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data?.data ?? []) as OfficeUser[];
        setOfficeUsers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setOfficeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const firmParams = (subType: string) => ({
      headers: authHeader(),
      params: { subType, status: 'active', limit: 1000, customerType: 'corporate' },
    });
    const brokerSub = CLAIM_FILE_CHANNELS.find((row) => row.key === 'broker')?.customerSubType;
    const agencySub = CLAIM_FILE_CHANNELS.find((row) => row.key === 'agency')?.customerSubType;
    void Promise.all([
      axios.get(`${API}/insurance-companies`, { headers: authHeader(), params: HASAR_FILE_INSURANCE_CATALOG_QUERY }).catch(() => null),
      brokerSub ? axios.get(`${API}/customers`, firmParams(brokerSub)).catch(() => null) : null,
      agencySub ? axios.get(`${API}/customers`, firmParams(agencySub)).catch(() => null) : null,
    ]).then(([icRes, brokerRes, agencyRes]) => {
      if (cancelled) return;
      const companies = rowsFromPayload(icRes?.data)
        .map((row) => {
          const c = row as { id?: string; name?: string };
          return { id: String(c.id ?? ''), name: String(c.name ?? '').trim() };
        })
        .filter((row) => row.id && row.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const currentCompany = claim.insuranceCompany?.id
        ? { id: claim.insuranceCompany.id, name: String(claim.insuranceCompany.name ?? '').trim() }
        : null;
      setInsuranceCompanies(withCurrent(companies, currentCompany));
      setBrokerFirms(withCurrent(customersToPickRows(brokerRes?.data), currentCustomerRow(claim.channelBrokerCustomer)));
      setAgencyFirms(withCurrent(customersToPickRows(agencyRes?.data), currentCustomerRow(claim.channelAgencyCustomer)));
    });
    return () => {
      cancelled = true;
    };
  }, [claim]);

  const officeOptions = useMemo(() => {
    const list = [...officeUsers];
    const current = claim.assignedOfficeUser as OfficeUser | undefined;
    if (current?.id && !list.some((u) => u.id === current.id)) {
      list.unshift(current);
    }
    return list;
  }, [officeUsers, claim.assignedOfficeUser]);

  const save = async () => {
    setError('');
    const name = toTitleCaseTR(insuredName.trim());
    const phone = parseInternationalPhone(insuredPhone).international;
    const irtibatAd = toTitleCaseTR(siteContactName.trim());
    const irtibatTel = parseInternationalPhone(siteContactPhone).international;
    const policy = policyNo.trim();
    const konu = lossType.trim();
    const ihbar = toTitleCaseTR(description.trim());
    const line = toTitleCaseTR(addressLine.trim());
    const cityName = city.trim();
    const districtName = district.trim();

    if (!policy) {
      setError('Poliçe no zorunludur');
      return;
    }
    if (isBlankFileSubject(konu)) {
      setError('Dosya konusu zorunludur');
      return;
    }
    if (!isClaimPriority(priority)) {
      setError('Öncelik zorunludur');
      return;
    }
    if (!insuranceCompanyId) {
      setError('Sigorta şirketi zorunludur');
      return;
    }
    const placeConflict = readClaimAddressPlace(line, cityName, districtName).conflict;
    if (placeConflict) {
      setError(placeConflict);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        insuredName: name || null,
        insuredPhone: phone || null,
        siteContactName: irtibatAd || null,
        siteContactPhone: irtibatTel || null,
        siteContactEmail: siteContactEmail.trim() || null,
        policyNo: policy,
        lossType: konu,
        description: ihbar || null,
        priority,
        notifyFileOwner: true,
        customerId: customer?.id ?? null,
        assignedOfficeUserId: assignedOfficeUserId || null,
        insuranceCompanyId,
        channelBrokerCustomerId: channelBrokerCustomerId || null,
        channelAgencyCustomerId: channelAgencyCustomerId || null,
        city: cityName || 'Belirtilmemiş',
        district: districtName || null,
        propertyAddress: line || [cityName, districtName].filter(Boolean).join(' / ') || 'Belirtilmemiş',
      };

      const r = await axios.patch(`${API}/claim-files/${claim.id}`, payload, { headers: authHeader() });
      const updated = r.data?.data ?? r.data;
      const nextOffice =
        updated?.assignedOfficeUser
        ?? officeOptions.find((u) => u.id === assignedOfficeUserId)
        ?? (assignedOfficeUserId ? claim.assignedOfficeUser : null);
      onSaved({
        insuredName: updated?.insuredName ?? (name || null),
        insuredPhone: updated?.insuredPhone ?? (phone || null),
        siteContactName: updated?.siteContactName ?? (irtibatAd || null),
        siteContactPhone: updated?.siteContactPhone ?? (irtibatTel || null),
        siteContactEmail: updated?.siteContactEmail ?? (siteContactEmail.trim() || null),
        policyNo: updated?.policyNo ?? policy,
        lossType: updated?.lossType ?? konu,
        description: updated?.description ?? (ihbar || null),
        priority: updated?.priority ?? priority,
        customerId: updated?.customerId ?? customer?.id ?? null,
        customer: updated?.customer ?? customer,
        assignedOfficeUserId: updated?.assignedOfficeUserId ?? (assignedOfficeUserId || null),
        assignedOfficeUser: nextOffice,
        insuranceCompanyId: updated?.insuranceCompanyId ?? insuranceCompanyId,
        insuranceCompany: updated?.insuranceCompany
          ?? insuranceCompanies.find((row) => row.id === insuranceCompanyId)
          ?? claim.insuranceCompany,
        channelBrokerCustomerId: updated?.channelBrokerCustomerId ?? (channelBrokerCustomerId || null),
        channelBrokerCustomer: updated?.channelBrokerCustomer ?? null,
        channelAgencyCustomerId: updated?.channelAgencyCustomerId ?? (channelAgencyCustomerId || null),
        channelAgencyCustomer: updated?.channelAgencyCustomer ?? null,
        propertyAddress: updated?.propertyAddress ?? {
          ...(claim.propertyAddress ?? {}),
          city: cityName || 'Belirtilmemiş',
          district: districtName || null,
          addressLine: line || [cityName, districtName].filter(Boolean).join(' / ') || 'Belirtilmemiş',
        },
        claimSubject: updated?.claimSubject ?? claim.claimSubject,
        departmentFileSubject: updated?.departmentFileSubject ?? claim.departmentFileSubject,
      });
      showToast('success', 'Dosya Bilgileri Güncellendi');
      onClose();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : 'Kaydedilemedi';
      const text = Array.isArray(msg) ? msg.join(', ') : String(msg);
      setError(text);
      showToast('error', text || 'Dosya Bilgileri Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          role="dialog"
          aria-labelledby="dosya-bilgileri-edit-title"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <h3 id="dosya-bilgileri-edit-title" className="text-base font-semibold text-slate-800">
                Dosya Bilgilerini Düzenle
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Yanlış girilen il, adres, ihbar ve sorumlu bilgilerini düzeltebilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
              aria-label="Kapat"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sigortalı Adı</label>
                <input
                  className={fieldCls}
                  value={insuredName}
                  onChange={(e) => setInsuredName(e.target.value)}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setInsuredName(v);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sigortalı Telefon</label>
                <PhoneInput
                  value={insuredPhone}
                  onChange={setInsuredPhone}
                  placeholder="532 133 4144"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">İrtibat Ad Soyad</label>
                <input
                  className={fieldCls}
                  value={siteContactName}
                  onChange={(e) => setSiteContactName(e.target.value)}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setSiteContactName(v);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">İrtibat Telefon</label>
                <PhoneInput
                  value={siteContactPhone}
                  onChange={setSiteContactPhone}
                  placeholder="532 133 4144"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                  <span>İrtibat E-posta</span>
                  <FieldHelpTip text="Tespit planı bu kutuya gider. Boşsa mail gitmez." testId="duzenle-irtibat-eposta-yardim" />
                </label>
                <input
                  className={fieldCls}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={siteContactEmail}
                  onChange={(e) => setSiteContactEmail(e.target.value)}
                  placeholder="Örn. ad@firma.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Poliçe No <span className="text-status-danger">*</span>
                </label>
                <input
                  className={fieldCls}
                  value={policyNo}
                  onChange={(e) => setPolicyNo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Öncelik <span className="text-status-danger">*</span>
                </label>
                <select
                  className={fieldCls}
                  data-testid="dosya-oncelik"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Seçiniz...</option>
                  {CLAIM_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Dosya Konusu <span className="text-status-danger">*</span>
                </label>
                <select
                  className={fieldCls}
                  value={lossType}
                  onChange={(e) => setLossType(e.target.value)}
                >
                  <option value="">Seçiniz...</option>
                  {lossType && !subjectOptions.includes(lossType) && (
                    <option value={lossType}>{lossType}</option>
                  )}
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
                {subjectsLoadFailed && (
                  <p className="text-xs text-amber-600 mt-0.5">Dosya konuları yüklenemedi. Lütfen sayfayı yenileyin.</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs font-medium text-slate-600">Hasar Adresi</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{ADDRESS_FIELD.province}</label>
                  <select
                    className={fieldCls}
                    value={cityCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const prov = STATIC_PROVINCES.find((p) => p.code === code);
                      setCityCode(code);
                      setCity(prov?.name ?? '');
                      setDistrict('');
                    }}
                  >
                    <option value="">{ADDRESS_FIELD.provincePlaceholder}</option>
                    {STATIC_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{ADDRESS_FIELD.district}</label>
                  <select
                    className={fieldCls}
                    value={district}
                    disabled={!cityCode}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                    {district && !districts.includes(district) && (
                      <option value={district}>{district}</option>
                    )}
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2" data-field="openAddress">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-slate-600">{ADDRESS_FIELD.openAddress}</label>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-800"
                      onClick={() => {
                        const found = applyClaimAddressPlace(addressLine);
                        if (!found.city || found.conflict?.includes('birden fazla')) {
                          setError(found.conflict || 'Adreste il okunamadı. İl ve ilçeyi adresle aynı seçin.');
                          return;
                        }
                        const prov = STATIC_PROVINCES.find((row) => row.name === found.city);
                        if (!prov) return;
                        setCityCode(prov.code);
                        setCity(prov.name);
                        const names = STATIC_DISTRICTS[prov.code] ?? [];
                        setDistrict(found.district && names.includes(found.district) ? found.district : '');
                        setError('');
                      }}
                    >
                      Konumu Bul
                    </button>
                  </div>
                  <textarea
                    className={`${fieldCls} resize-y min-h-[56px]`}
                    rows={2}
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    onBlur={(e) => {
                      const v = toTitleCaseTR(e.target.value.trim());
                      if (v) setAddressLine(v);
                    }}
                    placeholder={ADDRESS_FIELD.openAddressPlaceholder}
                  />
                </div>
                <div className="sm:col-span-2" data-field="ihbarIcerigi">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">İhbar İçeriği</label>
                  <textarea
                    className={`${fieldCls} resize-y min-h-[72px]`}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={(e) => {
                      const v = toTitleCaseTR(e.target.value.trim());
                      if (v) setDescription(v);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="duzenle-dosya-kanali">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Sigorta Şirketi <span className="text-status-danger">*</span>
                </label>
                <select
                  className={fieldCls}
                  data-testid="duzenle-sigorta-sirketi"
                  value={insuranceCompanyId}
                  onChange={(e) => setInsuranceCompanyId(e.target.value)}
                >
                  <option value="">Seçiniz...</option>
                  {insuranceCompanies.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Broker <span className="font-normal text-slate-400">Tercihe Bağlı</span>
                </label>
                <select
                  className={fieldCls}
                  data-testid="duzenle-broker"
                  value={channelBrokerCustomerId}
                  onChange={(e) => setChannelBrokerCustomerId(e.target.value)}
                >
                  <option value="">Seçiniz...</option>
                  {brokerFirms.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Acente <span className="font-normal text-slate-400">Tercihe Bağlı</span>
                </label>
                <select
                  className={fieldCls}
                  data-testid="duzenle-acente"
                  value={channelAgencyCustomerId}
                  onChange={(e) => setChannelAgencyCustomerId(e.target.value)}
                >
                  <option value="">Seçiniz...</option>
                  {agencyFirms.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Eksper Ofisi</label>
                <div className="flex gap-2">
                  <input
                    className={`${fieldCls} flex-1`}
                    value={customer ? customerDisplayName(customer) : ''}
                    readOnly
                    placeholder="Seçilmedi"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomerPickerOpen(true)}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-blue-50"
                  >
                    Seç
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Dosya Sorumlusu</label>
                <select
                  className={fieldCls}
                  value={assignedOfficeUserId}
                  onChange={(e) => setAssignedOfficeUserId(e.target.value)}
                >
                  <option value="">Atanmamış</option>
                  {officeOptions.map((u) => (
                    <option key={u.id} value={u.id}>{officeUserLabel(u)}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <CustomerSelectModal
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerPickerOpen(false);
        }}
        subTypeFilter={HASAR_EXPERT_CUSTOMER_SUB_TYPE}
        hideTypeColumn
      />
    </>
  );
}
