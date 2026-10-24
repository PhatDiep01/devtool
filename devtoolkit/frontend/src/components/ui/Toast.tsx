import React from 'react';
import {
  Toaster,
  toast,
  resolveValue,
  Toast as RHTToast,
  ToastType,
} from 'react-hot-toast';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Info,
  X,
  LucideIcon,
} from 'lucide-react';

interface ToastThemeConfig {
  title: string;
  titleColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentBar: string;
  progressBar: string;
  glow: string;
  icon: LucideIcon;
}

const TOAST_THEMES: Record<string, ToastThemeConfig> = {
  success: {
    title: 'Thành công',
    titleColor: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-200/90 dark:border-emerald-800/60',
    accentBar: 'bg-gradient-to-b from-emerald-500 to-teal-500',
    progressBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    glow: 'shadow-emerald-500/10 dark:shadow-emerald-500/5',
    icon: CheckCircle2,
  },
  error: {
    title: 'Đã xảy ra lỗi',
    titleColor: 'text-rose-700 dark:text-rose-400',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-600 dark:text-rose-400',
    badgeBorder: 'border-rose-200/90 dark:border-rose-800/60',
    accentBar: 'bg-gradient-to-b from-rose-500 to-red-600',
    progressBar: 'bg-gradient-to-r from-rose-500 to-red-500',
    glow: 'shadow-rose-500/10 dark:shadow-rose-500/5',
    icon: AlertCircle,
  },
  loading: {
    title: 'Đang xử lý...',
    titleColor: 'text-blue-700 dark:text-blue-400',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border-blue-200/90 dark:border-blue-800/60',
    accentBar: 'bg-gradient-to-b from-blue-500 to-indigo-600',
    progressBar: 'bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500',
    glow: 'shadow-blue-500/10 dark:shadow-blue-500/5',
    icon: Loader2,
  },
  warning: {
    title: 'Cảnh báo',
    titleColor: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-200/90 dark:border-amber-800/60',
    accentBar: 'bg-gradient-to-b from-amber-500 to-yellow-500',
    progressBar: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    glow: 'shadow-amber-500/10 dark:shadow-amber-500/5',
    icon: AlertTriangle,
  },
  blank: {
    title: 'Thông báo',
    titleColor: 'text-sky-700 dark:text-sky-400',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/60',
    badgeText: 'text-sky-600 dark:text-sky-400',
    badgeBorder: 'border-sky-200/90 dark:border-sky-800/60',
    accentBar: 'bg-gradient-to-b from-sky-500 to-blue-500',
    progressBar: 'bg-gradient-to-r from-sky-500 to-blue-500',
    glow: 'shadow-sky-500/10 dark:shadow-sky-500/5',
    icon: Info,
  },
  custom: {
    title: 'Thông báo',
    titleColor: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-50 dark:bg-slate-900',
    badgeText: 'text-slate-600 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-800',
    accentBar: 'bg-gradient-to-b from-slate-400 to-slate-600',
    progressBar: 'bg-slate-400',
    glow: 'shadow-slate-500/5',
    icon: Info,
  },
};

export interface ToastItemProps {
  toast: RHTToast;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast: t }) => {
  const rawContent = resolveValue(t.message, t);

  // Check if this blank toast represents a warning
  const isWarning =
    t.type === 'blank' &&
    (t.icon === '⚠️' ||
      (typeof rawContent === 'string' && /(?:cảnh báo|warning)/i.test(rawContent)));

  const themeKey = isWarning ? 'warning' : t.type;
  const theme = TOAST_THEMES[themeKey] || TOAST_THEMES.blank;
  const Icon = theme.icon;

  let title = theme.title;
  let description: React.ReactNode = null;

  if (React.isValidElement(rawContent)) {
    description = rawContent;
  } else if (typeof rawContent === 'string') {
    if (rawContent.includes('\n')) {
      const parts = rawContent.split('\n');
      title = parts[0].trim() || theme.title;
      description = parts.slice(1).join('\n').trim();
    } else {
      // If message is practically identical to default title, omit duplicate description
      const cleanMsg = rawContent.replace(/[!.:]/g, '').trim().toLowerCase();
      const cleanTitle = theme.title.replace(/[!.:]/g, '').trim().toLowerCase();
      if (cleanMsg === cleanTitle) {
        description = null;
      } else {
        description = rawContent;
      }
    }
  } else if (rawContent !== null && typeof rawContent === 'object') {
    const obj = rawContent as any;
    if (obj.title) title = String(obj.title);
    if (obj.message || obj.description || obj.error) {
      description = String(obj.message || obj.description || obj.error);
    } else {
      description = JSON.stringify(obj);
    }
  } else if (rawContent !== undefined && rawContent !== null) {
    description = String(rawContent);
  }

  const duration = t.duration || 4000;
  const isIndeterminate = t.type === 'loading';
  const hasTimer = !isIndeterminate && duration > 0 && duration !== Infinity;
  const isExiting = !t.visible;

  // Before height is measured by ToastWrapper, hide with opacity 0 to prevent position jumping
  const animationStyle: React.CSSProperties = t.height
    ? {
        animation: isExiting
          ? 'toastSlideOutRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          : 'toastSlideInRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    : { opacity: 0 };

  return (
    <div
      role={t.type === 'error' ? 'alert' : 'status'}
      aria-live={t.type === 'error' ? 'assertive' : 'polite'}
      className={`
        pointer-events-auto
        relative group overflow-hidden
        w-full sm:w-auto sm:max-w-[420px] sm:min-w-[340px]
        max-w-[calc(100vw-32px)]
        p-3.5 sm:p-4 rounded-2xl
        bg-white/95 dark:bg-slate-900/95
        text-slate-900 dark:text-slate-100
        border border-slate-200/90 dark:border-slate-800
        backdrop-blur-md
        shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-black/70
        transition-all duration-200
        ${theme.glow}
        ${isExiting ? 'pointer-events-none' : ''}
        ${t.className || ''}
      `}
      style={{
        ...animationStyle,
        ...t.style,
      }}
    >
      {/* Accent indicator bar on the left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accentBar}`} />

      {/* Main Toast Content Layout */}
      <div className="flex items-start gap-3">
        {/* Icon Badge */}
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ml-0.5 border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
        >
          {t.icon ? (
            <span className="text-base sm:text-lg leading-none select-none">
              {t.icon}
            </span>
          ) : (
            <Icon
              className={`w-5 h-5 ${
                t.type === 'loading' ? 'animate-spin' : ''
              }`}
              strokeWidth={2.2}
            />
          )}
        </div>

        {/* Content text */}
        <div className="flex-1 min-w-0 pr-1 select-text">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${theme.titleColor}`}
            >
              {title}
            </span>
          </div>
          {description && (
            <div className="text-[13px] sm:text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200 mt-0.5 max-h-48 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words">
              {description}
            </div>
          )}
        </div>

        {/* Close Button */}
        {t.type !== 'loading' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            title="Đóng thông báo"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Auto-dismiss countdown bar or indeterminate loading bar */}
      {isIndeterminate ? (
        <div
          key="indeterminate"
          className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800/60 overflow-hidden rounded-b-2xl"
        >
          <div
            className={`h-full w-full ${theme.progressBar} animate-[toastIndeterminate_1.6s_ease-in-out_infinite]`}
          />
        </div>
      ) : hasTimer ? (
        <div
          key={`timer-${duration}`}
          className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800/60 overflow-hidden rounded-b-2xl"
        >
          <div
            className={`h-full w-full origin-left ${theme.progressBar} group-hover:[animation-play-state:paused]`}
            style={{
              animation: `toastCountdown ${duration}ms linear forwards`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export interface AppToasterProps {
  position?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export const AppToaster: React.FC<AppToasterProps> = ({
  position = 'top-right',
}) => {
  return (
    <Toaster
      position={position}
      gutter={10}
      containerStyle={{
        top: 16,
        right: 16,
        left: 16,
        bottom: 16,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
      toastOptions={{
        duration: 4000,
        removeDelay: 350,
        error: {
          duration: 5000,
        },
      }}
    >
      {(t) => <ToastItem toast={t} />}
    </Toaster>
  );
};

export default AppToaster;
