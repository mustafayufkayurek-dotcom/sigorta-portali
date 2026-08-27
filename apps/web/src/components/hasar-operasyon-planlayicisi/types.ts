/** Hasar Operasyon Planlayıcısı — Hasar Tespit / Onarım / Kapanış */

import { HASAR_FLOW_GROUP_LABEL } from '@sigorta/shared';

export type StepId =
  | 'insured_appointment'
  | 'inspector'
  | 'supplier'
  | 'whatsapp'
  | 'digital_approval'
  | 'report_writing'
  | 'sent_for_approval'
  | 'approved'
  | 'repair_whatsapp'
  | 'muvafakat'
  | 'repair_complete'
  | 'closure_survey'
  | 'docs_upload';

export type PlannerGroupId = 'onay' | 'onarim' | 'kapanis';

export type StepStatus = 'done' | 'waiting' | 'future';

export type PlannerStep = {
  id: StepId;
  n: number;
  label: string;
  status: StepStatus;
  group: PlannerGroupId;
  meta?: string;
  hidden?: boolean;
};

export const PLANNER_GROUPS: Array<{ id: PlannerGroupId; label: string }> = [
  { id: 'onay', label: HASAR_FLOW_GROUP_LABEL.onay },
  { id: 'onarim', label: HASAR_FLOW_GROUP_LABEL.onarim },
  { id: 'kapanis', label: HASAR_FLOW_GROUP_LABEL.kapanis },
];

export const PLANNER_INTERNAL_STEP_IDS: StepId[] = [
  'whatsapp',
  'report_writing',
  'sent_for_approval',
  'muvafakat',
  'closure_survey',
];

export function isPlannerStepOnScreen(id: StepId): boolean {
  return !PLANNER_INTERNAL_STEP_IDS.includes(id);
}

export const PLANNER_STEPS: PlannerStep[] = [
  {
    id: 'insured_appointment',
    n: 1,
    label: 'Sigortalı Ve Randevu',
    status: 'done',
    group: 'onay',
    meta: '19.07.2026 10:30',
  },
  { id: 'inspector', n: 2, label: 'Tespitçi Ataması', status: 'done', group: 'onay' },
  { id: 'supplier', n: 3, label: 'Tedarikçi Ataması', status: 'waiting', group: 'onay' },
  { id: 'whatsapp', n: 0, label: 'Tespit WhatsApp', status: 'future', group: 'onay', hidden: true },
  { id: 'report_writing', n: 0, label: 'Rapor Yazım', status: 'future', group: 'onay', hidden: true },
  { id: 'sent_for_approval', n: 0, label: 'Onaya Gönderildi', status: 'future', group: 'onay', hidden: true },
  { id: 'approved', n: 4, label: 'Dosya Onaylandı', status: 'future', group: 'onay' },
  { id: 'digital_approval', n: 1, label: 'Dijital Onay', status: 'future', group: 'onarim' },
  { id: 'muvafakat', n: 0, label: 'Muvafakatname', status: 'future', group: 'onarim', hidden: true },
  { id: 'repair_whatsapp', n: 2, label: 'Onarım Planlama', status: 'future', group: 'onarim' },
  { id: 'repair_complete', n: 3, label: 'Onarım Bitiş', status: 'future', group: 'onarim' },
  { id: 'closure_survey', n: 0, label: 'Kapanış Anketi', status: 'future', group: 'kapanis', hidden: true },
  { id: 'docs_upload', n: 1, label: 'Evrak Yükleme', status: 'future', group: 'kapanis' },
];

export const PLANNER_VISIBLE_STEPS = PLANNER_STEPS.filter((s) => !s.hidden);
