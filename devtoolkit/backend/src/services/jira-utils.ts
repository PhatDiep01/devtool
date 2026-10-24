/**
 * DevToolkit Jira Utilities
 * - ADF (Atlassian Document Format) v3 converter
 * - Flexible worklog time parser ("1h 30m", "2h", "45m", "1d", decimals)
 */

/**
 * Converts plain text / markdown text into Atlassian Document Format (ADF) v3 JSON structure.
 * Jira REST API v3 requires rich text fields (description, comment, worklog comment) to be ADF.
 */
export function textToAdf(text?: string): any {
  if (!text || !text.trim()) {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: []
        }
      ]
    };
  }

  // Split into paragraphs by double newlines
  const rawParagraphs = text.split(/\r?\n\r?\n/).filter(p => p.trim().length > 0);
  const paragraphs = rawParagraphs.length > 0 ? rawParagraphs : [text];

  const content = paragraphs.map(paragraphText => {
    // Check if paragraph is a heading (e.g. "# Heading" or "## Heading")
    const headingMatch = paragraphText.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length);
      return {
        type: 'heading',
        attrs: { level },
        content: [
          {
            type: 'text',
            text: headingMatch[2]
          }
        ]
      };
    }

    const lines = paragraphText.split(/\r?\n/);

    // Check if paragraph is a bullet list (all lines start with '- ' or '* ')
    const isBulletList = lines.length > 0 && lines.every(line => /^[-*]\s+/.test(line.trim()));
    if (isBulletList) {
      return {
        type: 'bulletList',
        content: lines.map(line => {
          const itemText = line.trim().replace(/^[-*]\s+/, '');
          return {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: itemText }]
              }
            ]
          };
        })
      };
    }

    // Split single paragraph by single newlines for hard breaks
    const inlineContent: any[] = [];

    lines.forEach((line, idx) => {
      if (line) {
        inlineContent.push({
          type: 'text',
          text: line
        });
      }
      if (idx < lines.length - 1) {
        inlineContent.push({
          type: 'hardBreak'
        });
      }
    });

    return {
      type: 'paragraph',
      content: inlineContent.length > 0 ? inlineContent : [{ type: 'text', text: ' ' }]
    };
  });

  return {
    type: 'doc',
    version: 1,
    content
  };
}

/**
 * Converts Atlassian Document Format (ADF) object back to readable string text.
 */
export function adfToText(adf: any): string {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (!adf.content || !Array.isArray(adf.content)) return '';

  const parseNode = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (node.content && Array.isArray(node.content)) {
      const inner = node.content.map(parseNode).join('');
      if (node.type === 'paragraph') return inner + '\n\n';
      if (node.type === 'heading') return `### ${inner}\n\n`;
      if (node.type === 'bulletList') return inner;
      if (node.type === 'listItem') return `• ${inner.trim()}\n`;
      if (node.type === 'codeBlock') return `\`\`\`\n${inner}\n\`\`\`\n\n`;
      return inner;
    }
    return '';
  };

  return adf.content.map(parseNode).join('').trim();
}

/**
 * Parses flexible human time inputs into total seconds.
 * Supported formats:
 * - "1h 30m" -> 5400
 * - "2h" -> 7200
 * - "45m" -> 2700
 * - "1d" -> 28800 (1 work day = 8h)
 * - "1w" -> 144000 (1 work week = 5 days = 40h)
 * - "1.5" or "1.5h" -> 5400 (decimals as hours)
 * - "01:30" -> 5400 (HH:MM format)
 * - number -> rounded integer seconds
 */
export function parseFlexibleTimeToSeconds(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') {
    return Math.max(0, Math.round(input));
  }

  // Normalize comma decimals (e.g. "1,5" -> "1.5")
  const trimmed = input.trim().toLowerCase().replace(/(\d+),(\d+)/g, '$1.$2');
  if (!trimmed) return 0;

  // Pure decimal or integer (e.g. "1.5", "2", "0.75") -> treated as hours
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed) * 3600);
  }

  // HH:MM format (e.g. "01:30" or "2:15")
  const colonMatch = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    return Math.max(0, hours * 3600 + minutes * 60);
  }

  let totalSeconds = 0;
  const regex = /(\d+(?:\.\d+)?)\s*(w|d|h|m|s)/g;
  let match;
  let found = false;

  while ((match = regex.exec(trimmed)) !== null) {
    found = true;
    const val = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'w': // week = 5 work days = 40 hours
        totalSeconds += val * 5 * 8 * 3600;
        break;
      case 'd': // day = 8 hours standard Jira workday
        totalSeconds += val * 8 * 3600;
        break;
      case 'h': // hour = 3600s
        totalSeconds += val * 3600;
        break;
      case 'm': // minute = 60s
        totalSeconds += val * 60;
        break;
      case 's': // second
        totalSeconds += val;
        break;
    }
  }

  if (found) {
    return Math.max(0, Math.round(totalSeconds));
  }

  return 0;
}

/**
 * Formats seconds into human friendly duration like "1h 30m" or "45m"
 */
export function formatSecondsToTimeSpent(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
}

/**
 * Cleanly extracts error message from Jira REST API errors.
 */
export function formatJiraError(error: any): { error: any; message: string } {
  const data = error.response?.data;
  let message = error.message || 'Jira API Error';
  if (data) {
    if (Array.isArray(data.errorMessages) && data.errorMessages.length > 0) {
      message = data.errorMessages.join('. ');
    } else if (data.errors && typeof data.errors === 'object') {
      message = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`).join(', ');
    } else if (typeof data.message === 'string') {
      message = data.message;
    } else if (typeof data.error === 'string') {
      message = data.error;
    }
  }
  return { error: data || error.message, message };
}

