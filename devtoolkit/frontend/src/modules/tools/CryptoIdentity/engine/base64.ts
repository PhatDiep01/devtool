/**
 * Base64 Engine: 100% Client-Side UTF-8 Safe Encoding & Decoding
 * Handles Vietnamese diacritics, emojis, binary files, URL-safe variants, and image previews.
 */

export interface Base64ValidationResult {
  isValid: boolean;
  error?: string;
  invalidChar?: string;
  invalidIndex?: number;
}

export interface MagicByteDetection {
  mime: string;
  extension: string;
  ext: string;
  isImage: boolean;
}

/**
 * Validates whether a given string is valid Base64 (standard or URL-safe)
 */
export function validateBase64(input: string): Base64ValidationResult {
  if (!input || !input.trim()) {
    return { isValid: false, error: 'Dữ liệu đầu vào trống' };
  }

  // Remove data URI prefix if present
  let clean = input.trim();
  const dataUriMatch = clean.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.*)$/s);
  if (dataUriMatch) {
    clean = dataUriMatch[2].trim();
  }

  // Strip whitespaces and linebreaks (standard base64 allows whitespace)
  const noWhitespace = clean.replace(/[\r\n\t\s]/g, '');

  if (noWhitespace.length === 0) {
    return { isValid: false, error: 'Dữ liệu Base64 không chứa nội dung' };
  }

  // Check valid characters: standard (A-Z a-z 0-9 + / =) or url-safe (- _)
  const validPattern = /^[A-Za-z0-9+/_\-]*={0,2}$/;
  if (!validPattern.test(noWhitespace)) {
    // Find first invalid character
    for (let i = 0; i < noWhitespace.length; i++) {
      const char = noWhitespace[i];
      if (!/[A-Za-z0-9+/_\-=]/.test(char)) {
        return {
          isValid: false,
          error: `Ký tự không hợp lệ "${char}" tại vị trí ${i + 1}`,
          invalidChar: char,
          invalidIndex: i + 1
        };
      }
    }
    return { isValid: false, error: 'Chứa ký tự không thuộc bảng mã Base64' };
  }

  // Length check (modulo 4 check on clean string without padding)
  const unpadded = noWhitespace.replace(/=/g, '');
  if (unpadded.length % 4 === 1) {
    return {
      isValid: false,
      error: `Độ dài Base64 không hợp lệ (${unpadded.length} ký tự). Chuỗi Base64 không thể có số dư 1 khi chia cho 4.`
    };
  }

  return { isValid: true };
}

/**
 * Encodes UTF-8 string to Base64 (Standard or URL-Safe)
 */
export function encodeUtf8ToBase64(text: string, options: { urlSafe?: boolean; wrap76?: boolean } = {}): string {
  if (!text) return '';
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  let base64 = btoa(binary);

  if (options.urlSafe) {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  if (options.wrap76) {
    base64 = wrapLines(base64, 76);
  }

  return base64;
}

/**
 * Decodes Base64 to UTF-8 string or returns error info
 */
export function decodeBase64ToUtf8(base64Input: string): { text: string; error?: string; isBinary?: boolean } {
  if (!base64Input || !base64Input.trim()) {
    return { text: '' };
  }

  let clean = base64Input.trim();
  // Strip data URI prefix if present
  const dataUriMatch = clean.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.*)$/s);
  if (dataUriMatch) {
    clean = dataUriMatch[2].trim();
  }

  // Remove all whitespaces
  clean = clean.replace(/[\r\n\t\s]/g, '');

  // Convert url-safe to standard base64
  clean = clean.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with '=' if missing
  while (clean.length % 4 !== 0) {
    clean += '=';
  }

  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    try {
      // Decode as strict UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const text = decoder.decode(bytes);
      return { text };
    } catch {
      // Binary non-UTF-8 stream (e.g. image, zip, exe)
      const lossyDecoder = new TextDecoder('utf-8', { fatal: false });
      return {
        text: lossyDecoder.decode(bytes),
        isBinary: true,
        error: 'Dữ liệu Base64 là dạng nhị phân (binary/image/file) chứ không phải văn bản UTF-8 thuần túy. Bạn có thể tải về dạng file hoặc xem ảnh xem trước.'
      };
    }
  } catch (err: any) {
    return {
      text: '',
      error: `Lỗi giải mã Base64: ${err?.message || 'Chuỗi Base64 sai cú pháp'}`
    };
  }
}

/**
 * Converts Base64 string to Uint8Array bytes
 */
export function base64ToBytes(base64Input: string): Uint8Array {
  let clean = base64Input.trim();
  const dataUriMatch = clean.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.*)$/s);
  if (dataUriMatch) {
    clean = dataUriMatch[2].trim();
  }
  clean = clean.replace(/[\r\n\t\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) {
    clean += '=';
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Wrap text lines at specific column width
 */
export function wrapLines(str: string, width: number = 76): string {
  if (str.length <= width) return str;
  const regex = new RegExp(`.{1,${width}}`, 'g');
  const chunks = str.match(regex);
  return chunks ? chunks.join('\n') : str;
}

/**
 * Detects MIME type & extension from magic bytes
 */
export function detectMimeFromBytes(bytes: Uint8Array): MagicByteDetection {
  if (bytes.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      return { mime: 'image/png', extension: 'png', ext: 'png', isImage: true };
    }
  }

  if (bytes.length >= 3) {
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { mime: 'image/jpeg', extension: 'jpg', ext: 'jpg', isImage: true };
    }
    // GIF: GIF87a or GIF89a
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return { mime: 'image/gif', extension: 'gif', ext: 'gif', isImage: true };
    }
  }

  if (bytes.length >= 12) {
    // WEBP: RIFF....WEBP
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return { mime: 'image/webp', extension: 'webp', ext: 'webp', isImage: true };
    }
  }

  if (bytes.length >= 4) {
    // PDF: %PDF (25 50 44 46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { mime: 'application/pdf', extension: 'pdf', ext: 'pdf', isImage: false };
    }
    // ZIP: PK.. (50 4B 03 04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return { mime: 'application/zip', extension: 'zip', ext: 'zip', isImage: false };
    }
  }

  // Check SVG or XML
  try {
    const preview = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 100)).trim();
    if (preview.startsWith('<svg') || preview.includes('<svg')) {
      return { mime: 'image/svg+xml', extension: 'svg', ext: 'svg', isImage: true };
    }
    if (preview.startsWith('{') || preview.startsWith('[')) {
      return { mime: 'application/json', extension: 'json', ext: 'json', isImage: false };
    }
  } catch {
    // Ignore
  }

  return { mime: 'application/octet-stream', extension: 'bin', ext: 'bin', isImage: false };
}

/**
 * Calculates byte size of a UTF-8 string
 */
export function getUtf8ByteSize(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Formats byte size into human readable string
 */
export function formatByteSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
