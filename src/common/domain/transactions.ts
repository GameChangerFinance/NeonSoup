import type { ChainTransaction, ChainTransactionOutput } from '../services/providers/types';
import type {
  ActionMode,
  NeonSoupExecutionReceipt,
  ProtocolAction,
  ProtocolTransactionDetail,
  ProtocolTransaction,
} from '../state/types';
import { parseSwapDatum, stakeFromAddress } from './cardano';
import { transactionParticipantBadge, type OwnershipBadge } from './ownership';

export interface TransactionRow extends ProtocolTransaction {
  ownershipBadge: OwnershipBadge | null;
}

export function isConfirmedChainTransaction(transaction: Pick<ChainTransaction, 'includedAt'>): boolean {
  return transaction.includedAt > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isProtocolOutput(output: ChainTransactionOutput, beaconPolicy: string): boolean {
  const beacons = output.tokens.filter((token) => token.policyId === beaconPolicy && token.quantity === '1');
  return beacons.length === 3;
}

function outputReference(output: ChainTransactionOutput): string {
  return `${output.txHash}:${output.index}`;
}

function assetQuantity(output: ChainTransactionOutput, policyId: string, assetNameHex: string): string {
  if (policyId === 'ada') return output.value || '0';
  return output.tokens.find((token) => token.policyId === policyId && token.assetNameHex === assetNameHex)?.quantity || '0';
}

function positiveDelta(left: string, right: string): string {
  const a = BigInt(left || '0');
  const b = BigInt(right || '0');
  return a > b ? (a - b).toString() : '0';
}

function detailFromOutput(action: ProtocolTransactionDetail['action'], output: ChainTransactionOutput): ProtocolTransactionDetail | null {
  const datum = parseSwapDatum(output.datumHex);
  if (!datum) return null;
  return {
    action,
    outputRef: outputReference(output),
    offerPolicyId: datum.offerPolicyId,
    offerAssetNameHex: datum.offerAssetName,
    askPolicyId: datum.askPolicyId,
    askAssetNameHex: datum.askAssetName,
    offerQuantity: assetQuantity(output, datum.offerPolicyId, datum.offerAssetName),
    askQuantity: assetQuantity(output, datum.askPolicyId, datum.askAssetName),
    priceNumerator: datum.priceNumerator,
    priceDenominator: datum.priceDenominator,
  };
}

function detailFromFill(input: ChainTransactionOutput, output: ChainTransactionOutput): ProtocolTransactionDetail | null {
  const datum = parseSwapDatum(input.datumHex) || parseSwapDatum(output.datumHex);
  if (!datum) return null;
  return {
    action: 'fill',
    inputRef: outputReference(input),
    outputRef: outputReference(output),
    offerPolicyId: datum.offerPolicyId,
    offerAssetNameHex: datum.offerAssetName,
    askPolicyId: datum.askPolicyId,
    askAssetNameHex: datum.askAssetName,
    offerQuantity: positiveDelta(
      assetQuantity(input, datum.offerPolicyId, datum.offerAssetName),
      assetQuantity(output, datum.offerPolicyId, datum.offerAssetName),
    ),
    askQuantity: positiveDelta(
      assetQuantity(output, datum.askPolicyId, datum.askAssetName),
      assetQuantity(input, datum.askPolicyId, datum.askAssetName),
    ),
    priceNumerator: datum.priceNumerator,
    priceDenominator: datum.priceDenominator,
  };
}

function transactionDetails(
  protocolInputs: readonly ChainTransactionOutput[],
  parsedOutputs: readonly { output: ChainTransactionOutput; datum: ReturnType<typeof parseSwapDatum> }[],
): ProtocolTransactionDetail[] {
  const continuingByInput = new Map<string, { output: ChainTransactionOutput; datum: NonNullable<ReturnType<typeof parseSwapDatum>> }>();
  parsedOutputs.forEach(({ output, datum }) => {
    if (!datum?.previousInput) return;
    continuingByInput.set(`${datum.previousInput.txHash}:${datum.previousInput.index}`, { output, datum });
  });

  const details: ProtocolTransactionDetail[] = [];
  parsedOutputs.forEach(({ output, datum }) => {
    if (!datum || datum.previousInput) return;
    const detail = detailFromOutput('open', output);
    if (detail) details.push(detail);
  });
  protocolInputs.forEach((input) => {
    const inputRef = outputReference(input);
    const continuation = continuingByInput.get(inputRef);
    if (continuation) {
      const detail = detailFromFill(input, continuation.output);
      if (detail) details.push(detail);
      return;
    }
    const detail = detailFromOutput('close', input);
    if (detail) {
      const { outputRef: _outputRef, ...closedDetail } = detail;
      details.push({ ...closedDetail, inputRef });
    }
  });
  return details;
}

function actionSummary(actions: readonly ActionMode[], counts: Partial<Record<ActionMode, number>>): string {
  if (!actions.length) return 'Confirmed transaction; protocol action could not be verified.';
  return actions
    .map((action) => `${counts[action] || 1} ${action}${(counts[action] || 1) === 1 ? '' : 's'}`)
    .join(', ');
}

function displayedAction(actions: readonly ActionMode[]): ProtocolAction {
  if (!actions.length) return 'unknown';
  return actions.length === 1 ? actions[0] || 'unknown' : 'mixed';
}

function includedAtMilliseconds(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`) || 0;
}

export function protocolTransactionFromChain(
  transaction: ChainTransaction,
  beaconPolicy: string,
): ProtocolTransaction {
  if (transaction.validContract === false) {
    return {
      id: `chain-${transaction.hash}`,
      txHash: transaction.hash,
      action: 'unknown',
      actions: [],
      evidence: 'chain',
      status: 'failed',
      at: transaction.includedAt,
      ...(transaction.fee ? { feeQuantity: transaction.fee } : {}),
      participantStakeKeyHashes: unique(
        [...transaction.inputs, ...transaction.outputs].map(
          (output) => output.ownerStakeKeyHash || stakeFromAddress(output.address),
        ),
      ),
      outputOwnerStakeKeyHashes: [],
      summary: 'Transaction is on-chain but its contract execution is invalid.',
    };
  }
  const protocolInputs = transaction.inputs.filter((input) => isProtocolOutput(input, beaconPolicy));
  const protocolOutputs = transaction.outputs.filter((output) => isProtocolOutput(output, beaconPolicy));
  const counts: Partial<Record<ActionMode, number>> = {};
  const parsedOutputs = protocolOutputs.map((output) => ({ output, datum: parseSwapDatum(output.datumHex) }));

  if (parsedOutputs.length && parsedOutputs.every(({ datum }) => datum)) {
    const continuingReferences = new Set(
      parsedOutputs
        .map(({ datum }) => datum?.previousInput)
        .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
        .map((reference) => `${reference.txHash}:${reference.index}`),
    );
    counts.fill = continuingReferences.size;
    counts.open = parsedOutputs.filter(({ datum }) => !datum?.previousInput).length;
    counts.close = protocolInputs.filter((input) => !continuingReferences.has(outputReference(input))).length;
  } else {
    if (protocolInputs.length && protocolOutputs.length) counts.fill = Math.min(protocolInputs.length, protocolOutputs.length);
    if (protocolOutputs.length > protocolInputs.length) counts.open = protocolOutputs.length - protocolInputs.length;
    if (protocolInputs.length > protocolOutputs.length) counts.close = protocolInputs.length - protocolOutputs.length;
  }

  const actions = (['open', 'fill', 'close'] as const).filter((action) => Boolean(counts[action]));
  const participantStakeKeyHashes = unique(
    [...transaction.inputs, ...transaction.outputs].map(
      (output) => output.ownerStakeKeyHash || stakeFromAddress(output.address),
    ),
  );
  const outputOwnerStakeKeyHashes = unique(
    protocolOutputs.map((output) => output.ownerStakeKeyHash || stakeFromAddress(output.address)),
  );

  return {
    id: `chain-${transaction.hash}`,
    txHash: transaction.hash,
    action: displayedAction(actions),
    actions,
    actionCounts: counts,
    evidence: 'chain',
    status: 'confirmed',
    at: transaction.includedAt,
    ...(transaction.fee ? { feeQuantity: transaction.fee } : {}),
    participantStakeKeyHashes,
    outputOwnerStakeKeyHashes,
    summary: actionSummary(actions, counts),
    details: transactionDetails(protocolInputs, parsedOutputs),
  };
}

export function transactionsFromReceipt(receipt: NeonSoupExecutionReceipt, at: number): ProtocolTransaction[] {
  const groups = new Map<string, typeof receipt.items>();
  receipt.items.forEach((item) => groups.set(item.groupId, [...(groups.get(item.groupId) || []), item]));
  const txsByGroup = new Map(receipt.txs.map((tx) => [tx.groupId, tx] as const));
  return [...groups.entries()].map(([groupId, items]) => {
    const tx = txsByGroup.get(groupId);
    const txHash = tx?.txHash || items[0]?.txHash || '';
    const hasSubmitError = Boolean(tx?.hasSubmitError);
    const statusLabel = tx?.status && tx.status !== 'unknown' ? ` Wallet status: ${tx.status}.` : '';
    const contentionLabel = tx?.hasContentionError ? ' Wallet suggests UTxO contention.' : '';
    return {
      id: `receipt-${txHash || groupId}`,
      txHash,
      action: 'unknown',
      status: hasSubmitError ? 'failed' : 'submitted',
      ...(tx?.status ? { walletSubmitStatus: tx.status } : {}),
      walletSubmitError: hasSubmitError,
      walletSubmitContention: Boolean(tx?.hasContentionError),
      at,
      groupId,
      itemIds: items.map((item) => item.itemId),
      evidence: 'wallet-receipt',
      summary: hasSubmitError
        ? `Wallet reported a tentative submission failure for ${items.length} intent${items.length === 1 ? '' : 's'}; awaiting chain/provider evidence.${contentionLabel}`
        : `Submitted ${items.length} intent${items.length === 1 ? '' : 's'}; awaiting chain verification.${statusLabel}${contentionLabel}`,
    };
  });
}

export function mergeProtocolTransactions(
  current: readonly ProtocolTransaction[],
  incoming: readonly ProtocolTransaction[],
  limit = 100,
): ProtocolTransaction[] {
  const merged = new Map<string, ProtocolTransaction>();
  [...current, ...incoming].forEach((transaction) => {
    if (!transaction.txHash) return;
    const previous = merged.get(transaction.txHash);
    if (!previous || transaction.evidence === 'chain' || previous.evidence !== 'chain') {
      merged.set(transaction.txHash, {
        ...previous,
        ...transaction,
        itemIds: unique([...(previous?.itemIds || []), ...(transaction.itemIds || [])]),
      });
    }
  });
  return [...merged.values()].sort((a, b) => b.at - a.at || a.txHash.localeCompare(b.txHash)).slice(0, limit);
}

export function composeTransactionRows(
  transactions: readonly ProtocolTransaction[],
  walletStakeKeyHash?: string,
): TransactionRow[] {
  return mergeProtocolTransactions([], transactions).map((transaction) => {
    const verified = transaction.evidence === 'chain';
    const normalized = verified
      ? transaction
      : {
          ...transaction,
          action: 'unknown' as const,
          summary:
            transaction.status === 'submitted'
              ? transaction.summary
              : transaction.summary || 'Captured transaction; awaiting chain-backed categorization.',
        };
    return {
      ...normalized,
      ownershipBadge: verified ? transactionParticipantBadge(transaction, walletStakeKeyHash) : null,
    };
  });
}

export const parseChainIncludedAt = includedAtMilliseconds;
