export type NetworkTag = 'preprod' | 'mainnet';
export type ViewId = 'trade' | 'orders' | 'activity' | 'user' | 'options' | 'developer' | 'cart';
export type ActionMode = 'open' | 'fill' | 'close';
export type TradeTab = ActionMode | 'bulk-open';
export type NetworkProviderKind = 'blockfrost' | 'graphqlMk2';
export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
export type CartExecutionMode = 'bundle' | 'parallel';
export type CartItemStatus = 'draft' | 'executed' | 'failed';

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
  action: ActionMode | 'swap';
  status: 'draft' | 'submitted' | 'confirmed' | 'failed';
  at: number;
  pair?: AssetPair;
  summary: string;
}

export type IntentName = 'open' | 'fill' | 'close' | 'connect';
export type IntentArgs = Record<string, string>;

export interface IntentTemplate {
  code: {
    type: string;
    title?: string;
    description?: string;
    exportAs?: string;
    args?: IntentArgs;
    returnURLPattern?: string;
    [key: string]: unknown;
  };
}

export interface IntentSelection {
  id: string;
  name: Exclude<IntentName, 'connect'>;
  args: IntentArgs;
  sourceOfferId?: string;
}

export interface IntentBundle {
  id: string;
  selections: IntentSelection[];
}

export interface CartItem {
  id: string;
  name: Exclude<IntentName, 'connect'>;
  args: IntentArgs;
  selected: boolean;
  status: CartItemStatus;
  createdAt: number;
  executedAt?: number;
  sourceOfferId?: string;
  sourceLabel?: string;
  pair?: AssetPair;
}

export interface CartState {
  items: CartItem[];
  mode: CartExecutionMode;
  maxIntentsPerTransaction: number;
  modalOpen: boolean;
  showExecutedOnly: boolean;
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
  intents: Partial<Record<IntentName, IntentTemplate>>;
  intentArgs: Record<ActionMode, IntentArgs>;
  intentBundle: IntentBundle;
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
    intents: boolean;
  };
}

export type AppAction =
  | { type: 'replace-state'; state: AppState }
  | { type: 'set-view'; view: ViewId }
  | { type: 'set-action'; action: ActionMode }
  | { type: 'set-trade-tab'; tab: TradeTab }
  | { type: 'set-options'; options: Partial<AppOptions> }
  | { type: 'set-forms'; forms: Partial<FormState> }
  | { type: 'set-wallet'; wallet: WalletConnection | null }
  | { type: 'set-wallet-return'; payload: unknown }
  | { type: 'set-intents'; intents: Partial<Record<IntentName, IntentTemplate>> }
  | { type: 'set-intent-args'; action: ActionMode; args: IntentArgs }
  | { type: 'add-cart-item'; item: CartItem }
  | { type: 'add-cart-items'; items: CartItem[] }
  | { type: 'remove-cart-item'; itemId: string }
  | { type: 'remove-cart-items'; itemIds: string[] }
  | { type: 'clear-cart' }
  | { type: 'purge-executed-cart-items' }
  | { type: 'toggle-cart-item'; itemId: string }
  | { type: 'select-all-visible-cart-items' }
  | { type: 'deselect-all-cart-items' }
  | { type: 'set-cart-item-selected'; itemId: string; selected: boolean }
  | { type: 'set-cart-items-selected'; itemIds: string[]; selected: boolean }
  | { type: 'mark-cart-items-executed'; itemIds: string[]; executedAt: number }
  | { type: 'set-cart-mode'; mode: CartExecutionMode }
  | { type: 'set-cart-max-intents-per-transaction'; value: number }
  | { type: 'set-cart-modal-open'; open: boolean }
  | { type: 'set-cart-show-executed-only'; showExecutedOnly: boolean }
  | { type: 'set-open-offers'; offers: OpenOffer[] }
  | { type: 'set-portfolio'; portfolio: PortfolioAsset[] }
  | { type: 'set-asset-info'; assets: Record<string, ResolvedAsset> }
  | { type: 'set-custom-assets'; network: NetworkTag; assets: Record<string, AssetMetadata> }
  | { type: 'set-selected-order'; orderId: string }
  | { type: 'set-selected-pair'; pair: AssetPair | null }
  | { type: 'set-intent-bundle'; bundle: IntentBundle }
  | { type: 'add-transaction'; tx: ProtocolTransaction }
  | { type: 'set-notice'; key: keyof AppState['notices']; notice: Notice | null }
  | { type: 'set-loading'; key: keyof AppState['loading']; value: boolean }
  | { type: 'select-offer-for-fill'; offer: OpenOffer; amount: string }
  | { type: 'select-offer-for-close'; offer: OpenOffer }
  | { type: 'select-asset-for-open'; assetKey: string };
