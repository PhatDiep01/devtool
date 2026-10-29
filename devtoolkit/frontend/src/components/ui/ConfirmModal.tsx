import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRightLeft, X, CheckCircle2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'primary' | 'destructive' | 'warning' | 'purple' | 'success';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'primary',
  loading = false,
  icon
}) => {
  if (!isOpen) return null;

  const resolvedConfirmLabel = confirmText || confirmLabel || 'Xác nhận';
  const resolvedCancelLabel = cancelText || cancelLabel || 'Hủy';

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400',
          btnClass: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25',
          defaultIcon: <AlertCircle className="w-5 h-5 text-red-500" />
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25',
          defaultIcon: <AlertCircle className="w-5 h-5 text-amber-500" />
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          btnClass: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25',
          defaultIcon: <ArrowRightLeft className="w-5 h-5 text-purple-500" />
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25',
          defaultIcon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
          btnClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25',
          defaultIcon: <ArrowRightLeft className="w-5 h-5 text-blue-500" />
        };
    }
  };

  const styles = getVariantStyles();

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 sm:p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
            {icon || styles.defaultIcon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {title}
            </h3>
            <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {description}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition -mr-1 -mt-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5 ${styles.btnClass}`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>{resolvedConfirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
