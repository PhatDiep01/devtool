import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Table as TableIcon, 
  Minus, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Sparkles, 
  Columns, 
  Eye, 
  Edit3, 
  FileText,
  Upload, 
  HelpCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  Sliders,
  Maximize2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { filesApi, resolveApiUrl } from '../../../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { markdownToHtml, htmlToMarkdown } from '../../../utils/markdownConverter';
import { ImageResizeModal } from './ImageResizeModal';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
  minHeight?: string;
  placeholder?: string;
  onUploadImage?: (file: File) => Promise<string>;
  onDeleteImage?: (imageSrc: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  isSaving = false,
  minHeight = '520px',
  placeholder = 'Nhập nội dung đặc tả tại đây...',
  onUploadImage,
  onDeleteImage,
}) => {
  // Default to 'visual' (WYSIWYG) mode as requested to make it easy for no-tech users
  const [viewMode, setViewMode] = useState<'visual' | 'split' | 'edit' | 'preview'>('visual');
  const [isUploading, setIsUploading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCallouts, setShowCallouts] = useState(false);
  const [showHeadings, setShowHeadings] = useState(false);
  const [showTableTools, setShowTableTools] = useState(false);

  // Hover and Interactive Resize state for Images in WYSIWYG
  const [hoveredImage, setHoveredImage] = useState<HTMLImageElement | null>(null);
  const [hoveredImageRect, setHoveredImageRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isResizingDrag, setIsResizingDrag] = useState(false);
  const [dragCurrentWidth, setDragCurrentWidth] = useState<number | null>(null);

  // Configuration Modal state (opened when clicking directly on image or clicking Sliders icon)
  const [editorModalImage, setEditorModalImage] = useState<{
    url?: string;
    alt?: string;
    file?: File | null;
    initialWidth?: number;
    initialHeight?: number;
    targetElement?: HTMLImageElement | null;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const visualContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUpdatingFromProps = useRef<boolean>(false);
  const hoverTimeoutRef = useRef<any>(null);
  const dragStartInfo = useRef<{ startX: number; startWidth: number; img: HTMLImageElement } | null>(null);

  // Sync value to visual editor when switching to visual mode or initial mount
  useEffect(() => {
    if (viewMode === 'visual' && visualRef.current) {
      const currentHtml = visualRef.current.innerHTML;
      const expectedHtml = markdownToHtml(value);
      // Only update if fundamentally different to preserve cursor and avoid loops
      if (htmlToMarkdown(currentHtml).trim() !== value.trim()) {
        isUpdatingFromProps.current = true;
        visualRef.current.innerHTML = expectedHtml;
        isUpdatingFromProps.current = false;
      }
    }
  }, [viewMode, value]);

  // Handle changes inside Visual Editor
  const handleVisualInput = useCallback(() => {
    if (isUpdatingFromProps.current || !visualRef.current) return;
    const html = visualRef.current.innerHTML;
    const newMarkdown = htmlToMarkdown(html);
    onChange(newMarkdown);
  }, [onChange]);

  // Helper to accurately position floating toolbar over the hovered image
  const updateImageRect = useCallback((img: HTMLImageElement) => {
    if (!visualContainerRef.current) return;
    const containerRect = visualContainerRef.current.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    setHoveredImage(img);
    setHoveredImageRect({
      top: imgRect.top - containerRect.top + visualContainerRef.current.scrollTop,
      left: imgRect.left - containerRect.left + visualContainerRef.current.scrollLeft,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  // Listen for image deletions inside visual editor (e.g. Backspace, Cut, Delete key)
  useEffect(() => {
    if (viewMode !== 'visual' || !visualRef.current) return;

    const observer = new MutationObserver((mutations) => {
      if (isUpdatingFromProps.current) return;

      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeName === 'IMG') {
            const img = node as HTMLImageElement;
            const src = img.getAttribute('data-doc-src') || img.src;
            if (src && onDeleteImage) {
              onDeleteImage(src);
            }
          } else if ((node as HTMLElement).querySelectorAll) {
            const imgs = (node as HTMLElement).querySelectorAll('img');
            imgs.forEach((img) => {
              const src = img.getAttribute('data-doc-src') || img.src;
              if (src && onDeleteImage) {
                onDeleteImage(src);
              }
            });
          }
        });
      });
    });

    observer.observe(visualRef.current, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [viewMode, onDeleteImage]);

  // Handle mouse move over images in Visual mode
  const handleVisualMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isResizingDrag) return;
    let target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG') {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      updateImageRect(target as HTMLImageElement);
    }
  };

  const handleVisualMouseLeave = () => {
    if (isResizingDrag) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredImage(null);
      setHoveredImageRect(null);
    }, 400);
  };

  // Clicking directly on an image opens the configuration popup modal
  const handleVisualClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      e.stopPropagation();
      e.preventDefault();

      const widthAttr = img.getAttribute('width');
      const styleW = img.style?.width;
      const initialW = parseInt(widthAttr || styleW || '') || img.naturalWidth || Math.round(img.offsetWidth);
      const initialH = img.naturalHeight || Math.round(img.offsetHeight);

      setEditorModalImage({
        url: img.getAttribute('data-doc-src') || img.src,
        alt: img.alt || 'Hình ảnh',
        initialWidth: initialW,
        initialHeight: initialH,
        targetElement: img,
      });
    }
  };

  // Apply quick resize preset from hover toolbar (25%, 50%, 75%, 100%, 800px)
  const handleApplyPresetWidth = (preset: number | '800px') => {
    if (!hoveredImage) return;
    const img = hoveredImage;
    const containerWidth = visualRef.current?.clientWidth || 800;
    const naturalW = img.naturalWidth || img.offsetWidth;

    let targetPx = 0;
    if (preset === '800px') {
      targetPx = Math.min(800, containerWidth);
    } else {
      targetPx = Math.round((Math.min(naturalW, containerWidth) * preset) / 100);
    }

    img.setAttribute('width', `${targetPx}`);
    img.style.width = `${targetPx}px`;
    img.style.maxWidth = '100%';
    handleVisualInput();
    updateImageRect(img);
    toast.success(`Đã resize ảnh: ${targetPx}px (${preset})`);
  };

  // Delete image from hover toolbar
  const handleDeleteHoveredImage = () => {
    if (!hoveredImage) return;
    const img = hoveredImage;
    const src = img.getAttribute('data-doc-src') || img.src;

    const parent = img.parentElement;
    img.remove();
    if (parent && parent.tagName === 'P' && parent.children.length === 0 && !parent.textContent?.trim()) {
      parent.remove();
    }

    setHoveredImage(null);
    setHoveredImageRect(null);
    handleVisualInput();

    if (onDeleteImage && src) {
      onDeleteImage(src);
    }
    toast.success('Đã xóa ảnh khỏi tài liệu');
  };

  // Start interactive drag-to-resize handle at bottom-right
  const handleStartDragResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hoveredImage) return;

    const img = hoveredImage;
    dragStartInfo.current = {
      startX: e.clientX,
      startWidth: img.offsetWidth,
      img,
    };
    setIsResizingDrag(true);
    setDragCurrentWidth(Math.round(img.offsetWidth));

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartInfo.current) return;
      const { startX, startWidth, img: targetImg } = dragStartInfo.current;
      const containerW = visualRef.current?.clientWidth || 900;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, Math.min(containerW, startWidth + deltaX));

      targetImg.setAttribute('width', `${Math.round(newWidth)}`);
      targetImg.style.width = `${Math.round(newWidth)}px`;
      targetImg.style.maxWidth = '100%';
      setDragCurrentWidth(Math.round(newWidth));
      updateImageRect(targetImg);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsResizingDrag(false);
      setDragCurrentWidth(null);
      dragStartInfo.current = null;
      handleVisualInput();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Called when image is configured in modal
  const handleConfirmModalResize = (
    processedFile: File,
    previewUrl: string,
    metadata: { width: number; height: number; sizeBytes: number }
  ) => {
    if (editorModalImage?.targetElement) {
      const img = editorModalImage.targetElement;
      img.setAttribute('width', `${metadata.width}`);
      img.style.width = `${metadata.width}px`;
      img.style.maxWidth = '100%';
      if (previewUrl && previewUrl.startsWith('blob:')) {
        img.src = previewUrl;
      }
      handleVisualInput();
      updateImageRect(img);
    }
    setEditorModalImage(null);
  };

  // Switch View Mode with clean state synchronization
  const handleSwitchMode = (mode: 'visual' | 'split' | 'edit' | 'preview') => {
    if (mode === viewMode) return;

    if (viewMode === 'visual' && visualRef.current) {
      // Sync from visual to markdown before leaving visual mode
      const html = visualRef.current.innerHTML;
      const newMd = htmlToMarkdown(html);
      onChange(newMd);
    } else if (mode === 'visual') {
      // Sync from markdown to visual before entering visual mode
      setTimeout(() => {
        if (visualRef.current) {
          visualRef.current.innerHTML = markdownToHtml(value);
        }
      }, 0);
    }

    setViewMode(mode);
  };

  // Helper to execute formatting command in Visual Mode
  const execVisualCommand = (command: string, arg: string | undefined = undefined) => {
    if (visualRef.current) {
      visualRef.current.focus();
    }
    document.execCommand(command, false, arg);
    handleVisualInput();
  };

  // Insert markdown syntax around or at cursor in Textarea Mode
  const insertText = useCallback((before: string, after: string = '', defaultText: string = '') => {
    if (viewMode === 'visual') {
      // In Visual mode, use standard commands
      if (before === '**' && after === '**') execVisualCommand('bold');
      else if (before === '*' && after === '*') execVisualCommand('italic');
      else if (before === '~~' && after === '~~') execVisualCommand('strikeThrough');
      else {
        execVisualCommand('insertHTML', `${before}${defaultText}${after}`);
      }
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    const replacement = `${before}${selectedText}${after}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 10);
  }, [value, onChange, viewMode]);

  // Insert text block at current cursor or newline
  const insertBlock = useCallback((textToInsert: string) => {
    if (viewMode === 'visual') {
      const htmlBlock = markdownToHtml(textToInsert);
      if (visualRef.current) visualRef.current.focus();
      document.execCommand('insertHTML', false, htmlBlock);
      handleVisualInput();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
    const suffix = end < value.length && value[end] !== '\n' ? '\n\n' : '';
    const replacement = `${prefix}${textToInsert}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + replacement.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 10);
  }, [value, onChange, viewMode, handleVisualInput]);

  // Visual Headings setter
  const applyHeading = (tag: 'h1' | 'h2' | 'h3' | 'p') => {
    if (viewMode === 'visual') {
      execVisualCommand('formatBlock', tag.toUpperCase());
    } else {
      if (tag === 'h1') insertBlock('# Tiêu đề H1');
      else if (tag === 'h2') insertBlock('## Tiêu đề H2');
      else if (tag === 'h3') insertBlock('### Tiêu đề H3');
    }
    setShowHeadings(false);
  };

  // Visual Table Helpers
  const insertVisualTable = () => {
    if (viewMode === 'visual') {
      const tableHtml = `
        <table class="border-collapse border border-border my-4 w-full text-sm">
          <thead>
            <tr class="bg-muted/50">
              <th class="border border-border p-2 font-bold text-left">Cột 1</th>
              <th class="border border-border p-2 font-bold text-left">Cột 2</th>
              <th class="border border-border p-2 font-bold text-left">Cột 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="border border-border p-2">Nội dung 1</td>
              <td class="border border-border p-2">Nội dung 2</td>
              <td class="border border-border p-2">Nội dung 3</td>
            </tr>
            <tr>
              <td class="border border-border p-2">Nội dung 4</td>
              <td class="border border-border p-2">Nội dung 5</td>
              <td class="border border-border p-2">Nội dung 6</td>
            </tr>
          </tbody>
        </table>
        <p><br></p>
      `;
      execVisualCommand('insertHTML', tableHtml);
    } else {
      insertBlock('| Cột 1 | Cột 2 | Cột 3 |\n|---|---|---|\n| Giá trị 1 | Giá trị 2 | Giá trị 3 |\n| Giá trị 4 | Giá trị 5 | Giá trị 6 |');
    }
  };

  // Table manipulation helpers (for active cell)
  const modifyTable = (action: 'addRow' | 'deleteRow' | 'addCol' | 'deleteCol') => {
    if (viewMode !== 'visual') return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    let node: Node | null = sel.anchorNode;
    while (node && node.nodeName !== 'TD' && node.nodeName !== 'TH') {
      if (node === visualRef.current) break;
      node = node.parentNode;
    }

    if (!node || (node.nodeName !== 'TD' && node.nodeName !== 'TH')) {
      toast('Hãy đặt con trỏ vào ô bảng cần thao tác', { icon: 'ℹ️' });
      return;
    }

    const cell = node as HTMLTableCellElement;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.parentElement?.parentElement as HTMLTableElement;
    if (!table) return;

    if (action === 'addRow') {
      const newRow = table.insertRow(row.rowIndex + 1);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.className = 'border border-border p-2';
        newCell.innerHTML = 'Nội dung mới';
      }
      toast.success('Đã thêm dòng mới vào bảng');
    } else if (action === 'deleteRow') {
      if (table.rows.length <= 1) {
        toast.error('Bảng chỉ còn 1 dòng, không thể xóa tiếp');
        return;
      }
      table.deleteRow(row.rowIndex);
      toast.success('Đã xóa dòng');
    } else if (action === 'addCol') {
      const colIdx = cell.cellIndex;
      for (let r = 0; r < table.rows.length; r++) {
        const rCells = table.rows[r];
        const newCell = rCells.insertCell(colIdx + 1);
        newCell.className = 'border border-border p-2';
        newCell.innerHTML = r === 0 ? 'Cột mới' : 'Giá trị';
      }
      toast.success('Đã thêm cột mới vào bảng');
    } else if (action === 'deleteCol') {
      if (row.cells.length <= 1) {
        toast.error('Bảng chỉ còn 1 cột, không thể xóa tiếp');
        return;
      }
      const colIdx = cell.cellIndex;
      for (let r = 0; r < table.rows.length; r++) {
        table.rows[r].deleteCell(colIdx);
      }
      toast.success('Đã xóa cột');
    }

    handleVisualInput();
  };

  // Handle Image Upload & Insertion
  const uploadAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, SVG, WebP, GIF)');
      return;
    }

    setIsUploading(true);

    try {
      let imageUrl = '';
      if (onUploadImage) {
        imageUrl = await onUploadImage(file);
      } else {
        const toastId = toast.loading(`Đang tải ảnh "${file.name}" lên máy chủ...`);
        try {
          const formData = new FormData();
          formData.append('image', file);
          const res = await filesApi.uploadImage(formData);
          imageUrl = res.data.url;
          toast.success('Tải ảnh thành công và đã chèn vào tài liệu!', { id: toastId });
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Tải ảnh thất bại', { id: toastId });
          throw err;
        }
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');

      if (viewMode === 'visual') {
        const resolvedUrl = resolveApiUrl(imageUrl);
        const imgHtml = `<p><img src="${resolvedUrl}" data-doc-src="${imageUrl}" alt="${cleanName}" class="max-w-full rounded-xl my-3 border border-border shadow-xs inline-block cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" /></p><p><br></p>`;
        execVisualCommand('insertHTML', imgHtml);
      } else {
        const markdownTag = `![${cleanName}](${imageUrl})`;
        insertBlock(markdownTag);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      uploadAndInsertImage(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and Drop Images directly into editor
  const handleDrop = (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
      if (imageFile) {
        e.preventDefault();
        uploadAndInsertImage(imageFile);
      }
    }
  };

  // Paste image directly from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            uploadAndInsertImage(file);
            return;
          }
        }
      }
    }
  };

  // Keyboard Shortcuts (Ctrl+S, Ctrl+B, Ctrl+I)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (onSave) onSave();
      return;
    }
    if (viewMode !== 'visual') {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        insertText('**', '**', 'văn bản in đậm');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        insertText('*', '*', 'văn bản in nghiêng');
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        insertText('  ', '');
      }
    }
  };

  // Pre-built Handover Templates
  const templates = [
    {
      label: 'Bảng Features & AC mẫu',
      content: `### 2. TÍNH NĂNG & TIÊU CHÍ NGHIỆM THU (FEATURES & AC)
| Mã | Tính năng | Mô tả chi tiết | Tiêu chí nghiệm thu (AC) | Trạng thái |
|---|---|---|---|---|
| FEAT-01 | Khởi tạo trang | Tải dữ liệu ban đầu từ API | Hiển thị spinner và danh sách đầy đủ | Hoàn tất |
| FEAT-02 | Tìm kiếm & Lọc | Lọc theo từ khóa tức thì | Phản hồi dưới 300ms, không lag | Đang làm |
| FEAT-03 | Xác thực dữ liệu | Kiểm tra các trường bắt buộc | Hiển thị thông báo lỗi cụ thể | Chờ test |`
    },
    {
      label: 'Bảng API Endpoints mẫu',
      content: `### 4. DANH SÁCH API ENDPOINTS
| Method | Endpoint | Mô tả nghiệp vụ | Request Body / Query Params | Response mẫu |
|---|---|---|---|---|
| GET | \`/api/docs/screens\` | Lấy danh sách màn hình | \`?moduleId=1&q=search\` | 200 OK: \`Screen[]\` |
| POST | \`/api/docs/screens\` | Tạo màn hình mới | \`{ moduleId, title, raw_content }\` | 201 Created: \`Screen\` |
| PUT | \`/api/docs/screens/:id\` | Cập nhật màn hình | \`{ raw_content, status }\` | 200 OK: \`Screen\` |
| DELETE | \`/api/docs/screens/:id\` | Xóa màn hình | None | 200 OK: \`{ message }\` |`
    },
    {
      label: 'Quy tắc nghiệp vụ (Business Rules)',
      content: `### 3. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
- **BR-01 (Quyền hạn)**: Chỉ người dùng có quyền Quản trị hoặc Tác giả mới có thể chỉnh sửa/xóa màn hình này.
- **BR-02 (Ràng buộc dữ liệu)**: Dữ liệu bắt buộc phải được kiểm tra trước khi gửi lên API.
- **BR-03 (Lưu trữ tập trung)**: Mọi thay đổi được lưu tự động xuống cơ sở dữ liệu và đồng bộ vào thư mục disk.`
    }
  ];

  return (
    <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm flex flex-col">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
      />

      {/* Editor Main Toolbar */}
      <div className="border-b border-border bg-muted/40 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 select-none">
        {/* Left Toolbar: Rich Formatting Controls */}
        <div className="flex items-center gap-1 overflow-x-auto sm:overflow-visible scrollbar-thin flex-nowrap max-w-full py-0.5">
          {/* Heading Style Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeadings(!showHeadings)}
              className="p-1.5 px-2 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-accent flex items-center gap-1.5 transition"
              title="Chọn kiểu tiêu đề (Headings)"
            >
              <span>Kiểu chữ</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showHeadings && (
              <div 
                className="absolute left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowHeadings(false)}
              >
                <button
                  type="button"
                  onClick={() => applyHeading('p')}
                  className="w-full text-left px-3.5 py-1.5 text-xs text-foreground hover:bg-accent"
                >
                  Văn bản thường (Normal)
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading('h1')}
                  className="w-full text-left px-3.5 py-1.5 text-base font-extrabold text-foreground hover:bg-accent border-t border-border/50"
                >
                  Tiêu đề 1 (H1)
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading('h2')}
                  className="w-full text-left px-3.5 py-1.5 text-sm font-bold text-foreground hover:bg-accent"
                >
                  Tiêu đề 2 (H2)
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading('h3')}
                  className="w-full text-left px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-accent"
                >
                  Tiêu đề 3 (H3)
                </button>
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-border mx-1" />

          {/* Bold, Italic, Strikethrough */}
          <button
            type="button"
            onClick={() => insertText('**', '**', 'in đậm')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="In đậm (Bold - Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('*', '*', 'in nghiêng')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="In nghiêng (Italic - Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('~~', '~~', 'gạch ngang')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Gạch ngang (Strikethrough)"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-border mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'visual') execVisualCommand('insertUnorderedList');
              else insertBlock('- Mục 1\n- Mục 2');
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Danh sách dấu chấm (Bullet List)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'visual') execVisualCommand('insertOrderedList');
              else insertBlock('1. Bước 1\n2. Bước 2');
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Danh sách đánh số (Numbered List)"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertBlock('- [ ] Công việc cần làm\n- [x] Đã hoàn thành')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Checklist công việc (Task list)"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <span className="w-px h-5 bg-border mx-1" />

          {/* Table Insertion & Table Controls */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={insertVisualTable}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1"
              title="Chèn bảng trực quan (Table)"
            >
              <TableIcon className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold hidden md:inline">Bảng</span>
            </button>

            {/* Quick Table Manipulation for Visual Mode */}
            {viewMode === 'visual' && (
              <div className="flex items-center gap-0.5 ml-1 bg-background border border-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => modifyTable('addRow')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded hover:bg-accent text-foreground transition"
                  title="Thêm hàng mới vào bảng"
                >
                  + Dòng
                </button>
                <button
                  type="button"
                  onClick={() => modifyTable('deleteRow')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded hover:bg-red-500/10 text-red-500 transition"
                  title="Xóa dòng hiện tại"
                >
                  - Dòng
                </button>
                <button
                  type="button"
                  onClick={() => modifyTable('addCol')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded hover:bg-accent text-foreground transition"
                  title="Thêm cột mới vào bảng"
                >
                  + Cột
                </button>
                <button
                  type="button"
                  onClick={() => modifyTable('deleteCol')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded hover:bg-red-500/10 text-red-500 transition"
                  title="Xóa cột hiện tại"
                >
                  - Cột
                </button>
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-border mx-1" />

          {/* Callout Boxes */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCallouts(!showCallouts)}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition ${
                showCallouts ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Chèn hộp ghi chú / Callout"
            >
              <Quote className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Ghi chú</span>
            </button>

            {showCallouts && (
              <div 
                className="absolute left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowCallouts(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!NOTE]\n> Ghi chú thông tin cần nhớ.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                >
                  <Info className="w-4 h-4" />
                  <span>[!NOTE] Ghi chú</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!TIP]\n> Mẹo hay hoặc gợi ý thực thi.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>[!TIP] Mẹo hay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!WARNING]\n> Cảnh báo nghiệp vụ hoặc nguy cơ lỗi.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>[!WARNING] Cảnh báo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!IMPORTANT]\n> Quy tắc nghiệp vụ bắt buộc tuân thủ.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-500/10 text-red-600 dark:text-red-400"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>[!IMPORTANT] Quan trọng</span>
                </button>
              </div>
            )}
          </div>

          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition flex items-center gap-1 disabled:opacity-50"
            title="Tải ảnh lên hoặc dán ảnh (Ctrl+V)"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="text-[11px] font-bold hidden sm:inline text-foreground">Chèn ảnh</span>
          </button>

          {/* Link */}
          <button
            type="button"
            onClick={() => {
              const url = prompt('Nhập đường dẫn liên kết (URL):', 'https://');
              if (url) {
                if (viewMode === 'visual') {
                  execVisualCommand('createLink', url);
                } else {
                  insertText('[', `](${url})`, 'văn bản liên kết');
                }
              }
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Chèn liên kết (Link)"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {/* Template Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold transition border ${
                showTemplates
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-accent'
              }`}
              title="Chèn các mẫu đặc tả có sẵn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Mẫu Snippet</span>
            </button>

            {showTemplates && (
              <div 
                className="absolute right-0 left-auto sm:left-0 sm:right-auto max-w-[calc(100vw-2rem)] mt-2 w-64 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowTemplates(false)}
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/60">
                  Mẫu tài liệu đặc tả chuẩn
                </div>
                {templates.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      insertBlock(tpl.content);
                      setShowTemplates(false);
                      toast.success(`Đã chèn "${tpl.label}"`);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-accent hover:text-primary transition flex items-center justify-between"
                  >
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar: View Mode Switcher (WYSIWYG vs Raw Markdown vs Split) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-background border border-border rounded-xl p-0.5 flex items-center text-xs">
            {/* Visual (WYSIWYG) Mode */}
            <button
              type="button"
              onClick={() => handleSwitchMode('visual')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === 'visual'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chế độ Soạn thảo trực quan dễ dùng (như Word/Notion) - Khuyên dùng cho người dùng không rành code"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Trực quan (WYSIWYG)</span>
            </button>

            {/* Split Mode */}
            <button
              type="button"
              onClick={() => handleSwitchMode('split')}
              className={`hidden md:flex px-2.5 py-1.5 rounded-lg font-semibold items-center gap-1 transition ${
                viewMode === 'split'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chia đôi màn hình: Mã Markdown bên trái & Xem trước bên phải"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Song song</span>
            </button>

            {/* Raw Markdown Mode */}
            <button
              type="button"
              onClick={() => handleSwitchMode('edit')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                viewMode === 'edit'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chế độ Mã nguồn Markdown (.md thuần túy)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mã .md</span>
            </button>

            {/* Preview Mode */}
            <button
              type="button"
              onClick={() => handleSwitchMode('preview')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                viewMode === 'preview'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chỉ xem kết quả tài liệu"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xem trước</span>
            </button>
          </div>

          {/* Quick Save Button if onSave provided */}
          {onSave && (
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'visual' && visualRef.current) {
                  const html = visualRef.current.innerHTML;
                  const newMd = htmlToMarkdown(html);
                  onChange(newMd);
                }
                onSave();
              }}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              title="Lưu tài liệu (Ctrl+S)"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div 
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{ minHeight }}
      >
        {/* 1. VISUAL WYSIWYG EDITOR PANE (Default mode for no-tech users) */}
        {viewMode === 'visual' && (
          <div 
            ref={visualContainerRef}
            onScroll={() => {
              if (hoveredImage) updateImageRect(hoveredImage);
            }}
            className="flex-1 flex flex-col bg-background relative overflow-y-auto"
          >
            <div
              ref={visualRef}
              contentEditable
              onInput={handleVisualInput}
              onBlur={handleVisualInput}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onMouseMove={handleVisualMouseMove}
              onMouseLeave={handleVisualMouseLeave}
              onClick={handleVisualClick}
              className="w-full flex-1 p-5 sm:p-7 outline-none overflow-y-auto leading-relaxed text-foreground font-sans prose prose-slate dark:prose-invert max-w-none scrollbar-thin select-text min-h-[480px]"
              style={{ minHeight }}
            />

            {/* Floating Overlay for Hovered/Resizing Image */}
            {hoveredImageRect && hoveredImage && (
              <div 
                className="absolute pointer-events-none z-30 transition-all duration-75"
                style={{
                  top: hoveredImageRect.top,
                  left: hoveredImageRect.left,
                  width: hoveredImageRect.width,
                  height: hoveredImageRect.height,
                }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={handleVisualMouseLeave}
              >
                {/* Border outline on image */}
                <div className="absolute inset-0 border-2 border-primary/70 rounded-xl pointer-events-none ring-2 ring-primary/20" />

                {/* Top Action & Resize Toolbar */}
                <div 
                  className="absolute left-0 -top-11 flex items-center gap-1 bg-neutral-900/95 text-white border border-neutral-700/90 rounded-xl shadow-xl px-2 py-1 pointer-events-auto backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  }}
                >
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider px-1">
                    Resize:
                  </span>
                  {[
                    { label: '25%', val: 25 },
                    { label: '50%', val: 50 },
                    { label: '75%', val: 75 },
                    { label: '100%', val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleApplyPresetWidth(preset.val)}
                      className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-neutral-800 hover:bg-primary hover:text-white transition"
                      title={`Đặt kích thước ${preset.label}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleApplyPresetWidth('800px')}
                    className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-neutral-800 hover:bg-primary hover:text-white transition"
                    title="Đặt chiều rộng chuẩn 800px"
                  >
                    800px
                  </button>

                  <span className="w-px h-4 bg-neutral-700 mx-1" />

                  {/* Sliders / Configuration button */}
                  <button
                    type="button"
                    onClick={() => {
                      const initialW = parseInt(hoveredImage.getAttribute('width') || hoveredImage.style.width || '') || hoveredImage.naturalWidth || Math.round(hoveredImage.offsetWidth);
                      const initialH = hoveredImage.naturalHeight || Math.round(hoveredImage.offsetHeight);
                      setEditorModalImage({
                        url: hoveredImage.getAttribute('data-doc-src') || hoveredImage.src,
                        alt: hoveredImage.alt || 'Hình ảnh',
                        initialWidth: initialW,
                        initialHeight: initialH,
                        targetElement: hoveredImage,
                      });
                    }}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                    title="Cấu hình chi tiết (Xoay, lật, nén chất lượng, kích thước px)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Cấu hình</span>
                  </button>

                  {/* Delete image button */}
                  <button
                    type="button"
                    onClick={handleDeleteHoveredImage}
                    className="p-1 rounded hover:bg-red-500/20 text-neutral-300 hover:text-red-400 transition"
                    title="Xóa ảnh này khỏi tài liệu và máy chủ"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>

                {/* Bottom-right Drag handle to resize interactively */}
                <div
                  onMouseDown={handleStartDragResize}
                  className="absolute -right-2 -bottom-2 w-5 h-5 bg-primary border-2 border-white rounded-full shadow-lg cursor-se-resize flex items-center justify-center hover:scale-125 transition-transform pointer-events-auto select-none"
                  title="Nhấn và kéo chuột để thay đổi kích thước ảnh trực tiếp"
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>

                {/* Current width badge while dragging */}
                {dragCurrentWidth && (
                  <div className="absolute right-0 -bottom-8 bg-black/80 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md pointer-events-none shadow">
                    {dragCurrentWidth}px
                  </div>
                )}
              </div>
            )}

            {/* Bottom Status bar for Visual mode */}
            <div className="py-1 px-4 border-t border-border/50 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Chế độ Soạn thảo Trực quan (WYSIWYG) • Rê chuột vào ảnh để chỉnh kích thước nhanh hoặc bấm vào ảnh để cấu hình chi tiết</span>
              </span>
              <span className="font-mono shrink-0 ml-2">
                {value.length} ký tự
              </span>
            </div>
          </div>
        )}

        {/* 2. SPLIT / CODE / PREVIEW PANES */}
        {viewMode !== 'visual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1">
            {/* Editor Textarea Pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className={`relative flex flex-col ${viewMode === 'edit' ? 'col-span-full' : ''}`}>
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  placeholder={placeholder}
                  className="w-full flex-1 p-4 sm:p-5 bg-background text-foreground font-mono text-xs sm:text-sm resize-none focus:outline-none scrollbar-thin leading-relaxed"
                  style={{ minHeight }}
                />

                <div className="py-1 px-4 border-t border-border/50 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Kéo thả ảnh hoặc dán ảnh (Ctrl+V) • Lưu nhanh bằng <kbd className="font-mono bg-accent px-1 rounded">Ctrl+S</kbd></span>
                  <span className="font-mono shrink-0 ml-2">{value.length} ký tự</span>
                </div>
              </div>
            )}

            {/* Live Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={`p-4 sm:p-6 bg-card min-w-0 overflow-x-hidden overflow-y-auto scrollbar-thin ${viewMode === 'preview' ? 'col-span-full' : ''}`}>
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between pb-2 border-b border-border/60">
                  <span>Xem trước trực quan (Live Preview)</span>
                  <span className="text-[10px] text-emerald-500 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                {value.trim() ? (
                  <MarkdownRenderer content={value} />
                ) : (
                  <div className="py-16 text-center text-muted-foreground text-xs italic">
                    Nội dung xem trước sẽ hiển thị ở đây khi bạn bắt đầu gõ...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Customization / Resize Modal (Opened when clicking on image or clicking Sliders icon) */}
      {editorModalImage && (
        <ImageResizeModal
          isOpen={Boolean(editorModalImage)}
          file={editorModalImage.file || null}
          imageUrl={editorModalImage.url}
          imageAlt={editorModalImage.alt}
          initialWidth={editorModalImage.initialWidth}
          initialHeight={editorModalImage.initialHeight}
          onClose={() => setEditorModalImage(null)}
          onConfirm={handleConfirmModalResize}
        />
      )}
    </div>
  );
};
