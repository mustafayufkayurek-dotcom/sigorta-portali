'use client';

/** Yazım adımı — mesaj (imza içinde), PDF eki. Mail şablon önizlemesi yok. */
export function ReportApprovalMailComposeFields({
  messageText,
  onMessageChange,
  signatureName,
  signatureTitle,
  signaturePhone,
  signatureEmail,
  attachmentLabel,
  reportNo,
  onPreviewPdf,
  disabled,
}: {
  messageText: string;
  onMessageChange: (value: string) => void;
  signatureName: string;
  signatureTitle: string;
  signaturePhone?: string;
  signatureEmail?: string;
  attachmentLabel: string;
  reportNo: string;
  onPreviewPdf?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="onaya-gonder-mail-metni">
      <div data-testid="onaya-gonder-mesaj">
        <label htmlFor="onaya-gonder-mesaj-alani" className="text-sm font-semibold text-slate-900">
          Mesaj
        </label>
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500">
          <textarea
            id="onaya-gonder-mesaj-alani"
            value={messageText}
            onChange={(event) => onMessageChange(event.target.value)}
            disabled={disabled}
            rows={5}
            className="w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-800 focus-visible:outline-none disabled:opacity-60"
          />
          <div
            className="border-t border-slate-100 bg-slate-50 px-3 py-2.5"
            data-testid="onaya-gonder-elektronik-imza"
          >
            <p className="text-xs text-slate-500">Saygılarımızla,</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{signatureName}</p>
            <p className="text-xs text-slate-500">{signatureTitle}</p>
            {signaturePhone ? <p className="mt-1 text-xs text-slate-700">{signaturePhone}</p> : null}
            {signatureEmail ? <p className="text-xs text-slate-700">{signatureEmail}</p> : null}
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">PDF Eki</p>
        {onPreviewPdf ? (
          <button
            type="button"
            onClick={onPreviewPdf}
            data-testid="onaya-gonder-pdf-onizle"
            className="mt-1 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-brand-700">
              PDF
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">{attachmentLabel}</span>
              <span className="block text-xs text-slate-500">Rapor No: {reportNo}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-brand-700">PDF Önizle</span>
            </span>
          </button>
        ) : (
          <div className="mt-1 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-brand-700">
              PDF
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{attachmentLabel}</span>
              <span className="block text-xs text-slate-500">Rapor No: {reportNo}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
