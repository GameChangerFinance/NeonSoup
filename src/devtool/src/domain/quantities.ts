import { text } from './text';

export function toBase(value: string, decimals: number): bigint {
  const raw = text(value).trim();
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) return 0n;
  const [whole = '0', fraction = ''] = raw.split('.');
  return (
    BigInt(whole || '0') * 10n ** BigInt(decimals) +
    BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0')
  );
}

export function fromBase(quantity: string | bigint, decimals: number): string {
  const n = typeof quantity === 'bigint' ? quantity : BigInt(text(quantity || '0'));
  const scale = 10n ** BigInt(decimals);
  const whole = n / scale;
  const fraction = (n % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) return 0n;
  return (a + b - 1n) / b;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1n;
}

export function percent(value: bigint, max: bigint): number {
  if (max <= 0n) return value > 0n ? 200 : 0;
  return Math.max(0, Math.min(200, Number((value * 10000n) / max) / 100));
}
