import { buildNotificationEmailHtml } from '../notifications/email/email.template';
import {
  buildInboxIhbarEmailRows,
  buildInboxIhbarEmailTemplate,
  inboxIhbarDepartmentLabel,
} from './inbox-ihbar-email';

describe('inbox ihbar email', () => {
  it('uses approved Hasar Departmanı row order', () => {
    expect(inboxIhbarDepartmentLabel('hasar')).toBe('Hasar Departmanı');
    expect(inboxIhbarDepartmentLabel('acil')).toBe('Acil Yardım Departmanı');
    const rows = buildInboxIhbarEmailRows({
      fileType: 'hasar',
      fileNo: 'RCS-20261868899',
      notificationAt: new Date('2026-08-31T16:42:00+03:00'),
      insuranceCompanyName: 'Ray Sigorta',
      fileSubject: 'Tesisat',
      insuredName: 'Yunus Emre Kurt',
      city: 'İstanbul',
      district: 'Kadıköy',
      address: 'Caferağa Mah. Moda Cad. No:12 Kadıköy / İstanbul',
      actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/ornek',
    });
    expect(rows.map((row) => row.label)).toEqual([
      'İhbar Tarihi',
      'Sigorta Şirketi',
      'Dosya No',
      'Dosya Konusu',
      'Sigortalı Adı Soyadı',
      'Adres',
    ]);
    expect(rows[1]?.value).toBe('Ray Sigorta');
    expect(rows[2]?.value).toBe('RCS-20261868899');
    expect(rows[5]?.value).toBe('Caferağa Mah. Moda Cad. No:12 Kadıköy / İstanbul');
  });

  it('renders Acil Yeni İhbar with person name not assistant title', () => {
    const rows = buildInboxIhbarEmailRows({
      fileType: 'acil',
      fileNo: 'RCS-20261877741',
      notificationAt: new Date('2026-09-07T08:48:00+03:00'),
      assistantCompanyName: 'Remed Assistance',
      fileSubject: 'Konut Cam',
      insuredName: 'Ayşe Yılmaz',
      city: 'Bolu',
      district: 'Merkez',
      address: 'Borazanlar 413 Özyıl Apt. No : 4 Daire : 2 Merkez - Türkiye - Bolu',
      actionUrl: 'https://app.meridyen-tr.com/panel/acil-yardim/ornek',
    });
    expect(rows.map((row) => row.label)).toEqual([
      'İhbar Tarihi',
      'Asistan Firması',
      'Dosya No',
      'Dosya Konusu',
      'Sigortalı Adı Soyadı',
      'Adres',
    ]);
    expect(rows[1]?.value).toBe('Remed Assistance');
    expect(rows[4]?.value).toBe('Ayşe Yılmaz');
    expect(rows[4]?.value).not.toBe('—');
    expect(rows[5]?.value).toBe(
      'Borazanlar 413 Özyıl Apt. No : 4 Daire : 2 · Merkez · Bolu',
    );
    expect(rows[5]?.value).not.toContain('Türkiye');
  });

  it('ihbar mailinde adres sonda ilçe ve il ile biter', () => {
    const rows = buildInboxIhbarEmailRows({
      fileType: 'acil',
      fileNo: 'RCS-20261880964',
      assistantCompanyName: 'Remed Assistance',
      fileSubject: 'Konut Cam',
      insuredName: 'Hacer Neşe Gürgen',
      city: 'Isparta',
      district: 'Atabey',
      address:
        'Yeni Abdullah Aykon Dogan 4 Toki Sit. Toki Dk2 1 Toki Dk2 1 No : 6 /1 Daire : 9 Atabey - Türkiye - Isparta',
      actionUrl: 'https://app.meridyen-tr.com/panel/acil-yardim/ornek',
    });
    expect(rows[5]?.value).toBe(
      'Yeni Abdullah Aykon Dogan 4 Toki Sit. Toki Dk2 1 Toki Dk2 1 No : 6 /1 Daire : 9 · Atabey · Isparta',
    );
    expect(rows[5]?.value).not.toMatch(/Türkiye|Turkiye/i);
  });

  it('renders approved Yeni İhbar kartı without Operasyon Bildirimi', () => {
    const html = buildNotificationEmailHtml(
      buildInboxIhbarEmailTemplate({
        fileType: 'hasar',
        fileNo: 'RCS-20261868899',
        notificationAt: new Date('2026-08-31T16:42:00+03:00'),
        insuranceCompanyName: 'Ray Sigorta',
        customerLongName: 'Ray Sigorta A.Ş.',
        fileSubject: 'Tesisat',
        insuredName: 'Yunus Emre Kurt',
        address: 'Caferağa Mah. Moda Cad. No:12 Kadıköy / İstanbul',
        actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/ornek',
        portalUrl: 'https://app.meridyen-tr.com/giris',
      }),
    );
    expect(html).toContain('Yeni İhbar Dosyası');
    expect(html).toContain('Hasar Departmanı');
    expect(html).toContain('Ray Sigorta A.Ş.');
    expect(html).toContain('Dosya Bilgileri');
    expect(html).toContain('Dosyayı Görüntüle');
    expect(html).toContain('width="120"');
    expect(html).not.toContain('Operasyon Bildirimi');
    expect(html).not.toContain('Yeni Hasar Dosyası');
  });
});
