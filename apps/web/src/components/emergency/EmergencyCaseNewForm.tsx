'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { CollapsibleFormPanel } from '@/components/form/CollapsibleFormPanel';
import { NewFilePanelShell } from '@/components/form/NewFilePanelShell';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { normalizeTrDateValue } from '@/utils/tr-date-input';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { todayTrDateDisplay } from '@/utils/claim-new-form-helpers';
import {
  createCase,
  getCases,
  getEmergencyVendors,
  type EmergencyUrgency,
  type VendorOption,
} from '@/utils/emergencyApi';
import { mapInboundLossTypeToMeridyen } from '@sigorta/shared';
import { getApiErrorMessage } from '@/utils/api-error';
import { reportCaughtError } from '@/utils/report-caught-error';
import { createInFlightGuard } from '@/utils/in-flight-guard';

const URGENCY_OPTIONS: { value: EmergencyUrgency; label: string; color: string }[] = [
  { value: 'DUSUK', label: 'Düşük', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'YUKSEK', label: 'Yüksek', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'KRITIK', label: 'Kritik', color: 'bg-red-50 text-red-700 border-red-200' },
];

const FALLBACK_ISSUE_TYPES = [
  'Su Baskını',
  'Çatı Hasarı',
  'Cam Kırılması',
  'Kapı/Kilit Arızası',
  'Elektrik Arızası',
  'Doğalgaz Arızası',
  'Yangın Hasarı',
  'Hırsızlık/Güvenlik',
  'Boru Patlaması',
  'Asansör Arızası',
  'Diğer',
];

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

type SelectedCustomer = {
  id: string;
  type: string;
  fullName?: string | null;
  companyName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
};

type PanelUser = {
  id: string;
  firstName: string;
  lastName: string;
};

const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const inpCompact = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const lbl = 'block text-xs font-medium text-slate-600 mb-1.5';
const lblCompact = 'block text-[11px] font-medium text-slate-600 mb-1';

export type EmergencyCaseNewFormProps = {
  variant?: 'panel' | 'page';
  onSuccess: (caseId: string) => void;
  onCancel: () => void;
};

export function EmergencyCaseNewForm({ variant = 'page', onSuccess, onCancel }: EmergencyCaseNewFormProps) {
  const isPanel = variant === 'panel';
  const field = isPanel ? inpCompact : inp;
  const label = isPanel ? lblCompact : lbl;

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [subjectsLoadFailed, setSubjectsLoadFailed] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const submitGuard = useRef(createInFlightGuard());

  const [fileNo, setFileNo] = useState('');
  const [fileNoError, setFileNoError] = useState<string | null>(null);
  const [fileNoChecking, setFileNoChecking] = useState(false);
  const [fileDate, setFileDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [issueType, setIssueType] = useState('');
  const [urgency, setUrgency] = useState<EmergencyUrgency>('NORMAL');
  const [insuredName, setInsuredName] = useState('');
  const [insuredPhone, setInsuredPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [notes, setNotes] = useState('');

  const [assignedVendorId, setAssignedVendorId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<SelectedCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState('');
  const [newCustomerTaxNumber, setNewCustomerTaxNumber] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [phoneDupError, setPhoneDupError] = useState<string | null>(null);

  const [customerFileOrdinal, setCustomerFileOrdinal] = useState<number | null>(null);
  const [customerFileOrdinalLoading, setCustomerFileOrdinalLoading] = useState(false);

  const [openSections, setOpenSections] = useState({
    asistans: true,
    dosya: true,
    atama: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentDistricts = cityCode ? (STATIC_DISTRICTS[cityCode] ?? []) : [];

  const assistantDisplayName = (c: SelectedCustomer) =>
    (c.type === 'individual' ? c.fullName : c.companyName) ?? '—';

  const asistansSummary = selectedCustomer
    ? assistantDisplayName(selectedCustomer)
    : showNewCustomerForm
      ? 'Yeni asistans firması'
      : customerSearch.trim() || 'Asistan Firması Seçin';

  const dosyaSummary = [
    insuredName.trim(),
    issueType,
    fileNo.trim(),
    customerFileOrdinal != null ? `${customerFileOrdinal}. Dosya` : '',
    [city, district].filter(Boolean).join(' / '),
  ].filter(Boolean).join(' · ') || 'Zorunlu alanları doldurun';

  const atamaSummary = [
    assignedUserId ? users.find((u) => u.id === assignedUserId)?.firstName : '',
    assignedVendorId ? vendors.find((v) => v.id === assignedVendorId)?.name : '',
  ].filter(Boolean).join(' · ') || 'Opsiyonel';

  const loadLookups = useCallback(async () => {
    try {
      const [subjectsRes, vendorsRes, usersRes] = await Promise.all([
        axios.get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() }).catch((err) => {
          reportCaughtError(err, 'Acil konular yüklenemedi. Varsayılan liste kullanılıyor.', { toastType: 'warning' });
          return null;
        }),
        getEmergencyVendors(),
        axios.get(`${API}/users`, { headers: authHeader(), params: { limit: 100 } }),
      ]);
      const subjectData = subjectsRes?.data?.data;
      const acil = Array.isArray(subjectData?.acil) ? subjectData.acil : [];
      const normalized = (acil.length > 0 ? acil : FALLBACK_ISSUE_TYPES)
        .map((s: string) => {
          const raw = String(s).trim();
          return mapInboundLossTypeToMeridyen(raw) ?? toTitleCaseTR(raw);
        })
        .filter(Boolean);
      setIssueTypes(normalized);
      setSubjectsLoadFailed(!subjectsRes);
      setVendors(vendorsRes.data ?? []);
      setUsers((usersRes.data?.data ?? []) as PanelUser[]);
    } catch (e) {
      reportCaughtError(e, 'Form seçenekleri yüklenemedi. Varsayılan konular kullanılıyor.');
      setIssueTypes(FALLBACK_ISSUE_TYPES);
      setSubjectsLoadFailed(true);
    }
  }, []);

  useEffect(() => { void loadLookups(); }, [loadLookups]);

  const loadCustomerFileOrdinal = useCallback(async (customerId: string) => {
    setCustomerFileOrdinalLoading(true);
    try {
      const res = await getCases({ customerId });
      setCustomerFileOrdinal(res.data.length + 1);
    } catch {
      setCustomerFileOrdinal(null);
    } finally {
      setCustomerFileOrdinalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer?.id) {
      void loadCustomerFileOrdinal(selectedCustomer.id);
    } else {
      setCustomerFileOrdinal(null);
      setCustomerFileOrdinalLoading(false);
    }
  }, [selectedCustomer?.id, loadCustomerFileOrdinal]);

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
          limit: '10',
          subType: ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
        });
        const res = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
        const data = res.data.data || [];
        setCustomerResults(data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          type: (c.entityType ?? c.type ?? 'corporate') as string,
          fullName: (c.fullName as string | null) ?? null,
          companyName: (c.companyName as string | null) ?? null,
          identityNo: (c.identityNo as string | null) ?? null,
          taxNumber: (c.taxNumber as string | null) ?? null,
          phone: (c.phone as string | null) ?? null,
        })));
        setShowCustomerDropdown(true);
      } catch (e) {
        reportCaughtError(e, 'Asistan firması araması başarısız. Lütfen tekrar deneyin.');
        setCustomerResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectCustomerFromDropdown = (c: SelectedCustomer) => {
    setSelectedCustomer(c);
    setCustomerSearch(assistantDisplayName(c));
    setShowCustomerDropdown(false);
    setShowNewCustomerForm(false);
    setErrors((prev) => { const e = { ...prev }; delete e.assistant; return e; });
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
      const res = await axios.get(`${API}/emergency/cases/check-file-no?fileNo=${encodeURIComponent(trimmed)}`, { headers: authHeader() });
      const data = res.data.data;
      if (data.exists) {
        setFileNoError('Bu dosya numarası zaten acil yardım dosyasında kullanılıyor');
      } else {
        setFileNoError(null);
      }
    } catch (e) {
      reportCaughtError(e, 'Dosya no kontrolü yapılamadı. Kaydetmeden önce tekrar deneyin.', { toastType: 'warning' });
      setFileNoError('Dosya no kontrolü yapılamadı. Lütfen tekrar deneyin.');
    }
    finally { setFileNoChecking(false); }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedCustomer && !showNewCustomerForm) errs.assistant = 'Asistan Firması Seçiniz.';
    if (showNewCustomerForm) {
      if (!newCustomerCompanyName.trim()) errs.assistant = 'Şirket adı zorunludur.';
      if (phoneDupError) errs.assistant = phoneDupError;
    }
    if (!fileNo.trim()) errs.fileNo = 'Dosya numarası zorunludur.';
    if (fileNoError) errs.fileNo = fileNoError;
    if (!isPanel && !fileDate) errs.fileDate = 'Dosya tarihi zorunludur.';
    if (!issueType) errs.issueType = 'İhbar konusu seçiniz.';
    if (!insuredName.trim()) errs.insuredName = 'Sigortalı adı soyadı zorunludur.';
    if (!address.trim()) errs.address = 'Adres zorunludur.';
    setErrors(errs);
    if (errs.assistant) setOpenSections((p) => ({ ...p, asistans: true }));
    if (errs.fileNo || errs.issueType || errs.insuredName || errs.address) {
      setOpenSections((p) => ({ ...p, dosya: true }));
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!submitGuard.current.tryStart()) return;
    setSaving(true);
    setErrors((prev) => ({ ...prev, general: '' }));
    try {
      let customerId = selectedCustomer?.id ?? '';

      if (showNewCustomerForm) {
        const cRes = await axios.post(`${API}/customers`, {
          type: 'corporate',
          subType: ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
          serviceType: 'acil_yardim',
          companyName: toTitleCaseTR(newCustomerCompanyName.trim()),
          taxNumber: newCustomerTaxNumber.trim() || undefined,
          phone: newCustomerPhone || undefined,
        }, { headers: authHeader() });
        customerId = cRes.data.data.id;
      }

      const submitFileDate = isPanel
        ? new Date(normalizeTrDateValue(todayTrDateDisplay())).toISOString()
        : new Date(fileDate).toISOString();

      const res = await createCase({
        customerName: toTitleCaseTR(insuredName.trim()),
        customerPhone: insuredPhone || undefined,
        customerId: customerId || undefined,
        fileNo: fileNo.trim(),
        fileDate: submitFileDate,
        address: toTitleCaseTR(address.trim()),
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        issueType,
        urgency,
        assignedVendorId: assignedVendorId || undefined,
        assignedUserId: assignedUserId || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess(res.data.id);
    } catch (err: unknown) {
      const errorText = getApiErrorMessage(err, 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.');
      reportCaughtError(err, errorText, { toast: false });
      setErrors((prev) => ({ ...prev, general: errorText }));
    } finally {
      setSaving(false);
      submitGuard.current.end();
    }
  };

  const asistansSection = (
    <>
      {errors.assistant && <p className="text-xs text-red-500 mb-2">{errors.assistant}</p>}

      {selectedCustomer && !showNewCustomerForm ? (
        <div className="flex items-center justify-between gap-3 text-sm rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">{assistantDisplayName(selectedCustomer)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Asistan Firması
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
            <label className={label}>Asistan Firması Ara</label>
            <input
              type="text"
              className={`${field} ${errors.assistant ? 'border-red-400' : ''}`}
              placeholder="Firma adı, telefon veya vergi no..."
              value={customerSearch}
              onChange={(e) => handleCustomerSearchChange(e.target.value)}
              onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
            />
            {customerSearchLoading && (
              <div className="absolute right-3 top-8">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomerFromDropdown(c)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                  >
                    <span className="font-medium text-slate-800">{assistantDisplayName(c)}</span>
                    {c.phone && <span className="text-xs text-slate-400 ml-2">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
            >
              Listeden Seç
            </button>
            <button
              type="button"
              onClick={() => { setShowNewCustomerForm(true); setSelectedCustomer(null); setCustomerSearch(''); setOpenSections((p) => ({ ...p, asistans: true })); }}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
            >
              Yeni Asistan Firması
            </button>
          </div>
        </>
      ) : null}

      {showNewCustomerForm && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">Yeni Asistan Firması</p>
            <button
              type="button"
              onClick={() => { setShowNewCustomerForm(false); setPhoneDupError(null); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              İptal
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
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
              <span className="font-medium">{assistantDisplayName(selectedCustomer)}</span>
              {' · '}
              {customerFileOrdinal}. Acil Yardım Dosyası Açılıyor
            </p>
          ) : null}
        </div>
      )}

      <div className={`grid ${isPanel ? 'grid-cols-2 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3'}`}>
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
          <label className={label}>İhbar Konusu <span className="text-red-500">*</span></label>
          <select className={`${field} ${errors.issueType ? 'border-red-400' : ''}`} value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">Seçiniz...</option>
            {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {subjectsLoadFailed && (
            <p className="text-xs text-amber-600 mt-0.5">Konular yüklenemedi; varsayılan liste gösteriliyor. Gerekirse sayfayı yenileyin.</p>
          )}
          {errors.issueType && <p className="text-xs text-red-500 mt-0.5">{errors.issueType}</p>}
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
        {!isPanel ? (
          <div className="min-w-0">
            <label className={label}>Dosya Tarihi <span className="text-red-500">*</span></label>
            <TrDateInput
              className={`${field} ${errors.fileDate ? 'border-red-400' : ''}`}
              value={fileDate}
              onChange={setFileDate}
            />
            {errors.fileDate && <p className="text-xs text-red-500 mt-0.5">{errors.fileDate}</p>}
          </div>
        ) : (
          <div className="min-w-0">
            <label className={label}>Sigortalı Telefonu</label>
            <TRPhoneInput value={insuredPhone} onChange={setInsuredPhone} />
          </div>
        )}
        {!isPanel && (
          <div className="min-w-0">
            <label className={label}>Sigortalı Telefonu</label>
            <TRPhoneInput value={insuredPhone} onChange={setInsuredPhone} />
          </div>
        )}
        <div className="col-span-2">
          <label className={label}>Aciliyet</label>
          <div className={`grid grid-cols-4 ${isPanel ? 'gap-1.5' : 'gap-2 sm:grid-cols-4'}`}>
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUrgency(opt.value)}
                className={`${isPanel ? 'py-1.5 text-[11px]' : 'py-2 text-xs'} font-medium rounded-lg border transition-all ${
                  urgency === opt.value
                    ? `${opt.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2 min-w-0 pt-1 border-t border-slate-100">
          {!isPanel && <p className="text-[11px] font-medium text-slate-500 mb-2">Dosya Adresi</p>}
          <div className="grid grid-cols-2 gap-2 min-w-0">
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
            <div className="col-span-2">
              <label className={label}>{ADDRESS_FIELD.openAddress} <span className="text-red-500">*</span></label>
              <textarea
                rows={isPanel ? 2 : 2}
                className={`${field} resize-y min-h-[56px] ${errors.address ? 'border-red-400' : ''}`}
                placeholder={ADDRESS_FIELD.openAddressPlaceholder}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setAddress(v); }}
              />
              {errors.address && <p className="text-xs text-red-500 mt-0.5">{errors.address}</p>}
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <label className={label}>Notlar</label>
          <textarea rows={isPanel ? 1 : 2} className={`${field} resize-none`} placeholder="Opsiyonel" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </>
  );

  const atamaSection = (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={label}>Saha Tedarikçisi</label>
        <select className={field} value={assignedVendorId} onChange={(e) => setAssignedVendorId(e.target.value)}>
          <option value="">Seçilmedi</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Dosya Sorumlusu</label>
        <select className={field} value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
          <option value="">Seçilmedi</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const panelPanels = (
    <div className="space-y-2">
      {asistansSection}
      <div className="border-t border-slate-100 pt-2">{dosyaSection}</div>
      <div className="border-t border-slate-100 pt-2">{atamaSection}</div>
    </div>
  );

  const pagePanels = (
    <>
      <CollapsibleFormPanel
        title="Asistan Firması"
        hint="Dosyanın bağlı olduğu asistan firması"
        open={openSections.asistans}
        onToggle={() => toggleSection('asistans')}
        summary={asistansSummary}
      >
        {asistansSection}
      </CollapsibleFormPanel>

      <CollapsibleFormPanel
        title="Dosya Kaydı"
        hint="Sigortalı, ihbar ve adres bilgileri"
        accent="emerald"
        open={openSections.dosya}
        onToggle={() => toggleSection('dosya')}
        summary={dosyaSummary}
      >
        {dosyaSection}
      </CollapsibleFormPanel>

      <CollapsibleFormPanel
        title="Atama"
        hint="Saha tedarikçisi ve dosya sorumlusu"
        open={openSections.atama}
        onToggle={() => toggleSection('atama')}
        summary={atamaSummary}
      >
        {atamaSection}
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
        subTypeFilter={ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setShowNewCustomerForm(false);
          setCustomerSearch((c.type === 'individual' ? c.fullName : c.companyName) ?? '');
          setShowCustomerModal(false);
        }}
        onCreateNew={() => {
          setShowNewCustomerForm(true);
          setSelectedCustomer(null);
          setCustomerSearch('');
          setOpenSections((p) => ({ ...p, asistans: true }));
          setShowCustomerModal(false);
        }}
      />
    </>
  );
}
