export type ViewId = 'trade' | 'orders' | 'activity' | 'user' | 'options' | 'developer' | 'cart';
export type TradeTab = 'swap' | ActionMode | 'bulk-open';
export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
export type {
  ActionMode,
  AssetMetadata,
  AssetPair,
  AssetRef,
  CartExecutionMode,
  CartItem,
  CartItemStatus,
  CartState,
  ExecutionOutputRef,
  ExecutionReceiptGroup,
  ExecutionReceiptItem,
  ExecutionReceiptTx,
  GcscriptArgs,
  IntentArgs,
  IntentTemplate,
  NeonSoupExecutionReceipt,
  NetworkProviderKind,
  NetworkTag,
  OpenBookSnapshot,
  OpenOffer,
  OrderKind,
  PortfolioAsset,
  ProtocolAction,
  ProtocolTransaction,
  ProtocolTransactionDetail,
  ResolvedAsset,
  WalletConnection,
} from '../../core/types';

import type {
  ActionMode,
  AssetMetadata,
  AssetPair,
  CartExecutionMode,
  CartItem,
  CartState,
  NeonSoupExecutionReceipt,
  NetworkProviderKind,
  NetworkTag,
  OpenBookSnapshot,
  OpenOffer,
  PortfolioAsset,
  ProtocolTransaction,
  ResolvedAsset,
  WalletConnection,
} from '../../core/types';

export interface AppOptions {
  network: NetworkTag;
  provider: NetworkProviderKind;
  providerUrl: string;
  blockfrostUrl: string;
  blockfrostKey: string;
  gcWalletUrlPattern: string;
  swapSlippageTolerancePercent: number;
  swapPayUpPercent: number;
  toastAutoHideMs: number;
  historyFetchLimit: number;
  cardanoscanTxUrlPattern: string;
  popupMode: boolean;
  hideUnknownOffers: boolean;
  hideUnknownPortfolio: boolean;
  ownerOnly: boolean;
  theme: 'dark' | 'light';
}

export interface FormState {
  openOfferAssetKey: string;
  openAskAssetKey: string;
  openOfferAmount: string;
  openAskAmount: string;
  bulkOpenCount: string;
  bulkOpenVariancePercent: string;
  bulkOpenOfferVariancePercent: string;
  fillOfferAmount: string;
  fillAskAmount: string;
  swapOfferAmount: string;
  swapPayUp: boolean;
}

export interface Notice {
  message: string;
  tone: NoticeTone;
}

export interface AppState {
  appVersion: string;
  migrationNeeded: boolean;
  migrationSourceVersion: string;
  view: ViewId;
  action: ActionMode;
  tradeTab: TradeTab;
  selectedOrderId: string;
  selectedPair: AssetPair | null;
  options: AppOptions;
  forms: FormState;
  wallet: WalletConnection | null;
  cart: CartState;
  lastWalletReturn: unknown;
  openOffers: OpenOffer[];
  openOffersSnapshot: OpenBookSnapshot | null;
  portfolio: PortfolioAsset[];
  transactions: ProtocolTransaction[];
  assetInfo: Record<string, ResolvedAsset>;
  customAssets: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>;
  notices: {
    app: Notice | null;
    offers: Notice;
    portfolio: Notice;
  };
  loading: {
    offers: boolean;
    portfolio: boolean;
  };
}

export type AppAction =
  | { type: 'replace-state'; state: AppState }
  | { type: 'set-view'; view: ViewId }
  | { type: 'set-trade-tab'; tab: TradeTab }
  | { type: 'set-options'; options: Partial<AppOptions> }
  | { type: 'set-forms'; forms: Partial<FormState> }
  | { type: 'set-wallet'; wallet: WalletConnection | null }
  | { type: 'set-wallet-return'; payload: unknown }
  | { type: 'add-cart-item'; item: CartItem }
  | { type: 'add-cart-items'; items: CartItem[] }
  | { type: 'remove-cart-item'; itemId: string }
  | { type: 'remove-cart-items'; itemIds: string[] }
  | { type: 'purge-confirmed-cart-items' }
  | { type: 'select-all-visible-cart-items' }
  | { type: 'deselect-all-cart-items' }
  | { type: 'set-cart-item-selected'; itemId: string; selected: boolean }
  | { type: 'set-cart-items-selected'; itemIds: string[]; selected: boolean }
  | { type: 'apply-execution-receipt'; receipt: NeonSoupExecutionReceipt; at: number }
  | { type: 'requeue-cart-item'; itemId: string }
  | { type: 'set-cart-mode'; mode: CartExecutionMode }
  | { type: 'set-cart-max-intents-per-transaction'; value: number }
  | { type: 'set-cart-modal-open'; open: boolean }
  | { type: 'set-cart-show-confirmed-only'; showConfirmedOnly: boolean }
  | { type: 'set-open-offers'; offers: OpenOffer[]; snapshot?: OpenBookSnapshot }
  | { type: 'set-portfolio'; portfolio: PortfolioAsset[] }
  | { type: 'set-asset-info'; assets: Record<string, ResolvedAsset> }
  | { type: 'set-custom-assets'; network: NetworkTag; assets: Record<string, AssetMetadata> }
  | { type: 'set-selected-order'; orderId: string }
  | { type: 'set-selected-pair'; pair: AssetPair | null }
  | { type: 'add-transaction'; tx: ProtocolTransaction }
  | { type: 'merge-transactions'; transactions: ProtocolTransaction[] }
  | { type: 'reconcile-confirmed-transactions'; txHashes: string[]; failedTxHashes?: string[]; confirmedAt: number }
  | { type: 'set-notice'; key: keyof AppState['notices']; notice: Notice | null }
  | { type: 'set-loading'; key: keyof AppState['loading']; value: boolean }
  | { type: 'select-offer-for-fill'; offer: OpenOffer; amount: string }
  | { type: 'select-offer-for-close'; offer: OpenOffer }
  | { type: 'select-asset-for-open'; assetKey: string };
