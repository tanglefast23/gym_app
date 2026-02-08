'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * React error boundary that catches render errors in its subtree.
 * Shows a user-friendly error card with a retry button so a crash
 * in one section does not take down the entire app.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="rounded-2xl border border-border bg-elevated p-6">
        <h3 className="mb-2 text-base font-semibold text-text-primary">
          Something went wrong
        </h3>
        <p className="mb-4 text-sm text-text-secondary">
          This section failed to load. You can try again or reload the page.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          Try again
        </button>
      </div>
    );
  }
}
