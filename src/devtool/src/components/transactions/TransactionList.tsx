import type { NetworkTag, ProtocolTransaction } from '../../state/types';
import { short } from '../../domain/text';
import { cardanoscanTxUrl, openExternalUrl } from '../../services/explorers';
import { CopyIcon } from '../common/CopyIcon';
import { EmptyState } from '../common/EmptyState';

export interface TransactionRow extends ProtocolTransaction {
  userOwned?: boolean;
}

interface TransactionListProps {
  transactions: TransactionRow[];
  network: NetworkTag;
}

function statusClass(status: ProtocolTransaction['status']): string {
  if (status === 'confirmed') return 'text-bg-success';
  if (status === 'failed') return 'text-bg-danger';
  if (status === 'submitted') return 'text-bg-info';
  return 'text-bg-secondary';
}

function formatTime(at: number): string {
  if (!at) return 'Live UTxO';
  return new Date(at).toLocaleString();
}

export function TransactionList({ transactions, network }: TransactionListProps) {
  if (!transactions.length) {
    return <EmptyState title="No protocol transactions captured yet." detail="Wallet results will appear here after use." />;
  }

  return (
    <div className="table-responsive scroll-panel transaction-table">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Action</th>
            <th>Transaction</th>
            <th>Status</th>
            <th>When</th>
            <th className="text-end">Links</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge text-bg-secondary text-uppercase">{tx.action}</span>
                  {tx.userOwned ? <span className="badge text-bg-success">You</span> : null}
                </div>
              </td>
              <td>
                <div className="fw-semibold">{tx.summary}</div>
                <div className="small text-body-secondary hash-text">
                  {short(tx.txHash, 14, 12)}
                  <CopyIcon value={tx.txHash} label="Copy transaction hash" />
                </div>
              </td>
              <td>
                <span className={`badge ${statusClass(tx.status)}`}>{tx.status}</span>
              </td>
              <td className="small text-body-secondary">{formatTime(tx.at)}</td>
              <td>
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm icon-btn"
                    title="Open on Cardanoscan"
                    aria-label="Open transaction on Cardanoscan"
                    onClick={() => openExternalUrl(cardanoscanTxUrl(network, tx.txHash))}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
