import { useEffect, useMemo, useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PageHeader } from './components/layout/PageHeader';
import { AssetPairSelector } from './components/assets/AssetPairSelector';
import { AmountInput } from './components/common/AmountInput';
import { BalanceBar } from './components/common/BalanceBar';
import { CartAddButton } from './components/common/CartAddButton';
import { FormAlert } from './components/common/FormAlert';
import { LoadingState } from './components/common/LoadingState';
import { ReloadButton } from './components/common/ReloadButton';
import { OpenOffersTable } from './components/orders/OpenOffersTable';
import { PortfolioTable } from './components/portfolio/PortfolioTable';
import { TransactionList } from './components/transactions/TransactionList';
import { JsonViewer } from './components/common/JsonViewer';
import { OptionsPanel } from './components/options/OptionsPanel';
import { CartModal } from './components/cart/CartModal';
import { CartPanel } from './components/cart/CartPanel';
import { SwapRouteBar } from './components/swap/SwapRouteBar';
import { useAppDispatch, useAppState } from './state/appState';
import { assetMap, balanceOf, resolveAsset, selectedOffer, visibleOffers, visiblePortfolio } from './state/selectors';
import { assetTitle, configuredAssets } from './domain/assets';
import {
  composeTransactionRows,
  isConfirmedChainTransaction,
  protocolTransactionFromChain,
  transactionsFromReceipt,
} from './domain/transactions';
import { isCurrentOutputOwner } from './domain/ownership';
import { createOpenBookSnapshot, openBookSnapshotIsFresh } from './domain/openBook';
import { fromBase, percent, ratioDecimal, toBase } from './domain/quantities';
import {
  percentToBps,
  quoteSwap,
  summarizeSwapBookPolicyFilters,
  type SwapBookPolicySummary,
  type SwapPrice,
  type SwapQuote,
  type SwapQuoteSeverity,
} from './domain/swapQuote';
import { safeError, short } from './domain/text';
import { loadOpenOffers, loadPortfolio, loadTransactions } from './services/networkProvider';
import { captureWalletReturn, consumeWalletReturn, openWalletCode } from './services/gcWallet';
import { fillAskAmount } from './services/intents';
import {
  bookedSourceRefs,
  createBulkOpenCartItems,
  createCartItemFromCurrentIntent,
  createSwapCartItems,
  selectedCartItems,
  validateCartItemsCanBeAdded,
} from './services/cartIntents';
import {
  buildBundledGcscriptIntent,
  buildParallelGcscriptIntent,
  executionReceiptFromWalletReturn,
} from './services/intentExecution';
import { clearStoredState, readWalletReturn } from './services/storage';
import { APP_CONFIG } from './config/appConfig';
import { createInitialState } from './state/reducer';
import type { AppState, CartItem, NoticeTone, OpenOffer, ResolvedAsset, WalletConnection } from './state/types';

function pairMatches(stateOffer: OpenOffer, offerKey: string, askKey: string, assets: ReturnType<typeof assetMap>) {
  const offer = assets[offerKey];
  const ask = assets[askKey];
  if (!offer || !ask) return false;
  return (
    stateOffer.offerPolicyId === offer.policyId &&
    stateOffer.offerAssetName === offer.assetNameHex &&
    stateOffer.askPolicyId === ask.policyId &&
    stateOffer.askAssetName === ask.assetNameHex
  );
}

function walletFromReturn(raw: unknown): WalletConnection | null {
  if (!raw || typeof raw !== 'object') return null;
  const wallet = (raw as Record<string, unknown>).wallet;
  return wallet && typeof wallet === 'object' ? (wallet as WalletConnection) : null;
}

function hasExecutionExport(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const decoded = (raw as Record<string, unknown>).decoded;
  if (!decoded || typeof decoded !== 'object') return false;
  const exports = (decoded as Record<string, unknown>).exports;
  return Boolean(exports && typeof exports === 'object' && 'neonsoupExecution' in exports);
}

function cartPendingTxHashes(items: CartItem[]): string[] {
  return items
    .filter((item) => item.status === 'pending' && item.txHash)
    .map((item) => item.txHash || '')
    .filter(Boolean);
}

function pendingTransactionHashes(state: AppState): string[] {
  return [
    ...state.transactions.filter((tx) => tx.status === 'submitted').map((tx) => tx.txHash),
    ...cartPendingTxHashes(state.cart.items),
  ];
}

function openBookIsStale(state: AppState): boolean {
  return !openBookSnapshotIsFresh(
    state.openOffersSnapshot,
    state.options.provider,
    state.options.network,
    Date.now(),
    APP_CONFIG.pollingIntervalMs,
  );
}

function quoteTextClass(severity: SwapQuoteSeverity): string {
  if (severity === 'danger') return 'swap-quote-summary-danger';
  if (severity === 'warning') return 'swap-quote-summary-warning';
  if (severity === 'success') return 'swap-quote-summary-success';
  return 'swap-quote-summary-info';
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

function priceText(price: SwapPrice | null, offerAsset: ResolvedAsset | undefined, receiveAsset: ResolvedAsset | undefined): string {
  if (!price || !offerAsset || !receiveAsset || price.denominator <= 0n) return '-';
  const numerator = price.numerator * 10n ** BigInt(receiveAsset.decimals);
  const denominator = price.denominator * 10n ** BigInt(offerAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function inversePriceText(price: SwapPrice | null, offerAsset: ResolvedAsset | undefined, receiveAsset: ResolvedAsset | undefined): string {
  if (!price || !offerAsset || !receiveAsset || price.numerator <= 0n) return '-';
  const numerator = price.denominator * 10n ** BigInt(offerAsset.decimals);
  const denominator = price.numerator * 10n ** BigInt(receiveAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function quoteSummary(quote: SwapQuote, offerAsset: ResolvedAsset, receiveAsset: ResolvedAsset): string {
  const filled = fromBase(quote.filledInputQuantity, offerAsset.decimals);
  const executionInput = fromBase(quote.executionInputQuantity, offerAsset.decimals);
  const output = fromBase(quote.outputQuantity, receiveAsset.decimals);
  const effective = priceText(quote.effectivePrice, offerAsset, receiveAsset);
  const parts = [
    `Quote routes ${filled}/${executionInput} ${assetTitle(offerAsset)} into ${output} ${assetTitle(receiveAsset)}`,
    `effective ${effective} ${assetTitle(offerAsset)} per ${assetTitle(receiveAsset)}`,
    `slippage ${formatBps(quote.weightedSlippageBps)}`,
    `worst leg ${formatBps(quote.marginalSlippageBps)}`,
  ];
  if (quote.unfilledRequestedQuantity > 0n) {
    parts.push(`${fromBase(quote.unfilledRequestedQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} not routed`);
  }
  if (quote.roundUpInputQuantity > 0n) {
    parts.push(`amount adjusted to ${executionInput} ${assetTitle(offerAsset)} for protocol-safe execution`);
  }
  if (quote.remainderBlockedCount) {
    parts.push(`${quote.remainderBlockedCount} route boundary${quote.remainderBlockedCount === 1 ? '' : 'ies'} could not satisfy the maker-remainder policy`);
  }
  return parts.join('. ');
}

function bookPolicySummaryText(summary: SwapBookPolicySummary, receiveAsset: ResolvedAsset): string {
  if (!summary.count) return '';
  return `${summary.count} offer${summary.count === 1 ? '' : 's'} below minimum executable size filtered from the book (${fromBase(
    summary.offerQuantity,
    receiveAsset.decimals,
  )} ${assetTitle(receiveAsset)})`;
}

const WALLET_REQUIRED_MESSAGE =
  'Connect a wallet before operating. This is a temporary devtool restriction while wallet-agnostic intent execution is being fixed.';

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const assets = assetMap(state);
  const selectableAssets = configuredAssets(state.options.network, state.customAssets);
  const offer = assets[state.forms.openOfferAssetKey];
  const ask = assets[state.forms.openAskAssetKey];
  const currentOffer = selectedOffer(state);
  const offers = visibleOffers(state);
  const pairOfferKey =
    state.tradeTab === 'swap' || state.tradeTab === 'fill'
      ? state.forms.openAskAssetKey
      : state.forms.openOfferAssetKey;
  const pairAskKey =
    state.tradeTab === 'swap' || state.tradeTab === 'fill'
      ? state.forms.openOfferAssetKey
      : state.forms.openAskAssetKey;
  const pairOffers = offers.filter((item) =>
    pairMatches(item, pairOfferKey, pairAskKey, assets),
  );
  const excludedUtxoRefs = useMemo(() => bookedSourceRefs(state.cart), [state.cart]);
  const swapQuote = useMemo(
    () =>
      quoteSwap({
        offers: state.openOffers,
        offerAsset: offer,
        receiveAsset: ask,
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
      ask,
      offer,
      state.forms.swapOfferAmount,
      state.forms.swapPayUp,
      excludedUtxoRefs,
      state.openOffers,
      state.options.swapPayUpPercent,
      state.options.swapSlippageTolerancePercent,
    ],
  );
  const bookPolicySummary = useMemo(
    () => summarizeSwapBookPolicyFilters(state.openOffers, offer, ask),
    [ask, offer, state.openOffers],
  );
  const swapPolicyStatusByUtxo = useMemo(() => {
    const labels: Record<string, string> = {};
    swapQuote.filteredOffers.forEach(({ offer: filteredOffer, reason }) => {
      const key = `${filteredOffer.txHash}#${filteredOffer.txIndex}`;
      labels[key] = reason === 'min-executable-offer' ? 'Below minimum executable offer' : 'Skipped by pay-up';
    });
    return labels;
  }, [swapQuote.filteredOffers]);
  const portfolio = visiblePortfolio(state);
  const hiddenOffers = Math.max(0, state.openOffers.length - offers.length);
  const hiddenPortfolio = Math.max(0, state.portfolio.length - portfolio.length);
  const offersRefreshId = useRef(0);
  const portfolioRefreshId = useRef(0);
  const walletLaunchDisabled = !state.wallet;

  function updateStoredState() {
    clearStoredState();
    dispatch({ type: 'replace-state', state: createInitialState() });
    window.location.reload();
  }

  function applyWalletReturn(raw: unknown, shouldConsume: boolean) {
    if (!raw) return;
    const wallet = shouldConsume ? consumeWalletReturn(raw) || walletFromReturn(raw) : walletFromReturn(raw);
    const receipt = executionReceiptFromWalletReturn(raw);
    const at = typeof raw === 'object' ? Number((raw as Record<string, unknown>).at) || Date.now() : Date.now();

    dispatch({ type: 'set-wallet-return', payload: raw });
    if (wallet) dispatch({ type: 'set-wallet', wallet });
    if (receipt) {
      dispatch({ type: 'apply-execution-receipt', receipt, at });
      dispatch({ type: 'merge-transactions', transactions: transactionsFromReceipt(receipt, at) });
    }
    const submitFailures = receipt?.txs.filter((tx) => tx.hasSubmitError).length || 0;
    dispatch({
      type: 'set-notice',
      key: 'app',
      notice: {
        tone: submitFailures || (hasExecutionExport(raw) && !receipt) ? 'warning' : 'success',
        message: receipt
          ? submitFailures
            ? `${receipt.itemCount} intent${receipt.itemCount === 1 ? '' : 's'} captured with ${submitFailures} tentative submission error${submitFailures === 1 ? '' : 's'}. Chain data remains authoritative.`
            : `${receipt.itemCount} submitted intent${receipt.itemCount === 1 ? '' : 's'} captured.`
          : hasExecutionExport(raw)
            ? 'Wallet returned a malformed NeonSoup execution receipt. No Cart items were updated.'
            : 'Wallet response captured.',
      },
    });

    void refreshNetworkData(receipt ? [...new Set(receipt.items.map((item) => item.txHash))] : [], wallet?.address || state.wallet?.address || null);
  }

  useEffect(() => {
    captureWalletReturn()
      .then(() => {
        const raw = readWalletReturn();
        applyWalletReturn(raw, true);
      })
      .catch((error) =>
        dispatch({
          type: 'set-notice',
          key: 'app',
          notice: { tone: 'danger', message: `Wallet response decode failed: ${safeError(error)}` },
        }),
      );

    applyWalletReturn(readWalletReturn(), true);

    function onStorage(event: StorageEvent) {
      if (event.key !== APP_CONFIG.walletReturnKey || !event.newValue) return;
      try {
        applyWalletReturn(JSON.parse(event.newValue), true);
      } catch (error) {
        dispatch({
          type: 'set-notice',
          key: 'app',
          notice: { tone: 'danger', message: `Wallet response decode failed: ${safeError(error)}` },
        });
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
    // Wallet return capture is intentionally centralized here for every intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void refreshNetworkData();
    // Network/provider changes should refresh data; avoid depending on all state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider]);

  useEffect(() => {
    if (state.wallet?.address) void refreshNetworkData([], state.wallet.address);
    else portfolioRefreshId.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wallet?.address]);

  useEffect(() => {
    dispatch({ type: 'set-forms', forms: { fillAskAmount: fillAskAmount(state) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.forms.fillOfferAmount, state.selectedOrderId, state.openOffers, state.assetInfo]);

  useEffect(() => {
    if (!offer || !ask || (state.tradeTab !== 'open' && state.tradeTab !== 'bulk-open' && state.tradeTab !== 'swap')) return;
    const pair = {
      offer: { policyId: offer.policyId, assetNameHex: offer.assetNameHex },
      ask: { policyId: ask.policyId, assetNameHex: ask.assetNameHex },
    };
    const current = state.selectedPair;
    if (
      current?.offer.policyId === pair.offer.policyId &&
      current.offer.assetNameHex === pair.offer.assetNameHex &&
      current.ask.policyId === pair.ask.policyId &&
      current.ask.assetNameHex === pair.ask.assetNameHex
    ) {
      return;
    }
    dispatch({ type: 'set-selected-pair', pair });
  }, [ask, dispatch, offer, state.selectedPair, state.tradeTab]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshNetworkData();
    }, APP_CONFIG.pollingIntervalMs);
    return () => window.clearInterval(id);
    // Polling uses current visible network/wallet state through dependency reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider, state.wallet?.address]);

  const pendingHashesKey = [...new Set(pendingTransactionHashes(state))].sort().join(',');

  useEffect(() => {
    if (!pendingHashesKey) return;
    void refreshTransactionStatuses(pendingHashesKey.split(','));
    const id = window.setInterval(() => {
      void refreshTransactionStatuses(pendingHashesKey.split(','));
    }, APP_CONFIG.confirmationPollingIntervalMs);
    return () => window.clearInterval(id);
    // Pending hashes define the confirmation subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider, pendingHashesKey]);

  async function refreshTransactionStatuses(txHashes: string[]): Promise<void> {
    await reconcileChainTransactions(txHashes);
  }

  async function reconcileChainTransactions(
    txHashes: readonly string[],
    isCurrent: () => boolean = () => true,
  ): Promise<void> {
    try {
      const chainTransactions = await loadTransactions(state, txHashes);
      const confirmedChainTransactions = chainTransactions.filter(isConfirmedChainTransaction);
      if (!isCurrent() || !confirmedChainTransactions.length) return;
      dispatch({
        type: 'merge-transactions',
        transactions: confirmedChainTransactions.map((transaction) =>
          protocolTransactionFromChain(
            transaction,
            APP_CONFIG.networks[state.options.network].beaconPolicy || APP_CONFIG.beaconPolicy,
          ),
        ),
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
      // Transaction enrichment is retried independently and must not discard valid offer/portfolio data.
    }
  }

  async function refreshOffers(extraPendingHashes: string[] = []): Promise<OpenOffer[] | null> {
    const refreshId = ++offersRefreshId.current;
    dispatch({ type: 'set-loading', key: 'offers', value: true });
    dispatch({ type: 'set-notice', key: 'offers', notice: { tone: 'warning', message: 'Loading open offers...' } });
    try {
      const loaded = await loadOpenOffers(state);
      if (refreshId !== offersRefreshId.current) return null;
      dispatch({ type: 'set-asset-info', assets: loaded.assets });
      dispatch({
        type: 'set-open-offers',
        offers: loaded.data,
        snapshot: createOpenBookSnapshot(state.options.provider, state.options.network, loaded.data.length),
      });
      const transactionHashes = [
        ...loaded.data.map((offer) => offer.txHash),
        ...pendingTransactionHashes(state),
        ...extraPendingHashes,
      ];
      await reconcileChainTransactions(transactionHashes, () => refreshId === offersRefreshId.current);
      if (refreshId !== offersRefreshId.current) return null;
      dispatch({
        type: 'set-notice',
        key: 'offers',
        notice: {
          tone: loaded.data.length ? 'success' : 'warning',
          message: `${loaded.data.length} open offer${loaded.data.length === 1 ? '' : 's'} loaded.`,
        },
      });
      return loaded.data;
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'offers',
        notice: { tone: 'danger', message: `Could not load open offers: ${safeError(error)}` },
      });
      return null;
    } finally {
      if (refreshId === offersRefreshId.current) {
        dispatch({ type: 'set-loading', key: 'offers', value: false });
      }
    }
  }

  async function refreshPortfolio(walletAddress = state.wallet?.address) {
    if (!walletAddress) {
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: { tone: 'warning', message: 'Connect wallet to load portfolio.' },
      });
      return;
    }
    const refreshId = ++portfolioRefreshId.current;
    dispatch({ type: 'set-loading', key: 'portfolio', value: true });
    try {
      const loaded = await loadPortfolio(state, walletAddress);
      if (refreshId !== portfolioRefreshId.current) return;
      dispatch({ type: 'set-asset-info', assets: loaded.assets });
      dispatch({ type: 'set-portfolio', portfolio: loaded.data });
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: {
          tone: loaded.data.length ? 'success' : 'warning',
          message: `${loaded.data.length} assets at current address.`,
        },
      });
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: { tone: 'danger', message: `Could not load portfolio: ${safeError(error)}` },
      });
    } finally {
      if (refreshId === portfolioRefreshId.current) {
        dispatch({ type: 'set-loading', key: 'portfolio', value: false });
      }
    }
  }

  async function refreshNetworkData(extraPendingHashes: string[] = [], walletAddress: string | null | undefined = state.wallet?.address): Promise<void> {
    await refreshOffers(extraPendingHashes);
    if (walletAddress) await refreshPortfolio(walletAddress);
    else portfolioRefreshId.current += 1;
  }

  function selectFill(item: OpenOffer) {
    dispatch({ type: 'select-offer-for-fill', offer: item, amount: '' });
  }

  function selectClose(item: OpenOffer) {
    dispatch({ type: 'select-offer-for-close', offer: item });
  }

  function addItemsToCart(items: ReturnType<typeof createBulkOpenCartItems>, openModal = false) {
    if (!items.length) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: { tone: 'warning', message: 'No intents were created for the Cart.' },
      });
      return;
    }
    const validation = validateCartItemsCanBeAdded(state.cart, items);
    if (!validation.ok) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: { tone: 'warning', message: validation.message || 'Intent cannot be added to Cart.' },
      });
      return;
    }
    const [singleItem] = items;
    dispatch(items.length === 1 && singleItem ? { type: 'add-cart-item', item: singleItem } : { type: 'add-cart-items', items });
    dispatch({
      type: 'set-notice',
      key: 'app',
      notice: {
        tone: 'success',
        message: `${items.length} intent${items.length === 1 ? '' : 's'} added to Cart.`,
      },
    });
    if (openModal) dispatch({ type: 'set-cart-modal-open', open: true });
  }

  function addCurrentIntentToCart() {
    addItemsToCart([createCartItemFromCurrentIntent(state)]);
  }

  function addFillToCart() {
    addCurrentIntentToCart();
  }

  function addBulkOpenToCart() {
    const count = Number(state.forms.bulkOpenCount || '0');
    const priceVariance = Number(state.forms.bulkOpenVariancePercent || '0');
    const offerVariance = Number(state.forms.bulkOpenOfferVariancePercent || '0');
    addItemsToCart(createBulkOpenCartItems(state, count, priceVariance, offerVariance), true);
  }

  function swapSelectedPair() {
    dispatch({
      type: 'set-forms',
      forms: {
        openOfferAssetKey: state.forms.openAskAssetKey,
        openAskAssetKey: state.forms.openOfferAssetKey,
      },
    });
  }

  async function quoteOffersForSwap(): Promise<OpenOffer[]> {
    if (!openBookIsStale(state)) return state.openOffers;
    const refreshed = await refreshOffers();
    return refreshed || state.openOffers;
  }

  async function createCurrentSwapCartItems(): Promise<CartItem[]> {
    const quoteOffers = await quoteOffersForSwap();
    const freshQuote = quoteSwap({
      offers: quoteOffers,
      offerAsset: offer,
      receiveAsset: ask,
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
    return createSwapCartItems(state, freshQuote);
  }

  async function addSwapToCart() {
    addItemsToCart(await createCurrentSwapCartItems(), true);
  }

  async function runSwap() {
    await runIntentItems(await createCurrentSwapCartItems());
  }

  async function runIntentItems(items: CartItem[]) {
    if (!state.wallet) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: { tone: 'warning', message: WALLET_REQUIRED_MESSAGE },
      });
      return;
    }
    if (!items.length) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: { tone: 'warning', message: 'Select at least one draft or failed intent to run.' },
      });
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
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: { tone: 'info', message: 'Wallet opened. Intents remain relaunchable until a submission receipt returns.' },
      });
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'app',
        notice: {
          tone: 'danger',
          message: `Could not build Cart execution intent: ${safeError(error)}`,
        },
      });
    }
  }

  async function runAction() {
    await runIntentItems([createCartItemFromCurrentIntent(state)]);
  }

  async function runCartSelected() {
    await runIntentItems(selectedCartItems(state.cart).filter((item) => item.status === 'draft' || item.status === 'failed'));
  }

  const openWarnings = useMemo(() => {
    if (!offer || !ask) return ['Select both assets.'];
    const warnings: string[] = [];
    const offerQuantity = toBase(state.forms.openOfferAmount, offer.decimals);
    const offerBalance = balanceOf(state, offer.policyId, offer.assetNameHex);
    if (!state.wallet) warnings.push(WALLET_REQUIRED_MESSAGE);
    if (offer.policyId === ask.policyId && offer.assetNameHex === ask.assetNameHex) warnings.push('Same asset pair.');
    if (offerBalance && offerQuantity > offerBalance) warnings.push('Offer exceeds wallet balance.');
    return warnings;
  }, [ask, offer, state]);

  const fillWarnings = useMemo(() => {
    if (!currentOffer) return ['Select an open offer to fill.'];
    const warnings: string[] = [];
    const offeredAsset = resolveAsset(state, currentOffer.offerPolicyId, currentOffer.offerAssetName);
    const quantity = toBase(state.forms.fillOfferAmount, offeredAsset.decimals);
    const available = BigInt(currentOffer.utxoOfferQuantity || '0');
    if (!state.wallet) warnings.push(WALLET_REQUIRED_MESSAGE);
    if (quantity > available) warnings.push('Fill amount exceeds selected offer availability.');
    if (currentOffer.offerPolicyId === currentOffer.askPolicyId && currentOffer.offerAssetName === currentOffer.askAssetName) {
      warnings.push('Same asset pair.');
    }
    return warnings;
  }, [currentOffer, state, state.forms.fillOfferAmount]);

  const swapWarnings = useMemo(() => {
    if (!offer || !ask) return ['Select both assets.'];
    const warnings: string[] = [];
    const offerQuantity = swapQuote.executionInputQuantity;
    const offerBalance = balanceOf(state, offer.policyId, offer.assetNameHex);
    if (!state.wallet) warnings.push(WALLET_REQUIRED_MESSAGE);
    if (offer.policyId === ask.policyId && offer.assetNameHex === ask.assetNameHex) warnings.push('Same asset pair.');
    if (!swapQuote.requestedInputQuantity) warnings.push('Enter an amount to offer.');
    if (offerBalance && offerQuantity > offerBalance) warnings.push('Offered amount exceeds wallet balance.');
    if (offerQuantity && !swapQuote.outputQuantity) warnings.push('No executable liquidity for this amount and pair.');
    if (swapQuote.roundUpInputQuantity > 0n) {
      warnings.push(
        `Offer adjusted from ${fromBase(swapQuote.requestedInputQuantity, offer.decimals)} to ${fromBase(
          swapQuote.executionInputQuantity,
          offer.decimals,
        )} ${assetTitle(offer)} to avoid a below-minimum maker remainder.`,
      );
    }
    if (swapQuote.unfilledRequestedQuantity > 0n) {
      warnings.push(`${fromBase(swapQuote.unfilledRequestedQuantity, offer.decimals)} ${assetTitle(offer)} is not routed at the current book depth.`);
    }
    if (swapQuote.skippedUnsupportedCount) {
      warnings.push(`${swapQuote.skippedUnsupportedCount} future/unsupported order${swapQuote.skippedUnsupportedCount === 1 ? '' : 's'} skipped.`);
    }
    if (swapQuote.payUpFallback) warnings.push('Pay-up band skipped all available liquidity; using cheapest route.');
    if (swapQuote.remainderBlockedCount) warnings.push('A route boundary could not satisfy the maker-remainder policy.');
    if (openBookIsStale(state)) warnings.push('Quote will refresh the open-book mirror before wallet execution.');
    return warnings;
  }, [
    ask,
    offer,
    state,
    swapQuote.executionInputQuantity,
    swapQuote.outputQuantity,
    swapQuote.payUpFallback,
    swapQuote.remainderBlockedCount,
    swapQuote.requestedInputQuantity,
    swapQuote.roundUpInputQuantity,
    swapQuote.skippedUnsupportedCount,
    swapQuote.unfilledRequestedQuantity,
  ]);

  function renderTrade() {
    const offerBalance = offer ? balanceOf(state, offer.policyId, offer.assetNameHex) : 0n;
    const offerQuantity = offer ? toBase(state.forms.openOfferAmount, offer.decimals) : 0n;
    const swapOfferQuantity = offer ? swapQuote.executionInputQuantity : 0n;
    const swapReceivedLabel = ask ? fromBase(swapQuote.outputQuantity, ask.decimals) : '';
    const effectivePriceLabel = priceText(swapQuote.effectivePrice, offer, ask);
    const inverseEffectivePriceLabel = inversePriceText(swapQuote.effectivePrice, offer, ask);
    const bookPolicyText = ask ? bookPolicySummaryText(bookPolicySummary, ask) : '';
    const payUpLabel =
      state.forms.swapPayUp && swapQuote.payUpSkippedCount
        ? `Skipping ${swapQuote.payUpSkippedCount} cheapest order${swapQuote.payUpSkippedCount === 1 ? '' : 's'} up to +${state.options.swapPayUpPercent}%.`
        : state.forms.swapPayUp
          ? `Pay-up band +${state.options.swapPayUpPercent}% active.`
          : `Disabled: use cheapest executable route.`;
    const selectedOfferedAsset = currentOffer
      ? resolveAsset(state, currentOffer.offerPolicyId, currentOffer.offerAssetName)
      : null;
    const fillQuantity = selectedOfferedAsset ? toBase(state.forms.fillOfferAmount, selectedOfferedAsset.decimals) : 0n;
    const available = BigInt(currentOffer?.utxoOfferQuantity || '0');
    const bulkOpenCount = Math.max(0, Math.floor(Number(state.forms.bulkOpenCount || '0')) || 0);
    const bulkOpenLabel = `Open ${bulkOpenCount} offer${bulkOpenCount === 1 ? '' : 's'}`;

    return (
      <>
        <PageHeader title="Trade" eyebrow="Pair first">
        </PageHeader>

        <section className="app-card pair-primer p-3 p-lg-4 mb-4">
          <h2 className="h5 mb-3">1. Asset Pair</h2>
          <AssetPairSelector
            assets={selectableAssets}
            offerKey={state.forms.openOfferAssetKey}
            askKey={state.forms.openAskAssetKey}
            onOfferChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openOfferAssetKey: assetKey } })}
            onAskChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openAskAssetKey: assetKey } })}
            onSwapPair={swapSelectedPair}
          />
        </section>

        <section className="app-card p-3 p-lg-4 mb-4">
          <ul className="nav nav-tabs action-tabs mb-4" role="tablist" aria-label="Trade action">
            {(['swap', 'open', 'fill', 'close', 'bulk-open'] as const).map((mode) => (
              <li key={mode} className="nav-item" role="presentation">
              <button
                type="button"
                role="tab"
                className={`nav-link ${state.tradeTab === mode ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'set-trade-tab', tab: mode })}
              >
                {mode === 'bulk-open' ? 'Bulk-Open' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
              </li>
            ))}
          </ul>

          {state.tradeTab === 'swap' && offer && ask ? (
            <div className="row g-4">
              <div className="col-12">
                <div className="swap-quote-grid">
                  <div className="swap-quote-field">
                    <AmountInput
                      id="swap-offer-amount"
                      label={`Offer ${assetTitle(offer)}`}
                      value={state.forms.swapOfferAmount}
                      onChange={(value) => dispatch({ type: 'set-forms', forms: { swapOfferAmount: value } })}
                      help={`Balance ${fromBase(offerBalance, offer.decimals)} ${assetTitle(offer)}`}
                    />
                  </div>
                  <div className="swap-quote-field">
                    <AmountInput
                      id="swap-receive-amount"
                      label={`Estimated receive ${assetTitle(ask)}`}
                      value={swapReceivedLabel}
                      onChange={() => undefined}
                      readOnly
                    />
                  </div>
                  <div className={`swap-quote-field swap-quote-field-${swapQuote.severity}`}>
                    <label className="form-label" htmlFor="swap-effective-price">
                      Effective price
                    </label>
                    <div id="swap-effective-price" className="swap-effective-price">
                      {effectivePriceLabel}
                    </div>
                    <div className="form-text">
                      {effectivePriceLabel === '-'
                        ? `No executable route for ${assetTitle(offer)} / ${assetTitle(ask)}.`
                        : `${assetTitle(offer)} per ${assetTitle(ask)} · 1 ${assetTitle(offer)} ≈ ${inverseEffectivePriceLabel} ${assetTitle(ask)}`}
                    </div>
                    <span className={`badge rounded-pill swap-severity-badge swap-severity-${swapQuote.severity}`}>
                      {formatBps(swapQuote.weightedSlippageBps)} slippage
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-12">
                <div className="swap-warning-slot">
                  {swapWarnings.length ? (
                    <FormAlert tone={swapQuote.outputQuantity ? 'warning' : 'info'}>{swapWarnings.join(' ')}</FormAlert>
                  ) : null}
                </div>
              </div>
              <div className="col-12">
                <BalanceBar
                  value={percent(swapOfferQuantity, offerBalance)}
                  label="Offered amount versus current balance"
                  unavailable={!state.wallet}
                />
              </div>
              <div className="col-12">
                <div className="d-flex justify-content-between gap-3 small mb-1">
                  <span className="text-body-secondary">Swap route segments</span>
                  <span className="text-body-secondary">Click or hover to inspect</span>
                </div>
                <SwapRouteBar quote={swapQuote} offerAsset={offer} receiveAsset={ask} />
              </div>
              {bookPolicyText ? (
                <div className="col-12">
                  <FormAlert tone="warning">{bookPolicyText}</FormAlert>
                </div>
              ) : null}
              <div className="col-12 col-xl-6">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="swap-parallel-mode"
                    checked={state.cart.mode === 'parallel'}
                    onChange={(event) =>
                      dispatch({ type: 'set-cart-mode', mode: event.target.checked ? 'parallel' : 'bundle' })
                    }
                  />
                  <label className="form-check-label" htmlFor="swap-parallel-mode">
                    Best-effort fills
                    <span className="d-block small text-body-secondary">
                      {state.cart.mode === 'parallel'
                        ? 'Parallel mode: higher execution assurance, higher fees.'
                        : 'Bundle mode: cheaper atomic execution.'}
                    </span>
                  </label>
                </div>
              </div>
              <div className="col-12 col-xl-6">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="swap-pay-up"
                    checked={state.forms.swapPayUp}
                    onChange={(event) => dispatch({ type: 'set-forms', forms: { swapPayUp: event.target.checked } })}
                  />
                  <label className="form-check-label" htmlFor="swap-pay-up">
                    Pay up for lower contention
                    <span className="d-block small text-body-secondary">
                      {payUpLabel}
                    </span>
                  </label>
                </div>
              </div>
              <div className="col-12">
                <div
                  className={`swap-quote-summary-text ${
                    swapQuote.outputQuantity > 0n ? quoteTextClass(swapQuote.severity) : 'swap-quote-summary-info'
                  }`}
                >
                  {swapQuote.outputQuantity > 0n
                    ? `${quoteSummary(swapQuote, offer, ask)}. Tolerance ${state.options.swapSlippageTolerancePercent}%.`
                    : 'The quote engine uses the current full-book mirror and will re-fetch before execution when stale.'}
                </div>
              </div>
              <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void runSwap()}
                  disabled={walletLaunchDisabled}
                  title={walletLaunchDisabled ? WALLET_REQUIRED_MESSAGE : 'Launch Swap in wallet'}
                >
                  Swap
                </button>
                <CartAddButton onClick={() => void addSwapToCart()} />
              </div>
            </div>
          ) : null}

          {state.tradeTab === 'open' && offer && ask ? (
            <div className="row g-4">
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="open-offer-amount"
                  label={`Offer ${assetTitle(offer)}`}
                  value={state.forms.openOfferAmount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { openOfferAmount: value } })}
                  help={`Balance ${fromBase(offerBalance, offer.decimals)} ${assetTitle(offer)}`}
                />
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="open-ask-amount"
                  label={`Ask ${assetTitle(ask)}`}
                  value={state.forms.openAskAmount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { openAskAmount: value } })}
                />
              </div>
              <div className="col-12">
                <BalanceBar value={percent(offerQuantity, offerBalance)} label="Offered versus current balance" unavailable={!state.wallet} />
              </div>
              {openWarnings.length ? (
                <div className="col-12">
                  <FormAlert tone="warning">{openWarnings.join(' ')}</FormAlert>
                </div>
              ) : null}
              <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runAction}
                  disabled={walletLaunchDisabled}
                  title={walletLaunchDisabled ? WALLET_REQUIRED_MESSAGE : 'Launch Open in wallet'}
                >
                  Open offer
                </button>
                <CartAddButton onClick={addCurrentIntentToCart} />
              </div>
            </div>
          ) : null}

          {state.tradeTab === 'bulk-open' && offer && ask ? (
            <div className="row g-4">
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="bulk-open-offer-amount"
                  label={`Offer ${assetTitle(offer)}`}
                  value={state.forms.openOfferAmount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { openOfferAmount: value } })}
                  help={`Balance ${fromBase(offerBalance, offer.decimals)} ${assetTitle(offer)}`}
                />
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="bulk-open-ask-amount"
                  label={`Ask ${assetTitle(ask)}`}
                  value={state.forms.openAskAmount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { openAskAmount: value } })}
                />
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="bulk-open-offer-variance"
                  label="Random offer variance %"
                  value={state.forms.bulkOpenOfferVariancePercent}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { bulkOpenOfferVariancePercent: value } })}
                />
              </div>              
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="bulk-open-variance"
                  label="Random price variance %"
                  value={state.forms.bulkOpenVariancePercent}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { bulkOpenVariancePercent: value } })}
                />
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="bulk-open-count"
                  label="Number of offers"
                  value={state.forms.bulkOpenCount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { bulkOpenCount: value } })}
                />
              </div>
              <div className="col-12">
                <BalanceBar
                  value={percent(offerQuantity, offerBalance)}
                  label="Offered versus current balance per offer"
                  unavailable={!state.wallet}
                />
              </div>
              <div className="col-12">
                <FormAlert tone="info">
                  Bulk-Open adds generated open-offer intents to the Cart. Wallet execution is handled later from Cart.
                </FormAlert>
              </div>
              {openWarnings.length ? (
                <div className="col-12">
                  <FormAlert tone="warning">{openWarnings.join(' ')}</FormAlert>
                </div>
              ) : null}
              <div className="col-12 d-flex justify-content-end">
                <CartAddButton onClick={addBulkOpenToCart} label={bulkOpenLabel} />
              </div>
            </div>
          ) : null}

          {state.tradeTab === 'fill' ? (
            <div className="row g-4">
              <div className="col-12">
                <FormAlert tone={currentOffer ? 'info' : 'warning'}>
                  {currentOffer
                    ? `Selected ${short(currentOffer.txHash)}#${currentOffer.txIndex}`
                    : 'Select an offer from the table below or the Orders/User views.'}
                </FormAlert>
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="fill-offer-amount"
                  label="Fill amount"
                  value={state.forms.fillOfferAmount}
                  onChange={(value) => dispatch({ type: 'set-forms', forms: { fillOfferAmount: value } })}
                />
              </div>
              <div className="col-12 col-lg-6">
                <AmountInput
                  id="fill-ask-amount"
                  label="Required ask amount"
                  value={state.forms.fillAskAmount}
                  onChange={() => undefined}
                  readOnly
                />
              </div>
              <div className="col-12">
                <BalanceBar value={percent(fillQuantity, available)} label="Fill amount versus selected offer availability" />
              </div>
              {fillWarnings.length ? (
                <div className="col-12">
                  <FormAlert tone="warning">{fillWarnings.join(' ')}</FormAlert>
                </div>
              ) : null}
              <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runAction}
                  disabled={walletLaunchDisabled}
                  title={walletLaunchDisabled ? WALLET_REQUIRED_MESSAGE : 'Launch Fill in wallet'}
                >
                  Fill offer
                </button>
                <CartAddButton onClick={addFillToCart} />
              </div>
            </div>
          ) : null}

          {state.tradeTab === 'close' ? (
            <div className="vstack gap-3">
              <FormAlert tone={currentOffer ? 'warning' : 'info'}>
                {currentOffer
                  ? `Close selected offer ${short(currentOffer.txHash)}#${currentOffer.txIndex}. Verify owner stake credential before signing.${state.wallet ? '' : ` ${WALLET_REQUIRED_MESSAGE}`}`
                  : 'Select one of your offers to close.'}
              </FormAlert>
              <div className="d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={runAction}
                  disabled={walletLaunchDisabled}
                  title={walletLaunchDisabled ? WALLET_REQUIRED_MESSAGE : 'Launch Close in wallet'}
                >
                  Close offer
                </button>
                <CartAddButton onClick={addCurrentIntentToCart} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="app-card p-3 p-lg-4">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
            <div>
              <h2 className="h5 mb-1">Pair Offers</h2>
              <p className="text-body-secondary mb-0">
                {pairOffers.length}/{state.openOffers.length} offers for the selected pair. {hiddenOffers} hidden.
              </p>
            </div>
            <ReloadButton label="Refresh pair offers" onClick={() => void refreshOffers()} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading offers" /> : null}
          <OpenOffersTable
            state={state}
            offers={pairOffers}
            {...(state.tradeTab === 'swap' ? { policyStatusByUtxo: swapPolicyStatusByUtxo } : {})}
            onFill={selectFill}
            onClose={selectClose}
          />
        </section>
      </>
    );
  }

  function renderOrders() {
    return (
      <>
        <PageHeader title="Open Offers" eyebrow="Order book" />
        <FormAlert tone={state.notices.offers.tone}>
          {offers.length} open offer{offers.length === 1 ? '' : 's'} loaded. {hiddenOffers} hidden.
        </FormAlert>
        <section className="app-card p-3 p-lg-4">
          <div className="d-flex justify-content-end mb-3">
            <ReloadButton label="Refresh open offers" onClick={() => void refreshOffers()} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading offers" /> : null}
          <OpenOffersTable state={state} offers={offers} onFill={selectFill} onClose={selectClose} />
        </section>
      </>
    );
  }

  function renderUser() {
    const ownedOffers = offers.filter((item) => isCurrentOutputOwner(item, state.wallet?.stakeKeyHash));
    const userTransactions = composeTransactionRows(state.transactions, state.wallet?.stakeKeyHash).filter(
      (transaction) => transaction.ownershipBadge,
    );
    return (
      <>
        <PageHeader title="User" eyebrow="Wallet scope" />
        <div className="row g-4">
          <section className="col-12">
            <div className="app-card p-3 p-lg-4">
              <div className="d-flex justify-content-between gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Portfolio</h2>
                  <p className="text-body-secondary mb-0">
                    {portfolio.length} assets at current address. {hiddenPortfolio} hidden.
                  </p>
                </div>
                <ReloadButton label="Refresh portfolio" onClick={refreshPortfolio} disabled={state.loading.portfolio} />
              </div>
              <FormAlert tone={state.notices.portfolio.tone}>{state.notices.portfolio.message}</FormAlert>
              {state.loading.portfolio ? <LoadingState label="Loading portfolio" /> : null}
              <PortfolioTable
                assets={portfolio}
                connected={Boolean(state.wallet)}
                onOffer={(assetKey) => dispatch({ type: 'select-asset-for-open', assetKey })}
              />
            </div>
          </section>
          <section className="col-12">
            <div className="app-card p-3 p-lg-4">
              <div className="d-flex justify-content-between gap-3 mb-3">
                <h2 className="h5 mb-0">My Open Offers</h2>
                <ReloadButton label="Refresh my open offers" onClick={() => void refreshOffers()} disabled={state.loading.offers} />
              </div>
              <OpenOffersTable state={state} offers={ownedOffers} onFill={selectFill} onClose={selectClose} />
            </div>
          </section>
          <section className="col-12">
            <div className="app-card p-3 p-lg-4">
              <h2 className="h5 mb-3">Protocol Transaction History</h2>
              <TransactionList transactions={userTransactions} network={state.options.network} />
            </div>
          </section>
        </div>
      </>
    );
  }

  function renderActivity() {
    return (
      <>
        <PageHeader title="Activity" eyebrow="Protocol" />
        <section className="app-card pair-primer p-3 p-lg-4 mb-4">
          <h2 className="h5 mb-3">1. Asset Pair</h2>
          <AssetPairSelector
            assets={selectableAssets}
            offerKey={state.forms.openOfferAssetKey}
            askKey={state.forms.openAskAssetKey}
            onOfferChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openOfferAssetKey: assetKey } })}
            onAskChange={(assetKey) => dispatch({ type: 'set-forms', forms: { openAskAssetKey: assetKey } })}
            onSwapPair={swapSelectedPair}
          />
        </section>
        <section className="app-card p-3 p-lg-4">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
            <div>
              <h2 className="h5 mb-1">Protocol Transactions</h2>
              <p className="text-body-secondary mb-0">
                Chain-verified protocol transactions and pending wallet receipts for the current network.
              </p>
            </div>
            <ReloadButton label="Refresh protocol activity" onClick={() => void refreshOffers()} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading activity" /> : null}
          <TransactionList transactions={composeTransactionRows(state.transactions, state.wallet?.stakeKeyHash)} network={state.options.network} />
        </section>
      </>
    );
  }

  function renderDeveloper() {
    return (
      <>
        <PageHeader title="Developer" eyebrow="Debug" />
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">Captured Wallet Return</h2>
          <JsonViewer value={state.lastWalletReturn || null} label="Copy captured wallet return" />
        </section>
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">App State</h2>
          <JsonViewer value={state} label="Copy app state" />
        </section>
      </>
    );
  }

  function renderCart() {
    return (
      <>
        <PageHeader title="Cart" eyebrow="Composable intents" />
        {!state.wallet ? <FormAlert tone="warning">{WALLET_REQUIRED_MESSAGE}</FormAlert> : null}
        <CartPanel
          state={state}
          dispatch={dispatch}
          onRunSelected={runCartSelected}
          runDisabled={walletLaunchDisabled}
          runDisabledReason={WALLET_REQUIRED_MESSAGE}
        />
      </>
    );
  }

  function renderCurrentView() {
    if (state.view === 'trade') return renderTrade();
    if (state.view === 'orders') return renderOrders();
    if (state.view === 'activity') return renderActivity();
    if (state.view === 'user') return renderUser();
    if (state.view === 'cart') return renderCart();
    if (state.view === 'options') {
      return (
        <>
          <PageHeader title="Options" eyebrow="Configuration" />
          <OptionsPanel state={state} onRefreshOffers={() => void refreshOffers()} onRefreshPortfolio={refreshPortfolio} />
        </>
      );
    }
    return renderDeveloper();
  }

  return (
    <AppShell>
      {state.migrationNeeded ? (
        <section className="app-card border-warning p-3 p-lg-4 mb-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <h2 className="h5 mb-2 text-warning">Stored data update available</h2>
              <p className="mb-1">
                This devtool version differs from saved local state.
              </p>
              <p className="text-body-secondary mb-0">
                Saved version: {state.migrationSourceVersion || 'none'}. Current version: {APP_CONFIG.version}.
                Updating replaces incompatible local state with current defaults and reloads the app.
              </p>
            </div>
            <div className="d-flex align-items-start">
              <button type="button" className="btn btn-warning" onClick={updateStoredState}>
                Update local state
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {state.notices.app ? <FormAlert tone={state.notices.app.tone}>{state.notices.app.message}</FormAlert> : null}
      {renderCurrentView()}
      <CartModal
        state={state}
        dispatch={dispatch}
        onRunSelected={runCartSelected}
        runDisabled={walletLaunchDisabled}
        runDisabledReason={WALLET_REQUIRED_MESSAGE}
      />
    </AppShell>
  );
}
