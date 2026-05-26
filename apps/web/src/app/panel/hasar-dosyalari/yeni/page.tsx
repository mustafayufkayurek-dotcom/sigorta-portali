'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { CustomerSelectModal } from '@/components/CustomerSelectModal';
import { toTitleCaseTR } from '@/utils/text-helpers';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

const PRIORITIES = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
];

// ── Phone helpers ────────────────────────────────────────────────────────────
function maskPhoneTR(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 1) return d;
  if (d.length <= 4) return `${d[0]} (${d.slice(1)}`;
  if (d.length <= 7) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}
function unmaskPhoneTR(masked: string): string { return masked.replace(/\D/g, ''); }
function storageToMask(stored: string): string {
  if (!stored) return '';
  return maskPhoneTR(stored.replace(/\D/g, ''));
}

interface TRPhoneInputProps {
  value: string;
  onChange: (raw: string) => void;
  onBlur?: (raw: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

function TRPhoneInput({ value, onChange, onBlur, className = '', placeholder = '0 (5XX) XXX XX XX', disabled, hasError }: TRPhoneInputProps) {
  const [display, setDisplay] = useState(() => storageToMask(value));

  useEffect(() => { setDisplay(storageToMask(value)); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    setDisplay(maskPhoneTR(rawDigits));
    onChange(rawDigits);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const rawDigits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11);
    setDisplay(maskPhoneTR(rawDigits));
    onChange(rawDigits);
  };

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
      onChange={handleChange}
      onPaste={handlePaste}
      onBlur={() => { if (onBlur) onBlur(unmaskPhoneTR(display)); }}
    />
  );
}
// ────────────────────────────────────────────────────────────────────────────

function openNativeDatePicker(input: HTMLInputElement & { showPicker?: () => void }) {
  input.showPicker?.();
}

type InsuranceCompany = { id: string; name: string };
type Province = { id: string; plateCode: number; name: string };
type District = { id: string; name: string };
type ClaimStatus = { id: string; code: string; name: string };
type SelectedCustomer = {
  id: string;
  type: string;
  fullName?: string | null;
  companyName?: string | null;
  identityNo?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
};

export default function YeniHasarDosyasiPage() {
  const router = useRouter();

  // Lookup data
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [statuses, setStatuses] = useState<ClaimStatus[]>([]);
  const [claimSubjects, setClaimSubjects] = useState<string[]>([]);

  // Loading / saving
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dosya bilgileri
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [fileNo, setFileNo] = useState('');
  const [lossType, setLossType] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [notificationDate, setNotificationDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState('');
  const [currentStatusId, setCurrentStatusId] = useState('');

  // fileNo çakışma kontrolü
  const [fileNoError, setFileNoError] = useState<string | null>(null);
  const [fileNoChecking, setFileNoChecking] = useState(false);

  // Müşteri
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  // Yeni müşteri inline form
  const [newCustomerType, setNewCustomerType] = useState('individual');
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState('');
  const [newCustomerIdentityNo, setNewCustomerIdentityNo] = useState('');
  const [newCustomerTaxNumber, setNewCustomerTaxNumber] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerPhoneType, setNewCustomerPhoneType] = useState<'gsm' | 'landline'>('gsm');
  const [newCustomerExtension, setNewCustomerExtension] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');

  // Duplicate check states for new customer
  const [tcDupError, setTcDupError] = useState<string | null>(null);
  const [phoneDupError, setPhoneDupError] = useState<string | null>(null);
  const [nameDupWarn, setNameDupWarn] = useState<string | null>(null);

  // Customer search (autocomplete)
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<SelectedCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hasar Adresi
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [addressLine, setAddressLine] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [icRes, provRes, subjectsRes] = await Promise.all([
        axios.get(`${API}/insurance-companies?limit=200`, { headers: authHeader() }),
        axios.get(`${API}/locations/provinces`, { headers: authHeader() }),
        axios.get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() }).catch(() => null),
      ]);
      setInsuranceCompanies(icRes.data.data || []);
      setProvinces(provRes.data.data || []);
      const subjectData = subjectsRes?.data?.data;
      const subjects = Array.isArray(subjectData?.hasar)
        ? subjectData.hasar
        : Array.isArray(subjectData)
          ? subjectData
          : [];
      setClaimSubjects(subjects.map((s: string) => toTitleCaseTR(String(s).trim())).filter(Boolean));
    } catch (e) { console.error(e); }
  }, []);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/claim-files/statuses`, { headers: authHeader() });
      const data: ClaimStatus[] = res.data.data || [];
      setStatuses(data);
      const newStatus = data.find((s) => s.code === 'new');
      if (newStatus) setCurrentStatusId(newStatus.id);
    } catch { /* optional */ }
  }, []);

  const loadDistricts = async (pid: string) => {
    if (!pid) { setDistricts([]); setDistrictId(''); return; }
    try {
      const res = await axios.get(`${API}/locations/provinces/${pid}/districts`, { headers: authHeader() });
      setDistricts(res.data.data || []);
      setDistrictId('');
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadLookups(); loadStatuses(); }, [loadLookups, loadStatuses]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Customer autocomplete search
  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearch(val);
    if (!val.trim()) { setCustomerResults([]); setShowCustomerDropdown(false); return; }
    if (customerSearchDebounce.current) clearTimeout(customerSearchDebounce.current);
    customerSearchDebounce.current = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const res = await axios.get(`${API}/customers?search=${encodeURIComponent(val)}&limit=10`, { headers: authHeader() });
        const data = res.data.data || [];
        setCustomerResults(data.map((c: any) => ({
          id: c.id,
          type: c.entityType ?? c.type ?? 'individual',
          fullName: c.fullName ?? (c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : null) ?? null,
          companyName: c.companyName ?? null,
          identityNo: c.identityNo ?? null,
          taxNumber: c.taxNumber ?? null,
          phone: c.phone ?? null,
        })));
        setShowCustomerDropdown(true);
      } catch { /* ignore */ } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectCustomerFromDropdown = (c: SelectedCustomer) => {
    setSelectedCustomer(c);
    const display = c.type === 'individual' ? c.fullName : c.companyName;
    setCustomerSearch(display ?? '');
    setShowCustomerDropdown(false);
    setShowNewCustomerForm(false);
    setErrors((prev) => { const e = { ...prev }; delete e.customer; return e; });
  };

  // ── Duplicate checks ─────────────────────────────────────────────────────

  const checkTcDuplicate = async (tc: string) => {
    if (!tc || tc.length < 11) { setTcDupError(null); return; }
    try {
      const res = await axios.get(`${API}/customers/check-duplicate?tc=${encodeURIComponent(tc)}`, { headers: authHeader() });
      const data = res.data.data;
      if (data.exists && !data.warnOnly) {
        setTcDupError(`Bu TC ile kayıtlı müşteri mevcut: ${data.existingRecord?.fullName}`);
      } else {
        setTcDupError(null);
      }
    } catch { setTcDupError(null); }
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
    } catch { setPhoneDupError(null); }
  };

  const checkNameDuplicate = async (firstName: string, lastName: string) => {
    if (!firstName.trim() || !lastName.trim()) { setNameDupWarn(null); return; }
    try {
      const res = await axios.get(`${API}/customers/check-duplicate?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`, { headers: authHeader() });
      const data = res.data.data;
      if (data.exists && data.warnOnly) {
        setNameDupWarn(`Bu isimde müşteri mevcut: ${data.existingRecord?.fullName}. Yine de devam edebilirsiniz.`);
      } else {
        setNameDupWarn(null);
      }
    } catch { setNameDupWarn(null); }
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
    } catch { setFileNoError(null); }
    finally { setFileNoChecking(false); }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fileNo.trim()) errs.fileNo = 'Dosya numarası zorunludur.';
    if (fileNoError) errs.fileNo = fileNoError;
    if (!insuranceCompanyId) errs.insuranceCompanyId = 'Sigorta şirketi zorunludur.';
    if (!lossType) errs.lossType = 'Hasar konusu zorunludur.';
    if (!incidentDate) errs.incidentDate = 'Hasar tarihi zorunludur.';
    if (!notificationDate) errs.notificationDate = 'Bildirim tarihi zorunludur.';
    if (!selectedCustomer && !showNewCustomerForm) errs.customer = 'Müşteri seçiniz.';
    if (showNewCustomerForm) {
      if (newCustomerType === 'individual' && (!newCustomerFirstName.trim() || !newCustomerLastName.trim())) {
        errs.customer = 'Ad Soyad zorunludur.';
      }
      if (newCustomerType === 'corporate' && !newCustomerCompanyName) errs.customer = 'Şirket adı zorunludur.';
      if (tcDupError) errs.customer = tcDupError;
      if (phoneDupError) errs.customer = phoneDupError;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors((prev) => ({ ...prev, general: '' }));
    try {
      let customerId = selectedCustomer?.id ?? '';

      if (showNewCustomerForm) {
        const fullName = newCustomerType === 'individual'
          ? `${newCustomerFirstName} ${newCustomerLastName}`.trim()
          : undefined;
        const customerPayload: Record<string, unknown> = {
          type: newCustomerType,
          fullName,
          firstName: newCustomerType === 'individual' ? newCustomerFirstName : undefined,
          lastName: newCustomerType === 'individual' ? newCustomerLastName : undefined,
          companyName: newCustomerType === 'corporate' ? newCustomerCompanyName : undefined,
          identityNo: newCustomerIdentityNo || undefined,
          taxNumber: newCustomerTaxNumber || undefined,
          phone: newCustomerPhone || undefined,
          email: newCustomerEmail || undefined,
        };
        const cRes = await axios.post(`${API}/customers`, customerPayload, { headers: authHeader() });
        customerId = cRes.data.data.id;
      }

      let propertyAddressId: string | undefined;
      if (addressLine && provinceId) {
        const province = provinces.find((p) => p.id === provinceId);
        const district = districts.find((d) => d.id === districtId);
        const aRes = await axios.post(`${API}/addresses`, {
          city: province?.name ?? '',
          district: district?.name ?? undefined,
          addressLine,
        }, { headers: authHeader() });
        propertyAddressId = aRes.data.data?.id;
      }

      const payload: Record<string, unknown> = {
        fileNo: fileNo.trim(),
        insuranceCompanyId,
        policyNo: policyNo || 'N/A',
        claimNo: fileNo.trim() || 'N/A',
        productBranch: 'diger',
        lossType,
        incidentDate: new Date(incidentDate).toISOString(),
        notificationDate: new Date(notificationDate).toISOString(),
        priority,
        description: description || undefined,
        customerId: customerId || undefined,
        propertyAddressId,
      };
      if (currentStatusId) payload.currentStatusId = currentStatusId;

      const res = await axios.post(`${API}/claim-files`, payload, { headers: authHeader() });
      const createdId = res.data?.data?.id;
      if (!createdId) {
        throw new Error('Oluşturulan dosya kimliği alınamadı');
      }
      await router.push(`/panel/hasar-dosyalari/${createdId}`);
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const msg = e.response?.data?.message;
        const errorText = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Kayıt başarısız');
        setErrors((prev) => ({ ...prev, general: errorText }));
      } else {
        setErrors((prev) => ({ ...prev, general: 'Kayıt başarısız' }));
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomerDisplayName = selectedCustomer
    ? (selectedCustomer.type === 'individual' ? selectedCustomer.fullName : selectedCustomer.companyName) ?? '—'
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button type="button" onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">← Geri</button>
        <h2 className="text-2xl font-bold text-slate-800">Yeni Hasar Dosyası</h2>
      </div>

      <div className="space-y-6">
        {/* ── Dosya Bilgileri ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Dosya Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Sigorta Şirketi <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <select
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.insuranceCompanyId ? 'border-red-400' : 'border-slate-200'}`}
                value={insuranceCompanyId}
                onChange={(e) => setInsuranceCompanyId(e.target.value)}
              >
                <option value="">Seçiniz...</option>
                {insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.insuranceCompanyId && <p className="text-xs text-red-500 mt-0.5">{errors.insuranceCompanyId}</p>}
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Hasar Konusu <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <select
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${errors.lossType ? 'border-red-400' : 'border-slate-200'}`}
                value={lossType}
                onChange={(e) => setLossType(e.target.value)}
              >
                <option value="">Seçiniz...</option>
                {claimSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                {claimSubjects.length === 0 && <option value="Diğer">Diğer</option>}
              </select>
              {errors.lossType && <p className="text-xs text-red-500 mt-0.5">{errors.lossType}</p>}
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Dosya No <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.fileNo ? 'border-red-400' : 'border-slate-200'}`}
                placeholder="Örn: HAS-2026-001"
                value={fileNo}
                onChange={(e) => { setFileNo(e.target.value); setFileNoError(null); }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v) setFileNo(v); checkFileNoDuplicate(v); }}
              />
              {fileNoChecking && <p className="text-xs text-slate-400 mt-0.5">Kontrol ediliyor...</p>}
              {errors.fileNo && <p className="text-xs text-red-500 mt-0.5">{errors.fileNo}</p>}
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Poliçe No</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Opsiyonel" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Hasar Tarihi <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <input
                type="date"
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.incidentDate ? 'border-red-400' : 'border-slate-200'}`}
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                onClick={(e) => openNativeDatePicker(e.currentTarget)}
                onFocus={(e) => openNativeDatePicker(e.currentTarget)}
              />
              {errors.incidentDate && <p className="text-xs text-red-500 mt-0.5">{errors.incidentDate}</p>}
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">İhbar Tarihi <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
              <input
                type="date"
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.notificationDate ? 'border-red-400' : 'border-slate-200'}`}
                value={notificationDate}
                onChange={(e) => setNotificationDate(e.target.value)}
                onClick={(e) => openNativeDatePicker(e.currentTarget)}
                onFocus={(e) => openNativeDatePicker(e.currentTarget)}
              />
              {errors.notificationDate && <p className="text-xs text-red-500 mt-0.5">{errors.notificationDate}</p>}
            </div>

            <div className="md:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                {statuses.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 block mb-1.5">Başlangıç Durumu</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={currentStatusId} onChange={(e) => setCurrentStatusId(e.target.value)}>
                      <option value="">Seçiniz...</option>
                      {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">Öncelik</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1.5">Açıklama</label>
              <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Hasar Açıklaması..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Müşteri ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Müşteri Bilgileri</h3>

          {errors.customer && <p className="text-xs text-red-500 mb-3">{errors.customer}</p>}

          {/* Seçili müşteri gösterimi */}
          {selectedCustomer && !showNewCustomerForm ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl mb-3">
              <div>
                <p className="text-sm font-semibold text-green-800">{selectedCustomerDisplayName}</p>
                <p className="text-xs text-green-600">
                  {selectedCustomer.type === 'individual' ? 'Bireysel' : 'Kurumsal'}
                  {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                className="text-xs text-green-700 hover:text-green-900 border border-green-300 px-3 py-1.5 rounded-lg hover:bg-green-100"
              >
                Değiştir
              </button>
            </div>
          ) : !showNewCustomerForm ? (
            /* Autocomplete arama kutusu */
            <div ref={customerSearchRef} className="relative mb-2">
              <label className="text-xs text-slate-500 block mb-1.5">Müşteri Ara</label>
              <input
                type="text"
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.customer ? 'border-red-400' : 'border-slate-200'} focus:outline-none focus:ring-1 focus:ring-blue-300`}
                placeholder="İsim, telefon veya TC ile ara..."
                value={customerSearch}
                onChange={(e) => handleCustomerSearchChange(e.target.value)}
                onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
              />
              {customerSearchLoading && (
                <div className="absolute right-3 top-9">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
                  {customerResults.map((c) => {
                    const name = c.type === 'individual' ? c.fullName : c.companyName;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomerFromDropdown(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-800">{name ?? '—'}</span>
                        <span className="text-xs text-slate-400">{c.type === 'individual' ? 'Bireysel' : 'Kurumsal'}{c.phone ? ` · ${c.phone}` : ''}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {showCustomerDropdown && customerResults.length === 0 && customerSearch.trim().length > 0 && !customerSearchLoading && (
                <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 px-4 py-3 text-sm text-slate-500">
                  Sonuç bulunamadı.
                </div>
              )}
            </div>
          ) : null}

          {/* Alt link: Listeden seç (modal) veya yeni müşteri oluştur */}
          {!selectedCustomer && !showNewCustomerForm && (
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Listeden Seç
              </button>
              <span className="text-slate-300 text-xs">|</span>
              <button
                type="button"
                onClick={() => { setShowNewCustomerForm(true); setSelectedCustomer(null); setCustomerSearch(''); }}
                className="text-xs text-blue-600 hover:underline"
              >
                + Yeni Müşteri Oluştur
              </button>
            </div>
          )}

          {/* Yeni müşteri formu */}
          {showNewCustomerForm && (
            <div className="space-y-3 border border-blue-100 bg-blue-50/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-blue-700">Yeni Müşteri</p>
                <button
                  type="button"
                  onClick={() => { setShowNewCustomerForm(false); setTcDupError(null); setPhoneDupError(null); setNameDupWarn(null); }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  İptal
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Müşteri Tipi</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" value={newCustomerType} onChange={(e) => setNewCustomerType(e.target.value)}>
                  <option value="individual">Bireysel</option>
                  <option value="corporate">Kurumsal</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newCustomerType === 'individual' ? (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1.5">Ad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                        placeholder="Zorunlu"
                        value={newCustomerFirstName}
                        onChange={(e) => { setNewCustomerFirstName(e.target.value); setNameDupWarn(null); }}
                        onBlur={() => { const v = toTitleCaseTR(newCustomerFirstName.trim()); if (v) setNewCustomerFirstName(v); checkNameDuplicate(newCustomerFirstName, newCustomerLastName); }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1.5">Soyad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                        placeholder="Zorunlu"
                        value={newCustomerLastName}
                        onChange={(e) => { setNewCustomerLastName(e.target.value); setNameDupWarn(null); }}
                        onBlur={() => { const v = toTitleCaseTR(newCustomerLastName.trim()); if (v) setNewCustomerLastName(v); checkNameDuplicate(newCustomerFirstName, newCustomerLastName); }}
                      />
                    </div>
                    {nameDupWarn && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-amber-600 flex items-center gap-1">⚠ {nameDupWarn}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-1.5">Şirket Adı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder="Zorunlu Alan"
                      value={newCustomerCompanyName}
                      onChange={(e) => setNewCustomerCompanyName(e.target.value)}
                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setNewCustomerCompanyName(v); }}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">{newCustomerType === 'individual' ? 'TC Kimlik No' : 'Vergi No'}</label>
                  {newCustomerType === 'individual' ? (
                    <>
                      <input
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${tcDupError ? 'border-red-400' : 'border-slate-200'}`}
                        placeholder="Opsiyonel"
                        maxLength={11}
                        inputMode="numeric"
                        value={newCustomerIdentityNo}
                        onChange={(e) => { setNewCustomerIdentityNo(e.target.value.replace(/\D/g, '').slice(0, 11)); setTcDupError(null); }}
                        onBlur={() => checkTcDuplicate(newCustomerIdentityNo)}
                      />
                      {tcDupError && <p className="text-xs text-red-500 mt-0.5">{tcDupError}</p>}
                    </>
                  ) : (
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder="Opsiyonel"
                      value={newCustomerTaxNumber}
                      onChange={(e) => setNewCustomerTaxNumber(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">Telefon</label>
                  <div className="flex gap-1.5 items-center">
                    {/* Phone type icon */}
                    <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400">
                      {newCustomerPhoneType === 'gsm' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={1.8} />
                          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                    </span>
                    {/* GSM / Sabit Hat dropdown */}
                    <select
                      className="border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white flex-shrink-0 h-9 focus:outline-none"
                      value={newCustomerPhoneType}
                      onChange={(e) => { setNewCustomerPhoneType(e.target.value as 'gsm' | 'landline'); setNewCustomerExtension(''); }}
                    >
                      <option value="gsm">GSM</option>
                      <option value="landline">Sabit Hat</option>
                    </select>
                    {/* Masked phone input */}
                    <TRPhoneInput
                      className="flex-1"
                      placeholder={newCustomerPhoneType === 'gsm' ? '0 (5XX) XXX XX XX' : '0 (XXX) XXX XX XX'}
                      value={newCustomerPhone}
                      onChange={(v) => { setNewCustomerPhone(v); setPhoneDupError(null); }}
                      onBlur={checkPhoneDuplicate}
                      hasError={!!phoneDupError}
                    />
                    {/* Extension — only for landline */}
                    {newCustomerPhoneType === 'landline' && (
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="Dahili"
                        className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm flex-shrink-0 h-9 bg-white"
                        value={newCustomerExtension}
                        onChange={(e) => setNewCustomerExtension(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      />
                    )}
                  </div>
                  {phoneDupError && <p className="text-xs text-red-500 mt-0.5">{phoneDupError}</p>}
                </div>

                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">E-posta</label>
                  <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Opsiyonel" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Hasar Adresi ── */}
        <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Hasar Adresi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">İl</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); loadDistricts(e.target.value); }}>
                <option value="">Seçiniz...</option>
                {provinces.map((p) => <option key={p.id} value={p.id}>{p.plateCode} - {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">İlçe</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={!provinceId || districts.length === 0}>
                <option value="">Seçiniz...</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1.5">Adres</label>
              <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Sokak, Mahalle, Bina/Daire..." value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Kaydet ── */}
        {errors.general && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm">
            {errors.general}
          </div>
        )}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Kaydediliyor...' : 'Dosyayı Oluştur'}
          </button>
          <button type="button" onClick={() => router.back()} className="flex-1 border border-slate-200 py-3 rounded-xl text-sm text-slate-600 hover:bg-slate-50">İptal</button>
        </div>
      </div>

      {/* Customer Select Modal */}
      <CustomerSelectModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
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
          setShowCustomerModal(false);
        }}
      />
    </div>
  );
}
