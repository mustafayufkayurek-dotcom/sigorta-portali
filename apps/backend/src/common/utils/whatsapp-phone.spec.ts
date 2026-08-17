import { buildWhatsAppMeUrl, normalizeWhatsAppPhone } from './whatsapp-phone';

describe('normalizeWhatsAppPhone', () => {
  it('baştaki 0 ile TR cep normalleştirir', () => {
    expect(normalizeWhatsAppPhone('0532 647 01 18')).toBe('905326470118');
  });

  it('10 haneli cep için 90 ekler', () => {
    expect(normalizeWhatsAppPhone('5326470118')).toBe('905326470118');
  });

  it('+90 ile gelen numarayı temizler', () => {
    expect(normalizeWhatsAppPhone('+90 532 647 01 18')).toBe('905326470118');
  });

  it('zaten 90 ile başlayanı korur', () => {
    expect(normalizeWhatsAppPhone('905326470118')).toBe('905326470118');
  });

  it('çift 90 temizler', () => {
    expect(normalizeWhatsAppPhone('90905326470118')).toBe('905326470118');
  });

  it('00 önekini temizler', () => {
    expect(normalizeWhatsAppPhone('00905326470118')).toBe('905326470118');
  });

  it('+90 0532 trunk-0 hatasını düzeltir', () => {
    expect(normalizeWhatsAppPhone('+90 0532 647 01 18')).toBe('905326470118');
    expect(normalizeWhatsAppPhone('9005326470118')).toBe('905326470118');
  });

  it('fazla basamağı TR cep için kırpar', () => {
    expect(normalizeWhatsAppPhone('90532647011899')).toBe('905326470118');
  });

  it('11 haneli 5xx yapıştırmasını 10 haneye indirir', () => {
    expect(normalizeWhatsAppPhone('53264701189')).toBe('905326470118');
  });
});

describe('buildWhatsAppMeUrl', () => {
  it('api.whatsapp.com send linki üretir', () => {
    expect(buildWhatsAppMeUrl('05326470118', 'Merhaba')).toBe(
      `https://api.whatsapp.com/send?phone=905326470118&text=${encodeURIComponent('Merhaba')}`,
    );
  });

  it('wa.me kullanmaz', () => {
    expect(buildWhatsAppMeUrl('05326470118')).not.toContain('wa.me');
  });
});
