import { create } from 'zustand';

export interface BuildInfo {
  version: string;
  buildTime: number;
  buildDate: string;
  buildId: string;
}

interface AppUpdateState {
  hasUpdate: boolean;
  isOpen: boolean;
  currentBuild: BuildInfo;
  latestBuild: BuildInfo | null;
  dismissedBuildId: string | null;
  dismissedAt: number | null;
  isReloading: boolean;

  setUpdateAvailable: (latest: BuildInfo) => void;
  openUpdateModal: () => void;
  dismissModal: () => void;
  reloadApp: () => void;
  checkForUpdates: () => Promise<boolean>;
}

// Fallback initial build info if not defined in dev
const DEFAULT_BUILD_INFO: BuildInfo = typeof __APP_BUILD_INFO__ !== 'undefined'
  ? __APP_BUILD_INFO__
  : {
      version: '1.2.0',
      buildTime: Date.now(),
      buildDate: new Date().toISOString(),
      buildId: 'dev_build'
    };

let lastCheckTimestamp = 0;

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  hasUpdate: false,
  isOpen: false,
  currentBuild: DEFAULT_BUILD_INFO,
  latestBuild: null,
  dismissedBuildId: null,
  dismissedAt: null,
  isReloading: false,

  setUpdateAvailable: (latest: BuildInfo) => {
    const { currentBuild, dismissedBuildId, dismissedAt } = get();

    // Verify it is genuinely newer than the currently running build
    if (latest.buildId === currentBuild.buildId || latest.buildTime <= currentBuild.buildTime) {
      return;
    }

    // ANTI-SPAM RULE:
    // If the user dismissed this exact buildId within the cooldown window (15 mins),
    // we keep hasUpdate: true (so Topbar indicator shows) but don't re-pop the modal.
    // However, if latest is a BRAND NEW release (different from dismissedBuildId)
    // or cooldown expired, we reopen the single popup.
    const isNewerRelease = dismissedBuildId !== latest.buildId;
    const cooldownExpired = !dismissedAt || (Date.now() - dismissedAt > 15 * 60 * 1000);
    const shouldOpenModal = isNewerRelease || cooldownExpired;

    set((state) => ({
      hasUpdate: true,
      latestBuild: latest,
      // If modal is already open, it simply updates the latest build info (SINGLETON POPUP - NO STACKING)
      isOpen: state.isOpen || shouldOpenModal
    }));
  },

  openUpdateModal: () => {
    if (get().hasUpdate) {
      set({ isOpen: true });
    }
  },

  dismissModal: () => {
    const { latestBuild } = get();
    set({
      isOpen: false,
      dismissedBuildId: latestBuild?.buildId || null,
      dismissedAt: Date.now()
    });
  },

  reloadApp: () => {
    set({ isReloading: true });

    // Clean any browser CacheStorage entries if applicable
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      } catch {
        // ignore cache delete errors
      }
    }

    // Reload with cache-busting query parameter to force modern bundle fetch
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(get().latestBuild?.buildTime || Date.now()));
    window.location.replace(url.toString());
  },

  checkForUpdates: async (): Promise<boolean> => {
    const now = Date.now();
    // Throttle checks to at most once every 10 seconds to avoid spamming on rapid window focus
    if (now - lastCheckTimestamp < 10000) {
      return false;
    }
    lastCheckTimestamp = now;

    try {
      const response = await fetch(`/version.json?_t=${now}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) return false;

      const remoteBuild: BuildInfo = await response.json();
      if (!remoteBuild?.buildId || !remoteBuild?.buildTime) return false;

      const { currentBuild } = get();
      if (remoteBuild.buildId !== currentBuild.buildId && remoteBuild.buildTime > currentBuild.buildTime) {
        get().setUpdateAvailable(remoteBuild);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}));
