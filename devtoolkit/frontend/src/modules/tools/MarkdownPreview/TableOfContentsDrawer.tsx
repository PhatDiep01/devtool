import React, { useMemo } from 'react';
import { X, List, Hash, ChevronRight } from 'lucide-react';
import { slugifyHeading } from '../../docs/components/MarkdownRenderer';
import { HeadingItem } from './types';

interface TableOfContentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  previewContainerRef: React.RefObject<HTMLDivElement>;
}

export function extractHeadings(content: string): HeadingItem[] {
  if (!content) return [];
  const lines = content.split('\n');
  const headings: HeadingItem[] = [];

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check code blocks ``` to avoid matching comment lines inside code
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      // Remove inline markdown markers
      const cleanText = rawText.replace(/[*_~`]/g, '').trim();
      const id = slugifyHeading(cleanText);

      headings.push({
        id,
        level,
        text: cleanText,
        line: i + 1
      });
    }
  }

  return headings;
}

export const TableOfContentsDrawer: React.FC<TableOfContentsDrawerProps> = ({
  isOpen,
  onClose,
  content,
  previewContainerRef
}) => {
  const headings = useMemo(() => extractHeadings(content), [content]);

  const handleSelectHeading = (headingId: string) => {
    if (!previewContainerRef.current) return;
    const container = previewContainerRef.current;
    const targetEl = container.querySelector(`#${headingId}`);

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Flash highlight effect
      targetEl.classList.add('bg-primary/25', 'ring-2', 'ring-primary/50', 'transition-all');
      setTimeout(() => {
        targetEl.classList.remove('bg-primary/25', 'ring-2', 'ring-primary/50');
      }, 1200);

      // Auto close on mobile or when preferred
      if (window.innerWidth < 768) {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <List className="w-5 h-5 text-primary" />
            <span>Mục lục tài liệu</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {headings.length} mục
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
          {headings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Tài liệu chưa có tiêu đề nào (H1 - H6).
            </div>
          ) : (
            headings.map((item, idx) => {
              const paddingLeft = `${(item.level - 1) * 16}px`;

              return (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => handleSelectHeading(item.id)}
                  style={{ paddingLeft }}
                  className="w-full text-left flex items-start gap-2 py-1.5 px-2 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/70 transition-colors group"
                >
                  <span className="shrink-0 text-muted-foreground/60 group-hover:text-primary mt-0.5">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 break-words line-clamp-2 leading-snug">
                    {item.text}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
          <span>Nhấp vào mục để cuộn nhanh</span>
          <span>Esc để đóng</span>
        </div>
      </div>
    </div>
  );
};
