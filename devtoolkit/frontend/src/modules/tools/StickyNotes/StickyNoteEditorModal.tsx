import React, { useState } from 'react';
import { 
  X, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  CheckSquare, 
  Undo2, 
  Redo2, 
  Pin, 
  Copy, 
  Download, 
  Trash2, 
  CopyPlus, 
  Eye, 
  Edit3, 
  Columns, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Save,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StickyNote, StickyNoteColor } from '@/types';
import { useStickyNoteEditor } from './useStickyNoteEditor';
import { STICKY_COLORS, getColorConfig } from './types';
import { MarkdownRenderer } from '../../docs/components/MarkdownRenderer';

interface StickyNoteEditorModalProps {
  isOpen: boolean;
  note: StickyNote | null;
  onClose: () => void;
  onNoteUpdated: (updated: StickyNote, isNew?: boolean) => void;
  onDuplicate: (note: StickyNote) => Promise<any>;
  onDelete: (note: StickyNote) => void;
  onExport: (note: StickyNote) => void;
}

export const StickyNoteEditorModal: React.FC<StickyNoteEditorModalProps> = ({
  isOpen,
  note,
  onClose,
  onNoteUpdated,
  onDuplicate,
  onDelete,
  onExport
}) => {
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [isCopied, setIsCopied] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);

  const {
    isNewNote,
    title,
    setTitle,
    content,
    setContent,
    color,
    setColor,
    pinned,
    setPinned,
    version,
    saveStatus,
    isDirty,
    stats,
    textareaRef,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleFormatBold,
    handleFormatItalic,
    handleFormatHeading,
    handleFormatList,
    handleFormatChecklist,
    toggleChecklistLine,
    conflictData,
    isConflictModalOpen,
    handleResolveConflict,
    manualSave,
    saveAndClose,
    isConfirmCloseOpen,
    requestClose,
    confirmSaveAndClose,
    confirmDiscardAndClose,
    cancelClose
  } = useStickyNoteEditor(note, onNoteUpdated);

  // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z, Ctrl+Y, Ctrl+S)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleFormatBold();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleFormatItalic();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        manualSave();
      }
    }
  };

  if (!isOpen || !note) return null;

  const colorConfig = getColorConfig(color);

  // Copy quick content
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success('Đã sao chép nội dung vào clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Không thể truy cập clipboard');
    }
  };

  // Safe Close Request
  const handleSafeClose = () => {
    requestClose(onClose);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
    >
      <div 
        className={`w-full max-w-4xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] transition-colors relative ${colorConfig.cardBgClass} ${colorConfig.borderClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 ${colorConfig.headerBgClass} ${colorConfig.borderClass}`}>
          {/* Title input */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`p-1.5 rounded-lg transition shrink-0 ${
                pinned 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={pinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú lên đầu'}
            >
              <Pin className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} />
            </button>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Đặt tiêu đề ghi chú..."
              maxLength={100}
              className="w-full bg-transparent border-none font-bold text-base sm:text-lg text-foreground focus:outline-none placeholder:text-muted-foreground/60 truncate"
            />
          </div>

          {/* Color Picker & Save status & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Color Palette Selector */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-background/40 border border-border/40 backdrop-blur-sm">
              {STICKY_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    color === c.id ? 'scale-125 ring-2 ring-primary ring-offset-1' : 'hover:scale-110 opacity-80'
                  }`}
                  title={`Đổi màu sang: ${c.label}`}
                />
              ))}
            </div>

            {/* Mobile Color Dot with Popover */}
            <div className="relative sm:hidden">
              <button
                type="button"
                onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
                style={{ backgroundColor: colorConfig.hex }}
                className="w-6 h-6 rounded-full border border-black/20 dark:border-white/20 shadow-sm shrink-0 active:scale-95 transition-transform"
                title={`Màu hiện tại: ${colorConfig.label}. Bấm để đổi màu`}
              />
              {isColorMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsColorMenuOpen(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 p-1.5 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-40 flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                    {STICKY_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setColor(c.id);
                          setIsColorMenuOpen(false);
                        }}
                        style={{ backgroundColor: c.hex }}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          color === c.id ? 'scale-125 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Save Status Badge */}
            <div className="hidden sm:flex items-center text-xs">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Đang lưu...
                </span>
              )}
              {saveStatus === 'dirty' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Chưa lưu
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã lưu
                </span>
              )}
              {saveStatus === 'idle' && (
                <span className="text-muted-foreground px-2 py-0.5 text-[11px] font-mono">
                  {isNewNote ? 'Bản nháp' : `v${version}`}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Lưu lỗi
                </span>
              )}
              {saveStatus === 'conflict' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 font-bold border border-rose-500/30 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Xung đột!
                </span>
              )}
            </div>

            {/* Quick Actions (Copy, Export, Duplicate, Trash) */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Sao chép nội dung"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {!isNewNote && (
              <>
                <button
                  type="button"
                  onClick={() => onExport(note)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition"
                  title="Tải về file .txt"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onDuplicate(note)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition"
                  title="Nhân bản ghi chú"
                >
                  <CopyPlus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(note)}
                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition"
                  title="Chuyển vào thùng rác"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <div className="w-[1px] h-4 bg-border/60 mx-1" />

            <button
              type="button"
              onClick={handleSafeClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition"
              title="Đóng ghi chú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 sm:px-6 py-2 border-b border-border/40 bg-background/50 flex flex-wrap items-center justify-between gap-2 backdrop-blur-sm">
          {/* Format Tools */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition"
              title="Hoàn tác (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition"
              title="Làm lại (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-border/60 mx-1" />

            <button
              type="button"
              onClick={handleFormatBold}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="In đậm (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleFormatItalic}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="In nghiêng (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-border/60 mx-1" />

            <button
              type="button"
              onClick={() => handleFormatHeading(1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Tiêu đề H1 (#)"
            >
              <Heading1 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleFormatHeading(2)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Tiêu đề H2 (##)"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleFormatHeading(3)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Tiêu đề H3 (###)"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-border/60 mx-1" />

            <button
              type="button"
              onClick={handleFormatList}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Danh sách gạch đầu dòng (-)"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleFormatChecklist}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Danh sách việc cần làm (- [ ])"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${
                viewMode === 'edit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Soạn thảo
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden sm:flex px-2.5 py-1 text-xs font-medium rounded-md transition items-center gap-1 ${
                viewMode === 'split' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Song song
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${
                viewMode === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Xem trước
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0 bg-background/20">
          {/* Text Editor Pane */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`flex-1 flex flex-col min-h-0 ${viewMode === 'split' ? 'border-r border-border/40' : ''}`}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập nội dung ghi chú tại đây... Hỗ trợ Markdown, checklist `- [ ]`, in đậm `**`, tiêu đề `#`... (Bấm Ctrl+S để lưu)"
                className="flex-1 w-full p-4 sm:p-6 bg-transparent text-foreground font-mono text-sm sm:text-base leading-relaxed resize-none focus:outline-none placeholder:text-muted-foreground/50 overflow-y-auto"
                spellCheck={false}
              />
            </div>
          )}

          {/* Markdown Preview Pane */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-card/60 backdrop-blur-sm">
              {content.trim() ? (
                <div className="prose dark:prose-invert max-w-none text-sm sm:text-base">
                  <MarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/60 text-sm">
                  Chưa có nội dung để hiển thị xem trước...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Stats Bar */}
        <div className={`px-4 sm:px-6 py-2.5 border-t flex items-center justify-between text-xs text-muted-foreground bg-background/60 backdrop-blur-sm ${colorConfig.borderClass}`}>
          <div className="flex items-center gap-3 font-mono">
            <span>{stats.charCount} ký tự</span>
            <span>•</span>
            <span>{stats.wordCount} từ</span>
            <span>•</span>
            <span>{stats.lineCount} dòng</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">{(stats.byteSize / 1024).toFixed(1)} KB / 500 KB</span>
          </div>

          <div className="flex items-center gap-2">
            {stats.byteSize > 450 * 1024 && (
              <span className="text-amber-500 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Gần đạt dung lượng tối đa!
              </span>
            )}
            {/* Left Button: Lưu lại (keeps editor open) */}
            <button
              type="button"
              onClick={() => manualSave()}
              disabled={saveStatus === 'saving'}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm ${
                isDirty
                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
              title="Lưu các thay đổi và tiếp tục chỉnh sửa (Ctrl+S)"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Lưu lại</span>
            </button>

            {/* Right Button: Lưu & Đóng (saves and closes immediately without confirm popup) */}
            <button
              type="button"
              onClick={() => saveAndClose(onClose)}
              disabled={saveStatus === 'saving'}
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
              title="Lưu ghi chú và đóng trình soạn thảo"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Lưu & Đóng</span>
            </button>
          </div>
        </div>

        {/* POPUP CONFIRM WHEN CLOSING WITH UNSAVED CHANGES */}
        {isConfirmCloseOpen && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div 
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-amber-500">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Bạn có thay đổi chưa lưu!</h3>
                  <p className="text-xs text-muted-foreground">
                    Ghi chú chưa được lưu vào hệ thống. Bạn có muốn lưu lại trước khi thoát không?
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={confirmSaveAndClose}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Lưu & Đóng
                </button>

                <button
                  type="button"
                  onClick={confirmDiscardAndClose}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Không lưu & Thoát
                </button>

                <button
                  type="button"
                  onClick={cancelClose}
                  className="w-full px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition text-center"
                >
                  Tiếp tục chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Concurrency Conflict Resolution Modal Overlay */}
        {isConflictModalOpen && conflictData && (
          <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-lg bg-card border border-destructive/50 rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Phát Hiện Xung Đột Dữ Liệu</h3>
                  <p className="text-xs text-muted-foreground">
                    Ghi chú này đã được chỉnh sửa tại một tab hoặc phiên làm việc khác trong khi bạn đang mở.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1 font-mono">
                <p><b>Phiên bản trên máy chủ:</b> v{conflictData.currentVersion} ({new Date(conflictData.currentUpdatedAt).toLocaleTimeString('vi-VN')})</p>
                <p><b>Phiên bản cục bộ của bạn:</b> v{version}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Chọn phương án giải quyết để không mất dữ liệu:</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolveConflict('overwrite')}
                    className="w-full px-4 py-2.5 rounded-xl border border-destructive text-destructive font-semibold hover:bg-destructive hover:text-destructive-foreground transition text-xs text-left"
                  >
                    1. Ghi đè phiên bản của tôi lên máy chủ (Buộc lưu)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveConflict('save_as_copy')}
                    className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-xs text-left"
                  >
                    2. Lưu nội dung của tôi thành bản sao mới (Khuyến nghị an toàn)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveConflict('reload')}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-accent font-semibold transition text-xs text-left text-foreground"
                  >
                    3. Hủy bỏ thay đổi của tôi và nạp lại từ máy chủ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
