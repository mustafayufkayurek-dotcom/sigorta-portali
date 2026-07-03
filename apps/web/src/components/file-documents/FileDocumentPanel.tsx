'use client';

import { useState, useEffect } from 'react';
import {
  FileDocument,
  FileDocumentKind,
  createFileDocument,
  getFileDocuments,
  sendWhatsapp,
} from '@/utils/fileDocumentApi';

function CheckIcon({ className = '' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-700' },
    viewed: { label: 'Görüntülendi', color: 'bg-yellow-100 text-yellow-700' },
    digitally_approved: { label: 'Tamamlandı', color: 'bg-emerald-100 text-emerald-700' },
    physically_uploaded: { label: 'Tamamlandı', color: 'bg-emerald-100 text-emerald-700' },
  };
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

interface Props {
  entityType: 'claim_file' | 'emergency_case';
  entityId: string;
  documentKind: FileDocumentKind;
  onConditionsMet?: () => void;
  readonly?: boolean;
}

function WhatsAppModal({
  doc,
  onClose,
  onSent,
}: {
  doc: FileDocument;
  onClose: () => void;
  onSent: () => void;
}) {
  const [phone, setPhone] = useState(doc.whatsappPhone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [waUrl, setWaUrl] = useState('');

  const handleSend = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await sendWhatsapp(doc.id, phone.trim());
      setWaUrl(res.waUrl);
      onSent();
    } catch (e: any) {
      setError(e.message ?? 'WhatsApp gönderimi başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">WhatsApp ile Gönder</h3>
        <p className="text-sm text-gray-500 mb-4">Onay linkini aşağıdaki numaraya gönderin.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon No</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+90 5XX XXX XX XX"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          autoFocus
        />
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        {waUrl ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-green-700 text-sm font-medium mb-2">Link oluşturuldu!</p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              WhatsApp&apos;ta Aç
            </a>
          </div>
        ) : null}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
          >
            Kapat
          </button>
          {!waUrl && (
            <button
              onClick={handleSend}
              disabled={!phone.trim() || loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Gönderiliyor…' : 'Link Oluştur'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FileDocumentPanel({
  entityType,
  entityId,
  documentKind,
  onConditionsMet,
  readonly = false,
}: Props) {
  const [docs, setDocs] = useState<FileDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [waModal, setWaModal] = useState<FileDocument | null>(null);

  const activeDoc = docs[0] ?? null;

  const load = async () => {
    try {
      const data = await getFileDocuments(entityType, entityId);
      setDocs(data);
    } catch (e: any) {
      setError(e.message ?? 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  useEffect(() => {
    if (!activeDoc) return;
    if (activeDoc.digitallyApprovedAt) onConditionsMet?.();
  }, [activeDoc?.digitallyApprovedAt]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const doc = await createFileDocument({ entityType, entityId, documentKind });
      setDocs([doc, ...docs]);
    } catch (e: any) {
      setError(e.message ?? 'Oluşturma hatası');
    } finally {
      setCreating(false);
    }
  };

  const kindLabel = documentKind === 'muvafakatname' ? 'Mutabakat / Muvafakat Formu' : 'Matbu Evrak';
  const previewToken = activeDoc?.publicToken;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!activeDoc && !readonly && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">Henüz {kindLabel.toLowerCase()} oluşturulmamış.</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'Oluşturuluyor…' : `${kindLabel} Oluştur`}
          </button>
        </div>
      )}

      {activeDoc && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{kindLabel}</span>
            </div>
            {statusBadge(activeDoc.status)}
          </div>

          <div className="px-4 py-3">
            <TimelineRow
              done={!!activeDoc.digitallyApprovedAt}
              label="Dijital onay"
              detail={activeDoc.digitallyApprovedAt
                ? `${activeDoc.approvedFullName ?? ''} · ${new Date(activeDoc.digitallyApprovedAt).toLocaleString('tr-TR')}`
                : 'Sigortalı linkten onay verince tamamlanır'}
            />
          </div>

          {!readonly && (
            <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              {!activeDoc.digitallyApprovedAt && (
                <button
                  onClick={() => setWaModal(activeDoc)}
                  className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  WhatsApp
                </button>
              )}

              {previewToken && (
                <>
                  <a
                    href={`/evrak/${previewToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Önizle
                  </a>
                  <a
                    href={`/evrak/${previewToken}?print=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Çıktı Al
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {waModal && (
        <WhatsAppModal
          doc={waModal}
          onClose={() => setWaModal(null)}
          onSent={() => { setWaModal(null); load(); }}
        />
      )}
    </div>
  );
}

function TimelineRow({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
          done ? 'bg-green-500' : 'bg-gray-200'
        }`}
      >
        {done ? (
          <CheckIcon className="w-2.5 h-2.5 text-white" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-500'}`}>
          {label}
        </p>
        <p className="text-xs text-gray-400">{detail}</p>
      </div>
    </div>
  );
}
