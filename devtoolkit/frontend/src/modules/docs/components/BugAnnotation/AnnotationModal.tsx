import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationSidebar } from './AnnotationSidebar';
import { AnnotationShortcutsModal } from './AnnotationShortcutsModal';
import { compositeImageWithAnnotations, generateMarkdownSummary } from './mathUtils';
import { toast } from 'react-hot-toast';

export interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bug: BugItem;
  initialImageId?: string;
  onAnnotationsUpdated?: (bugId: number) => void;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  bug,
  initialImageId,
  onAnnotationsUpdated,
}) => {
  // Filter all image attachments from bug
  const imageAttachments = useMemo(() => {
    return (bug.attachments || []).filter((a) => a.isImage || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.url || a.filename || ''));
  }, [bug.attachments]);

  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [conflictData, setConflictData] = useState<{
    serverVersion: number;
    serverAnnotations: AnnotationItem[];
  } | null>(null);

  // Set initial selected image
  useEffect(() => {
    if (initialImageId && imageAttachments.length > 0) {
      const idx = imageAttachments.findIndex((img) => (img.id || img.filename) === initialImageId);
      if (idx !== -1) {
        setCurrentImageIndex(idx);
      }
    }
  }, [initialImageId, imageAttachments]);

  const currentImage: BugAttachment | undefined = imageAttachments[currentImageIndex];
  const currentImageId = currentImage ? (currentImage.id || currentImage.filename) : '';

  // Auto-save handler sent to useAnnotationEngine
  const handleAutoSave = useCallback(async (savedItems: AnnotationItem[]) => {
    if (!bug.id || !currentImageId) return;
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
  }, [bug.id, currentImageId, currentVersion, onAnnotationsUpdated]);

  // Force overwrite in case of concurrency conflict
  const handleForceSave = async () => {
    if (!bug.id || !currentImageId) return;
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
  }, [isOpen, bug]);

  const engine = useAnnotationEngine({
    initialAnnotations: [],
    onAutoSave: handleAutoSave,
    autoSaveDelay: 1000
  });

  // Load annotations from API when image changes
  useEffect(() => {
    if (!isOpen || !bug.id || !currentImageId) return;

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
  }, [isOpen, bug.id, currentImageId]);

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
      else if (key === 'f') engine.fitToScreen();
      else if (key === '?') setIsShortcutsModalOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, engine]);

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
      link.download = `annotation_bug_${bug.id}_${baseName}.png`;
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

  // Handle Copy Merged Image to Clipboard
  const handleCopyImage = async () => {
    if (!currentImage) return;
    try {
      setIsExporting(true);
      const fullUrl = resolveApiUrl(currentImage.url);
      const blob = await compositeImageWithAnnotations(fullUrl, engine.annotations);
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast.success('Đã sao chép ảnh có đánh dấu vào Clipboard');
      } else {
        toast.error('Trình duyệt không hỗ trợ sao chép ảnh vào Clipboard');
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
      bug.title,
      bug.us_key,
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
      <header className="h-14 border-b border-border/80 bg-card/95 px-4 flex items-center justify-between text-foreground shrink-0 z-20">
        {/* Left: Bug Info & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">Bug #{bug.id}</span>
              {bug.us_key && (
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {bug.us_key}
                </span>
              )}
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Trình Đánh Dấu Ảnh
              </span>
            </div>
            <h2 className="text-sm font-bold text-foreground truncate max-w-md sm:max-w-xl" title={bug.title}>
              {bug.title}
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
        <div className="flex items-center gap-2">
          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportPng}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
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
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title="Sao chép ảnh vào Clipboard để dán nhanh vào Jira / Chat"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Copy ảnh</span>
          </button>

          {/* Save Now Button */}
          <button
            type="button"
            onClick={() => engine.saveNow().then(() => toast.success('Đã lưu đánh dấu'))}
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition shadow-sm"
            title="Lưu đánh dấu ngay (Ctrl + S)"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Lưu</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition ml-1"
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
        onFitToScreen={engine.fitToScreen}
        onToggleShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* 3. MAIN WORKSPACE (CANVAS + SIDEBAR) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center: Canvas Viewport */}
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

          {/* Floating Onboarding Guide Hint when empty */}
          {!initialLoading && currentImage && engine.annotations.length === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-card/90 backdrop-blur border border-primary/40 shadow-xl text-xs font-medium text-foreground flex items-center gap-2 pointer-events-none animate-bounce">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span>Nhấp hoặc kéo chuột trên ảnh để vẽ khoanh vùng điểm lỗi</span>
            </div>
          )}
        </main>

        {/* Right: Sidebar List of Annotations */}
        <AnnotationSidebar
          annotations={engine.annotations}
          selectedId={engine.selectedId}
          onSelect={engine.setSelectedId}
          onUpdate={engine.updateAnnotation}
          onDelete={engine.deleteAnnotation}
          onCopyMarkdown={handleCopyMarkdown}
        />
      </div>

      {/* 4. BOTTOM THUMBNAIL CAROUSEL IF MULTIPLE IMAGES */}
      {imageAttachments.length > 1 && (
        <footer className="h-16 border-t border-border/80 bg-card/90 px-4 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
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
