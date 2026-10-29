import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + Enter', desc: 'Chuyển đổi / Tạo mới kết quả ngay lập tức' },
    { key: 'Ctrl + Shift + C', desc: 'Sao chép nhanh kết quả chính vào Clipboard' },
    { key: 'Esc', desc: 'Xóa nội dung đang nhập (xác nhận nếu > 100 ký tự)' },
    { key: 'Phím 1', desc: 'Chuyển sang Tab Base64' },
    { key: 'Phím 2', desc: 'Chuyển sang Tab URL Encode/Decode' },
    { key: 'Phím 3', desc: 'Chuyển sang Tab JWT Decoder' },
    { key: 'Phím 4', desc: 'Chuyển sang Tab Hash' },
    { key: 'Phím 5', desc: 'Chuyển sang Tab GUID Generator' },
    { key: 'Phím 6', desc: 'Chuyển sang Tab Mật Khẩu' },
    { key: '?', desc: 'Bật / Tắt bảng hướng dẫn phím tắt này' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Phím Tắt Tiện Ích</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Các phím tắt số 1 - 6 hoạt động khi con trỏ không nằm bên trong ô nhập liệu (input / textarea).
          </p>

          <div className="space-y-1.5">
            {shortcuts.map((sc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/30 transition text-xs"
              >
                <span className="text-muted-foreground font-medium">{sc.desc}</span>
                <kbd className="px-2 py-1 rounded-md bg-muted border border-border font-mono text-[11px] font-bold text-foreground shadow-2xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
