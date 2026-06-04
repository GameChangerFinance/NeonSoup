import type { ResolvedAsset } from '../../state/types';
import { assetTitle } from '../../domain/assets';

interface AssetPickerProps {
  id: string;
  label: string;
  value: string;
  assets: Record<string, ResolvedAsset>;
  onChange: (assetKey: string) => void;
}

export function AssetPicker({ id, label, value, assets, onChange }: AssetPickerProps) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="form-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(assets).map(([key, asset]) => (
          <option key={key} value={key}>
            {assetTitle(asset)}
          </option>
        ))}
      </select>
    </div>
  );
}
