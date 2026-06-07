import type { ViewId } from '../../state/types';
import { WalletWidget } from './WalletWidget';
import { useAppDispatch, useAppState } from '../../state/appState';
import { openWalletCode } from '../../services/gcWallet';
import { connectIntent } from '../../services/intents';
import { selectedCartItems } from '../../services/cartIntents';

interface AppShellProps {
  children: React.ReactNode;
}

const navItems: Array<{ id: ViewId; label: string }> = [
  { id: 'trade', label: 'Trade' },
  { id: 'orders', label: 'Orders' },
  { id: 'activity', label: 'Activity' },
  { id: 'user', label: 'User' },
  { id: 'cart', label: 'Cart' },
  { id: 'options', label: 'Options' },
  { id: 'developer', label: 'Developer' },
];

export function AppShell({ children }: AppShellProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const selectedCartCount = selectedCartItems(state.cart).length;

  async function connect() {
    try {
      await openWalletCode(state, connectIntent());
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: {
          tone: 'danger',
          message: error instanceof Error ? error.message : 'Could not open wallet',
        },
      });
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div>
              <h1>NeonSoup DEX</h1>
              <p>Dev Tool Dapp</p>
            </div>
            <span className="badge text-bg-info">{state.options.network}</span>
          </div>

          <nav className="nav nav-pills top-nav" aria-label="Devtool navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-link text-start ${state.view === item.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'set-view', view: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="top-actions">
          <button
            type="button"
            className="btn theme-toggle cart-toggle"
            title="Open Cart"
            aria-label="Open Cart"
            onClick={() => dispatch({ type: 'set-cart-modal-open', open: true })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7 18a2 2 0 1 0 .01 0H7Zm10 0a2 2 0 1 0 .01 0H17ZM6.2 6l.55 3h10.9l-.9 4H8.1L6.55 4.5A1 1 0 0 0 5.57 4H3v2h2.2Zm2.23 9h8.32a2 2 0 0 0 1.95-1.56l1.18-5.25A1 1 0 0 0 18.9 7H7.12l-.18-1H5.2l1.45 7.96A1.25 1.25 0 0 0 7.88 15h.55Z"
              />
            </svg>
            {selectedCartCount ? <span className="cart-count-badge">{selectedCartCount}</span> : null}
          </button>
          <button
            type="button"
            className="btn theme-toggle"
            title={state.options.theme === 'light' ? 'Use dark theme' : 'Use light theme'}
            aria-label={state.options.theme === 'light' ? 'Use dark theme' : 'Use light theme'}
            onClick={() =>
              dispatch({
                type: 'set-options',
                options: { theme: state.options.theme === 'light' ? 'dark' : 'light' },
              })
            }
          >
            {state.options.theme === 'light' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21 13.1A8.5 8.5 0 0 1 10.9 3a7 7 0 1 0 10.1 10.1Z"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0 4a1 1 0 0 1-1-1v-1h2v1a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2h2v1a1 1 0 0 1-1 1Zm10 8a1 1 0 0 1-1 1h-1v-2h1a1 1 0 0 1 1 1ZM4 12a1 1 0 0 1-1 1H2v-2h1a1 1 0 0 1 1 1Zm14.95 6.36-.7.7-1.42-1.41.71-.71 1.41 1.42ZM7.17 6.34l-.71.71-1.41-1.42.7-.7 1.42 1.41Zm11.78-.7-1.41 1.41-.71-.71 1.42-1.41.7.7ZM7.17 17.66l-1.42 1.41-.7-.7 1.41-1.42.71.71Z"
                />
              </svg>
            )}
          </button>
          <WalletWidget
            wallet={state.wallet}
            onConnect={connect}
            onDisconnect={() => dispatch({ type: 'set-wallet', wallet: null })}
          />
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
