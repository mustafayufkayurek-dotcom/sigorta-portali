import { Injectable } from '@nestjs/common';
import { InboundMailbox, InboundMessage, Prisma } from '@prisma/client';
import {
  mapInboundCategoryToMeridyen,
  mapInboundLossTypeToMeridyen,
  sanitizeInboundPhone,
  findInsuredMobilePhoneInText,
} from '@sigorta/shared';
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
  fileSubject?: string | null;
  insurer?: string | null;
}

export interface InboundRoutingSuggestion {
  suggestedAssigneeId?: string | null;
  suggestedAssigneeName?: string | null;
  suggestedAssigneeRole?: 'office' | 'field' | null;
  customerMatch: CustomerMatchResult;
  /** Mail gönderenine göre asistan firması eşleşmesi */
  assistantCustomerMatch: CustomerMatchResult;
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

export interface AssignableOfficeUser {
  id: string;
  firstName: string;
  lastName: string;
  departmentCodes: string[];
}

export interface AssignableUsersResult {
  departmentCode: string | null;
  departmentName: string | null;
  users: AssignableOfficeUser[];
}

export interface AutoAssignPreview {
  suggestion: InboundRoutingSuggestion;
  missingFields: string[];
  departmentCode: string | null;
  departmentName: string | null;
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
  fileSubject?: string | null;
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
    if (stored) return this.refreshStoredRoutingMailFields(message, stored);

    return this.buildRoutingSuggestion(message);
  }

  /** Önbellekteki routing eski/yanlış telefon-adres taşıyabilir — gövdeden yeniden doğrula. */
  private async refreshStoredRoutingMailFields(
    message: InboundMessage,
    stored: InboundRoutingSuggestion,
  ): Promise<InboundRoutingSuggestion> {
    const extracted = this.parseExtracted(message.aiExtractedJson);
    const heuristic = extractHeuristicFields(message);
    const bodyTextForPhone = [
      message.bodyText,
      message.bodyPreview,
      message.bodyHtml,
    ].filter(Boolean).join('\n');

    if (!extracted.phone?.trim()) {
      extracted.phone = heuristic.phone ?? findInsuredMobilePhoneInText(bodyTextForPhone) ?? null;
    } else {
      extracted.phone =
        sanitizeInboundPhone(extracted.phone)
        ?? heuristic.phone
        ?? findInsuredMobilePhoneInText(bodyTextForPhone)
        ?? null;
    }

    if (!extracted.address?.trim()) extracted.address = heuristic.address ?? null;
    if (!extracted.address?.trim()) {
      const policyNo = stored.mailFields?.policyNo ?? extracted.policyNo;
      const fileNo = stored.mailFields?.fileNo ?? extracted.fileNo;
      extracted.address = await this.resolveAddressFromExistingFiles(policyNo, fileNo);
    }

    const mailFields = {
      ...stored.mailFields,
      insuredPhone: extracted.phone?.trim() || null,
      insuredAddress: extracted.address?.trim() || null,
    };

    return {
      ...stored,
      insuredPhone: mailFields.insuredPhone,
      mailFields,
    };
  }

  async listAssignableOfficeUsers(messageId?: string): Promise<AssignableUsersResult> {
    let departmentId: string | null = null;
    let departmentCode: string | null = null;
    let departmentName: string | null = null;

    if (messageId) {
      const message = await this.prisma.inboundMessage.findUnique({ where: { id: messageId } });
      if (message) {
        departmentId = await this.resolveDepartmentId(message);
        if (departmentId) {
          const dept = await this.prisma.department.findUnique({
            where: { id: departmentId },
            select: { code: true, name: true },
          });
          departmentCode = dept?.code ?? null;
          departmentName = dept?.name ?? null;
        }
      }
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: ['office_staff', 'manager', 'admin'] } },
      select: { id: true },
    });
    const roleIds = roles.map((r) => r.id);
    if (roleIds.length === 0) {
      return { departmentCode, departmentName, users: [] };
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        isWebUser: true,
        roleId: { in: roleIds },
        ...(departmentId
          ? {
              departmentMemberships: {
                some: { departmentId, isActive: true },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentMemberships: {
          where: { isActive: true },
          select: { department: { select: { code: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return {
      departmentCode,
      departmentName,
      users: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        departmentCodes: u.departmentMemberships.map((m) => m.department.code),
      })),
    };
  }

  async getAutoAssignPreview(messageId: string): Promise<AutoAssignPreview> {
    const message = await this.prisma.inboundMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return {
        suggestion: this.emptySuggestion(),
        missingFields: ['Mesaj bulunamadı'],
        departmentCode: null,
        departmentName: null,
      };
    }

    const suggestion = await this.buildRoutingSuggestion(message);
    const missingFields = this.collectMissingFields(suggestion);
    const departmentId = await this.resolveDepartmentId(message);
    let departmentCode: string | null = null;
    let departmentName: string | null = null;
    if (departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { code: true, name: true },
      });
      departmentCode = dept?.code ?? null;
      departmentName = dept?.name ?? null;
    }

    return { suggestion, missingFields, departmentCode, departmentName };
  }

  private async buildRoutingSuggestion(message: InboundMessage): Promise<InboundRoutingSuggestion> {
    const extracted = this.parseExtracted(message.aiExtractedJson);
    const heuristic = extractHeuristicFields(message);
    const bodyTextForPhone = [
      message.bodyText,
      message.bodyPreview,
      message.bodyHtml,
    ].filter(Boolean).join('\n');
    if (!extracted.customerName?.trim()) extracted.customerName = heuristic.customerName ?? null;
    if (!extracted.phone?.trim()) {
      extracted.phone = heuristic.phone ?? findInsuredMobilePhoneInText(bodyTextForPhone) ?? null;
    } else {
      extracted.phone =
        sanitizeInboundPhone(extracted.phone)
        ?? heuristic.phone
        ?? findInsuredMobilePhoneInText(bodyTextForPhone)
        ?? null;
    }
    if (!extracted.policyNo?.trim()) extracted.policyNo = heuristic.policyNo ?? null;
    if (!extracted.fileNo?.trim()) extracted.fileNo = heuristic.fileNo ?? null;
    if (!extracted.claimNo?.trim()) extracted.claimNo = heuristic.claimNo ?? null;
    if (!extracted.fileSubject?.trim()) extracted.fileSubject = heuristic.fileSubject ?? null;
    if (!extracted.lossType?.trim()) extracted.lossType = heuristic.lossType ?? null;
    extracted.lossType = mapInboundLossTypeToMeridyen(extracted.lossType) ?? extracted.lossType;
    extracted.fileSubject = mapInboundCategoryToMeridyen(extracted.fileSubject) ?? extracted.fileSubject;
    if (!extracted.address?.trim()) {
      extracted.address = heuristic.address ?? null;
    }
    let addressInferredFromExistingFile = false;
    if (!extracted.address?.trim()) {
      const inferredAddress = await this.resolveAddressFromExistingFiles(
        extracted.policyNo,
        extracted.fileNo,
      );
      if (inferredAddress) {
        extracted.address = inferredAddress;
        addressInferredFromExistingFile = true;
      }
    }
    // Gönderen e-postası sigortalı eşleşmesinde kullanılmaz (ekspertiz firması karışıklığı).

    const customerMatch = await this.resolveCustomer(extracted, message.fromName);
    const assistantCustomerMatch = await this.resolveAssistantCustomer(message.fromAddress);
    const { city, district } = await this.resolveLocation(extracted.address);
    const insuranceCompanyId = await this.resolveInsuranceCompanyId(extracted.policyNo);
    const departmentId = await this.resolveDepartmentId(message);

    const warnings: string[] = [];
    const reasons: string[] = [];
    if (addressInferredFromExistingFile) {
      reasons.push('Adres mevcut dosya kaydından eşleştirildi');
    }
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

    const mailFields: InboundMailFields = {
      insuredName: extracted.customerName?.trim() || null,
      insuredPhone: extracted.phone?.trim() || null,
      insuredAddress: extracted.address?.trim() || null,
      fileNo: extracted.fileNo?.trim() || null,
      policyNo: extracted.policyNo?.trim() || null,
      claimNo: extracted.claimNo?.trim() || null,
      lossType: extracted.lossType?.trim() || null,
      fileSubject: extracted.fileSubject?.trim() || null,
    };

    for (const field of this.collectMissingFields({ mailFields })) {
      const warn = `Eksik bilgi: ${field}`;
      if (!warnings.includes(warn)) warnings.push(warn);
    }

    return {
      suggestedAssigneeId,
      suggestedAssigneeName,
      suggestedAssigneeRole,
      customerMatch,
      assistantCustomerMatch,
      insuredName: extracted.customerName?.trim() || null,
      insuredPhone: extracted.phone?.trim() || null,
      mailFields,
      warnings,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      insuranceCompanyId,
      city,
      district,
    };
  }

  private collectMissingFields(input: { mailFields?: InboundMailFields | null }): string[] {
    const mf = input.mailFields;
    const missing: string[] = [];
    if (!mf?.insuredName?.trim()) missing.push('Sigortalı adı soyadı');
    if (!mf?.insuredPhone?.trim()) missing.push('Sigortalı telefonu');
    if (!mf?.insuredAddress?.trim()) missing.push('Sigortalı adresi');
    if (!mf?.fileNo?.trim() && !mf?.policyNo?.trim()) missing.push('Dosya / poliçe numarası');
    if (!mf?.fileSubject?.trim()) missing.push('Dosya konusu');
    if (!mf?.lossType?.trim()) missing.push('Hasar şekli / hizmet türü');
    return missing;
  }

  private async resolveAddressFromExistingFiles(
    policyNo?: string | null,
    remedFileNo?: string | null,
  ): Promise<string | null> {
    const terms = new Set<string>();
    if (policyNo?.trim()) terms.add(policyNo.trim());
    if (remedFileNo?.trim()) {
      const normalized = remedFileNo.trim().toUpperCase();
      terms.add(normalized);
      terms.add(normalized.replace(/^RCS-/i, ''));
    }

    for (const term of terms) {
      const emergency = await this.prisma.emergencyCase.findFirst({
        where: {
          OR: [
            { fileNo: { equals: term, mode: 'insensitive' } },
            { fileNo: { contains: term, mode: 'insensitive' } },
            { notes: { contains: term, mode: 'insensitive' } },
          ],
          address: { notIn: ['', 'Belirtilmemiş'] },
        },
        select: { address: true },
        orderBy: { createdAt: 'desc' },
      });
      if (emergency?.address?.trim()) return emergency.address.trim();
    }

    if (policyNo?.trim()) {
      const claim = await this.prisma.claimFile.findFirst({
        where: {
          OR: [
            { policyNo: policyNo.trim() },
            { claimNo: policyNo.trim() },
            ...(remedFileNo
              ? [{ claimNo: { contains: remedFileNo.replace(/^RCS-/i, ''), mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: {
          propertyAddress: {
            select: {
              addressLine: true,
              city: true,
              district: true,
              neighborhood: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      const addr = claim?.propertyAddress;
      if (addr) {
        const parts = [
          addr.addressLine,
          addr.neighborhood,
          addr.district,
          addr.city,
        ].filter((p) => p?.trim());
        if (parts.length > 0) return parts.join(', ');
      }
    }

    return null;
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
        if (dup.existingRecord.entityType === 'corporate') {
          // Gönderen firma / kurumsal kayıt — sigortalı eşleşmesi değil
        } else {
          return {
            status: 'found',
            customer: {
              id: dup.existingRecord.id,
              name: dup.existingRecord.fullName,
            },
          };
        }
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
      fileSubject: typeof raw.fileSubject === 'string' ? raw.fileSubject : null,
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

  private async resolveAssistantCustomer(fromAddress: string): Promise<CustomerMatchResult> {
    const addr = fromAddress?.trim().toLowerCase() ?? '';
    if (!addr) return { status: 'not_found' };

    const REMED_TAX = '7340735275';
    const profiles: Array<{ match: (a: string) => boolean; taxNumber?: string; nameHint?: string }> = [
      { match: (a) => a.includes('remed.com'), taxNumber: REMED_TAX, nameHint: 'Remed' },
      { match: (a) => a.includes('safranbh.com'), nameHint: 'Safran' },
    ];

    for (const profile of profiles) {
      if (!profile.match(addr)) continue;
      const where: Prisma.CustomerWhereInput = {
        entityType: 'corporate',
        subType: 'asistan_firmasi',
        status: 'active',
        OR: [],
      };
      if (profile.taxNumber) {
        (where.OR as Prisma.CustomerWhereInput[]).push({ taxNumber: profile.taxNumber });
      }
      if (profile.nameHint) {
        (where.OR as Prisma.CustomerWhereInput[]).push({
          companyName: { contains: profile.nameHint, mode: 'insensitive' },
        });
      }
      const rows = await this.prisma.customer.findMany({
        where,
        select: { id: true, companyName: true, fullName: true },
        take: 5,
      });
      if (rows.length === 1) {
        const row = rows[0];
        return {
          status: 'found',
          customer: {
            id: row.id,
            name: row.companyName ?? row.fullName ?? 'Asistan Firması',
          },
        };
      }
      if (rows.length > 1) {
        return {
          status: 'ambiguous',
          candidates: rows.map((row) => ({
            id: row.id,
            name: row.companyName ?? row.fullName ?? 'Asistan Firması',
          })),
        };
      }
    }

    return { status: 'not_found' };
  }

  private emptySuggestion(): InboundRoutingSuggestion {
    return {
      customerMatch: { status: 'not_found' },
      assistantCustomerMatch: { status: 'not_found' },
      warnings: [],
      confidence: 0,
      reasons: [],
    };
  }
}
