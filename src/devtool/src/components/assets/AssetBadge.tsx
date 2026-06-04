import type { ResolvedAsset } from '../../state/types';
import { assetDescription, assetTitle } from '../../domain/assets';

interface AssetBadgeProps {
  asset: ResolvedAsset;
  showDescription?: boolean;
}

export function AssetBadge({ asset, showDescription = false }: AssetBadgeProps) {
  const title = assetTitle(asset);
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className="asset-icon" aria-hidden="true">
        {asset.logo ? <img alt="" src={asset.logo} /> : title.slice(0, 1)}
      </span>
      <span>
        <span className="fw-semibold">{title}</span>
        {!asset.known ? <span className="badge text-bg-warning ms-2">Unknown</span> : null}
        {showDescription && assetDescription(asset) ? (
          <span className="d-block small text-body-secondary">{assetDescription(asset)}</span>
        ) : null}
      </span>
    </span>
  );
}
