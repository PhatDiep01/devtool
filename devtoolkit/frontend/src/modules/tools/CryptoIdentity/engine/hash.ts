/**
 * Hash Engine: Concurrent Multi-Algorithm Hashing & HMAC
 * Computes MD5, SHA-1, SHA-256, SHA-384, SHA-512 with Hex/Base64 casing,
 * Hash comparison, and chunked file streaming with progress callback & abort signal.
 */

import { HashAlgorithm, HashItemResult, HashOutputCase, HashOutputEncoding, HashCompareResult } from '../types';
import { md5Bytes, hmacMd5Bytes, bytesToHex, bytesToBase64, Md5Stream } from './md5';

export const HASH_ALGORITHMS: { id: HashAlgorithm; isBroken: boolean; label: string }[] = [
  { id: 'MD5', isBroken: true, label: 'MD5 (128-bit)' },
  { id: 'SHA-1', isBroken: true, label: 'SHA-1 (160-bit)' },
  { id: 'SHA-256', isBroken: false, label: 'SHA-256 (256-bit - Tiêu chuẩn)' },
  { id: 'SHA-384', isBroken: false, label: 'SHA-384 (384-bit)' },
  { id: 'SHA-512', isBroken: false, label: 'SHA-512 (512-bit - Cực an toàn)' },
];

/**
 * Convert digest byte array to specified format (Hex or Base64, uppercase or lowercase)
 */
export function formatDigest(
  bytes: Uint8Array,
  casing: HashOutputCase = 'lower',
  encoding: HashOutputEncoding = 'hex'
): string {
  let str = '';
  if (encoding === 'base64') {
    str = bytesToBase64(bytes);
  } else {
    str = bytesToHex(bytes);
    if (casing === 'upper') {
      str = str.toUpperCase();
    } else {
      str = str.toLowerCase();
    }
  }
  return str;
}

/**
 * Calculates standard hash for a single algorithm on byte array
 */
export async function computeSingleHash(
  algorithm: HashAlgorithm,
  dataBytes: Uint8Array
): Promise<Uint8Array> {
  if (algorithm === 'MD5') {
    return md5Bytes(dataBytes);
  }

  // Web Crypto Subtle API handles SHA-1, SHA-256, SHA-384, SHA-512
  const subtleAlgo = algorithm; // 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'
  const buffer = await crypto.subtle.digest(subtleAlgo, dataBytes as any);
  return new Uint8Array(buffer);
}

/**
 * Calculates HMAC for a single algorithm on byte array
 */
export async function computeSingleHmac(
  algorithm: HashAlgorithm,
  keyBytes: Uint8Array,
  dataBytes: Uint8Array
): Promise<Uint8Array> {
  if (algorithm === 'MD5') {
    return hmacMd5Bytes(keyBytes, dataBytes);
  }

  const subtleAlgo = algorithm; // 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: { name: subtleAlgo } },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes as any);
  return new Uint8Array(signature);
}

/**
 * Concurrently calculates hashes for all 5 algorithms
 */
export async function computeAllHashes(
  dataBytes: Uint8Array,
  options: {
    casing?: HashOutputCase;
    encoding?: HashOutputEncoding;
    hmacKey?: string;
  } = {}
): Promise<HashItemResult[]> {
  const { casing = 'lower', encoding = 'hex', hmacKey } = options;
  const isHmac = typeof hmacKey === 'string' && hmacKey.length > 0;
  const keyBytes = isHmac ? new TextEncoder().encode(hmacKey) : new Uint8Array(0);

  const promises = HASH_ALGORITHMS.map(async (item) => {
    let digestBytes: Uint8Array;
    if (isHmac) {
      digestBytes = await computeSingleHmac(item.id, keyBytes, dataBytes);
    } else {
      digestBytes = await computeSingleHash(item.id, dataBytes);
    }

    const value = formatDigest(digestBytes, casing, encoding);
    return {
      algorithm: item.id,
      value,
      isBrokenSecurity: item.isBroken
    };
  });

  return Promise.all(promises);
}

/**
 * Compares an expected hash string against computed hash list
 */
export function compareHashValues(
  targetHash: string,
  computedList: HashItemResult[]
): HashCompareResult {
  const cleanTarget = (targetHash || '').trim();
  if (!cleanTarget) {
    return { hasInput: false, matched: false, matchedAlgorithms: [] };
  }

  const matchedAlgorithms: HashAlgorithm[] = [];
  const targetLower = cleanTarget.toLowerCase();

  computedList.forEach((item) => {
    if (item.value.toLowerCase() === targetLower) {
      matchedAlgorithms.push(item.algorithm);
    }
  });

  return {
    hasInput: true,
    matched: matchedAlgorithms.length > 0,
    matchedAlgorithms
  };
}

/**
 * Computes hashes of a File chunk-by-chunk with progress reporting and cancellation
 */
export async function hashFileInChunks(
  file: File,
  options: {
    casing?: HashOutputCase;
    encoding?: HashOutputEncoding;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<{ results: HashItemResult[]; elapsedMs: number }> {
  const startTime = performance.now();
  const chunkSize = 2 * 1024 * 1024; // 2MB chunk
  const totalChunks = Math.ceil(file.size / chunkSize);

  const md5Stream = new Md5Stream();

  // Read chunks and stream to MD5
  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    if (options.signal?.aborted) {
      throw new Error('Đã hủy tính toán hash file.');
    }

    const slice = file.slice(offset, offset + chunkSize);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    md5Stream.update(bytes);

    offset += chunkSize;
    chunkIndex++;

    if (options.onProgress) {
      const pct = Math.min(100, Math.round((chunkIndex / Math.max(1, totalChunks)) * 100));
      options.onProgress(pct);
    }

    // Allow UI thread to breathe
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const md5Digest = md5Stream.digest();

  // For SHA algorithms on files:
  // For files up to reasonable size in browser (or complete ArrayBuffer):
  const entireBuffer = await file.arrayBuffer();
  const entireBytes = new Uint8Array(entireBuffer);

  const [sha1Buffer, sha256Buffer, sha384Buffer, sha512Buffer] = await Promise.all([
    crypto.subtle.digest('SHA-1', entireBytes as any),
    crypto.subtle.digest('SHA-256', entireBytes as any),
    crypto.subtle.digest('SHA-384', entireBytes as any),
    crypto.subtle.digest('SHA-512', entireBytes as any)
  ]);

  const casing = options.casing || 'lower';
  const encoding = options.encoding || 'hex';

  const results: HashItemResult[] = [
    {
      algorithm: 'MD5',
      value: formatDigest(md5Digest, casing, encoding),
      isBrokenSecurity: true
    },
    {
      algorithm: 'SHA-1',
      value: formatDigest(new Uint8Array(sha1Buffer), casing, encoding),
      isBrokenSecurity: true
    },
    {
      algorithm: 'SHA-256',
      value: formatDigest(new Uint8Array(sha256Buffer), casing, encoding),
      isBrokenSecurity: false
    },
    {
      algorithm: 'SHA-384',
      value: formatDigest(new Uint8Array(sha384Buffer), casing, encoding),
      isBrokenSecurity: false
    },
    {
      algorithm: 'SHA-512',
      value: formatDigest(new Uint8Array(sha512Buffer), casing, encoding),
      isBrokenSecurity: false
    }
  ];

  const elapsedMs = Math.round(performance.now() - startTime);

  return { results, elapsedMs };
}
