import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { 
  AlertTriangle, 
  Info, 
  ShieldAlert, 
  Copy, 
  Check, 
  ExternalLink, 
  ImageOff,
  Sparkles
} from 'lucide-react';
import { slugifyHeading } from '../../docs/components/MarkdownRenderer';

interface MarkdownPreviewRendererProps {
  content: string;
}

function getHeadingText(children: any): string {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getHeadingText).join('');
  if (typeof children === 'object' && children.props?.children) {
    return getHeadingText(children.props.children);
  }
  return String(children);
}

// Subcomponent for Markdown Image with fallback on error
const SafeMarkdownImage: React.FC<{
  src?: string;
  alt?: string;
  [key: string]: any;
}> = ({ src, alt, ...props }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <span className="my-4 inline-flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-red-500/30 bg-red-500/5 text-xs text-red-600 dark:text-red-400">
        <ImageOff className="w-4 h-4 shrink-0 text-red-500" />
        <span>
          <strong>Không tải được hình ảnh:</strong> {alt || src || 'Đường dẫn không hợp lệ'}
        </span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Hình ảnh tài liệu'}
      onError={() => setHasError(true)}
      loading="lazy"
      className="rounded-xl border border-border shadow-sm max-w-full h-auto my-4 object-contain inline-block"
      {...props}
    />
  );
};

export const MarkdownPreviewRenderer: React.FC<MarkdownPreviewRendererProps> = ({ content }) => {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIndex(id);
    setTimeout(() => {
      setCopiedCodeIndex(null);
    }, 2000);
  };

  // Hỗ trợ đánh dấu highlight kiểu ==text== bằng cách thay thế trước khi parse hoặc thông qua HTML
  const processedContent = React.useMemo(() => {
    if (!content) return '';
    // Chuyển đổi cú pháp ==highlight== thành <mark>highlight</mark>
    return content.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  }, [content]);

  return (
    <div className="markdown-preview-body prose dark:prose-invert max-w-none text-foreground leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] px-6 py-6 select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          h1: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h1 
                id={headingId} 
                className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-6 mb-4 pb-2 border-b border-border text-foreground scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h2 
                id={headingId} 
                className="text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-3.5 pb-1.5 border-b border-border text-foreground scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h3 
                id={headingId} 
                className="text-lg sm:text-xl font-bold mt-5 mb-2.5 text-foreground scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h4 
                id={headingId} 
                className="text-base sm:text-lg font-semibold mt-4 mb-2 text-foreground scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h4>
            );
          },
          h5: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h5 
                id={headingId} 
                className="text-sm sm:text-base font-semibold mt-3.5 mb-1.5 text-foreground scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h5>
            );
          },
          h6: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h6 
                id={headingId} 
                className="text-xs sm:text-sm font-semibold uppercase text-muted-foreground mt-3 mb-1.5 tracking-wider scroll-mt-6 transition-colors duration-500 rounded px-1" 
                {...props}
              >
                {children}
              </h6>
            );
          },
          p: ({ node, ...props }) => (
            <p className="my-3 text-sm sm:text-[14.5px] leading-relaxed text-foreground/90" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          del: ({ node, ...props }) => (
            <del className="line-through text-muted-foreground/80" {...props} />
          ),
          mark: ({ node, ...props }) => (
            <mark className="bg-amber-200 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-border" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 text-sm sm:text-[14.5px] pl-2 text-foreground/90" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 text-sm sm:text-[14.5px] pl-2 text-foreground/90" {...props} />
          ),
          li: ({ node, children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          input: ({ node, type, ...props }: any) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  disabled
                  className="rounded border-border text-primary focus:ring-0 mr-2 align-middle cursor-default pointer-events-none w-4 h-4"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          blockquote: ({ node, children, ...props }) => {
            const rawChildrenText = React.Children.toArray(children)
              .map(c => (typeof c === 'string' ? c : (c as any)?.props?.children))
              .join(' ');

            if (rawChildrenText.includes('[!WARNING]') || rawChildrenText.includes('[!CAUTION]')) {
              return (
                <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200 shadow-sm">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Lưu ý / Cảnh báo (Warning)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6">{children}</div>
                </div>
              );
            }

            if (rawChildrenText.includes('[!IMPORTANT]') || rawChildrenText.includes('[!CRITICAL]')) {
              return (
                <div className="my-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-800 dark:text-red-200 shadow-sm">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Quan trọng (Important)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6">{children}</div>
                </div>
              );
            }

            if (rawChildrenText.includes('[!TIP]')) {
              return (
                <div className="my-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200 shadow-sm">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Mẹo hữu ích (Tip)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6">{children}</div>
                </div>
              );
            }

            if (rawChildrenText.includes('[!NOTE]')) {
              return (
                <div className="my-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Ghi chú bổ sung (Note)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6">{children}</div>
                </div>
              );
            }

            return (
              <blockquote
                className="border-l-4 border-primary/70 pl-4 py-2 italic my-4 text-muted-foreground bg-muted/30 rounded-r-xl"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-5 rounded-xl border border-border bg-card shadow-sm scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse min-w-[500px]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/80 border-b border-border text-foreground font-semibold" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-xs font-bold text-foreground/90 whitespace-nowrap uppercase tracking-wider" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border/60" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/40 transition-colors even:bg-muted/15" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-sm leading-relaxed" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 break-all"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          img: ({ node, ...props }: any) => (
            <SafeMarkdownImage {...props} />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const blockId = `code_${codeString.slice(0, 20)}_${codeString.length}`;

            if (!inline && (match || codeString.includes('\n'))) {
              const lang = match ? match[1] : 'text';
              const isCopied = copiedCodeIndex === blockId;

              return (
                <div className="relative my-4 rounded-xl overflow-hidden border border-border group bg-neutral-950 shadow-md">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400">
                    <span className="font-mono uppercase font-semibold text-neutral-300 tracking-wider">
                      {lang}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(codeString, blockId)}
                      className="flex items-center gap-1.5 hover:text-white transition-all px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300"
                      title="Sao chép khối mã"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Đã sao chép ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs sm:text-[13px] font-mono leading-relaxed scrollbar-thin text-neutral-200">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded-md text-xs sm:text-[13px] font-mono text-primary font-semibold break-all"
                {...props}
              >
                {children}
              </code>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
