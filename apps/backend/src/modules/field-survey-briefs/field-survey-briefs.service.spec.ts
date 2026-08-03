// uuid v14 ESM-only paket; jest CJS transform ile çakışıyor — testte sahte v4 yeterli.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { FieldSurveyBriefsService } from './field-survey-briefs.service';

describe('FieldSurveyBriefsService — generatePdf sigortalı adı mapping', () => {
  const baseClaimFile = {
    fileNo: '15598774220001',
    claimNo: 'H-123',
    policyNo: 'POL-9',
    insuredPhone: null,
    insuredName: 'Gerçek Sigortalı Adı',
    propertyAddress: null,
    insuranceCompany: { name: 'Örnek Sigorta' },
    customer: {
      fullName: null,
      companyName: 'M-Nihal Sigorta Ekspertiz',
      phone: '05559998877',
      email: 'ekspertiz@ornek.com',
    },
  };

  const baseBrief = {
    id: 'brief-1',
    claimFileId: 'cf-1',
    title: 'Mutfak Kapak Ölçüsü',
    itemType: 'kapi',
    summaryText: 'Cam kapak değişimi',
    dimensionsJson: [],
    materialsJson: [],
    aiConfidence: 0.7,
    photoUrl: null,
    annotatedPhotoUrl: null,
    createdAt: new Date('2026-08-02T12:00:00Z'),
    createdByUser: { firstName: 'Ayşe', lastName: 'Eksper', phone: null, email: null },
    claimFile: baseClaimFile,
  };

  function buildService(generateMock: jest.Mock) {
    const prisma = {} as any;
    const storage = {} as any;
    const config = { get: () => undefined } as any;
    const pdfService = { generate: generateMock } as any;
    const auditLogs = {} as any;

    const service = new FieldSurveyBriefsService(prisma, storage, config, pdfService, auditLogs);
    jest.spyOn(service as any, 'findOne').mockResolvedValue(baseBrief);
    jest.spyOn(service as any, 'resolvePhotoDataUrl').mockResolvedValue(null);
    return service;
  }

  it('supplier PDF: customerName gerçek sigortalıdan gelir, eksper/CRM kurumsal müşteri adı sızmaz', async () => {
    const generateMock = jest.fn().mockResolvedValue(Buffer.from('pdf'));
    const service = buildService(generateMock);

    await service.generatePdf('cf-1', 'brief-1', 'supplier');

    const [data] = generateMock.mock.calls[0];
    expect(data.customerName).toBe('Gerçek Sigortalı Adı');
    expect(data.customerName).not.toContain('Ekspertiz');
    expect(data.customerPhone).toBeNull();
    expect(data.customerEmail).toBeNull();
    expect(data.expertName).toBeNull();
    expect(data.fileNo).toBe('');
    expect(data.claimNo).toBeNull();
    expect(data.policyNo).toBeNull();
    expect(data.aiConfidence).toBeNull();
  });

  it('internal PDF: customerName da gerçek sigortalıdan gelir (insuredName önceliklidir)', async () => {
    const generateMock = jest.fn().mockResolvedValue(Buffer.from('pdf'));
    const service = buildService(generateMock);

    await service.generatePdf('cf-1', 'brief-1', 'internal');

    const [data] = generateMock.mock.calls[0];
    expect(data.customerName).toBe('Gerçek Sigortalı Adı');
    expect(data.fileNo).toBe('15598774220001');
  });

  it('insuredName boşsa customer kaydına düşer (geriye dönük uyumluluk)', async () => {
    const generateMock = jest.fn().mockResolvedValue(Buffer.from('pdf'));
    const service = buildService(generateMock);
    (service as any).findOne = jest.fn().mockResolvedValue({
      ...baseBrief,
      claimFile: { ...baseClaimFile, insuredName: null },
    });

    await service.generatePdf('cf-1', 'brief-1', 'supplier');

    const [data] = generateMock.mock.calls[0];
    expect(data.customerName).toBe('M-Nihal Sigorta Ekspertiz');
  });
});
