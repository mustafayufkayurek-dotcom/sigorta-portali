import {
  INVOICE_REQUEST_TELEGRAM_ACTION,
  buildInvoiceRequestTelegramPayload,
  formatInvoiceAmountTr,
  formatInvoiceRequestKonuLine,
  isInvoiceRequestNotifyRole,
  resolveInvoiceCustomerShortName,
} from './invoice-request-telegram.rule';

describe('invoice-request-telegram.rule', () => {
  it('tutar TR + KDV soneki', () => {
    expect(formatInvoiceAmountTr(12500)).toBe('12.500,00 TL KDV');
  });

  it('tekli konu satırı', () => {
    expect(
      formatInvoiceRequestKonuLine({
        fileNo: 'HS-1001',
        customerShortName: 'Acme',
        totalAmount: 12500,
      }),
    ).toBe('HS-1001 Nolu Acme fatura talebi. Dosya bedeli: 12.500,00 TL KDV.');
  });

  it('tekli payload — Etki yok, aksiyon sabit', () => {
    const payload = buildInvoiceRequestTelegramPayload(
      [{ fileNo: 'HS-1001', customerShortName: 'Acme', totalAmount: 1000 }],
      { at: new Date('2026-08-11T10:00:00+03:00') },
    );
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('🟠 UYARI | FATURA TALEBİ');
    expect(payload!.text).toContain(
      '<b>Konu</b>: HS-1001 Nolu Acme fatura talebi. Dosya bedeli: 1.000,00 TL KDV.',
    );
    expect(payload!.action).toBe(INVOICE_REQUEST_TELEGRAM_ACTION);
    expect(payload!.text).toContain(`<b>Aksiyon</b>: ${INVOICE_REQUEST_TELEGRAM_ACTION}`);
    expect(payload!.text).not.toContain('Etki');
    expect(payload!.text).not.toContain('Durum');
  });

  it('çoklu listeli konu', () => {
    const payload = buildInvoiceRequestTelegramPayload([
      { fileNo: 'HS-1', customerShortName: 'A', totalAmount: 100 },
      { fileNo: 'HS-2', customerShortName: 'B', totalAmount: 200 },
    ]);
    expect(payload!.title).toContain('1- HS-1 Nolu A fatura talebi.');
    expect(payload!.title).toContain('2- HS-2 Nolu B fatura talebi.');
  });

  it('müşteri kısa ad + finans roller', () => {
    expect(resolveInvoiceCustomerShortName({ shortName: 'X', companyName: 'Y' })).toBe('X');
    expect(isInvoiceRequestNotifyRole('finance')).toBe(true);
    expect(isInvoiceRequestNotifyRole('FINANCE')).toBe(true);
    expect(isInvoiceRequestNotifyRole('FINANS')).toBe(true);
    expect(isInvoiceRequestNotifyRole('admin')).toBe(true);
    expect(isInvoiceRequestNotifyRole('office_staff')).toBe(false);
  });
});
