'use client';

import { API, authHeader } from '@/utils/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import {
  FieldSurveyCameraModal,
  type FieldSurveyCameraDimension,
} from '@/components/field-survey/FieldSurveyCameraModal';
import { FieldSurveyCropModal } from '@/components/field-survey/FieldSurveyCropModal';
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
  }, [defaultPhone]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setShowCamera(false);
      setCropFile(null);
      setPendingScanOptions(null);
    }
  }, [open, resetForm]);

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

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (aiSuggestion) {
      setMessage('Kayıt için önce destek önerisini onaylayın, düzenleyin veya atlayın.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await axios.post(
        `${API}/claim-files/${claimFileId}/field-survey-briefs`,
        buildPayload(status),
        { headers: authHeader() },
      );
      const id = res.data?.data?.id as string | undefined;
      if (id) setSavedId(id);
      setMessage(status === 'sent' ? 'Keşif ölçüsü kaydedildi ve gönderildi olarak işaretlendi.' : 'Keşif ölçüsü kaydedildi.');
      onSaved?.();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Kayıt başarısız.';
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const ensureSaved = async (status: 'draft' | 'sent' = 'draft'): Promise<string | null> => {
    if (savedId) return savedId;
    if (aiSuggestion) {
      setMessage('Kayıt için önce destek önerisini onaylayın, düzenleyin veya atlayın.');
      return null;
    }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/claim-files/${claimFileId}/field-survey-briefs`,
        buildPayload(status),
        { headers: authHeader() },
      );
      const id = res.data?.data?.id as string | undefined;
      if (id) {
        setSavedId(id);
        onSaved?.();
        return id;
      }
      return null;
    } catch {
      setMessage('Önce kayıt yapılamadı.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePdfDownload = async () => {
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
        <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
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
              onClick={onClose}
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

            <label className="block text-xs font-medium text-slate-600">
              Keşif Özeti (Tedarikçi / Usta)
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setSummaryText(v);
                }}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Kısa keşif notu…"
              />
            </label>

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
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              İptal
            </button>
            <button
              type="button"
              disabled={saving || Boolean(aiSuggestion)}
              onClick={() => void handleSave('draft')}
              className="btn-secondary text-sm"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              disabled={saving || Boolean(aiSuggestion)}
              onClick={() => void handlePdfDownload()}
              className="btn-secondary text-sm"
              title="İç operasyon PDF"
            >
              PDF İndir
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
