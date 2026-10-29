import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Folder, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ApiEndpoint } from '@/types';
import { ApiMethodBadge } from './ApiMethodBadge';

interface ApiSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  endpoints: ApiEndpoint[];
  onSelectEndpoint: (endpoint: ApiEndpoint) => void;
}

export const ApiSearchPalette: React.FC<ApiSearchPaletteProps> = ({
  isOpen,
  onClose,
  endpoints,
  onSelectEndpoint
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter endpoints
  const q = query.trim().toLowerCase();
  const filtered = q
    ? endpoints.filter(ep => {
        const inPath = ep.path.toLowerCase().includes(q);
        const inTitle = ep.title.toLowerCase().includes(q);
        const inDesc = (ep.description || '').toLowerCase().includes(q);
        const inFolder = (ep.folder || '').toLowerCase().includes(q);
        const inMethod = ep.method.toLowerCase().includes(q);
        const inTags = (ep.tags || []).some(t => t.toLowerCase().includes(q));
        const inParams = (ep.parameters || []).some(p => p.name.toLowerCase().includes(q));
        const inErrors = (ep.related_error_codes || []).some(c => c.toLowerCase().includes(q));
        return inPath || inTitle || inDesc || inFolder || inMethod || inTags || inParams || inErrors;
      })
    : endpoints.slice(0, 15);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectEndpoint(filtered[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm theo đường dẫn, tên endpoint, tham số, mã lỗi, tag... (Ctrl + K)"
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-muted border border-border rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-border/40 scrollbar-thin flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Không tìm thấy endpoint nào phù hợp với từ khóa <span className="text-foreground font-semibold">"{query}"</span>
            </div>
          ) : (
            filtered.map((ep, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={ep.id}
                  onClick={() => {
                    onSelectEndpoint(ep);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ApiMethodBadge method={ep.method} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {ep.path}
                        </span>
                        {ep.status === 'deprecated' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            Sắp bỏ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-0.5">
                        <span className="font-medium truncate">{ep.title}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          {ep.folder || 'Chung'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary font-medium">
                        Chọn <CornerDownLeft className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">↓</kbd> Di chuyển</span>
            <span><kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">Enter</kbd> Chọn</span>
          </div>
          <span>{filtered.length} kết quả</span>
        </div>
      </div>
    </div>
  );
};
