'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
const _apiV1Base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_V1 = _apiV1Base.endsWith('/api/v1') ? _apiV1Base : `${_apiV1Base}/api/v1`;

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── Types ──────────────────────────────────────────────────────────────────────

type ApprovalItem = {
  id: string;
  status: string;
  report?: { reportNumber?: string; claimFile?: { fileNumber?: string } };
  reportId?: string;
  createdAt?: string;
};

const INSURANCE_COMPANIES = [
  { name: 'Türkiye Sigorta', color: '#003087' },
  { name: 'Anadolu Sigorta', color: '#E30613' },
  { name: 'Neova Sigorta', color: '#FF6B00' },
  { name: 'Ray Sigorta', color: '#7C3AED' },
  { name: 'Allianz Sigorta', color: '#003781' },
  { name: 'Quick Sigorta', color: '#0075BE' },
  { name: 'Bereket Sigorta', color: '#00A651' },
  { name: 'Sompo Sigorta', color: '#FF6600' },
  { name: 'Hepiyi Sigorta', color: '#4CAF50' },
  { name: 'Aksigorta', color: '#DA291C' },
];

// ─── İhbar Form Sabitleri ────────────────────────────────────────────────────

const IHBAR_KONULARI = [
  { value: 'yangin', label: 'Yangın' },
  { value: 'su_basmasi', label: 'Su Basması / Boru Patlaması' },
  { value: 'dogal_afet', label: 'Doğal Afet (Deprem / Sel / Fırtına)' },
  { value: 'hirsizlik', label: 'Hırsızlık' },
  { value: 'cam_kirilmasi', label: 'Cam Kırılması / Cephe Hasarı' },
  { value: 'makine_kirilmasi', label: 'Makine Kırılması' },
  { value: 'konut', label: 'Konut Hasarı' },
  { value: 'isyeri', label: 'İşyeri Hasarı' },
  { value: 'diger', label: 'Diğer' },
];

const TR_ILLER = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
  'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
  'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak',
  'Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan',
  'Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

// ─── İhbar Modal Bileşeni ────────────────────────────────────────────────────

type IhbarFormData = {
  policeTuru: 'bireysel' | 'ticari' | '';
  konu: string;
  sigortaSirketi: string;
  policeNo: string;
  ticariUnvan: string;
  vergiDairesi: string;
  vergiNo: string;
  sigortaliAdi: string;
  sigortaliTelefon: string;
  il: string;
  ilce: string;
  adresDetay: string;
  hasarTarihi: string;
  aciklama: string;
};

type IhbarModalProps = {
  onClose: () => void;
  onSuccess: (fileNo: string) => void;
};

function maskPhoneSimple(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 1) return d;
  if (d.length <= 4) return `${d[0]} (${d.slice(1)}`;
  if (d.length <= 7) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

function IhbarModal({ onClose, onSuccess }: IhbarModalProps) {
  const [form, setForm] = useState<IhbarFormData>({
    policeTuru: '', konu: '', sigortaSirketi: '', policeNo: '',
    ticariUnvan: '', vergiDairesi: '', vergiNo: '',
    sigortaliAdi: '', sigortaliTelefon: '', il: '', ilce: '', adresDetay: '',
    hasarTarihi: '', aciklama: '',
  });
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof IhbarFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [insuranceCompanies, setInsuranceCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    fetch(`${API_V1}/insurance-companies?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setInsuranceCompanies(d?.data ?? []))
      .catch(() => {});
  }, []);

  const set = (key: keyof IhbarFormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  };

  const validate = () => {
    const e: Partial<Record<keyof IhbarFormData, string>> = {};
    if (!form.policeTuru) e.policeTuru = 'Zorunlu alan';
    if (!form.konu) e.konu = 'Zorunlu alan';
    if (!form.sigortaliAdi.trim()) e.sigortaliAdi = 'Zorunlu alan';
    if (!form.sigortaliTelefon || form.sigortaliTelefon.replace(/\D/g, '').length < 10) e.sigortaliTelefon = 'Geçerli telefon giriniz';
    if (!form.il) e.il = 'Zorunlu alan';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const payload = {
        productBranch: form.konu,
        insuranceCompanyId: form.sigortaSirketi || undefined,
        policyNo: form.policeNo || undefined,
        description: form.aciklama || undefined,
        incidentDate: form.hasarTarihi ? new Date(form.hasarTarihi).toISOString() : undefined,
        notificationDate: new Date().toISOString(),
        priority: 'normal',
        insuredName: form.sigortaliAdi,
        insuredPhone: form.sigortaliTelefon.replace(/\D/g, ''),
        propertyAddress: [form.adresDetay, form.ilce, form.il].filter(Boolean).join(', '),
      };
      const res = await fetch(`${API_V1}/claim-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const fileNo = data?.data?.fileNumber ?? data?.data?.id?.slice(-8).toUpperCase() ?? 'YNI-' + Date.now().toString(36).toUpperCase();
        onSuccess(fileNo);
      } else {
        throw new Error('api_error');
      }
    } catch {
      alert('İhbar gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Eksper Portal</span>
      </nav>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Yeni İhbar</h2>
              <p className="text-xs text-slate-500">Hasar bilgilerini girin</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form alanları */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* İhbar Konusu */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              İhbar Konusu <span className="text-red-500">*</span>
            </label>
            <select
              className={`input-base-sm ${errors.konu ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
              value={form.konu}
              onChange={(e) => set('konu', e.target.value)}
            >
              <option value="">Seçiniz...</option>
              {IHBAR_KONULARI.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {errors.konu && <p className="text-xs text-red-500 mt-1">{errors.konu}</p>}
          </div>

          {/* Sigorta Şirketi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Sigorta Şirketi</label>
            <select
              className="input-base-sm"
              value={form.sigortaSirketi}
              onChange={(e) => set('sigortaSirketi', e.target.value)}
            >
              <option value="">Seçiniz...</option>
              {insuranceCompanies.length > 0
                ? insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                : INSURANCE_COMPANIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)
              }
            </select>
          </div>

          {/* Poliçe Türü */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Poliçe Türü <span className="text-red-500">*</span>
            </label>
            <select
              className={`input-base-sm ${errors.policeTuru ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
              value={form.policeTuru}
              onChange={(e) => set('policeTuru', e.target.value as 'bireysel' | 'ticari' | '')}
            >
              <option value="">Seçiniz...</option>
              <option value="bireysel">Bireysel</option>
              <option value="ticari">Ticari</option>
            </select>
            {errors.policeTuru && <p className="text-xs text-red-500 mt-1">{errors.policeTuru}</p>}
          </div>

          {/* Kurumsal Bilgiler — sadece Ticari seçildiğinde */}
          {form.policeTuru === 'ticari' && (
            <div className="space-y-3">
              {/* Amber uyarı */}
              {(!form.ticariUnvan.trim() || !form.vergiDairesi.trim() || !form.vergiNo.trim()) && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Kurumsal bilgilerin girilmesi önerilir. Eksik bilgiler dosya sürecini uzatabilir.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Ticari Ünvan</label>
                <input
                  className="input-base-sm"
                  placeholder="Şirket ünvanı"
                  value={form.ticariUnvan}
                  onChange={(e) => set('ticariUnvan', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Vergi Dairesi</label>
                  <input
                    className="input-base-sm"
                    placeholder="Vergi dairesi"
                    value={form.vergiDairesi}
                    onChange={(e) => set('vergiDairesi', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Vergi Numarası</label>
                  <input
                    className="input-base-sm"
                    placeholder="Vergi numarası"
                    value={form.vergiNo}
                    onChange={(e) => set('vergiNo', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Poliçe No */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Poliçe No</label>
            <input
              className="input-base-sm"
              placeholder="Opsiyonel"
              value={form.policeNo}
              onChange={(e) => set('policeNo', e.target.value)}
            />
          </div>

          {/* Sigortalı Adı + Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Sigortalı Adı Soyadı <span className="text-red-500">*</span>
              </label>
              <input
                className={`input-base-sm ${errors.sigortaliAdi ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
                placeholder="Ad Soyad"
                value={form.sigortaliAdi}
                onChange={(e) => set('sigortaliAdi', e.target.value)}
              />
              {errors.sigortaliAdi && <p className="text-xs text-red-500 mt-1">{errors.sigortaliAdi}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Sigortalı Telefon <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className={`input-base-sm ${errors.sigortaliTelefon ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
                placeholder="0 (5XX) XXX XX XX"
                value={phoneDisplay}
                maxLength={18}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPhoneDisplay(maskPhoneSimple(digits));
                  set('sigortaliTelefon', digits);
                }}
              />
              {errors.sigortaliTelefon && <p className="text-xs text-red-500 mt-1">{errors.sigortaliTelefon}</p>}
            </div>
          </div>

          {/* Hasar Adresi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Hasar Adresi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <select
                  className={`input-base-sm ${errors.il ? 'border-red-400 ring-2 ring-red-500/20' : ''}`}
                  value={form.il}
                  onChange={(e) => set('il', e.target.value)}
                >
                  <option value="">İl seçiniz...</option>
                  {TR_ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
                </select>
                {errors.il && <p className="text-xs text-red-500 mt-1">{errors.il}</p>}
              </div>
              <div>
                <input
                  className="input-base-sm"
                  placeholder="İlçe (opsiyonel)"
                  value={form.ilce}
                  onChange={(e) => set('ilce', e.target.value)}
                />
              </div>
            </div>
            <input
              className="input-base-sm"
              placeholder="Adres detayı (opsiyonel)"
              value={form.adresDetay}
              onChange={(e) => set('adresDetay', e.target.value)}
            />
          </div>

          {/* Hasar Tarihi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Hasar Tarihi</label>
            <input
              type="date"
              className="input-base-sm"
              value={form.hasarTarihi}
              onChange={(e) => set('hasarTarihi', e.target.value)}
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Kısa Açıklama</label>
            <textarea
              className="input-base-sm resize-none"
              rows={3}
              placeholder="Hasara dair kısa açıklama..."
              value={form.aciklama}
              onChange={(e) => set('aciklama', e.target.value)}
            />
          </div>

          {/* Fotoğraf (placeholder) */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Fotoğraf Yükle</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-5 text-center bg-slate-50">
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-slate-400">Fotoğraf yükleme yakında aktif olacak</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
            disabled={saving}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Gönder
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Toast ───────────────────────────────────────────────────────────

function IhbarSuccessToast({ fileNo, onClose }: { fileNo: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed top-5 right-5 z-[70] animate-toast-in">
      <div className="flex items-start gap-3 bg-white border border-emerald-200 rounded-2xl shadow-xl px-5 py-4 max-w-sm">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">İhbarınız alınmıştır</p>
          <p className="text-xs text-slate-500 mt-0.5">Dosya numarası: <span className="font-bold text-emerald-600">{fileNo}</span></p>
          <p className="text-[11px] text-slate-400 mt-1">Ofis personeli en kısa sürede işleme alacaktır.</p>
        </div>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Gauge Component (SVG-based animated dial) ─────────────────────────────────

function GaugeChart({
  value,
  max = 100,
  label,
  unit = '%',
  size = 150,
}: {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(value), 400);
    return () => clearTimeout(timer);
  }, [value]);

  const pct = Math.min(100, Math.max(0, (animated / max) * 100));
  const cx = size / 2;
  const cy = size * 0.58;
  const r = size * 0.38;
  const strokeWidth = size * 0.1;

  function polarToXY(deg: number, radius: number) {
    const rad = ((deg - 180) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const zones = [
    { from: 0, to: 60, color: '#EF4444' },
    { from: 60, to: 80, color: '#F59E0B' },
    { from: 80, to: 100, color: '#10B981' },
  ];

  const needle = polarToXY(pct * 1.8, r * 0.72);
  const gaugeColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <path d={arcPath(0, 180)} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} strokeLinecap="round" />
        {zones.map((z) => (
          <path
            key={z.from}
            d={arcPath(z.from * 1.8, z.to * 1.8)}
            fill="none"
            stroke={z.color}
            strokeWidth={strokeWidth}
            opacity={0.35}
          />
        ))}
        {pct > 0 && (
          <path
            d={arcPath(0, Math.max(1, pct * 1.8))}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'all 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        )}
        <line
          x1={cx} y1={cy}
          x2={needle.x} y2={needle.y}
          stroke="#334155"
          strokeWidth={size * 0.018}
          strokeLinecap="round"
          style={{ transition: 'all 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
        <circle cx={cx} cy={cy} r={size * 0.05} fill="#334155" />
        <text
          x={cx} y={cy + size * 0.16}
          textAnchor="middle"
          fontSize={size * 0.17}
          fontWeight="700"
          fill={gaugeColor}
        >
          {value}{unit}
        </text>
      </svg>
      <p className="text-xs font-medium text-slate-500 text-center mt-1 leading-tight px-2">{label}</p>
    </div>
  );
}

// ─── Clock ─────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="text-right">
      <p className="text-blue-200 text-xs">{dateStr}</p>
      <p className="text-white text-2xl font-bold tabular-nums tracking-wider">{timeStr}</p>
    </div>
  );
}

// ─── Status helpers ─────────────────────────────────────────────────────────────

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', expired: 'Süresi Doldu' };
  return map[s] ?? s;
}
function statusDot(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-400',
    approved: 'bg-emerald-400',
    rejected: 'bg-red-400',
    expired: 'bg-slate-400',
  };
  return map[s] ?? 'bg-slate-400';
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function EksperPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [assignedCount, setAssignedCount] = useState<number>(0);
  const [recentApprovals, setRecentApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showIhbarModal, setShowIhbarModal] = useState(false);
  const [successFileNo, setSuccessFileNo] = useState<string | null>(null);

  const handleIhbarSuccess = useCallback((fileNo: string) => {
    setShowIhbarModal(false);
    setSuccessFileNo(fileNo);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') { setLoading(false); setAccessDenied(true); return; }
    setUser(u);

    const adjusterId = u.adjusterId;
    if (!adjusterId) { setLoading(false); return; }

    Promise.all([
      fetch(`${API}/external-approvals/pending?approverType=expert&approverId=${adjusterId}`, { headers: getHeaders() }).then((r) => r.json()),
      fetch(`${API}/claim-files?assignedAdjusterId=${adjusterId}&limit=5`, { headers: getHeaders() }).then((r) => r.json()),
    ])
      .then(([approvals, files]) => {
        const list: ApprovalItem[] = approvals?.data ?? [];
        setPendingCount(list.length);
        setRecentApprovals(list.slice(0, 5));
        setAssignedCount(files?.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-9 w-9 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Bu sayfa eksperler içindir</p>
          <p className="text-sm text-slate-500 mt-1">Eksper Portalı yalnızca eksper rolündeki kullanıcılar tarafından kullanılabilir.</p>
        </div>
        <Link href="/panel" className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Eksper';

  const approvalPendingCount = pendingCount;
  const approvalExpiredCount = 0;

  return (
    <div className="min-h-screen bg-slate-50 -m-6 px-0">

      <div className="px-6 py-6 pb-16 space-y-6">

        {/* ── Hero: Hoş Geldin + Saat + Hava ─────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 shadow-lg">
          {/* Subtle dekoratif arka plan */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-16 -left-16 w-56 h-56 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -right-8 w-64 h-64 bg-indigo-900/30 rounded-full blur-3xl" />
          </div>

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Sol: Logo + Hoş geldin */}
            <div className="flex items-start gap-4">
              {/* Meridyen Logo */}
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">Meridyen Assistance</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300" />
                  <span className="text-[10px] text-blue-300">Eksper Portalı</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">
                  Hoş Geldiniz,{' '}
                  <span className="text-blue-100">
                    {userName}
                  </span>
                </h1>

                {/* Onay durumu özeti */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/30 rounded-lg px-3 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-200 text-xs font-semibold">{approvalPendingCount} onay bekliyor</span>
                  </div>
                  {approvalExpiredCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-red-200 text-xs font-semibold">{approvalExpiredCount} süresi geçmiş</span>
                    </div>
                  )}
                </div>

                {/* Hızlı Aksiyon Butonları */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {/* Yeni İhbar */}
                  <button
                    type="button"
                    onClick={() => setShowIhbarModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-blue-700 text-xs font-semibold transition-all duration-150 shadow hover:bg-blue-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Yeni İhbar
                  </button>
                  <Link
                    href="/panel/eksper-portal/dosyalar"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                    Dosyalarım
                  </Link>
                  <Link
                    href="/panel/eksper-portal/randevular"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Randevularım
                  </Link>
                  {/* Onay Bekleyen Dosyalar */}
                  <Link
                    href="/panel/eksper-portal/onaylar"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 border border-amber-400/40 text-xs font-semibold transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Onay Bekleyen
                    <span className="ml-1 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-amber-400 text-amber-900 text-[10px] font-bold px-1">
                      {approvalPendingCount}
                    </span>
                  </Link>
                  {/* Onay Süresi Geçmiş */}
                  <Link
                    href="/panel/eksper-portal/onaylar?filter=expired"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-400/20 hover:bg-red-400/30 text-red-100 border border-red-400/40 text-xs font-semibold transition-all duration-150"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    Süresi Geçmiş
                    {approvalExpiredCount > 0 && (
                      <span className="ml-1 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                        {approvalExpiredCount}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            </div>

            {/* Sağ: Saat + Hızlı İletişim */}
            <div className="flex flex-col items-end gap-4 flex-shrink-0">
              <LiveClock />
              {/* Hızlı İletişim — kompakt pill bandı */}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="tel:+908508852555"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  <svg className="w-3 h-3 text-blue-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-[11px] text-white font-medium tabular-nums">0 850 885 25 55</span>
                </a>
                <a
                  href="https://wa.me/905336330713"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 hover:bg-green-500/35 border border-green-400/30 transition-colors"
                >
                  <svg className="w-3 h-3 text-green-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-[11px] text-white font-medium tabular-nums">0533 633 07 13</span>
                </a>
                <a
                  href="mailto:info@meridyenassistance.com"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  <svg className="w-3 h-3 text-blue-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[11px] text-blue-100">info@meridyenassistance.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Aktif Dosya Sayısı ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col items-center hover:border-slate-300 hover:shadow-sm transition-all">
            <GaugeChart value={Math.min(assignedCount, 50)} max={50} label="Aktif Dosya Sayısı" unit="" size={140} />
            <p className="text-[10px] text-slate-400 text-center mt-1">{`Toplam: ${assignedCount}`}</p>
          </div>
        </div>

        {/* ── Alt Grid: Aktiviteler + İstatistikler ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Son Aktiviteler */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-800">Son Dosya Aktiviteleri</h3>
              </div>
              <Link href="/panel/eksper-portal/onaylar" className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium">
                Tümünü Gör →
              </Link>
            </div>
            {recentApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Henüz aktivite bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentApprovals.map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDot(a.status)}`} />
                      {i < recentApprovals.length - 1 && (
                        <div className="w-px h-6 bg-slate-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {a.report?.claimFile?.fileNumber ?? a.report?.reportNumber ?? `Dosya #${a.id.slice(-6)}`}
                        </p>
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {statusLabel(a.status)}
                        </span>
                      </div>
                      {a.report?.reportNumber && (
                        <p className="text-xs text-slate-400 truncate">{a.report.reportNumber}</p>
                      )}
                    </div>
                    {a.status === 'pending' && (
                      <Link
                        href="/panel/eksper-portal/onaylar"
                        className="flex-shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        İncele
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sağ: Özet KPI'lar + Tanıtım */}
          <div className="space-y-4">
            {/* KPI Cards */}
            {[
              {
                label: 'Bekleyen Onaylar',
                value: approvalPendingCount,
                icon: (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                ),
                href: '/panel/eksper-portal/onaylar',
                color: approvalPendingCount > 0 ? 'from-amber-500 to-orange-600' : 'from-slate-400 to-slate-500',
                textColor: approvalPendingCount > 0 ? 'text-amber-700' : 'text-slate-600',
                pulse: approvalPendingCount > 0,
              },
              {
                label: 'Süresi Geçmiş Onaylar',
                value: approvalExpiredCount,
                icon: (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                ),
                href: '/panel/eksper-portal/onaylar?filter=expired',
                color: approvalExpiredCount > 0 ? 'from-red-500 to-rose-600' : 'from-slate-400 to-slate-500',
                textColor: approvalExpiredCount > 0 ? 'text-red-700' : 'text-slate-600',
                pulse: approvalExpiredCount > 0,
              },
              {
                label: 'Atanmış Dosyalar',
                value: assignedCount,
                icon: (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"/><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                ),
                href: '/panel/eksper-portal/dosyalar',
                color: 'from-blue-500 to-indigo-600',
                textColor: 'text-blue-700',
                pulse: false,
              },
            ].map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="flex items-center gap-4 rounded-xl bg-white border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-150 group"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white flex-shrink-0 shadow-md`}>
                  {kpi.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-2xl font-bold tabular-nums ${kpi.textColor}`}>{kpi.value}</p>
                    {kpi.pulse && <span className={`w-2 h-2 rounded-full animate-pulse ${kpi.label.includes('Geçmiş') ? 'bg-red-500' : 'bg-amber-400'}`} />}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}

            {/* Meridyen Tanıtım Kartı */}
            <div className="rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-5 relative shadow-md">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-black/10 rounded-full blur-xl" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-white font-bold text-sm">Meridyen Assistance</span>
                </div>
                <p className="text-blue-100 text-xs leading-relaxed">
                  Türkiye&apos;nin önde gelen 10 sigorta şirketiyle çalışan, güvenilir hasar yönetimi partneri.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <p className="text-white font-bold text-lg tabular-nums">1.030+</p>
                    <p className="text-blue-200 text-[10px]">Toplam Dosya</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <p className="text-white font-bold text-lg tabular-nums">%94</p>
                    <p className="text-blue-200 text-[10px]">Memnuniyet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Sigorta Şirketleri — Fixed Bottom Bandı ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center h-10 overflow-hidden">
          <div className="flex-shrink-0 flex items-center gap-2 px-4 h-full bg-slate-800 text-white text-[11px] font-bold tracking-wider whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            PARTNERLER
          </div>
          <div className="flex-1 overflow-hidden">
            <div
              className="inline-flex items-center gap-8 whitespace-nowrap"
              style={{ animation: 'marqueeInsuranceFixed 32s linear infinite', willChange: 'transform' }}
            >
              {[...INSURANCE_COMPANIES, ...INSURANCE_COMPANIES].map((co, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                  style={{
                    color: co.color,
                    borderColor: `${co.color}40`,
                    backgroundColor: `${co.color}0d`,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                    style={{ background: co.color }}
                  >
                    {co.name.charAt(0)}
                  </span>
                  {co.name}
                </span>
              ))}
            </div>
            <style>{`
              @keyframes marqueeInsuranceFixed {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>
          <div className="flex-shrink-0 px-4 text-[10px] text-slate-400 whitespace-nowrap hidden sm:block">
            {INSURANCE_COMPANIES.length} aktif partner
          </div>
        </div>
      </div>

      {/* ── İhbar Modal ──────────────────────────────────────────────────────── */}
      {showIhbarModal && (
        <IhbarModal
          onClose={() => setShowIhbarModal(false)}
          onSuccess={handleIhbarSuccess}
        />
      )}

      {/* ── İhbar Başarı Toast ───────────────────────────────────────────────── */}
      {successFileNo && (
        <IhbarSuccessToast
          fileNo={successFileNo}
          onClose={() => setSuccessFileNo(null)}
        />
      )}
    </div>
  );
}
