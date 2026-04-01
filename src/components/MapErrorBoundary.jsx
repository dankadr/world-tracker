import { Component } from 'react';
import * as Sentry from '@sentry/react';

export default class MapErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: info });
    }
    console.error('[MapErrorBoundary] Map crashed:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 200,
          gap: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: 'var(--bg-secondary, #f5f0e8)',
          color: 'var(--text-primary, #333)',
        }}>
          <span style={{ fontSize: '2rem' }}>🗺️</span>
          <p style={{ margin: 0, fontWeight: 500 }}>Failed to load map</p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              borderRadius: '6px',
              border: '1px solid var(--divider, #ccc)',
              background: 'var(--glass-bg, #fff)',
              color: 'var(--text-primary, #333)',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
