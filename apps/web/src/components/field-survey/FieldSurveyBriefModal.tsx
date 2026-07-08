'use client';

import { API, authHeader } from '@/utils/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { ReceiptCameraModal, prefersNativeCameraCapture } from '@/components/ReceiptCameraModal';
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
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [itemType, setItemType] = useState<FieldSurveyItemType>('diger');
  const [title, setTitle] = useState('Keşif Ölçüsü');
  const [summaryText, setSummaryText] = useState('');
  const [dimensions, setDimensions] = useState<DimensionRow[]>([emptyDimension(1)]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [sharePhone, setSharePhone] = useState(defaultPhone ?? '');

  const resetForm = useCallback(() => {
    setScanning(false);
    setSaving(false);
    setSavedId(null);
    setMessage(null);
    setPhotoUrl(null);
    setItemType('diger');
    setTitle('Keşif Ölçüsü');
    setSummaryText('');
    setDimensions([emptyDimension(1)]);
    setMaterials([]);
    setAiConfidence(null);
    setSharePhone(defaultPhone ?? '');
  }, [defaultPhone]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setShowCamera(false);
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (open && defaultPhone) setSharePhone(defaultPhone);
  }, [open, defaultPhone]);

  const handleScan = async (file: File) => {
    setScanning(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(
        `${API}/claim-files/${claimFileId}/field-survey-briefs/scan`,
        fd,
        { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } },
      );
      const data = res.data?.data ?? {};
      if (data.itemType) setItemType(data.itemType);
      if (data.title) setTitle(data.title);
      if (data.summaryText) setSummaryText(data.summaryText);
      if (Array.isArray(data.dimensions) && data.dimensions.length > 0) {
        setDimensions(
          data.dimensions.map((d: DimensionRow, i: number) => ({
            label: d.label || `Modül ${i + 1}`,
            genislikCm: d.genislikCm ?? null,
            yukseklikCm: d.yukseklikCm ?? null,
            derinlikCm: d.derinlikCm ?? null,
          })),
        );
      }
      if (Array.isArray(data.materials)) {
        setMaterials(
          data.materials.map((m: MaterialRow) => ({
            name: m.name ?? '',
            quantity: m.quantity ?? '',
            note: m.note ?? '',
          })),
        );
      }
      if (data.aiConfidence != null) setAiConfidence(data.aiConfidence);
      if (data.photoUrl) setPhotoUrl(data.photoUrl);
      setMessage(data.message ?? 'Fotoğraf işlendi.');
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Fotoğraf okunamadı. Alanları elle doldurabilirsiniz.';
      setMessage(msg);
    } finally {
      setScanning(false);
    }
  };

  const handlePickFile = () => {
    if (prefersNativeCameraCapture()) {
      fileInputRef.current?.click();
      return;
    }
    setShowCamera(true);
  };

  const buildPayload = (status: 'draft' | 'sent') => ({
    itemType,
    title: title.trim() || 'Keşif Ölçüsü',
    summaryText: summaryText.trim(),
    dimensions: dimensions.map((d) => ({
      label: d.label.trim() || 'Modül',
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
    status,
  });

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
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
    const url = `${API}/claim-files/${claimFileId}/field-survey-briefs/${id}/pdf`;
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
              Lazer metre ile aldığınız ölçüleri buraya girin; fotoğraftan AI tahmini destek olur.
              Kesin ölçü dosya onayı sonrası tedarikçi/usta tarafından sahada alınır.
            </div>

            {message && (
              <p className="text-xs text-slate-600 dark:text-slate-300">{message}</p>
            )}

            <FileDropZone
              accept="image/*"
              capture="environment"
              disabled={scanning}
              clickToOpen={false}
              inputRef={fileInputRef}
              onFiles={(files) => {
                if (files[0]) void handleScan(files[0]);
              }}
              className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-4 transition-colors"
              activeClassName="border-blue-400 bg-blue-50"
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
                  {scanning ? 'Okunuyor…' : 'Fotoğraf Çek / Seç'}
                </button>
                {photoUrl && (
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Fotoğrafı Gör
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Fotoğrafı buraya sürükleyebilirsiniz</p>
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
                <span className="text-xs font-medium text-slate-600">Tahmini Ölçü Alanları</span>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
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
                      placeholder="Genişlik (Tahmini) cm"
                    />
                    <input
                      value={fmtCmInput(row.yukseklikCm)}
                      onChange={(e) => {
                        const v = parseCmInput(e.target.value);
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, yukseklikCm: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Yükseklik (Tahmini) cm"
                    />
                    <input
                      value={fmtCmInput(row.derinlikCm)}
                      onChange={(e) => {
                        const v = parseCmInput(e.target.value);
                        setDimensions((prev) => prev.map((r, i) => (i === idx ? { ...r, derinlikCm: v } : r)));
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                      placeholder="Derinlik (Tahmini) cm"
                    />
                    <button
                      type="button"
                      disabled={dimensions.length <= 1}
                      onClick={() => setDimensions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
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
                  className="text-xs text-blue-600 hover:underline"
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
                        className="text-xs text-red-600 hover:underline"
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

            {aiConfidence != null && (
              <p className="text-[11px] text-slate-400">
                AI Güven Skoru: %{Math.round(aiConfidence * 100)} (tahmini)
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              İptal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('draft')}
              className="btn-secondary text-sm"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handlePdfDownload()}
              className="btn-secondary text-sm"
            >
              PDF İndir
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleWhatsApp()}
              className="btn-primary text-sm"
            >
              Tedarikçiye WhatsApp Gönder
            </button>
          </div>
        </div>
      </div>

      <ReceiptCameraModal
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(file) => void handleScan(file)}
      />
    </>
  );
}
