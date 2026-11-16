'use client';

export type ReportApprovalMailPreviewRecipient = {
  name: string;
  email: string;
};

export type ReportApprovalMailPreviewProps = {
  fileNo: string;
  fileSubject?: string;
  subject: string;
  greeting: string;
  body: string;
  signatureName: string;
  signatureTitle: string;
  signaturePhone?: string;
  signatureEmail?: string;
  attachmentLabel: string;
  reportNo: string;
  toRecipients: ReportApprovalMailPreviewRecipient[];
  ccRecipients: ReportApprovalMailPreviewRecipient[];
};

/** Giden onay mailinin gerçek içeriği — gönderimden önce gösterilir. */
export function ReportApprovalMailPreview({
  fileNo,
  fileSubject,
  subject,
  greeting,
  body,
  signatureName,
  signatureTitle,
  signaturePhone,
  signatureEmail,
  attachmentLabel,
  reportNo,
  toRecipients,
  ccRecipients,
}: ReportApprovalMailPreviewProps) {
  return (
    <div className="space-y-3" data-testid="onaya-gonder-sablon-onizleme">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-slate-500">Gönderim Şablonu</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          Dosya {fileNo}
          {fileSubject && fileSubject !== '—' ? ` · ${fileSubject}` : ''}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Bu metin giden mail ile aynıdır. Onaya Gönder deyince bu şablon gider.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-[#102c44] px-4 py-2.5 text-xs text-[#f6f9fc]">
          Hasar Onarım Ve Restorasyon Departmanı
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-lg font-semibold text-slate-900">Dosya Değerlendirmeniz Bekleniyor</p>

          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-[11px] font-medium text-slate-500">Kime</span>
              <span className="mt-0.5 block break-all text-slate-800">
                {toRecipients.length > 0
                  ? toRecipients.map((row) => `${row.name} <${row.email}>`).join(', ')
                  : '—'}
              </span>
            </p>
            <p>
              <span className="text-[11px] font-medium text-slate-500">Bilgi (Cc)</span>
              <span className="mt-0.5 block break-all text-slate-800">
                {ccRecipients.length > 0
                  ? ccRecipients.map((row) => `${row.name} <${row.email}>`).join(', ')
                  : '—'}
              </span>
            </p>
            <p>
              <span className="text-[11px] font-medium text-slate-500">Konu</span>
              <span className="mt-0.5 block text-slate-800">{subject}</span>
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-sm font-semibold text-slate-900">{greeting}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-white text-xs font-semibold text-brand-700">
              PDF
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{attachmentLabel}</p>
              <p className="text-xs text-slate-500">Rapor No: {reportNo}</p>
              <p className="text-[11px] text-slate-500">E-posta ekinde sunulmuştur</p>
            </div>
          </div>

          <div className="border-l-2 border-slate-200 pl-3" data-testid="onaya-gonder-elektronik-imza">
            <p className="text-xs text-slate-500">Saygılarımızla,</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{signatureName}</p>
            <p className="text-xs text-slate-500">{signatureTitle}</p>
            {signaturePhone ? <p className="mt-1 text-xs text-slate-600">{signaturePhone}</p> : null}
            {signatureEmail ? <p className="text-xs text-slate-600">{signatureEmail}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
