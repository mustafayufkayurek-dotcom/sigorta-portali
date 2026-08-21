'use client';

/**
 * Acil dosya — Hasar canlı kabuğunun lokal kopyası.
 * Referans: /panel/hasar-dosyalari/[id] (DosyaSayfaUstu + Saha Tespit + Operasyon Planlayıcısı)
 */

import { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { Camera, Check, X } from 'lucide-react';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { formatEmergencyFileAddress } from '@/utils/emergency-file-address';
import { toWhatsAppLink } from '@/utils/date-helpers';
import type { VendorRecommendation } from '@/utils/emergencyApi';
import {
  OPERATOR_STEPS,
  PlannerStepBody,
  CallPhone,
  type ApprovalChannel,
  type ApprovalState,
  type OperatorStepKey,
} from './planner-steps';
import { validateOperatorStep } from './planner-gates';

type StepStatus = 'done' | 'waiting' | 'future';

const C = { active: '#F59E0B', done: '#16A34A', pending: '#CBD5E1' } as const;

const FILE = {
  fileNo: 'RCS-20261805434',
  customer: 'Anadolu Sigorta',
  customerEmail: 'operasyon@anadolusigorta.com.tr',
  customerPhone: '0216 555 10 10',
  insured: 'Yeşim Sultan Tatar',
  phone: '0532 000 00 00',
  subject: 'Çilingir-Konut',
  ihbarDate: '18.08.2026',
  owner: 'Ayşe Yılmaz',
  ownerInitials: 'AY',
  ownerContact: '0532 111 22 33',
  status: 'Yeni İhbar',
  notes: 'Kapı kilidi arızalı. Sigortalı evde bekliyor.',
  address: 'Gazi Mah. İlhan Akgün Cad. Sarıgelin Apt A Blok No: 72 Daire: 10',
  district: 'Anamur',
  city: 'Mersin',
  locationUrl: 'https://maps.google.com/?q=Anamur+Mersin',
  appointmentDate: '21.08.2026',
  appointmentTime: '11:00',
  durationMinutes: '45',
};

const PREVIEW_VENDORS: VendorRecommendation[] = [
  {
    id: 'v1',
    name: 'Mehmet Ali Sevinç',
    phone: '0324 555 01 01',
    city: 'Mersin',
    district: 'Anamur',
    avgResponseTime: null,
    avgServiceScore: 4.7,
    avgCost: 950,
    completedFileCount: 18,
    compositeScore: 94,
    serviceBranches: ['Çilingir', 'Konut'],
    lastWorkedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  },
  {
    id: 'v2',
    name: 'Anamur Acil Çilingir',
    phone: '0324 555 02 02',
    city: 'Mersin',
    district: 'Anamur',
    avgResponseTime: null,
    avgServiceScore: 4.2,
    avgCost: 1100,
    completedFileCount: 9,
    compositeScore: 86,
    serviceBranches: ['Çilingir'],
    lastWorkedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: 'v3',
    name: 'Mersin Kapı Servis',
    phone: '0324 555 03 03',
    city: 'Mersin',
    district: 'Yenişehir',
    avgResponseTime: null,
    avgServiceScore: 4.0,
    avgCost: 1250,
    completedFileCount: 6,
    compositeScore: 78,
    serviceBranches: ['Konut'],
    lastWorkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  },
  {
    id: 'v4',
    name: 'Bozyazı Destek',
    phone: '0324 555 04 04',
    city: 'Mersin',
    district: 'Bozyazı',
    avgResponseTime: null,
    avgServiceScore: null,
    avgCost: null,
    completedFileCount: 2,
    compositeScore: 61,
    rank: 4,
    serviceBranches: ['Çilingir'],
  },
];

function openPreviewWhatsApp(phone: string, text: string) {
  const url = toWhatsAppLink(phone, text) ?? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}



function FlowStepDot({ status, active, n }: { status: StepStatus; active: boolean; n: number }) {
  if (status === 'done' && !active) {
    return (
      <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: C.done }}>
        {n}
      </span>
    );
  }
  if (active || status === 'waiting') {
    return (
      <span
        className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{ backgroundColor: C.active, boxShadow: '0 0 0 4px #FDBA7455' }}
      >
        {n}
      </span>
    );
  }
  return (
    <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-400 text-[12px] font-bold text-white">
      {n}
    </span>
  );
}

function PreviewInner() {
  const { showToast } = useToast();
  const [fileInfoOpen, setFileInfoOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeStep, setActiveStep] = useState<OperatorStepKey>('tedarikci_saha');
  const [assigned, setAssigned] = useState<string | null>('v1');
  const [alis, setAlis] = useState('950');
  const [satis, setSatis] = useState('1.350');
  const [workStartOk, setWorkStartOk] = useState(false);
  const [fileClosed, setFileClosed] = useState(false);
  const [hakedisAt, setHakedisAt] = useState<string | null>(null);
  const [financeSent, setFinanceSent] = useState(false);
  const [financeAt, setFinanceAt] = useState<string | null>(null);
  const [approvalChannel, setApprovalChannel] = useState<ApprovalChannel>('email');
  const [approvalState, setApprovalState] = useState<ApprovalState>('bekliyor');
  const [approvalRequestedAt] = useState('21.08.2026 10:42');
  const [approvalDecidedAt, setApprovalDecidedAt] = useState<string | null>(null);
  const [approvalText, setApprovalText] = useState(
    'Maliyet uygun. Onaylıyorum. Tedarikçi bugün içinde müdahale edebilir.',
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [waLog, setWaLog] = useState<Array<{ at: string; to: string; text: string }>>([
    { at: '21.08.2026 09:18', to: 'Tedarikçi', text: 'Dosya atandı. Adres ve randevu bilgisi gönderildi.' },
  ]);
  const [sahaPhotos, setSahaPhotos] = useState<Array<{ url: string; label: string; at: string }>>([
    { url: '/dev/acil-preview/kapi.svg', label: 'Kapı önü', at: '21.08.2026 14:12' },
    { url: '/dev/acil-preview/kilit.svg', label: 'Kilit yakın', at: '21.08.2026 14:13' },
    { url: '/dev/acil-preview/bitis.svg', label: 'İş bitişi', at: '21.08.2026 15:40' },
    { url: '/dev/acil-preview/onay.svg', label: 'Sigortalı onayı', at: '21.08.2026 15:41' },
  ]);

  const assignedVendor = useMemo(
    () => PREVIEW_VENDORS.find((v) => v.id === assigned) ?? null,
    [assigned],
  );

  function nowLabel() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function sendWhatsApp(to: 'Tedarikçi' | 'Müşteri' | 'Sigortalı', phone: string, text: string) {
    openPreviewWhatsApp(phone, text);
    setWaLog((prev) => [{ at: nowLabel(), to, text }, ...prev]);
    showToast('success', 'WhatsApp mesajı hazırlandı');
  }

  function addSahaFiles(files: FileList | null) {
    if (!files?.length) return;
    const at = nowLabel();
    const added = Array.from(files)
      .filter((f) => f.type.startsWith('image/') || !f.type)
      .map((f) => ({
        url: URL.createObjectURL(f),
        label: f.name.replace(/\.[^.]+$/, '') || 'Tespit',
        at,
      }));
    if (added.length === 0) return;
    setSahaPhotos((prev) => [...added, ...prev]);
    showToast('success', 'Fotoğraf eklendi');
  }

  function saveCurrentStep() {
    const err = validateOperatorStep(activeStep, {
      assigned,
      alis,
      satis,
      workStartOk,
      fileClosed,
      financeSent,
      approvalState,
      approvalText,
    });
    if (err) {
      setSaveError(err);
      showToast('error', err);
      return;
    }
    setSaveError(null);
    showToast('success', 'Adım kaydedildi');
  }

  const operatorStatus: Record<OperatorStepKey, StepStatus> = {
    ihbar: 'done',
    tedarikci_saha: assigned ? (workStartOk ? 'done' : 'waiting') : 'waiting',
    maliyet: alis.trim() ? 'done' : assigned ? 'waiting' : 'future',
    onay: approvalState === 'onaylandi' ? 'done' : alis.trim() ? 'waiting' : 'future',
    kapanis: fileClosed ? 'done' : workStartOk ? 'waiting' : 'future',
    finans: financeSent ? 'done' : fileClosed ? 'waiting' : 'future',
  };
  const address = formatEmergencyFileAddress({
    address: FILE.address,
    district: FILE.district,
    city: FILE.city,
  });
  const mailAddress = formatEmergencyFileAddress({
    address:
      'Esenler Okulyolu Sırça Köşkler Sitesi A Blok No : 8 / 1 Daire : 2 Merkez - Türkiye - Çanakkale',
    district: null,
    city: null,
  });
  const steps = OPERATOR_STEPS.map((s, i) => ({
    ...s,
    n: i + 1,
    status: operatorStatus[s.key],
  }));
  const activeMeta = steps.find((s) => s.key === activeStep) ?? steps[0];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
        Lokal Önizleme · Canlı Acil’de Operasyon Planlayıcısı + Saha Tespit durur
      </div>

      <div className="px-4 py-4">
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-4">
            <span className="mt-0.5 shrink-0 text-sm text-slate-400">← Geri</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400">Hasar Dosya No</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-all text-lg font-bold leading-snug text-slate-900">{FILE.fileNo}</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {FILE.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-slate-500">
                    Sigorta Şirketi: <span className="font-semibold text-slate-700">{FILE.customer}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    Dosya Sorumlusu:{' '}
                    <span className="font-semibold text-slate-700">{FILE.owner}</span>
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  <span className="text-xs font-normal text-slate-400">Sigortalı Adı Soyadı: </span>
                  {FILE.insured}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  <span className="text-xs font-normal text-slate-400">Sigortalı Telefon: </span>
                  <CallPhone phone={FILE.phone} className="font-medium text-brand-600 hover:underline" />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className="text-slate-400">Dosya Konusu: </span>
                  <span className="font-medium text-slate-700">{FILE.subject}</span>
                </p>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-blue-100/80 bg-blue-50/60 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                {FILE.customer.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] leading-none text-blue-500">Müşteri</p>
                <p className="truncate text-sm font-semibold text-blue-900">{FILE.customer}</p>
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] leading-none text-blue-500">Telefon</p>
              <CallPhone phone={FILE.customerPhone} className="text-sm font-medium text-blue-800 hover:underline" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] leading-none text-blue-500">E-Posta</p>
              <p className="truncate text-sm font-medium text-blue-800">{FILE.customerEmail}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            <span className="shrink-0 text-slate-400">Adres</span>
            <span className="font-medium" data-testid="acil-onizleme-adres">
              {address}
            </span>
          </div>
          <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            <span className="shrink-0 text-slate-400">Mail adresi (örnek)</span>
            <span className="font-medium">{mailAddress}</span>
          </div>

          <div className="border-t border-slate-100" data-testid="dosya-bilgileri">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5">
              <button type="button" onClick={() => setFileInfoOpen((v) => !v)} className="min-w-0 flex-1 text-left">
                <p className="text-[11px] font-semibold text-slate-600">Dosya Bilgileri</p>
                {!fileInfoOpen ? (
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    İhbar {FILE.ihbarDate} · {FILE.owner}
                  </p>
                ) : null}
              </button>
              <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-blue-50">
                Düzenle
              </button>
              <button type="button" onClick={() => setFileInfoOpen((v) => !v)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                {fileInfoOpen ? 'Gizle' : 'Detay'}
              </button>
            </div>
            {fileInfoOpen ? (
              <div className="border-t border-slate-100 bg-slate-50/40 px-4 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">İhbar Tarihi</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{FILE.ihbarDate}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">Dosya Konusu</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{FILE.subject}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">Sigortalı Telefon</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">
                      <CallPhone phone={FILE.phone} className="font-medium text-brand-600 hover:underline" />
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">Dosya Sorumlusu</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{FILE.owner}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">Güncel Durum</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{FILE.status}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-[11px] text-slate-400">Adres</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-800">{address}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">Saha Tespit</h3>
              <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Tespit Yapılmadı</span>
            </div>
            <p className="text-[11px] text-slate-500">Saha tespiti bekleniyor</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-700">Tespit Fotoğrafları</h4>
              <p className="mb-2 text-xs text-slate-500">
                {sahaPhotos.length} fotoğraf · çekimden sonra burada görünür
              </p>
              <ul className="mb-3 grid grid-cols-2 gap-2">
                {sahaPhotos.map((ph) => (
                  <li key={ph.url} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt={ph.label} className="h-28 w-full object-cover" />
                    <p className="px-2 py-1 text-[11px] font-medium text-slate-700">{ph.label}</p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <input
                  id="acil-preview-kamera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    addSahaFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  id="acil-preview-galeri"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addSahaFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('acil-preview-kamera')?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-800"
                >
                  <Camera className="h-4 w-4" /> Kameradan
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('acil-preview-galeri')?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Galeriden
                </button>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold text-slate-700">Tespit Notları</h4>
              <p className="text-sm text-slate-500">Henüz tespit notu yok.</p>
            </div>
          </div>
        </section>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="operasyon-ozet">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Operasyon Planlama Özeti</h2>
                <p className="text-xs text-slate-500">
                  Operasyon Durumu:{' '}
                  {steps.filter((s) => s.status === 'done').length} / {steps.length} Tamamlandı
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                data-testid="acil-planlayici-ac"
              >
                Operasyon Planlayıcısı
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {steps.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setActiveStep(s.key);
                    setDrawerOpen(true);
                  }}
                  className={`rounded-xl border px-2 py-2.5 text-left ${
                    drawerOpen && activeStep === s.key
                      ? 'border-orange-200 bg-orange-50/70 ring-2 ring-orange-400'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-semibold text-slate-500">{s.n}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-800">{s.label}</p>
                </button>
              ))}
            </div>
          </div>
      </div>

      {drawerOpen ? (
        <>
          <button type="button" aria-label="Kapat" className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Operasyon Planlayıcısı</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">Tedarikçi, maliyet, onay, kapanış ve finans bu panelde.</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1">
              <nav className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-3 pl-2 pr-1.5" aria-label="Operasyon Akışı">
                <ol className="relative flex flex-col gap-0.5">
                  {steps.map((s, idx) => {
                    const active = activeStep === s.key;
                    const done = s.status === 'done';
                    const waiting = active || s.status === 'waiting';
                    return (
                      <li key={s.key} className="relative">
                        {idx < steps.length - 1 ? (
                          <span
                            className="pointer-events-none absolute left-[18px] top-8 h-[calc(100%-8px)] w-0.5"
                            style={{ backgroundColor: done && !active ? C.done : C.pending }}
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setActiveStep(s.key)}
                          className={`relative flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-left ${
                            active ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <FlowStepDot status={s.status} active={active} n={s.n} />
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span
                              className={`flex items-start gap-1 text-[11px] font-semibold leading-snug ${
                                done && !active ? 'text-emerald-700' : waiting ? 'text-orange-700' : 'text-slate-500'
                              }`}
                            >
                              <span className="min-w-0 flex-1">{s.label}</span>
                              {done && !active ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" strokeWidth={3} /> : null}
                            </span>
                            <span
                              className={`mt-0.5 block text-[10px] font-medium ${
                                done && !active ? 'text-emerald-600' : waiting ? 'text-orange-600' : 'text-slate-400'
                              }`}
                            >
                              {done && !active ? 'Tamamlandı' : waiting ? 'İşlem Bekliyor' : 'Bekliyor'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="flex min-w-0 flex-1 flex-col bg-white">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-[10px] font-semibold tracking-wide text-slate-400">{activeMeta.n}. Adım</p>
                  <h3 className="text-sm font-bold text-slate-950">{activeMeta.label}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">{activeMeta.hint}</p>
                  <div className="mt-3">
                    <PlannerStepBody
                      step={activeStep}
                      file={FILE}
                      address={address}
                      vendors={PREVIEW_VENDORS}
                      assigned={assigned}
                      assignedVendor={assignedVendor}
                      alis={alis}
                      satis={satis}
                      workStartOk={workStartOk}
                      fileClosed={fileClosed}
                      hakedisAt={hakedisAt}
                      financeSent={financeSent}
                      financeAt={financeAt}
                      approvalChannel={approvalChannel}
                      approvalState={approvalState}
                      approvalRequestedAt={approvalRequestedAt}
                      approvalDecidedAt={approvalDecidedAt}
                      approvalText={approvalText}
                      waLog={waLog}
                      photos={sahaPhotos}
                      onAssign={(id) => {
                        setAssigned(id);
                        showToast('success', 'Tedarikçi dosyaya atandı');
                      }}
                      onAlis={setAlis}
                      onSatis={setSatis}
                      onWorkStart={setWorkStartOk}
                      onCloseFile={() => {
                        setFileClosed(true);
                        setHakedisAt(nowLabel());
                        showToast('success', 'Dosya kapatıldı, tedarikçiye hakediş verildi');
                      }}
                      onFinance={() => {
                        setFinanceSent(true);
                        setFinanceAt(nowLabel());
                        showToast('success', 'Finansa aktarıldı');
                      }}
                      onApprovalChannel={setApprovalChannel}
                      onApprovalState={(v) => {
                        setApprovalState(v);
                        setApprovalDecidedAt(nowLabel());
                      }}
                      onApprovalText={setApprovalText}
                      onWhatsApp={sendWhatsApp}
                    />
                  </div>
                </div>
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
                  {saveError ? (
                    <p className="mb-2 text-[11px] text-amber-800" data-testid="planlayici-kaydet-hata">
                      {saveError}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setDrawerOpen(false)}
                      data-testid="planlayici-iptal"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                      onClick={saveCurrentStep}
                      data-testid="planlayici-kaydet"
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export default function AcilDosyaAkisPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ToastProvider>
      <PreviewInner />
    </ToastProvider>
  );
}
