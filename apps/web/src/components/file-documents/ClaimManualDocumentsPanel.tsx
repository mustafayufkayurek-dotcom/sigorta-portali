'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  claimManualDocumentLabel,
  getFileDocumentPhysicalUrl,
  getFileDocuments,
  listClaimInsuredDocumentTypes,
  uploadClaimManualDocument,
  type CatalogDocumentType,
  type FileDocument,
} from '@/utils/fileDocumentApi';

export function ClaimManualDocumentsPanel({
  claimId,
  onUploaded,
  listOnly = false,
}: {
  claimId: string;
  onUploaded?: () => void;
  /** Operasyon toplama: yükleme yok, yalnız biriken evrak. */
  listOnly?: boolean;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [kind, setKind] = useState('');
  const [catalog, setCatalog] = useState<CatalogDocumentType[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<FileDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, types] = await Promise.all([
        getFileDocuments('claim_file', claimId),
        listClaimInsuredDocumentTypes(),
      ]);
      setCatalog(types);
      setDocs(rows.filter((d) => d.documentKind !== 'matbu_evrak' && !!d.physicalUploadKey));
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Evraklar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimId, showToast]);

  useEffect(() => { void load(); }, [load]);

  const selectedName = catalog.find((row) => row.id === kind)?.name ?? 'Evrak';

  const handlePick = () => {
    if (!kind) {
      showToast('error', 'Önce evrak türünü seçin.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!kind) {
      showToast('error', 'Önce evrak türünü seçin.');
      return;
    }
    setUploading(true);
    try {
      await uploadClaimManualDocument(claimId, kind, file);
      showToast('success', `${selectedName} yüklendi.`);
      setKind('');
      await load();
      onUploaded?.();
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Evrak yüklenemedi'));
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      const { url } = await getFileDocumentPhysicalUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Evrak açılamadı'));
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {listOnly ? (
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <h4 className="text-sm font-semibold text-slate-800">Yüklenen Evraklar</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Yükleme planlayıcıdadır. Biriken evrak Evraklar → Tespit Ve Onarım’dadır.
          </p>
        </div>
      ) : (
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <h4 className="text-sm font-semibold text-slate-800">Manuel Evrak Yükle</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Yüklemeden önce evrak türünü seçin. Türler Ayarlar → Evrak Türleri (Müşteri · Sigortalı).
          </p>
        </div>
      )}

      {listOnly ? null : (
      <div className="px-5 py-4 space-y-3">
        <div>
          <label htmlFor="claim-manual-doc-kind" className="block text-xs font-medium text-slate-600 mb-1.5">
            Evrak Türü
          </label>
          <select
            id="claim-manual-doc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={catalog.length === 0}
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-slate-50"
          >
            <option value="">Seçiniz</option>
            {catalog.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          {catalog.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Bu kapsamda tür yok.{' '}
              <Link href="/panel/ayarlar/evrak-turleri" className="font-semibold text-brand-700 underline">
                Evrak Türleri
              </Link>
              ’nde Müşteri · Sigortalı tanımı ekleyin.
            </p>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleUpload}
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading || !kind}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Yükleniyor…' : 'Dosya Seç Ve Yükle'}
        </button>
      </div>
      )}

      <div className={listOnly ? 'px-5 py-3' : 'border-t border-slate-100 px-5 py-3'}>
        {listOnly ? null : <p className="text-xs font-medium text-slate-500 mb-2">Yüklenen Evraklar</p>}
        {loading ? (
          <p className="text-xs text-slate-400 py-2">Yükleniyor…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Henüz manuel evrak yüklenmedi.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {claimManualDocumentLabel(d)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {d.physicalUploadedAt
                      ? new Date(d.physicalUploadedAt).toLocaleString('tr-TR')
                      : new Date(d.createdAt).toLocaleString('tr-TR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleOpen(d.id)}
                  className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                >
                  Aç
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
