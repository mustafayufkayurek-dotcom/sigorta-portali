export const HR_LEAVE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type HrLeaveStatus = (typeof HR_LEAVE_STATUS)[keyof typeof HR_LEAVE_STATUS];

export const HR_LEAVE_TYPE = {
  ANNUAL: 'annual',
  SICK: 'sick',
  UNPAID: 'unpaid',
  OTHER: 'other',
} as const;

export type HrLeaveType = (typeof HR_LEAVE_TYPE)[keyof typeof HR_LEAVE_TYPE];

export const HR_ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
  LEAVE: 'leave',
  HOLIDAY: 'holiday',
  WEEKLY_REST: 'weekly_rest',
} as const;

export type HrAttendanceStatus = (typeof HR_ATTENDANCE_STATUS)[keyof typeof HR_ATTENDANCE_STATUS];

export const HR_ATTENDANCE_ENTRY_TYPE = {
  REGULAR: 'regular',
} as const;

export const HR_LEAVE_STATUS_LABELS: Record<HrLeaveStatus, string> = {
  draft: 'Taslak',
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export const HR_LEAVE_TYPE_LABELS: Record<HrLeaveType, string> = {
  annual: 'Yıllık İzin',
  sick: 'Hastalık İzni',
  unpaid: 'Ücretsiz İzin',
  other: 'Diğer',
};

export const HR_ATTENDANCE_STATUS_LABELS: Record<HrAttendanceStatus, string> = {
  present: 'Devam',
  absent: 'Devamsız',
  half_day: 'Yarım Gün',
  leave: 'İzinli',
  holiday: 'Resmi Tatil',
  weekly_rest: 'Hafta Tatili',
};
