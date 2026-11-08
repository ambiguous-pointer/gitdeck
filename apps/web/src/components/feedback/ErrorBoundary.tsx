import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort error boundary so a rendering failure never leaves a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('GitDeck UI crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-fg">
        <AlertOctagon className="h-10 w-10 text-danger" />
        <div className="text-center">
          <h1 className="text-base font-semibold">UI crashed</h1>
          <p className="mt-1 max-w-lg text-xs text-fg-muted">{this.state.error.message}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5 text-xs hover:bg-hover"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reload
        </button>
      </div>
    );
  }
}
