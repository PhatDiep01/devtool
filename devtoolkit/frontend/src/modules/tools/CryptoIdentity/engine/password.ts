/**
 * Password Generator & Strength Analyzer Engine
 * Cryptographically secure random generation using Web Crypto API (crypto.getRandomValues).
 * Entropy calculations, crack time estimation, and offline password vulnerability analyzer.
 */

import {
  PasswordRandomOptions,
  PasswordPassphraseOptions,
  PasswordStrengthMetrics,
  PasswordCheckResult,
  PasswordStrengthLevel
} from '../types';
import { PASSPHRASE_WORDLIST } from './wordlist';

const CHAR_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHAR_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHAR_NUMBERS = '0123456789';
const CHAR_SYMBOLS_DEFAULT = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const CHAR_AMBIGUOUS = '0Oo1lI|!';

const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111',
  '1234567', 'dragon', 'welcome', 'admin', 'administrator', 'iloveyou', 'football',
  'monkey', 'letmein', 'shadow', 'master', 'sunshine', 'princess', 'solo', 'starwars',
  'superman', 'baseball', 'michael', 'pass123', 'root', 'hunter2', 'trustno1'
]);

/**
 * Returns a cryptographically secure random integer in range [0, max - 1]
 * using rejection sampling to prevent modulo bias.
 */
function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % max;
    }
  }
}

/**
 * Generates a single cryptographically secure random password
 */
export function generateSingleRandomPassword(options: PasswordRandomOptions): string {
  let lower = CHAR_LOWER;
  let upper = CHAR_UPPER;
  let numbers = CHAR_NUMBERS;
  let symbols = options.customSymbols || CHAR_SYMBOLS_DEFAULT;

  // Filter excluded chars
  const excludedSet = new Set((options.excludedChars || '').split(''));
  if (options.excludeAmbiguous) {
    CHAR_AMBIGUOUS.split('').forEach((c) => excludedSet.add(c));
  }

  const clean = (pool: string) => pool.split('').filter((c) => !excludedSet.has(c)).join('');

  lower = options.lowercase ? clean(lower) : '';
  upper = options.uppercase ? clean(upper) : '';
  numbers = options.numbers ? clean(numbers) : '';
  symbols = options.symbols ? clean(symbols) : '';

  const activePools = [
    { name: 'lower', chars: lower },
    { name: 'upper', chars: upper },
    { name: 'numbers', chars: numbers },
    { name: 'symbols', chars: symbols }
  ].filter((p) => p.chars.length > 0);

  if (activePools.length === 0) {
    return 'Vui lòng chọn ít nhất 1 bộ ký tự!';
  }

  const allAvailableChars = activePools.map((p) => p.chars).join('');
  const length = Math.min(128, Math.max(4, options.length || 16));
  const result: string[] = [];

  // Guarantee inclusion of at least 1 character from each enabled pool
  if (options.requireEachType && length >= activePools.length) {
    activePools.forEach((pool) => {
      const char = pool.chars[secureRandomInt(pool.chars.length)];
      result.push(char);
    });
  }

  // Fill remaining slots
  while (result.length < length) {
    const char = allAvailableChars[secureRandomInt(allAvailableChars.length)];

    if (options.noConsecutiveDuplicates && result.length > 0 && result[result.length - 1] === char) {
      continue;
    }
    result.push(char);
  }

  // Cryptographically shuffle the array (Fisher-Yates)
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  // Check consecutive duplicates after shuffle if required
  if (options.noConsecutiveDuplicates) {
    for (let i = 1; i < result.length; i++) {
      if (result[i] === result[i - 1]) {
        // Swap with a non-matching element
        for (let k = 0; k < result.length; k++) {
          if (result[k] !== result[i] && (k === 0 || result[k - 1] !== result[i]) && (k === result.length - 1 || result[k + 1] !== result[i])) {
            const temp = result[i];
            result[i] = result[k];
            result[k] = temp;
            break;
          }
        }
      }
    }
  }

  return result.join('');
}

/**
 * Generates a memorable passphrase using offline dictionary
 */
export function generateSinglePassphrase(options: PasswordPassphraseOptions): string {
  const wordCount = Math.min(10, Math.max(3, options.wordCount || 4));
  const words: string[] = [];
  const listLen = PASSPHRASE_WORDLIST.length;

  for (let i = 0; i < wordCount; i++) {
    const idx = secureRandomInt(listLen);
    let word = PASSPHRASE_WORDLIST[idx];
    if (options.capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  if (options.includeNumber) {
    const num = secureRandomInt(90) + 10; // 10 to 99
    // Append to last word or random place
    words[words.length - 1] += num;
  }

  const sep = typeof options.separator === 'string' ? options.separator : '-';
  return words.join(sep);
}

/**
 * Batch generates passwords (1 to 50)
 */
export function generatePasswordBatch(
  mode: 'random' | 'passphrase',
  randomOpts: PasswordRandomOptions,
  passphraseOpts: PasswordPassphraseOptions
): string[] {
  const count = mode === 'passphrase'
    ? Math.min(50, Math.max(1, passphraseOpts.count || 1))
    : Math.min(50, Math.max(1, randomOpts.count || 1));

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    if (mode === 'passphrase') {
      results.push(generateSinglePassphrase(passphraseOpts));
    } else {
      results.push(generateSingleRandomPassword(randomOpts));
    }
  }
  return results;
}

/**
 * Calculates entropy and estimated crack time for a given password string or configuration
 */
export function calculatePasswordEntropy(password: string): PasswordStrengthMetrics {
  if (!password) {
    return {
      entropyBits: 0,
      level: 'very_weak',
      levelLabel: 'Rất yếu',
      crackTimeEstimate: '0 giây',
      crackTimeDetails: 'Mật khẩu trống',
      score: 0
    };
  }

  // Calculate pool size based on character variety
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  if (poolSize === 0) poolSize = 26;

  // Bits of entropy: L * log2(poolSize)
  const length = password.length;
  let entropy = length * (Math.log(poolSize) / Math.LN2);

  // Entropy penalty for common repeated or sequential characters
  if (/(.)\1{2,}/.test(password)) {
    entropy = Math.max(10, entropy - 15);
  }
  if (/12345|abcdef|qwerty/i.test(password)) {
    entropy = Math.max(10, entropy - 25);
  }

  const entropyBits = Math.round(entropy);

  // Evaluate Level
  let level: PasswordStrengthLevel = 'very_weak';
  let levelLabel = 'Rất yếu';
  let score = 0;

  if (entropyBits < 36) {
    level = 'very_weak';
    levelLabel = 'Rất yếu';
    score = 0;
  } else if (entropyBits < 60) {
    level = 'weak';
    levelLabel = 'Yếu';
    score = 1;
  } else if (entropyBits < 80) {
    level = 'medium';
    levelLabel = 'Trung bình';
    score = 2;
  } else if (entropyBits < 100) {
    level = 'strong';
    levelLabel = 'Mạnh';
    score = 3;
  } else {
    level = 'very_strong';
    levelLabel = 'Rất mạnh (Khuyên dùng)';
    score = 4;
  }

  // Estimate crack time at 10^11 (100 billion) guesses per second (High-end GPU cluster)
  const combinations = Math.pow(2, entropyBits);
  const guessesPerSec = 1e11;
  const seconds = combinations / (2 * guessesPerSec); // Average time is half combinations

  const crackTimeEstimate = formatCrackTime(seconds);
  const crackTimeDetails = `Ước tính cần ~${crackTimeEstimate} để bẻ khóa bằng cụm GPU hiện đại (100 tỷ phép thử/giây).`;

  return {
    entropyBits,
    level,
    levelLabel,
    crackTimeEstimate,
    crackTimeDetails,
    score
  };
}

/**
 * Formats seconds into human-readable time
 */
function formatCrackTime(seconds: number): string {
  if (seconds < 1) return 'Dưới 1 giây';
  if (seconds < 60) return `${Math.round(seconds)} giây`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} giờ`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} ngày`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)} tháng`;
  const years = days / 365.25;
  if (years < 1000) return `${Math.round(years)} năm`;
  if (years < 1000000) return `${(years / 1000).toFixed(1)} nghìn năm`;
  if (years < 1000000000) return `${(years / 1000000).toFixed(1)} triệu năm`;
  return `${(years / 1000000000).toFixed(1)} tỷ năm`;
}

/**
 * Offline Password Strength Checker & Vulnerability Analyzer
 */
export function checkPasswordStrength(password: string): PasswordCheckResult {
  const metrics = calculatePasswordEntropy(password);
  const length = password.length;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasMinLength = length >= 8;
  const hasGoodLength = length >= 12;

  // Patterns check
  const lowerPwd = password.toLowerCase();
  const hasNoCommonPattern = !COMMON_PASSWORDS.has(lowerPwd);
  const hasNoSequential = !/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|qwerty|asdf)/i.test(password);

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (length === 0) {
    warnings.push('Mật khẩu chưa có ký tự.');
  } else {
    if (!hasMinLength) {
      warnings.push(`Độ dài quá ngắn (${length} ký tự). Khuyến nghị tối thiểu 12 ký tự.`);
    } else if (!hasGoodLength) {
      suggestions.push('Nên nâng độ dài lên ít nhất 14-16 ký tự để tăng cường bảo vệ.');
    }

    if (!hasLower || !hasUpper) {
      warnings.push('Thiếu sự kết hợp giữa chữ cái thường và chữ cái hoa.');
    }

    if (!hasNumber) {
      suggestions.push('Nên thêm ít nhất một chữ số (0-9).');
    }

    if (!hasSymbol) {
      suggestions.push('Nên thêm ký tự đặc biệt (!@#$%...) để mở rộng không gian tìm kiếm.');
    }

    if (!hasNoCommonPattern) {
      warnings.push('Mật khẩu trùng với danh sách các mật khẩu phổ biến nhất thế giới (dễ bị tấn công từ điển)!');
    }

    if (!hasNoSequential) {
      warnings.push('Chứa chuỗi ký tự bàn phím hoặc số liên tiếp (123, abc, qwerty...).');
    }

    if (/(.)\1{2,}/.test(password)) {
      warnings.push('Chứa ký tự lặp lại 3 lần liên tiếp.');
    }
  }

  return {
    password,
    length,
    metrics,
    checks: {
      hasMinLength,
      hasGoodLength,
      hasLower,
      hasUpper,
      hasNumber,
      hasSymbol,
      hasNoCommonPattern,
      hasNoSequential
    },
    warnings,
    suggestions
  };
}
