export interface SavedMarkdownFile {
  id: string;
  name: string; // Tên file hiển thị (thường đã kèm .md hoặc đuôi sạch)
  content: string;
  note?: string;
  sizeBytes: number;
  linesCount: number;
  wordsCount: number;
  charsCount: number;
  source: 'upload' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'edit' | 'split' | 'preview';

export interface MarkdownStats {
  lines: number;
  words: number;
  chars: number;
  byteSize: number;
  formattedSize: string;
}

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  line?: number;
}
