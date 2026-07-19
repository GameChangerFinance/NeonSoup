import type { NetworkTag } from '../state/types';

export function cardanoscanTxUrl(network: NetworkTag, txHash: string): string {
  const host = network === 'mainnet' ? 'https://cardanoscan.io' : `https://${network}.cardanoscan.io`;
  return `${host}/transaction/${encodeURIComponent(txHash)}`;
}

export function openExternalUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
