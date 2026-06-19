import type { ResolvedAsset } from '../../state/types';
import { AssetPicker } from './AssetPicker';

interface AssetPairSelectorProps {
  assets: Record<string, ResolvedAsset>;
  offerKey: string;
  askKey: string;
  onOfferChange: (assetKey: string) => void;
  onAskChange: (assetKey: string) => void;
  onSwapPair?: () => void;
}

export function AssetPairSelector({
  assets,
  offerKey,
  askKey,
  onOfferChange,
  onAskChange,
  onSwapPair,
}: AssetPairSelectorProps) {
  return (
    <div className="asset-pair-grid">
      <div>
        <AssetPicker id="pair-offer" label="Offer asset" value={offerKey} assets={assets} onChange={onOfferChange} />
      </div>
      {onSwapPair ? (
        <div className="asset-pair-swap">
          <button
            type="button"
            className="btn btn-outline-primary icon-btn"
            onClick={onSwapPair}
            aria-label="Swap selected asset pair"
            title="Swap selected asset pair"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7 7h10.6l-3.3-3.3 1.4-1.4L21.4 8l-5.7 5.7-1.4-1.4L17.6 9H7V7Zm10 10H6.4l3.3 3.3-1.4 1.4L2.6 16l5.7-5.7 1.4 1.4L6.4 15H17v2Z"
              />
            </svg>
          </button>
        </div>
      ) : null}
      <div>
        <AssetPicker id="pair-ask" label="Ask asset" value={askKey} assets={assets} onChange={onAskChange} />
      </div>
    </div>
  );
}
