import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Maximize2, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical, 
  Lock, 
  Unlock, 
  Check, 
  RefreshCw, 
  Image as ImageIcon,
  Sliders,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { resolveApiUrl } from '../../../services/api';

interface ImageResizeModalProps {
  isOpen: boolean;
  file?: File | null;
  imageUrl?: string;
  imageAlt?: string;
  initialWidth?: number;
  initialHeight?: number;
  onClose: () => void;
  onConfirm: (
    processedFile: File,
    previewUrl: string,
    metadata: { width: number; height: number; sizeBytes: number }
  ) => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ImageResizeModal: React.FC<ImageResizeModalProps> = ({
  isOpen,
  file,
  imageUrl,
  imageAlt,
  initialWidth,
  initialHeight,
  onClose,
  onConfirm,
}) => {
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [quality, setQuality] = useState(0.9);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [estimatedSize, setEstimatedSize] = useState<number>(0);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Load image when file or imageUrl changes
  useEffect(() => {
    if (!isOpen || (!file && !imageUrl)) return;

    setLoading(true);
    let objectUrl = '';
    let targetSrc = '';

    if (file) {
      objectUrl = URL.createObjectURL(file);
      targetSrc = objectUrl;
    } else if (imageUrl) {
      targetSrc = resolveApiUrl(imageUrl);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      imageElementRef.current = img;
      setOriginalWidth(img.naturalWidth);
      setOriginalHeight(img.naturalHeight);
      
      const startWidth = initialWidth && initialWidth > 0 ? initialWidth : img.naturalWidth;
      const startHeight = initialHeight && initialHeight > 0 
        ? initialHeight 
        : Math.round((startWidth / (img.naturalWidth || 1)) * (img.naturalHeight || 1));

      setWidth(startWidth);
      setHeight(startHeight);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setEstimatedSize(file ? file.size : 0);

      // Auto-choose format based on file type
      if (file?.type === 'image/jpeg' || targetSrc.includes('.jpg') || targetSrc.includes('.jpeg')) setFormat('image/jpeg');
      else if (file?.type === 'image/webp' || targetSrc.includes('.webp')) setFormat('image/webp');
      else setFormat('image/png');

      setLoading(false);
    };

    img.onerror = () => {
      toast.error('Không thể tải hình ảnh để chỉnh sửa');
      setLoading(false);
    };

    img.src = targetSrc;

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, file, imageUrl, initialWidth, initialHeight]);

  // Update canvas & live preview
  useEffect(() => {
    if (!imageElementRef.current || width <= 0 || height <= 0) return;

    const img = imageElementRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine dimensions considering 90° or 270° rotation
    const isSideways = rotation === 90 || rotation === 270;
    const drawWidth = isSideways ? height : width;
    const drawHeight = isSideways ? width : height;

    canvas.width = drawWidth;
    canvas.height = drawHeight;

    ctx.save();

    // Translate to center for rotation & flips
    ctx.translate(drawWidth / 2, drawHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Draw the image scaled to the selected width & height
    ctx.drawImage(img, -width / 2, -height / 2, width, height);

    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setEstimatedSize(blob.size);
          const dataUrl = canvas.toDataURL(format, quality);
          setPreviewSrc(dataUrl);
        }
      },
      format,
      quality
    );
  }, [width, height, rotation, flipH, flipV, quality, format]);

  if (!isOpen || (!file && !imageUrl)) return null;

  const handleWidthChange = (val: number) => {
    const newWidth = Math.max(10, Math.min(8000, val));
    setWidth(newWidth);
    if (lockAspect && originalWidth > 0) {
      const ratio = originalHeight / originalWidth;
      setHeight(Math.round(newWidth * ratio));
    }
  };

  const handleHeightChange = (val: number) => {
    const newHeight = Math.max(10, Math.min(8000, val));
    setHeight(newHeight);
    if (lockAspect && originalHeight > 0) {
      const ratio = originalWidth / originalHeight;
      setWidth(Math.round(newHeight * ratio));
    }
  };

  const applyScalePreset = (percent: number) => {
    if (originalWidth <= 0) return;
    const newWidth = Math.round((originalWidth * percent) / 100);
    const newHeight = Math.round((originalHeight * percent) / 100);
    setWidth(newWidth);
    setHeight(newHeight);
  };

  const applyMaxDimension = (maxPx: number) => {
    if (originalWidth <= 0 || originalHeight <= 0) return;
    if (originalWidth <= maxPx && originalHeight <= maxPx) {
      // Already smaller
      setWidth(originalWidth);
      setHeight(originalHeight);
      return;
    }

    if (originalWidth >= originalHeight) {
      setWidth(maxPx);
      setHeight(Math.round((originalHeight / originalWidth) * maxPx));
    } else {
      setHeight(maxPx);
      setWidth(Math.round((originalWidth / originalHeight) * maxPx));
    }
  };

  const handleReset = () => {
    setWidth(originalWidth);
    setHeight(originalHeight);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setQuality(0.9);
  };

  const handleApply = () => {
    if (!imageElementRef.current || width <= 0 || height <= 0) return;

    const img = imageElementRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isSideways = rotation === 90 || rotation === 270;
    const drawWidth = isSideways ? height : width;
    const drawHeight = isSideways ? width : height;

    canvas.width = drawWidth;
    canvas.height = drawHeight;

    ctx.save();
    ctx.translate(drawWidth / 2, drawHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();

    // Clean filename with extension matching format
    const cleanBase = (file?.name || imageAlt || 'image').replace(/\.[^/.]+$/, '');
    let ext = '.png';
    if (format === 'image/jpeg') ext = '.jpg';
    else if (format === 'image/webp') ext = '.webp';

    const processedFileName = `${cleanBase}_${drawWidth}x${drawHeight}${ext}`;

    const finalizeConfirm = (blob: Blob | null) => {
      let previewUrl = imageUrl || '';
      let sizeBytes = 0;
      let finalFile: File;

      if (blob) {
        sizeBytes = blob.size;
        previewUrl = URL.createObjectURL(blob);
        finalFile = new File([blob], processedFileName, {
          type: format,
          lastModified: Date.now(),
        });
      } else {
        finalFile = new File([], processedFileName, { type: format });
      }

      onConfirm(finalFile, previewUrl, {
        width: drawWidth,
        height: drawHeight,
        sizeBytes,
      });

      toast.success(`Đã áp dụng kích thước: ${drawWidth}x${drawHeight} px`);
      onClose();
    };

    try {
      canvas.toBlob(
        (blob) => finalizeConfirm(blob),
        format,
        quality
      );
    } catch {
      finalizeConfirm(null);
    }
  };

  const sizeDiffPercent = file && file.size > 0 
    ? Math.round(((estimatedSize - file.size) / file.size) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                Tùy chỉnh & Thay đổi kích thước ảnh
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {file?.name || imageAlt || 'Hình ảnh'} • Gốc: {originalWidth}x{originalHeight} {file?.size ? `(${formatBytes(file.size)})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Canvas Preview */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-neutral-950/60 dark:bg-neutral-900/40 border border-border/80 rounded-2xl p-4 min-h-[300px] max-h-[460px] overflow-hidden relative">
            {loading ? (
              <div className="text-xs text-muted-foreground animate-pulse">
                Đang xử lý hình ảnh...
              </div>
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt="Preview"
                className="max-h-[380px] max-w-full object-contain rounded-lg shadow-md border border-neutral-800"
              />
            ) : (
              <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
            )}

            {/* Bottom floating badge info */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono px-3 py-1.5 bg-black/70 backdrop-blur-md text-white rounded-xl border border-white/10">
              <span>
                {width} x {height} px
              </span>
              <span className={sizeDiffPercent < 0 ? 'text-emerald-400 font-bold' : 'text-neutral-300'}>
                {formatBytes(estimatedSize)} {sizeDiffPercent !== 0 ? `(${sizeDiffPercent > 0 ? '+' : ''}${sizeDiffPercent}%)` : ''}
              </span>
            </div>
          </div>

          {/* Right Controls Panel */}
          <div className="md:col-span-5 space-y-4">
            {/* Dimensions Inputs */}
            <div className="bg-muted/30 border border-border/70 rounded-xl p-3.5 space-y-3">
              <label className="text-xs font-bold text-foreground block">
                Kích thước xuất (Dimensions)
              </label>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Chiều rộng (W)</span>
                  <div className="relative">
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary text-center"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">px</span>
                  </div>
                </div>

                {/* Aspect ratio lock button */}
                <button
                  type="button"
                  onClick={() => setLockAspect(!lockAspect)}
                  className={`p-2 rounded-xl mt-3.5 border transition ${
                    lockAspect
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                  title={lockAspect ? 'Đang khóa tỷ lệ khung hình' : 'Mở khóa tỷ lệ'}
                >
                  {lockAspect ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                <div className="flex-1">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Chiều cao (H)</span>
                  <div className="relative">
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary text-center"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">px</span>
                  </div>
                </div>
              </div>

              {/* Quick scale presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground block">Thu nhỏ theo tỷ lệ:</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyScalePreset(p)}
                      className="py-1 text-xs font-semibold bg-card border border-border rounded-lg hover:bg-accent text-foreground transition"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard documentation presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground block">Độ phân giải chuẩn:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyMaxDimension(800)}
                    className="py-1 text-[11px] font-semibold bg-card border border-border rounded-lg hover:bg-accent text-foreground transition"
                    title="Phù hợp xem tài liệu gọn nhẹ"
                  >
                    Max 800px
                  </button>
                  <button
                    type="button"
                    onClick={() => applyMaxDimension(1280)}
                    className="py-1 text-[11px] font-semibold bg-card border border-border rounded-lg hover:bg-accent text-foreground transition"
                    title="Chuẩn HD sắc nét"
                  >
                    Max 1280px
                  </button>
                  <button
                    type="button"
                    onClick={() => applyMaxDimension(1920)}
                    className="py-1 text-[11px] font-semibold bg-card border border-border rounded-lg hover:bg-accent text-foreground transition"
                    title="Chuẩn Full HD"
                  >
                    Max 1920px
                  </button>
                </div>
              </div>
            </div>

            {/* Transform Controls: Rotate & Flip */}
            <div className="bg-muted/30 border border-border/70 rounded-xl p-3.5 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Xoay & Lật ảnh
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 270) % 360)}
                  className="py-1.5 flex items-center justify-center gap-1 rounded-lg bg-card border border-border hover:bg-accent text-xs font-medium text-foreground transition"
                  title="Xoay trái 90°"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px]">Trái</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="py-1.5 flex items-center justify-center gap-1 rounded-lg bg-card border border-border hover:bg-accent text-xs font-medium text-foreground transition"
                  title="Xoay phải 90°"
                >
                  <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px]">Phải</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  className={`py-1.5 flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition ${
                    flipH ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-foreground hover:bg-accent'
                  }`}
                  title="Lật theo chiều ngang"
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px]">Ngang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV(!flipV)}
                  className={`py-1.5 flex items-center justify-center gap-1 rounded-lg border text-xs font-medium transition ${
                    flipV ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-foreground hover:bg-accent'
                  }`}
                  title="Lật theo chiều dọc"
                >
                  <FlipVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px]">Dọc</span>
                </button>
              </div>
            </div>

            {/* Format & Quality */}
            <div className="bg-muted/30 border border-border/70 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Định dạng & Chất lượng
                </label>
                <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setFormat('image/png')}
                    className={`px-2 py-0.5 rounded ${format === 'image/png' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('image/jpeg')}
                    className={`px-2 py-0.5 rounded ${format === 'image/jpeg' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    JPG
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('image/webp')}
                    className={`px-2 py-0.5 rounded ${format === 'image/webp' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    WebP
                  </button>
                </div>
              </div>

              {format !== 'image/png' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Nén chất lượng:</span>
                    <span className="font-mono font-bold text-foreground">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-border rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Khôi phục gốc</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Áp dụng kích thước</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
