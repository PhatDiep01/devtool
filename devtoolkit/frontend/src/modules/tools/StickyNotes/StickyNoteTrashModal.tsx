import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  Search, 
  AlertTriangle, 
  FileText, 
  Loader2,
  Calendar,
  Clock
} from 'lucide-react';
import { StickyNote } from '@/types';
import { getColorConfig } from './types';

interface StickyNoteTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashNotes: StickyNote[];
  isLoading: boolean;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

const formatDisplayDateTime = (val?: string | Date | null): string => {
  if (!val) return 'Mới đây';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'Mới đây';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const StickyNoteTrashModal: React.FC<StickyNoteTrashModalProps> = ({
  isOpen,
  onClose,
  trashNotes,
  isLoading,
  onRestore,
  onPermanentDelete,
  onEmptyTrash
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredTrash = trashNotes.filter(n => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div 
        className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Thùng Rác Sticky Notes</h2>
              <p className="text-xs text-muted-foreground">
                Ghi chú bị xóa được lưu tại đây. Bạn có thể khôi phục hoặc xóa vĩnh viễn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trashNotes.length > 0 && !confirmEmpty && (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Dọn sạch thùng rác
              </button>
            )}

            {confirmEmpty && (
              <div className="flex items-center gap-1.5 bg-destructive/10 p-1 rounded-lg">
                <span className="text-xs text-destructive font-medium px-2">Xóa tất cả?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onEmptyTrash();
                    setConfirmEmpty(false);
                  }}
                  className="px-2 py-1 text-xs font-bold rounded bg-destructive text-destructive-foreground hover:opacity-90"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(false)}
                  className="px-2 py-1 text-xs rounded hover:bg-accent text-foreground"
                >
                  Hủy
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm trong thùng rác..."
            className="flex-1 bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Đang tải danh sách thùng rác...</span>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-medium">
                {searchTerm ? 'Không tìm thấy ghi chú phù hợp' : 'Thùng rác trống'}
              </p>
              <p className="text-xs text-muted-foreground/80 max-w-sm">
                Khi xóa một ghi chú từ danh sách, nó sẽ xuất hiện ở đây trước khi bị xóa hoàn toàn.
              </p>
            </div>
          ) : (
            filteredTrash.map((note) => {
              const colorConfig = getColorConfig(note.color);
              return (
                <div
                  key={note.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${colorConfig.cardBgClass} ${colorConfig.borderClass}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: colorConfig.hex }} 
                        title={`Màu: ${colorConfig.label}`}
                      />
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {note.title?.trim() || 'New Note'}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 font-mono break-words">
                      {(note.preview && note.preview.trim()) || (note.content && note.content.trim().slice(0, 160)) || '(Ghi chú trống)'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sửa: {formatDisplayDateTime(note.updated_at)}
                      </span>
                      <span>•</span>
                      <span>{note.size_bytes} bytes</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onRestore(note.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition flex items-center gap-1"
                      title="Khôi phục ghi chú về danh sách chính"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Khôi phục
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDelete(note.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition flex items-center gap-1"
                      title="Xóa vĩnh viễn khỏi ổ đĩa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa vĩnh viễn
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Tổng số: {filteredTrash.length} ghi chú trong thùng rác</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
