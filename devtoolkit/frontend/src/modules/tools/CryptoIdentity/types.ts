export type CryptoTabId = 'base64' | 'url' | 'jwt' | 'hash' | 'guid' | 'password';

export interface TabConfigItem {
  id: CryptoTabId;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
}

// ==========================================
// 1. Base64 Types
// ==========================================
export type Base64Mode = 'encode' | 'decode';

export interface Base64Options {
  urlSafe: boolean;
  wrap76: boolean;
}

export interface Base64Stats {
  chars: number;
  bytes: number;
}

export interface Base64FileInfo {
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  dataUrl?: string;
}

// ==========================================
// 2. URL Types
// ==========================================
export type UrlMode = 'encode' | 'decode';
export type UrlEncodeType = 'component' | 'full';

export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ParsedUrl {
  isValid: boolean;
  raw: string;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  params: QueryParamItem[];
  error?: string;
}

// ==========================================
// 3. JWT Types
// ==========================================
export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: any;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: any;
}

export interface JwtClaimInfo {
  key: string;
  value: any;
  label: string;
  description: string;
  isStandard: boolean;
  formattedTime?: string;
  relativeTime?: string;
}

export type JwtValidityStatus = 'valid' | 'expired' | 'not_yet_valid' | 'no_exp' | 'malformed';

export interface ParsedJwt {
  isValid: boolean;
  rawHeader: string;
  rawPayload: string;
  rawSignature: string;
  headerObj: JwtHeader | null;
  payloadObj: JwtPayload | null;
  formattedHeaderJson: string;
  formattedPayloadJson: string;
  status: JwtValidityStatus;
  statusMessage: string;
  algorithm: string;
  tokenType: string;
  isAlgNone: boolean;
  claims: JwtClaimInfo[];
  signatureVerification?: {
    checked: boolean;
    valid: boolean;
    message: string;
  };
  errors: {
    structure?: string;
    header?: string;
    payload?: string;
  };
}

// ==========================================
// 4. Hash Types
// ==========================================
export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export type HashOutputCase = 'lower' | 'upper';
export type HashOutputEncoding = 'hex' | 'base64';

export interface HashItemResult {
  algorithm: HashAlgorithm;
  value: string;
  isBrokenSecurity: boolean;
}

export interface HashCompareResult {
  hasInput: boolean;
  matched: boolean;
  matchedAlgorithms: HashAlgorithm[];
}

export interface HashFileMeta {
  name: string;
  size: number;
  elapsedMs: number;
}

// ==========================================
// 5. GUID Types
// ==========================================
export type GuidVersion = 'v4' | 'v7';
export type GuidCase = 'lower' | 'upper';
export type GuidDelimiter = 'newline' | 'comma' | 'comma_space' | 'comma_newline' | 'sql_in' | 'json_array';

export interface GuidOptions {
  version: GuidVersion;
  count: number;
  casing: GuidCase;
  hyphens: boolean;
  braces: boolean;
  quotes: 'none' | 'single' | 'double';
  delimiter: GuidDelimiter;
}

export interface GuidInspection {
  isValid: boolean;
  raw: string;
  cleanHex: string;
  version?: number | string;
  versionName?: string;
  variant?: string;
  timestampMs?: number;
  timestampIso?: string;
  timestampRelative?: string;
  error?: string;
}

// ==========================================
// 6. Password Types
// ==========================================
export type PasswordMode = 'random' | 'passphrase';

export interface PasswordRandomOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  customSymbols: string;
  excludeAmbiguous: boolean; // 0, O, o, 1, l, I, |
  noConsecutiveDuplicates: boolean;
  requireEachType: boolean;
  excludedChars: string;
  count: number;
}

export interface PasswordPassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
  count: number;
}

export type PasswordStrengthLevel = 'very_weak' | 'weak' | 'medium' | 'strong' | 'very_strong';

export interface PasswordStrengthMetrics {
  entropyBits: number;
  level: PasswordStrengthLevel;
  levelLabel: string;
  crackTimeEstimate: string;
  crackTimeDetails: string;
  score: number; // 0 to 4
}

export interface PasswordCheckResult {
  password: string;
  length: number;
  metrics: PasswordStrengthMetrics;
  checks: {
    hasMinLength: boolean;
    hasGoodLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
    hasNoCommonPattern: boolean;
    hasNoSequential: boolean;
  };
  warnings: string[];
  suggestions: string[];
}

// ==========================================
// Persistent Preferences (ONLY non-sensitive settings)
// ==========================================
export interface StoredCryptoPreferences {
  lastTab: CryptoTabId;
  base64: {
    mode: Base64Mode;
    urlSafe: boolean;
    wrap76: boolean;
  };
  url: {
    mode: UrlMode;
    encodeType: UrlEncodeType;
  };
  hash: {
    casing: HashOutputCase;
    encoding: HashOutputEncoding;
    hmacEnabled: boolean;
  };
  guid: GuidOptions;
  password: {
    mode: PasswordMode;
    random: {
      length: number;
      lowercase: boolean;
      uppercase: boolean;
      numbers: boolean;
      symbols: boolean;
      excludeAmbiguous: boolean;
      noConsecutiveDuplicates: boolean;
      requireEachType: boolean;
      count: number;
    };
    passphrase: {
      wordCount: number;
      separator: string;
      capitalize: boolean;
      includeNumber: boolean;
      count: number;
    };
  };
}
