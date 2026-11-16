'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { useToast } from '@/contexts/ToastContext';
import {
  ReportRecipientPicker,
  buildRecipientPayload,
  type MailRecipient,
} from '@/components/repair-reports/ReportRecipientPicker';
import { ReportApprovalMailPreview } from '@/components/repair-reports/ReportApprovalMailPreview';
import {
  claimApprovalFallbackCustomerEmail,
  claimApprovalMailPreview,
  claimApprovalMailPreviewEmails,
} from '@/utils/claim-approval-mail-preview';
import {
  claimApprovalMailContacts,
  claimApprovalDefaultToEmails,
  claimApprovalMailTextPreview,
  mergeClaimApprovalFileOwnerContact,
  withClaimApprovalFileOwnerCc,
} from '@/utils/claim-approval-mail-contacts';
import {
  PLATFORM_MAIL_COPY_TITLE,
  resolveApprovalInformCc,
} from '@sigorta/shared';

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
  customer?: { email?: string | null } | null;
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
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [sessionUser, setSessionUser] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        email?: string;
        firstName?: string;
        lastName?: string;
      };
      setSessionUser(parsed);
    } catch {
      setSessionUser(null);
    }
  }, []);

  useEffect(() => {
    if (!target?.reportId) {
      setClaim(null);
      setReportNo(null);
      setRecipients([]);
      setStep('compose');
      setLoadError(target && !target.reportId ? 'Bu dosyada onarım raporu bulunamadı. Önce rapor oluşturun.' : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRecipients([]);
    setStep('compose');
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
        const fallback = claimApprovalFallbackCustomerEmail(claimFile.customer?.email);
        const baseContacts = rows.length > 0
          ? rows
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
        const defaults = claimApprovalDefaultToEmails(contacts, preferred);
        const defaultEmails = defaults.length > 0
          ? defaults
          : contacts
            .filter((row) => row.id !== 'file-owner')
            .slice(0, 1)
            .map((row) => row.email);
        const toRecipients = contacts
          .filter((row) => defaultEmails.some((email) => email.trim().toLowerCase() === row.email.trim().toLowerCase()))
          .map((row) => ({ ...row, delivery: 'to' as const }));
        setRecipients(
          withClaimApprovalFileOwnerCc(toRecipients, claimFile.assignedOfficeUser),
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
    const base = rows.length > 0
      ? rows
      : (() => {
        const fallback = claimApprovalFallbackCustomerEmail(claim.customer?.email);
        return fallback
          ? [{ id: 'fallback:customer', name: 'Kart Adresi', role: 'Yedek alıcı', email: fallback }]
          : [];
      })();
    return mergeClaimApprovalFileOwnerContact(base, claim.assignedOfficeUser);
  }, [claim]);

  const mailText = useMemo(() => {
    const firstTo = recipients.find((row) => row.delivery === 'to');
    const owner = claim?.assignedOfficeUser;
    const ownerName = `${String(owner?.firstName ?? '').trim()} ${String(owner?.lastName ?? '').trim()}`.trim();
    return claimApprovalMailTextPreview({
      serviceKind: claim?.serviceKind,
      consultancyServiceType: claim?.consultancyServiceType,
      fileNo: claim?.fileNo ?? target?.fileNo,
      reportNo,
      insuranceCompanyName: claim?.insuranceCompany?.name,
      fileSubject: claim?.claimSubject?.name
        ?? claim?.departmentFileSubject?.name
        ?? claim?.lossType,
      recipientName: firstTo?.name,
      ownerName: ownerName || null,
      ownerPhone: owner?.phone ?? null,
      ownerEmail: owner?.email ?? null,
    });
  }, [claim, reportNo, target?.fileNo, recipients]);

  const informCc = useMemo(
    () => resolveApprovalInformCc({
      email: sessionUser?.email,
      firstName: sessionUser?.firstName,
      lastName: sessionUser?.lastName,
      name: `${String(sessionUser?.firstName ?? '').trim()} ${String(sessionUser?.lastName ?? '').trim()}`.trim(),
    }),
    [sessionUser],
  );

  const toCount = recipients.filter((row) => row.delivery === 'to').length;
  const ccCount = recipients.filter((row) => row.delivery === 'cc').length;

  if (!target) return null;

  const submit = async () => {
    if (!target.reportId) {
      showToast('error', 'Bu dosyada onarım raporu yok — PDF oluşamaz, e-posta gönderilemez.');
      return;
    }
    let payload: { to: string[]; cc: string[] };
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
        { selectedEmails: payload.to, selectedCcEmails: payload.cc },
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
            Raporu Onaya Gönder
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

          {!loading && target.reportId && !loadError && step === 'compose' && (
            <>
              <ReportRecipientPicker
                contacts={contacts}
                value={recipients}
                onChange={setRecipients}
                disabled={busy}
                allowManual={false}
              />

              <div data-testid="onaya-gonder-mail-metni">
                <p className="text-sm font-semibold text-slate-900">Konu</p>
                <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {mailText.subject}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Gönderimden önce Önizle ile giden şablonu görün.
                </p>
              </div>

              <p className="text-xs text-slate-500" data-testid="onaya-gonder-bilgi-cc">
                {PLATFORM_MAIL_COPY_TITLE}
                {informCc ? ` · ${informCc.email}` : ''}
                {' · '}Dosya sorumlusu otomatik Bilgi alır
                {' — '}yöneticiye iç özet ayrı gider; dış e-postaya eklenmez.
              </p>

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

          {!loading && target.reportId && !loadError && step === 'preview' && (
            <ReportApprovalMailPreview
              fileNo={target.fileNo}
              fileSubject={mailText.fileSubject}
              subject={mailText.subject}
              greeting={mailText.greeting}
              body={mailText.body}
              signatureName={mailText.signatureName}
              signatureTitle={mailText.signatureTitle}
              signaturePhone={mailText.signaturePhone}
              signatureEmail={mailText.signatureEmail}
              attachmentLabel={mailText.attachmentLabel}
              reportNo={mailText.reportNo}
              toRecipients={recipients
                .filter((row) => row.delivery === 'to')
                .map((row) => ({ name: row.name, email: row.email }))}
              ccRecipients={recipients
                .filter((row) => row.delivery === 'cc')
                .map((row) => ({ name: row.name, email: row.email }))}
            />
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600" aria-live="polite">
              {recipients.length} alıcı seçildi
              <span className="mt-0.5 block">
                {toCount} Kime · {ccCount} Bilgi (Cc)
              </span>
            </p>
            <div className="flex gap-2">
              {step === 'preview' ? (
                <button
                  type="button"
                  onClick={() => setStep('compose')}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
                  data-testid="onaya-gonder-geri"
                >
                  Geri
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
                >
                  İptal
                </button>
              )}
              {step === 'compose' ? (
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={busy || !target.reportId || loading || !!loadError || toCount === 0}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  data-testid="onaya-gonder-onizle"
                >
                  Önizle
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !target.reportId || toCount === 0}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  data-testid="ops-email-submit"
                >
                  {busy ? 'Gönderiliyor…' : 'Onaya Gönder'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
