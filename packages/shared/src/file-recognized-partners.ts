export type FileRecognizedPartnerKind = 'sigorta_sirketi' | 'eksper_firmasi';

export type FileRecognizedPartner = {
  id: string;
  name: string;
  kind: FileRecognizedPartnerKind;
  fileCount: number;
};

export function isExpertOfficeSubType(subType?: string | null): boolean {
  const value = String(subType ?? '').trim();
  return value === 'eksper_firmasi' || value === 'eksper';
}

export function filePartnersSectionTitle(subType?: string | null): string | null {
  if (isExpertOfficeSubType(subType)) return 'Dosyadan Tanınan Sigorta Şirketleri';
  if (String(subType ?? '').trim() === 'sigorta_sirketi') return 'Dosyadan Tanınan Eksper Ofisleri';
  return null;
}

export function sortFileRecognizedPartners(rows: FileRecognizedPartner[]): FileRecognizedPartner[] {
  return [...rows]
    .filter((row) => row.id && row.name.trim())
    .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name, 'tr'))
    .slice(0, 20);
}
