'use client';

import { API, authHeader, getToken } from '@/utils/api';
import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import {
  filterDocumentTypesForCustomerSubType,
  filterDocumentTypesForVendorCategory,
} from '@/utils/document-type-scope';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';

const DwgDxfViewerModal = dynamic(
  () => import('./DwgDxfViewerModal').then((m) => m.DwgDxfViewerModal),
  { ssr: false }
);



function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(ext: string, mimeType: string) {
  const e = ext.replace('.', '').toLowerCase();
  if (['pdf'].includes(e)) return { bg: 'bg-red-50', text: 'text-red-600', label: 'PDF' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(e)) return { bg: 'bg-green-50', text: 'text-green-600', label: e.toUpperCase() };
  if (['doc', 'docx'].includes(e)) return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'DOC' };
  if (['xls', 'xlsx'].includes(e)) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'XLS' };
  if (e === 'dwg') return { bg: 'bg-orange-50', text: 'text-orange-600', label: 'DWG' };
  if (e === 'dxf') return { bg: 'bg-violet-50', text: 'text-violet-600', label: 'DXF' };
  if (mimeType.startsWith('image/')) return { bg: 'bg-green-50', text: 'text-green-600', label: 'IMG' };
  return { bg: 'bg-gray-100', text: 'text-gray-600', label: e.toUpperCase() || 'FILE' };
}

function isImage(mimeType: string) { return mimeType.startsWith('image/'); }
function isPdf(mimeType: string) { return mimeType === 'application/pdf'; }
function isCAD(ext: string) {
  const e = ext.replace('.', '').toLowerCase();
  return e === 'dwg' || e === 'dxf';
}

// ── SVG Icon Components ────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Doc = {
  id: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  notes?: string | null;
  storageKey: string;
  documentType?: { id: string; name: string } | null;
  uploadedBy?: { firstName: string; lastName: string } | null;
  createdAt: string;
};

type DocType = { id: string; name: string; code: string };

type Props = {
  /** 'vendor' uses /vendors/:id/documents endpoint; 'entity' uses /entity-documents?entityType=...&entityId=... */
  mode: 'vendor' | 'entity';
  /** For mode='vendor': vendorId. For mode='entity': entityId */
  entityId: string;
  /** For mode='entity' only: 'customer' | 'insurance_company' */
  entityType?: string;
  /** Müşteri alt tipi — evrak türü filtresi (insured, sigorta_sirketi, …) */
  customerSubType?: string | null;
  /** Tedarikçi hizmet kategorisi — hasar | acil | her_ikisi */
  vendorCategory?: string | null;
  /** Optional section card title */
  title?: string;
};

// ── Icon Action Button ─────────────────────────────────────────────────────────
function ActionBtn({
  onClick,
  title,
  variant,
  children,
}: {
  onClick: () => void;
  title: string;
  variant: 'indigo' | 'gray' | 'blue' | 'red';
  children: React.ReactNode;
}) {
  const styles = {
    indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border-indigo-100',
    gray: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-gray-200',
    blue: 'bg-blue-50 text-brand-600 hover:bg-blue-100 hover:text-blue-700 border-blue-100',
    red: 'bg-red-50 text-status-danger hover:bg-red-100 hover:text-red-700 border-red-100',
  }[variant];

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-150 ${styles}`}
    >
      {children}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function EntityDocumentsTab({
  mode,
  entityId,
  entityType,
  customerSubType,
  vendorCategory,
  title = 'Evraklar',
}: Props) {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  // CAD viewer state
  const [cadViewerDoc, setCadViewerDoc] = useState<Doc | null>(null);

  const listUrl = mode === 'vendor'
    ? `${API}/vendors/${entityId}/documents`
    : `${API}/entity-documents?entityType=${entityType}&entityId=${entityId}`;

  const uploadUrl = mode === 'vendor'
    ? `${API}/vendors/${entityId}/documents`
    : `${API}/entity-documents`;

  const downloadUrl = (docId: string) => mode === 'vendor'
    ? `${API}/vendor-documents/${docId}/download`
    : `${API}/entity-documents/${docId}/download`;

  const deleteUrl = (docId: string) => mode === 'vendor'
    ? `${API}/vendor-documents/${docId}`
    : `${API}/entity-documents/${docId}`;

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(listUrl, { headers: authHeader() });
      setDocs(r.data.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [listUrl]);

  useEffect(() => {
    loadDocuments();
    const params: Record<string, string> = { status: 'active' };
    if (mode === 'entity') {
      params.entityScope = 'customer';
      if (customerSubType) params.customerSubType = customerSubType;
      else if (entityType === 'insurance_company') params.customerSubType = 'sigorta_sirketi';
    } else {
      params.entityScope = 'vendor';
    }
    axios.get(`${API}/document-types`, { headers: authHeader(), params })
      .then((r) => {
        let rows = r.data.data || [];
        if (mode === 'entity') {
          rows = filterDocumentTypesForCustomerSubType(rows, customerSubType ?? (entityType === 'insurance_company' ? 'sigorta_sirketi' : null));
        } else if (vendorCategory) {
          rows = filterDocumentTypesForVendorCategory(rows, vendorCategory);
        }
        setDocTypes(rows);
      })
      .catch(console.error);
  }, [loadDocuments, mode, entityType, customerSubType, vendorCategory]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (selectedTypeId) fd.append('documentTypeId', selectedTypeId);
      if (notes.trim()) fd.append('notes', notes.trim());
      if (mode === 'entity') {
        fd.append('entityType', entityType!);
        fd.append('entityId', entityId);
      }
      await axios.post(uploadUrl, fd, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setNotes('');
      setSelectedTypeId('');
      loadDocuments();
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Yükleme Başarısız'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`"${fileName}" evrakını silmek istediğinizden emin misiniz?`)) return;
    try {
      await axios.delete(deleteUrl(docId), { headers: authHeader() });
      loadDocuments();
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Silinemedi'));
    }
  };

  const handleDownload = (docId: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = downloadUrl(docId);
    a.setAttribute('target', '_blank');
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = (doc: Doc) => {
    const url = downloadUrl(doc.id);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    }
  };

  const getPreviewUrl = (docId: string) => {
    const token = getToken();
    return `${downloadUrl(docId)}?token=${token}`;
  };

  return (
    <div className="space-y-4">
      {/* Upload Panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">{title} — Yükle</h4>
        <div className="flex flex-wrap gap-3 items-end">
          {docTypes.length > 0 && (
            <div className="flex-1 min-w-40">
              <label className="text-xs font-medium text-gray-500 block mb-1">Evrak Türü</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
              >
                <option value="">— Tür seçin (opsiyonel) —</option>
                {docTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-40">
            <label className="text-xs font-medium text-gray-500 block mb-1">Not (opsiyonel)</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              placeholder="Opsiyonel"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div>
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
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <UploadIcon />
              {uploading ? 'Yükleniyor...' : 'Dosya Seç'}
            </button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          {docs.length > 0 && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 font-medium">
              {docs.length} dosya
            </span>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center">
            <p className="text-gray-400 text-sm">Yükleniyor...</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Henüz Evrak Yüklenmemiş.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {docs.map((doc) => {
              const icon = fileIcon(doc.fileExtension, doc.mimeType);
              const canPreview = isImage(doc.mimeType) || isPdf(doc.mimeType);
              const canViewCAD = isCAD(doc.fileExtension);
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors duration-100 group"
                >
                  {/* File type badge */}
                  <div className={`w-9 h-9 rounded-lg ${icon.bg} border border-current/10 flex items-center justify-center flex-shrink-0`}>
                    <span className={`${icon.text} text-[10px] font-bold tracking-tight`}>{icon.label}</span>
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate leading-snug">{doc.fileName}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {doc.documentType && (
                        <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {doc.documentType.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {fmtSize(doc.fileSize)}
                      </span>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                      {doc.uploadedBy && (
                        <>
                          <span className="text-gray-300 text-xs">·</span>
                          <span className="text-xs text-gray-400">{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
                        </>
                      )}
                      {doc.notes && (
                        <>
                          <span className="text-gray-300 text-xs">·</span>
                          <span className="text-xs text-gray-500 italic">{doc.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons — icon only */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                      <ActionBtn
                        onClick={() => setPreviewDoc(doc)}
                        title="Önizle"
                        variant="indigo"
                      >
                        <EyeIcon />
                      </ActionBtn>
                    )}
                    {canViewCAD && (
                      <ActionBtn
                        onClick={() => setCadViewerDoc(doc)}
                        title="CAD Görüntüle"
                        variant="indigo"
                      >
                        <EyeIcon />
                      </ActionBtn>
                    )}
                    <ActionBtn
                      onClick={() => handlePrint(doc)}
                      title="Yazdır"
                      variant="gray"
                    >
                      <PrintIcon />
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                      title="İndir"
                      variant="blue"
                    >
                      <DownloadIcon />
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => handleDelete(doc.id, doc.fileName)}
                      title="Sil"
                      variant="red"
                    >
                      <TrashIcon />
                    </ActionBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewDoc(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
              {/* File icon */}
              <div className={`w-9 h-9 rounded-lg ${fileIcon(previewDoc.fileExtension, previewDoc.mimeType).bg} border border-current/10 flex items-center justify-center flex-shrink-0`}>
                <span className={`${fileIcon(previewDoc.fileExtension, previewDoc.mimeType).text} text-[10px] font-bold tracking-tight`}>
                  {fileIcon(previewDoc.fileExtension, previewDoc.mimeType).label}
                </span>
              </div>

              {/* File name & meta */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{previewDoc.fileName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmtSize(previewDoc.fileSize)} · {new Date(previewDoc.createdAt).toLocaleDateString('tr-TR')}
                  {previewDoc.uploadedBy && ` · ${previewDoc.uploadedBy.firstName} ${previewDoc.uploadedBy.lastName}`}
                </p>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  title="Yazdır"
                  onClick={() => handlePrint(previewDoc)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors shadow-sm"
                >
                  <PrintIcon />
                  <span>Yazdır</span>
                </button>
                <button
                  type="button"
                  title="İndir"
                  onClick={() => handleDownload(previewDoc.id, previewDoc.fileName)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <DownloadIcon />
                  <span>İndir</span>
                </button>
                <button
                  type="button"
                  title="Kapat"
                  onClick={() => setPreviewDoc(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 transition-colors shadow-sm"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden min-h-0 bg-gray-50">
              {isPdf(previewDoc.mimeType) ? (
                <iframe
                  src={getPreviewUrl(previewDoc.id)}
                  className="w-full h-full"
                  style={{ minHeight: '62vh' }}
                  title={previewDoc.fileName}
                />
              ) : isImage(previewDoc.mimeType) ? (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPreviewUrl(previewDoc.id)}
                    alt={previewDoc.fileName}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-md"
                    style={{ maxHeight: 'calc(92vh - 100px)' }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm mb-1 font-medium">Bu Dosya Türü Önizlenemiyor</p>
                    <p className="text-gray-400 text-xs mb-5">Dosyayı İndirerek Görüntüleyebilirsiniz.</p>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewDoc.id, previewDoc.fileName)}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <DownloadIcon />
                      Dosyayı İndir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* CAD Viewer Modal (DWG/DXF) */}
      {cadViewerDoc && (
        <DwgDxfViewerModal
          doc={cadViewerDoc}
          fileUrl={getPreviewUrl(cadViewerDoc.id)}
          onClose={() => setCadViewerDoc(null)}
          onDownload={() => handleDownload(cadViewerDoc.id, cadViewerDoc.fileName)}
        />
      )}
    </div>
  );
}
