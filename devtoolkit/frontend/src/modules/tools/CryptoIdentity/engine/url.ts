/**
 * URL Engine: Encoding, Decoding, Multi-layer analysis, and Interactive Query Parameter Parser
 */

import { ParsedUrl, QueryParamItem, UrlEncodeType } from '../types';

/**
 * Encodes text according to chosen mode:
 * - component: encodeURIComponent (for query values, encodes &, ?, /, #, =, etc.)
 * - full: encodeURI (for entire URLs, preserves structural protocol, domain, slashes)
 */
export function encodeUrlText(text: string, type: UrlEncodeType): string {
  if (!text) return '';
  try {
    if (type === 'component') {
      return encodeURIComponent(text);
    }
    return encodeURI(text);
  } catch (err: any) {
    return text;
  }
}

/**
 * Decodes URL text once with strict error checking
 */
export function decodeUrlTextOnce(text: string): { result: string; error?: string } {
  if (!text) return { result: '' };
  try {
    return { result: decodeURIComponent(text.replace(/\+/g, ' ')) };
  } catch (err: any) {
    return {
      result: text,
      error: 'Chuỗi mã hóa URL không hợp lệ (URI malformed). Vui lòng kiểm tra lại ký tự "%" hoặc độ dài chuỗi escape.'
    };
  }
}

/**
 * Detects if a string contains percent-encoded sequences (e.g. %20, %2F)
 */
export function hasPercentEncoding(text: string): boolean {
  return /%[0-9a-fA-F]{2}/.test(text);
}

/**
 * Counts how many nested encoding layers exist in a string
 */
export function countEncodingLayers(text: string): number {
  let current = text;
  let layers = 0;
  const maxLayers = 10;

  while (layers < maxLayers && hasPercentEncoding(current)) {
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, ' '));
      if (decoded === current) break;
      layers++;
      current = decoded;
    } catch {
      break;
    }
  }
  return layers;
}

/**
 * Recursively decodes URL string until fully decoded or max layers reached
 */
export function decodeUrlMultiLayers(text: string, maxLayers: number = 5): { result: string; layersDecoded: number; error?: string } {
  let current = text;
  let count = 0;
  let lastError: string | undefined;

  while (count < maxLayers && hasPercentEncoding(current)) {
    const step = decodeUrlTextOnce(current);
    if (step.error) {
      lastError = step.error;
      break;
    }
    if (step.result === current) {
      break;
    }
    current = step.result;
    count++;
  }

  return {
    result: current,
    layersDecoded: count,
    error: lastError
  };
}

/**
 * Parses full URL into components and interactive query parameter items
 */
export function parseFullUrl(urlInput: string): ParsedUrl {
  const trimmed = urlInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      raw: '',
      protocol: '',
      username: '',
      password: '',
      hostname: '',
      port: '',
      pathname: '',
      search: '',
      hash: '',
      origin: '',
      params: []
    };
  }

  try {
    // If user entered without protocol (e.g. "example.com/api?a=1"), prepend temporary https:// to parse
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const parseableUrl = hasScheme ? trimmed : `https://${trimmed}`;

    const urlObj = new URL(parseableUrl);

    const params: QueryParamItem[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: `param_${Math.random().toString(36).substring(2, 9)}`,
        key,
        value,
        enabled: true
      });
    });

    return {
      isValid: true,
      raw: trimmed,
      protocol: hasScheme ? urlObj.protocol.replace(':', '') : 'https',
      username: urlObj.username,
      password: urlObj.password,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      origin: urlObj.origin,
      params
    };
  } catch (err: any) {
    return {
      isValid: false,
      raw: trimmed,
      protocol: '',
      username: '',
      password: '',
      hostname: '',
      port: '',
      pathname: '',
      search: '',
      hash: '',
      origin: '',
      params: [],
      error: `Không thể phân tích URL: ${err?.message || 'Cấu trúc URL không đúng chuẩn'}`
    };
  }
}

/**
 * Reconstructs a full URL string from parsed components and modified parameters
 */
export function rebuildUrlFromParts(
  parts: {
    protocol: string;
    username?: string;
    password?: string;
    hostname: string;
    port?: string;
    pathname: string;
    hash?: string;
  },
  params: QueryParamItem[]
): string {
  try {
    const protocol = parts.protocol ? `${parts.protocol.replace(/:$/, '')}://` : 'https://';
    let auth = '';
    if (parts.username) {
      auth = parts.username;
      if (parts.password) {
        auth += `:${parts.password}`;
      }
      auth += '@';
    }

    const host = parts.hostname || 'localhost';
    const port = parts.port ? `:${parts.port}` : '';
    let path = parts.pathname || '';
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }

    const searchParams = new URLSearchParams();
    params.forEach((p) => {
      if (p.enabled && p.key.trim()) {
        searchParams.append(p.key.trim(), p.value);
      }
    });

    const queryString = searchParams.toString();
    const query = queryString ? `?${queryString}` : '';

    let hash = parts.hash || '';
    if (hash && !hash.startsWith('#')) {
      hash = '#' + hash;
    }

    return `${protocol}${auth}${host}${port}${path}${query}${hash}`;
  } catch {
    return '';
  }
}
