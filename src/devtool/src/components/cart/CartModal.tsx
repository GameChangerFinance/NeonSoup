import type { AppAction, AppState } from '../../state/types';
import { CartPanel } from './CartPanel';

interface CartModalProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onRunSelected: () => void | Promise<void>;
}

export function CartModal({ state, dispatch, onRunSelected }: CartModalProps) {
  if (!state.cart.modalOpen) return null;

  return (
    <div className="modal d-block cart-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cart-modal-title">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 id="cart-modal-title" className="modal-title h5">
              Cart
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Close Cart"
              onClick={() => dispatch({ type: 'set-cart-modal-open', open: false })}
            />
          </div>
          <div className="modal-body">
            <CartPanel state={state} dispatch={dispatch} onRunSelected={onRunSelected} embedded />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop show cart-modal-backdrop"
        aria-label="Close Cart"
        onClick={() => dispatch({ type: 'set-cart-modal-open', open: false })}
      />
    </div>
  );
}
