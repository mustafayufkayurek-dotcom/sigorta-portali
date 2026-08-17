import { toFieldSurveyPdfContentDisposition } from './field-survey-briefs-content-disposition.util';

describe('toFieldSurveyPdfContentDisposition', () => {
  it('ASCII-only filename in filename= part (Türkçe title)', () => {
    const raw = 'tahmini-kesif-olcusu-15598774220001-Keşif Ölçüsü.pdf';
    const header = toFieldSurveyPdfContentDisposition(raw);
    expect(header).toMatch(/^attachment; filename="[^"]*"; filename\*=UTF-8''/);
    const asciiPart = header.match(/^attachment; filename="([^"]*)"/)?.[1] ?? '';
    expect(asciiPart).toMatch(/^[\x20-\x7E]*$/);
    expect(asciiPart).not.toMatch(/[şöüğçıİŞÖÜĞÇ]/);
    expect(header).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(header.split("filename*=UTF-8''")[1])).toBe(raw);
  });

  it('falls back when filename is empty after sanitization', () => {
    const header = toFieldSurveyPdfContentDisposition('   ');
    expect(header).toContain('filename="kesif-olcusu.pdf"');
  });
});
