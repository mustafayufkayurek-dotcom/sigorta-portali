'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { sanitizeHtml } from '@/utils/sanitize-html';
import {
  getPublicDocument,
  markDocumentViewed,
  approveDocumentPublic,
} from '@/utils/fileDocumentApi';

type Stage = 'loading' | 'view' | 'approve' | 'done' | 'error' | 'already_approved';

export default function EvrakOnayPage() {
  const params = useParams();
  const token = params?.token as string;

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
  const viewedRef = useRef(false);

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
    doc?.documentKind === 'muvafakatname' ? 'Muvafakatname' : 'Matbu Evrak';

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-500">Meridyen Assistance</p>
          <h1 className="text-sm font-semibold text-gray-900">{kindLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          {stage === 'view' && (
            <button
              onClick={() => setStage('approve')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Onayla
            </button>
          )}
        </div>
      </div>

      {/* Document HTML */}
      <div className="max-w-3xl mx-auto my-4 px-4">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {doc?.renderedContent && (
            <div
              className="w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.renderedContent) }}
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
              <p className="text-red-500 text-xs mb-2">{error}</p>
            )}
            <p className="text-xs text-gray-400 mb-4">
              Adınızı yazarak yukarıdaki belgeyi elektronik ortamda onaylamış
              sayılırsınız. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setStage('view'); setError(''); }}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleApprove}
                disabled={!fullName.trim() || approving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {approving ? 'Onaylanıyor…' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
