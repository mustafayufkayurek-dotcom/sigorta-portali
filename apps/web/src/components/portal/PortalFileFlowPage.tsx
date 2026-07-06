'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import PortalProcessTimeline from '@/components/portal/PortalProcessTimeline';
import { fmtDate } from '@/utils/date-helpers';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { readInsurancePortalUser } from '@/utils/portal-insurance-scope';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface ClaimFile {
  id: string;
  fileNo?: string;
  fileNumber?: string;
  createdAt: string;
  insuranceCompany?: { name: string };
  currentStatus?: { name: string; code?: string; colorCode?: string; color?: string };
}

function fileNoOf(f: ClaimFile) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

export interface PortalFileFlowPageProps {
  portalHomeHref: string;
  portalHomeLabel: string;
  listTitle: string;
  emptyHint: string;
  filesLinkHref: string;
  filesLinkLabel: string;
  filesApiUrl: string;
  assertAccess: (user: { role?: { code?: string } }) => boolean;
  scopeRequiredMessage?: string;
}

export default function PortalFileFlowPage({
  portalHomeHref,
  portalHomeLabel,
  listTitle,
  emptyHint,
  filesLinkHref,
  filesLinkLabel,
  filesApiUrl,
  assertAccess,
  scopeRequiredMessage,
}: PortalFileFlowPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileIdFromQuery = searchParams.get('fileId');

  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);

  const selectFile = useCallback(
    (id: string) => {
      setSelectedId(id);
      const url = new URL(window.location.href);
      url.searchParams.set('fileId', id);
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) {
      router.push('/giris');
      return;
    }
    const u = JSON.parse(raw);
    if (!assertAccess(u)) {
      router.push('/panel');
      return;
    }

    if (scopeRequiredMessage) {
      const { hasScope } = readInsurancePortalUser();
      if (!hasScope) {
        setMissingScope(true);
        setLoading(false);
        return;
      }
    }
    setMissingScope(false);

    setLoading(true);
    setError(null);
    fetch(filesApiUrl, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((res) => {
        setFiles(res?.data ?? []);
      })
      .catch((err: Error) => setError(err.message ?? 'Dosyalar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router, filesApiUrl, assertAccess, scopeRequiredMessage]);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedId(null);
      return;
    }
    if (fileIdFromQuery && files.some((f) => f.id === fileIdFromQuery)) {
      setSelectedId(fileIdFromQuery);
      return;
    }
    setSelectedId((prev) => (prev && files.some((f) => f.id === prev) ? prev : files[0].id));
  }, [files, fileIdFromQuery]);

  const selectedFile = files.find((f) => f.id === selectedId);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      <PortalBreadcrumb
        portalHomeHref={portalHomeHref}
        portalHomeLabel={portalHomeLabel}
        currentLabel="Dosya Akışı"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-900">Dosya Akışı İzleme</h2>
        <Link
          href={filesLinkHref}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {filesLinkLabel}
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 ml-4 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {missingScope && scopeRequiredMessage ? (
        <div className="bg-white rounded-xl border border-amber-200 py-16 text-center px-6">
          <p className="text-slate-700 font-medium">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="text-slate-500 text-sm mt-2">{scopeRequiredMessage}</p>
        </div>
      ) : !error && files.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-slate-500 font-medium">Henüz dosya bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">{emptyHint}</p>
          <Link
            href={filesLinkHref}
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            {filesLinkLabel}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-2">
            <p className="text-xs font-medium text-slate-500 px-1">{listTitle}</p>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {files.map((f) => {
                const active = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFile(f.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{fileNoOf(f)}</span>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
                        style={{
                          background: f.currentStatus?.colorCode
                            ? `${f.currentStatus.colorCode}20`
                            : '#f3f4f6',
                          color: f.currentStatus?.colorCode ?? '#374151',
                        }}
                      >
                        {portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {f.insuranceCompany?.name ?? '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(f.createdAt)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8">
            {selectedId && selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-slate-800">
                    {fileNoOf(selectedFile)}
                    {selectedFile.insuranceCompany?.name && (
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        · {selectedFile.insuranceCompany.name}
                      </span>
                    )}
                  </h3>
                </div>
                <PortalProcessTimeline
                  claimFileId={selectedId}
                  fileCreatedAt={selectedFile.createdAt}
                  initialStatusCode={selectedFile.currentStatus?.code}
                  initialStatusName={portalStatusLabel(
                    selectedFile.currentStatus?.code,
                    selectedFile.currentStatus?.name,
                  )}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-500 text-sm">
                Görüntülemek için bir dosya seçin.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
