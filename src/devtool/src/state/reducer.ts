import { configuredAssets, hardAsset, normalizeAssetMetadataRecord, normalizePortfolioAssets } from '../domain/assets';
import { normalizeOpenOffers } from '../domain/orders';
import { fromBase } from '../domain/quantities';
import { APP_CONFIG } from '../config/appConfig';
import { mergeProtocolTransactions } from '../domain/transactions';
import { reconcileCartItemsByTransactionStatus } from './cartReconciliation';
import { cartItemsWithoutSourceCollisions } from '../../../core/intents/cart';
import type { AppAction, AppOptions, AppState, AssetMetadata, CartState, NetworkTag } from './types';

export const defaultOptions: AppOptions = {
  ...APP_CONFIG.defaults.options,
};

function freshCart(): CartState {
  return {
    items: [],
    ...APP_CONFIG.defaults.cart,
  };
}

function cartVisibleItems(cart: CartState) {
  return cart.showConfirmedOnly
    ? cart.items.filter((item) => item.status !== 'draft')
    : cart.items.filter((item) => item.status === 'draft');
}

function withCart(state: AppState, cart: CartState): AppState {
  return { ...state, cart };
}

function defaultAssetKeys(network: NetworkTag, customAssets: InitialStateSeed['customAssets'] = {}) {
  const keys = Object.keys(configuredAssets(network, customAssets));
  return {
    offer: keys[0] || 'ada.ada',
    ask: keys[1] || keys[0] || 'ada.ada',
  };
}

interface InitialStateSeed {
  migrationNeeded?: boolean;
  migrationSourceVersion?: string;
  options?: Partial<AppOptions>;
  forms?: Partial<AppState['forms']>;
  wallet?: AppState['wallet'];
  customAssets?: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>;
  view?: AppState['view'];
  action?: AppState['action'];
  tradeTab?: AppState['tradeTab'];
  selectedOrderId?: string;
  selectedPair?: AppState['selectedPair'];
  cart?: AppState['cart'];
  openOffers?: AppState['openOffers'];
  portfolio?: AppState['portfolio'];
  transactions?: AppState['transactions'];
  notices?: Partial<AppState['notices']>;
  loading?: Partial<AppState['loading']>;
}

export function createInitialState(seed?: InitialStateSeed): AppState {
  const options = { ...defaultOptions, ...(seed?.options || {}) };
  const customAssets = seed?.customAssets || {};
  const assetInfo = configuredAssets(options.network, customAssets);
  const assetKeys = defaultAssetKeys(options.network, customAssets);
  return {
    appVersion: APP_CONFIG.version,
    migrationNeeded: seed?.migrationNeeded || false,
    migrationSourceVersion: seed?.migrationSourceVersion || '',
    view: seed?.view || 'trade',
    action: seed?.action || 'open',
    tradeTab: seed?.tradeTab || 'swap',
    selectedOrderId: seed?.selectedOrderId || '',
    selectedPair: seed?.selectedPair || null,
    options,
    forms: {
      openOfferAssetKey: assetKeys.offer,
      openAskAssetKey: assetKeys.ask,
      openOfferAmount: APP_CONFIG.defaults.forms.openOfferAmount,
      openAskAmount: APP_CONFIG.defaults.forms.openAskAmount,
      bulkOpenCount: APP_CONFIG.defaults.forms.bulkOpenCount,
      bulkOpenVariancePercent: APP_CONFIG.defaults.forms.bulkOpenVariancePercent,
      bulkOpenOfferVariancePercent: APP_CONFIG.defaults.forms.bulkOpenOfferVariancePercent,
      fillOfferAmount: '',
      fillAskAmount: '',
      swapOfferAmount: APP_CONFIG.defaults.forms.swapOfferAmount,
      swapPayUp: APP_CONFIG.defaults.forms.swapPayUp,
      ...(seed?.forms || {}),
    },
    wallet: seed?.wallet || null,
    cart: seed?.cart || freshCart(),
    lastWalletReturn: null,
    openOffers: normalizeOpenOffers(seed?.openOffers || []),
    openOffersSnapshot: null,
    portfolio: normalizePortfolioAssets(seed?.portfolio || []),
    transactions: mergeProtocolTransactions([], seed?.transactions || []),
    assetInfo,
    customAssets,
    notices: {
      app: null,
      offers: { message: 'Loading open offers...', tone: 'warning' },
      portfolio: { message: 'Connect wallet to load portfolio.', tone: 'warning' },
      ...(seed?.notices || {}),
    },
    loading: {
      offers: false,
      portfolio: false,
      ...(seed?.loading || {}),
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'replace-state':
      return action.state;
    case 'set-view':
      return { ...state, view: action.view };
    case 'set-trade-tab':
      return {
        ...state,
        tradeTab: action.tab,
        action: action.tab === 'bulk-open' || action.tab === 'swap' ? state.action : action.tab,
      };
    case 'set-options': {
      const options = { ...state.options, ...action.options };
      const networkChanged = action.options.network && action.options.network !== state.options.network;
      const assetKeys = defaultAssetKeys(options.network, state.customAssets);
      return {
        ...state,
        options,
        selectedOrderId: networkChanged ? '' : state.selectedOrderId,
        selectedPair: networkChanged ? null : state.selectedPair,
        assetInfo: networkChanged ? configuredAssets(options.network, state.customAssets) : state.assetInfo,
        forms: networkChanged
          ? {
              ...state.forms,
              openOfferAssetKey: assetKeys.offer,
              openAskAssetKey: assetKeys.ask,
            }
          : state.forms,
      };
    }
    case 'set-forms':
      return { ...state, forms: { ...state.forms, ...action.forms } };
    case 'set-wallet':
      return { ...state, wallet: action.wallet, portfolio: action.wallet ? state.portfolio : [] };
    case 'set-wallet-return':
      return { ...state, lastWalletReturn: action.payload };
    case 'add-cart-item': {
      const items = cartItemsWithoutSourceCollisions(state.cart, [action.item]);
      if (!items.length) return state;
      const cart = {
        ...state.cart,
        items: [...state.cart.items, ...items],
      };
      return withCart(state, cart);
    }
    case 'add-cart-items': {
      const items = cartItemsWithoutSourceCollisions(state.cart, action.items);
      if (!items.length) return state;
      const cart = {
        ...state.cart,
        items: [...state.cart.items, ...items],
      };
      return withCart(state, cart);
    }
    case 'remove-cart-item': {
      const cart = {
        ...state.cart,
        items: state.cart.items.filter((item) => item.id !== action.itemId),
      };
      return withCart(state, cart);
    }
    case 'remove-cart-items': {
      const itemIds = new Set(action.itemIds);
      const cart = {
        ...state.cart,
        items: state.cart.items.filter((item) => !itemIds.has(item.id)),
      };
      return withCart(state, cart);
    }
    case 'purge-confirmed-cart-items':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.filter((item) => item.status !== 'confirmed'),
      });
    case 'select-all-visible-cart-items': {
      const visibleIds = new Set(cartVisibleItems(state.cart).map((item) => item.id));
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) => (visibleIds.has(item.id) ? { ...item, selected: true } : item)),
      });
    }
    case 'deselect-all-cart-items':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) => ({ ...item, selected: false })),
      });
    case 'set-cart-item-selected':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) =>
          item.id === action.itemId ? { ...item, selected: action.selected } : item,
        ),
      });
    case 'set-cart-items-selected': {
      const itemIds = new Set(action.itemIds);
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) =>
          itemIds.has(item.id) ? { ...item, selected: action.selected } : item,
        ),
      });
    }
    case 'apply-execution-receipt': {
      const receiptItems = new Map(
        action.receipt.items.map((item) => [item.itemId, item] as const),
      );
      const receiptTxs = new Map(
        action.receipt.txs.map((tx) => [tx.groupIndex, tx] as const),
      );
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((cartItem) => {
          const result = receiptItems.get(cartItem.id);
          if (!result) return cartItem;
          const tx = receiptTxs.get(result.groupIndex);
          const hasSubmitError = Boolean(tx?.hasSubmitError);
          return {
            ...cartItem,
            status: hasSubmitError ? 'failed' : 'pending',
            ...(!hasSubmitError ? { pendingAt: action.at } : {}),
            selected: false,
            txHash: tx?.txHash || result.txHash,
            groupId: result.groupId,
            groupIndex: result.groupIndex,
            ...(tx?.status ? { walletSubmitStatus: tx.status } : {}),
            walletSubmitError: hasSubmitError,
            walletSubmitContention: Boolean(tx?.hasContentionError),
            expectedOutputs: result.outputs,
          };
        }),
      });
    }
    case 'requeue-cart-item':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const {
            pendingAt: _pendingAt,
            txHash: _txHash,
            groupId: _groupId,
            groupIndex: _groupIndex,
            walletSubmitStatus: _walletSubmitStatus,
            walletSubmitError: _walletSubmitError,
            walletSubmitContention: _walletSubmitContention,
            expectedOutputs: _expectedOutputs,
            ...draft
          } = item;
          return { ...draft, status: 'draft', selected: true };
        }),
      });
    case 'set-cart-mode':
      return withCart(state, { ...state.cart, mode: action.mode });
    case 'set-cart-max-intents-per-transaction':
      return withCart(state, {
        ...state.cart,
        maxIntentsPerTransaction: Math.max(1, Math.floor(action.value) || 1),
      });
    case 'set-cart-modal-open':
      return { ...state, cart: { ...state.cart, modalOpen: action.open } };
    case 'set-cart-show-confirmed-only':
      return { ...state, cart: { ...state.cart, showConfirmedOnly: action.showConfirmedOnly } };
    case 'set-open-offers': {
      const openOffers = normalizeOpenOffers(action.offers);
      return {
        ...state,
        openOffers,
        openOffersSnapshot: action.snapshot || state.openOffersSnapshot,
        selectedOrderId: state.selectedOrderId || openOffers[0]?.id || '',
      };
    }
    case 'set-portfolio':
      return { ...state, portfolio: normalizePortfolioAssets(action.portfolio) };
    case 'set-asset-info':
      return { ...state, assetInfo: { ...state.assetInfo, ...action.assets } };
    case 'set-custom-assets': {
      const customAssets = {
        ...state.customAssets,
        [action.network]: normalizeAssetMetadataRecord(action.assets),
      };
      const assetKeys = defaultAssetKeys(state.options.network, customAssets);
      const hasOfferKey = Boolean(configuredAssets(state.options.network, customAssets)[state.forms.openOfferAssetKey]);
      const hasAskKey = Boolean(configuredAssets(state.options.network, customAssets)[state.forms.openAskAssetKey]);
      return {
        ...state,
        customAssets,
        assetInfo: configuredAssets(state.options.network, customAssets),
        forms: {
          ...state.forms,
          openOfferAssetKey: hasOfferKey ? state.forms.openOfferAssetKey : assetKeys.offer,
          openAskAssetKey: hasAskKey ? state.forms.openAskAssetKey : assetKeys.ask,
        },
      };
    }
    case 'set-selected-order':
      return { ...state, selectedOrderId: action.orderId };
    case 'set-selected-pair':
      return { ...state, selectedPair: action.pair };
    case 'add-transaction':
      return { ...state, transactions: mergeProtocolTransactions(state.transactions, [action.tx]) };
    case 'merge-transactions':
      return { ...state, transactions: mergeProtocolTransactions(state.transactions, action.transactions) };
    case 'reconcile-confirmed-transactions': {
      const txHashes = new Set(action.txHashes);
      const failedTxHashes = new Set(action.failedTxHashes || []);
      return {
        ...state,
        cart: {
          ...state.cart,
          items: reconcileCartItemsByTransactionStatus(state.cart.items, txHashes, failedTxHashes, action.confirmedAt),
        },
        transactions: state.transactions.map((tx) =>
          tx.status === 'submitted' && failedTxHashes.has(tx.txHash)
            ? { ...tx, status: 'failed' }
            : tx.status === 'submitted' && txHashes.has(tx.txHash)
              ? { ...tx, status: 'confirmed' }
              : tx,
        ),
      };
    }
    case 'set-notice':
      return { ...state, notices: { ...state.notices, [action.key]: action.notice } };
    case 'set-loading':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case 'select-offer-for-fill': {
      const offeredAsset = hardAsset(
        state.options.network,
        state.customAssets,
        action.offer.offerPolicyId,
        action.offer.offerAssetName,
      );
      return {
        ...state,
        view: 'trade',
        action: 'fill',
        tradeTab: 'fill',
        selectedOrderId: action.offer.id,
        selectedPair: {
          offer: {
            policyId: action.offer.offerPolicyId,
            assetNameHex: action.offer.offerAssetName,
          },
          ask: {
            policyId: action.offer.askPolicyId,
            assetNameHex: action.offer.askAssetName,
          },
        },
        forms: {
          ...state.forms,
          fillOfferAmount:
            action.amount ||
            fromBase(BigInt(action.offer.utxoOfferQuantity || '0') / 2n, offeredAsset.decimals),
        },
      };
    }
    case 'select-offer-for-close':
      return {
        ...state,
        view: 'trade',
        action: 'close',
        tradeTab: 'close',
        selectedOrderId: action.offer.id,
        selectedPair: {
          offer: {
            policyId: action.offer.offerPolicyId,
            assetNameHex: action.offer.offerAssetName,
          },
          ask: {
            policyId: action.offer.askPolicyId,
            assetNameHex: action.offer.askAssetName,
          },
        },
      };
    case 'select-asset-for-open':
      return {
        ...state,
        view: 'trade',
        action: 'open',
        tradeTab: 'open',
        selectedPair: null,
        forms: { ...state.forms, openOfferAssetKey: action.assetKey },
      };
    default:
      return state;
  }
}
