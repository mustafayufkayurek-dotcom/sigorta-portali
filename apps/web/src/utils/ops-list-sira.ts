/** Liste satır numarası — açık sayfa × sayfa boyutu + satır (1’den başlar). */
export function opsListRowNumber(page: number, pageSize: number, indexOnPage: number): number {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const i = Number.isFinite(indexOnPage) && indexOnPage >= 0 ? Math.floor(indexOnPage) : 0;
  return (p - 1) * size + i + 1;
}
