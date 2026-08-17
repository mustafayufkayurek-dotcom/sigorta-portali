/**
 * Lokal tasarım önizlemesi — gerçek API bağlanana kadar örnek veri.
 * URL: /dev/personel-ozluk-denetim
 */

export type DayEndMissingEmployee = {
  id: string;
  fullName: string;
  department: string;
  roleLabel: string;
  remainingLeaveDays: number;
  missingDates: string[];
  lastConfirmedDate: string | null;
  status: 'missing' | 'ok' | 'on_leave';
  /** İzinli personelin admin onaylı vekili */
  proxyName?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  expectedStart?: string | null;
  expectedEnd?: string | null;
  isLateStart?: boolean;
  isEarlyLeave?: boolean;
  lateStartMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
};

export type DayEndSupervisionPreview = {
  cutoffLabel: string;
  workDateLabel: string;
  workHours?: {
    labels: { summary: string };
  };
  totals: {
    totalEmployees: number;
    approved: number;
    notApproved: number;
    onLeave: number;
    lateStart?: number;
    earlyLeave?: number;
  };
  /** Birleşik özet: giriş yapan kullanıcının kendi izin bakiyesi */
  myLeaveBalance: {
    leaveTypeLabel: string;
    year: number;
    remainingDays: number;
    totalDays: number;
    usedDays: number;
    pendingDays: number;
  };
  employees: DayEndMissingEmployee[];
};

export const DAY_END_SUPERVISION_PREVIEW: DayEndSupervisionPreview = {
  cutoffLabel: '18:00',
  workDateLabel: '3 Ağustos 2026',
  workHours: {
    labels: {
      summary:
        'Hafta İçi 08:30–18:00 · Cumartesi 08:30–13:00 · Pazar Ve Resmi Tatiller Çalışılmıyor',
    },
  },
  totals: {
    totalEmployees: 8,
    approved: 3,
    notApproved: 4,
    onLeave: 1,
    lateStart: 2,
    earlyLeave: 1,
  },
  myLeaveBalance: {
    leaveTypeLabel: 'Yıllık İzin',
    year: 2026,
    remainingDays: 12,
    totalDays: 14,
    usedDays: 1,
    pendingDays: 1,
  },
  employees: [
    {
      id: 'p1',
      fullName: 'Ayşe Demir',
      department: 'Operasyon',
      roleLabel: 'Dosya Sorumlusu',
      remainingLeaveDays: 8,
      missingDates: ['2026-08-03'],
      lastConfirmedDate: '2026-08-02',
      status: 'missing',
      expectedStart: '08:30',
      expectedEnd: '18:00',
      isLateStart: true,
      lateStartMinutes: 25,
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
    },
    {
      id: 'p2',
      fullName: 'Mehmet Kara',
      department: 'Saha',
      roleLabel: 'Saha Personeli',
      remainingLeaveDays: 5,
      missingDates: ['2026-08-03', '2026-08-01'],
      lastConfirmedDate: '2026-07-31',
      status: 'missing',
      expectedStart: '08:30',
      expectedEnd: '18:00',
      isLateStart: true,
      lateStartMinutes: 40,
      isEarlyLeave: true,
      earlyLeaveMinutes: 55,
    },
    {
      id: 'p3',
      fullName: 'Zeynep Aksoy',
      department: 'Operasyon',
      roleLabel: 'Dosya Sorumlusu',
      remainingLeaveDays: 11,
      missingDates: ['2026-08-03'],
      lastConfirmedDate: '2026-08-02',
      status: 'missing',
    },
    {
      id: 'p4',
      fullName: 'Can Yılmaz',
      department: 'Saha',
      roleLabel: 'Saha Personeli',
      remainingLeaveDays: 3,
      missingDates: ['2026-08-02'],
      lastConfirmedDate: '2026-08-01',
      status: 'missing',
    },
    {
      id: 'p5',
      fullName: 'Elif Şahin',
      department: 'Finans',
      roleLabel: 'Finans',
      remainingLeaveDays: 10,
      missingDates: [],
      lastConfirmedDate: '2026-08-03',
      status: 'ok',
    },
    {
      id: 'p6',
      fullName: 'Burak Çelik',
      department: 'Operasyon',
      roleLabel: 'Dosya Sorumlusu',
      remainingLeaveDays: 14,
      missingDates: [],
      lastConfirmedDate: '2026-08-03',
      status: 'ok',
    },
    {
      id: 'p7',
      fullName: 'Selin Arslan',
      department: 'Saha',
      roleLabel: 'Saha Personeli',
      remainingLeaveDays: 2,
      missingDates: [],
      lastConfirmedDate: '2026-08-01',
      status: 'on_leave',
      proxyName: 'Mehmet Kara',
    },
    {
      id: 'p8',
      fullName: 'Emre Koç',
      department: 'Operasyon',
      roleLabel: 'Dosya Sorumlusu',
      remainingLeaveDays: 7,
      missingDates: [],
      lastConfirmedDate: '2026-08-03',
      status: 'ok',
    },
  ],
};

export const DAY_END_EMPLOYEE_WARNING_PREVIEW = {
  workDateLabel: '3 Ağustos 2026',
  cutoffLabel: '18:00',
  missingDates: ['2026-08-03'],
  message: 'Lütfen bugünkü puantajınızı onaylayınız.',
};
