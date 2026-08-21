'use client';

import { FileStageStrip, type FileStageStep, type FileStageTone } from '@/components/panel/FileStageStrip';
import { ACIL_STAGES, type AcilStageKey } from './acil-workflow';
import type { AcilStageStatus } from './acil-stage-status';

function toStageTone(status: AcilStageStatus): FileStageTone {
  if (status === 'done') return 'completed';
  if (status === 'waiting') return 'active';
  return 'future';
}

/** Acil dosya akışı — adımlar acil iş kuralından, görünüm ortak şeritten gelir. */
export function AcilHeaderStageStrip({
  statuses,
}: {
  statuses: Record<AcilStageKey, AcilStageStatus>;
}) {
  const steps: FileStageStep[] = ACIL_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    tone: toStageTone(statuses[stage.key]),
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
