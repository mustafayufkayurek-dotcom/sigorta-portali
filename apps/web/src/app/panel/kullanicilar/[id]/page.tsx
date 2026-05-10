'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

type UserTab = 'profil' | 'bolgeler' | 'randevular' | 'ekranlar';

const TABS: { id: UserTab; label: string; adminOnly?: boolean }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'bolgeler', label: 'Hizmet Bölgeleri' },
  { id: 'randevular', label: 'Randevuları' },
  { id: 'ekranlar', label: 'Ekran İzinleri', adminOnly: true },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

// ── Profil Tab ──────────────────────────────────────────────────────────────────
function ProfilTab({ user }: { user: any }) {
  const fields = [
    { label: 'Ad', value: user.firstName },
    { label: 'Soyad', value: user.lastName },
    { label: 'E-posta', value: user.email },
    { label: 'Telefon', value: user.phone ?? '—' },
    { label: 'Rol', value: user.role?.name ?? '—' },
    { label: 'Şube', value: user.branch?.name ?? '—' },
    { label: 'Durum', value: user.isActive ? 'Aktif' : 'Pasif' },
    { label: 'Kayıt Tarihi', value: fmtDate(user.createdAt) },
  ];
  return (
    <SectionCard title="Kullanıcı Bilgileri">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-xs text-slate-400">{f.label}</p>
            <p className="text-sm font-medium text-slate-800">{f.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Hizmet Bölgeleri Tab ────────────────────────────────────────────────────────
function BolgelerTab({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [serviceAreas, setServiceAreas] = useState<Array<{ provinceId: string; districtId: string | null }>>(
    (user.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null }))
  );
  const [saving, setSaving] = useState(false);
  const [districtNames, setDistrictNames] = useState<Record<string, string>>({});

  useEffect(() => {
    axios.get(`${API}/locations/provinces`, { headers: authHeader() })
      .then((r) => setProvinces(r.data.data || []))
      .catch(console.error);
  }, []);

  // Pre-load districts for existing areas
  useEffect(() => {
    const provinceIds = [...new Set(serviceAreas.filter(sa => sa.districtId).map(sa => sa.provinceId))];
    provinceIds.forEach((pid) => {
      axios.get(`${API}/locations/provinces/${pid}/districts`, { headers: authHeader() })
        .then((r) => {
          const dists: any[] = r.data.data || [];
          const map: Record<string, string> = {};
          dists.forEach((d) => { map[d.id] = d.name; });
          setDistrictNames((prev) => ({ ...prev, ...map }));
        })
        .catch(console.error);
    });
  }, []);

  const loadDistricts = async (id: string) => {
    const r = await axios.get(`${API}/locations/provinces/${id}/districts`, { headers: authHeader() });
    const dists: any[] = r.data.data || [];
    setDistricts(dists);
    const map: Record<string, string> = {};
    dists.forEach((d) => { map[d.id] = d.name; });
    setDistrictNames((prev) => ({ ...prev, ...map }));
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
      await axios.patch(`${API}/users/${user.id}/service-areas`, { serviceAreas }, { headers: authHeader() });
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
              const districtLabels = provAreas.filter((sa) => sa.districtId).map((sa) => districtNames[sa.districtId!] ?? sa.districtId);
              return (
                <div key={prov.id} className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-slate-700 w-32 shrink-0">{prov.name}</span>
                  <span className="text-xs text-slate-500">
                    {isAllProv ? 'Tüm il' : districtLabels.join(', ')}
                  </span>
                  <button type="button"
                    onClick={() => setServiceAreas((prev) => prev.filter((sa) => sa.provinceId !== prov.id))}
                    className="ml-auto text-xs text-red-400 hover:text-red-600"
                  >
                    Kaldır
                  </button>
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
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.plateCode} - {p.name}</option>)}
          </select>
          {selectedProvince && (
            <button type="button" onClick={addWholeProvince} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100">
              Tüm İlçeleri Ekle
            </button>
          )}
        </div>
        {selectedProvince && districts.length > 0 && (
          <div className="max-h-40 overflow-y-auto grid grid-cols-3 gap-1 mb-3">
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
            {serviceAreas.map((sa) => {
              const prov = provinces.find((p) => p.id === sa.provinceId);
              const distLabel = sa.districtId ? districtNames[sa.districtId] ?? sa.districtId : null;
              const label = distLabel ? `${prov?.name} / ${distLabel}` : `${prov?.name} (Tümü)`;
              return (
                <span
                  key={`${sa.provinceId}:${sa.districtId ?? ''}`}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100"
                >
                  {label}
                  <button type="button" onClick={() => toggleArea(sa.provinceId, sa.districtId)} className="hover:text-red-500">×</button>
                </span>
              );
            })}
          </div>
        )}
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Bölgeleri Kaydet'}
        </button>
      </SectionCard>
    </div>
  );
}

// ── Randevular Tab ──────────────────────────────────────────────────────────────
const APPOINTMENT_STATUS_COLOR: Record<string, string> = {
  planned: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  planned: 'Planlandı',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const APPOINTMENT_TYPE_LABEL: Record<string, string> = {
  customer_visit: 'Sigortalı Ziyareti',
  inspection: 'Keşif',
  site_visit: 'Saha Ziyareti',
  meeting: 'Toplantı',
  other: 'Diğer',
};

function RandevularTab({ userId }: { userId: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/adjusters/appointments?assignedUserId=${userId}`, { headers: authHeader() })
      .then((r) => setAppointments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;
  if (!appointments.length) return (
    <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
      Bu Kullanıcıya Atanmış Randevu Bulunamadı
    </div>
  );

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <div key={appt.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{APPOINTMENT_TYPE_LABEL[appt.type] ?? appt.type}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APPOINTMENT_STATUS_COLOR[appt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {APPOINTMENT_STATUS_LABEL[appt.status] ?? appt.status}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {new Date(appt.scheduledAt).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              {appt.claimFile && (
                <p className="text-xs text-slate-400 mt-0.5">Dosya: {appt.claimFile.fileNo} — {appt.claimFile.claimNo}</p>
              )}
              {appt.location && <p className="text-xs text-slate-400">Konum: {appt.location}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ana Sayfa ───────────────────────────────────────────────────────────────────

// ── Ekran İzinleri Tab ──────────────────────────────────────────────────────────
const SCREEN_LABELS: Record<string, string> = {
  hasar_dosyalari:   'Hasar Dosyaları',
  acil_yardim:       'Acil Yardım',
  finans:            'Finans',
  operasyon:         'Operasyon',
  eksperler:         'Eksperler',
  musteriler:        'Müşteriler',
  tedarikciler:      'Tedarikçiler',
  raporlar:          'Raporlar',
  ayarlar:           'Ayarlar',
  kullanicilar:      'Kullanıcılar',
  guvenlik:          'Güvenlik',
  harita:            'Harita',
  personel_yonetimi: 'Personel Yönetimi',
};

type ScreenRow = {
  code: string;
  label: string;
  canView: boolean;
  canEdit: boolean;
  isDefault: boolean;
};

function EkranlarTab({ userId, roleCode }: { userId: string; roleCode: string }) {
  const [rows, setRows] = useState<ScreenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/users/${userId}/screen-permissions?roleCode=${roleCode}`, { headers: authHeader() })
      .then((r) => setRows(r.data.data?.screens ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, roleCode]);

  const toggle = (code: string, field: 'canView' | 'canEdit') => {
    setRows((prev) =>
      prev.map((r) => r.code === code ? { ...r, [field]: !r[field] } : r)
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/users/${userId}/screen-permissions`,
        { screens: rows.map((r) => ({ code: r.code, canView: r.canView, canEdit: r.canEdit })) },
        { headers: authHeader() }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <SectionCard title="Ekran Erişim İzinleri">
        <p className="text-xs text-slate-400 mb-4">
          Kullanıcının görebileceği ekranları belirleyin. Varsayılan değerler rol temellidir.
          Buradan yapılan değişiklikler rol varsayılanını ezer.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">Ekran</th>
                <th className="text-center text-xs font-semibold text-slate-500 pb-2 w-24">Görüntüle</th>
                <th className="text-center text-xs font-semibold text-slate-500 pb-2 w-24">Düzenle</th>
                <th className="text-center text-xs font-semibold text-slate-500 pb-2 w-24">Varsayılan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
                <tr key={row.code} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-slate-700">{SCREEN_LABELS[row.code] ?? row.code}</span>
                    <span className="ml-2 text-[10px] text-slate-300 font-mono">{row.code}</span>
                  </td>
                  <td className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.canView}
                      onChange={() => toggle(row.code, 'canView')}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.canEdit}
                      onChange={() => toggle(row.code, 'canEdit')}
                      disabled={!row.canView}
                      className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-30"
                    />
                  </td>
                  <td className="py-2.5 text-center">
                    {row.isDefault ? (
                      <span className="text-[11px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Varsayılan</span>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">İzinler kaydedildi.</span>
          )}
          {!saved && <span />}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Kaydediliyor...' : 'İzinleri Kaydet'}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

export default function KullaniciDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UserTab>('profil');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('user') ?? '{}';
      try { setIsAdmin((JSON.parse(raw)?.role?.code ?? '').toLowerCase() === 'admin'); } catch { /* ignore */ }
    }
  }, []);

  const loadUser = useCallback(() => {
    if (!id) return;
    setLoading(true);
    axios.get(`${API}/users/${id}`, { headers: authHeader() })
      .then((r) => setUser(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (!id || !user) return;
    axios.get(`${API}/users/${id}/service-areas`, { headers: authHeader() })
      .then((r) => setUser((prev: any) => prev ? { ...prev, serviceAreas: r.data.data } : prev))
      .catch(console.error);
  }, [id, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">Yükleniyor...</div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">Kullanıcı Bulunamadı.</div>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{user.firstName} {user.lastName}</h1>
            <p className="text-xs text-slate-400">{user.role?.name} · {user.email}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {user.isActive ? 'Aktif' : 'Pasif'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-6">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === 'profil' && <ProfilTab user={user} />}
        {activeTab === 'bolgeler' && <BolgelerTab user={user} onUpdate={loadUser} />}
        {activeTab === 'randevular' && <RandevularTab userId={id!} />}
        {activeTab === 'ekranlar' && isAdmin && (
          <EkranlarTab userId={id!} roleCode={user?.role?.code ?? ''} />
        )}
      </div>
    </div>
  );
}
