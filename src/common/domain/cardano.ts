function hexToBytes(hex: string): Uint8Array {
  if (!hex) return new Uint8Array();
  const clean = hex.length % 2 ? `0${hex}` : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function stakeFromAddress(address: string): string {
  try {
    const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const separator = address.lastIndexOf('1');
    if (separator < 0) return '';
    const data = address
      .slice(separator + 1, address.length - 6)
      .split('')
      .map((char) => charset.indexOf(char));
    if (data.some((value) => value < 0)) return '';
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const value of data) {
      buffer = (buffer << 5) | value;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 255);
      }
    }
    return bytes.length < 57
      ? ''
      : bytes
          .slice(29, 57)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
  } catch {
    return '';
  }
}

type CborValue =
  | bigint
  | null
  | { bytes: string }
  | { arr: CborValue[] }
  | { tag: number; val: CborValue };

function decodeCbor(hex: string): CborValue {
  const bytes = hexToBytes(hex);
  let pos = 0;
  const readByte = () => bytes[pos++] ?? 0;
  const readHex = (count: number) => {
    let value = '';
    for (let i = 0; i < count; i += 1) value += readByte().toString(16).padStart(2, '0');
    return value;
  };
  const readUint = (additional: number): bigint => {
    if (additional <= 23) return BigInt(additional);
    if (additional === 24) return BigInt(readByte());
    if (additional === 25) return BigInt((readByte() << 8) | readByte());
    if (additional === 26) {
      return BigInt(readByte() * 0x1000000 + (readByte() << 16) + (readByte() << 8) + readByte());
    }
    if (additional === 27) {
      let value = 0n;
      for (let i = 0; i < 8; i += 1) value = value * 256n + BigInt(readByte());
      return value;
    }
    return 0n;
  };
  const decode = (): CborValue => {
    const first = readByte();
    const major = first >> 5;
    const additional = first & 31;
    if (major === 0) return readUint(additional);
    if (major === 1) return -(readUint(additional) + 1n);
    if (major === 2) {
      if (additional === 31) {
        let value = '';
        while (bytes[pos] !== 255 && pos < bytes.length) {
          const chunk = readByte();
          value += readHex(Number(readUint(chunk & 31)));
        }
        readByte();
        return { bytes: value };
      }
      return { bytes: readHex(Number(readUint(additional))) };
    }
    if (major === 4) {
      const arr: CborValue[] = [];
      if (additional === 31) {
        while (bytes[pos] !== 255 && pos < bytes.length) arr.push(decode());
        readByte();
      } else {
        const length = Number(readUint(additional));
        for (let i = 0; i < length; i += 1) arr.push(decode());
      }
      return { arr };
    }
    if (major === 6) {
      const tag = Number(readUint(additional));
      const val = decode();
      if (tag === 2 && val && typeof val === 'object' && 'bytes' in val) return BigInt(`0x${val.bytes || '0'}`);
      if (tag === 3 && val && typeof val === 'object' && 'bytes' in val) return -(BigInt(`0x${val.bytes || '0'}`) + 1n);
      return { tag, val };
    }
    return null;
  };
  return decode();
}

function asBytes(value: CborValue | undefined): string {
  return value && typeof value === 'object' && 'bytes' in value ? value.bytes : '';
}

function asArr(value: CborValue | undefined): CborValue[] {
  return value && typeof value === 'object' && 'arr' in value ? value.arr : [];
}

function plutusFields(value: CborValue): CborValue[] {
  return value && typeof value === 'object' && 'val' in value ? asArr(value.val) : [];
}

function constructorIndex(value: CborValue | undefined): number {
  if (!value || typeof value !== 'object' || !('tag' in value)) return -1;
  if (value.tag >= 121 && value.tag <= 127) return value.tag - 121;
  if (value.tag >= 1280 && value.tag <= 1400) return value.tag - 1280 + 7;
  if (value.tag === 102) {
    const [index] = asArr(value.val);
    return typeof index === 'bigint' ? Number(index) : -1;
  }
  return -1;
}

function parsePreviousInput(value: CborValue | undefined): { txHash: string; index: string } | null {
  if (constructorIndex(value) !== 0) return null;
  const [reference] = plutusFields(value ?? null);
  const [transactionId, index] = plutusFields(reference ?? null);
  const [transactionHash] = plutusFields(transactionId ?? null);
  const txHash = asBytes(transactionHash);
  return txHash && typeof index === 'bigint' ? { txHash, index: index.toString() } : null;
}

function normalizeTxAsset(policyId: string, assetNameHex: string) {
  return !policyId && !assetNameHex
    ? { policyId: 'ada', assetNameHex: 'ada' }
    : { policyId, assetNameHex };
}

export type SwapDatumProtocolVersion = 'v1' | 'v2';

export interface ParsedSwapDatum {
  pairBeacon: string;
  offerPolicyId: string;
  offerAssetName: string;
  offerBeacon: string;
  askPolicyId: string;
  askAssetName: string;
  askBeacon: string;
  priceNumerator: string;
  priceDenominator: string;
  previousInput: { txHash: string; index: string } | null;
}

function minimumSwapDatumFields(protocolVersion: SwapDatumProtocolVersion): number {
  return protocolVersion === 'v2' ? 11 : 10;
}

export function parseSwapDatum(datumHex: string, protocolVersion: SwapDatumProtocolVersion = 'v1'): ParsedSwapDatum | null {
  try {
    const fields = plutusFields(decodeCbor(datumHex));
    if (fields.length < minimumSwapDatumFields(protocolVersion)) return null;
    const price = plutusFields(fields[8] ?? null);
    const offer = normalizeTxAsset(asBytes(fields[2]), asBytes(fields[3]));
    const ask = normalizeTxAsset(asBytes(fields[5]), asBytes(fields[6]));
    return {
      pairBeacon: asBytes(fields[1]),
      offerPolicyId: offer.policyId,
      offerAssetName: offer.assetNameHex,
      offerBeacon: asBytes(fields[4]),
      askPolicyId: ask.policyId,
      askAssetName: ask.assetNameHex,
      askBeacon: asBytes(fields[7]),
      priceNumerator: (price[0] ?? 0n).toString(),
      priceDenominator: (price[1] ?? 1n).toString(),
      previousInput: parsePreviousInput(fields[9]),
    };
  } catch {
    return null;
  }
}
