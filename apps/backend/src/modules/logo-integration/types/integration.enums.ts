export enum IntegrationProvider {
  LOGO_WING = 'logo_wing',
}

export enum IntegrationEntityType {
  INSURANCE_COMPANY = 'insurance_company',
  VENDOR = 'vendor',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
}

export enum IntegrationDirection {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}

export enum IntegrationOperation {
  CREATE = 'create',
  UPDATE = 'update',
  FETCH = 'fetch',
}

export enum IntegrationStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  DEAD = 'dead',
}

export enum LogoJobType {
  SYNC_ARP = 'process-arp',
  SYNC_SALES_INVOICE = 'process-sales-invoice',
  SYNC_PURCHASE_INVOICE = 'process-purchase-invoice',
  SYNC_COLLECTION = 'process-collection',
  SYNC_PAYMENT = 'process-payment',
}

export enum LogoTestStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}
