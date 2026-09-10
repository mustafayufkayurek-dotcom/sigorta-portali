'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, PencilLine, Send } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { openWhatsAppChat } from '@/utils/date-helpers';
import { prepareTrustedDocumentHtml } from '@/utils/sanitize-html';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import type { VendorContractCorrectionRequest } from '@sigorta/shared';

export type VendorContractPreviewTarget = {
  claimId?: string;
  emergencyCaseId?: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  repairReportId?: string | null;
  existingId?: string | null;
};

function contractWriteBody(target: VendorContractPreviewTarget) {
  if (target.emergencyCaseId) {
    return {
      emergencyCaseId: target.emergencyCaseId,
      vendorId: target.vendorId,
      kind: 'simple' as const,
    };
  }
  return {
    claimFileId: target.claimId,
    vendorId: target.vendorId,
    repairReportId: target.repairReportId || undefined,
  };
}

export function VendorContractPreviewModal({
  target,
  onClose,
  onDone,
}: {
  target: VendorContractPreviewTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const { isManagement } = usePanelAccess();
  const [html, setHtml] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [contractId, setContractId] = useState<string | null>(target.existingId ?? null);
  const [correction, setCorrection] = useState<VendorContractCorrectionRequest | null>(null);
  const [askFix, setAskFix] = useState(false);
  const [fixNote, setFixNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const run = async () => {
      if (target.existingId) {
        const r = await axios.get(`${API}/vendor-contracts/${target.existingId}`, { headers: authHeader() });
        const row = r.data.data;
        if (cancelled) return;
        setHtml(row.renderedContent ?? '');
        setSigned(row.status === 'vendor_signed');
        setContractId(row.id);
        setCorrection(row.correctionRequest ?? null);
        return;
      }
      const r = await axios.post(
        `${API}/vendor-contracts/preview`,
        contractWriteBody(target),
        { headers: authHeader() },
      );
      if (cancelled) return;
      setHtml(r.data.data.html ?? '');
      setSigned(false);
      setCorrection(null);
    };
    run().catch((e: unknown) => {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const message = Array.isArray(raw) ? raw.join(' · ') : raw;
      if (!cancelled) setError(message || 'Önizleme yüklenemedi.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const persistAndSend = async (sendWa: boolean) => {
    if (!html.trim()) {
      setError('Sözleşme metni boş olamaz.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let id = contractId;
      if (id) {
        if (isManagement && editing) {
          await axios.patch(
            `${API}/vendor-contracts/${id}/content`,
            { renderedContent: html },
            { headers: authHeader() },
          );
        }
      } else {
        const created = await axios.post(
          `${API}/vendor-contracts`,
          contractWriteBody(target),
          { headers: authHeader() },
        );
        id = created.data.data.id;
        setContractId(id);
      }
      if (sendWa) {
        if (!target.vendorPhone.trim()) {
          setError('Tedarikçi telefonu yok.');
          return;
        }
        const send = await axios.post(
          `${API}/vendor-contracts/${id}/send-whatsapp`,
          { phone: target.vendorPhone },
          { headers: authHeader() },
        );
        openWhatsAppChat(target.vendorPhone, send.data.data?.message ?? '');
      }
      onDone();
      if (sendWa) onClose();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Kayıt yapılamadı.');
    } finally {
      setSaving(false);
    }
  };

  const submitCorrection = async () => {
    if (!fixNote.trim()) {
      setError('Düzeltme gerekçesini yazın.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let id = contractId;
      if (!id) {
        const created = await axios.post(
          `${API}/vendor-contracts`,
          contractWriteBody(target),
          { headers: authHeader() },
        );
        id = created.data.data.id;
        setContractId(id);
      }
      const r = await axios.post(
        `${API}/vendor-contracts/${id}/correction-request`,
        { note: fixNote.trim() },
        { headers: authHeader() },
      );
      setCorrection(r.data.data.correctionRequest ?? null);
      setAskFix(false);
      setFixNote('');
      onDone();
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'İstek gönderilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const pendingFix = correction?.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-slate-500" />
            {target.emergencyCaseId ? 'Tedarikçi Hizmet Alım Sözleşmesi' : 'Tedarikçi sözleşmesi'}
          </p>
          <p className="text-[11px] text-slate-500">{target.vendorName} · Dosya sorumlusu görür; metni yönetici düzeltir</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Yükleniyor…</p>
          ) : (
            <>
              {pendingFix ? (
                <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Yöneticiye düzeltme istendi: {correction.note}
                </p>
              ) : null}
              <div
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: prepareTrustedDocumentHtml(html) }}
              />
              {signed ? (
                <p className="mt-3 text-[11px] font-medium text-emerald-800">İmzalandı. Metin değiştirilmez.</p>
              ) : isManagement && editing ? (
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Yönetici düzeltmesi</label>
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    rows={10}
                    placeholder="Sözleşme metnini buradan düzeltin"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : isManagement && !signed ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  Yönetici olarak düzelt
                </button>
              ) : !signed ? (
                <div className="mt-3">
                  {!askFix ? (
                    <button
                      type="button"
                      onClick={() => setAskFix(true)}
                      className="text-[11px] font-semibold text-brand-700 hover:underline"
                    >
                      Yöneticiden düzeltme iste
                    </button>
                  ) : (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Düzeltme gerekçesi</label>
                      <textarea
                        value={fixNote}
                        onChange={(e) => setFixNote(e.target.value)}
                        rows={3}
                        placeholder="Hangi satır yanlış, ne yazılsın?"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void submitCorrection()}
                        className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        İsteği gönder
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
          {error ? <p className="mt-2 text-[11px] text-status-danger">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">
            Kapat
          </button>
          {!signed && !loading ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void persistAndSend(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor…' : 'Dosyaya kaydet'}
              </button>
              <button
                type="button"
                disabled={saving || !target.vendorPhone.trim()}
                onClick={() => void persistAndSend(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Kaydet ve WhatsApp ile gönder
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
