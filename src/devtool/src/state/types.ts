export type NetworkTag = 'preprod' | 'mainnet';
export type ViewId = 'trade' | 'orders' | 'activity' | 'user' | 'options' | 'developer' | 'cart';
export type ActionMode = 'open' | 'fill' | 'close';
export type TradeTab = ActionMode | 'bulk-open';
export type NetworkProviderKind = 'blockfrost' | 'graphqlMk2';
export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
export type CartExecutionMode = 'bundle' | 'parallel';
export type CartItemStatus = 'draft' | 'pending' | 'confirmed' | 'failed';
export type ProtocolAction = ActionMode | 'mixed' | 'unknown' | 'swap';

export interface AssetRef {
  policyId: string;
  assetNameHex: string;
  assetName?: string;
  assetId?: string;
}

export interface AssetMetadata extends AssetRef {
  label: string;
  ticker: string;
  decimals: number;
  description?: string;
  logo?: string;
  fingerprint?: string;
  registered?: boolean;
  known?: boolean;
}

export interface ResolvedAsset extends AssetMetadata {
  assetKey: string;
  assetId: string;
}

export interface AssetPair {
  offer: AssetRef;
  ask: AssetRef;
}

export interface OpenOffer {
  id: string;
  txHash: string;
  txIndex: string;
  address: string;
  ownerStakeKeyHash: string;
  utxoCoinQuantity: string;
  utxoOfferQuantity: string;
  pairBeacon: string;
  offerPolicyId: string;
  offerAssetName: string;
  offerBeacon: string;
  askPolicyId: string;
  askAssetName: string;
  askBeacon: string;
  priceNumerator: string;
  priceDenominator: string;
}

export interface PortfolioAsset extends ResolvedAsset {
  quantity: string;
}

export interface ProtocolTransaction {
  id: string;
  txHash: string;
  action: ProtocolAction;
  status: 'submitted' | 'confirmed' | 'failed';
  at: number;
  pair?: AssetPair;
  summary: string;
  groupId?: string;
  itemIds?: string[];
  actions?: ActionMode[];
  actionCounts?: Partial<Record<ActionMode, number>>;
  evidence?: 'chain' | 'wallet-receipt';
  participantStakeKeyHashes?: string[];
  outputOwnerStakeKeyHashes?: string[];
}

export type IntentArgs = Record<string, string>;
export type GcscriptArgs = Record<string, unknown>;

export interface IntentTemplate {
  code: {
    type: string;
    title?: string;
    description?: string;
    exportAs?: string;
    args?: GcscriptArgs;
    returnURLPattern?: string;
    [key: string]: unknown;
  };
}

export interface CartItem {
  id: string;
  name: ActionMode;
  args: IntentArgs;
  selected: boolean;
  status: CartItemStatus;
  createdAt: number;
  pendingAt?: number;
  confirmedAt?: number;
  txHash?: string;
  groupId?: string;
  groupIndex?: number;
  expectedOutputs?: ExecutionOutputRef[];
  sourceOfferId?: string;
  sourceLabel?: string;
  pair?: AssetPair;
}

export interface ExecutionOutputRef {
  role: 'openedOffer' | 'remainingOffer' | 'filledOffer' | 'closedFunds';
  index: string | number;
}

export interface ExecutionReceiptItem {
  itemId: string;
  intentId: string;
  type: ActionMode;
  itemIndex: number;
  groupId: string;
  groupIndex: number;
  groupItemIndex: number;
  txHash: string;
  sourceOfferId?: string;
  sourceUtxo?: {
    txHash: string;
    index: string;
  };
  outputs: ExecutionOutputRef[];
}

export interface ExecutionReceiptGroup {
  groupId: string;
  groupIndex: number;
  groupCount: number;
  txHash: string;
  items: ExecutionReceiptItem[];
}

export interface NeonSoupExecutionReceipt {
  executionId: string;
  itemCount: number;
  groupCount: number;
  items: ExecutionReceiptItem[];
}

export interface CartState {
  items: CartItem[];
  mode: CartExecutionMode;
  maxIntentsPerTransaction: number;
  modalOpen: boolean;
  showConfirmedOnly: boolean;
}

export interface WalletConnection {
  name: string;
  address: string;
  stakeKeyHash: string;
}

export interface AppOptions {
  network: NetworkTag;
  provider: NetworkProviderKind;
  blockfrostUrl: string;
  blockfrostKey: string;
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
  | { type: 'set-open-offers'; offers: OpenOffer[] }
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
