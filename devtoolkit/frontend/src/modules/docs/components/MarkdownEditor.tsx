import React, { 
  useState, 
  useRef, 
  useEffect, 
  useCallback, 
  useImperativeHandle, 
  forwardRef 
} from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading,
  Heading1, 
  Heading2, 
  Heading3, 
  Heading4,
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
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  AlignLeft,
  Sliders,
  Terminal,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { filesApi, resolveApiUrl } from '../../../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatMarkdownTable } from '../../../utils/markdownConverter';
import { ImageResizeModal } from './ImageResizeModal';

export interface MarkdownEditorRef {
  insertTextAtCursor: (text: string) => void;
  focus: () => void;
  getValue: () => string;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
  minHeight?: string;
  placeholder?: string;
  onUploadImage?: (file: File) => Promise<string>;
  onDeleteImage?: (imageSrc: string) => void;
}

interface HistoryItem {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(({
  value,
  onChange,
  onSave,
  isSaving = false,
  minHeight = '550px',
  placeholder = 'Nhập nội dung đặc tả tại đây (hỗ trợ đầy đủ GitHub Flavored Markdown)...',
  onUploadImage,
  onDeleteImage,
}, ref) => {
  // Default to 'split' (Split View: Markdown left, Live Preview right) for modern & smooth editing experience
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Dropdown states
  const [showHeadings, setShowHeadings] = useState(false);
  const [showCallouts, setShowCallouts] = useState(false);
  const [showCodeBlocks, setShowCodeBlocks] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Table creator state
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // Image customizer modal state
  const [resizeImageState, setResizeImageState] = useState<{
    file: File | null;
    url?: string;
    alt?: string;
    targetWidth?: number;
  } | null>(null);

  // Cursor position indicators
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSyncingScrollRef = useRef(false);

  // Undo / Redo history
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isPerformingHistoryActionRef = useRef<boolean>(false);
  const debounceHistoryTimerRef = useRef<any>(null);

  // Initialize history
  useEffect(() => {
    if (historyRef.current.length === 0 && value !== undefined) {
      historyRef.current = [{
        value,
        selectionStart: 0,
        selectionEnd: 0
      }];
      historyIndexRef.current = 0;
    }
  }, []);

  // Update history on changes
  const recordHistory = useCallback((newValue: string, selStart?: number, selEnd?: number) => {
    if (isPerformingHistoryActionRef.current) return;

    if (debounceHistoryTimerRef.current) {
      clearTimeout(debounceHistoryTimerRef.current);
    }

    debounceHistoryTimerRef.current = setTimeout(() => {
      const curStart = selStart !== undefined ? selStart : (textareaRef.current?.selectionStart || 0);
      const curEnd = selEnd !== undefined ? selEnd : (textareaRef.current?.selectionEnd || 0);

      // Truncate future branch if user edits after undo
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      
      // Only push if different from current top
      const top = newHistory[newHistory.length - 1];
      if (!top || top.value !== newValue) {
        newHistory.push({
          value: newValue,
          selectionStart: curStart,
          selectionEnd: curEnd
        });
        if (newHistory.length > 60) newHistory.shift(); // Limit to 60 snapshots
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
      }
    }, 350);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isPerformingHistoryActionRef.current = true;
      historyIndexRef.current--;
      const snapshot = historyRef.current[historyIndexRef.current];
      onChange(snapshot.value);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
        }
        isPerformingHistoryActionRef.current = false;
      }, 10);
    }
  }, [onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isPerformingHistoryActionRef.current = true;
      historyIndexRef.current++;
      const snapshot = historyRef.current[historyIndexRef.current];
      onChange(snapshot.value);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
        }
        isPerformingHistoryActionRef.current = false;
      }, 10);
    }
  }, [onChange]);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    insertTextAtCursor: (text: string) => {
      insertBlock(text);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    getValue: () => value,
  }));

  // Track cursor position for status bar
  const updateCursorPosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1
    });
  };

  // Synchronized scroll between editor and preview
  const handleEditorScroll = () => {
    if (isSyncingScrollRef.current || viewMode !== 'split') return;
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    isSyncingScrollRef.current = true;
    const editorScrollMax = textarea.scrollHeight - textarea.clientHeight;
    if (editorScrollMax > 0) {
      const scrollRatio = textarea.scrollTop / editorScrollMax;
      const previewScrollMax = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = scrollRatio * previewScrollMax;
    }
    setTimeout(() => { isSyncingScrollRef.current = false; }, 50);
  };

  const handlePreviewScroll = () => {
    if (isSyncingScrollRef.current || viewMode !== 'split') return;
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    isSyncingScrollRef.current = true;
    const previewScrollMax = preview.scrollHeight - preview.clientHeight;
    if (previewScrollMax > 0) {
      const scrollRatio = preview.scrollTop / previewScrollMax;
      const editorScrollMax = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = scrollRatio * editorScrollMax;
    }
    setTimeout(() => { isSyncingScrollRef.current = false; }, 50);
  };

  // Insert or wrap text around selection
  const insertText = useCallback((prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);
    recordHistory(newValue, start + prefix.length, start + prefix.length + selectedText.length);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
      updateCursorPosition();
    }, 10);
  }, [value, onChange, recordHistory]);

  // Insert a full block of markdown at current line/cursor
  const insertBlock = useCallback((textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      // Fallback: append
      const newValue = value ? `${value.trim()}\n\n${textToInsert}\n` : `${textToInsert}\n`;
      onChange(newValue);
      recordHistory(newValue);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Ensure clean separation with empty lines
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : (start > 1 && value[start - 2] !== '\n' ? '\n' : '');
    const suffix = end < value.length && value[end] !== '\n' ? '\n\n' : '\n';
    
    const replacement = `${prefix}${textToInsert}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);
    const newCursor = start + prefix.length + textToInsert.length;
    recordHistory(newValue, newCursor, newCursor);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
      updateCursorPosition();
    }, 10);
  }, [value, onChange, recordHistory]);

  // Apply or toggle Heading on current line
  const applyHeading = (level: 1 | 2 | 3 | 4 | 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = value.split('\n');
    
    // Find current line index
    let currentLineIndex = 0;
    let accumulatedLength = 0;
    for (let i = 0; i < lines.length; i++) {
      accumulatedLength += lines[i].length + 1;
      if (start < accumulatedLength) {
        currentLineIndex = i;
        break;
      }
    }

    const currentLine = lines[currentLineIndex];
    // Strip existing markdown heading markers
    const cleanLine = currentLine.replace(/^#{1,6}\s+/, '');
    
    let newLine = cleanLine;
    if (level > 0) {
      newLine = `${'#'.repeat(level)} ${cleanLine}`;
    }

    lines[currentLineIndex] = newLine;
    const newValue = lines.join('\n');
    onChange(newValue);
    recordHistory(newValue);
    setShowHeadings(false);

    setTimeout(() => {
      textarea.focus();
      updateCursorPosition();
    }, 10);
  };

  // Apply Code Block
  const applyCodeBlock = (lang: string = 'sql') => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;
    const selected = value.substring(start, end);
    const snippet = `\`\`\`${lang}\n${selected || '-- Nhập mã hoặc truy vấn tại đây\n'}\`\`\``;
    insertBlock(snippet);
    setShowCodeBlocks(false);
  };

  // Insert Table generator
  const handleInsertTable = () => {
    const rows = Math.max(1, Math.min(20, tableRows));
    const cols = Math.max(1, Math.min(10, tableCols));

    const header = '| ' + Array.from({ length: cols }, (_, i) => `Cột ${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const bodyRows = Array.from({ length: rows }, (_, r) => 
      '| ' + Array.from({ length: cols }, (_, c) => `Giá trị ${r + 1}.${c + 1}`).join(' | ') + ' |'
    );

    const tableMd = [header, separator, ...bodyRows].join('\n');
    insertBlock(tableMd);
    setShowTableModal(false);
    toast.success(`Đã chèn bảng ${cols} cột x ${rows} dòng`);
  };

  // Format the table near cursor
  const handleBeautifyTable = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = value.split('\n');

    // Find table start and end lines around cursor
    let tableStart = -1;
    let tableEnd = -1;

    let charCount = 0;
    let currentLineIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (start < charCount) {
        currentLineIdx = i;
        break;
      }
    }

    // Check if current line is part of a table
    if (!lines[currentLineIdx]?.includes('|')) {
      toast('Hãy đặt con trỏ vào bảng cần căn chỉnh!', { icon: 'ℹ️' });
      return;
    }

    // Find table boundaries
    for (let i = currentLineIdx; i >= 0; i--) {
      if (lines[i].includes('|')) tableStart = i;
      else break;
    }
    for (let i = currentLineIdx; i < lines.length; i++) {
      if (lines[i].includes('|')) tableEnd = i;
      else break;
    }

    if (tableStart !== -1 && tableEnd !== -1) {
      const tableLines = lines.slice(tableStart, tableEnd + 1);
      const formatted = formatMarkdownTable(tableLines.join('\n'));
      lines.splice(tableStart, tableLines.length, formatted);
      const newValue = lines.join('\n');
      onChange(newValue);
      recordHistory(newValue);
      toast.success('Đã căn lề các cột bảng thẳng tắp!');
    }
  };

  // Add row to current table
  const handleAddTableRow = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = value.split('\n');

    let currentLineIdx = 0;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (start < charCount) {
        currentLineIdx = i;
        break;
      }
    }

    if (!lines[currentLineIdx]?.includes('|')) {
      toast('Hãy đặt con trỏ vào bảng cần thêm dòng', { icon: 'ℹ️' });
      return;
    }

    // Count columns in current row
    const cells = lines[currentLineIdx].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    const colCount = Math.max(1, cells.length);
    const newRow = '| ' + new Array(colCount).fill('Dữ liệu mới').join(' | ') + ' |';

    lines.splice(currentLineIdx + 1, 0, newRow);
    const newValue = lines.join('\n');
    onChange(newValue);
    recordHistory(newValue);
    toast.success('Đã thêm 1 dòng mới vào bảng!');
  };

  // Image Upload & Insertion
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
          toast.success('Tải ảnh thành công!', { id: toastId });
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Tải ảnh thất bại', { id: toastId });
          throw err;
        }
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const markdownTag = `![${cleanName}](${imageUrl})`;
      insertBlock(markdownTag);
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

  // Drag and drop image
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

  // Keyboard Shortcuts & Smart Typing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Save: Ctrl + S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (onSave) onSave();
      return;
    }

    // Undo: Ctrl + Z
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Redo: Ctrl + Y or Ctrl + Shift + Z
    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Bold: Ctrl + B
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertText('**', '**', 'văn bản in đậm');
      return;
    }

    // Italic: Ctrl + I
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertText('*', '*', 'văn bản in nghiêng');
      return;
    }

    // Link: Ctrl + K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const url = prompt('Nhập đường dẫn liên kết (URL):', 'https://');
      if (url) {
        insertText('[', `](${url})`, 'tiêu đề liên kết');
      }
      return;
    }

    // Strikethrough: Ctrl + Shift + X
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      insertText('~~', '~~', 'gạch ngang');
      return;
    }

    // Tab key: Indent / Outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Shift + Tab: Remove 2 leading spaces on current line
        const before = value.substring(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const currentLine = value.substring(lineStart);
        if (currentLine.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + currentLine.substring(2);
          onChange(newValue);
          recordHistory(newValue, Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          setTimeout(() => {
            textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          }, 0);
        }
      } else {
        // Tab: Insert 2 spaces
        const replacement = '  ';
        const newValue = value.substring(0, start) + replacement + value.substring(end);
        onChange(newValue);
        recordHistory(newValue, start + 2, start + 2);
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
      return;
    }

    // Smart Enter in Lists (- item, 1. item, - [ ] item)
    if (e.key === 'Enter' && !e.shiftKey) {
      const start = textarea.selectionStart;
      const beforeCursor = value.substring(0, start);
      const lastNewline = beforeCursor.lastIndexOf('\n');
      const currentLine = beforeCursor.substring(lastNewline + 1);

      // Check task list: "- [ ] " or "- [x] "
      const taskMatch = currentLine.match(/^(\s*)-\s\[([ xX])\]\s(.*)$/);
      if (taskMatch) {
        e.preventDefault();
        const indent = taskMatch[1];
        const content = taskMatch[3];
        if (!content.trim()) {
          // If empty task item, pressing enter exits list
          const lineStart = lastNewline + 1;
          const newValue = value.substring(0, lineStart) + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, lineStart, lineStart);
          setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
        } else {
          // Continue task list
          const nextItem = `\n${indent}- [ ] `;
          const newValue = value.substring(0, start) + nextItem + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, start + nextItem.length, start + nextItem.length);
          setTimeout(() => textarea.setSelectionRange(start + nextItem.length, start + nextItem.length), 0);
        }
        return;
      }

      // Check bullet list: "- " or "* "
      const bulletMatch = currentLine.match(/^(\s*)([-*])\s(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const marker = bulletMatch[2];
        const content = bulletMatch[3];
        if (!content.trim()) {
          // Exit list
          const lineStart = lastNewline + 1;
          const newValue = value.substring(0, lineStart) + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, lineStart, lineStart);
          setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
        } else {
          // Continue list
          const nextItem = `\n${indent}${marker} `;
          const newValue = value.substring(0, start) + nextItem + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, start + nextItem.length, start + nextItem.length);
          setTimeout(() => textarea.setSelectionRange(start + nextItem.length, start + nextItem.length), 0);
        }
        return;
      }

      // Check ordered list: "1. "
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (numberMatch) {
        e.preventDefault();
        const indent = numberMatch[1];
        const num = parseInt(numberMatch[2], 10);
        const content = numberMatch[3];
        if (!content.trim()) {
          // Exit list
          const lineStart = lastNewline + 1;
          const newValue = value.substring(0, lineStart) + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, lineStart, lineStart);
          setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
        } else {
          // Continue numbered list
          const nextItem = `\n${indent}${num + 1}. `;
          const newValue = value.substring(0, start) + nextItem + value.substring(start);
          onChange(newValue);
          recordHistory(newValue, start + nextItem.length, start + nextItem.length);
          setTimeout(() => textarea.setSelectionRange(start + nextItem.length, start + nextItem.length), 0);
        }
        return;
      }
    }

    // Auto-wrap selected text with brackets/quotes
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '`': '`',
      '"': '"',
      "'": "'"
    };

    if (pairs[e.key]) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        e.preventDefault();
        const selected = value.substring(start, end);
        const replacement = `${e.key}${selected}${pairs[e.key]}`;
        const newValue = value.substring(0, start) + replacement + value.substring(end);
        onChange(newValue);
        recordHistory(newValue, start + 1, end + 1);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
        return;
      }
    }
  };

  // Snippet templates
  const templates = [
    {
      label: 'Bảng Features & AC chuẩn',
      content: `## 2. TÍNH NĂNG & TIÊU CHÍ NGHIỆM THU (FEATURES & AC)
| Mã | Tính năng | Mô tả chi tiết | Tiêu chí nghiệm thu (AC) | Trạng thái |
|---|---|---|---|---|
| FEAT-01 | Khởi tạo trang | Tải dữ liệu ban đầu cho màn hình | Hiển thị đầy đủ thông tin sau 1s | Hoàn tất |
| FEAT-02 | Tìm kiếm & Lọc | Lọc theo từ khóa tức thì | Phản hồi dưới 300ms, không giật lag | Đang làm |
| FEAT-03 | Xác thực biểu mẫu | Kiểm tra dữ liệu nhập bắt buộc | Báo lỗi chi tiết màu đỏ cạnh ô nhập | Chờ test |`
    },
    {
      label: 'Danh sách RESTful API Endpoints',
      content: `## 4. DANH SÁCH API ENDPOINTS
| Method | Endpoint | Mô tả nghiệp vụ | Query / Request Body | Response chuẩn |
|---|---|---|---|---|
| GET | \`/api/docs/screens\` | Lấy danh sách tài liệu | \`?moduleId=1&q=search\` | 200 OK: \`Screen[]\` |
| POST | \`/api/docs/screens\` | Tạo mới tài liệu đặc tả | \`{ moduleId, title, raw_content }\` | 201 Created: \`Screen\` |
| PUT | \`/api/docs/screens/:id\` | Cập nhật tài liệu | \`{ raw_content, status }\` | 200 OK: \`Screen\` |
| DELETE | \`/api/docs/screens/:id\` | Xóa tài liệu | None | 200 OK: \`{ message }\` |`
    },
    {
      label: 'Quy tắc nghiệp vụ (Business Rules - BR)',
      content: `## 3. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
- **BR-01 (Phân quyền)**: Chỉ người dùng có vai trò Quản trị viên (Admin) hoặc Tác giả mới có quyền chỉnh sửa/xóa tài liệu này.
- **BR-02 (Ràng buộc dữ liệu)**: Mọi trường bắt buộc có dấu (*) phải được kiểm tra hợp lệ trước khi gửi lên máy chủ.
- **BR-03 (Lưu trữ và Đồng bộ)**: Toàn bộ thay đổi được lưu tức thì vào cơ sở dữ liệu SQLite và đồng bộ vào file Markdown trên ổ đĩa.`
    },
    {
      label: 'Cơ sở dữ liệu & ER Schema',
      content: `## 5. CƠ SỞ DỮ LIỆU & ER
\`\`\`sql
-- Bảng lưu trữ thông tin thực thể
CREATE TABLE IF NOT EXISTS example_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\`\`\``
    },
    {
      label: 'Kiểm thử & QA Checklist',
      content: `## 6. KIỂM THỬ & QA
- [ ] Kiểm tra hiển thị responsive trên Mobile (375px), Tablet (768px), Desktop (1440px)
- [ ] Kiểm tra xác thực các trường bắt buộc và thông báo lỗi rõ ràng
- [ ] Kiểm tra hiệu năng tải trang ban đầu dưới 1.5 giây
- [ ] Kiểm tra lưu thành công và cập nhật tức thì vào danh sách`
    },
    {
      label: 'Ghi chú kỹ thuật bàn giao (Handover)',
      content: `## 7. GHI CHÚ BÀN GIAO KỸ THUẬT
> [!NOTE]
> Developer tiếp nhận cần kiểm tra cấu hình biến môi trường trước khi chạy ứng dụng.
> Liên hệ đội BA/Lead Dev nếu có thay đổi về luồng nghiệp vụ trên.`
    }
  ];

  // Character, word and line counters
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lineCount = value.split('\n').length;

  return (
    <div className={`border border-border rounded-2xl bg-card overflow-hidden shadow-sm flex flex-col transition-all duration-200 ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : ''
    }`}>
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
      />

      {/* STICKY MAIN TOOLBAR */}
      <div className="sticky top-0 z-20 border-b border-border bg-muted/70 backdrop-blur-md p-2 flex flex-wrap items-center justify-between gap-1.5 select-none">
        {/* Left Toolbar: Text Formatting & Tools */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-0.5 max-w-full">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={handleUndo}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Hoàn tác (Undo - Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Làm lại (Redo - Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-border mx-0.5" />

          {/* Heading Style Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeadings(!showHeadings)}
              className="px-2 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-accent flex items-center gap-1.5 transition shadow-2xs"
              title="Chọn kiểu tiêu đề (H1, H2, H3, H4)"
            >
              <Heading className="w-3.5 h-3.5 text-primary" />
              <span>Tiêu đề</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showHeadings && (
              <div 
                className="absolute left-0 mt-1.5 w-44 bg-card border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowHeadings(false)}
              >
                <button
                  type="button"
                  onClick={() => applyHeading(0)}
                  className="w-full text-left px-3.5 py-1.5 text-xs text-foreground hover:bg-accent"
                >
                  Văn bản thường (Normal)
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(1)}
                  className="w-full text-left px-3.5 py-1.5 text-sm font-extrabold text-foreground hover:bg-accent border-t border-border/50 flex items-center justify-between"
                >
                  <span>Tiêu đề H1</span>
                  <span className="text-[10px] text-muted-foreground font-mono">#</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(2)}
                  className="w-full text-left px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-accent flex items-center justify-between"
                >
                  <span>Tiêu đề H2</span>
                  <span className="text-[10px] text-muted-foreground font-mono">##</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(3)}
                  className="w-full text-left px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent flex items-center justify-between"
                >
                  <span>Tiêu đề H3</span>
                  <span className="text-[10px] text-muted-foreground font-mono">###</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(4)}
                  className="w-full text-left px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent flex items-center justify-between"
                >
                  <span>Tiêu đề H4</span>
                  <span className="text-[10px] text-muted-foreground font-mono">####</span>
                </button>
              </div>
            )}
          </div>

          {/* Bold, Italic, Strikethrough, Inline Code */}
          <button
            type="button"
            onClick={() => insertText('**', '**', 'văn bản in đậm')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="In đậm (Bold - Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('*', '*', 'văn bản in nghiêng')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="In nghiêng (Italic - Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('~~', '~~', 'gạch ngang')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Gạch ngang (Strikethrough - Ctrl+Shift+X)"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('`', '`', 'mã_inline')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Mã inline (Code snippet)"
          >
            <Code className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-border mx-0.5" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => insertBlock('- Mục danh sách 1\n- Mục danh sách 2')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Danh sách dấu chấm (Bullet List)"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertBlock('1. Bước 1\n2. Bước 2')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Danh sách số thứ tự (Numbered List)"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertBlock('- [ ] Công việc cần làm\n- [x] Đã hoàn tất')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Checklist công việc / AC (Task List)"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          <span className="w-px h-4 bg-border mx-0.5" />

          {/* Table Tools Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTableModal(!showTableModal)}
              className="px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1"
              title="Chèn & Quản lý bảng Markdown (Table)"
            >
              <TableIcon className="w-4 h-4 text-blue-500" />
              <span className="hidden md:inline">Bảng</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showTableModal && (
              <div 
                className="absolute left-0 mt-1.5 w-60 bg-card border border-border rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 space-y-2.5"
                onMouseLeave={() => setShowTableModal(false)}
              >
                <div className="text-[11px] font-bold text-foreground border-b border-border/60 pb-1 flex items-center justify-between">
                  <span>Chèn bảng Markdown</span>
                  <TableIcon className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Số cột</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={tableCols} 
                      onChange={(e) => setTableCols(Number(e.target.value))} 
                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Số hàng</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      value={tableRows} 
                      onChange={(e) => setTableRows(Number(e.target.value))} 
                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs" 
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInsertTable}
                  className="w-full py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition shadow-2xs"
                >
                  Tạo bảng mới
                </button>
                <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleAddTableRow();
                      setShowTableModal(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent rounded flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3 text-emerald-500" />
                    <span>Thêm 1 hàng tại con trỏ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleBeautifyTable();
                      setShowTableModal(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent rounded flex items-center gap-1.5"
                  >
                    <AlignLeft className="w-3 h-3 text-blue-500" />
                    <span>Làm đẹp / Căn thẳng hàng cột</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Callout Alerts Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCallouts(!showCallouts)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1 text-xs"
              title="Chèn hộp ghi chú / Callout GitHub chuẩn"
            >
              <Quote className="w-4 h-4 text-amber-500" />
              <span className="hidden lg:inline text-[11px] font-medium">Ghi chú</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showCallouts && (
              <div 
                className="absolute left-0 mt-1.5 w-52 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowCallouts(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!NOTE]\n> Ghi chú thông tin nghiệp vụ cần nhớ.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>[!NOTE] Ghi chú</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!TIP]\n> Mẹo hay hoặc đề xuất tối ưu.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>[!TIP] Mẹo hay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!WARNING]\n> Cảnh báo rủi ro hoặc nghiệp vụ quan trọng.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>[!WARNING] Cảnh báo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    insertBlock('> [!IMPORTANT]\n> Quy tắc nghiệp vụ bắt buộc tuân thủ.');
                    setShowCallouts(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>[!IMPORTANT] Bắt buộc</span>
                </button>
              </div>
            )}
          </div>

          {/* Code Block Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCodeBlocks(!showCodeBlocks)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1 text-xs"
              title="Chèn khối mã (Code Block) có Highlight cú pháp"
            >
              <Terminal className="w-4 h-4 text-purple-500" />
              <span className="hidden lg:inline text-[11px] font-medium">Khối Code</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showCodeBlocks && (
              <div 
                className="absolute left-0 mt-1.5 w-48 bg-card border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowCodeBlocks(false)}
              >
                {[
                  { label: 'SQL (Query & DDL)', val: 'sql' },
                  { label: 'TypeScript / JS', val: 'typescript' },
                  { label: 'JSON Data', val: 'json' },
                  { label: 'Bash / Shell', val: 'bash' },
                  { label: 'C# / .NET', val: 'csharp' },
                  { label: 'Sơ đồ Mermaid', val: 'mermaid' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => applyCodeBlock(item.val)}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent font-mono flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
            title="Chèn ảnh vào vị trí con trỏ (hoặc kéo thả/dán ảnh Ctrl+V)"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ImageIcon className="w-4 h-4 text-emerald-500" />
            )}
            <span className="hidden sm:inline text-[11px] text-foreground font-bold">Chèn ảnh</span>
          </button>

          {/* Link */}
          <button
            type="button"
            onClick={() => {
              const url = prompt('Nhập đường dẫn liên kết (URL):', 'https://');
              if (url) {
                insertText('[', `](${url})`, 'liên kết');
              }
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Chèn liên kết (Ctrl+K)"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {/* Snippets / Handover Templates */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-2 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-accent flex items-center gap-1.5 transition shadow-2xs"
              title="Chèn mẫu đặc tả & AC có sẵn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Mẫu Snippet</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showTemplates && (
              <div 
                className="absolute right-0 left-auto sm:left-0 sm:right-auto max-w-[calc(100vw-2rem)] mt-1.5 w-64 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95"
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
                    className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-accent hover:text-primary transition flex items-center justify-between"
                  >
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar: View Mode Switcher, Fullscreen & Save */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode Switcher */}
          <div className="bg-background border border-border rounded-xl p-0.5 flex items-center text-xs">
            {/* Split Mode (Recommended default) */}
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                viewMode === 'split'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chế độ Song song: Viết bên trái & Xem trước trực quan bên phải"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Song song</span>
            </button>

            {/* Edit Only */}
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                viewMode === 'edit'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chế độ Toàn màn hình soạn thảo Markdown"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Soạn thảo</span>
            </button>

            {/* Preview Only */}
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                viewMode === 'preview'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Chế độ Xem trước kết quả tài liệu"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước</span>
            </button>
          </div>

          {/* Fullscreen / Zen Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition shadow-2xs"
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Save Button */}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 disabled:opacity-50 hover:bg-primary/90"
              title="Lưu tài liệu (Ctrl+S)"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Lưu...' : 'Lưu'}</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN EDITOR CONTENT BODY */}
      <div 
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{ minHeight: isFullscreen ? 'calc(100vh - 85px)' : minHeight }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1 h-full">
          {/* EDITOR TEXTAREA PANE */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`relative flex flex-col h-full bg-background ${viewMode === 'edit' ? 'col-span-full' : ''}`}>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  recordHistory(e.target.value);
                  updateCursorPosition();
                }}
                onKeyDown={handleKeyDown}
                onClick={updateCursorPosition}
                onKeyUp={updateCursorPosition}
                onDrop={handleDrop}
                onPaste={handlePaste}
                onScroll={handleEditorScroll}
                placeholder={placeholder}
                className="w-full flex-1 p-4 sm:p-6 bg-background text-foreground font-mono text-xs sm:text-sm resize-none focus:outline-none scrollbar-thin leading-relaxed"
                style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : minHeight }}
                spellCheck={false}
              />
            </div>
          )}

          {/* LIVE PREVIEW PANE */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div 
              ref={previewRef}
              onScroll={handlePreviewScroll}
              className={`p-4 sm:p-6 bg-card min-w-0 overflow-y-auto scrollbar-thin h-full ${
                viewMode === 'preview' ? 'col-span-full' : ''
              }`}
              style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : minHeight }}
            >
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between pb-2 border-b border-border/60">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Xem trước trực quan (Live Preview)</span>
                </span>
                <span className="text-[10px] text-emerald-500 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Đồng bộ tức thời
                </span>
              </div>
              {value.trim() ? (
                <MarkdownRenderer content={value} />
              ) : (
                <div className="py-20 text-center text-muted-foreground text-xs italic space-y-2">
                  <FileText className="w-8 h-8 mx-auto opacity-30" />
                  <p>Nội dung xem trước sẽ tự động hiển thị ở đây khi bạn nhập nội dung đặc tả bên trái...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div className="border-t border-border/70 bg-muted/30 py-1.5 px-4 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="font-medium text-foreground">Markdown Engine sẵn sàng</span>
          </span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="hidden sm:inline font-mono">
            Dòng {cursorPos.line}, Cột {cursorPos.col}
          </span>
          <span className="hidden md:inline text-muted-foreground/40">•</span>
          <span className="hidden md:inline">
            Kéo thả ảnh hoặc dán <kbd className="font-mono bg-accent px-1 rounded text-[10px]">Ctrl+V</kbd> để tải ảnh
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span>{lineCount} dòng</span>
          <span>•</span>
          <span>{wordCount} từ</span>
          <span>•</span>
          <span>{charCount} ký tự</span>
        </div>
      </div>

      {/* Image Resize Modal */}
      {resizeImageState && (
        <ImageResizeModal
          isOpen={Boolean(resizeImageState)}
          file={resizeImageState.file}
          imageUrl={resizeImageState.url}
          imageAlt={resizeImageState.alt}
          initialWidth={resizeImageState.targetWidth}
          onClose={() => setResizeImageState(null)}
          onConfirm={(processedFile, previewUrl, metadata) => {
            const cleanAlt = resizeImageState.alt || 'Hình ảnh';
            const widthTag = `<img src="${previewUrl}" alt="${cleanAlt}" width="${metadata.width}" />`;
            insertBlock(widthTag);
            setResizeImageState(null);
            toast.success(`Đã chèn ảnh kích thước ${metadata.width}px`);
          }}
        />
      )}
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;
