import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[POS ErrorBoundary] Caught UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {this.props.fallbackTitle || 'Component Encountered an Issue'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {this.props.fallbackMessage || 'The view could not be displayed properly. No data was lost.'}
            </p>
            {this.state.error?.message && (
              <div className="mt-3 p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-rose-300 text-left overflow-x-auto border border-rose-900/30">
                {this.state.error.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center space-x-2 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry / Recover View</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              Reload POS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
