'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authAxios, authHeader, ensureSessionBeforeMutation } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import {
  ReportRecipientPicker,
  buildRecipientPayload,
  enforceSingleApprovalTo,
  type MailRecipient,
} from '@/components/repair-reports/ReportRecipientPicker';
import { ReportApprovalMailComposeFields } from '@/components/repair-reports/ReportApprovalMailPreview';
import { presentPdfPreview, readPdfPreviewFailure } from '@/utils/pdf-preview-open';
import {
  claimApprovalFallbackCustomerEmail,
  claimApprovalMailPreview,
  claimApprovalMailPreviewEmails,
} from '@/utils/claim-approval-mail-preview';
import {
  claimApprovalMailContacts,
  claimApprovalDefaultToEmailsWithCustomerCard,
  claimApprovalFirstToGreetingName,
  claimApprovalMailTextPreview,
  mergeClaimApprovalCustomerCardContact,
  mergeClaimApprovalFileOwnerContact,
  withClaimApprovalFileOwnerCc,
} from '@/utils/claim-approval-mail-contacts';
import { claimApprovalCustomerDisplayName } from '@sigorta/shared';
import { resolveClaimIhbarKonusu } from '@/utils/text-helpers';

export type OperationSendEmailTarget = {
  claimId: string;
  fileNo: string;
  reportId: string | null;
  defaultTo?: string;
};

type Props = {
  target: OperationSendEmailTarget | null;
  onClose: () => void;
};

type LoadedClaim = {
  serviceKind?: unknown;
  consultancyServiceType?: { code?: string | null; name?: string | null } | null;
  mailRouteJson?: unknown;
  insuranceCompany?: { name?: string | null; contactEmail?: string | null } | null;
  channelAgencyCustomer?: unknown;
  channelBrokerCustomer?: unknown;
  channelExpertCustomer?: unknown;
  customer?: {
    email?: string | null;
    shortName?: string | null;
    companyName?: string | null;
    fullName?: string | null;
    name?: string | null;
  } | null;
  claimSubject?: { name?: string | null } | null;
  departmentFileSubject?: { name?: string | null } | null;
  lossType?: string | null;
  fileNo?: string | null;
  assignedOfficeUser?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

/**
 * Operasyon / Hasar listesi → Onaya Gönder.
 * Kişi bazlı Alıcılar (Kime/Cc) + hazır konu/mesaj; request-approval.
 */
export function OperationSendEmailModal({ target, onClose }: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claim, setClaim] = useState<LoadedClaim | null>(null);
  const [reportNo, setReportNo] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<MailRecipient[]>([]);
  const [messageText, setMessageText] = useState('');
  const [messageSeed, setMessageSeed] = useState('');
  const [pdfPreviewing, setPdfPreviewing] = useState(false);

  useEffect(() => {
    if (!target?.reportId) {
      setClaim(null);
      setReportNo(null);
      setRecipients([]);
      setMessageText('');
      setMessageSeed('');
      setLoadError(target && !target.reportId ? 'Bu dosyada onarım raporu bulunamadı. Önce rapor oluşturun.' : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRecipients([]);
    axios
      .get(`${API}/repair-reports/${target.reportId}`, { headers: authHeader() })
      .then((res) => {
        if (cancelled) return;
        const report = res.data?.data ?? res.data ?? {};
        const claimFile = (report.claimFile ?? {}) as LoadedClaim;
        setClaim(claimFile);
        setReportNo(report.reportNo ? String(report.reportNo) : null);

        const rows = claimApprovalMailContacts({
          serviceKind: claimFile.serviceKind,
          consultancyServiceType: claimFile.consultancyServiceType,
          mailRouteJson: claimFile.mailRouteJson,
          insuranceCompany: claimFile.insuranceCompany,
          channelAgencyCustomer: claimFile.channelAgencyCustomer as never,
          channelBrokerCustomer: claimFile.channelBrokerCustomer as never,
          channelExpertCustomer: claimFile.channelExpertCustomer as never,
        });
        const withCustomer = mergeClaimApprovalCustomerCardContact(rows, claimFile.customer);
        const fallback = claimApprovalFallbackCustomerEmail(claimFile.customer?.email);
        const baseContacts = withCustomer.length > 0
          ? withCustomer
          : fallback
            ? [{ id: 'fallback:customer', name: 'Kart Adresi', role: 'Yedek alıcı', email: fallback }]
            : [];
        const contacts = mergeClaimApprovalFileOwnerContact(
          baseContacts,
          claimFile.assignedOfficeUser,
        );
        const preferred = claimApprovalMailPreviewEmails(
          claimApprovalMailPreview({
            serviceKind: claimFile.serviceKind,
            consultancyServiceType: claimFile.consultancyServiceType,
            mailRouteJson: claimFile.mailRouteJson,
            insuranceCompany: claimFile.insuranceCompany,
            channelAgencyCustomer: claimFile.channelAgencyCustomer as never,
            channelBrokerCustomer: claimFile.channelBrokerCustomer as never,
            channelExpertCustomer: claimFile.channelExpertCustomer as never,
          }),
        );
        const defaults = claimApprovalDefaultToEmailsWithCustomerCard(
          contacts,
          preferred,
          claimFile.customer?.email,
        );
        const fallbackEmails = contacts
          .filter((row) => row.id !== 'file-owner')
          .map((row) => row.email);
        const defaultEmails = (defaults.length > 0 ? defaults : fallbackEmails.slice(0, 1))
          .filter((email) =>
            contacts.some((row) => row.email.trim().toLowerCase() === email.trim().toLowerCase()),
          );
        const ensuredEmails = defaultEmails.length > 0 ? defaultEmails : fallbackEmails.slice(0, 1);
        const primaryTo = ensuredEmails[0] ?? '';
        const selectedRows = contacts
          .filter((row) => ensuredEmails.some((email) => email.trim().toLowerCase() === row.email.trim().toLowerCase()))
          .map((row) => ({
            ...row,
            delivery: (row.email.trim().toLowerCase() === primaryTo.trim().toLowerCase() ? 'to' : 'cc') as 'to' | 'cc',
          }));
        setRecipients(
          enforceSingleApprovalTo(
            withClaimApprovalFileOwnerCc(selectedRows, claimFile.assignedOfficeUser),
            primaryTo,
          ),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : 'Rapor bilgisi alınamadı';
        setLoadError(Array.isArray(msg) ? msg.join(', ') : String(msg));
        setClaim(null);
        setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const contacts = useMemo(() => {
    if (!claim) return [];
    const rows = claimApprovalMailContacts({
      serviceKind: claim.serviceKind,
      consultancyServiceType: claim.consultancyServiceType,
      mailRouteJson: claim.mailRouteJson,
      insuranceCompany: claim.insuranceCompany,
      channelAgencyCustomer: claim.channelAgencyCustomer as never,
      channelBrokerCustomer: claim.channelBrokerCustomer as never,
      channelExpertCustomer: claim.channelExpertCustomer as never,
    });
    const withCustomer = mergeClaimApprovalCustomerCardContact(rows, claim.customer);
    const base = withCustomer.length > 0
      ? withCustomer
      : (() => {
        const fallback = claimApprovalFallbackCustomerEmail(claim.customer?.email);
        return fallback
          ? [{ id: 'fallback:customer', name: 'Kart Adresi', role: 'Yedek alıcı', email: fallback }]
          : [];
      })();
    return mergeClaimApprovalFileOwnerContact(base, claim.assignedOfficeUser);
  }, [claim]);

  const mailText = useMemo(() => {
    const owner = claim?.assignedOfficeUser;
    const ownerName = `${String(owner?.firstName ?? '').trim()} ${String(owner?.lastName ?? '').trim()}`.trim();
    return claimApprovalMailTextPreview({
      serviceKind: claim?.serviceKind,
      consultancyServiceType: claim?.consultancyServiceType,
      fileNo: claim?.fileNo ?? target?.fileNo,
      reportNo,
      insuranceCompanyName: claim?.insuranceCompany?.name,
      fileSubject: resolveClaimIhbarKonusu(claim ?? {}),
      customerName: claimApprovalCustomerDisplayName(claim?.customer),
      recipientName: claimApprovalFirstToGreetingName(recipients),
      ownerName: ownerName || null,
      ownerPhone: owner?.phone ?? null,
      ownerEmail: owner?.email ?? null,
    });
  }, [claim, reportNo, target?.fileNo, recipients]);

  useEffect(() => {
    if (!target?.reportId || loading || loadError) return;
    const seed = mailText.messageText;
    if (!messageText || messageText === messageSeed) {
      setMessageText(seed);
      setMessageSeed(seed);
    }
  }, [target?.reportId, loading, loadError, mailText.messageText, messageText, messageSeed]);

  const toCount = recipients.filter((row) => row.delivery === 'to').length;
  const ccCount = recipients.filter((row) => row.delivery === 'cc').length;
  const bccCount = recipients.filter((row) => row.delivery === 'bcc').length;

  if (!target) return null;

  const openExternalPdf = async () => {
    if (!target.reportId || pdfPreviewing) return;
    setPdfPreviewing(true);
    try {
      if (!(await ensureSessionBeforeMutation())) {
        showToast('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
        return;
      }
      const res = await authAxios<Blob>({
        method: 'GET',
        url: `${API}/repair-reports/${target.reportId}/pdf?view=external`,
        responseType: 'blob',
        timeout: 120_000,
      });
      const failure = await readPdfPreviewFailure(res.data as Blob, String(res.headers['content-type'] ?? ''));
      if (failure) {
        showToast('error', failure);
        return;
      }
      const opened = await presentPdfPreview(res.data, 'Müşteri Görünümü');
      if (!opened) showToast('error', 'PDF önizleme açılamadı.');
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : e instanceof Error
          ? e.message
          : 'PDF önizleme açılamadı.';
      showToast('error', Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setPdfPreviewing(false);
    }
  };

  const submit = async () => {
    if (!target.reportId) {
      showToast('error', 'Bu dosyada onarım raporu yok — PDF oluşamaz, e-posta gönderilemez.');
      return;
    }
    let payload: { to: string[]; cc: string[]; bcc: string[] };
    try {
      payload = buildRecipientPayload(recipients);
    } catch (err: unknown) {
      showToast('warning', err instanceof Error ? err.message : 'En az bir Kime alıcısı seçilmelidir.');
      return;
    }
    setBusy(true);
    try {
      await axios.post(
        `${API}/repair-reports/${target.reportId}/request-approval`,
        {
          selectedEmails: payload.to,
          selectedCcEmails: payload.cc,
          selectedBccEmails: payload.bcc,
          messageText: messageText || mailText.messageText,
        },
        { headers: authHeader() },
      );
      showToast(
        'success',
        payload.to.length
          ? `Onaya alındı. Rapor PDF Kime adresine gönderildi: ${payload.to.join(', ')}`
          : 'Onaya alındı.',
      );
      onClose();
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : e instanceof Error
          ? e.message
          : 'E-posta gönderilemedi';
      showToast('error', Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Raporu onaya gönder"
    >
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        data-testid="ops-email-modal"
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <p className="text-[11px] font-semibold tracking-wide text-brand-600">Meridyen · Rapor Gönderimi</p>
          <h3 id="ops-email-title" className="mt-1 text-lg font-semibold text-slate-900">
            Raporu Gönder
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Dosya {target.fileNo}
            {mailText.fileSubject && mailText.fileSubject !== '—'
              ? ` · ${mailText.fileSubject}`
              : ''}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!target.reportId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Bu dosyada onarım raporu bulunamadı. Önce rapor oluşturun.
            </div>
          )}
          {loadError && target.reportId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {loadError}
            </div>
          )}
          {loading && (
            <p className="text-sm text-slate-500">Alıcılar yükleniyor…</p>
          )}

          {!loading && target.reportId && !loadError && (
            <>
              <ReportRecipientPicker
                contacts={contacts}
                value={recipients}
                onChange={setRecipients}
                disabled={busy}
                allowManual
              />

              <div>
                <p className="text-sm font-semibold text-slate-900">Konu</p>
                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {mailText.subject}
                </p>
              </div>

              <ReportApprovalMailComposeFields
                messageText={messageText || mailText.messageText}
                onMessageChange={setMessageText}
                signatureName={mailText.signatureName}
                signatureTitle={mailText.signatureTitle}
                signaturePhone={mailText.signaturePhone}
                signatureEmail={mailText.signatureEmail}
                attachmentLabel={mailText.attachmentLabel}
                reportNo={mailText.reportNo}
                disabled={busy || pdfPreviewing}
                onPreviewPdf={() => void openExternalPdf()}
              />

              <div
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
                data-testid="onaya-gonder-okundu-teyidi"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">Okundu Teyidi</p>
                  <p className="text-[11px] text-slate-500">Alıcı okuyunca iz düşer · kapatılamaz</p>
                </div>
                <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Açık
                </span>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600" aria-live="polite">
              {recipients.length} alıcı seçildi
              <span className="mt-0.5 block">
                {toCount} Kime · {ccCount} Bilgi · {bccCount} Gizli
              </span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                data-testid="ops-email-iptal"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !target.reportId || toCount === 0}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                data-testid="ops-email-submit"
              >
                {busy ? 'Gönderiliyor…' : 'Raporu Gönder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
