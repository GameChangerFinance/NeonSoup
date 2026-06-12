import type { AppState, OpenOffer } from '../../state/types';
import { composeOpenOfferRows } from '../../domain/orders';
import { short } from '../../domain/text';
import { resolveAsset } from '../../state/selectors';
import { AssetBadge } from '../assets/AssetBadge';
import { CopyIcon } from '../common/CopyIcon';
import { EmptyState } from '../common/EmptyState';

interface OpenOffersTableProps {
  state: AppState;
  offers: OpenOffer[];
  onFill: (offer: OpenOffer) => void;
  onClose: (offer: OpenOffer) => void;
}

export function OpenOffersTable({ state, offers, onFill, onClose }: OpenOffersTableProps) {
  if (!offers.length) {
    return <EmptyState title="No offers match this view." detail="Refresh or adjust filters to inspect live offers." />;
  }

  return (
    <div className="table-responsive scroll-panel">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Offer</th>
            {/* Ask is kept in the data model but hidden to keep devtool tables compact. */}
            <th className="d-none">Ask</th>
            <th>Price</th>
            <th>Owner</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {composeOpenOfferRows(
            offers,
            state.wallet?.stakeKeyHash,
            (policyId, assetNameHex) => resolveAsset(state, policyId, assetNameHex),
          ).map((row) => {
            const { offer, offeredAsset, askAsset, ownerBadge } = row;
            return (
              <tr key={row.key} className={offer.id === state.selectedOrderId ? 'table-active' : undefined}>
                <td>
                  <div className="d-flex flex-column gap-2">
                    <AssetBadge asset={offeredAsset} />
                    <div className="fw-semibold">
                      {row.offeredAmount} {row.offeredTitle}
                    </div>
                    <div className="small text-body-secondary hash-text">
                      {short(offer.txHash)}#{offer.txIndex}
                      <CopyIcon value={row.utxoRef} label="Copy UTxO reference" />
                    </div>
                  </div>
                </td>
                <td className="d-none">
                  <AssetBadge asset={askAsset} />
                </td>
                <td>
                  <div className="small price-cell">
                    <div className="d-flex flex-wrap align-items-center fw-semibold">
                      <span className="price-leg">
                        <span>1</span>
                        <AssetBadge asset={offeredAsset} />
                      </span>
                      <span className="price-separator">/</span>
                      <span className="price-leg">
                        <span>{row.formattedRate}</span>
                        <AssetBadge asset={askAsset} />
                      </span>
                      <span className="text-body-secondary price-fraction">
                        ({offer.priceNumerator}/{offer.priceDenominator})
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`badge rounded-pill ${ownerBadge ? 'text-bg-success' : 'text-bg-secondary'}`}
                    title={ownerBadge?.title}
                  >
                    {ownerBadge?.label || short(offer.ownerStakeKeyHash)}
                  </span>
                  <CopyIcon value={offer.ownerStakeKeyHash} label="Copy owner stake key hash" />
                </td>
                <td>
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onFill(offer)}>
                      Fill
                    </button>
                    {ownerBadge ? (
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onClose(offer)}>
                        Close
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
