export function decimalThresholdToBase(value: string, decimals: number): string {
  const raw = value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return '0';
  const [whole = '0', fraction = ''] = raw.split('.');
  const scale = 10n ** BigInt(decimals);
  const wholeBase = BigInt(whole || '0') * scale;
  const fractionBase = BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  const result = wholeBase + fractionBase;
  return result > 0n ? result.toString() : '0';
}

function defaultPolicyQuantity(policyId: string, assetNameHex: string, decimals: number): string {
  if (policyId === 'ada' && assetNameHex === 'ada') {
    return (5n * 10n ** BigInt(decimals)).toString();
  }
  return decimalThresholdToBase('0.01', decimals);
}

export function defaultMinExecutableOfferQuantity(policyId: string, assetNameHex: string, decimals: number): string {
  return defaultPolicyQuantity(policyId, assetNameHex, decimals);
}

export function defaultMinMakerRemainderQuantity(policyId: string, assetNameHex: string, decimals: number): string {
  return defaultPolicyQuantity(policyId, assetNameHex, decimals);
}

export function normalizeBaseUnitQuantity(value: string | undefined, fallback: string): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value).toString();
  }
  return fallback;
}
