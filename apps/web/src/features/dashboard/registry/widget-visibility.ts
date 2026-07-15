import { WidgetDefinition, UserRole } from '../types/widgets';
import {
  DASHBOARD_ROLE_LAYOUTS,
  resolveDashboardLayoutId,
  type DashboardLayoutId,
} from './role-dashboard-layout';

export function filterWidgetsByRole(widgets: WidgetDefinition[], userRole: UserRole): WidgetDefinition[] {
  return widgets.filter((widget) => {
    if (!widget.minRole || widget.minRole.length === 0) return true;
    return widget.minRole.includes(userRole);
  });
}

export function isWidgetVisibleForRole(widget: WidgetDefinition, userRole: UserRole): boolean {
  if (!widget.minRole || widget.minRole.length === 0) return true;
  return widget.minRole.includes(userRole);
}

/** Rol → layout id (page.tsx tek kaynakla aynı sözleşme). */
export function getDashboardLayoutForRole(roleCode: string): DashboardLayoutId {
  return resolveDashboardLayoutId(roleCode);
}

export function listRegisteredDashboardRoles(): string[] {
  return Object.keys(DASHBOARD_ROLE_LAYOUTS);
}
