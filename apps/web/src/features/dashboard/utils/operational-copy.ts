/**
 * Dosya Sorumlusu ekranı — operasyon dili (açıklama + aksiyon aynı işi anlatır).
 * Teknik state / enum / workflow adı ekrana çıkmaz.
 * Yalnız office_staff Bekleyen Operasyonlar UX’i için.
 */

import type { PendingOperationCategory } from './pending-operations-priority';

export type OperationalCopy = {
  /** Kısa kart başlığı */
  title: string;
  /** Kimin / hangi işlem bekleniyor */
  pendingLine: string;
  /** Dosya sorumlusunun şimdi basacağı aksiyon — satırla aynı iş */
  cta: string;
};

const COPY: Record<PendingOperationCategory, OperationalCopy> = {
  insurance_approval: {
    title: 'Sigorta Onayı',
    pendingLine: 'Sigorta şirketinden onay bekleniyor',
    cta: 'Sigortayı Hatırlat',
  },
  expert_report: {
    title: 'Eksper Raporu',
    pendingLine: 'Eksperden rapor bekleniyor',
    cta: 'Eksperi Hatırlat',
  },
  supplier_quote: {
    title: 'Tedarikçi Teklifi',
    pendingLine: 'Tedarikçiden teklif bekleniyor',
    cta: 'Tedarikçiyi Hatırlat',
  },
  customer_docs: {
    title: 'Müşteri Evrakı',
    pendingLine: 'Müşteriden evrak bekleniyor',
    cta: 'Evrak Talep Et',
  },
  finance_transfer: {
    title: 'Finansa Aktarım',
    pendingLine: 'Finansa aktarım bekleniyor',
    cta: 'Finansa Aktar',
  },
  repair_approval: {
    title: 'Onarım Onayı',
    pendingLine: 'Sizin onayınız bekleniyor',
    cta: 'Onayı İncele',
  },
  assistance: {
    title: 'Asistans İşlemi',
    pendingLine: 'Asistans işlemi bekleniyor',
    cta: 'İşleme Devam Et',
  },
  other: {
    title: 'Dosya Takibi',
    pendingLine: 'Dosyada işlem bekleniyor',
    cta: 'İşleme Devam Et',
  },
};

export function operationalCopyFor(category: PendingOperationCategory): OperationalCopy {
  return COPY[category] ?? COPY.other;
}

/** Serbest / teknik metinden kategoriye düşürüp aynı paket */
export function operationalCopyFromLooseText(raw?: string | null): OperationalCopy {
  const lower = (raw ?? '').toLocaleLowerCase('tr-TR');
  if (/external|dış onay|sigorta/.test(lower)) return COPY.insurance_approval;
  if (/submitted|eksper|rapor/.test(lower)) return COPY.expert_report;
  if (/tedarik|teklif|vendor|supplier/.test(lower)) return COPY.supplier_quote;
  if (/evrak|belge|doküman|müşteri/.test(lower)) return COPY.customer_docs;
  if (/finans|aktar|ödeme|payment/.test(lower)) return COPY.finance_transfer;
  if (/pending_approval|onarım|onay bek/.test(lower)) return COPY.repair_approval;
  if (/asistans|assistance/.test(lower)) return COPY.assistance;
  return COPY.other;
}
