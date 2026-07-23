/**
 * Bekleyen Operasyon satırı — operasyon dili; aksiyonla aynı kaynaktan.
 */

import type { PendingOperationCategory } from './pending-operations-priority';
import { operationalCopyFor, operationalCopyFromLooseText } from './operational-copy';

export type PendingOperationLineInput = {
  category: PendingOperationCategory;
  actionLabel?: string | null;
  workflowStep?: string | null;
  waitingParty?: string | null;
  expectedAction?: string | null;
};

export function composePendingOperationLine(input: PendingOperationLineInput): string {
  if (input.category && input.category !== 'other') {
    return operationalCopyFor(input.category).pendingLine;
  }
  return operationalCopyFromLooseText(
    input.actionLabel || input.workflowStep || input.expectedAction,
  ).pendingLine;
}
