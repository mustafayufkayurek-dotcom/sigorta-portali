import * as XLSX from 'xlsx';

export type ExcelSheetPayload = {
  sheetName: string;
  rows: Array<Record<string, string | number | null | undefined>>;
};

export function downloadWorkbook(opts: {
  fileName: string;
  meta: Array<[string, string]>;
  sheets: ExcelSheetPayload[];
}) {
  const wb = XLSX.utils.book_new();
  const metaAoA = [['Alan', 'Değer'], ...opts.meta];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaAoA), 'Özet');
  for (const sheet of opts.sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Bilgi: 'Veri yok' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
  }
  XLSX.writeFile(wb, opts.fileName.endsWith('.xlsx') ? opts.fileName : `${opts.fileName}.xlsx`);
}
