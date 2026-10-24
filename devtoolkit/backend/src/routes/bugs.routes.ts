import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { getDataDir } from '../services/file-manager';

const router = Router();

// Storage directory for bug files (images, logs, sample data)
const getBugUploadDir = () => {
  const dir = path.join(getDataDir(), 'bug_files');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getBugUploadDir());
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExts = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
      '.log', '.txt', '.json', '.pdf', '.xlsx', '.xls', '.csv', '.zip'
    ];
    const ext = safeExts.includes(rawExt) ? rawExt : '.bin';
    const uniqueName = `bug_${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExts = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
      '.log', '.txt', '.json', '.pdf', '.xlsx', '.xls', '.csv', '.zip'
    ];
    if (safeExts.includes(rawExt)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Permitted: ${safeExts.join(', ')}`));
    }
  }
});

// GET /api/bugs/files/:filename - Serve uploaded bug attachment
router.get('/files/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(getBugUploadDir(), safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bugs/upload - Upload attachment for a bug
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/api/bugs/files/${file.filename}`;
    const isImage = file.mimetype.startsWith('image/');

    res.json({
      id: uuidv4(),
      url: fileUrl,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      isImage
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bugs - List bugs with filters, search, and summary stats
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { search, status, type, severity } = req.query;

    let query = 'SELECT * FROM bugs WHERE 1=1';
    const params: any[] = [];

    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ' AND (title LIKE ? OR us_key LIKE ? OR description LIKE ? OR fix_solution LIKE ?)';
      params.push(term, term, term, term);
    }

    if (typeof status === 'string' && status !== 'all' && status.trim()) {
      query += ' AND status = ?';
      params.push(status.trim());
    }

    if (typeof type === 'string' && type !== 'all' && type.trim()) {
      query += ' AND type = ?';
      params.push(type.trim().toUpperCase());
    }

    if (typeof severity === 'string' && severity !== 'all' && severity.trim()) {
      query += ' AND severity = ?';
      params.push(severity.trim());
    }

    query += ' ORDER BY updated_at DESC, id DESC';

    const rawBugs = db.prepare(query).all(...params);

    const bugs = rawBugs.map((b: any) => {
      let attachments = [];
      try {
        attachments = JSON.parse(b.attachments || '[]');
      } catch {
        attachments = [];
      }
      return {
        ...b,
        attachments
      };
    });

    // Summary statistics across entire bugs table
    const statsRow = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN type = 'FE' THEN 1 ELSE 0 END) as fe_count,
        SUM(CASE WHEN type = 'BE' THEN 1 ELSE 0 END) as be_count,
        SUM(CASE WHEN type = 'BOTH' THEN 1 ELSE 0 END) as both_count
      FROM bugs
    `).get() || {};

    res.json({
      bugs,
      stats: {
        total: Number(statsRow.total || 0),
        todo: Number(statsRow.todo_count || 0),
        in_progress: Number(statsRow.in_progress_count || 0),
        resolved: Number(statsRow.resolved_count || 0),
        fe_count: Number(statsRow.fe_count || 0),
        be_count: Number(statsRow.be_count || 0),
        both_count: Number(statsRow.both_count || 0)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bugs/:id - Get single bug
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    let attachments = [];
    try {
      attachments = JSON.parse(bug.attachments || '[]');
    } catch {
      attachments = [];
    }

    res.json({
      ...bug,
      attachments
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bugs - Create new bug
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      us_key,
      us_link,
      type = 'FE',
      status = 'todo',
      severity = 'medium',
      description = '',
      fix_solution = '',
      attachments = [],
      created_by = 'QA',
      assigned_to = ''
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Auto-generate Jira link if us_key provided and us_link is empty
    let resolvedUsLink = us_link || '';
    const cleanUsKey = (us_key || '').trim().toUpperCase();
    if (cleanUsKey && !resolvedUsLink) {
      // Default to Jira instance if us_key matches pattern
      if (/^[A-Z0-9]+-\d+$/.test(cleanUsKey)) {
        resolvedUsLink = `https://task.ascvn.com.vn/browse/${cleanUsKey}`;
      }
    }

    const attachmentsJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);
    const db = getDb();

    const insertStmt = db.prepare(`
      INSERT INTO bugs (
        title, us_key, us_link, type, status, severity, 
        description, fix_solution, attachments, created_by, assigned_to,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, 
        datetime('now'), datetime('now')
      )
    `);

    const result = insertStmt.run(
      title.trim(),
      cleanUsKey || null,
      resolvedUsLink.trim() || null,
      type.toUpperCase(),
      status,
      severity,
      description,
      fix_solution,
      attachmentsJson,
      created_by.trim() || null,
      assigned_to.trim() || null
    );

    const newBug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...newBug,
      attachments: JSON.parse(newBug.attachments || '[]')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bugs/:id - Update bug details
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const {
      title = existing.title,
      us_key = existing.us_key,
      us_link = existing.us_link,
      type = existing.type,
      status = existing.status,
      severity = existing.severity,
      description = existing.description,
      fix_solution = existing.fix_solution,
      attachments = JSON.parse(existing.attachments || '[]'),
      created_by = existing.created_by,
      assigned_to = existing.assigned_to
    } = req.body;

    let resolvedUsLink = us_link || '';
    const cleanUsKey = (us_key || '').trim().toUpperCase();
    if (cleanUsKey && !resolvedUsLink && /^[A-Z0-9]+-\d+$/.test(cleanUsKey)) {
      resolvedUsLink = `https://task.ascvn.com.vn/browse/${cleanUsKey}`;
    }

    const attachmentsJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);

    db.prepare(`
      UPDATE bugs SET 
        title = ?,
        us_key = ?,
        us_link = ?,
        type = ?,
        status = ?,
        severity = ?,
        description = ?,
        fix_solution = ?,
        attachments = ?,
        created_by = ?,
        assigned_to = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title.trim(),
      cleanUsKey || null,
      resolvedUsLink.trim() || null,
      type.toUpperCase(),
      status,
      severity,
      description,
      fix_solution,
      attachmentsJson,
      created_by ? created_by.trim() : null,
      assigned_to ? assigned_to.trim() : null,
      id
    );

    const updated = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
    res.json({
      ...updated,
      attachments: JSON.parse(updated.attachments || '[]')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bugs/:id/status - Quick status change with optional fix notes
router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, fix_solution } = req.body;

    if (!status || !['todo', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: todo, in_progress, resolved' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const updatedFixSolution = fix_solution !== undefined ? fix_solution : existing.fix_solution;

    db.prepare(`
      UPDATE bugs SET 
        status = ?, 
        fix_solution = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, updatedFixSolution, id);

    const updated = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
    res.json({
      ...updated,
      attachments: JSON.parse(updated.attachments || '[]')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bugs/:id - Delete bug
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    db.prepare('DELETE FROM bugs WHERE id = ?').run(id);
    res.json({ success: true, id: Number(id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
