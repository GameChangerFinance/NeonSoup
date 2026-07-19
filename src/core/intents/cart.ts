import type { ActionMode, AssetPair, CartItem, CartState, IntentArgs } from '../types';

export interface CartValidationResult {
  ok: boolean;
  message?: string;
}

export interface CartItemSnapshotInput {
  action: ActionMode;
  args: IntentArgs;
  intentId: string;
  createdAt: number;
  sourceOfferId?: string;
  sourceLabel?: string;
  pair?: AssetPair;
}

export function pairForArgs(args: IntentArgs): AssetPair | undefined {
  const offerPolicyId = args['offer-policy-id'];
  const offerAssetName = args['offer-asset-name'];
  const askPolicyId = args['ask-policy-id'];
  const askAssetName = args['ask-asset-name'];
  if (!offerPolicyId || !askPolicyId) return undefined;
  return {
    offer: { policyId: offerPolicyId, assetNameHex: offerAssetName || '' },
    ask: { policyId: askPolicyId, assetNameHex: askAssetName || '' },
  };
}

export function createCartItemSnapshot({
  action,
  args,
  intentId,
  createdAt,
  sourceOfferId,
  sourceLabel,
  pair = pairForArgs(args),
}: CartItemSnapshotInput): CartItem {
  return {
    id: `${action}-${intentId}`,
    name: action,
    args: { ...args, 'intent-id': intentId },
    selected: true,
    status: 'draft',
    createdAt,
    ...(sourceOfferId ? { sourceOfferId } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(pair ? { pair } : {}),
  };
}

export function sourceRef(item: Pick<CartItem, 'args'>): string {
  const txHash = item.args['utxo-tx-hash'];
  const txIndex = item.args['utxo-tx-index'];
  return txHash && txIndex ? `${txHash}#${txIndex}` : '';
}

export function bookedSourceRefs(cart: Pick<CartState, 'items'>): Set<string> {
  const refs = new Set<string>();
  for (const item of cart.items) {
    if (item.name !== 'fill' && item.name !== 'close') continue;
    const ref = sourceRef(item);
    if (ref) refs.add(ref);
  }
  return refs;
}

export function cartItemsWithoutSourceCollisions(
  cart: Pick<CartState, 'items'>,
  items: readonly CartItem[],
): CartItem[] {
  const existingIds = new Set(cart.items.map((item) => item.id));
  const activeRefs = bookedSourceRefs(cart);
  const accepted: CartItem[] = [];

  for (const item of items) {
    if (existingIds.has(item.id)) continue;
    existingIds.add(item.id);

    if (item.name === 'fill' || item.name === 'close') {
      const ref = sourceRef(item);
      if (ref && activeRefs.has(ref)) continue;
      if (ref) activeRefs.add(ref);
    }

    accepted.push(item);
  }

  return accepted;
}

export function selectedCartItems(cart: CartState): CartItem[] {
  return cart.items.filter((item) => item.selected);
}

export function visibleCartItems(cart: CartState): CartItem[] {
  return cart.showConfirmedOnly
    ? cart.items.filter((item) => item.status !== 'draft')
    : cart.items.filter((item) => item.status === 'draft');
}

export function validateCartItemsCanBeAdded(cart: CartState, items: CartItem[]): CartValidationResult {
  const existingIds = new Set(cart.items.map((item) => item.id));
  for (const item of items) {
    if (existingIds.has(item.id)) {
      return { ok: false, message: `Intent ${item.id} is already in the Cart.` };
    }
    existingIds.add(item.id);
  }

  const activeRefs = bookedSourceRefs(cart);
  for (const item of items) {
    if (item.name !== 'fill' && item.name !== 'close') continue;
    const ref = sourceRef(item);
    if (ref && activeRefs.has(ref)) {
      return { ok: false, message: `Source UTxO ${ref} is already used by another Cart item.` };
    }
    if (ref) activeRefs.add(ref);
  }

  return { ok: true };
}
