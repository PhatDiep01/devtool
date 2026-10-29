import { marked } from 'marked';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'joplin-turndown-plugin-gfm';
import { resolveApiUrl } from '../services/api';

// Configure Marked for GFM tables, line breaks, etc.
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Configure Turndown for clean Markdown generation
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*'
});

// Apply GitHub Flavored Markdown (tables, strikethrough, task lists)
turndownService.use(gfm);

// Prevent escaping dots in headings and lists (e.g. "1. Overview")
turndownService.escape = (str: string) => str;

// Custom rule for GitHub Callout blockquotes: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]
turndownService.addRule('githubCallout', {
  filter: (node) => {
    return node.nodeName === 'BLOCKQUOTE';
  },
  replacement: (content, node) => {
    const text = content.trim();
    // Check if it's already a callout or standard quote
    if (text.startsWith('[!')) {
      return `\n\n> ${text.split('\n').join('\n> ')}\n\n`;
    }
    return `\n\n> ${text.split('\n').join('\n> ')}\n\n`;
  }
});

// Custom rule for images to ensure clean markdown formatting with width preservation
turndownService.addRule('cleanImages', {
  filter: 'img',
  replacement: (content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.alt || 'Hình ảnh';
    const originalSrc = img.getAttribute('data-doc-src') || img.getAttribute('data-original-src');
    let src = originalSrc || img.getAttribute('src') || '';
    if (!src) return '';

    // Check if custom width is present
    const widthAttr = img.getAttribute('width');
    const styleWidth = img.style?.width;
    const width = widthAttr || styleWidth;

    if (width) {
      const cleanWidth = width.replace(/px$/, '').trim();
      if (cleanWidth && cleanWidth !== 'auto') {
        return `<img src="${src}" alt="${alt}" width="${cleanWidth}" />`;
      }
    }
    return `![${alt}](${src})`;
  }
});

/**
 * Converts Markdown string to HTML for Visual WYSIWYG editing
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';
  try {
    const rawHtml = marked.parse(markdown) as string;

    // Process all <img> tags to resolve URLs and preserve width/styling
    return rawHtml.replace(/<img\s+([^>]*?)>/gi, (fullMatch, attrs) => {
      // Extract src
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const src = srcMatch ? srcMatch[1] : '';
      if (!src) return fullMatch;

      const resolved = resolveApiUrl(src);

      // Extract alt
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : 'Hình ảnh';

      // Extract width
      const widthMatch = attrs.match(/width=["']([^"']+)["']/i);
      const width = widthMatch ? widthMatch[1].trim() : '';

      // Build style
      let styleStr = 'max-width: 100%;';
      if (width) {
        const formattedWidth = /^\d+$/.test(width) ? `${width}px` : width;
        styleStr = `width: ${formattedWidth}; max-width: 100%;`;
      }

      const widthAttr = width ? ` width="${width.replace(/px$/, '')}"` : '';

      return `<img src="${resolved}" data-doc-src="${src}" alt="${alt}"${widthAttr} style="${styleStr}" class="max-w-full rounded-xl my-3 border border-border shadow-xs inline-block cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" />`;
    });
  } catch (err) {
    console.error('Error parsing markdown to HTML:', err);
    return markdown;
  }
}

/**
 * Removes all markdown and HTML image references for a given image identifier
 */
export function removeImageFromMarkdown(
  markdown: string,
  imageIdentifier: string | { url?: string; stored_name?: string; original_name?: string; tempId?: string }
): string {
  if (!markdown) return '';

  const tokens: string[] = [];
  if (typeof imageIdentifier === 'string') {
    if (imageIdentifier.trim()) tokens.push(imageIdentifier.trim());
  } else if (imageIdentifier && typeof imageIdentifier === 'object') {
    if (imageIdentifier.url) tokens.push(imageIdentifier.url);
    if (imageIdentifier.stored_name) tokens.push(imageIdentifier.stored_name);
    if (imageIdentifier.tempId) tokens.push(imageIdentifier.tempId);
    if (imageIdentifier.original_name && imageIdentifier.original_name.length > 3) {
      tokens.push(imageIdentifier.original_name);
    }
  }

  let result = markdown;

  for (const token of tokens) {
    const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Remove markdown images: ![alt](...token...)
    const mdImageRegex = new RegExp(`!\\[[^\\]]*\\]\\([^)]*?${safeToken}[^)]*?\\)`, 'gi');
    result = result.replace(mdImageRegex, '');

    // 2. Remove HTML image tags wrapped in paragraphs: <p>\s*<img ...token...>\s*</p>
    const htmlPImgRegex = new RegExp(`<p>\\s*<img\\s+[^>]*?${safeToken}[^>]*?>\\s*<\\/p>`, 'gi');
    result = result.replace(htmlPImgRegex, '');

    // 3. Remove standalone HTML image tags: <img ...token...>
    const htmlImgRegex = new RegExp(`<img\\s+[^>]*?${safeToken}[^>]*?\\/?>`, 'gi');
    result = result.replace(htmlImgRegex, '');
  }

  return result
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>\s*<p>\s*<br\s*\/?>\s*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts HTML from Visual Editor back to clean GFM Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';
  try {
    const md = turndownService.turndown(html);
    return md;
  } catch (err) {
    console.error('Error converting HTML to markdown:', err);
    return html;
  }
}

/**
 * Splits full document into YAML frontmatter metadata and Content Body
 * Prevents non-tech users from having to see or edit YAML code
 */
export function splitFrontmatterAndBody(fullMarkdown: string): { 
  frontmatter: {
    title?: string;
    module?: string;
    author?: string;
    status?: string;
    jira?: string;
    tags?: string[];
    [key: string]: any;
  }; 
  body: string;
  hasFrontmatter: boolean;
} {
  if (!fullMarkdown || typeof fullMarkdown !== 'string') {
    return { frontmatter: {}, body: '', hasFrontmatter: false };
  }

  const trimmed = fullMarkdown.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: fullMarkdown, hasFrontmatter: false };
  }

  // Regex to match opening and closing ---
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(trimmed);
  if (!match) {
    return { frontmatter: {}, body: fullMarkdown, hasFrontmatter: false };
  }

  const yamlBlock = match[1];
  const bodyContent = match[2];

  const frontmatter: Record<string, any> = {};

  // Parse lines: key: value
  yamlBlock.split(/\r?\n/).forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();

      // Handle tags array: tags: ["A", "B"] or tags: [A, B]
      if (key === 'tags' && val.startsWith('[') && val.endsWith(']')) {
        try {
          const rawTags = val.slice(1, -1);
          frontmatter[key] = rawTags
            .split(',')
            .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
        } catch {
          frontmatter[key] = [];
        }
      } else {
        // Strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        frontmatter[key] = val;
      }
    }
  });

  return { frontmatter, body: bodyContent, hasFrontmatter: true };
}

/**
 * Recombines metadata and body into clean, standard Markdown with Frontmatter
 */
export function composeFullMarkdown(
  metadata: {
    title: string;
    moduleName?: string;
    author?: string;
    status?: string;
    jiraKey?: string;
    tags?: string[];
  },
  bodyContent: string
): string {
  const tagsStr = metadata.tags && metadata.tags.length > 0
    ? `[${metadata.tags.map(t => `"${t.trim()}"`).join(', ')}]`
    : '[]';

  const frontmatterLines: string[] = [
    '---',
    `title: ${metadata.title.trim()}`,
    metadata.moduleName ? `module: ${metadata.moduleName.trim()}` : '',
    `author: ${metadata.author?.trim() || 'Author'}`,
    `status: ${metadata.status?.trim() || 'Draft'}`,
    metadata.jiraKey?.trim() ? `jira: ${metadata.jiraKey.trim()}` : '',
    `tags: ${tagsStr}`,
    '---',
    ''
  ].filter(line => line !== '');

  const cleanBody = (bodyContent || '').trimStart();
  return `${frontmatterLines.join('\n')}\n${cleanBody}`;
}
