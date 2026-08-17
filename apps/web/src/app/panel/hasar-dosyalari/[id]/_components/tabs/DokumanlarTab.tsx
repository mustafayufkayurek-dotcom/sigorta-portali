'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { API, authHeader } from '../claim-detail-utils';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';

// ─── Tab: Dokümanlar ──────────────────────────────────────────────────────────
// Helpers for DokumanlarTab
function _docFileIcon(ext: string) {
  const e = (ext || '').replace('.', '').toLowerCase();
  if (e === 'pdf') return { bg: 'bg-red-50', text: 'text-red-600' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) return { bg: 'bg-green-50', text: 'text-green-600' };
  if (['doc', 'docx'].includes(e)) return { bg: 'bg-blue-50', text: 'text-blue-700' };
  if (['xls', 'xlsx'].includes(e)) return { bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (e === 'dwg') return { bg: 'bg-orange-50', text: 'text-orange-600' };
  if (e === 'dxf') return { bg: 'bg-violet-50', text: 'text-violet-600' };
  return { bg: 'bg-slate-100', text: 'text-slate-600' };
}

function _isCADExt(ext: string) {
  const e = (ext || '').replace('.', '').toLowerCase();
  return e === 'dwg' || e === 'dxf';
}

function _isPreviewable(mimeType: string) {
  return mimeType?.startsWith('image/') || mimeType === 'application/pdf';
}

function _fmtBytes(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const DwgDxfViewerModal = dynamic(
  () => import('@/components/DwgDxfViewerModal').then((m) => m.DwgDxfViewerModal),
  { ssr: false }
);

export function DokumanlarTab({ claimId }: { claimId: string }) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [cadDoc, setCadDoc] = useState<any | null>(null);
  const [cadUrl, setCadUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocs = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/documents?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setDocs(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = '.' + (file.name.split('.').pop() || '');
      // Step 1: get presigned URL
      const presignRes = await axios.post(`${API}/uploads/presign`, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        ownerType: 'claim_file',
        ownerId: claimId,
      }, { headers: authHeader() });
      const { presignedUrl, storageKey } = presignRes.data.data;

      // Step 2: PUT to presigned URL (or local)
      if (presignedUrl.includes('localhost')) {
        // local: use our API
        const fd = new FormData();
        fd.append('file', file);
        await axios.post(`${API}/uploads/${storageKey}`, fd, {
          headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      }

      // Step 3: create document record
      await axios.post(`${API}/documents`, {
        claimFileId: claimId,
        fileName: file.name,
        fileExtension: ext,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        storageKey,
        documentType: null,
        category: 'document',
      }, { headers: authHeader() });

      loadDocs();
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Yükleme başarısız'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getDocUrl = async (storageKey: string): Promise<string> => {
    const r = await axios.get(`${API}/uploads/signed-url?storageKey=${encodeURIComponent(storageKey)}`, { headers: authHeader() });
    return r.data.data.url;
  };

  const handleDownload = async (doc: any) => {
    const fileName = doc.fileAsset?.fileName || 'dosya';
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { showToast('error', 'İndirilemiyor'); }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`"${fileName}" silinsin mi?`)) return;
    try {
      await axios.delete(`${API}/documents/${docId}`, { headers: authHeader() });
      loadDocs();
    } catch { showToast('error', 'Silinemedi'); }
  };

  const handlePreview = async (doc: any) => {
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      setPreviewDoc({ ...doc, _url: url });
    } catch { showToast('error', 'Önizleme Açılamadı'); }
  };

  const handleCADView = async (doc: any) => {
    const storageKey = doc.fileAsset?.storageKey;
    if (!storageKey) return;
    try {
      const url = await getDocUrl(storageKey);
      setCadUrl(url);
      setCadDoc(doc);
    } catch { showToast('error', 'Görüntüleyici Açılamadı'); }
  };

  return (
    <div className="space-y-4">
      {/* Upload panel */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Evrak Arşivi — Yükle</h4>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={(el) => { fileInputRef.current = el; }}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
            onChange={handleUpload}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {uploading ? 'Yükleniyor...' : 'Dosya Seç'}
          </button>
          <span className="text-xs text-slate-400">PDF, JPG, PNG, DOC, XLS, <span className="font-semibold text-orange-600">DWG</span>, <span className="font-semibold text-violet-600">DXF</span> desteklenir</span>
        </div>
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Evrak Arşivi</h4>
          {docs.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-medium">{docs.length} dosya</span>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center"><p className="text-slate-400 text-sm">Yükleniyor...</p></div>
        ) : docs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-slate-400 text-sm">Henüz Evrak Yüklenmemiş.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {docs.map((d) => {
              const fa = d.fileAsset;
              const ext = (fa?.fileExtension || '').replace('.', '').toLowerCase();
              const icon = _docFileIcon(fa?.fileExtension || '');
              const canPreview = _isPreviewable(fa?.mimeType || '');
              const canViewCAD = _isCADExt(fa?.fileExtension || '');
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors duration-100 group">
                  <div className={`w-9 h-9 rounded-lg ${icon.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`${icon.text} text-[10px] font-bold tracking-tight`}>{ext.toUpperCase() || 'FILE'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate leading-snug">{fa?.fileName || '—'}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {d.documentType && <span className="inline-flex items-center bg-brand-50 text-brand-700 border border-brand-100 px-1.5 py-0.5 rounded text-[10px] font-medium">{d.documentType}</span>}
                      {fa?.fileSize && <span className="text-xs text-slate-400">{_fmtBytes(fa.fileSize)}</span>}
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">v{d.versionNo}</span>
                      {d.createdAt && <><span className="text-slate-300 text-xs">·</span><span className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('tr-TR')}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                      <button type="button" title="Önizle" onClick={() => handlePreview(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-brand-50 text-brand-600 hover:bg-brand-100 border-brand-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    {canViewCAD && (
                      <button type="button" title="CAD Görüntüle" onClick={() => handleCADView(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-brand-50 text-brand-600 hover:bg-brand-100 border-brand-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                    )}
                    <button type="button" title="İndir" onClick={() => handleDownload(d)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-blue-50 text-brand-600 hover:bg-blue-100 border-blue-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button type="button" title="Sil" onClick={() => handleDelete(d.id, fa?.fileName || '')}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border bg-red-50 text-status-danger hover:bg-red-100 border-red-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal (PDF/Image) */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setPreviewDoc(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 truncate">{previewDoc.fileAsset?.fileName}</p></div>
              <button type="button" onClick={() => { handleDownload(previewDoc); setPreviewDoc(null); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                İndir
              </button>
              <button type="button" onClick={() => setPreviewDoc(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0 bg-slate-50">
              {previewDoc.fileAsset?.mimeType === 'application/pdf' ? (
                <iframe src={previewDoc._url} className="w-full h-full" style={{ minHeight: '62vh' }} title={previewDoc.fileAsset?.fileName} />
              ) : (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewDoc._url} alt={previewDoc.fileAsset?.fileName} className="max-w-full max-h-full object-contain rounded-xl shadow-md" style={{ maxHeight: 'calc(92vh - 100px)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DWG/DXF viewer modal */}
      {cadDoc && cadUrl && (
        <DwgDxfViewerModal
          doc={{
            id: cadDoc.id,
            fileName: cadDoc.fileAsset?.fileName || '',
            fileExtension: cadDoc.fileAsset?.fileExtension || '',
            fileSize: cadDoc.fileAsset?.fileSize || 0,
            storageKey: cadDoc.fileAsset?.storageKey || '',
            createdAt: cadDoc.createdAt || '',
            uploadedBy: cadDoc.fileAsset?.uploadedBy || null,
          }}
          fileUrl={cadUrl}
          onClose={() => { setCadDoc(null); setCadUrl(''); }}
          onDownload={() => handleDownload(cadDoc)}
        />
      )}
    </div>
  );
}
