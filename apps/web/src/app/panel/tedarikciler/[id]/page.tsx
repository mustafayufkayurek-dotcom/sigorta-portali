'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DistrictCheckboxGrid } from '@/components/ui/DistrictCheckboxGrid';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import {
  addAllDistrictsInProvince,
  isDistrictAreaChecked,
  toggleDistrictArea,
} from '@/utils/service-area-helpers';
import {
  buildDepartmentCodeMap,
  filterDocumentTypesForCategory,
  findOtherDocumentTypeId,
  isOtherDocumentTypeName,
  VENDOR_DOC_OTHER_SELECT,
  VENDOR_RELATION_SECTION_TITLE,
  formatVendorTypeLabel,
  type VendorCategory,
  type VendorDocumentTypeRow,
} from '@/utils/vendor-form-helpers';
import { CardNotesDisplay } from '@/components/card-notes/CardNotesDisplay';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';


function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

const CATEGORIES: Record<string, string> = {
  labor: 'İşçilik', material: 'Malzeme', subcontractor: 'Taşeron',
  logistics: 'Lojistik', equipment: 'Ekipman',
};
const SOURCE_LABEL: Record<string, string> = {
  referral: 'Referans', web: 'Web', direct: 'Doğrudan', other: 'Diğer',
};
const CONTACT_TYPE_ICON: Record<string, string> = {
  phone: '📞', email: '✉', fax: '🖷', whatsapp: '💬',
};
const CONTACT_LABEL: Record<string, string> = {
  general: 'Genel', work: 'İş', personal: 'Kişisel',
};

type VendorTab = 'profil' | 'yetkili-iletisim' | 'hizmet-kapsam' | 'performans' | 'evraklar' | 'odemeler';

const TABS: { id: VendorTab; label: string; icon: string }[] = [
  { id: 'profil', label: 'Genel Bakış', icon: '👤' },
  { id: 'hizmet-kapsam', label: 'Hizmet Kapsamı', icon: '🗺' },
  { id: 'evraklar', label: 'Evraklar', icon: '📄' },
  { id: 'odemeler', label: 'Finans', icon: '💰' },
];

// ── Shared ────────────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-400 tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

function Badge({ variant, children }: { variant: 'green' | 'gray' | 'indigo' | 'purple' | 'amber' | 'blue' | 'red'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-green-50 text-green-700 border-green-100',
    gray: 'bg-slate-100 text-slate-500 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }[variant];
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>{children}</span>;
}

// ── Profil Tab ────────────────────────────────────────────────────────────────
function ProfilTab({ vendor }: { vendor: any }) {
  const isCorporate = vendor.entityType !== 'individual';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Temel Bilgiler */}
        <SectionCard title="Temel Bilgiler" subtitle={isCorporate ? 'Kurumsal profil' : 'Bireysel profil'}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {isCorporate ? (
              <>
                <InfoRow label="Şirket Adı" value={vendor.name} className="col-span-2" />
                <InfoRow label="Vergi No" value={vendor.taxNumber} />
                <InfoRow label="Vergi Dairesi" value={vendor.taxOffice} />
                <InfoRow label="Ticaret Sicil No" value={vendor.tradeRegistryNo} />
                <InfoRow label="Tedarikçi Türü" value={formatVendorTypeLabel(vendor.type)} />
              </>
            ) : (
              <>
                <InfoRow label="Ad Soyad" value={vendor.name} className="col-span-2" />
                <InfoRow label="TC Kimlik No" value={vendor.identityNo} />
                <InfoRow label="Tedarikçi Türü" value={formatVendorTypeLabel(vendor.type)} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Adres & İletişim */}
        <SectionCard title="Adres & Konum">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="İl" value={vendor.city} />
            <InfoRow label="İlçe" value={vendor.district} />
            <InfoRow label="Adres" value={vendor.address} className="col-span-2" />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banka */}
        <SectionCard title="Banka Bilgileri">
          <div className="grid grid-cols-1 gap-y-4">
            <InfoRow label="IBAN" value={vendor.iban ? (
              <span className="font-mono text-sm bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-700">{vendor.iban}</span>
            ) : null} />
            <InfoRow label="Banka" value={vendor.bankName} />
          </div>
        </SectionCard>

        {/* İlişki Özeti */}
        <SectionCard title={VENDOR_RELATION_SECTION_TITLE} subtitle="Kayıt anı ilişki bilgileri">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Kaynak" value={vendor.source ? SOURCE_LABEL[vendor.source] ?? vendor.source : null} />
            <InfoRow label="Durum" value={
              <Badge variant={vendor.status === 'active' ? 'green' : 'gray'}>
                {vendor.status === 'active' ? '● Aktif' : '● Pasif'}
              </Badge>
            } />
            {Array.isArray(vendor.tags) && vendor.tags.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-400 tracking-wide mb-2">Etiketler</p>
                <div className="flex flex-wrap gap-1.5">
                  {vendor.tags.map((t: string) => <Badge key={t} variant="amber">{t}</Badge>)}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Kart Notları" subtitle="Kayıt ve düzenleme sırasında girilen numaralı notlar">
        <CardNotesDisplay notesRaw={vendor.notes} />
      </SectionCard>
    </div>
  );
}

// ── Yetkili & İletişim Tab ────────────────────────────────────────────────────
function YetkiliIletisimTab({ vendor }: { vendor: any }) {
  const contacts: any[] = vendor.contacts || [];
  const contactInfos: any[] = vendor.contactInfos || [];
  const today = new Date();

  return (
    <div className="space-y-4">
      <SectionCard title="Birincil İletişim Bilgileri">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Telefon" value={vendor.phone ? (
            <PhoneContactActions phone={vendor.phone} variant="inline" accent="indigo" />
          ) : null} />
          <InfoRow label="E-posta" value={vendor.email ? (
            <a href={`mailto:${vendor.email}`} className="text-indigo-600 hover:underline">{vendor.email}</a>
          ) : null} />
        </div>
      </SectionCard>

      <SectionCard title="Yetkili Kişiler" subtitle={`${contacts.length} kişi kayıtlı`}>
        {contacts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-slate-500 font-medium text-sm">Yetkili Kişi Eklenmemiş</p>
            <p className="text-xs text-slate-400 mt-1">Düzenle panelinden yetkili kişi ekleyebilirsiniz</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c: any, i: number) => {
              const isBirthday = c.birthDate && (() => {
                const bd = new Date(c.birthDate);
                return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
              })();
              return (
                <div key={c.id ?? i} className={`flex items-start justify-between p-4 rounded-xl border transition-colors ${isBirthday ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${c.isPrimary ? 'bg-indigo-600' : 'bg-slate-400'}`}>
                      {(c.fullName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{c.fullName}</p>
                        {c.isPrimary && <Badge variant="indigo">Birincil</Badge>}
                        {isBirthday && <Badge variant="amber">🎂 Bugün Doğum Günü!</Badge>}
                      </div>
                      {c.title && <p className="text-xs text-slate-500 mt-0.5">{c.title}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {c.phone && <PhoneContactActions phone={c.phone} variant="inline" accent="indigo" size="sm" />}
                        {c.email && <a href={`mailto:${c.email}`} className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1">✉ {c.email}</a>}
                        {c.birthDate && <p className="text-xs text-slate-400">🎂 {fmtDate(c.birthDate)}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Ek İletişim Kanalları" subtitle={`${contactInfos.length} kayıtlı kanal`}>
        {contactInfos.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Ek İletişim Kanalı Eklenmemiş.</p>
        ) : (
          <div className="space-y-2">
            {contactInfos.map((ci: any, i: number) => (
              <div key={ci.id ?? i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{CONTACT_TYPE_ICON[ci.type] ?? '📞'}</span>
                  <div>
                    {(ci.type === 'phone' || ci.type === 'whatsapp') ? (
                      <PhoneContactActions phone={ci.value} variant="inline" accent="indigo" size="sm" />
                    ) : ci.type === 'email' ? (
                      <a href={`mailto:${ci.value}`} className="text-sm font-medium text-indigo-600 hover:underline">{ci.value}</a>
                    ) : (
                      <p className="text-sm font-medium text-slate-800">{ci.value}</p>
                    )}
                    <p className="text-xs text-slate-400 capitalize">{CONTACT_LABEL[ci.label] ?? ci.label}</p>
                  </div>
                </div>
                <Badge variant="indigo">{ci.type === 'phone' ? 'Telefon' : ci.type === 'email' ? 'E-posta' : ci.type === 'fax' ? 'Faks' : 'WhatsApp'}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Hizmet Kapsamı Tab (Bölgeler + İş Grupları) ───────────────────────────────
function HizmetKapsamTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  return (
    <div className="space-y-4">
      <BolgelerTab vendor={vendor} onUpdate={onUpdate} />
      <IsGruplariTab vendor={vendor} onUpdate={onUpdate} />
    </div>
  );
}

// ── Hizmet Bölgeleri Tab ──────────────────────────────────────────────────────
function BolgelerTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [districts, setDistricts] = useState<any[]>([]);
  const [districtCache, setDistrictCache] = useState<Map<string, { id: string; name: string }[]>>(new Map());
  const [serviceAreas, setServiceAreas] = useState<Array<{ provinceId: string; districtId: string | null }>>(
    (vendor.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null })),
  );
  const [saving, setSaving] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    axios.get(`${API}/locations/provinces`, { headers: authHeader() })
      .then((r) => setProvinces(r.data.data || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setServiceAreas(
      (vendor.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null })),
    );
  }, [vendor.id, vendor.serviceAreas]);

  useEffect(() => {
    const cache = new Map<string, { id: string; name: string }[]>();
    for (const sa of vendor.serviceAreas ?? []) {
      if (sa.district && sa.provinceId) {
        const list = cache.get(sa.provinceId) ?? [];
        if (!list.some((d) => d.id === sa.district.id)) {
          cache.set(sa.provinceId, [...list, { id: sa.district.id, name: sa.district.name }]);
        }
      }
    }
    if (cache.size > 0) {
      setDistrictCache((prev) => {
        const next = new Map(prev);
        cache.forEach((v, k) => {
          const merged = [...(next.get(k) ?? [])];
          v.forEach((d) => { if (!merged.some((x) => x.id === d.id)) merged.push(d); });
          next.set(k, merged);
        });
        return next;
      });
    }
  }, [vendor.serviceAreas]);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  const loadDistricts = async (provinceId: string) => {
    const cached = districtCache.get(provinceId);
    if (cached) {
      setDistricts(cached);
      return;
    }
    setLoadingDistricts(true);
    try {
      const r = await axios.get(`${API}/locations/provinces/${provinceId}/districts`, { headers: authHeader() });
      const data: { id: string; name: string }[] = r.data.data || [];
      setDistrictCache((prev) => new Map(prev).set(provinceId, data));
      setDistricts(data);
    } catch (e) {
      console.error(e);
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const onProvinceChange = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    if (provinceId) loadDistricts(provinceId);
    else setDistricts([]);
  };

  const toggleArea = (provinceId: string, districtId: string | null) => {
    if (districtId) {
      setServiceAreas((p) =>
        toggleDistrictArea(p, provinceId, districtId, districts, selectedProvince?.name),
      );
      return;
    }
    const key = `${provinceId}:`;
    const exists = serviceAreas.some((sa) => !sa.districtId && `${sa.provinceId}:` === key);
    if (exists) {
      setServiceAreas((p) => p.filter((sa) => sa.districtId || `${sa.provinceId}:` !== key));
    } else {
      setServiceAreas((p) => [...p, { provinceId, districtId: null }]);
    }
  };

  const addAllDistrictsForProvince = () => {
    if (!selectedProvinceId || districts.length === 0) return;
    setServiceAreas((p) =>
      addAllDistrictsInProvince(p, selectedProvinceId, districts, selectedProvince?.name),
    );
  };

  const removeArea = (sa: { provinceId: string; districtId: string | null }) => {
    const key = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
    setServiceAreas((p) => p.filter((x) => (x.districtId ? `${x.provinceId}:${x.districtId}` : `${x.provinceId}:`) !== key));
  };

  const areaLabel = (sa: { provinceId: string; districtId: string | null }) => {
    const prov = provinces.find((p) => p.id === sa.provinceId);
    const fromVendor = (vendor.serviceAreas ?? []).find(
      (v: any) => v.provinceId === sa.provinceId && (v.districtId ?? null) === sa.districtId,
    );
    const provName = prov?.name ?? fromVendor?.province?.name ?? 'İl';
    if (!sa.districtId) return `${provName} · Tüm ilçeler`;
    const dist = districtCache.get(sa.provinceId)?.find((d) => d.id === sa.districtId)
      ?? fromVendor?.district;
    return `${provName} / ${dist?.name ?? 'İlçe'}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/vendors/${vendor.id}/service-areas`, { serviceAreas }, { headers: authHeader() });
      onUpdate();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const selectedProvince = provinces.find((p) => p.id === selectedProvinceId);

  return (
    <SectionCard title="Hizmet Bölgeleri" subtitle={`${serviceAreas.length} bölge tanımlı`}>
      {serviceAreas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {serviceAreas.map((sa, i) => (
            <span
              key={`${sa.provinceId}-${sa.districtId ?? 'all'}-${i}`}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 rounded-full pl-2.5 pr-1.5 py-1 border border-blue-100"
            >
              <span className="max-w-[12rem] truncate">{areaLabel(sa)}</span>
              <button
                type="button"
                onClick={() => removeArea(sa)}
                className="w-4 h-4 flex items-center justify-center rounded-full text-blue-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label="Kaldır"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-4">Henüz hizmet bölgesi eklenmemiş. Aşağıdan il seçerek başlayın.</p>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="text-xs font-medium text-slate-600 mb-3">Bölge ekle</p>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-52 flex-shrink-0 space-y-2">
            <label className="block text-[11px] text-slate-500">İl</label>
            <SearchableSelect
              options={provinceOptions}
              value={selectedProvinceId}
              onChange={onProvinceChange}
              placeholder={ADDRESS_FIELD.provinceSearchPlaceholder}
              emptyText={ADDRESS_FIELD.provinceSearchEmpty}
              inputClassName="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {selectedProvince && (
              <button
                type="button"
                onClick={addAllDistrictsForProvince}
                className="w-full text-xs font-medium text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
              >
                Tüm ilçeleri ekle
              </button>
            )}
          </div>

          {selectedProvince ? (
            <div className="flex-1 min-w-0 w-full">
              <p className="text-[11px] text-slate-500 mb-2">
                {loadingDistricts ? 'İlçeler yükleniyor…' : `${selectedProvince.name} — ilçe seçin (isteğe bağlı)`}
              </p>
              {!loadingDistricts && districts.length > 0 && (
                <DistrictCheckboxGrid
                  districts={districts}
                  loading={loadingDistricts}
                  isChecked={(districtId) => isDistrictAreaChecked(serviceAreas, selectedProvinceId, districtId)}
                  onToggle={(districtId) => toggleArea(selectedProvinceId, districtId)}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0 hidden sm:flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50 px-4 py-6">
              <p className="text-xs text-slate-400 text-center">İl seçildiğinde ilçeler burada listelenir.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 mt-1 border-t border-slate-50">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </SectionCard>
  );
}

// ── İş Grupları Tab ───────────────────────────────────────────────────────────
function IsGruplariTab({ vendor, onUpdate }: { vendor: any; onUpdate: () => void }) {
  const [workGroups, setWorkGroups] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    (vendor.vendorWorkGroups || []).map((vwg: any) => vwg.workGroupId)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/work-groups?limit=100`, { headers: authHeader() })
      .then((r) => setWorkGroups(r.data.data || [])).catch(console.error);
  }, []);

  const toggle = (id: string) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

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
          <p className="text-sm text-slate-400 text-center py-4">Henüz İş Grubu Atanmamış.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assigned.map((wg) => (
              <Badge key={wg.id} variant="indigo">⚙ {wg.name}</Badge>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="İş Gruplarını Güncelle">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5 max-h-48 overflow-y-auto">
          {workGroups.map((wg) => (
            <label key={wg.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${selectedIds.includes(wg.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200'}`}>
              <input type="checkbox" checked={selectedIds.includes(wg.id)} onChange={() => toggle(wg.id)} className="rounded accent-indigo-600" />
              {wg.name}
            </label>
          ))}
        </div>
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </SectionCard>
    </div>
  );
}

// ── Performans Göstergeleri (sayfa üstü) ─────────────────────────────────────
function VendorPerformanceStats({ vendorId }: { vendorId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/vendors/${vendorId}/stats`, { headers: authHeader() })
      .then((r) => setStats(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, [vendorId]);

  const metrics = [
    { label: 'Tamamlanan İş', value: stats?.completedJobs ?? 0, color: 'text-slate-900' },
    { label: 'Aktif İş', value: stats?.activeJobs ?? 0, color: 'text-indigo-600' },
    { label: 'Memnuniyet', value: '—', color: 'text-slate-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {metrics.map((m) => (
        <div key={m.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5 text-center">
          {loading ? (
            <>
              <div className="h-8 w-10 bg-slate-100 rounded mx-auto animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded mx-auto mt-2 animate-pulse" />
            </>
          ) : (
            <>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Performans Tab ────────────────────────────────────────────────────────────
function PerformansTab({ vendorId }: { vendorId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/vendors/${vendorId}/stats`, { headers: authHeader() })
      .then((r) => setStats(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, [vendorId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Yükleniyor...</div>;
  if (!stats) return <div className="text-slate-400 py-12 text-center">İstatistik Bulunamadı.</div>;

  if (!stats.avgByCategory?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-400">Kategori bazlı detay henüz oluşmadı.</p>
        <p className="text-xs text-slate-300 mt-1">Özet göstergeler sayfa üstünde görüntülenir.</p>
      </div>
    );
  }

  return (
    <SectionCard title="Kategori Bazlı Ortalama Tutar">
      <div className="space-y-2">
        {stats.avgByCategory.map((cat: any) => (
          <div key={cat.category} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-sm text-slate-700">{CATEGORIES[cat.category] ?? cat.category}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">{cat._count?.id ?? 0} iş</span>
              <span className="text-sm font-semibold text-slate-900">{fmtCurrency(cat._avg?.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

void ProfilTab;
void YetkiliIletisimTab;
void VendorPerformanceStats;
void PerformansTab;

function fmtHours(value: number | null | undefined) {
  if (value == null) return '—';
  if (value < 24) return `${value.toFixed(value % 1 === 0 ? 0 : 1)} sa`;
  const days = value / 24;
  return `${days.toFixed(days % 1 === 0 ? 0 : 1)} gün`;
}

function fmtPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `%${value}`;
}

function fmtScore(value: number | null | undefined) {
  if (value == null) return 'Veri bekleniyor';
  return `${value.toFixed(1)} / 5`;
}

function scoreTone(value: number | null | undefined) {
  if (value == null) return 'text-slate-400';
  if (value >= 4.5) return 'text-green-700';
  if (value >= 3.5) return 'text-amber-700';
  return 'text-red-600';
}

function resolveWhatsappValue(vendor: any) {
  const contactInfo = (vendor.contactInfos || []).find((info: any) => info.type === 'whatsapp')?.value;
  return contactInfo || vendor.authorizedPhone || vendor.phone || null;
}

function resolveServiceTypeSummary(vendor: any) {
  const workGroups = (vendor.vendorWorkGroups || []).map((row: any) => row.workGroup?.name).filter(Boolean);
  const branches = Array.isArray(vendor.serviceBranches) ? vendor.serviceBranches.filter(Boolean) : [];
  return [...new Set([...workGroups, ...branches])];
}

function OverviewMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function QualityMetric({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-base font-semibold ${scoreTone(value)}`}>{fmtScore(value)}</p>
    </div>
  );
}

function ChatArchivePreviewModal({
  archive,
  selfSender,
  onSelfSenderChange,
  onClose,
}: {
  archive: any;
  selfSender: string;
  onSelfSenderChange: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{archive.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{archive.messageCount ?? 0} mesaj</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
              value={selfSender}
              onChange={(e) => onSelfSenderChange(e.target.value)}
            >
              {Array.from(new Set<string>((archive.parsedMessages || []).map((msg: any) => String(msg.sender || 'Bilinmeyen')))).map((sender) => (
                <option key={sender} value={sender}>{sender}</option>
              ))}
            </select>
            <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">Kapat</button>
          </div>
        </div>
        <div className="space-y-1 overflow-y-auto bg-slate-50 p-4">
          {(archive.parsedMessages || []).map((msg: any, index: number) => (
            <div key={`${msg.timestamp}-${index}`} className={`flex ${msg.sender === selfSender ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${msg.sender === selfSender ? 'bg-green-100 text-slate-800' : 'border border-slate-100 bg-white text-slate-700'}`}>
                {msg.sender !== selfSender ? (
                  <p className="mb-0.5 text-[11px] font-semibold text-green-700">{msg.sender}</p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm">{msg.mediaRef ? 'Medya dosyası' : msg.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleString('tr-TR') : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenelBakisTab({ vendor, vendorId }: { vendor: any; vendorId: string }) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [historyQuery, setHistoryQuery] = useState('');
  const [selectedArchive, setSelectedArchive] = useState<any>(null);
  const [selfSender, setSelfSender] = useState('');
  const serviceTypes = resolveServiceTypeSummary(vendor);
  const whatsappValue = resolveWhatsappValue(vendor);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/vendors/${vendorId}/profile-overview`, { headers: authHeader() });
      setOverview(response.data.data);
    } catch (error) {
      console.error(error);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const openArchive = useCallback(async (archiveId: string) => {
    try {
      const response = await axios.get(`${API}/chat-archives/${archiveId}`, { headers: authHeader() });
      const detail = response.data.data;
      setSelectedArchive(detail);
      setSelfSender(detail?.parsedMessages?.[0]?.sender ?? '');
    } catch (error) {
      console.error(error);
    }
  }, []);

  const filteredHistory = (overview?.fileHistory || []).filter((row: any) => {
    const haystack = [
      row.fileNo,
      row.claimNo,
      row.insuredName,
      row.serviceType,
      row.insuranceCompanyName,
      row.city,
      row.district,
      row.status?.name,
    ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    return haystack.includes(historyQuery.trim().toLocaleLowerCase('tr-TR'));
  });

  const highlightedCost = (overview?.costSummary || []).slice(0, 6);
  const operation = overview?.operationSummary;
  const quality = overview?.qualitySummary;
  const latestFileHistory = (overview?.fileHistory || []).slice(0, 8);
  const whatsappHistory = (overview?.whatsappHistory || []).slice(0, 8);
  const coverageAreas = vendor.serviceAreas || [];
  const decisionSummary = [
    operation?.successRate != null ? `Başarılı tamamlama oranı ${fmtPercent(operation.successRate)}` : null,
    operation?.avgResponseTimeHours != null ? `ortalama müdahale ${fmtHours(operation.avgResponseTimeHours)}` : null,
    highlightedCost[0]?.serviceType ? `en yoğun hizmet ${highlightedCost[0].serviceType}` : null,
    quality?.recommendRate != null ? `yeniden tercih oranı ${fmtPercent(quality.recommendRate)}` : null,
  ].filter(Boolean).join(', ');

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-400">Profil özeti yükleniyor...</div>;
  }

  return (
    <div className="space-y-5">
      {selectedArchive ? (
        <ChatArchivePreviewModal
          archive={selectedArchive}
          selfSender={selfSender}
          onSelfSenderChange={setSelfSender}
          onClose={() => setSelectedArchive(null)}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Genel Bilgiler" subtitle="Karar için gereken temel tedarikçi bilgileri">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow label="Firma Adı" value={vendor.name} />
            <InfoRow label="Yetkili" value={vendor.authorizedPerson} />
            <InfoRow label="Telefon" value={vendor.phone ? <PhoneContactActions phone={vendor.phone} variant="inline" accent="indigo" /> : null} />
            <InfoRow label="WhatsApp" value={whatsappValue ? <PhoneContactActions phone={whatsappValue} variant="inline" accent="emerald" /> : null} />
            <InfoRow label="E-posta" value={vendor.email ? <a href={`mailto:${vendor.email}`} className="text-indigo-600 hover:underline">{vendor.email}</a> : null} />
            <InfoRow label="Yetkili E-posta" value={vendor.authorizedEmail ? <a href={`mailto:${vendor.authorizedEmail}`} className="text-indigo-600 hover:underline">{vendor.authorizedEmail}</a> : null} />
            <InfoRow label="Vergi Bilgileri" value={[vendor.taxOffice, vendor.taxNumber].filter(Boolean).join(' · ')} />
            <InfoRow label="Banka Bilgileri" value={[vendor.bankName, vendor.iban].filter(Boolean).join(' · ')} />
            <InfoRow label="Hizmet Bölgeleri" value={coverageAreas.length ? `${coverageAreas.length} bölge tanımlı` : 'Henüz tanımlı değil'} />
            <InfoRow label="Hizmet Türleri" value={serviceTypes.length ? serviceTypes.join(', ') : 'Henüz tanımlı değil'} />
          </div>
        </SectionCard>

        <SectionCard title="Karar Özeti" subtitle="İlk bakışta operasyon resmi">
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-sm font-semibold text-indigo-900">
                {decisionSummary || 'Yeterli operasyon verisi oluştukça bu özet otomatik zenginleşir.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <OverviewMetricCard label="Toplam Operasyon" value={operation?.totalOperations ?? '—'} />
              <OverviewMetricCard label="Başarılı Oran" value={fmtPercent(operation?.successRate)} />
              <OverviewMetricCard label="Son Operasyon" value={operation?.lastOperation?.referenceNo ?? '—'} hint={operation?.lastOperation?.completedAt ? fmtDate(operation.lastOperation.completedAt) : undefined} />
              <OverviewMetricCard label="Şikayet Sayısı" value={operation?.complaintCount ?? '—'} />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Operasyon Özeti" subtitle="Hız, tamamlama ve tekrar çalışma görünümü">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetricCard label="Toplam Operasyon" value={operation?.totalOperations ?? '—'} />
          <OverviewMetricCard label="Ortalama Müdahale Süresi" value={fmtHours(operation?.avgResponseTimeHours)} />
          <OverviewMetricCard label="Ortalama Tamamlama Süresi" value={fmtHours(operation?.avgCompletionTimeHours)} />
          <OverviewMetricCard label="Tekrar Çalışma Oranı" value={fmtPercent(operation?.repeatWorkRate)} hint="Aynı kurumdan tekrar gelen işler" />
          <OverviewMetricCard label="Şikayet Sayısı" value={operation?.complaintCount ?? '—'} />
          <OverviewMetricCard label="Başarılı Operasyon Oranı" value={fmtPercent(operation?.successRate)} />
          <OverviewMetricCard label="Tamamlanan Operasyon" value={operation?.completedOperations ?? '—'} />
          <OverviewMetricCard label="Aktif Operasyon" value={operation?.activeOperations ?? '—'} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Maliyet Özeti" subtitle="Son 12 aydaki hizmet bazlı maliyet görünümü">
          {highlightedCost.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Henüz maliyet geçmişi oluşmadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Hizmet</th>
                    <th className="pb-3 pr-4 font-medium">Min</th>
                    <th className="pb-3 pr-4 font-medium">Ort.</th>
                    <th className="pb-3 pr-4 font-medium">Maks</th>
                    <th className="pb-3 pr-4 font-medium">Son</th>
                    <th className="pb-3 font-medium">Adet</th>
                  </tr>
                </thead>
                <tbody>
                  {highlightedCost.map((row: any) => (
                    <tr key={row.serviceType} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-800">{row.serviceType}</td>
                      <td className="py-3 pr-4 text-slate-600">{fmtCurrency(row.minCost)}</td>
                      <td className="py-3 pr-4 text-slate-600">{fmtCurrency(row.avgCost)}</td>
                      <td className="py-3 pr-4 text-slate-600">{fmtCurrency(row.maxCost)}</td>
                      <td className="py-3 pr-4 text-slate-900">{fmtCurrency(row.lastCost)}</td>
                      <td className="py-3 text-slate-500">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Hizmet Kalitesi" subtitle="Anket ve kapanan iş verilerinden oluşur">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QualityMetric label="Genel Memnuniyet" value={quality?.overallSatisfaction} />
            <QualityMetric label="Zamanında Müdahale" value={quality?.onTimeIntervention} />
            <QualityMetric label="İletişim Kalitesi" value={quality?.communicationQuality} />
            <QualityMetric label="Fotoğraf Kalitesi" value={quality?.photoQuality} />
            <QualityMetric label="Evrak Kalitesi" value={quality?.documentQuality} />
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Tekrar Tercih Oranı</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{fmtPercent(quality?.recommendRate)}</p>
              <p className="mt-1 text-xs text-slate-400">{quality?.responseCount ? `${quality.responseCount} yanıt üzerinden` : 'Henüz anket yanıtı yok'}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Hizmet Kapsamı" subtitle="İl, ilçe ve hizmet yoğunluğu görünümü">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">Bölge Görünümü</p>
            {coverageAreas.length === 0 ? (
              <p className="text-sm text-slate-400">Henüz hizmet bölgesi tanımlı değil.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {coverageAreas.map((area: any, index: number) => (
                  <div key={`${area.provinceId}-${area.districtId ?? 'all'}-${index}`} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-800">{area.province?.name ?? 'İl'}</p>
                    <p className="mt-1 text-xs text-slate-500">{area.district?.name ?? 'Tüm İlçeler'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="mb-3 text-xs font-medium text-slate-500">Hizmet Türleri</p>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.length ? serviceTypes.map((item) => (
                  <Badge key={item} variant="indigo">{item}</Badge>
                )) : <span className="text-sm text-slate-400">Henüz tanımlı değil.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="mb-3 text-xs font-medium text-slate-500">Kısa Not</p>
              <p className="text-sm text-slate-600">
                {coverageAreas.length
                  ? `${coverageAreas.length} farklı bölgede hizmet veriyor. Karar verirken iş türü ile bölgeyi birlikte değerlendirin.`
                  : 'Bölge tanımı eklenirse atama kararları daha hızlı netleşir.'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Dosya Geçmişi" subtitle="Bu tedarikçinin tamamladığı ve üstlendiği dosyalar">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="Dosya no, hizmet, müşteri veya il ara..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:max-w-sm"
          />
          <p className="text-xs text-slate-400">{filteredHistory.length} kayıt</p>
        </div>
        {filteredHistory.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Filtreye uygun dosya bulunamadı.</p>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((row: any) => (
              <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{row.fileNo}</p>
                    <Badge variant={row.status?.isClosedState ? 'green' : 'blue'}>{row.status?.name ?? 'Durum Yok'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{row.serviceType || 'Hizmet tipi yok'}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {[row.insuranceCompanyName, row.insuredName, row.city, row.district].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{row.closedAt ? `Kapanış: ${fmtDate(row.closedAt)}` : `Güncelleme: ${fmtDate(row.updatedAt)}`}</span>
                  <Link href={`/panel/hasar-dosyalari/${row.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-white">
                    Dosyaya Git
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="WhatsApp Geçmişi" subtitle="Yazışmalar ve belge gönderimleri dosya bazında görünür">
        {whatsappHistory.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Henüz WhatsApp geçmişi oluşmadı.</p>
        ) : (
          <div className="space-y-2">
            {whatsappHistory.map((item: any) => (
              <div key={`${item.type}-${item.id}`} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.fileNo ? `Dosya ${item.fileNo}` : 'Dosya bağlantısı'}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.type === 'chat_archive' ? item.label : `${item.label} gönderimi`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {[item.sentAt ? new Date(item.sentAt).toLocaleString('tr-TR') : null, item.contact, item.messageCount ? `${item.messageCount} mesaj` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.type === 'chat_archive' ? (
                    <button
                      type="button"
                      onClick={() => openArchive(item.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Yazışmayı Aç
                    </button>
                  ) : null}
                  {item.claimFileId ? (
                    <Link href={`/panel/hasar-dosyalari/${item.claimFileId}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                      Dosyaya Git
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {latestFileHistory.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">Yakın Dosyalar</p>
            <div className="flex flex-wrap gap-2">
              {latestFileHistory.map((row: any) => (
                <Link key={row.id} href={`/panel/hasar-dosyalari/${row.id}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                  {row.fileNo}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

// ── Evrak Önizleme Modalı ─────────────────────────────────────────────────────
function DocPreviewModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const ext = (doc.fileExtension ?? '').replace('.', '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const downloadUrl = `${API}/vendor-documents/${doc.id}/download`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{doc.fileName}</p>
            {doc.documentType?.name && (
              <p className="text-xs text-slate-400 mt-0.5">{doc.documentType.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <a href={downloadUrl} target="_blank" rel="noreferrer"
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
              İndir
            </a>
            <button type="button" onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-50 min-h-0">
          {isImage ? (
            <img
              src={downloadUrl}
              alt={doc.fileName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
            />
          ) : isPdf ? (
            <iframe
              src={`${downloadUrl}#view=FitH`}
              title={doc.fileName}
              className="w-full h-full min-h-[60vh] rounded-lg border border-slate-100"
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-slate-500 text-lg font-bold">{ext.toUpperCase() || 'DOC'}</span>
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">{doc.fileName}</p>
              <p className="text-xs text-slate-400 mb-4">Bu dosya türü tarayıcıda önizlenemiyor.</p>
              <a href={downloadUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Dosyayı İndir
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Evraklar Tab ──────────────────────────────────────────────────────────────
function EvraklarTab({ vendorId, vendorCategory }: { vendorId: string; vendorCategory: VendorCategory }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<VendorDocumentTypeRow[]>([]);
  const [deptCodeById, setDeptCodeById] = useState<Map<string, string>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [customType, setCustomType] = useState('');
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTypes = filterDocumentTypesForCategory(documentTypes, vendorCategory, deptCodeById);
  const otherDocumentTypeId = findOtherDocumentTypeId(documentTypes, vendorCategory, deptCodeById);
  const otherSelected = selectedTypeId === VENDOR_DOC_OTHER_SELECT
    || (!!otherDocumentTypeId && selectedTypeId === otherDocumentTypeId)
    || isOtherDocumentTypeName(filteredTypes.find((dt) => dt.id === selectedTypeId)?.name ?? '');

  const loadDocuments = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/vendors/${vendorId}/documents`, { headers: authHeader() });
      setDocuments(r.data.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [vendorId]);

  useEffect(() => {
    loadDocuments();
    axios.get(`${API}/document-types`, { params: { status: 'active', entityScope: 'vendor' }, headers: authHeader() })
      .then((r) => setDocumentTypes(r.data.data ?? []))
      .catch(() => setDocumentTypes([]));
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => setDeptCodeById(buildDepartmentCodeMap((r.data.data ?? []) as { id: string; code: string }[])))
      .catch(() => setDeptCodeById(new Map()));
  }, [loadDocuments]);

  const canUpload = !!selectedTypeId && (!otherSelected || (!!customType.trim() && !!otherDocumentTypeId));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTypeId) return;
    const isManualOther = selectedTypeId === VENDOR_DOC_OTHER_SELECT
      || isOtherDocumentTypeName(filteredTypes.find((dt) => dt.id === selectedTypeId)?.name ?? '');
    const customLabel = isManualOther ? customType.trim() : '';
    if (isManualOther && !customLabel) return;
    const typeId = selectedTypeId === VENDOR_DOC_OTHER_SELECT ? otherDocumentTypeId : selectedTypeId;
    if (!typeId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('documentTypeId', typeId);
      if (customLabel) fd.append('customLabel', customLabel);
      await axios.post(`${API}/vendors/${vendorId}/documents`, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      loadDocuments();
      setSelectedTypeId('');
      setCustomType('');
    } catch (e: any) { alert(e.response?.data?.message ?? 'Yükleme başarısız'); }
    finally { setUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`"${fileName}" evrakını silmek istediğinizden emin misiniz?`)) return;
    try { await axios.delete(`${API}/vendor-documents/${docId}`, { headers: authHeader() }); loadDocuments(); }
    catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getExt = (doc: any) => (doc.fileExtension ?? '').replace('.', '').toLowerCase();
  const isImage = (doc: any) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getExt(doc));
  const isPdf = (doc: any) => getExt(doc) === 'pdf';

  if (loading) return <div className="text-slate-400 py-12 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <SectionCard title="Evrak Yükle">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Evrak Türü *</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={selectedTypeId}
                onChange={(e) => { setSelectedTypeId(e.target.value); setCustomType(''); }}>
                <option value="">Seçin...</option>
                {filteredTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}{dt.isRequired ? ' *' : ''}</option>
                ))}
                {!filteredTypes.some((dt) => isOtherDocumentTypeName(dt.name)) && (
                  <option value={VENDOR_DOC_OTHER_SELECT}>Diğer</option>
                )}
              </select>
              {otherSelected && (
                <input
                  className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="Evrak türünü yazın..."
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              )}
            </div>
            <div className="flex-shrink-0">
              <input type="file" ref={fileInputRef} className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload} disabled={!canUpload || uploading} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canUpload || uploading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap font-medium">
                {uploading ? 'Yükleniyor...' : 'Dosya Seç ve Yükle'}
              </button>
            </div>
          </div>
          {otherSelected && !otherDocumentTypeId && (
            <p className="text-xs text-amber-600">Ayarlarda &quot;Diğer&quot; evrak türü tanımlı değil.</p>
          )}
          {filteredTypes.length === 0 && !otherDocumentTypeId && (
            <p className="text-xs text-amber-600">Bu kategori için tanımlı evrak türü yok.</p>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">Desteklenen: PDF, JPG, PNG, Word, Excel — Maks. 20 MB</p>
      </SectionCard>

      <SectionCard title="Yüklü Evraklar" subtitle={`${documents.length} evrak`}>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Henüz Evrak Yüklenmemiş.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const downloadUrl = `${API}/vendor-documents/${doc.id}/download`;
              const ext = getExt(doc);
              const showThumb = isImage(doc);
              return (
                <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Thumbnail or icon */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {showThumb ? (
                        <img src={downloadUrl} alt={doc.fileName} className="w-10 h-10 object-cover rounded-xl" />
                      ) : (
                        <span className="text-indigo-600 text-xs font-bold">{ext.toUpperCase() || 'DOC'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.fileName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs mr-1">
                          {doc.customLabel ?? doc.documentType?.name ?? doc.documentTypeName ?? '—'}
                        </span>
                        {fmtSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString('tr-TR')}
                        {doc.uploadedBy && ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3 flex-shrink-0">
                    {/* Önizleme butonu */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isImage(doc) || isPdf(doc)) {
                          setPreviewDoc(doc);
                        } else {
                          window.open(downloadUrl, '_blank');
                        }
                      }}
                      title="Ön İzleme"
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <a href={downloadUrl} target="_blank" rel="noreferrer"
                      className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg transition-colors">İndir</a>
                    <button type="button" onClick={() => handleDelete(doc.id, doc.fileName)}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors">Sil</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Yükleniyor...</span>
      </div>
    </div>
  );
  if (!vendor) return <div className="text-slate-400 py-16 text-center">Tedarikçi Bulunamadı.</div>;

  const isCorporate = vendor.entityType !== 'individual';
  const contactCount = vendor.contacts?.length ?? 0;
  const hasBirthday = vendor.contacts?.some((c: any) => {
    if (!c.birthDate) return false;
    const bd = new Date(c.birthDate);
    const today = new Date();
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  });

  return (
    <div>
      {/* ── Back ── */}
      <button type="button" onClick={() => router.push('/panel/tedarikciler')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tedarikçiler
      </button>

      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm ${isCorporate ? 'bg-indigo-600' : 'bg-purple-600'}`}>
            {vendor.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {isCorporate ? 'Kurumsal' : 'Bireysel'}
                  {vendor.type && ` · ${formatVendorTypeLabel(vendor.type)}`}
                  {vendor.city && ` · ${vendor.city}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {hasBirthday && <Badge variant="amber">🎂 Bugün Doğum Günü!</Badge>}
                <Badge variant={vendor.status === 'active' ? 'green' : 'gray'}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${vendor.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {vendor.status === 'active' ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>
            </div>
            {/* Quick info */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
              {vendor.phone && (
                <PhoneContactActions phone={vendor.phone} variant="inline" accent="indigo" size="sm" />
              )}
              {vendor.email && <a href={`mailto:${vendor.email}`} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1">✉ {vendor.email}</a>}
              {vendor.taxNumber && <span className="text-xs text-slate-400">VKN: {vendor.taxNumber}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tedarikçi Bilgileri Bandı — tüm sekmelerde sabit ── */}
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${isCorporate ? 'bg-indigo-600' : 'bg-purple-600'}`}>
            {vendor.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-blue-400 font-medium tracking-wide leading-none mb-0.5">
              {isCorporate ? 'Kurumsal Tedarikçi' : 'Bireysel Tedarikçi'}
            </p>
            <p className="text-sm font-semibold text-blue-800 truncate">{vendor.name}</p>
          </div>
        </div>
        {vendor.phone && (
          <div className="min-w-0">
            <p className="text-xs text-blue-400 leading-none mb-0.5">Telefon</p>
            <PhoneContactActions phone={vendor.phone} variant="inline" accent="indigo" size="sm" />
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

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-5 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'yetkili-iletisim' && contactCount > 0 && (
                <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs rounded-full px-1.5 py-0.5 font-semibold">{contactCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'profil' && <GenelBakisTab vendor={vendor} vendorId={id!} />}
      {activeTab === 'hizmet-kapsam' && <HizmetKapsamTab vendor={vendor} onUpdate={loadVendor} />}
      {activeTab === 'evraklar' && (
        <EvraklarTab
          vendorId={id!}
          vendorCategory={(['hasar', 'acil', 'her_ikisi'].includes(vendor.category) ? vendor.category : 'hasar') as VendorCategory}
        />
      )}
      {activeTab === 'odemeler' && <OdemelerTab vendorId={id!} />}
    </div>
  );
}

// ─── OdemelerTab ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:              { label: 'Taslak',            color: 'bg-slate-100 text-slate-600' },
  SENT:               { label: 'Gönderildi',         color: 'bg-blue-100 text-blue-700' },
  PARTIALLY_APPROVED: { label: 'Kısmi Onay',         color: 'bg-yellow-100 text-yellow-700' },
  APPROVED:           { label: 'Onaylandı',          color: 'bg-green-100 text-green-700' },
  DISPUTED:           { label: 'İtirazlı',           color: 'bg-red-100 text-red-700' },
  CLOSED:             { label: 'Kapatıldı',          color: 'bg-slate-200 text-slate-500' },
};

function OdemelerTab({ vendorId }: { vendorId: string }) {
  const [statements, setStatements] = useState<any[]>([]);
  const [filePayments, setFilePayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stmtRes, summaryRes, payRes] = await Promise.all([
        axios.get(`${API}/vendor-statements?vendorId=${vendorId}&limit=50`, { headers: authHeader() }),
        axios.get(`${API}/vendor-statements/vendor/${vendorId}/summary`, { headers: authHeader() }),
        axios.get(`${API}/payments?payerId=${vendorId}&payerType=vendor&paymentType=outgoing&status=completed&limit=50`, { headers: authHeader() }),
      ]);
      setStatements(stmtRes.data.data ?? []);
      setSummary(summaryRes.data);
      setFilePayments(payRes.data.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [vendorId]);

  const openReceipt = async (paymentId: string) => {
    try {
      const res = await axios.get(`${API}/payments/${paymentId}/receipt/download`, { headers: authHeader() });
      const url = res.data?.data?.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Dekont açılamadı');
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id: string) => {
    if (!confirm('Ekstre tedarikçiye SMS ile gönderilecek. Onaylıyor musunuz?')) return;
    try {
      await axios.post(`${API}/vendor-statements/${id}/send`, {}, { headers: authHeader() });
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Gönderim hatası');
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-400">Yükleniyor...</div>;

  return (
    <div className="space-y-5">
      {/* Özet Kartlar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Toplam Ekstre', value: summary.totalStatements, color: 'text-slate-700' },
            { label: 'Dosya Ödemesi', value: summary.filePaymentCount ?? 0, color: 'text-indigo-600' },
            { label: 'Dekontlu Ödeme', value: summary.filePaymentsWithReceipt ?? 0, color: 'text-green-600' },
            { label: 'Onaylı Tutar', value: fmtCurrency(summary.totalApprovedAmount), color: 'text-indigo-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <SectionCard
        title="Dosya Bazlı Ödemeler"
        subtitle="Hasar dosyasından yapılan tedarikçi ödemeleri — dekont burada görünür"
      >
        {filePayments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Henüz dosya bazlı ödeme kaydı yok</p>
        ) : (
          <div className="space-y-2">
            {filePayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {p.claimFile?.fileNo ?? 'Dosya'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(p.paymentDate)} · {p.method?.toUpperCase() ?? '—'}
                    {p.referenceNo ? ` · Ref: ${p.referenceNo}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-slate-700">{fmtCurrency(p.amount)}</span>
                  {p.receiptStorageKey ? (
                    <button
                      type="button"
                      onClick={() => openReceipt(p.id)}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-100 rounded font-medium hover:bg-green-100"
                    >
                      Dekont
                    </button>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded font-medium">
                      Dekont yok
                    </span>
                  )}
                  {p.claimFile?.id && (
                    <a
                      href={`/panel/hasar-dosyalari/${p.claimFile.id}`}
                      className="text-xs px-2 py-1 border border-slate-200 hover:bg-white rounded font-medium text-slate-600 transition-colors"
                    >
                      Dosya
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Ödeme Ekstreleri"
        subtitle="Bu tedarikçiye ait dönemsel mutabakat belgeleri"
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-medium transition-colors"
          >
            + Yeni Ekstre
          </button>
        }
      >
        {statements.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Henüz ekstre oluşturulmamış</p>
        ) : (
          <div className="space-y-2">
            {statements.map((stmt) => {
              const s = STATUS_LABELS[stmt.status] ?? { label: stmt.status, color: 'bg-slate-100 text-slate-600' };
              const disputeCount = stmt.items?.filter((i: any) => i.approvalStatus === 'DISPUTED').length ?? 0;
              return (
                <div key={stmt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-indigo-700">EK</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{stmt.statementNo}</p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(stmt.periodStart)} – {fmtDate(stmt.periodEnd)}
                        {stmt._count?.items != null && ` · ${stmt._count.items} kalem`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {disputeCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {disputeCount} itiraz
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    <span className="text-sm font-bold text-slate-700">{fmtCurrency(stmt.totalAmount)}</span>
                    {stmt.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSend(stmt.id)}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                      >
                        Gönder
                      </button>
                    )}
                    <Link
                      href={`/panel/tedarikciler/${vendorId}/ekstreler/${stmt.id}`}
                      className="text-xs px-2 py-1 border border-slate-200 hover:bg-white rounded font-medium text-slate-600 transition-colors"
                    >
                      Detay
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {showCreateModal && (
        <CreateStatementModal
          vendorId={vendorId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── CreateStatementModal ─────────────────────────────────────────────────────
function CreateStatementModal({
  vendorId,
  onClose,
  onCreated,
}: {
  vendorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'period' | 'items' | 'review'>('period');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSuggestions = async () => {
    if (!periodStart || !periodEnd) { setError('Dönem başlangıç ve bitiş tarihi giriniz'); return; }
    setLoadingSuggest(true);
    setError('');
    try {
      const res = await axios.get(
        `${API}/vendor-statements/suggest-items?vendorId=${vendorId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
        { headers: authHeader() },
      );
      setSuggestedItems(res.data ?? []);
      setSelectedItems(new Set(res.data.map((i: any) => i.paymentId ?? Math.random().toString())));
      setStep('items');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Öneri yüklenemedi');
    }
    setLoadingSuggest(false);
  };

  const toggleItem = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const items = suggestedItems
        .filter((_, idx) => selectedItems.has(suggestedItems[idx].paymentId ?? String(idx)))
        .map((item) => ({
          paymentId: item.paymentId,
          claimFileId: item.claimFileId,
          lineDescription: item.lineDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          vatRate: item.vatRate,
          receiptRef: item.receiptRef,
          receiptDate: item.receiptDate,
        }));

      await axios.post(
        `${API}/vendor-statements`,
        { vendorId, periodStart, periodEnd, notes, items },
        { headers: authHeader() },
      );
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Ekstre oluşturulamadı');
    }
    setSaving(false);
  };

  const selectedTotal = suggestedItems
    .filter((item, idx) => selectedItems.has(item.paymentId ?? String(idx)))
    .reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Yeni Ekstre Oluştur</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 'period' ? '1/3 Dönem Seçimi' : step === 'items' ? '2/3 Kalem Seçimi' : '3/3 Gözden Geçir'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {step === 'period' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dönem Başlangıç</label>
                  <TrDateInput
                    value={periodStart}
                    onChange={setPeriodStart}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dönem Bitiş</label>
                  <TrDateInput
                    value={periodEnd}
                    onChange={setPeriodEnd}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notlar (opsiyonel)</label>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Tedarikçiye iletmek istediğiniz notlar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          )}

          {step === 'items' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  {suggestedItems.length} ödeme kaydı bulundu
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedItems(new Set(suggestedItems.map((i, idx) => i.paymentId ?? String(idx))))}
                    className="text-xs text-indigo-600 hover:underline">Tümünü Seç</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedItems(new Set())}
                    className="text-xs text-slate-500 hover:underline">Temizle</button>
                </div>
              </div>
              {suggestedItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  Bu dönemde tamamlanmış ödeme kaydı bulunamadı.<br/>
                  <span className="text-xs">Ekstre boş oluşturulacak; sonradan kalem ekleyebilirsiniz.</span>
                </p>
              ) : (
                suggestedItems.map((item, idx) => {
                  const key = item.paymentId ?? String(idx);
                  const checked = selectedItems.has(key);
                  return (
                    <label key={key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleItem(key)}
                        className="mt-0.5 accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.lineDescription}</p>
                        <p className="text-xs text-slate-400">
                          {item.claimFileNo && `Dosya: ${item.claimFileNo} · `}
                          {item.receiptDate && `Tarih: ${fmtDate(item.receiptDate)}`}
                          {item.hasReceipt && (
                            <span className="ml-2 text-green-600 font-medium">· Dekont var</span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-700 flex-shrink-0">{fmtCurrency(item.totalAmount)}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dönem</span>
                  <span className="font-medium">{fmtDate(periodStart)} – {fmtDate(periodEnd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seçili Kalem</span>
                  <span className="font-medium">{selectedItems.size} kalem</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Toplam Tutar</span>
                  <span className="font-bold text-indigo-700">{fmtCurrency(selectedTotal)}</span>
                </div>
              </div>
              {notes && (
                <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <span className="font-medium">Not:</span> {notes}
                </div>
              )}
              <p className="text-xs text-slate-400">
                Ekstre oluşturulduktan sonra &quot;Taslak&quot; durumunda olacak. Hazır olduğunuzda tedarikçiye gönderebilirsiniz.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={() => {
              if (step === 'items') setStep('period');
              else if (step === 'review') setStep('items');
              else onClose();
            }}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
          >
            {step === 'period' ? 'İptal' : 'Geri'}
          </button>
          {step === 'period' && (
            <button
              onClick={loadSuggestions}
              disabled={loadingSuggest || !periodStart || !periodEnd}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {loadingSuggest ? 'Yükleniyor...' : 'Devam'}
            </button>
          )}
          {step === 'items' && (
            <button
              onClick={() => setStep('review')}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Gözden Geçir
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? 'Oluşturuluyor...' : 'Ekstre Oluştur'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
