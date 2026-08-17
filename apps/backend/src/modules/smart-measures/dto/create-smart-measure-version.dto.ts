import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Yeni sürüm — mevcut elemana eklenir; eski sürümler silinmez */
export class CreateSmartMeasureVersionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  widthMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  heightMm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  depthMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidence?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  aiDetectedType?: string | null;

  @IsOptional()
  @IsBoolean()
  isAiProduced?: boolean;

  @IsOptional()
  @IsBoolean()
  isUserCorrected?: boolean;

  @IsOptional()
  @IsBoolean()
  isManualRevision?: boolean;

  @IsOptional()
  @IsString()
  photoFileAssetId?: string | null;

  @IsOptional()
  @IsString()
  annotatedPhotoFileAssetId?: string | null;

  @IsOptional()
  @IsObject()
  overlayJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  extensionJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsNumber()
  gpsLat?: number | null;

  @IsOptional()
  @IsNumber()
  gpsLng?: number | null;

  @IsOptional()
  @IsObject()
  deviceInfoJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  measuredAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string | null;
}
