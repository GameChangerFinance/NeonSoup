import { APP_CONFIG } from '../config/appConfig';
import type { AppOptions, AppState, AssetMetadata, NetworkTag, WalletConnection } from '../state/types';

interface StoredState {
  version: number;
  options?: Partial<AppOptions>;
  forms?: Partial<AppState['forms']>;
  wallet?: WalletConnection | null;
  customAssets?: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>;
}

export function loadStoredState(): StoredState {
  try {
    const stored = JSON.parse(localStorage.getItem(APP_CONFIG.storageKey) || '{}') as StoredState;
    if (stored.options && 'showAdvanced' in stored.options) {
      // Older devtool snapshots persisted this removed option. Drop it so debug state
      // only reflects the current typed option surface.
      delete (stored.options as Record<string, unknown>).showAdvanced;
    }
    return stored;
  } catch {
    return { version: APP_CONFIG.version };
  }
}

export function saveStoredState(state: AppState): void {
  const stored: StoredState = {
    version: APP_CONFIG.version,
    options: state.options,
    forms: state.forms,
    wallet: state.wallet,
    customAssets: state.customAssets,
  };
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(stored));
}

export function readWalletReturn(): unknown {
  try {
    const raw = localStorage.getItem(APP_CONFIG.walletReturnKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function peekWalletReturn(): unknown {
  return readWalletReturn();
}

export function writeWalletReturn(value: unknown): void {
  localStorage.setItem(APP_CONFIG.walletReturnKey, JSON.stringify(value));
}

export function clearWalletReturn(): void {
  localStorage.removeItem(APP_CONFIG.walletReturnKey);
}
