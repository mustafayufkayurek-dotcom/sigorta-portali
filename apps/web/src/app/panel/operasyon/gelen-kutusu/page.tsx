'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { parseSenderPersonName } from '@/utils/inbox-customer-prefill';
import {
  InboxLinkFilePickerModal,
  type LinkPickerHasarFile,
} from '@/components/operation-inbox/InboxLinkFilePickerModal';
import { InboxReplyModal } from '@/components/operation-inbox/InboxReplyModal';
import { InboxAssignUserModal } from '@/components/operation-inbox/InboxAssignUserModal';
import { InboxComposeModal } from '@/components/operation-inbox/InboxComposeModal';
import { InboxMatchCandidates } from '@/components/operation-inbox/InboxMatchCandidates';
import { InboxDetailModal } from '@/components/operation-inbox/InboxDetailModal';
import { InboxOpenFileModal } from '@/components/operation-inbox/InboxOpenFileModal';
import { buildInboxFileOpenDraft, buildInboxFileOpenDraftFromRow, type InboxFileOpenDraft } from '@/utils/inbox-file-open-draft';
import { sanitizeInboundPhone } from '@sigorta/shared';
import { parseAssigneeAssistantScope } from '@/utils/inbox-assignee-assistant-scope';
import { ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { API, authHeader } from '@/utils/api';
import axios from 'axios';
import type { EmergencyCase } from '@/utils/emergencyApi';

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

type ActionKind = 'claim' | 'emergency' | 'archive';

interface LinkedFile {
  id: string;
  fileNo?: string;
  caseNo?: string;
}

interface AssignedUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface InboundMessageRow {
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
  claimFile?: LinkedFile | null;
  emergencyCase?: LinkedFile | null;
  assignedUser?: AssignedUser | null;
  lastReplyAt?: string | null;
  lastReplyPreview?: string | null;
  routing?: RoutingSuggestion | null;
  isUnowned?: boolean;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

interface InboxStats {
  pending: number;
  today: number;
  actioned: number;
  unownedCount?: number;
  escalatedCount?: number;
}

interface CustomerMatchCandidate {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface RoutingSuggestion {
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  suggestedAssigneeRole?: 'office' | 'field' | null;
  customerMatch: {
    status: 'found' | 'ambiguous' | 'not_found';
    customer?: CustomerMatchCandidate;
    candidates?: CustomerMatchCandidate[];
  };
  assistantCustomerMatch?: {
    status: 'found' | 'ambiguous' | 'not_found';
    customer?: CustomerMatchCandidate;
    candidates?: CustomerMatchCandidate[];
  };
  insuredName?: string | null;
  insuredPhone?: string | null;
    mailFields?: {
    insuredName?: string | null;
    insuredPhone?: string | null;
    insuredAddress?: string | null;
    fileNo?: string | null;
    policyNo?: string | null;
    claimNo?: string | null;
    lossType?: string | null;
    fileSubject?: string | null;
    insurer?: string | null;
  } | null;
  warnings: string[];
  confidence: number;
  reasons: string[];
  insuranceCompanyId?: string | null;
  city?: string | null;
  district?: string | null;
  escalated?: boolean;
}

interface AutoAssignPreview {
  suggestion: RoutingSuggestion;
  missingFields: string[];
  departmentCode: string | null;
  departmentName: string | null;
}

interface PanelUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface OpenClaimResult {
  claimFile: { id: string; fileNo: string };
}

interface OpenEmergencyResult {
  emergencyCase: { id: string; caseNo: string; fileNo: string };
}

interface InboundMessageBrief {
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  bodyPreview?: string | null;
  aiSummary?: string | null;
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

const CLASSIFICATION_LABELS: Record<InboundClassification, string> = {
  HASAR_IHBAR: 'Hasar İhbar',
  ACIL_YARDIM: 'Acil Yardım',
  BELGE_TALEP: 'Belge Talep',
  FATURA_ODEME: 'Fatura Ödeme',
  GENEL: 'Genel',
  SPAM: 'Spam',
  UNKNOWN: 'Bilinmiyor',
};

const CLASSIFICATION_BADGE: Record<InboundClassification, string> = {
  HASAR_IHBAR: 'badge badge-blue',
  ACIL_YARDIM: 'badge badge-red',
  BELGE_TALEP: 'badge badge-purple',
  FATURA_ODEME: 'badge badge-amber',
  GENEL: 'badge badge-gray',
  SPAM: 'badge badge-gray',
  UNKNOWN: 'badge badge-gray',
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

function showLinkAction(row: InboundMessageRow): boolean {
  if (row.claimFile || row.emergencyCase || row.status === 'ACTIONED' || row.status === 'ARCHIVED' || row.status === 'CLASSIFYING') {
    return false;
  }
  if (row.suggestedAction === 'LINK_EXISTING') return true;
  return row.classification === 'BELGE_TALEP'
    || row.classification === 'FATURA_ODEME'
    || row.classification === 'GENEL';
}

function showHasarAction(row: InboundMessageRow): boolean {
  if (row.claimFile || row.status === 'ACTIONED' || row.status === 'ARCHIVED' || row.status === 'CLASSIFYING') {
    return false;
  }
  return row.classification === 'HASAR_IHBAR' || row.suggestedAction === 'OPEN_HASAR_FILE';
}

function showAcilAction(row: InboundMessageRow): boolean {
  if (row.emergencyCase || row.status === 'ACTIONED' || row.status === 'ARCHIVED' || row.status === 'CLASSIFYING') {
    return false;
  }
  return row.classification === 'ACIL_YARDIM' || row.suggestedAction === 'OPEN_ACIL_FILE';
}

function showArchiveAction(row: InboundMessageRow): boolean {
  return row.status !== 'ARCHIVED' && row.status !== 'ACTIONED';
}

function showAssignAction(row: InboundMessageRow): boolean {
  return row.status !== 'ARCHIVED' && row.status !== 'CLASSIFYING';
}

function showMatchCandidates(row: InboundMessageRow): boolean {
  if (row.claimFile || row.emergencyCase) return false;
  if (row.status === 'ACTIONED' || row.status === 'ARCHIVED' || row.status === 'CLASSIFYING') return false;
  return row.suggestedAction === 'LINK_EXISTING';
}

function showReplyAction(row: InboundMessageRow): boolean {
  if (row.status === 'ARCHIVED' || row.status === 'CLASSIFYING') return false;
  if (row.suggestedAction === 'REPLY_ONLY') return true;
  if (row.claimFile || row.emergencyCase) return true;
  return row.classification === 'BELGE_TALEP'
    || row.classification === 'GENEL'
    || row.classification === 'FATURA_ODEME';
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200/70 shadow-card px-4 py-3 card-accent-blue">
      <p className="text-[11px] font-medium text-slate-400 tracking-wide leading-none">{label}</p>
      <span className="text-lg font-bold text-slate-900 leading-tight tabular-nums mt-1">
        {value ?? '—'}
      </span>
    </div>
  );
}

function InstructionModal({
  open,
  title,
  description,
  instruction,
  onInstructionChange,
  confirmLabel,
  loading,
  error,
  requiresInstruction,
  showInsuranceSelect,
  insuranceCompanies,
  insuranceCompanyId,
  onInsuranceCompanyChange,
  insuranceRequired,
  routing,
  users,
  usersLoading,
  selectedAssigneeId,
  onAssigneeChange,
  selectedCustomerId,
  onCustomerChange,
  createNewCustomer,
  onCreateNewCustomerChange,
  insuredName,
  onInsuredNameChange,
  insuredPhone,
  onInsuredPhoneChange,
  showInsuredFields,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  instruction: string;
  onInstructionChange: (v: string) => void;
  confirmLabel: string;
  loading: boolean;
  error: string;
  requiresInstruction: boolean;
  showInsuranceSelect?: boolean;
  insuranceCompanies?: InsuranceCompany[];
  insuranceCompanyId?: string;
  onInsuranceCompanyChange?: (v: string) => void;
  insuranceRequired?: boolean;
  routing?: RoutingSuggestion | null;
  users?: PanelUser[];
  usersLoading?: boolean;
  selectedAssigneeId?: string;
  onAssigneeChange?: (v: string) => void;
  selectedCustomerId?: string;
  onCustomerChange?: (v: string) => void;
  createNewCustomer?: boolean;
  onCreateNewCustomerChange?: (v: boolean) => void;
  insuredName?: string;
  onInsuredNameChange?: (v: string) => void;
  insuredPhone?: string;
  onInsuredPhoneChange?: (v: string) => void;
  showInsuredFields?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const insuranceOk = !showInsuranceSelect || !insuranceRequired || !!insuranceCompanyId;
  const insuredOk = !showInsuredFields || !!insuredName?.trim();
  const canConfirm = !loading && (!requiresInstruction || instruction.trim().length >= 3) && insuranceOk && insuredOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 mb-4">{description}</p>

        {routing && routing.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {routing.warnings.map((w) => (
              <span key={w} className="badge badge-amber">{w}</span>
            ))}
          </div>
        )}

        {routing && onAssigneeChange && (
          <>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Önerilen Sorumlu
            </label>
            <select
              value={selectedAssigneeId ?? ''}
              onChange={(e) => onAssigneeChange(e.target.value)}
              disabled={loading || usersLoading}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            >
              <option value="">Sorumlu seçin…</option>
              {routing.suggestedAssigneeId && routing.suggestedAssigneeName && (
                <option value={routing.suggestedAssigneeId}>
                  {routing.suggestedAssigneeName} (Önerilen)
                </option>
              )}
              {(users ?? [])
                .filter((u) => u.id !== routing.suggestedAssigneeId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
            </select>
            {routing.suggestedAssigneeName && !selectedAssigneeId && (
              <p className="text-[11px] text-slate-400 mb-3">
                AI önerisi: {routing.suggestedAssigneeName}
              </p>
            )}
          </>
        )}

        {showInsuredFields && onInsuredNameChange && (
          <>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Sigortalı Adı Soyadı
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={insuredName ?? ''}
              onChange={(e) => onInsuredNameChange(e.target.value)}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) onInsuredNameChange(v);
              }}
              disabled={loading || usersLoading}
              placeholder="Mail formundan çıkarılan sigortalı adı"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
            {onInsuredPhoneChange && (
              <>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Sigortalı Telefonu
                </label>
                <input
                  type="tel"
                  value={insuredPhone ?? ''}
                  onChange={(e) => onInsuredPhoneChange(e.target.value)}
                  disabled={loading || usersLoading}
                  placeholder="Opsiyonel"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </>
            )}
          </>
        )}

        {routing && onCustomerChange && (
          <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-600 mb-2">Müşteri</p>
            {routing.customerMatch.status === 'found' && routing.customerMatch.customer && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={!createNewCustomer}
                  onChange={() => onCreateNewCustomerChange?.(false)}
                />
                Mevcut Müşteri Bulundu: {routing.customerMatch.customer.name}
              </label>
            )}
            {routing.customerMatch.status === 'ambiguous' && routing.customerMatch.candidates && (
              <>
                <p className="text-[11px] text-slate-500 mb-2">Birden Fazla Aday — Seçin</p>
                <select
                  value={selectedCustomerId ?? ''}
                  onChange={(e) => {
                    onCreateNewCustomerChange?.(false);
                    onCustomerChange(e.target.value);
                  }}
                  disabled={loading || createNewCustomer}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white mb-2"
                >
                  <option value="">Müşteri seçin…</option>
                  {routing.customerMatch.candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            )}
            {routing.customerMatch.status === 'not_found' && (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  Sigortalı müşteri kaydı bulunamadı. Dosyayı müşteri bağlamadan açabilirsiniz.
                </p>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!createNewCustomer}
                    onChange={(e) => onCreateNewCustomerChange?.(e.target.checked)}
                  />
                  Yeni Müşteri Oluştur ({insuredName || 'sigortalı adı'})
                </label>
              </>
            )}
            {(routing.customerMatch.status === 'found' || routing.customerMatch.status === 'ambiguous') && (
              <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
                <input
                  type="radio"
                  checked={!!createNewCustomer}
                  onChange={() => onCreateNewCustomerChange?.(true)}
                />
                Yeni Müşteri Oluştur
              </label>
            )}
          </div>
        )}

        {showInsuranceSelect && insuranceCompanies && insuranceCompanies.length > 0 && (
          <>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Sigorta Şirketi
              {insuranceRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
              value={insuranceCompanyId ?? ''}
              onChange={(e) => onInsuranceCompanyChange?.(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            >
              {insuranceCompanies.length > 1 && (
                <option value="">Sigorta şirketi seçin…</option>
              )}
              {insuranceCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
        {requiresInstruction && (
          <>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Talimat / Not
            </label>
            <textarea
              value={instruction}
              onChange={(e) => onInstructionChange(e.target.value)}
              rows={4}
              placeholder="Dosya sorumlusuna iletilecek talimatı yazın…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              disabled={loading}
            />
          </>
        )}
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'İşleniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GelenKutusuPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InboundMessageRow[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [mailboxFilter, setMailboxFilter] = useState<'all' | InboundMailbox>('all');
  const [actionQueueFilter, setActionQueueFilter] = useState(true);
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  const [actionModal, setActionModal] = useState<{
    messageId: string;
    kind: ActionKind;
    subject: string;
  } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [linkModal, setLinkModal] = useState<{
    messageId: string;
    preferredTab: 'hasar' | 'acil';
    initialSearch: string;
  } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const [replyModal, setReplyModal] = useState<{ messageId: string; subject: string } | null>(null);
  const [assignModal, setAssignModal] = useState<{ messageId: string; assignee?: AssignedUser | null } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');

  const [actionRouting, setActionRouting] = useState<RoutingSuggestion | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [panelUsers, setPanelUsers] = useState<PanelUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  const [insuredNameInput, setInsuredNameInput] = useState('');
  const [insuredPhoneInput, setInsuredPhoneInput] = useState('');
  const [insuredAddressInput, setInsuredAddressInput] = useState('');
  const [fileNoInput, setFileNoInput] = useState('');
  const [policyNoInput, setPolicyNoInput] = useState('');
  const [claimNoInput, setClaimNoInput] = useState('');
  const [lossTypeInput, setLossTypeInput] = useState('');
  const [fileSubjectInput, setFileSubjectInput] = useState('');
  const [actionDraft, setActionDraft] = useState<InboxFileOpenDraft | null>(null);
  const [assistantCompanies, setAssistantCompanies] = useState<CustomerMatchCandidate[]>([]);
  const [selectedAssistantCustomerId, setSelectedAssistantCustomerId] = useState('');
  const [assigneeAssistantScopeLabel, setAssigneeAssistantScopeLabel] = useState('');
  const [autoAssignPreview, setAutoAssignPreview] = useState<AutoAssignPreview | null>(null);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  const applyFileOpenDraft = useCallback((draft: InboxFileOpenDraft) => {
    setActionDraft(draft);
    setInsuredNameInput(draft.insuredName);
    setInsuredPhoneInput(draft.insuredPhone);
    setInsuredAddressInput(draft.insuredAddress);
    setFileNoInput(draft.fileNo);
    setPolicyNoInput(draft.policyNo);
    setClaimNoInput(draft.claimNo);
    setLossTypeInput(draft.lossType);
    setFileSubjectInput(draft.fileSubject);
  }, []);

  const loadAssistantCompanies = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/customers`, {
        headers: authHeader(),
        params: {
          limit: 200,
          status: 'active',
          customerType: 'corporate',
          subType: ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
        },
      });
      const list = (res.data?.data ?? res.data ?? []) as Array<{
        id: string;
        companyName?: string | null;
        fullName?: string | null;
      }>;
      setAssistantCompanies(
        Array.isArray(list)
          ? list
              .map((row) => ({
                id: row.id,
                name: row.companyName?.trim() || row.fullName?.trim() || 'Asistan Firması',
              }))
              .filter((row) => row.name)
              .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
          : [],
      );
    } catch {
      setAssistantCompanies([]);
    }
  }, []);

  const loadAssigneeAssistantScope = useCallback(async (userId: string) => {
    if (!userId) {
      setAssigneeAssistantScopeLabel('');
      return;
    }
    try {
      const res = await axios.get(`${API}/claim-responsibilities`, {
        headers: authHeader(),
        params: { userId, isActive: true },
      });
      const rows = (res.data?.data ?? res.data ?? []) as Array<Record<string, unknown>>;
      const nameById = new Map(assistantCompanies.map((c) => [c.id, c.name]));
      const scope = parseAssigneeAssistantScope(rows, nameById);
      setAssigneeAssistantScopeLabel(scope.label);
    } catch {
      setAssigneeAssistantScopeLabel('');
    }
  }, [assistantCompanies]);

  const loadPanelUsers = useCallback(async (messageId?: string) => {
    try {
      const listParams = messageId ? { messageId } : undefined;
      const usersRes = await apiClient.get<{ users: PanelUser[] }>(
        '/operation-inbox/assignable-users',
        listParams,
      );
      const baseUsers = usersRes.users ?? [];
      try {
        const delegatesRes = await axios.get(`${API}/operational-access-grants/function-delegates`, {
          headers: authHeader(),
          params: { scopeType: 'acil_yardim' },
        });
        const delegates = (delegatesRes.data?.data ?? []) as PanelUser[];
        const seen = new Set(baseUsers.map((u) => u.id));
        const merged = [...baseUsers];
        for (const delegate of delegates) {
          if (!seen.has(delegate.id)) {
            merged.push(delegate);
            seen.add(delegate.id);
          }
        }
        setPanelUsers(merged);
      } catch {
        setPanelUsers(baseUsers);
      }
    } catch {
      setPanelUsers([]);
    }
  }, []);

  const applyRoutingFromSuggestion = useCallback((routing: RoutingSuggestion) => {
    setActionRouting(routing);
    setSelectedAssigneeId(routing.suggestedAssigneeId ?? '');
    if (routing.customerMatch.status === 'found' && routing.customerMatch.customer) {
      setSelectedCustomerId(routing.customerMatch.customer.id);
      setCreateNewCustomer(false);
    } else if (
      routing.customerMatch.status === 'ambiguous'
      && routing.customerMatch.candidates?.length === 1
    ) {
      setSelectedCustomerId(routing.customerMatch.candidates[0].id);
      setCreateNewCustomer(false);
    } else if (routing.customerMatch.status === 'not_found') {
      setSelectedCustomerId('');
      setCreateNewCustomer(false);
    } else {
      setSelectedCustomerId('');
      setCreateNewCustomer(false);
    }
    if (routing.insuranceCompanyId) {
      setInsuranceCompanyId(routing.insuranceCompanyId);
    }
    const assistantMatch = routing.assistantCustomerMatch;
    if (assistantMatch?.status === 'found' && assistantMatch.customer) {
      setSelectedAssistantCustomerId(assistantMatch.customer.id);
    } else if (assistantMatch?.status === 'ambiguous' && assistantMatch.candidates?.length === 1) {
      setSelectedAssistantCustomerId(assistantMatch.candidates[0].id);
    }
    if (routing.suggestedAssigneeId) {
      void loadAssigneeAssistantScope(routing.suggestedAssigneeId);
    }
    const mf = routing.mailFields;
    if (mf) {
      if (mf.insuredName?.trim()) setInsuredNameInput(toTitleCaseTR(mf.insuredName.trim()));
      if (mf.insuredPhone?.trim()) {
        const fromRouting = sanitizeInboundPhone(mf.insuredPhone.trim());
        if (fromRouting) setInsuredPhoneInput(fromRouting);
      }
      if (mf.insuredAddress?.trim()) {
        setInsuredAddressInput(toTitleCaseTR(mf.insuredAddress.trim()));
      }
      if (mf.fileNo?.trim()) setFileNoInput(mf.fileNo.trim());
      if (mf.policyNo?.trim()) setPolicyNoInput(mf.policyNo.trim());
      if (mf.claimNo?.trim()) setClaimNoInput(mf.claimNo.trim());
      if (mf.fileSubject?.trim()) setFileSubjectInput(toTitleCaseTR(mf.fileSubject.trim()));
      if (mf.lossType?.trim()) setLossTypeInput(toTitleCaseTR(mf.lossType.trim()));
    }
  }, [loadAssigneeAssistantScope]);

  const loadActionContext = useCallback(async (messageId: string, rowFallback?: InboundMessageRow) => {
    setRoutingLoading(true);
    try {
      let message: InboundMessageBrief | null = null;
      let routing: RoutingSuggestion | null = null;

      try {
        message = await apiClient.get<InboundMessageBrief>(`/operation-inbox/messages/${messageId}`);
      } catch {
        message = rowFallback
          ? {
              subject: rowFallback.subject,
              fromAddress: rowFallback.fromAddress,
              fromName: rowFallback.fromName,
              aiSummary: rowFallback.aiSummary,
            }
          : null;
      }

      try {
        routing = await apiClient.get<RoutingSuggestion>(
          `/operation-inbox/messages/${messageId}/routing-suggestion`,
        );
      } catch {
        routing = null;
      }

      if (!message && rowFallback) {
        message = {
          subject: rowFallback.subject,
          fromAddress: rowFallback.fromAddress,
          fromName: rowFallback.fromName,
          aiSummary: rowFallback.aiSummary,
        };
      }

      if (!message) {
        setActionDraft(null);
        setActionRouting(null);
        setActionError('Mesaj yüklenemedi. Listeden tekrar deneyin.');
        return null;
      }

      const { draft } = buildInboxFileOpenDraft(message, routing, {
        manualFallback: !message.bodyText && !message.bodyHtml && !message.bodyPreview,
      });
      applyFileOpenDraft(draft);
      setActionError('');

      const autoInstruction =
        draft.description?.trim()
        || message.aiSummary?.trim()
        || `Gelen kutusu ihbarı: ${message.subject.trim()}`;
      if (autoInstruction.trim().length >= 3) {
        setInstruction(autoInstruction);
      }

      if (routing) {
        applyRoutingFromSuggestion(routing);
        if (!routing.insuranceCompanyId && draft.insurer && insuranceCompanies.length > 0) {
          const match = insuranceCompanies.find(
            (c) => c.name.toLowerCase().includes(draft.insurer!.toLowerCase().slice(0, 6))
              || draft.insurer!.toLowerCase().includes(c.name.toLowerCase().slice(0, 6)),
          );
          if (match) setInsuranceCompanyId(match.id);
        }
      }

      return { message, routing, draft };
    } catch {
      if (rowFallback) {
        const draft = buildInboxFileOpenDraftFromRow(rowFallback);
        draft.manualFallback = true;
        applyFileOpenDraft(draft);
        setActionError('Mail detayı okunamadı — alanları manuel doldurabilirsiniz.');
        return { message: null, routing: null, draft };
      }
      setActionRouting(null);
      setActionDraft(null);
      return null;
    } finally {
      setRoutingLoading(false);
    }
  }, [applyFileOpenDraft, applyRoutingFromSuggestion, insuranceCompanies]);

  const loadRoutingSuggestion = useCallback(async (messageId: string) => {
    setRoutingLoading(true);
    try {
      const routing = await apiClient.get<RoutingSuggestion>(
        `/operation-inbox/messages/${messageId}/routing-suggestion`,
      );
      setActionRouting(routing);
      return routing;
    } catch {
      setActionRouting(null);
      return null;
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  const loadInsuranceCompanies = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/insurance-companies`, {
        headers: authHeader(),
        params: { limit: 200 },
      });
      const list = (res.data?.data ?? []) as InsuranceCompany[];
      setInsuranceCompanies(list);
      if (list.length === 1) {
        setInsuranceCompanyId(list[0].id);
      }
    } catch {
      setInsuranceCompanies([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listParams: Record<string, string | number> = {
        limit: 100,
        actionQueue: actionQueueFilter ? 'true' : 'false',
      };
      if (mailboxFilter !== 'all') listParams.mailbox = mailboxFilter;

      const [listRes, statsRes] = await Promise.all([
        apiClient.get<{ items: InboundMessageRow[]; total: number; pendingCount: number }>(
          '/operation-inbox/messages',
          listParams,
        ),
        apiClient.get<InboxStats>('/operation-inbox/stats'),
      ]);
      setItems(listRes.items ?? []);
      setStats(statsRes ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Gelen kutusunu görüntüleme yetkiniz yok. Sistem yöneticinize başvurun.');
      } else {
        setError('Gelen kutusu yüklenemedi. Yetkiniz veya Microsoft 365 bağlantısı kontrol edilmeli.');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mailboxFilter, actionQueueFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const messageId = searchParams.get('messageId')?.trim();
    if (!messageId) return;
    setDetailModalId(messageId);
    setActionQueueFilter(false);
    router.replace('/panel/operasyon/gelen-kutusu', { scroll: false });
  }, [searchParams, router]);

  const handleReprocessMatching = async () => {
    setReprocessing(true);
    try {
      const res = await apiClient.post<{ processed: number; linked: number }>(
        '/operation-inbox/messages/reprocess-matching',
      );
      showToast(
        'success',
        `${res.processed} mesaj tarandı, ${res.linked} dosyaya otomatik bağlandı.`,
      );
      await load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Eşleştirme yenilenemedi');
    } finally {
      setReprocessing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await apiClient.post<{ ok: boolean; message: string }>('/operation-inbox/sync');
      setSyncMessage(res.message ?? (res.ok ? 'Senkronizasyon başlatıldı.' : 'Senkronizasyon başlatılamadı.'));
      if (res.ok) {
        setTimeout(() => load(), 3000);
      }
    } catch {
      setSyncMessage('Senkronizasyon isteği gönderilemedi.');
    } finally {
      setSyncing(false);
    }
  };

  const openActionModal = (
    messageId: string,
    kind: ActionKind,
    subject: string,
    options?: { prefillCustomer?: boolean; row?: InboundMessageRow },
  ) => {
    setActionModal({ messageId, kind, subject });
    setInstruction('');
    setActionError('');
    setActionRouting(null);
    setSelectedAssigneeId('');
    setSelectedCustomerId('');
    setCreateNewCustomer(false);
    setSelectedAssistantCustomerId('');
    setAssigneeAssistantScopeLabel('');

    const row = options?.row ?? items.find((i) => i.id === messageId);
    if (kind === 'claim' || kind === 'emergency') {
      if (row) {
        const instant = buildInboxFileOpenDraftFromRow(row);
        applyFileOpenDraft(instant);
      } else {
        setInsuredNameInput('');
        setInsuredPhoneInput('');
        setInsuredAddressInput('');
        setFileNoInput('');
        setPolicyNoInput('');
        setClaimNoInput('');
        setLossTypeInput('');
        setActionDraft({
          subject,
          senderEmail: '',
          fileNo: '',
          claimNo: '',
          policyNo: '',
          lossType: '',
          fileSubject: '',
          insuredName: '',
          insuredPhone: '',
          insuredAddress: '',
          manualFallback: true,
        });
      }
    }

    if (kind === 'claim') {
      setInsuranceCompanyId('');
    }
    if (kind === 'claim' || kind === 'emergency') {
      void loadPanelUsers(messageId);
      void (async () => {
        if (kind === 'claim') await loadInsuranceCompanies();
        if (kind === 'emergency') await loadAssistantCompanies();
        const ctx = await loadActionContext(messageId, row);
        if (options?.prefillCustomer && ctx?.routing?.customerMatch.status === 'not_found') {
          setCreateNewCustomer(true);
        }
      })();
    }
  };

  const closeActionModal = () => {
    if (actionLoading) return;
    setActionModal(null);
    setInstruction('');
    setActionError('');
    setActionRouting(null);
    setSelectedAssigneeId('');
    setSelectedCustomerId('');
    setCreateNewCustomer(false);
    setSelectedAssistantCustomerId('');
    setAssigneeAssistantScopeLabel('');
    setInsuredNameInput('');
    setInsuredPhoneInput('');
    setInsuredAddressInput('');
    setFileNoInput('');
    setPolicyNoInput('');
    setClaimNoInput('');
    setLossTypeInput('');
    setFileSubjectInput('');
    setActionDraft(null);
    setAutoAssignPreview(null);
    setAutoAssignLoading(false);
  };

  const handleRequestAutoAssign = async () => {
    if (!actionModal) return;
    setAutoAssignLoading(true);
    setActionError('');
    try {
      const preview = await apiClient.get<AutoAssignPreview>(
        `/operation-inbox/messages/${actionModal.messageId}/auto-assign-preview`,
      );
      setAutoAssignPreview(preview);
    } catch {
      setActionError('Otomatik atama önerisi alınamadı.');
      setAutoAssignPreview(null);
    } finally {
      setAutoAssignLoading(false);
    }
  };

  const handleAcceptAutoAssign = () => {
    if (!autoAssignPreview) return;
    applyRoutingFromSuggestion(autoAssignPreview.suggestion);
    setAutoAssignPreview(null);
    showToast('success', 'Atama önerisi uygulandı. Bilgileri kontrol edip dosyayı açın.');
  };

  const handleRejectAutoAssign = () => {
    setAutoAssignPreview(null);
  };

  const openLinkModal = (row: InboundMessageRow) => {
    const preferredTab = row.mailbox === 'IHBAR' ? 'acil' : 'hasar';
    setLinkModal({
      messageId: row.id,
      preferredTab,
      initialSearch: '',
    });
  };

  const openLinkModalForMessage = (
    messageId: string,
    mailbox: InboundMailbox,
    initialSearch: string,
  ) => {
    setLinkModal({
      messageId,
      preferredTab: mailbox === 'IHBAR' ? 'acil' : 'hasar',
      initialSearch,
    });
  };

  const handleLinkClaim = async (file: LinkPickerHasarFile) => {
    if (!linkModal) return;
    setLinkLoading(true);
    try {
      const res = await apiClient.post<{ claimFile: { id: string; fileNo: string } }>(
        `/operation-inbox/messages/${linkModal.messageId}/link-claim-file`,
        { claimFileId: file.id },
      );
      showToast('success', `Hasar dosyasına bağlandı: ${res.claimFile.fileNo}`);
      setLinkModal(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Bağlama başarısız');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLinkClaimDirect = async (messageId: string, claimFileId: string, fileNo: string) => {
    setLinkLoading(true);
    try {
      await apiClient.post(
        `/operation-inbox/messages/${messageId}/link-claim-file`,
        { claimFileId },
      );
      showToast('success', `Hasar dosyasına bağlandı: ${fileNo}`);
      setDetailModalId(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Bağlama başarısız');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleLinkEmergencyDirect = async (messageId: string, emergencyCaseId: string, fileNo: string) => {
    setLinkLoading(true);
    try {
      await apiClient.post(
        `/operation-inbox/messages/${messageId}/link-emergency-file`,
        { emergencyCaseId },
      );
      showToast('success', `Acil dosyaya bağlandı: ${fileNo}`);
      setDetailModalId(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Bağlama başarısız');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleReplySuccess = (updated: {
    id: string;
    status: 'ACTIONED';
    lastReplyAt?: string;
    lastReplyPreview?: string;
  }) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === updated.id
          ? {
              ...row,
              status: 'ACTIONED',
              suggestedAction: row.suggestedAction === 'REPLY_ONLY' ? null : row.suggestedAction,
              lastReplyAt: updated.lastReplyAt ?? new Date().toISOString(),
              lastReplyPreview: updated.lastReplyPreview ?? row.lastReplyPreview,
            }
          : row,
      ),
    );
  };

  const handleAssignSuccess = (messageId: string, assignee: AssignedUser) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === messageId ? { ...row, assignedUser: assignee } : row,
      ),
    );
  };

  const handleLinkEmergency = async (file: EmergencyCase) => {
    if (!linkModal) return;
    setLinkLoading(true);
    try {
      const res = await apiClient.post<{ emergencyCase: { id: string; caseNo: string } }>(
        `/operation-inbox/messages/${linkModal.messageId}/link-emergency-file`,
        { emergencyCaseId: file.id },
      );
      showToast('success', `Acil dosyaya bağlandı: ${res.emergencyCase.caseNo}`);
      setLinkModal(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Bağlama başarısız');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleActionConfirm = async () => {
    if (!actionModal) return;
    const requiresInstruction = actionModal.kind !== 'archive';
    const trimmed = requiresInstruction ? toTitleCaseTR(instruction.trim()) : '';
    if (requiresInstruction && trimmed.length < 3) {
      setActionError('Talimat en az 3 karakter olmalıdır.');
      return;
    }

    if (actionModal.kind === 'claim' && insuranceCompanies.length > 1 && !insuranceCompanyId) {
      setActionError('Hasar dosyası açmak için sigorta şirketi seçin.');
      return;
    }

    const insuredName = toTitleCaseTR(insuredNameInput.trim());
    if (
      (actionModal.kind === 'claim' || actionModal.kind === 'emergency')
      && !insuredName
    ) {
      setActionError('Sigortalı adı soyadı zorunludur.');
      return;
    }

    if (actionModal.kind === 'emergency' && !selectedAssistantCustomerId.trim()) {
      setActionError('Acil yardım dosyası için asistan firması seçilmelidir.');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const assigneePayload = selectedAssigneeId ? { assignedUserId: selectedAssigneeId } : {};
      const fileFieldsPayload = {
        insuredName,
        insuredPhone: insuredPhoneInput.trim() || undefined,
        insuredAddress: toTitleCaseTR(insuredAddressInput.trim()) || undefined,
        fileNo: fileNoInput.trim() || undefined,
        policyNo: policyNoInput.trim() || undefined,
        claimNo: claimNoInput.trim() || undefined,
        lossType: toTitleCaseTR(lossTypeInput.trim()) || undefined,
        fileSubject: toTitleCaseTR(fileSubjectInput.trim()) || undefined,
      };
      const { firstName, lastName } = parseSenderPersonName(insuredName);
      const matchedCustomerId =
        actionRouting?.customerMatch.status === 'found' && actionRouting.customerMatch.customer?.id
          ? actionRouting.customerMatch.customer.id
          : selectedCustomerId.trim() || undefined;
      const customerPayload =
        matchedCustomerId && (actionRouting?.customerMatch.status === 'found' || !createNewCustomer)
          ? { customerId: matchedCustomerId }
          : createNewCustomer
            ? {
                createCustomer: {
                  entityType: 'individual' as const,
                  firstName: firstName || undefined,
                  lastName: lastName || undefined,
                  phone: insuredPhoneInput.trim() || undefined,
                  address: toTitleCaseTR(insuredAddressInput.trim()) || undefined,
                },
              }
            : matchedCustomerId
              ? { customerId: matchedCustomerId }
              : {};

      if (actionModal.kind === 'claim') {
        const res = await apiClient.post<OpenClaimResult>(
          `/operation-inbox/messages/${actionModal.messageId}/open-claim-file`,
          {
            instruction: trimmed,
            insuranceCompanyId: insuranceCompanyId || undefined,
            ...assigneePayload,
            ...customerPayload,
            ...fileFieldsPayload,
          },
        );
        showToast('success', `Hasar dosyası açıldı: ${res.claimFile.fileNo}`);
        closeActionModal();
        await load();
        window.open(`/panel/hasar-dosyalari/${res.claimFile.id}`, '_blank');
      } else if (actionModal.kind === 'emergency') {
        const res = await apiClient.post<OpenEmergencyResult>(
          `/operation-inbox/messages/${actionModal.messageId}/open-emergency-file`,
          {
            instruction: trimmed,
            assistantCustomerId: selectedAssistantCustomerId.trim(),
            ...assigneePayload,
            ...fileFieldsPayload,
          },
        );
        showToast('success', `Acil yardım dosyası açıldı: ${res.emergencyCase.caseNo}`);
        closeActionModal();
        await load();
        window.open(`/panel/acil-yardim/${res.emergencyCase.id}`, '_blank');
      } else {
        await apiClient.post(`/operation-inbox/messages/${actionModal.messageId}/archive`);
        showToast('success', 'Mesaj arşivlendi');
        closeActionModal();
        await load();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : actionModal.kind === 'archive'
            ? 'Arşivleme başarısız'
            : 'Dosya açma başarısız';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const modalTitle =
    actionModal?.kind === 'claim'
      ? 'Hasar Dosyası Aç'
      : actionModal?.kind === 'emergency'
        ? 'Acil Yardım Dosyası Aç'
        : 'Mesajı Yoksay';

  const modalDescription =
    actionModal?.kind === 'claim'
      ? 'AI özeti ve e-posta içeriğinden hasar dosyası oluşturulur. Dosya sorumlusuna talimatınız kaydedilir.'
      : actionModal?.kind === 'emergency'
        ? 'AI özeti ve e-posta içeriğinden acil yardım dosyası oluşturulur. Talimat dosya notlarına eklenir.'
        : 'Bu mesaj arşive alınır ve bekleyen sayaçtan düşer.';

  const modalConfirmLabel =
    actionModal?.kind === 'claim'
      ? 'Hasar Aç'
      : actionModal?.kind === 'emergency'
        ? 'Acil Aç'
        : 'Arşivle';

  return (
    <div className="space-y-6">
      <InboxDetailModal
        open={!!detailModalId}
        messageId={detailModalId}
        onClose={() => setDetailModalId(null)}
        onLinkClaim={handleLinkClaimDirect}
        onLinkEmergency={handleLinkEmergencyDirect}
        linking={linkLoading}
        actions={{
          onOpenClaim: (messageId, subject, prefillCustomer) => {
            setDetailModalId(null);
            openActionModal(messageId, 'claim', subject, { prefillCustomer });
          },
          onOpenEmergency: (messageId, subject) => {
            setDetailModalId(null);
            openActionModal(messageId, 'emergency', subject);
          },
          onLinkFile: (messageId, mailbox, initialSearch) => {
            openLinkModalForMessage(messageId, mailbox, initialSearch);
          },
          onReply: (messageId, subject) => {
            setReplyModal({ messageId, subject });
          },
          onAssign: (messageId, assignee) => {
            setAssignModal({ messageId, assignee });
            void loadRoutingSuggestion(messageId);
          },
          onArchive: (messageId, subject) => {
            setDetailModalId(null);
            openActionModal(messageId, 'archive', subject);
          },
        }}
      />

      <InboxReplyModal
        open={!!replyModal}
        messageId={replyModal?.messageId ?? null}
        subject={replyModal?.subject ?? ''}
        onClose={() => setReplyModal(null)}
        onSuccess={handleReplySuccess}
        onToast={showToast}
      />

      <InboxAssignUserModal
        open={!!assignModal}
        messageId={assignModal?.messageId ?? null}
        currentAssignee={assignModal?.assignee}
        onClose={() => setAssignModal(null)}
        onSuccess={(assignee) => {
          if (assignModal) handleAssignSuccess(assignModal.messageId, assignee);
        }}
        onToast={showToast}
      />

      <InboxComposeModal
        open={composeOpen}
        defaultMailbox={mailboxFilter === 'IHBAR' ? 'IHBAR' : 'HASAR'}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => void load()}
        onToast={showToast}
      />

      <InboxLinkFilePickerModal
        open={!!linkModal}
        onClose={() => { if (!linkLoading) setLinkModal(null); }}
        preferredTab={linkModal?.preferredTab ?? 'hasar'}
        initialSearch={linkModal?.initialSearch ?? ''}
        onSelectClaim={handleLinkClaim}
        onSelectEmergency={handleLinkEmergency}
      />

      <InstructionModal
        open={!!actionModal && actionModal.kind === 'archive'}
        title={modalTitle}
        description={modalDescription}
        instruction={instruction}
        onInstructionChange={setInstruction}
        confirmLabel={modalConfirmLabel}
        loading={actionLoading}
        error={actionError}
        requiresInstruction={actionModal?.kind !== 'archive'}
        showInsuranceSelect={actionModal?.kind === 'claim'}
        insuranceCompanies={insuranceCompanies}
        insuranceCompanyId={insuranceCompanyId}
        onInsuranceCompanyChange={setInsuranceCompanyId}
        insuranceRequired={insuranceCompanies.length > 1}
        routing={actionModal?.kind !== 'archive' ? actionRouting : null}
        users={panelUsers}
        usersLoading={routingLoading}
        selectedAssigneeId={selectedAssigneeId}
        onAssigneeChange={setSelectedAssigneeId}
        selectedCustomerId={selectedCustomerId}
        onCustomerChange={setSelectedCustomerId}
        createNewCustomer={createNewCustomer}
        onCreateNewCustomerChange={setCreateNewCustomer}
        showInsuredFields={false}
        onConfirm={handleActionConfirm}
        onCancel={closeActionModal}
      />

      <InboxOpenFileModal
        open={
          !!actionModal
          && (actionModal.kind === 'claim' || actionModal.kind === 'emergency')
          && !!actionDraft
        }
        kind={actionModal?.kind === 'emergency' ? 'emergency' : 'claim'}
        draft={actionDraft}
        contextLoading={routingLoading}
        instruction={instruction}
        onInstructionChange={setInstruction}
        confirmLabel={actionModal?.kind === 'emergency' ? 'Acil Aç' : 'Hasar Aç'}
        loading={actionLoading || routingLoading}
        error={actionError}
        routing={actionRouting}
        users={panelUsers}
        usersLoading={routingLoading}
        selectedAssigneeId={selectedAssigneeId}
        onAssigneeChange={(userId) => {
          setSelectedAssigneeId(userId);
          void loadAssigneeAssistantScope(userId);
        }}
        selectedCustomerId={selectedCustomerId}
        onCustomerChange={setSelectedCustomerId}
        createNewCustomer={createNewCustomer}
        onCreateNewCustomerChange={setCreateNewCustomer}
        insuredName={insuredNameInput}
        onInsuredNameChange={setInsuredNameInput}
        insuredPhone={insuredPhoneInput}
        onInsuredPhoneChange={setInsuredPhoneInput}
        insuredAddress={insuredAddressInput}
        onInsuredAddressChange={setInsuredAddressInput}
        fileNo={fileNoInput}
        onFileNoChange={setFileNoInput}
        policyNo={policyNoInput}
        onPolicyNoChange={setPolicyNoInput}
        claimNo={claimNoInput}
        onClaimNoChange={setClaimNoInput}
        lossType={lossTypeInput}
        onLossTypeChange={setLossTypeInput}
        fileSubject={fileSubjectInput}
        onFileSubjectChange={setFileSubjectInput}
        insuranceCompanies={insuranceCompanies}
        insuranceCompanyId={insuranceCompanyId}
        onInsuranceCompanyChange={setInsuranceCompanyId}
        insuranceRequired={insuranceCompanies.length > 1}
        assistantCompanies={assistantCompanies}
        selectedAssistantCustomerId={selectedAssistantCustomerId}
        onAssistantCustomerChange={setSelectedAssistantCustomerId}
        assigneeAssistantScopeLabel={assigneeAssistantScopeLabel}
        missingFields={
          autoAssignPreview?.missingFields
          ?? actionRouting?.warnings
            .filter((w) => w.startsWith('Eksik bilgi:'))
            .map((w) => w.replace('Eksik bilgi: ', ''))
        }
        autoAssignPreview={autoAssignPreview}
        autoAssignLoading={autoAssignLoading}
        onRequestAutoAssign={handleRequestAutoAssign}
        onAcceptAutoAssign={handleAcceptAutoAssign}
        onRejectAutoAssign={handleRejectAutoAssign}
        onConfirm={handleActionConfirm}
        onCancel={closeActionModal}
      />

      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Link href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/panel/operasyon" className="hover:text-blue-600 transition-colors">Operasyon</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Gelen Kutusu</span>
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Gelen Kutusu</h1>
            <p className="page-subtitle">
              ihbar@ ve hasar@ paylaşımlı kutularından gelen mailler — AI destekli sınıflandırma
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleReprocessMatching()}
            disabled={reprocessing}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {reprocessing ? 'Eşleştiriliyor…' : 'Eşleştirmeyi Yenile'}
          </button>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Yeni E-posta
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary shadow-sm shadow-blue-200/60"
          >
            {syncing ? 'Senkronize Ediliyor…' : 'Senkronize Et'}
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Bekleyen" value={stats?.pending ?? null} />
        <StatCard label="Sahipsiz" value={stats?.unownedCount ?? null} />
        <StatCard label="Bugün Gelen" value={stats?.today ?? null} />
        <StatCard label="İşlenen" value={stats?.actioned ?? null} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400 mr-1">Görünüm:</span>
        {([
          { key: true, label: 'Aksiyon Gereken' },
          { key: false, label: 'Tümü' },
        ] as const).map(({ key, label }) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setActionQueueFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              actionQueueFilter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-slate-200 mx-1">|</span>
        {(['all', 'IHBAR', 'HASAR'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMailboxFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mailboxFilter === key
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {key === 'all' ? 'Hepsi' : MAILBOX_LABELS[key]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400 animate-pulse">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-card">
          <p className="text-sm font-medium text-slate-600">Henüz Gelen Mail Yok</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Microsoft 365 senkronizasyonunu başlatmak için &quot;Senkronize Et&quot; düğmesine basın.
            Ayarlar → Entegrasyonlar → Microsoft 365 sekmesinden bağlantıyı yapılandırın.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((row) => (
            <article
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailModalId(row.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailModalId(row.id);
                }
              }}
              className={`rounded-2xl border bg-white shadow-card px-4 py-3.5 transition-colors cursor-pointer ${
                row.isUnowned
                  ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
                  : 'border-slate-200/70 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-900 truncate" title={row.subject}>
                    {row.subject}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {row.fromName ? `${row.fromName} · ${row.fromAddress}` : row.fromAddress}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span className="badge badge-blue">{MAILBOX_LABELS[row.mailbox]}</span>
                  {row.classification ? (
                    <span className={CLASSIFICATION_BADGE[row.classification]}>
                      {CLASSIFICATION_LABELS[row.classification]}
                      {row.confidence != null && (
                        <span className="ml-1 opacity-75">
                          {Math.round(row.confidence * 100)}%
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="badge badge-gray">{STATUS_LABELS[row.status]}</span>
                  )}
                  {row.lastReplyAt && (
                    <span className="badge badge-green" title={row.lastReplyPreview ?? undefined}>
                      Yanıt Gönderildi
                    </span>
                  )}
                  {row.isUnowned && (
                    <span className="badge badge-amber">Sahiplenilmedi</span>
                  )}
                  {row.routing?.warnings?.map((w) => (
                    <span key={w} className="badge badge-amber" title={w}>{w}</span>
                  ))}
                  {row.assignedUser && (
                    <span className="badge badge-purple" title={`${row.assignedUser.firstName} ${row.assignedUser.lastName}`}>
                      {row.assignedUser.firstName} {row.assignedUser.lastName}
                    </span>
                  )}
                </div>
              </div>

              {row.aiSummary && (
                <p className="text-xs text-slate-600 mt-2 line-clamp-2" title={row.aiSummary}>
                  {row.aiSummary}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span>{fmtDateTime(row.receivedAt)}</span>
                {row.classification && row.status !== 'CLASSIFIED' && (
                  <span>{STATUS_LABELS[row.status]}</span>
                )}
                {!row.aiSummary && row.status === 'NEW' && (
                  <span>AI sınıflandırması bekleniyor</span>
                )}
                {row.status === 'CLASSIFYING' && (
                  <span className="text-blue-500">Sınıflandırılıyor…</span>
                )}
              </div>

              {(row.claimFile || row.emergencyCase) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.claimFile && (
                    <Link
                      href={`/panel/hasar-dosyalari/${row.claimFile.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Hasar Dosyası: {row.claimFile.fileNo}
                    </Link>
                  )}
                  {row.emergencyCase && (
                    <Link
                      href={`/panel/acil-yardim/${row.emergencyCase.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Acil Dosya: {row.emergencyCase.caseNo ?? row.emergencyCase.fileNo}
                    </Link>
                  )}
                </div>
              )}

              {showMatchCandidates(row) && (
                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <InboxMatchCandidates
                  messageId={row.id}
                  linking={linkLoading}
                  onLinkClaim={(claimFileId, fileNo) => void handleLinkClaimDirect(row.id, claimFileId, fileNo)}
                  onLinkEmergency={(emergencyCaseId, fileNo) => void handleLinkEmergencyDirect(row.id, emergencyCaseId, fileNo)}
                />
                </div>
              )}

              {(showHasarAction(row) || showAcilAction(row) || showLinkAction(row) || showReplyAction(row) || showArchiveAction(row) || showAssignAction(row)) && (
                <div
                  className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {showAssignAction(row) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignModal({ messageId: row.id, assignee: row.assignedUser });
                        void loadRoutingSuggestion(row.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      Ata
                    </button>
                  )}
                  {showReplyAction(row) && (
                    <button
                      type="button"
                      onClick={() => setReplyModal({ messageId: row.id, subject: row.subject })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Yanıtla
                    </button>
                  )}
                  {showLinkAction(row) && (
                    <button
                      type="button"
                      onClick={() => openLinkModal(row)}
                      disabled={linkLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Dosyaya Bağla
                    </button>
                  )}
                  {showHasarAction(row) && (
                    <button
                      type="button"
                      onClick={() => openActionModal(row.id, 'claim', row.subject, { row })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Hasar Aç
                    </button>
                  )}
                  {showAcilAction(row) && (
                    <button
                      type="button"
                      onClick={() => openActionModal(row.id, 'emergency', row.subject, { row })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Acil Aç
                    </button>
                  )}
                  {showArchiveAction(row) && (
                    <button
                      type="button"
                      onClick={() => openActionModal(row.id, 'archive', row.subject)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Yoksay
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
