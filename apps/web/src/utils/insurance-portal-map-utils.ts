import { resolveProvinceCoords } from '@/data/turkey-province-coords';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import type {
  InsuranceMapPin,
  InsurancePinCategory,
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
  currentStatus?: { name?: string } | null;
};

const CATEGORY_COLORS: Record<InsurancePinCategory, string> = {
  residential: '#2563EB',
  industrial: '#7C3AED',
  marine: '#0891B2',
  generic: '#64748B',
};

export function pinCategoryColor(category: InsurancePinCategory): string {
  return CATEGORY_COLORS[category];
}

export function detectPinCategory(
  lossType?: string | null,
  productBranch?: string | null,
  propertyType?: string | null,
): InsurancePinCategory {
  const text = `${lossType ?? ''} ${productBranch ?? ''} ${propertyType ?? ''}`.toLocaleLowerCase('tr-TR');
  if (/deniz|yat|gemi|tekne|marine|marin/.test(text)) return 'marine';
  if (/fabrika|endüst|sanayi|industrial|depo|tesis|ticari/.test(text)) return 'industrial';
  if (/konut|ev|mesken|residential|daire|villa|bireysel/.test(text)) return 'residential';
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

function jitterCoords(id: string, lat: number, lng: number): [number, number] {
  const h = hashString(id);
  const dLat = ((h % 100) - 50) / 450;
  const dLng = (((h >> 8) % 100) - 50) / 450;
  return [lat + dLat, lng + dLng];
}

function resolveFileCoords(file: ClaimFileForMap): { lat: number; lng: number; city?: string } | null {
  const lat = file.propertyAddress?.latitude ?? file.customer?.latitude;
  const lng = file.propertyAddress?.longitude ?? file.customer?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return {
      lat,
      lng,
      city: file.propertyAddress?.city ?? file.customer?.city,
    };
  }

  const city = file.propertyAddress?.city ?? file.customer?.city;
  const province = resolveProvinceCoords(city);
  if (!province) return null;

  const [jLat, jLng] = jitterCoords(file.id, province.lat, province.lng);
  return { lat: jLat, lng: jLng, city: city ?? undefined };
}

export function claimFileToMapPin(file: ClaimFileForMap): InsuranceMapPin | null {
  const coords = resolveFileCoords(file);
  if (!coords) return null;

  const fileNumber = file.fileNo ?? file.fileNumber ?? '—';
  const category = detectPinCategory(file.lossType, file.productBranch, file.propertyType);
  const tooltip = formatClaimSubjectLabel(file.lossType, file.productBranch);

  return {
    id: file.id,
    fileId: file.id,
    fileNumber,
    latitude: coords.lat,
    longitude: coords.lng,
    label: fileNumber,
    tooltip: tooltip === '—' ? 'Hasar Dosyası' : tooltip,
    category,
    isShowcase: false,
    city: coords.city,
    statusName: file.currentStatus?.name,
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
