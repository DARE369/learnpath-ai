import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultFallback error={this.state.error} onReset={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-2xl">
        ⚠️
      </div>
      <div>
        <p className="text-base font-semibold text-white">Something went wrong</p>
        <p className="mt-1 text-sm text-white/50 max-w-sm">
          {error?.message ?? "An unexpected error occurred in this section."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="text-sm text-accent-light hover:text-white border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-colors"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
