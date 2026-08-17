import { IsArray, IsString, IsOptional, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class CreateInvoiceDraftDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  caseIds!: string[];

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
