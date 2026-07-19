import { MAINNET_ASSETS, PREPROD_ASSETS } from './assets';
import packageJson from '../../../../package.json';
import {
  buildRuntimeGcscript,
  GCSCRIPT_P2P_DEFI_KERNEL_LIB,
  P2P_DEFI_KERNEL_VALIDATOR_DEPLOYMENTS,
  P2P_DEFI_KERNEL_VALIDATOR_INFO,
} from '../../../common/config/appConfig';

export { buildRuntimeGcscript, GCSCRIPT_P2P_DEFI_KERNEL_LIB };

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
const buildTag = env.VITE_NEONSOUP_BUILD_TAG || 'local';
const appVersion = `${packageJson.version}+${buildTag}`;
const defaultProvider = 'graphqlMk2';
const gcWalletUrlPattern = env.VITE_NEONSOUP_GC_WALLET_URL_PATTERN || '';

function validatorFor(dltTag: string, networkTag: string) {
  const validator = P2P_DEFI_KERNEL_VALIDATOR_DEPLOYMENTS[`${dltTag}-${networkTag}`];
  if (!validator) throw new Error(`Missing P2P DeFi Kernel deployment for ${dltTag}-${networkTag}.`);
  return validator;
}

function envFlag(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function serviceFees(prefix: 'PREPROD' | 'MAINNET') {
  return {
    address: env[`VITE_NEONSOUP_${prefix}_SERVICE_FEE_ADDRESS`] || '',
    bundleSwap: {
      policyId: env[`VITE_NEONSOUP_${prefix}_BUNDLE_SWAP_SERVICE_FEE_POLICY_ID`] || 'ada',
      assetNameHex: env[`VITE_NEONSOUP_${prefix}_BUNDLE_SWAP_SERVICE_FEE_ASSET_NAME`] || 'ada',
      quantity: env[`VITE_NEONSOUP_${prefix}_BUNDLE_SWAP_SERVICE_FEE_QUANTITY`] || '',
    },
    parallelSwap: {
      policyId: env[`VITE_NEONSOUP_${prefix}_PARALLEL_SWAP_SERVICE_FEE_POLICY_ID`] || 'ada',
      assetNameHex: env[`VITE_NEONSOUP_${prefix}_PARALLEL_SWAP_SERVICE_FEE_ASSET_NAME`] || 'ada',
      quantity: env[`VITE_NEONSOUP_${prefix}_PARALLEL_SWAP_SERVICE_FEE_QUANTITY`] || '',
    },
  };
}

export const APP_CONFIG = {
  version: appVersion,
  defaultProvider,
  storageKey: 'neonsoup-devtool-v5',
  walletReturnKey: 'neonsoup-wallet-return-v5',
  encoding: 'gzip',
  popupFeatures: 'noopener,width=480,height=800',
  walletUrlPatternOverrideEnabled: envFlag(env.VITE_NEONSOUP_ENABLE_WALLET_URL_PATTERN_OVERRIDE),
  gcWalletUrlPattern,
  gcscriptLib: GCSCRIPT_P2P_DEFI_KERNEL_LIB,
  pollingIntervalMs: 10 * 60 * 1000,
  confirmationPollingIntervalMs: 15 * 1000,
  defaults: {
    frontendCartMode: false,
    options: {
      network: 'preprod',
      availableNetworks: ['preprod', 'mainnet'],
      provider: defaultProvider,
      providerUrl: '',
      blockfrostUrl: '',
      blockfrostKey: '',
      gcWalletUrlPattern,
      swapSlippageTolerancePercent: 0.5,
      swapPayUpPercent: 5,
      toastAutoHideMs: 15600,
      historyFetchLimit: 50,
      cardanoscanTxUrlPattern: '',
      popupMode: true,
      hideUnknownOffers: true,
      hideUnknownPortfolio: true,
      ownerOnly: false,
      theme: 'dark',
    },
    forms: {
      defaultAmount: '0.1',
      amountStep: '0.1',
      openOfferAmount: '0.1',
      openAskAmount: '0.1',
      swapOfferAmount: '0.1',
      bulkOpenCount: '3',
      bulkOpenVariancePercent: '0',
      bulkOpenOfferVariancePercent: '0',
      swapPayUp: false,
    },
    cart: {
      mode: 'bundle',
      maxIntentsPerTransaction: 100,
      modalOpen: false,
      showConfirmedOnly: false,
    },
    quote: {
      slippageTolerancePercentFallback: 0.5,
      warningSlippageMultiplier: 0.7,
      maxSlippageTolerancePercent: 35,
      payUpPercentFallback: 5,
    },
  },
  networks: {
    preprod: {
      dltTag: 'cardano',
      networkTag: 'preprod',
      hostedBlockfrostUrl: env.VITE_NEONSOUP_PREPROD_BLOCKFROST_URL || '',
      graphqlMk2Url: env.VITE_NEONSOUP_PREPROD_GRAPHQL_MK2_URL || '',
      blockfrostUrl: '',
      apiKey: env.VITE_NEONSOUP_PREPROD_BLOCKFROST_KEY || '',
      validator: validatorFor('cardano', 'preprod'),
      validatorInfo: P2P_DEFI_KERNEL_VALIDATOR_INFO,
      serviceFees: serviceFees('PREPROD'),
      assets: PREPROD_ASSETS,
    },
    mainnet: {
      dltTag: 'cardano',
      networkTag: 'mainnet',
      hostedBlockfrostUrl: env.VITE_NEONSOUP_MAINNET_BLOCKFROST_URL || '',
      graphqlMk2Url: env.VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL || '',
      blockfrostUrl: '',
      apiKey: env.VITE_NEONSOUP_MAINNET_BLOCKFROST_KEY || '',
      validator: validatorFor('cardano', 'mainnet'),
      validatorInfo: P2P_DEFI_KERNEL_VALIDATOR_INFO,
      serviceFees: serviceFees('MAINNET'),
      assets: MAINNET_ASSETS,
    },
  },
} as const;

export async function getConfig() {
  return APP_CONFIG;
}
