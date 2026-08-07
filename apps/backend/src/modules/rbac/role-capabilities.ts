/**
 * Yetkilendirme ekranı — operasyon yetenekleri (UI etiketi ↔ izin kodları).
 * Permission string UI’da gösterilmez; yalnız bu whitelist API’ye yazılır.
 */

export type CapabilityDefinition = {
  id: string;
  label: string;
  /** Bu yetenek açıkken role bağlanacak izin kodları */
  codes: string[];
};

export type CapabilityGroup = {
  id: string;
  title: string;
  capabilities: CapabilityDefinition[];
};

/** Yönetilebilir yetenek grupları (ilk sürüm: Tedarikçiler) */
export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'vendors',
    title: 'Tedarikçiler',
    capabilities: [
      {
        id: 'vendor_view',
        label: 'Tedarikçiyi Görüntüle',
        codes: ['vendor.view'],
      },
      {
        id: 'vendor_edit',
        label: 'Tedarikçi Ekle Ve Güncelle',
        codes: ['vendor.create', 'vendor.update'],
      },
      {
        id: 'vendor_delete',
        label: 'Tedarikçiyi Kalıcı Sil',
        codes: ['vendor.delete'],
      },
    ],
  },
];

const ALL_MANAGED_CODES = new Set(
  CAPABILITY_GROUPS.flatMap((g) => g.capabilities.flatMap((c) => c.codes)),
);

export function isManagedPermissionCode(code: string): boolean {
  return ALL_MANAGED_CODES.has(code);
}

export function expandCapabilityIds(capabilityIds: string[]): string[] {
  const codes = new Set<string>();
  for (const group of CAPABILITY_GROUPS) {
    for (const cap of group.capabilities) {
      if (capabilityIds.includes(cap.id)) {
        for (const code of cap.codes) codes.add(code);
      }
    }
  }
  return [...codes];
}

export function capabilityIdsFromPermissionCodes(codes: string[]): string[] {
  const set = new Set(codes);
  const ids: string[] = [];
  for (const group of CAPABILITY_GROUPS) {
    for (const cap of group.capabilities) {
      if (cap.codes.every((c) => set.has(c))) ids.push(cap.id);
    }
  }
  return ids;
}
