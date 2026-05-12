import { PartialType } from '@nestjs/swagger';
import { CreateClaimStatusDto } from './create-claim-status.dto';

export class UpdateClaimStatusDto extends PartialType(CreateClaimStatusDto) {}