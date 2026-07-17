import { MAINNET_ASSETS, PREPROD_ASSETS } from './assets';
import packageJson from '../../../package.json';
import gc from '@gamechanger-finance/gc';
import commonLibSource from '../../intents/lib/common.gcscript.jsonc?raw';
import openLibSource from '../../intents/lib/open.gcscript.jsonc?raw';
import closeLibSource from '../../intents/lib/close.gcscript.jsonc?raw';
import swapLibSource from '../../intents/lib/swap.gcscript.jsonc?raw';

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
const buildTag = env.VITE_NEONSOUP_BUILD_TAG || 'local';
const appVersion = `${packageJson.version}+${buildTag}`;
const defaultProvider = 'graphqlMk2';
const gcWalletUrlPattern = env.VITE_NEONSOUP_GC_WALLET_URL_PATTERN || '';
const textEncoder = new TextEncoder();

export const P2P_DEFI_KERNEL_VALIDATOR_INFO = {
  //description: 'P2P DeFi Kernel OWS V2 (Live, not audited) - ecbf5da',
  description: 'P2P DeFi Kernel OWS V1 (Live, audited) - 9ec41e7',
  protocolVersion: 'v1',
  sourceURL: 'https://github.com/fallen-icarus/cardano-swaps/blob/main/VERSIONS.md',
} as const;

const RAW_GCSCRIPT_P2P_DEFI_KERNEL_LIB = {
  'lib/common.gcscript.jsonc': commonLibSource,
  'lib/open.gcscript.jsonc': openLibSource,
  'lib/close.gcscript.jsonc': closeLibSource,
  'lib/swap.gcscript.jsonc': swapLibSource,
} as const;

type GcscriptCode = Record<string, unknown>;
type GcscriptSourceMap = Record<string, string>;
type GcscriptVirtualFiles = Record<string, { data: Uint8Array; mimeType: string }>;

interface ValidatorDeployment {
  beaconsPolicy: {
    scriptHashHex: string;
    scriptSize: number;
    lang: string;
    input: {
      txHash: string;
      index: number;
    };
  };
  spendingValidator: {
    scriptHashHex: string;
    scriptSize: number;
    lang: string;
    input: {
      txHash: string;
      index: number;
    };
  };
  [key: string]: unknown;
}

function virtualFiles(sources: GcscriptSourceMap): GcscriptVirtualFiles {
  return Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [
      name,
      {
        data: textEncoder.encode(source),
        mimeType: 'application/json',
      },
    ]),
  );
}

export async function buildRuntimeGcscript(
  source: string | GcscriptCode,
  {
    fileUri = 'app:///main.gcscript',
    files = virtualFiles(GCSCRIPT_P2P_DEFI_KERNEL_LIB),
  }: { fileUri?: string; files?: GcscriptVirtualFiles } = {},
): Promise<GcscriptCode> {
  const dataUri = await gc.build.file({
    input: typeof source === 'string' ? source : JSON.stringify(source),
    fileUri,
    files,
    doValidate: false,
    compactOutput: true,
  });
  return (await (await fetch(dataUri)).json()) as GcscriptCode;
}

async function buildGcscriptLib(): Promise<Record<keyof typeof RAW_GCSCRIPT_P2P_DEFI_KERNEL_LIB, string>> {
  const rawFiles = virtualFiles(RAW_GCSCRIPT_P2P_DEFI_KERNEL_LIB);
  const entries = await Promise.all(
    Object.entries(RAW_GCSCRIPT_P2P_DEFI_KERNEL_LIB).map(async ([name, source]) => [
      name,
      JSON.stringify(await buildRuntimeGcscript(source, { fileUri: `app:///${name}`, files: rawFiles })),
    ]),
  );
  return Object.fromEntries(entries) as Record<keyof typeof RAW_GCSCRIPT_P2P_DEFI_KERNEL_LIB, string>;
}

export const GCSCRIPT_P2P_DEFI_KERNEL_LIB = await buildGcscriptLib();

function deploymentConstants(commonLib: string): Record<string, ValidatorDeployment> {
  const parsed = JSON.parse(commonLib) as {
    run?: { deploymentConstants?: { value?: Record<string, ValidatorDeployment> } };
  };
  return parsed.run?.deploymentConstants?.value || {};
}

export const P2P_DEFI_KERNEL_VALIDATOR_DEPLOYMENTS = deploymentConstants(GCSCRIPT_P2P_DEFI_KERNEL_LIB['lib/common.gcscript.jsonc']);

function validatorFor(dltTag: string, networkTag: string): ValidatorDeployment {
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
      swapSlippageTolerancePercent: 5.0,
      swapPayUpPercent: 5,
      toastAutoHideMs: 90000,
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
