import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum WorkPriorityDto {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  KARAR_GEREKLI = 'KARAR_GEREKLI',
}

export enum TestNoteStatusDto {
  YENI = 'YENI',
  INCELEMEDE = 'INCELEMEDE',
  DUZELTME_BEKLIYOR = 'DUZELTME_BEKLIYOR',
  CANLIDA = 'CANLIDA',
  KABUL = 'KABUL',
  BACKLOG = 'BACKLOG',
}

export enum WorkItemSourceDto {
  TEST_NOTU = 'TEST_NOTU',
  KULLANICI_TALEBI = 'KULLANICI_TALEBI',
  TEKNIK = 'TEKNIK',
  DANISMAN = 'DANISMAN',
}

export enum WorkItemStatusDto {
  ACIK = 'ACIK',
  DEVAM_EDIYOR = 'DEVAM_EDIYOR',
  TAMAMLANDI = 'TAMAMLANDI',
  IPTAL = 'IPTAL',
}

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}

export class TestNoteFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkPriorityDto)
  oncelik?: WorkPriorityDto;

  @IsOptional()
  @IsEnum(TestNoteStatusDto)
  durum?: TestNoteStatusDto;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  tekrarDurumu?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateTestNoteDto {
  @IsString()
  ekranModul!: string;

  @IsString()
  kullaniciGozlemi!: string;

  @IsString()
  beklenenDavranis!: string;

  @IsOptional()
  @IsString()
  ekranGoruntusu?: string;

  @IsEnum(WorkPriorityDto)
  oncelik!: WorkPriorityDto;

  @IsOptional()
  @IsEnum(TestNoteStatusDto)
  durum?: TestNoteStatusDto;

  @IsOptional()
  @IsBoolean()
  tekrarDurumu?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  managerIslemNotu?: string;

  @IsOptional()
  @IsDateString()
  islemTarihi?: string;
}

export class UpdateTestNoteDto {
  @IsOptional()
  @IsString()
  ekranModul?: string;

  @IsOptional()
  @IsString()
  kullaniciGozlemi?: string;

  @IsOptional()
  @IsString()
  beklenenDavranis?: string;

  @IsOptional()
  @IsString()
  ekranGoruntusu?: string | null;

  @IsOptional()
  @IsEnum(WorkPriorityDto)
  oncelik?: WorkPriorityDto;

  @IsOptional()
  @IsEnum(TestNoteStatusDto)
  durum?: TestNoteStatusDto;

  @IsOptional()
  @IsBoolean()
  tekrarDurumu?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  managerIslemNotu?: string;

  @IsOptional()
  @IsDateString()
  islemTarihi?: string;
}

export class GenerateTestNoteFormatDto {
  @IsOptional()
  @IsString()
  etkiSinifi?: string;
}

export class WorkItemFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkItemSourceDto)
  kaynak?: WorkItemSourceDto;

  @IsOptional()
  @IsEnum(WorkPriorityDto)
  oncelik?: WorkPriorityDto;

  @IsOptional()
  @IsEnum(WorkItemStatusDto)
  durum?: WorkItemStatusDto;

  @IsOptional()
  @IsUUID()
  sorumluId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateWorkItemDto {
  @IsString()
  konu!: string;

  @IsEnum(WorkItemSourceDto)
  kaynak!: WorkItemSourceDto;

  @IsEnum(WorkPriorityDto)
  oncelik!: WorkPriorityDto;

  @IsOptional()
  @IsUUID()
  sorumluId?: string;

  @IsOptional()
  @IsDateString()
  hedefTarih?: string;

  @IsOptional()
  @IsDateString()
  hatirlatmaTarih?: string;

  @IsOptional()
  @IsEnum(WorkItemStatusDto)
  durum?: WorkItemStatusDto;

  @IsOptional()
  @IsString()
  kullaniciYorumu?: string;

  @IsOptional()
  @IsString()
  kanit?: string;

  @IsOptional()
  @IsString()
  kapanisNotu?: string;

  @IsOptional()
  @IsString()
  managerIslemNotu?: string;

  @IsOptional()
  @IsDateString()
  islemTarihi?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class UpdateWorkItemDto {
  @IsOptional()
  @IsString()
  konu?: string;

  @IsOptional()
  @IsEnum(WorkItemSourceDto)
  kaynak?: WorkItemSourceDto;

  @IsOptional()
  @IsEnum(WorkPriorityDto)
  oncelik?: WorkPriorityDto;

  @IsOptional()
  @IsUUID()
  sorumluId?: string | null;

  @IsOptional()
  @IsDateString()
  hedefTarih?: string | null;

  @IsOptional()
  @IsDateString()
  hatirlatmaTarih?: string | null;

  @IsOptional()
  @IsEnum(WorkItemStatusDto)
  durum?: WorkItemStatusDto;

  @IsOptional()
  @IsString()
  kullaniciYorumu?: string | null;

  @IsOptional()
  @IsString()
  kanit?: string | null;

  @IsOptional()
  @IsString()
  kapanisNotu?: string | null;

  @IsOptional()
  @IsString()
  managerIslemNotu?: string | null;

  @IsOptional()
  @IsDateString()
  islemTarihi?: string | null;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}