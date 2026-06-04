interface BalanceBarProps {
  value: number;
  label: string;
}

export function BalanceBar({ value, label }: BalanceBarProps) {
  const width = Math.max(0, Math.min(100, value));
  const over = value > 100;
  return (
    <div>
      <div className="d-flex justify-content-between gap-3 small mb-1">
        <span className="text-body-secondary">{label}</span>
        <span className={over ? 'text-danger fw-semibold' : 'text-body-secondary'}>
          {Number.isFinite(value) ? `${value.toFixed(1)}%` : '0%'}
        </span>
      </div>
      <div
        className={`progress ${over ? 'progress-over' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={200}
        style={{ height: 8 }}
      >
        <div className="progress-bar" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
