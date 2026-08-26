'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Trash2 } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { reportCaughtError } from '@/utils/report-caught-error';
import { AuthBlobImg } from '@/components/ui/AuthBlobImg';
import { entityDocumentFileUrl } from '@/utils/protected-image';
import { PhotoLightbox } from '@/components/ui/PhotoLightbox';
import { isRepairCompletionPhotoNote, repairCompletionPhotoNote } from '@sigorta/shared';

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

export function VendorRepairPhotosPanel({
  claimId,
  vendorId,
  vendorName,
  readOnly = false,
}: {
  claimId: string;
  vendorId: string;
  vendorName: string;
  readOnly?: boolean;
}) {
  const [docs, setDocs] = useState<PhotoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const note = repairCompletionPhotoNote(vendorId, vendorName);

  const load = useCallback(async () => {
    if (!claimId || !vendorId) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/entity-documents`, {
        headers: authHeader(),
        params: { entityType: 'claim_file', entityId: claimId },
      });
      const rows = ((r.data?.data ?? []) as PhotoDoc[]).filter(
        (d) => isImageMime(d.mimeType) && isRepairCompletionPhotoNote(d.notes, vendorId),
      );
      setDocs(rows);
    } catch (err) {
      reportCaughtError(err, 'Onarım resimleri yüklenemedi.', { toast: false });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [claimId, vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (!claimId || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('entityType', 'claim_file');
        fd.append('entityId', claimId);
        fd.append('notes', note);
        await axios.post(`${API}/entity-documents`, fd, { headers: authHeader() });
      }
      await load();
    } catch (err) {
      reportCaughtError(err, 'Fotoğraf yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={`onarim-bitis-foto-${vendorId}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-700">{vendorName}</p>
        {readOnly ? null : (
          <>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Resim ekle
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void uploadFiles(files);
          }}
        />
          </>
        )}
      </div>
      {loading ? (
        <p className="text-[11px] text-slate-400">Yükleniyor…</p>
      ) : docs.length === 0 ? (
        <p className="text-[11px] text-slate-500">Bu tedarikçinin onarım bitiş resmi yok.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docs.map((d, i) => (
            <button
              key={d.id}
              type="button"
              className="relative h-36 w-36 overflow-hidden rounded-lg border border-slate-200"
              onClick={() => setPreviewIndex(i)}
            >
              <AuthBlobImg url={entityDocumentFileUrl(d.id, 'thumb')} alt="" className="h-full w-full object-cover" />
              {readOnly ? null : (
              <span
                className="absolute right-0.5 top-0.5 rounded bg-white/90 p-0.5"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (!confirm('Silinsin mi?')) return;
                  void axios.delete(`${API}/entity-documents/${d.id}`, { headers: authHeader() }).then(load);
                }}
              >
                <Trash2 className="h-3 w-3 text-red-600" />
              </span>
              )}
            </button>
          ))}
        </div>
      )}
      {previewIndex != null ? (
        <PhotoLightbox
          srcs={docs.map((d) => entityDocumentFileUrl(d.id, 'full'))}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          alt={docs[previewIndex]?.fileName ?? 'Onarım resmi'}
        />
      ) : null}
    </div>
  );
}
