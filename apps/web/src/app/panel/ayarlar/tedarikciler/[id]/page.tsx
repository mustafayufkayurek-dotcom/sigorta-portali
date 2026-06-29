'use client';

import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { formatVendorTypeLabel } from '@/utils/vendor-form-helpers';

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

const CATEGORIES: Record<string, string> = {
  labor: 'İşçilik',
  material: 'Malzeme',
  subcontractor: 'Taşeron',
  logistics: 'Lojistik',
  equipment: 'Ekipman',
};

type VendorTab = 'profil' | 'bolgeler' | 'is-gruplari' | 'performans' | 'gecmis' | 'evraklar';

const TABS: { id: VendorTab; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'bolgeler', label: 'Hizmet Bölgeleri' },
  { id: 'is-gruplari', label: 'İş Grupları' },
  { id: 'performans', label: 'Performans' },
  { id: 'gecmis', label: 'İş Geçmişi' },
  { id: 'evraklar', label: 'Evraklar' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/ayarlar" className="hover:text-blue-600 transition-colors">Ayarlar</a>
        <span>/</span>
        <a href="/panel/ayarlar/tedarikciler" className="hover:text-blue-600 transition-colors">Tedarikciler</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Id</span>
      </nav>

      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

// ── Profil Tab ──────────────────────────────────────────────────────────────────
function ProfilTab({ vendor }: { vendor: any }) {
  const isCorporate = vendor.entityType !== 'individual';
  const fields = isCorporate ? [
    { label: 'Şirket Adı', value: vendor.name },
    { label: 'Tür', value: formatVendorTypeLabel(vendor.type) ?? '—' },
    { label: 'Tip', value: 'Kurumsal' },
    { label: 'Vergi No', value: vendor.taxNumber ?? '—' },
    { label: 'Vergi Dairesi', value: vendor.taxOffice ?? '—' },
    { label: 'Ticaret Sicil No', value: vendor.tradeRegistryNo ?? '—' },
    { label: 'Yetkili Kişi', value: vendor.authorizedPerson ?? '—' },
    { label: 'Yetkili Telefon', value: vendor.authorizedPhone ?? '—' },
    { label: 'Yetkili E-posta', value: vendor.authorizedEmail ?? '—' },
    { label: 'Telefon', value: vendor.phone ?? '—' },
    { label: 'E-posta', value: vendor.email ?? '—' },
    { label: 'İl', value: vendor.city ?? '—' },
    { label: 'İlçe', value: vendor.district ?? '—' },
    { label: 'Adres', value: vendor.address ?? '—' },
    { label: 'IBAN', value: vendor.iban ?? '—' },
    { label: 'Banka Adı', value: vendor.bankName ?? '—' },
    { label: 'Durum', value: vendor.status === 'active' ? 'Aktif' : 'Pasif' },
    { label: 'Kayıt Tarihi', value: fmtDate(vendor.createdAt) },
  ] : [
    { label: 'Ad Soyad', value: vendor.name },
    { label: 'Tür', value: formatVendorTypeLabel(vendor.type) ?? '—' },
    { label: 'Tip', value: 'Bireysel' },
    { label: 'TC Kimlik No', value: vendor.identityNo ?? '—' },
    { label: 'Telefon', value: vendor.phone ?? '—' },
    { label: 'E-posta', value: vendor.email ?? '—' },
    { label: 'İl', value: vendor.city ?? '—' },
    { label: 'İlçe', value: vendor.district ?? '—' },
    { label: 'Adres', value: vendor.address ?? '—' },
    { label: 'IBAN', value: vendor.iban ?? '—' },
    { label: 'Banka Adı', value: vendor.bankName ?? '—' },
    { label: 'Durum', value: vendor.status === 'active' ? 'Aktif' : 'Pasif' },
    { label: 'Kayıt Tarihi', value: fmtDate(vendor.createdAt) },
  ];
  return (
    <div className="space-y-4">
      <SectionCard title="Tedarikçi Bilgileri">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800">{f.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      {vendor.notes && (
        <SectionCard title="Notlar">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{vendor.notes}</p>
        </SectionCard>
      )}
    </div>
  );
}

// ── Hizmet Bölgeleri Tab ────────────────────────────────────────────────────────
function BolgelerTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [serviceAreas, setServiceAreas] = useState<Array<{ provinceId: string; districtId: string | null }>>(
    (vendor.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/locations/provinces`, { headers: authHeader() })
      .then((r) => setProvinces(r.data.data || []))
      .catch(console.error);
  }, []);

  const loadDistricts = async (id: string) => {
    const r = await axios.get(`${API}/locations/provinces/${id}/districts`, { headers: authHeader() });
    setDistricts(r.data.data || []);
  };

  const handleSelectProvince = (id: string) => {
    const p = provinces.find((x) => x.id === id);
    setSelectedProvince(p ?? null);
    if (p) loadDistricts(p.id);
    else setDistricts([]);
  };

  const toggleArea = (provinceId: string, districtId: string | null) => {
    const key = districtId ? `${provinceId}:${districtId}` : `${provinceId}:`;
    const exists = serviceAreas.some((sa) => (sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`) === key);
    if (exists) {
      setServiceAreas((prev) => prev.filter((sa) => (sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`) !== key));
    } else {
      setServiceAreas((prev) => [...prev, { provinceId, districtId }]);
    }
  };

  const addWholeProvince = () => {
    if (!selectedProvince) return;
    setServiceAreas((prev) => [
      ...prev.filter((sa) => sa.provinceId !== selectedProvince.id),
      { provinceId: selectedProvince.id, districtId: null },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/vendors/${vendor.id}/service-areas`, { serviceAreas }, { headers: authHeader() });
      onUpdate();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const groupedAreas = provinces.filter((p) => serviceAreas.some((sa) => sa.provinceId === p.id));

  return (
    <div className="space-y-4">
      <SectionCard title="Mevcut Hizmet Bölgeleri">
        {groupedAreas.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz hizmet bölgesi eklenmemiş.</p>
        ) : (
          <div className="space-y-2">
            {groupedAreas.map((prov) => {
              const provAreas = serviceAreas.filter((sa) => sa.provinceId === prov.id);
              const isAllProv = provAreas.some((sa) => !sa.districtId);
              return (
                <div key={prov.id} className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-slate-700 w-28">{prov.name}</span>
                  <span className="text-xs text-slate-500">
                    {isAllProv ? 'Tüm İl' : `${provAreas.length} İlçe`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Bölge Ekle / Güncelle">
        <div className="flex gap-2 mb-3">
          <select
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedProvince?.id ?? ''}
            onChange={(e) => handleSelectProvince(e.target.value)}
          >
            <option value="">İl Seçin...</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProvince && (
            <button type="button" onClick={addWholeProvince} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100">
              Tüm İlçeleri Ekle
            </button>
          )}
        </div>
        {selectedProvince && districts.length > 0 && (
          <div className="max-h-32 overflow-y-auto grid grid-cols-3 gap-1 mb-3">
            {districts.map((d) => {
              const checked = serviceAreas.some((sa) => sa.provinceId === selectedProvince.id && sa.districtId === d.id);
              return (
                <label key={d.id} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer hover:text-blue-600">
                  <input type="checkbox" checked={checked} onChange={() => toggleArea(selectedProvince.id, d.id)} className="rounded" />
                  {d.name}
                </label>
              );
            })}
          </div>
        )}
        {serviceAreas.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {serviceAreas.map((sa, i) => {
              const prov = provinces.find((p) => p.id === sa.provinceId);
              const label = sa.districtId ? `${prov?.name}/${sa.districtId}` : `${prov?.name} (Tümü)`;
              return (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">
                  {label}
                  <button type="button" onClick={() => {
                    const key = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
                    setServiceAreas((prev) => prev.filter((x) => (x.districtId ? `${x.provinceId}:${x.districtId}` : `${x.provinceId}:`) !== key));
                  }} className="text-blue-400 hover:text-red-500">×</button>
                </span>
              );
            })}
          </div>
        )}
        <button type="button" onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </SectionCard>
    </div>
  );
}

// ── İş Grupları Tab ─────────────────────────────────────────────────────────────
function IsGruplariTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  const [workGroups, setWorkGroups] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    (vendor.vendorWorkGroups || []).map((vwg: any) => vwg.workGroupId)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/work-groups?limit=100`, { headers: authHeader() })
      .then((r) => setWorkGroups(r.data.data || []))
      .catch(console.error);
  }, []);

  const toggle = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/vendors/${vendor.id}/work-groups`, { workGroupIds: selectedIds }, { headers: authHeader() });
      onUpdate();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const assigned = workGroups.filter((wg) => selectedIds.includes(wg.id));

  return (
    <div className="space-y-4">
      <SectionCard title="Atanmış İş Grupları">
        {assigned.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz iş grubu atanmamış.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assigned.map((wg) => (
              <span key={wg.id} className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-3 py-1 border border-indigo-100">{wg.name}</span>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="İş Gruplarını Düzenle">
        <div className="grid grid-cols-3 gap-2 mb-4 max-h-48 overflow-y-auto">
          {workGroups.map((wg) => (
            <label key={wg.id} className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer hover:text-indigo-600">
              <input type="checkbox" checked={selectedIds.includes(wg.id)} onChange={() => toggle(wg.id)} className="rounded" />
              {wg.name}
            </label>
          ))}
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </SectionCard>
    </div>
  );
}

// ── Performans Tab ──────────────────────────────────────────────────────────────
function PerformansTab({ vendorId }: { vendorId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/vendors/${vendorId}/stats`, { headers: authHeader() })
      .then((r) => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vendorId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!stats) return <div className="text-slate-400 py-8 text-center">İstatistik bulunamadı.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-slate-900">{stats.completedJobs}</p>
          <p className="text-xs text-slate-500 mt-1">Toplam Tamamlanan İş</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.activeJobs}</p>
          <p className="text-xs text-slate-500 mt-1">Aktif İş</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-slate-400">—</p>
          <p className="text-xs text-slate-500 mt-1">Ortalama Memnuniyet</p>
        </div>
      </div>

      {stats.avgByCategory?.length > 0 && (
        <SectionCard title="Kategori Bazlı Ortalama Tutar">
          <div className="space-y-2">
            {stats.avgByCategory.map((cat: any) => (
              <div key={cat.category} className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-sm text-slate-700">{CATEGORIES[cat.category] ?? cat.category}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400">{cat._count?.id ?? 0} iş</span>
                  <span className="text-sm font-semibold text-slate-900">{fmtCurrency(cat._avg?.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Evraklar Tab ────────────────────────────────────────────────────────────────
function EvraklarTab({ vendorId }: { vendorId: string }) {
  return <EntityDocumentsTab mode="vendor" entityId={vendorId} title="Evraklar" />;
}

// ── İş Geçmişi Tab ──────────────────────────────────────────────────────────────
function GecmisTab({ vendorId: _vendorId }: { vendorId: string }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Maliyet Girişleri">
        <p className="text-sm text-slate-400">İş geçmişi görüntülemek için tedarikçiye atanmış maliyet girişlerine gidin.</p>
      </SectionCard>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<VendorTab>('profil');

  const loadVendor = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/vendors/${id}`, { headers: authHeader() });
      setVendor(r.data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadVendor(); }, [loadVendor]);

  if (loading) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;
  if (!vendor) return <div className="text-slate-400 py-16 text-center">Tedarikçi bulunamadı.</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button type="button" onClick={() => router.push('/panel/ayarlar/tedarikciler')} className="text-slate-400 hover:text-slate-700 text-sm">← Geri</button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">{vendor.name}</h2>
          <p className="text-sm text-slate-400">{formatVendorTypeLabel(vendor.type) ?? ''}{vendor.type && vendor.city ? ' · ' : ''}{vendor.city ?? ''}</p>
        </div>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {vendor.status === 'active' ? 'Aktif' : 'Pasif'}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{vendor.serviceAreas?.length ?? 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">Hizmet Bölgesi</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{vendor.vendorWorkGroups?.length ?? 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">İş Grubu</p>
        </div>
      </div>

      {/* Tedarikçi Bilgileri Bandı — tüm sekmelerde sabit */}
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${vendor.entityType !== 'individual' ? 'bg-blue-600' : 'bg-purple-600'}`}>
            {(vendor.name ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide leading-none mb-0.5">
              {vendor.entityType !== 'individual' ? 'Kurumsal Tedarikçi' : 'Bireysel Tedarikçi'}
            </p>
            <p className="text-sm font-semibold text-blue-800 truncate">{vendor.name}</p>
          </div>
        </div>
        {vendor.phone && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Telefon</p>
            <a href={`tel:${vendor.phone}`} className="text-sm font-medium text-blue-700 hover:underline">{vendor.phone}</a>
          </div>
        )}
        {vendor.email && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">E-posta</p>
            <a href={`mailto:${vendor.email}`} className="text-sm font-medium text-blue-700 hover:underline truncate">{vendor.email}</a>
          </div>
        )}
        {vendor.city && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Şehir</p>
            <p className="text-sm font-medium text-blue-700">{vendor.city}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profil' && <ProfilTab vendor={vendor} />}
      {activeTab === 'bolgeler' && <BolgelerTab vendor={vendor} onUpdate={loadVendor} />}
      {activeTab === 'is-gruplari' && <IsGruplariTab vendor={vendor} onUpdate={loadVendor} />}
      {activeTab === 'performans' && <PerformansTab vendorId={id!} />}
      {activeTab === 'gecmis' && <GecmisTab vendorId={id!} />}
      {activeTab === 'evraklar' && <EvraklarTab vendorId={id!} />}
    </div>
  );
}
