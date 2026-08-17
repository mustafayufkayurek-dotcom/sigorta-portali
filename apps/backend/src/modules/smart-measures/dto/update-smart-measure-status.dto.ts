import { IsIn } from 'class-validator';
import {
  SMART_MEASURE_ELEMENT_STATUSES,
  type SmartMeasureElementStatus,
} from '../smart-measure-element-types';

export class UpdateSmartMeasureStatusDto {
  @IsIn([...SMART_MEASURE_ELEMENT_STATUSES])
  status!: SmartMeasureElementStatus;
}
