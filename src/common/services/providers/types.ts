import type {
  AppOptions,
  AssetMetadata,
  AssetRef,
  NetworkTag,
  OpenOffer,
  PortfolioAsset,
  ResolvedAsset,
} from '../../state/types';

export type ProviderSortDirection = 'asc' | 'desc';

export interface PageRequest {
  limit: number;
  offset: number;
}

export interface PageInfo extends PageRequest {
  returned: number;
  nextOffset: number | null;
  hasMore: boolean;
  truncated: boolean;
}

export interface PageResult<T> {
  items: T[];
  page: PageInfo;
}

export interface ProviderContext {
  networkTag: NetworkTag;
  options: AppOptions;
  assetInfo: Record<string, ResolvedAsset>;
  customAssets: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>;
}

export interface ProviderDataResult<T> {
  data: T;
  assets: Record<string, ResolvedAsset>;
}

export interface ChainTransactionToken {
  policyId: string;
  assetNameHex: string;
  quantity: string;
}

export interface ChainTransactionOutput {
  address: string;
  ownerStakeKeyHash: string;
  txHash: string;
  index: string;
  value: string;
  datumHex: string;
  tokens: ChainTransactionToken[];
}

export interface ChainTransaction {
  hash: string;
  includedAt: number;
  fee?: string;
  validContract?: boolean;
  inputs: ChainTransactionOutput[];
  outputs: ChainTransactionOutput[];
}

export interface NetworkProvider {
  getAssetInfo(context: ProviderContext, policyId: string, assetNameHex: string): Promise<ResolvedAsset>;
  getAssetsInfo(context: ProviderContext, assets: readonly AssetRef[]): Promise<Record<string, ResolvedAsset>>;
  getOpenOffers(context: ProviderContext): Promise<ProviderDataResult<OpenOffer[]>>;
  getPortfolio(context: ProviderContext, address: string): Promise<ProviderDataResult<PortfolioAsset[]>>;
  getTransactions(context: ProviderContext, txHashes: readonly string[]): Promise<ChainTransaction[]>;
  getAddressTransactions(context: ProviderContext, address: string, limit?: number): Promise<ChainTransaction[]>;
  getConfirmedTransactionHashes(context: ProviderContext, txHashes: readonly string[]): Promise<string[]>;
}
