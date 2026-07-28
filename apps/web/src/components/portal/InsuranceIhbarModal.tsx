'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import SpeechToText from '@/components/SpeechToText';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

const MAX_IHBAR_PHOTO_COUNT = 6;
const MAX_IHBAR_PHOTO_SIZE = 10 * 1024 * 1024;

const WIZARD_STEPS = [
  { id: 1 as const, label: 'İhbar Bilgisi' },
  { id: 2 as const, label: 'Sigortalı Ve Adres' },
  { id: 3 as const, label: 'Açıklama Ve Fotoğraf' },
];

type WizardStep = (typeof WIZARD_STEPS)[number]['id'];

type IhbarFormData = {
  dosyaNo: string;
  policeTuru: 'bireysel' | 'ticari' | '';
  konu: string;
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
type UploadItem = { id: string; file: File; previewUrl: string };

export type InsuranceIhbarModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (fileNo: string) => void;
  lockedInsuranceCompanyId: string;
  lockedInsuranceCompanyName?: string;
};

function authHeaders(extra?: Record<string, string>) {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

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

function normalizeApiMessage(body: unknown, fallback: string) {
  const record = body as { message?: string | string[]; error?: { message?: string } } | null;
  if (Array.isArray(record?.message)) return record.message.join(', ');
  return record?.message ?? record?.error?.message ?? fallback;
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

const EMPTY_FORM: IhbarFormData = {
  dosyaNo: '',
  policeTuru: '',
  konu: '',
  ticariUnvan: '',
  vergiDairesi: '',
  vergiNo: '',
  sigortaliAdi: '',
  sigortaliTelefon: '',
  il: '',
  ilce: '',
  adresDetay: '',
  hasarTarihi: '',
  aciklama: '',
};

function InsuranceIhbarModal({
  open,
  onClose,
  onSuccess,
  lockedInsuranceCompanyId,
  lockedInsuranceCompanyName,
}: InsuranceIhbarModalProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<WizardStep>(1);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [ihbarKonulari, setIhbarKonulari] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState<IhbarFormData>(EMPTY_FORM);
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof IhbarFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [photos, setPhotos] = useState<UploadItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(EMPTY_FORM);
    setPhoneDisplay('');
    setErrors({});
    setDistricts([]);
    setPhotos((prev) => {
      prev.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoadingLookups(true);
      setLookupError(null);
      try {
        if (!getAccessToken()) {
          setLookupError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
          return;
        }
        const [provinceResponse, konuResponse] = await Promise.all([
          fetch(`${API}/locations/provinces`, { headers: authHeaders() }),
          fetch(`${API}/claim-subjects/active?category=hasar`, { headers: authHeaders() }),
        ]);
        const [provinceBody, konuBody] = await Promise.all([
          provinceResponse.json().catch(() => null),
          konuResponse.json().catch(() => null),
        ]);
        if (!active) return;
        setProvinces(provinceResponse.ok ? (provinceBody?.data ?? []) : []);
        if (konuResponse.ok && konuBody?.data) {
          const subjects = konuBody.data ?? [];
          setIhbarKonulari(subjects.map((s: { code: string; name: string }) => ({ value: s.code, label: s.name })));
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
  }, [open]);

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
      const response = await fetch(`${API}/locations/provinces/${provinceId}/districts`, {
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(normalizeApiMessage(body, 'İlçe listesi yüklenemedi'));
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

  const STEP1_KEYS: (keyof IhbarFormData)[] = ['dosyaNo', 'policeTuru', 'konu', 'ticariUnvan', 'vergiDairesi', 'vergiNo'];
  const STEP2_KEYS: (keyof IhbarFormData)[] = ['sigortaliAdi', 'sigortaliTelefon', 'il', 'ilce', 'adresDetay'];
  const STEP3_KEYS: (keyof IhbarFormData)[] = ['hasarTarihi'];

  const collectValidationErrors = (targetStep: WizardStep, data: IhbarFormData) => {
    const e: Partial<Record<keyof IhbarFormData, string>> = {};

    if (targetStep >= 1) {
      if (!data.dosyaNo.trim()) e.dosyaNo = 'Dosya numarası zorunludur';
      if (!data.policeTuru) e.policeTuru = 'Zorunlu alan';
      if (!data.konu) e.konu = 'Zorunlu alan';
      if (data.policeTuru === 'ticari') {
        if (!data.ticariUnvan.trim()) e.ticariUnvan = 'Zorunlu alan';
        if (!data.vergiDairesi.trim()) e.vergiDairesi = 'Zorunlu alan';
        if (!data.vergiNo.trim()) e.vergiNo = 'Zorunlu alan';
      }
    }

    if (targetStep >= 2) {
      if (!data.sigortaliAdi.trim()) e.sigortaliAdi = 'Zorunlu alan';
      if (!data.sigortaliTelefon || data.sigortaliTelefon.replace(/\D/g, '').length < 10) {
        e.sigortaliTelefon = 'Geçerli telefon giriniz';
      }
      if (!data.il) e.il = 'Zorunlu alan';
      if (data.il && !data.ilce) e.ilce = 'Zorunlu alan';
      if (!data.adresDetay.trim()) e.adresDetay = 'Zorunlu alan';
    }

    if (targetStep >= 3) {
      if (data.hasarTarihi && !toIsoDate(data.hasarTarihi)) e.hasarTarihi = 'Geçerli tarih giriniz';
    }

    return e;
  };

  const firstInvalidStep = (e: Partial<Record<keyof IhbarFormData, string>>): WizardStep | null => {
    if (STEP1_KEYS.some((key) => e[key])) return 1;
    if (STEP2_KEYS.some((key) => e[key])) return 2;
    if (STEP3_KEYS.some((key) => e[key])) return 3;
    return null;
  };

  const validateStep = (targetStep: WizardStep, data: IhbarFormData) => {
    const e = collectValidationErrors(targetStep, data);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateAll = (data: IhbarFormData) => {
    const e = collectValidationErrors(3, data);
    setErrors(e);
    if (Object.keys(e).length === 0) return true;
    const invalidStep = firstInvalidStep(e);
    if (invalidStep) setStep(invalidStep);
    return false;
  };

  const uploadPhotos = useCallback(async (reportId: string) => {
    if (photos.length === 0) return;
    await Promise.all(photos.map(async (photo) => {
      const formData = new FormData();
      formData.append('file', photo.file);
      const response = await fetch(`${API}/repair-reports/${reportId}/images`, {
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

  const handleNext = () => {
    const normalizedForm = normalizeIhbarTextFields(form);
    setForm(normalizedForm);
    if (!validateStep(step, normalizedForm)) {
      showToast('error', 'Lütfen zorunlu alanları kontrol edin.');
      return;
    }
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const handleSubmit = async () => {
    if (saving || loadingLookups || loadingDistricts) return;
    const normalizedForm = normalizeIhbarTextFields(form);
    setForm(normalizedForm);
    if (!validateAll(normalizedForm)) {
      showToast('error', 'Lütfen zorunlu alanları kontrol edin.');
      return;
    }
    if (!lockedInsuranceCompanyId || !isUuid(lockedInsuranceCompanyId)) {
      showToast('error', 'Sigorta şirketi bilgisi eksik. Lütfen oturumu yenileyin.');
      return;
    }
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }
      const provinceName = provinces.find((province) => province.id === normalizedForm.il)?.name ?? '';
      const fileNoValue = normalizedForm.dosyaNo.trim();
      if (!fileNoValue) {
        showToast('error', 'Dosya numarası zorunludur.');
        setStep(1);
        setSaving(false);
        return;
      }
      const payload = {
        fileNo: fileNoValue,
        productBranch: normalizedForm.konu,
        insuranceCompanyId: lockedInsuranceCompanyId,
        policyNo: 'Belirtilmedi',
        claimNo: `HN-${fileNoValue}`.slice(0, 64),
        lossType: normalizedForm.konu,
        description: normalizedForm.aciklama.trim() || undefined,
        incidentDate: toIsoDate(normalizedForm.hasarTarihi) ?? new Date().toISOString(),
        notificationDate: new Date().toISOString(),
        priority: 'normal',
        sourceChannel: 'insurance_portal',
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
      const res = await fetch(`${API}/claim-files`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        const claimFileId = body?.data?.id;
        let photoUploadFailed = false;
        if (claimFileId) {
          const reportResponse = await fetch(`${API}/claim-files/${claimFileId}/repair-reports`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              reportType: 'single',
              reportDate: new Date().toISOString(),
              findingsText: normalizedForm.aciklama.trim() || 'Sigorta portalı ihbar fotoğrafları',
            }),
          });
          const reportBody = await reportResponse.json().catch(() => null);
          if (!reportResponse.ok) {
            throw new Error(normalizeApiMessage(reportBody, 'İhbar sonrası rapor oluşturulamadı.'));
          }
          const reportId = reportBody?.data?.id;
          if (reportId && photos.length > 0) {
            try {
              await uploadPhotos(reportId);
            } catch (uploadError: unknown) {
              photoUploadFailed = true;
              console.error(uploadError);
            }
          }
        }
        const fileNo = body?.data?.fileNo ?? body?.data?.fileNumber ?? fileNoValue;
        if (photoUploadFailed) {
          showToast(
            'error',
            `İhbar kaydedildi (Dosya no: ${fileNo}) ancak fotoğraf yüklenemedi. Dosyadan tekrar deneyin.`,
          );
        } else {
          showToast('success', `İhbar başarıyla gönderildi. Dosya no: ${fileNo}`);
        }
        onSuccess(fileNo);
        onClose();
      } else {
        throw new Error(normalizeApiMessage(body, 'İhbar gönderilemedi. Lütfen tekrar deneyin.'));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'İhbar gönderilemedi. Lütfen tekrar deneyin.';
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insurance-ihbar-modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 id="insurance-ihbar-modal-title" className="text-base font-bold text-slate-800">Yeni İhbar</h2>
              <p className="text-xs text-slate-500">Hasar bilgilerini girin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Kapat"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 pb-2 pt-4">
          <div className="flex items-center gap-2">
            {WIZARD_STEPS.map((wizardStep, index) => {
              const active = step === wizardStep.id;
              const completed = step > wizardStep.id;
              return (
                <div key={wizardStep.id} className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active
                          ? 'bg-brand-600 text-white'
                          : completed
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {wizardStep.id}
                    </span>
                    <span className={`truncate text-xs font-medium ${active ? 'text-brand-700' : 'text-slate-500'}`}>
                      {wizardStep.label}
                    </span>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={`h-px min-w-[12px] flex-1 ${completed ? 'bg-brand-200' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Sigorta Şirketi
                </label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  className="input-base-sm cursor-not-allowed bg-slate-50 text-slate-700"
                  value={lockedInsuranceCompanyName?.trim() || 'Sigorta Şirketi'}
                />
              </div>

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
                  <p className="text-xs text-status-warning mt-1">{lookupError}</p>
                )}
                {errors.konu && <p className="text-xs text-status-danger mt-1">{errors.konu}</p>}
              </div>

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

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Dosya No <span className="text-status-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`input-base-sm ${errors.dosyaNo ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                  placeholder="Hasar dosya numarasını girin"
                  value={form.dosyaNo}
                  onChange={(e) => set('dosyaNo', e.target.value)}
                />
                {errors.dosyaNo && <p className="text-xs text-status-danger mt-1">{errors.dosyaNo}</p>}
              </div>

              {form.policeTuru === 'ticari' && (
                <div className="space-y-3">
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
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      Ticari Unvan <span className="text-status-danger">*</span>
                    </label>
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
                      <label className="text-xs font-medium text-slate-600 block mb-1.5">
                        Vergi Dairesi <span className="text-status-danger">*</span>
                      </label>
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
                      <label className="text-xs font-medium text-slate-600 block mb-1.5">
                        Vergi No <span className="text-status-danger">*</span>
                      </label>
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
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">
                    Sigortalı Adı <span className="text-status-danger">*</span>
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
                    Telefon <span className="text-status-danger">*</span>
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

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Adres <span className="text-status-danger">*</span>
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
                      {provinces.map((province) => (
                        <option key={province.id} value={province.id}>{province.name}</option>
                      ))}
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
                    className={`input-base-sm w-full min-h-[80px] resize-y pr-14 text-base sm:text-sm ${errors.adresDetay ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
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
                {errors.adresDetay && <p className="text-xs text-status-danger mt-1">{errors.adresDetay}</p>}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Hasar Tarihi</label>
                <TrDateInput
                  className={`input-base-sm w-full ${errors.hasarTarihi ? 'border-red-400 ring-2 ring-status-danger/20' : ''}`}
                  value={form.hasarTarihi}
                  onChange={(hasarTarihi) => set('hasarTarihi', hasarTarihi)}
                  aria-label="Hasar tarihi"
                />
                {errors.hasarTarihi && <p className="text-xs text-status-danger mt-1">{errors.hasarTarihi}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Açıklama</label>
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

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Fotoğraf Yükle</label>
                <div className="space-y-3">
                  <FileDropZone
                    accept="image/*"
                    multiple
                    onFiles={addPhotoFiles}
                    className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-5 text-center bg-slate-50 cursor-pointer hover:border-brand-300 transition-colors"
                    activeClassName="border-brand-400 bg-brand-50"
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
                            aria-label="Fotoğrafı kaldır"
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
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60"
              >
                Geri
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              disabled={saving}
            >
              İptal
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loadingLookups || loadingDistricts}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                İleri
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || loadingLookups || loadingDistricts}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Gönder
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsuranceIhbarModal;
