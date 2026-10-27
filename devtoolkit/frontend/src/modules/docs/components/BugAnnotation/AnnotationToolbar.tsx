import React from 'react';
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
  AlertCircle
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
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-card/90 backdrop-blur border-b border-border text-foreground select-none shrink-0 z-10">
      {/* Group 1: Tools */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onSelectTool(t.type)}
              title={t.label}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
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
      <div className="flex items-center gap-2">
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

      {/* Group 3: History & Zoom */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-muted/40 p-1 rounded-xl border border-border/50">
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
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs font-semibold">
          <button
            type="button"
            onClick={onZoomOut}
            title="Thu nhỏ (-)"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            title="Khôi phục 100% (0)"
            className="px-1.5 py-0.5 rounded hover:bg-accent font-mono text-[11px]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="Phóng to (+)"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <ZoomIn className="w-4 h-4" />
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
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border border-border/40 bg-muted/20">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-blue-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Đang lưu...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Đã lưu</span>
            </span>
          )}
          {saveStatus === 'dirty' && (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Chưa lưu</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <AlertCircle className="w-3 h-3" />
              <span>Lỗi lưu</span>
            </span>
          )}
        </div>

        {/* Shortcuts Help Guide Button */}
        <button
          type="button"
          onClick={onToggleShortcutsModal}
          title="Xem bảng phím tắt"
          className="p-1.5 rounded-xl border border-border/50 bg-muted/40 hover:bg-accent text-muted-foreground hover:text-foreground transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
