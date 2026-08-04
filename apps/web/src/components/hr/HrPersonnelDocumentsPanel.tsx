'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Upload,
  UserRound,
} from 'lucide-react';

export type DocPhase = 'hire' | 'active' | 'exit';
export type DocRequirement = 'required' | 'conditional' | 'optional';
export type DocStatus = 'uploaded' | 'missing' | 'not_applicable';
/** Personel çalışma tipi — evrak zorunluluğu bu kapsama göre hesaplanır. */
export type WorkScope = 'office' | 'field' | 'hazardous';

export type DocApplicability = 'all' | WorkScope | 'male' | 'position';

export type PersonnelDocItem = {
  id: string;
  title: string;
  phase: DocPhase;
  requirement: DocRequirement;
  /** Bu evrak hangi çalışma tipine uygulanır? */
  appliesTo: DocApplicability[];
  legalBasis: string;
  note?: string;
  status: DocStatus;
  uploadedAt?: string | null;
  fileName?: string | null;
};

export const WORK_SCOPE_LABELS: Record<WorkScope, string> = {
  office: 'Ofis',
  field: 'Saha',
  hazardous: 'Riskli İş',
};

function isApplicable(doc: PersonnelDocItem, workScope: WorkScope): boolean {
  if (doc.appliesTo.includes('all')) return true;
  if (doc.appliesTo.includes(workScope)) return true;
  // male / position: koşullu — listede kalır ama zorunlu sayaca girmez (önizleme)
  if (doc.appliesTo.includes('male') || doc.appliesTo.includes('position')) return true;
  return false;
}

const PHASE_LABELS: Record<DocPhase, string> = {
  hire: 'İşe Giriş',
  active: 'Çalışma Süreci',
  exit: 'İşten Çıkış',
};

const REQUIREMENT_LABELS: Record<DocRequirement, string> = {
  required: 'Zorunlu',
  conditional: 'Koşullu',
  optional: 'Önerilen',
};

/** 4857 m.75 + uygulamada genel kabul gören çekirdek liste (önizleme). */
export const PERSONNEL_DOCUMENTS_PREVIEW: PersonnelDocItem[] = [
  {
    id: 'id_copy',
    title: 'Nüfus Cüzdanı / Kimlik Fotokopisi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.75',
    status: 'uploaded',
    uploadedAt: '2026-03-12T10:20:00+03:00',
    fileName: 'kimlik-fotokopi.pdf',
  },
  {
    id: 'employment_contract',
    title: 'İmzalı İş Sözleşmesi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.8',
    note: 'Islak imzalı asıl veya taranmış kopya',
    status: 'uploaded',
    uploadedAt: '2026-03-12T10:25:00+03:00',
    fileName: 'is-sozlesmesi-imzali.pdf',
  },
  {
    id: 'sgk_entry',
    title: 'Sgk İşe Giriş Bildirgesi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '5510/m.8',
    status: 'uploaded',
    uploadedAt: '2026-03-12T11:00:00+03:00',
    fileName: 'sgk-giris.pdf',
  },
  {
    id: 'kvkk',
    title: 'Kvkk Aydınlatma Metni Ve Açık Rıza',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '6698',
    status: 'missing',
  },
  {
    id: 'health_report',
    title: 'İşe Giriş Sağlık Raporu',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['field', 'hazardous'],
    legalBasis: '6331/m.15',
    note: 'Saha / riskli iş için zorunlu',
    status: 'missing',
  },
  {
    id: 'isg_training',
    title: 'İsg Eğitim Katılım Belgesi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['field', 'hazardous'],
    legalBasis: '6331/m.17',
    note: 'Ofis personeli için uygulanmaz',
    status: 'missing',
  },
  {
    id: 'diploma',
    title: 'Diploma / Mezuniyet Belgesi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.75',
    status: 'uploaded',
    uploadedAt: '2026-03-12T10:40:00+03:00',
    fileName: 'diploma.pdf',
  },
  {
    id: 'residence',
    title: 'İkametgah Belgesi',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.75',
    status: 'missing',
  },
  {
    id: 'photo',
    title: 'Vesikalık Fotoğraf',
    phase: 'hire',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.75',
    status: 'uploaded',
    uploadedAt: '2026-03-12T10:15:00+03:00',
    fileName: 'vesikalik.jpg',
  },
  {
    id: 'military',
    title: 'Askerlik Durum Belgesi',
    phase: 'hire',
    requirement: 'conditional',
    appliesTo: ['male'],
    legalBasis: '4857/m.75',
    note: 'Erkek çalışanlar için',
    status: 'missing',
  },
  {
    id: 'criminal_record',
    title: 'Adli Sicil Kaydı',
    phase: 'hire',
    requirement: 'conditional',
    appliesTo: ['position'],
    legalBasis: '4857/m.75',
    note: 'Pozisyona göre',
    status: 'missing',
  },
  {
    id: 'iban_form',
    title: 'Banka / Iban Bilgi Formu',
    phase: 'hire',
    requirement: 'optional',
    appliesTo: ['all'],
    legalBasis: 'Uygulama',
    status: 'uploaded',
    uploadedAt: '2026-03-13T09:00:00+03:00',
    fileName: 'iban-form.pdf',
  },
  {
    id: 'annual_leave_forms',
    title: 'Yıllık İzin Formları',
    phase: 'active',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.54',
    note: 'Onaylı izin evrakları (ıslak veya dijital kayıt)',
    status: 'uploaded',
    uploadedAt: '2026-07-02T14:10:00+03:00',
    fileName: 'izin-formu-temmuz.pdf',
  },
  {
    id: 'payroll_signed',
    title: 'İmzalı Ücret Bordroları',
    phase: 'active',
    requirement: 'required',
    appliesTo: ['all'],
    legalBasis: '4857/m.37',
    status: 'missing',
  },
  {
    id: 'overtime_consent',
    title: 'Fazla Çalışma Yazılı Onayı',
    phase: 'active',
    requirement: 'conditional',
    appliesTo: ['all'],
    legalBasis: '4857/m.41',
    note: 'Fazla mesai yapıldığında',
    status: 'missing',
  },
  {
    id: 'periodic_health',
    title: 'Periyodik Sağlık Muayene Belgesi',
    phase: 'active',
    requirement: 'conditional',
    appliesTo: ['field', 'hazardous'],
    legalBasis: '6331/m.15',
    status: 'missing',
  },
  {
    id: 'discipline',
    title: 'Disiplin / Uyarı Yazıları',
    phase: 'active',
    requirement: 'optional',
    appliesTo: ['all'],
    legalBasis: '4857',
    note: 'Oluştuğunda',
    status: 'missing',
  },
  {
    id: 'resignation',
    title: 'İstifa / Fesih Bildirimi',
    phase: 'exit',
    requirement: 'conditional',
    appliesTo: ['all'],
    legalBasis: '4857/m.17-19',
    note: 'İş ilişkisi sona erdiğinde',
    status: 'missing',
  },
  {
    id: 'sgk_exit',
    title: 'Sgk İşten Ayrılış Bildirgesi',
    phase: 'exit',
    requirement: 'conditional',
    appliesTo: ['all'],
    legalBasis: '5510',
    status: 'missing',
  },
  {
    id: 'release_form',
    title: 'İbraname',
    phase: 'exit',
    requirement: 'conditional',
    appliesTo: ['all'],
    legalBasis: '4857/m.75',
    status: 'missing',
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  preview?: boolean;
  employeeName?: string;
  /** Personelin çalışma tipi — zorunlu evrak hesabı buna göre yapılır. */
  workScope?: WorkScope;
  documents?: PersonnelDocItem[];
  canUpload?: boolean;
  canSelectEmployee?: boolean;
  onWorkScopeChange?: (scope: WorkScope) => void;
  /** Canlıda yükleme EntityDocumentsTab üzerinden yapılır. */
  onUploadRequest?: (doc: PersonnelDocItem) => void;
};

/**
 * Islak imzalı personel özlük evrakları paneli.
 * Önizleme: örnek veri. Canlıda kontrol listesi + entity-documents yükleme alanı.
 */
export function HrPersonnelDocumentsPanel({
  preview = false,
  employeeName = 'Ayşe Yılmaz',
  workScope = 'office',
  documents,
  canUpload = true,
  canSelectEmployee = true,
  onWorkScopeChange,
  onUploadRequest,
}: Props) {
  const liveDocuments = useMemo(
    () =>
      PERSONNEL_DOCUMENTS_PREVIEW.map((d) => ({
        ...d,
        status: 'missing' as DocStatus,
        uploadedAt: null,
        fileName: null,
      })),
    [],
  );
  const effectiveDocuments = documents ?? (preview ? PERSONNEL_DOCUMENTS_PREVIEW : liveDocuments);

  const [phaseFilter, setPhaseFilter] = useState<DocPhase | 'all'>('all');
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localScope, setLocalScope] = useState<WorkScope>(workScope);

  const effectiveScope = onWorkScopeChange ? workScope : localScope;

  const resolvedDocs = useMemo(() => {
    return effectiveDocuments.map((doc) => {
      if (!isApplicable(doc, effectiveScope)) {
        return { ...doc, status: 'not_applicable' as const };
      }
      return doc;
    });
  }, [effectiveDocuments, effectiveScope]);

  const requiredDocs = useMemo(
    () =>
      resolvedDocs.filter(
        (d) =>
          d.requirement === 'required'
          && d.phase !== 'exit'
          && d.status !== 'not_applicable',
      ),
    [resolvedDocs],
  );
  const requiredUploaded = requiredDocs.filter((d) => d.status === 'uploaded').length;
  const missingRequired = requiredDocs.length - requiredUploaded;

  const filtered = useMemo(() => {
    const base = resolvedDocs;
    if (phaseFilter === 'all') return base;
    return base.filter((d) => d.phase === phaseFilter);
  }, [resolvedDocs, phaseFilter]);

  const grouped = useMemo(() => {
    const order: DocPhase[] = ['hire', 'active', 'exit'];
    return order
      .map((phase) => ({
        phase,
        items: filtered.filter((d) => d.phase === phase),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const setScope = (scope: WorkScope) => {
    if (onWorkScopeChange) onWorkScopeChange(scope);
    else setLocalScope(scope);
  };

  const handleUploadClick = (doc: PersonnelDocItem) => {
    if (doc.status === 'not_applicable') return;
    setSelectedId(doc.id);
    if (preview) {
      setUploadNote(
        `"${doc.title}" için dosya seçimi hazır — canlıda ıslak imzalı PDF/JPG yüklenecek.`,
      );
      return;
    }
    setUploadNote(
      `"${doc.title}" için aşağıdaki yükleme alanını kullanın. Dosya adında evrak türünü belirtin.`,
    );
    onUploadRequest?.(doc);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
              <FolderOpen className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Özlük Evrakları</h3>
              <p className="text-xs text-content-secondary mt-0.5 max-w-xl">
                4857 sayılı İş Kanunu m.75 kapsamında personel özlük dosyası. Islak imzalı
                evrakların taranmış kopyaları burada saklanır.
              </p>
            </div>
          </div>
          {canSelectEmployee && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2">
              <UserRound className="h-4 w-4 text-content-tertiary" />
              <span className="text-xs font-medium text-content-primary">{employeeName}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-content-tertiary">Çalışma Tipi:</span>
          {(['office', 'field', 'hazardous'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setScope(scope)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                effectiveScope === scope
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface border border-border text-content-secondary hover:bg-surface-muted'
              }`}
            >
              {WORK_SCOPE_LABELS[scope]}
            </button>
          ))}
          <span className="text-[11px] text-content-tertiary ml-1">
            (Ofiste İsg / saha sağlık evrakı uygulanmaz)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
            <p className="text-[11px] text-content-tertiary">Zorunlu Evrak</p>
            <p className="text-lg font-semibold text-content-primary mt-0.5">
              {requiredUploaded}/{requiredDocs.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
            <p className="text-[11px] text-content-tertiary">Eksik Zorunlu</p>
            <p className={`text-lg font-semibold mt-0.5 ${missingRequired > 0 ? 'text-status-warning' : 'text-status-success'}`}>
              {missingRequired}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
            <p className="text-[11px] text-content-tertiary">Saklama Notu</p>
            <p className="text-xs font-medium text-content-primary mt-1.5 leading-relaxed">
              En Az 10 Yıl · Kvkk Gizli
            </p>
          </div>
        </div>

        {missingRequired > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
            <p className="text-xs text-content-secondary">
              Eksik zorunlu evraklar denetimde risk oluşturur. Islak imzalı asılların taranmış
              kopyasını yükleyin; dijital onay nitelikli e-imza yerine geçmez.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'all', label: 'Tümü' },
            { key: 'hire', label: 'İşe Giriş' },
            { key: 'active', label: 'Çalışma Süreci' },
            { key: 'exit', label: 'İşten Çıkış' },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPhaseFilter(item.key)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              phaseFilter === item.key
                ? 'bg-brand-600 text-white'
                : 'bg-surface border border-border text-content-secondary hover:bg-surface-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {uploadNote && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-content-secondary">
          {uploadNote}
        </div>
      )}

      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.phase} className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              {PHASE_LABELS[group.phase]}
            </h4>
            <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
              {group.items.map((doc) => {
                const isMissing = doc.status === 'missing';
                const isNa = doc.status === 'not_applicable';
                return (
                  <div
                    key={doc.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                      selectedId === doc.id ? 'bg-brand-50/40' : ''
                    } ${isNa ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isNa
                            ? 'bg-slate-100'
                            : isMissing
                              ? 'bg-status-warning/10'
                              : 'bg-status-success/10'
                        }`}
                      >
                        {isNa ? (
                          <FileText className="h-4 w-4 text-slate-400" />
                        ) : isMissing ? (
                          <FileText className="h-4 w-4 text-status-warning" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-status-success" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-content-primary">{doc.title}</p>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              doc.requirement === 'required'
                                ? 'bg-brand-50 text-brand-700'
                                : doc.requirement === 'conditional'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-slate-50 text-slate-500'
                            }`}
                          >
                            {REQUIREMENT_LABELS[doc.requirement]}
                          </span>
                          <span className="text-[10px] text-content-tertiary">{doc.legalBasis}</span>
                        </div>
                        {doc.note && (
                          <p className="text-[11px] text-content-tertiary mt-0.5">{doc.note}</p>
                        )}
                        {!isMissing && !isNa && (
                          <p className="text-[11px] text-content-secondary mt-1">
                            {doc.fileName} · {formatDateTime(doc.uploadedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          isNa
                            ? 'bg-slate-100 text-slate-500'
                            : isMissing
                              ? 'bg-status-warning/10 text-status-warning'
                              : 'bg-status-success/10 text-status-success'
                        }`}
                      >
                        {isNa ? 'Uygulanmaz' : isMissing ? 'Eksik' : 'Yüklendi'}
                      </span>
                      {canUpload && !isNa && (
                        <button
                          type="button"
                          onClick={() => handleUploadClick(doc)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 text-xs font-semibold"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {isMissing ? 'Yükle' : 'Güncelle'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[11px] text-content-tertiary leading-relaxed">
        Not: Kanunda tek bir evrak listesi yoktur; yukarıdaki çekirdek liste 4857/m.75, 5510, 6331
        ve 6698 uygulamalarına göre hazırlanmıştır. Koşullu evraklar pozisyon/duruma göre
        zorunlu hale gelebilir. Evrak türleri ileride Ayarlar → Personel üzerinden
        genişletilebilir.
      </p>
    </div>
  );
}
