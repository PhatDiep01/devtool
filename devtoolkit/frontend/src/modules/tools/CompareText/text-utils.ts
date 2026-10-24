import { TextStats } from './types';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB hard limit
export const LARGE_PAYLOAD_LINE_THRESHOLD = 10_000;
export const LARGE_PAYLOAD_CHAR_THRESHOLD = 500_000;

export interface FileReadResult {
  content: string;
  filename: string;
  sizeBytes: number;
  stats: TextStats;
}

/**
 * Validates whether a file buffer appears to be binary.
 * Reads first 8KB and checks for null bytes or abnormally high ratio of control chars.
 */
export async function isBinaryFile(file: File): Promise<boolean> {
  const sampleSize = Math.min(file.size, 8192);
  if (sampleSize === 0) return false;

  const slice = file.slice(0, sampleSize);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let suspiciousBytes = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    // Byte 0 is null byte - unmistakable sign of binary
    if (byte === 0) {
      return true;
    }
    // Check non-printable control characters (excluding \t, \n, \r)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspiciousBytes++;
    }
  }

  // If > 20% control characters, treat as binary
  return suspiciousBytes / bytes.length > 0.2;
}

/**
 * Safely reads a client-side file as UTF-8 text with Vietnamese accent support and binary check.
 */
export async function readTextFileClient(file: File): Promise<FileReadResult> {
  if (!file) {
    throw new Error('Không có tệp nào được chọn.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Tệp quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB). Giới hạn tối đa là 50MB.`
    );
  }

  // Check binary
  const binary = await isBinaryFile(file);
  if (binary) {
    throw new Error(
      `Tệp "${file.name}" dường như là tệp nhị phân (binary file) hoặc không hỗ trợ định dạng văn bản UTF-8.`
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const content = (reader.result as string) || '';
        const stats = computeTextStats(content);
        resolve({
          content,
          filename: file.name,
          sizeBytes: file.size,
          stats
        });
      } catch (err) {
        reject(new Error(`Không thể phân tích nội dung tệp: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error(`Lỗi khi đọc tệp "${file.name}". Vui lòng thử lại.`));
    };

    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Computes characters, words, lines and UTF-8 byte size for a given text.
 */
export function computeTextStats(text: string): TextStats {
  if (!text) {
    return { characters: 0, words: 0, lines: 0, byteSize: 0 };
  }

  const characters = text.length;
  // Unicode-aware word matching
  const wordsMatch = text.trim().match(/[\p{L}\p{N}_]+/gu);
  const words = wordsMatch ? wordsMatch.length : 0;
  // Standard line count
  const lines = text.split(/\r?\n/).length;

  let byteSize = 0;
  if (typeof TextEncoder !== 'undefined') {
    byteSize = new TextEncoder().encode(text).length;
  } else {
    byteSize = characters;
  }

  return { characters, words, lines, byteSize };
}

/**
 * Deeply sorts object keys alphabetically and formats JSON with 2-space indentation.
 */
export function formatJsonCanonical(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Cú pháp JSON không hợp lệ: ${(err as Error).message}`);
  }

  const deepSort = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(deepSort);
    }
    if (value !== null && typeof value === 'object') {
      const sortedObj: Record<string, any> = {};
      const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
      for (const key of keys) {
        sortedObj[key] = deepSort(value[key]);
      }
      return sortedObj;
    }
    return value;
  };

  const canonicalObj = deepSort(parsed);
  return JSON.stringify(canonicalObj, null, 2);
}

/**
 * Sorts lines alphabetically with full Vietnamese locale support.
 */
export function sortTextLines(text: string, order: 'asc' | 'desc' = 'asc'): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);

  lines.sort((a, b) => {
    const comp = a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true });
    return order === 'asc' ? comp : -comp;
  });

  return lines.join('\n');
}

/**
 * Copies text content to user's clipboard safely.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to execCommand
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Downloads arbitrary text as a client-side file.
 */
export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
