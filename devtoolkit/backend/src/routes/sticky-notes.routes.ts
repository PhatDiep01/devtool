import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  listNotes,
  getNoteById,
  createNote,
  updateNote,
  duplicateNote,
  moveToTrash,
  restoreFromTrash,
  permanentlyDelete,
  emptyTrash,
  importNote,
  ConcurrencyConflictError,
  ALLOWED_COLORS,
  DEFAULT_COLOR
} from '../services/sticky-notes-manager';

const router = Router();
const upload = multer({ 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB upload max limit
  storage: multer.memoryStorage() 
});

/**
 * GET /api/sticky-notes
 * Get active sticky notes with filtering and sorting
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { search, color, sortBy, sortOrder } = req.query;
    const result = listNotes({
      search: typeof search === 'string' ? search : undefined,
      color: typeof color === 'string' ? color : undefined,
      sortBy: sortBy === 'title' || sortBy === 'created_at' || sortBy === 'updated_at' ? sortBy : 'updated_at',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      isTrash: false
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error listing sticky notes:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi đọc danh sách ghi chú' });
  }
});

/**
 * GET /api/sticky-notes/trash
 * List notes in trash
 */
router.get('/trash', (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const result = listNotes({
      search: typeof search === 'string' ? search : undefined,
      sortBy: 'updated_at',
      sortOrder: 'desc',
      isTrash: true
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error listing trash sticky notes:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi đọc thùng rác' });
  }
});

/**
 * DELETE /api/sticky-notes/trash
 * Empty all notes in trash
 */
router.delete('/trash', (req: Request, res: Response) => {
  try {
    const result = emptyTrash();
    res.json({ message: `Đã dọn dẹp ${result.deletedCount} ghi chú trong thùng rác`, deletedCount: result.deletedCount });
  } catch (err: any) {
    console.error('Error emptying trash:', err);
    res.status(500).json({ error: err.message || 'Lỗi khi dọn thùng rác' });
  }
});

/**
 * GET /api/sticky-notes/:id
 * Get single note details
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const isTrash = req.query.trash === 'true';
    const note = getNoteById(req.params.id, isTrash);
    res.json(note);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Không tìm thấy ghi chú' });
  }
});

/**
 * POST /api/sticky-notes
 * Create a new sticky note
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, content, color, pinned } = req.body;
    const note = createNote({ title, content, color, pinned });
    res.status(201).json(note);
  } catch (err: any) {
    console.error('Error creating sticky note:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi tạo ghi chú mới' });
  }
});

/**
 * PUT /api/sticky-notes/:id
 * Update a sticky note with optimistic concurrency check
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { title, content, color, pinned, expectedVersion, forceOverwrite } = req.body;
    const note = updateNote(req.params.id, {
      title,
      content,
      color,
      pinned,
      expectedVersion: typeof expectedVersion === 'number' ? expectedVersion : undefined,
      forceOverwrite: Boolean(forceOverwrite)
    });
    res.json(note);
  } catch (err: any) {
    if (err instanceof ConcurrencyConflictError) {
      return res.status(409).json({
        error: err.message,
        conflict: true,
        conflictData: err.conflictData
      });
    }
    console.error('Error updating sticky note:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi cập nhật ghi chú' });
  }
});

/**
 * POST /api/sticky-notes/:id/duplicate
 * Duplicate a sticky note
 */
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const note = duplicateNote(req.params.id);
    res.status(201).json(note);
  } catch (err: any) {
    console.error('Error duplicating sticky note:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi nhân bản ghi chú' });
  }
});

/**
 * POST /api/sticky-notes/:id/trash
 * Move note to trash
 */
router.post('/:id/trash', (req: Request, res: Response) => {
  try {
    const result = moveToTrash(req.params.id);
    res.json(result);
  } catch (err: any) {
    console.error('Error moving note to trash:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi chuyển ghi chú vào thùng rác' });
  }
});

/**
 * POST /api/sticky-notes/:id/restore
 * Restore note from trash
 */
router.post('/:id/restore', (req: Request, res: Response) => {
  try {
    const note = restoreFromTrash(req.params.id);
    res.json(note);
  } catch (err: any) {
    console.error('Error restoring note from trash:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi khôi phục ghi chú' });
  }
});

/**
 * DELETE /api/sticky-notes/:id/permanent
 * Permanently delete note from trash
 */
router.delete('/:id/permanent', (req: Request, res: Response) => {
  try {
    const result = permanentlyDelete(req.params.id);
    res.json(result);
  } catch (err: any) {
    console.error('Error permanently deleting note:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi xóa vĩnh viễn ghi chú' });
  }
});

/**
 * POST /api/sticky-notes/import
 * Import note from multipart file upload or JSON raw text
 */
router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    let filename = 'imported-note.txt';
    let rawText = '';

    if (req.file) {
      filename = req.file.originalname || filename;
      rawText = req.file.buffer.toString('utf-8');
    } else if (req.body && req.body.rawText) {
      filename = req.body.filename || filename;
      rawText = String(req.body.rawText);
    } else {
      return res.status(400).json({ error: 'Vui lòng cung cấp file hoặc văn bản hợp lệ để nhập' });
    }

    const note = importNote(filename, rawText);
    res.status(201).json(note);
  } catch (err: any) {
    console.error('Error importing sticky note:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi nhập file ghi chú' });
  }
});

/**
 * GET /api/sticky-notes/:id/export
 * Download note as a clean .txt file
 */
router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const rawFormat = req.query.raw === 'true';
    const note = getNoteById(req.params.id, false);

    // If rawFormat is requested, download file as is (with metadata frontmatter)
    // Otherwise export clean readable text for Notepad
    let exportContent = '';
    if (rawFormat) {
      exportContent = [
        '---',
        `title: "${note.title.replace(/"/g, '\\"')}"`,
        `color: ${note.color}`,
        `created_at: ${note.created_at}`,
        `updated_at: ${note.updated_at}`,
        '---',
        '',
        note.content
      ].join('\n');
    } else {
      exportContent = [
        `=== ${note.title.toUpperCase()} ===`,
        `Thời gian tạo: ${new Date(note.created_at).toLocaleString('vi-VN')}`,
        `Cập nhật lần cuối: ${new Date(note.updated_at).toLocaleString('vi-VN')}`,
        '----------------------------------------',
        '',
        note.content
      ].join('\n');
    }

    const safeDownloadName = encodeURIComponent(`${note.title.replace(/[\/\\:*?"<>|]/g, '_')}.txt`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"; filename*=UTF-8''${safeDownloadName}`);
    res.send(exportContent);
  } catch (err: any) {
    console.error('Error exporting sticky note:', err);
    res.status(404).json({ error: err.message || 'Không tìm thấy ghi chú để xuất' });
  }
});

export default router;
