import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BugItem, 
  BugAttachment, 
  AnnotationItem, 
  AnnotationType 
} from '../../../../types';
import { 
  X, 
  Download, 
  Copy, 
  ImageIcon, 
  Save, 
  Sparkles, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Share2,
  AlertTriangle,
  Upload,
  RefreshCw
} from 'lucide-react';
import { bugAnnotationsApi, bugsApi, resolveApiUrl } from '../../../../services/api';
import { useAnnotationEngine } from './useAnnotationEngine';
import { AnnotationCanvas, AnnotationCanvasHandle } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationSidebar } from './AnnotationSidebar';
import { AnnotationShortcutsModal } from './AnnotationShortcutsModal';
import { compositeImageWithAnnotations, generateMarkdownSummary } from './mathUtils';
import { toast } from 'react-hot-toast';

export interface AnnotationModalImageItem {
  id: string;
  url: string;
  originalName: string;
  annotations?: AnnotationItem[];
  isPending?: boolean;
}

export interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bug?: BugItem | null;
  initialImageId?: string;
  customImages?: AnnotationModalImageItem[];
  customTitle?: string;
  customUsKey?: string;
  onSaveFormAnnotations?: (imageId: string, annotations: AnnotationItem[]) => void;
  onAddDraftImage?: (file: File) => void;
  onAnnotationsUpdated?: (bugId: number) => void;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  bug,
  initialImageId,
  customImages,
  customTitle,
  customUsKey,
  onSaveFormAnnotations,
  onAddDraftImage,
  onAnnotationsUpdated,
}) => {
  // Filter all image attachments from bug or use provided customImages
  const imageAttachments: AnnotationModalImageItem[] = useMemo(() => {
    if (customImages && customImages.length > 0) {
      return customImages;
    }
    if (bug?.attachments) {
      return (bug.attachments || [])
        .filter((a) => a.isImage || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.url || a.filename || ''))
        .map((a) => ({
          id: a.id || a.filename,
          url: a.url,
          originalName: a.originalName,
          annotations: bug.annotations?.[a.id || a.filename]?.annotations || []
        }));
    }
    return [];
  }, [customImages, bug?.attachments, bug?.annotations]);

  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [conflictData, setConflictData] = useState<{
    serverVersion: number;
    serverAnnotations: AnnotationItem[];
  } | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const canvasRef = useRef<AnnotationCanvasHandle>(null);

  // Set initial selected image
  useEffect(() => {
    if (initialImageId && imageAttachments.length > 0) {
      const idx = imageAttachments.findIndex((img) => img.id === initialImageId);
      if (idx !== -1) {
        setCurrentImageIndex(idx);
      }
    }
  }, [initialImageId, imageAttachments]);

  const currentImage: AnnotationModalImageItem | undefined = imageAttachments[currentImageIndex];
  const currentImageId = currentImage ? currentImage.id : '';
  const displayTitle = customTitle || bug?.title || 'Đánh dấu hình ảnh';
  const displayUsKey = customUsKey || bug?.us_key;
  const isDraftMode = !bug?.id || Boolean(onSaveFormAnnotations);

  // Auto-save handler sent to useAnnotationEngine
  const handleAutoSave = useCallback(async (savedItems: AnnotationItem[]) => {
    if (!currentImageId) return;

    // In draft mode or when form save callback is provided:
    if (isDraftMode || onSaveFormAnnotations) {
      onSaveFormAnnotations?.(currentImageId, savedItems);
      return;
    }

    if (bug?.id) {
      try {
        const res = await bugAnnotationsApi.save(bug.id, currentImageId, {
          annotations: savedItems,
          version: currentVersion
        });
        if (res.data && res.data.version) {
          setCurrentVersion(res.data.version);
        }
        setConflictData(null);
        onAnnotationsUpdated?.(bug.id);
      } catch (err: any) {
        if (err.response?.status === 409) {
          toast.error('Có xung đột phiên bản: Dữ liệu đã được cập nhật từ phiên khác');
          if (err.response?.data?.data) {
            setConflictData({
              serverVersion: err.response.data.currentVersion || 1,
              serverAnnotations: err.response.data.data.annotations || []
            });
          }
        } else {
          toast.error('Lỗi khi tự động lưu đánh dấu');
        }
        throw err;
      }
    }
  }, [isDraftMode, bug?.id, currentImageId, currentVersion, onSaveFormAnnotations, onAnnotationsUpdated]);

  // Force overwrite in case of concurrency conflict
  const handleForceSave = async () => {
    if (!currentImageId) return;
    if (isDraftMode || onSaveFormAnnotations) {
      onSaveFormAnnotations?.(currentImageId, engine.annotations);
      toast.success('Đã lưu điểm đánh dấu');
      return;
    }
    if (!bug?.id) return;
    try {
      const res = await bugAnnotationsApi.save(bug.id, currentImageId, {
        annotations: engine.annotations,
        force: true
      });
      if (res.data?.version) setCurrentVersion(res.data.version);
      setConflictData(null);
      toast.success('Đã ghi đè bản mới nhất thành công');
      onAnnotationsUpdated?.(bug.id);
    } catch {
      toast.error('Lỗi khi ghi đè dữ liệu');
    }
  };

  // Reload latest annotations from server
  const handleReloadLatest = () => {
    if (!conflictData) return;
    engine.resetWithAnnotations(conflictData.serverAnnotations);
    setCurrentVersion(conflictData.serverVersion);
    setConflictData(null);
    toast.success('Đã nạp phiên bản mới nhất từ máy chủ');
  };

  // Direct paste & drop upload of new image to bug
  const handleUploadImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ tải lên file hình ảnh');
      return;
    }

    if (isDraftMode && onAddDraftImage) {
      onAddDraftImage(file);
      toast.success('Đã thêm ảnh vào form (chờ lưu)');
      return;
    }

    if (bug?.id) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await bugsApi.upload(formData);
        const newAtt = res.data;

        const updatedAttachments = [...(bug.attachments || []), newAtt];
        await bugsApi.update(bug.id, { attachments: updatedAttachments });
        bug.attachments = updatedAttachments;
        onAnnotationsUpdated?.(bug.id);

        const newIdx = updatedAttachments.filter((a) => a.isImage || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.url || a.filename || '')).length - 1;
        setCurrentImageIndex(Math.max(0, newIdx));
        toast.success('Đã thêm ảnh mới từ clipboard/kéo thả vào bug!');
      } catch (err: any) {
        console.error('Failed to attach pasted image:', err);
        toast.error('Không thể thêm ảnh: ' + (err.message || 'Lỗi'));
      }
    }
  };

  // Global paste handler for image files inside AnnotationModal
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!e.clipboardData) return;

      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleUploadImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen, bug, isDraftMode]);

  const engine = useAnnotationEngine({
    initialAnnotations: [],
    onAutoSave: handleAutoSave,
    autoSaveDelay: 1000
  });

  // Load annotations when image changes
  useEffect(() => {
    if (!isOpen || !currentImage) return;

    // 1. If custom draft annotations are available on currentImage
    if (currentImage.annotations !== undefined) {
      engine.resetWithAnnotations(currentImage.annotations);
      setInitialLoading(false);
      return;
    }

    // 2. If persisted on server with bug id
    if (bug?.id && currentImageId) {
      let isMounted = true;
      setInitialLoading(true);

      bugAnnotationsApi.getByImage(bug.id, currentImageId)
        .then((res) => {
          if (!isMounted) return;
          const record = res.data;
          const loadedAnnotations = Array.isArray(record.annotations) ? record.annotations : [];
          engine.resetWithAnnotations(loadedAnnotations);
          setCurrentVersion(record.version || 0);
        })
        .catch((err) => {
          console.error('Failed to load image annotations:', err);
          if (isMounted) {
            engine.resetWithAnnotations([]);
          }
        })
        .finally(() => {
          if (isMounted) setInitialLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      engine.resetWithAnnotations([]);
      setInitialLoading(false);
    }
  }, [isOpen, bug?.id, currentImageId, currentImage]);

  const handleFitToScreen = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.fitToScreen();
    } else {
      engine.fitToScreen();
    }
  }, [engine]);

  // Global Keyboard shortcuts handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+S / Cmd+S: Save immediately
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        engine.saveNow().then(() => toast.success('Đã lưu đánh dấu thành công'));
        return;
      }

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        engine.undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        engine.redo();
        return;
      }

      // Delete / Backspace: Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (engine.selectedId) {
          e.preventDefault();
          engine.deleteAnnotation(engine.selectedId);
          toast.success('Đã xóa điểm đánh dấu');
        }
        return;
      }

      // Tool shortcuts
      const key = e.key.toLowerCase();
      if (key === 'v' || e.key === 'Escape') engine.setActiveTool('select');
      else if (key === 'r') engine.setActiveTool('rect');
      else if (key === 'c') engine.setActiveTool('circle');
      else if (key === 'a') engine.setActiveTool('arrow');
      else if (key === 'l') engine.setActiveTool('line');
      else if (key === 't') engine.setActiveTool('text');
      else if (key === 'n' || key === 'b') engine.setActiveTool('badge');
      else if (key === 'h') engine.setActiveTool('highlight');
      else if (key === '+' || key === '=') engine.zoomIn();
      else if (key === '-') engine.zoomOut();
      else if (key === '0') engine.resetZoom();
      else if (key === 'f') handleFitToScreen();
      else if (key === '?') setIsShortcutsModalOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, engine, handleFitToScreen]);

  // Handle Export PNG
  const handleExportPng = async () => {
    if (!currentImage) return;
    try {
      setIsExporting(true);
      const fullUrl = resolveApiUrl(currentImage.url);
      const blob = await compositeImageWithAnnotations(fullUrl, engine.annotations);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const baseName = currentImage.originalName.replace(/\.[^/.]+$/, '');
      link.download = `annotation_${bug?.id ? `bug_${bug.id}_` : ''}${baseName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('Đã xuất ảnh PNG thành công');
    } catch (err: any) {
      console.error('Export PNG failed:', err);
      toast.error('Không thể xuất ảnh PNG: ' + (err.message || 'Lỗi'));
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy Merged Image to Clipboard with iOS Safari fallback
  const handleCopyImage = async () => {
    if (!currentImage) return;
    try {
      setIsExporting(true);
      const fullUrl = resolveApiUrl(currentImage.url);
      const blob = await compositeImageWithAnnotations(fullUrl, engine.annotations);
      
      let copied = false;
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toast.success('Đã sao chép ảnh có đánh dấu vào Clipboard');
          copied = true;
        } catch (clipErr) {
          console.warn('Direct clipboard write failed (iOS/Permissions fallback):', clipErr);
        }
      }

      if (!copied) {
        // Fallback for iOS Safari or restricted permissions: auto-download
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const baseName = currentImage.originalName.replace(/\.[^/.]+$/, '');
        link.download = `annotation_${bug?.id ? `bug_${bug.id}_` : ''}${baseName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        toast('Trình duyệt chặn ghi clipboard: Đã tự động tải ảnh về máy', { icon: '📥' });
      }
    } catch (err: any) {
      console.error('Copy image failed:', err);
      toast.error('Không thể sao chép ảnh: ' + (err.message || 'Lỗi'));
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy Markdown Summary Table
  const handleCopyMarkdown = () => {
    if (!currentImage) return;
    const md = generateMarkdownSummary(
      displayTitle,
      displayUsKey,
      currentImage.originalName,
      engine.annotations
    );
    navigator.clipboard.writeText(md)
      .then(() => toast.success('Đã sao chép bảng Markdown vào Clipboard'))
      .catch(() => toast.error('Lỗi sao chép Markdown'));
  };

  // Switch image with auto-save
  const switchImage = async (newIndex: number) => {
    if (newIndex === currentImageIndex || newIndex < 0 || newIndex >= imageAttachments.length) return;
    if (engine.saveStatus === 'dirty') {
      await engine.saveNow();
    }
    setCurrentImageIndex(newIndex);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200"
      tabIndex={0}
    >
      {/* 1. TOP HEADER BAR */}
      <header className="h-12 sm:h-14 border-b border-border/80 bg-card/95 px-2.5 sm:px-4 flex items-center justify-between text-foreground shrink-0 z-20">
        {/* Left: Bug Info & Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 mr-1.5">
          <div className="p-1.5 sm:p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {bug?.id ? (
                <span className="font-mono text-[10px] sm:text-xs font-bold text-muted-foreground shrink-0">Bug #{bug.id}</span>
              ) : (
                <span className="font-mono text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                  Bản nháp
                </span>
              )}
              {displayUsKey && (
                <span className="font-mono text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                  {displayUsKey}
                </span>
              )}
              <span className="hidden sm:inline-flex text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                Trình Đánh Dấu Ảnh
              </span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-foreground truncate max-w-full" title={displayTitle}>
              {displayTitle}
            </h2>
          </div>
        </div>

        {/* Center: Image Switcher if multiple images */}
        {imageAttachments.length > 1 && (
          <div className="hidden md:flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs font-semibold">
            <button
              type="button"
              disabled={currentImageIndex === 0}
              onClick={() => switchImage(currentImageIndex - 1)}
              className="p-1 rounded-lg hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition"
              title="Ảnh trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Ảnh {currentImageIndex + 1} / {imageAttachments.length}
            </span>
            <button
              type="button"
              disabled={currentImageIndex === imageAttachments.length - 1}
              onClick={() => switchImage(currentImageIndex + 1)}
              className="p-1 rounded-lg hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition"
              title="Ảnh kế tiếp"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right: Actions & Close */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportPng}
            disabled={isExporting}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title="Xuất ảnh PNG kèm điểm đánh dấu"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Xuất PNG</span>
          </button>

          {/* Copy Image to Clipboard */}
          <button
            type="button"
            onClick={handleCopyImage}
            disabled={isExporting}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title="Sao chép ảnh vào Clipboard để dán nhanh vào Jira / Chat"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Copy ảnh</span>
          </button>

          {/* Save Now Button */}
          <button
            type="button"
            onClick={async () => {
              await engine.saveNow();
              if (isDraftMode || onSaveFormAnnotations) {
                onSaveFormAnnotations?.(currentImageId, engine.annotations);
                toast.success('Đã lưu điểm đánh dấu cho ảnh này');
              } else {
                toast.success('Đã lưu đánh dấu');
              }
            }}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition shadow-sm"
            title="Lưu đánh dấu ngay (Ctrl + S)"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Lưu</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={async () => {
              if (engine.saveStatus === 'dirty') {
                try {
                  await engine.saveNow();
                  if (isDraftMode || onSaveFormAnnotations) {
                    onSaveFormAnnotations?.(currentImageId, engine.annotations);
                  }
                } catch {}
              }
              onClose();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition ml-0.5 sm:ml-1"
            title="Đóng trình đánh dấu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. SUB-TOOLBAR */}
      <AnnotationToolbar
        activeTool={engine.activeTool}
        activeColor={engine.activeColor}
        strokeWidth={engine.strokeWidth}
        canUndo={engine.canUndo}
        canRedo={engine.canRedo}
        zoom={engine.zoom}
        saveStatus={engine.saveStatus}
        lastSavedAt={engine.lastSavedAt}
        onSelectTool={engine.setActiveTool}
        onSelectColor={engine.setActiveColor}
        onSelectStrokeWidth={engine.setStrokeWidth}
        onUndo={engine.undo}
        onRedo={engine.redo}
        onZoomIn={engine.zoomIn}
        onZoomOut={engine.zoomOut}
        onResetZoom={engine.resetZoom}
        onFitToScreen={handleFitToScreen}
        onToggleShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* 3. MAIN WORKSPACE (CANVAS + SIDEBAR) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center: Canvas Viewport (100% width on mobile) */}
        <main 
          className="flex-1 h-full relative overflow-hidden bg-slate-950/90"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleUploadImageFile(e.dataTransfer.files[0]);
            }
          }}
        >
          {/* Concurrency Conflict Banner */}
          {conflictData && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-amber-500/90 text-amber-950 font-bold text-xs shadow-2xl flex items-center gap-3 backdrop-blur animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-amber-950 shrink-0" />
              <span>Phát hiện xung đột: Đánh dấu đã được cập nhật từ phiên khác!</span>
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  type="button"
                  onClick={handleReloadLatest}
                  className="px-2.5 py-1 rounded-xl bg-amber-950 text-amber-100 text-[11px] font-bold hover:bg-black transition flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Nạp bản mới</span>
                </button>
                <button
                  type="button"
                  onClick={handleForceSave}
                  className="px-2.5 py-1 rounded-xl bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition"
                >
                  <span>Ghi đè (Lưu đè)</span>
                </button>
              </div>
            </div>
          )}

          {initialLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Đang tải ảnh và dữ liệu đánh dấu...</p>
            </div>
          ) : currentImage ? (
            <AnnotationCanvas
              ref={canvasRef}
              imageSrc={resolveApiUrl(currentImage.url)}
              imageAlt={currentImage.originalName}
              annotations={engine.annotations}
              selectedId={engine.selectedId}
              activeTool={engine.activeTool}
              activeColor={engine.activeColor}
              strokeWidth={engine.strokeWidth}
              fontSize={engine.fontSize}
              zoom={engine.zoom}
              pan={engine.pan}
              onSelect={engine.setSelectedId}
              onAddAnnotation={engine.addAnnotation}
              onUpdateAnnotation={engine.updateAnnotation}
              onDeleteAnnotation={engine.deleteAnnotation}
              onPanChange={engine.setPan}
              onZoomChange={engine.setZoom}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center space-y-3">
              <ImageIcon className="w-12 h-12 stroke-1 opacity-40" />
              <div>
                <p className="text-sm font-bold text-foreground">Không tìm thấy ảnh đính kèm</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Dán ảnh từ clipboard (Ctrl + V) hoặc kéo thả file ảnh vào đây để bắt đầu đánh dấu.
                </p>
              </div>
              <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Tải ảnh lên</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleUploadImageFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          )}

          {/* Floating Onboarding Guide Hint when empty: single line nowrap, centered, elevated above mobile pill */}
          {!initialLoading && currentImage && engine.annotations.length === 0 && (
            <div className="absolute bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-2xl bg-card/95 backdrop-blur border border-primary/40 shadow-xl text-xs font-medium text-foreground flex items-center gap-2 pointer-events-none whitespace-nowrap max-w-[85vw] overflow-hidden text-ellipsis animate-bounce z-20">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">Nhấp hoặc kéo trên ảnh để vẽ điểm lỗi</span>
            </div>
          )}

          {/* Floating Pill Button for Mobile Bottom Sheet / Drawer */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="lg:hidden absolute bottom-4 right-4 z-30 px-3.5 py-2 rounded-full bg-card/95 hover:bg-card text-foreground border border-border shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-bold transition hover:scale-105 active:scale-95"
            title="Xem danh sách ghi chú đánh dấu"
          >
            <span>📝</span>
            <span>Ghi chú ({engine.annotations.length})</span>
            {engine.annotations.some(a => a.status === 'open') && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </main>

        {/* Right: Sidebar List of Annotations (Desktop: >= 1024px) */}
        <div className="hidden lg:flex h-full shrink-0">
          <AnnotationSidebar
            annotations={engine.annotations}
            selectedId={engine.selectedId}
            onSelect={engine.setSelectedId}
            onUpdate={engine.updateAnnotation}
            onDelete={engine.deleteAnnotation}
            onCopyMarkdown={handleCopyMarkdown}
          />
        </div>

        {/* Mobile Collapsible Bottom Sheet / Drawer (< 1024px) */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            {/* Bottom Sheet Card */}
            <div 
              className="relative z-50 bg-card border-t border-border rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
            >
              {/* Grab bar */}
              <div 
                className="w-full pt-2.5 pb-1 flex justify-center cursor-pointer" 
                onClick={() => setIsMobileDrawerOpen(false)}
              >
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex-1 overflow-hidden">
                <AnnotationSidebar
                  annotations={engine.annotations}
                  selectedId={engine.selectedId}
                  onSelect={(id) => {
                    engine.setSelectedId(id);
                  }}
                  onUpdate={engine.updateAnnotation}
                  onDelete={engine.deleteAnnotation}
                  onCopyMarkdown={handleCopyMarkdown}
                  isMobileDrawer={true}
                  onClose={() => setIsMobileDrawerOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM THUMBNAIL CAROUSEL IF MULTIPLE IMAGES */}
      {imageAttachments.length > 1 && (
        <footer 
          className="h-16 border-t border-border/80 bg-card/90 px-3 sm:px-4 flex items-center gap-2 overflow-x-auto scrollbar-none touch-pan-x shrink-0 z-20"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-2">
            Danh sách ảnh ({imageAttachments.length}):
          </span>
          {imageAttachments.map((att, idx) => {
            const isSelected = idx === currentImageIndex;
            return (
              <div
                key={att.id || idx}
                onClick={() => switchImage(idx)}
                className={`h-11 aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition relative shrink-0 ${
                  isSelected ? 'border-primary ring-2 ring-primary/40 shadow-md scale-105' : 'border-border/60 hover:border-border opacity-70 hover:opacity-100'
                }`}
                title={att.originalName}
              >
                <img src={resolveApiUrl(att.url)} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[9px] font-bold text-white">
                  #{idx + 1}
                </span>
              </div>
            );
          })}
        </footer>
      )}

      {/* Shortcuts Help Modal */}
      <AnnotationShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>,
    document.body
  );
};
