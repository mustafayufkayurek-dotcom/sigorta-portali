import { WidgetDefinition, WidgetSpanConfig } from '../types/widgets';

export const WIDGET_IDS = {
  PRIMARY_KPI: 'primary-kpi',
  CRITICAL_ALERTS: 'critical-alerts',
  PENDING_ACTIONS: 'pending-actions',
  SLA_RISK: 'sla-risk',
  OWNERSHIP_LOAD: 'ownership-load',
  FINANCE_BOTTLENECK: 'finance-bottleneck',
  ACTIVITY_FEED: 'activity-feed',
} as const;

const defaultSpan: WidgetSpanConfig = {
  mobile: 1,
  tablet: 1,
  desktop: 1,
  wide: 1,
};

const twoColumnSpan: WidgetSpanConfig = {
  mobile: 1,
  tablet: 2,
  desktop: 2,
  wide: 2,
};

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  [WIDGET_IDS.PRIMARY_KPI]: {
    id: WIDGET_IDS.PRIMARY_KPI,
    title: 'Birincil KPIlar',
    priority: 'primary',
    defaultSpan: { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
    category: 'kpi',
  },
  [WIDGET_IDS.CRITICAL_ALERTS]: {
    id: WIDGET_IDS.CRITICAL_ALERTS,
    title: 'Kritik Uyarılar',
    priority: 'primary',
    defaultSpan: twoColumnSpan,
    category: 'alerts',
  },
  [WIDGET_IDS.PENDING_ACTIONS]: {
    id: WIDGET_IDS.PENDING_ACTIONS,
    title: 'Bekleyen Aksiyonlar',
    priority: 'primary',
    defaultSpan: twoColumnSpan,
    category: 'operations',
  },
  [WIDGET_IDS.SLA_RISK]: {
    id: WIDGET_IDS.SLA_RISK,
    title: 'SLA Risk Dağılımı',
    priority: 'secondary',
    defaultSpan: defaultSpan,
    category: 'analytics',
  },
  [WIDGET_IDS.OWNERSHIP_LOAD]: {
    id: WIDGET_IDS.OWNERSHIP_LOAD,
    title: 'Ownership Yoğunluğu',
    priority: 'secondary',
    defaultSpan: defaultSpan,
    category: 'analytics',
  },
  [WIDGET_IDS.FINANCE_BOTTLENECK]: {
    id: WIDGET_IDS.FINANCE_BOTTLENECK,
    title: 'Finans Darboğazları',
    priority: 'secondary',
    defaultSpan: defaultSpan,
    category: 'operations',
    minRole: ['admin', 'manager', 'finance'],
  },
  [WIDGET_IDS.ACTIVITY_FEED]: {
    id: WIDGET_IDS.ACTIVITY_FEED,
    title: 'Son Aktiviteler',
    priority: 'secondary',
    defaultSpan: defaultSpan,
    category: 'activity',
  },
};

export function getWidgetDefinition(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[id];
}

export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY);
}

export function getWidgetsByPriority(priority: 'primary' | 'secondary' | 'detail'): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((w) => w.priority === priority);
}
