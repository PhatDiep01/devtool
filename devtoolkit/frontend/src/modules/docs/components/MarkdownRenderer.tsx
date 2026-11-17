import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { 
  AlertTriangle, 
  Info, 
  Copy, 
  Check, 
  ShieldAlert, 
  Sparkles,
  ExternalLink,
  ImageOff
} from 'lucide-react';
import { resolveApiUrl } from '../../../services/api';
import { ImageLightboxModal } from './ImageLightboxModal';

interface MarkdownRendererProps {
  content: string;
}

function getHeadingText(children: any): string {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getHeadingText).join('');
  if (typeof children === 'object' && children.props?.children) return getHeadingText(children.props.children);
  return String(children);
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Preprocesses markdown text to fix common paste issues:
 * 1. Normalize \r\n and non-breaking spaces (\u00a0, &nbsp;)
 * 2. Fix bullet list indentation and hyphens
 * 3. Convert ==highlight== syntax to HTML <mark>
 */
function preprocessMarkdown(raw: string): string {
  if (!raw) return '';

  let md = raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ');

  // Fix lines where user typed irregular nested hyphens, e.g. "-   -   - KEY"
  md = md.replace(/^([ \t]*)-\s+-\s+-\s+/gm, '$1    - ');
  md = md.replace(/^([ \t]*)-\s+-\s+/gm, '$1  - ');

  // Support highlight syntax ==text==
  md = md.replace(/==([^=\n]+)==/g, '<mark class="markdown-highlight">$1</mark>');

  return md;
}

/**
 * Strips callout identifier [!TYPE] from blockquote children so it is not displayed twice
 */
function cleanCalloutChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, idx) => {
    if (idx !== 0 || !React.isValidElement(child)) return child;

    const subChildren = React.Children.toArray((child.props as any)?.children);
    if (subChildren.length === 0) return child;

    if (typeof subChildren[0] === 'string') {
      const cleaned = subChildren[0]
        .replace(/^\[!(WARNING|CAUTION|IMPORTANT|CRITICAL|TIP|NOTE|INFO)\]\s*/i, '')
        .trimStart();

      if (!cleaned && subChildren.length > 1) {
        return React.cloneElement(child as React.ReactElement, {}, ...subChildren.slice(1));
      }
      return React.cloneElement(child as React.ReactElement, {}, cleaned, ...subChildren.slice(1));
    }

    return child;
  });
}

// Subcomponent for Markdown Image with graceful error fallback
const SafeMarkdownImage: React.FC<{
  src?: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}> = ({ src, alt, className, onClick, ...props }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <span className="my-4 inline-flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 text-xs text-destructive">
        <ImageOff className="w-4 h-4 shrink-0" />
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
      onClick={onClick}
      loading="lazy"
      className={className}
      {...props}
    />
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const processedContent = useMemo(() => preprocessMarkdown(content), [content]);

  return (
    <div className="markdown-rendered-body max-w-none text-foreground leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // 1. Headings (H1 to H6)
          h1: ({ node, children, ...props }) => {
            const headingText = getHeadingText(children);
            const headingId = slugifyHeading(headingText);
            return (
              <h1 
                id={headingId} 
                className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-7 mb-4 pb-2.5 border-b border-border text-foreground scroll-mt-20 first:mt-0" 
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
                className="text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-4 pb-2 border-b border-border text-foreground scroll-mt-20" 
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
                className="text-lg sm:text-xl font-bold mt-6 mb-2.5 text-foreground scroll-mt-20" 
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
                className="text-sm sm:text-base font-semibold mt-4 mb-2 text-foreground scroll-mt-20" 
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
                className="text-xs sm:text-sm font-semibold uppercase text-muted-foreground mt-3.5 mb-1.5 tracking-wider scroll-mt-20" 
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
                className="text-xs font-semibold uppercase text-muted-foreground mt-3 mb-1 tracking-wider scroll-mt-20" 
                {...props}
              >
                {children}
              </h6>
            );
          },

          // 2. Body Text & Typographic Elements
          p: ({ node, ...props }) => (
            <p className="my-3 text-sm sm:text-[14.5px] leading-relaxed text-foreground/90" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-foreground" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-foreground/95" {...props} />
          ),
          del: ({ node, ...props }) => (
            <del className="line-through text-muted-foreground" {...props} />
          ),
          mark: ({ node, ...props }) => (
            <mark className="bg-amber-200 dark:bg-amber-500/25 text-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded font-medium" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-t border-border" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a 
              className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5 break-all" 
              target="_blank" 
              rel="noopener noreferrer" 
              {...props} 
            />
          ),

          // 3. Lists & Task Lists
          ul: ({ node, ...props }) => (
            <ul 
              className="list-disc list-outside pl-6 space-y-1.5 my-3 text-sm sm:text-[14.5px] leading-relaxed text-foreground/90 [&_ul]:my-1 [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:pl-5" 
              {...props} 
            />
          ),
          ol: ({ node, ...props }) => (
            <ol 
              className="list-decimal list-outside pl-6 space-y-1.5 my-3 text-sm sm:text-[14.5px] leading-relaxed text-foreground/90 [&_ul]:my-1 [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:pl-5" 
              {...props} 
            />
          ),
          li: ({ node, children, className, ...props }: any) => {
            const isTaskItem = className?.includes('task-list-item');
            return (
              <li 
                className={`leading-relaxed marker:text-muted-foreground ${
                  isTaskItem ? 'list-none -ml-6 flex items-start gap-2.5 my-1' : ''
                }`} 
                {...props}
              >
                {children}
              </li>
            );
          },
          input: ({ node, type, ...props }: any) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  disabled 
                  className="rounded border-border text-primary focus:ring-0 mt-1 align-middle cursor-default pointer-events-none w-4 h-4 shrink-0 accent-primary" 
                  {...props} 
                />
              );
            }
            return <input type={type} {...props} />;
          },

          // 4. Tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6 rounded-xl border border-border bg-card shadow-xs scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse min-w-full" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/80 border-b border-border text-foreground font-semibold" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-xs font-bold text-foreground/90 uppercase tracking-wider whitespace-nowrap border-r border-border/40 last:border-r-0" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border/60" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/30 transition-colors even:bg-muted/10 border-b border-border/50 last:border-b-0" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-sm leading-relaxed border-r border-border/40 last:border-r-0 text-foreground/90" {...props} />
          ),

          // 5. GitHub Alert Callouts & Blockquotes
          blockquote: ({ node, children, ...props }) => {
            const textContent = React.Children.toArray(children)
              .map(c => (typeof c === 'string' ? c : (c as any)?.props?.children))
              .join(' ');

            const isWarning = textContent.includes('[!WARNING]') || textContent.includes('[!CAUTION]');
            const isImportant = textContent.includes('[!IMPORTANT]') || textContent.includes('[!CRITICAL]');
            const isTip = textContent.includes('[!TIP]');
            const isNote = textContent.includes('[!NOTE]') || textContent.includes('[!INFO]');

            if (isWarning) {
              return (
                <div className="my-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Lưu ý / Cảnh báo (Warning)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6 [&>p]:my-1.5 leading-relaxed">
                    {cleanCalloutChildren(children)}
                  </div>
                </div>
              );
            }

            if (isImportant) {
              return (
                <div className="my-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-800 dark:text-red-200 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Quan trọng (Important Rule)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6 [&>p]:my-1.5 leading-relaxed">
                    {cleanCalloutChildren(children)}
                  </div>
                </div>
              );
            }

            if (isTip) {
              return (
                <div className="my-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Mẹo hữu ích (Tip)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6 [&>p]:my-1.5 leading-relaxed">
                    {cleanCalloutChildren(children)}
                  </div>
                </div>
              );
            }

            if (isNote) {
              return (
                <div className="my-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold mb-1.5 text-sm">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Ghi chú bổ sung (Note)</span>
                  </div>
                  <div className="text-sm opacity-95 pl-6 [&>p]:my-1.5 leading-relaxed">
                    {cleanCalloutChildren(children)}
                  </div>
                </div>
              );
            }

            return (
              <blockquote className="border-l-4 border-primary/70 pl-4 py-2 italic my-5 text-muted-foreground bg-muted/20 rounded-r-xl" {...props}>
                {children}
              </blockquote>
            );
          },

          // 6. Code Blocks & Inline Code
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isMultiLine = !inline && (Boolean(match) || codeString.includes('\n'));

            if (isMultiLine) {
              const lang = match ? match[1].toLowerCase() : 'text';
              const isCopied = copiedCode === codeString;

              return (
                <div className="relative my-5 rounded-xl overflow-hidden border border-border group bg-neutral-950 shadow-md">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400">
                    <span className="font-mono uppercase font-semibold text-neutral-300 text-[11px] tracking-wider">
                      {lang}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(codeString)}
                      className="flex items-center gap-1.5 hover:text-white transition-all px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 cursor-pointer"
                      title="Sao chép khối mã"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold text-[11px]">Đã chép ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Sao chép</span>
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
                className="bg-muted/80 text-primary font-mono text-[12.5px] px-1.5 py-0.5 rounded-md border border-border/50 font-semibold break-all" 
                {...props}
              >
                {children}
              </code>
            );
          },

          // 7. Images & Lightbox
          img: ({ node, src, alt, width, style, ...props }: any) => {
            const resolvedSrc = resolveApiUrl(src || '');
            const imgWidth = width || style?.width;
            const formattedWidth = imgWidth ? (/^\d+$/.test(String(imgWidth)) ? `${imgWidth}px` : String(imgWidth)) : undefined;

            return (
              <SafeMarkdownImage 
                src={resolvedSrc}
                alt={alt || 'Hình ảnh tài liệu'}
                title={alt || 'Nhấp để xem ảnh phóng to'}
                onClick={() => setLightboxImage({ url: resolvedSrc, title: alt || 'Hình ảnh tài liệu' })}
                className="rounded-xl border border-border shadow-xs max-w-full h-auto my-4 hover:shadow-md transition-shadow object-contain cursor-zoom-in inline-block" 
                style={{
                  ...style,
                  width: formattedWidth || style?.width,
                  maxWidth: '100%'
                }}
                {...props} 
              />
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>

      {/* Lightbox Modal for Fullscreen Image Inspection */}
      {lightboxImage && (
        <ImageLightboxModal
          isOpen={Boolean(lightboxImage)}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
        />
      )}
    </div>
  );
};
