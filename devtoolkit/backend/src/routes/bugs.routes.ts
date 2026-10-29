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

/**
 * Scans bug_files directory and removes any files not referenced by any bug in SQLite.
 */
export function cleanupOrphanBugFiles() {
  try {
    const db = getDb();
    const bugs: any[] = db.prepare('SELECT attachments FROM bugs').all();
    const referencedFiles = new Set<string>();

    for (const b of bugs) {
      try {
        const atts = JSON.parse(b.attachments || '[]');
        if (Array.isArray(atts)) {
          for (const a of atts) {
            const fname = a.filename || (a.url ? path.basename(a.url) : null);
            if (fname) referencedFiles.add(path.basename(fname));
          }
        }
      } catch (e) {}
    }

    const uploadDir = getBugUploadDir();
    if (fs.existsSync(uploadDir)) {
      const filesOnDisk = fs.readdirSync(uploadDir);
      for (const file of filesOnDisk) {
        if (!referencedFiles.has(file)) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
            console.log(`[BugFiles] Cleaned up orphan file: ${file}`);
          } catch (err) {
            console.warn(`[BugFiles] Could not remove orphan file ${file}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[BugFiles] Error cleaning orphan bug files:', err);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getBugUploadDir());
  },
  filename: (req, file, cb) => {
    let rawExt = path.extname(file.originalname).toLowerCase();
    if (!rawExt && file.mimetype) {
      if (file.mimetype === 'image/jpeg') rawExt = '.jpg';
      else if (file.mimetype === 'image/png') rawExt = '.png';
      else if (file.mimetype === 'image/gif') rawExt = '.gif';
      else if (file.mimetype === 'image/webp') rawExt = '.webp';
      else if (file.mimetype === 'image/svg+xml') rawExt = '.svg';
    }
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
    let rawExt = path.extname(file.originalname).toLowerCase();
    if (!rawExt && file.mimetype) {
      if (file.mimetype === 'image/jpeg') rawExt = '.jpg';
      else if (file.mimetype === 'image/png') rawExt = '.png';
      else if (file.mimetype === 'image/gif') rawExt = '.gif';
      else if (file.mimetype === 'image/webp') rawExt = '.webp';
      else if (file.mimetype === 'image/svg+xml') rawExt = '.svg';
    }
    const safeExts = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
      '.log', '.txt', '.json', '.pdf', '.xlsx', '.xls', '.csv', '.zip'
    ];
    if (safeExts.includes(rawExt) || (file.mimetype && file.mimetype.startsWith('image/'))) {
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

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
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
    const { search, status, type, severity, has_annotations } = req.query;

    let query = `
      SELECT b.*,
        (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') AS annotated_images_count
      FROM bugs b WHERE 1=1
    `;
    const params: any[] = [];

    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ' AND (b.title LIKE ? OR b.us_key LIKE ? OR b.description LIKE ? OR b.fix_solution LIKE ? OR b.payload LIKE ?)';
      params.push(term, term, term, term, term);
    }

    if (typeof status === 'string' && status !== 'all' && status.trim()) {
      query += ' AND b.status = ?';
      params.push(status.trim());
    }

    if (typeof type === 'string' && type !== 'all' && type.trim()) {
      query += ' AND b.type = ?';
      params.push(type.trim().toUpperCase());
    }

    if (typeof severity === 'string' && severity !== 'all' && severity.trim()) {
      query += ' AND b.severity = ?';
      params.push(severity.trim());
    }

    if (has_annotations === 'yes') {
      query += ` AND (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') > 0`;
    } else if (has_annotations === 'no') {
      query += ` AND (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') = 0`;
    }

    query += ' ORDER BY b.updated_at DESC, b.id DESC';

    const rawBugs = db.prepare(query).all(...params);

    // Load all annotations for these bugs in a single fast query
    const bugIds = rawBugs.map((b: any) => b.id);
    const annotationsByBug: Record<number, Record<string, any>> = {};
    if (bugIds.length > 0) {
      const placeholders = bugIds.map(() => '?').join(',');
      const allAnnotations = db.prepare(`SELECT * FROM bug_annotations WHERE bug_id IN (${placeholders})`).all(...bugIds);
      for (const a of allAnnotations) {
        if (!annotationsByBug[a.bug_id]) annotationsByBug[a.bug_id] = {};
        try {
          annotationsByBug[a.bug_id][a.image_id] = {
            ...a,
            annotations: JSON.parse(a.annotations || '[]')
          };
        } catch {
          annotationsByBug[a.bug_id][a.image_id] = {
            ...a,
            annotations: []
          };
        }
      }
    }

    const bugs = rawBugs.map((b: any) => {
      let attachments = [];
      try {
        attachments = JSON.parse(b.attachments || '[]');
      } catch {
        attachments = [];
      }
      const annotatedImagesCount = Number(b.annotated_images_count || 0);
      return {
        ...b,
        attachments,
        annotations: annotationsByBug[b.id] || {},
        annotated_images_count: annotatedImagesCount,
        has_annotations: annotatedImagesCount > 0
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
        SUM(CASE WHEN type = 'BOTH' THEN 1 ELSE 0 END) as both_count,
        SUM(CASE WHEN (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = bugs.id AND ba.annotations != '[]' AND ba.annotations != '') > 0 THEN 1 ELSE 0 END) as annotated_count
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
        both_count: Number(statsRow.both_count || 0),
        annotated_count: Number(statsRow.annotated_count || 0)
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
    const bug = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM bug_annotations ba WHERE ba.bug_id = b.id AND ba.annotations != '[]' AND ba.annotations != '') AS annotated_images_count
      FROM bugs b WHERE b.id = ?
    `).get(id);

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    let attachments = [];
    try {
      attachments = JSON.parse(bug.attachments || '[]');
    } catch {
      attachments = [];
    }

    // Load annotations for all images of this bug
    const annotationRows = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ?').all(id);
    const annotationsByImage: Record<string, any> = {};
    for (const row of annotationRows) {
      try {
        annotationsByImage[row.image_id] = {
          id: row.id,
          bug_id: row.bug_id,
          image_id: row.image_id,
          annotations: JSON.parse(row.annotations || '[]'),
          version: row.version,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      } catch {
        annotationsByImage[row.image_id] = {
          id: row.id,
          bug_id: row.bug_id,
          image_id: row.image_id,
          annotations: [],
          version: row.version,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      }
    }

    const annotatedImagesCount = Number(bug.annotated_images_count || 0);

    res.json({
      ...bug,
      attachments,
      annotations: annotationsByImage,
      annotated_images_count: annotatedImagesCount,
      has_annotations: annotatedImagesCount > 0
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
      payload = null,
      fix_solution = '',
      attachments = [],
      created_by = 'QA',
      assigned_to = null
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Auto-generate Jira link if us_key provided and us_link is empty
    let resolvedUsLink = (typeof us_link === 'string') ? us_link.trim() : '';
    const cleanUsKey = (typeof us_key === 'string') ? us_key.trim().toUpperCase() : '';
    if (cleanUsKey && !resolvedUsLink) {
      // Default to Jira instance if us_key matches pattern
      if (/^[A-Z0-9]+-\d+$/.test(cleanUsKey)) {
        resolvedUsLink = `https://task.ascvn.com.vn/browse/${cleanUsKey}`;
      }
    }

    const attachmentsJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);
    const cleanCreatedBy = (typeof created_by === 'string' && created_by.trim()) ? created_by.trim() : null;
    const cleanAssignedTo = (typeof assigned_to === 'string' && assigned_to.trim()) ? assigned_to.trim() : null;
    const cleanPayload = (typeof payload === 'string' && payload.trim()) 
      ? payload.trim() 
      : (payload && typeof payload === 'object' ? JSON.stringify(payload, null, 2) : null);
    const cleanType = (typeof type === 'string' && type.trim()) ? type.trim().toUpperCase() : 'FE';
    const cleanStatus = (typeof status === 'string' && status.trim()) ? status.trim() : 'todo';
    const cleanSeverity = (typeof severity === 'string' && severity.trim()) ? severity.trim() : 'medium';

    const db = getDb();

    const insertStmt = db.prepare(`
      INSERT INTO bugs (
        title, us_key, us_link, type, status, severity, 
        description, payload, fix_solution, attachments, created_by, assigned_to,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, 
        datetime('now'), datetime('now')
      )
    `);

    const result = insertStmt.run(
      title.trim(),
      cleanUsKey || null,
      resolvedUsLink || null,
      cleanType,
      cleanStatus,
      cleanSeverity,
      typeof description === 'string' ? description : '',
      cleanPayload,
      typeof fix_solution === 'string' ? fix_solution : '',
      attachmentsJson,
      cleanCreatedBy,
      cleanAssignedTo
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
      payload = existing.payload,
      fix_solution = existing.fix_solution,
      attachments = JSON.parse(existing.attachments || '[]'),
      created_by = existing.created_by,
      assigned_to = existing.assigned_to
    } = req.body;

    const cleanTitle = (typeof title === 'string' && title.trim()) ? title.trim() : existing.title;
    let resolvedUsLink = (typeof us_link === 'string') ? us_link.trim() : '';
    const cleanUsKey = (typeof us_key === 'string') ? us_key.trim().toUpperCase() : '';
    if (cleanUsKey && !resolvedUsLink && /^[A-Z0-9]+-\d+$/.test(cleanUsKey)) {
      resolvedUsLink = `https://task.ascvn.com.vn/browse/${cleanUsKey}`;
    }

    const cleanType = (typeof type === 'string' && type.trim()) ? type.trim().toUpperCase() : existing.type;
    const cleanStatus = (typeof status === 'string' && status.trim()) ? status.trim() : existing.status;
    const cleanSeverity = (typeof severity === 'string' && severity.trim()) ? severity.trim() : existing.severity;
    const cleanDescription = description !== undefined ? (typeof description === 'string' ? description : '') : existing.description;
    const cleanFixSolution = fix_solution !== undefined ? (typeof fix_solution === 'string' ? fix_solution : '') : existing.fix_solution;
    const cleanPayload = payload !== undefined 
      ? ((typeof payload === 'string' && payload.trim()) ? payload.trim() : (payload && typeof payload === 'object' ? JSON.stringify(payload, null, 2) : null))
      : existing.payload;
    const cleanCreatedBy = created_by !== undefined 
      ? ((typeof created_by === 'string' && created_by.trim()) ? created_by.trim() : null)
      : existing.created_by;
    const cleanAssignedTo = assigned_to !== undefined 
      ? ((typeof assigned_to === 'string' && assigned_to.trim()) ? assigned_to.trim() : null)
      : existing.assigned_to;

    const attachmentsJson = JSON.stringify(Array.isArray(attachments) ? attachments : []);

    // Clean up physical files for any attachments that were removed in this edit
    try {
      const oldAttachments = JSON.parse(existing.attachments || '[]');
      const newAttachments = Array.isArray(attachments) ? attachments : [];
      const newFilenames = new Set(newAttachments.map((a: any) => a.filename || (a.url ? path.basename(a.url) : '')));

      const uploadDir = getBugUploadDir();
      if (Array.isArray(oldAttachments)) {
        for (const oldAtt of oldAttachments) {
          const oldFilename = oldAtt.filename || (oldAtt.url ? path.basename(oldAtt.url) : '');
          if (oldFilename && !newFilenames.has(oldFilename)) {
            const safeFilename = path.basename(oldFilename);
            const filePath = path.join(uploadDir, safeFilename);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`[BugFiles] Deleted removed attachment: ${safeFilename}`);
              } catch (e) {
                console.warn(`Could not unlink removed attachment ${filePath}:`, e);
              }
            }
          }
        }
      }

      // Clean up annotations for removed attachments
      if (Array.isArray(oldAttachments)) {
        for (const oldAtt of oldAttachments) {
          const oldImageId = oldAtt.id || oldAtt.filename || (oldAtt.url ? path.basename(oldAtt.url) : '');
          const isStillPresent = newAttachments.some((na: any) => (na.id || na.filename || (na.url ? path.basename(na.url) : '')) === oldImageId);
          if (oldImageId && !isStillPresent) {
            db.prepare('DELETE FROM bug_annotations WHERE bug_id = ? AND image_id = ?').run(id, oldImageId);
          }
        }
      }
    } catch (e) {
      console.warn('Error cleaning removed attachments on bug update:', e);
    }

    db.prepare(`
      UPDATE bugs SET 
        title = ?,
        us_key = ?,
        us_link = ?,
        type = ?,
        status = ?,
        severity = ?,
        description = ?,
        payload = ?,
        fix_solution = ?,
        attachments = ?,
        created_by = ?,
        assigned_to = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      cleanTitle,
      cleanUsKey || null,
      resolvedUsLink || null,
      cleanType,
      cleanStatus,
      cleanSeverity,
      cleanDescription,
      cleanPayload,
      cleanFixSolution,
      attachmentsJson,
      cleanCreatedBy,
      cleanAssignedTo,
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

// DELETE /api/bugs/:id - Delete bug and its attachment files on disk
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    // Delete attached physical files from disk
    try {
      const attachments = JSON.parse(existing.attachments || '[]');
      const uploadDir = getBugUploadDir();
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          const filename = att.filename || (att.url ? path.basename(att.url) : null);
          if (filename) {
            const safeFilename = path.basename(filename);
            const filePath = path.join(uploadDir, safeFilename);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`[BugFiles] Deleted attachment file: ${safeFilename}`);
              } catch (e) {
                console.warn(`Could not unlink ${filePath}:`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error parsing attachments during bug deletion:', e);
    }

    // Delete associated annotations for this bug
    db.prepare('DELETE FROM bug_annotations WHERE bug_id = ?').run(id);
    db.prepare('DELETE FROM bugs WHERE id = ?').run(id);

    // Run orphan cleanup check
    cleanupOrphanBugFiles();

    res.json({ success: true, id: Number(id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bugs/:id/annotations - Get all annotations for a bug
router.get('/:id/annotations', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const bug = db.prepare('SELECT id FROM bugs WHERE id = ?').get(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const rows = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ?').all(id);
    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.image_id] = {
          ...row,
          annotations: JSON.parse(row.annotations || '[]')
        };
      } catch {
        result[row.image_id] = {
          ...row,
          annotations: []
        };
      }
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bugs/:id/annotations/:imageId - Get annotations for a specific image
router.get('/:id/annotations/:imageId', (req: Request, res: Response) => {
  try {
    const { id, imageId } = req.params;
    const db = getDb();
    const bug = db.prepare('SELECT id FROM bugs WHERE id = ?').get(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const row = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(id, imageId);
    if (!row) {
      return res.json({
        bug_id: Number(id),
        image_id: imageId,
        annotations: [],
        version: 0
      });
    }

    let parsedAnnotations = [];
    try {
      parsedAnnotations = JSON.parse(row.annotations || '[]');
    } catch {
      parsedAnnotations = [];
    }

    res.json({
      id: row.id,
      bug_id: row.bug_id,
      image_id: row.image_id,
      annotations: parsedAnnotations,
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bugs/:id/annotations/:imageId - Save annotations for an image
router.put('/:id/annotations/:imageId', (req: Request, res: Response) => {
  try {
    const { id, imageId } = req.params;
    const { annotations, version, force } = req.body;

    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Annotations must be an array' });
    }

    const db = getDb();
    const bug = db.prepare('SELECT id FROM bugs WHERE id = ?').get(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const existing = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(id, imageId);

    // Optimistic concurrency check if version was supplied and record already exists (unless force is true)
    if (!force && existing && typeof version === 'number' && version > 0) {
      if (existing.version > version) {
        let existingAnnotations = [];
        try { existingAnnotations = JSON.parse(existing.annotations || '[]'); } catch {}
        return res.status(409).json({
          error: 'Concurrency conflict: annotations have been modified by another session',
          currentVersion: existing.version,
          data: {
            ...existing,
            annotations: existingAnnotations
          }
        });
      }
    }

    const jsonString = JSON.stringify(annotations);

    if (existing) {
      db.prepare(`
        UPDATE bug_annotations SET
          annotations = ?,
          version = version + 1,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(jsonString, existing.id);
    } else {
      db.prepare(`
        INSERT INTO bug_annotations (bug_id, image_id, annotations, version, created_at, updated_at)
        VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      `).run(id, imageId, jsonString);
    }

    const updated = db.prepare('SELECT * FROM bug_annotations WHERE bug_id = ? AND image_id = ?').get(id, imageId);
    res.json({
      ...updated,
      annotations: JSON.parse(updated.annotations || '[]')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bugs/:id/annotations/:imageId - Delete annotations for an image
router.delete('/:id/annotations/:imageId', (req: Request, res: Response) => {
  try {
    const { id, imageId } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM bug_annotations WHERE bug_id = ? AND image_id = ?').run(id, imageId);
    res.json({ success: true, bug_id: Number(id), image_id: imageId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bugs/cleanup-orphans - Trigger orphan cleanup
router.post('/cleanup-orphans', (req: Request, res: Response) => {
  cleanupOrphanBugFiles();
  res.json({ success: true, message: 'Orphan files cleaned up' });
});

export default router;
