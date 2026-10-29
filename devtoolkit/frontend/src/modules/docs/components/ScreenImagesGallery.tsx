import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Eye, 
  Copy, 
  Check, 
  Plus, 
  FileImage, 
  Download, 
  Loader2,
  ExternalLink,
  Sliders,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ScreenImage } from '../../../types';
import { filesApi, resolveApiUrl } from '../../../services/api';
import { ImageLightboxModal } from './ImageLightboxModal';
import { ImageResizeModal } from './ImageResizeModal';

interface ScreenImagesGalleryProps {
  images: ScreenImage[];
  onImagesChange?: (updatedImages: ScreenImage[]) => void;
  screenId?: number;
  onInsertToMarkdown?: (markdownSnippet: string) => void;
  onDeleteImage?: (deletedImg: ScreenImage) => void;
  readOnly?: boolean;
  title?: string;
  deferUpload?: boolean; // When true, do NOT upload to server immediately. Keep in local state until parent saves.
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ScreenImagesGallery: React.FC<ScreenImagesGalleryProps> = ({
  images = [],
  onImagesChange,
  screenId,
  onInsertToMarkdown,
  onDeleteImage,
  readOnly = false,
  title = 'Giao diện & Ảnh đính kèm (Screenshots & Mockups)',
  deferUpload = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [activeImage, setActiveImage] = useState<ScreenImage | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Modal for editing/resizing an existing pending or saved image
  const [resizingFile, setResizingFile] = useState<File | null>(null);
  const [resizingTargetUrl, setResizingTargetUrl] = useState<string | null>(null);
  const [resizingTargetAlt, setResizingTargetAlt] = useState<string>('');
  const [resizingTargetImageId, setResizingTargetImageId] = useState<number | null>(null);
  const [showResizeModal, setShowResizeModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // When files are selected from input or dropped - add directly without auto-opening popup
  const handleSelectFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      toast.error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP, GIF, SVG)');
      return;
    }

    // If deferUpload is enabled (e.g. creating/editing screen before clicking Save)
    if (deferUpload) {
      const newPendingImages: ScreenImage[] = [];
      for (const file of fileArray) {
        const previewUrl = URL.createObjectURL(file);
        const tempId = `temp_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newPendingImages.push({
          id: -Date.now() - Math.floor(Math.random() * 10000),
          tempId,
          screen_id: screenId || null,
          original_name: file.name,
          stored_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          created_at: new Date().toISOString(),
          url: previewUrl,
          isPending: true,
          file,
        });
      }
      const updated = [...newPendingImages, ...images];
      if (onImagesChange) onImagesChange(updated);
      toast.success(`Đã thêm ${fileArray.length} ảnh vào danh sách (Chờ bấm "Lưu tài liệu")`);
      return;
    }

    // If immediate upload is required (e.g. on ScreenDetail)
    setUploading(true);
    try {
      const newUploaded: ScreenImage[] = [];
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('image', file);
        if (screenId) {
          formData.append('screen_id', String(screenId));
        }

        const res = await filesApi.uploadImage(formData);
        newUploaded.push({
          id: res.data.id,
          screen_id: screenId || null,
          original_name: res.data.originalName || file.name,
          stored_name: res.data.storedName || file.name,
          mime_type: file.type,
          size_bytes: res.data.sizeBytes || file.size,
          created_at: new Date().toISOString(),
          url: res.data.url,
          isPending: false,
        });
      }

      const updated = [...newUploaded, ...images];
      if (onImagesChange) onImagesChange(updated);
      toast.success(`Đã tải lên ${fileArray.length} ảnh lên máy chủ thành công!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Tải ảnh lên máy chủ thất bại');
    } finally {
      setUploading(false);
    }
  };

  // Called when user confirms resize/customization in ImageResizeModal
  const handleConfirmResize = async (
    processedFile: File,
    previewUrl: string,
    metadata: { width: number; height: number; sizeBytes: number }
  ) => {
    // If we were resizing an already existing pending or saved image
    if (resizingTargetImageId !== null) {
      const updated = images.map((item) => {
        if (item.id === resizingTargetImageId) {
          return {
            ...item,
            file: processedFile.size > 0 ? processedFile : item.file,
            url: previewUrl || item.url,
            original_name: processedFile.name || item.original_name,
            size_bytes: metadata.sizeBytes || item.size_bytes,
            width: metadata.width,
            height: metadata.height,
          };
        }
        return item;
      });
      if (onImagesChange) onImagesChange(updated);
      setResizingFile(null);
      setResizingTargetUrl(null);
      setResizingTargetImageId(null);
      setShowResizeModal(false);
    }
  };

  // Re-open resize modal for an existing image
  const handleEditImageDimensions = (img: ScreenImage) => {
    setResizingTargetImageId(img.id);
    setResizingFile(img.file || null);
    setResizingTargetUrl(img.file ? null : img.url);
    setResizingTargetAlt(img.original_name);
    setShowResizeModal(true);
  };

  const handleDelete = async (img: ScreenImage) => {
    // If pending (not saved to server yet), simply remove locally without any server request!
    if (img.isPending) {
      if (img.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(img.url);
        } catch {}
      }
      const updated = images.filter((item) => item.id !== img.id);
      if (onImagesChange) onImagesChange(updated);
      if (onDeleteImage) onDeleteImage(img);
      toast.success('Đã xóa ảnh khỏi danh sách chờ lưu');
      return;
    }

    // If already saved on server, request confirmation and call API
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ảnh "${img.original_name}" trên máy chủ? Thao tác này sẽ xóa vĩnh viễn file trên máy chủ và loại bỏ khỏi nội dung tài liệu.`)) return;

    setDeletingId(img.id);
    try {
      await filesApi.deleteImage(img.id);
      if (img.stored_name) {
        await filesApi.deleteImageByName(img.stored_name).catch(() => {});
      }
      toast.success('Đã xóa ảnh trên máy chủ thành công');
      const updated = images.filter((item) => item.id !== img.id);
      if (onImagesChange) onImagesChange(updated);
      if (onDeleteImage) onDeleteImage(img);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Xóa ảnh thất bại');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyMarkdown = (img: ScreenImage) => {
    const snippet = `![${img.original_name}](${img.url})`;
    navigator.clipboard.writeText(snippet);
    setCopiedId(img.id);
    toast.success('Đã sao chép mã Markdown vào clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {images.length}
              </span>
              {deferUpload && images.some((img) => img.isPending) && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {images.filter((img) => img.isPending).length} ảnh chờ lưu
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {deferUpload
                ? 'Ảnh thêm tại đây sẽ được chỉnh sửa kích thước và chỉ tải lên máy chủ khi bạn bấm "Lưu tài liệu"'
                : 'Mockup giao diện, sơ đồ hệ thống hoặc ảnh chụp màn hình cho tính năng này'}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleSelectFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{uploading ? 'Đang tải lên...' : '+ Thêm ảnh / Chụp màn hình'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Drop zone when empty or as an option */}
      {!readOnly && images.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleSelectFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/10 hover:bg-muted/20 transition-all rounded-2xl p-6 sm:p-8 text-center cursor-pointer space-y-2 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground group-hover:text-primary transition-colors shadow-xs">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <FileImage className="w-6 h-6" />}
          </div>
          <div className="text-sm font-semibold text-foreground">
            {uploading ? 'Đang xử lý hình ảnh...' : 'Kéo thả ảnh hoặc nhấp để thêm ảnh'}
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Hỗ trợ tùy chỉnh kích thước (Resize), xoay ảnh và xem trước tức thì trước khi lưu lên máy chủ.
          </p>
        </div>
      )}

      {/* Grid of uploaded and pending images */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {images.map((img) => {
              const fullUrl = img.isPending ? img.url : resolveApiUrl(img.url);
              return (
                <div
                  key={img.id}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group ${
                    img.isPending ? 'border-amber-500/40' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {/* Thumbnail container */}
                  <div
                    onClick={() => setActiveImage(img)}
                    className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden cursor-pointer group-hover:opacity-95 transition"
                  >
                    <img
                      src={fullUrl}
                      alt={img.original_name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Status Badge (Pending / Saved) */}
                    <div className="absolute top-2 left-2 z-10">
                      {img.isPending ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-white shadow-xs backdrop-blur-sm">
                          <Clock className="w-3 h-3" />
                          <span>Chưa lưu</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600/90 text-white shadow-xs backdrop-blur-sm">
                          <Check className="w-3 h-3" />
                          <span>Đã lưu</span>
                        </span>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition shadow-sm">
                        <Eye className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                  {/* Metadata and Quick Actions */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div className="min-w-0">
                      <div
                        onClick={() => setActiveImage(img)}
                        className="text-xs font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        title={img.original_name}
                      >
                        {img.original_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        {img.size_bytes ? <span>{formatBytes(img.size_bytes)}</span> : null}
                        {img.width && img.height ? <span>• {img.width}x{img.height}</span> : null}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/50 text-xs">
                      {onInsertToMarkdown && (
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `![${img.original_name}](${img.url})`;
                            onInsertToMarkdown(snippet);
                            toast.success(`Đã chèn ảnh "${img.original_name}" vào tài liệu!`);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition"
                          title="Chèn ảnh này vào vị trí soạn thảo"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Chèn</span>
                        </button>
                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleEditImageDimensions(img)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary transition"
                          title="Tùy chỉnh kích thước (Resize)"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyMarkdown(img)}
                        className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground text-[11px] transition"
                        title="Sao chép cú pháp Markdown"
                      >
                        {copiedId === img.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Copy MD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveImage(img)}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
                        title="Xem phóng to"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {!readOnly && (
                        <button
                          type="button"
                          disabled={deletingId === img.id}
                          onClick={() => handleDelete(img)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                          title={img.isPending ? 'Bỏ ảnh chờ lưu' : 'Xóa ảnh trên máy chủ'}
                        >
                          {deletingId === img.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleSelectFiles(e.dataTransfer.files);
                }
              }}
              className="p-3 border border-dashed border-border/80 rounded-xl bg-muted/10 text-center text-xs text-muted-foreground hover:bg-muted/20 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>+ Kéo thêm ảnh hoặc nhấp vào đây để thêm và tùy chỉnh kích thước ảnh</span>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {activeImage && (
        <ImageLightboxModal
          isOpen={Boolean(activeImage)}
          onClose={() => setActiveImage(null)}
          imageUrl={activeImage.isPending ? activeImage.url : activeImage.url}
          title={activeImage.original_name}
          subtitle={formatBytes(activeImage.size_bytes)}
        />
      )}

      {/* Resize / Edit Modal */}
      {showResizeModal && (resizingFile || resizingTargetUrl) && (
        <ImageResizeModal
          isOpen={showResizeModal}
          file={resizingFile}
          imageUrl={resizingTargetUrl || undefined}
          imageAlt={resizingTargetAlt}
          onClose={() => {
            setShowResizeModal(false);
            setResizingFile(null);
            setResizingTargetUrl(null);
            setResizingTargetImageId(null);
          }}
          onConfirm={handleConfirmResize}
        />
      )}
    </div>
  );
};
