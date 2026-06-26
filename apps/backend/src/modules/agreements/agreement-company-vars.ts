import type { AgreementTemplateVars } from '@sigorta/shared';

/** Backend CompanyInfo → sözleşme placeholder değerleri */
export interface CompanyInfoForAgreements {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  tradeRegistryNo?: string;
  website?: string;
  kvkkEmail?: string;
  appUrl?: string;
  payrollEmployerEnabled?: boolean;
  payrollEmployerName?: string;
  payrollEmployerAddress?: string;
  payrollEmployerTaxNumber?: string;
  payrollEmployerTradeRegistryNo?: string;
  payrollEmployerPhone?: string;
  payrollEmployerEmail?: string;
}

export function companyInfoToAgreementVars(
  info: CompanyInfoForAgreements,
  fallbackAppUrl = 'https://app.meridyen-tr.com',
): AgreementTemplateVars {
  const email = (info.email ?? '').trim();
  const payrollEnabled = Boolean(info.payrollEmployerEnabled) && Boolean(info.payrollEmployerName?.trim());

  return {
    sirket_adi: (info.name ?? '').trim(),
    sirket_adres: (info.address ?? '').trim(),
    sirket_telefon: (info.phone ?? '').trim(),
    sirket_email: email,
    sirket_vergi_no: (info.taxNumber ?? '').trim(),
    sirket_ticaret_sicil: (info.tradeRegistryNo ?? '').trim(),
    sirket_web: (info.website ?? '').trim(),
    kvkk_email: (info.kvkkEmail ?? email).trim(),
    uygulama_url: (info.appUrl ?? fallbackAppUrl).trim(),
    bordro_isveren_adi: payrollEnabled ? (info.payrollEmployerName ?? '').trim() : '',
    bordro_isveren_adres: payrollEnabled ? (info.payrollEmployerAddress ?? '').trim() : '',
    bordro_isveren_vergi_no: payrollEnabled ? (info.payrollEmployerTaxNumber ?? '').trim() : '',
    bordro_isveren_ticaret_sicil: payrollEnabled ? (info.payrollEmployerTradeRegistryNo ?? '').trim() : '',
  };
}
