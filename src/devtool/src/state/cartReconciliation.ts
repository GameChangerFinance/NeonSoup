import type { CartItem } from './types';

export function reconcileCartItemsByTransactionStatus(
  items: readonly CartItem[],
  confirmedTxHashes: ReadonlySet<string>,
  failedTxHashes: ReadonlySet<string>,
  confirmedAt: number,
): CartItem[] {
  return items.map((item) => {
    if (item.status !== 'pending' || !item.txHash) return item;
    if (failedTxHashes.has(item.txHash)) return { ...item, status: 'failed', selected: false };
    if (!confirmedTxHashes.has(item.txHash)) return item;
    return {
      ...item,
      status: 'confirmed',
      confirmedAt,
      selected: false,
      walletSubmitError: false,
    };
  });
}
