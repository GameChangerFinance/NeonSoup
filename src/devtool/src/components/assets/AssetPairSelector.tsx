import type { ResolvedAsset } from '../../state/types';
import { AssetPicker } from './AssetPicker';

interface AssetPairSelectorProps {
  assets: Record<string, ResolvedAsset>;
  offerKey: string;
  askKey: string;
  onOfferChange: (assetKey: string) => void;
  onAskChange: (assetKey: string) => void;
}

export function AssetPairSelector({
  assets,
  offerKey,
  askKey,
  onOfferChange,
  onAskChange,
}: AssetPairSelectorProps) {
  return (
    <div className="row g-3">
      <div className="col-12 col-md-6">
        <AssetPicker id="pair-offer" label="Offer asset" value={offerKey} assets={assets} onChange={onOfferChange} />
      </div>
      <div className="col-12 col-md-6">
        <AssetPicker id="pair-ask" label="Ask asset" value={askKey} assets={assets} onChange={onAskChange} />
      </div>
    </div>
  );
}
