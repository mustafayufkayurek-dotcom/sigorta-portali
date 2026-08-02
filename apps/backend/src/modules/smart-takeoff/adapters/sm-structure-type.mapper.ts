import { StructureElementTypes } from '../domain/domain.types';
const SM_ELEMENT_TO_SQT: Readonly<Record<string, string>> = {
  kapi: StructureElementTypes.DOOR,
  pencere: StructureElementTypes.WINDOW,
  pvc_dograma: StructureElementTypes.WINDOW,
  ahsap_dograma: StructureElementTypes.WINDOW,
  tavan: StructureElementTypes.CEILING,
  asma_tavan: StructureElementTypes.CEILING,
};

export function mapSmElementTypeToTakeoff(
  elementType: string,
  extensionJson?: unknown,
): string | null {
  const ext = extensionJson as { takeoffStructureType?: string } | null | undefined;
  const override = ext?.takeoffStructureType?.trim().toUpperCase();
  if (override && Object.values(StructureElementTypes).includes(override as never)) {
    return override;
  }
  return SM_ELEMENT_TO_SQT[elementType.trim().toLowerCase()] ?? null;
}
