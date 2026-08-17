import { IsString, IsNotEmpty, Length } from 'class-validator';

export class QueryTaxDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 11)
  taxNumber!: string;
}
