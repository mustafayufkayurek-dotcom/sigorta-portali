export const EXPERT_WHATSAPP_SUPPORT_URL = 'https://wa.me/905336330713';
export const EXPERT_WHATSAPP_SUPPORT_PHONE = '0533 633 07 13';
export const EXPERT_CALL_CENTER_PHONE = '0850 885 25 55';
export const EXPERT_CALL_CENTER_TEL = 'tel:+908508852555';
export const EXPERT_SUPPORT_EMAIL = 'info@meridyenasistans.com';

/**
 * Eksper Portalı iletişim bilgileri — WhatsApp / Çağrı Merkezi / E-posta.
 * Konum: Eksper Paneli başlığının sağında (çerçevesiz).
 */
export function ExpertPortalContactStrip({ compact = false }: { compact?: boolean }) {
  const shell = compact
    ? 'flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5 sm:gap-x-6'
    : 'flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:gap-x-10 sm:px-5';

  return (
    <div className={shell} aria-label="İletişim Bilgileri">
      <a
        href={EXPERT_WHATSAPP_SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-emerald-700"
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-8 sm:w-8"
          aria-hidden
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.523 5.853L.057 23.43a.5.5 0 00.612.63l5.79-1.518A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.06-1.377l-.363-.216-3.585.94.957-3.494-.236-.37A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-medium text-slate-500 sm:text-[11px]">WhatsApp Destek</span>
          <span className="text-xs font-semibold text-slate-900 sm:text-sm">{EXPERT_WHATSAPP_SUPPORT_PHONE}</span>
        </span>
      </a>

      <a
        href={EXPERT_CALL_CENTER_TEL}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-blue-700"
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 sm:h-8 sm:w-8"
          aria-hidden
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-medium text-slate-500 sm:text-[11px]">Çağrı Merkezi</span>
          <span className="text-xs font-semibold text-slate-900 sm:text-sm">{EXPERT_CALL_CENTER_PHONE}</span>
        </span>
      </a>

      <a
        href={`mailto:${EXPERT_SUPPORT_EMAIL}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-blue-700"
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 sm:h-8 sm:w-8"
          aria-hidden
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-medium text-slate-500 sm:text-[11px]">E-posta</span>
          <span className="text-xs font-semibold text-slate-900 sm:text-sm">{EXPERT_SUPPORT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}
