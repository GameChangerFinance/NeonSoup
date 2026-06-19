import type { ResolvedAsset } from '../../state/types';
import { assetTitle } from '../../domain/assets';
import { assetMetadataWarningText } from '../../domain/assetWarnings';

interface AssetPickerProps {
  id: string;
  label: string;
  value: string;
  assets: Record<string, ResolvedAsset>;
  onChange: (assetKey: string) => void;
}

export function AssetPicker({ id, label, value, assets, onChange }: AssetPickerProps) {
  const warning = assetMetadataWarningText(assets[value]);
  const warningId = `${id}-metadata-warning`;
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="form-select"
        value={value}
        aria-describedby={warning ? warningId : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(assets).map(([key, asset]) => (
          <option key={key} value={key}>
            {assetTitle(asset)}
          </option>
        ))}
      </select>
      {warning ? (
        <div id={warningId} className="form-text text-warning">
          {warning}
        </div>
      ) : null}
    </div>
  );
}
