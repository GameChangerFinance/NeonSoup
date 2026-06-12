import { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_CONFIG } from '../../config/appConfig';
import { clearStoredState } from '../../services/storage';

interface StateRecoveryBoundaryProps {
  children: ReactNode;
}

interface StateRecoveryBoundaryState {
  error: Error | null;
}

export class StateRecoveryBoundary extends Component<
  StateRecoveryBoundaryProps,
  StateRecoveryBoundaryState
> {
  state: StateRecoveryBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StateRecoveryBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NeonSoup devtool render failed', error, info);
  }

  updateStoredState = () => {
    clearStoredState();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-shell container-fluid py-4">
        <section className="app-card border-danger p-3 p-lg-4">
          <h1 className="h4 text-danger">App state needs an update</h1>
          <p className="text-body-secondary">
            NeonSoup could not render with the current saved browser state.
          </p>
          <pre className="bg-body-tertiary border rounded p-3 small json-scroll">
            {this.state.error.message}
          </pre>
          <button type="button" className="btn btn-warning" onClick={this.updateStoredState}>
            Update local state
          </button>
          <p className="small text-body-secondary mt-3 mb-0">
            Current app version: {APP_CONFIG.version}
          </p>
        </section>
      </main>
    );
  }
}
