/**
 * GUID / UUID Engine: RFC 4122 (v4) & RFC 9562 (v7) Generator and Inspector
 * Uses Web Crypto crypto.getRandomValues for cryptographically secure uniqueness.
 */

import { GuidOptions, GuidInspection, GuidVersion } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';

// Internal sequence counter for UUID v7 monotonicity within the same millisecond
let lastV7Timestamp = -1;
let v7SequenceCounter = 0;

/**
 * Generates an RFC 4122 UUID v4 (random)
 */
export function generateUuidV4(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version 4 (0100)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant RFC 4122 (10xx)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuidString(bytes);
}

/**
 * Generates an RFC 9562 UUID v7 (Unix Epoch timestamp millisecond + random, time-sortable)
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let now = Date.now();

  // Ensure sequence counter advances if called within the same millisecond
  if (now === lastV7Timestamp) {
    v7SequenceCounter = (v7SequenceCounter + 1) & 0xfff;
    if (v7SequenceCounter === 0) {
      // Counter overflow within millisecond, bump timestamp
      now++;
    }
  } else {
    lastV7Timestamp = now;
    // Initialize random 12-bit seed sequence
    v7SequenceCounter = (bytes[6] << 8 | bytes[7]) & 0x0fff;
  }

  // 48-bit timestamp (ms since epoch) using BigInt to avoid 32-bit bitwise wrap
  const bigNow = BigInt(now);
  bytes[0] = Number((bigNow >> 40n) & 0xffn);
  bytes[1] = Number((bigNow >> 32n) & 0xffn);
  bytes[2] = Number((bigNow >> 24n) & 0xffn);
  bytes[3] = Number((bigNow >> 16n) & 0xffn);
  bytes[4] = Number((bigNow >> 8n) & 0xffn);
  bytes[5] = Number(bigNow & 0xffn);

  // 4-bit version 7 (0111) + top 4 bits of sequence
  bytes[6] = 0x70 | ((v7SequenceCounter >>> 8) & 0x0f);
  // Bottom 8 bits of sequence
  bytes[7] = v7SequenceCounter & 0xff;

  // 2-bit variant RFC 4122 (10xx)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuidString(bytes);
}

/**
 * Converts 16-byte array to canonical 8-4-4-4-12 hex string
 */
function bytesToUuidString(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

/**
 * Formats a raw UUID string according to user preferences
 */
export function formatSingleGuid(
  rawUuid: string,
  options: Pick<GuidOptions, 'casing' | 'hyphens' | 'braces' | 'quotes'>
): string {
  let clean = rawUuid.replace(/[^a-fA-F0-9]/g, '');
  if (clean.length !== 32) return rawUuid;

  let formatted = options.hyphens
    ? `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`
    : clean;

  if (options.casing === 'upper') {
    formatted = formatted.toUpperCase();
  } else {
    formatted = formatted.toLowerCase();
  }

  if (options.braces) {
    formatted = `{${formatted}}`;
  }

  if (options.quotes === 'single') {
    formatted = `'${formatted}'`;
  } else if (options.quotes === 'double') {
    formatted = `"${formatted}"`;
  }

  return formatted;
}

/**
 * Generates a batch of GUIDs (1 to 1000)
 */
export function generateGuidBatch(options: GuidOptions): { rawList: string[]; formattedText: string } {
  const count = Math.min(1000, Math.max(1, options.count || 1));
  const rawList: string[] = [];

  for (let i = 0; i < count; i++) {
    const guid = options.version === 'v7' ? generateUuidV7() : generateUuidV4();
    rawList.push(guid);
  }

  const formattedItems = rawList.map((guid) =>
    formatSingleGuid(guid, {
      casing: options.casing,
      hyphens: options.hyphens,
      braces: options.braces,
      quotes: options.quotes
    })
  );

  let formattedText = '';
  switch (options.delimiter) {
    case 'comma':
      formattedText = formattedItems.join(',');
      break;
    case 'comma_space':
      formattedText = formattedItems.join(', ');
      break;
    case 'comma_newline':
      formattedText = formattedItems.join(',\n');
      break;
    case 'sql_in':
      formattedText = formattedItems
        .map((g) => (g.startsWith("'") ? g : `'${g.replace(/['"{}]/g, '')}'`))
        .join(', ');
      break;
    case 'json_array':
      formattedText = JSON.stringify(
        formattedItems.map((g) => g.replace(/['"]/g, '')),
        null,
        2
      );
      break;
    case 'newline':
    default:
      formattedText = formattedItems.join('\n');
      break;
  }

  return { rawList, formattedText };
}

/**
 * Validates and inspects an existing GUID/UUID string
 */
export function inspectGuid(input: string): GuidInspection {
  const raw = (input || '').trim();
  if (!raw) {
    return { isValid: false, raw: '', cleanHex: '', error: 'Vui lòng dán chuỗi GUID/UUID cần kiểm tra' };
  }

  // Strip braces, quotes, spaces, dashes
  const cleanHex = raw.replace(/[{}"'\s-]/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(cleanHex)) {
    return {
      isValid: false,
      raw,
      cleanHex,
      error: `Chuỗi không hợp lệ: phải chứa đúng 32 ký tự thập lục phân (hexadecimal 0-9, a-f). Hiện có ${cleanHex.length} ký tự.`
    };
  }

  // Version is the 13th hex character (index 12)
  const versionDigit = parseInt(cleanHex[12], 16);
  // Variant is high bits of 17th hex character (index 16)
  const variantDigit = parseInt(cleanHex[16], 16);

  let versionName = 'Không xác định';
  switch (versionDigit) {
    case 1:
      versionName = 'v1 (Date-Time & MAC Address)';
      break;
    case 2:
      versionName = 'v2 (DCE Security)';
      break;
    case 3:
      versionName = 'v3 (MD5 Namespace)';
      break;
    case 4:
      versionName = 'v4 (Random Cryptographic - Ngẫu nhiên)';
      break;
    case 5:
      versionName = 'v5 (SHA-1 Namespace)';
      break;
    case 7:
      versionName = 'v7 (Unix Epoch Time-Sortable - Sắp xếp theo thời gian)';
      break;
    default:
      if (cleanHex === '00000000000000000000000000000000') {
        versionName = 'Nil UUID (Toàn số 0)';
      }
      break;
  }

  let variant = 'RFC 4122 / RFC 9562 (Leach-Salz)';
  if ((variantDigit & 0x8) === 0) {
    variant = 'NCS Tương thích ngược (0xxx)';
  } else if ((variantDigit & 0xc) === 0x8) {
    variant = 'RFC 4122 / RFC 9562 Tiêu chuẩn (10xx)';
  } else if ((variantDigit & 0xe) === 0xc) {
    variant = 'Microsoft Corporation GUID (110x)';
  } else {
    variant = 'Dự trữ tương lai (111x)';
  }

  let timestampMs: number | undefined;
  let timestampIso: string | undefined;
  let timestampRelative: string | undefined;

  // If UUID v7, first 48 bits (12 hex digits) are Unix timestamp in ms
  if (versionDigit === 7) {
    const timeHex = cleanHex.slice(0, 12);
    timestampMs = parseInt(timeHex, 16);
    if (!isNaN(timestampMs) && timestampMs > 0) {
      const date = new Date(timestampMs);
      if (!isNaN(date.getTime())) {
        timestampIso = format(date, 'dd/MM/yyyy HH:mm:ss.SSS (xxx)');
        try {
          timestampRelative = formatDistanceToNow(date, { addSuffix: true, locale: vi });
        } catch {
          timestampRelative = '';
        }
      }
    }
  }

  return {
    isValid: true,
    raw,
    cleanHex,
    version: versionDigit,
    versionName,
    variant,
    timestampMs,
    timestampIso,
    timestampRelative
  };
}
