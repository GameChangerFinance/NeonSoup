export function text(value: unknown): string {
  return value == null ? '' : String(value);
}

export function short(value: unknown, start = 10, end = 8): string {
  const s = text(value);
  return s.length > start + end + 3 ? `${s.slice(0, start)}...${s.slice(-end)}` : s;
}

export function truncate(value: unknown, max: number): string {
  const s = text(value).trim();
  return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}...` : s;
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.message : text(error) || 'Unknown error';
}
