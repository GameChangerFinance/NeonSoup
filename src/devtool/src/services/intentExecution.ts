import commonLibSource from '../../../intents/lib/common.gcscript.jsonc?raw';
import openLibSource from '../../../intents/lib/open.gcscript.jsonc?raw';
import closeLibSource from '../../../intents/lib/close.gcscript.jsonc?raw';
import swapLibSource from '../../../intents/lib/swap.gcscript.jsonc?raw';
import type {
  AppState,
  CartItem,
  IntentTemplate,
} from '../state/types';
import { getGcRuntime } from './gcRuntime';
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
  return {
    'lib/common.gcscript.jsonc': file(commonLibSource),
    'lib/open.gcscript.jsonc': file(openLibSource),
    'lib/close.gcscript.jsonc': file(closeLibSource),
    'lib/swap.gcscript.jsonc': file(swapLibSource),
  };
}

async function parseBuiltDataUri(dataUri: string): Promise<IntentTemplate['code']> {
  const response = await fetch(dataUri);
  return (await response.json()) as IntentTemplate['code'];
}

async function buildRuntimeGcscript(source: IntentTemplate['code']): Promise<IntentTemplate['code']> {
  const dataUri = await getGcRuntime().build.file({
    input: JSON.stringify(source),
    fileUri: 'app:///main.gcscript',
    files: virtualFiles(),
    doValidate: false,
    compactOutput: true,
  });
  return parseBuiltDataUri(dataUri);
}

export async function buildBundledGcscriptIntent({
  items,
  maxIntentsPerTransaction,
}: BundledIntentArgs): Promise<IntentTemplate['code']> {
  return buildRuntimeGcscript(
    createBundledGcscriptSource({
      items,
      maxIntentsPerTransaction,
      returnUrlPattern: cleanReturnUrl(),
    }),
  );
}

export async function buildParallelGcscriptIntent({ items }: ParallelIntentArgs): Promise<IntentTemplate['code']> {
  return buildRuntimeGcscript(
    createParallelGcscriptSource({
      items,
      returnUrlPattern: cleanReturnUrl(),
    }),
  );
}
