'use client';

import { useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; icon: string; textColor: string }> = {
  success: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-green-500',
    icon: '✓',
    textColor: 'text-green-600',
  },
  error: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-status-danger',
    icon: '✕',
    textColor: 'text-red-600',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-yellow-500',
    icon: '⚠',
    textColor: 'text-yellow-600',
  },
  info: {
    bg: 'bg-white',
    border: 'border-l-4 border-l-blue-500',
    icon: 'ℹ',
    textColor: 'text-brand-600',
  },
};

function ToastMessage({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const config = TOAST_CONFIG[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    timerRef.current = setTimeout(() => {
      onRemove(toast.id);
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`
        flex items-start gap-3 w-full max-w-sm rounded-lg shadow-lg
        ${config.bg} ${config.border}
        px-4 py-3 animate-toast-in
      `}
      role="alert"
    >
      <span className={`text-base font-bold mt-0.5 flex-shrink-0 ${config.textColor}`}>
        {config.icon}
      </span>
      <p className="flex-1 text-sm text-gray-800 leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-1 mt-0.5"
        aria-label="Kapat"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastMessage toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
