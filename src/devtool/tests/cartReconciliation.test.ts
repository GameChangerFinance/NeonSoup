import { isConfirmedChainTransaction } from '../src/domain/transactions';
import { reconcileCartItemsByTransactionStatus } from '../src/state/cartReconciliation';
import type { CartItem } from '../src/state/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function cartItem(status: CartItem['status'], txHash?: string): CartItem {
  return {
    id: `${status}-${txHash || 'none'}`,
    name: 'fill',
    args: {},
    selected: true,
    status,
    createdAt: 1,
    ...(txHash ? { txHash } : {}),
  };
}

assert(!isConfirmedChainTransaction({ includedAt: 0 }), 'transactions without inclusion time are not confirmed');
assert(isConfirmedChainTransaction({ includedAt: 1 }), 'transactions with inclusion time are confirmed');

const reconciled = reconcileCartItemsByTransactionStatus(
  [
    cartItem('pending', 'confirmed-tx'),
    cartItem('pending', 'failed-tx'),
    cartItem('draft', 'confirmed-tx'),
    cartItem('failed', 'confirmed-tx'),
  ],
  new Set(['confirmed-tx']),
  new Set(['failed-tx']),
  123,
);

assert(reconciled[0]?.status === 'confirmed', 'pending cart item is confirmed by confirmed tx hash');
assert(reconciled[0]?.confirmedAt === 123, 'confirmed cart item receives confirmation time');
assert(reconciled[1]?.status === 'failed', 'pending cart item is failed by failed tx hash');
assert(reconciled[2]?.status === 'draft', 'draft cart item is not confirmed by stale tx hash');
assert(reconciled[3]?.status === 'failed', 'failed cart item is not re-confirmed by stale tx hash');
