'use client';

import { createContext, useContext } from 'react';
import type { PanelUserLike } from '@/utils/panel-access';

const PanelUserContext = createContext<PanelUserLike | null>(null);

export function PanelUserProvider({
  user,
  children,
}: {
  user: PanelUserLike | null;
  children: React.ReactNode;
}) {
  return <PanelUserContext.Provider value={user}>{children}</PanelUserContext.Provider>;
}

export function usePanelUser(): PanelUserLike | null {
  return useContext(PanelUserContext);
}
