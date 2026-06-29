'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  PanelTableColumnPicker,
  TableColumnsProvider,
  usePanelTableColumns,
  type PanelTableColumnsValue,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

export function useSettingsTableColumns(columns: TableColumnDef[]) {
  const pathname = usePathname();
  return usePanelTableColumns(`table-cols:${pathname}`, columns);
}

export function SettingsTableColumnsProvider({
  columns,
  children,
}: {
  columns: TableColumnDef[];
  children: (tableColumns: PanelTableColumnsValue) => ReactNode;
}) {
  const tableColumns = useSettingsTableColumns(columns);
  return (
    <TableColumnsProvider value={tableColumns}>
      {children(tableColumns)}
    </TableColumnsProvider>
  );
}

export function SettingsTableColumnPicker({ tableColumns }: { tableColumns: PanelTableColumnsValue }) {
  return <PanelTableColumnPicker tableColumns={tableColumns} />;
}
