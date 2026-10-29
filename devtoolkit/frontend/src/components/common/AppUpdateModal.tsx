import React, { useEffect } from 'react';
import { Sparkles, RefreshCw, X, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { useAppUpdateStore } from '../../stores/app-update.store';

export const AppUpdateModal: React.FC = () => {
  const {
    isOpen,
    latestBuild,
    currentBuild,
    isReloading,
    dismissModal,
    reloadApp,
    checkForUpdates
  } = useAppUpdateStore();

  // Setup periodic & event-based update checkers
  useEffect(() => {
    // 1. Initial check after app finishes loading (5s delay)
    const initialTimer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    // 2. Periodic polling every 45 seconds
    const intervalTimer = setInterval(() => {
      checkForUpdates();
    }, 45000);

    // 3. Tab visibility change & window focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    const handleFocus = () => {
      checkForUpdates();
    };

    // 4. Vite dynamic import failure (when new assets deployed with different hashes)
    const handlePreloadError = (event: any) => {
      event.preventDefault?.();
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('vite:preloadError', handlePreloadError);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('vite:preloadError', handlePreloadError);
    };
  }, [checkForUpdates]);

  if (!isOpen || !latestBuild) {
    return null;
  }

  // Format release timestamp
  const formatBuildTime = (isoString?: string) => {
    if (!isoString) return 'Vừa phát hành';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        ' - ' + d.toLocaleDateString('vi-VN');
    } catch {
      return 'Vừa phát hành';
    }
  };

  return (
    <div 
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100] max-w-md w-[calc(100%-2rem)] sm:w-[420px] bg-card/95 backdrop-blur-xl border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden p-5 animate-in slide-in-from-bottom-5 duration-300 select-none"
      role="alert"
      aria-live="polite"
    >
      {/* Glow decorative background */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-2">
              <span>Đã có bản phát hành mới!</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                v{latestBuild.version}
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Phát hành lúc {formatBuildTime(latestBuild.buildDate)}
            </p>
          </div>
        </div>

        <button
          onClick={dismissModal}
          disabled={isReloading}
          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition -mr-1 -mt-1 shrink-0"
          title="Để sau"
          aria-label="Close update notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="mt-3.5 relative z-10 text-xs text-foreground/85 leading-relaxed space-y-2">
        <p>
          Hệ thống vừa cập nhật các tính năng và bản vá lỗi mới nhất. Bạn có thể làm mới trang ngay để áp dụng hoặc chọn để sau.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="truncate">
            Bản dựng mới nhất: <span className="font-mono font-bold text-foreground">{latestBuild.buildId}</span>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-end gap-2.5 relative z-10">
        <button
          type="button"
          onClick={dismissModal}
          disabled={isReloading}
          className="px-4 py-2 rounded-xl border border-border hover:bg-accent text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          Để sau
        </button>
        <button
          type="button"
          onClick={reloadApp}
          disabled={isReloading}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition shadow-md shadow-blue-500/25 flex items-center gap-1.5 disabled:opacity-50"
        >
          {isReloading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Đang tải lại...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cập nhật ngay</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
