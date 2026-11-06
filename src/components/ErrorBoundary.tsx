import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Translation } from 'react-i18next';

/**
 * Keeps a page that throws from blanking the whole app, most often a lazy page chunk that is gone
 * after a deploy or unreachable offline. The journal itself is safe: it is saved after each change.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[duckrep] page failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Translation>
        {(t) => (
          <main id="main-content" role="alert" className="mx-auto my-12 max-w-lg px-6 text-[var(--color-ink)]">
            <h1 className="text-xl font-semibold">{t('bootFailedTitle')}</h1>
            <p className="mt-3 text-[var(--color-muted)]">{t('bootFailedHint')}</p>
            <button type="button" onClick={() => window.location.reload()} className="dr-btn dr-btn-primary mt-4">
              {t('retry')}
            </button>
          </main>
        )}
      </Translation>
    );
  }
}
