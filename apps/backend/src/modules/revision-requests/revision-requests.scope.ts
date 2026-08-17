import {
  applyClaimFileListScope,
  type RequestUser,
} from '../../common/helpers/claim-file-scope.helper';
import type { ListRevisionRequestsDto } from './dto/revision-requests.dto';

/** Liste / gecikmiş kuyruk — hasar dosyası kapsamı (saha, tedarikçi, portal). */
export function buildRevisionListWhere(
  query: Pick<ListRevisionRequestsDto, 'status' | 'reportId' | 'claimFileId' | 'assignedToId' | 'priority'>,
  user: RequestUser,
): Record<string, unknown> {
  const claimFileWhere = applyClaimFileListScope(
    query.claimFileId ? { id: query.claimFileId } : {},
    user,
  );
  const reportWhere: Record<string, unknown> = {
    claimFile: claimFileWhere,
  };
  if (query.reportId) reportWhere.id = query.reportId;

  const where: Record<string, unknown> = { report: reportWhere };
  if (query.status) where.status = query.status;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.priority) where.priority = query.priority;
  return where;
}
