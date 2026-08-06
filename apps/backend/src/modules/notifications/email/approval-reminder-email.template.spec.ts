import {
  buildApprovalReminderEmailHtml,
  buildApprovalReminderEmailSubject,
  buildApprovalReminderEmailText,
} from './approval-reminder-email.template';

describe('approval-reminder-email.template', () => {
  it('konu satırı dosya no içerir', () => {
    expect(buildApprovalReminderEmailSubject('HS-100')).toContain('HS-100');
    expect(buildApprovalReminderEmailSubject('HS-100')).toContain('Onay Hatırlatması');
  });

  it('HTML atama mavisi kullanmaz; turuncu/charcoal aciliyet dili kullanır', () => {
    const html = buildApprovalReminderEmailHtml({
      recipientName: 'Ayşe Yılmaz',
      fileNo: 'HS-100',
      customerName: 'Sezgi Grup Global Sigorta Eksperlik Hizmetleri',
      insuranceCompanyName: 'Anadolu Sigorta',
      insuredName: 'Mehmet Demir',
      cityDistrict: 'İstanbul / Kadıköy',
      hoursWaiting: 96,
      actionUrl: 'https://app.example.com/panel/hasar-dosyalari/1',
    });
    expect(html).toContain('Onay Süresi Aşıldı');
    expect(html).toContain('HS-100');
    expect(html).toContain('#C2410C');
    expect(html).toContain('#1C1917');
    expect(html).toContain('/docs/meridyen-logo-original.png');
    expect(html).toContain('alt="Meridyen Asistans"');
    expect(html).toContain('Sezgi Grup Global Sigorta Eksperlik Hizmetleri');
    expect(html).toContain('Sayın Ayşe Yılmaz,');
    expect(html).toContain('HS-100 Numaralı Dosya İşlemi.');
    expect(html).not.toContain('Saattir Bekliyor');
    expect(html).toContain('72 Saat+');
    expect(html).toContain('Sigorta Şirketi');
    expect(html).toContain('Anadolu Sigorta');
    expect(html).toContain('Sigortalı Adı Soyadı');
    expect(html).toContain('Mehmet Demir');
    expect(html).toContain('İl / İlçe');
    expect(html).toContain('İstanbul / Kadıköy');
    expect(html).not.toContain('>Müşteri<');
    expect(html).toContain('Operasyon sürecinin ilerleyebilmesi için lütfen dosya durumunu netleştiriniz.');
    expect(html).toContain('Lütfen dosya durumunu netleştiriniz.');
    expect(html).toContain('Safran Birleşik Hizmetler Yan Kuruluşudur');
    expect(html).not.toContain('Meridyen Asistans Safran');
    expect(html).not.toContain('#1E5AA8');
    expect(html).not.toContain('Operasyon Bildirimi');
    expect(html).not.toContain('Yeni Atama');
  });

  it('düz metin özeti üretir', () => {
    const text = buildApprovalReminderEmailText({
      recipientName: 'Ayşe Yılmaz',
      fileNo: 'HS-100',
      customerName: 'Sezgi Grup Global Sigorta Eksperlik Hizmetleri',
      insuranceCompanyName: 'Anadolu Sigorta',
      insuredName: 'Mehmet Demir',
      cityDistrict: 'İstanbul / Kadıköy',
      hoursWaiting: 80,
    });
    expect(text).toContain('HS-100');
    expect(text).toContain('Sezgi Grup Global Sigorta Eksperlik Hizmetleri');
    expect(text).toContain('Sayın Ayşe Yılmaz,');
    expect(text).toContain('Sigorta Şirketi: Anadolu Sigorta');
    expect(text).toContain('Sigortalı Adı Soyadı: Mehmet Demir');
    expect(text).toContain('İl / İlçe: İstanbul / Kadıköy');
    expect(text).toContain('Bekleme: 72 Saat+');
    expect(text).toContain('Operasyon sürecinin ilerleyebilmesi için lütfen dosya durumunu netleştiriniz.');
    expect(text).toContain('Safran Birleşik Hizmetler Yan Kuruluşudur.');
    expect(text).not.toContain('Meridyen Asistans Safran');
  });
});
