import type { ChainTransactionOutput } from '../services/providers/types';
import type { NeonSoupExecutionReceipt } from '../state/types';
import { currentOutputOwnerBadge } from './ownership';
import {
  mergeProtocolTransactions,
  protocolTransactionFromChain,
  transactionsFromReceipt,
} from './transactions';

const BEACON_POLICY = 'beacon-policy';
const OWNER = 'owner-stake-key-hash';

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function protocolOutput(txHash: string, index: number): ChainTransactionOutput {
  return {
    address: '',
    ownerStakeKeyHash: OWNER,
    txHash,
    index: String(index),
    value: '3000000',
    datumHex: '',
    tokens: ['pair', 'offer', 'ask'].map((assetNameHex) => ({
      policyId: BEACON_POLICY,
      assetNameHex,
      quantity: '1',
    })),
  };
}

export function verifyTransactionFixtures(): void {
  const singleFill = protocolTransactionFromChain(
    {
      hash: 'single-fill',
      includedAt: 1,
      inputs: [protocolOutput('source', 0)],
      outputs: [protocolOutput('single-fill', 0)],
    },
    BEACON_POLICY,
  );
  invariant(singleFill.action === 'fill', 'A one-input/one-output protocol transition must remain a fill.');
  invariant(singleFill.actionCounts?.fill === 1, 'A single fill must preserve its exact fill count.');

  const bundledFill = protocolTransactionFromChain(
    {
      hash: 'bundled-fill',
      includedAt: 2,
      inputs: [0, 1, 2].map((index) => protocolOutput('source', index)),
      outputs: [0, 1, 2].map((index) => protocolOutput('bundled-fill', index)),
    },
    BEACON_POLICY,
  );
  invariant(bundledFill.action === 'fill', 'A bundled fill must not become open or mixed.');
  invariant(bundledFill.actionCounts?.fill === 3, 'A bundled fill must preserve its exact fill count.');

  const ownerBadge = currentOutputOwnerBadge({ ownerStakeKeyHash: OWNER }, OWNER);
  invariant(ownerBadge?.kind === 'current-output-owner', 'Current offer ownership must use explicit owner semantics.');

  const receipt: NeonSoupExecutionReceipt = {
    executionId: 'receipt',
    itemCount: 1,
    groupCount: 1,
    txs: [
      {
        groupId: 'group',
        groupIndex: 0,
        txHash: 'single-fill',
        status: 'pending',
        hasSubmitError: false,
        hasContentionError: false,
      },
    ],
    items: [
      {
        itemId: 'item',
        intentId: 'intent',
        type: 'open',
        itemIndex: 0,
        groupId: 'group',
        groupIndex: 0,
        groupItemIndex: 0,
        txHash: 'single-fill',
        outputs: [],
      },
    ],
  };
  const pending = transactionsFromReceipt(receipt, 0)[0];
  invariant(pending?.action === 'unknown', 'Wallet receipts must not categorize protocol actions.');
  const merged = mergeProtocolTransactions(pending ? [pending] : [], [singleFill]);
  invariant(merged.length === 1 && merged[0]?.action === 'fill', 'Chain evidence must replace a receipt hint by hash.');

  const failed = protocolTransactionFromChain(
    { hash: 'failed', includedAt: 3, validContract: false, inputs: [], outputs: [] },
    BEACON_POLICY,
  );
  invariant(failed.status === 'failed' && failed.action === 'unknown', 'Invalid contracts must not be categorized as actions.');

}
