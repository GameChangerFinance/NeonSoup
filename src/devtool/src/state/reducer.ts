import { configuredAssets, hardAsset, normalizeAssetMetadataRecord } from '../domain/assets';
import { fromBase } from '../domain/quantities';
import { APP_CONFIG } from '../config/appConfig';
import type { AppAction, AppOptions, AppState, AssetMetadata, CartState, IntentBundle, NetworkTag } from './types';

export const defaultOptions: AppOptions = {
  network: 'preprod',
  provider: 'blockfrost',
  blockfrostUrl: '',
  blockfrostKey: '',
  popupMode: true,
  hideUnknownOffers: true,
  hideUnknownPortfolio: true,
  ownerOnly: false,
  theme: 'dark',
};

function freshBundle(): IntentBundle {
  return {
    id: `bundle-${Date.now()}`,
    selections: [],
  };
}

function freshCart(): CartState {
  return {
    items: [],
    mode: 'bundle',
    maxIntentsPerTransaction: 20,
    modalOpen: false,
    showExecutedOnly: false,
  };
}

function cartVisibleItems(cart: CartState) {
  return cart.showExecutedOnly
    ? cart.items.filter((item) => item.status === 'executed')
    : cart.items.filter((item) => item.status !== 'executed');
}

function bundleFromCart(cart: CartState, previous: IntentBundle): IntentBundle {
  return {
    id: previous.id,
    selections: cart.items
      .filter((item) => item.selected)
      .map((item) => {
        const selection = {
          id: item.id,
          name: item.name,
          args: item.args,
          ...(item.sourceOfferId ? { sourceOfferId: item.sourceOfferId } : {}),
        };
        return selection;
      }),
  };
}

function withCart(state: AppState, cart: CartState): AppState {
  return {
    ...state,
    cart,
    intentBundle: bundleFromCart(cart, state.intentBundle),
  };
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
  intents?: AppState['intents'];
  intentBundle?: AppState['intentBundle'];
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
    tradeTab: seed?.tradeTab || seed?.action || 'open',
    selectedOrderId: seed?.selectedOrderId || '',
    selectedPair: seed?.selectedPair || null,
    options,
    forms: {
      openOfferAssetKey: assetKeys.offer,
      openAskAssetKey: assetKeys.ask,
      openOfferAmount: '',
      openAskAmount: '',
      bulkOpenCount: '3',
      bulkOpenVariancePercent: '0',
      bulkOpenOfferVariancePercent: '0',
      fillOfferAmount: '',
      fillAskAmount: '',
      ...(seed?.forms || {}),
    },
    wallet: seed?.wallet || null,
    intents: seed?.intents || {},
    intentArgs: {
      open: {},
      fill: {},
      close: {},
    },
    intentBundle: seed?.intentBundle || freshBundle(),
    cart: seed?.cart || freshCart(),
    lastWalletReturn: null,
    openOffers: seed?.openOffers || [],
    portfolio: seed?.portfolio || [],
    transactions: seed?.transactions || [],
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
      intents: false,
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
    case 'set-action':
      return { ...state, action: action.action, tradeTab: action.action };
    case 'set-trade-tab':
      return {
        ...state,
        tradeTab: action.tab,
        action: action.tab === 'bulk-open' ? state.action : action.tab,
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
    case 'set-intents':
      return { ...state, intents: action.intents };
    case 'set-intent-args':
      return {
        ...state,
        intentArgs: { ...state.intentArgs, [action.action]: action.args },
        intentBundle: {
          id: state.intentBundle.id,
          selections: [
            {
              id: `${action.action}-selection`,
              name: action.action,
              args: action.args,
              ...(state.selectedOrderId ? { sourceOfferId: state.selectedOrderId } : {}),
            },
          ],
        },
      };
    case 'add-cart-item': {
      const cart = {
        ...state.cart,
        items: [...state.cart.items, action.item],
      };
      return withCart(state, cart);
    }
    case 'add-cart-items': {
      const cart = {
        ...state.cart,
        items: [...state.cart.items, ...action.items],
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
    case 'clear-cart':
      return withCart(state, { ...state.cart, items: [] });
    case 'purge-executed-cart-items':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.filter((item) => item.status !== 'executed'),
      });
    case 'toggle-cart-item':
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) =>
          item.id === action.itemId ? { ...item, selected: !item.selected } : item,
        ),
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
    case 'mark-cart-items-executed': {
      const itemIds = new Set(action.itemIds);
      return withCart(state, {
        ...state.cart,
        items: state.cart.items.map((item) =>
          itemIds.has(item.id)
            ? { ...item, status: 'executed', executedAt: action.executedAt, selected: false }
            : item,
        ),
      });
    }
    case 'set-cart-mode':
      return withCart(state, { ...state.cart, mode: action.mode });
    case 'set-cart-max-intents-per-transaction':
      return withCart(state, {
        ...state.cart,
        maxIntentsPerTransaction: Math.max(1, Math.floor(action.value) || 1),
      });
    case 'set-cart-modal-open':
      return { ...state, cart: { ...state.cart, modalOpen: action.open } };
    case 'set-cart-show-executed-only':
      return { ...state, cart: { ...state.cart, showExecutedOnly: action.showExecutedOnly } };
    case 'set-open-offers':
      return {
        ...state,
        openOffers: action.offers,
        selectedOrderId: state.selectedOrderId || action.offers[0]?.id || '',
      };
    case 'set-portfolio':
      return { ...state, portfolio: action.portfolio };
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
    case 'set-intent-bundle':
      return { ...state, intentBundle: action.bundle };
    case 'add-transaction':
      return { ...state, transactions: [action.tx, ...state.transactions].slice(0, 100) };
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
        intentArgs: { ...state.intentArgs, fill: {} },
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
        intentArgs: { ...state.intentArgs, close: {} },
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
