import { WidgetSpanConfig } from '../types/widgets';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export function getGridColumns(breakpoint: Breakpoint): number {
  const columnMap: Record<Breakpoint, number> = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    wide: 4,
  };
  return columnMap[breakpoint];
}

export function getWidgetSpan(spanConfig: WidgetSpanConfig, breakpoint: Breakpoint): number {
  return spanConfig[breakpoint];
}

export function getGridTemplateColumns(breakpoint: Breakpoint): string {
  const cols = getGridColumns(breakpoint);
  return `repeat(${cols}, minmax(0, 1fr))`;
}
