import matter from 'gray-matter';

export interface ParsedDocument {
  frontmatter: {
    title: string;
    module: string;
    screen?: string;
    author?: string;
    date?: string;
    version?: string;
    status?: string;
    jira?: string;
    figma?: string;
    tags?: string[];
  };
  sections: {
    overview?: string;
    features?: string;
    businessRules?: string;
    apiEndpoints?: string;
    database?: string;
    testing?: string;
    configuration?: string;
    dependencies?: string;
    uiUx?: string;
    notes?: string;
  };
  raw: string;
}

/** Mapping from normalized heading text to section key */
const HEADING_MAP: Record<string, keyof ParsedDocument['sections']> = {
  // Overview
  'overview': 'overview',
  'tổng quan': 'overview',
  'mục đích & bối cảnh nghiệp vụ': 'overview',
  'bối cảnh': 'overview',

  // Features & Acceptance Criteria
  'features': 'features',
  'danh mục tính năng': 'features',
  'tính năng': 'features',
  'tiêu chí chấp nhận': 'features',
  'acceptance criteria': 'features',
  'features & acceptance criteria': 'features',

  // Business Rules
  'business rules': 'businessRules',
  'quy tắc nghiệp vụ': 'businessRules',
  'nghiệp vụ': 'businessRules',
  'rules': 'businessRules',
  'validation rules': 'businessRules',

  // API Endpoints
  'api endpoints': 'apiEndpoints',
  'api': 'apiEndpoints',
  'endpoints': 'apiEndpoints',
  'giao tiếp api': 'apiEndpoints',
  'api contracts': 'apiEndpoints',

  // Database
  'database': 'database',
  'db schema': 'database',
  'db': 'database',
  'data model': 'database',
  'cơ sở dữ liệu': 'database',
  'er diagram': 'database',
  'sơ đồ quan hệ': 'database',

  // QA & Testing
  'qa & testing guidelines': 'testing',
  'testing guidelines': 'testing',
  'testing': 'testing',
  'qa': 'testing',
  'test cases': 'testing',
  'kiểm thử': 'testing',
  'kế hoạch kiểm thử': 'testing',

  // Configuration
  'configuration': 'configuration',
  'cấu hình': 'configuration',
  'config': 'configuration',
  'appsettings': 'configuration',

  // Dependencies
  'dependencies': 'dependencies',
  'phụ thuộc': 'dependencies',
  'gói phụ thuộc': 'dependencies',
  'deps': 'dependencies',

  // UI/UX & States
  'ui/ux & states': 'uiUx',
  'ui/ux': 'uiUx',
  'ui': 'uiUx',
  'ux': 'uiUx',
  'giao diện': 'uiUx',
  'states': 'uiUx',
  'quy định giao diện': 'uiUx',

  // Notes & Warnings
  'notes': 'notes',
  'notes & technical debt': 'notes',
  'notes & warnings': 'notes',
  'ghi chú': 'notes',
  'cảnh báo': 'notes',
  'lưu ý': 'notes',
  'technical debt': 'notes',
  'nợ kỹ thuật': 'notes'
};

/**
 * Parse a markdown string, extracting frontmatter and structured sections.
 * Supports flexible heading formats and dual-language headings (EN / VI).
 */
export function parseMarkdown(content: string): ParsedDocument {
  let data: Record<string, any> = {};
  let body = content;

  try {
    const parsed = matter(content);
    data = parsed.data || {};
    body = parsed.content || content;
  } catch (err) {
    // Graceful fallback if YAML frontmatter has syntax errors (e.g. unquoted colons)
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
      body = fmMatch[2];
      const lines = fmMatch[1].split(/\r?\n/);
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let val = line.slice(colonIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith('[') && val.endsWith(']')) {
            data[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
          } else {
            data[key] = val;
          }
        }
      }
    }
  }

  // Fallback: If title is empty, check for first # Heading in body
  let title = data.title || '';
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }

  const frontmatter: ParsedDocument['frontmatter'] = {
    title,
    module: data.module || '',
    screen: data.screen,
    author: data.author,
    date: data.date ? String(data.date) : undefined,
    version: data.version ? String(data.version) : undefined,
    status: data.status,
    jira: data.jira,
    figma: data.figma,
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : undefined,
  };

  const sections: ParsedDocument['sections'] = {};

  // Split by ## headings
  const parts = body.split(/^## (.+)$/m);

  for (let i = 1; i < parts.length; i += 2) {
    const rawHeading = parts[i].trim();
    const sectionBody = (parts[i + 1] || '').trim();

    // Normalize heading (strip numbers like "1. ", lower case, strip markdown punctuation)
    const normalized = rawHeading
      .toLowerCase()
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/[^\p{L}\p{N}\s&/-]/gu, '')
      .trim();

    // Check exact or partial match
    let matchedKey: keyof ParsedDocument['sections'] | undefined = HEADING_MAP[normalized];

    if (!matchedKey) {
      for (const [pattern, key] of Object.entries(HEADING_MAP)) {
        if (normalized.includes(pattern)) {
          matchedKey = key;
          break;
        }
      }
    }

    if (matchedKey) {
      if (sections[matchedKey]) {
        sections[matchedKey] += `\n\n## ${rawHeading}\n\n${sectionBody}`;
      } else {
        sections[matchedKey] = sectionBody;
      }
    }
  }

  return {
    frontmatter,
    sections,
    raw: content,
  };
}
