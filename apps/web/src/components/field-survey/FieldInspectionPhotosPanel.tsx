'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { notifyToast, reportCaughtError } from '@/utils/report-caught-error';
import { AuthBlobImg } from '@/components/ui/AuthBlobImg';
import { entityDocumentFileUrl } from '@/utils/protected-image';
import { PhotoLightbox } from '@/components/ui/PhotoLightbox';
import { isAcilInspectionPhotoNotes } from '@sigorta/shared';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  INSPECTION_PHOTO_UPLOAD_CONCURRENCY,
  runWithConcurrency,
  shrinkInspectionPhoto,
} from '@/utils/shrink-inspection-photo';

type PhotoDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  notes?: string | null;
};

function isImageMime(mime: string) {
  return (mime || '').startsWith('image/');
}

function isInspectionPhoto(doc: PhotoDoc) {
  if (!isImageMime(doc.mimeType)) return false;
  return isAcilInspectionPhotoNotes(doc.notes);
}

/** Saha — ortak tespit fotoğrafları (ofis evrak yaşam döngüsü yok) */
export function FieldInspectionPhotosPanel({
  claimId,
  entityType = 'claim_file',
  entityId,
  readOnly = false,
  onCountChange,
}: {
  claimId?: string;
  entityType?: string;
  entityId?: string;
  readOnly?: boolean;
  onCountChange?: (count: number) => void;
}) {
  const resolvedId = entityId || claimId || '';
  const { confirm, dialog } = usePanelConfirm();
  const [docs, setDocs] = useState<PhotoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadQueueRef = useRef<File[]>([]);
  const uploadRunningRef = useRef(false);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/entity-documents`, {
        headers: authHeader(),
        params: { entityType, entityId: resolvedId },
      });
      const rows = ((r.data?.data ?? []) as PhotoDoc[]).filter(isInspectionPhoto);
      setDocs(rows);
      onCountChange?.(rows.length);
    } catch (err) {
      reportCaughtError(err, 'Tespit fotoğrafları yüklenemedi.', { toast: false });
      setDocs([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [entityType, resolvedId, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(docs.length);
  }, [docs.length, onCountChange]);

  const drainUploadQueue = async () => {
    if (uploadRunningRef.current || !resolvedId) return;
    uploadRunningRef.current = true;
    setUploading(true);
    try {
      while (uploadQueueRef.current.length > 0) {
        const batch = uploadQueueRef.current.splice(0, uploadQueueRef.current.length);
        let done = 0;
        let failed = 0;
        setUploadProgress({ done: 0, total: batch.length });
        await runWithConcurrency(batch, INSPECTION_PHOTO_UPLOAD_CONCURRENCY, async (file) => {
          try {
            const shrunk = await shrinkInspectionPhoto(file);
            const fd = new FormData();
            fd.append('file', shrunk);
            fd.append('entityType', entityType);
            fd.append('entityId', resolvedId);
            fd.append('notes', 'Tespit Fotoğrafı');
            const r = await axios.post(`${API}/entity-documents`, fd, {
              headers: authHeader(),
            });
            const created = r.data?.data as PhotoDoc | undefined;
            if (created?.id) {
              setDocs((prev) => {
                if (prev.some((row) => row.id === created.id)) return prev;
                return [created, ...prev];
              });
            }
          } catch {
            failed += 1;
          } finally {
            done += 1;
            setUploadProgress({ done, total: batch.length });
          }
        });
        if (failed > 0) {
          notifyToast('error', failed === 1 ? 'Bir fotoğraf yüklenemedi.' : `${failed} fotoğraf yüklenemedi.`);
        }
      }
    } finally {
      uploadRunningRef.current = false;
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadFiles = (files: File[]) => {
    if (!resolvedId || files.length === 0) return;
    const images = files.filter(
      (file) =>
        isImageMime(file.type) ||
        !file.type ||
        /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name),
    );
    const skipped = files.length - images.length;
    if (images.length === 0) {
      notifyToast('error', 'Yalnız fotoğraf seçin.');
      return;
    }
    if (skipped > 0) notifyToast('warning', 'Fotoğraf olmayan dosyalar alınmadı.');
    uploadQueueRef.current.push(...images);
    void drainUploadQueue();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await uploadFiles(files);
  };

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (readOnly) return;
    uploadFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!(await confirm(`"${fileName}" silinsin mi?`))) return;
    try {
      await axios.delete(`${API}/entity-documents/${docId}`, { headers: authHeader() });
      setSelectedIds((prev) => prev.filter((id) => id !== docId));
      await load();
    } catch (err) {
      reportCaughtError(err, 'Fotoğraf silinemedi.');
    }
  };

  const toggleSelected = (docId: string) => {
    setSelectedIds((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  };

  const exitSelect = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    const ids = selectedIds.filter((id) => docs.some((doc) => doc.id === id));
    if (ids.length === 0) return;
    const ok = await confirm({
      title: 'Seçilenleri Sil',
      message: ids.length === 1 ? 'Seçilen fotoğraf silinsin mi?' : `Seçilen ${ids.length} fotoğraf silinsin mi?`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    setDeletingBulk(true);
    try {
      for (const id of ids) {
        await axios.delete(`${API}/entity-documents/${id}`, { headers: authHeader() });
      }
      exitSelect();
      await load();
    } catch (err) {
      reportCaughtError(err, 'Fotoğraflar silinemedi.');
      await load();
    } finally {
      setDeletingBulk(false);
    }
  };

  const openPreview = (docId: string) => {
    const idx = docs.findIndex((d) => d.id === docId);
    if (idx >= 0) setPreviewIndex(idx);
  };

  const onPhotoClick = (docId: string) => {
    if (selecting) {
      toggleSelected(docId);
      return;
    }
    openPreview(docId);
  };

  return (
    <div
      data-testid="saha-tespit-fotograflari"
      onDragEnter={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploading) setDragOver(true);
            }
      }
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploading) setDragOver(true);
            }
      }
      onDragLeave={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOver(false);
            }
      }
      onDrop={readOnly ? undefined : onDropFiles}
      className={dragOver ? 'rounded-xl ring-2 ring-brand-400 ring-offset-2' : undefined}
    >
      {readOnly ? null : (
        <OpsFirstRunNotice
          noticeId={OPS_NOTICE.sahaTespitTopluSil.id}
          title={OPS_NOTICE.sahaTespitTopluSil.title}
          body={OPS_NOTICE.sahaTespitTopluSil.body}
          testId="saha-tespit-toplu-sil-seridi"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {loading
            ? 'Yükleniyor…'
            : uploadProgress
              ? `${uploadProgress.done} / ${uploadProgress.total} yüklendi`
              : docs.length === 0
                ? 'Henüz tespit fotoğrafı yok.'
                : selecting && selectedIds.length > 0
                  ? `${selectedIds.length} / ${docs.length} seçildi`
                  : `${docs.length} fotoğraf`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {readOnly || docs.length === 0 ? null : selecting ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedIds(docs.map((doc) => doc.id))}
                disabled={deletingBulk}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                data-testid="saha-tespit-foto-tumunu-sec"
              >
                Tümünü Seç
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={deletingBulk || selectedIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-status-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                data-testid="saha-tespit-foto-secilenleri-sil"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {deletingBulk ? 'Siliniyor…' : 'Seçilenleri Sil'}
              </button>
              <button
                type="button"
                onClick={exitSelect}
                disabled={deletingBulk}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                data-testid="saha-tespit-foto-sec-vazgec"
              >
                Vazgeç
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelecting(true);
                setSelectedIds([]);
              }}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              data-testid="saha-tespit-foto-sec"
            >
              Seç
            </button>
          )}
          {readOnly ? null : (
            <>
          {/* accept yok: Mac seçici tür süzünce çerçeve ve yön tuşuyla çoklu seçim kapanır */}
          <input
            ref={galleryInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            data-testid="saha-tespit-foto-input"
          />
          {/* capture: telefonda doğrudan kamera; galeri ayrı */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            data-testid="saha-tespit-foto-kamera"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            data-testid="saha-tespit-foto-kamera-btn"
          >
            Kameradan
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            data-testid="saha-tespit-foto-yukle"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Galeriden
          </button>
            </>
          )}
        </div>
      </div>

      {!loading && docs.length === 0 ? (
        readOnly ? (
          <p className="mt-2 text-xs text-slate-400">Tespit resmi yok.</p>
        ) : (
        <div
          className={`mt-3 rounded-xl border border-dashed px-4 py-8 text-center ${
            dragOver ? 'border-brand-400 bg-brand-50/70' : 'border-slate-200 bg-slate-50/60'
          }`}
        >
          <ImagePlus className="mx-auto h-8 w-8 text-slate-300" strokeWidth={1.5} aria-hidden />
          <p className="mt-2 text-sm font-medium text-slate-600">Tespit Fotoğrafı Ekleyin</p>
          <p className="mt-1 text-xs text-slate-400" data-testid="saha-tespit-surukle-birak">
            Kameradan, galeriden veya dosyayı buraya sürükleyip bırakarak ekleyin.
          </p>
        </div>
        )
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className={`group relative h-36 w-36 shrink-0 overflow-hidden rounded-lg border bg-slate-50 ${
                selecting && selectedIds.includes(doc.id)
                  ? 'border-brand-600 ring-2 ring-brand-500'
                  : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onPhotoClick(doc.id)}
                className="block h-full w-full"
                title={doc.fileName}
                aria-pressed={selecting ? selectedIds.includes(doc.id) : undefined}
              >
                <AuthBlobImg
                  url={entityDocumentFileUrl(doc.id, 'thumb')}
                  alt={doc.fileName}
                  className="h-full w-full object-contain bg-slate-50"
                />
              </button>
              {readOnly || !selecting ? null : (
                <span
                  className={`pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md shadow-sm ring-1 ${
                    selectedIds.includes(doc.id)
                      ? 'bg-brand-600 text-white ring-brand-700'
                      : 'bg-white/90 text-transparent ring-slate-200'
                  }`}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
              {readOnly || selecting ? null : (
              <button
                type="button"
                onClick={() => void handleDelete(doc.id, doc.fileName)}
                className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-200 transition group-hover:opacity-100 hover:text-status-danger"
                title="Sil"
                aria-label="Sil"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {previewIndex !== null && docs[previewIndex] ? (
        <PhotoLightbox
          srcs={docs.map((d) => entityDocumentFileUrl(d.id, 'full'))}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          alt={docs[previewIndex]?.fileName ?? 'Tespit Fotoğrafı'}
        />
      ) : null}
      {dialog}
    </div>
  );
}
