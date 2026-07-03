'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { API, authHeader } from '@/utils/api';
import { InboxMatchCandidates } from '@/components/operation-inbox/InboxMatchCandidates';
import { InboxQuickActions } from '@/components/operation-inbox/InboxQuickActions';
import {
  buildSummaryFields,
  decodeEmailText,
  parseInboundEmailContent,
} from '@/utils/inbound-email-content-parser';
import { toTitleCaseTR } from '@/utils/text-helpers';

type InboundMailbox = 'IHBAR' | 'HASAR';
type InboundMessageStatus = 'NEW' | 'CLASSIFYING' | 'CLASSIFIED' | 'ACTIONED' | 'ARCHIVED' | 'ERROR';
type InboundClassification =
  | 'HASAR_IHBAR'
  | 'ACIL_YARDIM'
  | 'BELGE_TALEP'
  | 'FATURA_ODEME'
  | 'GENEL'
  | 'SPAM'
  | 'UNKNOWN';

interface InboundAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey?: string | null;
}

interface InboundMessageDetail {
  id: string;
  mailbox: InboundMailbox;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  status: InboundMessageStatus;
  classification: InboundClassification | null;
  confidence: number | null;
  aiSummary: string | null;
  suggestedAction: string | null;
  bodyPreview: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: InboundAttachment[];
  claimFile?: { id: string; fileNo: string } | null;
  emergencyCase?: { id: string; caseNo: string } | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
}

interface RoutingSuggestion {
  customerMatch: {
    status: 'found' | 'ambiguous' | 'not_found';
    customer?: { id: string; name: string };
    candidates?: Array<{ id: string; name: string }>;
  };
}

export interface InboxDetailActions {
  onOpenClaim: (messageId: string, subject: string, prefillCustomer?: boolean) => void;
  onOpenEmergency: (messageId: string, subject: string) => void;
  onLinkFile: (messageId: string, mailbox: InboundMailbox, initialSearch: string) => void;
  onReply: (messageId: string, subject: string) => void;
  onAssign: (messageId: string, assignee?: { id: string; firstName: string; lastName: string } | null) => void;
  onArchive: (messageId: string, subject: string) => void;
}

interface InboxDetailModalProps {
  open: boolean;
  messageId: string | null;
  onClose: () => void;
  onLinkClaim?: (messageId: string, claimFileId: string, fileNo: string) => void;
  onLinkEmergency?: (messageId: string, emergencyCaseId: string, fileNo: string) => void;
  linking?: boolean;
  actions?: InboxDetailActions;
}

const MAILBOX_LABELS: Record<InboundMailbox, string> = {
  IHBAR: 'İhbar',
  HASAR: 'Hasar',
};

const STATUS_LABELS: Record<InboundMessageStatus, string> = {
  NEW: 'Yeni',
  CLASSIFYING: 'Sınıflandırılıyor',
  CLASSIFIED: 'Sınıflandırıldı',
  ACTIONED: 'İşlendi',
  ARCHIVED: 'Arşiv',
  ERROR: 'Hata',
};

const SUGGESTED_ACTION_LABELS: Record<string, string> = {
  LINK_EXISTING: 'Mevcut Dosyaya Bağla',
  OPEN_HASAR_FILE: 'Hasar Dosyası Aç',
  OPEN_ACIL_FILE: 'Acil Dosya Aç',
  REPLY_ONLY: 'Yalnızca Yanıtla',
  ARCHIVE: 'Arşivle',
};

const CLASSIFICATION_LABELS: Record<InboundClassification, string> = {
  HASAR_IHBAR: 'Hasar İhbar',
  ACIL_YARDIM: 'Acil Yardım',
  BELGE_TALEP: 'Belge Talep',
  FATURA_ODEME: 'Fatura Ödeme',
  GENEL: 'Genel',
  SPAM: 'Spam',
  UNKNOWN: 'Bilinmiyor',
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function openAttachment(storageKey: string) {
  const res = await axios.get(`${API}/uploads/signed-url`, {
    headers: authHeader(),
    params: { storageKey },
  });
  const url = res.data?.data?.url;
  if (url) window.open(url, '_blank');
}

export function InboxDetailModal({
  open,
  messageId,
  onClose,
  onLinkClaim,
  onLinkEmergency,
  linking = false,
  actions,
}: InboxDetailModalProps) {
  const [detail, setDetail] = useState<InboundMessageDetail | null>(null);
  const [routing, setRouting] = useState<RoutingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRawBody, setShowRawBody] = useState(false);

  const load = useCallback(async () => {
    if (!messageId) return;
    setLoading(true);
    setError('');
    try {
      const [res, routingRes] = await Promise.all([
        apiClient.get<InboundMessageDetail>(`/operation-inbox/messages/${messageId}`),
        apiClient.get<RoutingSuggestion>(`/operation-inbox/messages/${messageId}/routing-suggestion`).catch(() => null),
      ]);
      setDetail(res);
      setRouting(routingRes);
    } catch {
      setError('Mesaj detayı yüklenemedi.');
      setDetail(null);
      setRouting(null);
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    if (open && messageId) {
      void load();
    } else {
      setDetail(null);
      setRouting(null);
      setError('');
      setShowRawBody(false);
    }
  }, [open, messageId, load]);

  const parsed = useMemo(() => {
    if (!detail) return null;
    return parseInboundEmailContent({
      subject: detail.subject,
      bodyText: detail.bodyText,
      bodyHtml: detail.bodyHtml,
      bodyPreview: detail.bodyPreview,
      fromAddress: detail.fromAddress,
    });
  }, [detail]);

  const summaryFields = useMemo(
    () => (parsed ? buildSummaryFields(parsed) : []),
    [parsed],
  );

  const rawBody = useMemo(() => {
    if (!detail) return '';
    if (detail.bodyText?.trim()) return decodeEmailText(detail.bodyText);
    if (detail.bodyHtml?.trim()) return decodeEmailText(detail.bodyHtml);
    return detail.bodyPreview?.trim() ?? '';
  }, [detail]);

  if (!open || !messageId) return null;

  const showCandidates =
    detail &&
    !detail.claimFile &&
    !detail.emergencyCase &&
    detail.status !== 'ACTIONED' &&
    detail.status !== 'ARCHIVED' &&
    (detail.suggestedAction === 'LINK_EXISTING' || detail.status === 'NEW' || detail.status === 'CLASSIFIED');

  const linkSearch = parsed?.claimNo?.replace(/^RCS-/i, '')
    ?? parsed?.fileNo
    ?? parsed?.customerName
    ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!loading) onClose(); }}
      />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">E-posta Detayı</h3>
            {detail && (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2" title={detail.subject}>
                {detail.subject}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {loading && (
            <p className="text-sm text-slate-400 animate-pulse py-8 text-center">Yükleniyor…</p>
          )}

          {error && (
            <p className="text-sm text-red-600 py-4 text-center">{error}</p>
          )}

          {detail && parsed && !loading && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge badge-blue">{MAILBOX_LABELS[detail.mailbox]}</span>
                <span className="badge badge-gray">{STATUS_LABELS[detail.status]}</span>
                {detail.classification && (
                  <span className="badge badge-purple">
                    {CLASSIFICATION_LABELS[detail.classification]}
                    {detail.confidence != null && (
                      <span className="ml-1 opacity-75">
                        {Math.round(detail.confidence * 100)}%
                      </span>
                    )}
                  </span>
                )}
                {detail.suggestedAction && (
                  <span className="badge badge-amber">
                    {SUGGESTED_ACTION_LABELS[detail.suggestedAction] ?? detail.suggestedAction}
                  </span>
                )}
              </div>

              {actions && (
                <InboxQuickActions
                  messageId={detail.id}
                  mailbox={detail.mailbox}
                  subject={detail.subject}
                  status={detail.status}
                  fromName={detail.fromName}
                  fromAddress={detail.fromAddress}
                  suggestedAction={detail.suggestedAction}
                  linkedClaimId={detail.claimFile?.id}
                  linkedEmergencyId={detail.emergencyCase?.id}
                  parsed={parsed}
                  customerMatch={routing?.customerMatch ?? null}
                  onOpenClaim={() => actions.onOpenClaim(detail.id, detail.subject)}
                  onOpenEmergency={() => actions.onOpenEmergency(detail.id, detail.subject)}
                  onLinkFile={() => actions.onLinkFile(detail.id, detail.mailbox, linkSearch)}
                  onReply={() => actions.onReply(detail.id, detail.subject)}
                  onAssign={() => actions.onAssign(detail.id, detail.assignedUser ?? null)}
                  onArchive={() => actions.onArchive(detail.id, detail.subject)}
                  onOpenClaimWithCustomer={() => actions.onOpenClaim(detail.id, detail.subject, true)}
                />
              )}

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Gönderen</dt>
                  <dd className="text-slate-800 mt-0.5">
                    {detail.fromName ? `${detail.fromName} · ${detail.fromAddress}` : detail.fromAddress}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Alınma</dt>
                  <dd className="text-slate-800 mt-0.5">{fmtDateTime(detail.receivedAt)}</dd>
                </div>
                {detail.assignedUser && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Atanan</dt>
                    <dd className="text-slate-800 mt-0.5">
                      {detail.assignedUser.firstName} {detail.assignedUser.lastName}
                    </dd>
                  </div>
                )}
              </dl>

              {detail.aiSummary && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                  <p className="text-xs font-medium text-blue-800 mb-1">AI Özeti</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.aiSummary}</p>
                </div>
              )}

              {(detail.claimFile || detail.emergencyCase) && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
                  <p className="text-xs font-medium text-emerald-800 mb-1.5">Bağlı Dosya</p>
                  <div className="flex flex-wrap gap-3">
                    {detail.claimFile && (
                      <Link
                        href={`/panel/hasar-dosyalari/${detail.claimFile.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        target="_blank"
                      >
                        Hasar Dosyası: {detail.claimFile.fileNo}
                      </Link>
                    )}
                    {detail.emergencyCase && (
                      <Link
                        href={`/panel/acil-yardim/${detail.emergencyCase.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        target="_blank"
                      >
                        Acil Dosya: {detail.emergencyCase.caseNo}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {summaryFields.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
                    <p className="text-xs font-medium text-slate-600">
                      {parsed.formTitle ? toTitleCaseTR(parsed.formTitle) : 'İhbar Özeti'}
                    </p>
                  </div>
                  <dl className="divide-y divide-slate-100">
                    {summaryFields.map((field) => (
                      <div key={field.label} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 px-3 py-2.5">
                        <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
                        <dd className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                          {field.label === 'Sigorta Ettiren' || field.label === 'Adres' || field.label === 'Açıklama'
                            ? toTitleCaseTR(field.value)
                            : field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {parsed.notes.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                  <p className="text-xs font-medium text-amber-800 mb-1">Not</p>
                  {parsed.notes.map((note) => (
                    <p key={note} className="text-sm text-slate-700 whitespace-pre-wrap">{note}</p>
                  ))}
                </div>
              )}

              {rawBody && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowRawBody((v) => !v)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 mb-1.5"
                  >
                    {showRawBody ? 'Ham Metni Gizle' : 'Ham Metni Göster'}
                  </button>
                  {showRawBody && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {rawBody}
                    </div>
                  )}
                </div>
              )}

              {detail.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Ekler</p>
                  <ul className="space-y-1.5">
                    {detail.attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">{att.fileName}</p>
                          <p className="text-[11px] text-slate-400">{formatBytes(att.sizeBytes)}</p>
                        </div>
                        {att.storageKey && (
                          <button
                            type="button"
                            onClick={() => void openAttachment(att.storageKey!)}
                            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Aç
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showCandidates && onLinkClaim && onLinkEmergency && (
                <InboxMatchCandidates
                  messageId={detail.id}
                  linking={linking}
                  onLinkClaim={(claimFileId, fileNo) => onLinkClaim(detail.id, claimFileId, fileNo)}
                  onLinkEmergency={(emergencyCaseId, fileNo) => onLinkEmergency(detail.id, emergencyCaseId, fileNo)}
                />
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
