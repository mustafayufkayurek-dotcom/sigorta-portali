'use client';

/**
 * Hasar — 1. Perde: Randevu Operasyon Merkezi
 * UX Kilitli Referans (2026-07-19) — Lokal işlev doğrulama ekranı.
 * Freeze: docs/project-governance/canli-kabul/HASAR_1_PERDE_UX_KILIT_20260719.md
 */

import { notFound } from 'next/navigation';
import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';
import { API, authHeader } from '@/utils/api';
import { toWhatsAppLink } from '@/utils/date-helpers';
import { isWhatsAppMarkSentBypassActive } from '@/utils/whatsapp-sent-confirm-gate';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { formatClaimSubjectLabel, toTitleCaseTR } from '@/utils/text-helpers';

/** Lokal 1. Perde test: API’de sigortalı telefonu yoksa Ara / WhatsApp doğrulanabilsin */
const LOCAL_TEST_INSURED_PHONE = '0532 133 41 44';

function resolveInsuredPhone(phone: string | null | undefined): string {
  const trimmed = phone?.trim();
  return trimmed || LOCAL_TEST_INSURED_PHONE;
}

type DrawerId = 'tespitci' | 'tedarikci' | 'whatsapp' | 'dijital-onay' | 'randevu' | null;

type GuideState = 'done' | 'active' | 'future';
type TespitFilter = 'oneri' | 'yakin' | 'ekonomik' | 'basarili' | 'son';

type OperationActivity = {
  id: string;
  action: string;
  description: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actor?: { firstName: string; lastName: string } | null;
};

type OperationCenterData = {
  claim: {
    id: string;
    fileNo: string;
    insuredName: string | null;
    insuredPhone: string | null;
    lossType: string | null;
    serviceGroup: string | null;
    address: string | null;
    city: string | null;
    district: string | null;
    locationUrl: string | null;
  };
  mainAppointment: {
    id: string;
    scheduledAt: string;
    location: string | null;
    locationUrl: string | null;
    estimatedDurationMinutes: number | null;
    notes: string | null;
    status: string;
  } | null;
  assignedInspector: { id: string; name: string; phone?: string | null } | null;
  assignedSuppliers: Array<{
    id: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    district?: string | null;
    workGroups?: Array<{ id: string; name: string }>;
  }>;
  activity: OperationActivity[];
  appointmentNotifications: PreparedNotification[];
};

type PreparedNotification = {
  eventId: string;
  recipientType: 'insured' | 'adjuster' | 'vendor';
  recipientId: string | null;
  recipientName: string;
  phone: string | null;
  message: string;
  status: 'ready' | 'opened' | 'sent' | 'pending' | 'failed';
  url: string | null;
};

/** Yalnızca 1. Perde hızlı işlemleri */
const QUICK = [
  { t: 'Ara', icon: 'phone' as const, drawer: null },
  { t: 'WhatsApp', icon: 'wa' as const, drawer: 'whatsapp' as DrawerId },
  { t: 'Not Ekle', icon: 'note' as const, drawer: null },
  { t: 'Dosya Ekle', icon: 'file' as const, drawer: null },
  { t: 'Hatırlatma', icon: 'bell' as const, drawer: null },
  { t: 'Dosya Notu', icon: 'clip' as const, drawer: null },
];

const ACTIVE_STEP_CTA: Record<number, string> = {
  2: 'Tespitçiyi Ata',
  3: 'Tedarikçiyi Ata',
  4: 'Mesaj Gönder',
  5: 'Dijital Onay Gönder',
  6: 'Rapor Aşamasına Geç',
};

const MOCK_NOTES = [
  {
    who: 'Ayşe Operatör',
    when: '18.07 · 14:10',
    text: 'Sigortalı randevu saatini sabah istedi.',
    tag: 'Önemli' as const,
  },
  {
    who: 'Mehmet Kaya',
    when: '17.07 · 16:40',
    text: 'Önceki dosyada hızlı dönüş sağlandı.',
    tag: 'Bilgi' as const,
  },
];

const MOCK_REMINDERS = [
  { when: 'Yarın 10:00', text: 'Randevu hatırlatma', active: true },
  { when: '20.07 · 09:00', text: 'Tespitçi takip ara', active: false },
  { when: '21.07 · 11:30', text: 'Dijital onay kontrol', active: false },
];

const DOSYA_BAGLAM = {
  dosyaNo: 'HD-2026-0042',
  hasarTuru: 'Dahili Su',
  kategori: 'Tespit',
  bolge: 'Kadıköy / İstanbul',
  dosyaSorumlusu: 'Ayşe Operatör',
};

function openNativePicker(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.click();
    }
  } catch {
    el.click();
  }
}

function displayHasarTuru(raw?: string | null): string {
  return formatClaimSubjectLabel(raw, null, DOSYA_BAGLAM.hasarTuru);
}

function buildLocalOperationStub(
  form: {
    date: string;
    time: string;
    location: string;
    locationUrl: string;
    durationMinutes: string;
    notes: string;
  },
  current: OperationCenterData | null = null,
): OperationCenterData {
  const scheduledAt = new Date(`${form.date}T${form.time}:00`);
  return {
    claim: current?.claim ?? {
      id: 'local-claim-hd-2026-0042',
      fileNo: DOSYA_BAGLAM.dosyaNo,
      insuredName: 'Ahmet Yılmaz',
      insuredPhone: LOCAL_TEST_INSURED_PHONE,
      lossType: DOSYA_BAGLAM.hasarTuru,
      serviceGroup: DOSYA_BAGLAM.hasarTuru,
      address: form.location || DOSYA_BAGLAM.bolge,
      city: 'İstanbul',
      district: 'Kadıköy',
      locationUrl: form.locationUrl || null,
    },
    mainAppointment: {
      id: current?.mainAppointment?.id ?? `local-appointment-${Date.now()}`,
      scheduledAt: Number.isNaN(scheduledAt.getTime())
        ? new Date().toISOString()
        : scheduledAt.toISOString(),
      location: form.location.trim(),
      locationUrl: form.locationUrl.trim() || null,
      estimatedDurationMinutes: form.durationMinutes
        ? Number(form.durationMinutes)
        : null,
      notes: form.notes.trim() || null,
      status: 'planned',
    },
    assignedInspector: current?.assignedInspector ?? null,
    assignedSuppliers: current?.assignedSuppliers ?? [],
    activity: current?.activity ?? [],
    appointmentNotifications: current?.appointmentNotifications ?? [],
  };
}

type CardUiState = 'bekliyor' | 'devam' | 'tamamlandi' | 'sonraki_asama';
/** Görsel hiyerarşi — aynı anda yalnız 1 kart `active` (şerit ile senkron) */
type CardFocus = 'active' | 'done' | 'waiting' | 'future';

function cardUiState(opts: {
  done: boolean;
  stagePassed: boolean;
  drawerOpen: boolean;
}): CardUiState {
  if (opts.stagePassed) return 'sonraki_asama';
  if (opts.drawerOpen) return 'devam';
  if (opts.done) return 'tamamlandi';
  return 'bekliyor';
}

function cardFocus(opts: {
  guideStep: number;
  activeGuideStep: number | null;
  done: boolean;
  waiting?: boolean;
}): CardFocus {
  if (opts.done) return 'done';
  if (opts.activeGuideStep != null && opts.guideStep === opts.activeGuideStep) return 'active';
  if (opts.waiting) return 'waiting';
  return 'future';
}

function DosyaBaglamBar() {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 text-[10px] sm:grid-cols-5">
      {(
        [
          ['Dosya No', DOSYA_BAGLAM.dosyaNo],
          ['Hasar Türü', DOSYA_BAGLAM.hasarTuru],
          ['Kategori', DOSYA_BAGLAM.kategori],
          ['Bölge', DOSYA_BAGLAM.bolge],
          ['Dosya Sorumlusu', DOSYA_BAGLAM.dosyaSorumlusu],
        ] as const
      ).map(([k, v]) => (
        <div key={k}>
          <p className="text-blue-500/80">{k}</p>
          <p className="font-semibold text-slate-800">{v}</p>
        </div>
      ))}
    </div>
  );
}

function OpStatusCard({
  title,
  ui,
  focus,
  body,
  actionLabel,
  onAction,
  onEdit,
  onPass,
  canPass,
  done,
  actionDisabled = false,
  actionDisabledReason,
}: {
  title: string;
  ui: CardUiState;
  focus: CardFocus;
  body: ReactNode;
  actionLabel: string;
  onAction: () => void;
  onEdit: () => void;
  onPass: () => void;
  canPass: boolean;
  done: boolean;
  actionDisabled?: boolean;
  actionDisabledReason?: string;
}) {
  const isEditing = ui === 'devam';
  const shell =
    focus === 'active'
      ? `border-2 border-blue-500 bg-blue-50/40 anim-pulse${isEditing ? ' border-dashed' : ''}`
      : focus === 'done' || ui === 'tamamlandi' || ui === 'sonraki_asama'
        ? `border-2 border-emerald-400 bg-emerald-50/70${isEditing ? ' border-dashed border-orange-400 bg-orange-50/30' : ''}${
            ui === 'sonraki_asama' && !isEditing ? ' opacity-80' : ''
          }`
        : focus === 'waiting'
          ? 'border border-amber-300 bg-white'
          : 'border border-slate-200 bg-white';

  const status =
    ui === 'tamamlandi' || (ui === 'sonraki_asama' && !isEditing)
      ? { label: '✓ İşlem Tamamlandı', tone: 'green' as const }
      : isEditing
        ? { label: 'Düzenle Modu', tone: 'orange' as const }
        : focus === 'future'
            ? { label: 'Bekliyor', tone: 'gray' as const }
            : { label: 'İşlem Bekliyor', tone: 'orange' as const };

  const primaryDisabled = (done && !isEditing) || ui === 'sonraki_asama' || actionDisabled;
  const editEnabled = done && ui !== 'sonraki_asama';
  const primaryIsBlue = focus === 'active' && !primaryDisabled;
  const actionIcon = actionIconKindForLabel(actionLabel);

  return (
    <div className={`t-card relative flex flex-col rounded-xl p-3.5 shadow-sm ${shell}`}>
      {focus === 'active' ? <AktifGorevRozet /> : null}
      <div className={`flex items-start justify-between gap-2${focus === 'active' ? ' mt-1' : ''}`}>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          {ui === 'tamamlandi' || ui === 'sonraki_asama' ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success text-[10px] font-bold text-white">
              ✓
            </span>
          ) : null}
          {title}
        </h3>
        <Pill label={status.label} tone={status.tone} />
      </div>
      <div className="mt-2 flex-1 text-xs text-slate-600">{body}</div>
      <button
        type="button"
        disabled={primaryDisabled}
        title={actionDisabled ? actionDisabledReason : undefined}
        onClick={onAction}
        className={`t-fast mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
          primaryDisabled
            ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
            : primaryIsBlue
              ? 'bg-brand-600 text-white hover:bg-blue-700'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <ActionBtnIcon
          kind={actionIcon}
          className={`h-3.5 w-3.5 shrink-0 ${
            primaryDisabled ? 'opacity-40' : primaryIsBlue ? 'opacity-100' : 'opacity-60'
          }`}
        />
        {actionLabel}
      </button>
      <button
        type="button"
        disabled={!editEnabled}
        onClick={onEdit}
        className={`t-fast mt-1.5 w-full rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          editEnabled
            ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
        }`}
      >
        Düzenle / Değiştir
      </button>
      <div className="mt-2">
        {ui === 'sonraki_asama' ? (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
          >
            Sonraki Aşamaya Geçildi
          </button>
        ) : (
          <StagePassButton unlocked={canPass} onClick={onPass} />
        )}
      </div>
    </div>
  );
}

type Tespitci = {
  id: string;
  ad: string;
  telefon: string;
  whatsapp: string;
  il: string;
  ilce: string;
  hizmetBolgesi: string;
  hizmetGrubu: string;
  uygun: boolean | null;
  puan: number | null;
  sonCalisma: string | null;
  ortalamaMaliyet: number | null;
  mesafeKm: number | null;
  sistemOnerisi: boolean;
  sonIsler: string[];
  operasyonNotlari: string;
};

const TESPITCILER: Tespitci[] = [
  {
    id: 't1',
    ad: 'Mehmet Kaya',
    telefon: '0532 111 22 33',
    whatsapp: '0532 111 22 33',
    il: 'İstanbul',
    ilce: 'Kadıköy',
    hizmetBolgesi: 'Kadıköy · Moda · Fenerbahçe',
    hizmetGrubu: 'Su Hasarı Tespit',
    uygun: true,
    puan: 4.8,
    sonCalisma: '16.07.2026',
    ortalamaMaliyet: 1850,
    mesafeKm: 2.1,
    sistemOnerisi: true,
    sonIsler: [
      'HD-2026-0038 · Dahili Su · Tamamlandı',
      'HD-2026-0031 · Nem · Tamamlandı',
      'HD-2026-0024 · Dahili Su · Tamamlandı',
      'HD-2026-0019 · Banyo Sızıntı · Tamamlandı',
      'HD-2026-0012 · Dahili Su · Tamamlandı',
      'HD-2025-1190 · Nem · Tamamlandı',
      'HD-2025-1172 · Dahili Su · Tamamlandı',
      'HD-2025-1140 · Mutfak · Tamamlandı',
      'HD-2025-1108 · Dahili Su · Tamamlandı',
      'HD-2025-1088 · Nem · Tamamlandı',
    ],
    operasyonNotlari: 'Kadıköy bölgesinde hızlı dönüş. Sigortalı iletişimi güçlü.',
  },
  {
    id: 't2',
    ad: 'Ayşe Demir',
    telefon: '0533 444 55 66',
    whatsapp: '0533 444 55 66',
    il: 'İstanbul',
    ilce: 'Üsküdar',
    hizmetBolgesi: 'Üsküdar · Kuzguncuk · Acıbadem',
    hizmetGrubu: 'Genel Hasar Tespit',
    uygun: true,
    puan: 4.6,
    sonCalisma: '14.07.2026',
    ortalamaMaliyet: 1650,
    mesafeKm: 4.8,
    sistemOnerisi: true,
    sonIsler: [
      'HD-2026-0035 · Dahili Su · Tamamlandı',
      'HD-2026-0028 · Yangın · Tamamlandı',
      'HD-2026-0021 · Nem · Tamamlandı',
      'HD-2026-0015 · Dahili Su · Tamamlandı',
      'HD-2026-0009 · Cam · Tamamlandı',
      'HD-2025-1181 · Dahili Su · Tamamlandı',
      'HD-2025-1155 · Nem · Tamamlandı',
      'HD-2025-1120 · Dahili Su · Tamamlandı',
      'HD-2025-1099 · Genel · Tamamlandı',
      'HD-2025-1070 · Dahili Su · Tamamlandı',
    ],
    operasyonNotlari: 'Maliyet dengeli. Rapor kalitesi yüksek.',
  },
  {
    id: 't3',
    ad: 'Can Öztürk',
    telefon: '0535 777 88 99',
    whatsapp: '0535 777 88 99',
    il: 'İstanbul',
    ilce: 'Ataşehir',
    hizmetBolgesi: 'Ataşehir · Kozyatağı',
    hizmetGrubu: 'Su Hasarı Tespit',
    uygun: false,
    puan: 4.3,
    sonCalisma: '10.07.2026',
    ortalamaMaliyet: 2100,
    mesafeKm: 6.2,
    sistemOnerisi: false,
    sonIsler: [
      'HD-2026-0030 · Dahili Su · Tamamlandı',
      'HD-2026-0022 · Nem · Tamamlandı',
      'HD-2026-0017 · Dahili Su · Tamamlandı',
      'HD-2026-0010 · Genel · Tamamlandı',
      'HD-2025-1166 · Dahili Su · Tamamlandı',
      'HD-2025-1133 · Nem · Tamamlandı',
      'HD-2025-1111 · Dahili Su · Tamamlandı',
      'HD-2025-1080 · Genel · Tamamlandı',
      'HD-2025-1055 · Dahili Su · Tamamlandı',
      'HD-2025-1022 · Nem · Tamamlandı',
    ],
    operasyonNotlari: 'Bugün meşgul. Yarın 14:00 sonrası uygun.',
  },
  {
    id: 't4',
    ad: 'Zeynep Ak',
    telefon: '0536 222 33 44',
    whatsapp: '0536 222 33 44',
    il: 'İstanbul',
    ilce: 'Beşiktaş',
    hizmetBolgesi: 'Beşiktaş · Ortaköy · Levent',
    hizmetGrubu: 'Genel Hasar Tespit',
    uygun: true,
    puan: 4.9,
    sonCalisma: '17.07.2026',
    ortalamaMaliyet: 2400,
    mesafeKm: 12.4,
    sistemOnerisi: false,
    sonIsler: [
      'HD-2026-0040 · Dahili Su · Tamamlandı',
      'HD-2026-0036 · Nem · Tamamlandı',
      'HD-2026-0029 · Dahili Su · Tamamlandı',
      'HD-2026-0025 · Yangın · Tamamlandı',
      'HD-2026-0018 · Dahili Su · Tamamlandı',
      'HD-2026-0011 · Nem · Tamamlandı',
      'HD-2025-1199 · Dahili Su · Tamamlandı',
      'HD-2025-1177 · Genel · Tamamlandı',
      'HD-2025-1144 · Dahili Su · Tamamlandı',
      'HD-2025-1110 · Nem · Tamamlandı',
    ],
    operasyonNotlari: 'En yüksek puan. Mesafe uzak; acil dosyalar için tercih.',
  },
  {
    id: 't5',
    ad: 'Burak Yıldız',
    telefon: '0537 555 66 77',
    whatsapp: '0537 555 66 77',
    il: 'İstanbul',
    ilce: 'Maltepe',
    hizmetBolgesi: 'Maltepe · Kartal · Pendik',
    hizmetGrubu: 'Su Hasarı Tespit',
    uygun: true,
    puan: 4.4,
    sonCalisma: '12.07.2026',
    ortalamaMaliyet: 1450,
    mesafeKm: 9.0,
    sistemOnerisi: false,
    sonIsler: [
      'HD-2026-0033 · Dahili Su · Tamamlandı',
      'HD-2026-0026 · Nem · Tamamlandı',
      'HD-2026-0020 · Dahili Su · Tamamlandı',
      'HD-2026-0014 · Genel · Tamamlandı',
      'HD-2026-0007 · Dahili Su · Tamamlandı',
      'HD-2025-1150 · Nem · Tamamlandı',
      'HD-2025-1125 · Dahili Su · Tamamlandı',
      'HD-2025-1090 · Genel · Tamamlandı',
      'HD-2025-1060 · Dahili Su · Tamamlandı',
      'HD-2025-1030 · Nem · Tamamlandı',
    ],
    operasyonNotlari: 'En ekonomik seçenek. Anadolu yakası yoğunluğu iyi.',
  },
];

const TESPIT_FILTRELER: { id: TespitFilter; label: string }[] = [
  { id: 'oneri', label: 'Sistem Önerisi' },
  { id: 'yakin', label: 'En Yakın' },
  { id: 'ekonomik', label: 'En Ekonomik' },
  { id: 'basarili', label: 'En Başarılı' },
  { id: 'son', label: 'Son Çalışılan' },
];

function parseTrDate(d: string) {
  const [dd, mm, yyyy] = d.split('.').map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}

function filterAndSortTespitci(list: Tespitci[], q: string, filter: TespitFilter | null) {
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  let rows = list.filter((t) => {
    if (!needle) return true;
    const bag = [t.ad, t.telefon, t.il, t.ilce, t.hizmetBolgesi, t.hizmetGrubu]
      .join(' ')
      .toLocaleLowerCase('tr-TR');
    return bag.includes(needle);
  });

  if (filter === 'oneri') rows = rows.filter((t) => t.sistemOnerisi);
  if (filter === 'yakin') rows = [...rows].sort((a, b) => (a.mesafeKm ?? 99999) - (b.mesafeKm ?? 99999));
  if (filter === 'ekonomik') {
    rows = [...rows].sort(
      (a, b) => (a.ortalamaMaliyet ?? 99999) - (b.ortalamaMaliyet ?? 99999),
    );
  }
  if (filter === 'basarili') rows = [...rows].sort((a, b) => (b.puan ?? -1) - (a.puan ?? -1));
  if (filter === 'son') {
    rows = [...rows].sort(
      (a, b) =>
        (b.sonCalisma ? parseTrDate(b.sonCalisma) : 0) -
        (a.sonCalisma ? parseTrDate(a.sonCalisma) : 0),
    );
  }
  return rows;
}

function buildGuide(state: {
  waDone: boolean;
  dijitalDone: boolean;
  tespitci: string | null;
  tedarikciDone: boolean;
  raporDone: boolean;
}): { n: number; label: string; state: GuideState; meta: string }[] {
  const steps = [
    { n: 1, label: 'Sigortalıyı Ara', done: true },
    { n: 2, label: 'Tespitçi Ataması', done: !!state.tespitci },
    { n: 3, label: 'Tedarikçi Ataması', done: state.tedarikciDone },
    { n: 4, label: 'WhatsApp Mesajı', done: state.waDone },
    { n: 5, label: 'Dijital Onay', done: state.dijitalDone },
    { n: 6, label: 'Rapor Aşaması', done: state.raporDone },
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  return steps.map((s, idx) => {
    const st: GuideState = s.done ? 'done' : idx === firstOpen ? 'active' : 'future';
    return {
      n: s.n,
      label: s.label,
      state: st,
      meta:
        st === 'done'
          ? s.n === 1
            ? 'Tamamlandı · 18.07.2026 08:20'
            : 'Tamamlandı'
          : 'İşlem Bekliyor',
    };
  });
}

const TEDARIKCI_KATEGORI = [
  { kategori: 'Boyacı', atanmis: 'Renk Ustaları Ltd.', durum: 'atanmis' as const },
  { kategori: 'Mobilyacı', atanmis: null, durum: 'bekliyor' as const },
  { kategori: 'Elektrikçi', atanmis: null, durum: 'bekliyor' as const },
  { kategori: 'Tesisatçı', atanmis: 'Su Teknik', durum: 'atanmis' as const },
  { kategori: 'Temizlik', atanmis: null, durum: 'bekliyor' as const },
];

type ActionIconKind = 'calendar' | 'user' | 'wrench' | 'chat' | 'document' | 'report';

function actionIconKindForLabel(label: string): ActionIconKind {
  if (/Randevu/i.test(label)) return 'calendar';
  if (/Tespitçi/i.test(label)) return 'user';
  if (/Tedarikçi/i.test(label)) return 'wrench';
  if (/Mesaj/i.test(label)) return 'chat';
  if (/Dijital Onay/i.test(label)) return 'document';
  if (/Rapor/i.test(label)) return 'report';
  return 'calendar';
}

function ActionBtnIcon({
  kind,
  className = 'h-3.5 w-3.5',
}: {
  kind: ActionIconKind;
  className?: string;
}) {
  const paths: Record<ActionIconKind, string> = {
    calendar:
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    wrench:
      'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    document:
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    report:
      'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={paths[kind]} />
    </svg>
  );
}

function AktifGorevRozet() {
  return (
    <span className="absolute -top-2 left-3 z-10 inline-flex items-center rounded-md bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm ring-2 ring-white">
      Aktif Görev
    </span>
  );
}

function IconPhone({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function IconWa({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function QuickIcon({ name }: { name: (typeof QUICK)[number]['icon'] }) {
  const cls = 'h-5 w-5';
  if (name === 'phone') return <IconPhone className={cls} />;
  if (name === 'wa') return <IconWa className={cls} />;
  const paths: Record<string, string> = {
    note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    file: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    cal: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    map: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    clip: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  };
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={paths[name]} />
    </svg>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}) {
  const map = {
    green: 'bg-emerald-100 text-emerald-800',
    orange: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[tone]}`}>
      {label}
    </span>
  );
}

function StagePassButton({ unlocked, onClick }: { unlocked: boolean; onClick?: () => void }) {
  if (unlocked) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="t-fast mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Sonraki Aşamaya Geç →
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled
      className="mt-auto flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      Sonraki Aşamaya Geç (Kilitli)
    </button>
  );
}

function DrawerShell({
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryTone = 'blue',
  headerExtra,
  wide = false,
  xwide = false,
  hideFooter = false,
  cancelLabel = 'İptal',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryTone?: 'blue' | 'green';
  headerExtra?: React.ReactNode;
  wide?: boolean;
  xwide?: boolean;
  hideFooter?: boolean;
  cancelLabel?: string;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
        aria-label="Paneli Kapat"
        onClick={onClose}
      />
      <aside
        className={`drawer-enter fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl ${
          xwide ? 'max-w-4xl' : wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold text-slate-950">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Kapat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {headerExtra ?? <DosyaBaglamBar />}
        </div>
        <div className="flex-1 overflow-auto px-4 py-4">{children}</div>
        {!hideFooter && (
          <div className="flex gap-2 border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="t-fast flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
            {primaryLabel && onPrimary ? (
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                className={`t-fast flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  primaryDisabled
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : primaryTone === 'green'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-brand-600 text-white hover:bg-blue-700'
                }`}
              >
                {primaryLabel}
              </button>
            ) : null}
          </div>
        )}
      </aside>
    </>
  );
}

export default function HasarOperasyonKontrolMerkeziPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [operationData, setOperationData] = useState<OperationCenterData | null>(null);
  const [operationLoading, setOperationLoading] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [drawerSuccess, setDrawerSuccess] = useState<string | null>(null);
  const [tespitciSearch, setTespitciSearch] = useState('');
  const [tespitFilter, setTespitFilter] = useState<TespitFilter | null>('oneri');
  const [selectedTespitciId, setSelectedTespitciId] = useState<string | null>(null);
  const [registeredTespitciler, setRegisteredTespitciler] = useState<Tespitci[]>(TESPITCILER);
  const [tedarikciTab, setTedarikciTab] = useState<'kayitli' | 'google'>('kayitli');
  const [registeredSuppliers, setRegisteredSuppliers] = useState<Array<any>>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [alternativeSuppliers, setAlternativeSuppliers] = useState<Array<any>>([]);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [alternativeDraft, setAlternativeDraft] = useState<any | null>(null);
  const [alternativePhone, setAlternativePhone] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [callRecordedAt, setCallRecordedAt] = useState<string | null>(null);
  const [onayBelge, setOnayBelge] = useState('hasar_onay_formu');
  const [notesTab, setNotesTab] = useState<'notlar' | 'hatirlatmalar' | 'tumu'>('notlar');
  const [randevuHatirlat, setRandevuHatirlat] = useState(true);
  const [randevuOnayDone, setRandevuOnayDone] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    date: '2026-07-19',
    time: '10:30',
    location: 'Moda Cad. No: 12 D: 4, Kadıköy / İstanbul',
    locationUrl: '',
    durationMinutes: '90',
    notes: '',
  });
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [notificationResults, setNotificationResults] = useState<PreparedNotification[]>([]);
  const [operationNotice, setOperationNotice] = useState<string | null>(null);

  const [state, setState] = useState({
    waDone: false,
    dijitalDone: false,
    tespitci: null as string | null,
    tespitciAt: null as string | null,
    tedarikciDone: false,
    raporDone: false,
    stagePassed: {
      randevu: false,
      wa: false,
      dijital: false,
      tespitci: false,
      tedarikci: false,
      rapor: false,
    },
  });

  const loadOperationCenter = async () => {
    setOperationLoading(true);
    setOperationError(null);
    try {
      const response = await axios.get(
        `${API}/claim-operation-center/by-file-no/${encodeURIComponent(DOSYA_BAGLAM.dosyaNo)}`,
        { headers: authHeader() },
      );
      const next = response.data.data as OperationCenterData;
      setOperationData(next);
      setState((current) => ({
        ...current,
        tespitci: next.assignedInspector?.name ?? null,
        tedarikciDone: next.assignedSuppliers.length > 0,
      }));
      if (next.mainAppointment) {
        const when = new Date(next.mainAppointment.scheduledAt);
        setAppointmentForm({
          date: when.toISOString().slice(0, 10),
          time: when.toTimeString().slice(0, 5),
          location: next.mainAppointment.location ?? next.claim.address ?? '',
          locationUrl: next.mainAppointment.locationUrl ?? next.claim.locationUrl ?? '',
          durationMinutes: next.mainAppointment.estimatedDurationMinutes?.toString() ?? '',
          notes: next.mainAppointment.notes ?? '',
        });
      }
      setCallRecordedAt(
        next.activity.find((item) => item.action === 'PHONE_CALL_RECORDED')?.createdAt ?? null,
      );
      const restoredNotifications = (next.appointmentNotifications ?? []).map((item) =>
        item.recipientType === 'insured' && !item.url
          ? {
              ...item,
              phone: resolveInsuredPhone(item.phone),
              url: toWhatsAppLink(resolveInsuredPhone(item.phone), item.message),
              status: item.status === 'failed' ? ('ready' as const) : item.status,
            }
          : item,
      );
      setNotificationResults(restoredNotifications);
      setState((current) => ({
        ...current,
        waDone:
          restoredNotifications.length > 0 &&
          restoredNotifications.every((item) => item.status === 'sent'),
      }));
    } catch (error: any) {
      setOperationError(
        error?.response?.data?.message ??
          'Lokal dosya bağlamı yüklenemedi. Gerçek işlemler için lokal backend ve oturum gereklidir.',
      );
    } finally {
      setOperationLoading(false);
    }
  };

  useEffect(() => {
    void loadOperationCenter();
  }, []);

  useEffect(() => {
    const claimId = operationData?.claim.id;
    if (!claimId) return;
    axios
      .get(`${API}/claim-files/${claimId}/vendors/nearby?purpose=inspector`, {
        headers: authHeader(),
      })
      .then((response) => {
        const rows = (response.data.data ?? []) as Array<any>;
        if (!rows.length) {
          setRegisteredTespitciler(TESPITCILER);
          return;
        }
        setRegisteredTespitciler(
          rows.map((row, index) => ({
            id: row.id,
            ad: toTitleCaseTR(row.name ?? ''),
            telefon: row.authorizedPhone ?? row.phone ?? '',
            whatsapp: row.authorizedPhone ?? row.phone ?? '',
            il: row.city ?? '',
            ilce: row.district ?? '',
            hizmetBolgesi:
              row.serviceAreas
                ?.map((area: any) => area.district?.name ?? area.province?.name)
                .filter(Boolean)
                .join(' · ') || [row.district, row.city].filter(Boolean).join(' · '),
            hizmetGrubu: displayHasarTuru(
              operationData.claim.serviceGroup ?? operationData.claim.lossType,
            ),
            uygun: null,
            puan: null,
            sonCalisma: null,
            ortalamaMaliyet: null,
            mesafeKm: null,
            sistemOnerisi: index === 0,
            sonIsler: [],
            operasyonNotlari:
              'Kayıtlı tespitçi. Müsaitlik ve performans metrikleri mevcut kaynakta bulunmuyor.',
          })),
        );
      })
      .catch(() => setRegisteredTespitciler(TESPITCILER));
    axios
      .get(`${API}/claim-files/${claimId}/vendors/nearby?purpose=supplier`, {
        headers: authHeader(),
      })
      .then((response) => setRegisteredSuppliers(response.data.data ?? []))
      .catch(() => setRegisteredSuppliers([]));
    setSelectedSupplierIds(operationData.assignedSuppliers.map((supplier) => supplier.id));
  }, [operationData?.claim.id, operationData?.claim.serviceGroup]);

  const searchAlternatives = async () => {
    if (!operationData?.claim.city || !operationData.claim.serviceGroup) return;
    setAlternativeLoading(true);
    try {
      const params = new URLSearchParams({
        city: operationData.claim.city,
        serviceType: operationData.claim.serviceGroup,
      });
      if (operationData.claim.district) params.set('district', operationData.claim.district);
      const response = await axios.get(
        `${API}/vendor-discovery/alternative-search?${params.toString()}`,
        { headers: authHeader() },
      );
      setAlternativeSuppliers(response.data.data ?? []);
    } catch {
      setAlternativeSuppliers([]);
      setOperationNotice(
        'Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.',
      );
    } finally {
      setAlternativeLoading(false);
    }
  };

  /** Lokal test: API telefonu yoksa Mustafa test numarası */
  const insuredPhone = resolveInsuredPhone(operationData?.claim.insuredPhone);

  const recordCall = async () => {
    const phone = insuredPhone;
    const claimId = operationData?.claim.id;
    if (!phone || !claimId || callBusy) return;
    setCallBusy(true);
    try {
      await axios.post(
        `${API}/claim-operation-center/${claimId}/contact-events`,
        {
          channel: 'phone',
          recipientType: 'insured',
          recipientId: null,
          recipientName: operationData.claim.insuredName,
          phone,
          status: 'called',
          result: 'Arama Gerçekleştirildi',
        },
        { headers: authHeader() },
      );
      const stamp = new Date().toISOString();
      setCallRecordedAt(stamp);
      setOperationNotice('Arama Gerçekleştirildi. Tarih, saat ve kullanıcı geçmişe kaydedildi.');
      void loadOperationCenter();
    } catch (error: any) {
      setOperationNotice(error?.response?.data?.message ?? 'Arama kaydı oluşturulamadı.');
    } finally {
      setCallBusy(false);
    }
  };

  const saveAppointment = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.location.trim()) {
      setOperationNotice('Tarih, saat ve adres zorunludur.');
      return;
    }
    const claimId = operationData?.claim.id;
    const isLocalClaim = !claimId || claimId.startsWith('local-');
    setAppointmentSaving(true);
    setOperationNotice(null);
    try {
      if (!isLocalClaim) {
        const scheduledAt = new Date(`${appointmentForm.date}T${appointmentForm.time}:00`);
        await axios.put(
          `${API}/claim-operation-center/${claimId}/main-appointment`,
          {
            scheduledAt: scheduledAt.toISOString(),
            location: appointmentForm.location,
            locationUrl: appointmentForm.locationUrl || null,
            estimatedDurationMinutes: appointmentForm.durationMinutes
              ? Number(appointmentForm.durationMinutes)
              : null,
            notes: appointmentForm.notes || null,
          },
          { headers: authHeader() },
        );
        await loadOperationCenter();
      } else {
        setOperationData((current) => buildLocalOperationStub(appointmentForm, current));
        setOperationError(null);
      }
      setNotificationResults([]);
      setState((current) => ({ ...current, waDone: false }));
      setRandevuOnayDone(true);
      setOperationNotice(
        isLocalClaim
          ? 'Randevu kaydedildi (lokal). Sıradaki adım: Tespitçi Ataması. Bildirimler atamalar tamamlanınca tek ekrandan gönderilir.'
          : 'Randevu kaydedildi. Sıradaki adım: Tespitçi Ataması. Bildirimler atamalar tamamlanınca tek ekrandan gönderilir.',
      );
      close();
    } catch (error: any) {
      // Oturum yoksa veya API reddederse lokal akış bozulmasın
      setOperationData((current) => buildLocalOperationStub(appointmentForm, current));
      setNotificationResults([]);
      setState((current) => ({ ...current, waDone: false }));
      setRandevuOnayDone(true);
      setOperationError(null);
      setOperationNotice(
        `Randevu lokal olarak kaydedildi. (${
          error?.response?.data?.message ?? 'API oturumu yok veya yanıt vermedi'
        }) Sıradaki adım: Tespitçi Ataması.`,
      );
      close();
    } finally {
      setAppointmentSaving(false);
    }
  };

  const recordNotificationResult = async (
    result: PreparedNotification,
    status: 'opened' | 'sent' | 'pending' | 'failed',
  ) => {
    const claimId = operationData?.claim.id;
    const appointmentId = operationData?.mainAppointment?.id;
    if (!claimId || !appointmentId) return;
    await axios.post(
      `${API}/claim-operation-center/${claimId}/appointment-notifications/result`,
      {
        appointmentId,
        recipientType: result.recipientType,
        recipientId: result.recipientId,
        recipientName: result.recipientName,
        message: result.message,
        status,
        preparedEventId: result.eventId,
      },
      { headers: authHeader() },
    );
    setNotificationResults((current) => {
      const next = current.map((item) =>
        item.eventId === result.eventId ? { ...item, status } : item,
      );
      const allSent = next.length > 0 && next.every((item) => item.status === 'sent');
      setState((stateCurrent) => ({ ...stateCurrent, waDone: allSent }));
      if (allSent) {
        setOperationNotice('Tüm zorunlu randevu bilgilendirmeleri tamamlandı.');
      }
      return next;
    });
    void loadOperationCenter();
  };

  const notificationPlanMissing = [
    !operationData?.mainAppointment ? 'Ana Randevu' : null,
    !operationData?.assignedInspector ? 'Tespitçi Ataması' : null,
    !operationData?.assignedSuppliers.length ? 'Tedarikçi Ataması' : null,
  ].filter(Boolean) as string[];
  const notificationPlanReady = notificationPlanMissing.length === 0;

  const openRequiredNotifications = async () => {
    setDrawerSuccess(null);
    if (!notificationPlanReady || !operationData) {
      setOperationNotice(
        `Bilgilendirme mesajları için önce şu işlemler tamamlanmalı: ${notificationPlanMissing.join(', ')}.`,
      );
      return;
    }

    setDrawer('whatsapp');
    const expectedIds = [
      'insured',
      `adjuster:${operationData.assignedInspector?.id}`,
      ...operationData.assignedSuppliers.map((supplier) => `vendor:${supplier.id}`),
    ];
    const preparedIds = notificationResults.map((item) =>
      item.recipientType === 'insured'
        ? 'insured'
        : `${item.recipientType}:${item.recipientId}`,
    );
    const currentPlanPrepared =
      notificationResults.length === expectedIds.length &&
      expectedIds.every((id) => preparedIds.includes(id));
    if (currentPlanPrepared) return;

    setWaBusy(true);
    try {
      const response = await axios.post(
        `${API}/claim-operation-center/${operationData.claim.id}/appointment-notifications/prepare`,
        { recipients: ['insured', 'adjuster', 'vendors'] },
        { headers: authHeader() },
      );
      const prepared = (response.data.data as PreparedNotification[]).map((item) =>
        item.recipientType === 'insured' && !item.url
          ? {
              ...item,
              phone: insuredPhone,
              url: toWhatsAppLink(insuredPhone, item.message),
              status: item.status === 'failed' ? ('ready' as const) : item.status,
            }
          : item,
      );
      setNotificationResults(prepared);
      setState((current) => ({ ...current, waDone: false }));
      setOperationNotice('Zorunlu bilgilendirmeler gönderim sırasına göre hazırlandı.');
    } catch (error: any) {
      setOperationNotice(error?.response?.data?.message ?? 'Bilgilendirmeler hazırlanamadı.');
    } finally {
      setWaBusy(false);
    }
  };

  const zorunluDone =
    (!!state.tespitci ? 1 : 0) +
    (state.tedarikciDone ? 1 : 0) +
    (state.waDone ? 1 : 0) +
    (state.dijitalDone ? 1 : 0) +
    (state.raporDone ? 1 : 0) +
    (randevuOnayDone ? 1 : 0);
  const zorunluTotal = 6;

  const guide = buildGuide(state);
  const activeGuideStep = guide.find((s) => s.state === 'active')?.n ?? null;
  const sonrakiAdimCta =
    (activeGuideStep != null ? ACTIVE_STEP_CTA[activeGuideStep] : undefined) ?? 'Tespitçiyi Ata';

  const open = (id: DrawerId) => {
    setDrawerSuccess(null);
    if (id === 'whatsapp') {
      void openRequiredNotifications();
      return;
    }
    if (id === 'tespitci') {
      setTespitciSearch('');
      setTespitFilter('oneri');
      const current = registeredTespitciler.find((t) => t.ad === state.tespitci);
      setSelectedTespitciId(current?.id ?? null);
    }
    if (id === 'tedarikci') setTedarikciTab('kayitli');
    setDrawer(id);
  };
  const close = () => {
    setDrawer(null);
    setDrawerSuccess(null);
  };

  const filteredTespitci = filterAndSortTespitci(registeredTespitciler, tespitciSearch, tespitFilter);
  const selectedTespitci = registeredTespitciler.find((t) => t.id === selectedTespitciId) ?? null;

  const tespitUi = cardUiState({
    done: !!state.tespitci,
    stagePassed: state.stagePassed.tespitci,
    drawerOpen: drawer === 'tespitci' && !drawerSuccess,
  });
  const tedarikUi = cardUiState({
    done: state.tedarikciDone,
    stagePassed: state.stagePassed.tedarikci,
    drawerOpen: drawer === 'tedarikci' && !drawerSuccess,
  });
  const dijitalUi = cardUiState({
    done: state.dijitalDone,
    stagePassed: state.stagePassed.dijital,
    drawerOpen: drawer === 'dijital-onay' && !drawerSuccess,
  });
  const waUi = cardUiState({
    done: state.waDone,
    stagePassed: state.stagePassed.wa,
    drawerOpen: drawer === 'whatsapp' && !drawerSuccess,
  });
  const mainAppointmentDate = operationData?.mainAppointment
    ? new Date(operationData.mainAppointment.scheduledAt)
    : null;
  const drawerContextBar = (
    <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 text-[10px] sm:grid-cols-5">
      {[
        ['Sigortalı', operationData?.claim.insuredName ?? '—'],
        ['Telefon', insuredPhone],
        ['Adres', operationData?.mainAppointment?.location ?? operationData?.claim.address ?? '—'],
        ['Konum', operationData?.mainAppointment?.locationUrl ? 'Bağlantı Var' : 'Bağlantı Yok'],
        [
          'Randevu',
          mainAppointmentDate
            ? `${mainAppointmentDate.toLocaleDateString('tr-TR')} ${mainAppointmentDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
            : 'Oluşturulmadı',
        ],
        [
          'Tahmini Süre',
          operationData?.mainAppointment?.estimatedDurationMinutes
            ? `${operationData.mainAppointment.estimatedDurationMinutes} Dakika`
            : '—',
        ],
        ['Hasar Türü', displayHasarTuru(operationData?.claim.lossType)],
        [
          'Hizmet / Görev Grubu',
          displayHasarTuru(operationData?.claim.serviceGroup ?? operationData?.claim.lossType),
        ],
        ['Tespitçi', operationData?.assignedInspector?.name ?? 'Atanmadı'],
        ['Tedarikçi', `${operationData?.assignedSuppliers.length ?? 0} Atama`],
      ].map(([label, value]) => (
        <div key={label}>
          <p className="text-blue-500/80">{label}</p>
          <p className="truncate font-semibold text-slate-800" title={value}>{value}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#EEF2F7] text-slate-800"
      data-reference-records={TESPITCILER.length + TEDARIKCI_KATEGORI.length}
    >
      <style>{`
        @keyframes soft-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          50% { box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.16); }
        }
        @keyframes soft-glow-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18); }
        }
        @keyframes drawer-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .anim-pulse { animation: soft-pulse 3s ease-in-out infinite; }
        .anim-amber { animation: soft-glow-amber 3s ease-in-out infinite; }
        .t-fast { transition: all 180ms ease-in-out; }
        .t-card { transition: transform 180ms ease-in-out, box-shadow 180ms ease-in-out; }
        .t-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); }
        .drawer-enter { animation: drawer-in 200ms ease-out; }
      `}</style>

      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-[11px] font-medium text-emerald-900">
        1. Perde Kilitli · Referans · Lokal İşlev Doğrulama
      </div>

      <div className="flex min-h-[calc(100vh-28px)]">
        {/* Sol menü */}
        <aside className="sticky top-[28px] hidden h-[calc(100vh-28px)] w-[220px] shrink-0 flex-col bg-[#0B1F3A] text-slate-200 lg:flex">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                M
              </div>
              <div>
                <p className="text-xs font-bold leading-tight text-white">Meridyen Asistans</p>
                <p className="text-[10px] text-slate-400">Operasyon Paneli</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 text-sm">
            {(
              [
                { t: 'Dashboard', a: false, d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z' },
                { t: 'Operasyon', a: true, n: 12, d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                { t: 'Dosyalarım', a: false, d: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
                { t: 'Atamalar', a: false, d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                { t: 'Tedarikçiler', a: false, d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                { t: 'Takvim', a: false, d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { t: 'Raporlar', a: false, d: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { t: 'Finans', a: false, d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { t: 'Ayarlar', a: false, d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
              ] as const
            ).map((item) => (
              <div
                key={item.t}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                  item.a ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.d} />
                  </svg>
                  {item.t}
                </span>
                {'n' in item && item.n ? (
                  <span className="rounded-full bg-status-danger px-1.5 text-[10px] font-bold text-white">{item.n}</span>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 px-3 py-3">
            <div className="flex items-center gap-2.5 px-1">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-white">
                  SY
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0B1F3A] bg-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Safran BH</p>
                <p className="text-[10px] text-slate-400">Operatör</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Çıkış Yap
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400">Operasyon › Dosya Detayı › 1. Perde – Randevu</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-blue-800">Randevu Operasyon Merkezi</h1>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    HD-2026-0042
                  </span>
                  <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    Randevu Aşamasında
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
                <p className="font-semibold">Drawer Standardı</p>
                <p className="mt-0.5 text-blue-800">Kart → Drawer → Kaydet → Kart Güncelle → Sonraki Kart</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 py-4 pb-28 sm:px-5">
            {operationLoading ? (
              <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Gerçek dosya bağlamı yükleniyor...
              </div>
            ) : operationError ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {operationError}
              </div>
            ) : null}
            {operationNotice ? (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {operationNotice}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="space-y-3 xl:col-span-9">
                {/* Dosya Özeti */}
                <section className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">Dosya Özeti</p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                        </span>
                        <div>
                          <p className="text-[9px] font-medium text-slate-400">Eksper Ofisi</p>
                          <p className="text-[11px] font-semibold text-slate-800">Kadıköy Eksper Ofisi</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailsOpen((v) => !v)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {detailsOpen ? 'Detayları Gizle' : 'Detayları Gör ›'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4 xl:grid-cols-7">
                    {[
                      ['Dosya No', operationData?.claim.fileNo ?? 'HD-2026-0042'],
                      ['Sigortalı', operationData?.claim.insuredName ?? 'Ahmet Yılmaz'],
                      ['Sigorta Şirketi', 'Anadolu Sigorta'],
                      ['Hasar Türü', displayHasarTuru(operationData?.claim.lossType)],
                      ['İhbar Tarihi', '18.07.2026'],
                      ['Adres', operationData?.claim.address ?? 'Kadıköy / İstanbul'],
                      ['Telefon', insuredPhone],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] text-slate-400">{k}</p>
                        <p className="truncate font-semibold text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                  {detailsOpen && (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                      Moda Cad. No: 12 D: 4 · Poliçe POL-2026-77881 · Hasar No HAS-998877
                    </p>
                  )}
                </section>

                {/* Bugünkü Görev — kompakt */}
                <section className="overflow-hidden rounded-xl border-2 border-blue-500 bg-white shadow-md">
                  <div className="grid gap-3 p-3.5 lg:grid-cols-12 lg:p-4">
                    <div className="lg:col-span-8">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Bugünkü Görev
                        </span>
                        <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Öncelik: Yüksek
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-start gap-2.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
                          <IconPhone className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">Sigortalıyı Ara</h2>
                          <p className="mt-0.5 text-xs text-slate-600">
                            Randevu onayı bekleniyor. İlk iletişimi gerçekleştirin.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <a
                          href={`tel:${insuredPhone.replace(/\s/g, '')}`}
                          onClick={() => void recordCall()}
                          className="t-fast inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <IconPhone className="h-3.5 w-3.5" />
                          {callBusy ? 'Kaydediliyor...' : 'Ara'}
                        </a>
                        <button
                          type="button"
                          disabled={!notificationPlanReady}
                          title={
                            notificationPlanReady
                              ? 'Zorunlu bilgilendirmeleri aç'
                              : `Önce tamamlanmalı: ${notificationPlanMissing.join(', ')}.`
                          }
                          onClick={() => open('whatsapp')}
                          className="t-fast inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <IconWa className="h-3.5 w-3.5" /> WhatsApp Mesaj Gönder
                        </button>
                        <button
                          type="button"
                          onClick={() => setRandevuOnayDone(true)}
                          className="t-fast inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <ActionBtnIcon kind="calendar" className="h-3.5 w-3.5 shrink-0" />
                          Randevuyu Onayla
                        </button>
                      </div>
                      {callRecordedAt ? (
                        <p className="mt-2 text-[11px] font-medium text-emerald-700">
                          ✓ Arama Gerçekleştirildi · {new Date(callRecordedAt).toLocaleString('tr-TR')}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="t-fast mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Sonra Hatırlat
                      </button>
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 lg:col-span-4">
                      <p className="text-[10px] font-semibold text-brand-600">Şimdi Yap</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{sonrakiAdimCta}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1">
                        {['Ara', 'Tespitçi', 'Tedarikçi', 'WA', 'Onay', 'Rapor'].map((s, i) => {
                          const stepN = i + 1;
                          const g = guide.find((x) => x.n === stepN);
                          const st = g?.state ?? 'future';
                          return (
                            <div key={s} className="flex items-center gap-1">
                              {i > 0 && <span className="h-px w-2 bg-slate-300" />}
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
                                  st === 'done'
                                    ? 'bg-status-success text-white'
                                    : st === 'active'
                                      ? 'bg-brand-600 text-white ring-2 ring-blue-200'
                                      : 'border border-slate-200 bg-white text-slate-400'
                                }`}
                                title={s}
                              >
                                {st === 'done' ? '✓' : stepN}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500">Kart → Drawer → Ata → Kart Güncellenir</p>
                    </div>
                  </div>
                </section>

                {/* Durum kartları — odak şerit ile senkron */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(() => {
                    const randevuFocus = cardFocus({
                      guideStep: 1,
                      activeGuideStep,
                      done: randevuOnayDone,
                      waiting: !randevuOnayDone,
                    });
                    const randevuShell =
                      randevuFocus === 'active'
                        ? 'border-2 border-blue-500 bg-blue-50/40 anim-pulse'
                        : randevuFocus === 'done'
                          ? 'border-2 border-emerald-400 bg-emerald-50/70'
                          : randevuFocus === 'waiting'
                            ? 'border border-amber-300 bg-white'
                            : 'border border-slate-200 bg-white';
                    return (
                  <div className={`t-card relative flex flex-col rounded-xl p-3.5 shadow-sm ${randevuShell}`}>
                    {randevuFocus === 'active' ? <AktifGorevRozet /> : null}
                    <div className={`flex items-start justify-between gap-2${randevuFocus === 'active' ? ' mt-1' : ''}`}>
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {randevuOnayDone ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success text-[10px] font-bold text-white">
                            ✓
                          </span>
                        ) : null}
                        Randevu Bilgileri
                      </h3>
                      <Pill
                        label={randevuOnayDone ? '✓ İşlem Tamamlandı' : 'İşlem Bekliyor'}
                        tone={randevuOnayDone ? 'green' : 'orange'}
                      />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-bold text-slate-950">
                        {operationData?.mainAppointment
                          ? new Date(operationData.mainAppointment.scheduledAt).toLocaleDateString(
                              'tr-TR',
                              { day: '2-digit', month: 'long', year: 'numeric' },
                            )
                          : 'Ana Randevu Oluşturulmadı'}
                      </p>
                      <p className="text-2xl font-bold tabular-nums text-slate-950">
                        {operationData?.mainAppointment
                          ? new Date(operationData.mainAppointment.scheduledAt).toLocaleTimeString(
                              'tr-TR',
                              { hour: '2-digit', minute: '2-digit' },
                            )
                          : '—'}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {operationData?.mainAppointment?.location ??
                        operationData?.claim.address ??
                        'Adres Bulunamadı'}
                    </p>
                    <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                      <p className="text-[10px] font-semibold text-slate-500">Sigortalı Onayı</p>
                      {randevuOnayDone ? (
                        <p className="mt-0.5 text-xs font-semibold text-emerald-700">✓ Onaylandı</p>
                      ) : (
                        <p className="mt-0.5 text-xs font-semibold text-amber-700">⚠ Henüz Onay Vermedi</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => open('randevu')}
                      className={`t-fast mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                        randevuFocus === 'active'
                          ? 'bg-brand-600 text-white hover:bg-blue-700'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ActionBtnIcon
                        kind="calendar"
                        className={`h-3.5 w-3.5 shrink-0 ${
                          randevuFocus === 'active' ? 'opacity-100' : 'opacity-60'
                        }`}
                      />
                      Randevuyu Düzenle
                    </button>
                    <button
                      type="button"
                      disabled
                      className="t-fast mt-1.5 w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-300"
                    >
                      Düzenle / Değiştir
                    </button>
                    <div className="mt-2">
                      <StagePassButton unlocked={randevuOnayDone} />
                    </div>
                  </div>
                    );
                  })()}

                  <OpStatusCard
                    title="Tespitçi Ataması"
                    ui={tespitUi}
                    focus={cardFocus({
                      guideStep: 2,
                      activeGuideStep,
                      done: !!state.tespitci,
                    })}
                    done={!!state.tespitci}
                    body={
                      state.tespitci ? (
                        <div>
                          <p className="font-semibold text-emerald-800">✓ İşlem Tamamlandı</p>
                          <p className="mt-1 font-semibold text-slate-900">
                            {state.tespitci}
                            {state.tespitciAt ? `, ${state.tespitciAt}` : ''}
                          </p>
                        </div>
                      ) : (
                        <p>Atama yapılmadı. Saha tespitçisi henüz görevlendirilmedi.</p>
                      )
                    }
                    actionLabel="Tespitçiyi Ata"
                    onAction={() => open('tespitci')}
                    onEdit={() => open('tespitci')}
                    actionDisabled={!operationData?.mainAppointment}
                    actionDisabledReason="Önce ana randevu oluşturulmalıdır."
                    canPass={!!state.tespitci && !state.stagePassed.tespitci}
                    onPass={() =>
                      setState((s) => ({ ...s, stagePassed: { ...s.stagePassed, tespitci: true } }))
                    }
                  />

                  <OpStatusCard
                    title="Tedarikçi Ataması"
                    ui={tedarikUi}
                    focus={cardFocus({
                      guideStep: 3,
                      activeGuideStep,
                      done: state.tedarikciDone,
                    })}
                    done={state.tedarikciDone}
                    body={
                      state.tedarikciDone ? (
                        <div>
                          <p className="font-semibold text-emerald-800">✓ İşlem Tamamlandı</p>
                          <p className="mt-1">Tedarikçi ataması kaydedildi.</p>
                        </div>
                      ) : (
                        <p>Tedarikçi henüz görevlendirilmedi.</p>
                      )
                    }
                    actionLabel="Tedarikçiyi Ata"
                    onAction={() => open('tedarikci')}
                    onEdit={() => open('tedarikci')}
                    actionDisabled={!operationData?.assignedInspector}
                    actionDisabledReason="Önce tespitçi ataması tamamlanmalıdır."
                    canPass={state.tedarikciDone && !state.stagePassed.tedarikci}
                    onPass={() =>
                      setState((s) => ({
                        ...s,
                        stagePassed: { ...s.stagePassed, tedarikci: true },
                      }))
                    }
                  />

                  <OpStatusCard
                    title="WhatsApp Durumu"
                    ui={waUi}
                    focus={cardFocus({
                      guideStep: 4,
                      activeGuideStep,
                      done: state.waDone,
                    })}
                    done={state.waDone}
                    body={
                      state.waDone ? (
                        <div>
                          <p className="font-semibold text-emerald-800">✓ İşlem Tamamlandı</p>
                          <p className="mt-1">Tüm zorunlu bilgilendirme mesajları iletildi.</p>
                        </div>
                      ) : (
                        <p>
                          {notificationPlanReady
                            ? `${notificationResults.filter((item) => item.status === 'sent').length}/${2 + (operationData?.assignedSuppliers.length ?? 0)} zorunlu bilgilendirme tamamlandı.`
                            : `Önce tamamlanmalı: ${notificationPlanMissing.join(', ')}.`}
                        </p>
                      )
                    }
                    actionLabel="Mesaj Gönder"
                    onAction={() => open('whatsapp')}
                    onEdit={() => open('whatsapp')}
                    actionDisabled={!notificationPlanReady || waBusy}
                    actionDisabledReason={
                      notificationPlanReady
                        ? 'Bilgilendirmeler hazırlanıyor.'
                        : `Önce tamamlanmalı: ${notificationPlanMissing.join(', ')}.`
                    }
                    canPass={state.waDone && !state.stagePassed.wa}
                    onPass={() => setState((s) => ({ ...s, stagePassed: { ...s.stagePassed, wa: true } }))}
                  />

                  <OpStatusCard
                    title="Dijital Onay"
                    ui={dijitalUi}
                    focus={cardFocus({
                      guideStep: 5,
                      activeGuideStep,
                      done: state.dijitalDone,
                    })}
                    done={state.dijitalDone}
                    body={
                      state.dijitalDone ? (
                        <div>
                          <p className="font-semibold text-emerald-800">✓ İşlem Tamamlandı</p>
                          <p className="mt-1">Onay formu sigortalıya gönderildi.</p>
                        </div>
                      ) : (
                        <p>Dijital onay henüz gönderilmedi.</p>
                      )
                    }
                    actionLabel="Dijital Onay Gönder"
                    onAction={() => open('dijital-onay')}
                    onEdit={() => open('dijital-onay')}
                    actionDisabled={!state.waDone}
                    actionDisabledReason="Önce tüm zorunlu bilgilendirmeler tamamlanmalıdır."
                    canPass={state.dijitalDone && !state.stagePassed.dijital}
                    onPass={() =>
                      setState((s) => ({ ...s, stagePassed: { ...s.stagePassed, dijital: true } }))
                    }
                  />

                  <OpStatusCard
                    title="Rapor Aşaması"
                    ui={cardUiState({
                      done: state.raporDone,
                      stagePassed: state.stagePassed.rapor,
                      drawerOpen: false,
                    })}
                    focus={cardFocus({
                      guideStep: 6,
                      activeGuideStep,
                      done: state.raporDone,
                    })}
                    done={state.raporDone}
                    body={
                      state.raporDone ? (
                        <div>
                          <p className="font-semibold text-emerald-800">✓ İşlem Tamamlandı</p>
                          <p className="mt-1">Rapor aşamasına geçildi (önizleme).</p>
                        </div>
                      ) : (
                        <p>Rapor aşaması henüz yapılmadı.</p>
                      )
                    }
                    actionLabel="Rapor Aşamasına Geç"
                    onAction={() =>
                      setState((s) => ({
                        ...s,
                        raporDone: true,
                        stagePassed: { ...s.stagePassed, rapor: false },
                      }))
                    }
                    onEdit={() =>
                      setState((s) => ({
                        ...s,
                        raporDone: true,
                        stagePassed: { ...s.stagePassed, rapor: false },
                      }))
                    }
                    actionDisabled={!state.dijitalDone}
                    actionDisabledReason="Önce dijital onay tamamlanmalıdır."
                    canPass={state.raporDone && !state.stagePassed.rapor}
                    onPass={() =>
                      setState((s) => ({ ...s, stagePassed: { ...s.stagePassed, rapor: true } }))
                    }
                  />
                </div>

                {/* Hızlı İşlemler — yalnız 1. Perde aksiyonları */}
                <section className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Hızlı İşlemler</h3>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {QUICK.map((item) => (
                      <button
                        key={item.t}
                        type="button"
                        disabled={item.drawer === 'whatsapp' && !notificationPlanReady}
                        title={
                          item.drawer === 'whatsapp' && !notificationPlanReady
                            ? `Önce tamamlanmalı: ${notificationPlanMissing.join(', ')}.`
                            : undefined
                        }
                        onClick={() => {
                          if (item.t === 'Ara') {
                            void recordCall();
                            window.location.href = `tel:${insuredPhone.replace(/\s/g, '')}`;
                            return;
                          }
                          if (item.drawer) open(item.drawer);
                        }}
                        className="t-fast group flex w-[72px] flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100 group-hover:text-slate-800">
                          <QuickIcon name={item.icon} />
                        </span>
                        <span className="text-center text-[10px] font-semibold leading-tight text-slate-700">
                          {item.t}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sağ kolon */}
              <div className="space-y-3 xl:col-span-3">
                <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Zorunlu İşlemler</h3>
                    <Pill label={`${zorunluDone}/${zorunluTotal} Tamamlandı`} tone="blue" />
                  </div>
                  <ul className="mt-3 space-y-2">
                    {[
                      {
                        t: 'Tespitçi Ataması',
                        done: !!state.tespitci,
                        active: activeGuideStep === 2,
                        onClick: () => open('tespitci'),
                      },
                      {
                        t: 'Tedarikçi Ataması',
                        done: state.tedarikciDone,
                        active: activeGuideStep === 3,
                        onClick: () => open('tedarikci'),
                      },
                      {
                        t: 'WhatsApp Mesajı',
                        done: state.waDone,
                        active: activeGuideStep === 4,
                        onClick: () => open('whatsapp'),
                      },
                      {
                        t: 'Dijital Onay Gönderimi',
                        done: state.dijitalDone,
                        active: activeGuideStep === 5,
                        onClick: () => open('dijital-onay'),
                      },
                      {
                        t: 'Rapor Aşaması',
                        done: state.raporDone,
                        active: activeGuideStep === 6,
                        onClick: () =>
                          setState((s) => ({
                            ...s,
                            raporDone: true,
                          })),
                      },
                      {
                        t: 'Randevu Onayı',
                        done: randevuOnayDone,
                        active: activeGuideStep === 1,
                        onClick: () => setRandevuOnayDone(true),
                      },
                    ].map((row) => (
                      <li key={row.t}>
                        <button
                          type="button"
                          onClick={row.onClick}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs ${
                            row.done
                              ? 'border-emerald-200 bg-emerald-50'
                              : row.active
                                ? 'anim-pulse border-2 border-blue-500 bg-blue-50 ring-2 ring-blue-200/70'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-800">{row.t}</span>
                            <Pill
                              label={row.done ? 'Tamamlandı' : 'İşlem Bekliyor'}
                              tone={row.done ? 'green' : row.active ? 'blue' : 'orange'}
                            />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] leading-relaxed text-amber-700">
                    Zorunlular bitmeden sonraki perdeye geçilemez.
                  </p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Notlar & Hatırlatmalar</h3>
                    <button
                      type="button"
                      className="rounded-md bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700"
                    >
                      + Yeni Not
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1 rounded-lg bg-slate-100 p-0.5">
                    {(
                      [
                        ['notlar', `Notlar (${MOCK_NOTES.length})`],
                        ['hatirlatmalar', `Hatırlatmalar (${MOCK_REMINDERS.length})`],
                        ['tumu', 'Tümü'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setNotesTab(id)}
                        className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-semibold ${
                          notesTab === id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <ul className="mt-3 max-h-52 space-y-2 overflow-auto">
                    {(notesTab === 'hatirlatmalar' ? [] : MOCK_NOTES).map((n) => (
                      <li key={`${n.who}-${n.when}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-slate-800">{n.who}</p>
                          <p className="text-[10px] text-slate-400">{n.when}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">{n.text}</p>
                        {n.tag && (
                          <span
                            className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              n.tag === 'Önemli'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {n.tag}
                          </span>
                        )}
                      </li>
                    ))}
                    {(notesTab === 'notlar' ? [] : MOCK_REMINDERS).map((r) => (
                      <li key={r.text} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-slate-800">{r.text}</p>
                          <Pill label={r.active ? 'Aktif' : 'Bekliyor'} tone={r.active ? 'blue' : 'gray'} />
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{r.when}</p>
                      </li>
                    ))}
                  </ul>
                  {operationData?.activity.length ? (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-slate-800">
                        Operasyon Geçmişi ({operationData.activity.length})
                      </summary>
                      <ul className="mt-2 max-h-40 space-y-1.5 overflow-auto">
                        {operationData.activity.slice(0, 20).map((item) => (
                          <li key={item.id} className="rounded-md bg-white px-2 py-1.5 text-[10px]">
                            <p className="font-medium text-slate-700">{item.description}</p>
                            <p className="mt-0.5 text-slate-400">
                              {new Date(item.createdAt).toLocaleString('tr-TR')} ·{' '}
                              {item.actor
                                ? `${item.actor.firstName} ${item.actor.lastName}`
                                : 'Kullanıcı'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-900">Randevu Hatırlatma</p>
                      <p className="text-[10px] text-slate-500">Yarın 10:00&apos;da hatırlat</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={randevuHatirlat}
                      onClick={() => setRandevuHatirlat((v) => !v)}
                      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                        randevuHatirlat ? 'bg-brand-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          randevuHatirlat ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </main>

          {/* Alt aşama şeridi — daireli stepper (00:58) */}
          <footer className="sticky bottom-0 z-20 border-t border-slate-700 bg-[#0B1F3A] text-white">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-1 overflow-x-auto">
                {guide.map((step, idx) => (
                  <div key={step.label} className="flex min-w-0 flex-1 items-center">
                    <div className="flex min-w-0 flex-col items-center gap-1 px-0.5 text-center">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          step.state === 'done'
                            ? 'bg-status-success text-white'
                            : step.state === 'active'
                              ? 'bg-brand-600 text-white ring-4 ring-blue-500/30'
                              : 'bg-slate-500 text-slate-200'
                        }`}
                      >
                        {step.state === 'done' ? '✓' : step.n}
                      </span>
                      <p
                        className={`max-w-[88px] truncate text-[10px] font-semibold leading-tight ${
                          step.state === 'done'
                            ? 'text-emerald-300'
                            : step.state === 'active'
                              ? 'text-white'
                              : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-[9px] ${
                          step.state === 'done'
                            ? 'text-emerald-400/80'
                            : step.state === 'active'
                              ? 'text-blue-200'
                              : 'text-slate-500'
                        }`}
                      >
                        {step.meta}
                      </p>
                    </div>
                    {idx < guide.length - 1 && (
                      <div
                        className={`mx-0.5 mb-6 h-0.5 min-w-[12px] flex-1 ${
                          step.state === 'done' ? 'bg-status-success/60' : 'bg-slate-600'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="ml-auto shrink-0 text-right">
                <button
                  type="button"
                  disabled={zorunluDone < zorunluTotal}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold ${
                    zorunluDone < zorunluTotal
                      ? 'cursor-not-allowed bg-slate-600/60 text-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-status-success'
                  }`}
                >
                  {zorunluDone < zorunluTotal && (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  )}
                  Sonraki Perdeye Geç {zorunluDone < zorunluTotal ? '(Kilitli)' : ''}
                </button>
                {zorunluDone < zorunluTotal && (
                  <p className="mt-0.5 text-[9px] text-slate-400">Zorunlu işlemler tamamlanmalı</p>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Drawers */}
      {drawer === 'tespitci' && (
        <DrawerShell
          title={drawerSuccess ? 'İşlem Tamamlandı' : 'Tespitçi Seç'}
          xwide={!drawerSuccess}
          wide={!!drawerSuccess}
          headerExtra={drawerContextBar}
          onClose={close}
          hideFooter={!!drawerSuccess}
          primaryLabel={drawerSuccess ? undefined : 'Tespitçiyi Ata'}
          primaryDisabled={!selectedTespitci}
          onPrimary={
            drawerSuccess
              ? undefined
              : async () => {
                  if (!selectedTespitci) return;
                  const claimId = operationData?.claim.id;
                  const isLocalClaim = !claimId || claimId.startsWith('local-');
                  if (!isLocalClaim) {
                    try {
                      await axios.post(
                        `${API}/claim-files/${claimId}/assign-inspector-vendor`,
                        {
                          vendorId: selectedTespitci.id,
                          note: '1. Perde Operasyon Merkezi üzerinden atandı.',
                        },
                        { headers: authHeader() },
                      );
                    } catch (error: any) {
                      // Lokal doğrulamada API yoksa yine de atamayı ekranda tamamla
                      setOperationNotice(
                        error?.response?.data?.message
                          ? `${error.response.data.message} — Lokal atama uygulandı.`
                          : 'Tespitçi lokal olarak atandı.',
                      );
                    }
                  }
                  const now = new Date();
                  const stamp = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
                  setOperationData((current) =>
                    current
                      ? {
                          ...current,
                          assignedInspector: {
                            id: selectedTespitci.id,
                            name: selectedTespitci.ad,
                            phone: selectedTespitci.telefon,
                          },
                        }
                      : current,
                  );
                  setState((s) => ({
                    ...s,
                    tespitci: selectedTespitci.ad,
                    tespitciAt: stamp,
                    stagePassed: { ...s.stagePassed, tespitci: false },
                  }));
                  setDrawerSuccess(selectedTespitci.ad);
                  if (!isLocalClaim) void loadOperationCenter();
                }
          }
        >
          {drawerSuccess ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success text-3xl font-bold text-white">
                ✓
              </div>
              <p className="mt-4 text-lg font-bold text-slate-950">İşlem Tamamlandı</p>
              <p className="mt-1 text-sm text-slate-600">Tespitçi başarıyla atandı.</p>
              <div className="mt-5 w-full max-w-sm rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-left text-xs">
                <p>
                  <span className="text-slate-400">Tespitçi: </span>
                  <span className="font-semibold text-slate-900">{drawerSuccess}</span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-400">Tarih: </span>
                  <span className="font-semibold text-slate-900">{state.tespitciAt}</span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-400">Bölge: </span>
                  <span className="font-semibold text-slate-900">{DOSYA_BAGLAM.bolge}</span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-400">Not: </span>
                  <span className="font-semibold text-slate-900">Atama dosyaya işlendi (önizleme).</span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="t-fast mt-6 rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-600">Kayıtlı Tespitçi Ara</label>
                <input
                  value={tespitciSearch}
                  onChange={(e) => setTespitciSearch(e.target.value)}
                  placeholder="Ad Soyad, Telefon, İl / İlçe, Hizmet Bölgesi, Hizmet Grubu"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Yalnızca sisteme tanımlı tespitçiler listelenir.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TESPIT_FILTRELER.map((f) => {
                    const active = tespitFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTespitFilter(active ? null : f.id)}
                        className={`t-fast rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          active
                            ? 'bg-brand-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Seç</th>
                        <th className="px-2 py-2 font-semibold">Ad Soyad</th>
                        <th className="px-2 py-2 font-semibold">Bölge</th>
                        <th className="px-2 py-2 font-semibold">Durum</th>
                        <th className="px-2 py-2 font-semibold">Puan</th>
                        <th className="px-2 py-2 font-semibold">Son Çalışma</th>
                        <th className="px-2 py-2 font-semibold">Maliyet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTespitci.map((t) => {
                        const selected = selectedTespitciId === t.id;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTespitciId(t.id)}
                            className={`cursor-pointer border-t border-slate-100 ${
                              selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-2 py-2">
                              <span
                                className={`inline-flex h-3.5 w-3.5 rounded-full border ${
                                  selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                                }`}
                              />
                            </td>
                            <td className="px-2 py-2 font-semibold text-slate-900">{t.ad}</td>
                            <td className="px-2 py-2 text-slate-600">{t.ilce}</td>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    t.uygun === true
                                      ? 'bg-status-success'
                                      : t.uygun === false
                                        ? 'bg-status-danger'
                                        : 'bg-slate-300'
                                  }`}
                                />
                                {t.uygun === true ? 'Uygun' : t.uygun === false ? 'Meşgul' : 'Bilinmiyor'}
                              </span>
                            </td>
                            <td className="px-2 py-2 font-semibold">{t.puan?.toFixed(1) ?? '—'}</td>
                            <td className="px-2 py-2">{t.sonCalisma ?? '—'}</td>
                            <td className="px-2 py-2">
                              {t.ortalamaMaliyet != null
                                ? `${t.ortalamaMaliyet.toLocaleString('tr-TR')} ₺`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredTespitci.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">Sonuç bulunamadı.</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="sticky top-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-[10px] font-bold text-blue-700">Seçilen Tespitçi</p>
                  {selectedTespitci ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                          {selectedTespitci.ad
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-950">{selectedTespitci.ad}</p>
                          <p className="text-xs text-amber-600">
                            {selectedTespitci.puan != null ? `★ ${selectedTespitci.puan.toFixed(1)}` : 'Puan Yok'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="t-fast flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700"
                        >
                          Telefon
                        </button>
                        <button
                          type="button"
                          className="t-fast flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] font-semibold text-emerald-800"
                        >
                          WhatsApp
                        </button>
                      </div>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="text-[10px] text-slate-400">Hizmet Bölgesi</dt>
                          <dd className="font-semibold text-slate-800">{selectedTespitci.hizmetBolgesi}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-slate-400">Telefon / WhatsApp</dt>
                          <dd className="font-semibold text-slate-800">
                            {selectedTespitci.telefon}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-slate-400">Ortalama Maliyet</dt>
                          <dd className="font-semibold text-slate-800">
                            {selectedTespitci.ortalamaMaliyet != null
                              ? `${selectedTespitci.ortalamaMaliyet.toLocaleString('tr-TR')} ₺`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-slate-400">Son Çalışma</dt>
                          <dd className="font-semibold text-slate-800">{selectedTespitci.sonCalisma ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-slate-400">Son 10 İş</dt>
                          <dd className="mt-1 max-h-28 space-y-1 overflow-auto">
                            {selectedTespitci.sonIsler.map((is) => (
                              <p key={is} className="text-[11px] text-slate-600">
                                · {is}
                              </p>
                            ))}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                          <dt className="text-[10px] text-slate-400">Operasyon Notları</dt>
                          <dd className="mt-0.5 text-slate-700">{selectedTespitci.operasyonNotlari}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="mt-6 text-center text-sm text-slate-400">
                      Karşılaştırma için soldan bir tespitçi seçin.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DrawerShell>
      )}

      {drawer === 'tedarikci' && (
        <DrawerShell
          title={drawerSuccess ? 'İşlem Tamamlandı' : 'Tedarikçi Ata'}
          wide
          headerExtra={drawerContextBar}
          onClose={close}
          hideFooter={!!drawerSuccess}
          primaryLabel={drawerSuccess ? undefined : 'Tedarikçileri Kaydet'}
          primaryDisabled={!selectedSupplierIds.length || !operationData?.claim.id}
          primaryTone="green"
          onPrimary={
            drawerSuccess
              ? undefined
              : async () => {
                  if (!operationData?.claim.id || !selectedSupplierIds.length) return;
                  try {
                    await axios.post(
                      `${API}/claim-files/${operationData.claim.id}/assign-supplier`,
                      {
                        supplierIds: selectedSupplierIds,
                        note: '1. Perde Operasyon Merkezi üzerinden atandı.',
                      },
                      { headers: authHeader() },
                    );
                    setState((s) => ({
                      ...s,
                      tedarikciDone: true,
                      stagePassed: { ...s.stagePassed, tedarikci: false },
                    }));
                    setDrawerSuccess('tedarikci');
                    void loadOperationCenter();
                  } catch (error: any) {
                    setOperationNotice(error?.response?.data?.message ?? 'Tedarikçi ataması kaydedilemedi.');
                  }
                }
          }
        >
          {drawerSuccess === 'tedarikci' ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success text-3xl font-bold text-white">
                ✓
              </div>
              <p className="mt-4 text-lg font-bold text-slate-950">İşlem Tamamlandı</p>
              <p className="mt-1 text-sm text-slate-600">Tedarikçi atamaları kaydedildi.</p>
              <button
                type="button"
                onClick={close}
                className="t-fast mt-6 rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setTedarikciTab('kayitli')}
                  className={`t-fast flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    tedarikciTab === 'kayitli' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Kayıtlı Tedarikçiler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTedarikciTab('google');
                    if (!alternativeSuppliers.length) void searchAlternatives();
                  }}
                  className={`t-fast flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    tedarikciTab === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Alternatif Öneriler
                </button>
              </div>

              {tedarikciTab === 'kayitli' ? (
                <>
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-800">Dosyada Kimler Var?</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {operationData?.assignedSuppliers.length
                        ? operationData.assignedSuppliers.map((supplier) => supplier.name).join(' · ')
                        : 'Henüz Tedarikçi Atanmadı'}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {registeredSuppliers.map((row) => {
                      const selected = selectedSupplierIds.includes(row.id);
                      const assigned = operationData?.assignedSuppliers.some(
                        (supplier) => supplier.id === row.id,
                      );
                      return (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {[row.district, row.city].filter(Boolean).join(' / ') || 'Bölge Bilgisi Yok'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {assigned ? <Pill label="Dosyada" tone="green" /> : null}
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-blue-700">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                setSelectedSupplierIds((current) =>
                                  event.target.checked
                                    ? Array.from(new Set([...current, row.id]))
                                    : current.filter((id) => id !== row.id),
                                )
                              }
                            />
                            {assigned ? 'Koru' : 'Ata'}
                          </label>
                          {assigned ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!operationData?.claim.id) return;
                                await axios.delete(
                                  `${API}/claim-files/${operationData.claim.id}/suppliers/${row.id}`,
                                  { headers: authHeader() },
                                );
                                setSelectedSupplierIds((current) =>
                                  current.filter((id) => id !== row.id),
                                );
                                void loadOperationCenter();
                              }}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Kaldır
                            </button>
                          ) : null}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                  {!registeredSuppliers.length ? (
                    <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-center text-xs text-amber-800">
                      Hasar türü, iş grubu ve bölgeye uygun kayıtlı tedarikçi bulunamadı.
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 space-y-2">
                  {alternativeLoading ? (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                      Alternatif öneriler aranıyor...
                    </p>
                  ) : alternativeSuppliers.length ? (
                    alternativeSuppliers.map((candidate) => (
                      <div key={candidate.externalId} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">{candidate.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{candidate.address}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Puan: {candidate.rating ?? '—'} · Değerlendirme: {candidate.reviewCount ?? '—'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAlternativeDraft(candidate);
                            setAlternativePhone(candidate.phone ?? '');
                          }}
                          className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
                        >
                          Tedarikçi Havuzuna Kaydet
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-slate-800">Alternatif Öneriler</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.
                      </p>
                    </div>
                  )}
                  {alternativeDraft ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                      <p className="text-xs font-semibold text-slate-800">
                        {alternativeDraft.name} — Havuza Kaydet
                      </p>
                      <label className="mt-2 block text-xs text-slate-600">Telefon</label>
                      <input
                        value={alternativePhone}
                        onChange={(event) => setAlternativePhone(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!alternativePhone.trim()}
                        onClick={async () => {
                          if (!operationData?.claim.id) return;
                          try {
                            const response = await axios.post(
                              `${API}/vendors`,
                              {
                                name: alternativeDraft.name,
                                phone: alternativePhone,
                                address: alternativeDraft.address || undefined,
                                city: alternativeDraft.city || operationData.claim.city || undefined,
                                district: alternativeDraft.district || operationData.claim.district || undefined,
                                type: 'hizmet',
                                category: 'hasar',
                                notes: 'Alternatif önerilerden tedarikçi havuzuna eklendi.',
                              },
                              { headers: authHeader() },
                            );
                            const vendor = response.data.data;
                            setRegisteredSuppliers((current) => [...current, vendor]);
                            setSelectedSupplierIds((current) => Array.from(new Set([...current, vendor.id])));
                            await axios.post(
                              `${API}/claim-files/${operationData.claim.id}/assign-supplier`,
                              { supplierId: vendor.id, note: 'Alternatif öneriden havuza kaydedilip atandı.' },
                              { headers: authHeader() },
                            );
                            setAlternativeDraft(null);
                            setTedarikciTab('kayitli');
                            setOperationNotice('Tedarikçi havuza kaydedildi ve dosyaya atandı.');
                            void loadOperationCenter();
                          } catch (error: any) {
                            setOperationNotice(error?.response?.data?.message ?? 'Tedarikçi kaydedilemedi.');
                          }
                        }}
                        className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Havuza Kaydet Ve Dosyaya Ata
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </DrawerShell>
      )}

      {drawer === 'whatsapp' && (
        <DrawerShell
          title="Zorunlu Bilgilendirmeler"
          onClose={close}
          headerExtra={drawerContextBar}
          hideFooter
        >
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-blue-900">Gönderim Sırası Zorunludur</p>
            <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
              Sigortalı, tespitçi ve atanmış tedarikçiler sırayla bilgilendirilir. Bir gönderim
              tamamlanmadan sonraki alıcı açılamaz.
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {notificationResults.map((result, index) => {
              const previousCompleted = notificationResults
                .slice(0, index)
                .every((item) => item.status === 'sent');
              const active = previousCompleted && result.status !== 'sent';
              const locked = !previousCompleted;
              return (
                <div
                  key={result.eventId}
                  className={`rounded-xl border p-3 ${
                    result.status === 'sent'
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : active
                        ? 'border-blue-400 bg-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {index + 1}. Bildirim ·{' '}
                        {result.recipientType === 'insured'
                          ? 'Sigortalı'
                          : result.recipientType === 'adjuster'
                            ? 'Tespitçi'
                            : 'Tedarikçi'}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {result.recipientName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {result.phone || 'Telefon Numarası Bulunamadı'}
                      </p>
                    </div>
                    <Pill
                      label={
                        result.status === 'sent'
                          ? 'Gönderildi'
                          : locked
                            ? 'Sırasını Bekliyor'
                            : result.status === 'opened'
                              ? 'Sonuç Bekleniyor'
                              : result.status === 'failed'
                                ? 'Tekrar Deneyin'
                                : 'Gönderime Hazır'
                      }
                      tone={
                        result.status === 'sent'
                          ? 'green'
                          : result.status === 'failed'
                            ? 'red'
                            : active
                              ? 'blue'
                              : 'gray'
                      }
                    />
                  </div>
                  <textarea
                    value={result.message}
                    disabled={locked || result.status === 'sent'}
                    onChange={(event) => {
                      const message = event.target.value;
                      setNotificationResults((current) =>
                        current.map((item) =>
                          item.eventId === result.eventId
                            ? { ...item, message, url: toWhatsAppLink(item.phone, message) }
                            : item,
                        ),
                      );
                    }}
                    rows={5}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-700 disabled:bg-slate-100"
                  />
                  {!locked && result.status !== 'sent' && (
                    <div className="mt-2 space-y-2">
                      {result.url ? (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void recordNotificationResult(result, 'opened')}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <IconWa className="h-4 w-4" /> WhatsApp&apos;ta Aç Ve Gönder
                        </a>
                      ) : (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          Telefon numarası bulunmadan bu bildirim tamamlanamaz.
                        </p>
                      )}
                      {result.status === 'opened' && (
                        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
                          Mesajı gönderdikten sonra bu Drawer&apos;a dönüp sonucu işaretleyin.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={
                            result.status !== 'opened' && !isWhatsAppMarkSentBypassActive()
                          }
                          onClick={() => void recordNotificationResult(result, 'sent')}
                          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          Gönderildi
                        </button>
                        <button
                          type="button"
                          disabled={result.status !== 'opened'}
                          onClick={() => void recordNotificationResult(result, 'failed')}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                        >
                          Gönderilemedi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DrawerShell>
      )}

      {drawer === 'dijital-onay' && (
        <DrawerShell
          title="Dijital Onay Gönder"
          onClose={close}
          primaryLabel="Gönder"
          onPrimary={() => {
            setState((s) => ({ ...s, dijitalDone: true }));
            close();
          }}
        >
          <label className="block text-xs font-semibold text-slate-600">Belge</label>
          <select
            value={onayBelge}
            onChange={(e) => setOnayBelge(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="hasar_onay_formu">Hasar Onay Formu</option>
            <option value="randevu_onay">Randevu Onay Formu</option>
          </select>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">Hasar Onay Formu</p>
              <p className="mt-1 text-xs text-slate-500">PDF Önizleme</p>
              <button type="button" className="mt-3 text-xs font-semibold text-blue-700 hover:underline">
                Pdf Önizle
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Gönderim sonrası kart durumu güncellenir.</p>
        </DrawerShell>
      )}

      {drawer === 'randevu' && (
        <DrawerShell
          title="Randevuyu Düzenle"
          onClose={close}
          headerExtra={drawerContextBar}
          primaryLabel={appointmentSaving ? 'Kaydediliyor...' : 'Randevuyu Kaydet'}
          primaryDisabled={appointmentSaving || !appointmentForm.date || !appointmentForm.time || !appointmentForm.location.trim()}
          onPrimary={() => void saveAppointment()}
        >
          <p className="mb-3 text-xs text-slate-500">
            Dosya özeti üstte yer alır. Bu alanda yalnızca randevu bilgilerini güncelleyin.
          </p>
          <label className="block text-xs font-semibold text-slate-600">Tarih</label>
          <div className="mt-1">
            <TrDateInput
              value={appointmentForm.date}
              onChange={(value) => setAppointmentForm((current) => ({ ...current, date: value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              aria-label="Randevu Tarihi"
            />
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-600">Saat</label>
          <input
            type="time"
            value={appointmentForm.time}
            onChange={(event) => setAppointmentForm((current) => ({ ...current, time: event.target.value }))}
            onClick={(event) => openNativePicker(event.currentTarget)}
            onFocus={(event) => openNativePicker(event.currentTarget)}
            className="mt-1 w-full cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Adres</label>
          <textarea
            value={appointmentForm.location}
            onChange={(event) => setAppointmentForm((current) => ({ ...current, location: event.target.value }))}
            onBlur={(event) => {
              const v = toTitleCaseTR(event.target.value.trim());
              if (v) setAppointmentForm((current) => ({ ...current, location: v }));
            }}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Konum Bağlantısı</label>
          <input
            type="url"
            value={appointmentForm.locationUrl}
            onChange={(event) => setAppointmentForm((current) => ({ ...current, locationUrl: event.target.value }))}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Tahmini Süre (Dakika)</label>
          <input
            type="number"
            min={1}
            max={1440}
            value={appointmentForm.durationMinutes}
            onChange={(event) => setAppointmentForm((current) => ({ ...current, durationMinutes: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Randevu Notu</label>
          <textarea
            value={appointmentForm.notes}
            onChange={(event) => setAppointmentForm((current) => ({ ...current, notes: event.target.value }))}
            onBlur={(event) => {
              const v = toTitleCaseTR(event.target.value.trim());
              setAppointmentForm((current) => ({ ...current, notes: v }));
            }}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </DrawerShell>
      )}
    </div>
  );
}
