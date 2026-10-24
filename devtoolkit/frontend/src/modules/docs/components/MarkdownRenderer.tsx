import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { AlertTriangle, Info, CheckCircle2, ChevronRight, Copy, Check, ShieldAlert } from 'lucide-react';
import { resolveApiUrl } from '../../../services/api';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-5 rounded-xl border border-border bg-card shadow-sm scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse min-w-[600px]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/70 border-b border-border text-foreground font-semibold" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border/60" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/30 transition-colors even:bg-muted/10" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-sm leading-relaxed" {...props} />
          ),
          blockquote: ({ node, children, ...props }) => {
            const textContent = React.Children.toArray(children)
              .map(c => (typeof c === 'string' ? c : (c as any)?.props?.children))
              .join(' ');

            if (textContent.includes('[!WARNING]') || textContent.includes('[!CAUTION]')) {
              return (
                <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Lưu ý / Cảnh báo (Warning)</span>
                  </div>
                  <div className="text-sm opacity-90 pl-6">{children}</div>
                </div>
              );
            }

            if (textContent.includes('[!IMPORTANT]') || textContent.includes('[!CRITICAL]')) {
              return (
                <div className="my-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Quan trọng (Critical Rule)</span>
                  </div>
                  <div className="text-sm opacity-90 pl-6">{children}</div>
                </div>
              );
            }

            if (textContent.includes('[!TIP]') || textContent.includes('[!NOTE]')) {
              return (
                <div className="my-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-700 dark:text-blue-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Ghi chú bổ sung (Note)</span>
                  </div>
                  <div className="text-sm opacity-90 pl-6">{children}</div>
                </div>
              );
            }

            return (
              <blockquote className="border-l-4 border-primary pl-4 py-1.5 italic my-4 text-muted-foreground bg-muted/20 rounded-r-xl" {...props}>
                {children}
              </blockquote>
            );
          },
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return (
                <div className="relative my-4 rounded-xl overflow-hidden border border-border group bg-neutral-950 shadow-md">
                  <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-xs text-neutral-400">
                    <span className="font-mono uppercase font-semibold text-neutral-300">{match[1]}</span>
                    <button
                      onClick={() => handleCopy(codeString)}
                      className="flex items-center gap-1 hover:text-white transition-colors px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px]"
                      title="Copy code snippet"
                    >
                      {copiedCode === codeString ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === codeString ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono scrollbar-thin">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono text-primary font-semibold break-all whitespace-pre-wrap" {...props}>
                {children}
              </code>
            );
          },
          h2: ({ node, children, ...props }) => (
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-8 mb-4 pb-2 border-b border-border flex items-center gap-2 text-foreground" {...props}>
              <ChevronRight className="w-5 h-5 text-primary shrink-0" />
              <span className="min-w-0 break-words flex-1">{children}</span>
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-base sm:text-lg font-bold mt-5 mb-2.5 text-foreground flex items-center gap-2 min-w-0" {...props}>
              <span className="min-w-0 break-words flex-1">{children}</span>
            </h3>
          ),
          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1.5 my-3 text-sm pl-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1.5 my-3 text-sm pl-2" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          p: ({ node, ...props }) => <p className="my-2.5 text-sm leading-relaxed" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-primary hover:underline font-semibold break-all" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          img: ({ node, src, ...props }) => (
            <img 
              src={resolveApiUrl(src || '')}
              className="rounded-xl border border-border shadow-sm max-w-full h-auto my-4 hover:shadow-md transition-shadow object-contain" 
              loading="lazy"
              {...props} 
            />
          ),
          input: ({ node, type, ...props }: any) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  disabled 
                  className="rounded border-border text-primary focus:ring-primary mr-2 align-middle cursor-default" 
                  {...props} 
                />
              );
            }
            return <input type={type} {...props} />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
