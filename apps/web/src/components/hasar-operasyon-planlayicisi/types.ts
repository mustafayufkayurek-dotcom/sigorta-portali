/** Hasar Operasyon Planlayıcısı — lokal önizleme tipleri */

export type StepId =
  | 'insured_appointment'
  | 'inspector'
  | 'supplier'
  | 'whatsapp'
  | 'digital_approval'
  | 'report_writing'
  | 'sent_for_approval'
  | 'approved';

export type StepStatus = 'done' | 'waiting' | 'future';

export type PlannerStep = {
  id: StepId;
  n: number;
  label: string;
  status: StepStatus;
  meta?: string;
};

export const PLANNER_STEPS: PlannerStep[] = [
  {
    id: 'insured_appointment',
    n: 1,
    label: 'Sigortalı Ve Randevu',
    status: 'done',
    meta: '19.07.2026 10:30',
  },
  { id: 'inspector', n: 2, label: 'Tespitçi Ataması', status: 'done' },
  { id: 'supplier', n: 3, label: 'Tedarikçi Ataması', status: 'waiting' },
  { id: 'whatsapp', n: 4, label: 'WhatsApp Bilgilendirme', status: 'future' },
  { id: 'digital_approval', n: 5, label: 'Dijital Onay', status: 'future' },
  { id: 'report_writing', n: 6, label: 'Rapor Yazım Aşamasında', status: 'future' },
  { id: 'sent_for_approval', n: 7, label: 'Onaya Gönderildi', status: 'future' },
  { id: 'approved', n: 8, label: 'Onaylandı', status: 'future' },
];
