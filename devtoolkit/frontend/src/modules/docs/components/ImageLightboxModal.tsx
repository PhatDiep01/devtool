import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { resolveApiUrl } from '../../../services/api';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  subtitle?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
}) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const fullUrl = resolveApiUrl(imageUrl);

  const handleCopyMarkdown = () => {
    const mdTag = `![${title || 'Screenshot'}](${imageUrl})`;
    navigator.clipboard.writeText(mdTag);
    setCopied(true);
    toast.success('Đã chép mã Markdown vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = title || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/80 border-b border-neutral-800 text-neutral-200">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="truncate">
            <h3 className="text-sm font-bold text-white truncate">{title || 'Xem ảnh chi tiết'}</h3>
            {subtitle && <p className="text-xs text-neutral-400 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-xl p-1 border border-neutral-700">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1.5 min-w-[42px] text-center text-neutral-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
              title="Khôi phục kích thước 100%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy MD button */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white transition"
            title="Sao chép thẻ Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Đã chép' : 'Copy MD'}</span>
          </button>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-neutral-300 hover:text-white transition"
            title="Tải ảnh về máy"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Open full URL in new tab */}
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-neutral-300 hover:text-white transition"
            title="Mở ảnh trong tab mới"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 hover:text-white rounded-xl transition ml-1"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image canvas area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={fullUrl}
          alt={title || 'Screenshot'}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-transform duration-150 border border-neutral-800 pointer-events-auto"
          draggable={false}
        />
      </div>
    </div>
  );
};
