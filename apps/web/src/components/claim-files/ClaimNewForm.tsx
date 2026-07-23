'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { CollapsibleFormPanel } from '@/components/form/CollapsibleFormPanel';
import { NewFilePanelShell } from '@/components/form/NewFilePanelShell';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { normalizeTrDateValue, isCompleteTrDateValue } from '@/utils/tr-date-input';
import { formatVendorAddress } from '@/utils/vendor-form-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { HASAR_EXPERT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { isOfficeStaffRole } from '@/hooks/usePanelRole';
import {
  loadClaimNewPrefs,
  saveClaimNewPrefs,
  todayTrDateDisplay,
} from '@/utils/claim-new-form-helpers';
import {
  customerDisplayName,
  customerSubTypeLabel,
} from '@/utils/customer-form-helpers';
import { getApiErrorMessage } from '@/utils/api-error';
import { reportCaughtError } from '@/utils/report-caught-error';
import { createInFlightGuard } from '@/utils/in-flight-guard';



function maskPhoneTR(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 1) return d;
  if (d.length <= 4) return `${d[0]} (${d.slice(1)}`;
  if (d.length <= 7) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}
function storageToMask(stored: string): string {
  if (!stored) return '';
  return maskPhoneTR(stored.replace(/\D/g, ''));
}

function TRPhoneInput({
  value,
  onChange,
  onBlur,
  className = '',
  placeholder = '0 (5XX) XXX XX XX',
  disabled,
  hasError,
}: {
  value: string;
  onChange: (raw: string) => void;
  onBlur?: (raw: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const [display, setDisplay] = useState(() => storageToMask(value));
  useEffect(() => { setDisplay(storageToMask(value)); }, [value]);

  const borderCls = hasError
    ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50'
    : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400';

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${borderCls} ${disabled ? 'bg-slate-50 text-slate-400' : ''} ${className}`}
      placeholder={placeholder}
      value={display}
      disabled={disabled}
      maxLength={18}
      onChange={(e) => {
        const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
        setDisplay(maskPhoneTR(rawDigits));
        onChange(rawDigits);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const rawDigits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11);
        setDisplay(maskPhoneTR(rawDigits));
        onChange(rawDigits);
      }}
      onBlur={() => { if (onBlur) onBlur(display.replace(/\D/g, '')); }}
    />
  );
}

type InsuranceCompany = { id: string; name: string };
type ClaimStatus = { id: string; code: string; name: string };
type SelectedCustomer = {
  id: string;
  subType?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
};

const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const inpCompact = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const lbl = 'block text-xs font-medium text-slate-600 mb-1.5';
const lblCompact = 'block text-[11px] font-medium text-slate-600 mb-1';

export type ClaimNewFormProps = {
  variant?: 'panel' | 'page';
  onSuccess: (claimId: string) => void;
  onCancel: () => void;
};

export function ClaimNewForm({ variant = 'page', onSuccess, onCancel }: ClaimNewFormProps) {
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

  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [fileNo, setFileNo] = useState('');
  const [lossType, setLossType] = useState('');
  const [notificationDate, setNotificationDate] = useState('');
  const [insuredName, setInsuredName] = useState('');
  const [description, setDescription] = useState('');
  const [currentStatusId, setCurrentStatusId] = useState('');

  const [fileNoError, setFileNoError] = useState<string | null>(null);
  const [fileNoChecking, setFileNoChecking] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState('');
  const [newCustomerTaxNumber, setNewCustomerTaxNumber] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [phoneDupError, setPhoneDupError] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<SelectedCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customerFileOrdinal, setCustomerFileOrdinal] = useState<number | null>(null);
  const [customerFileOrdinalLoading, setCustomerFileOrdinalLoading] = useState(false);

  const [cityCode, setCityCode] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [openAddress, setOpenAddress] = useState('');

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
      const [icRes, subjectsRes, meRes] = await Promise.all([
        axios.get(`${API}/insurance-companies?limit=200`, { headers: authHeader() }),
        axios.get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() }).catch((err) => {
          reportCaughtError(err, 'Hasar konuları yüklenemedi. Lütfen sayfayı yenileyin.');
          return null;
        }),
        axios.get(`${API}/auth/me`, { headers: authHeader() }).catch(() => null),
      ]);
      let companies: { id: string; name: string }[] = icRes.data.data || [];
      const me = meRes?.data?.data ?? meRes?.data?.user ?? meRes?.data;
      const roleCode = String(me?.role?.code ?? me?.roleCode ?? '').toLowerCase();
      const scopedIds = Array.isArray(me?.insuranceCompanyScopes)
        ? me.insuranceCompanyScopes.map((s: { id?: string }) => s.id).filter(Boolean)
        : [];
      if (isOfficeStaffRole(roleCode) && scopedIds.length > 0) {
        companies = companies.filter((c) => scopedIds.includes(c.id));
      }
      setInsuranceCompanies(companies);

      const prefs = loadClaimNewPrefs();
      const prefCompanyId = prefs.insuranceCompanyId;
      if (prefCompanyId && companies.some((c) => c.id === prefCompanyId)) {
        setInsuranceCompanyId(prefCompanyId);
      } else if (isOfficeStaffRole(roleCode) && companies.length === 1) {
        setInsuranceCompanyId(companies[0].id);
      } else {
        setInsuranceCompanyId('');
      }
      if (prefs.lossType) setLossType(prefs.lossType);

      const subjectData = subjectsRes?.data?.data;
      const subjects = Array.isArray(subjectData?.hasar)
        ? subjectData.hasar
        : Array.isArray(subjectData)
          ? subjectData
          : [];
      const normalized = subjects.map((s: string) => toTitleCaseTR(String(s).trim())).filter(Boolean);
      setClaimSubjects(normalized);
      setSubjectsLoadFailed(!subjectsRes);
    } catch (e) {
      reportCaughtError(e, 'Form seçenekleri yüklenemedi. Lütfen sayfayı yenileyin.');
      setSubjectsLoadFailed(true);
    }
  }, []);

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
    setNotificationDate(todayTrDateDisplay());
  }, []);

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

  const handleSelectCustomerFromDropdown = (c: SelectedCustomer) => {
    setSelectedCustomer(c);
    setCustomerSearch(customerDisplayName(c));
    setShowCustomerDropdown(false);
    setShowNewCustomerForm(false);
    setErrors((prev) => { const e = { ...prev }; delete e.customer; return e; });
  };

  const checkPhoneDuplicate = async (phone: string) => {
    if (!phone || phone.length < 11) { setPhoneDupError(null); return; }
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
    if (!insuranceCompanyId) errs.insuranceCompanyId = 'Sigorta şirketi zorunludur.';
    if (!lossType) errs.lossType = 'Hasar konusu zorunludur.';
    const ihbarToday = todayTrDateDisplay();
    if (!isPanel && !isCompleteTrDateValue(notificationDate || ihbarToday)) {
      errs.notificationDate = 'İhbar tarihi zorunludur (GG.AA.YYYY).';
    }
    if (!insuredName.trim()) errs.insuredName = 'Sigortalı adı soyadı zorunludur.';
  };

  const validateEksperFields = (errs: Record<string, string>) => {
    if (showNewCustomerForm) {
      if (!newCustomerCompanyName.trim()) errs.customer = 'Şirket adı zorunludur.';
      if (phoneDupError) errs.customer = phoneDupError;
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    validateEksperFields(errs);
    validateDosyaFields(errs);
    setErrors(errs);
    if (errs.customer) setOpenSections((p) => ({ ...p, eksper: true }));
    if (errs.fileNo || errs.insuranceCompanyId || errs.lossType || errs.insuredName) {
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

      if (showNewCustomerForm) {
        const cRes = await axios.post(`${API}/customers`, {
          type: 'corporate',
          subType: HASAR_EXPERT_CUSTOMER_SUB_TYPE,
          serviceType: 'hasar',
          companyName: toTitleCaseTR(newCustomerCompanyName.trim()),
          taxNumber: newCustomerTaxNumber.trim() || undefined,
          phone: newCustomerPhone || undefined,
        }, { headers: authHeader() });
        customerId = cRes.data.data.id;
      } else if (!customerId && insuredName.trim()) {
        const name = toTitleCaseTR(insuredName.trim());
        const parts = name.split(/\s+/).filter(Boolean);
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
        const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
        const cRes = await axios.post(`${API}/customers`, {
          type: 'individual',
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
        insuranceCompanyId,
        policyNo: 'N/A',
        claimNo: fileNo.trim() || 'N/A',
        productBranch: 'diger',
        lossType,
        incidentDate: ihbarIso,
        notificationDate: ihbarIso,
        priority: 'normal',
        description: description || undefined,
        insuredName: toTitleCaseTR(insuredName.trim()),
        customerId: customerId || undefined,
        propertyAddressId,
      };
      if (currentStatusId) payload.currentStatusId = currentStatusId;

      const res = await axios.post(`${API}/claim-files`, payload, { headers: authHeader() });
      const createdId = res.data?.data?.id;
      if (!createdId) {
        throw new Error('Oluşturulan dosya kimliği alınamadı');
      }
      saveClaimNewPrefs({ lossType });
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
      {errors.customer && <p className="text-xs text-red-500 mb-2">{errors.customer}</p>}

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
            className="text-xs font-medium text-blue-600 hover:text-blue-800 shrink-0"
          >
            Değiştir
          </button>
        </div>
      ) : !showNewCustomerForm ? (
        <>
          <div ref={customerSearchRef} className="relative">
            <label className={label}>Müşteri Ara</label>
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
              onClick={() => setShowCustomerModal(true)}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 sm:flex-1"
            >
              Listeden Seç
            </button>
            <button
              type="button"
              onClick={() => { setShowNewCustomerForm(true); setSelectedCustomer(null); setCustomerSearch(''); setOpenSections((p) => ({ ...p, eksper: true })); }}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 sm:flex-1"
            >
              Yeni Eksper Ofisi
            </button>
          </div>
        </>
      ) : null}

      {showNewCustomerForm && (
        <div className={`space-y-2 ${isPanel ? '' : 'space-y-3'} pt-1`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">Yeni Eksper Ofisi</p>
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
              <label className={label}>Şirket Adı <span className="text-red-500">*</span></label>
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
              <TRPhoneInput
                value={newCustomerPhone}
                onChange={(v) => { setNewCustomerPhone(v); setPhoneDupError(null); }}
                onBlur={checkPhoneDuplicate}
                hasError={!!phoneDupError}
                className={isPanel ? 'rounded-lg px-2.5 py-1.5' : ''}
              />
              {phoneDupError && <p className="text-xs text-red-500 mt-0.5">{phoneDupError}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const dosyaSection = (
    <>
      {selectedCustomer && (
        <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
          {customerFileOrdinalLoading ? (
            <p className="text-xs text-slate-500">Dosya sırası hesaplanıyor...</p>
          ) : customerFileOrdinal != null ? (
            <p className="text-xs text-emerald-800">
              <span className="font-medium">{selectedCustomerDisplayName}</span>
              {' · '}
              {customerFileOrdinal}. Hasar Dosyası Açılıyor
            </p>
          ) : null}
        </div>
      )}
      <div className={formGrid}>
        <div className="min-w-0">
          <label className={label}>Sigortalı Adı Soyadı <span className="text-red-500">*</span></label>
          <input
            className={`${field} ${errors.insuredName ? 'border-red-400' : ''}`}
            value={insuredName}
            onChange={(e) => setInsuredName(e.target.value)}
            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setInsuredName(v); }}
          />
          {errors.insuredName && <p className="text-xs text-red-500 mt-0.5">{errors.insuredName}</p>}
        </div>
        <div className="min-w-0">
          <label className={label}>Hasar Konusu <span className="text-red-500">*</span></label>
          <select className={`${field} ${errors.lossType ? 'border-red-400' : ''}`} value={lossType} onChange={(e) => setLossType(e.target.value)}>
            <option value="">Seçiniz...</option>
            {claimSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            {claimSubjects.length === 0 && <option value="Diğer">Diğer</option>}
          </select>
          {subjectsLoadFailed && (
            <p className="text-xs text-amber-600 mt-0.5">Hasar konuları yüklenemedi. «Diğer» seçilebilir veya sayfayı yenileyin.</p>
          )}
          {errors.lossType && <p className="text-xs text-red-500 mt-0.5">{errors.lossType}</p>}
        </div>
        <div className="min-w-0">
          <label className={label}>Sigorta Şirketi <span className="text-red-500">*</span></label>
          <select className={`${field} w-full min-w-0 ${errors.insuranceCompanyId ? 'border-red-400' : ''}`} value={insuranceCompanyId} onChange={(e) => setInsuranceCompanyId(e.target.value)}>
            <option value="">Seçiniz...</option>
            {insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.insuranceCompanyId && <p className="text-xs text-red-500 mt-0.5">{errors.insuranceCompanyId}</p>}
        </div>
        <div className="min-w-0">
          <label className={label}>Dosya No <span className="text-red-500">*</span></label>
          <input
            className={`${field} ${errors.fileNo ? 'border-red-400' : ''}`}
            value={fileNo}
            onChange={(e) => { setFileNo(e.target.value); setFileNoError(null); }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v) setFileNo(v); void checkFileNoDuplicate(v); }}
          />
          {fileNoChecking && <p className="text-xs text-slate-400 mt-0.5">Kontrol ediliyor...</p>}
          {!fileNoChecking && !errors.fileNo && (
            <p className="text-xs text-slate-400 mt-0.5">Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz.</p>
          )}
          {errors.fileNo && <p className="text-xs text-red-500 mt-0.5">{errors.fileNo}</p>}
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
            <div className={spanFull}>
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
          </div>
        </div>
        <div className={spanFull}>
          <label className={label}>İhbar Detayı</label>
          <textarea
            rows={isPanel ? 2 : 4}
            className={`${field} w-full resize-y ${isPanel ? 'min-h-[64px] max-h-[120px]' : 'min-h-[88px] max-h-[320px]'}`}
            placeholder="Opsiyonel — ihbar notu, ek açıklama..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
        title="Eksper Ofisi"
        hint="Dosyanın bağlı olduğu eksper ofisi"
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
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50">
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
        subTypeFilter={HASAR_EXPERT_CUSTOMER_SUB_TYPE}
        onSelect={(c) => {
          setSelectedCustomer({
            id: c.id,
            subType: (c as { subType?: string | null }).subType ?? null,
            fullName: c.fullName,
            firstName: (c as { firstName?: string | null }).firstName,
            lastName: (c as { lastName?: string | null }).lastName,
            companyName: c.companyName,
            identityNo: c.identityNo,
            taxNumber: c.taxNumber,
            phone: c.phone,
          });
          setShowNewCustomerForm(false);
          setCustomerSearch(customerDisplayName(c));
          setShowCustomerModal(false);
        }}
        onCreateNew={() => {
          setShowNewCustomerForm(true);
          setSelectedCustomer(null);
          setCustomerSearch('');
          setOpenSections((p) => ({ ...p, eksper: true }));
          setShowCustomerModal(false);
        }}
      />
    </>
  );
}
