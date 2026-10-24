import React, { forwardRef } from 'react';
import { X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
  clearable?: boolean;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onClear,
      clearable = false,
      sizeVariant = 'md',
      className = '',
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'py-1.5 text-xs min-h-[32px]',
      md: 'py-2 text-xs min-h-[38px]',
      lg: 'py-2.5 text-sm min-h-[44px]',
    }[sizeVariant];

    const paddingClasses = `${leftIcon ? 'pl-9' : 'pl-3.5'} ${
      clearable || rightIcon ? 'pr-9' : 'pr-3.5'
    }`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-foreground block">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-muted-foreground pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            value={value}
            disabled={disabled}
            className={`w-full bg-background border rounded-xl font-medium text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none ${sizeClasses} ${paddingClasses} ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed bg-muted/40' : ''} ${className}`}
            {...props}
          />

          <div className="absolute right-2.5 flex items-center gap-1">
            {clearable && Boolean(value) && !disabled && (
              <button
                type="button"
                onClick={onClear}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="Xóa nội dung"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {rightIcon && !Boolean(value && clearable) && (
              <div className="text-muted-foreground pointer-events-none flex items-center justify-center">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {error ? (
          <p className="text-[11px] text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', disabled, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-foreground block">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          disabled={disabled}
          className={`w-full bg-background border rounded-xl p-3 text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs hover:border-primary/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-muted/40' : ''} ${className}`}
          {...props}
        />

        {error ? (
          <p className="text-[11px] text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
