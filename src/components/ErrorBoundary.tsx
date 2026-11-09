import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a bug shows a recovery screen instead of a blank window.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI crashed:', error, info.componentStack);
  }

  componentDidMount() {
    // Dev only: once a hot update lands (e.g. a broken file got fixed), try rendering again
    // instead of staying stuck on the error screen until a manual reload.
    const hot = (import.meta as unknown as { hot?: { on: (e: string, cb: () => void) => void } }).hot;
    hot?.on('vite:afterUpdate', () => {
      if (this.state.error) this.setState({ error: null });
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center gap-4 bg-black text-neutral-200 p-8">
        <div className="text-sm font-semibold">Something went wrong while drawing the app.</div>
        <pre className="max-w-[640px] max-h-48 overflow-auto text-[11px] text-red-300/90 bg-white/5 border border-white/10 rounded-xl p-3 whitespace-pre-wrap">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold"
        >
          Reload
        </button>
      </div>
    );
  }
}
