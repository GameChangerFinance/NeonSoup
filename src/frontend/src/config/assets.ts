const ASSET_BASE = '/assets';

export const FRONTEND_LOGO_ASSETS = {
  icon: `${ASSET_BASE}/logo/icon.webp`,
  wordmark: `${ASSET_BASE}/logo/logo.webp`,
  favicon: `${ASSET_BASE}/logo/favicon.png`,
} as const;

export const UI_ASSETS = {
  route: `${ASSET_BASE}/cybernekos/lens-inspection_U.webp`,
  tooltip: `${ASSET_BASE}/cybernekos/peeking-counter_A.webp`,
  tablet: `${ASSET_BASE}/cybernekos/order-tablet_O.webp`,
  network: `${ASSET_BASE}/cybernekos/conveyor-belt_T.webp`,
  scale: `${ASSET_BASE}/cybernekos/soup-scale_J.webp`,
  ladle: `${ASSET_BASE}/cybernekos/ladle-stir_X.webp`,
  wallet: `${ASSET_BASE}/cybernekos/yawning-paw_AF.webp`,
  walletConnected: `${ASSET_BASE}/cybernekos/dj-cook_K.webp`,
  walletConnect: `${ASSET_BASE}/cybernekos/yawning-paw_AF.webp`,
  walletDisconnect: `${ASSET_BASE}/cybernekos/skateboard-bowl_AE.webp`,
  incognito: `${ASSET_BASE}/cybernekos/incognito_half_A.webp`,
  receipt: `${ASSET_BASE}/cybernekos/receipt-sorting_S.webp`,
  parallel: `${ASSET_BASE}/cybernekos/receipt-sorting_S.webp`,
  cloche: `${ASSET_BASE}/cybernekos/serving-cloche_AQ.webp`,
  success: `${ASSET_BASE}/cybernekos/confetti-happy_AC.webp`,
  warning: `${ASSET_BASE}/cybernekos/worried-sweat_E.webp`,
  danger: `${ASSET_BASE}/cybernekos/crying-error_F.webp`,
  info: `${ASSET_BASE}/cybernekos/order-tablet_O.webp`,
  infoToast: `${ASSET_BASE}/cybernekos/table-setting_AR.webp`,
  empty: `${ASSET_BASE}/cybernekos/sitting-calm_D.webp`,
  cart: `${ASSET_BASE}/cybernekos/menu-scroll_N.webp`,
  cartMode: `${ASSET_BASE}/cybernekos/menu-scroll_N.webp`,
  open: `${ASSET_BASE}/cybernekos/serving-soup_AD.webp`,
  menu: `${ASSET_BASE}/cybernekos/menu-pointer_R.webp`,
  data: `${ASSET_BASE}/cybernekos/data-wall_AY.webp`,
  history: `${ASSET_BASE}/cybernekos/receipt-sorting_S.webp`,
  options: `${ASSET_BASE}/cybernekos/pantry-terminal_AM.webp`,
  bundleActions: `${ASSET_BASE}/cybernekos/soup-pot-stack_BB.webp`,
  payUp: `${ASSET_BASE}/cybernekos/temperature-gun_W.webp`,
  serviceFee: `${ASSET_BASE}/cybernekos/bowl-seasoning_I.webp`,
  bundle: `${ASSET_BASE}/kitchen/bento_cube_A.webp`,
  measure: `${ASSET_BASE}/kitchen/measuring_spoon_A.webp`,
  strainer: `${ASSET_BASE}/kitchen/strainer_ladle_A.webp`,
  coin: `${ASSET_BASE}/kitchen/coin_bowl_A.webp`,
  gogglesCleaning: `${ASSET_BASE}/cybernekos/goggles-cleaning_Y.webp`,
} as const;

export type UiAsset = Exclude<keyof typeof UI_ASSETS, 'gogglesCleaning'>;
