'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  PanelConfirmDialog,
  type PanelConfirmRequest,
} from '@/components/ui/PanelConfirmDialog';

type Pending = PanelConfirmRequest & { resolve: (value: boolean) => void };

export function usePanelConfirm(): {
  confirm: (request: string | PanelConfirmRequest) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback((request: string | PanelConfirmRequest) => {
    const next: Pending = {
      ...(typeof request === 'string' ? { message: request, danger: true } : request),
      resolve: () => undefined,
    };
    return new Promise<boolean>((resolve) => {
      next.resolve = resolve;
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const close = (value: boolean) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  };

  return {
    confirm,
    dialog: (
      <PanelConfirmDialog
        open={Boolean(pending)}
        title={pending?.title}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        danger={pending?.danger ?? true}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    ),
  };
}
