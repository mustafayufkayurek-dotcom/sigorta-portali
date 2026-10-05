import type { NotificationEmailTemplateData } from '../notifications/email/email.template';
import { formatIhbarMailAddress } from '@sigorta/shared';
import { toTitleCaseTR } from '@/common/utils/text-helpers';
import {
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
  /** Atayan kişinin Kullanıcılar’daki Görev yazısı */
  assignedByJobTitle?: string | null;
};

export const HASAR_ASSIGNED_BY_HEADING_SUFFIX = 'Tarafından Atanmıştır';

/** Görev: Operasyon Direktörü → Operasyon Direktörü Tarafından Atanmıştır */
export function hasarAssignedByHeading(jobTitle?: string | null): string | undefined {
  const raw = String(jobTitle ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return undefined;
  const duty = toTitleCaseTR(raw).replace(/\s+tarafından\s+atanmıştır\.?$/i, '').trim();
  if (!duty) return undefined;
  return `${duty} ${HASAR_ASSIGNED_BY_HEADING_SUFFIX}`;
}

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
  const address = formatIhbarMailAddress({
    address: summary.address,
    district: summary.district,
    city: summary.city,
  });
  return [
    { label: 'İhbar Tarihi', value: formatNotificationDateTime(summary.notificationAt) },
    { label: companyLabel, value: companyValue },
    { label: 'Dosya No', value: notificationDash(summary.fileNo) },
    { label: 'Dosya Konusu', value: notificationDash(summary.fileSubject) },
    { label: 'Sigortalı Adı Soyadı', value: notificationDash(summary.insuredName) },
    { label: 'Adres', value: address },
  ];
}

/** 1 Eylül onaylı ihbar kartı — Operasyon Bildirimi yok. */
export function buildInboxIhbarEmailTemplate(
  summary: InboxIhbarEmailSummary,
): NotificationEmailTemplateData {
  return {
    title: 'Yeni İhbar Dosyası',
    titleSuffix: hasarAssignedByHeading(summary.assignedByJobTitle),
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
