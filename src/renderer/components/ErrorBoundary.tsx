'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render errors in child components
 * and displays a recovery UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: '2rem',
            margin: '1rem',
            borderRadius: '12px',
            background: 'rgba(255, 60, 60, 0.08)',
            border: '1px solid rgba(255, 60, 60, 0.25)',
            backdropFilter: 'blur(12px)',
            color: 'var(--text-primary, #fff)',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
            Something went wrong
          </h2>
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #aaa)',
              fontFamily: 'monospace',
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-primary, rgba(255,255,255,0.15))',
              background: 'var(--glass-bg, rgba(255,255,255,0.06))',
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
