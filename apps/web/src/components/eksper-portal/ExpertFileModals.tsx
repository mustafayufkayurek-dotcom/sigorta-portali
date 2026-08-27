'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Printer, X } from 'lucide-react';
import { ExpertOperationHistory } from '@/components/eksper-portal/ExpertOperationHistory';
import { fmtDate } from '@/utils/date-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';
import {
  claimManualDocumentLabel,
  getFileDocuments,
  openFileDocumentView,
  type FileDocument,
} from '@/utils/fileDocumentApi';

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
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
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
  /** true ise yükleme alanı gösterilir (document.upload yetkisi olan roller) */
  allowUpload?: boolean;
  onUploaded?: () => void;
};

type DocItem = {
  id: string;
  fileName?: string;
  documentType?: string;
  createdAt?: string;
  fileAsset?: { storageKey?: string };
  storageKey?: string;
  fileDocumentId?: string;
  canPreview?: boolean;
};

function mapFileDocument(row: FileDocument): DocItem {
  const kindLabel = claimManualDocumentLabel(row);
  return {
    id: `fd-${row.id}`,
    fileDocumentId: row.id,
    fileName: row.approvedFullName ? `${kindLabel} — ${row.approvedFullName}` : kindLabel,
    documentType: kindLabel,
    createdAt: row.createdAt,
    storageKey: row.physicalUploadKey ?? undefined,
    canPreview: row.canPreview !== false,
  };
}

export function ExpertFileDocumentsModal({
  open,
  claimFileId,
  onClose,
  allowUpload = false,
  onUploaded,
}: DocsModalProps) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reload = async (id: string) => {
    const [legacyRes, fileDocs] = await Promise.all([
      fetch(`${API}/documents?claimFileId=${encodeURIComponent(id)}&limit=50`, {
        headers: authHeaders(),
      }),
      getFileDocuments('claim_file', id).catch(() => [] as FileDocument[]),
    ]);

    const legacyJson = legacyRes.ok ? await legacyRes.json().catch(() => null) : null;
    const legacyDocs: DocItem[] = Array.isArray(legacyJson?.data) ? legacyJson.data : [];
    const mappedFileDocs = (Array.isArray(fileDocs) ? fileDocs : []).map(mapFileDocument);

    const merged = [...legacyDocs, ...mappedFileDocs];
    const seen = new Set<string>();
    return merged.filter((d) => {
      const key = `${d.fileName ?? ''}|${d.storageKey ?? d.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  useEffect(() => {
    if (!open || !claimFileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const unique = await reload(claimFileId);
        if (!cancelled) setDocs(unique);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Evraklar yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, claimFileId]);

  if (!open) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !claimFileId) return;
    setUploading(true);
    setError(null);
    try {
      const ext = `.${(file.name.split('.').pop() || 'bin').toLowerCase()}`;
      const presignRes = await fetch(`${API}/uploads/presign`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          ownerType: 'claim_file',
          ownerId: claimFileId,
        }),
      });
      if (!presignRes.ok) throw new Error('Yükleme hazırlığı başarısız.');
      const presignBody = await presignRes.json();
      const { presignedUrl, storageKey } = presignBody?.data ?? {};
      if (!presignedUrl || !storageKey) throw new Error('Yükleme adresi alınamadı.');

      if (String(presignedUrl).includes('localhost')) {
        const fd = new FormData();
        fd.append('file', file);
        const putRes = await fetch(`${API}/uploads/${storageKey}`, {
          method: 'POST',
          headers: { Authorization: authHeaders().Authorization ?? '' },
          body: fd,
        });
        if (!putRes.ok) throw new Error('Dosya yüklenemedi.');
      } else {
        const putRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) throw new Error('Dosya yüklenemedi.');
      }

      const createRes = await fetch(`${API}/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          claimFileId,
          fileName: file.name,
          fileExtension: ext,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          storageKey,
          documentType: null,
          category: 'document',
        }),
      });
      if (!createRes.ok) throw new Error('Evrak kaydı oluşturulamadı.');

      const unique = await reload(claimFileId);
      setDocs(unique);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openAsset = async (doc: DocItem, download: boolean) => {
    if (doc.fileDocumentId) {
      try {
        await openFileDocumentView(doc.fileDocumentId, { print: download });
      } catch {
        setError('Belge açılamadı.');
      }
      return;
    }
    const storageKey = doc.fileAsset?.storageKey ?? doc.storageKey;
    if (!storageKey) {
      setError('Bu belgenin dosya bağlantısı bulunamadı.');
      return;
    }
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
      <div className="space-y-3 px-5 py-4">
        {error && <p className="text-xs text-status-danger">{error}</p>}
        {allowUpload ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-xs text-slate-600">Dosyaya evrak ekleyin (PDF, görsel…).</p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => void handleUpload(e)}
              />
              <button
                type="button"
                disabled={uploading || !claimFileId}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {uploading ? 'Yükleniyor…' : 'Evrak Yükle'}
              </button>
            </div>
          </div>
        ) : null}
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
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                    Yükleniyor…
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center">
                    <p className="text-sm font-medium text-slate-600">Henüz Evrak Yok</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {allowUpload
                        ? 'Yukarıdaki düğme ile evrak ekleyebilirsiniz.'
                        : 'Yüklenen belgeler burada listelenir. Görüntüle ve indir işlemleri hazırdır.'}
                    </p>
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
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
                        {d.fileDocumentId ? (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            title="Yazdır"
                            aria-label="Yazdır"
                            onClick={() => void openAsset(d, true)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            title="İndir"
                            aria-label="İndir"
                            onClick={() => void openAsset(d, true)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Kapat
        </button>
      </div>
    </ModalShell>
  );
}

type ReportPreviewProps = {
  open: boolean;
  claimFileId: string | null;
  fileNo?: string;
  onClose: () => void;
};

type RepairReportRow = {
  id: string;
  reportNo?: string | null;
  status?: string | null;
  reportDate?: string | null;
  createdAt?: string;
};

export function ExpertFileReportPreviewModal({ open, claimFileId, fileNo, onClose }: ReportPreviewProps) {
  const [reports, setReports] = useState<RepairReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !claimFileId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/claim-files/${claimFileId}/repair-reports`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error('Raporlar yüklenemedi.');
        const body = await r.json();
        const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setReports(list);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, claimFileId]);

  if (!open) return null;

  const openPdf = async (reportId: string) => {
    setBusyId(reportId);
    setError(null);
    try {
      const res = await fetch(`${API}/repair-reports/${reportId}/pdf?view=external`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Rapor önizlemesi açılamadı.');
      const blob = await res.blob();
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('json') || contentType.includes('text/')) {
        throw new Error('Rapor PDF olarak hazır değil.');
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rapor önizlemesi açılamadı.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalShell title="Rapor Önizleme" onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-3 px-5 py-4">
        {fileNo ? <p className="text-xs text-slate-500">Dosya: {fileNo}</p> : null}
        {error ? <p className="text-xs text-status-danger">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">Henüz Rapor Yok</p>
            <p className="mt-1 text-xs text-slate-500">Rapor oluşunca bu pencereden önizleme açılır.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{r.reportNo ?? 'Rapor'}</p>
                  <p className="text-xs text-slate-500">
                    {r.status ?? '—'}
                    {r.reportDate || r.createdAt ? ` · ${fmtDate(r.reportDate ?? r.createdAt)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void openPdf(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {busyId === r.id ? 'Açılıyor…' : 'Önizle'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Kapat
        </button>
      </div>
    </ModalShell>
  );
}

type DeleteRequestProps = {
  open: boolean;
  claimFileId: string | null;
  fileNo?: string;
  onClose: () => void;
  onDone: (message: string) => void;
};

/**
 * Eksper bağımsız silme yapamaz.
 * Onay → admin bildirimi + "Talebiniz iletildi"
 * Vazgeç → admin bildirimi (iptal)
 */
export function ExpertFileDeleteRequestModal({
  open,
  claimFileId,
  fileNo,
  onClose,
  onDone,
}: DeleteRequestProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!open || !claimFileId) return null;

  const submit = async (outcome: 'requested' | 'cancelled') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/claim-files/${claimFileId}/delete-request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ outcome }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        throw new Error(body?.message || 'Talep iletilemedi.');
      }
      if (outcome === 'requested') {
        onDone('Talebiniz sistem yöneticisine iletildi.');
      } else {
        onDone('Silme talebinden vazgeçildi. Sistem yöneticisine bildirildi.');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Talep iletilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Silme Talebi" onClose={onClose} widthClass="max-w-md">
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-slate-700">
          Eksper olarak dosyayı doğrudan silemezsiniz. Silme talebi sistem yöneticisine iletilir.
        </p>
        {fileNo ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">Dosya: {fileNo}</p>
        ) : null}
        <p className="text-sm text-slate-600">Onaylıyor musunuz?</p>
        {error ? <p className="text-xs text-status-danger">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('cancelled')}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('requested')}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'İletiliyor…' : 'Onayla Ve İlet'}
        </button>
      </div>
    </ModalShell>
  );
}

type NoteKind = 'general' | 'manager_instruction';

type NoteModalProps = {
  open: boolean;
  claimFileId: string | null;
  /** Liste satırından hemen gösterim — yoksa dosyadan yüklenir */
  fileNo?: string | null;
  insuredName?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

type NoteContext = {
  fileNo: string | null;
  insuredName: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
};

const NOTE_TEMPLATES = ['Evrak Eksik', 'Revizyon Gerekli', 'Onay Notu', 'Bilgi Notu'] as const;

/**
 * Ortak dosya notu — eksper / sigorta / asistans aynı kültür.
 * E-posta gönderimi tercihe bağlıdır (varsayılan kapalı).
 */
export function ExpertFileNoteModal({
  open,
  claimFileId,
  fileNo: fileNoProp,
  insuredName: insuredNameProp,
  onClose,
  onSaved,
}: NoteModalProps) {
  const [content, setContent] = useState('');
  const [noteKind, setNoteKind] = useState<NoteKind>('general');
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<NoteContext>({
    fileNo: null,
    insuredName: null,
    responsibleName: null,
    responsibleEmail: null,
  });
  const [ctxLoading, setCtxLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContent('');
    setNoteKind('general');
    setSendEmail(false);
    setError(null);
    setCtx({
      fileNo: fileNoProp?.trim() || null,
      insuredName: insuredNameProp?.trim() || null,
      responsibleName: null,
      responsibleEmail: null,
    });
  }, [open, claimFileId, fileNoProp, insuredNameProp]);

  useEffect(() => {
    if (!open || !claimFileId) return;
    let cancelled = false;
    setCtxLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${API}/claim-files/${claimFileId}`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const data = (json?.data ?? json) as Record<string, unknown>;
        const office = data.assignedOfficeUser as
          | { firstName?: string; lastName?: string; email?: string }
          | null
          | undefined;
        const name = [office?.firstName, office?.lastName].filter(Boolean).join(' ').trim();
        const insured =
          (typeof data.insuredName === 'string' && data.insuredName.trim()) ||
          (typeof (data.insured as { fullName?: string } | null)?.fullName === 'string'
            ? String((data.insured as { fullName?: string }).fullName)
            : null);
        if (cancelled) return;
        setCtx((prev) => ({
          fileNo: prev.fileNo || (typeof data.fileNo === 'string' ? data.fileNo : null),
          insuredName: prev.insuredName || (insured ? toTitleCaseTR(insured) : null),
          responsibleName: name || null,
          responsibleEmail: office?.email?.trim() || null,
        }));
      } catch {
        /* bağlam yoksa form yine çalışır */
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, claimFileId]);

  if (!open || !claimFileId) return null;

  const applyTemplate = (label: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `${label}: `;
      if (trimmed.toLocaleLowerCase('tr').includes(label.toLocaleLowerCase('tr'))) return prev;
      return `${trimmed}\n${label}: `;
    });
  };

  const save = async () => {
    const text = toTitleCaseTR(content.trim());
    if (!text) {
      setError('Not metni zorunludur.');
      return;
    }
    if (sendEmail && !ctx.responsibleEmail) {
      setError('Dosya sorumlusunun kayıtlı e-posta adresi bulunamadı. Notu kaydetmek için e-posta seçeneğini kapatın.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/claim-files/${claimFileId}/notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: text, noteType: noteKind }),
      });
      if (!res.ok) {
        const fallback = await fetch(`${API}/notes`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ claimFileId, content: text, noteType: noteKind }),
        });
        if (!fallback.ok) throw new Error('Not kaydedilemedi.');
      }

      if (sendEmail) {
        const mailRes = await fetch(`${API}/claim-files/${claimFileId}/responsible-email`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ message: text }),
        });
        const body = await mailRes.json().catch(() => ({}));
        if (!mailRes.ok || body?.success === false) {
          throw new Error(
            body?.message || body?.data?.errorMsg || 'Not kaydedildi; e-posta gönderilemedi.',
          );
        }
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const contextLine = [
    ctx.fileNo ? `Dosya No: ${ctx.fileNo}` : null,
    ctx.insuredName ? `Sigortalı: ${ctx.insuredName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ModalShell title="Dosya Notu" onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-4 px-5 py-4">
        {(contextLine || ctxLoading) && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Dosya</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800">
              {ctxLoading && !contextLine ? 'Dosya bilgisi yükleniyor…' : contextLine || '—'}
            </p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Kayıt Türü</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'general' as const, label: 'Dosya Notu', hint: 'Dosya kaydına yazılır' },
                { id: 'manager_instruction' as const, label: 'Talimat', hint: 'Öncelikli yönlendirme' },
              ] as const
            ).map((opt) => {
              const active = noteKind === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNoteKind(opt.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className={`block text-sm font-semibold ${active ? 'text-brand-800' : 'text-slate-800'}`}>
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="expert-file-note-content">
            Not
          </label>
          <textarea
            id="expert-file-note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v) setContent(v);
            }}
            rows={5}
            placeholder="Notunuzu Yazın…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NOTE_TEMPLATES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => applyTemplate(label)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">Dosya Sorumlusuna E-posta Gönder</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                İsteğe bağlıdır. İşaretlemezseniz not yalnızca dosyaya kaydedilir.
              </span>
            </span>
          </label>
          {sendEmail && (
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              {ctxLoading ? (
                <p>Alıcı bilgisi yükleniyor…</p>
              ) : ctx.responsibleName || ctx.responsibleEmail ? (
                <p>
                  <span className="font-medium text-slate-700">Alıcı:</span>{' '}
                  {[ctx.responsibleName, ctx.responsibleEmail].filter(Boolean).join(' · ')}
                </p>
              ) : (
                <p className="text-status-warning">
                  Dosya sorumlusu veya e-posta adresi bulunamadı. Notu kaydedebilirsiniz; e-posta gönderilemez.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Kaydediliyor…' : sendEmail ? 'Kaydet Ve Gönder' : 'Kaydet'}
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
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
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
