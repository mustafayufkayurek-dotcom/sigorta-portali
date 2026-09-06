'use client';

import InsurancePortalMap from './InsurancePortalMap';
import type { InsuranceMapPin } from './insurance-portal-map.types';

type InsuranceLiveMap3DProps = {
  pins: InsuranceMapPin[];
  loading?: boolean;
  active?: boolean;
  onSelectPin?: (pin: InsuranceMapPin) => void;
  onMessagePin?: (pin: InsuranceMapPin) => void;
};

/** Canlı İzle — panel haritası ile aynı sokak + H/A kutu pin. */
export default function InsuranceLiveMap3D({
  pins,
  loading,
  active = true,
  onSelectPin,
  onMessagePin,
}: InsuranceLiveMap3DProps) {
  if (!active) return null;
  return (
    <InsurancePortalMap
      pins={pins}
      loading={loading}
      immersive
      onSelectPin={onSelectPin}
      onMessagePin={onMessagePin}
    />
  );
}
