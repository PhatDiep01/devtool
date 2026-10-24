export type DiffMode = 'line' | 'word' | 'char';

export type ViewMode = 'side-by-side' | 'unified';

export interface DiffOptions {
  ignoreCase: boolean;
  trimWhitespace: boolean;
  collapseWhitespace: boolean;
  ignoreEmptyLines: boolean;
  normalizeLineEndings: boolean;
}

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
  byteSize: number;
}

export type DiffChangeType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffToken {
  type: 'unchanged' | 'added' | 'removed';
  value: string;
}

export interface SideBySideCell {
  lineNumber: number | null;
  content: string;
  type: DiffChangeType | 'empty';
  tokens?: DiffToken[];
}

export interface SideBySideRow {
  rowNumber: number;
  type: DiffChangeType;
  diffHunkIndex: number | null;
  left: SideBySideCell;
  right: SideBySideCell;
  isContextCollapsed?: boolean;
}

export interface UnifiedRow {
  rowNumber: number;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: 'unchanged' | 'added' | 'removed' | 'hunk-header';
  content: string;
  tokens?: DiffToken[];
  diffHunkIndex: number | null;
  isContextCollapsed?: boolean;
}

export interface DiffHunk {
  index: number;
  sideBySideStartRow: number;
  sideBySideEndRow: number;
  unifiedStartRow: number;
  unifiedEndRow: number;
  oldStartLine: number;
  oldLineCount: number;
  newStartLine: number;
  newLineCount: number;
  description: string;
}

export interface DiffStats {
  addedLines: number;
  removedLines: number;
  modifiedLines: number;
  unchangedLines: number;
  totalDiffHunks: number;
  similarityPercentage: number;
}

export interface CompareResult {
  isIdentical: boolean;
  isBothEmpty: boolean;
  isOriginalEmpty: boolean;
  isModifiedEmpty: boolean;
  stats: DiffStats;
  sideBySideRows: SideBySideRow[];
  unifiedRows: UnifiedRow[];
  hunks: DiffHunk[];
  unifiedDiffText: string;
  normalizedOriginal: string;
  normalizedModified: string;
  executionTimeMs: number;
}

export interface ComparePayload {
  originalText: string;
  modifiedText: string;
  diffMode: DiffMode;
  options: DiffOptions;
  collapseUnchanged: boolean;
  contextLines: number;
}

export interface WorkerRequestMessage {
  id: string;
  type: 'COMPARE';
  payload: ComparePayload;
}

export interface WorkerResponseMessage {
  id: string;
  type: 'COMPARE_SUCCESS' | 'COMPARE_ERROR';
  result?: CompareResult;
  error?: string;
}
