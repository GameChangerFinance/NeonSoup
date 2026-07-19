import type { AssetMetadata, CartExecutionMode, NetworkTag, ServiceFeeAsset, ServiceFeeConfig } from '../../core/types';
import { APP_CONFIG } from '../config/appConfig';
import { assetKeyOf, hardAsset } from './assets';
import { toBase } from './quantities';

type RawServiceFeeAsset = {
  policyId: string;
  assetNameHex: string;
  quantity: string;
};

function resolveFeeAsset(
  network: NetworkTag,
  customAssets: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
  fee: RawServiceFeeAsset | undefined,
): ServiceFeeAsset | undefined {
  if (!fee?.quantity) return undefined;
  const assetKey = assetKeyOf(fee.policyId, fee.assetNameHex);
  const asset =
    APP_CONFIG.networks[network].assets[assetKey] ||
    customAssets[network]?.[assetKey] ||
    hardAsset(network, {}, fee.policyId, fee.assetNameHex);
  const quantity = toBase(fee.quantity, asset.decimals);
  if (quantity <= 0n) return undefined;
  return {
    policyId: fee.policyId,
    assetNameHex: fee.assetNameHex,
    quantity: quantity.toString(),
    displayQuantity: fee.quantity,
    ...(asset.ticker ? { ticker: asset.ticker } : {}),
  };
}

export function serviceFeesForNetwork(
  network: NetworkTag,
  customAssets: Partial<Record<NetworkTag, Record<string, AssetMetadata>>>,
): ServiceFeeConfig {
  const configured = APP_CONFIG.networks[network].serviceFees;
  const address = configured.address.trim();
  if (!address) return { address: '' };
  const bundleSwap = resolveFeeAsset(network, customAssets, configured.bundleSwap);
  const parallelSwap = resolveFeeAsset(network, customAssets, configured.parallelSwap);
  return { address, ...(bundleSwap ? { bundleSwap } : {}), ...(parallelSwap ? { parallelSwap } : {}) };
}

export function swapServiceFeeForMode(config: ServiceFeeConfig | undefined, mode: CartExecutionMode): ServiceFeeAsset | undefined {
  if (!config?.address) return undefined;
  return mode === 'parallel' ? config.parallelSwap : config.bundleSwap;
}
