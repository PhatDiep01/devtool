export type StickyNoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'orange';

export interface StickyNote {
  id: string;
  title: string;
  color: StickyNoteColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  content: string;
  preview: string;
  filename: string;
  size_bytes: number;
}

export interface StickyNoteListResponse {
  notes: StickyNote[];
  total: number;
  corruptedCount: number;
}

export type StickyNoteSortBy = 'updated_at' | 'created_at' | 'title';
export type StickyNoteSortOrder = 'asc' | 'desc';

export interface ConflictErrorData {
  currentVersion: number;
  currentUpdatedAt: string;
  currentContent: string;
  currentTitle: string;
}

export interface StickyNoteCreatePayload {
  title?: string;
  content?: string;
  color?: StickyNoteColor;
  pinned?: boolean;
}

export interface StickyNoteUpdatePayload {
  title?: string;
  content?: string;
  color?: StickyNoteColor;
  pinned?: boolean;
  expectedVersion?: number;
  forceOverwrite?: boolean;
}
