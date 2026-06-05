import commonLibSource from '../../../intents/lib/common.gcscript.jsonc?raw';
import openLibSource from '../../../intents/lib/open.gcscript.jsonc?raw';
import closeLibSource from '../../../intents/lib/close.gcscript.jsonc?raw';
import swapLibSource from '../../../intents/lib/swap.gcscript.jsonc?raw';
import type { AppState, CartItem, IntentTemplate } from '../state/types';
import { getGcRuntime } from './gcRuntime';
import { cleanReturnUrl } from './intents';

type GcNode = Record<string, unknown>;

export interface BundledIntentArgs {
  state: AppState;
  items: CartItem[];
  maxIntentsPerTransaction: number;
}

export interface ParallelIntentArgs {
  state: AppState;
  items: CartItem[];
}

interface ComposeGroup {
  id: string;
  items: CartItem[];
}

interface ComposeEntry {
  item: CartItem;
  step: string;
  cachePath: string;
}

const textEncoder = new TextEncoder();

function shortId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random.slice(0, 12)}`;
}

function actionLabel(item: CartItem): string {
  return item.name === 'fill' ? 'Fill' : item.name.charAt(0).toUpperCase() + item.name.slice(1);
}

function groupPrefix(items: CartItem[]): string {
  const unique = [...new Set(items.map((item) => item.name))];
  return unique.length === 1 ? `${unique[0]}-${items.length}` : `composed-${items.length}`;
}

function chunkItems(items: CartItem[], maxSize: number): ComposeGroup[] {
  const size = Math.max(1, Math.floor(maxSize) || 1);
  const rootId = shortId(groupPrefix(items));
  const groups: ComposeGroup[] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push({
      id: rootId,
      items: items.slice(index, index + size),
    });
  }
  return groups;
}

function cartItemStepName(item: CartItem, index: number): string {
  return `${item.name}${index}`;
}

function libImportFor(item: CartItem): { key: string; uri: string } {
  if (item.name === 'open') return { key: 'open', uri: 'app://lib/open.gcscript.jsonc' };
  if (item.name === 'fill') return { key: 'swap', uri: 'app://lib/swap.gcscript.jsonc' };
  return { key: 'close', uri: 'app://lib/close.gcscript.jsonc' };
}

function importArgsFor(item: CartItem): unknown {
  if (item.name === 'open') return item.args;
  if (item.name === 'fill') {
    return {
      ...item.args,
      'offer-address': "{get('cache.myAddress')}",
    };
  }
  if (item.name === 'close') {
    return {
      ...item.args,
      'offer-address': item.args['offer-address'] || "{get('cache.myAddress')}",
    };
  }
  return item.args;
}

function importStepFor(entries: Array<{ item: CartItem; step: string }>): GcNode {
  return {
    type: '$importAsScript',
    argsByKey: Object.fromEntries(entries.map(({ item, step }) => [step, importArgsFor(item)])),
    from: Object.fromEntries(entries.map(({ item, step }) => [step, libImportFor(item).uri])),
  };
}

function txFeatureReturnUrl(): string {
  const url = new URL(cleanReturnUrl());
  url.searchParams.set('txHash', '{txHash}');
  return url.toString().replace('%7BtxHash%7D', '{txHash}');
}

function metadataMsgFor(group: ComposeGroup): string[] {
  const items = group.items.slice(0, 8);
  const lines = items.flatMap((item, index) => {
    const ref = item.args['utxo-tx-hash']
      ? ` ${item.args['utxo-tx-hash'].slice(0, 8)}#${item.args['utxo-tx-index'] || '0'}`
      : '';
    return [`${index + 1}. ${actionLabel(item)}${ref}\n`];
  });
  if (group.items.length > items.length) lines.push(`+${group.items.length - items.length} more\n`);
  return ['🍲 NeonSoup composed tx\n', `Group ${group.id}\n`, ...lines];
}

function buildFeaturesFor(group: ComposeGroup, index: number, total: number): GcNode {
  const tags = ['p2p-defi-kernel', 'neonsoup', ...new Set(group.items.map((item) => item.name))];
  const first = group.items[0];
  const action = first && group.items.every((item) => item.name === first.name) ? first.name : 'compose';
  const title =
    action === 'open'
      ? `🟢 Open ${group.items.length}`
      : action === 'fill'
        ? `🔁 Fill ${group.items.length}`
        : action === 'close'
          ? `🔴 Close ${group.items.length}`
          : `🍲 Compose ${group.items.length}`;
  return {
    title,
    id: `${group.id}-${index + 1}of${total}`,
    tags,
    group: group.id,
    indexOf: index + 1,
    returnURLPattern: txFeatureReturnUrl(),
  };
}

function auxiliaryDataFor(group: ComposeGroup): GcNode {
  return {
    '674': {
      msg: metadataMsgFor(group),
    },
  };
}

function mechanicalTxFor(entries: ComposeEntry[], group: ComposeGroup): GcNode {
  const mints = entries
    .filter(({ item }) => item.name === 'open' || item.name === 'close')
    .map(({ cachePath }) => `{get('cache.${cachePath}.tx.mints.beacons')}`);
  const inputs = entries
    .filter(({ item }) => item.name === 'fill' || item.name === 'close')
    .map(({ cachePath }) => `{get('cache.${cachePath}.tx.inputs.offerWithBeacons')}`);
  const outputs = entries.flatMap(({ item, cachePath }) => {
    if (item.name === 'open') return [`{get('cache.${cachePath}.tx.outputs.offerWithBeacons')}`];
    if (item.name === 'fill') {
      return [
        `{get('cache.${cachePath}.tx.outputs.filledOffer')}`,
        `{get('cache.${cachePath}.tx.outputs.remainingOfferWithBeacons')}`,
      ];
    }
    return [`{get('cache.${cachePath}.tx.outputs.unfilledOffer')}`];
  });
  const scripts = entries.flatMap(({ item, cachePath }) => {
    if (item.name === 'open') return [`{get('cache.${cachePath}.tx.witnesses.plutus.scripts.beaconsPolicy')}`];
    if (item.name === 'fill') return [`{get('cache.${cachePath}.tx.witnesses.plutus.scripts.spendingValidator')}`];
    return [
      `{get('cache.${cachePath}.tx.witnesses.plutus.scripts.beaconsPolicy')}`,
      `{get('cache.${cachePath}.tx.witnesses.plutus.scripts.spendingValidator')}`,
    ];
  });
  const consumers = entries.flatMap(({ item, cachePath }) => {
    if (item.name === 'open') return [`{get('cache.${cachePath}.tx.witnesses.plutus.consumers.beaconsMint')}`];
    if (item.name === 'fill') {
      return [`{get('cache.${cachePath}.tx.witnesses.plutus.consumers.offerWithBeaconsSpend')}`];
    }
    return [
      `{get('cache.${cachePath}.tx.witnesses.plutus.consumers.beaconsMint')}`,
      `{get('cache.${cachePath}.tx.witnesses.plutus.consumers.offerWithBeaconsSpend')}`,
    ];
  });
  const requiredSigners = entries
    .filter(({ item }) => item.name === 'close')
    .map(({ cachePath }) => `{get('cache.${cachePath}.tx.requiredSigners.0')}`);

  return {
    type: 'macro',
    run: {
      inputs,
      mints,
      outputs,
      witnesses: {
        plutus: {
          scripts,
          consumers,
        },
      },
      requiredSigners,
      options: {
        collateralCoinSelection: 'LASLAD',
      },
      auxiliaryData: auxiliaryDataFor(group),
    },
  };
}

function bundledGroupScript(group: ComposeGroup, groupStep: string, index: number, total: number): GcNode {
  const importEntries = group.items.map((item, itemIndex) => ({ item, step: cartItemStepName(item, itemIndex) }));
  const entries = importEntries.map(({ item, step }) => ({
    item,
    step,
    cachePath: `${groupStep}.intents.${step}`,
  }));
  return {
    myAddress: { type: 'getCurrentAddress' },
    intents: importStepFor(importEntries),
    tx: mechanicalTxFor(entries, group),
    build: {
      type: 'buildTx',
      ...buildFeaturesFor(group, index, total),
      tx: `{get('cache.${groupStep}.tx')}`,
    },
  };
}

function parallelGroupScript(group: ComposeGroup, index: number, total: number): GcNode {
  const importEntries = group.items.map((item, itemIndex) => ({ item, step: cartItemStepName(item, itemIndex) }));
  const run: GcNode = {
    myAddress: { type: 'getCurrentAddress' },
    intents: importStepFor(importEntries),
  };
  group.items.forEach((item, itemIndex) => {
    const step = cartItemStepName(item, itemIndex);
    const txStep = `${step}Tx`;
    const buildStep = `${step}Build`;
    const singleGroup = { id: group.id, items: [item] };
    run[txStep] = mechanicalTxFor([{ item, step, cachePath: `intents.${step}` }], singleGroup);
    run[buildStep] = {
      type: 'buildTx',
      ...buildFeaturesFor(singleGroup, index + itemIndex, total),
      tx: `{get('cache.${txStep}')}`,
    };
  });
  return run;
}

function baseScript(title: string, run: GcNode, buildRefs: string[]): IntentTemplate['code'] {
  return {
    type: 'script',
    title,
    exportAs: 'neonsoupCart',
    return: { mode: 'last' },
    returnURLPattern: cleanReturnUrl(),
    run: {
      ...run,
      sign: {
        type: 'signTxs',
        detailedPermissions: false,
        txs: buildRefs,
      },
      submit: {
        type: 'submitTxs',
        mode: 'noWait',
        txs: "{get('cache.sign')}",
      },
      finally: {
        type: 'macro',
        run: {
          txs: "{get('cache.sign')}",
        },
      },
    },
  };
}

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
  const groups = chunkItems(items, maxIntentsPerTransaction);
  const run: GcNode = {};
  const buildRefs: string[] = [];
  groups.forEach((group, index) => {
    const groupStep = `group${index}`;
    run[groupStep] = {
      type: 'script',
      return: {
        mode: 'macro',
        exec: `{get('cache.${groupStep}.build')}`,
      },
      run: bundledGroupScript(group, groupStep, index, groups.length),
    };
    buildRefs.push(`{get('cache.${groupStep}.txHex')}`);
  });
  return buildRuntimeGcscript(baseScript('🍲 NeonSoup Bundle', run, buildRefs));
}

export async function buildParallelGcscriptIntent({ items }: ParallelIntentArgs): Promise<IntentTemplate['code']> {
  const group: ComposeGroup = { id: shortId(`parallel-${items.length}`), items };
  const run = parallelGroupScript(group, 0, items.length);
  const buildRefs = items.map((item, index) => `{get('cache.${cartItemStepName(item, index)}Build.txHex')}`);
  return buildRuntimeGcscript(baseScript('🍲 NeonSoup Parallel', run, buildRefs));
}
