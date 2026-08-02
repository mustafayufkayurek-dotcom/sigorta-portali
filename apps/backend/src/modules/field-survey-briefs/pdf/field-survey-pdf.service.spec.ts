import { ConfigService } from '@nestjs/config';
import { FieldSurveyPdfService, type BriefPdfData } from './field-survey-pdf.service';

describe('FieldSurveyPdfService — variant content', () => {
  const sample: BriefPdfData = {
    title: 'Mutfak Kapak Ölçüsü',
    itemType: 'kapi',
    summaryText: 'Cam kapak değişimi',
    fileNo: '15598774220001',
    claimNo: 'H-123',
    customerName: 'Ali Veli',
    address: 'Atatürk Cad. No:1 Kadıköy',
    expertName: 'Ayşe Eksper',
    dimensions: [{ label: 'Kapak', genislikCm: 60, yukseklikCm: 80, derinlikCm: null }],
    materials: [{ name: 'Cam', quantity: '1', note: null }],
    aiConfidence: 0.7,
    createdAt: new Date('2026-08-02T12:00:00Z'),
    photoDataUrl: 'data:image/png;base64,abc',
  };

  /** Supplier PDF'e asla gitmemesi gereken iletişim örnekleri (regresyon). */
  const contactLeakSample: BriefPdfData = {
    ...sample,
    address: 'Atatürk Cad. No:1 Kadıköy Tel:05551234567 email:ali@ornek.com',
  };

  let service: FieldSurveyPdfService;

  beforeEach(() => {
    service = new FieldSurveyPdfService({
      get: (key: string, def?: string) => (key === 'APP_NAME' ? 'Meridyen' : def),
    } as ConfigService);
  });

  it('internal PDF includes operational fields, logo/brand and photo', () => {
    const html = service.buildHtmlForTest(sample, 'internal');
    expect(html).toContain('Ali Veli');
    expect(html).toContain('Atatürk Cad');
    expect(html).toContain('Ayşe Eksper');
    expect(html).toContain('15598774220001');
    expect(html).toContain('H-123');
    expect(html).toContain('field-photo');
    expect(html).toContain('data:image/png;base64,abc');
    expect(html).toMatch(/header-logo|header-brand-text/);
  });

  it('supplier PDF includes insured name + work content; excludes address/expert/contact', () => {
    const html = service.buildHtmlForTest(sample, 'supplier');
    // Zorunlu: Sigortalı Adı Soyadı
    expect(html).toContain('Ali Veli');
    expect(html).toContain('Sigortalı');
    // İş içeriği
    expect(html).toContain('Cam kapak değişimi');
    expect(html).toContain('Cam');
    expect(html).toContain('Kapak');
    expect(html).toContain('field-photo');
    expect(html).toContain('Tedarikçi');
    expect(html).toMatch(/header-logo|header-brand-text/);
    // Yasak: açık adres, eksper, dosya/hasar no, destek skoru
    expect(html).not.toContain('Atatürk Cad');
    expect(html).not.toContain('Ayşe Eksper');
    expect(html).not.toContain('15598774220001');
    expect(html).not.toContain('H-123');
    expect(html).not.toContain('Destek Skoru');
    expect(html).not.toContain('Adres:');
    expect(html).not.toContain('Eksper:');
  });

  it('supplier PDF does not render address even if address field is populated', () => {
    // Service katmanı supplier için address=null gönderir; generator da address göstermemeli
    const html = service.buildHtmlForTest(
      { ...contactLeakSample, address: null, expertName: null },
      'supplier',
    );
    expect(html).toContain('Ali Veli');
    expect(html).not.toContain('05551234567');
    expect(html).not.toContain('ali@ornek.com');
    expect(html).not.toContain('Atatürk');
  });
});
