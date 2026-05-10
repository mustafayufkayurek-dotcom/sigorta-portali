'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WidgetError } from './widget-error';

interface WidgetBoundaryProps {
  children: ReactNode;
}

interface WidgetBoundaryState {
  hasError: boolean;
}

export class WidgetBoundary extends Component<WidgetBoundaryProps, WidgetBoundaryState> {
  state: WidgetBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): WidgetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard widget render error', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <WidgetError message="Widget gösterilirken bir sorun oluştu." onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}