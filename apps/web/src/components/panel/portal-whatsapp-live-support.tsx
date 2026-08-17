'use client';

import { EXPERT_WHATSAPP_SUPPORT_PHONE, EXPERT_WHATSAPP_SUPPORT_URL } from '@/components/panel/expert-portal-contact-strip';

/**
 * Müşteri portalları (eksper / sigorta) — sabit WhatsApp canlı destek.
 * Numara: 0533 633 07 13
 */
export function PortalWhatsAppLiveSupport() {
  return (
    <a
      href={EXPERT_WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#1ebe57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      aria-label={`WhatsApp Canlı Destek — ${EXPERT_WHATSAPP_SUPPORT_PHONE}`}
      data-testid="portal-whatsapp-live-support"
    >
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
        aria-hidden
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.523 5.853L.057 23.43a.5.5 0 00.612.63l5.79-1.518A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.06-1.377l-.363-.216-3.585.94.957-3.494-.236-.37A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
        </svg>
      </span>
      <span className="hidden sm:inline">Canlı Destek</span>
    </a>
  );
}
