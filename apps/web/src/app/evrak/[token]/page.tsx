'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { prepareTrustedDocumentHtml } from '@/utils/sanitize-html';
import {
  getPublicDocument,
  markDocumentViewed,
  approveDocumentPublic,
} from '@/utils/fileDocumentApi';

type Stage = 'loading' | 'view' | 'approve' | 'done' | 'error' | 'already_approved';

export default function EvrakOnayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token as string;
  const printMode = searchParams?.get('print') === '1';

  const [stage, setStage] = useState<Stage>('loading');
  const [doc, setDoc] = useState<{
    id: string;
    documentKind: string;
    status: string;
    renderedContent: string;
    digitallyApprovedAt: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [leaveWarn, setLeaveWarn] = useState(false);
  const viewedRef = useRef(false);
  const needsInsuredApprove =
    doc?.documentKind === 'matbu_evrak' &&
    stage !== 'done' &&
    stage !== 'already_approved' &&
    stage !== 'loading' &&
    stage !== 'error';

  useEffect(() => {
    if (!token) return;

    getPublicDocument(token)
      .then((d) => {
        setDoc(d);
        if (d.digitallyApprovedAt) {
          setApprovedAt(d.digitallyApprovedAt);
          setStage('already_approved');
          return;
        }
        setStage('view');
        // Mark viewed
        if (!viewedRef.current) {
          viewedRef.current = true;
          markDocumentViewed(token).catch(() => {});
        }
      })
      .catch((e) => {
        setError(e.message ?? 'Evrak yüklenemedi');
        setStage('error');
      });
  }, [token]);

  useEffect(() => {
    if (!printMode || stage !== 'view' || !doc?.renderedContent) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [printMode, stage, doc?.renderedContent]);

  useEffect(() => {
    if (!needsInsuredApprove) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Onay vermeden çıkarsanız işlem tamamlanmaz.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [needsInsuredApprove]);

  const handleApprove = async () => {
    if (!fullName.trim()) return;
    setApproving(true);
    try {
      const res = await approveDocumentPublic(token, fullName.trim());
      setApprovedAt(res.digitallyApprovedAt);
      setStage('done');
    } catch (e: any) {
      setError(e.message ?? 'Onay işlemi başarısız');
    } finally {
      setApproving(false);
    }
  };

  const kindLabel =
    doc?.documentKind === 'muvafakatname'
      ? 'Muvafakatname'
      : doc?.documentKind === 'matbu_evrak'
        ? 'Servis Onay Formu'
        : 'Evrak';

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Evrak yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Evrak Bulunamadı</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (stage === 'already_approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Evrak Daha Önce Onaylandı</h2>
          <p className="text-gray-500 text-sm">
            Bu {kindLabel.toLowerCase()} belgesi{' '}
            {approvedAt
              ? new Date(approvedAt).toLocaleString('tr-TR')
              : ''}{' '}
            tarihinde onaylanmıştır.
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Onaylandı</h2>
          <p className="text-gray-500 text-sm mb-1">
            <strong>{fullName}</strong> tarafından onaylandı.
          </p>
          {approvedAt && (
            <p className="text-gray-400 text-xs">
              {new Date(approvedAt).toLocaleString('tr-TR')}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-4">
            Bu sayfayı kapatabilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  // View + approve stages
  return (
    <div className="min-h-screen bg-gray-50 evrak-page">
      {/* Header — yazdırma sırasında gizlenir */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
        <div>
          <p className="text-xs text-gray-500">Meridyen Assistance</p>
          <h1 className="text-sm font-semibold text-gray-900">{kindLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          {stage === 'view' && (
            <button
              onClick={() => setStage('approve')}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Onayla
            </button>
          )}
        </div>
      </div>
      {doc?.documentKind === 'matbu_evrak' && (stage === 'view' || stage === 'approve') ? (
        <div
          className="print:hidden max-w-3xl mx-auto mt-3 px-4"
          data-testid="sigortali-onay-uyari"
        >
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Bu belgeyi onaylamanız gerekir. Onay vermeden sayfayı kapatırsanız işlem tamamlanmaz.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Yazıcı gerekmez. Aşağıdaki Onayla ile belgenizi telefondan onaylayın.
          </p>
        </div>
      ) : null}

      {/* Document HTML */}
      <div className="max-w-3xl mx-auto my-4 px-4 print:max-w-none print:mx-0 print:px-0 print:my-0">
        <div className="bg-white rounded-xl shadow overflow-hidden print:shadow-none print:rounded-none">
          {doc?.renderedContent && (
            <div
              className="w-full evrak-document-root"
              dangerouslySetInnerHTML={{
                __html: prepareTrustedDocumentHtml(doc.renderedContent),
              }}
            />
          )}
        </div>
      </div>

      {/* Onay Modal */}
      {stage === 'approve' && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Belgeyi Onayla</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bu belgeni onaylamak için tam adınızı yazın.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Soyad
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınızı ve soyadınızı yazın"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              autoFocus
            />
            {error && (
              <p className="text-status-danger text-xs mb-2">{error}</p>
            )}
            <p className="text-xs text-gray-400 mb-4">
              Adınızı yazarak yukarıdaki belgeyi elektronik ortamda onaylamış
              sayılırsınız. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              {doc?.documentKind === 'matbu_evrak' ? (
                <button
                  type="button"
                  onClick={() => setLeaveWarn(true)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                >
                  Vazgeç
                </button>
              ) : (
                <button
                  onClick={() => { setStage('view'); setError(''); }}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                >
                  Vazgeç
                </button>
              )}
              <button
                onClick={handleApprove}
                disabled={!fullName.trim() || approving}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {approving ? 'Onaylanıyor…' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {doc?.documentKind === 'matbu_evrak' && stage === 'view' ? (
        <div className="print:hidden sticky bottom-0 z-20 border-t border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-950">Onay vermeden işlem tamamlanmaz.</p>
            <button
              type="button"
              onClick={() => setStage('approve')}
              className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Onayla
            </button>
          </div>
        </div>
      ) : null}

      {leaveWarn ? (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Onay gerekli</h3>
            <p className="mt-2 text-sm text-gray-600">
              Sigortalı onay vermeden bu form kapanmaz. Lütfen adınızı yazıp Onayla düğmesine basın.
            </p>
            <button
              type="button"
              onClick={() => {
                setLeaveWarn(false);
                setStage('approve');
              }}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Onaya dön
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
