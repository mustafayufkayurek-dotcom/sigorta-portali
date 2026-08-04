import { buildWhatsAppMeUrl, normalizeWhatsAppPhone } from './whatsapp-phone';

describe('normalizeWhatsAppPhone', () => {
  it('TR 0 ile başlayan numarayı 90 ile normalize eder', () => {
    expect(normalizeWhatsAppPhone('0532 647 01 18')).toBe('905326470118');
  });

  it('10 haneli yerel numaraya 90 ekler', () => {
    expect(normalizeWhatsAppPhone('5326470118')).toBe('905326470118');
  });

  it('+90 formatını bozmaz', () => {
    expect(normalizeWhatsAppPhone('+90 532 647 01 18')).toBe('905326470118');
  });

  it('zaten 90 ile başlayan numarayı bozmaz', () => {
    expect(normalizeWhatsAppPhone('905326470118')).toBe('905326470118');
  });

  it('çift 90 önekini temizler', () => {
    expect(normalizeWhatsAppPhone('90905326470118')).toBe('905326470118');
  });

  it('00 uluslararası önekini temizler', () => {
    expect(normalizeWhatsAppPhone('00905326470118')).toBe('905326470118');
  });
});

describe('buildWhatsAppMeUrl', () => {
  it('normalize edilmiş wa.me linki üretir', () => {
    expect(buildWhatsAppMeUrl('05326470118', 'Merhaba')).toBe(
      `https://wa.me/905326470118?text=${encodeURIComponent('Merhaba')}`,
    );
  });
});
