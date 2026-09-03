export type CustomerFileCountSource = {
  _count?: { claimFiles?: number; files?: number; emergencyCases?: number } | null;
  _openCount?: number | null;
  _closedCount?: number | null;
  fileCount?: number | null;
};

export function customerFileCounts(customer: CustomerFileCountSource): {
  total: number;
  open: number;
  closed: number;
} {
  const total = Number(
    customer._count?.claimFiles ?? customer._count?.files ?? customer.fileCount ?? 0,
  );
  const open = Number(customer._openCount ?? 0);
  const closed = Number(customer._closedCount ?? Math.max(0, total - open));
  return { total, open, closed };
}
