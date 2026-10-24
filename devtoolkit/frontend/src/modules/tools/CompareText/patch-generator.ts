import { DiffHunk, UnifiedRow } from './types';

/**
 * Generates standard Git-compatible unified diff text.
 */
export function generateUnifiedDiffText(
  originalFilename: string = 'original',
  modifiedFilename: string = 'modified',
  unifiedRows: UnifiedRow[],
  hunks: DiffHunk[]
): string {
  if (unifiedRows.length === 0) {
    return '';
  }

  const lines: string[] = [
    `--- a/${originalFilename}`,
    `+++ b/${modifiedFilename}`
  ];

  if (hunks.length === 0) {
    return lines.join('\n');
  }

  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.oldStartLine},${hunk.oldLineCount} +${hunk.newStartLine},${hunk.newLineCount} @@`
    );

    for (let r = hunk.unifiedStartRow; r <= hunk.unifiedEndRow; r++) {
      const row = unifiedRows[r];
      if (!row) continue;

      if (row.type === 'unchanged') {
        lines.push(` ${row.content}`);
      } else if (row.type === 'removed') {
        lines.push(`-${row.content}`);
      } else if (row.type === 'added') {
        lines.push(`+${row.content}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Triggers a browser download of a .patch or .diff file.
 */
export function downloadPatchFile(
  content: string,
  filename: string = 'changes.patch'
): void {
  const blob = new Blob([content], { type: 'text/x-diff;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Generates a standard timestamped diff filename: diff_20261024_153012.diff
 */
export function createTimestampedDiffFilename(extension: 'diff' | 'patch' = 'diff'): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `diff_${timestamp}.${extension}`;
}
