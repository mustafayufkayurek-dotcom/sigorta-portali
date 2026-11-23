import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

const CARI_TUR_LIST = [
  'musteri',
  'tedarikci',
  'musteri_tedarikci',
  'kredi_karti',
  'kredi',
  'vergi',
  'sgk',
  'banka',
  'kasa',
  'diger',
] as const;

export class CreatePartyAccountDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(CARI_TUR_LIST)
  kind!: (typeof CARI_TUR_LIST)[number];

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  cardLabel?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  linkedCustomerId?: string;

  @IsOptional()
  @IsString()
  linkedVendorId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Açılış tutarı (TL). 0 veya yoksa açılış satırı yazılmaz. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  openingAmount?: number;

  /** alacak = onlar bize borçlu; borc = biz onlara borçluyuz */
  @IsOptional()
  @IsIn(['alacak', 'borc'])
  openingDirection?: 'alacak' | 'borc';

  @IsOptional()
  @IsDateString()
  openingDate?: string;
}

export class UpdatePartyAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(CARI_TUR_LIST)
  kind?: (typeof CARI_TUR_LIST)[number];

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  cardLast4?: string | null;

  @IsOptional()
  @IsString()
  cardLabel?: string | null;

  @IsOptional()
  @IsString()
  bankName?: string | null;

  @IsOptional()
  @IsString()
  branchName?: string | null;

  @IsOptional()
  @IsString()
  iban?: string | null;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  linkedCustomerId?: string | null;

  @IsOptional()
  @IsString()
  linkedVendorId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePartyAccountEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  debitAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  creditAmount?: number;
}

export class PatchFinansKurulumDto {
  @IsOptional()
  cariTanim?: boolean | 'yok';

  @IsOptional()
  @IsBoolean()
  acilisGozdenGecirildi?: boolean;

  @IsOptional()
  @IsBoolean()
  masrafKaynak?: boolean;

  @IsOptional()
  @IsBoolean()
  seyirAcik?: boolean;
}

export class PatchFinansHedefCiroDto {
  /** true = öneriyi (veya kabulAylik) kaydet */
  @IsOptional()
  @IsBoolean()
  kabul?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  kabulAylik?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  borcAySayisi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  karPayiPct?: number;

  /** Merkez Sabit Gider Yönetimi kalemleri; hedef bunu okur (dosya havuzu değil). */
  @IsOptional()
  @IsArray()
  isletmeSabitKalemleri?: Array<{
    id?: string;
    ad?: string;
    kategori?: string;
    aylikTutar?: number;
    tekrar?: string;
    baslangic?: string;
    bitis?: string | null;
    durum?: string;
  }>;
}
