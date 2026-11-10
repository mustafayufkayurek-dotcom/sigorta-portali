'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { CollapsibleFormPanel } from '@/components/form/CollapsibleFormPanel';
import { NewFilePanelShell } from '@/components/form/NewFilePanelShell';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { normalizeTrDateValue, isCompleteTrDateValue } from '@/utils/tr-date-input';
import { formatVendorAddress } from '@/utils/vendor-form-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { isOfficeStaffRole } from '@/hooks/usePanelRole';
import {
  clearYeniDosyaTaslak,
  loadYeniDosyaTaslak,
  saveYeniDosyaTaslak,
  todayTrDateDisplay,
  type YeniDosyaReturnSlot,
  type YeniDosyaTaslak,
} from '@/utils/claim-new-form-helpers';
import {
  customerDisplayName,
  customerSubTypeLabel,
} from '@/utils/customer-form-helpers';
import { getApiErrorMessage } from '@/utils/api-error';
import { reportCaughtError } from '@/utils/report-caught-error';
import { createInFlightGuard } from '@/utils/in-flight-guard';
import { FieldHelpTip } from '@/components/ui/FieldHelpTip';
import { fetchDepartmentFileSubjectNames } from '@/utils/damage-reason-options';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { PhoneInput } from '@/components/PhoneInput';
import { buildMusteriGrubuAddHref } from '@/utils/musteri-gruplari-add-context';
import { parseInternationalPhone } from '@/data/country-codes';
import {
  CLAIM_FILE_CHANNELS,
  CLAIM_SERVICE_KIND_LABEL,
  CLAIM_SERVICE_KINDS,
  CONSULTANCY_SERVICE_FAMILY,
  HASAR_FILE_INSURANCE_CATALOG_QUERY,
  CLAIM_CUSTOMER_SOURCES,
  CLAIM_CUSTOMER_SOURCE_LABEL,
  claimCustomerSourceAllowsPrivateAlongside,
  claimCustomerSourceContactLabel,
  claimCustomerSourceFromSubType,
  claimCustomerSourceHidesChannel,
  claimCustomerSourceSubType,
  claimFileChannelCreateFields,
  claimServiceKindFromListHizmet,
  departmentCodeForNewClaim,
  consultancyTypesForNewFile,
  filterInsuranceCatalogForHasarFileForm,
  newClaimOpeningCaption,
  parseClaimCustomerSource,
  parseClaimServiceKind,
  parseServiceTypeListPayload,
  findHizmetKarti,
  hizmetKartiCodeForClaim,
  hizmetRequiredPartyMessage,
  mergeHizmetKartlari,
  missingHizmetRequiredParty,
  type ClaimCustomerSource,
  type HizmetKarti,
  type ClaimServiceKind,
} from '@sigorta/shared';



type InsuranceCompany = { id: string; name: string; email?: string | null };
type ClaimStatus = { id: string; code: string; name: string };
type SelectedCustomer = {
  id: string;
  subType?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  shortName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  insuranceCompanyId?: string | null;
};

type SourceContact = { id: string; name: string; phone?: string | null; email?: string | null };

type PanelUser = { id: string; firstName?: string | null; lastName?: string | null };
type ConsultancyTypeOption = { id: string; name: string; code?: string | null };
type ChannelFirm = { id: string; name: string; email?: string | null };

function customersToChannelFirms(payload: unknown): ChannelFirm[] {
  const nested = payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data?: unknown }).data
    : payload;
  const rows = Array.isArray(nested) ? nested : [];
  return rows
    .map((row) => {
      const c = row as SelectedCustomer & { id?: string };
      const id = String(c.id ?? '').trim();
      const name = customerDisplayName(c);
      const email = String((c as { email?: string | null }).email ?? '').trim() || null;
      return { id, name, email };
    })
    .filter((row) => row.id && row.name && row.name !== '—')
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const inpCompact = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const lbl = 'block text-xs font-medium text-slate-600 mb-1.5';
const lblCompact = 'block text-[11px] font-medium text-slate-600 mb-1';

export type ClaimNewFormProps = {
  variant?: 'panel' | 'page';
  onSuccess: (claimId: string) => void;
  onCancel: () => void;
  prefillCustomerId?: string | null;
  prefillSlot?: string | null;
  listHizmet?: string | null;
};

export function ClaimNewForm({ variant = 'page', onSuccess, onCancel, prefillCustomerId, prefillSlot, listHizmet }: ClaimNewFormProps) {
  const isPanel = variant === 'panel';
  const field = isPanel ? inpCompact : inp;
  const label = isPanel ? lblCompact : lbl;
  /** Panel + mobil: tek sütun; sm+ iki sütun */
  const formGrid = 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2';
  const spanFull = 'col-span-1 sm:col-span-2';

  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [claimSubjects, setClaimSubjects] = useState<string[]>([]);
  const [subjectsLoadFailed, setSubjectsLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitGuard = useRef(createInFlightGuard());

  const [insuranceCompanyId, setInsuranceCompanyId] = useState(() => loadYeniDosyaTaslak()?.insuranceCompanyId ?? '');
  const [channelAgencyCustomerId, setChannelAgencyCustomerId] = useState(() => loadYeniDosyaTaslak()?.channelAgencyCustomerId ?? '');
  const [channelBrokerCustomerId, setChannelBrokerCustomerId] = useState(() => loadYeniDosyaTaslak()?.channelBrokerCustomerId ?? '');
  const [channelExpertCustomerId, setChannelExpertCustomerId] = useState(() => loadYeniDosyaTaslak()?.channelExpertCustomerId ?? '');
  const [channelAgencyFirms, setChannelAgencyFirms] = useState<ChannelFirm[]>([]);
  const [channelBrokerFirms, setChannelBrokerFirms] = useState<ChannelFirm[]>([]);
  const [channelExpertFirms, setChannelExpertFirms] = useState<ChannelFirm[]>([]);
  const [fileNo, setFileNo] = useState(() => loadYeniDosyaTaslak()?.fileNo ?? '');
  const [lossType, setLossType] = useState(() => loadYeniDosyaTaslak()?.lossType ?? '');
  const [notificationDate, setNotificationDate] = useState(() => loadYeniDosyaTaslak()?.notificationDate || todayTrDateDisplay());
  const [insuredName, setInsuredName] = useState(() => loadYeniDosyaTaslak()?.insuredName ?? '');
  const [description, setDescription] = useState(() => loadYeniDosyaTaslak()?.description ?? '');
  const [currentStatusId, setCurrentStatusId] = useState('');

  const [customerSource, setCustomerSource] = useState<ClaimCustomerSource>(() => {
    const saved = loadYeniDosyaTaslak()?.customerSource;
    return saved ? parseClaimCustomerSource(saved) : 'expert';
  });
  const [privateCustomer, setPrivateCustomer] = useState<SelectedCustomer | null>(() => loadYeniDosyaTaslak()?.privateCustomer ?? null);
  const [sourceContacts, setSourceContacts] = useState<SourceContact[]>([]);
  const [sourceContactId, setSourceContactId] = useState(() => loadYeniDosyaTaslak()?.sourceContactId ?? '');
  const [customerPickTarget, setCustomerPickTarget] = useState<'source' | 'private'>('source');
  const [serviceKind, setServiceKind] = useState<ClaimServiceKind>(() => {
    const saved = loadYeniDosyaTaslak()?.serviceKind;
    return saved ? parseClaimServiceKind(saved) : claimServiceKindFromListHizmet(listHizmet);
  });
  const [consultancyTypes, setConsultancyTypes] = useState<ConsultancyTypeOption[]>([]);
  const [hizmetKartlari, setHizmetKartlari] = useState<HizmetKarti[]>([]);
  const [consultancyServiceTypeId, setConsultancyServiceTypeId] = useState(() => loadYeniDosyaTaslak()?.consultancyServiceTypeId ?? '');
  const router = useRouter();
  const [officeUsers, setOfficeUsers] = useState<PanelUser[]>([]);
  const [assignedOfficeUserId, setAssignedOfficeUserId] = useState(() => loadYeniDosyaTaslak()?.assignedOfficeUserId ?? '');
  const [siteContactName, setSiteContactName] = useState(() => loadYeniDosyaTaslak()?.siteContactName ?? '');
  const [siteContactPhone, setSiteContactPhone] = useState(() => loadYeniDosyaTaslak()?.siteContactPhone ?? '');
  const [siteContactEmail, setSiteContactEmail] = useState(() => loadYeniDosyaTaslak()?.siteContactEmail ?? '');
  const [sessionUserId, setSessionUserId] = useState('');
  const [fileNoChecking, setFileNoChecking] = useState(false);
  const [fileNoError, setFileNoError] = useState<string | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(() => loadYeniDosyaTaslak()?.selectedCustomer ?? null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState('');
  const [newCustomerTaxNumber, setNewCustomerTaxNumber] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [phoneDupError, setPhoneDupError] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState(() => loadYeniDosyaTaslak()?.customerSearch ?? '');
  const [customerResults, setCustomerResults] = useState<SelectedCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customerFileOrdinal, setCustomerFileOrdinal] = useState<number | null>(null);
  const [customerFileOrdinalLoading, setCustomerFileOrdinalLoading] = useState(false);

  const [cityCode, setCityCode] = useState(() => loadYeniDosyaTaslak()?.cityCode ?? '');
  const [city, setCity] = useState(() => loadYeniDosyaTaslak()?.city ?? '');
  const [district, setDistrict] = useState(() => loadYeniDosyaTaslak()?.district ?? '');
  const [openAddress, setOpenAddress] = useState(() => loadYeniDosyaTaslak()?.openAddress ?? '');

  const [openSections, setOpenSections] = useState({ eksper: true, dosya: true });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentDistricts = cityCode ? (STATIC_DISTRICTS[cityCode] ?? []) : [];

  const selectedCustomerDisplayName = selectedCustomer
    ? customerDisplayName(selectedCustomer)
    : null;

  const eksperSummary = selectedCustomer
    ? selectedCustomerDisplayName ?? 'Seçildi'
    : showNewCustomerForm
      ? 'Yeni eksper ofisi'
      : customerSearch.trim() || 'Opsiyonel — seçilmedi';

  const dosyaSummary = [
    insuredName.trim(),
    lossType,
    fileNo.trim(),
    customerFileOrdinal != null ? `${customerFileOrdinal}. Dosya` : '',
    [city, district].filter(Boolean).join(' / '),
  ].filter(Boolean).join(' · ') || 'Zorunlu alanları doldurun';

  const loadLookups = useCallback(async () => {
    try {
      const channelFirmParams = (subType: string) => ({
        headers: authHeader(),
        params: { subType, status: 'active', limit: 1000, customerType: 'corporate' },
      });
      const [icRes, meRes, staffRes, consultancyRes, agencyRes, brokerRes, expertRes, cardsRes] = await Promise.all([
        axios.get(`${API}/insurance-companies`, {
          headers: authHeader(),
          params: HASAR_FILE_INSURANCE_CATALOG_QUERY,
        }),
        axios.get(`${API}/auth/me`, { headers: authHeader() }).catch(() => null),
        axios
          .get(`${API}/claim-files/assignable-staff`, {
            headers: authHeader(),
            params: { role: 'office_staff', includeDelegates: 'hasar' },
          })
          .catch(() => ({ data: { data: [] } })),
        axios
          .get(`${API}/service-types`, {
            headers: authHeader(),
            params: { family: CONSULTANCY_SERVICE_FAMILY },
          })
          .catch(() => null),
        axios.get(`${API}/customers`, channelFirmParams(CLAIM_FILE_CHANNELS[1].customerSubType!)).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/customers`, channelFirmParams(CLAIM_FILE_CHANNELS[2].customerSubType!)).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/customers`, channelFirmParams(CLAIM_FILE_CHANNELS[3].customerSubType!)).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/system-settings/hizmet-kartlari`, { headers: authHeader() }).catch(() => ({ data: { data: [] } })),
      ]);
      setHizmetKartlari(mergeHizmetKartlari(cardsRes.data?.data ?? []));
      setChannelAgencyFirms(customersToChannelFirms(agencyRes.data));
      setChannelBrokerFirms(customersToChannelFirms(brokerRes.data));
      setChannelExpertFirms(customersToChannelFirms(expertRes.data));
      let companies: InsuranceCompany[] = (icRes.data.data || []).map((row: { id: string; name: string; contactEmail?: string | null }) => ({
        id: row.id,
        name: row.name,
        email: row.contactEmail ?? null,
      }));
      const me = meRes?.data?.data ?? meRes?.data?.user ?? meRes?.data;
      const roleCode = String(me?.role?.code ?? me?.roleCode ?? '').toLowerCase();
      const meId = String(me?.id ?? me?.userId ?? '');
      if (meId) setSessionUserId(meId);
      const staff = (staffRes.data?.data ?? []) as PanelUser[];
      setOfficeUsers(staff);
      setAssignedOfficeUserId((prev) => {
        if (prev) return prev;
        if (meId && staff.some((u) => u.id === meId)) return meId;
        if (staff.length === 1) return staff[0].id;
        return '';
      });
      companies = filterInsuranceCatalogForHasarFileForm(
        companies,
        roleCode,
        me?.insuranceCompanyScopes,
      );
      setInsuranceCompanies(companies);

      setInsuranceCompanyId((prev) => {
        if (prev) return prev;
        if (isOfficeStaffRole(roleCode) && companies.length === 1) return companies[0].id;
        return '';
      });

      const consultancyRows = consultancyTypesForNewFile(
        parseServiceTypeListPayload(consultancyRes?.data),
      );
      setConsultancyTypes(consultancyRows);
      setConsultancyServiceTypeId((prev) => {
        if (!prev) return '';
        if (consultancyRows.length === 0) return prev;
        return consultancyRows.some((row) => row.id === prev) ? prev : '';
      });
    } catch (e) {
      reportCaughtError(e, 'Form seçenekleri yüklenemedi. Lütfen sayfayı yenileyin.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const departmentCode = departmentCodeForNewClaim({
      customerSource,
      serviceKind: parseClaimServiceKind(serviceKind),
    });
    void fetchDepartmentFileSubjectNames(departmentCode)
      .then((names) => {
        if (cancelled) return;
        setClaimSubjects(names);
        setSubjectsLoadFailed(false);
        setLossType((prev) => (prev && names.includes(prev) ? prev : ''));
      })
      .catch((err) => {
        if (cancelled) return;
        reportCaughtError(err, 'Hasar konuları yüklenemedi. Lütfen sayfayı yenileyin.');
        setClaimSubjects([]);
        setSubjectsLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerSource, serviceKind]);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/claim-files/statuses`, { headers: authHeader() });
      const data: ClaimStatus[] = res.data.data || [];
      const newStatus = data.find((s) => s.code === 'new');
      if (newStatus) setCurrentStatusId(newStatus.id);
    } catch (e) {
      reportCaughtError(e, 'Dosya durumu yüklenemedi. Kayıt yine de denenebilir.', { toastType: 'warning' });
    }
  }, []);

  useEffect(() => { loadLookups(); loadStatuses(); }, [loadLookups, loadStatuses]);

  useEffect(() => {
    const id = String(prefillCustomerId ?? '').trim();
    if (!id) return;
    let alive = true;
    axios.get(`${API}/customers/${id}`, { headers: authHeader() }).then((res) => {
      const c = res.data?.data ?? res.data;
      if (!alive || !c?.id) return;
      const picked: SelectedCustomer = {
        id: String(c.id),
        subType: c.subType ?? null,
        fullName: c.fullName ?? null,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        companyName: c.companyName ?? null,
        shortName: c.shortName ?? null,
        identityNo: c.identityNo ?? null,
        taxNumber: c.taxNumber ?? null,
        phone: c.phone ?? null,
        insuranceCompanyId: c.insuranceCompanyId ?? null,
      };
      const slot = String(prefillSlot ?? loadYeniDosyaTaslak()?.returnSlot ?? '').trim();
      if (slot === 'agency' || slot === 'broker' || slot === 'expert') {
        if (slot === 'agency') setChannelAgencyCustomerId(String(c.id));
        if (slot === 'broker') setChannelBrokerCustomerId(String(c.id));
        if (slot === 'expert') setChannelExpertCustomerId(String(c.id));
        return;
      }
      if (slot === 'private') {
        setPrivateCustomer(picked);
        return;
      }
      const source = claimCustomerSourceFromSubType(c.subType);
      setCustomerSource(source);
      setSelectedCustomer(picked);
      setCustomerSearch(customerDisplayName(picked));
      setShowNewCustomerForm(false);
      const contacts = Array.isArray(c.contacts) ? c.contacts : [];
      setSourceContacts(
        source === 'private'
          ? []
          : contacts
            .map((row: { id?: string; name?: string; phone?: string | null; email?: string | null }) => ({
              id: String(row.id ?? '').trim(),
              name: String(row.name ?? '').trim(),
              phone: row.phone ?? null,
              email: row.email ?? null,
            }))
            .filter((row: SourceContact) => row.id && row.name),
      );
      if (source === 'insurance') {
        const linked = String(c.insuranceCompanyId ?? '').trim();
        if (linked) setInsuranceCompanyId(linked);
      }
    }).catch(() => { /* kart seçimi sessizce durur */ });
    return () => { alive = false; };
  }, [prefillCustomerId, prefillSlot]);

  const loadCustomerClaimFileOrdinal = useCallback(async (customerId: string) => {
    setCustomerFileOrdinalLoading(true);
    try {
      const res = await axios.get(`${API}/customers/${customerId}`, { headers: authHeader() });
      const existing = res.data?.data?._count?.claimFiles ?? 0;
      setCustomerFileOrdinal(existing + 1);
    } catch {
      setCustomerFileOrdinal(null);
    } finally {
      setCustomerFileOrdinalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer?.id) {
      void loadCustomerClaimFileOrdinal(selectedCustomer.id);
    } else {
      setCustomerFileOrdinal(null);
      setCustomerFileOrdinalLoading(false);
    }
  }, [selectedCustomer?.id, loadCustomerClaimFileOrdinal]);

  useEffect(() => {
    const id = String(selectedCustomer?.id ?? '').trim();
    if (!id || customerSource === 'private') return;
    if (customerSource === 'expert') setChannelExpertCustomerId(id);
    if (customerSource === 'broker') setChannelBrokerCustomerId(id);
  }, [selectedCustomer?.id, customerSource]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearch(val);
    if (!val.trim()) { setCustomerResults([]); setShowCustomerDropdown(false); return; }
    if (customerSearchDebounce.current) clearTimeout(customerSearchDebounce.current);
    customerSearchDebounce.current = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const params = new URLSearchParams({
          search: val.trim(),
          limit: '15',
          status: 'active',
        });
        params.set('subType', claimCustomerSourceSubType(customerSource));
        const res = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
        const data = res.data.data || [];
        setCustomerResults(data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          subType: (c.subType as string | null) ?? null,
          fullName: (c.fullName as string | null) ?? null,
          firstName: (c.firstName as string | null) ?? null,
          lastName: (c.lastName as string | null) ?? null,
          companyName: (c.companyName as string | null) ?? null,
          identityNo: (c.identityNo as string | null) ?? null,
          taxNumber: (c.taxNumber as string | null) ?? null,
          phone: (c.phone as string | null) ?? null,
        })));
        setShowCustomerDropdown(true);
      } catch (e) {
        reportCaughtError(e, 'Müşteri araması başarısız. Lütfen tekrar deneyin.');
        setCustomerResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);
  };

  const applySourceCard = useCallback(async (c: SelectedCustomer) => {
    setSelectedCustomer(c);
    setCustomerSearch(customerDisplayName(c));
    setShowCustomerDropdown(false);
    setShowNewCustomerForm(false);
    setSourceContactId('');
    setSourceContacts([]);
    setErrors((prev) => { const e = { ...prev }; delete e.customer; delete e.insuranceCompanyId; delete e.sourceContactId; return e; });
    if (customerSource === 'private') return;
    try {
      const res = await axios.get(`${API}/customers/${c.id}`, { headers: authHeader() });
      const card = res.data?.data ?? res.data;
      const contacts = Array.isArray(card?.contacts) ? card.contacts : [];
      setSourceContacts(
        contacts
          .map((row: { id?: string; name?: string; phone?: string | null; email?: string | null }) => ({
            id: String(row.id ?? '').trim(),
            name: String(row.name ?? '').trim(),
            phone: row.phone ?? null,
            email: row.email ?? null,
          }))
          .filter((row: SourceContact) => row.id && row.name),
      );
      if (customerSource === 'insurance') {
        const linked = String(card?.insuranceCompanyId ?? c.insuranceCompanyId ?? '').trim();
        if (linked) {
          setInsuranceCompanyId(linked);
        } else {
          const cardName = customerDisplayName({
            companyName: card?.companyName,
            shortName: card?.shortName,
            fullName: card?.fullName,
          }).toLocaleLowerCase('tr-TR');
          const match = insuranceCompanies.find((row) => row.name.toLocaleLowerCase('tr-TR') === cardName);
          setInsuranceCompanyId(match?.id ?? '');
        }
      }
    } catch {
      setSourceContacts([]);
    }
  }, [customerSource, insuranceCompanies]);

  const handleSelectCustomerFromDropdown = (c: SelectedCustomer) => {
    void applySourceCard(c);
  };

  const checkPhoneDuplicate = async (phone: string) => {
    if (!phone || phone.replace(/\D/g, '').replace(/^90/, '').length < 10) { setPhoneDupError(null); return; }
    try {
      const res = await axios.get(`${API}/customers/check-duplicate?phone=${encodeURIComponent(phone)}`, { headers: authHeader() });
      const data = res.data.data;
      if (data.exists && !data.warnOnly) {
        setPhoneDupError(`Bu telefon ile kayıtlı müşteri mevcut: ${data.existingRecord?.fullName}`);
      } else {
        setPhoneDupError(null);
      }
    } catch (e) {
      reportCaughtError(e, 'Telefon kontrolü yapılamadı. Kaydetmeden önce tekrar deneyin.', { toastType: 'warning' });
      setPhoneDupError('Telefon kontrolü yapılamadı. Lütfen tekrar deneyin.');
    }
  };

  const checkFileNoDuplicate = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) { setFileNoError(null); return; }
    setFileNoChecking(true);
    try {
      const res = await axios.get(`${API}/claim-files/check-file-no?fileNo=${encodeURIComponent(trimmed)}`, { headers: authHeader() });
      const data = res.data.data;
      if (data.exists) {
        setFileNoError('Bu dosya numarası zaten hasar dosyasında kullanılıyor');
      } else {
        setFileNoError(null);
      }
    } catch (e) {
      reportCaughtError(e, 'Dosya no kontrolü yapılamadı. Kaydetmeden önce tekrar deneyin.', { toastType: 'warning' });
      setFileNoError('Dosya no kontrolü yapılamadı. Lütfen tekrar deneyin.');
    }
    finally { setFileNoChecking(false); }
  };

  const validateDosyaFields = (errs: Record<string, string>) => {
    if (!fileNo.trim()) errs.fileNo = 'Dosya numarası zorunludur.';
    if (fileNoError) errs.fileNo = fileNoError;
    if (customerSource !== 'private' && customerSource !== 'insurance' && !insuranceCompanyId) {
      errs.insuranceCompanyId = 'Sigorta şirketi zorunludur.';
    }
    if (customerSource === 'insurance' && !insuranceCompanyId) {
      errs.insuranceCompanyId = 'Seçilen sigorta kartı şirket listesine bağlı değil.';
    }
    if (claimCustomerSourceContactLabel(customerSource) && sourceContacts.length > 0 && !sourceContactId) {
      errs.sourceContactId = 'Karttaki dosya sorumlusu seçilmelidir.';
    }
    if (!lossType) errs.lossType = 'Hasar konusu zorunludur.';
    if (!assignedOfficeUserId) errs.assignedOfficeUserId = 'Dosya sorumlusu zorunludur.';
    if (!serviceKind) errs.serviceKind = 'Hizmet türü zorunludur.';
    if (serviceKind === 'consultancy' && !consultancyServiceTypeId) {
      errs.consultancyServiceTypeId = 'Danışmanlık hizmet türü zorunludur.';
    }
    const typeRow = consultancyTypes.find((row) => row.id === consultancyServiceTypeId);
    const card = findHizmetKarti(hizmetKartlari, hizmetKartiCodeForClaim({
      serviceKind,
      consultancyServiceType: typeRow ? { code: typeRow.code, name: typeRow.name } : null,
    }));
    const missingParty = missingHizmetRequiredParty(card, {
      insurance: insuranceCompanyId,
      broker: channelBrokerCustomerId || (customerSource === 'broker' ? selectedCustomer?.id : ''),
      expert: channelExpertCustomerId || (customerSource === 'expert' ? selectedCustomer?.id : ''),
    });
    if (missingParty && !(missingParty === 'insurance' && customerSource === 'private')) {
      const field = missingParty === 'insurance' ? 'insuranceCompanyId'
        : missingParty === 'broker' ? 'channelBrokerCustomerId'
          : 'channelExpertCustomerId';
      errs[field] = hizmetRequiredPartyMessage(missingParty);
    }
    const ihbarToday = todayTrDateDisplay();
    if (!isPanel && !isCompleteTrDateValue(notificationDate || ihbarToday)) {
      errs.notificationDate = 'İhbar tarihi zorunludur (GG.AA.YYYY).';
    }
    if (!insuredName.trim()) errs.insuredName = 'Sigortalı adı soyadı zorunludur.';
  };

  const validateEksperFields = (errs: Record<string, string>) => {
    if (showNewCustomerForm && customerSource !== 'private') {
      if (!newCustomerCompanyName.trim()) errs.customer = 'Şirket adı zorunludur.';
      if (phoneDupError) errs.customer = phoneDupError;
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    validateEksperFields(errs);
    validateDosyaFields(errs);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.keys(errs)[0];
      requestAnimationFrame(() => {
        document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    if (errs.customer) setOpenSections((p) => ({ ...p, eksper: true }));
    if (errs.fileNo || errs.insuranceCompanyId || errs.lossType || errs.insuredName || errs.assignedOfficeUserId || errs.serviceKind || errs.consultancyServiceTypeId || errs.sourceContactId || errs.channelBrokerCustomerId || errs.channelExpertCustomerId) {
      setOpenSections((p) => ({ ...p, dosya: true }));
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ihbarToday = todayTrDateDisplay();
    setNotificationDate(ihbarToday);
    if (!validate()) return;
    if (!submitGuard.current.tryStart()) return;
    setSaving(true);
    setErrors((prev) => ({ ...prev, general: '' }));
    try {
      let customerId = selectedCustomer?.id ?? '';

      if (showNewCustomerForm && customerSource !== 'private') {
        const cRes = await axios.post(`${API}/customers`, {
          type: 'corporate',
          subType: claimCustomerSourceSubType(customerSource),
          serviceType: 'hasar',
          companyName: toTitleCaseTR(newCustomerCompanyName.trim()),
          taxNumber: newCustomerTaxNumber.trim() || undefined,
          phone: newCustomerPhone || undefined,
        }, { headers: authHeader() });
        customerId = cRes.data.data.id;
      } else if (privateCustomer?.id && customerSource !== 'private') {
        customerId = privateCustomer.id;
      } else if (!customerId && insuredName.trim()) {
        const name = toTitleCaseTR(insuredName.trim());
        const parts = name.split(/\s+/).filter(Boolean);
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        const cRes = await axios.post(`${API}/customers`, {
          type: 'individual',
          subType: customerSource === 'private' ? 'private_customer' : undefined,
          fullName: name,
          firstName,
          lastName: lastName || undefined,
        }, { headers: authHeader() });
        customerId = cRes.data.data.id;
      }

      let propertyAddressId: string | undefined;
      const openPart = openAddress.trim() ? toTitleCaseTR(openAddress.trim()) : '';
      const regionalPart = formatVendorAddress({ city, district });
      const addressLine = [openPart, regionalPart].filter(Boolean).join(', ') || undefined;
      if (addressLine) {
        const aRes = await axios.post(`${API}/addresses`, {
          city: city.trim() || 'Belirtilmemiş',
          district: district.trim() || undefined,
          addressLine,
        }, { headers: authHeader() });
        propertyAddressId = aRes.data.data?.id;
      }

      const ihbarIso = new Date(normalizeTrDateValue(ihbarToday)).toISOString();
      const payload: Record<string, unknown> = {
        fileNo: fileNo.trim(),
        insuranceCompanyId: insuranceCompanyId || undefined,
        policyNo: 'N/A',
        claimNo: fileNo.trim() || 'N/A',
        productBranch: 'diger',
        lossType,
        incidentDate: ihbarIso,
        notificationDate: ihbarIso,
        priority: 'normal',
        description: toTitleCaseTR(description.trim()) || undefined,
        insuredName: toTitleCaseTR(insuredName.trim()),
        customerId: customerId || undefined,
        propertyAddressId,
        assignedOfficeUserId,
        customerSource,
        serviceKind: parseClaimServiceKind(serviceKind),
        consultancyServiceTypeId: serviceKind === 'consultancy' ? consultancyServiceTypeId || undefined : undefined,
        siteContactName: toTitleCaseTR(siteContactName.trim()) || undefined,
        siteContactPhone: parseInternationalPhone(siteContactPhone).international || undefined,
        siteContactEmail: siteContactEmail.trim() || undefined,
        ...claimFileChannelCreateFields({
          channelAgencyCustomerId: customerSource === 'broker' ? null : channelAgencyCustomerId,
          channelBrokerCustomerId: channelBrokerCustomerId || (customerSource === 'broker' ? selectedCustomer?.id : '') || null,
          channelExpertCustomerId: channelExpertCustomerId || (customerSource === 'expert' ? selectedCustomer?.id : '') || null,
        }),
      };
      if (currentStatusId) payload.currentStatusId = currentStatusId;

      const res = await axios.post(`${API}/claim-files`, payload, { headers: authHeader() });
      const createdId = res.data?.data?.id;
      if (!createdId) {
        throw new Error('Oluşturulan dosya kimliği alınamadı');
      }
      clearYeniDosyaTaslak();
      onSuccess(createdId);
    } catch (err: unknown) {
      const errorText = getApiErrorMessage(err, 'Kayıt başarısız. Lütfen tekrar deneyin.');
      reportCaughtError(err, errorText, { toast: false });
      setErrors((prev) => ({ ...prev, general: errorText }));
    } finally {
      setSaving(false);
      submitGuard.current.end();
    }
  };

  const eksperSection = (
    <>
      <div className="mb-3" data-field="customerSource">
        <label className={label}>Müşteri Kaynağı</label>
        <div className="grid grid-cols-2 gap-1.5">
          {CLAIM_CUSTOMER_SOURCES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setCustomerSource(id);
                setSelectedCustomer(null);
                setPrivateCustomer(null);
                setSourceContacts([]);
                setSourceContactId('');
                setCustomerSearch('');
                setShowNewCustomerForm(false);
                setInsuranceCompanyId('');
                setChannelBrokerCustomerId('');
                setChannelExpertCustomerId('');
                if (id === 'broker') setChannelAgencyCustomerId('');
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                customerSource === id
                  ? 'border-brand-400 bg-brand-50 text-brand-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {CLAIM_CUSTOMER_SOURCE_LABEL[id]}
            </button>
          ))}
        </div>
      </div>
      {errors.customer && <p className="text-xs text-status-danger mb-2">{errors.customer}</p>}

      {selectedCustomer && !showNewCustomerForm ? (
        <div className="flex items-center justify-between gap-3 text-sm rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">{selectedCustomerDisplayName ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {customerSubTypeLabel(selectedCustomer.subType) ?? 'Müşteri'}
              {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setCustomerFileOrdinal(null); }}
            className="text-xs font-medium text-brand-600 hover:text-blue-800 shrink-0"
          >
            Değiştir
          </button>
        </div>
      ) : !showNewCustomerForm ? (
        <>
          <div ref={customerSearchRef} className="relative">
            <label className={label}>{CLAIM_CUSTOMER_SOURCE_LABEL[customerSource]} Ara</label>
            <input
              type="text"
              className={`${field} ${errors.customer ? 'border-red-400' : ''}`}
              placeholder="Ad, firma, telefon veya vergi no..."
              value={customerSearch}
              onChange={(e) => handleCustomerSearchChange(e.target.value)}
              onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
            />
            {customerSearchLoading && (
              <div className={`absolute right-3 ${isPanel ? 'top-7' : 'top-9'}`}>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {showCustomerDropdown && customerSearch.trim() && !customerSearchLoading && customerResults.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">Müşteri bulunamadı. Listeden seçin veya yeni ekleyin.</p>
            )}
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                {customerResults.map((c) => {
                  const name = customerDisplayName(c);
                  const subLabel = customerSubTypeLabel(c.subType);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomerFromDropdown(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"
                    >
                      <span className="font-medium text-slate-800">{name}</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                        {subLabel && <span>{subLabel}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        {c.taxNumber && <span>Vkn: {c.taxNumber}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => { setCustomerPickTarget('source'); setShowCustomerModal(true); }}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 sm:flex-1"
            >
              Listeden Seç
            </button>
            <button
              type="button"
              onClick={() => openFullCustomerCard(claimCustomerSourceSubType(customerSource), 'source')}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 sm:flex-1"
            >
              {`Yeni ${CLAIM_CUSTOMER_SOURCE_LABEL[customerSource]}`}
            </button>
          </div>
        </>
      ) : null}

      {claimCustomerSourceContactLabel(customerSource) && (
        <div className="mt-2" data-field="sourceContactId">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className={label}>
              {claimCustomerSourceContactLabel(customerSource)}
              {sourceContacts.length > 0 ? <span className="text-status-danger"> *</span> : null}
            </label>
            <button
              type="button"
              className="text-[11px] font-medium text-brand-700"
              onClick={() => openSourceContactCard()}
            >
              Kişi Ekle
            </button>
          </div>
          <select
            className={`${field} ${errors.sourceContactId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
            value={sourceContactId}
            disabled={!selectedCustomer || sourceContacts.length === 0}
            onChange={(e) => {
              const id = e.target.value;
              setSourceContactId(id);
              const row = sourceContacts.find((item) => item.id === id);
              if (!row) return;
              setSiteContactName((prev) => (prev.trim() ? prev : toTitleCaseTR(row.name)));
              setSiteContactPhone((prev) => (prev.trim() ? prev : String(row.phone ?? '')));
              setSiteContactEmail((prev) => (prev.trim() ? prev : String(row.email ?? '')));
              setErrors((p) => { const n = { ...p }; delete n.sourceContactId; return n; });
            }}
          >
            <option value="">{!selectedCustomer ? 'Önce kartı seçin' : sourceContacts.length ? 'Seçiniz...' : 'Kartta yetkili kişi yok'}</option>
            {sourceContacts.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          {errors.sourceContactId && <p className="text-xs text-status-danger mt-0.5">{errors.sourceContactId}</p>}
          {customerSource === 'insurance' && errors.insuranceCompanyId && (
            <p className="text-xs text-status-danger mt-0.5" data-field="insuranceCompanyId">{errors.insuranceCompanyId}</p>
          )}
        </div>
      )}

      {claimCustomerSourceAllowsPrivateAlongside(customerSource) && (
        <div className="mt-2" data-field="privateCustomer">
          <label className={label}>Bu Dosyadaki Özel Müşteri</label>
          {privateCustomer ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="truncate font-medium text-slate-800">{customerDisplayName(privateCustomer)}</span>
              <button type="button" className="text-xs font-medium text-brand-600" onClick={() => setPrivateCustomer(null)}>Kaldır</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setCustomerPickTarget('private'); setShowCustomerModal(true); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
            >
              Özel Müşteri Bağla
            </button>
          )}
        </div>
      )}

      {showNewCustomerForm && customerSource !== 'private' && customerSource !== 'insurance' && (
        <div className={`space-y-2 ${isPanel ? '' : 'space-y-3'} pt-1`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">
              {`Yeni ${CLAIM_CUSTOMER_SOURCE_LABEL[customerSource]}`}
            </p>
            <button
              type="button"
              onClick={() => { setShowNewCustomerForm(false); setPhoneDupError(null); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              İptal
            </button>
          </div>
          <div className={`${formGrid} ${isPanel ? '' : 'sm:gap-3'}`}>
            <div className={spanFull}>
              <label className={label}>Şirket Adı <span className="text-status-danger">*</span></label>
              <input
                className={field}
                value={newCustomerCompanyName}
                onChange={(e) => setNewCustomerCompanyName(e.target.value)}
                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setNewCustomerCompanyName(v); }}
              />
            </div>
            <div>
              <label className={label}>Vergi No</label>
              <input className={field} value={newCustomerTaxNumber} onChange={(e) => setNewCustomerTaxNumber(e.target.value)} />
            </div>
            <div>
              <label className={label}>Telefon</label>
              <PhoneInput
                value={newCustomerPhone}
                onChange={(v) => { setNewCustomerPhone(v); setPhoneDupError(null); }}
                onBlur={checkPhoneDuplicate}
                placeholder="532 133 4144"
                className={phoneDupError ? 'border-red-400 ring-2 ring-status-danger/20' : ''}
              />
              {phoneDupError && <p className="text-xs text-status-danger mt-0.5">{phoneDupError}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const taslakSnapshot = (returnSlot: YeniDosyaReturnSlot | '' = ''): YeniDosyaTaslak => ({
    customerSource,
    serviceKind,
    consultancyServiceTypeId,
    insuranceCompanyId,
    channelAgencyCustomerId,
    channelBrokerCustomerId,
    channelExpertCustomerId,
    fileNo,
    lossType,
    notificationDate,
    insuredName,
    description,
    assignedOfficeUserId,
    siteContactName,
    siteContactPhone,
    siteContactEmail,
    sourceContactId,
    customerSearch,
    cityCode,
    city,
    district,
    openAddress,
    selectedCustomer,
    privateCustomer,
    returnSlot,
  });

  useEffect(() => {
    const keptSlot = loadYeniDosyaTaslak()?.returnSlot ?? '';
    saveYeniDosyaTaslak(taslakSnapshot(keptSlot));
  }, [
    customerSource,
    serviceKind,
    consultancyServiceTypeId,
    insuranceCompanyId,
    channelAgencyCustomerId,
    channelBrokerCustomerId,
    channelExpertCustomerId,
    fileNo,
    lossType,
    notificationDate,
    insuredName,
    description,
    assignedOfficeUserId,
    siteContactName,
    siteContactPhone,
    siteContactEmail,
    sourceContactId,
    customerSearch,
    cityCode,
    city,
    district,
    openAddress,
    selectedCustomer,
    privateCustomer,
  ]);

  const yeniDosyaReturnTo = (slot: YeniDosyaReturnSlot | '' = '') => {
    const params = new URLSearchParams({ yeni: '1' });
    if (listHizmet) params.set('hizmet', listHizmet);
    if (slot) params.set('returnSlot', slot);
    return `/panel/hasar-dosyalari?${params.toString()}`;
  };

  const openFullCustomerCard = (subType: string, slot: YeniDosyaReturnSlot) => {
    saveYeniDosyaTaslak(taslakSnapshot(slot));
    const returnTo = yeniDosyaReturnTo(slot);
    if (subType === 'private_customer') {
      const params = new URLSearchParams({
        openAdd: '1',
        subType: 'private_customer',
        returnTo,
        returnLabel: 'Yeni Dosya',
      });
      router.push(`/panel/musteriler?${params.toString()}`);
      return;
    }
    router.push(buildMusteriGrubuAddHref({
      subType,
      returnTo,
      returnLabel: 'Yeni Dosya',
    }));
  };

  const openSourceContactCard = () => {
    const subType = claimCustomerSourceSubType(customerSource);
    if (!selectedCustomer?.id) {
      openFullCustomerCard(subType, 'source');
      return;
    }
    saveYeniDosyaTaslak(taslakSnapshot('source'));
    const params = new URLSearchParams({
      edit: selectedCustomer.id,
      subType,
      returnTo: yeniDosyaReturnTo('source'),
      returnLabel: 'Yeni Dosya',
    });
    router.push(`/panel/musteriler?${params.toString()}`);
  };

  const openChannelCustomer = (subType: 'acente_firmasi' | 'broker_firmasi' | 'eksper_firmasi') => {
    const slot: YeniDosyaReturnSlot = subType === 'acente_firmasi' ? 'agency' : subType === 'broker_firmasi' ? 'broker' : 'expert';
    openFullCustomerCard(subType, slot);
  };

  const channelAddLink = (subType: 'acente_firmasi' | 'broker_firmasi' | 'eksper_firmasi') => (
    <button
      type="button"
      className="mt-1 text-[11px] font-medium text-brand-700"
      onClick={() => openChannelCustomer(subType)}
    >
      Yeni Ekle
    </button>
  );

  const expertChannelOptions = (() => {
    const list = [...channelExpertFirms];
    const id = String(selectedCustomer?.id ?? '').trim();
    if (customerSource === 'expert' && id && !list.some((row) => row.id === id)) {
      list.unshift({ id, name: selectedCustomerDisplayName ?? 'Eksper Ofisi' });
    }
    return list;
  })();

  const dosyaSection = (
    <>
      <OpsFirstRunNotice
        compact
        noticeId={OPS_NOTICE.hasarDosyaKanali.id}
        title={OPS_NOTICE.hasarDosyaKanali.title}
        body={OPS_NOTICE.hasarDosyaKanali.body}
        testId="dosya-kanali-ilk-kullanim-seridi"
      />
      {selectedCustomer && (
        <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
          {customerFileOrdinalLoading ? (
            <p className="text-xs text-slate-500">Dosya sırası hesaplanıyor...</p>
          ) : customerFileOrdinal != null ? (
            <p className="text-xs text-emerald-800">
              <span className="font-medium">{selectedCustomerDisplayName}</span>
              {' · '}
              {customerFileOrdinal}. {newClaimOpeningCaption(serviceKind)}
            </p>
          ) : null}
        </div>
      )}
      <div className={formGrid}>
        <div className="min-w-0" data-field="serviceKind">
          <label className={label}>Hizmet Türü <span className="text-status-danger">*</span></label>
          <select
            className={`${field} ${errors.serviceKind ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
            value={serviceKind}
            required
            onChange={(e) => {
              const kind = parseClaimServiceKind(e.target.value);
              setServiceKind(kind);
              if (kind !== 'consultancy') setConsultancyServiceTypeId('');
              else setConsultancyServiceTypeId('');
              setErrors((p) => {
                const n = { ...p };
                delete n.serviceKind;
                if (kind !== 'consultancy') delete n.consultancyServiceTypeId;
                return n;
              });
            }}
          >
            <optgroup label="Asistans Hizmetleri">
              {CLAIM_SERVICE_KINDS.filter((kind) => kind === 'repair').map((kind) => (
                <option key={kind} value={kind}>Hasar Onarım</option>
              ))}
            </optgroup>
            <optgroup label="Ek Hizmetler">
              {CLAIM_SERVICE_KINDS.filter((kind) => kind === 'consultancy' || kind === 'inspection')
                .slice()
                .sort((a, b) => CLAIM_SERVICE_KIND_LABEL[a].localeCompare(CLAIM_SERVICE_KIND_LABEL[b], 'tr'))
                .map((kind) => (
                  <option key={kind} value={kind}>{CLAIM_SERVICE_KIND_LABEL[kind]}</option>
                ))}
            </optgroup>
          </select>
          {errors.serviceKind && <p className="text-xs text-status-danger mt-0.5">{errors.serviceKind}</p>}
        </div>
        {serviceKind === 'consultancy' ? (
          <div className="min-w-0" data-field="consultancyServiceTypeId">
            <label className={`${label} flex items-center gap-1.5`}>
              <span>Danışmanlık Hizmet Türü <span className="text-status-danger">*</span></span>
              <FieldHelpTip text="Ayarlar’daki danışmanlık türleri. Hasar Tespit bu listede yoktur." testId="danismanlik-hizmet-turu-yardim" />
            </label>
            <select
              className={`${field} ${errors.consultancyServiceTypeId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
              value={consultancyServiceTypeId}
              required
              onChange={(e) => {
                setConsultancyServiceTypeId(e.target.value);
                if (e.target.value) setErrors((p) => { const n = { ...p }; delete n.consultancyServiceTypeId; return n; });
              }}
            >
              <option value="">Seçiniz...</option>
              {consultancyTypes.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
            {errors.consultancyServiceTypeId && (
              <p className="text-xs text-status-danger mt-0.5">{errors.consultancyServiceTypeId}</p>
            )}
          </div>
        ) : null}
        <div className="min-w-0" data-field="assignedOfficeUserId">
          <label className={label}>Dosya Sorumlusu <span className="text-status-danger">*</span></label>
          <select
            className={`${field} ${errors.assignedOfficeUserId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
            value={assignedOfficeUserId}
            onChange={(e) => {
              setAssignedOfficeUserId(e.target.value);
              if (e.target.value) setErrors((p) => { const n = { ...p }; delete n.assignedOfficeUserId; return n; });
            }}
          >
            <option value="">Seçiniz...</option>
            {officeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.id}
                {u.id === sessionUserId ? ' (Siz)' : ''}
              </option>
            ))}
          </select>
          {errors.assignedOfficeUserId && <p className="text-xs text-status-danger mt-0.5">{errors.assignedOfficeUserId}</p>}
        </div>
        <div className="min-w-0" data-field="insuredName">
          <label className={label}>Sigortalı Adı Soyadı <span className="text-status-danger">*</span></label>
          <input
            className={`${field} ${errors.insuredName ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
            value={insuredName}
            onChange={(e) => setInsuredName(e.target.value)}
            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setInsuredName(v); }}
          />
          {errors.insuredName && <p className="text-xs text-status-danger mt-0.5">{errors.insuredName}</p>}
        </div>
        <div className="min-w-0" data-field="lossType">
          <label className={label}>Hasar Konusu <span className="text-status-danger">*</span></label>
          <select className={`${field} ${errors.lossType ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`} value={lossType} onChange={(e) => setLossType(e.target.value)}>
            <option value="">Seçiniz...</option>
            {claimSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          {subjectsLoadFailed && (
            <p className="text-xs text-amber-600 mt-0.5">Hasar konuları yüklenemedi. Lütfen sayfayı yenileyin.</p>
          )}
          {!subjectsLoadFailed && claimSubjects.length === 0 && (
            <p className="text-xs text-amber-600 mt-0.5">Bu hat için dosya konusu yok.</p>
          )}
          {errors.lossType && <p className="text-xs text-status-danger mt-0.5">{errors.lossType}</p>}
        </div>
        <div className="min-w-0" data-field="fileNo">
          <label className={`${label} flex items-center gap-1.5`}>
            <span>Dosya No <span className="text-status-danger">*</span></span>
            <FieldHelpTip text="Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz." testId="dosya-no-yardim" />
          </label>
          <input
            className={`${field} ${errors.fileNo ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
            value={fileNo}
            onChange={(e) => { setFileNo(e.target.value); setFileNoError(null); }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v) setFileNo(v); void checkFileNoDuplicate(v); }}
          />
          {fileNoChecking && <p className="text-xs text-slate-400 mt-0.5">Kontrol ediliyor...</p>}
          {errors.fileNo && <p className="text-xs text-status-danger mt-0.5">{errors.fileNo}</p>}
        </div>
        <div className={`${spanFull} min-w-0`} data-field="dosyaKanali">
          <p className={`${label} flex items-center gap-1.5`}>
            <span>Dosya Kanalı</span>
            <FieldHelpTip text="Dosyayı biz açarız. Rapor ve yazışma burada seçilen taraflara gider." testId="dosya-kanali-yardim" />
          </p>
          <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-2 sm:gap-2">
            {!claimCustomerSourceHidesChannel(customerSource, 'insurance') && <div className="min-w-0" data-field="insuranceCompanyId">
              <label className={label}>
                Sigorta Şirketi {customerSource === 'private'
                  ? <span className="font-normal text-slate-400"> Tercihe Bağlı</span>
                  : <span className="text-status-danger"> *</span>}
              </label>
              <select className={`${field} w-full min-w-0 ${errors.insuranceCompanyId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`} value={insuranceCompanyId} onChange={(e) => setInsuranceCompanyId(e.target.value)}>
                <option value="">Seçiniz...</option>
                {insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.insuranceCompanyId && <p className="text-xs text-status-danger mt-0.5">{errors.insuranceCompanyId}</p>}
            </div>}
            {!claimCustomerSourceHidesChannel(customerSource, 'broker') && <div className="min-w-0" data-field="channelBrokerCustomerId">
              <label className={label}>Broker <span className="font-normal text-slate-400">Tercihe Bağlı</span></label>
              <select className={`${field} w-full min-w-0 ${errors.channelBrokerCustomerId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`} value={channelBrokerCustomerId} onChange={(e) => setChannelBrokerCustomerId(e.target.value)}>
                <option value="">Seçiniz...</option>
                {channelBrokerFirms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.channelBrokerCustomerId && <p className="text-xs text-status-danger mt-0.5">{errors.channelBrokerCustomerId}</p>}
              {channelAddLink('broker_firmasi')}
            </div>}
            {customerSource !== 'broker' && <div className="min-w-0" data-field="channelAgencyCustomerId">
              <label className={label}>Acente <span className="font-normal text-slate-400">Tercihe Bağlı</span></label>
              <select className={`${field} w-full min-w-0`} value={channelAgencyCustomerId} onChange={(e) => setChannelAgencyCustomerId(e.target.value)}>
                <option value="">Seçiniz...</option>
                {channelAgencyFirms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {channelAddLink('acente_firmasi')}
            </div>}
            {!claimCustomerSourceHidesChannel(customerSource, 'expert') && <div className="min-w-0" data-field="channelExpertCustomerId">
              <label className={label}>Eksper <span className="font-normal text-slate-400">Tercihe Bağlı</span></label>
              <select className={`${field} w-full min-w-0 ${errors.channelExpertCustomerId ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`} value={channelExpertCustomerId} onChange={(e) => setChannelExpertCustomerId(e.target.value)}>
                <option value="">Seçiniz...</option>
                {expertChannelOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.channelExpertCustomerId && <p className="text-xs text-status-danger mt-0.5">{errors.channelExpertCustomerId}</p>}
              {channelAddLink('eksper_firmasi')}
            </div>}
          </div>
        </div>
        <div className={`${spanFull} min-w-0 border-t border-slate-100 pt-3 sm:pt-1`}>
          {!isPanel && <p className="text-[11px] font-medium text-slate-500 mb-2">Dosya Adresi</p>}
          <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-2 sm:gap-2">
            <div className="min-w-0">
              <label className={label}>{ADDRESS_FIELD.province}</label>
              <select
                className={`${field} w-full min-w-0 max-w-full`}
                value={cityCode}
                onChange={(e) => {
                  const prov = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                  setCityCode(e.target.value);
                  setCity(prov?.name ?? '');
                  setDistrict('');
                }}
              >
                <option value="">{ADDRESS_FIELD.provincePlaceholder}</option>
                {STATIC_PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label className={label}>{ADDRESS_FIELD.district}</label>
              <select className={`${field} w-full min-w-0 max-w-full`} value={district} disabled={!cityCode} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                {currentDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <label className={label}>İrtibat Ad Soyad</label>
          <input
            className={field}
            value={siteContactName}
            onChange={(e) => setSiteContactName(e.target.value)}
            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setSiteContactName(v); }}
            placeholder="Tespitte aranacak kişi"
          />
        </div>
        <div className="min-w-0">
          <label className={`${label} flex items-center gap-1.5`}>
            <span>İrtibat Telefon</span>
            <FieldHelpTip text="Yalnız tespit içindir; rapora yazılmaz." testId="irtibat-telefon-yardim" />
          </label>
          <PhoneInput value={siteContactPhone} onChange={setSiteContactPhone} placeholder="532 133 4144" />
        </div>
        <div className="min-w-0">
          <label className={`${label} flex items-center gap-1.5`}>
            <span>İrtibat E-posta</span>
            <FieldHelpTip text="Tespit planı bu kutuya gider. Boşsa mail gitmez." testId="irtibat-eposta-yardim" />
          </label>
          <input
            className={field}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={siteContactEmail}
            onChange={(e) => setSiteContactEmail(e.target.value)}
            placeholder="Örn. ad@firma.com"
          />
        </div>
        <div className={spanFull} data-field="openAddress">
          <label className={label}>{ADDRESS_FIELD.openAddress}</label>
          <textarea
            rows={isPanel ? 2 : 2}
            className={`${field} resize-y min-h-[56px]`}
            placeholder={ADDRESS_FIELD.openAddressPlaceholder}
            value={openAddress}
            onChange={(e) => setOpenAddress(e.target.value)}
            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setOpenAddress(v); }}
          />
        </div>
        <div className={spanFull} data-field="ihbarDetayi">
          <label className={label}>İhbar Detayı</label>
          <textarea
            rows={isPanel ? 2 : 4}
            className={`${field} w-full resize-y ${isPanel ? 'min-h-[64px] max-h-[120px]' : 'min-h-[88px] max-h-[320px]'}`}
            placeholder="Opsiyonel — ihbar notu, ek açıklama..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v) setDescription(v);
            }}
          />
        </div>
      </div>
    </>
  );

  const panelPanels = (
    <div className="space-y-2">
      {eksperSection}
      <div className="border-t border-slate-100 pt-2">{dosyaSection}</div>
    </div>
  );

  const pagePanels = (
    <>
      <CollapsibleFormPanel
        title={customerPickTarget === 'private' ? 'Özel Müşteri' : CLAIM_CUSTOMER_SOURCE_LABEL[customerSource]}
        hint={customerPickTarget === 'private' ? 'Dosyanın bağlı olduğu özel müşteri kartı' : 'Dosyanın bağlı olduğu kart'}
        open={openSections.eksper}
        onToggle={() => toggleSection('eksper')}
        summary={eksperSummary}
      >
        {eksperSection}
      </CollapsibleFormPanel>

      <CollapsibleFormPanel
        title="Dosya Kaydı"
        hint="Sigortalı, adres ve hasar bilgileri"
        accent="emerald"
        open={openSections.dosya}
        onToggle={() => toggleSection('dosya')}
        summary={dosyaSummary}
      >
        {dosyaSection}
      </CollapsibleFormPanel>
    </>
  );

  const pageFooter = (
    <>
      {errors.general && (
        <p className="text-xs text-red-600 px-5 py-2">{errors.general}</p>
      )}
      <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-xl">
          İptal
        </button>
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : 'Dosyayı Oluştur'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {isPanel ? (
        <form className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <NewFilePanelShell errorGeneral={errors.general} onCancel={onCancel} saving={saving}>
            {panelPanels}
          </NewFilePanelShell>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 space-y-3">
              {pagePanels}
            </div>
            {pageFooter}
          </div>
        </form>
      )}

      <CustomerSelectModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        hideTypeColumn
        subTypeFilter={customerPickTarget === 'private' ? 'private_customer' : claimCustomerSourceSubType(customerSource)}
        onSelect={(c) => {
          const picked: SelectedCustomer = {
            id: c.id,
            subType: (c as { subType?: string | null }).subType ?? null,
            fullName: c.fullName,
            firstName: (c as { firstName?: string | null }).firstName,
            lastName: (c as { lastName?: string | null }).lastName,
            companyName: c.companyName,
            identityNo: c.identityNo,
            taxNumber: c.taxNumber,
            phone: c.phone,
          };
          if (customerPickTarget === 'private') {
            setPrivateCustomer(picked);
            setShowCustomerModal(false);
            setCustomerPickTarget('source');
            return;
          }
          void applySourceCard(picked);
          setShowCustomerModal(false);
        }}
        onCreateNew={() => {
          openFullCustomerCard(
            customerPickTarget === 'private' ? 'private_customer' : claimCustomerSourceSubType(customerSource),
            customerPickTarget === 'private' ? 'private' : 'source',
          );
        }}
      />
    </>
  );
}
