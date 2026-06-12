import type { OpenOffer, ProtocolTransaction } from '../state/types';

export type OwnershipBadgeKind = 'current-output-owner' | 'transaction-participant';

export interface OwnershipBadge {
  kind: OwnershipBadgeKind;
  label: string;
  title: string;
}

export function isCurrentOutputOwner(
  offer: Pick<OpenOffer, 'ownerStakeKeyHash'>,
  walletStakeKeyHash?: string,
): boolean {
  return Boolean(walletStakeKeyHash && offer.ownerStakeKeyHash === walletStakeKeyHash);
}

export function currentOutputOwnerBadge(
  offer: Pick<OpenOffer, 'ownerStakeKeyHash'>,
  walletStakeKeyHash?: string,
): OwnershipBadge | null {
  if (!isCurrentOutputOwner(offer, walletStakeKeyHash)) return null;
  return {
    kind: 'current-output-owner',
    label: 'You',
    title: 'Owner: The connected wallet owns this current protocol output.',
  };
}

export function transactionParticipantBadge(
  transaction: ProtocolTransaction,
  walletStakeKeyHash?: string,
): OwnershipBadge | null {
  if (!walletStakeKeyHash || !transaction.participantStakeKeyHashes?.includes(walletStakeKeyHash)) return null;
  return {
    kind: 'transaction-participant',
    label: 'You',
    title: 'Participant: The connected wallet stake credential appears in protocol inputs or outputs for this transaction.',
  };
}
