import { BadRequestException } from '@nestjs/common';
import { ReportEmailService } from './report-email.service';

describe('ReportEmailService PDF attach chain', () => {
  const config = {
    get: (key: string) => {
      if (key === 'SMTP_HOST') return undefined;
      return undefined;
    },
  };

  const service = new ReportEmailService(config as any);

  it('rejects empty PDF — never send without attachment', async () => {
    await expect(
      service.sendReport({
        to: 'a@b.com',
        subject: 't',
        pdfBuffer: Buffer.alloc(0),
        reportNo: 'R-1',
        viewType: 'external',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid recipient', async () => {
    await expect(
      service.sendReport({
        to: 'not-an-email',
        subject: 't',
        pdfBuffer: Buffer.from('%PDF-1.4'),
        reportNo: 'R-1',
        viewType: 'external',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('staging-no-smtp: PDF chain ok, success false, pdfAttached true', async () => {
    const pdf = Buffer.from('%PDF-1.4 mock');
    const result = await service.sendReport({
      to: 'sigorta@example.com',
      subject: 'Rapor',
      pdfBuffer: pdf,
      reportNo: 'R-99',
      viewType: 'external',
    });
    expect(result.pdfAttached).toBe(true);
    expect(result.pdfBytes).toBe(pdf.length);
    expect(result.mode).toBe('staging-no-smtp');
    expect(result.success).toBe(false);
    expect(result.to).toBe('sigorta@example.com');
  });
});
