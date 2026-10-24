import { marked } from 'marked';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'joplin-turndown-plugin-gfm';

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

// Custom rule for images to ensure clean markdown formatting
turndownService.addRule('cleanImages', {
  filter: 'img',
  replacement: (content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.alt || 'Hình ảnh';
    const src = img.getAttribute('src') || '';
    if (!src) return '';
    return `![${alt}](${src})`;
  }
});

/**
 * Converts Markdown string to HTML for Visual WYSIWYG editing
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return '';
  try {
    return marked.parse(markdown) as string;
  } catch (err) {
    console.error('Error parsing markdown to HTML:', err);
    return markdown;
  }
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
