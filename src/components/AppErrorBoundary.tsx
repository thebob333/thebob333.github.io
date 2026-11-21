import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecoveryScreen } from '@/components/RecoveryScreen';

/** Top-level boundary: any crash shows the recovery screen instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[TELOS] App crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <RecoveryScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

const CHUNK_RELOAD_FLAG = 'telos_chunk_reload';

function isChunkLoadError(error: unknown) {
  const msg = String((error as Error)?.message ?? error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

interface RouteState {
  error: unknown;
  showRecovery: boolean;
}

/**
 * Per-page boundary (keyed by path in AppLayout): one broken page doesn't take
 * down navigation, and after a deploy a stale code-split chunk triggers one
 * automatic reload.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteState> {
  state: RouteState = { error: null, showRecovery: false };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[TELOS] Page crashed', error, info.componentStack);
    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
          sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    const { error, showRecovery } = this.state;
    if (!error) return this.props.children;
    if (showRecovery) {
      return <RecoveryScreen inline error={error} onRetry={() => this.setState({ error: null, showRecovery: false })} />;
    }
    return (
      <div className="mx-auto mt-10 max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 w-fit rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-base font-semibold">This page hit a snag</h2>
        <p className="mt-1 text-sm text-muted-foreground">The rest of the app still works and your data is safe.</p>
        <div className="mt-5 grid gap-2">
          <Button className="h-11" onClick={() => this.setState({ error: null })}>
            <RotateCcw className="mr-2 h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/" onClick={() => this.setState({ error: null })}>
              <Home className="mr-2 h-4 w-4" /> Go home
            </Link>
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => this.setState({ showRecovery: true })}>
            Recovery options
          </Button>
        </div>
      </div>
    );
  }
}
