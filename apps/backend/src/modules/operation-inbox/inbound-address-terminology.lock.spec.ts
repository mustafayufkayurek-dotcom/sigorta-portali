import {
  collectInboundPlainText,
  decodeInboundEmailText,
  extractInboundFormFields,
  getInboundFormFieldValue,
  INBOUND_ADDRESS_FIELD_LABELS,
  mapInboundLossTypeToMeridyen,
} from '@sigorta/shared';
import { sanitizeInboundLossType } from '@/common/helpers/ihbar-konusu.helper';

describe('inbound address + terminology locks', () => {
  it('HTML tablo hücresinden Adres değerini çıkarır', () => {
    const html = `
      <table>
        <tr><td>Sigorta Ettiren Ad-Soyad</td><td>Fehmi Öz</td></tr>
        <tr><td>Dosya No</td><td>RCS-20261822585</td></tr>
        <tr><td>Hasar Şekli</td><td>Tesisat</td></tr>
        <tr><td>Adres</td><td>Erciş Mah. No: 12 Başkale / Van</td></tr>
      </table>
    `;
    const text = decodeInboundEmailText(html);
    const fields = extractInboundFormFields(text);
    expect(getInboundFormFieldValue(fields, ...INBOUND_ADDRESS_FIELD_LABELS)).toBe(
      'Erciş Mah. No: 12 Başkale / Van',
    );
  });

  it('eksik bodyText olsa bile bodyHtml adresini toplar', () => {
    const plain = collectInboundPlainText({
      bodyText: 'Ynt: kısa özet — form yok',
      bodyHtml: `
        <p>KONUT HASAR İHBAR FORMU</p>
        <table>
          <tr><td>Adres</td><td>Atatürk Cad. No: 5 Merkez / Uşak</td></tr>
          <tr><td>Hasar Şekli</td><td>Cam Kırığı</td></tr>
        </table>
      `,
    });
    const fields = extractInboundFormFields(plain);
    expect(getInboundFormFieldValue(fields, ...INBOUND_ADDRESS_FIELD_LABELS)).toContain('Atatürk');
    expect(getInboundFormFieldValue(fields, 'Hasar Şekli')).toBe('Cam Kırığı');
  });

  it('Cam Kırığı → Cam Kırılması kilitli eşlemesi', () => {
    expect(mapInboundLossTypeToMeridyen('Cam Kırığı')).toBe('Cam Kırılması');
    expect(mapInboundLossTypeToMeridyen('cam kirigi')).toBe('Cam Kırılması');
    expect(mapInboundLossTypeToMeridyen('CAM KIRIK')).toBe('Cam Kırılması');
    expect(sanitizeInboundLossType('Cam Kırığı', 'Konut Cam')).toBe('Cam Kırılması');
  });
});
