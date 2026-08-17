import {
  resolveApproval72hCustomerEmailPayload,
  resolveCustomerReminderEmail,
} from './approval-72h-customer-email.rule';

describe('approval-72h-customer-email.rule', () => {
  const validSource = {
    fileNo: 'HS-100',
    insuredName: 'Mehmet Demir',
    customer: {
      email: 'musteri@sezgi.com',
      companyName: 'Sezgi Grup Global Sigorta Eksperlik Hizmetleri',
      contactFirstName: 'Ayşe',
      contactLastName: 'Yılmaz',
    },
    insuranceCompany: {
      name: 'Anadolu Sigorta',
      contactEmail: 'onay@anadolu.com',
    },
    propertyAddress: { city: 'İstanbul', district: 'Kadıköy' },
  };

  it('geçerli kaynakta müşteri e-postası ve dosya özetini üretir', () => {
    const result = resolveApproval72hCustomerEmailPayload(validSource);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.recipientEmail).toBe('musteri@sezgi.com');
    expect(result.payload.customerName).toContain('Sezgi Grup');
    expect(result.payload.insuranceCompanyName).toBe('Anadolu Sigorta');
    expect(result.payload.insuredName).toBe('Mehmet Demir');
    expect(result.payload.cityDistrict).toBe('İstanbul / Kadıköy');
    expect(result.payload.recipientName).toBe('Ayşe Yılmaz');
  });

  it('müşteri e-postası yoksa sigorta e-postasına düşmez', () => {
    const result = resolveApproval72hCustomerEmailPayload({
      ...validSource,
      customer: {
        ...validSource.customer,
        email: null,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Müşteri e-posta/);
    expect(resolveCustomerReminderEmail({
      email: null,
      contacts: [],
    })).toBeNull();
  });

  it('sigorta şirketi adı müşteri ünvanı olarak kullanılmaz', () => {
    const result = resolveApproval72hCustomerEmailPayload({
      ...validSource,
      customer: {
        email: 'musteri@sezgi.com',
        companyName: null,
        shortName: null,
        fullName: null,
        firstName: null,
        lastName: null,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Müşteri ünvanı/);
  });

  it('sigortalı / il-ilçe / sigorta şirketi eksikse göndermez', () => {
    expect(resolveApproval72hCustomerEmailPayload({
      ...validSource,
      insuredName: null,
    }).ok).toBe(false);
    expect(resolveApproval72hCustomerEmailPayload({
      ...validSource,
      propertyAddress: { city: null, district: null },
    }).ok).toBe(false);
    expect(resolveApproval72hCustomerEmailPayload({
      ...validSource,
      insuranceCompany: { name: null, contactEmail: 'x@y.com' },
    }).ok).toBe(false);
  });

  it('geçersiz e-posta formatını reddeder', () => {
    const result = resolveApproval72hCustomerEmailPayload({
      ...validSource,
      customer: { ...validSource.customer, email: 'degil-email' },
    });
    expect(result.ok).toBe(false);
  });

  it('birincil müşteri iletişimi e-postasını kullanabilir', () => {
    const result = resolveApproval72hCustomerEmailPayload({
      ...validSource,
      customer: {
        ...validSource.customer,
        email: null,
        contacts: [
          { email: 'ikincil@sezgi.com', isPrimary: false },
          { email: 'birincil@sezgi.com', isPrimary: true },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.recipientEmail).toBe('birincil@sezgi.com');
  });
});
