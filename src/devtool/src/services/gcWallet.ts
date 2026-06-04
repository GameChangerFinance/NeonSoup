import { APP_CONFIG } from '../config/appConfig';
import type { AppState, IntentName, IntentTemplate, WalletConnection } from '../state/types';
import { cleanReturnUrl, prepareIntent } from './intents';
import { clearWalletReturn, writeWalletReturn } from './storage';
import { text } from '../domain/text';

export async function walletUrl(state: AppState, intent: IntentName = state.action): Promise<string> {
  if (!window.gc?.encode?.url) throw new Error('GameChanger library is not available on window.gc');
  const code = intent === 'connect' ? prepareConnectIntent(state.intents.connect) : prepareIntent(state, intent);
  if (!code) throw new Error(`Intent ${intent} is not loaded`);
  return window.gc.encode.url({
    input: JSON.stringify(code),
    apiVersion: '2',
    network: state.options.network,
    encoding: APP_CONFIG.encoding,
    disableNetworkRouter: false,
  });
}

function prepareConnectIntent(template?: IntentTemplate): IntentTemplate['code'] | null {
  if (!template?.code) return null;
  return {
    ...JSON.parse(JSON.stringify(template.code)),
    returnURLPattern: cleanReturnUrl(),
  };
}

export async function openWallet(state: AppState, intent: IntentName = state.action): Promise<void> {
  const url = await walletUrl(state, intent);
  if (state.options.popupMode) {
    window.open(url, 'gc_udc_popup', APP_CONFIG.popupFeatures);
  } else {
    window.location.href = url;
  }
}

function walletFromDecoded(decoded: unknown): WalletConnection | null {
  if (!decoded || typeof decoded !== 'object') return null;
  const root = decoded as Record<string, unknown>;
  const exports = root.exports && typeof root.exports === 'object' ? (root.exports as Record<string, unknown>) : {};
  const connect =
    exports.connect && typeof exports.connect === 'object'
      ? (exports.connect as Record<string, unknown>)
      : exports;
  const addressInfo =
    connect.addressInfo && typeof connect.addressInfo === 'object'
      ? (connect.addressInfo as Record<string, unknown>)
      : {};
  const stakingKey =
    connect.stakingKey && typeof connect.stakingKey === 'object'
      ? (connect.stakingKey as Record<string, unknown>)
      : {};
  const wallet = {
    name: text(connect.name || root.walletName || 'Connected wallet'),
    address: text(connect.address || root.address),
    stakeKeyHash: text(
      connect.stakeKeyHash ||
        stakingKey.pubKeyHashHex ||
        addressInfo.stakeKeyHash ||
        root.stakeKeyHash,
    ),
  };
  return wallet.address || wallet.stakeKeyHash ? wallet : null;
}

export async function captureWalletReturn(): Promise<WalletConnection | null> {
  const url = new URL(window.location.href);
  const result = url.searchParams.get('result');
  if (!result || !window.gc?.encodings?.msg?.decoder) return null;
  const decoded = await window.gc.encodings.msg.decoder(result);
  const wallet = walletFromDecoded(decoded);
  writeWalletReturn({ at: Date.now(), wallet, decoded });
  url.search = '';
  history.replaceState({}, document.title, `${url.pathname}${url.hash}`);
  try {
    window.close();
    setTimeout(() => {
      try {
        window.open('', '_self');
        window.close();
      } catch {
        // Browser may refuse to close a non-script-opened window.
      }
    }, 30);
  } catch {
    // Browser may refuse to close a non-script-opened window.
  }
  return wallet;
}

export function consumeWalletReturn(raw: unknown): WalletConnection | null {
  if (!raw || typeof raw !== 'object') return null;
  const wallet = (raw as Record<string, unknown>).wallet;
  clearWalletReturn();
  return wallet && typeof wallet === 'object' ? (wallet as WalletConnection) : null;
}
