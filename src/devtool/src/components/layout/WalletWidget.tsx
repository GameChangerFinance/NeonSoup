import type { WalletConnection } from '../../state/types';
import { CopyIcon } from '../common/CopyIcon';
import { short } from '../../domain/text';

interface WalletWidgetProps {
  wallet: WalletConnection | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletWidget({ wallet, onConnect, onDisconnect }: WalletWidgetProps) {
  if (!wallet) {
    return (
      <button type="button" className="btn btn-primary" onClick={onConnect}>
        Connect wallet
      </button>
    );
  }

  return (
    <div className="card app-card">
      <div className="card-body p-3">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div className="min-w-0">
            <div className="fw-semibold">{wallet.name || 'Connected wallet'}</div>
            <div className="small text-body-secondary hash-text">
              {short(wallet.address, 18, 12)}
              <CopyIcon value={wallet.address} label="Copy wallet address" />
            </div>
            <div className="small text-body-secondary hash-text">
              {short(wallet.stakeKeyHash, 12, 8)}
              <CopyIcon value={wallet.stakeKeyHash} label="Copy stake key hash" />
            </div>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
