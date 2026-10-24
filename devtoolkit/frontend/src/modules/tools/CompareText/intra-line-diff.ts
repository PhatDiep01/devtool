import { myersDiff } from './myers-diff';
import { DiffToken } from './types';

/**
 * Tokenizes text into word-level chunks (words, whitespaces, punctuations).
 * Unicode property escapes support Vietnamese accents, CJK, and other alphabets.
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Matches whitespace runs, unicode words (letters + numbers + underscore), or single punctuation symbols
  const regex = /([^\S\r\n]+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}])/gu;
  const matches = text.match(regex);
  return matches || [text];
}

/**
 * Tokenizes text into individual Unicode characters safe with combining marks/emojis.
 */
export function tokenizeChars(text: string): string[] {
  if (!text) return [];
  return Array.from(text);
}

/**
 * Computes intra-line token difference between an old line and a new line.
 * Returns tokens for the left side (with 'unchanged' and 'removed')
 * and tokens for the right side (with 'unchanged' and 'added').
 */
export function computeIntraLineDiff(
  oldLine: string,
  newLine: string,
  mode: 'word' | 'char' = 'word',
  ignoreCase: boolean = false
): { leftTokens: DiffToken[]; rightTokens: DiffToken[] } {
  const oldTokens = mode === 'char' ? tokenizeChars(oldLine) : tokenizeWords(oldLine);
  const newTokens = mode === 'char' ? tokenizeChars(newLine) : tokenizeWords(newLine);

  const comparator = (a: string, b: string) => {
    if (ignoreCase) {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  };

  const { edits } = myersDiff(oldTokens, newTokens, comparator);

  const leftTokens: DiffToken[] = [];
  const rightTokens: DiffToken[] = [];

  for (const edit of edits) {
    if (edit.type === 'keep') {
      // Unchanged on both sides
      leftTokens.push({ type: 'unchanged', value: edit.value });
      rightTokens.push({ type: 'unchanged', value: edit.value });
    } else if (edit.type === 'delete') {
      // Removed from left
      leftTokens.push({ type: 'removed', value: edit.value });
    } else if (edit.type === 'insert') {
      // Added to right
      rightTokens.push({ type: 'added', value: edit.value });
    }
  }

  return {
    leftTokens: consolidateTokens(leftTokens),
    rightTokens: consolidateTokens(rightTokens)
  };
}

/**
 * Merges adjacent tokens of the same type to optimize DOM node rendering.
 */
function consolidateTokens(tokens: DiffToken[]): DiffToken[] {
  if (tokens.length <= 1) return tokens;

  const result: DiffToken[] = [];
  let current = { ...tokens[0] };

  for (let i = 1; i < tokens.length; i++) {
    const next = tokens[i];
    if (next.type === current.type) {
      current.value += next.value;
    } else {
      result.push(current);
      current = { ...next };
    }
  }
  result.push(current);

  return result;
}

/**
 * Fast estimation of similarity between two strings (0.0 to 1.0)
 * Uses common bigrams (Dice coefficient) for fast O(N) estimation.
 */
export function computeLineSimilarity(
  s1: string,
  s2: string,
  ignoreCase: boolean = false
): number {
  const a = ignoreCase ? s1.toLowerCase() : s1;
  const b = ignoreCase ? s2.toLowerCase() : s2;

  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;
  if (a.length === 1 && b.length === 1) return a === b ? 1.0 : 0.0;

  // Dice coefficient on character bigrams
  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bg1 = getBigrams(a);
  const bg2 = getBigrams(b);

  let intersection = 0;
  bg1.forEach((count, bigram) => {
    if (bg2.has(bigram)) {
      intersection += Math.min(count, bg2.get(bigram)!);
    }
  });

  const total = (a.length - 1) + (b.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0;
}
