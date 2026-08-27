import {
  findInsuredMobilePhoneInText,
  resolveInsuredPhoneForInbox,
} from '@sigorta/shared';
import { extractHeuristicFields } from './inbound-heuristic-parser';

describe('inbound-heuristic-parser', () => {
  const staffPhone = '0532 174 5611';
  const insuredPhone = '0539 876 5432';
  const address = 'Kemalöz 1.Üniversite No : 51 Daire : 7 Merkez - Türkiye - Usak';

  const bodyText = `
Didem Caner
Meridyen
Tel: ${staffPhone}

KONUT HASAR İHBAR FORMU
Sigorta Ettiren Ad-Soyad: Özge Oral
Dosya No: RCS-20261805465
Poliçe No: 744875622
Referans No: 744875622
İletişim No: ${insuredPhone}
Hasar Şekli: Tesisat
Adres: ${address}
`.trim();

  it('adres içindeki iki nokta üst üste ile tam adresi çıkarır', () => {
    const fields = extractHeuristicFields({
      subject: 'Ynt: 744875622/ÖZGE ORAL/RCS-20261805465/TESİSAT',
      bodyText,
      bodyPreview: null,
      bodyHtml: null,
    });
    expect(fields.address).toBe(address);
  });

  it('yanıt zincirindeki personel telefonunu değil form İletişim No alanını alır', () => {
    const fields = extractHeuristicFields({
      subject: 'Ynt: 744875622/ÖZGE ORAL/RCS-20261805465/TESİSAT',
      bodyText,
      bodyPreview: null,
      bodyHtml: null,
    });
    expect(fields.phone).toContain('539');
    expect(fields.phone).not.toContain('174');
  });

  it('resolveInsuredPhoneForInbox heuristic önceliğini korur', () => {
    const resolved = resolveInsuredPhoneForInbox({
      heuristicPhone: insuredPhone,
      extractedPhone: staffPhone,
      bodyText,
    });
    expect(resolved).toContain('539');
  });

  it('resolveInsuredPhoneForInbox form etiketini AI çıkarımından önce alır', () => {
    const resolved = resolveInsuredPhoneForInbox({
      heuristicPhone: undefined,
      extractedPhone: staffPhone,
      bodyText,
    });
    expect(resolved).toContain('539');
    expect(resolved).not.toContain('174');
  });

  it('findInsuredMobilePhoneInText form gövdesindeki numarayı seçer', () => {
    const found = findInsuredMobilePhoneInText(bodyText);
    expect(found).toContain('539');
    expect(found).not.toContain('174');
  });

  it('Dosya No alanındaki sigorta markasını konu satırındaki numarayla değiştirir', () => {
    const fields = extractHeuristicFields({
      subject: 'EUREKO 26645495 ILKNUR YILMAZ',
      bodyText: `
Sigorta şirketi: EUREKO
Poliçe No: 89046645
Dosya No: EUREKO
Sigortalı: İLKNUR YILMAZ
`.trim(),
      bodyPreview: null,
      bodyHtml: null,
    });
    expect(fields.fileNo).toBe('26645495');
    expect(fields.fileNoWarning).toContain('26645495');
  });

  it('Dosya No alanındaki poliçe numarasını konu satırındaki gerçek numarayla değiştirir', () => {
    const fields = extractHeuristicFields({
      subject: 'EUREKO 26645495 ILKNUR YILMAZ',
      bodyText: `
Sigorta şirketi: EUREKO
Poliçe No: 89046645
Dosya No: 89046645
Sigortalı: İLKNUR YILMAZ
`.trim(),
      bodyPreview: null,
      bodyHtml: null,
    });
    expect(fields.fileNo).toBe('26645495');
    expect(fields.fileNoWarning).toMatch(/poliçe/i);
  });

  it('Remed Dosya No alanındaki poliçe numarasını konu satırındaki RCS ile değiştirir', () => {
    const fields = extractHeuristicFields({
      subject: 'Ynt: 1619479924/KARAKOL KARDEŞLER OTOMOTİV/RCS-20261854032/CAM',
      bodyText: `
Sigorta Ettiren Ad-Soyad: Karakol Kardeşler Otomotiv
Dosya No: 1619479924
Poliçe No: 1619479924
Adres: Sandıklı / Afyon
`.trim(),
      bodyPreview: null,
      bodyHtml: null,
    });
    expect(fields.fileNo).toBe('RCS-20261854032');
    expect(fields.fileNoWarning).toMatch(/RCS-20261854032/);
  });
});
