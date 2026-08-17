import { resolveProvinceCoords } from '@/data/turkey-province-coords';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import type {
  InsuranceMapPin,
  InsurancePinCategory,
  InsurancePinSlaTone,
  InsurancePortalRealStats,
  InsurancePortalVitrinStats,
  InsurancePortalViewMode,
} from '@/components/portal/insurance-portal-map.types';
import { INSURANCE_PORTAL_SHOWCASE_PINS } from '@/components/portal/insurance-portal-showcase-pins';

export type ClaimFileForMap = {
  id: string;
  fileNo?: string;
  fileNumber?: string;
  lossType?: string;
  productBranch?: string;
  propertyType?: string;
  delayRisk?: boolean;
  slaDueAt?: string | Date | null;
  approvedAt?: string | Date | null;
  repairStartAt?: string | Date | null;
  estimatedRepairEndAt?: string | Date | null;
  claimSubject?: { id?: string; name?: string | null } | null;
  assignedOfficeUser?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  customer?: {
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  propertyAddress?: {
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  currentStatus?: { name?: string; code?: string } | null;
};

const CATEGORY_COLORS: Record<InsurancePinCategory, string> = {
  residential: '#2563EB',
  industrial: '#7C3AED',
  marine: '#0891B2',
  generic: '#64748B',
};

const SLA_COLORS: Record<InsurancePinSlaTone, string> = {
  ok: '#16A34A',
  warn: '#D97706',
  late: '#DC2626',
};

export function pinCategoryColor(category: InsurancePinCategory): string {
  return CATEGORY_COLORS[category];
}

export function resolvePinSlaTone(file: {
  delayRisk?: boolean;
  slaDueAt?: string | Date | null;
}): InsurancePinSlaTone {
  if (file.delayRisk) return 'late';
  if (file.slaDueAt) {
    const due = new Date(file.slaDueAt).getTime();
    if (!Number.isNaN(due)) {
      const hoursLeft = (due - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft <= 24) return 'warn';
    }
  }
  return 'ok';
}

export function pinSlaColor(tone: InsurancePinSlaTone | undefined, category: InsurancePinCategory): string {
  if (tone) return SLA_COLORS[tone];
  return pinCategoryColor(category);
}

export function detectPinCategory(
  lossType?: string | null,
  productBranch?: string | null,
  propertyType?: string | null,
  claimSubjectName?: string | null,
): InsurancePinCategory {
  const text = `${lossType ?? ''} ${productBranch ?? ''} ${propertyType ?? ''} ${claimSubjectName ?? ''}`
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC');

  // Tekne / yat / deniz — konu adından da yakala (öncelikli)
  if (
    /deniz|yat\b|gemi|tekne|marine|marin|marina|bot\b|sail|tekne\s*&?\s*yat|yat\s*&?\s*tekne|su\s*arac/.test(
      text,
    )
  ) {
    return 'marine';
  }
  if (/fabrika|endüst|sanayi|industrial|depo|tesis|ticari\s*bina|işyeri/.test(text)) {
    return 'industrial';
  }
  // "ev" / "bireysel" tek başına yanlış konut ikonu üretiyordu — kaldırıldı
  if (/konut|mesken|daire|villa|residential|apartman|müstakil/.test(text)) {
    return 'residential';
  }
  return 'generic';
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** İl merkezi civarında küçük sapma — deniz/göl içine düşmeyi azaltır (~±1.5 km) */
function jitterCoords(id: string, lat: number, lng: number): [number, number] {
  const h = hashString(id);
  const dLat = ((h % 100) - 50) / 2200;
  const dLng = (((h >> 8) % 100) - 50) / 2200;
  return [lat + dLat, lng + dLng];
}

function parseCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function resolveFileCoords(file: ClaimFileForMap): {
  lat: number;
  lng: number;
  city?: string;
  approximate?: boolean;
} | null {
  const lat = parseCoord(file.propertyAddress?.latitude ?? file.customer?.latitude);
  const lng = parseCoord(file.propertyAddress?.longitude ?? file.customer?.longitude);
  if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
    return {
      lat,
      lng,
      city: file.propertyAddress?.city ?? file.customer?.city,
      approximate: false,
    };
  }

  const city = file.propertyAddress?.city ?? file.customer?.city;
  const province = resolveProvinceCoords(city);
  if (!province) return null;

  const [jLat, jLng] = jitterCoords(file.id, province.lat, province.lng);
  return { lat: jLat, lng: jLng, city: city ?? undefined, approximate: true };
}

function toIsoOrNull(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function claimFileToMapPin(file: ClaimFileForMap): InsuranceMapPin | null {
  const coords = resolveFileCoords(file);
  if (!coords) return null;

  const fileNumber = file.fileNo ?? file.fileNumber ?? '—';
  const subjectLabel =
    file.claimSubject?.name?.trim()
    || formatClaimSubjectLabel(file.lossType, file.productBranch);
  const tooltip = subjectLabel === '—' ? 'Hasar Dosyası' : subjectLabel;
  const category = detectPinCategory(
    file.lossType,
    file.productBranch,
    file.propertyType,
    file.claimSubject?.name,
  );
  const officeName = file.assignedOfficeUser
    ? `${file.assignedOfficeUser.firstName ?? ''} ${file.assignedOfficeUser.lastName ?? ''}`.trim() || null
    : null;
  const slaTone = resolvePinSlaTone(file);

  return {
    id: file.id,
    fileId: file.id,
    fileNumber,
    latitude: coords.lat,
    longitude: coords.lng,
    label: fileNumber,
    tooltip,
    category,
    isShowcase: false,
    city: coords.city,
    statusName: file.currentStatus?.name,
    statusCode: file.currentStatus?.code,
    delayRisk: Boolean(file.delayRisk),
    slaTone,
    claimSubjectName: tooltip,
    approvedAt: toIsoOrNull(file.approvedAt),
    repairStartAt: toIsoOrNull(file.repairStartAt),
    estimatedRepairEndAt: toIsoOrNull(file.estimatedRepairEndAt),
    assignedOfficeUserName: officeName,
  };
}

export function buildMapPins(
  files: ClaimFileForMap[],
  viewMode: InsurancePortalViewMode,
): InsuranceMapPin[] {
  const realPins = files
    .map(claimFileToMapPin)
    .filter((pin): pin is InsuranceMapPin => pin !== null);

  if (viewMode === 'ours') return realPins;
  return [...realPins, ...INSURANCE_PORTAL_SHOWCASE_PINS];
}

function vitrinSeed(userId: string, dateKey: string): number {
  return hashString(`${userId}:${dateKey}:meridyen-vitrin`);
}

function vitrinRange(seed: number, min: number, max: number, slot: number): number {
  const mixed = hashString(`${seed}:${slot}`);
  return min + (mixed % (max - min + 1));
}

export function computeVitrinStats(
  userId: string,
  real: InsurancePortalRealStats,
  viewMode: InsurancePortalViewMode,
): InsurancePortalVitrinStats | null {
  if (viewMode !== 'network') return null;

  const dateKey = new Date().toISOString().slice(0, 10);
  const seed = vitrinSeed(userId || 'anon', dateKey);
  const showcaseCount = INSURANCE_PORTAL_SHOWCASE_PINS.length;

  return {
    networkNodes: real.mapPinCount + showcaseCount + vitrinRange(seed, 18, 42, 1),
    activeInterventions: vitrinRange(seed, 12, 28, 2),
    avgResponseMinutes: vitrinRange(seed, 38, 72, 3),
    satisfactionPct: vitrinRange(seed, 91, 97, 4),
    partnerRegions: vitrinRange(seed, 14, 22, 5),
  };
}

export { CATEGORY_COLORS };
