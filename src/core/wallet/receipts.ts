import type { NeonSoupExecutionReceipt } from '../types';

export function executionReceiptFromWalletReturn(raw: unknown): NeonSoupExecutionReceipt | null {
  if (!raw || typeof raw !== 'object') return null;
  const decoded = (raw as Record<string, unknown>).decoded;
  if (!decoded || typeof decoded !== 'object') return null;
  const exports = (decoded as Record<string, unknown>).exports;
  if (!exports || typeof exports !== 'object') return null;
  const receipt = (exports as Record<string, unknown>).neonsoupExecution;
  if (!receipt || typeof receipt !== 'object') return null;
  const candidate = receipt as Partial<NeonSoupExecutionReceipt>;
  if (
    typeof candidate.executionId !== 'string' ||
    typeof candidate.itemCount !== 'number' ||
    typeof candidate.groupCount !== 'number' ||
    !Array.isArray(candidate.items) ||
    !Array.isArray(candidate.txs)
  ) {
    return null;
  }

  const itemIds = new Set<string>();
  const groupIds = new Set<string>();
  const groupIndexes = new Map<number, string>();
  const valid = candidate.items.every((item) => {
    if (
      !item ||
      typeof item.itemId !== 'string' ||
      itemIds.has(item.itemId) ||
      typeof item.intentId !== 'string' ||
      (item.type !== 'open' && item.type !== 'fill' && item.type !== 'close') ||
      typeof item.itemIndex !== 'number' ||
      typeof item.groupId !== 'string' ||
      typeof item.groupIndex !== 'number' ||
      typeof item.groupItemIndex !== 'number' ||
      typeof item.txHash !== 'string' ||
      !Array.isArray(item.outputs) ||
      !item.outputs.every(
        (output) =>
          (output.role === 'openedOffer' ||
            output.role === 'remainingOffer' ||
            output.role === 'filledOffer' ||
            output.role === 'closedFunds') &&
          (typeof output.index === 'string' || typeof output.index === 'number'),
      )
    ) {
      return false;
    }
    itemIds.add(item.itemId);
    groupIds.add(item.groupId);
    groupIndexes.set(item.groupIndex, item.groupId);
    return true;
  });
  if (!valid || itemIds.size !== candidate.itemCount || groupIds.size !== candidate.groupCount) return null;

  const txKeys = new Set<string>();
  const validTxs = candidate.txs.every((tx) => {
    if (
      !tx ||
      typeof tx.groupId !== 'string' ||
      typeof tx.groupIndex !== 'number' ||
      typeof tx.txHash !== 'string' ||
      typeof tx.status !== 'string' ||
      typeof tx.hasSubmitError !== 'boolean' ||
      typeof tx.hasContentionError !== 'boolean'
    ) {
      return false;
    }
    const key = `${tx.groupIndex}:${tx.groupId}`;
    if (txKeys.has(key)) return false;
    txKeys.add(key);
    return groupIndexes.get(tx.groupIndex) === tx.groupId;
  });

  return validTxs && txKeys.size === candidate.groupCount
    ? (candidate as NeonSoupExecutionReceipt)
    : null;
}
