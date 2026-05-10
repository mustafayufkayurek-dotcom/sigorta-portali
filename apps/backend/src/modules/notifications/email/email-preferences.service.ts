import { Injectable } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '@/prisma/prisma.service';

export class UpdateEmailPreferencesDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  newClaimFile?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  claimAssignment?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  reportApproved?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  reportRejected?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  slaWarning?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  slaViolation?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  revisionRequest?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  managerInstruction?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  claimClosed?: boolean;
}

@Injectable()
export class EmailPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.userEmailPreferences.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    return this.prisma.userEmailPreferences.create({ data: { userId } });
  }

  async update(userId: string, dto: UpdateEmailPreferencesDto) {
    return this.prisma.userEmailPreferences.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
