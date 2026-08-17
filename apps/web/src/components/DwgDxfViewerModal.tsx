'use client';

import { useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
type ViewerDoc = {
  id: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  storageKey: string;
  createdAt: string;
  uploadedBy?: { firstName: string; lastName: string } | null;
};

type Props = {
  doc: ViewerDoc;
  fileUrl: string;
  onClose: () => void;
  onDownload: () => void;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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


// ── DXF Viewer (sharecad.org embed — same as DWG) ────────────────────────────
function DxfViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [iframeError, setIframeError] = useState(false);
  const encodedUrl = encodeURIComponent(fileUrl);
  const embedUrl = `https://sharecad.org/cadframe/load?url=${encodedUrl}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-200 flex-shrink-0">
        <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-violet-700">
          DXF dosyası harici servis ile görüntüleniyor. Yüklenemezse dosyayı indirip AutoCAD veya uyumlu yazılımla açabilirsiniz.
        </p>
      </div>
      <div className="flex-1 relative overflow-hidden min-h-0">
        {!iframeError ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            style={{ minHeight: '400px', border: 'none' }}
            title={fileName}
            onError={() => setIframeError(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm font-semibold mb-1">DXF Görüntülenemedi</p>
            <p className="text-gray-400 text-xs text-center max-w-sm">
              Dosyayı indirerek AutoCAD veya uyumlu bir yazılımla açabilirsiniz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DWG Viewer (sharecad.org embed) ───────────────────────────────────────────
function DwgViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [iframeError, setIframeError] = useState(false);
  const encodedUrl = encodeURIComponent(fileUrl);
  const embedUrl = `https://sharecad.org/cadframe/load?url=${encodedUrl}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
        <svg className="w-4 h-4 text-status-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-amber-700">
          DWG görüntülemek için dosyanın erişilebilir bir URL&apos;e sahip olması gerekir. Görüntülenemiyorsa dosyayı indirin.
        </p>
      </div>
      <div className="flex-1 relative overflow-hidden min-h-0">
        {!iframeError ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            style={{ minHeight: '400px', border: 'none' }}
            title={fileName}
            onError={() => setIframeError(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm font-semibold mb-1">DWG Görüntülenemedi</p>
            <p className="text-gray-400 text-xs text-center max-w-sm">
              DWG dosyaları web üzerinde görüntülemek için üçüncü taraf servis gerektirir.
              Dosyayı indirerek AutoCAD veya uyumlu bir yazılımla açabilirsiniz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export function DwgDxfViewerModal({ doc, fileUrl, onClose, onDownload }: Props) {
  const ext = doc.fileExtension.replace('.', '').toLowerCase();
  const isDxf = ext === 'dxf';

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-6xl overflow-hidden"
        style={{ height: 'min(92vh, 900px)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          {/* File type badge */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isDxf ? 'bg-violet-50 border border-violet-100' : 'bg-orange-50 border border-orange-100'
          }`}>
            <span className={`text-[10px] font-bold tracking-tight ${isDxf ? 'text-violet-600' : 'text-orange-600'}`}>
              {ext.toUpperCase()}
            </span>
          </div>

          {/* File info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{doc.fileName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString('tr-TR')}
              {doc.uploadedBy && ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
            >
              <DownloadIcon />
              <span>İndir</span>
            </button>
            <button
              type="button"
              title="Kapat"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 transition-colors shadow-sm"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 overflow-hidden min-h-0">
          {isDxf ? (
            <DxfViewer fileUrl={fileUrl} fileName={doc.fileName} />
          ) : (
            <DwgViewer fileUrl={fileUrl} fileName={doc.fileName} />
          )}
        </div>
      </div>
    </div>
  );
}
