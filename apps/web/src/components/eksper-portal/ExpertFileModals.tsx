'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { ExpertOperationHistory } from '@/components/eksper-portal/ExpertOperationHistory';
import { fmtDate } from '@/utils/date-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;
const UPLOADS_ORIGIN = API.replace(/\/api\/v1$/, '');

function authHeaders() {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type ExpertEditableFile = {
  id: string;
  fileNo: string;
  lossType?: string | null;
  description?: string | null;
  incidentDate?: string | null;
  insuranceCompany?: { id?: string; name?: string } | null;
  updatedAt?: string;
};

type EditModalProps = {
  open: boolean;
  file: ExpertEditableFile | null;
  onClose: () => void;
  onSaved: (patch: Partial<ExpertEditableFile> & { id: string }) => void;
};

export function ExpertFileEditModal({ open, file, onClose, onSaved }: EditModalProps) {
  const [lossType, setLossType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    setLossType(file.lossType ?? '');
    setCompanyName(file.insuranceCompany?.name ?? '');
    setDescription(file.description ?? '');
    setIncidentDate(file.incidentDate ? file.incidentDate.slice(0, 10) : '');
    setError(null);
  }, [open, file]);

  if (!open || !file) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        lossType: lossType.trim() || undefined,
        description: toTitleCaseTR(description.trim()) || undefined,
        incidentDate: incidentDate || undefined,
      };
      if (file.updatedAt) body.expectedUpdatedAt = file.updatedAt;
      const res = await fetch(`${API}/claim-files/${file.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Kayıt başarısız (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      const data = json?.data ?? json;
      onSaved({
        id: file.id,
        lossType: data?.lossType ?? lossType,
        description: data?.description ?? description,
        incidentDate: data?.incidentDate ?? incidentDate,
        updatedAt: data?.updatedAt,
        insuranceCompany: file.insuranceCompany,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Dosya Düzenle" onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-3 px-5 py-4">
        <label className="block text-xs font-medium text-slate-600">
          Dosya Konusu
          <input
            value={lossType}
            onChange={(e) => setLossType(e.target.value)}
            onBlur={(e) => setLossType(toTitleCaseTR(e.target.value.trim()))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Sigorta Şirketi
          <input
            value={companyName}
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            title="Sigorta şirketi bu ekrandan değiştirilmez"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Tarih
          <input
            type="date"
            value={incidentDate}
            onChange={(e) => setIncidentDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Açıklama
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => setDescription(toTitleCaseTR(e.target.value.trim()))}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </ModalShell>
  );
}

type DocsModalProps = {
  open: boolean;
  claimFileId: string | null;
  onClose: () => void;
};

type DocItem = {
  id: string;
  fileName?: string;
  documentType?: string;
  createdAt?: string;
  fileAsset?: { storageKey?: string };
  storageKey?: string;
};

export function ExpertFileDocumentsModal({ open, claimFileId, onClose }: DocsModalProps) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !claimFileId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/documents?claimFileId=${encodeURIComponent(claimFileId)}&limit=50`, {
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((body) => setDocs(body?.data ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, claimFileId]);

  if (!open) return null;

  const openAsset = async (doc: DocItem, download: boolean) => {
    const storageKey = doc.fileAsset?.storageKey ?? doc.storageKey;
    if (!storageKey) return;
    try {
      const res = await fetch(
        `${API}/uploads/signed-url?storageKey=${encodeURIComponent(storageKey)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error('Dosya açılamadı');
      const body = await res.json();
      const url = body?.data?.url ?? body?.url;
      if (!url) throw new Error('Bağlantı yok');
      const abs = String(url).startsWith('http') ? url : `${UPLOADS_ORIGIN}${url}`;
      if (download) {
        const a = document.createElement('a');
        a.href = abs;
        a.download = doc.fileName ?? 'belge';
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
      } else {
        window.open(abs, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError('Belge açılamadı.');
    }
  };

  return (
    <ModalShell title="Evraklar" onClose={onClose} widthClass="max-w-2xl">
      <div className="px-5 py-4">
        {loading && <p className="text-sm text-slate-400">Yükleniyor…</p>}
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {!loading && docs.length === 0 && <p className="text-sm text-slate-400">Belge bulunmuyor.</p>}
        {docs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Belge</th>
                  <th className="px-3 py-2 text-left font-semibold">Tür</th>
                  <th className="px-3 py-2 text-left font-semibold">Tarih</th>
                  <th className="px-3 py-2 text-right font-semibold">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{d.fileName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.documentType ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.createdAt ? fmtDate(d.createdAt) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                          title="Görüntüle"
                          aria-label="Görüntüle"
                          onClick={() => void openAsset(d, false)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                          title="İndir"
                          aria-label="İndir"
                          onClick={() => void openAsset(d, true)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Kapat
        </button>
      </div>
    </ModalShell>
  );
}

type NoteModalProps = {
  open: boolean;
  claimFileId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ExpertFileNoteModal({ open, claimFileId, onClose, onSaved }: NoteModalProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setContent('');
      setError(null);
    }
  }, [open]);

  if (!open || !claimFileId) return null;

  const save = async () => {
    const text = toTitleCaseTR(content.trim());
    if (!text) {
      setError('Not metni zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/claim-files/${claimFileId}/notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: text, noteType: 'general' }),
      });
      if (!res.ok) {
        const fallback = await fetch(`${API}/notes`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ claimFileId, content: text, noteType: 'general' }),
        });
        if (!fallback.ok) throw new Error('Not kaydedilemedi.');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Not Ekle" onClose={onClose} widthClass="max-w-md">
      <div className="space-y-3 px-5 py-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Notunuzu yazın…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          İptal
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </ModalShell>
  );
}

type HistoryModalProps = {
  open: boolean;
  claimFileId: string | null;
  fileCreatedAt?: string;
  statusCode?: string;
  statusName?: string;
  onClose: () => void;
};

/** Geçmiş — timeline görünümü (drawer/modal kabuğu değil; tam genişlik overlay timeline) */
export function ExpertFileHistoryOverlay({
  open,
  claimFileId,
  fileCreatedAt,
  onClose,
}: HistoryModalProps) {
  if (!open || !claimFileId) return null;
  return (
    <div className="fixed inset-0 z-[220] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:w-[480px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Operasyon Geçmişi"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">Operasyon Geçmişi</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ExpertOperationHistory claimFileId={claimFileId} fileCreatedAt={fileCreatedAt} />
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  widthClass = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={`w-full ${widthClass} overflow-hidden rounded-2xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
