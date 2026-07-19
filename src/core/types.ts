export type NetworkTag = 'preprod' | 'mainnet';
export type NetworkProviderKind = 'blockfrost' | 'graphqlMk2';
export type ActionMode = 'open' | 'fill' | 'close';
export type CartExecutionMode = 'bundle' | 'parallel';
export type CartItemStatus = 'draft' | 'pending' | 'confirmed' | 'failed';
export type ProtocolAction = ActionMode | 'mixed' | 'unknown' | 'swap';
export type OrderKind = 'one-way' | 'two-way' | 'future' | 'unknown';
export type AssetTag = 'coin' | 'stablecoin' | 'mainstream' | 'community' | 'experimental';

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
  decimalsKnown?: boolean;
  minExecutableOfferQuantity?: string;
  minMakerRemainderQuantity?: string;
  description?: string;
  logo?: string;
  fingerprint?: string;
  registered?: boolean;
  known?: boolean;
  tag?: AssetTag;
}

export interface ResolvedAsset extends AssetMetadata {
  assetKey: string;
  assetId: string;
  minExecutableOfferQuantity: string;
  minMakerRemainderQuantity: string;
}

export interface AssetPair {
  offer: AssetRef;
  ask: AssetRef;
}

export interface ServiceFeeAsset extends AssetRef {
  quantity: string;
  displayQuantity?: string;
  ticker?: string;
}

export interface ServiceFeeConfig {
  address: string;
  bundleSwap?: ServiceFeeAsset;
  parallelSwap?: ServiceFeeAsset;
}

export type GcscriptPrivacyMode = 'connected' | 'incognito';

export interface OpenOffer {
  id: string;
  orderKind?: OrderKind;
  txHash: string;
  txIndex: string;
  address: string;
  ownerStakeKeyHash: string;
  utxoCoinQuantity: string;
  utxoOfferQuantity: string;
  utxoAskQuantity: string;
  pairBeacon: string;
  offerPolicyId: string;
  offerAssetName: string;
  offerBeacon: string;
  askPolicyId: string;
  askAssetName: string;
  askBeacon: string;
  priceNumerator: string;
  priceDenominator: string;
  previousInput?: { txHash: string; index: string } | null;
  originalOfferQuantity?: string;
  accumulatedAskQuantity?: string;
}

export interface OpenBookSnapshot {
  provider: NetworkProviderKind;
  network: NetworkTag;
  updatedAt: number;
  orderCount: number;
}

export interface PortfolioAsset extends ResolvedAsset {
  quantity: string;
}

export interface ProtocolTransaction {
  id: string;
  txHash: string;
  action: ProtocolAction;
  status: 'submitted' | 'confirmed' | 'failed';
  walletSubmitStatus?: string;
  walletSubmitError?: boolean;
  walletSubmitContention?: boolean;
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
  includedAtLabel?: string;
  feeQuantity?: string;
  details?: ProtocolTransactionDetail[];
}

export interface ProtocolTransactionDetail {
  action: ActionMode | 'unknown';
  inputRef?: string;
  outputRef?: string;
  offerPolicyId?: string;
  offerAssetNameHex?: string;
  askPolicyId?: string;
  askAssetNameHex?: string;
  offerQuantity?: string;
  askQuantity?: string;
  priceNumerator?: string;
  priceDenominator?: string;
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
  walletSubmitStatus?: string;
  walletSubmitError?: boolean;
  walletSubmitContention?: boolean;
  expectedOutputs?: ExecutionOutputRef[];
  sourceOfferId?: string;
  sourceLabel?: string;
  pair?: AssetPair;
}

export interface ExecutionOutputRef {
  role: 'openedOffer' | 'remainingOffer' | 'filledOffer' | 'closedFunds' | 'serviceFee';
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

export interface ExecutionReceiptTx {
  groupId: string;
  groupIndex: number;
  txHash: string;
  status: string;
  hasSubmitError: boolean;
  hasContentionError: boolean;
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
  txs: ExecutionReceiptTx[];
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
  walletType?: string;
  dltTag?: string;
  networkTag?: NetworkTag;
}
