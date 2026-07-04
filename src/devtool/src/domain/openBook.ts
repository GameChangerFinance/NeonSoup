import type { NetworkProviderKind, NetworkTag, OpenBookSnapshot } from '../state/types';

export function createOpenBookSnapshot(
  provider: NetworkProviderKind,
  network: NetworkTag,
  orderCount: number,
  updatedAt = Date.now(),
): OpenBookSnapshot {
  return {
    provider,
    network,
    updatedAt,
    orderCount,
  };
}

export function openBookSnapshotIsFresh(
  snapshot: OpenBookSnapshot | null,
  provider: NetworkProviderKind,
  network: NetworkTag,
  now: number,
  maxAgeMs: number,
): boolean {
  if (!snapshot) return false;
  if (snapshot.provider !== provider || snapshot.network !== network) return false;
  return now - snapshot.updatedAt <= maxAgeMs;
}
