import { ConfigService } from '@nestjs/config';
import { FieldSurveyPdfService, type BriefPdfData } from './field-survey-pdf.service';

describe('FieldSurveyPdfService — variant content', () => {
  const sample: BriefPdfData = {
    title: 'Mutfak Kapak Ölçüsü',
    itemType: 'kapi',
    summaryText: 'Cam kapak değişimi',
    fileNo: '15598774220001',
    claimNo: 'H-123',
    policyNo: 'POL-9',
    customerName: 'Ali Veli',
    customerPhone: '05551234567',
    customerEmail: 'ali@ornek.com',
    address: 'Atatürk Cad. No:1 Kadıköy',
    expertName: 'Ayşe Eksper',
    expertPhone: '05321112233',
    expertEmail: 'ayse@ornek.com',
    dimensions: [{ label: 'Kapak', genislikCm: 60, yukseklikCm: 80, derinlikCm: null }],
    materials: [{ name: 'Cam', quantity: '1', note: null }],
    aiConfidence: 0.7,
    createdAt: new Date('2026-08-02T12:00:00Z'),
    photoDataUrl: 'data:image/png;base64,abc',
  };

  let service: FieldSurveyPdfService;

  beforeEach(() => {
    service = new FieldSurveyPdfService({
      get: (key: string, def?: string) => (key === 'APP_NAME' ? 'Meridyen' : def),
    } as ConfigService);
  });

  it('internal PDF includes full ops fields, logo right header and photo', () => {
    const html = service.buildHtmlForTest(sample, 'internal');
    expect(html).toContain('justify-content: flex-end');
    expect(html).toContain('Ali Veli');
    expect(html).toContain('Atatürk Cad');
    expect(html).toContain('Ayşe Eksper');
    expect(html).toContain('15598774220001');
    expect(html).toContain('H-123');
    expect(html).toContain('POL-9');
    expect(html).toContain('05551234567');
    expect(html).toContain('field-photo');
    expect(html).toMatch(/header-logo|header-brand-text/);
  });

  it('supplier PDF keeps insured name and work; strips contact/address/file/expert', () => {
    const html = service.buildHtmlForTest(sample, 'supplier');
    expect(html).toContain('Ali Veli');
    expect(html).toContain('Sigortalı');
    expect(html).toContain('Cam kapak değişimi');
    expect(html).toContain('Cam');
    expect(html).toContain('field-photo');
    expect(html).toContain('justify-content: flex-end');

    expect(html).not.toContain('Atatürk Cad');
    expect(html).not.toContain('Ayşe Eksper');
    expect(html).not.toContain('15598774220001');
    expect(html).not.toContain('H-123');
    expect(html).not.toContain('POL-9');
    expect(html).not.toContain('05551234567');
    expect(html).not.toContain('ali@ornek.com');
    expect(html).not.toContain('05321112233');
    expect(html).not.toContain('ayse@ornek.com');
    expect(html).not.toContain('Destek Skoru');
  });
});
