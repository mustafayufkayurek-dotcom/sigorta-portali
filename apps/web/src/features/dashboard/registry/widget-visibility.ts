import { WidgetDefinition, UserRole } from '../types/widgets';

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
