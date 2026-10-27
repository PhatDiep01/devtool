import React, { useState } from 'react';
import { 
  AnnotationItem, 
  AnnotationStatus 
} from '../../../../types';
import { 
  Square, 
  Circle, 
  ArrowUpRight, 
  Minus, 
  Tag, 
  Type, 
  Highlighter, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Copy,
  ChevronDown,
  Layers
} from 'lucide-react';
import { ANNOTATION_COLORS, STATUS_OPTIONS } from './constants';
import { toast } from 'react-hot-toast';

interface AnnotationSidebarProps {
  annotations: AnnotationItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<AnnotationItem>, recordHistory?: boolean) => void;
  onDelete: (id: string) => void;
  onCopyMarkdown: () => void;
}

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  annotations,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onCopyMarkdown,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getToolIcon = (type: string) => {
    switch (type) {
      case 'rect': return <Square className="w-3.5 h-3.5" />;
      case 'circle': return <Circle className="w-3.5 h-3.5" />;
      case 'arrow': return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'line': return <Minus className="w-3.5 h-3.5" />;
      case 'badge': return <Tag className="w-3.5 h-3.5" />;
      case 'text': return <Type className="w-3.5 h-3.5" />;
      case 'highlight': return <Highlighter className="w-3.5 h-3.5" />;
      default: return <Layers className="w-3.5 h-3.5" />;
    }
  };

  const filteredAnnotations = annotations.filter((ann) => {
    if (filterStatus === 'all') return true;
    return ann.status === filterStatus;
  }).sort((a, b) => a.sequence - b.sequence);

  return (
    <aside className="w-80 border-l border-border bg-card/60 flex flex-col h-full select-none shrink-0 z-10">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
            Danh sách điểm ({annotations.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={onCopyMarkdown}
          className="p-1 px-2 rounded-lg bg-muted hover:bg-accent text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          title="Sao chép danh sách thành bảng Markdown"
        >
          <Copy className="w-3 h-3" />
          <span>Copy MD</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-border/50 text-[11px] font-medium bg-muted/20">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`flex-1 py-1 rounded-md text-center transition ${
            filterStatus === 'all'
              ? 'bg-card text-foreground shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Tất cả ({annotations.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('open')}
          className={`flex-1 py-1 rounded-md text-center transition ${
            filterStatus === 'open'
              ? 'bg-card text-red-600 dark:text-red-400 shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Chưa fix ({annotations.filter((a) => a.status === 'open').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('resolved')}
          className={`flex-1 py-1 rounded-md text-center transition ${
            filterStatus === 'resolved'
              ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Đã fix ({annotations.filter((a) => a.status === 'resolved').length})
        </button>
      </div>

      {/* Annotation Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredAnnotations.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
            <Layers className="w-8 h-8 stroke-1 mb-2 opacity-50" />
            <p className="text-xs font-semibold">Chưa có điểm đánh dấu nào</p>
            <p className="text-[11px] mt-1 text-muted-foreground/80 leading-relaxed">
              Chọn công cụ (Khung chữ nhật, Mũi tên, Huy hiệu số...) ở trên rồi nhấp hoặc kéo trên ảnh để tạo điểm đánh dấu.
            </p>
          </div>
        ) : (
          filteredAnnotations.map((ann) => {
            const isSelected = ann.id === selectedId;

            return (
              <div
                key={ann.id}
                onClick={() => onSelect(ann.id)}
                className={`p-2.5 rounded-xl border transition cursor-pointer text-xs space-y-2 ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/30'
                }`}
              >
                {/* Header: Sequence Tag, Tool Icon, Status, Delete */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-xs"
                      style={{ backgroundColor: ann.color || '#EF4444' }}
                    >
                      {ann.sequence}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 font-semibold text-[11px] truncate">
                      {getToolIcon(ann.type)}
                      <span className="capitalize">{ann.type}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Status selector */}
                    <select
                      value={ann.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdate(ann.id, { status: e.target.value as AnnotationStatus })}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-border/80 bg-background text-foreground cursor-pointer focus:outline-none"
                    >
                      <option value="open">🔴 Chưa fix</option>
                      <option value="fixing">🔵 Đang fix</option>
                      <option value="resolved">🟢 Đã fix</option>
                    </select>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(ann.id);
                        toast.success(`Đã xóa điểm #${ann.sequence}`);
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                      title="Xóa điểm đánh dấu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Note content textarea */}
                <textarea
                  value={ann.note || ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdate(ann.id, { note: e.target.value }, false)}
                  onBlur={() => onUpdate(ann.id, {}, true)}
                  placeholder="Ghi chú chi tiết lỗi hoặc hướng dẫn fix..."
                  rows={2}
                  className="w-full text-xs p-1.5 rounded-lg border border-border/80 bg-background/80 text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Color swatches for fast color changing */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {ANNOTATION_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onUpdate(ann.id, { color: c.value })}
                        className={`w-3.5 h-3.5 rounded-full border border-white/20 transition ${
                          ann.color === c.value ? 'scale-125 ring-1 ring-primary' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground/80 font-mono">
                    {Math.round(ann.x * 100)}%, {Math.round(ann.y * 100)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
