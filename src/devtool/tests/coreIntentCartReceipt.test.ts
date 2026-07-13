import {
  buildCloseIntentArgs,
  buildFillIntentArgsForQuantity,
  buildOpenIntentArgs,
  createCartItemSnapshot,
  createBundledGcscriptSource,
  createParallelGcscriptSource,
  executionReceiptFromWalletReturn,
  selectedCartItems,
  validateCartItemsCanBeAdded,
  visibleCartItems,
  type CartItem,
  type NeonSoupExecutionReceipt,
  type OpenOffer,
  type ResolvedAsset,
} from '../../core';
import { transactionsFromReceipt } from '../src/domain/transactions';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const offerAsset: ResolvedAsset = {
  policyId: 'policy-offer',
  assetNameHex: 'offer',
  assetKey: 'policy-offer.offer',
  assetId: 'policy-offeroffer',
  label: 'Offer Token',
  ticker: 'OFFER',
  decimals: 0,
  minExecutableOfferQuantity: '0',
  minMakerRemainderQuantity: '0',
};

const askAsset: ResolvedAsset = {
  policyId: 'policy-ask',
  assetNameHex: 'ask',
  assetKey: 'policy-ask.ask',
  assetId: 'policy-askask',
  label: 'Ask Token',
  ticker: 'ASK',
  decimals: 0,
  minExecutableOfferQuantity: '0',
  minMakerRemainderQuantity: '0',
};

function openOffer(overrides: Partial<OpenOffer> = {}): OpenOffer {
  return {
    id: 'tx'.padEnd(64, '0') + '#1',
    orderKind: 'one-way',
    txHash: 'tx'.padEnd(64, '0'),
    txIndex: '1',
    address: 'addr_owner',
    ownerStakeKeyHash: 'owner-stake',
    utxoCoinQuantity: '3000000',
    utxoOfferQuantity: '100',
    utxoAskQuantity: '',
    pairBeacon: 'pair',
    offerPolicyId: offerAsset.policyId,
    offerAssetName: offerAsset.assetNameHex,
    offerBeacon: 'offer-beacon',
    askPolicyId: askAsset.policyId,
    askAssetName: askAsset.assetNameHex,
    askBeacon: 'ask-beacon',
    priceNumerator: '5',
    priceDenominator: '2',
    ...overrides,
  };
}

const openArgs = buildOpenIntentArgs({
  offer: offerAsset,
  ask: askAsset,
  offerAmount: '4',
  askAmount: '10',
  ownerStakeKeyHash: 'owner-stake',
  intentId: 'open-id',
});

assert(openArgs['offer-quantity'] === '4', 'open args convert offer display amount to base units');
assert(openArgs['price-numerator'] === '5', 'open args reduce price numerator');
assert(openArgs['price-denominator'] === '2', 'open args reduce price denominator');
assert(openArgs['owner-stake-keyhash'] === 'owner-stake', 'open args preserve owner stake key hash');

const fillArgs = buildFillIntentArgsForQuantity({
  offer: openOffer(),
  offerQuantity: 3n,
  intentId: 'fill-id',
});

assert(fillArgs['ask-quantity'] === '8', 'fill args use ceiling ask math');
assert(fillArgs['utxo-ask-quantity'] === '0', 'fill args default missing accumulated ask quantity to zero');
assert(fillArgs['intent-id'] === 'fill-id', 'fill args preserve supplied intent id');

const closeArgs = buildCloseIntentArgs({
  offer: openOffer({ utxoAskQuantity: '13' }),
  ownerAddress: 'addr_wallet',
  intentId: 'close-id',
});

assert(closeArgs['utxo-ask-quantity'] === '13', 'close args preserve accumulated ask quantity');
assert(closeArgs['offer-address'] === 'addr_wallet', 'close args preserve explicit owner return address');
assert(closeArgs['owner-stake-keyhash'] === 'owner-stake', 'close args preserve owner stake key hash');

const sourceArgs = { ...fillArgs };
const cartItem = createCartItemSnapshot({
  action: 'fill',
  args: sourceArgs,
  intentId: 'fill-id',
  createdAt: 123,
  sourceOfferId: 'source-offer',
  sourceLabel: 'Fill 3 OFFER',
});
sourceArgs['offer-quantity'] = '999';

assert(cartItem.args['offer-quantity'] === '3', 'Cart item snapshots copy protocol args immutably');
assert(cartItem.sourceOfferId === 'source-offer', 'Cart item snapshots preserve source offer id');
assert(cartItem.pair?.offer.policyId === offerAsset.policyId, 'Cart item snapshots derive pair from args');

const pendingItem: CartItem = { ...cartItem, id: 'pending', status: 'pending', txHash: 'submitted' };
const draftDuplicate: CartItem = { ...cartItem, id: 'draft-duplicate', status: 'draft' };
const cart = {
  items: [cartItem, pendingItem],
  mode: 'bundle' as const,
  maxIntentsPerTransaction: 20,
  modalOpen: false,
  showConfirmedOnly: false,
};

assert(selectedCartItems(cart).length === 2, 'selected Cart helper keeps current selection semantics');
assert(visibleCartItems(cart).length === 1, 'visible Cart helper shows draft items by default');
assert(
  !validateCartItemsCanBeAdded(cart, [draftDuplicate]).ok,
  'Cart validation rejects duplicate draft fill source UTxOs',
);
assert(
  visibleCartItems({ ...cart, showConfirmedOnly: true }).every((item) => item.status !== 'draft'),
  'visible Cart helper shows execution history when requested',
);

const receipt: NeonSoupExecutionReceipt = {
  executionId: 'execution',
  itemCount: 1,
  groupCount: 1,
  txs: [
    {
      groupId: 'group',
      groupIndex: 0,
      txHash: 'submitted',
      status: 'pending',
      hasSubmitError: false,
      hasContentionError: false,
    },
  ],
  items: [
    {
      itemId: 'fill-fill-id',
      intentId: 'fill-id',
      type: 'fill',
      itemIndex: 0,
      groupId: 'group',
      groupIndex: 0,
      groupItemIndex: 0,
      txHash: 'submitted',
      sourceUtxo: { txHash: fillArgs['utxo-tx-hash'] || '', index: fillArgs['utxo-tx-index'] || '0' },
      outputs: [{ role: 'remainingOffer', index: 1 }],
    },
  ],
};

const parsedReceipt = executionReceiptFromWalletReturn({
  decoded: { exports: { neonsoupExecution: receipt } },
});

assert(parsedReceipt?.executionId === 'execution', 'valid wallet execution receipts are parsed');
assert(
  transactionsFromReceipt(receipt, 123)[0]?.status === 'submitted',
  'wallet receipts create submitted hints, not confirmed transactions',
);
assert(
  !executionReceiptFromWalletReturn({
    decoded: {
      exports: {
        neonsoupExecution: {
          ...receipt,
          items: [receipt.items[0], receipt.items[0]],
          itemCount: 2,
        },
      },
    },
  }),
  'duplicate receipt item ids are rejected',
);
assert(
  !executionReceiptFromWalletReturn({
    decoded: {
      exports: {
        neonsoupExecution: {
          ...receipt,
          items: [{ ...receipt.items[0], outputs: [{ role: 'bad', index: 0 }] }],
        },
      },
    },
  }),
  'malformed receipt output roles are rejected',
);

const legacyFillItem: CartItem = createCartItemSnapshot({
  action: 'fill',
  args: {
    ...fillArgs,
    'intent-id': 'legacy-fill',
  },
  intentId: 'legacy-fill',
  createdAt: 456,
});
delete legacyFillItem.args['utxo-ask-quantity'];
const closeItem: CartItem = createCartItemSnapshot({
  action: 'close',
  args: closeArgs,
  intentId: 'close-id',
  createdAt: 789,
});
const bundled = createBundledGcscriptSource({
  items: [legacyFillItem, closeItem],
  maxIntentsPerTransaction: 1,
  returnUrlPattern: 'https://example.test/neonsoup',
  executionId: 'execution-fixed',
  groupRootId: 'bundle-fixed',
});
const bundledRun = bundled.run as Record<string, Record<string, unknown>>;
const bundledImport = bundledRun.intents as {
  argsByKey: Record<string, Record<string, string>>;
};

assert(bundledRun.myAddress?.type === 'getCurrentAddress', 'bundle mode fetches current address once at root');
assert(bundledImport.argsByKey['0']?.['offer-address'] === "{get('cache.myAddress')}", 'bundle fill args use root wallet address');
assert(bundledImport.argsByKey['0']?.['utxo-ask-quantity'] === '0', 'bundle fill args default legacy missing utxo ask quantity');
assert(bundledImport.argsByKey['1']?.['offer-address'] === "{get('cache.myAddress')}", 'bundle close args use root wallet address');
assert(bundledRun.build0?.type === 'buildTx' && bundledRun.build1?.type === 'buildTx', 'bundle mode creates one buildTx per group');
assert((bundledRun.sign as Record<string, unknown>).type === 'signTxs', 'bundle mode signs all built transactions once');
assert((bundledRun.submit as Record<string, unknown>).type === 'submitTxs', 'bundle mode submits all signed transactions once');
assert((bundledRun.submit as Record<string, unknown>).extras === true, 'bundle submit keeps extras enabled');
assert((bundledRun.submit as Record<string, unknown>).noFail === true, 'bundle submit keeps noFail enabled');

const parallel = createParallelGcscriptSource({
  items: [legacyFillItem, closeItem],
  returnUrlPattern: 'https://example.test/neonsoup',
  executionId: 'parallel-fixed',
});
const parallelRun = parallel.run as Record<string, Record<string, unknown>>;

assert(parallelRun.myAddress?.type === 'getCurrentAddress', 'parallel mode fetches current address once at root');
assert(parallelRun.build0?.type === 'buildTx' && parallelRun.build1?.type === 'buildTx', 'parallel mode creates one buildTx per item');
assert((parallelRun.sign as Record<string, unknown>).type === 'signTxs', 'parallel mode signs all built transactions once');
assert((parallelRun.submit as Record<string, unknown>).type === 'submitTxs', 'parallel mode submits all signed transactions once');
assert((parallelRun.submit as Record<string, unknown>).extras === true, 'parallel submit keeps extras enabled');
assert((parallelRun.submit as Record<string, unknown>).noFail === true, 'parallel submit keeps noFail enabled');
