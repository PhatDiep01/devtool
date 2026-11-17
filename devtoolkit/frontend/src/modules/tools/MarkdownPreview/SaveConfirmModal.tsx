import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  AlertTriangle, 
  Loader2, 
  Check, 
  CopyPlus, 
  Info,
  HardDrive
} from 'lucide-react';
import { MarkdownStats } from './types';
import { sanitizeFileName } from './useMarkdownStorage';

interface SaveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: (fileName: string, note: string) => Promise<void>;
  defaultName: string;
  source: 'upload' | 'manual';
  stats: MarkdownStats;
  checkNameExists: (name: string) => boolean;
  onSuggestNewName: (baseName: string) => string;
}

export const SaveConfirmModal: React.FC<SaveConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmSave,
  defaultName,
  source,
  stats,
  checkNameExists,
  onSuggestNewName
}) => {
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const initial = sanitizeFileName(defaultName || 'tai-lieu-moi');
      setFileName(initial);
      setNote('');
      setErrorMsg('');
      setSaveError('');
      setIsSaving(false);

      // Auto focus and select all text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const isDuplicate = checkNameExists(fileName);

  const validateInput = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập tên file.');
      return false;
    }
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setErrorMsg('Tên file không được chứa ký tự đặc biệt (\\ / : * ? " < > |).');
      return false;
    }
    if (trimmed.length > 100) {
      setErrorMsg('Tên file không được vượt quá 100 ký tự.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFileName(val);
    validateInput(val);
  };

  const handleSuggestCopy = () => {
    const suggested = onSuggestNewName(fileName || defaultName);
    setFileName(suggested);
    setErrorMsg('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleConfirm = async () => {
    if (isSaving) return;
    if (!validateInput(fileName)) return;

    try {
      setIsSaving(true);
      setSaveError('');
      await onConfirmSave(fileName.trim(), note.trim());
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu file:', err);
      setSaveError(err.message || 'Không thể lưu lúc này. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSaving) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base sm:text-lg leading-tight">
                Lưu file Markdown
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xác nhận thông tin trước khi lưu trữ vào hệ thống
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* File Name Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
              Tên file <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary overflow-hidden transition-all">
              <input
                ref={inputRef}
                type="text"
                disabled={isSaving}
                value={fileName}
                onChange={handleNameChange}
                placeholder="ten-file"
                className="flex-1 px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
              />
              <span className="px-3.5 py-2.5 text-sm font-mono text-muted-foreground/80 bg-muted/50 border-l border-border select-none">
                .md
              </span>
            </div>
            {errorMsg && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          {/* Duplicate Warning */}
          {isDuplicate && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-start justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Đã có file cùng tên trong danh sách. Lưu sẽ <strong>ghi đè</strong> phiên bản cũ.
                </span>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSuggestCopy}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-medium text-xs transition-colors"
                title="Tự động thêm hậu số mới"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                <span>Lưu bản mới</span>
              </button>
            </div>
          )}

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
              Ghi chú <span className="text-muted-foreground text-[11px] font-normal normal-case">(không bắt buộc)</span>
            </label>
            <textarea
              rows={2}
              disabled={isSaving}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Thêm mô tả ngắn hoặc mục đích tài liệu..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none disabled:opacity-50 scrollbar-thin"
            />
          </div>

          {/* Summary Box */}
          <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span>Thông tin tóm tắt tài liệu:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <div className="font-bold text-foreground text-sm">{stats.lines}</div>
                <div className="text-[11px] text-muted-foreground">Dòng</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <div className="font-bold text-foreground text-sm">{stats.words}</div>
                <div className="text-[11px] text-muted-foreground">Từ</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <div className="font-bold text-foreground text-sm">{stats.formattedSize}</div>
                <div className="text-[11px] text-muted-foreground">Dung lượng</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <div className="font-bold text-foreground text-sm truncate">
                  {source === 'upload' ? 'Tải lên' : 'Trực tiếp'}
                </div>
                <div className="text-[11px] text-muted-foreground">Nguồn gốc</div>
              </div>
            </div>
          </div>

          {/* Internal Error Message */}
          {saveError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSaving || !!errorMsg || !fileName.trim()}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Xác nhận lưu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
