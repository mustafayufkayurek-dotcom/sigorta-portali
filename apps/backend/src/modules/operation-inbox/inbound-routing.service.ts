import { Injectable } from '@nestjs/common';
import { InboundMailbox, InboundMessage, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaimResponsibilitiesService } from '../claim-responsibilities/claim-responsibilities.service';
import { ClaimFilesService } from '../claim-files/claim-files.service';
import { CustomersService } from '../customers/customers.service';
import { OperationInboxNotificationService } from './operation-inbox-notification.service';
import { extractHeuristicFields } from './inbound-heuristic-parser';

export interface CustomerMatchCandidate {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerMatchResult {
  status: 'found' | 'ambiguous' | 'not_found';
  customer?: CustomerMatchCandidate;
  candidates?: CustomerMatchCandidate[];
}

export interface InboundMailFields {
  insuredName?: string | null;
  insuredPhone?: string | null;
  insuredAddress?: string | null;
  fileNo?: string | null;
  policyNo?: string | null;
  claimNo?: string | null;
  lossType?: string | null;
  insurer?: string | null;
}

export interface InboundRoutingSuggestion {
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  suggestedAssigneeRole?: 'office' | 'field' | null;
  customerMatch: CustomerMatchResult;
  /** Formdan / konudan çıkarılan sigortalı adı soyadı */
  insuredName?: string | null;
  insuredPhone?: string | null;
  /** Mail + heuristic birleşik alanlar — modal ön-dolum / manuel düzeltme */
  mailFields?: InboundMailFields | null;
  warnings: string[];
  confidence: number;
  reasons: string[];
  insuranceCompanyId?: string | null;
  city?: string | null;
  district?: string | null;
  escalated?: boolean;
  escalatedAt?: string;
}

interface ExtractedFields {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  policyNo?: string | null;
  fileNo?: string | null;
  claimNo?: string | null;
  address?: string | null;
  lossType?: string | null;
  urgency?: 'NORMAL' | 'HIGH' | null;
  suggestedResponsibleRole?: 'office' | 'field' | null;
}

const OPEN_ACTIONS = new Set(['OPEN_HASAR_FILE', 'OPEN_ACIL_FILE']);
const MAILBOX_LABELS: Record<InboundMailbox, string> = {
  IHBAR: 'İhbar',
  HASAR: 'Hasar',
};

@Injectable()
export class InboundRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claimResponsibilities: ClaimResponsibilitiesService,
    private readonly claimFilesService: ClaimFilesService,
    private readonly customersService: CustomersService,
    private readonly inboxNotifications: OperationInboxNotificationService,
  ) {}

  async computeAndStoreRouting(messageId: string): Promise<InboundRoutingSuggestion | null> {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.status !== 'CLASSIFIED') return null;

    const suggestion = await this.buildRoutingSuggestion(message);
    await this.persistRouting(message, suggestion);

    if (this.shouldEscalate(message, suggestion)) {
      await this.escalateUnowned(message, suggestion);
    }

    return suggestion;
  }

  async getRoutingSuggestion(messageId: string): Promise<InboundRoutingSuggestion> {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      return this.emptySuggestion();
    }

    const stored = this.parseStoredRouting(message.aiExtractedJson);
    if (stored) return stored;

    return this.buildRoutingSuggestion(message);
  }

  private async buildRoutingSuggestion(message: InboundMessage): Promise<InboundRoutingSuggestion> {
    const extracted = this.parseExtracted(message.aiExtractedJson);
    const heuristic = extractHeuristicFields(message);
    if (!extracted.customerName?.trim()) extracted.customerName = heuristic.customerName ?? null;
    if (!extracted.phone?.trim()) extracted.phone = heuristic.phone ?? null;
    if (!extracted.policyNo?.trim()) extracted.policyNo = heuristic.policyNo ?? null;
    if (!extracted.fileNo?.trim()) extracted.fileNo = heuristic.fileNo ?? null;
    if (!extracted.claimNo?.trim()) extracted.claimNo = heuristic.claimNo ?? null;
    if (!extracted.address?.trim()) extracted.address = heuristic.address ?? null;
    if (!extracted.lossType?.trim()) extracted.lossType = heuristic.lossType ?? null;
    const emailHint = extracted.email?.trim() || message.fromAddress?.trim() || null;
    if (!extracted.email && emailHint && !emailHint.includes('@safranbh.com')) {
      extracted.email = emailHint;
    }

    const customerMatch = await this.resolveCustomer(extracted, message.fromName);
    const { city, district } = await this.resolveLocation(extracted.address);
    const insuranceCompanyId = await this.resolveInsuranceCompanyId(extracted.policyNo);
    const departmentId = await this.resolveDepartmentId(message);

    const warnings: string[] = [];
    const reasons: string[] = [];
    let confidence = 0.4;
    let suggestedAssigneeId: string | null = null;
    let suggestedAssigneeName: string | null = null;
    let suggestedAssigneeRole = extracted.suggestedResponsibleRole ?? null;

    if (insuranceCompanyId) {
      reasons.push('Sigorta şirketi poliçe kaydından çıkarıldı');
      confidence += 0.05;
    }

    if (city) {
      reasons.push(`Konum: ${city}${district ? ` / ${district}` : ''}`);
      confidence += 0.1;
    } else if (extracted.address?.trim()) {
      warnings.push('Adresten il/ilçe çıkarılamadı');
    }

    const responsibleUser = departmentId && city
      ? await this.claimResponsibilities.findResponsibleUser({
          departmentId,
          city,
          district: district ?? undefined,
        })
      : null;

    if (responsibleUser) {
      const scopeOk = await this.userMatchesInsuranceScope(responsibleUser.id, insuranceCompanyId);
      if (scopeOk) {
        suggestedAssigneeId = responsibleUser.id;
        suggestedAssigneeName = `${responsibleUser.firstName} ${responsibleUser.lastName}`.trim();
        reasons.push('Dosya sorumluluğu eşleşmesi');
        confidence += 0.35;
      } else {
        warnings.push('Önerilen sorumlu sigorta kapsamı dışında');
      }
    } else if (departmentId && city) {
      warnings.push('Dosya sorumluluğu kuralı eşleşmedi');
    }

    if (!suggestedAssigneeId && city) {
      const regionCandidates = await this.claimFilesService.suggestAssigneesByRegion(city, district ?? undefined);
      const filtered = insuranceCompanyId
        ? await this.filterByInsuranceScope(regionCandidates.map((c) => c.user.id), insuranceCompanyId)
        : regionCandidates.map((c) => c.user.id);

      const pickId = filtered[0] ?? regionCandidates[0]?.user.id;
      const pick = regionCandidates.find((c) => c.user.id === pickId);

      if (pick) {
        suggestedAssigneeId = pick.user.id;
        suggestedAssigneeName = `${pick.user.firstName} ${pick.user.lastName}`.trim();
        reasons.push('Bölge hizmet alanı eşleşmesi');
        confidence += 0.2;
      } else if (regionCandidates.length > 0 && insuranceCompanyId) {
        warnings.push('Bölgede sigorta kapsamına uygun sorumlu bulunamadı');
      } else if (!city) {
        warnings.push('Bölge eşleşmesi yapılamadı');
      }
    }

    if (!suggestedAssigneeId) {
      warnings.push('Önerilen sorumlu bulunamadı');
      confidence = Math.min(confidence, 0.45);
    } else {
      confidence = Math.min(confidence, 0.95);
    }

    if (customerMatch.status === 'found') {
      reasons.push('Mevcut müşteri eşleşti');
      confidence += 0.05;
    } else if (customerMatch.status === 'ambiguous') {
      warnings.push('Birden fazla müşteri adayı var');
    } else if (extracted.customerName || extracted.phone || extracted.email) {
      reasons.push('Yeni müşteri oluşturulabilir');
    }

    return {
      suggestedAssigneeId,
      suggestedAssigneeName,
      suggestedAssigneeRole,
      customerMatch,
      insuredName: extracted.customerName?.trim() || null,
      insuredPhone: extracted.phone?.trim() || null,
      mailFields: {
        insuredName: extracted.customerName?.trim() || null,
        insuredPhone: extracted.phone?.trim() || null,
        insuredAddress: extracted.address?.trim() || null,
        fileNo: extracted.fileNo?.trim() || null,
        policyNo: extracted.policyNo?.trim() || null,
        claimNo: extracted.claimNo?.trim() || null,
        lossType: extracted.lossType?.trim() || null,
      },
      warnings,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      insuranceCompanyId,
      city,
      district,
    };
  }

  private async resolveCustomer(
    extracted: ExtractedFields,
    _fromName: string | null,
  ): Promise<CustomerMatchResult> {
    const phone = this.normalizePhone(extracted.phone);
    const email = extracted.email?.trim().toLowerCase() || null;

    if (phone) {
      const dup = await this.customersService.checkDuplicate({ phone });
      if (dup.exists && dup.existingRecord?.type === 'customer') {
        return {
          status: 'found',
          customer: {
            id: dup.existingRecord.id,
            name: dup.existingRecord.fullName,
          },
        };
      }
    }

    if (email) {
      const dup = await this.customersService.checkDuplicate({ email });
      if (dup.exists && dup.existingRecord?.type === 'customer') {
        return {
          status: 'found',
          customer: {
            id: dup.existingRecord.id,
            name: dup.existingRecord.fullName,
          },
        };
      }
    }

    const nameQuery = extracted.customerName?.trim();
    if (nameQuery && nameQuery.length >= 3) {
      const result = await this.customersService.findAll({ search: nameQuery, limit: 5 });
      const candidates: CustomerMatchCandidate[] = (result.data ?? []).map((c: any) => ({
        id: c.id,
        name:
          c.entityType === 'individual'
            ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.fullName || '—'
            : c.companyName || c.fullName || '—',
        phone: c.phone,
        email: c.email,
      }));

      if (candidates.length === 1) {
        return { status: 'found', customer: candidates[0] };
      }
      if (candidates.length > 1) {
        return { status: 'ambiguous', candidates };
      }
    }

    return { status: 'not_found' };
  }

  private async resolveLocation(address?: string | null): Promise<{ city: string | null; district: string | null }> {
    if (!address?.trim()) return { city: null, district: null };

    const text = address.trim();
    const provinces = await this.prisma.province.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    let matchedProvince: { id: string; name: string } | null = null;
    for (const p of provinces) {
      if (text.toLowerCase().includes(p.name.toLowerCase())) {
        matchedProvince = p;
        break;
      }
    }
    if (!matchedProvince) return { city: null, district: null };

    const districts = await this.prisma.district.findMany({
      where: { provinceId: matchedProvince.id },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    let matchedDistrict: string | null = null;
    for (const d of districts) {
      if (text.toLowerCase().includes(d.name.toLowerCase())) {
        matchedDistrict = d.name;
        break;
      }
    }

    return { city: matchedProvince.name, district: matchedDistrict };
  }

  private async resolveInsuranceCompanyId(policyNo?: string | null): Promise<string | null> {
    if (!policyNo?.trim()) return null;

    const claim = await this.prisma.claimFile.findFirst({
      where: { policyNo: policyNo.trim() },
      orderBy: { createdAt: 'desc' },
      select: { insuranceCompanyId: true },
    });
    return claim?.insuranceCompanyId ?? null;
  }

  private async resolveDepartmentId(message: InboundMessage): Promise<string | null> {
    const isAcil =
      message.mailbox === 'IHBAR'
      || message.classification === 'ACIL_YARDIM'
      || message.suggestedAction === 'OPEN_ACIL_FILE';

    const code = isAcil ? 'acil-yardim' : 'hasar-onarim';
    const dept = await this.prisma.department.findFirst({
      where: { code, status: 'active' },
      select: { id: true },
    });
    return dept?.id ?? null;
  }

  private async userMatchesInsuranceScope(
    userId: string,
    insuranceCompanyId: string | null | undefined,
  ): Promise<boolean> {
    if (!insuranceCompanyId) return true;
    const scopes = await this.claimFilesService.getInsuranceScopes(userId);
    if (scopes.length === 0) return true;
    return scopes.includes(insuranceCompanyId);
  }

  private async filterByInsuranceScope(userIds: string[], insuranceCompanyId: string): Promise<string[]> {
    const result: string[] = [];
    for (const id of userIds) {
      if (await this.userMatchesInsuranceScope(id, insuranceCompanyId)) {
        result.push(id);
      }
    }
    return result;
  }

  private shouldEscalate(message: InboundMessage, suggestion: InboundRoutingSuggestion): boolean {
    if (message.assignedUserId) return false;
    if (!message.suggestedAction || !OPEN_ACTIONS.has(message.suggestedAction)) return false;
    if (suggestion.escalated) return false;

    const extracted = this.parseExtracted(message.aiExtractedJson);
    const highUrgency = extracted.urgency === 'HIGH';
    const noAssignee = !suggestion.suggestedAssigneeId;

    return highUrgency || noAssignee;
  }

  private async escalateUnowned(message: InboundMessage, suggestion: InboundRoutingSuggestion): Promise<void> {
    const extracted = this.parseExtracted(message.aiExtractedJson);
    const reason = !suggestion.suggestedAssigneeId
      ? 'Sorumlu bulunamadı, mesaj sahipsiz'
      : 'Yüksek aciliyetli ihbar, sahiplenme gerekli';

    suggestion.escalated = true;
    suggestion.escalatedAt = new Date().toISOString();
    await this.persistRouting(message, suggestion);

    void this.inboxNotifications.notifyUnownedEscalation({
      messageId: message.id,
      subject: message.subject,
      mailboxLabel: MAILBOX_LABELS[message.mailbox],
      urgency: extracted.urgency === 'HIGH' ? 'HIGH' : 'NORMAL',
      reason,
    });
  }

  private async persistRouting(message: InboundMessage, suggestion: InboundRoutingSuggestion): Promise<void> {
    const base =
      message.aiExtractedJson && typeof message.aiExtractedJson === 'object' && !Array.isArray(message.aiExtractedJson)
        ? { ...(message.aiExtractedJson as Record<string, unknown>) }
        : {};

    base.routing = suggestion as unknown as Prisma.JsonValue;

    await this.prisma.inboundMessage.update({
      where: { id: message.id },
      data: { aiExtractedJson: base as Prisma.InputJsonValue },
    });
  }

  private parseStoredRouting(json: unknown): InboundRoutingSuggestion | null {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const routing = (json as Record<string, unknown>).routing;
    if (!routing || typeof routing !== 'object' || Array.isArray(routing)) return null;
    return routing as InboundRoutingSuggestion;
  }

  private parseExtracted(json: unknown): ExtractedFields {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
    const raw = json as Record<string, unknown>;
    return {
      customerName: typeof raw.customerName === 'string' ? raw.customerName : null,
      phone: typeof raw.phone === 'string' ? raw.phone : null,
      email: typeof raw.email === 'string' ? raw.email : null,
      policyNo: typeof raw.policyNo === 'string' ? raw.policyNo : null,
      fileNo: typeof raw.fileNo === 'string' ? raw.fileNo : null,
      claimNo: typeof raw.claimNo === 'string' ? raw.claimNo : null,
      address: typeof raw.address === 'string' ? raw.address : null,
      lossType: typeof raw.lossType === 'string' ? raw.lossType : null,
      urgency: raw.urgency === 'HIGH' || raw.urgency === 'NORMAL' ? raw.urgency : null,
      suggestedResponsibleRole:
        raw.suggestedResponsibleRole === 'office' || raw.suggestedResponsibleRole === 'field'
          ? raw.suggestedResponsibleRole
          : null,
    };
  }

  private normalizePhone(phone?: string | null): string | undefined {
    if (!phone?.trim()) return undefined;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length === 12) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    return digits.length >= 10 ? digits : undefined;
  }

  private emptySuggestion(): InboundRoutingSuggestion {
    return {
      customerMatch: { status: 'not_found' },
      warnings: [],
      confidence: 0,
      reasons: [],
    };
  }
}
