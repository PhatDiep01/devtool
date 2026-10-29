import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MousePointer, 
  Square, 
  Circle, 
  ArrowUpRight, 
  Minus, 
  Type, 
  Tag, 
  Highlighter, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw,
  HelpCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Palette,
  Check
} from 'lucide-react';
import { AnnotationType } from '../../../../types';
import { ANNOTATION_COLORS, STROKE_WIDTH_OPTIONS } from './constants';

interface AnnotationToolbarProps {
  activeTool: AnnotationType | 'select';
  activeColor: string;
  strokeWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  lastSavedAt: Date | null;
  onSelectTool: (tool: AnnotationType | 'select') => void;
  onSelectColor: (color: string) => void;
  onSelectStrokeWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  onToggleShortcutsModal: () => void;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  activeColor,
  strokeWidth,
  canUndo,
  canRedo,
  zoom,
  saveStatus,
  lastSavedAt,
  onSelectTool,
  onSelectColor,
  onSelectStrokeWidth,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  onToggleShortcutsModal,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const togglePicker = () => {
    if (!isPickerOpen && pickerRef.current) {
      const rect = pickerRef.current.getBoundingClientRect();
      const dropdownW = 210;
      const left = Math.max(8, Math.min(window.innerWidth - dropdownW - 8, rect.left));
      setPopoverPos({
        top: rect.bottom + 6,
        left,
      });
      setIsPickerOpen(true);
    } else {
      setIsPickerOpen(false);
    }
  };

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current && !pickerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPickerOpen]);

  const tools = [
    { type: 'select', label: 'Chọn (V)', icon: MousePointer },
    { type: 'rect', label: 'Khung chữ nhật (R)', icon: Square },
    { type: 'circle', label: 'Hình tròn (C)', icon: Circle },
    { type: 'arrow', label: 'Mũi tên (A)', icon: ArrowUpRight },
    { type: 'line', label: 'Đường thẳng (L)', icon: Minus },
    { type: 'badge', label: 'Huy hiệu số (N)', icon: Tag },
    { type: 'text', label: 'Văn bản (T)', icon: Type },
    { type: 'highlight', label: 'Làm nổi bật (H)', icon: Highlighter },
  ] as const;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-card/95 backdrop-blur border-b border-border text-foreground select-none shrink-0 z-10 overflow-x-auto scrollbar-none touch-pan-x">
      {/* Group 1: Tools */}
      <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 shrink-0">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onSelectTool(t.type)}
              title={t.label}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Group 2: Color Palette & Stroke Width */}
      {/* Desktop View (>= md): Full Palette */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        {/* Colors */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
          {ANNOTATION_COLORS.map((col) => {
            const isSelected = activeColor === col.value;
            return (
              <button
                key={col.value}
                type="button"
                onClick={() => onSelectColor(col.value)}
                title={col.name}
                className={`w-5 h-5 rounded-full transition-transform border ${
                  isSelected ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: col.value, borderColor: 'rgba(255,255,255,0.2)' }}
              />
            );
          })}
        </div>

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
          {STROKE_WIDTH_OPTIONS.map((sw) => (
            <button
              key={sw.value}
              type="button"
              onClick={() => onSelectStrokeWidth(sw.value)}
              title={sw.label}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                strokeWidth === sw.value
                  ? 'bg-accent text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {sw.value}px
            </button>
          ))}
        </div>
      </div>

      {/* Mobile View (< md): Compact Popover Button */}
      <div className="md:hidden relative shrink-0" ref={pickerRef}>
        <button
          type="button"
          onClick={togglePicker}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 hover:bg-muted rounded-xl border border-border/60 transition shadow-xs"
          title="Chọn màu sắc & độ dày nét vẽ"
        >
          <div
            className="w-4 h-4 rounded-full border border-white/40 shadow-xs shrink-0"
            style={{ backgroundColor: activeColor }}
          />
          <span className="text-[11px] font-bold text-foreground">
            {strokeWidth}px
          </span>
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {isPickerOpen && popoverPos && typeof document !== 'undefined' && createPortal(
          <div 
            ref={popoverRef}
            className="fixed p-3 bg-card border border-border rounded-2xl shadow-2xl z-[130] flex flex-col gap-2.5 w-[210px] animate-in fade-in zoom-in-95 duration-150"
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Màu vẽ
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ANNOTATION_COLORS.map((col) => {
                const isSelected = activeColor === col.value;
                return (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => onSelectColor(col.value)}
                    title={col.name}
                    className={`w-7 h-7 rounded-full transition-transform border flex items-center justify-center ${
                      isSelected ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: col.value, borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-1.5 border-t border-border/60">
              Độ dày nét
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STROKE_WIDTH_OPTIONS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => {
                    onSelectStrokeWidth(sw.value);
                    setIsPickerOpen(false);
                  }}
                  className={`py-1 rounded-lg text-xs font-bold text-center transition ${
                    strokeWidth === sw.value
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 hover:bg-muted text-foreground'
                  }`}
                >
                  {sw.value}px
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>

      <div className="flex-1 min-w-[2px]" />

      {/* Group 3: History & Zoom */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-muted/40 p-1 rounded-xl border border-border/50 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl + Z)"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Làm lại (Ctrl + Y)"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={onZoomOut}
            title="Thu nhỏ (-)"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            title="Khôi phục 100% (0)"
            className="px-1.5 py-0.5 rounded hover:bg-accent font-mono text-[10px] sm:text-[11px]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="Phóng to (+)"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={onFitToScreen}
            title="Vừa màn hình (F)"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auto-save Status Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border border-border/40 bg-muted/20 shrink-0">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-blue-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Đang lưu...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Đã lưu</span>
            </span>
          )}
          {saveStatus === 'dirty' && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="hidden sm:inline">Chưa lưu</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <AlertCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Lỗi lưu</span>
            </span>
          )}
        </div>

        {/* Shortcuts Help Guide Button */}
        <button
          type="button"
          onClick={onToggleShortcutsModal}
          title="Xem bảng phím tắt"
          className="hidden sm:flex p-1.5 rounded-xl border border-border/50 bg-muted/40 hover:bg-accent text-muted-foreground hover:text-foreground transition shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
