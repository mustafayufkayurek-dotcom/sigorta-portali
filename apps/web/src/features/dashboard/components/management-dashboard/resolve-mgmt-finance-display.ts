/**
 * Yönetim Dashboard finans kartları — fatura yokken dosya planı görünür.
 * Gerçekleşen (fatura tarihi) özet ile plan özeti karıştırılmaz; sıra kilitli.
 */

export type MgmtMoneyTriple = {
  revenue?: number | null;
  cost?: number | null;
  profit?: number | null;
  marginPct?: number | null;
};

export type MgmtFinanceDisplay = {
  point: { revenue: number; cost: number; profit: number; marginPct: number } | null;
  basis: 'actual' | 'plan' | 'lifetime-actual' | 'lifetime-plan' | 'empty';
  caption: string;
};

function hasMoney(m?: MgmtMoneyTriple | null): boolean {
  if (!m) return false;
  return (m.revenue ?? 0) > 0 || (m.cost ?? 0) > 0 || (m.profit ?? 0) !== 0;
}

function toPoint(m: MgmtMoneyTriple): {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
} {
  const revenue = Number(m.revenue) || 0;
  const cost = Number(m.cost) || 0;
  const profit = Number(m.profit) || 0;
  const marginPct =
    m.marginPct != null && Number.isFinite(Number(m.marginPct))
      ? Number(m.marginPct)
      : revenue > 0
        ? (profit / revenue) * 100
        : 0;
  return { revenue, cost, profit, marginPct };
}

export function resolveMgmtFinanceDisplay(input: {
  periodActual?: MgmtMoneyTriple | null;
  periodPlan?: MgmtMoneyTriple | null;
  lifetimeActual?: MgmtMoneyTriple | null;
  lifetimePlan?: MgmtMoneyTriple | null;
}): MgmtFinanceDisplay {
  if (hasMoney(input.periodActual)) {
    return {
      point: toPoint(input.periodActual!),
      basis: 'actual',
      caption: 'Önceki döneme göre',
    };
  }
  if (hasMoney(input.periodPlan)) {
    return {
      point: toPoint(input.periodPlan!),
      basis: 'plan',
      caption: 'Plan — fatura henüz yok',
    };
  }
  if (hasMoney(input.lifetimeActual)) {
    return {
      point: toPoint(input.lifetimeActual!),
      basis: 'lifetime-actual',
      caption: 'Seçili dönemde fatura yok — tüm dönem',
    };
  }
  if (hasMoney(input.lifetimePlan)) {
    return {
      point: toPoint(input.lifetimePlan!),
      basis: 'lifetime-plan',
      caption: 'Plan — fatura henüz yok (tüm dönem)',
    };
  }
  return {
    point: null,
    basis: 'empty',
    caption: 'Bu dönemde fatura ve plan tutarı yok',
  };
}
