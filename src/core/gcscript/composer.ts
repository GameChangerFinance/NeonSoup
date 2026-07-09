import type { CartItem, ExecutionReceiptItem, GcscriptArgs, IntentTemplate } from '../types';

type GcNode = Record<string, unknown>;

interface ComposeGroup {
  id: string;
  items: CartItem[];
}

interface ComposeEntry {
  item: CartItem;
  itemIndex: number;
  groupIndex: number;
  groupItemIndex: number;
  stepKey: string;
  cachePath: string;
}

interface ReceiptGroupSource {
  group: ComposeGroup;
  buildCachePath: string;
  entries: ComposeEntry[];
}

export interface BundledGcscriptSourceArgs {
  items: CartItem[];
  maxIntentsPerTransaction: number;
  returnUrlPattern: string;
  executionId?: string;
  groupRootId?: string;
}

export interface ParallelGcscriptSourceArgs {
  items: CartItem[];
  returnUrlPattern: string;
  executionId?: string;
}

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

function chunkItems(items: CartItem[], maxSize: number, rootId: string): ComposeGroup[] {
  const size = Math.max(1, Math.floor(maxSize) || 1);
  const groups: ComposeGroup[] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push({
      id: `${rootId}-${index + 1}`,
      items: items.slice(index, index + size),
    });
  }
  return groups;
}

function libImportFor(item: CartItem): { key: string; uri: string } {
  if (item.name === 'open') return { key: 'open', uri: 'app://lib/open.gcscript.jsonc' };
  if (item.name === 'fill') return { key: 'swap', uri: 'app://lib/swap.gcscript.jsonc' };
  return { key: 'close', uri: 'app://lib/close.gcscript.jsonc' };
}

function argRefsFor(item: CartItem, itemIndex: number): GcNode {
  const args = Object.fromEntries(
    Object.keys(item.args).map((key) => [key, `{get('args.items.${itemIndex}.protocol-args.${key}')}`]),
  );
  if (item.name === 'fill' || item.name === 'close') {
    args['offer-address'] = "{get('cache.myAddress')}";
    if (!('utxo-ask-quantity' in item.args)) args['utxo-ask-quantity'] = '0';
  }
  return args;
}

function importStepFor(entries: ComposeEntry[]): GcNode {
  return {
    type: '$importAsScript',
    argsByKey: Object.fromEntries(entries.map((entry) => [entry.stepKey, argRefsFor(entry.item, entry.itemIndex)])),
    from: Object.fromEntries(entries.map((entry) => [entry.stepKey, libImportFor(entry.item).uri])),
  };
}

function txFeatureReturnUrl(returnUrlPattern: string): string {
  const url = new URL(returnUrlPattern);
  url.searchParams.set('txHash', '{txHash}');
  return url.toString().replace('%7BtxHash%7D', '{txHash}');
}

function compactId(value: string): string {
  return value.length > 11 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function rootTitle(items: CartItem[]): string {
  if (items.length !== 1) return '🍲 NeonSoup Cart';
  const [item] = items;
  if (!item) return '🍲 NeonSoup Cart';
  const action = actionLabel(item);
  return `🍲 NeonSoup ${action} Offer`;
}

function transactionTitle(group: ComposeGroup, totalItems: number): string {
  const first = group.items[0];
  if (group.items.length === 1 && first) return `🍲 NeonSoup ${first.sourceLabel || `${actionLabel(first)} Offer`}`;
  return `🍲 NeonSoup Cart · ${group.items.length}/${totalItems}`;
}

function groupSummary(group: ComposeGroup, totalItems: number): string {
  const first = group.items[0];
  const sameAction = first && group.items.every((item) => item.name === first.name);
  if (!sameAction) return `Executing ${group.items.length}/${totalItems} Cart intents`;
  const verb = first.name === 'open' ? 'Opening' : first.name === 'fill' ? 'Filling' : 'Closing';
  return `${verb} ${group.items.length}/${totalItems} offers`;
}

function metadataMsgFor(group: ComposeGroup, totalItems: number, allItems: CartItem[]): string[] {
  const items = group.items.slice(0, 8);
  const lines = items.flatMap((item, index) => {
    const ref = item.args['utxo-tx-hash']
      ? ` · ${compactId(item.args['utxo-tx-hash'])}#${item.args['utxo-tx-index'] || '0'}`
      : '';
    return [
      `${index + 1}. ${(item.sourceLabel || actionLabel(item)).slice(0, 38)}${ref}\n`,
      `Item ${compactId(item.id)}\n`,
    ];
  });
  if (group.items.length > items.length) lines.push(`+${group.items.length - items.length} more\n`);
  return [rootTitle(allItems) + '\n', groupSummary(group, totalItems) + '\n', `Group ${compactId(group.id)}\n`, ...lines];
}

function buildFeaturesFor(argsPath: string, returnUrlPattern: string): GcNode {
  return {
    title: `{get('${argsPath}.build-title')}`,
    id: `{get('${argsPath}.build-id')}`,
    tags: `{get('${argsPath}.tags')}`,
    group: `{get('${argsPath}.group-id')}`,
    indexOf: `{get('${argsPath}.index-of')}`,
    returnURLPattern: txFeatureReturnUrl(returnUrlPattern),
  };
}

function auxiliaryDataFor(argsPath: string): GcNode {
  return {
    '674': {
      msg: `{get('${argsPath}.metadata-msg')}`,
    },
  };
}

function mechanicalTxFor(entries: ComposeEntry[], argsPath: string): GcNode {
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

  const run: GcNode = {
    outputs,
    options: {
      collateralCoinSelection: 'LASLAD',
    },
    auxiliaryData: auxiliaryDataFor(argsPath),
  };
  const tx: GcNode = {
    type: 'macro',
    run,
  };
  if (inputs.length) run.inputs = inputs;
  if (mints.length) run.mints = mints;
  if (scripts.length || consumers.length) {
    const plutus: GcNode = {};
    if (scripts.length) plutus.scripts = scripts;
    if (consumers.length) plutus.consumers = consumers;
    run.witnesses = { plutus };
  }
  if (requiredSigners.length) run.requiredSigners = requiredSigners;
  return tx;
}

function groupEntries(group: ComposeGroup, groupIndex: number, globalOffset: number): ComposeEntry[] {
  return group.items.map((item, groupItemIndex) => ({
    item,
    itemIndex: globalOffset + groupItemIndex,
    groupIndex,
    groupItemIndex,
    stepKey: String(globalOffset + groupItemIndex),
    cachePath: `intents.${globalOffset + groupItemIndex}`,
  }));
}

function intentTag(item: CartItem): string {
  const action = item.name === 'fill' ? 'swap' : item.name;
  return `P2PDeFiKernel-OWS-${action}-${item.args['intent-id']}`;
}

function outputArgs(item: CartItem): Array<{ role: ExecutionReceiptItem['outputs'][number]['role']; idPattern: string }> {
  const tag = intentTag(item);
  if (item.name === 'open') return [{ role: 'openedOffer', idPattern: `${tag}-offerWithBeacons` }];
  if (item.name === 'fill') {
    return [
      { role: 'filledOffer', idPattern: `${tag}-filledOffer` },
      { role: 'remainingOffer', idPattern: `${tag}-remainingOfferWithBeacons` },
    ];
  }
  return [{ role: 'closedFunds', idPattern: `${tag}-unfilledOffer` }];
}

function receiptArgs(mode: 'bundle' | 'parallel', executionId: string, sources: ReceiptGroupSource[]): GcscriptArgs {
  const items = sources.flatMap(({ group }) => group.items);
  return {
    mode,
    'execution-id': executionId,
    'item-count': items.length,
    'group-count': sources.length,
    groups: sources.map(({ group }, groupIndex) => ({
      'group-id': group.id,
      'group-index': groupIndex,
      'group-count': sources.length,
      'build-title': transactionTitle(group, items.length),
      'build-id': `${group.id}-${groupIndex + 1}of${sources.length}`,
      tags: ['p2p-defi-kernel', 'neonsoup', ...new Set(group.items.map((item) => item.name))],
      'index-of': groupIndex + 1,
      'metadata-msg': metadataMsgFor(group, items.length, items),
    })),
    items: sources.flatMap(({ entries }) =>
      entries.map((entry) => ({
        'item-id': entry.item.id,
        'intent-id': entry.item.args['intent-id'],
        type: entry.item.name,
        'item-index': entry.itemIndex,
        'group-index': entry.groupIndex,
        'group-item-index': entry.groupItemIndex,
        'protocol-args': entry.item.args,
        ...(entry.item.sourceOfferId ? { 'source-offer-id': entry.item.sourceOfferId } : {}),
        ...(entry.item.args['utxo-tx-hash']
          ? {
              'source-utxo': {
                'tx-hash': entry.item.args['utxo-tx-hash'],
                index: entry.item.args['utxo-tx-index'] || '0',
              },
            }
          : {}),
        outputs: outputArgs(entry.item),
      })),
    ),
  };
}

function receiptMacro(sources: ReceiptGroupSource[]): GcNode {
  const entries = sources.flatMap((source) =>
    source.entries.map((entry) => ({
      ...entry,
      group: source.group,
      buildCachePath: source.buildCachePath,
    })),
  );
  return {
    type: 'macro',
    run: {
      executionId: "{get('args.execution-id')}",
      itemCount: "{get('args.item-count')}",
      groupCount: "{get('args.group-count')}",
      txs: sources.map((source, txIndex) => ({
        groupId: `{get('args.groups.${txIndex}.group-id')}`,
        groupIndex: `{get('args.groups.${txIndex}.group-index')}`,
        txHash: `{get('cache.${source.buildCachePath}.txHash')}`,
        status: `{get('cache.submit.txsExtended.${txIndex}.status')}`,
        hasSubmitError: `{eq(get('cache.submit.txsExtended.${txIndex}.status'),'error')}`,
        hasContentionError: `{eq(get('cache.submit.txsExtended.${txIndex}.error'),get('cache.knownErrors.contention'))}`,
      })),
      items: entries.map((entry) => ({
        itemId: `{get('args.items.${entry.itemIndex}.item-id')}`,
        intentId: `{get('args.items.${entry.itemIndex}.intent-id')}`,
        type: `{get('args.items.${entry.itemIndex}.type')}`,
        itemIndex: `{get('args.items.${entry.itemIndex}.item-index')}`,
        groupId: `{get('args.groups.${entry.groupIndex}.group-id')}`,
        groupIndex: `{get('args.items.${entry.itemIndex}.group-index')}`,
        groupItemIndex: `{get('args.items.${entry.itemIndex}.group-item-index')}`,
        txHash: `{get('cache.${entry.buildCachePath}.txHash')}`,
        ...(entry.item.sourceOfferId ? { sourceOfferId: `{get('args.items.${entry.itemIndex}.source-offer-id')}` } : {}),
        ...(entry.item.args['utxo-tx-hash']
          ? {
              sourceUtxo: {
                txHash: `{get('args.items.${entry.itemIndex}.source-utxo.tx-hash')}`,
                index: `{get('args.items.${entry.itemIndex}.source-utxo.index')}`,
              },
            }
          : {}),
        outputs: outputArgs(entry.item).map((_, outputIndex) => ({
          role: `{get('args.items.${entry.itemIndex}.outputs.${outputIndex}.role')}`,
          index: `{get(join('.','cache','${entry.buildCachePath}','indexMap','output',get('args.items.${entry.itemIndex}.outputs.${outputIndex}.idPattern')))}`,
        })),
      })),
    },
  };
}

function baseScript(
  title: string,
  args: GcscriptArgs,
  run: GcNode,
  buildRefs: string[],
  receiptSources: ReceiptGroupSource[],
  returnUrlPattern: string,
): IntentTemplate['code'] {
  return {
    type: 'script',
    title,
    args,
    exportAs: 'neonsoupExecution',
    return: { mode: 'last' },
    returnURLPattern: returnUrlPattern,
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
        noFail: true,
        extras: true,
        txs: "{get('cache.sign')}",
      },
      knownErrors: {
        type: 'macro',
        run: {
          contention:
            "The transaction contains unknown UTxO references as inputs. This can happen if the inputs you're trying to spend have already been spent, or if you've simply referred to non-existing UTxO altogether. The field 'data.unknownOutputReferences' indicates all unknown inputs.",
        },
      },
      finally: receiptMacro(receiptSources),
    },
  };
}

export function createBundledGcscriptSource({
  items,
  maxIntentsPerTransaction,
  returnUrlPattern,
  executionId = shortId('execution'),
  groupRootId = shortId(groupPrefix(items)),
}: BundledGcscriptSourceArgs): IntentTemplate['code'] {
  const groups = chunkItems(items, maxIntentsPerTransaction, groupRootId);
  const txRun: GcNode = {};
  const buildRefs: string[] = [];
  const receiptSources: ReceiptGroupSource[] = [];
  let globalOffset = 0;
  groups.forEach((group, index) => {
    const entries = groupEntries(group, index, globalOffset);
    const txStep = `tx${index}`;
    const buildStep = `build${index}`;
    txRun[txStep] = mechanicalTxFor(entries, `args.groups.${index}`);
    txRun[buildStep] = {
      type: 'buildTx',
      ...buildFeaturesFor(`args.groups.${index}`, returnUrlPattern),
      tx: `{get('cache.${txStep}')}`,
    };
    buildRefs.push(`{get('cache.${buildStep}.txHex')}`);
    receiptSources.push({
      group,
      buildCachePath: buildStep,
      entries,
    });
    globalOffset += group.items.length;
  });
  const entries = receiptSources.flatMap((source) => source.entries);
  const run: GcNode = {
    myAddress: { type: 'getCurrentAddress' },
    intents: importStepFor(entries),
    ...txRun,
  };
  return baseScript(rootTitle(items), receiptArgs('bundle', executionId, receiptSources), run, buildRefs, receiptSources, returnUrlPattern);
}

export function createParallelGcscriptSource({
  items,
  returnUrlPattern,
  executionId = shortId('execution'),
}: ParallelGcscriptSourceArgs): IntentTemplate['code'] {
  const groups = items.map((item, index) => ({ id: `${executionId}-${index + 1}`, items: [item] }));
  const entries = groups.map((group, index) => ({
    item: group.items[0] as CartItem,
    itemIndex: index,
    groupIndex: index,
    groupItemIndex: 0,
    stepKey: String(index),
    cachePath: `intents.${index}`,
  }));
  const run: GcNode = {
    myAddress: { type: 'getCurrentAddress' },
    intents: importStepFor(entries),
  };
  entries.forEach((entry) => {
    const txStep = `tx${entry.itemIndex}`;
    const buildStep = `build${entry.itemIndex}`;
    const argsPath = `args.groups.${entry.groupIndex}`;
    run[txStep] = mechanicalTxFor([entry], argsPath);
    run[buildStep] = {
      type: 'buildTx',
      ...buildFeaturesFor(argsPath, returnUrlPattern),
      tx: `{get('cache.${txStep}')}`,
    };
  });
  const buildRefs = entries.map((entry) => `{get('cache.build${entry.itemIndex}.txHex')}`);
  const receiptSources = entries.map((entry) => ({
    group: groups[entry.groupIndex] as ComposeGroup,
    buildCachePath: `build${entry.itemIndex}`,
    entries: [entry],
  }));
  return baseScript(rootTitle(items), receiptArgs('parallel', executionId, receiptSources), run, buildRefs, receiptSources, returnUrlPattern);
}
