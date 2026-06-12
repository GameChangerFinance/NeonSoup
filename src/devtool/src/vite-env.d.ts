/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEONSOUP_PREPROD_BLOCKFROST_URL?: string;
  readonly VITE_NEONSOUP_PREPROD_BLOCKFROST_KEY?: string;
  readonly VITE_NEONSOUP_MAINNET_BLOCKFROST_URL?: string;
  readonly VITE_NEONSOUP_MAINNET_BLOCKFROST_KEY?: string;
  readonly VITE_NEONSOUP_PREPROD_GRAPHQL_MK2_URL?: string;
  readonly VITE_NEONSOUP_MAINNET_GRAPHQL_MK2_URL?: string;
  readonly VITE_NEONSOUP_BUILD_TAG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
