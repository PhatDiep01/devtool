import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Link as LinkIcon, 
  Table as TableIcon,
  HelpCircle
} from 'lucide-react';

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSaveShortcut?: () => void;
  editorRef?: React.RefObject<HTMLTextAreaElement>;
  onScroll?: (e: React.UIEvent<HTMLTextAreaElement>) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  onSaveShortcut,
  editorRef: externalRef,
  onScroll: externalOnScroll
}) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;
  const gutterRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Tính số lượng dòng
  const linesCount = Math.max(content.split('\n').length, 1);
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1);

  // Sync scroll giữa textarea và line numbers gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    if (externalOnScroll) {
      externalOnScroll(e);
    }
  };

  // Helper chèn cú pháp markdown tại vị trí con trỏ hoặc wrap bôi đen
  const insertSyntax = useCallback((prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end);

    const replacement = selectedText 
      ? `${prefix}${selectedText}${suffix}`
      : `${prefix}${defaultPlaceholder}${suffix}`;

    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    onChange(nextVal);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        const cursorPosition = start + prefix.length + (defaultPlaceholder ? defaultPlaceholder.length : 0);
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  }, [onChange, textareaRef]);

  // Insert Table template
  const insertTableTemplate = useCallback(() => {
    const template = `\n| Cột 1 | Cột 2 | Cột 3 |\n| :--- | :---: | ---: |\n| Dữ liệu A | Dữ liệu B | Dữ liệu C |\n| Dữ liệu 1 | Dữ liệu 2 | Dữ liệu 3 |\n`;
    insertSyntax('', template, '');
  }, [insertSyntax]);

  // Handle keyboard shortcuts inside editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key: indent with 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;

      const nextVal = currentVal.substring(0, start) + '  ' + currentVal.substring(end);
      onChange(nextVal);

      setTimeout(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }

    // Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (onSaveShortcut) {
        onSaveShortcut();
      }
      return;
    }

    // Ctrl+B: Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertSyntax('**', '**', 'chữ đậm');
      return;
    }

    // Ctrl+I: Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertSyntax('*', '*', 'chữ nghiêng');
      return;
    }

    // Ctrl+K: Link
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertSyntax('[', '](https://example.com)', 'tiêu đề liên kết');
      return;
    }
  };

  const toolbarButtons = [
    {
      title: 'Chữ đậm (Ctrl+B)',
      icon: Bold,
      action: () => insertSyntax('**', '**', 'chữ đậm')
    },
    {
      title: 'Chữ nghiêng (Ctrl+I)',
      icon: Italic,
      action: () => insertSyntax('*', '*', 'chữ nghiêng')
    },
    {
      title: 'Gạch ngang',
      icon: Strikethrough,
      action: () => insertSyntax('~~', '~~', 'chữ gạch ngang')
    },
    {
      title: 'Tiêu đề cấp 2 (Heading)',
      icon: Heading,
      action: () => insertSyntax('## ', '', 'Tiêu đề')
    },
    {
      title: 'Danh sách không thứ tự',
      icon: List,
      action: () => insertSyntax('- ', '', 'Mục danh sách')
    },
    {
      title: 'Danh sách đánh số',
      icon: ListOrdered,
      action: () => insertSyntax('1. ', '', 'Mục có thứ tự')
    },
    {
      title: 'Checklist công việc',
      icon: CheckSquare,
      action: () => insertSyntax('- [ ] ', '', 'Công việc cần làm')
    },
    {
      title: 'Hộp trích dẫn (Blockquote)',
      icon: Quote,
      action: () => insertSyntax('> ', '', 'Trích dẫn quan trọng')
    },
    {
      title: 'Khối mã (Code Block)',
      icon: Code,
      action: () => insertSyntax('```typescript\n', '\n```', '// Nhập mã nguồn vào đây')
    },
    {
      title: 'Chèn liên kết (Ctrl+K)',
      icon: LinkIcon,
      action: () => insertSyntax('[', '](https://example.com)', 'tên liên kết')
    },
    {
      title: 'Chèn bảng dữ liệu (Table)',
      icon: TableIcon,
      action: insertTableTemplate
    }
  ];

  return (
    <div className={`flex flex-col h-full bg-card border rounded-xl overflow-hidden transition-all duration-200 ${
      isFocused ? 'ring-2 ring-primary/40 border-primary' : 'border-border'
    }`}>
      {/* Quick Formatting Toolbar */}
      <div className="flex items-center flex-wrap gap-1 px-3 py-2 border-b border-border bg-muted/40 text-muted-foreground select-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mr-1.5 hidden sm:inline">
          Định dạng:
        </span>

        {toolbarButtons.map((btn, index) => {
          const Icon = btn.icon;
          return (
            <button
              key={index}
              type="button"
              onClick={btn.action}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-muted active:scale-95 transition-all"
              title={btn.title}
              aria-label={btn.title}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Main Textarea with Line Numbers Gutter */}
      <div className="flex-1 flex overflow-hidden relative bg-card">
        {/* Line Numbers Gutter */}
        <div 
          ref={gutterRef}
          aria-hidden="true"
          className="w-11 sm:w-12 shrink-0 py-4 select-none bg-muted/20 border-r border-border text-right pr-2.5 font-mono text-xs sm:text-[13.5px] leading-[1.6] text-muted-foreground/50 overflow-hidden"
        >
          {lineNumbers.map(num => (
            <div key={num} className="h-[21.6px]">
              {num}
            </div>
          ))}
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={`Nhập hoặc dán nội dung Markdown vào đây...\nVí dụ:\n# Tiêu đề tài liệu\n**Chữ đậm**, *chữ nghiêng*\n- [x] Danh sách công việc\n\`\`\`js\nconsole.log("Hello DevToolkit!");\n\`\`\``}
          spellCheck={false}
          className="flex-1 w-full h-full p-4 resize-none bg-transparent font-mono text-xs sm:text-[13.5px] leading-[1.6] text-foreground focus:outline-none placeholder:text-muted-foreground/45 scrollbar-thin"
        />
      </div>
    </div>
  );
};
