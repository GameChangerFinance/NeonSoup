import { APP_CONFIG } from '../config/appConfig';
import type {
  AppOptions,
  AppState,
  AssetMetadata,
  CartState,
  NetworkTag,
  TradeTab,
  WalletConnection,
} from '../state/types';

export interface StoredState {
  version?: string;
  options?: Partial<AppOptions>;
  forms?: Partial<AppState['forms']>;
  wallet?: WalletConnection | null;
  tradeTab?: TradeTab;
  customAssets?: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>;
  cart?: CartState;
}

export interface StoredStateResult {
  stored: StoredState;
  migrationNeeded: boolean;
  migrationSourceVersion: string;
  corrupted: boolean;
}

export function loadStoredState(): StoredStateResult {
  try {
    const stored = JSON.parse(localStorage.getItem(APP_CONFIG.storageKey) || '{}') as StoredState;
    const migrationSourceVersion = stored.version ? String(stored.version) : '';
    return {
      stored,
      migrationNeeded: Boolean(migrationSourceVersion && migrationSourceVersion !== APP_CONFIG.version),
      migrationSourceVersion,
      corrupted: false,
    };
  } catch {
    return {
      stored: {},
      migrationNeeded: true,
      migrationSourceVersion: 'unreadable',
      corrupted: true,
    };
  }
}

export function saveStoredState(state: AppState): void {
  if (state.migrationNeeded) return;
  const stored: StoredState = {
    version: APP_CONFIG.version,
    options: state.options,
    forms: state.forms,
    wallet: state.wallet,
    tradeTab: state.tradeTab,
    customAssets: state.customAssets,
    cart: state.cart,
  };
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(stored));
}

export function clearStoredState(): void {
  localStorage.removeItem(APP_CONFIG.storageKey);
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
