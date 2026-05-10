import { Injectable } from '@nestjs/common';
import { LogoConfigService } from './logo-config.service';
import {
  LogoArpCard,
  LogoSalesInvoice,
  LogoPurchaseInvoice,
  LogoCollectionSlip,
  LogoPaymentSlip,
} from '../types/logo-api.types';

const LOGO_CURRENCY_MAP: Record<string, string> = {
  TRY: 'TL',
  USD: 'USD',
  EUR: 'EUR',
};

const LOGO_PAYMENT_TYPE_MAP: Record<string, number> = {
  cash: 1,
  credit_card: 2,
  eft: 3,
  havale: 3,
  offset: 4,
};

@Injectable()
export class LogoMappingService {
  constructor(private readonly configService: LogoConfigService) {}

  private mapCurrency(currency: string): string {
    return LOGO_CURRENCY_MAP[currency] ?? currency;
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  private async buildArpCode(entityCode: string): Promise<string> {
    const config = await this.configService.getConfig();
    const prefix = config?.companyCodePrefix ?? 'SHS_';
    const raw = `${prefix}${entityCode}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return raw.substring(0, 16);
  }

  async mapInsuranceCompanyToArp(company: {
    code: string;
    name: string;
    taxNumber?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  }): Promise<LogoArpCard> {
    const code = await this.buildArpCode(company.code);
    return {
      code,
      title: company.name,
      taxNumber: company.taxNumber ?? undefined,
      eMailAddr: company.contactEmail ?? undefined,
      telephoneNumber1: company.contactPhone ?? undefined,
      address1: company.address ?? undefined,
      accountType: 1,
      definitions: [{ definition: 'Sigorta Şirketi' }],
    };
  }

  async mapVendorToArp(vendor: {
    name: string;
    taxNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    type?: string;
    id: string;
  }): Promise<LogoArpCard> {
    const code = await this.buildArpCode(vendor.id.substring(0, 10));
    return {
      code,
      title: vendor.name,
      taxNumber: vendor.taxNumber ?? undefined,
      telephoneNumber1: vendor.phone ?? undefined,
      eMailAddr: vendor.email ?? undefined,
      address1: vendor.address ?? undefined,
      accountType: 3,
      definitions: [{ definition: vendor.type ?? 'Tedarikçi' }],
    };
  }

  async mapInvoiceToSalesInvoice(
    invoice: {
      invoiceNo: string;
      invoiceDate: Date;
      dueDate?: Date | null;
      totalAmount: number;
      vatAmount: number;
      subtotalAmount: number;
      currency: string;
      notes?: string | null;
    },
    arpCode: string,
  ): Promise<LogoSalesInvoice> {
    return {
      number: invoice.invoiceNo,
      date: this.formatDate(invoice.invoiceDate),
      dueDate: invoice.dueDate ? this.formatDate(invoice.dueDate) : undefined,
      clCard: { code: arpCode },
      currencyCode: this.mapCurrency(invoice.currency),
      description: invoice.notes ?? undefined,
      grosstotal: invoice.totalAmount,
      nettotal: invoice.subtotalAmount,
      totaltax: invoice.vatAmount,
      transactions: [
        {
          itemCode: 'HIZMET',
          itemDescription: 'Hasar Servis Hizmeti',
          quantity: 1,
          unitPrice: invoice.subtotalAmount,
          vatRate: invoice.subtotalAmount > 0
            ? Math.round((invoice.vatAmount / invoice.subtotalAmount) * 100)
            : 20,
        },
      ],
    };
  }

  async mapInvoiceToPurchaseInvoice(
    invoice: Parameters<typeof this.mapInvoiceToSalesInvoice>[0],
    arpCode: string,
  ): Promise<LogoPurchaseInvoice> {
    return this.mapInvoiceToSalesInvoice(invoice, arpCode);
  }

  async mapPaymentToCollectionSlip(
    payment: {
      paymentDate: Date;
      amount: number;
      currency: string;
      method: string;
      referenceNo?: string | null;
    },
    arpCode: string,
    invoiceNo?: string,
  ): Promise<LogoCollectionSlip> {
    return {
      date: this.formatDate(payment.paymentDate),
      clCard: { code: arpCode },
      amount: payment.amount,
      currencyCode: this.mapCurrency(payment.currency),
      paymentType: LOGO_PAYMENT_TYPE_MAP[payment.method] ?? 3,
      documentNumber: payment.referenceNo ?? undefined,
      transactions: invoiceNo
        ? [{ invoiceNumber: invoiceNo, amount: payment.amount }]
        : undefined,
    };
  }

  async mapPaymentToPaymentSlip(
    payment: Parameters<typeof this.mapPaymentToCollectionSlip>[0],
    arpCode: string,
    invoiceNo?: string,
  ): Promise<LogoPaymentSlip> {
    return this.mapPaymentToCollectionSlip(payment, arpCode, invoiceNo);
  }
}
