/**
 * Operasyon Terminolojisi Hafızası — Meridyen Operasyon Hafızasının ilk karar motoru.
 *
 * Zincir:
 *   Müşteri dili (ör. Cam Kırığı)
 *     → Standart hizmet (ör. Cam Kırılması)
 *     → Operasyon Grubu / üst grup (ör. Cam Hizmetleri)
 *     → Tedarikçi uzmanlığı (ör. Cam Ustası)
 *     → Maliyet Hafızası
 *     → Öneri Motoru
 *
 * Yeni tablo / migration yok; mevcut sözlük + shared alias kullanılır.
 * Orijinal müşteri metni silinmez.
 */
import {
  isInboundIhbarNoteText,
  listInboundAliasVariantsForCanonical,
  mapInboundCategoryKnown,
  mapInboundLossTypeToMeridyen,
  resolveInboundCanonicalLabel,
  toInboundTitleCaseTR,
} from '@sigorta/shared';
import {
  resolveCanonicalIhbarLabel,
  resolveClaimSubjectIdByLabel,
} from '@/common/helpers/ihbar-konusu.helper';
import { resolveDepartmentFileSubjectByLabel } from '@/common/helpers/dosya-konusu.helper';
import type { PrismaService } from '@/prisma/prisma.service';

export type TerminologyResolution = {
  originalText: string;
  canonicalSubjectId: string | null;
  /** Standart / kanonik hizmet türü (ör. Cam Kırılması). */
  canonicalLabel: string | null;
  /** Operasyon Grubu — hizmetlerin bağlandığı üst grup (ör. Cam Hizmetleri). */
  operationGroup: string | null;
  /** Tedarikçi uzmanlığı eşleşme anahtarları (work group / branş / geçmiş iş). */
  expertiseHints: string[];
  matched: boolean;
  source: 'claim_subject' | 'department_file_subject' | 'alias' | 'unmatched';
};

export type TerminologyMemoryEntry = {
  originalText: string;
  canonicalSubjectId: string | null;
  canonicalLabel: string | null;
  operationGroup: string | null;
  count: number;
  matched: boolean;
};

/** Karar motoru zincir durumu — profil API özeti. */
export type TerminologyDecisionChain = {
  terminologyResolved: boolean;
  operationGroupLinked: boolean;
  expertiseHintsReady: boolean;
  costMemoryReady: boolean;
  recommendationReady: boolean;
};

export type TerminologyDecisionEngine = {
  operationGroup: string | null;
  expertiseHints: string[];
  chain: TerminologyDecisionChain;
};

/** Profil API — terminologyMemory alanı */
export type TerminologyMemorySummary = {
  query: TerminologyResolution | null;
  subjects: TerminologyMemoryEntry[];
  unmatched: TerminologyMemoryEntry[];
  totalObservations: number;
  /** Karar motoru özeti + zincir bağlantı durumu. */
  decisionEngine: TerminologyDecisionEngine;
};

/**
 * Operasyon Grubu (üst grup) kuralları — kanonik hizmet türünden türetilir.
 * Örnek: Cam Kırılması → Cam Hizmetleri (yalnızca synonym değil).
 */
const OPERATION_GROUP_RULES: Array<{ match: RegExp; group: string }> = [
  { match: /cam/i, group: 'Cam Hizmetleri' },
  { match: /elektrik|elektronik/i, group: 'Elektrik Hizmetleri' },
  { match: /tesisat|dahili\s*su|su\s*bask|boru|sizinti|sızınt/i, group: 'Tesisat Hizmetleri' },
  { match: /kapi|kapı|kilit/i, group: 'Kapı Kilit Hizmetleri' },
  { match: /cati|çatı/i, group: 'Çatı Hizmetleri' },
  { match: /yangin|yangın/i, group: 'Yangın Hizmetleri' },
  { match: /dogalgaz|doğalgaz/i, group: 'Doğalgaz Hizmetleri' },
  { match: /hirsiz|hırsız|guvenlik|güvenlik/i, group: 'Güvenlik Hizmetleri' },
  { match: /boya|siva|sıva/i, group: 'Boya Sıva Hizmetleri' },
  { match: /asansor|asansör/i, group: 'Asansör Hizmetleri' },
  { match: /marangoz/i, group: 'Marangozluk Hizmetleri' },
];

/**
 * Operasyon Grubu anahtar kelimesi → WorkGroup / serviceBranches / geçmiş iş eşleşme ipuçları.
 * Yeni tablo yok; mevcut seed iş grupları ve branş adlarından türetilir.
 */
const OPERATION_GROUP_EXPERTISE: Array<{ match: RegExp; hints: string[] }> = [
  {
    match: /cam/i,
    hints: [
      'Cam Hizmetleri',
      'Cam İşleri',
      'cam_isleri',
      'Cam',
      'Cam Ustası',
      'Cam Kırılması',
      'Cam Kırığı',
      'Konut Cam',
    ],
  },
  {
    match: /elektrik/i,
    hints: ['Elektrik Hizmetleri', 'Elektrik', 'elektrik', 'Elektrik Arızası', 'Elektronik Cihaz'],
  },
  {
    match: /tesisat|dahili\s*su|su\s*bask|boru|sizinti|sızınt/i,
    hints: [
      'Tesisat Hizmetleri',
      'Sıhhi Tesisat',
      'sihhi_tesisat',
      'Tesisat',
      'Su Baskını',
      'Dahili Su',
      'Boru Patlaması',
    ],
  },
  {
    match: /kapi|kapı|kilit/i,
    hints: ['Kapı Kilit Hizmetleri', 'Kapı/Kilit Arızası', 'Marangozluk', 'marangozluk', 'Kapı'],
  },
  {
    match: /cati|çatı/i,
    hints: ['Çatı Hizmetleri', 'Çatı Hasarı', 'Çatı', 'cati', 'Çatı İşleri'],
  },
  {
    match: /yangin|yangın/i,
    hints: ['Yangın Hizmetleri', 'Yangın Hasarı', 'Konut Yangın', 'Endüstriyel Yangın', 'Yangın'],
  },
  {
    match: /dogalgaz|doğalgaz/i,
    hints: ['Doğalgaz Hizmetleri', 'Doğalgaz Arızası', 'Doğalgaz', 'dogalgaz'],
  },
  {
    match: /hirsiz|hırsız|guvenlik|güvenlik/i,
    hints: ['Güvenlik Hizmetleri', 'Hırsızlık', 'Hırsızlık/Güvenlik', 'Güvenlik'],
  },
  {
    match: /boya|siva|sıva/i,
    hints: ['Boya Sıva Hizmetleri', 'Boya / Sıva', 'boya_siva', 'Boya'],
  },
  {
    match: /asansor|asansör/i,
    hints: ['Asansör Hizmetleri', 'Asansör Arızası', 'Asansör'],
  },
];

function collapseKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normKey(value: string): string {
  return collapseKey(value).toLocaleLowerCase('tr-TR');
}

/**
 * Kanonik / serbest hizmet metninden Operasyon Grubu (üst grup) üretir.
 * "Cam Kırılması" → "Cam Hizmetleri"; zaten üst grupsa olduğu gibi döner.
 */
export function resolveOperationGroupLabel(
  ...labels: Array<string | null | undefined>
): string | null {
  for (const label of labels) {
    const t = label?.trim();
    if (!t) continue;
    if (/hizmetleri$/i.test(t)) return toInboundTitleCaseTR(t);
    for (const rule of OPERATION_GROUP_RULES) {
      if (rule.match.test(t)) return rule.group;
    }
  }
  for (const label of labels) {
    const t = label?.trim();
    if (t) return toInboundTitleCaseTR(t);
  }
  return null;
}

function emptyResolution(originalText = ''): TerminologyResolution {
  return {
    originalText,
    canonicalSubjectId: null,
    canonicalLabel: null,
    operationGroup: null,
    expertiseHints: [],
    matched: false,
    source: 'unmatched',
  };
}

/** Operasyon Grubu + alias + iş grubu ipuçlarından uzmanlık anahtarları. */
export function buildExpertiseHints(
  operationGroup?: string | null,
  extraLabels: Array<string | null | undefined> = [],
): string[] {
  const hints = new Set<string>();
  const group = operationGroup?.trim();
  if (group) {
    hints.add(group);
    hints.add(toInboundTitleCaseTR(group));
    for (const v of listInboundAliasVariantsForCanonical(group)) {
      hints.add(v);
    }
    for (const rule of OPERATION_GROUP_EXPERTISE) {
      if (rule.match.test(group)) {
        for (const h of rule.hints) hints.add(h);
      }
    }
  }
  for (const label of extraLabels) {
    const t = label?.trim();
    if (t) {
      hints.add(t);
      const nestedGroup = resolveOperationGroupLabel(t);
      if (nestedGroup && nestedGroup !== t) {
        hints.add(nestedGroup);
        for (const rule of OPERATION_GROUP_EXPERTISE) {
          if (rule.match.test(nestedGroup) || rule.match.test(t)) {
            for (const h of rule.hints) hints.add(h);
          }
        }
      }
    }
  }
  return [...hints].filter(Boolean);
}

/**
 * Müşteri / synonym etiket → standart hizmet türü.
 * Örnek: Cam Kırığı → Cam Kırılması (Operasyon Grubu ayrıca üst grup üretir).
 */
const STANDARD_SERVICE_LABELS: Record<string, string> = {
  'cam kırığı': 'Cam Kırılması',
  'cam kirigi': 'Cam Kırılması',
  'konut cam': 'Cam Kırılması',
};

function toStandardServiceLabel(label?: string | null): string | null {
  const t = label?.trim();
  if (!t) return null;
  const mapped = STANDARD_SERVICE_LABELS[normKey(t)];
  return mapped ?? toInboundTitleCaseTR(t);
}

function withDecisionFields(
  base: Omit<TerminologyResolution, 'operationGroup' | 'expertiseHints'>,
): TerminologyResolution {
  const canonicalLabel = base.matched
    ? toStandardServiceLabel(base.canonicalLabel)
    : null;
  const operationGroup = base.matched
    ? resolveOperationGroupLabel(canonicalLabel, base.canonicalLabel, base.originalText)
    : null;
  return {
    ...base,
    canonicalLabel,
    operationGroup,
    expertiseHints: buildExpertiseHints(operationGroup, [canonicalLabel, base.canonicalLabel, base.originalText]),
  };
}

export function buildDecisionEngine(
  query: TerminologyResolution | null,
  opts?: { costMemoryLinked?: boolean; recommendationLinked?: boolean },
): TerminologyDecisionEngine {
  const operationGroup = query?.operationGroup ?? null;
  const expertiseHints = query?.expertiseHints ?? [];
  const terminologyResolved = Boolean(query?.matched);
  const operationGroupLinked = Boolean(operationGroup);
  const expertiseHintsReady = expertiseHints.length > 0;
  return {
    operationGroup,
    expertiseHints,
    chain: {
      terminologyResolved,
      operationGroupLinked,
      expertiseHintsReady,
      costMemoryReady: Boolean(opts?.costMemoryLinked) && operationGroupLinked,
      recommendationReady: Boolean(opts?.recommendationLinked) && operationGroupLinked,
    },
  };
}

/** Sync alias çözümü (DB yok). */
export function resolveTerminologySync(raw?: string | null): TerminologyResolution {
  const originalText = raw?.trim() ? collapseKey(raw) : '';
  if (!originalText) return emptyResolution();
  if (isInboundIhbarNoteText(originalText)) return emptyResolution(originalText);

  const aliasLabel =
    mapInboundLossTypeToMeridyen(originalText)
    ?? mapInboundCategoryKnown(originalText)
    ?? resolveInboundCanonicalLabel(originalText);

  if (aliasLabel) {
    return withDecisionFields({
      originalText,
      canonicalSubjectId: null,
      canonicalLabel: aliasLabel,
      matched: true,
      source: 'alias',
    });
  }

  return emptyResolution(originalText);
}

/**
 * Serbest metin → standart hizmet + Operasyon Grubu (üst grup).
 * ClaimSubject tercih; DFS fallback; alias son çare.
 */
export async function resolveTerminology(
  prisma: PrismaService,
  raw?: string | null,
): Promise<TerminologyResolution> {
  const sync = resolveTerminologySync(raw);
  if (!sync.originalText) return sync;

  const labelForLookup =
    sync.canonicalLabel
    ?? resolveCanonicalIhbarLabel({
      lossType: sync.originalText,
      fileSubject: sync.originalText,
    })
    ?? sync.originalText;

  const claimSubjectId = await resolveClaimSubjectIdByLabel(prisma, labelForLookup);
  if (claimSubjectId) {
    const subject = await prisma.claimSubject.findUnique({
      where: { id: claimSubjectId },
      select: { id: true, name: true },
    });
    if (subject) {
      return withDecisionFields({
        originalText: sync.originalText,
        canonicalSubjectId: subject.id,
        canonicalLabel: subject.name,
        matched: true,
        source: 'claim_subject',
      });
    }
  }

  const dfs = await resolveDepartmentFileSubjectByLabel(prisma, labelForLookup);
  if (dfs) {
    return withDecisionFields({
      originalText: sync.originalText,
      canonicalSubjectId: dfs.id,
      canonicalLabel: dfs.name,
      matched: true,
      source: 'department_file_subject',
    });
  }

  if (sync.matched && sync.canonicalLabel) return sync;

  return emptyResolution(sync.originalText);
}

/**
 * Maliyet/öneri Prisma `in` filtreleri için eşleşme anahtarları.
 * Operasyon Grubu + orijinal + kanonik + bilinen alias; orijinal metin korunur.
 */
export async function buildServiceTypeMatchKeys(
  prisma: PrismaService,
  raw?: string | null,
): Promise<{ keys: string[]; resolution: TerminologyResolution }> {
  const resolution = await resolveTerminology(prisma, raw);
  const keys = new Set<string>();

  if (resolution.originalText) {
    keys.add(resolution.originalText);
    keys.add(toInboundTitleCaseTR(resolution.originalText));
  }
  if (resolution.operationGroup) {
    keys.add(resolution.operationGroup);
    keys.add(toInboundTitleCaseTR(resolution.operationGroup));
  }
  if (resolution.canonicalLabel) {
    keys.add(resolution.canonicalLabel);
    keys.add(toInboundTitleCaseTR(resolution.canonicalLabel));
    for (const v of listInboundAliasVariantsForCanonical(resolution.canonicalLabel)) {
      keys.add(v);
    }
  }
  for (const hint of resolution.expertiseHints) {
    keys.add(hint);
  }

  if (resolution.canonicalSubjectId && resolution.source === 'claim_subject') {
    const subject = await prisma.claimSubject.findUnique({
      where: { id: resolution.canonicalSubjectId },
      select: { name: true, code: true },
    });
    if (subject?.name) keys.add(subject.name);
    if (subject?.code) keys.add(subject.code);
  }

  return {
    keys: [...keys].filter(Boolean),
    resolution,
  };
}

/** Kayıtlı serviceType, sorgu anahtarlarıyla veya aynı Operasyon Grubu ile eşleşiyor mu? */
export function serviceTypeMatchesKeys(
  stored: string | null | undefined,
  keys: string[],
  queryCanonical?: string | null,
): boolean {
  if (!keys.length) return true;
  const storedTrim = stored?.trim();
  if (!storedTrim) return false;

  const keyNorms = new Set(keys.map(normKey));
  if (keyNorms.has(normKey(storedTrim))) return true;

  const storedCanon =
    mapInboundLossTypeToMeridyen(storedTrim)
    ?? mapInboundCategoryKnown(storedTrim)
    ?? null;
  if (queryCanonical) {
    if (storedCanon && normKey(storedCanon) === normKey(queryCanonical)) return true;
  }

  const storedGroup = resolveOperationGroupLabel(storedCanon ?? storedTrim);
  const queryGroup = resolveOperationGroupLabel(queryCanonical);
  if (storedGroup && queryGroup && normKey(storedGroup) === normKey(queryGroup)) return true;

  return false;
}

/**
 * Tedarikçi uzmanlık etiketleri (work group / branş / category / geçmiş iş)
 * Operasyon Grubu ipuçlarıyla örtüşüyor mu?
 */
export function vendorExpertiseMatchesHints(
  vendorTags: Array<string | null | undefined>,
  hints: string[],
): boolean {
  if (!hints.length) return true;
  const hintNorms = new Set(hints.map(normKey).filter(Boolean));
  for (const tag of vendorTags) {
    const t = tag?.trim();
    if (!t) continue;
    const n = normKey(t);
    if (hintNorms.has(n)) return true;
    for (const h of hintNorms) {
      if (h.length >= 3 && (n.includes(h) || h.includes(n))) return true;
    }
  }
  return false;
}

/** Uzmanlık örtüşme skoru 0–1 (öneri motoru boost). */
export function vendorExpertiseOverlapScore(
  vendorTags: Array<string | null | undefined>,
  hints: string[],
): number {
  if (!hints.length) return 0.5;
  const hintNorms = [...new Set(hints.map(normKey).filter(Boolean))];
  if (!hintNorms.length) return 0.5;
  let hits = 0;
  const tagNorms = vendorTags
    .map((t) => (t?.trim() ? normKey(t) : ''))
    .filter(Boolean);
  if (!tagNorms.length) return 0.35;
  for (const h of hintNorms) {
    if (tagNorms.some((t) => t === h || (h.length >= 3 && (t.includes(h) || h.includes(t))))) {
      hits += 1;
    }
  }
  return Math.min(1, hits / Math.min(hintNorms.length, 4));
}

export function aggregateTerminologyMemory(
  resolutions: TerminologyResolution[],
  query: TerminologyResolution | null = null,
  opts?: { costMemoryLinked?: boolean; recommendationLinked?: boolean },
): TerminologyMemorySummary {
  const byKey = new Map<string, TerminologyMemoryEntry>();

  for (const r of resolutions) {
    if (!r.originalText) continue;
    const groupKey = r.operationGroup || r.canonicalLabel
      ? `g:${normKey(r.operationGroup || r.canonicalLabel || '')}`
      : `o:${normKey(r.originalText)}`;
    const existing = byKey.get(groupKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(groupKey, {
      originalText: r.originalText,
      canonicalSubjectId: r.canonicalSubjectId,
      canonicalLabel: r.canonicalLabel,
      operationGroup: r.operationGroup,
      count: 1,
      matched: r.matched,
    });
  }

  const all = [...byKey.values()].sort((a, b) => b.count - a.count);
  return {
    query,
    subjects: all.filter((e) => e.matched).slice(0, 12),
    unmatched: all.filter((e) => !e.matched).slice(0, 8),
    totalObservations: resolutions.filter((r) => r.originalText).length,
    decisionEngine: buildDecisionEngine(query, opts),
  };
}

export function emptyTerminologyMemory(
  query: TerminologyResolution | null = null,
  opts?: { costMemoryLinked?: boolean; recommendationLinked?: boolean },
): TerminologyMemorySummary {
  return {
    query,
    subjects: [],
    unmatched: [],
    totalObservations: 0,
    decisionEngine: buildDecisionEngine(query, opts),
  };
}
