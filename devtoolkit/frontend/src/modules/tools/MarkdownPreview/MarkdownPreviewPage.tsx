import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Folder, 
  Columns, 
  Eye, 
  Edit3, 
  Save, 
  Maximize2, 
  Minimize2, 
  Download, 
  Sparkles, 
  List, 
  RotateCcw, 
  AlertTriangle, 
  Check, 
  X,
  FileCode,
  Copy,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ViewMode, SavedMarkdownFile } from './types';
import { SAMPLE_MARKDOWN } from './sampleMarkdown';
import { 
  calculateMarkdownStats, 
  sanitizeFileName, 
  extractFirstH1, 
  downloadMarkdownFile,
  useMarkdownStorage 
} from './useMarkdownStorage';
import { MarkdownPreviewRenderer } from './MarkdownPreviewRenderer';
import { MarkdownEditor } from './MarkdownEditor';
import { SaveConfirmModal } from './SaveConfirmModal';
import { SavedFilesDrawer } from './SavedFilesDrawer';
import { TableOfContentsDrawer, extractHeadings } from './TableOfContentsDrawer';

export const MarkdownPreviewPage: React.FC = () => {
  // Main Editor content & file metadata
  const [content, setContent] = useState<string>('');
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [fileSource, setFileSource] = useState<'upload' | 'manual'>('manual');
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Layout View mode: 'split' | 'edit' | 'preview'
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage for editor
  const [isDraggingDivider, setIsDraggingDivider] = useState<boolean>(false);

  // Sync scrolling flag (default ON)
  const [syncScroll, setSyncScroll] = useState<boolean>(true);

  // Fullscreen Preview mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Drag and drop overlay state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const dragCounter = useRef<number>(0);

  // Modals & Drawers state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isSavedFilesDrawerOpen, setIsSavedFilesDrawerOpen] = useState<boolean>(false);
  const [isTocDrawerOpen, setIsTocDrawerOpen] = useState<boolean>(false);

  // Pending file replace confirmation dialog state
  const [pendingFileContent, setPendingFileContent] = useState<{
    content: string;
    name: string;
    source: 'upload' | 'manual';
    id?: string;
  } | null>(null);

  // Clear confirmation dialog state
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);

  // Hidden File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll Sync Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'editor' | 'preview' | null>(null);
  const scrollTimeoutRef = useRef<any>(null);

  // Storage hook
  const { 
    files, 
    saveFile, 
    renameFile, 
    deleteFile, 
    checkNameExists, 
    suggestNewName 
  } = useMarkdownStorage();

  // Calculate live statistics
  const stats = useMemo(() => calculateMarkdownStats(content), [content]);

  // Headings count for TOC
  const headings = useMemo(() => extractHeadings(content), [content]);

  // Handle window beforeunload when unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSaved && content.trim().length > 0) {
        e.preventDefault();
        e.returnValue = 'Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn rời đi?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaved, content]);

  // Default view mode responsiveness: switch to 1 column on small screens
  useEffect(() => {
    const checkViewport = () => {
      if (window.innerWidth < 768 && viewMode === 'split') {
        setViewMode('edit');
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [viewMode]);

  // Global ESC key listener for Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        if (isTocDrawerOpen) setIsTocDrawerOpen(false);
      }
      // Ctrl+S globally
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (content.trim().length > 0) {
          setIsSaveModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isTocDrawerOpen, content]);

  // Content change handler
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsSaved(false);
  };

  // Sync scroll logic
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!syncScroll || isScrollingRef.current === 'preview') return;
    const editor = e.currentTarget;
    const preview = previewContainerRef.current;
    if (!preview) return;

    isScrollingRef.current = 'editor';
    const editorScrollMax = editor.scrollHeight - editor.clientHeight;
    const percentage = editorScrollMax > 0 ? editor.scrollTop / editorScrollMax : 0;

    const previewScrollMax = preview.scrollHeight - preview.clientHeight;
    preview.scrollTop = percentage * previewScrollMax;

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 120);
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isScrollingRef.current === 'editor') return;
    const preview = e.currentTarget;
    const editor = editorRef.current;
    if (!editor) return;

    isScrollingRef.current = 'preview';
    const previewScrollMax = preview.scrollHeight - preview.clientHeight;
    const percentage = previewScrollMax > 0 ? preview.scrollTop / previewScrollMax : 0;

    const editorScrollMax = editor.scrollHeight - editor.clientHeight;
    editor.scrollTop = percentage * editorScrollMax;

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = null;
    }, 120);
  };

  // Resizable divider drag handlers
  const handleMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider) return;
      const containerWidth = window.innerWidth;
      const newRatio = Math.max(20, Math.min(80, (e.clientX / containerWidth) * 100));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      if (isDraggingDivider) {
        setIsDraggingDivider(false);
      }
    };

    if (isDraggingDivider) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  // File loading and validation
  const processUploadedFile = (file: File) => {
    const validExtensions = ['.md', '.markdown', '.txt'];
    const fileName = file.name;
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      toast.error('File không đúng định dạng. Vui lòng chọn file .md, .markdown hoặc .txt');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File vượt quá 2 MB. Vui lòng chọn file nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        toast.error('Không thể đọc file này. Vui lòng thử lại hoặc chọn file khác.');
        return;
      }

      if (text.trim().length === 0) {
        toast.error('File không có nội dung.');
        return;
      }

      const cleanBaseName = sanitizeFileName(fileName);

      // Check if current editor has unsaved changes
      if (!isSaved && content.trim().length > 0) {
        setPendingFileContent({
          content: text,
          name: cleanBaseName,
          source: 'upload'
        });
        return;
      }

      // Load directly
      applyLoadedContent(text, cleanBaseName, 'upload');
    };

    reader.onerror = () => {
      toast.error('Không thể đọc file này. Vui lòng thử lại hoặc chọn file khác.');
    };

    reader.readAsText(file);
  };

  const applyLoadedContent = (
    newContent: string, 
    fileName: string, 
    source: 'upload' | 'manual', 
    id?: string
  ) => {
    setContent(newContent);
    setCurrentFileName(fileName);
    setCurrentFileId(id || null);
    setFileSource(source);
    setIsSaved(true);
    toast.success(`Đã tải file "${fileName}.md" thành công!`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (fileList.length > 1) {
      toast('Chỉ xử lý file đầu tiên trong danh sách chọn.', { icon: 'ℹ️' });
    }

    processUploadedFile(fileList[0]);
    // Reset file input value so selecting the same file again still fires change
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragOver(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      toast('Chỉ xử lý file đầu tiên trong danh sách kéo thả.', { icon: 'ℹ️' });
    }

    processUploadedFile(files[0]);
  };

  // Load sample template
  const handleLoadSample = () => {
    if (!isSaved && content.trim().length > 0) {
      setPendingFileContent({
        content: SAMPLE_MARKDOWN,
        name: 'huong-dan-markdown-mau',
        source: 'manual'
      });
      return;
    }
    applyLoadedContent(SAMPLE_MARKDOWN, 'huong-dan-markdown-mau', 'manual');
  };

  // Clear workspace
  const handleClearContent = () => {
    if (!isSaved && content.trim().length > 0) {
      setIsClearConfirmOpen(true);
    } else {
      doClearContent();
    }
  };

  const doClearContent = () => {
    setContent('');
    setCurrentFileName('');
    setCurrentFileId(null);
    setFileSource('manual');
    setIsSaved(true);
    setIsClearConfirmOpen(false);
    toast.success('Đã xóa sạch nội dung trình soạn thảo.');
  };

  // Open file from saved list
  const handleOpenSavedFile = (file: SavedMarkdownFile) => {
    if (!isSaved && content.trim().length > 0) {
      setPendingFileContent({
        content: file.content,
        name: file.name,
        source: file.source,
        id: file.id
      });
      setIsSavedFilesDrawerOpen(false);
      return;
    }

    applyLoadedContent(file.content, file.name, file.source, file.id);
    setIsSavedFilesDrawerOpen(false);
  };

  // Confirm Save action
  const handleConfirmSave = async (fileName: string, note: string) => {
    const saved = await saveFile({
      id: currentFileId || undefined,
      name: fileName,
      content,
      note,
      source: fileSource
    });

    setCurrentFileName(saved.name);
    setCurrentFileId(saved.id);
    setIsSaved(true);
    toast.success(`Đã lưu "${saved.name}.md" thành công!`);
  };

  // Quick download .md
  const handleDownloadCurrent = () => {
    const name = currentFileName || extractFirstH1(content) || 'tai-lieu-moi';
    downloadMarkdownFile(name, content);
    toast.success(`Đang tải file "${name}.md" về máy...`);
  };

  // Copy full raw markdown
  const handleCopyRawMarkdown = () => {
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép toàn bộ mã nguồn Markdown!');
  };

  return (
    <div 
      className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] bg-background text-foreground relative select-none overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-background/85 backdrop-blur-sm border-4 border-dashed border-primary flex flex-col items-center justify-center p-8 transition-all animate-in fade-in duration-150 pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-xl ring-4 ring-primary/20">
            <Upload className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 text-center">
            Thả file Markdown vào đây
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Hỗ trợ định dạng file <strong>.md</strong>, <strong>.markdown</strong> hoặc <strong>.txt</strong> (tối đa 2 MB)
          </p>
        </div>
      )}

      {/* 2.1. Thanh tiêu đề (Header) */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                Xem trước Markdown
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary rounded-full">
                GFM Preview
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Tải file lên hoặc nhập nội dung để xem trước
            </p>
          </div>
        </div>

        {/* Header Right Quick Info / Actions */}
        <div className="flex items-center gap-2">
          {/* Saved Files button */}
          <button
            type="button"
            onClick={() => setIsSavedFilesDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-all shadow-sm"
            title="Mở danh sách file đã lưu"
          >
            <Folder className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">File đã lưu</span>
            <span className="px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
              {files.length}
            </span>
          </button>

          {/* Quick Download Button if content exists */}
          {content.trim().length > 0 && (
            <button
              type="button"
              onClick={handleDownloadCurrent}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Tải file .md về máy"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2.2. Thanh công cụ (Toolbar) */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-6 py-2 border-b border-border bg-muted/20 shrink-0 text-xs">
        {/* Nhóm 1: Nhập liệu */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-muted text-foreground font-medium shadow-sm transition-all"
            title="Tải file .md từ máy tính"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>Tải file lên</span>
          </button>

          <button
            type="button"
            onClick={handleClearContent}
            disabled={content.trim().length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border/80 text-muted-foreground hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all disabled:opacity-40 disabled:pointer-events-none"
            title="Xóa toàn bộ nội dung"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xóa nội dung</span>
          </button>

          {content.trim().length === 0 && (
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              title="Tải nội dung Markdown mẫu để trải nghiệm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Dùng nội dung mẫu</span>
            </button>
          )}
        </div>

        {/* Nhóm 2: Chế độ hiển thị (Segmented Control) */}
        <div className="flex items-center bg-muted/70 p-0.5 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'edit'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Soạn thảo</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'split'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Song song</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'preview'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem trước</span>
          </button>
        </div>

        {/* Nhóm 3: Hành động chính */}
        <div className="flex items-center gap-2">
          {/* Sync scroll toggle switch (chỉ hiện khi ở chế độ song song) */}
          {viewMode === 'split' && (
            <label 
              className="hidden lg:flex items-center gap-1.5 text-muted-foreground text-[11px] cursor-pointer select-none mr-1"
              title="Đồng bộ vị trí cuộn giữa hai khung soạn thảo và xem trước"
            >
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={e => setSyncScroll(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary border-border focus:ring-0"
              />
              <span>Cuộn đồng bộ</span>
            </label>
          )}

          {/* Nút Toàn màn hình */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={isFullscreen ? 'Thu nhỏ (Esc)' : 'Toàn màn hình xem trước'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Nút Lưu - Nút chính nổi bật nhất */}
          <button
            type="button"
            disabled={content.trim().length === 0}
            onClick={() => setIsSaveModalOpen(true)}
            className="relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
            title={content.trim().length === 0 ? 'Chưa có nội dung để lưu' : 'Lưu file Markdown (Ctrl+S)'}
          >
            <Save className="w-4 h-4" />
            <span>Lưu</span>

            {/* Chấm cam nhắc nhở khi có thay đổi chưa lưu */}
            {!isSaved && content.trim().length > 0 && (
              <span 
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-card animate-pulse" 
                title="Có thay đổi chưa lưu"
              />
            )}
          </button>
        </div>
      </div>

      {/* 2.3. Vùng làm việc chính */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* CỘT 1: VÙNG SOẠN THẢO (EDITOR) */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div 
            style={{ 
              width: viewMode === 'split' ? `${splitRatio}%` : '100%'
            }}
            className="flex flex-col h-full overflow-hidden p-2 sm:p-3"
          >
            <div className="flex items-center justify-between pb-2 px-1 text-xs text-muted-foreground shrink-0 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Soạn thảo
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  (Markdown GFM)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRawMarkdown}
                  disabled={content.trim().length === 0}
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1 disabled:opacity-40"
                  title="Sao chép toàn bộ mã nguồn"
                >
                  <Copy className="w-3 h-3" />
                  <span className="text-[11px]">Sao chép</span>
                </button>
              </div>
            </div>

            <div className="flex-1 h-full min-h-0">
              <MarkdownEditor
                content={content}
                onChange={handleContentChange}
                onSaveShortcut={() => {
                  if (content.trim().length > 0) setIsSaveModalOpen(true);
                }}
                editorRef={editorRef}
                onScroll={handleEditorScroll}
              />
            </div>
          </div>
        )}

        {/* THANH CHIA KÉO THẢ (RESIZABLE DIVIDER) ở chế độ Song song */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDownDivider}
            className={`w-1.5 hover:w-2 -mx-0.5 cursor-col-resize z-20 transition-all flex items-center justify-center group ${
              isDraggingDivider ? 'bg-primary w-2' : 'bg-border hover:bg-primary/60'
            }`}
            title="Kéo sang trái hoặc phải để thay đổi tỉ lệ khung nhìn"
          >
            <div className="w-0.5 h-8 bg-muted-foreground/40 rounded-full group-hover:bg-white" />
          </div>
        )}

        {/* CỘT 2: VÙNG XEM TRƯỚC (PREVIEW) */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div 
            style={{ 
              width: viewMode === 'split' ? `${100 - splitRatio}%` : '100%'
            }}
            className="flex flex-col h-full overflow-hidden p-2 sm:p-3"
          >
            <div className="flex items-center justify-between pb-2 px-1 text-xs text-muted-foreground shrink-0 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Xem trước
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  (Kết quả hiển thị tài liệu)
                </span>
              </div>

              {/* Nút Mục lục TOC nếu có >= 3 headings */}
              {headings.length >= 3 && (
                <button
                  type="button"
                  onClick={() => setIsTocDrawerOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card border border-border hover:border-primary/40 text-foreground text-[11px] font-medium shadow-2xs transition-colors"
                  title="Mở mục lục tài liệu"
                >
                  <List className="w-3 h-3 text-primary" />
                  <span>Mục lục ({headings.length})</span>
                </button>
              )}
            </div>

            {/* Container xem trước */}
            <div 
              ref={previewContainerRef}
              onScroll={handlePreviewScroll}
              className="flex-1 h-full overflow-y-auto bg-card border border-border rounded-xl shadow-xs scrollbar-thin relative"
            >
              {content.trim().length === 0 ? (
                /* 4.5 Trạng thái trống */
                <div className="flex flex-col items-center justify-center min-h-[360px] h-full p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
                    <FileText className="w-8 h-8 text-primary/70" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                    Chưa có nội dung để xem trước
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
                    Tải file lên hoặc bắt đầu nhập ở khung bên trái để xem nội dung được định dạng trực quan tại đây.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-card border border-border hover:border-primary/50 text-foreground transition-all shadow-sm"
                    >
                      <Upload className="w-4 h-4 text-primary" />
                      <span>Tải file lên</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Dùng nội dung mẫu</span>
                    </button>
                  </div>
                </div>
              ) : (
                <MarkdownPreviewRenderer content={content} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2.4. Thanh trạng thái (Status bar) ở dưới cùng */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 border-t border-border bg-muted/40 text-[11px] sm:text-xs text-muted-foreground shrink-0 select-none">
        {/* Bên trái: Tên file & Trạng thái lưu */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <FileText className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
            <span className="font-medium text-foreground truncate max-w-[150px] sm:max-w-[260px]">
              {currentFileName ? `${currentFileName}.md` : 'Chưa đặt tên'}
            </span>
          </div>

          <span className="text-border">|</span>

          {isSaved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3 h-3" />
              <span>Đã lưu</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Chưa lưu</span>
            </span>
          )}
        </div>

        {/* Bên phải: Thống kê dòng, từ, ký tự, dung lượng */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-muted-foreground/80">
          <span>{stats.lines} dòng</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{stats.words} từ</span>
          <span>•</span>
          <span>{stats.chars} ký tự</span>
          <span>•</span>
          <span className="font-mono">{stats.formattedSize}</span>
        </div>
      </div>

      {/* 4.4. Chế độ Toàn màn hình xem trước (Fullscreen Modal) */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-white shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <Eye className="w-5 h-5 text-primary" />
              <span>Toàn màn hình xem trước - {currentFileName ? `${currentFileName}.md` : 'Tài liệu Markdown'}</span>
            </div>
            <div className="flex items-center gap-2">
              {headings.length >= 3 && (
                <button
                  type="button"
                  onClick={() => setIsTocDrawerOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-200 hover:text-white"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Mục lục ({headings.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Thoát toàn màn hình (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto my-4 bg-card rounded-2xl border border-border shadow-2xl p-4 sm:p-8 scrollbar-thin">
            <MarkdownPreviewRenderer content={content} />
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN LƯU FILE */}
      <SaveConfirmModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirmSave={handleConfirmSave}
        defaultName={currentFileName || extractFirstH1(content) || 'tai-lieu-moi'}
        source={fileSource}
        stats={stats}
        checkNameExists={name => checkNameExists(name, currentFileId || undefined)}
        onSuggestNewName={suggestNewName}
      />

      {/* DRAWER DANH SÁCH FILE ĐÃ LƯU */}
      <SavedFilesDrawer
        isOpen={isSavedFilesDrawerOpen}
        onClose={() => setIsSavedFilesDrawerOpen(false)}
        files={files}
        onOpenFile={handleOpenSavedFile}
        onRenameFile={renameFile}
        onDeleteFile={deleteFile}
      />

      {/* DRAWER MỤC LỤC TÀI LIỆU (TOC) */}
      <TableOfContentsDrawer
        isOpen={isTocDrawerOpen}
        onClose={() => setIsTocDrawerOpen(false)}
        content={content}
        previewContainerRef={previewContainerRef}
      />

      {/* POPUP XÁC NHẬN THAY THẾ NỘI DUNG CHƯA LƯU KHI NẠP FILE MỚI */}
      {pendingFileContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setPendingFileContent(null)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground text-base sm:text-lg">
                Thay thế nội dung hiện tại?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
              Nội dung đang soạn chưa được lưu và sẽ bị thay thế bởi file mới. Bạn có chắc chắn muốn tiếp tục?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingFileContent(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  applyLoadedContent(
                    pendingFileContent.content, 
                    pendingFileContent.name, 
                    pendingFileContent.source,
                    pendingFileContent.id
                  );
                  setPendingFileContent(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all shadow-sm"
              >
                Thay thế
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA NỘI DUNG */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setIsClearConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground text-base sm:text-lg">
                Xóa toàn bộ nội dung đang soạn?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
              Các thay đổi chưa lưu sẽ bị xóa vĩnh viễn và không thể khôi phục. Bạn có chắc chắn muốn làm sạch trình soạn thảo?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={doClearContent}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:scale-95 transition-all shadow-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MarkdownPreviewPage;
