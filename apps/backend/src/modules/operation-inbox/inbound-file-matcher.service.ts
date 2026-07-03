import { Injectable, Logger } from '@nestjs/common';
import {
  InboundClassification,
  InboundMailbox,
  InboundMessage,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { extractSubjectHints } from './inbound-subject-parser';

export interface FileMatchCandidate {
  type: 'claim' | 'emergency';
  id: string;
  fileNo: string;
  score: number;
  reason: string;
}

export interface FileMatchResult {
  autoLinked: boolean;
  claimFileId?: string;
  emergencyCaseId?: string;
  suggestedAction?: string;
  candidates: FileMatchCandidate[];
}

const CORRESPONDENCE_CLASSIFICATIONS = new Set<InboundClassification>([
  'BELGE_TALEP',
  'FATURA_ODEME',
  'GENEL',
]);

const FILE_NO_PATTERNS = [
  /\b(HK-\d{6}-\d{3,6})\b/i,
  /\b(AYF-\d{6}-\d{3,6})\b/i,
  /\b(DOSYA[\s.:]*([A-Z0-9-]{5,20}))\b/i,
];

const PLATE_PATTERN = /\b(\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4})\b/i;

interface ExtractedHints {
  fileNo?: string;
  policyNo?: string;
  plate?: string;
  claimNo?: string;
}

@Injectable()
export class InboundFileMatcherService {
  private readonly logger = new Logger(InboundFileMatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  shouldAttemptMatch(message: InboundMessage, suggestedAction: string): boolean {
    if (message.claimFileId || message.emergencyCaseId) return false;
    if (message.classification === 'SPAM') return false;

    if (suggestedAction === 'LINK_EXISTING') return true;
    if (message.classification && CORRESPONDENCE_CLASSIFICATIONS.has(message.classification)) {
      return true;
    }
    return false;
  }

  async matchMessage(message: InboundMessage): Promise<FileMatchResult> {
    const hints = this.collectHints(message);
    const candidates: FileMatchCandidate[] = [];

    if (hints.fileNo) {
      candidates.push(...(await this.matchByFileNo(hints.fileNo)));
    }
    if (hints.claimNo) {
      candidates.push(...(await this.matchByClaimNo(hints.claimNo)));
    }
    if (hints.policyNo) {
      candidates.push(...(await this.matchByPolicyNo(hints.policyNo)));
    }
    if (message.conversationId) {
      candidates.push(...(await this.matchByConversation(message.conversationId, message.id)));
    }
    if (hints.plate) {
      candidates.push(...(await this.matchByPlate(hints.plate)));
    }

    const deduped = this.deduplicateCandidates(candidates);
    const best = deduped[0];
    const second = deduped[1];

    if (best && best.score >= 90 && (!second || best.score - second.score >= 15)) {
      this.logger.log(
        `Otomatik eşleşme: ${message.id} → ${best.type}:${best.fileNo} (${best.score}, ${best.reason})`,
      );
      return {
        autoLinked: true,
        claimFileId: best.type === 'claim' ? best.id : undefined,
        emergencyCaseId: best.type === 'emergency' ? best.id : undefined,
        suggestedAction: undefined,
        candidates: deduped,
      };
    }

    if (deduped.length > 0) {
      return {
        autoLinked: false,
        suggestedAction: 'LINK_EXISTING',
        candidates: deduped.slice(0, 5),
      };
    }

    return { autoLinked: false, candidates: [] };
  }

  private collectHints(message: InboundMessage): ExtractedHints {
    const hints: ExtractedHints = {};
    const extracted = this.parseExtracted(message.aiExtractedJson);

    if (extracted.fileNo?.trim()) hints.fileNo = this.normalizeFileNo(extracted.fileNo);
    if (extracted.policyNo?.trim()) hints.policyNo = extracted.policyNo.trim();
    if (extracted.plate?.trim()) hints.plate = this.normalizePlate(extracted.plate);
    if (extracted.claimNo?.trim()) hints.claimNo = extracted.claimNo.trim();

    const subjectNos = this.extractFileNosFromText(message.subject);
    if (!hints.fileNo && subjectNos.length > 0) hints.fileNo = subjectNos[0];

    const subjectHints = extractSubjectHints(message.subject);
    if (!hints.claimNo && subjectHints.claimNo) hints.claimNo = subjectHints.claimNo;
    if (!hints.policyNo && subjectHints.policyNo) hints.policyNo = subjectHints.policyNo;

    const bodyText = [message.bodyText, message.bodyPreview, message.subject].filter(Boolean).join(' ');
    if (!hints.plate) {
      const plateMatch = bodyText.match(PLATE_PATTERN);
      if (plateMatch) hints.plate = this.normalizePlate(plateMatch[1]);
    }
    if (!hints.fileNo) {
      for (const pattern of FILE_NO_PATTERNS) {
        const m = bodyText.match(pattern);
        if (m) {
          hints.fileNo = this.normalizeFileNo(m[1] ?? m[0]);
          break;
        }
      }
    }

    if (!hints.claimNo) {
      const rcsInBody = bodyText.match(/\bRCS-(\d+)\b/i);
      if (rcsInBody?.[1]) hints.claimNo = rcsInBody[1];
    }

    return hints;
  }

  private parseExtracted(json: unknown): Record<string, string | null | undefined> {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
    const raw = json as Record<string, unknown>;
    return {
      fileNo: typeof raw.fileNo === 'string' ? raw.fileNo : null,
      policyNo: typeof raw.policyNo === 'string' ? raw.policyNo : null,
      plate: typeof raw.plate === 'string' ? raw.plate : null,
      claimNo: typeof raw.claimNo === 'string' ? raw.claimNo : null,
    };
  }

  private extractFileNosFromText(text: string): string[] {
    const found: string[] = [];
    for (const pattern of FILE_NO_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const m of matches) {
        const val = this.normalizeFileNo(m[1] ?? m[0]);
        if (val && !found.includes(val)) found.push(val);
      }
    }
    return found;
  }

  private normalizeFileNo(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '');
  }

  private normalizePlate(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase();
  }

  private async matchByFileNo(fileNo: string): Promise<FileMatchCandidate[]> {
    const [claim, emergency] = await Promise.all([
      this.prisma.claimFile.findUnique({ where: { fileNo }, select: { id: true, fileNo: true } }),
      this.prisma.emergencyCase.findFirst({
        where: { OR: [{ fileNo }, { caseNo: fileNo }] },
        select: { id: true, fileNo: true, caseNo: true },
      }),
    ]);

    const results: FileMatchCandidate[] = [];
    if (claim) {
      results.push({
        type: 'claim',
        id: claim.id,
        fileNo: claim.fileNo,
        score: 100,
        reason: 'Dosya no tam eşleşme',
      });
    }
    if (emergency) {
      results.push({
        type: 'emergency',
        id: emergency.id,
        fileNo: emergency.fileNo ?? emergency.caseNo,
        score: 100,
        reason: 'Dosya no tam eşleşme',
      });
    }
    return results;
  }

  private async matchByClaimNo(claimNo: string): Promise<FileMatchCandidate[]> {
    const claims = await this.prisma.claimFile.findMany({
      where: { claimNo: { equals: claimNo, mode: 'insensitive' } },
      take: 3,
      select: { id: true, fileNo: true, claimNo: true },
    });
    return claims.map((c) => ({
      type: 'claim' as const,
      id: c.id,
      fileNo: c.fileNo,
      score: 95,
      reason: `Hasar no eşleşmesi (${c.claimNo})`,
    }));
  }

  private async matchByPolicyNo(policyNo: string): Promise<FileMatchCandidate[]> {
    const claims = await this.prisma.claimFile.findMany({
      where: { policyNo: { equals: policyNo, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, fileNo: true, policyNo: true },
    });
    return claims.map((c, idx) => ({
      type: 'claim' as const,
      id: c.id,
      fileNo: c.fileNo,
      score: claims.length === 1 ? 88 : 75 - idx * 5,
      reason: `Poliçe no eşleşmesi (${c.policyNo})`,
    }));
  }

  private async matchByConversation(
    conversationId: string,
    excludeMessageId: string,
  ): Promise<FileMatchCandidate[]> {
    const linked = await this.prisma.inboundMessage.findFirst({
      where: {
        conversationId,
        id: { not: excludeMessageId },
        OR: [{ claimFileId: { not: null } }, { emergencyCaseId: { not: null } }],
      },
      select: {
        claimFileId: true,
        emergencyCaseId: true,
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, fileNo: true, caseNo: true } },
      },
    });
    if (!linked) return [];

    if (linked.claimFile) {
      return [{
        type: 'claim',
        id: linked.claimFile.id,
        fileNo: linked.claimFile.fileNo,
        score: 85,
        reason: 'Aynı e-posta zinciri',
      }];
    }
    if (linked.emergencyCase) {
      return [{
        type: 'emergency',
        id: linked.emergencyCase.id,
        fileNo: linked.emergencyCase.fileNo ?? linked.emergencyCase.caseNo,
        score: 85,
        reason: 'Aynı e-posta zinciri',
      }];
    }
    return [];
  }

  private async matchByPlate(plate: string): Promise<FileMatchCandidate[]> {
    const claims = await this.prisma.claimFile.findMany({
      where: {
        OR: [
          { description: { contains: plate, mode: 'insensitive' } },
          { lossType: { contains: plate, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, fileNo: true },
    });
    return claims.map((c, idx) => ({
      type: 'claim' as const,
      id: c.id,
      fileNo: c.fileNo,
      score: 72 - idx * 5,
      reason: `Plaka metin eşleşmesi (${plate})`,
    }));
  }

  private deduplicateCandidates(candidates: FileMatchCandidate[]): FileMatchCandidate[] {
    const map = new Map<string, FileMatchCandidate>();
    for (const c of candidates) {
      const key = `${c.type}:${c.id}`;
      const existing = map.get(key);
      if (!existing || c.score > existing.score) {
        map.set(key, c);
      }
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }

  preferredTargetForMailbox(mailbox: InboundMailbox): 'claim' | 'emergency' | 'any' {
    return mailbox === 'IHBAR' ? 'emergency' : 'claim';
  }
}
