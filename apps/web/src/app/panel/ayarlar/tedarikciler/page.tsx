'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  validateTCKimlik,
  validateVergiNo,
  validateIBAN,
  validatePhone,
  validateEmail,
} from '@/utils/validators';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { StatusBadge } from '@/components/settings/SettingsUI';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';

// ---- GİB / NVI helpers ----
async function gibQuery(taxNumber: string, token: string | null) {
  const r = await axios.get(`${API}/tax-verification/query?taxNumber=${encodeURIComponent(taxNumber)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data.data as { title: string; taxOffice: string; address: string; status: string; found: boolean };
}

async function ibanVerify(iban: string, token: string | null) {
  const r = await axios.post(`${API}/tax-verification/verify-iban`, { iban }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data.data as { valid: boolean; bankName?: string };
}

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }


type WorkGroup = { id: string; code: string; name: string; sortOrder: number };
type ServiceArea = { provinceId: string; districtId?: string | null };

const emptyForm = {
  entityType: 'corporate' as 'corporate' | 'individual',
  name: '',        // Şirket Adı (kurumsal)
  firstName: '',   // Bireysel: Ad
  lastName: '',    // Bireysel: Soyad
  type: '',
  taxNumber: '',
  taxOffice: '',
  tradeRegistryNo: '',
  authorizedFirstName: '',
  authorizedLastName: '',
  authorizedPhone: '',
  authorizedEmail: '',
  identityNo: '',
  phone: '',
  email: '',
  address: '',
  cityCode: '',
  city: '',
  district: '',
  neighborhood: '',
  streetName: '',
  buildingNo: '',
  doorNo: '',
  iban: '',
  bankName: '',
  notes: '',
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // GİB / validation state
  const [gibLoading, setGibLoading] = useState(false);
  const [gibError, setGibError] = useState<string | null>(null);
  const [tcResult, setTcResult] = useState<boolean | null>(null);
  const [ibanLoading, setIbanLoading] = useState(false);
  const [ibanResult, setIbanResult] = useState<{ valid: boolean; bankName?: string } | null>(null);
  // Inline validation
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [taxNoError, setTaxNoError] = useState<string | null>(null);

  // Vendor types from SystemSetting
  const [vendorTypes, setVendorTypes] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);

  // Service areas (uses API provinces/districts)
  const [provinces, setProvinces] = useState<any[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<any | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  // Work groups
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [selectedWorkGroupIds, setSelectedWorkGroupIds] = useState<string[]>([]);
  const [wgDropdownOpen, setWgDropdownOpen] = useState(false);
  const wgRef = useRef<HTMLDivElement>(null);

  // Konum state
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);

  const handleGeocodeAddress = useCallback(async (
    city: string, district: string, neighborhood: string, streetName: string, buildingNo: string,
  ) => {
    const parts = [neighborhood, streetName, buildingNo ? `No: ${buildingNo}` : '', district, city].filter(Boolean);
    if (!parts.length) return;
    setGeocoding(true); setGeocodeMsg(null);
    try {
      const q = encodeURIComponent(parts.join(', ') + ', Türkiye');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=tr`, {
        headers: { 'Accept-Language': 'tr', 'User-Agent': 'sigorta-hasar-sistemi/1.0' },
      });
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setLocationCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
        setGeocodeMsg(`Konum bulundu: ${display_name}`);
      } else {
        setGeocodeMsg('Konum bulunamadı. Lütfen adresi kontrol edin veya haritadan seçin.');
      }
    } catch {
      setGeocodeMsg('Geocoding hatası. İnternet bağlantınızı kontrol edin.');
    } finally { setGeocoding(false); }
  }, []);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setServiceAreas([]);
    setSelectedWorkGroupIds([]);
    setSelectedProvince(null);
    setDistricts([]);
    setWgDropdownOpen(false);
    setGibError(null);
    setTcResult(null);
    setIbanResult(null);
    setPhoneError(null);
    setEmailError(null);
    setTaxNoError(null);
    setLocationCoords(null);
    setGeocodeMsg(null);
  };

  const handleGibQuery = async () => {
    if (!form.taxNumber) return;
    setGibLoading(true);
    setGibError(null);
    try {
      const result = await gibQuery(form.taxNumber, getToken());
      if (result.found) {
        setForm((p) => ({
          ...p,
          name: result.title || p.name,
          taxOffice: result.taxOffice || p.taxOffice,
          address: result.address || p.address,
        }));
      } else {
        setGibError('Vergi numarasına ait kayıt bulunamadı.');
      }
    } catch {
      setGibError('GİB sorgusu başarısız. Lütfen tekrar deneyin.');
    } finally {
      setGibLoading(false);
    }
  };

  const handleTcVerify = () => {
    if (!form.identityNo) return;
    const valid = validateTCKimlik(form.identityNo);
    setTcResult(valid);
  };

  const handleIbanVerify = async () => {
    if (!form.iban) return;
    // Quick local check first
    const localResult = validateIBAN(form.iban);
    if (!localResult.valid) {
      setIbanResult({ valid: false });
      return;
    }
    setIbanLoading(true);
    try {
      const result = await ibanVerify(form.iban, getToken());
      setIbanResult(result);
      if (result.valid && result.bankName) {
        setForm((p) => ({ ...p, bankName: result.bankName! }));
      }
    } catch {
      // Fall back to local validation result
      setIbanResult(localResult);
    } finally {
      setIbanLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    if (!form.phone) { setPhoneError(null); return; }
    const r = validatePhone(form.phone);
    if (r.valid) {
      setPhoneError(null);
      if (r.formatted) setForm((p) => ({ ...p, phone: r.formatted! }));
    } else {
      setPhoneError(r.error ?? 'Geçersiz telefon numarası');
    }
  };

  const handleEmailBlur = () => {
    if (!form.email) { setEmailError(null); return; }
    setEmailError(validateEmail(form.email) ? null : 'Geçersiz e-posta adresi');
  };

  const handleTaxNoBlur = () => {
    if (!form.taxNumber) { setTaxNoError(null); return; }
    const s = form.taxNumber.replace(/\s/g, '');
    if (s.length === 10) {
      setTaxNoError(validateVergiNo(s) ? null : 'Geçersiz vergi numarası');
    } else {
      setTaxNoError(null);
    }
  };

  const loadVendorTypes = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/system-settings/vendor-types`, { headers: authHeader() });
      setVendorTypes(r.data.data || []);
    } catch { setVendorTypes(['Taşeron', 'Malzeme Tedarikçisi', 'Lojistik', 'Ekipman', 'Diğer']); }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/locations/provinces`, { headers: authHeader() });
      setProvinces(r.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadWorkGroups = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/work-groups?limit=100`, { headers: authHeader() });
      setWorkGroups(r.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadDistricts = async (provinceId: string) => {
    try {
      const r = await axios.get(`${API}/locations/provinces/${provinceId}/districts`, { headers: authHeader() });
      setDistricts(r.data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleSelectProvince = async (prov: any) => {
    setSelectedProvince(prov);
    await loadDistricts(prov.id);
  };

  const toggleServiceArea = (provinceId: string, districtId?: string | null) => {
    const key = districtId ? `${provinceId}:${districtId}` : `${provinceId}:`;
    const exists = serviceAreas.some((sa) => {
      const saKey = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
      return saKey === key;
    });
    if (exists) {
      setServiceAreas((prev) => prev.filter((sa) => {
        const saKey = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
        return saKey !== key;
      }));
    } else {
      setServiceAreas((prev) => [...prev, { provinceId, districtId: districtId ?? null }]);
    }
  };

  const addWholeProvince = (prov: any) => {
    const already = serviceAreas.some((sa) => sa.provinceId === prov.id && !sa.districtId);
    if (!already) {
      setServiceAreas((prev) => [...prev.filter((sa) => sa.provinceId !== prov.id), { provinceId: prov.id, districtId: null }]);
    }
  };

  const toggleWorkGroup = (id: string) => {
    setSelectedWorkGroupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await axios.get(`${API}/vendors?${params}`, { headers: authHeader() });
      setVendors(res.data.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, typeFilter, statusFilter]); // eslint-disable-line
  useEffect(() => { loadProvinces(); loadWorkGroups(); loadVendorTypes(); }, [loadProvinces, loadWorkGroups, loadVendorTypes]);

  // Close work group dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wgRef.current && !wgRef.current.contains(e.target as Node)) setWgDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openCreate = () => { setEditVendor(null); resetForm(); setShowModal(true); };
  const openEdit = async (v: any) => {
    setEditVendor(v);
    setForm({
      entityType: (v.entityType as 'corporate' | 'individual') || 'corporate',
      name: v.name ?? '',
      firstName: v.firstName ?? '',
      lastName: v.lastName ?? '',
      type: v.type ?? '',
      taxNumber: v.taxNumber ?? '',
      taxOffice: v.taxOffice ?? '',
      tradeRegistryNo: v.tradeRegistryNo ?? '',
      authorizedFirstName: v.authorizedFirstName ?? (v.authorizedPerson ? v.authorizedPerson.split(' ')[0] : ''),
      authorizedLastName: v.authorizedLastName ?? (v.authorizedPerson ? v.authorizedPerson.split(' ').slice(1).join(' ') : ''),
      authorizedPhone: v.authorizedPhone ?? '',
      authorizedEmail: v.authorizedEmail ?? '',
      identityNo: v.identityNo ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
      cityCode: v.cityCode ?? '',
      city: v.city ?? '',
      district: v.district ?? '',
      neighborhood: v.neighborhood ?? '',
      streetName: v.streetName ?? '',
      buildingNo: v.buildingNo ?? '',
      doorNo: v.doorNo ?? '',
      iban: v.iban ?? '',
      bankName: v.bankName ?? '',
      notes: v.notes ?? '',
    });
    setGibError(null);
    setTcResult(null);
    setIbanResult(null);
    setPhoneError(null);
    setEmailError(null);
    setTaxNoError(null);
    setGeocodeMsg(null);
    if (v.latitude != null && v.longitude != null) {
      setLocationCoords({ lat: v.latitude, lng: v.longitude });
    } else {
      setLocationCoords(null);
    }
    try {
      const r = await axios.get(`${API}/vendors/${v.id}`, { headers: authHeader() });
      const full = r.data.data;
      setServiceAreas((full.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null })));
      setSelectedWorkGroupIds((full.vendorWorkGroups || []).map((vwg: any) => vwg.workGroupId));
    } catch { /* keep existing service areas */ }
    setSelectedProvince(null);
    setDistricts([]);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload: any = {
        entityType: form.entityType,
        type: form.type,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        cityCode: form.cityCode || null,
        city: form.city || null,
        district: form.district || null,
        neighborhood: form.neighborhood || null,
        streetName: form.streetName || null,
        buildingNo: form.buildingNo || null,
        doorNo: form.doorNo || null,
        latitude: locationCoords?.lat ?? null,
        longitude: locationCoords?.lng ?? null,
        iban: form.iban || null,
        bankName: form.bankName || null,
        notes: form.notes || null,
        serviceAreas,
        workGroupIds: selectedWorkGroupIds,
      };
      if (form.entityType === 'corporate') {
        payload.name = form.name;
        payload.taxNumber = form.taxNumber || null;
        payload.taxOffice = form.taxOffice || null;
        payload.tradeRegistryNo = form.tradeRegistryNo || null;
        payload.authorizedFirstName = form.authorizedFirstName || null;
        payload.authorizedLastName = form.authorizedLastName || null;
        payload.authorizedPhone = form.authorizedPhone || null;
        payload.authorizedEmail = form.authorizedEmail || null;
        if (!editVendor) {
          const dupName = vendors.find((v) => v.name?.trim().toLowerCase() === (form.name || '').trim().toLowerCase());
          if (dupName) { setSaveError('Bu isimde bir tedarikçi zaten mevcut!'); setSaving(false); return; }
          if (form.taxNumber) {
            const dupTax = vendors.find((v) => v.taxNumber && v.taxNumber === form.taxNumber.trim());
            if (dupTax) { setSaveError('Bu vergi numarasıyla kayıtlı bir tedarikçi zaten mevcut!'); setSaving(false); return; }
          }
        }
      } else {
        payload.firstName = form.firstName;
        payload.lastName = form.lastName;
        payload.name = `${form.firstName} ${form.lastName}`.trim();
        payload.identityNo = form.identityNo || null;
        if (!editVendor && form.identityNo) {
          const dupId = vendors.find((v) => v.identityNo && v.identityNo === form.identityNo.trim());
          if (dupId) { setSaveError('Bu TC kimlik numarasıyla kayıtlı bir tedarikçi zaten mevcut!'); setSaving(false); return; }
        }
      }
      if (editVendor) {
        await axios.patch(`${API}/vendors/${editVendor.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/vendors`, payload, { headers: authHeader() });
      }
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message ?? 'Bir hata oluştu, lütfen tekrar deneyin.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/vendors/${id}`, { headers: authHeader() });
      setDeleteTarget(null);
      load();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const handleToggleStatus = async (v: any) => {
    try {
      await axios.patch(`${API}/vendors/${v.id}`, { status: v.status === 'active' ? 'passive' : 'active' }, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const handleAddVendorType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed || vendorTypes.includes(trimmed)) return;
    setSavingType(true);
    try {
      const updated = [...vendorTypes, trimmed];
      await axios.put(`${API}/system-settings/vendor-types`, { types: updated }, { headers: authHeader() });
      setVendorTypes(updated);
      setNewTypeName('');
      setShowAddType(false);
    } catch (e) { console.error(e); } finally { setSavingType(false); }
  };

  const handleRemoveVendorType = async (t: string) => {
    const updated = vendorTypes.filter((x) => x !== t);
    try {
      await axios.put(`${API}/system-settings/vendor-types`, { types: updated }, { headers: authHeader() });
      setVendorTypes(updated);
    } catch (e) { console.error(e); }
  };

  const selectedWgNames = workGroups.filter((wg) => selectedWorkGroupIds.includes(wg.id)).map((wg) => wg.name);

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm';

  return (
    <SettingsPageLayout
      title="Tedarikçiler"
      description={`${vendors.length} tedarikçi kayıtlı`}
      addButtonText="+ Yeni Tedarikçi"
      onAdd={openCreate}
    >

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 flex flex-wrap gap-3 items-center">
        <input
          placeholder="İsim, E-Posta Ara..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tüm Türler</option>
          {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>
      ) : !vendors.length ? (
        <div className="text-slate-400 py-16 text-center">Tedarikçi bulunamadı.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Tedarikçi</th>
                <th className="text-left px-4 py-3">Tür</th>
                <th className="text-left px-4 py-3">Tip</th>
                <th className="text-left px-4 py-3">İletişim</th>
                <th className="text-left px-4 py-3">Şehir</th>
                <th className="text-center px-4 py-3">Durum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-blue-50/20">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <Link href={`/panel/ayarlar/tedarikciler/${v.id}`} className="hover:text-blue-600">{v.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.type || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${v.entityType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                      {v.entityType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {v.email && <p>{v.email}</p>}
                    {v.phone && <p className="text-xs text-slate-400">{v.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.city ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button type="button" onClick={() => handleToggleStatus(v)}>
                      <StatusBadge active={v.status === 'active'} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/panel/ayarlar/tedarikciler/${v.id}`} className="text-xs text-slate-500 hover:underline">Detay</Link>
                      <button type="button" onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:underline">Düzenle</button>
                      <button type="button" onClick={() => setDeleteTarget(v)} className="text-xs text-red-400 hover:text-red-600">Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-800 mb-3">{editVendor ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi Ekle'}</h3>

            {/* Kimlik Bandı */}
            {(() => {
              const displayName = form.entityType === 'individual'
                ? `${form.firstName} ${form.lastName}`.trim()
                : form.name.trim();
              const typeLabel = form.entityType === 'individual' ? 'Bireysel Tedarikçi' : 'Kurumsal Tedarikçi';
              return displayName ? (
                <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-800">{displayName}</span>
                  <span className="text-xs text-blue-500 font-medium">— {typeLabel}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs text-slate-400 italic">İsim girilmedi</span>
                </div>
              );
            })()}

            {/* Kurumsal / Bireysel Toggle */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, entityType: 'corporate' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.entityType === 'corporate' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Kurumsal
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, entityType: 'individual' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.entityType === 'individual' ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Bireysel
              </button>
            </div>

            {/* Tür Alanı */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tür</p>
            <div className="flex gap-2 mb-4">
              <select className={`flex-1 ${inp}`} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="">Tür Seçin...</option>
                {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowAddType(!showAddType)}
                className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 whitespace-nowrap"
              >
                + Yeni Tür
              </button>
            </div>
            {showAddType && (
              <div className="flex gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <input
                  className={inp}
                  placeholder="Tür Adı"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddVendorType(); }}
                />
                <button type="button" onClick={handleAddVendorType} disabled={savingType || !newTypeName.trim()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">Ekle</button>
                <button type="button" onClick={() => setShowAddType(false)} className="text-sm text-slate-500">İptal</button>
              </div>
            )}
            {vendorTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {vendorTypes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    {t}
                    <button type="button" onClick={() => handleRemoveVendorType(t)} className="text-slate-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Kurumsal Alanlar */}
            {form.entityType === 'corporate' && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kurumsal Bilgiler</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">Şirket Adı <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                    <input className={inp} placeholder="Zorunlu Alan" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Vergi No</label>
                    <div className="flex gap-2">
                      <input
                        className={`flex-1 ${inp}`}
                        placeholder="Opsiyonel"
                        value={form.taxNumber}
                        onChange={(e) => { setForm((p) => ({ ...p, taxNumber: e.target.value })); setGibError(null); setTaxNoError(null); }}
                        onBlur={handleTaxNoBlur}
                      />
                      <button
                        type="button"
                        onClick={handleGibQuery}
                        disabled={gibLoading || !form.taxNumber}
                        className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                      >
                        {gibLoading ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : null}
                        Sorgula
                      </button>
                    </div>
                    {gibError && <p className="text-xs text-red-500 mt-1">{gibError}</p>}
                    {taxNoError && <p className="text-xs text-red-500 mt-1">{taxNoError}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Vergi Dairesi</label>
                    <input className={inp} placeholder="Opsiyonel" value={form.taxOffice} onChange={(e) => setForm((p) => ({ ...p, taxOffice: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Ticaret Sicil No</label>
                    <input className={inp} placeholder="Opsiyonel" value={form.tradeRegistryNo} onChange={(e) => setForm((p) => ({ ...p, tradeRegistryNo: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Yetkili Ad</label>
                    <input className={inp} placeholder="Opsiyonel" value={form.authorizedFirstName} onChange={(e) => setForm((p) => ({ ...p, authorizedFirstName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Yetkili Soyad</label>
                    <input className={inp} placeholder="Opsiyonel" value={form.authorizedLastName} onChange={(e) => setForm((p) => ({ ...p, authorizedLastName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Yetkili Telefon</label>
                    <input className={inp} placeholder="Opsiyonel" value={form.authorizedPhone} onChange={(e) => setForm((p) => ({ ...p, authorizedPhone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Yetkili E-posta</label>
                    <input type="email" className={inp} placeholder="Opsiyonel" value={form.authorizedEmail} onChange={(e) => setForm((p) => ({ ...p, authorizedEmail: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {/* Bireysel Alanlar */}
            {form.entityType === 'individual' && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bireysel Bilgiler</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Ad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                    <input className={inp} placeholder="Zorunlu" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Soyad <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                    <input className={inp} placeholder="Zorunlu" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} required />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">TC Kimlik No</label>
                    <div className="flex gap-2">
                      <input
                        className={`flex-1 ${inp}`}
                        placeholder="Opsiyonel (11 hane)"
                        maxLength={11}
                        value={form.identityNo}
                        onChange={(e) => { setForm((p) => ({ ...p, identityNo: e.target.value })); setTcResult(null); }}
                      />
                      <button
                        type="button"
                        onClick={handleTcVerify}
                        disabled={!form.identityNo}
                        className="bg-purple-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                      >
                        Doğrula
                      </button>
                      {tcResult === true && (
                        <span className="flex items-center text-green-600 text-xs gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          Geçerli
                        </span>
                      )}
                      {tcResult === false && (
                        <span className="flex items-center text-red-500 text-xs gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                          Geçersiz TC
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Telefon</label>
                    <input
                      className={inp}
                      placeholder="05XX XXX XX XX"
                      value={form.phone}
                      onChange={(e) => { setForm((p) => ({ ...p, phone: e.target.value })); setPhoneError(null); }}
                      onBlur={handlePhoneBlur}
                    />
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">E-posta</label>
                    <input
                      type="email"
                      className={inp}
                      placeholder="Opsiyonel"
                      value={form.email}
                      onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); }}
                      onBlur={handleEmailBlur}
                    />
                    {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Ortak Alanlar */}
            {form.entityType === 'corporate' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Telefon</label>
                  <input
                    className={inp}
                    placeholder="05XX XXX XX XX"
                    value={form.phone}
                    onChange={(e) => { setForm((p) => ({ ...p, phone: e.target.value })); setPhoneError(null); }}
                    onBlur={handlePhoneBlur}
                  />
                  {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">E-posta</label>
                  <input
                    type="email"
                    className={inp}
                    placeholder="Opsiyonel"
                    value={form.email}
                    onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); }}
                    onBlur={handleEmailBlur}
                  />
                  {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                </div>
              </div>
            )}

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Adres Bilgileri</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">İl</label>
                <select
                  className={inp}
                  value={form.cityCode}
                  onChange={(e) => {
                    const prov = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                    setForm((p) => ({ ...p, cityCode: e.target.value, city: prov?.name ?? '', district: '', neighborhood: '' }));
                  }}
                >
                  <option value="">İl seçin...</option>
                  {STATIC_PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>{p.plateCode} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">İlçe</label>
                <select
                  className={inp}
                  value={form.district}
                  disabled={!form.cityCode}
                  onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}
                >
                  <option value="">İlçe seçin...</option>
                  {(form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : []).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Mahalle</label>
                <input className={inp} placeholder="Mahalle adı"
                  value={form.neighborhood}
                  onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Cadde / Sokak</label>
                <input className={inp} placeholder="Cadde veya sokak adı"
                  value={form.streetName}
                  onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Bina No</label>
                  <input className={inp} placeholder="Bina no"
                    value={form.buildingNo}
                    onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Daire No</label>
                  <input className={inp} placeholder="Daire no"
                    value={form.doorNo}
                    onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))} />
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Açık Adres</label>
                <input className={inp} placeholder="Opsiyonel" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              {/* Geocoding buttons */}
              {(form.city || form.district || form.neighborhood || form.streetName) && (
                <div className="col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={geocoding}
                    onClick={() => handleGeocodeAddress(form.city, form.district, form.neighborhood, form.streetName, form.buildingNo)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                  >
                    {geocoding ? (
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    )}
                    {geocoding ? 'Aranıyor...' : 'Konumu Bul'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${locationCoords ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    {locationCoords ? 'Konum Seçildi' : 'Haritadan Konum Seç'}
                  </button>
                </div>
              )}
              {geocodeMsg && (
                <div className={`col-span-2 text-xs px-3 py-2 rounded-lg ${geocodeMsg.startsWith('Konum bulundu') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {geocodeMsg}
                </div>
              )}
              {locationCoords && (
                <div className="col-span-2">
                  <LocationPreview
                    lat={locationCoords.lat}
                    lng={locationCoords.lng}
                    onEdit={() => setShowLocationPicker(true)}
                    onClear={() => { setLocationCoords(null); setGeocodeMsg(null); }}
                    accentColor="indigo"
                  />
                </div>
              )}
            </div>

            <LocationPickerModal
              open={showLocationPicker}
              initial={locationCoords}
              addressHint={[form.neighborhood, form.streetName, form.buildingNo ? `No: ${form.buildingNo}` : '', form.district, form.city].filter(Boolean).join(' ') || undefined}
              onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
              onClose={() => setShowLocationPicker(false)}
            />

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Banka Bilgileri</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">IBAN</label>
                <div className="flex gap-2">
                  <input
                    className={`flex-1 ${inp}`}
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    value={form.iban}
                    onChange={(e) => { setForm((p) => ({ ...p, iban: e.target.value })); setIbanResult(null); }}
                  />
                  <button
                    type="button"
                    onClick={handleIbanVerify}
                    disabled={ibanLoading || !form.iban}
                    className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                  >
                    {ibanLoading ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : null}
                    Doğrula
                  </button>
                  {ibanResult?.valid === true && (
                    <span className="flex items-center text-green-600 text-xs gap-1 whitespace-nowrap">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {ibanResult.bankName ?? 'Geçerli'}
                    </span>
                  )}
                  {ibanResult?.valid === false && (
                    <span className="flex items-center text-red-500 text-xs gap-1 whitespace-nowrap">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      Geçersiz IBAN
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Banka Adı</label>
                <input className={inp} placeholder="Opsiyonel (IBAN doğrulaması ile otomatik dolar)" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
              </div>
            </div>

            {/* Hizmet Bölgeleri */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hizmet Bölgeleri</p>
            <div className="border border-slate-200 rounded-xl p-3 mb-4">
              <div className="flex gap-2 mb-2">
                <select
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedProvince?.id ?? ''}
                  onChange={(e) => {
                    const p = provinces.find((x) => x.id === e.target.value);
                    if (p) handleSelectProvince(p);
                  }}
                >
                  <option value="">İl Seçin...</option>
                  {provinces.map((p) => <option key={p.id} value={p.id}>{p.plateCode} - {p.name}</option>)}
                </select>
                {selectedProvince && (
                  <button
                    type="button"
                    onClick={() => addWholeProvince(selectedProvince)}
                    className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100"
                  >
                    Tüm İlçeleri Ekle
                  </button>
                )}
              </div>
              {selectedProvince && districts.length > 0 && (
                <div className="max-h-28 overflow-y-auto grid grid-cols-3 gap-1">
                  {districts.map((d) => {
                    const checked = serviceAreas.some((sa) => sa.provinceId === selectedProvince.id && sa.districtId === d.id);
                    return (
                      <label key={d.id} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer hover:text-blue-600">
                        <input type="checkbox" checked={checked} onChange={() => toggleServiceArea(selectedProvince.id, d.id)} className="rounded" />
                        {d.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {serviceAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {serviceAreas.map((sa, i) => {
                    const prov = provinces.find((p) => p.id === sa.provinceId);
                    let label = prov?.name ?? '?';
                    if (sa.districtId) {
                      const d = districts.find((x) => x.id === sa.districtId);
                      if (d) label = `${prov?.name}/${d.name}`;
                    } else {
                      label += ' (Tümü)';
                    }
                    return (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">
                        {label}
                        <button type="button" onClick={() => {
                          const key = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
                          setServiceAreas((prev) => prev.filter((x) => {
                            const xKey = x.districtId ? `${x.provinceId}:${x.districtId}` : `${x.provinceId}:`;
                            return xKey !== key;
                          }));
                        }} className="text-blue-400 hover:text-red-500">×</button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* İş Grupları - Multi-select dropdown */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">İş Grupları</p>
            <div ref={wgRef} className="relative mb-4">
              <button
                type="button"
                onClick={() => setWgDropdownOpen((o) => !o)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between"
              >
                <span className={selectedWgNames.length ? 'text-slate-800' : 'text-slate-400'}>
                  {selectedWgNames.length ? `${selectedWgNames.length} İş Grubu Seçildi` : 'İş Grubu Seçin...'}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${wgDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {wgDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-slate-100 z-30 max-h-48 overflow-y-auto py-1">
                  {workGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 px-4 py-3">İş grubu bulunamadı.</p>
                  ) : (
                    workGroups.map((wg) => (
                      <label key={wg.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedWorkGroupIds.includes(wg.id)}
                          onChange={() => toggleWorkGroup(wg.id)}
                          className="rounded"
                        />
                        {wg.name}
                      </label>
                    ))
                  )}
                </div>
              )}
              {selectedWgNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedWgNames.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5 border border-indigo-100">
                      {name}
                      <button type="button" onClick={() => {
                        const wg = workGroups.find((w) => w.name === name);
                        if (wg) toggleWorkGroup(wg.id);
                      }} className="text-indigo-300 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Notlar</label>
              <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Opsiyonel" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2 mt-4">
              {saveError && (
                <div className="w-full mb-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{saveError}</div>
              )}
              <div className="flex gap-2 w-full">
              <button type="button" onClick={handleSave}
                disabled={saving || (form.entityType === 'corporate' ? !form.name : (!form.firstName || !form.lastName))}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : editVendor ? 'Güncelle' : 'Ekle'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 py-2 rounded-lg text-sm text-slate-600">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        deleting={deleting}
        itemName={deleteTarget?.name}
      />
    </SettingsPageLayout>
  );
}
