import { IsString, MinLength } from 'class-validator';

export class OwnerExplanationDto {
  @IsString()
  @MinLength(8, { message: 'Açıklama en az 8 karakter olmalıdır' })
  ownerExplanation!: string;
}
