import { ReactNode } from 'react';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetPriority = 'primary' | 'secondary' | 'detail';
export type UserRole = 'admin' | 'manager' | 'operator' | 'finance' | 'viewer';

export interface WidgetSpanConfig {
  mobile: number;    // 1-1 columns
  tablet: number;    // 1-2 columns
  desktop: number;   // 1-3 columns
  wide: number;      // 1-4 columns
}

export interface WidgetDefinition {
  id: string;
  title: string;
  description?: string;
  priority: WidgetPriority;
  defaultSpan: WidgetSpanConfig;
  minRole?: UserRole[];
  icon?: ReactNode;
  category?: 'kpi' | 'alerts' | 'operations' | 'analytics' | 'activity';
}

export interface WidgetProps {
  className?: string;
  onNavigate?: (path: string) => void;
}

export interface WidgetState {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage?: string;
}
