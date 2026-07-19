import type {
  AppState,
  CartItem,
  IntentTemplate,
} from '../state/types';
import { APP_CONFIG, buildRuntimeGcscript } from '../config/appConfig';
import { serviceFeesForNetwork } from '../../../common/domain/serviceFees';
import { cleanReturnUrl } from './intents';
export { executionReceiptFromWalletReturn } from '../../../core/wallet/receipts';
import { createBundledGcscriptSource, createParallelGcscriptSource } from '../../../core/gcscript/composer';

export interface BundledIntentArgs {
  state: AppState;
  items: CartItem[];
  maxIntentsPerTransaction: number;
}

export interface ParallelIntentArgs {
  state: AppState;
  items: CartItem[];
}

const textEncoder = new TextEncoder();

function virtualFiles(): Record<string, { data: Uint8Array; mimeType: string }> {
  const file = (source: string) => ({
    data: textEncoder.encode(source),
    mimeType: 'application/json',
  });
  return Object.fromEntries(Object.entries(APP_CONFIG.gcscriptLib).map(([name, source]) => [name, file(source)]));
}

export async function buildBundledGcscriptIntent({
  state,
  items,
  maxIntentsPerTransaction,
}: BundledIntentArgs): Promise<IntentTemplate['code']> {
  return (await buildRuntimeGcscript(
    createBundledGcscriptSource({
      items,
      maxIntentsPerTransaction,
      returnUrlPattern: cleanReturnUrl(),
      networkTag: state.options.network,
      expectedAddress: state.wallet?.address,
      serviceFees: serviceFeesForNetwork(state.options.network, state.customAssets),
      privacyMode: state.wallet?.address ? 'connected' : 'incognito',
    }),
    { files: virtualFiles() },
  )) as IntentTemplate['code'];
}

export async function buildParallelGcscriptIntent({ state, items }: ParallelIntentArgs): Promise<IntentTemplate['code']> {
  return (await buildRuntimeGcscript(
    createParallelGcscriptSource({
      items,
      returnUrlPattern: cleanReturnUrl(),
      networkTag: state.options.network,
      expectedAddress: state.wallet?.address,
      serviceFees: serviceFeesForNetwork(state.options.network, state.customAssets),
      privacyMode: state.wallet?.address ? 'connected' : 'incognito',
    }),
    { files: virtualFiles() },
  )) as IntentTemplate['code'];
}
