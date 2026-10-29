import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Search, 
  Pin, 
  Copy, 
  Download, 
  CopyPlus, 
  Edit3, 
  StickyNote as StickyNoteIcon, 
  ArrowUpDown, 
  Clock, 
  AlertTriangle,
  RotateCcw,
  Check,
  Filter
} from 'lucide-react';
import { useStickyNotes } from './useStickyNotes';
import { STICKY_COLORS, getColorConfig } from './types';
import { StickyNoteEditorModal } from './StickyNoteEditorModal';
import { StickyNoteTrashModal } from './StickyNoteTrashModal';
import { StickyNote, StickyNoteSortBy, StickyNoteSortOrder } from '@/types';

// Safe Date Formatter helper
const formatDisplayDate = (val?: string | Date | null): string => {
  if (!val) return 'Mới đây';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'Mới đây';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const StickyNotesPage: React.FC = () => {
  const {
    notes,
    setNotes,
    trashNotes,
    loading,
    trashLoading,
    corruptedCount,
    search,
    setSearch,
    colorFilter,
    setColorFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeNote,
    setActiveNote,
    isEditorOpen,
    setIsEditorOpen,
    isTrashOpen,
    setIsTrashOpen,
    noteToDelete,
    setNoteToDelete,
    fetchTrash,
    handleCreateNote,
    handleTogglePin,
    handleChangeColor,
    handleDuplicateNote,
    handleConfirmDelete,
    handleRestoreNote,
    handlePermanentDelete,
    handleEmptyTrash,
    handleImportFile,
    handleCopyContent,
    handleExportNote
  } = useStickyNotes();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openColorPickerNoteId, setOpenColorPickerNoteId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Handle noteId from URL (e.g. from global search)
  useEffect(() => {
    const targetNoteId = searchParams.get('noteId');
    if (targetNoteId && notes.length > 0) {
      const match = notes.find(n => n.id === targetNoteId);
      if (match) {
        setActiveNote(match);
        setIsEditorOpen(true);
      }
    }
  }, [searchParams, notes, setActiveNote, setIsEditorOpen]);

  // Close color popover when clicking anywhere outside
  useEffect(() => {
    if (!openColorPickerNoteId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.sticky-color-picker-container')) {
        setOpenColorPickerNoteId(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openColorPickerNoteId]);

  const handleOpenTrash = () => {
    fetchTrash();
    setIsTrashOpen(true);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hidden File Input for .txt import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <StickyNoteIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Sticky Notes
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Ghi chú nhanh lưu trữ độc lập dạng file .txt UTF-8 (Thư mục <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">sticky_notes/</code>)
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleOpenFilePicker}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-card hover:bg-accent text-foreground transition flex items-center gap-2 shadow-xs"
          >
            <Upload className="w-4 h-4 text-primary" />
            <span>Nhập file .txt</span>
          </button>

          <button
            type="button"
            onClick={handleOpenTrash}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-card hover:bg-accent text-foreground transition flex items-center gap-2 shadow-xs"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            <span>Thùng rác</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateNote()}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo ghi chú mới</span>
          </button>
        </div>
      </div>

      {/* Corrupted files warning banner */}
      {corruptedCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Hệ thống phát hiện {corruptedCount} file trong thư mục không đúng định dạng và đã tự động bỏ qua để đảm bảo an toàn.
          </span>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-2xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên hoặc nội dung ghi chú..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-muted/40 border border-border/60 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        {/* Color Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setColorFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${
              colorFilter === 'all' 
                ? 'bg-foreground text-background shadow-sm' 
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            Tất cả màu
          </button>
          {STICKY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColorFilter(c.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                colorFilter === c.id ? 'ring-2 ring-primary ring-offset-1 bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
              <span className="hidden sm:inline text-foreground">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as StickyNoteSortBy)}
            className="px-2.5 py-1.5 text-xs bg-muted/50 border border-border/60 rounded-lg text-foreground focus:outline-none cursor-pointer"
          >
            <option value="updated_at">Thời gian sửa</option>
            <option value="created_at">Thời gian tạo</option>
            <option value="title">Tên ghi chú</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-lg border border-border/60 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title={sortOrder === 'asc' ? 'Thứ tự tăng dần' : 'Thứ tự giảm dần'}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted/30 border border-border animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        /* Empty States */
        <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl p-8 flex flex-col items-center justify-center gap-4 bg-card/30">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <StickyNoteIcon className="w-8 h-8 opacity-60" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {search || colorFilter !== 'all' ? 'Không tìm thấy ghi chú phù hợp' : 'Chưa có ghi chú Sticky Note nào'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md">
              {search || colorFilter !== 'all'
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc màu để xem toàn bộ danh sách.'
                : 'Tạo ghi chú mới hoặc nhập file .txt từ máy tính để bắt đầu ghi chép nhanh.'}
            </p>
          </div>
          {search || colorFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setColorFilter('all');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent text-foreground hover:bg-accent/80 transition"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleCreateNote()}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tạo Ghi Chú Đầu Tiên
            </button>
          )}
        </div>
      ) : (
        /* Notes Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notes.map((note) => {
            const colorConfig = getColorConfig(note.color);
            return (
              <div
                key={note.id}
                onClick={() => {
                  setActiveNote(note);
                  setIsEditorOpen(true);
                }}
                className={`group rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md relative ${
                  openColorPickerNoteId === note.id ? 'z-20 ring-1 ring-primary/30' : 'hover:z-10'
                } ${colorConfig.cardBgClass} ${colorConfig.borderClass}`}
              >
                {/* Card Top: Pin + Title */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {note.title?.trim() || 'New Note'}
                    </h3>

                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(note, e)}
                      className={`p-1 rounded-md transition shrink-0 ${
                        note.pinned 
                          ? 'text-amber-500 hover:text-amber-600' 
                          : 'text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100'
                      }`}
                      title={note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                    >
                      <Pin className={`w-4 h-4 ${note.pinned ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Preview Text */}
                  <p className="text-xs text-muted-foreground line-clamp-4 font-mono leading-relaxed mb-4 break-words">
                    {(note.preview && note.preview.trim()) || (note.content && note.content.trim().slice(0, 160)) || '(Chưa có nội dung)'}
                  </p>
                </div>

                {/* Card Bottom: Metadata & Action Toolbar */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {formatDisplayDate(note.updated_at)}
                    </span>
                  </div>

                  {/* Hover Actions */}
                  <div 
                    className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Quick Color Picker Dropdown / Dot */}
                    <div className="relative group/color sticky-color-picker-container">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenColorPickerNoteId(prev => prev === note.id ? null : note.id);
                        }}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition flex items-center justify-center shrink-0"
                        title="Đổi màu ghi chú"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shadow-xs block"
                          style={{ backgroundColor: colorConfig.hex }}
                        />
                      </button>

                      {/* Floating Color Palette with Gapless Hitbox */}
                      <div
                        className={`absolute bottom-full right-0 pb-2 z-30 ${
                          openColorPickerNoteId === note.id
                            ? 'flex'
                            : 'hidden group-hover/color:flex'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 p-1.5 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100">
                          {STICKY_COLORS.map((c) => {
                            const isSelected = note.color === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={(e) => {
                                  handleChangeColor(note, c.id, e);
                                  setOpenColorPickerNoteId(null);
                                }}
                                style={{ backgroundColor: c.hex }}
                                className={`w-5 h-5 rounded-full border border-black/15 dark:border-white/15 transition-all duration-150 flex items-center justify-center shadow-2xs ${
                                  isSelected
                                    ? 'scale-125 ring-2 ring-primary ring-offset-1 z-10'
                                    : 'hover:scale-125 hover:z-10 opacity-90 hover:opacity-100'
                                }`}
                                title={c.label}
                              >
                                {isSelected && (
                                  <Check className="w-2.5 h-2.5 text-black/75 dark:text-black/80 stroke-[3]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopyContent(note, e)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition"
                      title="Sao chép nội dung"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleExportNote(note, e)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition"
                      title="Tải về file .txt"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDuplicateNote(note, e)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition"
                      title="Nhân bản"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(note);
                      }}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded transition"
                      title="Chuyển vào thùng rác"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {noteToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setNoteToDelete(null)}
        >
          <div 
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Xác nhận chuyển vào thùng rác</h3>
                <p className="text-xs text-muted-foreground">
                  Ghi chú có thể được khôi phục bất cứ lúc nào từ Thùng rác.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Bạn có chắc chắn muốn xóa ghi chú: <b className="text-foreground">"{noteToDelete.title}"</b>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-accent text-foreground transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 transition shadow-sm"
              >
                Chuyển vào Thùng rác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <StickyNoteEditorModal
        isOpen={isEditorOpen}
        note={activeNote}
        onClose={() => {
          setIsEditorOpen(false);
          setActiveNote(null);
        }}
        onNoteUpdated={(updated, isNew) => {
          if (isNew) {
            setNotes(prev => [updated, ...prev.filter(n => n.id !== updated.id)]);
          } else {
            setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
          }
          setActiveNote(updated);
        }}
        onDuplicate={handleDuplicateNote}
        onDelete={(note) => {
          setNoteToDelete(note);
        }}
        onExport={handleExportNote}
      />

      {/* Trash Modal */}
      <StickyNoteTrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        trashNotes={trashNotes}
        isLoading={trashLoading}
        onRestore={handleRestoreNote}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
      />
    </div>
  );
};
