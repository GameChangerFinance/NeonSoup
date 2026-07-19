export function formatBalancePercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  if (value > 0 && value < 0.01) return '<0.01%';
  if (value < 1) return `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
  return `${value.toFixed(1)}%`;
}
