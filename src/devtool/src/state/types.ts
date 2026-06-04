export type NetworkTag = 'preprod' | 'mainnet';
export type ViewId = 'trade' | 'orders' | 'activity' | 'user' | 'options' | 'developer';
export type ActionMode = 'open' | 'fill' | 'close';
export type NetworkProviderKind = 'blockfrost' | 'graphqlMk2';
export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

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
  unit: string;
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
  fillOfferAmount: string;
  fillAskAmount: string;
}

export interface Notice {
  message: string;
  tone: NoticeTone;
}

export interface AppState {
  view: ViewId;
  action: ActionMode;
  selectedOrderId: string;
  selectedPair: AssetPair | null;
  options: AppOptions;
  forms: FormState;
  wallet: WalletConnection | null;
  intents: Partial<Record<IntentName, IntentTemplate>>;
  intentArgs: Record<ActionMode, IntentArgs>;
  intentBundle: IntentBundle;
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
  | { type: 'set-view'; view: ViewId }
  | { type: 'set-action'; action: ActionMode }
  | { type: 'set-options'; options: Partial<AppOptions> }
  | { type: 'set-forms'; forms: Partial<FormState> }
  | { type: 'set-wallet'; wallet: WalletConnection | null }
  | { type: 'set-wallet-return'; payload: unknown }
  | { type: 'set-intents'; intents: Partial<Record<IntentName, IntentTemplate>> }
  | { type: 'set-intent-args'; action: ActionMode; args: IntentArgs }
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
