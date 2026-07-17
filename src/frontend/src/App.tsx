import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import textLogoUrl from './assets/textLogo.png';
import logoUrl from '/assets/logo/icon.png';
import { APP_CONFIG } from '../../common/config/appConfig';
import { useAppDispatch, useAppState } from '../../common/state/appState';
import { assetMap, balanceOf, resolveAsset, visiblePortfolio } from '../../common/state/selectors';
import { assetKeyOf, assetTitle, configuredAssets } from '../../common/domain/assets';
import { createOpenBookSnapshot } from '../../common/domain/openBook';
import { isCurrentOutputOwner } from '../../common/domain/ownership';
import { fromBase, percent, ratioDecimal, toBase } from '../../common/domain/quantities';
import { serviceFeesForNetwork, swapServiceFeeForMode } from '../../common/domain/serviceFees';
import { safeError, short } from '../../common/domain/text';
import {
  composeTransactionRows,
  isConfirmedChainTransaction,
  protocolTransactionFromChain,
  transactionsFromReceipt,
  type TransactionRow,
} from '../../common/domain/transactions';
import {
  percentToBps,
  quoteSwap,
  severityForSlippage,
  type SwapPrice,
  type SwapQuote,
  type SwapQuoteSeverity,
} from '../../common/domain/swapQuote';
import { loadAddressTransactions, loadOpenOffers, loadPortfolio, loadTransactions } from '../../common/services/networkProvider';
import { cardanoscanTxUrl, openExternalUrl } from '../../common/services/explorers';
import { captureWalletReturn, consumeWalletReturn, openWalletCode } from '../../common/services/gcWallet';
import { connectIntent } from '../../common/services/intents';
import {
  buildBundledGcscriptIntent,
  buildParallelGcscriptIntent,
  executionReceiptFromWalletReturn,
} from '../../common/services/intentExecution';
import {
  bookedSourceRefs,
  createCartItemFromCurrentIntent,
  createSwapCartItems,
  selectedCartItems,
  sourceRef,
  validateCartItemsCanBeAdded,
  visibleCartItems,
} from '../../common/services/cartIntents';
import { clearNetworkScopedStoredData, readWalletReturn } from '../../common/services/storage';
import type {
  AppState,
  CartItem,
  NeonSoupExecutionReceipt,
  NoticeTone,
  OpenOffer,
  ResolvedAsset,
  NetworkTag,
  ProtocolTransactionDetail,
  WalletConnection,
} from '../../common/state/types';

type ViewId = 'swap' | 'open' | 'markets' | 'orders' | 'portfolio' | 'history' | 'options';

interface ToastState {
  tone: NoticeTone;
  title: string;
  message: string;
}

interface WalletExecutionStatus {
  txs: Array<{
    status: string;
    hasSubmitError: boolean;
    hasContentionError: boolean;
  }>;
  itemCount?: number;
  incognito: boolean;
}

const HELP = {
  swapPage:
    'Swap estimates a route across live NeonSoup offers. It feels like a DEX swap, but it fills P2P DeFi Kernel order-book liquidity at posted limit prices.',
  openPage:
    'Open Offer creates a one-way limit order. You choose what you offer, what you request, and the fixed price other users may fill.',
  marketsPage: 'Markets lists recognized asset pairs and live order-book liquidity available to NeonSoup right now.',
  ordersPage: 'My Orders shows your open NeonSoup offers and how much of each offer appears filled for this wallet.',
  portfolioPage: 'Portfolio shows wallet balances recognized by NeonSoup and quick actions to swap or open offers.',
  historyPage: 'History shows wallet transactions that NeonSoup recognizes from on-chain order activity.',
  optionsPage: 'Options controls wallet flow, transaction bundling, route preferences, provider, and network selection.',
  route: 'Shows how much of your swap can be matched right now and how smoothly the price moves across available offers.',
  priceImpact: 'Shows how much the estimated price changes while matching your swap against available offers.',
  swapPay: 'Asset and amount you want to spend. NeonSoup routes this against live order offers.',
  swapReceive:
    'Asset and estimated amount you may receive from the current route. The final amount depends on live order availability when you submit.',
  bestExecutablePrice: 'Best currently available limit price from executable live offers for this pair.',
  balanceUsed: 'Share of your connected wallet balance used by the executable part of this swap.',
  serviceFee: 'NeonSoup service fee added to the wallet transaction for this swap action.',
  openOfferAsset: 'Asset and amount you lock into a new one-way offer for other users to fill.',
  openRequestAsset: 'Asset and amount you want to receive as the offer is filled.',
  limitPrice: 'Fixed exchange rate for your offer. Fillers can only take your offered asset if they pay at least this price.',
  cartMode:
    'When Cart Mode is on, operations wait in Cart until you press Run. When it is off, the wallet opens immediately and the operation is still kept as history.',
  parallel:
    'An action intent is one NeonSoup operation, such as filling one offer. A transaction is the on-chain Cardano transaction that carries one or more action intents. Bundle mode packs action intents together. Best-effort parallel mode sends independent transactions so some actions can still land if another user fills one of the same shared order-book offers first.',
  bundleActions:
    'Controls how many NeonSoup action intents can be packed into each on-chain transaction in bundle mode. Higher values can reduce wallet prompts and fees, but one contested offer can make that bundled transaction fail. This is disabled in best-effort parallel mode because parallel mode intentionally uses independent transactions.',
  payUp:
    'NeonSoup has no backend batcher. Your device routes directly against the global P2P DeFi Kernel order book, where each offer UTxO can only be filled by one user at a time. Pay-up mode can skip the cheapest, most contested offers and choose slightly worse-priced offers to improve the chance that your transaction is accepted.',
  payUpPremium:
    'Maximum extra price, in percent, that the router may accept when Pay-up mode is enabled. For example, 1% lets NeonSoup choose an offer up to 1% worse than the cheapest local route when that may reduce UTxO contention.',
  slippageTolerance:
    'Percentage threshold used to warn about route-level price movement across multiple limit orders. This is not AMM curve slippage; it measures how much worse the selected order-book route is compared with the best executable price NeonSoup sees locally.',
  provider:
    'The provider only transports chain data. NeonSoup keeps swap semantics and routing on your device.',
  network:
    'Shows which Cardano network NeonSoup is using for chain data and wallet operations. Changing networks disconnects the wallet and clears Cart, order book, portfolio, history, wallet return data, and network-specific endpoint overrides.',
  pending:
    'Wallet-submitted operations are not final until a provider confirms the transaction on-chain.',
};

const INCOGNITO_NOTICE =
  'You are using Incognito Mode. You can transact without connecting your wallet because GameChanger Wallet will provide the required address privately, but NeonSoup will not know your balance until you connect.';
const INCOGNITO_CART_NOTICE =
  'In Incognito Mode, NeonSoup does not keep executed Cart items after opening the wallet, so your activity is not tracked in local app history.';

const UI_ASSETS = {
  route: '/assets/cybernekos/lens-inspection_U.png',
  tooltip: '/assets/cybernekos/peeking-counter_A.png',
  tablet: '/assets/cybernekos/order-tablet_O.png',
  network: '/assets/cybernekos/conveyor-belt_T.png',
  scale: '/assets/cybernekos/soup-scale_J.png',
  ladle: '/assets/cybernekos/ladle-stir_X.png',
  wallet: '/assets/cybernekos/yawning-paw_AF.png',
  walletConnected: '/assets/cybernekos/dj-cook_K.png',
  walletConnect: '/assets/cybernekos/yawning-paw_AF.png',
  walletDisconnect: '/assets/cybernekos/skateboard-bowl_AE.png',
  incognito: '/assets/cybernekos/incognito_half_A.png',
  receipt: '/assets/cybernekos/receipt-sorting_S.png',
  parallel: '/assets/cybernekos/receipt-sorting_S.png',
  cloche: '/assets/cybernekos/serving-cloche_AQ.png',
  success: '/assets/cybernekos/confetti-happy_AC.png',
  warning: '/assets/cybernekos/worried-sweat_E.png',
  danger: '/assets/cybernekos/crying-error_F.png',
  info: '/assets/cybernekos/order-tablet_O.png',
  infoToast: '/assets/cybernekos/table-setting_AR.png',
  empty: '/assets/cybernekos/sitting-calm_D.png',
  cart: '/assets/cybernekos/menu-scroll_N.png',
  cartMode: '/assets/cybernekos/menu-scroll_N.png',
  open: '/assets/cybernekos/serving-soup_AD.png',
  menu: '/assets/cybernekos/menu-pointer_R.png',
  data: '/assets/cybernekos/data-wall_AY.png',
  history: '/assets/cybernekos/receipt-sorting_S.png',
  options: '/assets/cybernekos/pantry-terminal_AM.png',
  bundleActions: '/assets/cybernekos/soup-pot-stack_BB.png',
  payUp: '/assets/cybernekos/temperature-gun_W.png',
  serviceFee: '/assets/cybernekos/bowl-seasoning_I.png',
  bundle: '/assets/kitchen/bento_cube_A.png',
  measure: '/assets/kitchen/measuring_spoon_A.png',
  strainer: '/assets/kitchen/strainer_ladle_A.png',
  coin: '/assets/kitchen/coin_bowl_A.png',
} as const;

type UiAsset = keyof typeof UI_ASSETS;
const MARKET_QUOTE_ASSET_TAGS = new Set<ResolvedAsset['tag']>(['coin', 'stablecoin', 'mainstream']);

function VisualAsset({ asset, className = '' }: { asset: UiAsset; className?: string }) {
  return <img className={`ns-helper-art ${className}`} src={UI_ASSETS[asset]} alt="" aria-hidden="true" />;
}

function tooltipAssetForLabel(label: string): UiAsset {
  if (/markets/i.test(label)) return 'data';
  if (/my orders|order progress/i.test(label)) return 'tablet';
  if (/history/i.test(label)) return 'history';
  if (/options/i.test(label)) return 'options';
  if (/portfolio/i.test(label)) return 'walletConnected';
  if (/service fee/i.test(label)) return 'serviceFee';
  if (/pay-up/i.test(label)) return 'payUp';
  if (/price impact|slippage|limit price/i.test(label)) return 'scale';
  if (/swap|receive|you pay|executable|balance used|route|availability/i.test(label)) return 'ladle';
  if (/disconnect/i.test(label)) return 'walletDisconnect';
  if (/connect/i.test(label)) return 'walletConnect';
  if (/wallet/i.test(label)) return 'walletConnected';
  if (/open offer/i.test(label)) return 'open';
  if (/cart mode/i.test(label)) return 'cartMode';
  if (/cart collision/i.test(label)) return 'cart';
  if (/parallel/i.test(label)) return 'parallel';
  if (/bundle/i.test(label)) return 'bundleActions';
  if (/provider url/i.test(label)) return 'menu';
  if (/network/i.test(label)) return 'network';
  if (/provider/i.test(label)) return 'tablet';
  if (/pending/i.test(label)) return 'receipt';
  return 'tooltip';
}

function alertAssetForMessage(tone: NoticeTone, message: string): UiAsset {
  if (/order transactions? loaded|recent order transactions|transaction/i.test(message)) return 'history';
  if (/connect a wallet|incognito mode/i.test(message)) return 'incognito';
  if (/disconnect/i.test(message)) return 'walletDisconnect';
  if (/wallet|connect/i.test(message)) return 'walletConnected';
  if (/liquidity|offers|order/i.test(message)) return tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'route';
  if (/cart|queue|operation/i.test(message)) return 'cart';
  if (/history|transactions|loaded/i.test(message)) return 'history';
  if (/amount|balance|price|slippage|terms/i.test(message)) return tone === 'danger' ? 'danger' : 'scale';
  if (tone === 'success') return 'success';
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  return 'info';
}

interface PageAlertItem {
  tone: NoticeTone;
  message: string;
}

const GOGGLES_CLEANING_ASSET = '/assets/cybernekos/goggles-cleaning_Y.png';
const MAINNET_ALPHA_ACK_KEY = `neonsoup-mainnet-public-alpha-ack-${APP_CONFIG.version}`;
const PUBLIC_ALPHA_COPY =
 `NeonSoup is currently in Public Alpha because its source code is publicly available as open source for early testing and feedback, including feedback from the Gimbalabs Piece of Pie Hackathon.
The software may be unstable, incomplete, or unavailable without notice. It is provided “as is” and used entirely at your own risk. We are not responsible for any loss, damage, misuse, or unintended consequences resulting from its use.`;

const ALERT_PRIORITY: Record<NoticeTone, number> = {
  danger: 0,
  warning: 1,
  success: 2,
  info: 3,
};

function prioritizedAlert(alerts: Array<PageAlertItem | false | null | undefined>): PageAlertItem | null {
  return (
    alerts
      .filter((alert): alert is PageAlertItem => Boolean(alert && alert.message))
      .sort((left, right) => ALERT_PRIORITY[left.tone] - ALERT_PRIORITY[right.tone])[0] || null
  );
}

function GraphicTextModal({ title, text, asset, onClose }: { title: string; text: string; asset: UiAsset; onClose: () => void }) {
  return createPortal(
    <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card graphic-text-modal" aria-modal="true" role="dialog" aria-labelledby="graphic-text-modal-title">
        <VisualAsset asset={asset} className="modal-top-art" />
        <div className="modal-head">
          <h2 id="graphic-text-modal-title">{title}</h2>
          <button type="button" className="modal-action-btn" onClick={onClose} aria-label={`Close ${title}`}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body-scroll modal-text-scroll">
          <p>{text}</p>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ValidationAlert({ tone, message }: PageAlertItem) {
  const [modalOpen, setModalOpen] = useState(false);
  const role = tone === 'info' || tone === 'success' ? 'status' : 'alert';
  const canExpand = message.length > 96;
  const asset = alertAssetForMessage(tone, message);
  return (
    <div className={`alert alert-${tone} validation-alert`} role={role}>
      <VisualAsset asset={asset} className="ns-alert-art" />
      <span className="validation-alert-text">{message}</span>
      {canExpand ? (
        <button type="button" className="alert-more-btn" onClick={() => setModalOpen(true)}>
          more
        </button>
      ) : null}
      {modalOpen ? <GraphicTextModal title="" text={message} asset={asset} onClose={() => setModalOpen(false)} /> : null}
    </div>
  );
}

function PageAlert({ alerts }: { alerts: Array<PageAlertItem | false | null | undefined> }) {
  const alert = prioritizedAlert(alerts);
  return alert ? <ValidationAlert tone={alert.tone} message={alert.message} /> : null;
}

function walletFromReturn(raw: unknown): WalletConnection | null {
  if (!raw || typeof raw !== 'object') return null;
  const wallet = (raw as Record<string, unknown>).wallet;
  return wallet && typeof wallet === 'object' ? (wallet as WalletConnection) : null;
}

function incognitoExecutionStatusFromWalletReturn(raw: unknown): WalletExecutionStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const decoded = (raw as Record<string, unknown>).decoded;
  if (!decoded || typeof decoded !== 'object') return null;
  const exports = (decoded as Record<string, unknown>).exports;
  if (!exports || typeof exports !== 'object') return null;
  const receipt = (exports as Record<string, unknown>).neonsoupExecution;
  if (!receipt || typeof receipt !== 'object') return null;
  const txs = (receipt as Record<string, unknown>).txs;
  if (!Array.isArray(txs)) return null;
  const normalized = txs
    .map((tx) => {
      if (!tx || typeof tx !== 'object') return null;
      const value = tx as Record<string, unknown>;
      return typeof value.status === 'string' &&
        typeof value.hasSubmitError === 'boolean' &&
        typeof value.hasContentionError === 'boolean'
        ? {
            status: value.status,
            hasSubmitError: value.hasSubmitError,
            hasContentionError: value.hasContentionError,
          }
        : null;
    })
    .filter((tx): tx is WalletExecutionStatus['txs'][number] => Boolean(tx));
  return normalized.length === txs.length && normalized.length ? { txs: normalized, incognito: true } : null;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

function serviceFeeText(state: AppState): string {
  const fee = swapServiceFeeForMode(serviceFeesForNetwork(state.options.network, state.customAssets), state.cart.mode);
  if (!fee) return 'No fee';
  const ticker = fee.ticker || (fee.policyId === 'ada' && fee.assetNameHex === 'ada' ? 'ADA' : `${short(fee.policyId, 4, 4)}.${fee.assetNameHex || 'asset'}`);
  return `${fee.displayQuantity || fee.quantity} ${ticker}`;
}

function compareQuantityDesc(a: bigint, b: bigint): number {
  if (a === b) return 0;
  if (a === 0n) return 1;
  if (b === 0n) return -1;
  return a > b ? -1 : 1;
}

function priceText(price: SwapPrice | null, offerAsset: ResolvedAsset | undefined, receiveAsset: ResolvedAsset | undefined): string {
  if (!price || !offerAsset || !receiveAsset || price.denominator <= 0n) return '-';
  const numerator = price.numerator * 10n ** BigInt(receiveAsset.decimals);
  const denominator = price.denominator * 10n ** BigInt(offerAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function shortHash(value: string): string {
  return short(value, 4, 4);
}

function formatDateTime(value: number): string {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function txExplorerUrl(state: AppState, txHash: string): string {
  const pattern = state.options.cardanoscanTxUrlPattern.trim();
  if (pattern) {
    return pattern
      .replace(/\{txHash\}/g, encodeURIComponent(txHash))
      .replace(/\{network\}/g, encodeURIComponent(state.options.network));
  }
  return cardanoscanTxUrl(state.options.network, txHash);
}

function detailAsset(state: AppState, policyId = '', assetNameHex = ''): ResolvedAsset {
  return resolveAsset(state, policyId || 'ada', assetNameHex || 'ada');
}

function detailPrice(detail: ProtocolTransactionDetail, offerAsset: ResolvedAsset, askAsset: ResolvedAsset): string {
  const numerator = BigInt(detail.priceNumerator || '0');
  const denominator = BigInt(detail.priceDenominator || '0');
  if (numerator <= 0n || denominator <= 0n) return 'Unknown price';
  return `${priceText({ numerator, denominator }, askAsset, offerAsset)} ${assetTitle(askAsset)} / ${assetTitle(offerAsset)}`;
}

function actionTitle(action: ProtocolTransactionDetail['action']): string {
  if (action === 'open') return 'Open offer';
  if (action === 'fill') return 'Swap fill';
  if (action === 'close') return 'Close offer';
  return 'Order activity';
}

function amountLabels(action: ProtocolTransactionDetail['action']): { offer: string; ask: string } {
  if (action === 'open') return { offer: 'Offered', ask: 'Requested' };
  if (action === 'fill') return { offer: 'Filled', ask: 'Paid' };
  if (action === 'close') return { offer: 'Returned', ask: 'Collected' };
  return { offer: 'Offer side', ask: 'Ask side' };
}

function openPriceText(offerAmount: bigint, askAmount: bigint, offerAsset: ResolvedAsset, askAsset: ResolvedAsset): string {
  if (offerAmount <= 0n || askAmount <= 0n) return '-';
  const numerator = askAmount * 10n ** BigInt(offerAsset.decimals);
  const denominator = offerAmount * 10n ** BigInt(askAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function orderLimitPriceText(offer: OpenOffer, offerAsset: ResolvedAsset, askAsset: ResolvedAsset): string {
  const numerator = BigInt(offer.priceNumerator || '0') * 10n ** BigInt(offerAsset.decimals);
  const denominator = BigInt(offer.priceDenominator || '1') * 10n ** BigInt(askAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function quotePreviewOutput(quote: SwapQuote): bigint {
  if (quote.unfilledRequestedQuantity <= 0n) return quote.outputQuantity;
  const lastPrice = quote.marginalPrice || quote.effectivePrice || quote.executableBestPrice;
  if (!lastPrice || lastPrice.numerator <= 0n || lastPrice.denominator <= 0n) return quote.outputQuantity;
  return quote.outputQuantity + (quote.unfilledRequestedQuantity * lastPrice.denominator) / lastPrice.numerator;
}

function quoteHasExecutableRoute(quote: SwapQuote): boolean {
  return quote.segments.length > 0 && quote.outputQuantity > 0n;
}

function quoteHasTrueLiquidityShortage(quote: SwapQuote): boolean {
  return (
    quote.unfilledRequestedQuantity > 0n &&
    quote.remainderBlockedCount === 0 &&
    quote.segments.every((segment) => segment.makerRemainderQuantity <= 0n)
  );
}

function formQuantity(value: string, asset: ResolvedAsset): bigint {
  return toBase(value, asset.decimals);
}

function scaledDecimal(value: string, decimals = 8): bigint {
  return toBase(value, decimals);
}

function askQuantityFromPrice(offerQuantity: bigint, price: string, offerAsset: ResolvedAsset, askAsset: ResolvedAsset): bigint {
  const scaleDecimals = 8;
  const priceScaled = scaledDecimal(price, scaleDecimals);
  if (offerQuantity <= 0n || priceScaled <= 0n) return 0n;
  return (offerQuantity * priceScaled * 10n ** BigInt(askAsset.decimals)) / (10n ** BigInt(scaleDecimals + offerAsset.decimals));
}

function filledOfferEquivalent(offer: OpenOffer): bigint {
  const askQuantity = BigInt(offer.utxoAskQuantity || '0');
  const numerator = BigInt(offer.priceNumerator || '0');
  const denominator = BigInt(offer.priceDenominator || '0');
  if (askQuantity <= 0n || numerator <= 0n || denominator <= 0n) return 0n;
  return (askQuantity * denominator) / numerator;
}

function pendingTransactionHashes(state: AppState): string[] {
  return [
    ...state.transactions.filter((tx) => tx.status === 'submitted').map((tx) => tx.txHash),
    ...state.cart.items.filter((item) => item.status === 'pending').map((item) => item.txHash || ''),
  ].filter(Boolean);
}

function protocolRowsFromChainTransactions(state: AppState, transactions: Parameters<typeof protocolTransactionFromChain>[0][]) {
  return transactions
    .map((transaction) =>
      protocolTransactionFromChain(
        transaction,
        APP_CONFIG.networks[state.options.network].validator.beaconsPolicy.scriptHashHex,
      ),
    )
    .filter((transaction) => transaction.status === 'failed' || Boolean(transaction.actions?.length));
}

function executionStatusFromReceipt(receipt: NeonSoupExecutionReceipt): WalletExecutionStatus {
  return { txs: receipt.txs, itemCount: receipt.itemCount, incognito: false };
}

function walletExecutionToast(status: WalletExecutionStatus | null): ToastState | null {
  if (!status) return null;
  const total = status.txs.length;
  const failed = status.txs.filter((tx) => tx.hasSubmitError).length;
  const contention = status.txs.filter((tx) => tx.hasContentionError).length;
  const submitted = Math.max(0, total - failed);
  const privacySuffix = status.incognito
    ? ' NeonSoup did not keep local activity details for this Incognito Mode execution.'
    : ' Final details will update after chain confirmation.';
  if (!failed) {
    const actionCount = status.itemCount || total;
    return {
      tone: 'success',
      title: status.incognito ? 'Wallet execution sent' : 'Wallet submitted',
      message: `${actionCount} operation${actionCount === 1 ? '' : 's'} sent to the wallet with no reported transaction errors.${privacySuffix}`,
    };
  }
  if (failed === total) {
    return {
      tone: 'danger',
      title: 'Wallet execution failed',
      message: `${failed} transaction${failed === 1 ? '' : 's'} reported wallet submission errors${contention ? `, including ${contention} contention error${contention === 1 ? '' : 's'}` : ''}.${privacySuffix}`,
    };
  }
  return {
    tone: 'warning',
    title: 'Some transactions need attention',
    message: `${submitted} transaction${submitted === 1 ? '' : 's'} submitted and ${failed} reported wallet submission errors${contention ? `, including ${contention} contention error${contention === 1 ? '' : 's'}` : ''}.${privacySuffix}`,
  };
}

function walletReturnToast(receipt: NeonSoupExecutionReceipt | null, incognitoStatus: WalletExecutionStatus | null): ToastState {
  const executionToast = walletExecutionToast(receipt ? executionStatusFromReceipt(receipt) : incognitoStatus);
  if (executionToast) return executionToast;
  return {
    tone: 'success',
    title: 'Wallet connected',
    message: 'NeonSoup can now read your public wallet address and balances.',
  };
}

function executionSummaryForItems(state: AppState, items: readonly CartItem[], receipt: NeonSoupExecutionReceipt | null): string {
  if (!receipt) return '';
  const failedGroups = new Set(receipt.txs.filter((tx) => tx.hasSubmitError).map((tx) => tx.groupIndex));
  const successfulIds = new Set(
    receipt.items.filter((item) => !failedGroups.has(item.groupIndex)).map((item) => item.itemId),
  );
  const totals = new Map<string, { expected: bigint; apparent: bigint; decimals: number; label: string }>();
  items.forEach((item) => {
    if (item.name !== 'fill' || !item.pair) return;
    const quantity = BigInt(item.args['offer-quantity'] || '0');
    if (quantity <= 0n) return;
    const asset = resolveAsset(state, item.pair.offer.policyId, item.pair.offer.assetNameHex);
    const previous = totals.get(asset.assetKey) || {
      expected: 0n,
      apparent: 0n,
      decimals: asset.decimals,
      label: assetTitle(asset),
    };
    totals.set(asset.assetKey, {
      ...previous,
      expected: previous.expected + quantity,
      apparent: previous.apparent + (successfulIds.has(item.id) ? quantity : 0n),
    });
  });
  const partial = [...totals.values()].filter((item) => item.expected > 0n && item.apparent < item.expected);
  if (!partial.length) return '';
  return partial
    .map(
      (item) =>
        `Based on wallet submission status, you appear to have received at least ${fromBase(item.apparent, item.decimals)} ${item.label} out of the expected ${fromBase(item.expected, item.decimals)} ${item.label}.`,
    )
    .join(' ');
}

function HelpTooltip({ label, children, asset }: { label: string; children: ReactNode; asset?: UiAsset }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; placement: 'above' | 'below' }>({
    left: 16,
    top: 16,
    placement: 'above',
  });

  useLayoutEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 16;
      const gap = 8;
      const width = Math.min(520, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
      const showBelow = rect.top < 96;
      const top = showBelow ? rect.bottom + gap : Math.max(margin, rect.top - gap);
      setPosition({ left, top, placement: showBelow ? 'below' : 'above' });
    }

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  return (
    <span className="help-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="help-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <i className="bi bi-question-lg" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <span
              className={`help-popover help-popover-floating help-popover-${position.placement}`}
              style={{ left: position.left, top: position.top }}
              role="tooltip"
            >
              <VisualAsset asset={asset || tooltipAssetForLabel(label)} className="ns-tooltip-art" />
              <span className="help-popover-content">{children}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function EmptyState({ children, asset = 'empty' }: { children: ReactNode; asset?: UiAsset }) {
  return (
    <div className="empty-state ns-art-surface">
      <VisualAsset asset={asset} />
      <span>{children}</span>
    </div>
  );
}

function ScrollFade({ children, className = '', header }: { children: ReactNode; className?: string; header?: ReactNode }) {
  return (
    <div className={`scroll-fade ${className}`}>
      {header ? <div className="scroll-fade-header">{header}</div> : null}
      <div className="scroll-fade-scroll">
        <div className="scroll-fade-inner">{children}</div>
      </div>
    </div>
  );
}

function CopyIcon({ value, label = 'Copy value' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button type="button" className="copy-icon" onClick={copy} title={copied ? 'Copied' : label} aria-label={copied ? 'Copied' : label}>
      <i className={`bi ${copied ? 'bi-check2' : 'bi-copy'}`} aria-hidden="true" />
    </button>
  );
}

function ProtocolInfoModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const network = APP_CONFIG.networks[state.options.network];
  const fields = [
    ['Description', network.validatorInfo.description],
    ['Beacons Policy', network.validator.beaconsPolicy.scriptHashHex],
    ['Spending Validator', network.validator.spendingValidator.scriptHashHex],
  ] as const;

  return createPortal(
    <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card graphic-text-modal protocol-info-modal" aria-modal="true" role="dialog" aria-labelledby="protocol-info-title">
        <img className="modal-top-art" src={GOGGLES_CLEANING_ASSET} alt="" aria-hidden="true" />
        <div className="modal-head">
          <h2 id="protocol-info-title">Protocol Info</h2>
          <button type="button" className="modal-action-btn" onClick={onClose} aria-label="Close Protocol Info">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body-scroll modal-text-scroll">
          <div className="protocol-info-list">
            {fields.map(([label, value]) => (
              <div className="protocol-info-row" key={label}>
                <span>{label}</span>
                <strong className="mono inline-copy">
                  {label === 'Description' ? value : short(value)}
                  <CopyIcon value={value} label={`Copy ${label}`} />
                </strong>
              </div>
            ))}
            <div className="protocol-info-row">
              <span>Source</span>
              <strong className="inline-copy">
                <a href={network.validatorInfo.sourceURL} target="_blank" rel="noreferrer">
                  Open source
                </a>
                <CopyIcon value={network.validatorInfo.sourceURL} label="Copy Source" />
              </strong>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function RefreshButton({ loading, disabled, onClick }: { loading?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="panel-refresh-btn" onClick={onClick} disabled={disabled || loading} aria-label="Refresh">
      <i className={`bi bi-arrow-clockwise${loading ? ' spin' : ''}`} aria-hidden="true" />
      <span>{loading ? 'Refreshing' : 'Refresh'}</span>
    </button>
  );
}

function AmountShortcuts({
  balance,
  asset,
  onSet,
}: {
  balance: bigint;
  asset: ResolvedAsset;
  onSet: (value: string) => void;
}) {
  const setFraction = (numerator: bigint, denominator: bigint) => {
    const next = denominator > 0n ? (balance * numerator) / denominator : 0n;
    onSet(fromBase(next, asset.decimals));
  };
  return (
    <div className="amount-shortcuts" aria-label={`Available ${assetTitle(asset)} shortcuts`}>
      <button type="button" onClick={() => onSet('')}>
        Reset
      </button>
      <button type="button" disabled={balance <= 0n} onClick={() => setFraction(1n, 4n)}>
        1/4
      </button>
      <button type="button" disabled={balance <= 0n} onClick={() => setFraction(1n, 2n)}>
        1/2
      </button>
      <button type="button" disabled={balance <= 0n} onClick={() => setFraction(1n, 1n)}>
        Max
      </button>
    </div>
  );
}

function AssetIcon({ asset, size = 'md' }: { asset: ResolvedAsset | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const title = asset ? assetTitle(asset) : '?';
  return (
    <span className={`ns-asset-icon ns-asset-icon-${size}`} aria-hidden="true">
      {title.slice(0, size === 'sm' ? 3 : 4)}
    </span>
  );
}

function AssetPairStack({ offerAsset, askAsset }: { offerAsset: ResolvedAsset | undefined; askAsset: ResolvedAsset | undefined }) {
  return (
    <span className="asset-stack" aria-hidden="true">
      <AssetIcon asset={offerAsset} />
      <AssetIcon asset={askAsset} />
    </span>
  );
}

function assetRefValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function cartItemPairAssets(state: AppState, item: CartItem): { offerAsset: ResolvedAsset | undefined; askAsset: ResolvedAsset | undefined } {
  const offer = item.pair?.offer || {
    policyId: assetRefValue(item.args['offer-policy-id']),
    assetNameHex: assetRefValue(item.args['offer-asset-name']),
  };
  const ask = item.pair?.ask || {
    policyId: assetRefValue(item.args['ask-policy-id']),
    assetNameHex: assetRefValue(item.args['ask-asset-name']),
  };
  return {
    offerAsset: offer.policyId ? resolveAsset(state, offer.policyId, offer.assetNameHex) : undefined,
    askAsset: ask.policyId ? resolveAsset(state, ask.policyId, ask.assetNameHex) : undefined,
  };
}

function AssetPicker({
  assets,
  value,
  exclude,
  onChange,
}: {
  assets: Record<string, ResolvedAsset>;
  value: string;
  exclude: string;
  onChange: (assetKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = assets[value];
  const choices = Object.values(assets).filter((asset) => asset.known && asset.assetKey !== exclude);
  return (
    <div className="asset-picker">
      <button type="button" className="asset-trigger" onClick={() => setOpen((next) => !next)}>
        <AssetIcon asset={selected} size="lg" />
        <span>{selected ? assetTitle(selected) : 'Select'}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {open ? (
        <div className="asset-menu">
          {choices.map((asset) => (
            <button
              type="button"
              key={asset.assetKey}
              onClick={() => {
                onChange(asset.assetKey);
                setOpen(false);
              }}
            >
              <AssetIcon asset={asset} size="sm" />
              <span>{assetTitle(asset)}</span>
              {!asset.known ? <span className="asset-unknown">Unknown</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompactRouteBar({ quote, offerAsset, receiveAsset }: { quote: SwapQuote; offerAsset: ResolvedAsset; receiveAsset: ResolvedAsset }) {
  if (!quote.requestedInputQuantity) {
    return (
      <div className="route-empty">
        Enter an amount to inspect the route. <HelpTooltip label="Route help" asset="route">{HELP.route}</HelpTooltip>
      </div>
    );
  }
  if (!quote.segments.length) {
    return <EmptyState asset="route">No available offers match this direction.</EmptyState>;
  }
  const displayTotal = quote.routeDisplayQuantity > 0n ? quote.routeDisplayQuantity : quote.requestedInputQuantity;
  const share = (value: bigint) => {
    if (value <= 0n || displayTotal <= 0n) return 0;
    return Number((value * 10_000n) / displayTotal) / 100;
  };
  const segments = quote.segments.flatMap((segment) => {
    const out: Array<{ key: string; className: string; displayQuantity: bigint; title: string; asset: UiAsset }> = [];
    if (segment.baseAskQuantity > 0n) {
      out.push({
        key: `fill-${segment.utxoRef}`,
        className: `route-segment route-${segment.severity}`,
        displayQuantity: segment.baseAskQuantity,
        title: `${fromBase(segment.baseAskQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} -> ${fromBase(segment.baseOfferQuantity, receiveAsset.decimals)} ${assetTitle(receiveAsset)}. ${formatBps(segment.cumulativeSlippageBps)} price movement.`,
        asset: segment.severity === 'danger' ? 'warning' : segment.severity === 'warning' ? 'scale' : 'ladle',
      });
    }
    if (segment.roundUpAskQuantity > 0n) {
      out.push({
        key: `round-${segment.utxoRef}`,
        className: `route-segment route-round route-round-${segment.severity}`,
        displayQuantity: segment.roundUpAskQuantity,
        title: `${fromBase(segment.roundUpAskQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} is included to keep the offer cleanly executable.`,
        asset: 'measure',
      });
    }
    if (segment.makerRemainderQuantity > 0n) {
      out.push({
        key: `remain-${segment.utxoRef}`,
        className: 'route-segment route-remainder',
        displayQuantity: segment.makerRemainderAskEquivalentQuantity,
        title: `${fromBase(segment.makerRemainderQuantity, receiveAsset.decimals)} ${assetTitle(receiveAsset)} stays available after this swap.`,
        asset: 'cloche',
      });
    }
    return out;
  }).filter((segment) => segment.displayQuantity > 0n);
  if (quote.unfilledRequestedQuantity > 0n) {
    const blockedAtBoundary = quote.remainderBlockedCount > 0;
    segments.push({
      key: blockedAtBoundary ? 'unrouted' : 'unfilled',
      className: blockedAtBoundary ? 'route-segment route-unrouted' : 'route-segment route-unfilled',
      displayQuantity: quote.unfilledRequestedQuantity,
      title: blockedAtBoundary
        ? `${fromBase(quote.unfilledRequestedQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} is not routed at this order boundary.`
        : `${fromBase(quote.unfilledRequestedQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} is above what is available right now.`,
      asset: blockedAtBoundary ? 'strainer' : 'warning',
    });
  }
  return (
    <div className="route-fill">
      <div className="route-fill-head">
        <span>
          Available now <HelpTooltip label="Availability help" asset="route">{HELP.route}</HelpTooltip>
        </span>
        <span>
          {quote.segments.length} offer{quote.segments.length === 1 ? '' : 's'} - {formatBps(quote.weightedSlippageBps)} impact
        </span>
      </div>
      <div className="route-track" aria-label="Swap route order fill plan">
        {segments.map((segment) => (
          <button
            type="button"
            key={segment.key}
            className={segment.className}
            style={{ flexBasis: `${Math.max(0.3, share(segment.displayQuantity))}%` }}
            aria-label={segment.title}
          >
            <span className="route-tooltip">
              <VisualAsset asset={segment.asset} className="ns-tooltip-art" />
              <span className="help-popover-content">{segment.title}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppToast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const icon =
    toast.tone === 'success'
      ? 'bi-check-lg'
      : toast.tone === 'danger'
        ? 'bi-x-lg'
        : toast.tone === 'warning'
          ? 'bi-exclamation-triangle'
          : 'bi-info-lg';
  return (
    <div className={`app-toast app-toast-${toast.tone}`} role="status" aria-live="polite">
      <VisualAsset
        asset={toast.tone === 'success' ? 'success' : toast.tone === 'danger' ? 'danger' : toast.tone === 'warning' ? 'warning' : 'infoToast'}
        className="toast-helper-art"
      />
      <div className="toast-icon">
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <b>{toast.title}</b>
        <p>{toast.message}</p>
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onClose}>
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    </div>
  );
}

function ActionButtonSuffix({ cartMode, icon }: { cartMode: boolean; icon: string }) {
  return cartMode ? (
    <span className="cart-action-suffix" aria-hidden="true">
      <i className="bi bi-plus-lg" />
      <i className="bi bi-cart3" />
    </span>
  ) : (
    <i className={`bi ${icon}`} aria-hidden="true" />
  );
}

function Sidebar({ hideBrand = false }: { hideBrand?: boolean; incognito?: boolean }) {
  const items: Array<[ViewId, string, string, boolean?]> = [
    ['swap', 'bi-arrow-left-right', 'Swap'],
    ['open', 'bi-plus-circle', 'Offer'],
    ['markets', 'bi-graph-up-arrow', 'Markets'],
    ['orders', 'bi-clipboard-check', 'My Orders'],
    ['portfolio', 'bi-person', 'Portfolio'],
    ['history', 'bi-clock-history', 'History'],
    ['options', 'bi-sliders', 'Options', true],
  ];
  return (
    <aside className="sidebar">
      {hideBrand ? null : (
        <div className="brand">
          <img src={textLogoUrl} alt="NeonSoup" />
        </div>
      )}
      <nav className="nav-card" aria-label="Main navigation">
        {items.map(([id, icon, label, hidden]) => (
          <NavLink key={id} className={({ isActive }) => `${isActive ? 'active' : ''} ${hidden ? 'hidden-nav-item' : ''}`} to={`/${id}`}>
            <i className={`bi ${icon}`} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <section className="kernel-card">
        <img src={logoUrl} alt="" />
        <div>
          Powered by
          <br />
          Cardano P2P
          <br />
          DeFi Kernel
        </div>
      </section>
    </aside>
  );
}

function Topbar({
  cartCount,
  wallet,
  theme,
  onTheme,
  onCart,
  onConnect,
  onDisconnect,
  onOptions,
  onMenu,
}: {
  cartCount: number;
  wallet: WalletConnection | null;
  theme: 'dark' | 'light';
  onTheme: () => void;
  onCart: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOptions: () => void;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn hamburger" aria-label="Open menu" onClick={onMenu}>
        <i className="bi bi-list" aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" aria-label={`Cart with ${cartCount} queued operations`} onClick={onCart}>
        <i className="bi bi-cart3" aria-hidden="true" />
        {cartCount ? <span className="cart-badge">{cartCount}</span> : null}
      </button>
      <button type="button" className="icon-btn" aria-label="Toggle theme" onClick={onTheme}>
        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} aria-hidden="true" />
      </button>
      {wallet ? (
        <div className="wallet-group" aria-label="Connected wallet">
          <span className="wallet-help-wrap wallet-widget-wrap">
            <button type="button" className="wallet-btn wallet-connected" onClick={() => void navigator.clipboard?.writeText(wallet.address)}>
              <i className="bi bi-wallet2" aria-hidden="true" />
              <span className="wallet-text">
                <span className="wallet-name">{wallet.name || 'Connected wallet'}</span>
                <span className="wallet-address">{short(wallet.address, 16, 8)}</span>
              </span>
              {wallet.walletType ? <span className="wallet-type">{wallet.walletType}</span> : null}
            </button>
            <HelpTooltip label="Wallet widget help">Shows the connected wallet. Click it to copy the wallet address.</HelpTooltip>
          </span>
          <span className="wallet-help-wrap wallet-disconnect-wrap">
            <button type="button" className="wallet-disconnect" aria-label="Disconnect wallet" onClick={onDisconnect}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
            <HelpTooltip label="Disconnect wallet help">Disconnect clears the local wallet connection from NeonSoup. It does not change the wallet itself.</HelpTooltip>
          </span>
        </div>
      ) : (
        <span className="wallet-help-wrap wallet-connect-wrap">
          <button type="button" className="wallet-btn wallet-connect" onClick={onConnect}>
            <i className="bi bi-incognito" aria-hidden="true" /> Connect Wallet
          </button>
          <HelpTooltip label="Connect wallet help">
            Connect through GameChanger Wallet for balances and history; it supports CIP-30 browser extension wallets, hardware wallets, seed phrase wallets, QR wallets, and burner wallets.
            <br/><br/>  
            <strong>You are currently in Incognito Mode:</strong> you can trade without exposing your address to NeonSoup. 
          </HelpTooltip>
        </span>
      )}
      <button type="button" className="icon-btn more-btn" aria-label="Open Options" onClick={onOptions}>
        <i className="bi bi-three-dots" aria-hidden="true" />
      </button>
    </header>
  );
}

function SwapScreen({
  state,
  quote,
  assets,
  offerAsset,
  receiveAsset,
  cartMode,
  onSwap,
  onFlip,
  onRefresh,
  refreshing,
}: {
  state: AppState;
  quote: SwapQuote;
  assets: Record<string, ResolvedAsset>;
  offerAsset: ResolvedAsset;
  receiveAsset: ResolvedAsset | undefined;
  cartMode: boolean;
  onSwap: () => void;
  onFlip: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const dispatch = useAppDispatch();
  const [flipRotation, setFlipRotation] = useState(0);
  const payValue = state.forms.swapOfferAmount;
  const requestedQuantity = formQuantity(payValue, offerAsset);
  const hasPair = Boolean(receiveAsset && receiveAsset.assetKey !== offerAsset.assetKey);
  const output = receiveAsset && hasPair ? fromBase(quotePreviewOutput(quote), receiveAsset.decimals) : '0';
  const balance = balanceOf(state, offerAsset.policyId, offerAsset.assetNameHex);
  const balancePercent = percent(quote.requestedInputQuantity, balance);
  const executionQuantity = quote.executionInputQuantity;
  const hasExecutableRoute = quoteHasExecutableRoute(quote);
  const hasTrueLiquidityShortage = quoteHasTrueLiquidityShortage(quote);
  const incognito = !state.wallet;
  const slippageTolerancePercent = state.options.swapSlippageTolerancePercent;
  const slippageToleranceBps = percentToBps(slippageTolerancePercent, APP_CONFIG.defaults.quote.slippageTolerancePercentFallback);
  const maxSlippageTolerancePercent = APP_CONFIG.defaults.quote.maxSlippageTolerancePercent;
  const slippageDangerProblems = [
    ...(slippageTolerancePercent <= 0 ? ['Set a slippage tolerance greater than 0% before swapping.'] : []),
    ...(slippageTolerancePercent >= maxSlippageTolerancePercent
      ? [`Slippage tolerance must stay below ${maxSlippageTolerancePercent}%.`]
      : []),
    ...(hasPair && requestedQuantity > 0n && quote.outputQuantity > 0n && quote.weightedSlippageBps >= slippageToleranceBps
      ? ['Price impact is above your slippage tolerance. Increase tolerance or choose a smaller swap.']
      : []),
  ];
  const swapProblems = [
    ...(!receiveAsset ? ['Select the asset you want to receive before swapping.'] : []),
    ...(receiveAsset && receiveAsset.assetKey === offerAsset.assetKey ? ['Select a different asset to receive before swapping.'] : []),
    ...(requestedQuantity <= 0n ? ['Enter an amount greater than zero.'] : []),
    ...(state.wallet && executionQuantity > balance
      ? [`Your balance is ${fromBase(balance, offerAsset.decimals)} ${assetTitle(offerAsset)}, which is not enough for this swap.`]
      : []),
    ...(hasPair && requestedQuantity > 0n && hasTrueLiquidityShortage
      ? ['Not enough available liquidity for this swap right now.']
      : []),
    ...(receiveAsset && hasPair && requestedQuantity > 0n && !hasExecutableRoute
      ? [`No available offers can sell ${assetTitle(receiveAsset)} for ${assetTitle(offerAsset)} right now.`]
      : []),
  ];
  const swapDisabled = slippageDangerProblems.length > 0 || swapProblems.length > 0;
  const severity: SwapQuoteSeverity = severityForSlippage(
    quote.weightedSlippageBps,
    slippageToleranceBps,
    APP_CONFIG.defaults.quote.warningSlippageMultiplier,
  );
  return (
    <section className="panel-card swap-panel">
      <div className="panel-head">
        <h1>
          Swap <HelpTooltip label="Swap page help">{HELP.swapPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={refreshing} onClick={onRefresh} />
      </div>

      <div className="swap-hero">
        <AssetPairStack offerAsset={offerAsset} askAsset={receiveAsset} />
        <div>
          <b>
            Swap {assetTitle(offerAsset)} for {receiveAsset ? assetTitle(receiveAsset) : 'Select asset'}
          </b>
          <small>
            NeonSoup routes across live offers so the swap stays simple while the order book stays under the hood.
            <HelpTooltip label="Swap route help">{HELP.swapPage}</HelpTooltip>
          </small>
        </div>
      </div>

      <div className="token-box">
        <div>
          <label className="token-label" htmlFor="swap-pay-amount">
            You pay <HelpTooltip label="You pay help">{HELP.swapPay}</HelpTooltip>
          </label>
          <AssetPicker
            assets={assets}
            value={state.forms.openOfferAssetKey}
            exclude={state.forms.openAskAssetKey}
            onChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openOfferAssetKey: assetKey } })}
          />
        </div>
        <div className="token-amount">
          <input
            id="swap-pay-amount"
            className="amount-input"
            type="number"
            min="0"
            step={APP_CONFIG.defaults.forms.amountStep}
            inputMode="decimal"
            value={payValue}
            onChange={(event) => dispatch({ type: 'set-forms', forms: { swapOfferAmount: event.target.value } })}
          />
          <AmountShortcuts
            balance={balance}
            asset={offerAsset}
            onSet={(value) => dispatch({ type: 'set-forms', forms: { swapOfferAmount: value } })}
          />
        </div>
      </div>

      <button
        type="button"
        className="switch-btn"
        aria-label="Flip swap assets"
        onClick={() => {
          setFlipRotation((rotation) => rotation + 180);
          onFlip();
        }}
      >
        <i className="bi bi-arrow-down-up" style={{ transform: `rotate(${flipRotation}deg)` }} aria-hidden="true" />
      </button>

      <div className="token-box">
        <div>
          <div className="token-label">
            You receive <HelpTooltip label="You receive help">{HELP.swapReceive}</HelpTooltip>
          </div>
          <AssetPicker
            assets={assets}
            value={state.forms.openAskAssetKey}
            exclude={state.forms.openOfferAssetKey}
            onChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openAskAssetKey: assetKey } })}
          />
        </div>
        <div className="token-amount">
          <strong>{output}</strong>
          <small>
            {receiveAsset
              ? `Est. final price ${priceText(quote.effectivePrice || quote.marginalPrice || quote.executableBestPrice, offerAsset, receiveAsset)} ${assetTitle(offerAsset)} / ${assetTitle(receiveAsset)}`
              : 'Select a receive asset'}
          </small>
        </div>
      </div>

      {receiveAsset && hasPair ? <CompactRouteBar quote={quote} offerAsset={offerAsset} receiveAsset={receiveAsset} /> : null}

      <PageAlert
        alerts={[
          incognito && { tone: 'info', message: `${INCOGNITO_NOTICE} Connect a wallet if you want balances to be shown.` },
          slippageDangerProblems.length ? { tone: 'danger', message: slippageDangerProblems[0] ?? '' } : null,
          swapProblems.length ? { tone: 'warning', message: swapProblems[0] ?? '' } : null,
        ]}
      />

      <button type="button" className="cta" onClick={onSwap} disabled={swapDisabled}>
        Swap <ActionButtonSuffix cartMode={cartMode} icon="bi-arrow-right" />
      </button>

      <div className="stats">
        <div>
          Best executable price <HelpTooltip label="Best executable price help">{HELP.bestExecutablePrice}</HelpTooltip>
          <strong>
            {receiveAsset && hasPair ? `${priceText(quote.executableBestPrice, offerAsset, receiveAsset)} ${assetTitle(offerAsset)}` : '-'}
          </strong>
        </div>
        <div>
          Price impact <HelpTooltip label="Price impact help">{HELP.priceImpact}</HelpTooltip>
          <strong className={`severity-${severity}`}>{formatBps(quote.weightedSlippageBps)}</strong>
        </div>
        <div>
          Balance used <HelpTooltip label="Balance used help">{HELP.balanceUsed}</HelpTooltip>
          <strong>{incognito ? 'Incognito' : balance ? `${balancePercent}%` : '0%'}</strong>
        </div>
        <div>
          Service fee <HelpTooltip label="Service fee help">{HELP.serviceFee}</HelpTooltip>
          <strong>{serviceFeeText(state)}</strong>
        </div>
      </div>
    </section>
  );
}

function OpenScreen({
  state,
  assets,
  offerAsset,
  askAsset,
  cartMode,
  onOpen,
  onRefresh,
  refreshing,
}: {
  state: AppState;
  assets: Record<string, ResolvedAsset>;
  offerAsset: ResolvedAsset;
  askAsset: ResolvedAsset | undefined;
  cartMode: boolean;
  onOpen: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const dispatch = useAppDispatch();
  const [flipRotation, setFlipRotation] = useState(0);
  const offerBalance = balanceOf(state, offerAsset.policyId, offerAsset.assetNameHex);
  const offerQuantity = formQuantity(state.forms.openOfferAmount, offerAsset);
  const askQuantity = askAsset ? formQuantity(state.forms.openAskAmount, askAsset) : 0n;
  const priceValue = askAsset ? openPriceText(offerQuantity, askQuantity, offerAsset, askAsset) : '-';
  const incognito = !state.wallet;
  const openProblems = [
    ...(!askAsset ? ['Select the asset you want to receive before opening an offer.'] : []),
    ...(askAsset && offerAsset.assetKey === askAsset.assetKey ? ['Select a different asset to receive before opening an offer.'] : []),
    ...(offerQuantity <= 0n ? ['Enter the amount you want to offer.'] : []),
    ...(askQuantity <= 0n ? ['Enter the amount you want to receive.'] : []),
    ...(state.wallet && offerQuantity > offerBalance
      ? [`Your balance is ${fromBase(offerBalance, offerAsset.decimals)} ${assetTitle(offerAsset)}, which is not enough for this offer.`]
      : []),
  ];
  const disabled = openProblems.length > 0;
  return (
    <section className="panel-card open-panel">
      <div className="panel-head">
        <h1>
          Open Offer <HelpTooltip label="Open offer page help">{HELP.openPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={refreshing} disabled={!state.wallet} onClick={onRefresh} />
      </div>

      <div className="open-hero">
        <AssetPairStack offerAsset={offerAsset} askAsset={askAsset} />
        <div>
          <b>
            Offer {assetTitle(offerAsset)} for {askAsset ? assetTitle(askAsset) : 'Select asset'}
          </b>
          <small>
            Create a one-way Cardano-Swaps offer. Other users can fill it partially or fully while your price stays fixed.
            <HelpTooltip label="Open offer help">
              Opening an offer locks the asset you offer at your personal P2P DeFi Kernel address. Fillers pay the requested asset according to your limit price.
              {incognito ? ' In Incognito Mode, set amounts carefully because NeonSoup cannot read your balance.' : ''}
            </HelpTooltip>
          </small>
        </div>
      </div>

      <div className="open-grid">
        <div className="offer-box">
          <label className="token-label" htmlFor="open-offer-amount">
            Your offer <HelpTooltip label="Your offer help">{HELP.openOfferAsset}</HelpTooltip>
          </label>
          <AssetPicker
            assets={assets}
            value={state.forms.openOfferAssetKey}
            exclude={state.forms.openAskAssetKey}
            onChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openOfferAssetKey: assetKey } })}
          />
          <input
            id="open-offer-amount"
            className="amount-input open-amount"
            type="number"
            min="0"
            step={APP_CONFIG.defaults.forms.amountStep}
            inputMode="decimal"
            value={state.forms.openOfferAmount}
            onChange={(event) => dispatch({ type: 'set-forms', forms: { openOfferAmount: event.target.value } })}
          />
          <AmountShortcuts
            balance={offerBalance}
            asset={offerAsset}
            onSet={(value) => dispatch({ type: 'set-forms', forms: { openOfferAmount: value } })}
          />
        </div>
        <button
          type="button"
          className="switch-btn open-switch-btn"
          aria-label="Flip offer and request assets"
          onClick={() => {
            setFlipRotation((rotation) => rotation + 180);
            dispatch({
              type: 'set-forms',
              forms: {
                openOfferAssetKey: state.forms.openAskAssetKey,
                openAskAssetKey: state.forms.openOfferAssetKey,
                openOfferAmount: state.forms.openAskAmount,
                openAskAmount: state.forms.openOfferAmount,
              },
            });
          }}
        >
          <i className="bi bi-arrow-left-right" style={{ transform: `rotate(${flipRotation}deg)` }} aria-hidden="true" />
        </button>
        <div className="offer-box request-box">
          <label className="token-label" htmlFor="open-ask-amount">
            Your request <HelpTooltip label="Your request help">{HELP.openRequestAsset}</HelpTooltip>
          </label>
          <AssetPicker
            assets={assets}
            value={state.forms.openAskAssetKey}
            exclude={state.forms.openOfferAssetKey}
            onChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openAskAssetKey: assetKey } })}
          />
          <input
            id="open-ask-amount"
            className="amount-input open-amount"
            type="number"
            min="0"
            step={APP_CONFIG.defaults.forms.amountStep}
            inputMode="decimal"
            value={state.forms.openAskAmount}
            onChange={(event) => dispatch({ type: 'set-forms', forms: { openAskAmount: event.target.value } })}
            disabled={!askAsset}
          />
          <small>Requested asset received as the offer is filled.</small>
        </div>
      </div>

      <div className="open-summary">
        <label htmlFor="open-price">
          Limit price <HelpTooltip label="Limit price help">{HELP.limitPrice}</HelpTooltip>
        </label>
        <div className="price-input-wrap">
          <input
            id="open-price"
            className="price-input"
            type="number"
            min="0"
            step="0.000001"
            inputMode="decimal"
            value={priceValue === '-' ? '' : priceValue}
            disabled={!askAsset}
            onChange={(event) => {
              if (!askAsset) return;
              const nextAsk = askQuantityFromPrice(offerQuantity, event.target.value, offerAsset, askAsset);
              dispatch({ type: 'set-forms', forms: { openAskAmount: nextAsk > 0n ? fromBase(nextAsk, askAsset.decimals) : '' } });
            }}
          />
          <span>
            {askAsset ? assetTitle(askAsset) : 'Select asset'} / {assetTitle(offerAsset)}
          </span>
        </div>
      </div>

      <PageAlert
        alerts={[
          incognito && { tone: 'info', message: `${INCOGNITO_NOTICE} Connect a wallet to show balances before opening an offer.` },
          openProblems.length ? { tone: 'warning', message: openProblems[0] ?? '' } : null,
        ]}
      />

      <button type="button" className="cta open-cta" onClick={onOpen} disabled={disabled}>
        Open Offer <ActionButtonSuffix cartMode={cartMode} icon="bi-plus-circle" />
      </button>
    </section>
  );
}

function MarketsScreen({
  state,
  assets,
  onSelect,
  onOffer,
  onRefresh,
  refreshing,
}: {
  state: AppState;
  assets: Record<string, ResolvedAsset>;
  onSelect: (payKey: string, receiveKey: string) => void;
  onOffer: (offerKey: string, askKey: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const excludedUtxoRefs = bookedSourceRefs(state.cart);
  const registeredAssets = configuredAssets(state.options.network, state.customAssets);
  const marketPairs = new Map<string, { offerAsset: ResolvedAsset; receiveAsset: ResolvedAsset }>();
  const registeredAsset = (asset: ResolvedAsset): ResolvedAsset => {
    const resolved = assets[asset.assetKey];
    if (!resolved) return asset;
    const merged = { ...asset, ...resolved };
    return asset.tag && !merged.tag ? { ...merged, tag: asset.tag } : merged;
  };
  const isMarketQuoteAsset = (asset: ResolvedAsset): boolean => MARKET_QUOTE_ASSET_TAGS.has(asset.tag);
  const addMarketPair = (offerAsset: ResolvedAsset | undefined, receiveAsset: ResolvedAsset | undefined) => {
    if (!offerAsset?.known || !receiveAsset?.known || offerAsset.assetKey === receiveAsset.assetKey) return;
    if (!isMarketQuoteAsset(offerAsset)) return;
    marketPairs.set(`${offerAsset.assetKey}->${receiveAsset.assetKey}`, { offerAsset, receiveAsset });
  };
  const registeredValues = Object.values(registeredAssets).filter((asset) => asset.known);
  const quoteAssets = registeredValues.filter(isMarketQuoteAsset);
  quoteAssets.forEach((offerAsset) => {
    registeredValues.forEach((receiveAsset) => addMarketPair(registeredAsset(offerAsset), registeredAsset(receiveAsset)));
  });
  state.openOffers.forEach((offer) => {
    const offerAsset = assets[assetKeyOf(offer.askPolicyId, offer.askAssetName)];
    const receiveAsset = assets[assetKeyOf(offer.offerPolicyId, offer.offerAssetName)];
    if (offerAsset && receiveAsset && registeredAssets[offerAsset.assetKey] && registeredAssets[receiveAsset.assetKey]) {
      addMarketPair(offerAsset, receiveAsset);
    }
  });
  const rows = [...marketPairs.values()]
    .map(({ offerAsset, receiveAsset }) => {
      const receiveBalance = balanceOf(state, receiveAsset.policyId, receiveAsset.assetNameHex);
      const offerBalance = balanceOf(state, offerAsset.policyId, offerAsset.assetNameHex);
      const hasReceiveBalance = receiveBalance > 0n;
      const hasOfferBalance = offerBalance > 0n;
      const openOfferAsset = !state.wallet || hasReceiveBalance ? receiveAsset : hasOfferBalance ? offerAsset : undefined;
      const openAskAsset = openOfferAsset?.assetKey === receiveAsset.assetKey ? offerAsset : receiveAsset;
      const swapPayAsset = !state.wallet || hasOfferBalance ? offerAsset : hasReceiveBalance ? receiveAsset : undefined;
      const swapReceiveAsset = swapPayAsset?.assetKey === offerAsset.assetKey ? receiveAsset : offerAsset;
      const balance = receiveBalance > offerBalance ? receiveBalance : offerBalance;
      const hasBalance = hasReceiveBalance || hasOfferBalance;
      const quote = quoteSwap({
        offers: state.openOffers,
        offerAsset,
        receiveAsset,
        offerAmount: '1',
        payUp: state.forms.swapPayUp,
        excludedUtxoRefs,
        slippageToleranceBps: percentToBps(
          state.options.swapSlippageTolerancePercent,
          APP_CONFIG.defaults.quote.slippageTolerancePercentFallback,
        ),
        warningSlippageMultiplier: APP_CONFIG.defaults.quote.warningSlippageMultiplier,
        payUpBps: percentToBps(state.options.swapPayUpPercent, APP_CONFIG.defaults.quote.payUpPercentFallback),
      });
      return { receiveAsset, offerAsset, quote, balance, hasBalance, openOfferAsset, openAskAsset, swapPayAsset, swapReceiveAsset };
    })
    .sort((left, right) => {
      if (left.hasBalance !== right.hasBalance) return left.hasBalance ? -1 : 1;
      if (left.quote.rawCandidateCount !== right.quote.rawCandidateCount) {
        return right.quote.rawCandidateCount - left.quote.rawCandidateCount;
      }
      if (left.quote.pairMatchCount !== right.quote.pairMatchCount) {
        return right.quote.pairMatchCount - left.quote.pairMatchCount;
      }
      const byBalance = compareQuantityDesc(left.balance, right.balance);
      if (byBalance) return byBalance;
      return assetTitle(left.receiveAsset).localeCompare(assetTitle(right.receiveAsset));
    });
  return (
    <section className="panel-card">
      <div className="panel-head">
        <h1>
          Markets <HelpTooltip label="Markets page help">{HELP.marketsPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={refreshing} onClick={onRefresh} />
      </div>
      <ScrollFade
        header={
          <div className="table-list dex-table markets-table">
            <div className="market-row table-head" role="row">
              <span>Pair</span>
              <span>Best price</span>
              <span>Open offers</span>
              <span>Actions</span>
            </div>
          </div>
        }
      >
        <div className="table-list dex-table markets-table">
          {rows.map(({ receiveAsset, offerAsset, quote, openOfferAsset, openAskAsset, swapPayAsset, swapReceiveAsset }) => (
            <div className="market-row" key={`${offerAsset.assetKey}->${receiveAsset.assetKey}`}>
              <div className="pair-cell">
                <AssetPairStack offerAsset={receiveAsset} askAsset={offerAsset} />
                <span>
                  {assetTitle(receiveAsset)} / {offerAsset ? assetTitle(offerAsset) : '-'}
                </span>
              </div>
              <span className="mono">{priceText(quote.executableBestPrice, offerAsset, receiveAsset)}</span>
              <span>
                {quote.pairMatchCount} orders
                {quote.rawCandidateCount !== quote.pairMatchCount ? ` / ${quote.rawCandidateCount} executable` : ''}
              </span>
              <span className="row-actions">
                {openOfferAsset ? (
                  <button type="button" className="mini-btn" onClick={() => onOffer(openOfferAsset.assetKey, openAskAsset.assetKey)}>
                    <i className="bi bi-plus-circle" aria-hidden="true" /> Offer
                  </button>
                ) : (
                  <span className="action-placeholder" aria-hidden="true" />
                )}
                {swapPayAsset ? (
                  <button type="button" className="mini-btn" onClick={() => onSelect(swapPayAsset.assetKey, swapReceiveAsset.assetKey)}>
                    <i className="bi bi-arrow-left-right" aria-hidden="true" /> Swap
                  </button>
                ) : (
                  <span className="action-placeholder" aria-hidden="true" />
                )}
              </span>
            </div>
          ))}
        </div>
      </ScrollFade>
    </section>
  );
}

function OrdersScreen({
  state,
  cartMode,
  onCloseOrder,
  onRefresh,
  refreshing,
}: {
  state: AppState;
  cartMode: boolean;
  onCloseOrder: (offer: OpenOffer) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const owned = state.openOffers
    .filter((offer) => isCurrentOutputOwner(offer, state.wallet?.stakeKeyHash))
    .sort((left, right) => {
      const byFilled = compareQuantityDesc(BigInt(left.utxoAskQuantity || '0'), BigInt(right.utxoAskQuantity || '0'));
      return byFilled || compareQuantityDesc(BigInt(left.utxoOfferQuantity || '0'), BigInt(right.utxoOfferQuantity || '0'));
    });
  return (
    <section className="panel-card">
      <div className="panel-head">
        <h1>
          My Orders <HelpTooltip label="My orders page help">{HELP.ordersPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={refreshing} onClick={onRefresh} />
      </div>
      <PageAlert alerts={[!state.wallet && { tone: 'info', message: `${INCOGNITO_NOTICE} Connect a wallet to show owned orders.` }]} />
      {state.wallet && !owned.length ? <EmptyState asset="open">No open NeonSoup orders found for this wallet.</EmptyState> : null}
      <ScrollFade>
        <div className="grid2 orders-grid">
          {owned.map((offer) => {
            const offered = resolveAsset(state, offer.offerPolicyId, offer.offerAssetName);
            const asked = resolveAsset(state, offer.askPolicyId, offer.askAssetName);
            const hasAccumulatedAsk = BigInt(offer.utxoAskQuantity || '0') > 0n;
            const remaining = BigInt(offer.utxoOfferQuantity || '0');
            const accumulated = BigInt(offer.utxoAskQuantity || '0');
            const filledOffer = filledOfferEquivalent(offer);
            const totalOffer = remaining + filledOffer;
            const filledPct =
              totalOffer > 0n ? Number((filledOffer * 10_000n) / totalOffer) / 100 : 0;
            const progressLabel = `${filledPct.toFixed(filledPct % 1 === 0 ? 0 : 2)}% filled: ${fromBase(filledOffer, offered.decimals)} ${assetTitle(offered)} of ${fromBase(totalOffer, offered.decimals)} ${assetTitle(offered)}. Received ${fromBase(accumulated, asked.decimals)} ${assetTitle(asked)} so far.`;
            return (
              <article className="order-card" key={offer.id}>
                <div className="order-head">
                  <span className="pair-cell">
                    <AssetPairStack offerAsset={offered} askAsset={asked} />
                    <b>
                      {assetTitle(offered)} / {assetTitle(asked)}
                    </b>
                  </span>
                  <span className="pill">{offer.orderKind}</span>
                </div>
                <div className="order-fill-card">
                  <span>
                    Filled / Total <HelpTooltip label="Order progress help">Filled is estimated from the requested asset accumulated in the order and the order limit price.</HelpTooltip>
                  </span>
                  <strong>
                    {fromBase(filledOffer, offered.decimals)} / {fromBase(totalOffer, offered.decimals)} {assetTitle(offered)}
                  </strong>
                  <small>
                    Received {fromBase(accumulated, asked.decimals)} {assetTitle(asked)} so far
                  </small>
                  <div className="bar order-progress" tabIndex={0} aria-label={progressLabel}>
                    <i style={{ width: `${Math.min(100, Math.max(0, filledPct))}%` }} />
                    <span className="route-tooltip">{progressLabel}</span>
                  </div>
                </div>
                <div className="order-meta">
                  <span>
                    Limit price {orderLimitPriceText(offer, offered, asked)} {assetTitle(asked)} / {assetTitle(offered)}
                  </span>
                  <span>{hasAccumulatedAsk ? 'Partially filled' : 'Waiting for fills'}</span>
                </div>
                <button type="button" className="mini-btn" onClick={() => onCloseOrder(offer)}>
                  Close order <ActionButtonSuffix cartMode={cartMode} icon="bi-x-circle" />
                </button>
              </article>
            );
          })}
        </div>
      </ScrollFade>
    </section>
  );
}

function PortfolioScreen({
  state,
  onSwapAsset,
  onOfferAsset,
  onRefresh,
  refreshing,
}: {
  state: AppState;
  onSwapAsset: (assetKey: string) => void;
  onOfferAsset: (assetKey: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const portfolio = [...visiblePortfolio(state)].sort((left, right) => {
    const byQuantity = compareQuantityDesc(BigInt(left.quantity || '0'), BigInt(right.quantity || '0'));
    return byQuantity || assetTitle(left).localeCompare(assetTitle(right));
  });
  return (
    <section className="panel-card">
      <div className="panel-head">
        <h1>
          Portfolio <HelpTooltip label="Portfolio page help">{HELP.portfolioPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={refreshing} disabled={!state.wallet} onClick={onRefresh} />
      </div>
      <PageAlert alerts={[!state.wallet && { tone: 'info', message: `${INCOGNITO_NOTICE} Connect a wallet to load balances and operation history.` }]} />
      <ScrollFade
        header={
          <div className="table-list dex-table portfolio-table">
            <div className="market-row table-head" role="row">
              <span>Asset</span>
              <span>Balance</span>
              <span>Actions</span>
            </div>
          </div>
        }
      >
        <div className="table-list dex-table portfolio-table">
          {portfolio.map((asset) => (
            <div className="market-row" key={asset.assetKey}>
              <div className="pair-cell">
                <AssetIcon asset={asset} />
                <span>{assetTitle(asset)}</span>
                {!asset.known ? <span className="asset-unknown">Unknown</span> : null}
              </div>
              <span className="mono">{fromBase(asset.quantity || '0', asset.decimals)}</span>
              <span className="row-actions">
                {BigInt(asset.quantity || '0') > 0n ? (
                  <button type="button" className="mini-btn" onClick={() => onOfferAsset(asset.assetKey)}>
                    <i className="bi bi-plus-circle" aria-hidden="true" /> Offer
                  </button>
                ) : null}
                <button type="button" className="mini-btn" onClick={() => onSwapAsset(asset.assetKey)}>
                  <i className="bi bi-arrow-left-right" aria-hidden="true" /> Swap
                </button>
              </span>
            </div>
          ))}
        </div>
      </ScrollFade>
    </section>
  );
}

function HistoryScreen({
  state,
  loading,
  onRefresh,
  notice,
}: {
  state: AppState;
  loading: boolean;
  onRefresh: () => void;
  notice: string;
}) {
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);
  const rows = composeTransactionRows(state.transactions, state.wallet?.stakeKeyHash).slice(0, state.options.historyFetchLimit);
  return (
    <section className="panel-card">
      <div className="panel-head">
        <h1>
          History <HelpTooltip label="History page help">{HELP.historyPage}</HelpTooltip>
        </h1>
        <RefreshButton loading={loading} disabled={!state.wallet} onClick={onRefresh} />
      </div>
      <PageAlert
        alerts={[
          notice ? { tone: 'info', message: notice } : null,
          !state.wallet && { tone: 'info', message: `${INCOGNITO_NOTICE} Connect a wallet to show your order history.` },
        ]}
      />
      <ScrollFade
        header={
          <div className="table-list dex-table history-table">
            <div className="market-row table-head" role="row">
              <span>Status</span>
              <span>Actions</span>
              <span>Created at</span>
              <span>Transaction</span>
              <span>Open</span>
            </div>
          </div>
        }
      >
        <div className="table-list dex-table history-table">
          {rows.map((tx) => (
            <div className={`market-row tx-row tx-${tx.status}`} key={tx.id}>
              <span className={`tx-status tx-status-${tx.status}`}>{tx.status}</span>
              <span>{tx.summary}</span>
              <span>{formatDateTime(tx.at)}</span>
              <span className="mono inline-copy">
                {tx.txHash ? shortHash(tx.txHash) : 'Pending'}
                <CopyIcon value={tx.txHash} label="Copy transaction hash" />
              </span>
              <span className="row-actions">
                <button type="button" className="mini-btn" onClick={() => setSelectedTx(tx)}>
                  <i className="bi bi-eye" aria-hidden="true" /> View
                </button>
                {tx.txHash ? (
                  <button type="button" className="mini-btn" onClick={() => openExternalUrl(txExplorerUrl(state, tx.txHash))}>
                  <i className="bi bi-link-45deg" aria-hidden="true" /> Explorer
                </button>
              ) : null}
            </span>
          </div>
        ))}
        </div>
      </ScrollFade>
      {!rows.length ? <EmptyState asset="history">No order transactions found yet.</EmptyState> : null}
      {selectedTx ? <TransactionDetailsModal state={state} tx={selectedTx} onClose={() => setSelectedTx(null)} /> : null}
    </section>
  );
}

function TransactionDetailsModal({ state, tx, onClose }: { state: AppState; tx: TransactionRow; onClose: () => void }) {
  const details = tx.details || [];
  return (
    <AppModal title="Transaction details" onClose={onClose} asset="history">
      <div className="tx-detail-head">
        <span className={`tx-status tx-status-${tx.status}`}>{tx.status}</span>
        <span>{formatDateTime(tx.at)}</span>
        <span className="mono inline-copy">
          {tx.txHash ? shortHash(tx.txHash) : 'Pending'}
          <CopyIcon value={tx.txHash} label="Copy transaction hash" />
        </span>
      </div>
      <p className="detail-note">Recognized order activity in this transaction.</p>
      <div className="detail-grid tx-summary-grid">
        <div>
          <span>Actions</span>
          <strong>{tx.summary}</strong>
        </div>
        <div>
          <span>Network fee</span>
          <strong>{tx.feeQuantity ? `${fromBase(tx.feeQuantity, 6)} tADA` : 'Fee unavailable'}</strong>
        </div>
      </div>
      {details.length ? (
        <ScrollFade className="tx-scroll-fade">
          <div className="tx-operation-list">
            {details.map((detail, index) => {
              const offerAsset = detailAsset(state, detail.offerPolicyId, detail.offerAssetNameHex);
              const askAsset = detailAsset(state, detail.askPolicyId, detail.askAssetNameHex);
              const labels = amountLabels(detail.action);
              const offerQuantity = BigInt(detail.offerQuantity || '0');
              const askQuantity = BigInt(detail.askQuantity || '0');
              return (
                <article className="tx-operation-card" key={`${detail.inputRef || ''}-${detail.outputRef || ''}-${index}`}>
                  <div className="order-head">
                    <div className="pair-cell">
                      <AssetPairStack offerAsset={offerAsset} askAsset={askAsset} />
                      <span>{actionTitle(detail.action)}</span>
                    </div>
                    <div className="tx-price">
                      <span>Price</span>
                      <strong>{detailPrice(detail, offerAsset, askAsset)}</strong>
                    </div>
                  </div>
                  <div className="detail-grid tx-amount-grid">
                    {offerQuantity > 0n ? (
                      <div className="tx-amount-card">
                        <span>{labels.offer}</span>
                        <strong>
                          {fromBase(offerQuantity, offerAsset.decimals)} {assetTitle(offerAsset)}
                        </strong>
                      </div>
                    ) : null}
                    {askQuantity > 0n ? (
                      <div className="tx-amount-card">
                        <span>{labels.ask}</span>
                        <strong>
                          {fromBase(askQuantity, askAsset.decimals)} {assetTitle(askAsset)}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                  <div className="tx-ref-row">
                    <div className="tx-ref-label">
                      <span>Input</span>
                      <strong className="mono inline-copy">
                        {detail.inputRef ? shortHash(detail.inputRef) : 'New output'}
                        <CopyIcon value={detail.inputRef || ''} label="Copy input reference" />
                      </strong>
                    </div>
                    <div className="tx-ref-label">
                      <span>Output</span>
                      <strong className="mono inline-copy">
                        {detail.outputRef ? shortHash(detail.outputRef) : 'Closed'}
                        <CopyIcon value={detail.outputRef || ''} label="Copy output reference" />
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </ScrollFade>
      ) : (
        <EmptyState asset="history">No recognizable order details were found for this transaction.</EmptyState>
      )}
    </AppModal>
  );
}

function OptionsScreen({
  state,
  cartMode,
  setCartMode,
  onNetworkChange,
  modal = false,
  hideTitle = false,
}: {
  state: AppState;
  cartMode: boolean;
  setCartMode: (value: boolean) => void;
  onNetworkChange: (network: NetworkTag) => void;
  modal?: boolean;
  hideTitle?: boolean;
}) {
  const dispatch = useAppDispatch();
  const [protocolInfoOpen, setProtocolInfoOpen] = useState(false);
  const optionProblems = [
    ...(state.options.swapPayUpPercent < 0 ? ['Pay-up premium cannot be negative.'] : []),
    ...(state.options.swapSlippageTolerancePercent <= 0 ? ['Slippage tolerance must be greater than 0%.'] : []),
    ...(state.options.swapSlippageTolerancePercent >= APP_CONFIG.defaults.quote.maxSlippageTolerancePercent
      ? [`Slippage tolerance must stay below ${APP_CONFIG.defaults.quote.maxSlippageTolerancePercent}%.`]
      : []),
  ];
  const parallelMode = state.cart.mode === 'parallel';
  const payUpEnabled = state.forms.swapPayUp;
  const incognito = !state.wallet;
  return (
    <section className={modal ? 'options-modal-content' : 'panel-card'}>
      {hideTitle ? null : (
        <div className="panel-head">
          <h1>
            Options <HelpTooltip label="Options page help">{HELP.optionsPage}</HelpTooltip>
          </h1>
          {/*<span className="tag">Execution</span>*/}
        </div>
      )}
      <PageAlert alerts={[optionProblems.length ? { tone: 'danger', message: optionProblems[0] ?? '' } : null]} />
      <ScrollFade>
        <div className="options-grid">
          <label className="option-line">
            <span>
              <b>Network</b> <HelpTooltip label="Network help">{HELP.network}</HelpTooltip>
              <small>Changing network disconnects the wallet and purges Cart, orders, balances, history, and endpoint overrides.</small>
            </span>
            <select
              className="option-input"
              value={state.options.network}
              onChange={(event) => onNetworkChange(event.target.value as NetworkTag)}
            >
              {state.options.availableNetworks.map((networkTag) => (
                <option value={networkTag} key={networkTag}>
                  {networkTag}
                </option>
              ))}
            </select>
          </label>
          <label className="option-line">
          <span>
            <b>Cart Mode</b>{' '}
            <HelpTooltip label="Cart Mode help">
              {HELP.cartMode}
              {incognito ? ` ${INCOGNITO_CART_NOTICE}` : ''}
            </HelpTooltip>
            <small>Queue operations and launch the wallet from Cart.</small>
          </span>
          <input type="checkbox" checked={cartMode} onChange={(event) => setCartMode(event.target.checked)} />
        </label>
        <label className="option-line">
          <span>
            <b>Best-effort parallel mode</b> <HelpTooltip label="Parallel mode help">{HELP.parallel}</HelpTooltip>
            <small>Use independent transactions so some action intents can still complete during offer contention.</small>
          </span>
          <input
            type="checkbox"
            checked={parallelMode}
            onChange={(event) => dispatch({ type: 'set-cart-mode', mode: event.target.checked ? 'parallel' : 'bundle' })}
          />
        </label>
        <label className={`option-line ${parallelMode ? 'option-line-muted' : ''}`}>
          <span>
            <b>Bundle size</b> <HelpTooltip label="Bundle size help">{HELP.bundleActions}</HelpTooltip>
            <small>Maximum action intents packed into one on-chain transaction in bundle mode.</small>
          </span>
          <span className="option-input-wrap">
            <input
              type="number"
              className="option-input"
              min="1"
              step="1"
              disabled={parallelMode}
              value={state.cart.maxIntentsPerTransaction}
              onChange={(event) =>
                dispatch({ type: 'set-cart-max-intents-per-transaction', value: Number(event.target.value) || 1 })
              }
            />
            <span className="option-input-suffix">actions</span>
          </span>
        </label>
        <label className="option-line">
          <span>
            <b>Pay up for lower contention</b> <HelpTooltip label="Pay-up help">{HELP.payUp}</HelpTooltip>
            <small>Let the local router choose slightly worse prices when that may avoid contested offers.</small>
          </span>
          <input
            type="checkbox"
            checked={state.forms.swapPayUp}
            onChange={(event) => dispatch({ type: 'set-forms', forms: { swapPayUp: event.target.checked } })}
          />
        </label>
        <label className={`option-line ${payUpEnabled ? '' : 'option-line-muted'}`}>
          <span>
            <b>Pay-up premium</b>
            <HelpTooltip label="Pay-up premium help">{HELP.payUpPremium}</HelpTooltip>
            <small>Maximum extra price accepted for lower-contention routing.</small>
          </span>
          <span className="option-input-wrap">
            <input
              type="number"
              className="option-input"
              min="0"
              step="0.1"
              disabled={!payUpEnabled}
              value={state.options.swapPayUpPercent}
              onChange={(event) =>
                dispatch({ type: 'set-options', options: { swapPayUpPercent: Math.max(0, Number(event.target.value) || 0) } })
              }
            />
            <span className="option-input-suffix">%</span>
          </span>
        </label>
        <label className="option-line">
          <span>
            <b>Slippage tolerance</b>
            <HelpTooltip label="Slippage tolerance help">{HELP.slippageTolerance}</HelpTooltip>
            <small>Maximum accepted order-book route price movement.</small>
          </span>
          <span className="option-input-wrap">
            <input
              type="number"
              className="option-input"
              min="0"
              max={APP_CONFIG.defaults.quote.maxSlippageTolerancePercent}
              step="0.1"
              value={state.options.swapSlippageTolerancePercent}
              onChange={(event) =>
                dispatch({
                  type: 'set-options',
                  options: { swapSlippageTolerancePercent: Math.max(0, Number(event.target.value) || 0) },
                })
              }
            />
            <span className="option-input-suffix">%</span>
          </span>
        </label>
        <label className="option-line">
          <span>
            <b>Provider</b> <HelpTooltip label="Provider help">{HELP.provider}</HelpTooltip>
            <small>Transport for chain data.</small>
          </span>
          <select
            className="option-input"
            value={state.options.provider}
            onChange={(event) =>
              dispatch({
                type: 'set-options',
                options: { provider: event.target.value === 'blockfrost' ? 'blockfrost' : 'graphqlMk2' },
              })
            }
          >
            <option value="graphqlMk2">GraphQL MKII</option>
            <option value="blockfrost">Blockfrost</option>
          </select>
        </label>
        <label className="option-line option-line-wide">
          <span>
            <b>API provider URL</b>
            <HelpTooltip label="Provider URL help">Overrides the endpoint used by the selected API provider. Empty keeps the configured default.</HelpTooltip>
            <small>Optional endpoint override. Empty uses default endpoint.</small>
          </span>
          <input
            type="url"
            className="option-input option-input-wide"
            placeholder="Use configured default"
            value={state.options.providerUrl}
            onChange={(event) => dispatch({ type: 'set-options', options: { providerUrl: event.target.value } })}
          />
          </label>
          <div className="option-line option-line-wide">
            <span>
              <b>Protocol Info</b>
              <small>Audit the configured P2P DeFi Kernel validator hashes.</small>
            </span>
            <button type="button" className="option-action-btn" onClick={() => setProtocolInfoOpen(true)}>
              Protocol Info
            </button>
          </div>
        </div>
      </ScrollFade>
      {protocolInfoOpen ? <ProtocolInfoModal state={state} onClose={() => setProtocolInfoOpen(false)} /> : null}
    </section>
  );
}

function AppModal({
  title,
  children,
  onClose,
  asset,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  asset?: UiAsset;
}) {
  return createPortal(
    <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" aria-modal="true" role="dialog" aria-labelledby="modal-title">
        {asset ? <VisualAsset asset={asset} className="modal-helper-art" /> : null}
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="modal-action-btn" onClick={onClose} aria-label={`Close ${title}`}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body-scroll">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function MainnetAlphaModal({ onAccept }: { onAccept: () => void }) {
  return createPortal(
    <div className="backdrop">
      <section className="modal-card graphic-text-modal alpha-disclaimer-modal" aria-modal="true" role="dialog" aria-labelledby="alpha-disclaimer-title">
        <img className="modal-top-art" src={GOGGLES_CLEANING_ASSET} alt="" aria-hidden="true" />
        <div className="modal-head">
          <h2 id="alpha-disclaimer-title">Public Alpha</h2>
        </div>
        <div className="modal-body-scroll modal-text-scroll">
          <p>{PUBLIC_ALPHA_COPY}</p>
        </div>
        <div className="modal-footer-actions">
          <button type="button" className="cta" onClick={onAccept}>
            I understand
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function collisionSourceRefs(items: readonly CartItem[]): Set<string> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const ref = sourceRef(item);
    if (ref) counts.set(ref, (counts.get(ref) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([ref]) => ref));
}

function CartModal({
  state,
  cartMode,
  incognito,
  onClose,
  onRun,
  onRemove,
  onSwitchCartMode,
}: {
  state: AppState;
  cartMode: boolean;
  incognito: boolean;
  onClose: () => void;
  onRun: () => void;
  onRemove: (itemId: string) => void;
  onSwitchCartMode: () => void;
}) {
  const items = visibleCartItems(state.cart);
  const collisionRefs = collisionSourceRefs(state.cart.items);
  return (
    <AppModal title="Operation Cart" onClose={onClose} asset="cart">
        {items.length ? (
          <>
            <ScrollFade>
              <div className="cart-list">
                {items.map((item) => {
                  const ref = sourceRef(item);
                  const hasCollision = Boolean(ref && collisionRefs.has(ref));
                  const { offerAsset, askAsset } = cartItemPairAssets(state, item);
                  return (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-main">
                        <AssetPairStack offerAsset={offerAsset} askAsset={askAsset} />
                        <div>
                          <div className="cart-item-title">
                            <b>{item.name === 'fill' ? 'Swap' : item.name}</b>
                            {hasCollision ? (
                              <span className="cart-collision-badge">
                                Collision
                                <HelpTooltip label="Cart collision help">
                                  {`Source UTxO ${short(ref)} appears in more than one Cart item. Remove one of the colliding items before running the Cart.`}
                                </HelpTooltip>
                              </span>
                            ) : null}
                          </div>
                          <small>{item.sourceLabel || item.id}</small>
                          {item.status !== 'draft' ? (
                            <small>
                              {item.status} <HelpTooltip label="Pending help">{HELP.pending}</HelpTooltip>
                            </small>
                          ) : null}
                        </div>
                      </div>
                      <button type="button" className="modal-action-btn danger-action" aria-label={`Remove ${item.id}`} onClick={() => onRemove(item.id)}>
                        <i className="bi bi-trash" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollFade>
            <div className="cart-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>
                <i className="bi bi-x-lg" aria-hidden="true" /> Close
              </button>
              <button type="button" className="primary-btn" onClick={onRun}>
                <i className="bi bi-play-fill" aria-hidden="true" /> Run {items.length}
              </button>
            </div>
          </>
        ) : (
          <div className="cart-empty-card ns-art-surface">
            <VisualAsset asset="cartMode" />
            <div>
              <h2>Your Cart is empty</h2>
              {cartMode ? (
                <p>{incognito ? INCOGNITO_CART_NOTICE : 'Queued operations will appear here before you run them.'}</p>
              ) : (
                <>
                  <p>
                    {HELP.cartMode}{' '}
                    <HelpTooltip label="Cart Mode help">
                      {HELP.cartMode}
                      {incognito ? ` ${INCOGNITO_CART_NOTICE}` : ''}
                    </HelpTooltip>
                  </p>
                  <p className="cart-empty-reminder">You can change this setting later from Options.</p>
                  <button type="button" className="primary-btn" onClick={onSwitchCartMode}>
                    <i className="bi bi-cart-plus" aria-hidden="true" /> Switch into Cart Mode
                  </button>
                </>
              )}
            </div>
          </div>
        )}
    </AppModal>
  );
}

function Drawer({ close, incognito }: { close: () => void; incognito: boolean }) {
  return (
    <div className="mobile-drawer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="drawer">
        <div className="drawer-head">
          <img src={textLogoUrl} alt="NeonSoup" />
          <button type="button" className="modal-action-btn" onClick={close} aria-label="Close menu">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div onClick={close}>
          <Sidebar hideBrand incognito={incognito} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [cartMode, setCartMode] = useState(() => {
    const stored = localStorage.getItem('neonsoup-frontend-cart-mode');
    return stored ? stored === 'on' : APP_CONFIG.defaults.frontendCartMode;
  });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNotice, setHistoryNotice] = useState('');
  const previousNetworkRef = useRef<NetworkTag>(state.options.network);
  const [mainnetAlphaPromptOpen, setMainnetAlphaPromptOpen] = useState(
    () => state.options.network === 'mainnet' && localStorage.getItem(MAINNET_ALPHA_ACK_KEY) !== '1',
  );
  const assets = assetMap(state);
  const configured = configuredAssets(state.options.network, state.customAssets);
  const configuredValues = Object.values(configured);
  const defaultAsset = configured['ada.ada'] || configuredValues[0];
  if (!defaultAsset) {
    return <main className="frontend-app">No configured assets are available for this network.</main>;
  }
  const offerAsset = assets[state.forms.openOfferAssetKey] || defaultAsset;
  const receiveAsset = assets[state.forms.openAskAssetKey];
  const quoteReceiveAsset =
    receiveAsset && receiveAsset.assetKey !== offerAsset.assetKey
      ? receiveAsset
      : configuredValues.find((asset) => asset.assetKey !== offerAsset.assetKey) || defaultAsset;
  const draftCartCount = state.cart.items.filter((item) => item.status === 'draft').length;
  const pendingHashesKey = [...new Set(pendingTransactionHashes(state))].sort().join(',');
  const excludedUtxoRefs = useMemo(() => bookedSourceRefs(state.cart), [state.cart]);
  const mainnetAlphaRequired = state.options.network === 'mainnet' && mainnetAlphaPromptOpen;

  function acceptMainnetAlpha() {
    localStorage.setItem(MAINNET_ALPHA_ACK_KEY, '1');
    setMainnetAlphaPromptOpen(false);
  }

  function clearFrontendUserData() {
    clearNetworkScopedStoredData();
    setHistoryLoading(false);
    setHistoryNotice('');
  }

  function changeNetwork(network: NetworkTag) {
    clearFrontendUserData();
    dispatch({ type: 'set-options', options: { network } });
  }

  useLayoutEffect(() => {
    if (state.forms.openOfferAssetKey && state.forms.openOfferAssetKey === state.forms.openAskAssetKey) {
      dispatch({ type: 'set-forms', forms: { openAskAssetKey: '' } });
    }
  }, [dispatch, state.forms.openAskAssetKey, state.forms.openOfferAssetKey]);

  const quote = useMemo(
    () =>
      quoteSwap({
        offers: state.openOffers,
        offerAsset,
        receiveAsset: quoteReceiveAsset,
        offerAmount: state.forms.swapOfferAmount,
        payUp: state.forms.swapPayUp,
        excludedUtxoRefs,
        slippageToleranceBps: percentToBps(
          state.options.swapSlippageTolerancePercent,
          APP_CONFIG.defaults.quote.slippageTolerancePercentFallback,
        ),
        warningSlippageMultiplier: APP_CONFIG.defaults.quote.warningSlippageMultiplier,
        payUpBps: percentToBps(state.options.swapPayUpPercent, APP_CONFIG.defaults.quote.payUpPercentFallback),
      }),
    [
      offerAsset,
      quoteReceiveAsset,
      state.forms.swapOfferAmount,
      state.forms.swapPayUp,
      excludedUtxoRefs,
      state.openOffers,
      state.options.swapPayUpPercent,
      state.options.swapSlippageTolerancePercent,
    ],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', state.options.theme);
    document.documentElement.setAttribute('data-theme', state.options.theme);
  }, [state.options.theme]);

  useEffect(() => {
    localStorage.setItem('neonsoup-frontend-cart-mode', cartMode ? 'on' : 'off');
  }, [cartMode]);

  useEffect(() => {
    const previousNetwork = previousNetworkRef.current;
    if (state.options.network === 'mainnet' && previousNetwork !== 'mainnet') {
      setMainnetAlphaPromptOpen(true);
    } else if (state.options.network !== 'mainnet') {
      setMainnetAlphaPromptOpen(false);
    }
    if (previousNetwork !== state.options.network) {
      clearFrontendUserData();
      void refreshNetworkData();
    }
    previousNetworkRef.current = state.options.network;
    // Network changes are the only trigger here; refreshNetworkData uses current shell state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network]);

  useEffect(() => {
    captureWalletReturn()
      .then(() => {
        applyWalletReturn(readWalletReturn(), true);
      })
      .catch((error) => {
        setToast({ tone: 'danger', title: 'Wallet return failed', message: safeError(error) });
      });
    applyWalletReturn(readWalletReturn(), true);
    void refreshNetworkData();

    function onStorage(event: StorageEvent) {
      if (event.key !== APP_CONFIG.walletReturnKey || !event.newValue) return;
      try {
        applyWalletReturn(JSON.parse(event.newValue), true);
      } catch (error) {
        setToast({ tone: 'warning', title: 'Wallet return unreadable', message: safeError(error) });
      }
    }
    function checkStoredReturn() {
      applyWalletReturn(readWalletReturn(), true);
    }
    function onVisibilityChange() {
      if (!document.hidden) checkStoredReturn();
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkStoredReturn);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkStoredReturn);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // Run once on boot. State refreshes are user or provider driven below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.wallet?.address) void refreshNetworkData({ walletAddress: state.wallet.address });
    else clearFrontendUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wallet?.address]);

  useEffect(() => {
    if (!pendingHashesKey) return;
    const hashes = pendingHashesKey.split(',');
    void reconcileChainTransactions(hashes);
    const id = window.setInterval(() => {
      void reconcileChainTransactions(hashes);
    }, APP_CONFIG.confirmationPollingIntervalMs);
    return () => window.clearInterval(id);
    // Pending hashes define the confirmation subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider, pendingHashesKey]);

  useEffect(() => {
    if (!toast || (toast.tone !== 'info' && toast.tone !== 'success')) return;
    const timeout = window.setTimeout(() => setToast(null), state.options.toastAutoHideMs);
    return () => window.clearTimeout(timeout);
  }, [state.options.toastAutoHideMs, toast]);

  async function refreshOffers(): Promise<OpenOffer[] | null> {
    dispatch({ type: 'set-loading', key: 'offers', value: true });
    try {
      const loaded = await loadOpenOffers(state);
      dispatch({
        type: 'set-open-offers',
        offers: loaded.data,
        snapshot: createOpenBookSnapshot(state.options.provider, state.options.network, loaded.data.length),
      });
      dispatch({ type: 'set-asset-info', assets: loaded.assets });
      await reconcileChainTransactions(pendingTransactionHashes(state));
      return loaded.data;
    } catch (error) {
      setToast({ tone: 'warning', title: 'Order book unavailable', message: safeError(error) });
      return null;
    } finally {
      dispatch({ type: 'set-loading', key: 'offers', value: false });
    }
  }

  async function refreshPortfolio(walletAddress = state.wallet?.address) {
    if (!walletAddress) return;
    dispatch({ type: 'set-loading', key: 'portfolio', value: true });
    try {
      const loaded = await loadPortfolio(state, walletAddress);
      dispatch({ type: 'set-portfolio', portfolio: loaded.data });
      dispatch({ type: 'set-asset-info', assets: loaded.assets });
    } catch (error) {
      setToast({ tone: 'warning', title: 'Portfolio unavailable', message: safeError(error) });
    } finally {
      dispatch({ type: 'set-loading', key: 'portfolio', value: false });
    }
  }

  async function refreshWalletHistory(walletAddress = state.wallet?.address) {
    if (!walletAddress) return;
    setHistoryLoading(true);
    setHistoryNotice('');
    try {
      const chainTransactions = await loadAddressTransactions(state, walletAddress, state.options.historyFetchLimit);
      const protocolTransactions = protocolRowsFromChainTransactions(state, chainTransactions);
      dispatch({ type: 'merge-transactions', transactions: protocolTransactions });
      setHistoryNotice(
        protocolTransactions.length
          ? `${protocolTransactions.length} order transaction${protocolTransactions.length === 1 ? '' : 's'} loaded for this wallet.`
          : 'No recent order transactions found for this wallet.',
      );
    } catch (error) {
      setHistoryNotice(`Could not refresh History: ${safeError(error)}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshNetworkData(options: { walletAddress?: string | null } = {}) {
    await refreshOffers();
    const walletAddress = options.walletAddress ?? state.wallet?.address;
    if (!walletAddress) return;
    await Promise.all([refreshPortfolio(walletAddress), refreshWalletHistory(walletAddress)]);
  }

  async function reconcileChainTransactions(txHashes: readonly string[]): Promise<void> {
    try {
      const chainTransactions = await loadTransactions(state, txHashes);
      const confirmedChainTransactions = chainTransactions.filter(isConfirmedChainTransaction);
      if (!confirmedChainTransactions.length) return;
      dispatch({
        type: 'merge-transactions',
        transactions: protocolRowsFromChainTransactions(state, confirmedChainTransactions),
      });
      dispatch({
        type: 'reconcile-confirmed-transactions',
        txHashes: confirmedChainTransactions
          .filter((transaction) => transaction.validContract !== false)
          .map((transaction) => transaction.hash),
        failedTxHashes: confirmedChainTransactions
          .filter((transaction) => transaction.validContract === false)
          .map((transaction) => transaction.hash),
        confirmedAt: Date.now(),
      });
    } catch {
      // Retried by the polling loop; wallet-return history stays visible meanwhile.
    }
  }

  function applyWalletReturn(raw: unknown, shouldConsume: boolean) {
    if (!raw) return;
    const wallet = shouldConsume ? consumeWalletReturn(raw) || walletFromReturn(raw) : walletFromReturn(raw);
    const receipt = executionReceiptFromWalletReturn(raw);
    const incognitoStatus = receipt ? null : incognitoExecutionStatusFromWalletReturn(raw);
    const at = typeof raw === 'object' ? Number((raw as Record<string, unknown>).at) || Date.now() : Date.now();
    if (wallet) dispatch({ type: 'set-wallet', wallet });
    dispatch({ type: 'set-wallet-return', payload: raw });
    if (receipt) {
      dispatch({ type: 'apply-execution-receipt', receipt, at });
      dispatch({ type: 'merge-transactions', transactions: transactionsFromReceipt(receipt, at) });
    }
    if (receipt || incognitoStatus || wallet) {
      const summary = executionSummaryForItems(state, state.cart.items, receipt);
      const notice = walletReturnToast(receipt, incognitoStatus);
      setToast(summary ? { ...notice, message: `${notice.message} ${summary}` } : notice);
    }
    void refreshNetworkData({ walletAddress: wallet?.address || state.wallet?.address || null });
  }

  function addItemsToCart(items: CartItem[]): { ok: boolean; openedEmptyCart: boolean } {
    if (!items.length) {
      setToast({ tone: 'warning', title: 'Nothing to queue', message: 'No executable operations were created for this route.' });
      return { ok: false, openedEmptyCart: false };
    }
    const validation = validateCartItemsCanBeAdded(state.cart, items);
    if (!validation.ok) {
      setToast({ tone: 'warning', title: 'Cart conflict', message: validation.message || 'Operation cannot be added to Cart.' });
      return { ok: false, openedEmptyCart: false };
    }
    const openedEmptyCart = state.cart.items.filter((item) => item.status === 'draft').length === 0;
    dispatch(items.length === 1 && items[0] ? { type: 'add-cart-item', item: items[0] } : { type: 'add-cart-items', items });
    return { ok: true, openedEmptyCart };
  }

  function openCartAfterFirstQueuedItem(result: { ok: boolean; openedEmptyCart: boolean }) {
    if (cartMode && result.openedEmptyCart) {
      dispatch({ type: 'set-cart-modal-open', open: true });
    }
  }

  async function runItems(items: CartItem[], options: { clearAfterOpen?: boolean } = {}) {
    if (mainnetAlphaRequired) {
      setToast({ tone: 'warning', title: 'Public Alpha', message: 'Read and accept the Public Alpha disclaimer before opening the wallet on mainnet.' });
      return;
    }
    if (!items.length) {
      setToast({ tone: 'warning', title: 'Nothing selected', message: 'No draft or failed Cart operations are selected to run.' });
      return;
    }
    try {
      const code =
        state.cart.mode === 'bundle'
          ? await buildBundledGcscriptIntent({
              state,
              items,
              maxIntentsPerTransaction: state.cart.maxIntentsPerTransaction,
            })
          : await buildParallelGcscriptIntent({ state, items });
      await openWalletCode(state, code);
      setToast({ tone: 'info', title: 'Wallet opened', message: 'Continue in wallet to review and sign...' });
      if (options.clearAfterOpen) {
        dispatch({ type: 'remove-cart-items', itemIds: items.map((item) => item.id) });
        dispatch({ type: 'set-cart-modal-open', open: false });
      }
    } catch (error) {
      setToast({ tone: 'danger', title: 'Could not build wallet request', message: safeError(error) });
    }
  }

  async function swap() {
    const requestedQuantity = formQuantity(state.forms.swapOfferAmount, offerAsset);
    const balance = balanceOf(state, offerAsset.policyId, offerAsset.assetNameHex);
    if (
      !receiveAsset ||
      offerAsset.assetKey === receiveAsset.assetKey ||
      requestedQuantity <= 0n ||
      (state.wallet && quote.executionInputQuantity > balance) ||
      !quoteHasExecutableRoute(quote) ||
      quoteHasTrueLiquidityShortage(quote)
    ) {
      setToast({ tone: 'warning', title: 'Swap unavailable', message: 'Fix the highlighted swap amount before continuing.' });
      return;
    }
    const refreshedOffers = await refreshOffers();
    const freshQuote = quoteSwap({
      offers: refreshedOffers || state.openOffers,
      offerAsset,
      receiveAsset,
      offerAmount: state.forms.swapOfferAmount,
      payUp: state.forms.swapPayUp,
      excludedUtxoRefs,
      slippageToleranceBps: percentToBps(
        state.options.swapSlippageTolerancePercent,
        APP_CONFIG.defaults.quote.slippageTolerancePercentFallback,
      ),
      warningSlippageMultiplier: APP_CONFIG.defaults.quote.warningSlippageMultiplier,
      payUpBps: percentToBps(state.options.swapPayUpPercent, APP_CONFIG.defaults.quote.payUpPercentFallback),
    });
    if (
      (state.wallet && freshQuote.executionInputQuantity > balance) ||
      !quoteHasExecutableRoute(freshQuote) ||
      quoteHasTrueLiquidityShortage(freshQuote)
    ) {
      setToast({ tone: 'warning', title: 'Swap unavailable', message: 'Available offers changed. Review the updated quote before continuing.' });
      return;
    }
    const items = createSwapCartItems(state, freshQuote);
    if (!state.wallet && !cartMode) {
      await runItems(items);
      return;
    }
    const addResult = addItemsToCart(items);
    if (!addResult.ok) return;
    if (cartMode) {
      openCartAfterFirstQueuedItem(addResult);
      setToast({ tone: 'success', title: 'Queued in Cart', message: `${items.length} swap operation${items.length === 1 ? '' : 's'} added.` });
    } else {
      await runItems(items);
    }
  }

  async function openOffer() {
    const offerBalance = balanceOf(state, offerAsset.policyId, offerAsset.assetNameHex);
    const offerQuantity = formQuantity(state.forms.openOfferAmount, offerAsset);
    const askQuantity = receiveAsset ? formQuantity(state.forms.openAskAmount, receiveAsset) : 0n;
    if (!receiveAsset || offerAsset.assetKey === receiveAsset.assetKey || offerQuantity <= 0n || askQuantity <= 0n || (state.wallet && offerQuantity > offerBalance)) {
      setToast({ tone: 'warning', title: 'Open offer unavailable', message: 'Fix the highlighted offer terms before continuing.' });
      return;
    }
    const item = createCartItemFromCurrentIntent({ ...state, action: 'open' });
    if (!state.wallet && !cartMode) {
      await runItems([item]);
      return;
    }
    const addResult = addItemsToCart([item]);
    if (!addResult.ok) return;
    if (cartMode) {
      openCartAfterFirstQueuedItem(addResult);
      setToast({ tone: 'success', title: 'Offer queued', message: 'Open Offer was added to Cart.' });
    } else {
      await runItems([item]);
    }
  }

  async function connectWallet() {
    if (mainnetAlphaRequired) {
      setToast({ tone: 'warning', title: 'Public Alpha', message: 'Read and accept the Public Alpha disclaimer before connecting on mainnet.' });
      return;
    }
    try {
      await openWalletCode(state, connectIntent(state));
      setToast({ tone: 'info', title: 'Wallet opened', message: 'Approve the public-data request to connect NeonSoup.' });
    } catch (error) {
      setToast({ tone: 'danger', title: 'Could not open wallet', message: safeError(error) });
    }
  }

  function disconnectWallet() {
    clearFrontendUserData();
    dispatch({ type: 'set-wallet', wallet: null });
    setToast({ tone: 'info', title: 'Wallet disconnected', message: 'Local wallet connection data was cleared.' });
  }

  async function closeOrder(offer: OpenOffer) {
    dispatch({ type: 'select-offer-for-close', offer });
    const nextState = {
      ...state,
      action: 'close' as const,
      selectedOrderId: offer.id,
    };
    const item = createCartItemFromCurrentIntent(nextState);
    const addResult = addItemsToCart([item]);
    if (!addResult.ok) return;
    if (!cartMode) await runItems([item]);
    else openCartAfterFirstQueuedItem(addResult);
  }

  function flipAssets() {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: state.forms.openAskAssetKey,
        openAskAssetKey: state.forms.openOfferAssetKey,
      },
    });
  }

  function selectPair(payKey: string, receiveKey: string) {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: payKey,
        openAskAssetKey: payKey === receiveKey ? '' : receiveKey,
      },
    });
    navigate('/swap');
  }

  function startOffer(assetKey: string) {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: assetKey,
        openAskAssetKey: '',
      },
    });
    navigate('/open');
  }

  function startOfferPair(offerKey: string, askKey: string) {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: offerKey,
        openAskAssetKey: offerKey === askKey ? '' : askKey,
      },
    });
    navigate('/open');
  }

  function startSwapFromAsset(assetKey: string) {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: assetKey,
        openAskAssetKey: '',
      },
    });
    navigate('/swap');
  }

  return (
    <main className="frontend-app">
      <div className="shell">
        <div className="layout">
          <Sidebar incognito={!state.wallet} />
          <Topbar
            cartCount={draftCartCount}
            wallet={state.wallet}
            theme={state.options.theme}
            onTheme={() =>
              dispatch({ type: 'set-options', options: { theme: state.options.theme === 'dark' ? 'light' : 'dark' } })
            }
            onCart={() => dispatch({ type: 'set-cart-modal-open', open: true })}
            onConnect={() => void connectWallet()}
            onDisconnect={disconnectWallet}
            onOptions={() => setOptionsModalOpen(true)}
            onMenu={() => setDrawerOpen(true)}
          />
          <main className="main-panel">
            <Routes>
              <Route path="/" element={<Navigate to="/swap" replace />} />
              <Route
                path="/swap"
                element={
                  <SwapScreen
                    state={state}
                    quote={quote}
                    assets={assets}
                    offerAsset={offerAsset}
                    receiveAsset={receiveAsset}
                    cartMode={cartMode}
                    onSwap={() => void swap()}
                    onFlip={flipAssets}
                    onRefresh={() => void refreshOffers()}
                    refreshing={state.loading.offers}
                  />
                }
              />
              <Route
                path="/open"
                element={
                  <OpenScreen
                    state={state}
                    assets={assets}
                    offerAsset={offerAsset}
                    askAsset={receiveAsset}
                    cartMode={cartMode}
                    onOpen={() => void openOffer()}
                    onRefresh={() => void refreshPortfolio()}
                    refreshing={state.loading.portfolio}
                  />
                }
              />
              <Route
                path="/markets"
                element={
                  <MarketsScreen
                    state={state}
                    assets={assets}
                    onSelect={selectPair}
                    onOffer={startOfferPair}
                    onRefresh={() => void refreshOffers()}
                    refreshing={state.loading.offers}
                  />
                }
              />
              <Route
                path="/orders"
                element={
                  <OrdersScreen
                    state={state}
                    cartMode={cartMode}
                    onCloseOrder={(offer) => void closeOrder(offer)}
                    onRefresh={() => void refreshOffers()}
                    refreshing={state.loading.offers}
                  />
                }
              />
              <Route
                path="/portfolio"
                element={
                  <PortfolioScreen
                    state={state}
                    onOfferAsset={startOffer}
                    onSwapAsset={startSwapFromAsset}
                    onRefresh={() => void refreshPortfolio()}
                    refreshing={state.loading.portfolio}
                  />
                }
              />
              <Route
                path="/history"
                element={
                  <HistoryScreen
                    state={state}
                    loading={historyLoading}
                    notice={historyNotice}
                    onRefresh={() => void refreshWalletHistory()}
                  />
                }
              />
              <Route
                path="/options"
                element={<OptionsScreen state={state} cartMode={cartMode} setCartMode={setCartMode} onNetworkChange={changeNetwork} />}
              />
              <Route path="*" element={<Navigate to="/swap" replace />} />
            </Routes>
          </main>
          <footer className="footer">
            <span className="network-pill">
              {state.options.network}
              <HelpTooltip label="Network help">{HELP.network}</HelpTooltip>
            </span>
            <span className="footer-separator" aria-hidden="true">|</span>
            <span>by </span>
            <b>GameChanger</b>
            <span>Finance</span>
          </footer>
        </div>
      </div>
      {state.cart.modalOpen ? (
        <CartModal
          state={state}
          cartMode={cartMode}
          incognito={!state.wallet}
          onClose={() => dispatch({ type: 'set-cart-modal-open', open: false })}
          onRemove={(itemId) => dispatch({ type: 'remove-cart-item', itemId })}
          onSwitchCartMode={() => {
            setCartMode(true);
            setToast({ tone: 'info', title: 'Cart Mode enabled', message: 'New operations will be queued in Cart before opening the wallet.' });
          }}
          onRun={() =>
            void runItems(selectedCartItems(state.cart).filter((item) => item.status === 'draft' || item.status === 'failed'), {
              clearAfterOpen: !state.wallet,
            })
          }
        />
      ) : null}
      {optionsModalOpen ? (
        <AppModal title="Options" onClose={() => setOptionsModalOpen(false)} asset="options">
          <OptionsScreen state={state} cartMode={cartMode} setCartMode={setCartMode} onNetworkChange={changeNetwork} modal hideTitle />
        </AppModal>
      ) : null}
      {drawerOpen ? <Drawer close={() => setDrawerOpen(false)} incognito={!state.wallet} /> : null}
      {mainnetAlphaRequired ? <MainnetAlphaModal onAccept={acceptMainnetAlpha} /> : null}
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} /> : null}
    </main>
  );
}
