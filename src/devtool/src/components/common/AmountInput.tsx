import { APP_CONFIG } from '../../config/appConfig';

interface AmountInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  help?: string;
}

export function AmountInput({ id, label, value, onChange, readOnly = false, help }: AmountInputProps) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="form-control form-control-lg"
        value={value}
        min="0"
        step={APP_CONFIG.defaults.forms.amountStep}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <div className="form-text">{help}</div> : null}
    </div>
  );
}
