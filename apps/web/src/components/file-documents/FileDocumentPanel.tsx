'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileDocument,
  FileDocumentKind,
  createFileDocument,
  getFileDocuments,
  sendWhatsapp,
  uploadPhysicalDocument,
} from '@/utils/fileDocumentApi';

// ── İcon helpers ────────────────────────────────────────────────────────────

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
    digitally_approved: { label: 'Dijital Onaylı', color: 'bg-emerald-100 text-emerald-700' },
    physically_uploaded: { label: 'Fiziki Yüklendi', color: 'bg-green-100 text-green-700' },
  };
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  entityType: 'claim_file' | 'emergency_case';
  entityId: string;
  documentKind: FileDocumentKind;
  /** Kapama koşulları tamamlandığında çağrılır */
  onConditionsMet?: () => void;
  /** Sadece görüntüleme modu */
  readonly?: boolean;
}

// ── WhatsApp Modal ───────────────────────────────────────────────────────────

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
              WhatsApp'ta Aç
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

// ── Physical Upload Modal ────────────────────────────────────────────────────

function PhysicalUploadModal({
  doc,
  onClose,
  onUploaded,
}: {
  doc: FileDocument;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await uploadPhysicalDocument(doc.id, file);
      onUploaded();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Yükleme başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Fiziki Aslı Yükle</h3>
        <p className="text-sm text-gray-500 mb-4">Muvafakname fiziki aslının taranmış halini yükleyin.</p>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4 cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {file ? (
            <p className="text-sm text-gray-700 font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Dosya seçmek için tıklayın</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 10 MB)</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
            İptal
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? 'Yükleniyor…' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

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
  const [uploadModal, setUploadModal] = useState<FileDocument | null>(null);

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
    const isMuvafakatname = documentKind === 'muvafakatname';
    const complete = isMuvafakatname
      ? activeDoc.status === 'physically_uploaded'
      : activeDoc.status === 'digitally_approved';
    if (complete) onConditionsMet?.();
  }, [activeDoc?.status]);

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

  const kindLabel = documentKind === 'muvafakatname' ? 'Muvafakatname' : 'Matbu Evrak';

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

      {/* Evrak yok — oluştur */}
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

      {/* Aktif evrak */}
      {activeDoc && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Evrak başlık */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{kindLabel}</span>
            </div>
            {statusBadge(activeDoc.status)}
          </div>

          {/* Timeline */}
          <div className="px-4 py-3 space-y-2">
            <TimelineRow
              done={!!activeDoc.digitallyApprovedAt}
              label="Dijital onay"
              detail={activeDoc.digitallyApprovedAt
                ? `${activeDoc.approvedFullName ?? ''} · ${new Date(activeDoc.digitallyApprovedAt).toLocaleString('tr-TR')}`
                : 'Bekleniyor'}
            />
            {documentKind === 'muvafakatname' && (
              <TimelineRow
                done={!!activeDoc.physicalUploadKey}
                label="Fiziki aslı yüklendi"
                detail={activeDoc.physicalUploadedAt
                  ? new Date(activeDoc.physicalUploadedAt).toLocaleString('tr-TR')
                  : 'Bekleniyor'}
              />
            )}
          </div>

          {/* Aksiyonlar */}
          {!readonly && (
            <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              {/* WhatsApp */}
              {!activeDoc.digitallyApprovedAt && (
                <button
                  onClick={() => setWaModal(activeDoc)}
                  className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M11.999 0C5.373 0 0 5.373 0 12c0 2.117.549 4.103 1.508 5.832L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.626 0 12 0zm.001 21.818a9.817 9.817 0 01-5.006-1.369l-.36-.214-3.728.972.998-3.648-.235-.374A9.817 9.817 0 012.182 12c0-5.418 4.4-9.818 9.818-9.818 5.417 0 9.818 4.4 9.818 9.818 0 5.417-4.401 9.818-9.818 9.818z"/>
                  </svg>
                  WhatsApp
                </button>
              )}

              {/* Önizleme */}
              {activeDoc.id && (
                <a
                  href={`/evrak/${activeDoc.publicToken ?? ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Önizle
                </a>
              )}

              {/* Fiziki yükleme (yalnızca muvafakatname) */}
              {documentKind === 'muvafakatname' && activeDoc.digitallyApprovedAt && !activeDoc.physicalUploadKey && (
                <button
                  onClick={() => setUploadModal(activeDoc)}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  Fiziki Aslı Yükle
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {waModal && (
        <WhatsAppModal
          doc={waModal}
          onClose={() => setWaModal(null)}
          onSent={() => { setWaModal(null); load(); }}
        />
      )}
      {uploadModal && (
        <PhysicalUploadModal
          doc={uploadModal}
          onClose={() => setUploadModal(null)}
          onUploaded={load}
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
