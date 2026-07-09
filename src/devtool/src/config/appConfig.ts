import { MAINNET_ASSETS, PREPROD_ASSETS } from './assets';
import packageJson from '../../../../package.json';

const env = import.meta.env;
const buildTag = env.VITE_NEONSOUP_BUILD_TAG || 'local';
const appVersion = `${packageJson.version}+${buildTag}`;

function envFlag(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

export const APP_CONFIG = {
  version: appVersion,
  defaultProvider: 'graphqlMk2',
  storageKey: 'neonsoup-devtool-v5',
  walletReturnKey: 'neonsoup-wallet-return-v5',
  encoding: 'gzip',
  popupFeatures: 'noopener,width=480,height=1024',
  walletUrlPatternOverrideEnabled: envFlag(env.VITE_NEONSOUP_ENABLE_WALLET_URL_PATTERN_OVERRIDE),
  gcWalletUrlPattern: env.VITE_NEONSOUP_GC_WALLET_URL_PATTERN || '',
  pollingIntervalMs: 10 * 60 * 1000,
  confirmationPollingIntervalMs: 15 * 1000,
  beaconPolicy: 'c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209',
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
