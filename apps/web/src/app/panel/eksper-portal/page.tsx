'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import SpeechToText from '@/components/SpeechToText';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';
import { DashboardShell, DashboardHeader } from '@/app/panel/_components';
import { ExpertPortalContactStrip } from '@/components/panel/expert-portal-contact-strip';
import { PortalWeeklyTrendCard } from '@/components/panel/portal-weekly-trend-card';
import { classifyExpertQueue, countExpertQueues } from '@/utils/expert-portal-queues';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { buildPortalWeeklyActivity, type PortalWeeklyPoint } from '@/utils/portal-weekly-activity';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
const _apiV1Base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_V1 = _apiV1Base.endsWith('/api/v1') ? _apiV1Base : `${_apiV1Base}/api/v1`;

function getHeaders() {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

function authHeaders(extra?: Record<string, string>) {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────────

type ApprovalItem = {
  id: string;
  status: string;
  expiresAt?: string;
  sentAt?: string;
  report?: {
    reportNo?: string;
    reportNumber?: string;
    claimFile?: {
      fileNo?: string;
      fileNumber?: string;
      lossType?: string;
      insuranceCompany?: { name?: string };
    };
  };
  reportId?: string;
  createdAt?: string;
};

type ExpertClaimFile = {
  id: string;
  fileNo?: string;
  fileNumber?: string;
  lossType?: string;
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string | null;
  insuranceCompany?: { name?: string };
  currentStatus?: { name?: string; code?: string; colorCode?: string };
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

// İhbar konuları artık API'den çekiliyor (admin paneli tanımları ile senkron)

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
  dosyaNo: string;
  policeTuru: 'bireysel' | 'ticari' | '';
  konu: string;
  sigortaSirketi: string;
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

type ProvinceOption = { id: string; plateCode: number; name: string };
type DistrictOption = { id: string; name: string; provinceId: string };
type InsuranceCompanyOption = { id: string; name: string };
type UploadItem = { id: string; file: File; previewUrl: string };

const MAX_IHBAR_PHOTO_COUNT = 6;
const MAX_IHBAR_PHOTO_SIZE = 10 * 1024 * 1024;

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

function isUuid(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

function toIsoDate(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeApiMessage(body: any, fallback: string) {
  if (Array.isArray(body?.message)) return body.message.join(', ');
  return body?.message ?? body?.error?.message ?? fallback;
}

function normalizeIhbarTextFields(data: IhbarFormData): IhbarFormData {
  return {
    ...data,
    sigortaliAdi: toTitleCaseTR(data.sigortaliAdi.trim()),
    ticariUnvan: toTitleCaseTR(data.ticariUnvan.trim()),
    vergiDairesi: toTitleCaseTR(data.vergiDairesi.trim()),
    adresDetay: toTitleCaseTR(data.adresDetay.trim()),
    aciklama: toTitleCaseTR(data.aciklama.trim()),
  };
}

function matchInsuranceCompanyId(name: string | null | undefined, list: InsuranceCompanyOption[]): string {
  if (!name?.trim() || list.length === 0) return '';
  const normalized = name.trim().toLocaleLowerCase('tr-TR');
  const exact = list.find((c) => c.name.trim().toLocaleLowerCase('tr-TR') === normalized);
  if (exact) return exact.id;
  const partial = list.find((c) => {
    const cn = c.name.trim().toLocaleLowerCase('tr-TR');
    return normalized.includes(cn) || cn.includes(normalized);
  });
  return partial?.id ?? '';
}

function matchProvinceId(cityName: string | null | undefined, list: ProvinceOption[]): string {
  if (!cityName?.trim() || list.length === 0) return '';
  const normalized = cityName.trim().toLocaleLowerCase('tr-TR');
  const found = list.find((p) => p.name.trim().toLocaleLowerCase('tr-TR') === normalized);
  return found?.id ?? '';
}

function matchDistrictName(districtName: string | null | undefined, list: DistrictOption[]): string {
  if (!districtName?.trim() || list.length === 0) return '';
  const normalized = districtName.trim().toLocaleLowerCase('tr-TR');
  const found = list.find((d) => d.name.trim().toLocaleLowerCase('tr-TR') === normalized);
  return found?.name ?? '';
}

function IhbarModal({ onClose, onSuccess }: IhbarModalProps) {
  const { showToast } = useToast();
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [ihbarKonulari, setIhbarKonulari] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState<IhbarFormData>({
    dosyaNo: '', policeTuru: '', konu: '', sigortaSirketi: '',
    ticariUnvan: '', vergiDairesi: '', vergiNo: '',
    sigortaliAdi: '', sigortaliTelefon: '', il: '', ilce: '', adresDetay: '',
    hasarTarihi: '', aciklama: '',
  });
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof IhbarFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompanyOption[]>([]);
  const [photos, setPhotos] = useState<UploadItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const documentScanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!getAccessToken()) {
          setLookupError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
          return;
        }
        const [companyResponse, provinceResponse, konuResponse] = await Promise.all([
          fetch(`${API_V1}/insurance-companies?limit=200`, { headers: authHeaders() }),
          fetch(`${API_V1}/locations/provinces`, { headers: authHeaders() }),
          fetch(`${API_V1}/claim-subjects/active?category=hasar`, { headers: authHeaders() }),
        ]);
        const [companyBody, provinceBody, konuBody] = await Promise.all([
          companyResponse.json().catch(() => null),
          provinceResponse.json().catch(() => null),
          konuResponse.json().catch(() => null),
        ]);
        if (!active) return;
        setInsuranceCompanies(companyResponse.ok ? (companyBody?.data ?? []) : []);
        setProvinces(provinceResponse.ok ? (provinceBody?.data ?? []) : []);
        if (konuResponse.ok && konuBody?.data) {
          const subjects = konuBody.data ?? [];
          setIhbarKonulari(subjects.map((s: any) => ({ value: s.code, label: s.name })));
        } else {
          setLookupError(normalizeApiMessage(konuBody, 'İhbar konuları yüklenemedi'));
        }
      } catch {
        if (active) setLookupError('Form verileri yüklenemedi');
      } finally {
        if (active) setLoadingLookups(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, [photos]);

  const loadDistricts = useCallback(async (provinceId: string) => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }

    try {
      setLoadingDistricts(true);
      const response = await fetch(`${API_V1}/locations/provinces/${provinceId}/districts`, {
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? 'İlçe listesi yüklenemedi');
      }

      setDistricts(body?.data ?? []);
    } catch {
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  }, []);

  const set = (key: keyof IhbarFormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  };

  const appendSpeech = (key: keyof IhbarFormData) => (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      [key]: prev[key]?.trim() ? `${prev[key].trim()} ${trimmed}` : trimmed,
    }));
  };

  const blurTitleCase = (key: keyof IhbarFormData) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = toTitleCaseTR(e.target.value.trim());
    if (v) set(key, v);
  };

  const applyScannedFields = useCallback(async (fields: Record<string, unknown>) => {
    const next: Partial<IhbarFormData> = {};
    if (typeof fields.insuredName === 'string' && fields.insuredName.trim()) {
      next.sigortaliAdi = toTitleCaseTR(fields.insuredName.trim());
    }
    if (typeof fields.insuredPhone === 'string' && fields.insuredPhone.trim()) {
      const digits = fields.insuredPhone.replace(/\D/g, '').slice(-11);
      next.sigortaliTelefon = digits;
      setPhoneDisplay(maskPhoneSimple(digits));
    }
    if (fields.policyType === 'bireysel' || fields.policyType === 'ticari') {
      next.policeTuru = fields.policyType;
    }
    if (typeof fields.commercialTitle === 'string' && fields.commercialTitle.trim()) {
      next.ticariUnvan = toTitleCaseTR(fields.commercialTitle.trim());
    }
    if (typeof fields.taxOffice === 'string' && fields.taxOffice.trim()) {
      next.vergiDairesi = toTitleCaseTR(fields.taxOffice.trim());
    }
    if (typeof fields.taxNumber === 'string' && fields.taxNumber.trim()) {
      next.vergiNo = fields.taxNumber.trim();
    }
    if (typeof fields.incidentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fields.incidentDate)) {
      next.hasarTarihi = fields.incidentDate;
    }
    if (typeof fields.addressDetail === 'string' && fields.addressDetail.trim()) {
      next.adresDetay = toTitleCaseTR(fields.addressDetail.trim());
    }
    if (typeof fields.description === 'string' && fields.description.trim()) {
      next.aciklama = toTitleCaseTR(fields.description.trim());
    }
    const companyId = matchInsuranceCompanyId(
      typeof fields.insuranceCompanyName === 'string' ? fields.insuranceCompanyName : null,
      insuranceCompanies,
    );
    if (companyId) next.sigortaSirketi = companyId;

    const provinceId = matchProvinceId(
      typeof fields.cityName === 'string' ? fields.cityName : null,
      provinces,
    );
    if (provinceId) {
      next.il = provinceId;
      await loadDistricts(provinceId);
      const districtRows = await fetch(`${API_V1}/locations/provinces/${provinceId}/districts`, {
        headers: authHeaders(),
      }).then((r) => r.json()).then((b) => b?.data ?? []).catch(() => []);
      const districtName = matchDistrictName(
        typeof fields.districtName === 'string' ? fields.districtName : null,
        districtRows,
      );
      if (districtName) next.ilce = districtName;
    }

    setForm((prev) => ({ ...prev, ...next }));
  }, [insuranceCompanies, provinces, loadDistricts]);

  const addPhotoFiles = useCallback((selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const remaining = Math.max(0, MAX_IHBAR_PHOTO_COUNT - photos.length);
    const nextFiles = selectedFiles.filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    if (nextFiles.length === 0) {
      showToast('error', 'Yalnızca görsel dosyaları yükleyebilirsiniz.');
      return;
    }
    const oversized = nextFiles.find((file) => file.size > MAX_IHBAR_PHOTO_SIZE);
    if (oversized) {
      showToast('error', 'Her fotoğraf en fazla 10 MB olabilir.');
      return;
    }
    const mapped = nextFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...mapped].slice(0, MAX_IHBAR_PHOTO_COUNT));
    if (selectedFiles.length > remaining) {
      showToast('error', `En fazla ${MAX_IHBAR_PHOTO_COUNT} fotoğraf yükleyebilirsiniz.`);
    }
  }, [photos.length, showToast]);

  const handleDocumentScan = async (file: File) => {
    if (scanning) return;
    const token = getAccessToken();
    if (!token) {
      showToast('error', 'Oturum bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.');
      return;
    }
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_V1}/claim-files/scan-intake-document`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(normalizeApiMessage(body, 'Belge okunamadı'));
      }
      const fields = body?.data ?? {};
      await applyScannedFields(fields);
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [
        { id: `scan-${Date.now()}`, file, previewUrl },
        ...prev,
      ].slice(0, MAX_IHBAR_PHOTO_COUNT));
      showToast(fields.message?.includes('elle') ? 'info' : 'success', fields.message ?? 'Belge işlendi');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Belge okunamadı';
      showToast('error', msg);
    } finally {
      setScanning(false);
    }
  };

  const validate = (data: IhbarFormData) => {
    const e: Partial<Record<keyof IhbarFormData, string>> = {};
    if (!data.policeTuru) e.policeTuru = 'Zorunlu alan';
    if (!data.konu) e.konu = 'Zorunlu alan';
    if (!data.sigortaSirketi || !isUuid(data.sigortaSirketi)) e.sigortaSirketi = 'Lütfen listeden geçerli bir sigorta şirketi seçin';
    if (!data.sigortaliAdi.trim()) e.sigortaliAdi = 'Zorunlu alan';
    if (!data.sigortaliTelefon || data.sigortaliTelefon.replace(/\D/g, '').length < 10) e.sigortaliTelefon = 'Geçerli telefon giriniz';
    if (!data.il) e.il = 'Zorunlu alan';
    if (data.il && !data.ilce) e.ilce = 'Zorunlu alan';
    if (data.hasarTarihi && !toIsoDate(data.hasarTarihi)) e.hasarTarihi = 'Geçerli tarih giriniz';
    if (data.policeTuru === 'ticari') {
      if (!data.ticariUnvan.trim()) e.ticariUnvan = 'Zorunlu alan';
      if (!data.vergiDairesi.trim()) e.vergiDairesi = 'Zorunlu alan';
      if (!data.vergiNo.trim()) e.vergiNo = 'Zorunlu alan';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const uploadPhotos = useCallback(async (reportId: string) => {
    if (photos.length === 0) return;
    await Promise.all(photos.map(async (photo) => {
      const formData = new FormData();
      formData.append('file', photo.file);
      const response = await fetch(`${API_V1}/repair-reports/${reportId}/images`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(normalizeApiMessage(body, 'Fotoğraf yükleme başarısız oldu.'));
      }
    }));
  }, [photos]);

  const handleSubmit = async () => {
    if (saving || loadingLookups || loadingDistricts) return;
    const normalizedForm = normalizeIhbarTextFields(form);
    setForm(normalizedForm);
    if (!validate(normalizedForm)) {
      showToast('error', 'Lütfen zorunlu alanları kontrol edin.');
      return;
    }
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      const provinceName = provinces.find((province) => province.id === normalizedForm.il)?.name ?? '';
      const generatedFileNo = normalizedForm.dosyaNo.trim() || `EXP-${Date.now().toString(36).toUpperCase()}`;
      const payload = {
        fileNo: generatedFileNo,
        productBranch: normalizedForm.konu,
        insuranceCompanyId: normalizedForm.sigortaSirketi,
        policyNo: 'Belirtilmedi',
        claimNo: `EXP-${Date.now().toString(36).toUpperCase()}`,
        lossType: normalizedForm.konu,
        description: normalizedForm.aciklama.trim() || undefined,
        incidentDate: toIsoDate(normalizedForm.hasarTarihi) ?? new Date().toISOString(),
        notificationDate: new Date().toISOString(),
        priority: 'normal',
        sourceChannel: 'expert_portal',
        insuredName: normalizedForm.sigortaliAdi.trim(),
        insuredPhone: normalizedForm.sigortaliTelefon.replace(/\D/g, ''),
        propertyAddress: [normalizedForm.adresDetay.trim(), normalizedForm.ilce.trim(), provinceName].filter(Boolean).join(', '),
        city: provinceName || undefined,
        district: normalizedForm.ilce.trim() || undefined,
        policyType: normalizedForm.policeTuru,
        commercialTitle: normalizedForm.ticariUnvan.trim() || undefined,
        taxOffice: normalizedForm.vergiDairesi.trim() || undefined,
        taxNumber: normalizedForm.vergiNo.trim() || undefined,
      };
      const res = await fetch(`${API_V1}/claim-files`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        const claimFileId = body?.data?.id;
        if (claimFileId) {
          const reportResponse = await fetch(`${API_V1}/claim-files/${claimFileId}/repair-reports`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              reportType: 'single',
              reportDate: new Date().toISOString(),
              findingsText: normalizedForm.aciklama.trim() || 'Eksper portalı ihbar fotoğrafları',
            }),
          });
          const reportBody = await reportResponse.json().catch(() => null);
          if (!reportResponse.ok) {
            throw new Error(normalizeApiMessage(reportBody, 'İhbar sonrası rapor oluşturulamadı.'));
          }
          const reportId = reportBody?.data?.id;
          if (reportId) {
            await uploadPhotos(reportId);
          }
        }
        const fileNo = body?.data?.fileNo ?? body?.data?.fileNumber ?? body?.data?.id?.slice(-8).toUpperCase() ?? 'YNI-' + Date.now().toString(36).toUpperCase();
        showToast('success', `İhbar başarıyla gönderildi. Dosya no: ${fileNo}`);
        onSuccess(fileNo);
      } else {
        throw new Error(normalizeApiMessage(body, 'İhbar gönderilemedi. Lütfen tekrar deneyin.'));
      }
    } catch (error: any) {
      showToast('error', error?.message ?? 'İhbar gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
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
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow">
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

          {/* Akıllı belge okuma */}
          <FileDropZone
            accept="image/*"
            disabled={scanning || loadingLookups}
            clickToOpen={false}
            capture="environment"
            inputRef={documentScanInputRef}
            onFiles={(files) => {
              if (files[0]) void handleDocumentScan(files[0]);
            }}
            className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 transition-colors cursor-default"
            activeClassName="border-blue-300 bg-blue-100/80"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Belgeden Oku</p>
                <p className="text-xs text-slate-600 mt-1">
                  Poliçe, ihbar formu veya hasar belgesinin fotoğrafını çekin; alanlar otomatik dolsun.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Belgeyi buraya sürükleyebilirsiniz</p>
                <button
                  type="button"
                  disabled={scanning || loadingLookups}
                  onClick={(e) => {
                    e.stopPropagation();
                    documentScanInputRef.current?.click();
                  }}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-blue-200 text-sm font-medium text-blue-700 cursor-pointer hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {scanning ? 'Belge Okunuyor...' : 'Kamera / Galeri'}
                </button>
              </div>
            </div>
          </FileDropZone>

          {/* İhbar Konusu */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              İhbar Konusu <span className="text-status-danger">*</span>
            </label>
            <select
              className={`input-base-sm text-base sm:text-sm ${errors.konu ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
              value={form.konu}
              onChange={(e) => set('konu', e.target.value)}
              disabled={loadingLookups}
            >
              <option value="">{loadingLookups ? 'Konular yükleniyor...' : 'Seçiniz...'}</option>
              {ihbarKonulari.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {lookupError && !loadingLookups && (
              <p className="text-xs text-amber-600 mt-1">{lookupError}</p>
            )}
            {errors.konu && <p className="text-xs text-status-danger mt-1">{errors.konu}</p>}
          </div>

          {/* Sigorta Şirketi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Sigorta Şirketi</label>
            <select
              className={`input-base-sm ${errors.sigortaSirketi ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
              value={form.sigortaSirketi}
              onChange={(e) => set('sigortaSirketi', e.target.value)}
            >
              <option value="">Seçiniz...</option>
              {insuranceCompanies.length > 0
                ? insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                : INSURANCE_COMPANIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)
              }
            </select>
            {errors.sigortaSirketi && <p className="text-xs text-status-danger mt-1">{errors.sigortaSirketi}</p>}
          </div>

          {/* Dosya Numarası */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Dosya Numarası
            </label>
            <input
              type="text"
              className="input-base-sm"
              placeholder="Boş bırakılırsa otomatik üretilir"
              value={form.dosyaNo}
              onChange={(e) => set('dosyaNo', e.target.value)}
            />
          </div>

          {/* Poliçe Türü */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Poliçe Türü <span className="text-status-danger">*</span>
            </label>
            <select
              className={`input-base-sm ${errors.policeTuru ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
              value={form.policeTuru}
              onChange={(e) => set('policeTuru', e.target.value as 'bireysel' | 'ticari' | '')}
            >
              <option value="">Seçiniz...</option>
              <option value="bireysel">Bireysel</option>
              <option value="ticari">Ticari</option>
            </select>
            {errors.policeTuru && <p className="text-xs text-status-danger mt-1">{errors.policeTuru}</p>}
          </div>

          {/* Kurumsal Bilgiler — sadece Ticari seçildiğinde */}
          {form.policeTuru === 'ticari' && (
            <div className="space-y-3">
              {/* Amber uyarı */}
              {(!form.ticariUnvan.trim() || !form.vergiDairesi.trim() || !form.vergiNo.trim()) && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                  <svg className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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
                  className={`input-base-sm ${errors.ticariUnvan ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                  placeholder="Şirket ünvanı"
                  value={form.ticariUnvan}
                  onChange={(e) => set('ticariUnvan', e.target.value)}
                  onBlur={blurTitleCase('ticariUnvan')}
                />
                {errors.ticariUnvan && <p className="text-xs text-status-danger mt-1">{errors.ticariUnvan}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Vergi Dairesi</label>
                  <input
                    className={`input-base-sm ${errors.vergiDairesi ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                    placeholder="Vergi dairesi"
                    value={form.vergiDairesi}
                    onChange={(e) => set('vergiDairesi', e.target.value)}
                    onBlur={blurTitleCase('vergiDairesi')}
                  />
                  {errors.vergiDairesi && <p className="text-xs text-status-danger mt-1">{errors.vergiDairesi}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Vergi Numarası</label>
                  <input
                    className={`input-base-sm ${errors.vergiNo ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                    placeholder="Vergi numarası"
                    value={form.vergiNo}
                    onChange={(e) => set('vergiNo', e.target.value)}
                  />
                  {errors.vergiNo && <p className="text-xs text-status-danger mt-1">{errors.vergiNo}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Sigortalı Adı + Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Sigortalı Adı Soyadı <span className="text-status-danger">*</span>
              </label>
              <input
                className={`input-base-sm ${errors.sigortaliAdi ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                placeholder="Ad Soyad"
                value={form.sigortaliAdi}
                onChange={(e) => set('sigortaliAdi', e.target.value)}
                onBlur={blurTitleCase('sigortaliAdi')}
              />
              {errors.sigortaliAdi && <p className="text-xs text-status-danger mt-1">{errors.sigortaliAdi}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                Sigortalı Telefon <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className={`input-base-sm ${errors.sigortaliTelefon ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                placeholder="0 (5XX) XXX XX XX"
                value={phoneDisplay}
                maxLength={18}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPhoneDisplay(maskPhoneSimple(digits));
                  set('sigortaliTelefon', digits);
                }}
              />
              {errors.sigortaliTelefon && <p className="text-xs text-status-danger mt-1">{errors.sigortaliTelefon}</p>}
            </div>
          </div>

          {/* Hasar Adresi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">
              Hasar Adresi <span className="text-status-danger">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2">
              <div>
                <select
                  className={`input-base-sm w-full ${errors.il ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                  value={form.il}
                  onChange={async (e) => {
                    const provinceId = e.target.value;
                    setForm((prev) => ({ ...prev, il: provinceId, ilce: '' }));
                    if (errors.il || errors.ilce) setErrors((prev) => { const next = { ...prev }; delete next.il; delete next.ilce; return next; });
                    await loadDistricts(provinceId);
                  }}
                >
                  <option value="">İl seçiniz...</option>
                  {provinces.length > 0
                    ? provinces.map((province) => (
                      <option key={province.id} value={province.id}>{province.name}</option>
                    ))
                    : TR_ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
                </select>
                {errors.il && <p className="text-xs text-status-danger mt-1">{errors.il}</p>}
              </div>
              <div>
                <select
                  className={`input-base-sm w-full ${errors.ilce ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                  value={form.ilce}
                  onChange={(e) => set('ilce', e.target.value)}
                  disabled={!form.il || districts.length === 0 || loadingDistricts}
                >
                  <option value="">{loadingDistricts ? 'İlçeler yükleniyor...' : 'İlçe seçiniz...'}</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.name}>{district.name}</option>
                  ))}
                </select>
                {errors.ilce && <p className="text-xs text-status-danger mt-1">{errors.ilce}</p>}
              </div>
            </div>
            <div className="relative">
              <textarea
                className="input-base-sm w-full min-h-[80px] resize-y pr-14 text-base sm:text-sm"
                rows={3}
                placeholder="Mahalle, sokak, bina no, daire…"
                value={form.adresDetay}
                onChange={(e) => set('adresDetay', e.target.value)}
                onBlur={blurTitleCase('adresDetay')}
              />
              <div className="absolute bottom-2 right-2">
                <SpeechToText size="sm" onTranscript={appendSpeech('adresDetay')} />
              </div>
            </div>
          </div>

          {/* İhbar Tarihi */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">İhbar Tarihi</label>
            <TrDateInput
              className={`input-base-sm w-full ${errors.hasarTarihi ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
              value={form.hasarTarihi}
              onChange={(hasarTarihi) => set('hasarTarihi', hasarTarihi)}
              aria-label="İhbar tarihi"
            />
            {errors.hasarTarihi && <p className="text-xs text-status-danger mt-1">{errors.hasarTarihi}</p>}
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Kısa Açıklama</label>
            <div className="relative">
              <textarea
                className="input-base-sm w-full resize-y pr-14 text-base sm:text-sm"
                rows={4}
                placeholder="Hasara dair kısa açıklama..."
                value={form.aciklama}
                onChange={(e) => set('aciklama', e.target.value)}
                onBlur={blurTitleCase('aciklama')}
              />
              <div className="absolute bottom-2 right-2">
                <SpeechToText size="sm" onTranscript={appendSpeech('aciklama')} />
              </div>
            </div>
          </div>

          {/* Fotoğraf */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Fotoğraf Yükle</label>
            <div className="space-y-3">
              <FileDropZone
                accept="image/*"
                multiple
                onFiles={addPhotoFiles}
                className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-5 text-center bg-slate-50 cursor-pointer hover:border-blue-300 transition-colors"
                activeClassName="border-blue-400 bg-blue-50"
              >
                <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-slate-500">Fotoğrafları Sürükleyin veya Seçin</p>
                <p className="text-[11px] text-slate-400 mt-1">Maksimum {MAX_IHBAR_PHOTO_COUNT} adet, dosya başına 10 MB</p>
              </FileDropZone>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                      <img src={photo.previewUrl} alt={photo.file.name} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
                        onClick={() => {
                          URL.revokeObjectURL(photo.previewUrl);
                          setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
                        }}
                      >
                        ×
                      </button>
                      <div className="px-2 py-1.5 text-[11px] text-slate-500 truncate">{photo.file.name}</div>
                    </div>
                  ))}
                </div>
              )}
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
            disabled={saving || loadingLookups || loadingDistricts}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-blue-700 text-white shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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

// ─── Gauge Component (SVG-based animated dial) — referans FINAL ibre + ok ─────

function GaugeChart({
  value,
  displayValue,
  max = 100,
  label,
  subtitle,
  unit = '',
  size = 128,
  trend,
}: {
  value: number;
  displayValue?: number;
  max?: number;
  label: string;
  subtitle?: string;
  unit?: string;
  size?: number;
  trend?: { direction: 'up' | 'down'; label: string } | null;
}) {
  const [animated, setAnimated] = useState(0);
  const shown = displayValue ?? value;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(value), 400);
    return () => clearTimeout(timer);
  }, [value]);

  const pct = Math.min(100, Math.max(0, (animated / Math.max(max, 1)) * 100));
  const cx = size / 2;
  const cy = size * 0.58;
  const r = size * 0.4;
  const strokeWidth = size * 0.095;

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

  // Referans FINAL: mavi → mor → pembe → mercan renk geçişi (tam yay görünür)
  const zones = [
    { from: 0, to: 22, color: '#1D4ED8' },
    { from: 22, to: 42, color: '#4F46E5' },
    { from: 42, to: 58, color: '#7C3AED' },
    { from: 58, to: 74, color: '#C026D3' },
    { from: 74, to: 88, color: '#E11D48' },
    { from: 88, to: 100, color: '#F97316' },
  ];

  const needleDeg = pct * 1.8;
  const needleLen = r * 0.82;
  const tip = polarToXY(needleDeg, needleLen);
  const hubBack = polarToXY(needleDeg, r * 0.08);
  const rad = ((needleDeg - 180) * Math.PI) / 180;
  const baseW = size * 0.038;
  const bx1 = hubBack.x + baseW * Math.cos(rad + Math.PI / 2);
  const by1 = hubBack.y + baseW * Math.sin(rad + Math.PI / 2);
  const bx2 = hubBack.x + baseW * Math.cos(rad - Math.PI / 2);
  const by2 = hubBack.y + baseW * Math.sin(rad - Math.PI / 2);

  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-1 px-1 text-center text-sm font-semibold leading-snug text-slate-700">{label}</p>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} className="flex-shrink-0">
        <path d={arcPath(0, 180)} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} strokeLinecap="round" />
        {zones.map((z) => (
          <path
            key={z.from}
            d={arcPath(z.from * 1.8, z.to * 1.8)}
            fill="none"
            stroke={z.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        ))}
        {/* Gösterge oku (ibre) — referans: sivri üçgen ok + göbek */}
        <polygon
          points={`${tip.x},${tip.y} ${bx1},${by1} ${bx2},${by2}`}
          fill="#0F172A"
          style={{ transition: 'all 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
        <circle cx={cx} cy={cy} r={size * 0.058} fill="#0F172A" />
        <circle cx={cx} cy={cy} r={size * 0.024} fill="#F8FAFC" />
      </svg>
      <p className="mt-1 text-center text-3xl font-bold tabular-nums leading-none text-slate-900">
        {shown}
        {unit}
      </p>
      {subtitle ? (
        <p className="mt-1.5 px-2 text-center text-xs leading-snug text-slate-500">{subtitle}</p>
      ) : null}
      {trend ? (
        <p
          className={`mt-1 text-center text-xs font-semibold ${
            trend.direction === 'up' ? 'text-emerald-600' : 'text-status-danger'
          }`}
        >
          {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
        </p>
      ) : null}
    </div>
  );
}

// ─── Status helpers ─────────────────────────────────────────────────────────────

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', expired: 'Süresi Doldu' };
  return map[s] ?? s;
}

function formatShortDate(value?: string | null) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih yok';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTr(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dakika önce`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  return formatShortDate(value);
}

function fileNumberOf(file?: Pick<ExpertClaimFile, 'fileNo' | 'fileNumber'> | null) {
  return file?.fileNo ?? file?.fileNumber ?? 'Dosya no yok';
}

function activityBadgeFromFile(
  statusName?: string | null,
  statusCode?: string | null,
): { label: string; className: string } {
  const kind = classifyExpertQueue(statusName, statusCode);
  if (kind === 'onay') return { label: 'Onay', className: 'bg-violet-50 text-violet-700' };
  if (kind === 'rapor') return { label: 'Rapor', className: 'bg-orange-50 text-orange-700' };
  const s = (statusName ?? '').toLocaleLowerCase('tr-TR');
  if (/evrak|belge/.test(s)) return { label: 'Evrak', className: 'bg-amber-50 text-amber-800' };
  if (/ihbar/.test(s)) return { label: 'İhbar', className: 'bg-blue-50 text-blue-700' };
  return { label: 'Dosya', className: 'bg-slate-100 text-slate-700' };
}

function ActivityDocIcon() {
  return (
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-600" aria-hidden>
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </span>
  );
}

type WorkloadMetrics = {
  avgFileWaitDays: number | null;
  avgReportWaitDays: number | null;
  avgApprovalWaitDays: number | null;
  closedThisWeek: number;
  closedByDay: number[]; // son 7 gün, eski → yeni
  weeklyActivity: PortalWeeklyPoint[];
};

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatWaitDays(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return '< 1 Gün';
  return `${days.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })} Gün`;
}

function isClosedStatus(name?: string | null): boolean {
  const s = (name ?? '').toLocaleLowerCase('tr-TR');
  return /tamam|kapan|kapandı|kapandi|closed|completed|sonuç|sonuc/.test(s);
}

function computeWorkloadMetrics(
  files: ExpertClaimFile[],
  approvals: ApprovalItem[],
): WorkloadMetrics {
  const fileWaits = files
    .map((f) => daysSince(f.lastActivityAt || f.updatedAt || f.createdAt))
    .filter((d): d is number => d != null);

  const reportWaits = files
    .filter((f) => classifyExpertQueue(f.currentStatus?.name, f.currentStatus?.code) === 'rapor')
    .map((f) => daysSince(f.lastActivityAt || f.updatedAt || f.createdAt))
    .filter((d): d is number => d != null);

  const approvalWaits = approvals
    .filter((a) => a.status === 'pending')
    .map((a) => daysSince(a.sentAt || a.createdAt || a.expiresAt))
    .filter((d): d is number => d != null);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const closedByDay = Array.from({ length: 7 }, () => 0);
  let closedThisWeek = 0;
  for (const f of files) {
    if (!isClosedStatus(f.currentStatus?.name)) continue;
    const raw = f.lastActivityAt || f.updatedAt || f.createdAt;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    const dayOffset = Math.floor((startOfToday - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000);
    if (dayOffset >= 0 && dayOffset < 7) {
      closedByDay[6 - dayOffset] += 1;
      closedThisWeek += 1;
    }
  }

  return {
    avgFileWaitDays: avg(fileWaits),
    avgReportWaitDays: avg(reportWaits),
    avgApprovalWaitDays: avg(approvalWaits),
    closedThisWeek,
    closedByDay,
    weeklyActivity: buildPortalWeeklyActivity(files),
  };
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function EksperPortalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [assignedCount, setAssignedCount] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);
  const [onaylananCount, setOnaylananCount] = useState<number>(0);
  const [assignedFiles, setAssignedFiles] = useState<ExpertClaimFile[]>([]);
  const [recentApprovals, setRecentApprovals] = useState<ApprovalItem[]>([]);
  const [workload, setWorkload] = useState<WorkloadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvalLoadWarning, setApprovalLoadWarning] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showIhbarModal, setShowIhbarModal] = useState(false);
  const [successFileNo, setSuccessFileNo] = useState<string | null>(null);

  const applyFilesPayload = useCallback((
    files: { data?: ExpertClaimFile[]; meta?: { total?: number } } | null,
    approvalsForWorkload?: ApprovalItem[],
  ) => {
    const list = files?.data ?? [];
    const queues = countExpertQueues(list);
    setAssignedCount(files?.meta?.total ?? list.length);
    setAssignedFiles(list.slice(0, 5));
    setReviewCount(queues.onay);
    setReportCount(queues.rapor);
    setOnaylananCount(queues.onaylanan);
    setWorkload(computeWorkloadMetrics(list, approvalsForWorkload ?? []));
  }, []);

  const handleIhbarSuccess = useCallback((fileNo: string) => {
    setShowIhbarModal(false);
    setSuccessFileNo(fileNo);
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    const expertUserId = u?.id;
    if (!expertUserId) return;
    Promise.all([
      fetch(`${API}/external-approvals/pending?approverType=expert&approverId=${expertUserId}&includeExpired=true`, { headers: getHeaders() }).then((r) => r.json()),
      fetch(`${API}/claim-files?limit=50`, { headers: getHeaders() }).then((r) => r.json()),
    ])
      .then(([approvals, files]) => {
        const list: ApprovalItem[] = approvals?.data ?? [];
        setRecentApprovals(list.slice(0, 5));
        applyFilesPayload(files, list);
      })
      .catch(() => {});
  }, [applyFilesPayload]);

  useEffect(() => {
    if (searchParams.get('openIhbar') === '1') {
      setShowIhbarModal(true);
      router.replace('/panel/eksper-portal', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') { setLoading(false); setAccessDenied(true); return; }
    setUser(u);

    const expertUserId = u.id;
    if (!expertUserId) { setLoading(false); setLoadError('Kullanıcı oturumu geçersiz. Lütfen tekrar giriş yapın.'); return; }

    setLoadError(null);
    setApprovalLoadWarning(null);
    Promise.allSettled([
      fetch(`${API}/external-approvals/pending?approverType=expert&approverId=${expertUserId}&includeExpired=true`, { headers: getHeaders() }).then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          const msg = body?.message ?? body?.code ?? 'Onay listesi yüklenemedi';
          throw new Error(typeof msg === 'string' ? msg : 'Onay listesi yüklenemedi');
        }
        return body;
      }),
      fetch(`${API}/claim-files?limit=50`, { headers: getHeaders() }).then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          throw new Error(body?.message ?? 'Dosya listesi yüklenemedi');
        }
        return body;
      }),
    ])
      .then(([approvalsResult, filesResult]) => {
        let approvalList: ApprovalItem[] = [];
        if (approvalsResult.status === 'fulfilled') {
          approvalList = approvalsResult.value?.data ?? [];
          setRecentApprovals(approvalList.slice(0, 5));
        } else {
          setRecentApprovals([]);
          setApprovalLoadWarning(approvalsResult.reason?.message ?? 'Onay listesi yüklenemedi');
        }

        if (filesResult.status === 'fulfilled') {
          applyFilesPayload(filesResult.value, approvalList);
        } else {
          setAssignedCount(0);
          setAssignedFiles([]);
          setReviewCount(0);
          setReportCount(0);
          setOnaylananCount(0);
          setWorkload(computeWorkloadMetrics([], approvalList));
          setLoadError(filesResult.reason?.message ?? 'Dosya listesi yüklenemedi');
        }
      })
      .finally(() => setLoading(false));
  }, [router, applyFilesPayload]);

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
        <Link href="/panel" className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Dashboard&apos;a Dön</Link>
      </div>
    );
  }

  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Eksper';

  // Düşük hacimde ibre «yarı dolu» görünmesin — taban ölçek 50
  const gaugeMax = Math.max(50, assignedCount, reviewCount, reportCount, onaylananCount);

  const queueChip = (count: number, tone: 'amber' | 'orange' | 'rose') => {
    const map = {
      amber: 'bg-amber-100 text-amber-800',
      orange: 'bg-orange-100 text-orange-800',
      rose: 'bg-rose-100 text-rose-800',
    };
    return (
      <span className={`ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${map[tone]}`}>
        {count}
      </span>
    );
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => setShowIhbarModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Yeni İhbar
      </button>
      <Link
        href="/panel/eksper-portal/dosyalar"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Dosyalarım
      </Link>
      <Link
        href="/panel/eksper-portal/dosyalar?queue=onay"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Onay Bekliyor
        {queueChip(reviewCount, 'rose')}
      </Link>
      <Link
        href="/panel/eksper-portal/dosyalar?queue=rapor"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Rapor Bekleyenler
        {queueChip(reportCount, 'orange')}
      </Link>
      <Link
        href="/panel/eksper-portal/dosyalar?queue=onaylanan"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Onaylanan Dosyalar
        {queueChip(onaylananCount, 'amber')}
      </Link>
    </>
  );

  const activityEmpty = recentApprovals.length === 0 && assignedFiles.length === 0;

  return (
    <DashboardShell>
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}
        {approvalLoadWarning && !loadError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {approvalLoadWarning}
          </div>
        )}

        <div className="space-y-3 border-b border-slate-200/80 pb-3 dark:border-slate-800 [&>div:first-child]:border-b-0 [&>div:first-child]:pb-0">
          <DashboardHeader
            title="Eksper Paneli"
            subtitle={`Hoş Geldiniz, ${userName}`}
            hideDefaultActions
            actions={<ExpertPortalContactStrip compact />}
          />

          <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
            {headerActions}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <GaugeChart
              value={Math.min(assignedCount, gaugeMax)}
              displayValue={assignedCount}
              max={gaugeMax}
              label="Dosyalarım (Aktif)"
              subtitle="Aktif dosya"
            />
          </div>
          <Link href="/panel/eksper-portal/dosyalar?queue=onay" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <GaugeChart
              value={Math.min(reviewCount, gaugeMax)}
              displayValue={reviewCount}
              max={gaugeMax}
              label="Onay Bekliyor"
              subtitle="Onay bekleyen"
            />
          </Link>
          <Link href="/panel/eksper-portal/dosyalar?queue=rapor" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <GaugeChart
              value={Math.min(reportCount, gaugeMax)}
              displayValue={reportCount}
              max={gaugeMax}
              label="Rapor Bekleyenler"
              subtitle="Rapor bekleyen"
            />
          </Link>
          <Link href="/panel/eksper-portal/dosyalar?queue=onaylanan" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
            <GaugeChart
              value={Math.min(onaylananCount, gaugeMax)}
              displayValue={onaylananCount}
              max={gaugeMax}
              label="Onaylanan Dosyalar"
              subtitle="Onayı tamamlanan"
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Güncel Dosya Hareketleri</h3>
              <Link href="/panel/eksper-portal/dosyalar" className="text-xs font-semibold text-brand-600 hover:underline">
                Tümünü Gör →
              </Link>
            </div>
            {activityEmpty ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <p className="text-sm font-medium text-slate-500">Bugün Gösterilecek Dosya Hareketi Yok</p>
                <p className="text-xs text-slate-400">Yeni ihbar veya onay talebi oluştuğunda burada görünecek.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {recentApprovals.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/panel/eksper-portal/dosyalar?queue=onaylanan"
                      className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
                    >
                      <ActivityDocIcon />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {fileNumberOf(a.report?.claimFile) ?? a.report?.reportNo ?? a.report?.reportNumber ?? `Dosya #${a.id.slice(-6)}`}
                          </span>
                          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                            Onay
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {statusLabel(a.status)}
                          {a.expiresAt ? ` · ${formatRelativeTr(a.expiresAt) || formatShortDate(a.expiresAt)}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {assignedFiles.slice(0, Math.max(0, 5 - recentApprovals.length)).map((file) => {
                  const statusLabel = portalStatusLabel(file.currentStatus?.code, file.currentStatus?.name);
                  const badge = activityBadgeFromFile(file.currentStatus?.name, file.currentStatus?.code);
                  return (
                    <li key={file.id}>
                      <Link
                        href="/panel/eksper-portal/dosyalar"
                        className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
                      >
                        <ActivityDocIcon />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{fileNumberOf(file)}</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {statusLabel}
                            {file.lastActivityAt || file.updatedAt
                              ? ` · ${formatRelativeTr(file.lastActivityAt || file.updatedAt)}`
                              : ''}
                            {file.insuranceCompany?.name ? ` · ${file.insuranceCompany.name}` : ''}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/panel/eksper-portal/dosyalar"
              className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:underline"
            >
              Tüm Hareketler →
            </Link>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Süre Analizi</h3>
            <p className="mt-1 text-xs leading-snug text-slate-500">
              Dosya süreçlerinin genel görünümü. Performans puanı değildir.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              <li className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-xs font-medium text-slate-600">Ortalama Dosya Bekleme Süresi</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatWaitDays(workload?.avgFileWaitDays ?? null)}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-xs font-medium text-slate-600">Ortalama Rapor Hazırlama Süresi</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatWaitDays(workload?.avgReportWaitDays ?? null)}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-xs font-medium text-slate-600">Ortalama Onay Bekleme Süresi</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatWaitDays(workload?.avgApprovalWaitDays ?? null)}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-xs font-medium text-slate-600">Bu Hafta Tamamlanan Dosya</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {workload ? workload.closedThisWeek : '—'}
                </span>
              </li>
            </ul>
          </article>

          <PortalWeeklyTrendCard
            title="Haftalık Dosya Hareketi"
            data={workload?.weeklyActivity ?? []}
          />
        </div>

      {showIhbarModal && (
        <IhbarModal
          onClose={() => setShowIhbarModal(false)}
          onSuccess={handleIhbarSuccess}
        />
      )}

      {successFileNo && (
        <IhbarSuccessToast
          fileNo={successFileNo}
          onClose={() => setSuccessFileNo(null)}
        />
      )}
    </DashboardShell>
  );
}
