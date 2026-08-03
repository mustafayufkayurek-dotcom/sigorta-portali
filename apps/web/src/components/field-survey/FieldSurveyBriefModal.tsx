'use client';

import { API, authHeader } from '@/utils/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import {
  FieldSurveyCameraModal,
  type FieldSurveyCameraDimension,
} from '@/components/field-survey/FieldSurveyCameraModal';
import { FieldSurveyCropModal } from '@/components/field-survey/FieldSurveyCropModal';
import { FieldSurveySpeechButton } from '@/components/field-survey/FieldSurveySpeechButton';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  FIELD_SURVEY_ITEM_TYPE_OPTIONS,
  type FieldSurveyItemType,
} from '@/components/field-survey/field-survey.constants';

export type { FieldSurveyItemType } from '@/components/field-survey/field-survey.constants';

interface DimensionRow {
  label: string;
  genislikCm: number | null;
  yukseklikCm: number | null;
  derinlikCm: number | null;
}

interface MaterialRow {
  name: string;
  quantity: string;
  note: string;
}

type DraftSnapshot = {
  savedId: string | null;
  itemType: FieldSurveyItemType;
  title: string;
  summaryText: string;
  dimensions: DimensionRow[];
  materials: MaterialRow[];
  photoUrl: string | null;
  annotatedPhotoUrl: string | null;
  aiConfidence: number | null;
  sharePhone: string;
};

function draftStorageKey(claimFileId: string): string {
  return `fsb-draft:${claimFileId}`;
}

function readDraft(claimFileId: string): DraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(claimFileId));
    if (!raw) return null;
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

function writeDraft(claimFileId: string, draft: DraftSnapshot): void {
  try {
    localStorage.setItem(draftStorageKey(claimFileId), JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

function clearDraft(claimFileId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(claimFileId));
  } catch {
    /* ignore */
  }
}

function snapshotKey(s: Omit<DraftSnapshot, 'savedId'> & { savedId?: string | null }): string {
  return JSON.stringify({
    itemType: s.itemType,
    title: s.title,
    summaryText: s.summaryText,
    dimensions: s.dimensions,
    materials: s.materials,
    photoUrl: s.photoUrl,
    annotatedPhotoUrl: s.annotatedPhotoUrl,
    aiConfidence: s.aiConfidence,
    sharePhone: s.sharePhone,
  });
}

/** Scan sonrası AI önerisi — kullanıcı Onayla/Düzenle demeden forma yazılmaz. */
interface AiSuggestion {
  itemType: FieldSurveyItemType | null;
  title: string | null;
  summaryText: string | null;
  dimensions: DimensionRow[] | null;
  materials: MaterialRow[] | null;
  aiConfidence: number | null;
  message: string | null;
}

const ITEM_TYPE_OPTIONS = FIELD_SURVEY_ITEM_TYPE_OPTIONS;

function emptyDimension(index: number): DimensionRow {
  return {
    label: `Alan ${index}`,
    genislikCm: null,
    yukseklikCm: null,
    derinlikCm: null,
  };
}

function parseCmInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtCmInput(n: number | null): string {
  if (n == null) return '';
  return String(n);
}

function hasFilledDimension(rows: DimensionRow[]): boolean {
  return rows.some(
    (d) => d.genislikCm != null || d.yukseklikCm != null || d.derinlikCm != null,
  );
}

interface FieldSurveyBriefModalProps {
  open: boolean;
  onClose: () => void;
  claimFileId: string;
  claimFileNo: string;
  defaultPhone?: string | null;
  onSaved?: () => void;
}

export function FieldSurveyBriefModal({
  open,
  onClose,
  claimFileId,
  claimFileNo,
  defaultPhone,
  onSaved,
}: FieldSurveyBriefModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pendingScanOptions, setPendingScanOptions] = useState<{
    preserveDimensions?: boolean;
    cameraDimensions?: FieldSurveyCameraDimension[];
    annotatedFile?: File | null;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [annotatedPhotoUrl, setAnnotatedPhotoUrl] = useState<string | null>(null);
  const [itemType, setItemType] = useState<FieldSurveyItemType>('diger');
  const [title, setTitle] = useState('Keşif Ölçüsü');
  const [summaryText, setSummaryText] = useState('');
  const [dimensions, setDimensions] = useState<DimensionRow[]>([emptyDimension(1)]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [sharePhone, setSharePhone] = useState(defaultPhone ?? '');
  const [baselineKey, setBaselineKey] = useState('');
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const hydratedRef = useRef(false);

  const currentSnapshot = useMemo(
    (): DraftSnapshot => ({
      savedId,
      itemType,
      title,
      summaryText,
      dimensions,
      materials,
      photoUrl,
      annotatedPhotoUrl,
      aiConfidence,
      sharePhone,
    }),
    [
      savedId,
      itemType,
      title,
      summaryText,
      dimensions,
      materials,
      photoUrl,
      annotatedPhotoUrl,
      aiConfidence,
      sharePhone,
    ],
  );

  const isDirty = Boolean(baselineKey) && snapshotKey(currentSnapshot) !== baselineKey;

  // Kaydet butonu disabled iken tıklama olayı hiç tetiklenmez (persistBrief içindeki
  // uyarı mesajı bu yüzden hiç görünmez) — kullanıcı nedeni buradan görsün.
  const saveDisabledReason: string | null = saving
    ? null
    : aiSuggestion
      ? 'Kaydetmeden önce yukarıdaki destek önerisini onaylayın, düzenleyin veya "Öneriyi Atla" seçin.'
      : !isDirty
        ? 'Kaydedilecek yeni bir değişiklik yok.'
        : null;

  const resetForm = useCallback(() => {
    setScanning(false);
    setSaving(false);
    setSavedId(null);
    setMessage(null);
    setPhotoUrl(null);
    setAnnotatedPhotoUrl(null);
    setItemType('diger');
    setTitle('Keşif Ölçüsü');
    setSummaryText('');
    setDimensions([emptyDimension(1)]);
    setMaterials([]);
    setAiConfidence(null);
    setAiSuggestion(null);
    setSharePhone(defaultPhone ?? '');
    setBaselineKey('');
    setExitConfirmOpen(false);
    hydratedRef.current = false;
  }, [defaultPhone]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setShowCamera(false);
      setCropFile(null);
      setPendingScanOptions(null);
      return;
    }

    const draft = readDraft(claimFileId);
    if (draft) {
      setSavedId(draft.savedId);
      setItemType(draft.itemType || 'diger');
      setTitle(draft.title || 'Keşif Ölçüsü');
      setSummaryText(draft.summaryText || '');
      setDimensions(draft.dimensions?.length ? draft.dimensions : [emptyDimension(1)]);
      setMaterials(draft.materials ?? []);
      setPhotoUrl(draft.photoUrl);
      setAnnotatedPhotoUrl(draft.annotatedPhotoUrl);
      setAiConfidence(draft.aiConfidence);
      setSharePhone(draft.sharePhone || defaultPhone || '');
      setBaselineKey(snapshotKey(draft));
      setMessage('Kaydedilmemiş taslak geri yüklendi.');
    } else {
      const empty: DraftSnapshot = {
        savedId: null,
        itemType: 'diger',
        title: 'Keşif Ölçüsü',
        summaryText: '',
        dimensions: [emptyDimension(1)],
        materials: [],
        photoUrl: null,
        annotatedPhotoUrl: null,
        aiConfidence: null,
        sharePhone: defaultPhone ?? '',
      };
      setBaselineKey(snapshotKey(empty));
    }
    // Taslak yazmayı bir tick ertele — açılış state güncellemesi tamamlanmadan boş draft yazılmasın
    hydratedRef.current = false;
    const readyTimer = window.setTimeout(() => {
      hydratedRef.current = true;
    }, 0);
    return () => window.clearTimeout(readyTimer);
  }, [open, claimFileId, defaultPhone, resetForm]);

  useEffect(() => {
    if (!open || !hydratedRef.current || !isDirty) return;
    const t = window.setTimeout(() => {
      writeDraft(claimFileId, currentSnapshot);
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, claimFileId, currentSnapshot, isDirty]);

  const requestClose = () => {
    if (saving) return;
    if (isDirty) {
      setExitConfirmOpen(true);
      return;
    }
    clearDraft(claimFileId);
    onClose();
  };

  const discardAndClose = () => {
    clearDraft(claimFileId);
    setExitConfirmOpen(false);
    onClose();
  };

  const openCropThenScan = (
    file: File,
    options?: {
      preserveDimensions?: boolean;
      cameraDimensions?: FieldSurveyCameraDimension[];
      annotatedFile?: File | null;
    },
  ) => {
    setPendingScanOptions(options ?? null);
    setCropFile(file);
  };

  useEffect(() => {
    if (open && defaultPhone) setSharePhone(defaultPhone);
  }, [open, defaultPhone]);

  const handleScan = async (
    file: File,
    options?: {
      preserveDimensions?: boolean;
      cameraDimensions?: FieldSurveyCameraDimension[];
      annotatedFile?: File | null;
    },
  ) => {
    setScanning(true);
    setMessage(null);

    const cameraDims = options?.cameraDimensions;
    const preserveFromCamera =
      Boolean(options?.preserveDimensions) &&
      Array.isArray(cameraDims) &&
      cameraDims.some((d) => d.genislikCm != null || d.yukseklikCm != null || d.derinlikCm != null);

    if (preserveFromCamera && cameraDims) {
      setDimensions(
        cameraDims.map((d, i) => ({
          label: d.label?.trim() || `Alan ${i + 1}`,
          genislikCm: d.genislikCm,
          yukseklikCm: d.yukseklikCm,
          derinlikCm: d.derinlikCm,
        })),
      );
    }

    // İşaretli foto varsa onu kanıt olarak yükle (ölçü özeti basılı)
    const uploadFile = options?.annotatedFile ?? file;

    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await axios.post(
        `${API}/claim-files/${claimFileId}/field-survey-briefs/scan`,
        fd,
        { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } },
      );
      const data = res.data?.data ?? {};

      // Fotoğraf kanıtı — AI yorumu değil; doğrudan saklanır
      if (data.photoUrl) {
        setPhotoUrl(data.photoUrl);
        if (options?.annotatedFile) setAnnotatedPhotoUrl(data.photoUrl);
      }

      const aiDims: DimensionRow[] | null =
        Array.isArray(data.dimensions) && data.dimensions.length > 0
          ? data.dimensions.map((d: DimensionRow, i: number) => ({
              label: d.label || `Alan ${i + 1}`,
              genislikCm: d.genislikCm ?? null,
              yukseklikCm: d.yukseklikCm ?? null,
              derinlikCm: d.derinlikCm ?? null,
            }))
          : null;

      const aiMats: MaterialRow[] | null =
        Array.isArray(data.materials) && data.materials.length > 0
          ? data.materials.map((m: MaterialRow) => ({
              name: m.name ?? '',
              quantity: m.quantity ?? '',
              note: m.note ?? '',
            }))
          : null;

      const hasAiContent = Boolean(
        data.itemType || data.title || data.summaryText || aiDims || aiMats,
      );

      if (hasAiContent) {
        // AI sonucu öneri — Onayla/Düzenle olmadan forma yazılmaz
        setAiSuggestion({
          itemType: (data.itemType as FieldSurveyItemType) || null,
          title: data.title ? String(data.title) : null,
          summaryText: data.summaryText ? String(data.summaryText) : null,
          dimensions: preserveFromCamera ? null : aiDims,
          materials: aiMats,
          aiConfidence: data.aiConfidence ?? null,
          message: data.message ? String(data.message) : null,
        });
        setMessage(
          preserveFromCamera
            ? 'Fotoğraf ve ölçü özeti kaydedildi. Destek önerisini onaylayın veya düzenleyin.'
            : 'Fotoğraf kaydedildi. Destek önerisini onaylamadan kayıt kesinleşmez.',
        );
      } else {
        setAiSuggestion(null);
        setMessage(
          preserveFromCamera
            ? 'Fotoğraf kaydedildi — ölçü özeti forma aktarıldı. Kontrol edip kaydedin.'
            : data.message ?? 'Fotoğraf kaydedildi — ölçüleri elle girebilirsiniz.',
        );
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Fotoğraf kaydedilemedi. Ölçüleri elle girebilirsiniz.';
      setMessage(msg);
    } finally {
      setScanning(false);
    }
  };

  const handlePickFile = () => {
    setShowCamera(true);
  };

  const applyAiSuggestion = (suggestion: AiSuggestion) => {
    if (suggestion.itemType) setItemType(suggestion.itemType);
    if (suggestion.title) setTitle(suggestion.title);
    if (suggestion.summaryText) setSummaryText(suggestion.summaryText);
    if (suggestion.dimensions?.length) {
      setDimensions((prev) => (hasFilledDimension(prev) ? prev : suggestion.dimensions!));
    }
    if (suggestion.materials?.length) {
      setMaterials(suggestion.materials);
    }
    if (suggestion.aiConfidence != null) setAiConfidence(suggestion.aiConfidence);
    setAiSuggestion(null);
  };

  const handleApproveAi = () => {
    if (!aiSuggestion) return;
    applyAiSuggestion(aiSuggestion);
    setMessage('Destek önerisi onaylandı. Kontrol edip kaydedebilirsiniz.');
  };

  const handleEditAi = () => {
    if (!aiSuggestion) return;
    applyAiSuggestion(aiSuggestion);
    setMessage('Destek önerisi forma aktarıldı — dilediğiniz alanları düzenleyin.');
  };

  const handleDismissAi = () => {
    setAiSuggestion(null);
    setMessage('Destek önerisi atlandı. Ölçüleri elle girerek kaydedebilirsiniz.');
  };

  const buildPayload = (status: 'draft' | 'sent') => ({
    itemType,
    title: title.trim() || 'Keşif Ölçüsü',
    summaryText: summaryText.trim(),
    dimensions: dimensions.map((d) => ({
      label: d.label.trim() || 'Alan',
      genislikCm: d.genislikCm,
      yukseklikCm: d.yukseklikCm,
      derinlikCm: d.derinlikCm,
    })),
    materials: materials
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        quantity: m.quantity.trim() || null,
        note: m.note.trim() || null,
      })),
    aiConfidence,
    isEstimated: true,
    photoUrl,
    annotatedPhotoUrl,
    status,
  });

  const persistBrief = async (
    status: 'draft' | 'sent' = 'draft',
  ): Promise<string | null> => {
    if (aiSuggestion) {
      setMessage('Kayıt için önce destek önerisini onaylayın, düzenleyin veya atlayın.');
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = buildPayload(status);
      const res = savedId
        ? await axios.patch(
            `${API}/claim-files/${claimFileId}/field-survey-briefs/${savedId}`,
            payload,
            { headers: authHeader() },
          )
        : await axios.post(
            `${API}/claim-files/${claimFileId}/field-survey-briefs`,
            payload,
            { headers: authHeader() },
          );
      const id = (res.data?.data?.id as string | undefined) ?? savedId;
      if (!id) {
        setMessage('Kayıt başarısız.');
        return null;
      }
      setSavedId(id);
      const next: DraftSnapshot = { ...currentSnapshot, savedId: id };
      setBaselineKey(snapshotKey(next));
      clearDraft(claimFileId);
      onSaved?.();
      return id;
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Kayıt başarısız.';
      setMessage(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    const id = await persistBrief(status);
    if (!id) return;
    setMessage(
      status === 'sent'
        ? 'Keşif ölçüsü kaydedildi ve gönderildi olarak işaretlendi.'
        : 'Keşif ölçüsü kaydedildi.',
    );
  };

  const saveAndClose = async () => {
    const id = await persistBrief('draft');
    if (!id) return;
    setExitConfirmOpen(false);
    onClose();
  };

  const ensureSaved = async (status: 'draft' | 'sent' = 'draft'): Promise<string | null> => {
    if (savedId && !isDirty) return savedId;
    return persistBrief(status);
  };

  const handlePdfDownload = async () => {
    if (downloadingPdf) return; // ikinci tıklama → yeni request engellenir
    setDownloadingPdf(true);
    setMessage(null);
    try {
      const id = await ensureSaved('draft');
      if (!id) return;
      // İç operasyon PDF
      const url = `${API}/claim-files/${claimFileId}/field-survey-briefs/${id}/pdf?variant=internal`;
      const res = await axios.get(url, { headers: authHeader(), responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `tahmini-kesif-olcusu-${claimFileNo}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'PDF oluşturulamadı. Lütfen tekrar deneyin.';
      setMessage(msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    const id = await ensureSaved('sent');
    if (!id) return;
    const params = sharePhone.trim() ? `?phone=${encodeURIComponent(sharePhone.trim())}` : '';
    try {
      const res = await axios.get(
        `${API}/claim-files/${claimFileId}/field-survey-briefs/${id}/share${params}`,
        { headers: authHeader() },
      );
      const whatsappUrl = res.data?.data?.whatsappUrl as string | undefined;
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setMessage('WhatsApp paylaşım penceresi açıldı.');
      }
    } catch {
      setMessage('Paylaşım bağlantısı oluşturulamadı.');
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={requestClose} aria-hidden />
        <div
          className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-survey-title"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
            <div>
              <h3 id="field-survey-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Saha Keşif Ölçüsü
              </h3>
              <p className="text-xs text-slate-500">
                Dosya {claimFileNo} — marangoz, boya, seramik, parke ve diğer işler
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Tahmini Keşif Ölçüsü</span>
              {' — '}
              Lazer metre ile aldığınız ölçüleri kamerada veya aşağıya girin; fotoğraf kanıt ve özet içindir.
              Kesin ölçü dosya onayı sonrası tedarikçi/usta tarafından sahada alınır.
            </div>

            {message && (
              <p className="text-xs text-slate-600 dark:text-slate-300">{message}</p>
            )}

            {aiSuggestion && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-3 space-y-2">
                <p className="text-xs font-semibold text-slate-800">Destek Önerisi</p>
                <p className="text-[11px] text-slate-600">
                  Bu değerler öneridir. Onaylamadan kayda yazılmaz.
                  {aiSuggestion.aiConfidence != null && (
                    <> Güven: %{Math.round(aiSuggestion.aiConfidence * 100)}</>
                  )}
                </p>
                <dl className="grid gap-1 text-xs text-slate-700">
                  {aiSuggestion.itemType && (
                    <div>
                      <dt className="inline font-medium">Parça Tipi: </dt>
                      <dd className="inline">
                        {ITEM_TYPE_OPTIONS.find((o) => o.value === aiSuggestion.itemType)?.label ??
                          aiSuggestion.itemType}
                      </dd>
                    </div>
                  )}
                  {aiSuggestion.title && (
                    <div>
                      <dt className="inline font-medium">Başlık: </dt>
                      <dd className="inline">{aiSuggestion.title}</dd>
                    </div>
                  )}
                  {aiSuggestion.summaryText && (
                    <div>
                      <dt className="font-medium">Özet</dt>
                      <dd className="text-slate-600">{aiSuggestion.summaryText}</dd>
                    </div>
                  )}
                  {aiSuggestion.materials && aiSuggestion.materials.length > 0 && (
                    <div>
                      <dt className="font-medium">Malzeme</dt>
                      <dd>
                        {aiSuggestion.materials
                          .map((m) => `${m.name}${m.quantity ? ` × ${m.quantity}` : ''}`)
                          .join(', ')}
                      </dd>
                    </div>
                  )}
                  {aiSuggestion.dimensions && aiSuggestion.dimensions.length > 0 && (
                    <div>
                      <dt className="font-medium">Ölçü Önerisi</dt>
                      <dd>
                        {aiSuggestion.dimensions
                          .map((d) => {
                            const parts = [
                              d.genislikCm != null ? `G:${d.genislikCm}` : null,
                              d.yukseklikCm != null ? `Y:${d.yukseklikCm}` : null,
                              d.derinlikCm != null ? `D:${d.derinlikCm}` : null,
                            ].filter(Boolean);
                            return `${d.label}${parts.length ? ` (${parts.join(' ')})` : ''}`;
                          })
                          .join('; ')}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApproveAi}
                    className="rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    onClick={handleEditAi}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissAi}
                    className="rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:underline"
                  >
                    Öneriyi Atla
                  </button>
                </div>
              </div>
            )}

            <FileDropZone
              accept="image/*"
              capture="environment"
              disabled={scanning}
              clickToOpen={false}
              inputRef={fileInputRef}
              onFiles={(files) => {
                if (files[0]) openCropThenScan(files[0]);
              }}
              className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-4 transition-colors"
              activeClassName="border-brand-400 bg-brand-50"
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickFile();
                  }}
                  disabled={scanning}
                  className="btn-secondary text-sm"
                >
                  {scanning ? 'Kaydediliyor…' : 'Fotoğraf Çek / Ölçü Gir'}
                </button>
                {(annotatedPhotoUrl || photoUrl) && (
                  <a
                    href={annotatedPhotoUrl || photoUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Fotoğrafı Gör
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Kamera ölçü emareleri ve ölçü özeti ile açılır. Fotoğrafı buraya da sürükleyebilirsiniz.
              </p>
            </FileDropZone>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                İş / Parça Tipi
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as FieldSurveyItemType)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {ITEM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Başlık
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setTitle(v);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">
                  Saha Tespit
                </span>
                <FieldSurveySpeechButton
                  disabled={Boolean(aiSuggestion) || saving}
                  onError={(msg) => setMessage(msg)}
                  onTranscript={(text) => {
                    setSummaryText((prev) => {
                      const base = prev.trim();
                      return base ? `${base} ${text}` : text;
                    });
                  }}
                />
              </div>
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setSummaryText(v);
                }}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Kısa keşif notu…"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Ölçü Özeti</span>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => setDimensions((d) => [...d, emptyDimension(d.length + 1)])}
                >
                  Alan Ekle
                </button>
              </div>
              <div className="space-y-2">
                {dimensions.map((row, idx) => (
                  <div key={idx} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-5">
                    <input
                      value={row.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, label: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs sm:col-span-1"
                      placeholder="Alan adı"
                    />
                    <input
                      value={fmtCmInput(row.genislikCm)}
                      onChange={(e) => {
                        const v = parseCmInput(e.target.value);
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, genislikCm: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Genişlik (Cm)"
                    />
                    <input
                      value={fmtCmInput(row.yukseklikCm)}
                      onChange={(e) => {
                        const v = parseCmInput(e.target.value);
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, yukseklikCm: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Yükseklik (Cm)"
                    />
                    <input
                      value={fmtCmInput(row.derinlikCm)}
                      onChange={(e) => {
                        const v = parseCmInput(e.target.value);
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, derinlikCm: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Derinlik (Cm)"
                    />
                    <button
                      type="button"
                      disabled={dimensions.length <= 1}
                      onClick={() => setDimensions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-status-danger hover:underline disabled:opacity-40"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Malzeme Listesi</span>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => setMaterials((m) => [...m, { name: '', quantity: '', note: '' }])}
                >
                  Malzeme Ekle
                </button>
              </div>
              {materials.length === 0 ? (
                <p className="text-xs text-slate-400">Henüz malzeme eklenmedi.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((row, idx) => (
                    <div key={idx} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-4">
                      <input
                        value={row.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMaterials((prev) => prev.map((r, i) => (i === idx ? { ...r, name: v } : r)));
                        }}
                        onBlur={(e) => {
                          const v = toTitleCaseTR(e.target.value.trim());
                          setMaterials((prev) => prev.map((r, i) => (i === idx ? { ...r, name: v } : r)));
                        }}
                        className="rounded border border-slate-200 px-2 py-1.5 text-xs sm:col-span-1"
                        placeholder="Malzeme"
                      />
                      <input
                        value={row.quantity}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMaterials((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: v } : r)));
                        }}
                        className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                        placeholder="Miktar"
                      />
                      <input
                        value={row.note}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMaterials((prev) => prev.map((r, i) => (i === idx ? { ...r, note: v } : r)));
                        }}
                        className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                        placeholder="Not"
                      />
                      <button
                        type="button"
                        onClick={() => setMaterials((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-status-danger hover:underline"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-xs font-medium text-slate-600">
              Tedarikçi WhatsApp (Opsiyonel)
              <input
                value={sharePhone}
                onChange={(e) => setSharePhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="5xx xxx xx xx"
              />
            </label>

            {aiConfidence != null && !aiSuggestion && (
              <p className="text-[11px] text-slate-400">
                Destek Skoru: %{Math.round(aiConfidence * 100)} (tahmini)
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
            {saveDisabledReason && (
              <p className="w-full text-left text-[11px] text-slate-400">{saveDisabledReason}</p>
            )}
            <button type="button" onClick={requestClose} className="btn-secondary text-sm">
              İptal
            </button>
            <button
              type="button"
              disabled={saving || Boolean(aiSuggestion) || !isDirty}
              onClick={() => void handleSave('draft')}
              className="btn-secondary text-sm"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              disabled={saving || downloadingPdf || Boolean(aiSuggestion)}
              onClick={() => void handlePdfDownload()}
              className="btn-secondary text-sm"
              title="İç operasyon PDF"
            >
              {downloadingPdf ? 'PDF Hazırlanıyor…' : 'PDF İndir'}
            </button>
            <button
              type="button"
              disabled={saving || Boolean(aiSuggestion)}
              onClick={() => void handleWhatsApp()}
              className="btn-primary text-sm"
              title="Tedarikçi PDF (kişisel veri yok)"
            >
              Tedarikçiye WhatsApp Gönder
            </button>
          </div>
        </div>
      </div>

      {exitConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => !saving && setExitConfirmOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-slate-800">Kaydedilmemiş Değişiklikler</p>
            <p className="mt-2 text-xs text-slate-600">
              Çıkmadan önce değişiklikleri kaydetmek ister misiniz?
            </p>
            {aiSuggestion && (
              <p className="mt-2 text-[11px] text-status-danger">
                Kaydetmeden çıkmak için önce ana ekrandaki destek önerisini onaylayın, düzenleyin
                veya &quot;Öneriyi Atla&quot; seçin.
              </p>
            )}
            {!aiSuggestion && message && (
              <p className="mt-2 text-[11px] text-slate-600">{message}</p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={saving || Boolean(aiSuggestion)}
                onClick={() => void saveAndClose()}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet ve Çık'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={discardAndClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-status-danger hover:bg-red-50 disabled:opacity-50"
              >
                Değişiklikleri Sil
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setExitConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      <FieldSurveyCameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        initialDimensions={dimensions}
        onCapture={({ file, annotatedFile, dimensions: cameraDims }) => {
          openCropThenScan(file, {
            preserveDimensions: true,
            cameraDimensions: cameraDims,
            annotatedFile,
          });
        }}
      />

      <FieldSurveyCropModal
        open={Boolean(cropFile)}
        file={cropFile}
        onClose={() => {
          setCropFile(null);
          setPendingScanOptions(null);
        }}
        onSave={(cropped) => {
          const opts = pendingScanOptions;
          setCropFile(null);
          setPendingScanOptions(null);
          // Kırpılmış görsel kanıt + AI girdisi olur; işaretli ham kare yerine kırpılmış dosya
          void handleScan(cropped, {
            preserveDimensions: opts?.preserveDimensions,
            cameraDimensions: opts?.cameraDimensions,
            annotatedFile: cropped,
          });
        }}
      />
    </>
  );
}
