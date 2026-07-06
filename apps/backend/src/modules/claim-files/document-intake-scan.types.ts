export type ParsedIntakeDocumentFields = {
  insuredName: string | null;
  insuredPhone: string | null;
  policyType: 'bireysel' | 'ticari' | null;
  commercialTitle: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  incidentDate: string | null;
  addressDetail: string | null;
  cityName: string | null;
  districtName: string | null;
  description: string | null;
  insuranceCompanyName: string | null;
  lossSubject: string | null;
};

export type IntakeDocumentScanResult = ParsedIntakeDocumentFields & {
  configured: boolean;
  message?: string;
};
