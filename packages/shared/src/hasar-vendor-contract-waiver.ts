/** Geriye dönük kapanmış üç hasar dosyası — tedarikçi sözleşmesi yüklenmez. Başka dosyaya yayılmaz. */

export const HASAR_VENDOR_CONTRACT_WAIVED_FILES = [
  {
    id: '82805b75-173b-44d1-99e0-356f8c50fdd1',
    fileNo: '822017',
    label: 'Adalet Teşkilatını Güçlendirme Vakfı',
  },
  {
    id: '1707f8d5-6f76-4672-96c6-f92651399fe6',
    fileNo: '14102847240002',
    label: 'Serap Richard',
  },
  {
    id: '2b9d15db-2293-4dd8-9e7e-db38aa7658a7',
    fileNo: 'EUREKO',
    label: 'İlknur Yılmaz',
  },
] as const;

function normId(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function normFileNo(value?: string | null): string {
  return (value ?? '').trim().toLocaleUpperCase('tr-TR');
}

export function isHasarVendorContractWaived(input: {
  id?: string | null;
  fileNo?: string | null;
}): boolean {
  const id = normId(input.id);
  const fileNo = normFileNo(input.fileNo);
  if (!id && !fileNo) return false;
  return HASAR_VENDOR_CONTRACT_WAIVED_FILES.some(
    (row) => (id && normId(row.id) === id) || (fileNo && normFileNo(row.fileNo) === fileNo),
  );
}
