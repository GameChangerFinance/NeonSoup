import { formatBalancePercent } from '../../domain/uiFormat';

interface BalanceBarProps {
  value: number;
  label: string;
  unavailable?: boolean;
}

export function BalanceBar({ value, label, unavailable = false }: BalanceBarProps) {
  const width = Math.max(0, Math.min(100, value));
  const visibleWidth = value > 0 && width < 0.8 ? 0.8 : width;
  const over = value > 100;
  const ok = !unavailable && !over && value > 0;
  return (
    <div>
      <div className="d-flex justify-content-between gap-3 small mb-1">
        <span className="text-body-secondary">{label}</span>
        <span className={over ? 'text-danger fw-semibold' : ok ? 'text-success fw-semibold' : 'text-body-secondary'}>
          {unavailable ? 'Balance unavailable' : formatBalancePercent(value)}
        </span>
      </div>
      <div
        className={`progress ${over ? 'progress-over' : ok ? 'progress-ok' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={200}
        style={{ height: 8 }}
      >
        <div className="progress-bar" style={{ width: `${visibleWidth}%` }} />
      </div>
    </div>
  );
}
