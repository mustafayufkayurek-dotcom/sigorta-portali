'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalProcessTimeline from '@/components/portal/PortalProcessTimeline';
import { fmtDate } from '@/utils/date-helpers';
import { fetchPortalClaimFiles, hasPortalSessionToken } from '@/utils/portal-api';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { readInsurancePortalUser } from '@/utils/portal-insurance-scope';

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
  filesLimit?: number;
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
  filesLimit = 50,
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

    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }

    setLoading(true);
    setError(null);
    fetchPortalClaimFiles(filesLimit)
      .then((res) => {
        setFiles((res?.data ?? []) as ClaimFile[]);
      })
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Dosyalar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router, filesLimit, assertAccess, scopeRequiredMessage]);

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
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref={portalHomeHref}
        portalHomeLabel={portalHomeLabel}
        currentLabel="Dosya Akışı"
        title="Dosya Akışı İzleme"
        actions={
          <Link
            href={filesLinkHref}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
          >
            {filesLinkLabel}
          </Link>
        }
      />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span className="text-sm">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 font-bold text-red-700 hover:text-red-900"
          >
            &times;
          </button>
        </div>
      )}

      {missingScope && scopeRequiredMessage ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="mt-2 text-sm text-slate-500">{scopeRequiredMessage}</p>
        </div>
      ) : !error && files.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="font-medium text-slate-500">Henüz dosya bulunmuyor.</p>
          <p className="mt-1 text-sm text-slate-400">{emptyHint}</p>
          <Link
            href={filesLinkHref}
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {filesLinkLabel}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobil: dosya seçici */}
          <div className="md:hidden">
            <p className="mb-2 px-1 text-xs font-medium text-slate-500">{listTitle}</p>
            <div className="space-y-2">
              {files.map((f) => {
                const active = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFile(f.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{fileNoOf(f)}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {f.insuranceCompany?.name ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{fmtDate(f.createdAt)}</p>
                      </div>
                      <span
                        className="inline-block max-w-[6.5rem] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
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
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="hidden space-y-2 md:block lg:col-span-4">
              <p className="px-1 text-xs font-medium text-slate-500">{listTitle}</p>
              <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {files.map((f) => {
                  const active = f.id === selectedId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFile(f.id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        active ? 'border-l-2 border-l-blue-600 bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{fileNoOf(f)}</span>
                        <span
                          className="inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
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
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {f.insuranceCompany?.name ?? '—'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{fmtDate(f.createdAt)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-8">
              {selectedId && selectedFile ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <h3 className="text-base font-semibold text-slate-800">
                      {fileNoOf(selectedFile)}
                      {selectedFile.insuranceCompany?.name ? (
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          · {selectedFile.insuranceCompany.name}
                        </span>
                      ) : null}
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
                <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                  Görüntülemek için bir dosya seçin.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
