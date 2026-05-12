'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

const STATUS_LABELS: Record<string, string> = { active: 'Aktif', passive: 'Pasif', suspended: 'Askıya Alındı' };
const STATUS_COLOR: Record<string, string> = { active: 'bg-green-100 text-green-700', passive: 'bg-slate-100 text-slate-500', suspended: 'bg-red-100 text-red-600' };

type SortKey = 'performanceScore' | 'avgReportDays' | 'revisionRate' | 'total';

// Telefon mask helpers
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

function TRPhoneInput({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
  const [display, setDisplay] = useState(() => storageToMask(value));
  useEffect(() => { setDisplay(storageToMask(value)); }, [value]); // eslint-disable-line
  const borderCls = hasError
    ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50'
    : 'border-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${borderCls}`}
      placeholder="0 (5XX) XXX XX XX"
      value={display}
      maxLength={18}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
        setDisplay(maskPhoneTR(raw));
        onChange(raw);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11);
        setDisplay(maskPhoneTR(raw));
        onChange(raw);
      }}
    />
  );
}

const SECTIONS = ['Kişisel Bilgiler', 'İletişim & Adres', 'Uzmanlık', 'İlgili Kişiler'];

type ContactPerson = { firstName: string; lastName: string; role: string; phone: string; email: string };
const emptyContact = (): ContactPerson => ({ firstName: '', lastName: '', role: '', phone: '', email: '' });

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  company: '',
  
  phone: '',
  email: '',
  cityCode: '',
  city: '',
  district: '',
  neighborhood: '',
  streetName: '',
  buildingNo: '',
  doorNo: '',
  address: '',
  serviceBranches: [] as string[],
  serviceRegions: [] as string[],
  insuranceCompanyIds: [] as string[],
  notes: '',
  status: 'active' as 'active' | 'passive',
});

const STATIC_BRANCHES = [
  'Yangın', 'Su Hasarı', 'Taşıt', 'Hırsızlık', 'Dolu Hasarı',
  'Deprem', 'Cam Kırılması', 'Makine Kırılması', 'İnşaat', 'Nakliyat',
  'Mühendislik', 'Sorumluluk', 'Tekne', 'Tarım', 'Can Sigortası',
];

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-4">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
    </div>
  );
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
const inpErr = 'w-full border border-red-400 ring-2 ring-red-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-colors bg-red-50';

export default function AdjustersPage() {
  const [adjusters, setAdjusters] = useState<any[]>([]);
  const [performance, setPerformance] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('performanceScore');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [contacts, setContacts] = useState<ContactPerson[]>([emptyContact()]);

  // Validation states
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Branch list from API (fallback to static)
  const [availableBranches, setAvailableBranches] = useState<string[]>(STATIC_BRANCHES);

  // Insurance companies list for multi-select
  const [insuranceCompanies, setInsuranceCompanies] = useState<{ id: string; name: string }[]>([]);

  // Relationship types from settings
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [addingNewRelType, setAddingNewRelType] = useState(false);
  const [newRelTypeValue, setNewRelTypeValue] = useState('');
  const [savingRelType, setSavingRelType] = useState(false);

  const currentDistricts = form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : [];

  // Geocoding states
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const [adjRes, perfRes] = await Promise.all([
        axios.get(`${API}/adjusters?${params}`, { headers: authHeader() }),
        axios.get(`${API}/adjusters/performance`, { headers: authHeader() }),
      ]);
      setAdjusters(adjRes.data.data || []);
      const perfMap: Record<string, any> = {};
      (perfRes.data.data || []).forEach((p: any) => { perfMap[p.id] = p; });
      setPerformance(perfMap);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]); // eslint-disable-line

  useEffect(() => {
    axios.get(`${API}/service-branches?type=hasar`, { headers: authHeader() })
      .then((r) => {
        const names = (r.data.data ?? []).map((b: any) => b.name as string).filter(Boolean);
        if (names.length > 0) setAvailableBranches(names);
      })
      .catch(() => { /* use static fallback */ });

    axios.get(`${API}/insurance-companies`, { headers: authHeader() })
      .then((r) => {
        const list = (r.data.data ?? r.data ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string }));
        setInsuranceCompanies(list);
      })
      .catch(() => { /* insurance companies unavailable */ });

    axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data ?? [];
        if (data.length > 0 && typeof data[0] === 'string') {
          setRelationshipTypes(data as string[]);
        } else {
          setRelationshipTypes(
            (data as { label: string; active: boolean }[])
              .filter((t) => t.active)
              .map((t) => t.label)
          );
        }
      })
      .catch(() => { /* use empty fallback */ });
  }, []);

  const handleAddNewRelType = async (onSelect?: (label: string) => void) => {
    const val = newRelTypeValue.trim();
    if (!val || savingRelType) return;
    if (relationshipTypes.includes(val)) {
      onSelect?.(val);
      setAddingNewRelType(false);
      setNewRelTypeValue('');
      return;
    }
    setSavingRelType(true);
    try {
      const res = await axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() });
      const existing = res.data.data ?? [];
      const full: Array<{ label: string; active: boolean }> = existing.length > 0 && typeof existing[0] === 'string'
        ? existing.map((l: string) => ({ label: l, active: true }))
        : existing;
      if (!full.some((t: { label: string }) => t.label === val)) {
        full.push({ label: val, active: true });
        await axios.put(`${API}/system-settings/relationship-types`, { values: full }, { headers: authHeader() });
      }
      setRelationshipTypes((prev) => prev.includes(val) ? prev : [...prev, val]);
      onSelect?.(val);
    } catch { /* ignore */ } finally {
      setSavingRelType(false);
      setAddingNewRelType(false);
      setNewRelTypeValue('');
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setActiveSection(0);
    setPhoneError(null); setFieldErrors({});
    setContacts([emptyContact()]);
    setLocationCoords(null);
    setGeocodeMsg(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = 'Bu alan zorunludur';
    if (!form.lastName.trim()) errors.lastName = 'Bu alan zorunludur';
    if (!form.phone || form.phone.replace(/\D/g, '').length < 11) errors.phone = 'Geçerli bir telefon numarası giriniz';
    if (form.serviceBranches.length === 0) errors.serviceBranches = 'En az bir branş seçiniz';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) {
      if (fieldErrors.firstName || fieldErrors.lastName) { setActiveSection(0); return; }
      if (fieldErrors.phone) { setActiveSection(1); return; }
      if (fieldErrors.serviceBranches) { setActiveSection(2); return; }
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/adjusters`, {
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        company: form.company || null,
        
        phone: form.phone || null,
        email: form.email || null,
        city: form.city || null,
        district: form.district || null,
        neighborhood: form.neighborhood || null,
        streetName: form.streetName || null,
        buildingNo: form.buildingNo || null,
        doorNo: form.doorNo || null,
        address: form.address || null,
        latitude: locationCoords?.lat ?? null,
        longitude: locationCoords?.lng ?? null,
        specialties: form.serviceBranches,
        serviceRegions: form.serviceRegions,
        insuranceCompanyIds: form.insuranceCompanyIds,
        notes: form.notes || null,
        status: form.status,
        contacts: contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).map((c) => ({ ...c, role: c.role === '__other__' ? '' : c.role })),
      }, { headers: authHeader() });
      setShowCreateModal(false);
      resetForm();
      load();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" isimli eksperi silmek istediğinize emin misiniz?`)) return;
    try {
      await axios.delete(`${API}/adjusters/${id}`, { headers: authHeader() });
      load();
    } catch (e) { console.error(e); }
  };

  const toggleBranch = (b: string) => {
    setForm((p) => ({
      ...p,
      serviceBranches: p.serviceBranches.includes(b)
        ? p.serviceBranches.filter((x) => x !== b)
        : [...p.serviceBranches, b],
    }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n.serviceBranches; return n; });
  };

  const toggleRegion = (code: string) => {
    setForm((p) => ({
      ...p,
      serviceRegions: p.serviceRegions.includes(code)
        ? p.serviceRegions.filter((x) => x !== code)
        : [...p.serviceRegions, code],
    }));
  };

  const toggleInsuranceCompany = (id: string) => {
    setForm((p) => ({
      ...p,
      insuranceCompanyIds: p.insuranceCompanyIds.includes(id)
        ? p.insuranceCompanyIds.filter((x) => x !== id)
        : [...p.insuranceCompanyIds, id],
    }));
  };

  const upC = (i: number, f: keyof ContactPerson, v: string) =>
    setContacts((p) => p.map((c, j) => (j === i ? { ...c, [f]: v } : c)));

  const enriched = adjusters.map((a) => ({ ...a, ...performance[a.id] }));
  const sorted = [...enriched].sort((a, b) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    return sortBy === 'avgReportDays' || sortBy === 'revisionRate' ? va - vb : vb - va;
  });

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Eksperler</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Eksperler</h2>
          <p className="text-sm text-slate-400 mt-0.5">{adjusters.length} eksper kayıtlı</p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Eksper
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 flex flex-wrap gap-3 items-center">
        <input
          placeholder="İsim, Şirket, E-Posta Ara..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-400">Sıralama:</span>
          {([['performanceScore', 'Skor'], ['total', 'Toplam İş'], ['avgReportDays', 'Rapor Süresi ↑'], ['revisionRate', 'Revizyon Oranı ↑']] as const).map(([k, l]) => (
            <button type="button" key={k} onClick={() => setSortBy(k)} className={`text-xs px-3 py-1.5 rounded-lg transition-all ${sortBy === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse p-4">{Array.from({length:6}).map((_,i)=><div key={i} className="h-12 rounded-lg bg-slate-200"/>)}</div>
      ) : !sorted.length ? (
        <div className="text-slate-400 py-16 text-center">Eksper bulunamadı.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Eksper</th>
                <th className="text-left px-4 py-3">Bölge</th>
                <th className="text-center px-4 py-3">Toplam İş</th>
                <th className="text-center px-4 py-3">Tamamlanan</th>
                <th className="text-center px-4 py-3">Ort. Rapor Süresi</th>
                <th className="text-center px-4 py-3">Revizyon Oranı</th>
                <th className="text-center px-4 py-3">Performans</th>
                <th className="text-center px-4 py-3">Durum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((adj) => (
                <tr key={adj.id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <Link href={`/panel/eksperler/${adj.id}`} className="font-semibold text-blue-700 hover:underline">{adj.name}</Link>
                    <p className="text-xs text-slate-400">{adj.company ?? '—'}</p>
                    {adj.insuranceCompanies?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(adj.insuranceCompanies as { id: string; name: string }[]).slice(0, 3).map((ic) => (
                          <span key={ic.id} className="inline-block text-[10px] leading-none bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                            {ic.name}
                          </span>
                        ))}
                        {adj.insuranceCompanies.length > 3 && (
                          <span className="inline-block text-[10px] leading-none bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                            +{adj.insuranceCompanies.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{adj.city ?? '—'}</p>
                    {adj.district && <p className="text-xs text-slate-400">{adj.district}</p>}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{adj.total ?? 0}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-medium">{adj.completed ?? 0}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{adj.avgReportDays ? `${adj.avgReportDays} gün` : '—'}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{adj.revisionRate != null ? `%${adj.revisionRate}` : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-lg font-bold ${scoreColor(adj.performanceScore ?? 0)}`}>{adj.performanceScore ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[adj.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABELS[adj.status] ?? adj.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/panel/eksperler/${adj.id}`} className="text-xs text-blue-600 hover:underline">Profil</Link>
                      <button type="button" onClick={() => handleDelete(adj.id, adj.name)} className="text-xs text-red-400 hover:text-red-600">Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div>
                <h3 className="text-base font-semibold text-white">Yeni Eksper Ekle</h3>
                <p className="text-blue-200 text-xs mt-0.5">Eksper bilgilerini eksiksiz doldurun</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-blue-200 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Kimlik Bandı */}
            {(() => {
              const displayName = `${form.firstName} ${form.lastName}`.trim();
              const typeLabel = form.company ? `Eksper — ${form.company}` : 'Eksper';
              return displayName ? (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border-b border-blue-100">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-800">{displayName}</span>
                  <span className="text-xs text-blue-500 font-medium">— {typeLabel}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs text-slate-400 italic">İsim girilmedi</span>
                </div>
              );
            })()}

            {/* Section Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {SECTIONS.map((sec, i) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setActiveSection(i)}
                  className={`flex-1 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeSection === i
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'
                  }`}
                >
                  {i + 1}. {sec}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Section 0: Kişisel Bilgiler */}
              {activeSection === 0 && (
                <div className="space-y-4">
                  <SectionTitle title="Kişisel Bilgiler" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Ad" required error={fieldErrors.firstName}>
                      <input
                        className={fieldErrors.firstName ? inpErr : inp}
                        placeholder="Ahmet"
                        value={form.firstName}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, firstName: e.target.value }));
                          setFieldErrors((prev) => { const n = { ...prev }; delete n.firstName; return n; });
                        }}
                      />
                    </FormField>
                    <FormField label="Soyad" required error={fieldErrors.lastName}>
                      <input
                        className={fieldErrors.lastName ? inpErr : inp}
                        placeholder="Yılmaz"
                        value={form.lastName}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, lastName: e.target.value }));
                          setFieldErrors((prev) => { const n = { ...prev }; delete n.lastName; return n; });
                        }}
                      />
                    </FormField>
                    <div className="col-span-2">
                      <FormField label="Eksper Firması">
                        <input
                          className={inp}
                          placeholder="Firma adı (opsiyonel)"
                          value={form.company}
                          onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                        />
                      </FormField>
                    </div>
                  </div>

                  <SectionTitle title="Durum" />
                  <div className="flex gap-3">
                    {([['active', 'Aktif', 'green'], ['passive', 'Pasif', 'gray']] as const).map(([val, label, color]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, status: val }))}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                          form.status === val
                            ? color === 'green'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-slate-500 text-white border-slate-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${form.status === val ? 'bg-white' : color === 'green' ? 'bg-green-500' : 'bg-slate-400'}`} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 1: İletişim & Adres */}
              {activeSection === 1 && (
                <div className="space-y-4">
                  <SectionTitle title="İletişim Bilgileri" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Telefon" required error={phoneError ?? fieldErrors.phone ?? undefined}>
                      <TRPhoneInput
                        value={form.phone}
                        onChange={(v) => {
                          setForm((p) => ({ ...p, phone: v }));
                          setPhoneError(null);
                          setFieldErrors((prev) => { const n = { ...prev }; delete n.phone; return n; });
                        }}
                        hasError={!!(phoneError || fieldErrors.phone)}
                      />
                    </FormField>
                    <FormField label="E-posta">
                      <input
                        type="email"
                        className={inp}
                        placeholder="ornek@mail.com"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </FormField>
                  </div>

                  <SectionTitle title="Adres Bilgileri" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="İl">
                      <select
                        className={inp}
                        value={form.cityCode}
                        onChange={(e) => {
                          const selected = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                          setForm((p) => ({
                            ...p,
                            cityCode: e.target.value,
                            city: selected?.name ?? '',
                            district: '',
                            neighborhood: '',
                          }));
                        }}
                      >
                        <option value="">İl Seçin...</option>
                        {STATIC_PROVINCES.map((prov) => (
                          <option key={prov.code} value={prov.code}>{prov.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="İlçe">
                      <select
                        className={inp}
                        value={form.district}
                        disabled={!form.cityCode}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}
                      >
                        <option value="">İlçe Seçin...</option>
                        {currentDistricts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="col-span-2">
                      <FormField label="Mahalle">
                        <input
                          className={inp}
                          placeholder="Mahalle adı"
                          value={form.neighborhood}
                          onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    <FormField label="Cadde / Sokak">
                      <input
                        className={inp}
                        placeholder="Cadde veya sokak adı"
                        value={form.streetName}
                        onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Bina No">
                        <input
                          className={inp}
                          placeholder="Bina no"
                          value={form.buildingNo}
                          onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))}
                        />
                      </FormField>
                      <FormField label="Daire No">
                        <input
                          className={inp}
                          placeholder="Daire no"
                          value={form.doorNo}
                          onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    <div className="col-span-2">
                      <FormField label="Açık Adres">
                        <input
                          className={inp}
                          placeholder="Cadde, sokak, bina no..."
                          value={form.address}
                          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                        />
                      </FormField>
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                          </svg>
                          Haritadan Konum Seç
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
                          accentColor="blue"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 2: Uzmanlık */}
              {activeSection === 2 && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Hasar Branşları <span className="text-red-400">*</span>
                        </p>
                        {fieldErrors.serviceBranches && (
                          <p className="text-xs text-red-500 mt-0.5">{fieldErrors.serviceBranches}</p>
                        )}
                      </div>
                      {form.serviceBranches.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 font-medium">
                          {form.serviceBranches.length} seçildi
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableBranches.map((b) => {
                        const selected = form.serviceBranches.includes(b);
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleBranch(b)}
                            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                              selected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {selected && <span className="mr-1">✓</span>}
                            {b}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected chips */}
                    {form.serviceBranches.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2">Seçilen branşlar:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {form.serviceBranches.map((b) => (
                            <span
                              key={b}
                              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1 font-medium"
                            >
                              {b}
                              <button
                                type="button"
                                onClick={() => toggleBranch(b)}
                                className="ml-0.5 text-blue-400 hover:text-blue-700 rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-blue-100"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Hizmet Bölgeleri{' '}
                        <span className="text-slate-400 font-normal normal-case">(opsiyonel)</span>
                      </p>
                      {form.serviceRegions.length > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">
                          {form.serviceRegions.length} il
                        </span>
                      )}
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATIC_PROVINCES.map((prov) => {
                          const selected = form.serviceRegions.includes(prov.code);
                          return (
                            <button
                              key={prov.code}
                              type="button"
                              onClick={() => toggleRegion(prov.code)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                                selected
                                  ? 'bg-slate-600 text-white border-slate-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {prov.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {insuranceCompanies.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Çalıştığı Sigorta Şirketleri{' '}
                          <span className="text-slate-400 font-normal normal-case">(opsiyonel)</span>
                        </p>
                        {form.insuranceCompanyIds.length > 0 && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">
                            {form.insuranceCompanyIds.length} şirket
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {insuranceCompanies.map((ic) => {
                          const selected = form.insuranceCompanyIds.includes(ic.id);
                          return (
                            <button
                              key={ic.id}
                              type="button"
                              onClick={() => toggleInsuranceCompany(ic.id)}
                              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                                selected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                            >
                              {selected && <span className="mr-1">✓</span>}
                              {ic.name}
                            </button>
                          );
                        })}
                      </div>
                      {form.insuranceCompanyIds.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1.5">
                            {form.insuranceCompanyIds.map((icId) => {
                              const ic = insuranceCompanies.find((c) => c.id === icId);
                              if (!ic) return null;
                              return (
                                <span key={icId} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1 font-medium">
                                  {ic.name}
                                  <button type="button" onClick={() => toggleInsuranceCompany(icId)} className="ml-0.5 text-indigo-400 hover:text-indigo-700 rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-indigo-100">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <FormField label="Notlar">
                    <textarea
                      className={inp}
                      rows={3}
                      placeholder="Eksperle ilgili notlar..."
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </FormField>
                </div>
              )}

              {/* Section 3: İlgili Kişiler */}
              {activeSection === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-base">👥</span>
                    <span className="text-sm font-semibold text-slate-700">İlgili Kişiler</span>
                    <span className="text-xs text-slate-400 font-normal">(Opsiyonel)</span>
                    {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length > 0 && (
                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                        {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length} kişi
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {contacts.map((c, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 p-4 relative">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-500">İlgili Kişi #{idx + 1}</span>
                          {contacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Ad">
                            <input
                              className={inp}
                              placeholder="Ad"
                              value={c.firstName}
                              onChange={(e) => upC(idx, 'firstName', e.target.value)}
                            />
                          </FormField>
                          <FormField label="Soyad">
                            <input
                              className={inp}
                              placeholder="Soyad"
                              value={c.lastName}
                              onChange={(e) => upC(idx, 'lastName', e.target.value)}
                            />
                          </FormField>
                          <FormField label="Görevi">
                            <select
                              className={inp}
                              value={c.role === '' ? '' : (relationshipTypes.includes(c.role) ? c.role : '__other__')}
                              onChange={(e) => {
                                if (e.target.value === '__add_new__') { setAddingNewRelType(true); setNewRelTypeValue(''); }
                                else if (e.target.value === '__other__') upC(idx, 'role', '__other__');
                                else upC(idx, 'role', e.target.value);
                              }}
                            >
                              <option value="">Seçin...</option>
                              {relationshipTypes.filter((rt) => rt !== 'Diğer').map((rt) => (
                                <option key={rt} value={rt}>{rt}</option>
                              ))}
                              <option value="__other__">Diğer</option>
                              <option value="__add_new__">+ Yeni Tür Ekle</option>
                            </select>
                            {addingNewRelType && (
                              <div className="flex gap-1.5 mt-1.5">
                                <input
                                  autoFocus
                                  className={`${inp} flex-1`}
                                  placeholder="Yeni tür adı..."
                                  value={newRelTypeValue}
                                  onChange={(e) => setNewRelTypeValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleAddNewRelType((label) => upC(idx, 'role', label)); }
                                    if (e.key === 'Escape') { setAddingNewRelType(false); setNewRelTypeValue(''); }
                                  }}
                                />
                                <button type="button" disabled={savingRelType || !newRelTypeValue.trim()}
                                  onClick={() => handleAddNewRelType((label) => upC(idx, 'role', label))}
                                  className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                                  {savingRelType ? '...' : 'Ekle'}
                                </button>
                                <button type="button" onClick={() => { setAddingNewRelType(false); setNewRelTypeValue(''); }}
                                  className="px-2 py-1.5 border border-slate-200 text-slate-500 text-xs rounded-lg hover:bg-slate-50 flex-shrink-0">
                                  İptal
                                </button>
                              </div>
                            )}
                            {!addingNewRelType && (c.role === '__other__' || (!relationshipTypes.includes(c.role) && c.role !== '')) && (
                              <input
                                className={`${inp} mt-1.5`}
                                placeholder="Görevi / Ünvanı girin..."
                                value={c.role === '__other__' ? '' : c.role}
                                onChange={(e) => upC(idx, 'role', e.target.value || '__other__')}
                              />
                            )}
                          </FormField>
                          <FormField label="Telefon">
                            <TRPhoneInput value={c.phone} onChange={(v) => upC(idx, 'phone', v)} />
                          </FormField>
                          <div className="col-span-2">
                            <FormField label="E-posta">
                              <input
                                type="email"
                                className={inp}
                                placeholder="ornek@mail.com"
                                value={c.email}
                                onChange={(e) => upC(idx, 'email', e.target.value)}
                              />
                            </FormField>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setContacts((p) => [...p, emptyContact()])}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Kişi Ekle
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-2 items-center">
                {activeSection > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSection((s) => s - 1)}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    ← Geri
                  </button>
                )}
                <div className="flex gap-1 ml-2">
                  {SECTIONS.map((_, i) => (
                    <button key={i} type="button" onClick={() => setActiveSection(i)} className={`h-2 rounded-full transition-all ${activeSection === i ? 'bg-blue-600 w-4' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                {activeSection < SECTIONS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveSection((s) => s + 1)}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors"
                  >
                    İleri →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !form.firstName || !form.lastName || !form.phone || form.serviceBranches.length === 0}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {saving && (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      <LocationPickerModal
        open={showLocationPicker}
        initial={locationCoords}
        addressHint={[form.neighborhood, form.streetName, form.buildingNo ? `No: ${form.buildingNo}` : '', form.district, form.city].filter(Boolean).join(' ') || undefined}
        onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
        onClose={() => setShowLocationPicker(false)}
      />
    </div>
  );
}
