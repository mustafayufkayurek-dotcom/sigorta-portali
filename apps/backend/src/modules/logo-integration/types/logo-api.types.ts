export interface LogoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LogoArpCard {
  code: string;
  title: string;
  taxNumber?: string;
  eMailAddr?: string;
  telephoneNumber1?: string;
  address1?: string;
  accountType?: number;
  definitions?: Array<{ definition: string }>;
}

export interface LogoInvoiceLine {
  itemCode?: string;
  itemDescription?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total?: number;
}

export interface LogoSalesInvoice {
  type?: number;
  number: string;
  date: string;
  dueDate?: string;
  clCard: { code: string };
  currencyCode?: string;
  description?: string;
  grosstotal?: number;
  nettotal?: number;
  totaltax?: number;
  transactions: LogoInvoiceLine[];
}

export interface LogoPurchaseInvoice extends LogoSalesInvoice {
  // aynı yapı, farklı endpoint
}

export interface LogoFinanceSlipLine {
  invoiceNumber?: string;
  amount: number;
  currencyCode?: string;
}

export interface LogoCollectionSlip {
  date: string;
  clCard: { code: string };
  amount: number;
  currencyCode?: string;
  paymentType?: number;
  documentNumber?: string;
  bankCode?: string;
  description?: string;
  transactions?: LogoFinanceSlipLine[];
}

export interface LogoPaymentSlip extends LogoCollectionSlip {
  // aynı yapı
}

export interface LogoApiResponse<T = unknown> {
  isSuccess?: boolean;
  errorInfo?: {
    errorCode?: number;
    errorDescription?: string;
  };
  data?: T;
  value?: T;
}

export interface LogoJob {
  jobType: string;
  entityType: string;
  entityId: string;
  logId?: string;
  attempt?: number;
}
