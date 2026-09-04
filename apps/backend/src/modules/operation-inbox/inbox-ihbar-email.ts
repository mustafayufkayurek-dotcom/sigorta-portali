import type { NotificationEmailTemplateData } from '../notifications/email/email.template';
import {
  formatNotificationCityDistrict,
  formatNotificationDateTime,
  notificationDash,
} from '../notifications/email/email-notification-tone';

export type InboxIhbarEmailSummary = {
  fileType: 'hasar' | 'acil';
  fileNo: string;
  notificationAt?: Date | string | null;
  insuranceCompanyName?: string | null;
  assistantCompanyName?: string | null;
  customerLongName?: string | null;
  fileSubject?: string | null;
  insuredName?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  actionUrl: string;
  portalUrl?: string;
};

export function inboxIhbarDepartmentLabel(fileType: 'hasar' | 'acil'): string {
  return fileType === 'acil' ? 'Acil Yardım Departmanı' : 'Hasar Departmanı';
}

export function buildInboxIhbarEmailRows(
  summary: InboxIhbarEmailSummary,
): Array<{ label: string; value: string }> {
  const companyLabel = summary.fileType === 'acil' ? 'Asistan Firması' : 'Sigorta Şirketi';
  const companyValue =
    summary.fileType === 'acil'
      ? notificationDash(summary.assistantCompanyName)
      : notificationDash(summary.insuranceCompanyName);
  const address = notificationDash(summary.address);
  const cityDistrict = formatNotificationCityDistrict(summary.city, summary.district);
  return [
    { label: 'İhbar Tarihi', value: formatNotificationDateTime(summary.notificationAt) },
    { label: companyLabel, value: companyValue },
    { label: 'Dosya No', value: notificationDash(summary.fileNo) },
    { label: 'Dosya Konusu', value: notificationDash(summary.fileSubject) },
    { label: 'Sigortalı Adı Soyadı', value: notificationDash(summary.insuredName) },
    { label: 'Adres', value: address !== '—' ? address : cityDistrict },
  ];
}

/** 1 Eylül onaylı ihbar kartı — Operasyon Bildirimi yok. */
export function buildInboxIhbarEmailTemplate(
  summary: InboxIhbarEmailSummary,
): NotificationEmailTemplateData {
  return {
    title: 'Yeni İhbar Dosyası',
    badgeLabel: inboxIhbarDepartmentLabel(summary.fileType),
    kickerLabel: '',
    bannerLead: notificationDash(summary.customerLongName),
    bodyNote: '',
    summaryTitle: 'Dosya Bilgileri',
    rows: buildInboxIhbarEmailRows(summary),
    actionUrl: summary.actionUrl,
    actionLabel: 'Dosyayı Görüntüle',
    portalUrl: summary.portalUrl,
  };
}
