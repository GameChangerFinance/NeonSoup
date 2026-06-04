import type { PortfolioAsset } from '../../state/types';
import { assetDescription, assetKeyOf } from '../../domain/assets';
import { fromBase } from '../../domain/quantities';
import { short } from '../../domain/text';
import { AssetBadge } from '../assets/AssetBadge';
import { CopyIcon } from '../common/CopyIcon';
import { EmptyState } from '../common/EmptyState';

interface PortfolioTableProps {
  assets: PortfolioAsset[];
  connected: boolean;
  onOffer: (assetKey: string) => void;
}

export function PortfolioTable({ assets, connected, onOffer }: PortfolioTableProps) {
  if (!connected) {
    return <EmptyState title="Connect wallet to inspect current address balances." />;
  }
  if (!assets.length) {
    return <EmptyState title="No assets match this view." detail="Unknown assets may be hidden." />;
  }

  return (
    <div className="table-responsive scroll-panel">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Balance</th>
            <th>AssetID</th>
            <th className="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.unit}>
              <td>
                <AssetBadge asset={asset} showDescription />
                {assetDescription(asset) ? null : <div className="small text-body-secondary">No trusted description.</div>}
              </td>
              <td className="fw-semibold">{fromBase(asset.quantity, asset.decimals)}</td>
              <td className="small text-body-secondary hash-text">
                {asset.unit === 'lovelace' ? 'lovelace' : short(asset.unit, 14, 10)}
                <CopyIcon value={asset.unit} label="Copy AssetID" />
              </td>
              <td className="text-end">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onOffer(assetKeyOf(asset.policyId, asset.assetNameHex))}
                >
                  Offer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
