import React from 'react';
import clsx from 'clsx';
import { ApiMethod } from '@/types';

interface ApiMethodBadgeProps {
  method: ApiMethod | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30'
  },
  POST: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30'
  },
  PUT: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30'
  },
  PATCH: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30'
  },
  DELETE: {
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30'
  },
  HEAD: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/30'
  },
  OPTIONS: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30'
  }
};

export const ApiMethodBadge: React.FC<ApiMethodBadgeProps> = ({
  method,
  size = 'md',
  className
}) => {
  const upper = (method || 'GET').toUpperCase();
  const theme = METHOD_COLORS[upper] || {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border'
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider font-mono',
    md: 'text-xs px-2 py-0.5 rounded-md font-bold tracking-wider font-mono',
    lg: 'text-sm px-3 py-1 rounded-lg font-extrabold tracking-wider font-mono'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center border transition-colors select-none shrink-0',
        theme.bg,
        theme.text,
        theme.border,
        sizeClasses[size],
        className
      )}
    >
      {upper}
    </span>
  );
};
