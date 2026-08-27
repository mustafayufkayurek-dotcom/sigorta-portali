'use client';

/**
 * Acil dosya üst şerit — planlayıcı ile aynı 6 operatör adımı.
 */

import { FileStageStrip, type FileStageStep, type FileStageTone } from '@/components/panel/FileStageStrip';
import {
  OPERATOR_STEPS,
  type OperatorStepKey,
} from '@/components/acil-operasyon-planlayicisi/planner-steps';
import type { AcilPlannerStepStatus } from '@/components/acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel';

function toStageTone(status: AcilPlannerStepStatus): FileStageTone {
  if (status === 'done') return 'completed';
  if (status === 'waiting') return 'active';
  return 'future';
}

export function AcilHeaderStageStrip({
  statuses,
}: {
  statuses: Record<OperatorStepKey, AcilPlannerStepStatus>;
}) {
  const steps: FileStageStep[] = OPERATOR_STEPS.map((stage) => ({
    key: stage.key,
    label: stage.label,
    tone: toStageTone(statuses[stage.key] ?? 'future'),
  }));

  return (
    <FileStageStrip
      steps={steps}
      compact
      showTitle={false}
      className="flex-1"
      testId="acil-stage-strip"
      trackTestId="surec-strip"
    />
  );
}
