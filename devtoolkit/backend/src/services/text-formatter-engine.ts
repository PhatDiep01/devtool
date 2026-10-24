export type DetectedType = 'JSON' | 'SQL' | 'LOG' | 'TEXT';

export interface FormatterOptions {
  smartJson: boolean;
  separator: string; // ' ' | ',' | ', ' | ';' | '; ' | '|' | custom
  trimLines: boolean;
  removeEmptyLines: boolean;
  collapseSpaces: boolean;
}

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
  byteSize: number;
}

export interface FormatterResult {
  output: string;
  detectedType: DetectedType;
  isJsonValid: boolean;
  jsonError?: string;
  inputStats: TextStats;
  outputStats: TextStats;
  charsSaved: number;
  reductionPercent: number;
  isLargePayload: boolean;
}

export const PERFORMANCE_THRESHOLD = 100_000;

export function computeTextStats(text: string): TextStats {
  if (!text) {
    return { characters: 0, words: 0, lines: 0, byteSize: 0 };
  }

  const characters = text.length;
  const wordsMatch = text.trim().match(/\S+/g);
  const words = wordsMatch ? wordsMatch.length : 0;
  const lines = text.split(/\r?\n/).length;
  
  let byteSize = 0;
  if (typeof Buffer !== 'undefined') {
    byteSize = Buffer.byteLength(text, 'utf8');
  } else if (typeof TextEncoder !== 'undefined') {
    byteSize = new TextEncoder().encode(text).length;
  } else {
    byteSize = characters;
  }

  return { characters, words, lines, byteSize };
}

export function detectInputType(text: string): DetectedType {
  const trimmed = text.trim();
  if (!trimmed) return 'TEXT';

  // 1. Log detection FIRST: timestamp pattern or bracketed log level tag
  const logRegex = /^(\[?\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}|\[\s*(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL|NOTICE|CRITICAL)\s*\]|\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE|FATAL):\s+)/i;
  if (logRegex.test(trimmed)) {
    return 'LOG';
  }

  // 2. SQL query detection: strip leading SQL comments (-- or /* */) first
  const sqlStripped = trimmed.replace(/^(\s*(--[^\r\n]*(\r?\n|$)|(\/\*[\s\S]*?\*\/)))+/i, '').trim();
  const sqlRegex = /^(SELECT|INSERT\s+INTO|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE\s+INTO|WITH|EXPLAIN|GRANT|REVOKE|EXEC|EXECUTE|UPSERT|REPLACE\s+INTO)\b/i;
  if (sqlRegex.test(sqlStripped)) {
    return 'SQL';
  }

  // 3. JSON check: starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'JSON';
  }

  return 'TEXT';
}

export function formatText(text: string, options: FormatterOptions): FormatterResult {
  const isLargePayload = text.length > PERFORMANCE_THRESHOLD;
  const inputStats = computeTextStats(text);
  const detectedType = detectInputType(text);

  if (!text) {
    return {
      output: '',
      detectedType: 'TEXT',
      isJsonValid: false,
      inputStats,
      outputStats: computeTextStats(''),
      charsSaved: 0,
      reductionPercent: 0,
      isLargePayload: false
    };
  }

  let output = '';
  let isJsonValid = false;
  let jsonError: string | undefined;

  // Smart JSON mode: only attempt when smartJson is enabled AND detectedType is JSON
  if (options.smartJson && detectedType === 'JSON') {
    try {
      const parsed = JSON.parse(text);
      isJsonValid = true;
      output = JSON.stringify(parsed);
    } catch (err: any) {
      isJsonValid = false;
      jsonError = err?.message || 'Cú pháp JSON không hợp lệ';
    }
  }

  // If not JSON or Smart JSON fallback
  if (!output) {
    let lines = text.split(/\r?\n/);

    if (options.trimLines) {
      lines = lines.map(line => line.trim());
    }

    if (options.removeEmptyLines) {
      lines = lines.filter(line => line.length > 0);
    }

    if (options.collapseSpaces) {
      lines = lines.map(line => line.replace(/\s+/g, ' '));
    }

    output = lines.join(options.separator);
  }

  const outputStats = computeTextStats(output);
  const charsSaved = inputStats.characters - outputStats.characters;
  const reductionPercent = inputStats.characters > 0
    ? Math.max(0, Number(((charsSaved / inputStats.characters) * 100).toFixed(1)))
    : 0;

  return {
    output,
    detectedType,
    isJsonValid,
    jsonError,
    inputStats,
    outputStats,
    charsSaved,
    reductionPercent,
    isLargePayload
  };
}
