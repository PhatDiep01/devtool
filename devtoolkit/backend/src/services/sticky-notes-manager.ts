import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { getDataDir, assertPathInside, sanitizeSlug } from './file-manager';

export interface StickyNoteMetadata {
  id: string;
  title: string;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface StickyNoteItem extends StickyNoteMetadata {
  content: string;
  preview: string;
  filename: string;
  size_bytes: number;
}

export interface ConflictErrorData {
  currentVersion: number;
  currentUpdatedAt: string;
  currentContent: string;
  currentTitle: string;
}

export class ConcurrencyConflictError extends Error {
  conflictData: ConflictErrorData;
  constructor(message: string, conflictData: ConflictErrorData) {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.conflictData = conflictData;
  }
}

export const ALLOWED_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'] as const;
export type StickyNoteColor = typeof ALLOWED_COLORS[number];
export const DEFAULT_COLOR: StickyNoteColor = 'yellow';
export const MAX_CONTENT_BYTES = 500 * 1024; // 500 KB limit
export const MAX_TITLE_LENGTH = 100;

/**
 * Returns the directory path for sticky notes, ensuring it exists.
 */
export function getStickyNotesDir(): string {
  const baseDir = path.join(getDataDir(), 'sticky_notes');
  assertPathInside(getDataDir(), baseDir);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Returns the trash directory path for sticky notes, ensuring it exists.
 */
export function getStickyNotesTrashDir(): string {
  const trashDir = path.join(getStickyNotesDir(), '.trash');
  assertPathInside(getDataDir(), trashDir);
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }
  return trashDir;
}

/**
 * Generate a unique ID for note
 */
export function generateNoteId(): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `note_${timestamp}_${randomSuffix}`;
}

/**
 * Sanitize title to form safe file name
 */
export function sanitizeTitle(rawTitle: string): string {
  if (!rawTitle || typeof rawTitle !== 'string') return 'new-note';
  const clean = sanitizeSlug(rawTitle.slice(0, MAX_TITLE_LENGTH));
  return clean || 'new-note';
}

/**
 * Build safe file name: {safeTitle}_{id}.txt
 */
export function buildFilename(title: string, id: string): string {
  const safeTitle = sanitizeTitle(title);
  return `${safeTitle}_${id}.txt`;
}

/**
 * Atomic file write helper to prevent partial writes / corrupted files
 */
function atomicWriteFile(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${Date.now()}.${crypto.randomBytes(2).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(tempPath, data, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

/**
 * Find the file matching an ID in a specified directory
 */
function findFileById(dir: string, id: string): { filePath: string; filename: string } | null {
  assertPathInside(getDataDir(), dir);
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;

    // Check if filename contains _id.txt or is id.txt
    if (entry.name.endsWith(`_${id}.txt`) || entry.name === `${id}.txt`) {
      const fullPath = path.join(dir, entry.name);
      assertPathInside(dir, fullPath);
      return { filePath: fullPath, filename: entry.name };
    }
  }

  // Fallback: check content metadata if filename didn't match (for imported files)
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
    try {
      const fullPath = path.join(dir, entry.name);
      assertPathInside(dir, fullPath);
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = matter(raw);
      if (parsed.data && parsed.data.id === id) {
        return { filePath: fullPath, filename: entry.name };
      }
    } catch {}
  }

  return null;
}

/**
 * Safe ISO string converter ensuring valid timestamp string representation
 */
export function toSafeIsoString(val: any, fallback: Date = new Date()): string {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return fallback.toISOString();
}

/**
 * Extract clean preview string from content (first 160 characters)
 */
export function extractPreview(content: string): string {
  if (!content || typeof content !== 'string') return '';
  const clean = content
    .replace(/^#+\s+/gm, '')
    .replace(/^- \[[ x]\]\s+/gim, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean) {
    return clean.slice(0, 160);
  }
  return content.trim().slice(0, 160);
}

/**
 * Parse a note file content and extract metadata + content safely
 */
export function parseNoteContent(rawContent: string, fallbackStats?: { birthtime: Date; mtime: Date; filename: string }): {
  metadata: StickyNoteMetadata;
  content: string;
  preview: string;
} {
  let metadata: StickyNoteMetadata;
  let content = '';

  try {
    const parsed = matter(rawContent);
    const data = parsed.data || {};
    content = parsed.content || '';

    // Extract or infer fields
    const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : generateNoteId();
    const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
    const title = rawTitle 
      ? rawTitle.slice(0, MAX_TITLE_LENGTH)
      : (content.split('\n')[0]?.replace(/^[#\s\-*]+/, '').trim().slice(0, MAX_TITLE_LENGTH) || 'New Note');
    const color = ALLOWED_COLORS.includes(data.color) ? data.color : DEFAULT_COLOR;
    const pinned = Boolean(data.pinned);
    const version = typeof data.version === 'number' && Number.isFinite(data.version) ? data.version : 1;

    const createdAt = toSafeIsoString(data.created_at, fallbackStats?.birthtime || new Date());
    const updatedAt = toSafeIsoString(data.updated_at, fallbackStats?.mtime || new Date());

    metadata = {
      id,
      title: title || 'New Note',
      color,
      pinned,
      created_at: createdAt,
      updated_at: updatedAt,
      version
    };
  } catch (err) {
    // Gray-matter parse failure fallback
    content = rawContent;
    const firstLine = rawContent.split('\n')[0]?.replace(/^[#\s\-*]+/, '').trim();
    metadata = {
      id: generateNoteId(),
      title: firstLine ? firstLine.slice(0, MAX_TITLE_LENGTH) : 'New Note',
      color: DEFAULT_COLOR,
      pinned: false,
      created_at: toSafeIsoString(fallbackStats?.birthtime, new Date()),
      updated_at: toSafeIsoString(fallbackStats?.mtime, new Date()),
      version: 1
    };
  }

  const preview = extractPreview(content);

  return { metadata, content, preview };
}

/**
 * Serialize note metadata and content into raw string with YAML Frontmatter
 */
export function serializeNote(metadata: StickyNoteMetadata, content: string): string {
  const frontmatterData = {
    id: metadata.id,
    title: (metadata.title || '').trim() || 'New Note',
    color: metadata.color || DEFAULT_COLOR,
    pinned: Boolean(metadata.pinned),
    created_at: toSafeIsoString(metadata.created_at, new Date()),
    updated_at: toSafeIsoString(metadata.updated_at, new Date()),
    version: typeof metadata.version === 'number' && Number.isFinite(metadata.version) ? metadata.version : 1
  };

  return matter.stringify(content, frontmatterData);
}

/**
 * List all notes in active or trash folder
 */
export function listNotes(options: {
  search?: string;
  color?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
  isTrash?: boolean;
} = {}): { notes: StickyNoteItem[]; total: number; corruptedCount: number } {
  const targetDir = options.isTrash ? getStickyNotesTrashDir() : getStickyNotesDir();
  assertPathInside(getDataDir(), targetDir);

  if (!fs.existsSync(targetDir)) {
    return { notes: [], total: 0, corruptedCount: 0 };
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const notes: StickyNoteItem[] = [];
  let corruptedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
    // Skip hidden files
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(targetDir, entry.name);
    try {
      assertPathInside(targetDir, fullPath);
      const stat = fs.statSync(fullPath);
      const raw = fs.readFileSync(fullPath, 'utf-8');

      const { metadata, content, preview } = parseNoteContent(raw, {
        birthtime: stat.birthtime,
        mtime: stat.mtime,
        filename: entry.name
      });

      // Filter by search query (title or content)
      if (options.search) {
        const query = options.search.toLowerCase().trim();
        const matchTitle = metadata.title.toLowerCase().includes(query);
        const matchContent = content.toLowerCase().includes(query);
        if (!matchTitle && !matchContent) continue;
      }

      // Filter by color
      if (options.color && options.color !== 'all') {
        if (metadata.color !== options.color) continue;
      }

      notes.push({
        ...metadata,
        content,
        preview,
        filename: entry.name,
        size_bytes: stat.size
      });
    } catch (err) {
      console.warn(`[StickyNotes] Failed to read note file "${entry.name}":`, err);
      corruptedCount++;
    }
  }

  // Sorting: Pinned notes always on top for active notes (not in trash)
  const sortBy = options.sortBy || 'updated_at';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

  notes.sort((a, b) => {
    if (!options.isTrash) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
    }

    if (sortBy === 'title') {
      return a.title.localeCompare(b.title, 'vi') * sortOrder;
    } else if (sortBy === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sortOrder;
    } else {
      // Default: updated_at
      return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * sortOrder;
    }
  });

  return { notes, total: notes.length, corruptedCount };
}

/**
 * Get a single note by ID
 */
export function getNoteById(id: string, isTrash = false): StickyNoteItem {
  const targetDir = isTrash ? getStickyNotesTrashDir() : getStickyNotesDir();
  const fileInfo = findFileById(targetDir, id);

  if (!fileInfo) {
    throw new Error(`Note not found: ${id}`);
  }

  const stat = fs.statSync(fileInfo.filePath);
  const raw = fs.readFileSync(fileInfo.filePath, 'utf-8');
  const { metadata, content, preview } = parseNoteContent(raw, {
    birthtime: stat.birthtime,
    mtime: stat.mtime,
    filename: fileInfo.filename
  });

  return {
    ...metadata,
    content,
    preview,
    filename: fileInfo.filename,
    size_bytes: stat.size
  };
}

/**
 * Create a new sticky note
 */
export function createNote(data: {
  title?: string;
  content?: string;
  color?: string;
  pinned?: boolean;
}): StickyNoteItem {
  const dir = getStickyNotesDir();
  const id = generateNoteId();
  const rawTitle = (data.title || '').trim().slice(0, MAX_TITLE_LENGTH);
  const title = rawTitle || 'New Note';
  const content = (data.content || '').slice(0, MAX_CONTENT_BYTES);
  const color = ALLOWED_COLORS.includes(data.color as any) ? (data.color as StickyNoteColor) : DEFAULT_COLOR;
  const pinned = Boolean(data.pinned);
  const now = new Date().toISOString();

  const metadata: StickyNoteMetadata = {
    id,
    title,
    color,
    pinned,
    created_at: now,
    updated_at: now,
    version: 1
  };

  const serialized = serializeNote(metadata, content);
  const filename = buildFilename(title, id);
  const filePath = path.join(dir, filename);

  assertPathInside(dir, filePath);
  atomicWriteFile(filePath, serialized);

  const stat = fs.statSync(filePath);
  const preview = extractPreview(content);

  return {
    ...metadata,
    content,
    preview,
    filename,
    size_bytes: stat.size
  };
}

/**
 * Update an existing sticky note with Optimistic Concurrency Control
 */
export function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    color?: string;
    pinned?: boolean;
    expectedVersion?: number;
    forceOverwrite?: boolean;
  }
): StickyNoteItem {
  const dir = getStickyNotesDir();
  const fileInfo = findFileById(dir, id);

  if (!fileInfo) {
    throw new Error(`Note not found: ${id}`);
  }

  const stat = fs.statSync(fileInfo.filePath);
  const raw = fs.readFileSync(fileInfo.filePath, 'utf-8');
  const existing = parseNoteContent(raw, {
    birthtime: stat.birthtime,
    mtime: stat.mtime,
    filename: fileInfo.filename
  });

  // Concurrency check
  if (
    !data.forceOverwrite &&
    typeof data.expectedVersion === 'number' &&
    existing.metadata.version !== data.expectedVersion
  ) {
    throw new ConcurrencyConflictError(
      `Xung đột phiên chỉnh sửa: Ghi chú đã được cập nhật bởi một phiên hoặc thiết bị khác (phiên bản trên đĩa: v${existing.metadata.version}, phiên bản gửi lên: v${data.expectedVersion}).`,
      {
        currentVersion: existing.metadata.version,
        currentUpdatedAt: existing.metadata.updated_at,
        currentContent: existing.content,
        currentTitle: existing.metadata.title
      }
    );
  }

  // Validate content byte size limit
  const newContent = data.content !== undefined ? data.content : existing.content;
  if (Buffer.byteLength(newContent, 'utf-8') > MAX_CONTENT_BYTES) {
    throw new Error(`Dung lượng nội dung ghi chú vượt quá giới hạn cho phép (${Math.round(MAX_CONTENT_BYTES / 1024)} KB)`);
  }

  const newTitle = data.title !== undefined 
    ? (data.title.trim().slice(0, MAX_TITLE_LENGTH) || 'New Note') 
    : existing.metadata.title;
  const newColor = data.color !== undefined && ALLOWED_COLORS.includes(data.color as any)
    ? (data.color as StickyNoteColor)
    : existing.metadata.color;
  const newPinned = data.pinned !== undefined ? Boolean(data.pinned) : existing.metadata.pinned;

  const now = new Date().toISOString();
  const newVersion = existing.metadata.version + 1;

  const updatedMetadata: StickyNoteMetadata = {
    id: existing.metadata.id,
    title: newTitle,
    color: newColor,
    pinned: newPinned,
    created_at: existing.metadata.created_at,
    updated_at: now,
    version: newVersion
  };

  const serialized = serializeNote(updatedMetadata, newContent);
  const targetFilename = buildFilename(newTitle, id);
  const targetPath = path.join(dir, targetFilename);

  assertPathInside(dir, targetPath);

  // If title changed, target file name may differ from existing file name
  if (fileInfo.filePath !== targetPath) {
    // Write new file first, then remove old file safely
    atomicWriteFile(targetPath, serialized);
    if (fs.existsSync(fileInfo.filePath)) {
      try { fs.unlinkSync(fileInfo.filePath); } catch {}
    }
  } else {
    atomicWriteFile(fileInfo.filePath, serialized);
  }

  const finalStat = fs.statSync(targetPath);
  const preview = extractPreview(newContent);

  return {
    ...updatedMetadata,
    content: newContent,
    preview,
    filename: targetFilename,
    size_bytes: finalStat.size
  };
}

/**
 * Duplicate a note (creates an exact copy with new ID and (Copy) appended to title)
 */
export function duplicateNote(id: string): StickyNoteItem {
  const original = getNoteById(id, false);
  const copyTitle = `${original.title} (Copy)`.slice(0, MAX_TITLE_LENGTH);

  return createNote({
    title: copyTitle,
    content: original.content,
    color: original.color,
    pinned: false // duplicates are unpinned by default
  });
}

/**
 * Move a note to trash
 */
export function moveToTrash(id: string): { success: boolean; message: string } {
  const dir = getStickyNotesDir();
  const trashDir = getStickyNotesTrashDir();
  const fileInfo = findFileById(dir, id);

  if (!fileInfo) {
    throw new Error(`Note not found: ${id}`);
  }

  const targetPath = path.join(trashDir, fileInfo.filename);
  assertPathInside(trashDir, targetPath);

  // If a file with same name already exists in trash, overwrite or rename
  if (fs.existsSync(targetPath)) {
    try { fs.unlinkSync(targetPath); } catch {}
  }

  fs.renameSync(fileInfo.filePath, targetPath);
  return { success: true, message: `Ghi chú đã được chuyển vào thùng rác` };
}

/**
 * Restore a note from trash back to active sticky notes
 */
export function restoreFromTrash(id: string): StickyNoteItem {
  const dir = getStickyNotesDir();
  const trashDir = getStickyNotesTrashDir();
  const fileInfo = findFileById(trashDir, id);

  if (!fileInfo) {
    throw new Error(`Note not found in trash: ${id}`);
  }

  const targetPath = path.join(dir, fileInfo.filename);
  assertPathInside(dir, targetPath);

  if (fs.existsSync(targetPath)) {
    // If active already has a file with this name, generate new filename
    const note = getNoteById(id, true);
    const newFilename = buildFilename(note.title, note.id);
    const newTargetPath = path.join(dir, newFilename);
    fs.renameSync(fileInfo.filePath, newTargetPath);
    return getNoteById(id, false);
  }

  fs.renameSync(fileInfo.filePath, targetPath);
  return getNoteById(id, false);
}

/**
 * Permanently delete a note from trash
 */
export function permanentlyDelete(id: string): { success: boolean; message: string } {
  const trashDir = getStickyNotesTrashDir();
  const fileInfo = findFileById(trashDir, id);

  if (!fileInfo) {
    throw new Error(`Note not found in trash: ${id}`);
  }

  fs.unlinkSync(fileInfo.filePath);
  return { success: true, message: `Đã xóa vĩnh viễn ghi chú khỏi thùng rác` };
}

/**
 * Empty all notes in trash
 */
export function emptyTrash(): { deletedCount: number } {
  const trashDir = getStickyNotesTrashDir();
  assertPathInside(getDataDir(), trashDir);

  if (!fs.existsSync(trashDir)) return { deletedCount: 0 };

  const entries = fs.readdirSync(trashDir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.txt')) {
      const fullPath = path.join(trashDir, entry.name);
      try {
        fs.unlinkSync(fullPath);
        count++;
      } catch {}
    }
  }

  return { deletedCount: count };
}

/**
 * Import a .txt file as a new sticky note
 */
export function importNote(filename: string, rawText: string): StickyNoteItem {
  if (Buffer.byteLength(rawText, 'utf-8') > MAX_CONTENT_BYTES) {
    throw new Error(`File nhập vào vượt quá dung lượng cho phép (${Math.round(MAX_CONTENT_BYTES / 1024)} KB)`);
  }

  const cleanFilename = path.basename(filename).replace(/\.txt$/i, '');
  const { metadata, content } = parseNoteContent(rawText);

  // Has frontmatter title?
  let hasExplicitFrontmatterTitle = false;
  try {
    const parsed = matter(rawText);
    if (parsed.data && typeof parsed.data.title === 'string' && parsed.data.title.trim()) {
      hasExplicitFrontmatterTitle = true;
    }
  } catch {}

  const finalTitle = hasExplicitFrontmatterTitle
    ? metadata.title
    : (cleanFilename.trim().slice(0, MAX_TITLE_LENGTH) || metadata.title || 'Imported Note');

  return createNote({
    title: finalTitle,
    content: content,
    color: metadata.color || DEFAULT_COLOR,
    pinned: false
  });
}
