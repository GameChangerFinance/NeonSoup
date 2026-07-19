const ASSET_BASE = '/assets';

export const FRONTEND_LOGO_ASSETS = {
  icon: `${ASSET_BASE}/logo/icon.png`,
  wordmark: `${ASSET_BASE}/logo/logo.png`,
  favicon: `${ASSET_BASE}/logo/favicon.png`,
} as const;

export const UI_ASSETS = {
  route: `${ASSET_BASE}/cybernekos/lens-inspection_U.png`,
  tooltip: `${ASSET_BASE}/cybernekos/peeking-counter_A.png`,
  tablet: `${ASSET_BASE}/cybernekos/order-tablet_O.png`,
  network: `${ASSET_BASE}/cybernekos/conveyor-belt_T.png`,
  scale: `${ASSET_BASE}/cybernekos/soup-scale_J.png`,
  ladle: `${ASSET_BASE}/cybernekos/ladle-stir_X.png`,
  wallet: `${ASSET_BASE}/cybernekos/yawning-paw_AF.png`,
  walletConnected: `${ASSET_BASE}/cybernekos/dj-cook_K.png`,
  walletConnect: `${ASSET_BASE}/cybernekos/yawning-paw_AF.png`,
  walletDisconnect: `${ASSET_BASE}/cybernekos/skateboard-bowl_AE.png`,
  incognito: `${ASSET_BASE}/cybernekos/incognito_half_A.png`,
  receipt: `${ASSET_BASE}/cybernekos/receipt-sorting_S.png`,
  parallel: `${ASSET_BASE}/cybernekos/receipt-sorting_S.png`,
  cloche: `${ASSET_BASE}/cybernekos/serving-cloche_AQ.png`,
  success: `${ASSET_BASE}/cybernekos/confetti-happy_AC.png`,
  warning: `${ASSET_BASE}/cybernekos/worried-sweat_E.png`,
  danger: `${ASSET_BASE}/cybernekos/crying-error_F.png`,
  info: `${ASSET_BASE}/cybernekos/order-tablet_O.png`,
  infoToast: `${ASSET_BASE}/cybernekos/table-setting_AR.png`,
  empty: `${ASSET_BASE}/cybernekos/sitting-calm_D.png`,
  cart: `${ASSET_BASE}/cybernekos/menu-scroll_N.png`,
  cartMode: `${ASSET_BASE}/cybernekos/menu-scroll_N.png`,
  open: `${ASSET_BASE}/cybernekos/serving-soup_AD.png`,
  menu: `${ASSET_BASE}/cybernekos/menu-pointer_R.png`,
  data: `${ASSET_BASE}/cybernekos/data-wall_AY.png`,
  history: `${ASSET_BASE}/cybernekos/receipt-sorting_S.png`,
  options: `${ASSET_BASE}/cybernekos/pantry-terminal_AM.png`,
  bundleActions: `${ASSET_BASE}/cybernekos/soup-pot-stack_BB.png`,
  payUp: `${ASSET_BASE}/cybernekos/temperature-gun_W.png`,
  serviceFee: `${ASSET_BASE}/cybernekos/bowl-seasoning_I.png`,
  bundle: `${ASSET_BASE}/kitchen/bento_cube_A.png`,
  measure: `${ASSET_BASE}/kitchen/measuring_spoon_A.png`,
  strainer: `${ASSET_BASE}/kitchen/strainer_ladle_A.png`,
  coin: `${ASSET_BASE}/kitchen/coin_bowl_A.png`,
  gogglesCleaning: `${ASSET_BASE}/cybernekos/goggles-cleaning_Y.png`,
} as const;

export type UiAsset = Exclude<keyof typeof UI_ASSETS, 'gogglesCleaning'>;
