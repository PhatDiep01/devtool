import React, { useState, useMemo } from 'react';
import { 
  X, 
  Folder, 
  Search, 
  FileText, 
  Download, 
  Edit2, 
  Trash2, 
  Check, 
  AlertTriangle,
  Clock,
  HardDrive
} from 'lucide-react';
import { SavedMarkdownFile } from './types';
import { formatRelativeTime } from '../../../utils/dateUtils';
import { downloadMarkdownFile, sanitizeFileName } from './useMarkdownStorage';

interface SavedFilesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: SavedMarkdownFile[];
  onOpenFile: (file: SavedMarkdownFile) => void;
  onRenameFile: (id: string, newName: string) => boolean;
  onDeleteFile: (id: string) => void;
}

export const SavedFilesDrawer: React.FC<SavedFilesDrawerProps> = ({
  isOpen,
  onClose,
  files,
  onOpenFile,
  onRenameFile,
  onDeleteFile
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // State rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameError, setRenameError] = useState('');

  // State delete confirmation modal
  const [fileToDelete, setFileToDelete] = useState<SavedMarkdownFile | null>(null);

  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    const term = searchTerm.toLowerCase();
    return files.filter(f => 
      f.name.toLowerCase().includes(term) ||
      (f.note && f.note.toLowerCase().includes(term))
    );
  }, [files, searchTerm]);

  if (!isOpen) return null;

  const startRename = (file: SavedMarkdownFile) => {
    setEditingId(file.id);
    setEditingName(sanitizeFileName(file.name));
    setRenameError('');
  };

  const confirmRename = (id: string) => {
    const clean = sanitizeFileName(editingName);
    if (!clean) {
      setRenameError('Tên không được để trống.');
      return;
    }
    const success = onRenameFile(id, clean);
    if (!success) {
      setRenameError('Tên file đã tồn tại hoặc không hợp lệ.');
      return;
    }
    setEditingId(null);
    setEditingName('');
    setRenameError('');
  };

  const handleConfirmDelete = () => {
    if (fileToDelete) {
      onDeleteFile(fileToDelete.id);
      setFileToDelete(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5 font-semibold text-foreground">
            <Folder className="w-5 h-5 text-primary" />
            <span>Danh sách file đã lưu</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-border bg-background">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm file theo tên hoặc ghi chú..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-foreground placeholder:text-muted-foreground/60"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchTerm ? 'Không tìm thấy file phù hợp' : 'Bạn chưa lưu file nào'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {searchTerm
                  ? 'Thử tìm kiếm với từ khóa khác'
                  : 'Hãy soạn thảo nội dung và bấm nút "Lưu" để lưu trữ tài liệu vào danh sách.'}
              </p>
            </div>
          ) : (
            filteredFiles.map(file => {
              const isEditing = editingId === file.id;

              return (
                <div
                  key={file.id}
                  className="group relative p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-150 flex flex-col gap-2"
                >
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmRename(file.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="w-full text-xs sm:text-sm font-semibold px-2 py-1 rounded-lg border border-primary bg-background focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => confirmRename(file.id)}
                              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                              title="Lưu tên"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {renameError && (
                            <p className="text-[11px] text-red-500">{renameError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <h4 
                            onClick={() => onOpenFile(file)}
                            className="font-semibold text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            title={`${file.name}.md (Nhấp để mở)`}
                          >
                            {file.name}.md
                          </h4>
                        </div>
                      )}

                      {/* Note line if exists */}
                      {file.note && !isEditing && (
                        <p className="text-xs text-muted-foreground/90 truncate mt-1 pl-6">
                          {file.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meta stats & Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(file.updatedAt)}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <span>•</span>
                      <span>{file.linesCount} dòng</span>
                    </div>

                    {/* Action buttons (hover or mobile visible) */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onOpenFile(file)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                        title="Mở tài liệu vào trình soạn thảo"
                      >
                        Mở
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadMarkdownFile(file.name, file.content)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Tải file .md về máy"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(file)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Đổi tên file"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFileToDelete(file)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Xóa file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
          <span>Tổng cộng: {files.length} file</span>
          <span>Esc để đóng</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setFileToDelete(null)}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-foreground text-base">
                Xác nhận xóa file
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
              Bạn có chắc chắn muốn xóa file <strong>"{fileToDelete.name}.md"</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all shadow-sm"
              >
                Xóa file
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
