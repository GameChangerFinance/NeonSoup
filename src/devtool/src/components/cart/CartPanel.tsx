import type { AppAction, AppState, CartItem } from '../../state/types';
import { assetTitle } from '../../domain/assets';
import { short } from '../../domain/text';
import { resolveAsset } from '../../state/selectors';
import { selectedCartItems, visibleCartItems } from '../../services/cartIntents';
import { CopyIcon } from '../common/CopyIcon';
import { EmptyState } from '../common/EmptyState';
import { FormAlert } from '../common/FormAlert';

interface CartPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onRunSelected: () => void | Promise<void>;
  embedded?: boolean;
}

function itemSummary(state: AppState, item: CartItem): string {
  if (item.pair) {
    const offered = resolveAsset(state, item.pair.offer.policyId, item.pair.offer.assetNameHex);
    const asked = resolveAsset(state, item.pair.ask.policyId, item.pair.ask.assetNameHex);
    return `${assetTitle(offered)} / ${assetTitle(asked)}`;
  }
  return item.sourceLabel || item.name;
}

function argsSummary(item: CartItem): string {
  const intentId = item.args['intent-id'];
  const offerQuantity = item.args['offer-quantity'];
  const askQuantity = item.args['ask-quantity'];
  const price = item.args['price-numerator'] && item.args['price-denominator']
    ? `${item.args['price-numerator']}/${item.args['price-denominator']}`
    : '';
  return [intentId ? `id ${intentId}` : '', offerQuantity ? `offer ${offerQuantity}` : '', askQuantity ? `ask ${askQuantity}` : '', price ? `price ${price}` : '']
    .filter(Boolean)
    .join(' · ');
}

function sourceRef(item: CartItem): string {
  const txHash = item.args['utxo-tx-hash'];
  const txIndex = item.args['utxo-tx-index'];
  return txHash && txIndex ? `${txHash}#${txIndex}` : '';
}

function statusClass(status: CartItem['status']): string {
  if (status === 'executed') return 'text-bg-success';
  if (status === 'failed') return 'text-bg-danger';
  return 'text-bg-secondary';
}

export function CartPanel({ state, dispatch, onRunSelected, embedded = false }: CartPanelProps) {
  const visibleItems = visibleCartItems(state.cart);
  const selectedItems = selectedCartItems(state.cart);
  const selectedVisibleIds = visibleItems.filter((item) => item.selected).map((item) => item.id);
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => item.selected);
  const executedCount = state.cart.items.filter((item) => item.status === 'executed').length;

  return (
    <section className={embedded ? '' : 'app-card p-3 p-lg-4'}>
      <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Cart</h2>
          <p className="text-body-secondary mb-0">
            {selectedItems.length} selected of {state.cart.items.length} intent{state.cart.items.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-start justify-content-lg-end gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={onRunSelected}>
            Run selected
          </button>
          <div className="form-check form-switch mb-0">
            <input
              id="cart-bundle-mode"
              className="form-check-input"
              type="checkbox"
              checked={state.cart.mode === 'bundle'}
              onChange={(event) =>
                dispatch({ type: 'set-cart-mode', mode: event.target.checked ? 'bundle' : 'parallel' })
              }
            />
            <label className="form-check-label small" htmlFor="cart-bundle-mode">
              Bundle
            </label>
          </div>
          <label className="small text-body-secondary" htmlFor="cart-max-intents">
            Max
          </label>
          <input
            id="cart-max-intents"
            type="number"
            min="1"
            className="form-control form-control-sm cart-number-input"
            value={state.cart.maxIntentsPerTransaction}
            onChange={(event) =>
              dispatch({
                type: 'set-cart-max-intents-per-transaction',
                value: Number(event.target.value),
              })
            }
          />
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => dispatch({ type: 'select-all-visible-cart-items' })}>
          Select all
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => dispatch({ type: 'deselect-all-cart-items' })}>
          Deselect all
        </button>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={!selectedVisibleIds.length}
          onClick={() => dispatch({ type: 'remove-cart-items', itemIds: selectedVisibleIds })}
        >
          Remove selected
        </button>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={!executedCount}
          onClick={() => dispatch({ type: 'purge-executed-cart-items' })}
        >
          Purge executed
        </button>
        <div className="form-check form-switch d-flex align-items-center gap-2 mb-0 ms-lg-auto">
          <input
            id="cart-show-executed-only"
            className="form-check-input"
            type="checkbox"
            checked={state.cart.showExecutedOnly}
            onChange={(event) =>
              dispatch({ type: 'set-cart-show-executed-only', showExecutedOnly: event.target.checked })
            }
          />
          <label className="form-check-label small" htmlFor="cart-show-executed-only">
            Show executed only
          </label>
        </div>
      </div>

      {state.cart.mode === 'bundle' ? (
        <FormAlert tone="info">Bundling is scaffolded. Final composable GCScript generation is intentionally pending.</FormAlert>
      ) : (
        <FormAlert tone="info">Parallel execution is scaffolded. Final composable GCScript generation is intentionally pending.</FormAlert>
      )}

      {visibleItems.length ? (
        <div className="table-responsive scroll-panel">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th className="cart-select-cell">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    aria-label="Select all visible Cart items"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      dispatch({
                        type: 'set-cart-items-selected',
                        itemIds: visibleItems.map((item) => item.id),
                        selected: event.target.checked,
                      })
                    }
                  />
                </th>
                <th>Intent</th>
                <th>Details</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const ref = sourceRef(item);
                return (
                  <tr key={item.id} className={item.status === 'executed' ? 'cart-row-executed' : undefined}>
                    <td>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        aria-label={`Select ${item.id}`}
                        checked={item.selected}
                        onChange={(event) =>
                          dispatch({ type: 'set-cart-item-selected', itemId: item.id, selected: event.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span className="badge text-bg-primary text-uppercase">{item.name}</span>
                          <span className="fw-semibold">{itemSummary(state, item)}</span>
                        </div>
                        <span className="small text-body-secondary hash-text">
                          {short(item.id)}
                          <CopyIcon value={item.id} label="Copy Cart item id" />
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <div>{item.sourceLabel || argsSummary(item) || 'No summary'}</div>
                        {ref ? (
                          <div className="text-body-secondary hash-text">
                            {short(ref)}
                            <CopyIcon value={ref} label="Copy source UTxO" />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${statusClass(item.status)}`}>{item.status}</span>
                      {item.executedAt ? (
                        <div className="small text-body-secondary mt-1">{new Date(item.executedAt).toLocaleString()}</div>
                      ) : null}
                    </td>
                    <td className="small text-body-secondary">{new Date(item.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="d-flex justify-content-end">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => dispatch({ type: 'remove-cart-item', itemId: item.id })}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={state.cart.items.length ? 'No Cart items match this filter.' : 'Cart is empty.'}
          detail={state.cart.items.length ? 'Toggle Show executed only to switch between pending and executed items.' : 'Add Open, Fill, Close, or Bulk-Open intents.'}
        />
      )}
    </section>
  );
}
