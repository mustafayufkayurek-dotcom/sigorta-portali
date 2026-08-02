import { RuleVersionResolver, S1_RULE_IDS, S1_RULE_VERSION_ID } from '../versioning/rule-version-resolver';
import { S1_RULE_DEFINITIONS, S1_RULE_VERSION_TAG } from '../rule-library/s1-rule-definitions';

describe('S3 — RuleVersionResolver (mocked Prisma)', () => {
  function buildResolver(existingVersion: unknown = null) {
    const prisma = {
      takeoffRuleVersion: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { versionTag: string } }) =>
          existingVersion && where.versionTag === 's1.2026.08.02.1'
            ? Promise.resolve(existingVersion)
            : Promise.resolve(null),
        ),
        findFirst: jest.fn().mockResolvedValue(
          existingVersion ?? {
            id: S1_RULE_VERSION_ID,
            versionTag: S1_RULE_VERSION_TAG,
            librarySnapshotHash: 'sha256:test',
            effectiveFrom: new Date('2026-08-02'),
          },
        ),
        upsert: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-seed' }),
      },
      takeoffRule: {
        upsert: jest.fn(),
      },
      takeoffRuleVersionMember: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    };

    return { resolver: new RuleVersionResolver(prisma as never), prisma };
  }

  it('resolveCurrent returns existing RuleVersion without re-seeding', async () => {
    const existing = {
      id: S1_RULE_VERSION_ID,
      versionTag: S1_RULE_VERSION_TAG,
      librarySnapshotHash: 'sha256:existing',
      effectiveFrom: new Date('2026-08-02'),
    };
    const { resolver, prisma } = buildResolver(existing);

    const ref = await resolver.resolveCurrent('user-1');

    expect(ref.versionTag).toBe(S1_RULE_VERSION_TAG);
    expect(ref.id).toBe(S1_RULE_VERSION_ID);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ensureS1Seed upserts 4 rules and version members when missing', async () => {
    const { resolver, prisma } = buildResolver(null);

    await resolver.ensureS1Seed('user-seed');

    expect(prisma.takeoffRule.upsert).toHaveBeenCalledTimes(S1_RULE_DEFINITIONS.length);
    expect(prisma.takeoffRuleVersion.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.takeoffRuleVersionMember.upsert).toHaveBeenCalledTimes(S1_RULE_DEFINITIONS.length);
    expect(S1_RULE_IDS.DOOR_PAINTING_SET).toBe('s1-rule-door-painting-set');
  });
});
