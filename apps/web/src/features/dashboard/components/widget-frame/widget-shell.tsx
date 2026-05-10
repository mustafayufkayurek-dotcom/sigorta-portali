'use client';

import { type ReactNode } from 'react';
import { WidgetBoundary } from './widget-boundary';
import { WidgetError } from './widget-error';
import { WidgetFrame } from './widget-frame';

interface WidgetShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'premium' | 'alert';
  isLoaded?: boolean;
  staggerIndex?: number;
  error?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function WidgetShell({
  error = false,
  errorMessage,
  onRetry,
  isLoaded = true,
  staggerIndex = 0,
  children,
  ...frameProps
}: WidgetShellProps) {
  return (
    <WidgetBoundary>
      <WidgetFrame {...frameProps} isLoaded={isLoaded} staggerIndex={staggerIndex}>
        {error ? <WidgetError message={errorMessage} onRetry={onRetry} /> : children}
      </WidgetFrame>
    </WidgetBoundary>
  );
}