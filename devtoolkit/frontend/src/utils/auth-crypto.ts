/**
 * Utility for obfuscating and securing remembered authentication data in browser localStorage.
 * Ensures credentials (passwords, tokens, usernames) are NEVER stored in plaintext.
 * Uses client-side XOR cipher + base64 encoding with hardware/origin salt.
 */

const STORAGE_KEY = 'jira_remembered_auth';

function getClientSalt(): string {
  if (typeof window === 'undefined') return 'devtoolkit-salt-default';
  const parts = [
    window.location.origin || '',
    navigator.userAgent || '',
    String(window.screen?.width || 0),
    '__devtoolkit_jira_v2__'
  ];
  return parts.join('::');
}

export interface RememberedJiraAuth {
  authTab: 'token' | 'basic';
  baseUrl: string;
  username?: string;
  password?: string;
  apiToken?: string;
  savedAt: number;
}

/**
 * Obfuscates a string using XOR with repeating key + Base64.
 * Output looks like an encrypted hash: e.g. "enc_v2_..."
 */
function obfuscateString(plainText: string, key: string): string {
  if (!plainText) return '';
  const result: number[] = [];
  for (let i = 0; i < plainText.length; i++) {
    const charCode = plainText.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result.push(charCode ^ keyChar);
  }
  const bytes = new Uint8Array(result);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'enc_v2_' + btoa(binary);
}

/**
 * De-obfuscates the string back to plaintext using the dynamic key.
 */
function deobfuscateString(cipherText: string, key: string): string {
  if (!cipherText || !cipherText.startsWith('enc_v2_')) return '';
  try {
    const base64 = cipherText.slice(7);
    const binary = atob(base64);
    const chars: string[] = [];
    for (let i = 0; i < binary.length; i++) {
      const charCode = binary.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      chars.push(String.fromCharCode(charCode ^ keyChar));
    }
    return chars.join('');
  } catch {
    return '';
  }
}

/**
 * Saves remembered authentication data obfuscated in localStorage.
 * No plaintext username, password, or token will be visible in DevTools LocalStorage.
 */
export function saveRememberedAuth(auth: Omit<RememberedJiraAuth, 'savedAt'>): void {
  try {
    const salt = getClientSalt();
    const payload: RememberedJiraAuth = {
      ...auth,
      savedAt: Date.now()
    };
    const json = JSON.stringify(payload);
    const encrypted = obfuscateString(json, salt);
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (err) {
    console.warn('Failed to save remembered auth to localStorage:', err);
  }
}

/**
 * Reads and de-obfuscates remembered authentication data from localStorage.
 */
export function getRememberedAuth(): RememberedJiraAuth | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const salt = getClientSalt();
    const json = deobfuscateString(stored, salt);
    if (!json) return null;
    return JSON.parse(json) as RememberedJiraAuth;
  } catch {
    return null;
  }
}

/**
 * Removes remembered authentication data from localStorage.
 */
export function clearRememberedAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
