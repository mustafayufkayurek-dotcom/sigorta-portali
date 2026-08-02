import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { RuleVersionRef } from './version.types';
import { S1_RULE_DEFINITIONS, S1_RULE_VERSION_TAG } from '../rule-library/s1-rule-definitions';
import { createHash } from 'crypto';

const S1_LIBRARY_SNAPSHOT_HASH = `sha256:${createHash('sha256').update(JSON.stringify(S1_RULE_DEFINITIONS.map((r) => r.code))).digest('hex')}`;

/** Stable ids for S1 seed — idempotent upsert across environments. */
export const S1_RULE_IDS: Readonly<Record<string, string>> = {
  DOOR_PAINTING_SET: 's1-rule-door-painting-set',
  WINDOW_PAINTING_SET: 's1-rule-window-painting-set',
  SKIRTING_INSTALL_SET: 's1-rule-skirting-install-set',
  CEILING_PAINTING_SET: 's1-rule-ceiling-painting-set',
};

export const S1_RULE_VERSION_ID = 's1-rule-version-20260802';

/**
 * Resolves active RuleVersion from DB; ensures S1 seed exists.
 */
@Injectable()
export class RuleVersionResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCurrent(createdByUserId?: string): Promise<RuleVersionRef> {
    await this.ensureS1Seed(createdByUserId);

    const version = await this.prisma.takeoffRuleVersion.findFirst({
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!version) {
      throw new Error('Takeoff RuleVersion bulunamadı — S1 seed başarısız');
    }

    return {
      id: version.id,
      versionTag: version.versionTag,
      librarySnapshotHash: version.librarySnapshotHash,
      effectiveFrom: version.effectiveFrom,
    };
  }

  async ensureS1Seed(createdByUserId?: string): Promise<void> {
    const existing = await this.prisma.takeoffRuleVersion.findUnique({
      where: { versionTag: S1_RULE_VERSION_TAG },
    });
    if (existing) return;

    const seedUserId =
      createdByUserId ??
      (
        await this.prisma.user.findFirst({
          where: { status: 'active' },
          select: { id: true },
        })
      )?.id;

    if (!seedUserId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const def of S1_RULE_DEFINITIONS) {
        await tx.takeoffRule.upsert({
          where: { code: def.code },
          create: {
            id: S1_RULE_IDS[def.code],
            code: def.code,
            name: def.displayFamily,
            structureElementType: def.structureElementType,
            active: true,
            decisionSpecJson: {
              plannedItems: def.plannedItems,
            } as unknown as Prisma.InputJsonValue,
            calculationBindJson: {
              requiredDimensions: def.requiredDimensions,
            } as unknown as Prisma.InputJsonValue,
          },
          update: {
            name: def.displayFamily,
            structureElementType: def.structureElementType,
            active: true,
            decisionSpecJson: {
              plannedItems: def.plannedItems,
            } as unknown as Prisma.InputJsonValue,
            calculationBindJson: {
              requiredDimensions: def.requiredDimensions,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.takeoffRuleVersion.upsert({
        where: { versionTag: S1_RULE_VERSION_TAG },
        create: {
          id: S1_RULE_VERSION_ID,
          versionTag: S1_RULE_VERSION_TAG,
          librarySnapshotHash: S1_LIBRARY_SNAPSHOT_HASH,
          effectiveFrom: new Date('2026-08-02T00:00:00.000Z'),
          createdByUserId: seedUserId,
          notes: 'S1 Rule Library — DOOR · WINDOW · SKIRTING · CEILING',
        },
        update: {},
      });

      for (const def of S1_RULE_DEFINITIONS) {
        await tx.takeoffRuleVersionMember.upsert({
          where: {
            ruleVersionId_ruleId: {
              ruleVersionId: S1_RULE_VERSION_ID,
              ruleId: S1_RULE_IDS[def.code],
            },
          },
          create: {
            ruleVersionId: S1_RULE_VERSION_ID,
            ruleId: S1_RULE_IDS[def.code],
            ruleBodyJson: def as unknown as object,
          },
          update: {
            ruleBodyJson: def as unknown as object,
          },
        });
      }
    });
  }
}
