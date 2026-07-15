import { MAINNET_ASSETS, PREPROD_ASSETS } from './assets';
import packageJson from '../../../package.json';

const env = import.meta.env;
const buildTag = env.VITE_NEONSOUP_BUILD_TAG || 'local';
const appVersion = `${packageJson.version}+${buildTag}`;
const defaultProvider = 'graphqlMk2';
const gcWalletUrlPattern = env.VITE_NEONSOUP_GC_WALLET_URL_PATTERN || '';

function envFlag(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
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
  pollingIntervalMs: 10 * 60 * 1000,
  confirmationPollingIntervalMs: 15 * 1000,
  beaconPolicy: 'c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209',
  defaults: {
    frontendCartMode: false,
    options: {
      network: 'preprod',
      // Add 'mainnet' here when mainnet frontend switching is ready.
      availableNetworks: ['preprod'],
      provider: defaultProvider,
      providerUrl: '',
      blockfrostUrl: '',
      blockfrostKey: '',
      gcWalletUrlPattern,
      swapSlippageTolerancePercent: 0.5,
      swapPayUpPercent: 5,
      toastAutoHideMs: 5200,
      historyFetchLimit: 50,
      cardanoscanTxUrlPattern: '',
      popupMode: true,
      hideUnknownOffers: true,
      hideUnknownPortfolio: true,
      ownerOnly: false,
      theme: 'dark',
    },
    forms: {
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
      payUpPercentFallback: 5,
    },
  },
  networks: {
    preprod: {
      networkTag: 'preprod',
      hostedBlockfrostUrl: env.VITE_NEONSOUP_PREPROD_BLOCKFROST_URL || '',
      graphqlMk2Url: env.VITE_NEONSOUP_PREPROD_GRAPHQL_MK2_URL || '',
      blockfrostUrl: '',
      apiKey: env.VITE_NEONSOUP_PREPROD_BLOCKFROST_KEY || '',
      beaconPolicy: 'c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209',
      assets: PREPROD_ASSETS,
    },
    mainnet: {
      networkTag: 'mainnet',
      hostedBlockfrostUrl: env.VITE_NEONSOUP_MAINNET_BLOCKFROST_URL || '',
      graphqlMk2Url: env.VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL || '',
      blockfrostUrl: '',
      apiKey: env.VITE_NEONSOUP_MAINNET_BLOCKFROST_KEY || '',
      beaconPolicy: 'c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209',
      assets: MAINNET_ASSETS,
    },
  },
} as const;

export async function getConfig() {
  return APP_CONFIG;
}
