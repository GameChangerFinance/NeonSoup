import { useEffect, useMemo } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PageHeader } from './components/layout/PageHeader';
import { AssetPairSelector } from './components/assets/AssetPairSelector';
import { AmountInput } from './components/common/AmountInput';
import { BalanceBar } from './components/common/BalanceBar';
import { FormAlert } from './components/common/FormAlert';
import { LoadingState } from './components/common/LoadingState';
import { ReloadButton } from './components/common/ReloadButton';
import { OpenOffersTable } from './components/orders/OpenOffersTable';
import { PortfolioTable } from './components/portfolio/PortfolioTable';
import { TransactionList, type TransactionRow } from './components/transactions/TransactionList';
import { GeneratedIntentPanel } from './components/intents/GeneratedIntentPanel';
import { OptionsPanel } from './components/options/OptionsPanel';
import { useAppDispatch, useAppState } from './state/appState';
import { assetMap, balanceOf, resolveAsset, selectedOffer, visibleOffers, visiblePortfolio } from './state/selectors';
import { assetTitle, configuredAssets } from './domain/assets';
import { fromBase, percent, toBase } from './domain/quantities';
import { safeError, short } from './domain/text';
import { loadAssetInfo, loadOpenOffers, loadPortfolio } from './services/networkProvider';
import { captureWalletReturn, consumeWalletReturn, openWallet } from './services/gcWallet';
import { buildArgsForAction, loadIntentTemplates, fillAskAmount } from './services/intents';
import { readWalletReturn } from './services/storage';
import { APP_CONFIG } from './config/appConfig';
import type { ActionMode, OpenOffer, ProtocolTransaction, WalletConnection } from './state/types';

function pairMatches(stateOffer: OpenOffer, offerKey: string, askKey: string, assets: ReturnType<typeof assetMap>) {
  const offer = assets[offerKey];
  const ask = assets[askKey];
  if (!offer || !ask) return true;
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

function findStringField(value: unknown, field: string, depth = 0): string {
  if (!value || typeof value !== 'object' || depth > 8) return '';
  const record = value as Record<string, unknown>;
  if (typeof record[field] === 'string' && record[field]) return record[field];
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findStringField(item, field, depth + 1);
        if (found) return found;
      }
    } else if (child && typeof child === 'object') {
      const found = findStringField(child, field, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function actionFromReturn(raw: unknown, fallback: ActionMode): ActionMode {
  if (!raw || typeof raw !== 'object') return fallback;
  const decoded = (raw as Record<string, unknown>).decoded;
  const exports =
    decoded && typeof decoded === 'object' && (decoded as Record<string, unknown>).exports
      ? ((decoded as Record<string, unknown>).exports as Record<string, unknown>)
      : {};
  if ('openLimitOrder' in exports) return 'open';
  if ('swapLimitOrder' in exports) return 'fill';
  if ('closeLimitOrder' in exports) return 'close';
  return fallback;
}

function transactionFromReturn(raw: unknown, fallbackAction: ActionMode): ProtocolTransaction | null {
  if (!raw || typeof raw !== 'object') return null;
  const at = Number((raw as Record<string, unknown>).at) || Date.now();
  const txHash = findStringField(raw, 'txHash');
  if (!txHash) return null;
  const action = actionFromReturn(raw, fallbackAction);
  return {
    id: `${action}-${txHash}-${at}`,
    txHash,
    action,
    status: 'submitted',
    at,
    summary: `${action.charAt(0).toUpperCase() + action.slice(1)} wallet result captured.`,
  };
}

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const assets = assetMap(state);
  const selectableAssets = configuredAssets(state.options.network, state.customAssets);
  const offer = assets[state.forms.openOfferAssetKey];
  const ask = assets[state.forms.openAskAssetKey];
  const currentOffer = selectedOffer(state);
  const offers = visibleOffers(state);
  const pairOffers = offers.filter((item) =>
    pairMatches(item, state.forms.openOfferAssetKey, state.forms.openAskAssetKey, assets),
  );
  const portfolio = visiblePortfolio(state);
  const hiddenOffers = Math.max(0, state.openOffers.length - offers.length);
  const hiddenPortfolio = Math.max(0, state.portfolio.length - portfolio.length);

  function offerToTransaction(item: OpenOffer): TransactionRow {
    const offeredAsset = resolveAsset(state, item.offerPolicyId, item.offerAssetName);
    const askAsset = resolveAsset(state, item.askPolicyId, item.askAssetName);
    const userOwned = Boolean(state.wallet?.stakeKeyHash && item.ownerStakeKeyHash === state.wallet.stakeKeyHash);
    return {
      id: `active-offer-${item.id}`,
      txHash: item.txHash,
      action: 'open',
      status: 'confirmed',
      at: 0,
      userOwned,
      summary: `${fromBase(item.utxoOfferQuantity, offeredAsset.decimals)} ${assetTitle(
        offeredAsset,
      )} asking ${assetTitle(askAsset)}`,
    };
  }

  function protocolTransactions(items: OpenOffer[] = state.openOffers): TransactionRow[] {
    const openOfferTransactions = items.map(offerToTransaction);
    const confirmedHashes = new Set(openOfferTransactions.map((tx) => tx.txHash));
    return [
      ...state.transactions
        .filter((tx) => !confirmedHashes.has(tx.txHash))
        .map((tx) => ({
          ...tx,
          userOwned: Boolean(state.wallet?.stakeKeyHash && tx.pair),
        })),
      ...openOfferTransactions,
    ];
  }

  function applyWalletReturn(raw: unknown, shouldConsume: boolean) {
    if (!raw) return;
    const wallet = shouldConsume ? consumeWalletReturn(raw) || walletFromReturn(raw) : walletFromReturn(raw);
    const transaction = transactionFromReturn(raw, state.action);

    dispatch({ type: 'set-wallet-return', payload: raw });
    if (wallet) dispatch({ type: 'set-wallet', wallet });
    if (transaction) dispatch({ type: 'add-transaction', tx: transaction });
    dispatch({
      type: 'set-notice',
      key: 'app',
      notice: { tone: 'success', message: 'Wallet response captured.' },
    });

    void refreshOffers();
    if (state.wallet?.address || wallet?.address) void refreshPortfolio();
  }

  useEffect(() => {
    loadIntentTemplates()
      .then((intents) => dispatch({ type: 'set-intents', intents }))
      .catch((error) =>
        dispatch({ type: 'set-notice', key: 'app', notice: { tone: 'danger', message: safeError(error) } }),
      );
  }, [dispatch]);

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
    void refreshOffers();
    if (state.wallet?.address) void refreshPortfolio();
    // Network/provider changes should refresh data; avoid depending on all state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider]);

  useEffect(() => {
    if (state.wallet?.address) void refreshPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wallet?.address]);

  useEffect(() => {
    dispatch({ type: 'set-forms', forms: { fillAskAmount: fillAskAmount(state) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.forms.fillOfferAmount, state.selectedOrderId, state.openOffers, state.assetInfo]);

  useEffect(() => {
    const args = buildArgsForAction(state);
    if (JSON.stringify(args) !== JSON.stringify(state.intentArgs[state.action])) {
      dispatch({ type: 'set-intent-args', action: state.action, args });
    }
  }, [
    state.action,
    state.forms,
    state.wallet?.address,
    state.wallet?.stakeKeyHash,
    state.selectedOrderId,
    state.openOffers,
    state.assetInfo,
    dispatch,
  ]);

  useEffect(() => {
    if (!offer || !ask || state.action !== 'open') return;
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
  }, [ask, dispatch, offer, state.action, state.selectedPair]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshOffers();
      if (state.wallet?.address) void refreshPortfolio();
    }, APP_CONFIG.pollingIntervalMs);
    return () => window.clearInterval(id);
    // Polling uses current visible network/wallet state through dependency reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.options.network, state.options.provider, state.wallet?.address]);

  async function refreshOffers() {
    dispatch({ type: 'set-loading', key: 'offers', value: true });
    dispatch({ type: 'set-notice', key: 'offers', notice: { tone: 'warning', message: 'Loading open offers...' } });
    try {
      const loaded = await loadOpenOffers(state);
      const info = { ...state.assetInfo };
      for (const item of loaded) {
        const offered = await loadAssetInfo(state, item.offerPolicyId, item.offerAssetName);
        const asked = await loadAssetInfo(state, item.askPolicyId, item.askAssetName);
        info[offered.assetKey] = offered;
        info[asked.assetKey] = asked;
      }
      dispatch({ type: 'set-asset-info', assets: info });
      dispatch({ type: 'set-open-offers', offers: loaded });
      dispatch({
        type: 'set-notice',
        key: 'offers',
        notice: {
          tone: loaded.length ? 'success' : 'warning',
          message: `${loaded.length} open offer${loaded.length === 1 ? '' : 's'} loaded.`,
        },
      });
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'offers',
        notice: { tone: 'danger', message: `Could not load open offers: ${safeError(error)}` },
      });
    } finally {
      dispatch({ type: 'set-loading', key: 'offers', value: false });
    }
  }

  async function refreshPortfolio() {
    if (!state.wallet?.address) {
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: { tone: 'warning', message: 'Connect wallet to load portfolio.' },
      });
      return;
    }
    dispatch({ type: 'set-loading', key: 'portfolio', value: true });
    try {
      const loaded = await loadPortfolio(state, state.wallet.address);
      const info = Object.fromEntries(loaded.map((asset) => [asset.assetKey, asset]));
      dispatch({ type: 'set-asset-info', assets: info });
      dispatch({ type: 'set-portfolio', portfolio: loaded });
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: { tone: loaded.length ? 'success' : 'warning', message: `${loaded.length} assets at current address.` },
      });
    } catch (error) {
      dispatch({
        type: 'set-notice',
        key: 'portfolio',
        notice: { tone: 'danger', message: `Could not load portfolio: ${safeError(error)}` },
      });
    } finally {
      dispatch({ type: 'set-loading', key: 'portfolio', value: false });
    }
  }

  function selectFill(item: OpenOffer) {
    dispatch({ type: 'select-offer-for-fill', offer: item, amount: '' });
  }

  function selectClose(item: OpenOffer) {
    dispatch({ type: 'select-offer-for-close', offer: item });
  }

  async function runAction() {
    try {
      await openWallet(state);
    } catch (error) {
      dispatch({ type: 'set-notice', key: 'app', notice: { tone: 'danger', message: safeError(error) } });
    }
  }

  const openWarnings = useMemo(() => {
    if (!offer || !ask) return ['Select both assets.'];
    const warnings: string[] = [];
    const offerQuantity = toBase(state.forms.openOfferAmount, offer.decimals);
    const offerBalance = balanceOf(state, offer.policyId, offer.assetNameHex);
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
    if (quantity > available) warnings.push('Fill amount exceeds selected offer availability.');
    if (currentOffer.offerPolicyId === currentOffer.askPolicyId && currentOffer.offerAssetName === currentOffer.askAssetName) {
      warnings.push('Same asset pair.');
    }
    return warnings;
  }, [currentOffer, state, state.forms.fillOfferAmount]);

  function renderTrade() {
    const offerBalance = offer ? balanceOf(state, offer.policyId, offer.assetNameHex) : 0n;
    const offerQuantity = offer ? toBase(state.forms.openOfferAmount, offer.decimals) : 0n;
    const selectedOfferedAsset = currentOffer
      ? resolveAsset(state, currentOffer.offerPolicyId, currentOffer.offerAssetName)
      : null;
    const fillQuantity = selectedOfferedAsset ? toBase(state.forms.fillOfferAmount, selectedOfferedAsset.decimals) : 0n;
    const available = BigInt(currentOffer?.utxoOfferQuantity || '0');

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
          />
        </section>

        <section className="app-card p-3 p-lg-4 mb-4">
          <div className="btn-group mb-4" role="group" aria-label="Trade action">
            {(['open', 'fill', 'close'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`btn ${state.action === mode ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => dispatch({ type: 'set-action', action: mode })}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {state.action === 'open' && offer && ask ? (
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
                <BalanceBar value={percent(offerQuantity, offerBalance)} label="Offered versus current balance" />
              </div>
              {openWarnings.length ? (
                <div className="col-12">
                  <FormAlert tone="warning">{openWarnings.join(' ')}</FormAlert>
                </div>
              ) : null}
              <div className="col-12 d-flex justify-content-end">
                <button type="button" className="btn btn-primary" onClick={runAction}>
                  Open offer
                </button>
              </div>
            </div>
          ) : null}

          {state.action === 'fill' ? (
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
              <div className="col-12 d-flex justify-content-end">
                <button type="button" className="btn btn-primary" onClick={runAction}>
                  Fill offer
                </button>
              </div>
            </div>
          ) : null}

          {state.action === 'close' ? (
            <div className="vstack gap-3">
              <FormAlert tone={currentOffer ? 'warning' : 'info'}>
                {currentOffer
                  ? `Close selected offer ${short(currentOffer.txHash)}#${currentOffer.txIndex}. Verify owner stake credential before signing.`
                  : 'Select one of your offers to close.'}
              </FormAlert>
              <div className="d-flex justify-content-end">
                <button type="button" className="btn btn-outline-danger" onClick={runAction}>
                  Close offer
                </button>
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
            <ReloadButton label="Refresh pair offers" onClick={refreshOffers} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading offers" /> : null}
          <OpenOffersTable state={state} offers={pairOffers} onFill={selectFill} onClose={selectClose} />
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
            <ReloadButton label="Refresh open offers" onClick={refreshOffers} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading offers" /> : null}
          <OpenOffersTable state={state} offers={offers} onFill={selectFill} onClose={selectClose} />
        </section>
      </>
    );
  }

  function renderUser() {
    const ownedOffers = offers.filter((item) => state.wallet?.stakeKeyHash && item.ownerStakeKeyHash === state.wallet.stakeKeyHash);
    const confirmedHashes = new Set(ownedOffers.map((offer) => offer.txHash));
    const userTransactions = [
      ...state.transactions.filter((tx) => !confirmedHashes.has(tx.txHash)).map((tx) => ({ ...tx, userOwned: true })),
      ...ownedOffers.map(offerToTransaction),
    ];
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
                <ReloadButton label="Refresh my open offers" onClick={refreshOffers} disabled={state.loading.offers} />
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
          />
        </section>
        <section className="app-card p-3 p-lg-4">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
            <div>
              <h2 className="h5 mb-1">Protocol Transactions</h2>
              <p className="text-body-secondary mb-0">
                Open protocol UTxOs and wallet-return transactions for the current network.
              </p>
            </div>
            <ReloadButton label="Refresh protocol activity" onClick={refreshOffers} disabled={state.loading.offers} />
          </div>
          {state.loading.offers ? <LoadingState label="Loading activity" /> : null}
          <TransactionList transactions={protocolTransactions()} network={state.options.network} />
        </section>
      </>
    );
  }

  function renderDeveloper() {
    return (
      <>
        <PageHeader title="Developer" eyebrow="Debug" />
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">Protocol Intents</h2>
          <div className="d-flex flex-wrap gap-2">
            {Object.entries(APP_CONFIG.intentFiles).map(([name, path]) => (
              <a
                key={name}
                className="btn btn-outline-primary btn-sm"
                href={path}
                target="_blank"
                rel="noreferrer"
              >
                {name}.gcscript.json
              </a>
            ))}
          </div>
        </section>
        <GeneratedIntentPanel state={state} onRun={runAction} />
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">Intent Bundle</h2>
          <pre className="bg-body-tertiary border rounded p-3 small json-scroll mb-0">
            {JSON.stringify(state.intentBundle, null, 2)}
          </pre>
        </section>
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">Captured Wallet Return</h2>
          <pre className="bg-body-tertiary border rounded p-3 small json-scroll mb-0">
            {JSON.stringify(state.lastWalletReturn || null, null, 2)}
          </pre>
        </section>
        <section className="app-card p-3 p-lg-4 mt-4">
          <h2 className="h5 mb-3">App State</h2>
          <pre className="bg-body-tertiary border rounded p-3 small json-scroll mb-0">
            {JSON.stringify(state, null, 2)}
          </pre>
        </section>
      </>
    );
  }

  function renderCurrentView() {
    if (state.view === 'trade') return renderTrade();
    if (state.view === 'orders') return renderOrders();
    if (state.view === 'activity') return renderActivity();
    if (state.view === 'user') return renderUser();
    if (state.view === 'options') {
      return (
        <>
          <PageHeader title="Options" eyebrow="Configuration" />
          <OptionsPanel state={state} onRefreshOffers={refreshOffers} onRefreshPortfolio={refreshPortfolio} />
        </>
      );
    }
    return renderDeveloper();
  }

  return (
    <AppShell>
      {state.notices.app ? <FormAlert tone={state.notices.app.tone}>{state.notices.app.message}</FormAlert> : null}
      {renderCurrentView()}
    </AppShell>
  );
}
