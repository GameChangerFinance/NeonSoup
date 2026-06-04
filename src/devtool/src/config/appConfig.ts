import { MAINNET_ASSETS, PREPROD_ASSETS } from './assets';

const env = import.meta.env;

export const APP_CONFIG = {
  version: 4,
  storageKey: 'neonsoup-devtool-v4',
  walletReturnKey: 'neonsoup-wallet-return-v4',
  encoding: 'gzip',
  popupFeatures: 'noopener,width=480,height=720',
  pollingIntervalMs: 10 * 60 * 1000,
  intentFiles: {
    open: './intents/open.gcscript.json',
    fill: './intents/swap.gcscript.json',
    close: './intents/close.gcscript.json',
  },
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
