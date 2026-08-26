'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[40vh] flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Beklenmeyen Bir Hata Oluştu</h2>
            <p className="text-sm text-slate-600 mb-6">
              Sayfa yüklenirken sorun oluştu. Lütfen tekrar deneyin. Sorun sürerse sayfayı yenileyin.
            </p>
            {this.state.error?.message ? (
              <p className="mb-6 break-words text-xs text-slate-500" data-testid="panel-hata-ayrinti">
                {this.state.error.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
