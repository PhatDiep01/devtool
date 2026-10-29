import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileCode,
  Link2,
  KeyRound,
  Hash,
  Fingerprint,
  Lock,
  Keyboard,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CryptoTabId,
  StoredCryptoPreferences,
  Base64Options,
  Base64Mode,
  UrlMode,
  UrlEncodeType,
  HashOutputCase,
  HashOutputEncoding,
  GuidOptions,
  PasswordMode,
  PasswordRandomOptions,
  PasswordPassphraseOptions
} from './types';
import { Base64Tab } from './tabs/Base64Tab';
import { UrlTab } from './tabs/UrlTab';
import { JwtTab } from './tabs/JwtTab';
import { HashTab } from './tabs/HashTab';
import { GuidTab } from './tabs/GuidTab';
import { PasswordTab } from './tabs/PasswordTab';
import { ShortcutsModal } from './ShortcutsModal';

const STORAGE_PREFS_KEY = 'crypto_identity_tool_prefs';

const DEFAULT_PREFERENCES: StoredCryptoPreferences = {
  lastTab: 'base64',
  base64: {
    mode: 'encode',
    urlSafe: false,
    wrap76: false
  },
  url: {
    mode: 'encode',
    encodeType: 'component'
  },
  hash: {
    casing: 'lower',
    encoding: 'hex',
    hmacEnabled: false
  },
  guid: {
    version: 'v4',
    count: 5,
    casing: 'lower',
    hyphens: true,
    braces: false,
    quotes: 'none',
    delimiter: 'newline'
  },
  password: {
    mode: 'random',
    random: {
      length: 16,
      lowercase: true,
      uppercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: false,
      noConsecutiveDuplicates: false,
      requireEachType: true,
      count: 5
    },
    passphrase: {
      wordCount: 4,
      separator: '-',
      capitalize: true,
      includeNumber: true,
      count: 5
    }
  }
};

function loadStoredPreferences(): StoredCryptoPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      base64: { ...DEFAULT_PREFERENCES.base64, ...parsed.base64 },
      url: { ...DEFAULT_PREFERENCES.url, ...parsed.url },
      hash: { ...DEFAULT_PREFERENCES.hash, ...parsed.hash },
      guid: { ...DEFAULT_PREFERENCES.guid, ...parsed.guid },
      password: {
        ...DEFAULT_PREFERENCES.password,
        ...parsed.password,
        random: { ...DEFAULT_PREFERENCES.password.random, ...parsed.password?.random },
        passphrase: { ...DEFAULT_PREFERENCES.password.passphrase, ...parsed.password?.passphrase }
      }
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function saveStoredPreferences(prefs: StoredCryptoPreferences): void {
  try {
    // Only non-sensitive settings are ever stored
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors
  }
}

export const CryptoIdentityPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [preferences, setPreferences] = useState<StoredCryptoPreferences>(loadStoredPreferences);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Tab definitions
  const tabs: { id: CryptoTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'base64', label: 'Base64', icon: FileCode },
    { id: 'url', label: 'URL', icon: Link2 },
    { id: 'jwt', label: 'JWT Decoder', icon: KeyRound },
    { id: 'hash', label: 'Hash & HMAC', icon: Hash },
    { id: 'guid', label: 'GUID / UUID', icon: Fingerprint },
    { id: 'password', label: 'Mật khẩu', icon: Lock }
  ];

  // Active Tab: Prioritize URL search parameter (?tab=...), then saved preferences
  const queryTab = searchParams.get('tab') as CryptoTabId | null;
  const validTabs: CryptoTabId[] = ['base64', 'url', 'jwt', 'hash', 'guid', 'password'];
  const activeTab: CryptoTabId = queryTab && validTabs.includes(queryTab) ? queryTab : preferences.lastTab;

  const setActiveTab = useCallback(
    (tabId: CryptoTabId) => {
      setSearchParams({ tab: tabId }, { replace: true });
      setPreferences((prev) => {
        const next = { ...prev, lastTab: tabId };
        saveStoredPreferences(next);
        return next;
      });
    },
    [setSearchParams]
  );

  // Sync query parameter on mount if absent
  useEffect(() => {
    if (!queryTab || !validTabs.includes(queryTab)) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [queryTab, activeTab, setSearchParams]);

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in input, textarea, or contentEditable, do not trigger tab shortcuts
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (!isInput) {
        if (e.key >= '1' && e.key <= '6') {
          e.preventDefault();
          const tabIndex = parseInt(e.key, 10) - 1;
          if (tabs[tabIndex]) {
            setActiveTab(tabs[tabIndex].id);
          }
        } else if (e.key === '?') {
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, tabs]);

  // Update handlers that persist to localStorage
  const updateBase64Options = (opts: Partial<Base64Options>) => {
    setPreferences((prev) => {
      const next = { ...prev, base64: { ...prev.base64, ...opts } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateBase64Mode = (mode: Base64Mode) => {
    setPreferences((prev) => {
      const next = { ...prev, base64: { ...prev.base64, mode } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateUrlMode = (mode: UrlMode) => {
    setPreferences((prev) => {
      const next = { ...prev, url: { ...prev.url, mode } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateUrlEncodeType = (encodeType: UrlEncodeType) => {
    setPreferences((prev) => {
      const next = { ...prev, url: { ...prev.url, encodeType } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateHashCasing = (casing: HashOutputCase) => {
    setPreferences((prev) => {
      const next = { ...prev, hash: { ...prev.hash, casing } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateHashEncoding = (encoding: HashOutputEncoding) => {
    setPreferences((prev) => {
      const next = { ...prev, hash: { ...prev.hash, encoding } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateHashHmacEnabled = (hmacEnabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, hash: { ...prev.hash, hmacEnabled } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updateGuidOptions = (opts: Partial<GuidOptions>) => {
    setPreferences((prev) => {
      const next = { ...prev, guid: { ...prev.guid, ...opts } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updatePasswordMode = (mode: PasswordMode) => {
    setPreferences((prev) => {
      const next = { ...prev, password: { ...prev.password, mode } };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updatePasswordRandomOptions = (opts: Partial<PasswordRandomOptions>) => {
    setPreferences((prev) => {
      const next = {
        ...prev,
        password: {
          ...prev.password,
          random: { ...prev.password.random, ...opts }
        }
      };
      saveStoredPreferences(next);
      return next;
    });
  };

  const updatePasswordPassphraseOptions = (opts: Partial<PasswordPassphraseOptions>) => {
    setPreferences((prev) => {
      const next = {
        ...prev,
        password: {
          ...prev.password,
          passphrase: { ...prev.password.passphrase, ...opts }
        }
      };
      saveStoredPreferences(next);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-6 border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-20">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 tracking-tight text-foreground">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span>Mã hóa & Định danh</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Bộ công cụ Base64, URL, JWT Decoder, mã băm Hash & HMAC, sinh GUID/UUID và mật khẩu an toàn 100% Client-Side.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 100% Client-Side Privacy Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold select-none">
              <ShieldCheck className="w-4 h-4" />
              <span>Dữ liệu được xử lý hoàn toàn trên máy của bạn</span>
            </div>

            {/* Keyboard Shortcuts Button */}
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition border border-border"
              title="Xem danh sách phím tắt (?)"
            >
              <Keyboard className="w-4 h-4" />
              <span className="hidden md:inline">Phím tắt</span>
            </button>
          </div>
        </div>

        {/* 2. Top Navigation Tabs */}
        <div className="max-w-[1700px] mx-auto mt-4 pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap select-none ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Tab Contents Body */}
      <div className="p-4 sm:p-6 max-w-[1700px] mx-auto w-full flex-1">
        {activeTab === 'base64' && (
          <Base64Tab
            options={preferences.base64}
            mode={preferences.base64.mode}
            onUpdateOptions={updateBase64Options}
            onUpdateMode={updateBase64Mode}
          />
        )}

        {activeTab === 'url' && (
          <UrlTab
            mode={preferences.url.mode}
            encodeType={preferences.url.encodeType}
            onUpdateMode={updateUrlMode}
            onUpdateEncodeType={updateUrlEncodeType}
          />
        )}

        {activeTab === 'jwt' && <JwtTab />}

        {activeTab === 'hash' && (
          <HashTab
            casing={preferences.hash.casing}
            encoding={preferences.hash.encoding}
            hmacEnabled={preferences.hash.hmacEnabled}
            onUpdateCasing={updateHashCasing}
            onUpdateEncoding={updateHashEncoding}
            onUpdateHmacEnabled={updateHashHmacEnabled}
          />
        )}

        {activeTab === 'guid' && (
          <GuidTab
            options={preferences.guid}
            onUpdateOptions={updateGuidOptions}
          />
        )}

        {activeTab === 'password' && (
          <PasswordTab
            mode={preferences.password.mode}
            randomOptions={{
              ...preferences.password.random,
              customSymbols: '',
              excludedChars: ''
            }}
            passphraseOptions={preferences.password.passphrase}
            onUpdateMode={updatePasswordMode}
            onUpdateRandomOptions={updatePasswordRandomOptions}
            onUpdatePassphraseOptions={updatePasswordPassphraseOptions}
          />
        )}
      </div>

      {/* 4. Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
