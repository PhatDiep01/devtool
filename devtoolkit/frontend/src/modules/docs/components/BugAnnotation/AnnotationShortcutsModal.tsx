import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { SHORTCUTS_LIST } from './constants';

interface AnnotationShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnnotationShortcutsModal: React.FC<AnnotationShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Phím tắt Trình Đánh Dấu</h3>
              <p className="text-xs text-muted-foreground">Thao tác nhanh trên bàn phím</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-border/50 text-xs">
          {SHORTCUTS_LIST.map((sc, i) => (
            <div key={i} className="py-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{sc.label}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-muted border border-border/80 font-mono text-[11px] font-bold text-foreground shrink-0 shadow-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/30 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
