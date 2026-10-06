/** Onarım yapılmadan kapanış — duran bütçe / hakediş / fatura talebi. Yeni kuyruk yok. */

export const CLOSE_BILLABLE_QUESTION = 'Fatura Edilecek Masraf / Hizmet Var mı?';

export type HasarKapanisButce = {
  remainingRepairDropped: boolean;
  hasBillable: boolean | null;
  customerAgreed: boolean;
  infoWhatsappAt: string | null;
  closeBudgetStartedAt: string | null;
};

export const EMPTY_HASAR_KAPANIS_BUTCE: HasarKapanisButce = {
  remainingRepairDropped: false,
  hasBillable: null,
  customerAgreed: false,
  infoWhatsappAt: null,
  closeBudgetStartedAt: null,
};

export function parseHasarKapanisButce(raw: unknown): HasarKapanisButce {
  let obj: Record<string, unknown> | null = null;
  if (raw && typeof raw === 'object') obj = raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      obj = null;
    }
  }
  if (!obj) return { ...EMPTY_HASAR_KAPANIS_BUTCE };
  const hasBillable =
    obj.hasBillable === true ? true : obj.hasBillable === false ? false : null;
  return {
    remainingRepairDropped: Boolean(obj.remainingRepairDropped),
    hasBillable,
    customerAgreed: Boolean(obj.customerAgreed),
    infoWhatsappAt: typeof obj.infoWhatsappAt === 'string' && obj.infoWhatsappAt.trim()
      ? obj.infoWhatsappAt
      : null,
    closeBudgetStartedAt:
      typeof obj.closeBudgetStartedAt === 'string' && obj.closeBudgetStartedAt.trim()
        ? obj.closeBudgetStartedAt
        : null,
  };
}

export function serializeHasarKapanisButce(state: HasarKapanisButce): string {
  return JSON.stringify({
    remainingRepairDropped: Boolean(state.remainingRepairDropped),
    hasBillable: state.hasBillable,
    customerAgreed: Boolean(state.customerAgreed),
    infoWhatsappAt: state.infoWhatsappAt,
    closeBudgetStartedAt: state.closeBudgetStartedAt,
  });
}

export function hasarKapanisCloseMissing(input: {
  remainingRepairDropped: boolean;
  hasBillable: boolean | null;
  customerAgreed: boolean;
  infoWhatsappAt?: string | null;
  closeBudgetStartedAt?: string | null;
  hasInvoiceRequest: boolean;
}): string[] {
  if (!input.remainingRepairDropped) return [];
  if (input.hasBillable === null) return ['Fatura edilecek masraf / hizmet sorusu'];
  if (input.hasBillable === false) return [];
  const missing: string[] = [];
  if (!input.closeBudgetStartedAt) missing.push('Kapanış bütçesi');
  if (!input.customerAgreed) missing.push('Müşteri mutabık');
  if (!String(input.infoWhatsappAt ?? '').trim()) missing.push('Tahsilat bilgi yazısı');
  if (!input.hasInvoiceRequest) missing.push('Fatura talebi');
  return missing;
}

export function buildKapanisTahsilatWhatsAppMessage(input: {
  insuredName: string;
  fileNo: string;
}): string {
  const name = String(input.insuredName ?? '').trim() || 'İlgili';
  const fileNo = String(input.fileNo ?? '').trim() || '—';
  return [
    `Sayın ${name},`,
    `${fileNo} sayılı dosyada kalan onarım yapılmayacaktır.`,
    'Kararlaştırılan tutar tarafınıza ayrıca bildirilir.',
    'Söz konusu talep olağan prosedür kapsamındadır.',
  ].join(' ');
}
