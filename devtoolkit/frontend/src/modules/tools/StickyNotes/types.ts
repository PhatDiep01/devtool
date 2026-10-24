import { StickyNote, StickyNoteColor, StickyNoteSortBy, StickyNoteSortOrder, ConflictErrorData } from '@/types';

export interface ColorOption {
  id: StickyNoteColor;
  label: string;
  bgClass: string;
  cardBgClass: string;
  borderClass: string;
  headerBgClass: string;
  hex: string;
}

export const STICKY_COLORS: ColorOption[] = [
  {
    id: 'yellow',
    label: 'Vàng Cổ Điển',
    bgClass: 'bg-amber-100 dark:bg-amber-950/60',
    cardBgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-300 dark:border-amber-700/60',
    headerBgClass: 'bg-amber-200/70 dark:bg-amber-900/50',
    hex: '#fef08a'
  },
  {
    id: 'blue',
    label: 'Xanh Dương',
    bgClass: 'bg-sky-100 dark:bg-sky-950/60',
    cardBgClass: 'bg-sky-50 dark:bg-sky-950/30',
    borderClass: 'border-sky-300 dark:border-sky-700/60',
    headerBgClass: 'bg-sky-200/70 dark:bg-sky-900/50',
    hex: '#bae6fd'
  },
  {
    id: 'green',
    label: 'Xanh Lá',
    bgClass: 'bg-emerald-100 dark:bg-emerald-950/60',
    cardBgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-300 dark:border-emerald-700/60',
    headerBgClass: 'bg-emerald-200/70 dark:bg-emerald-900/50',
    hex: '#bbf7d0'
  },
  {
    id: 'pink',
    label: 'Hồng Phấn',
    bgClass: 'bg-rose-100 dark:bg-rose-950/60',
    cardBgClass: 'bg-rose-50 dark:bg-rose-950/30',
    borderClass: 'border-rose-300 dark:border-rose-700/60',
    headerBgClass: 'bg-rose-200/70 dark:bg-rose-900/50',
    hex: '#fbcfe8'
  },
  {
    id: 'purple',
    label: 'Tím Oải Hương',
    bgClass: 'bg-purple-100 dark:bg-purple-950/60',
    cardBgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-purple-300 dark:border-purple-700/60',
    headerBgClass: 'bg-purple-200/70 dark:bg-purple-900/50',
    hex: '#e9d5ff'
  },
  {
    id: 'orange',
    label: 'Cam Đào',
    bgClass: 'bg-orange-100 dark:bg-orange-950/60',
    cardBgClass: 'bg-orange-50 dark:bg-orange-950/30',
    borderClass: 'border-orange-300 dark:border-orange-700/60',
    headerBgClass: 'bg-orange-200/70 dark:bg-orange-900/50',
    hex: '#fed7aa'
  }
];

export function getColorConfig(color: StickyNoteColor): ColorOption {
  return STICKY_COLORS.find(c => c.id === color) || STICKY_COLORS[0];
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
export type AutoSaveStatus = SaveStatus; // Backwards-compatible alias
