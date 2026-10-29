import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { getDataDir, assertPathInside } from '../services/file-manager';

const router = Router();
const getUploadDir = () => {
  const dir = path.join(getDataDir(), 'images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    // Sanitize extension and force UUID naming
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(rawExt)
      ? rawExt
      : '.png';
    const uniqueName = `${uuidv4()}${safeExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeAllowed = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i.test(file.mimetype);

    if (allowedExts.includes(ext) && mimeAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type: Only safe images (jpg, png, gif, webp, svg) are permitted'));
    }
  }
});

const uploadMiddleware = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

// POST /api/files/upload - Single image upload
router.post('/upload', uploadMiddleware, (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = req.file || files?.['image']?.[0] || files?.['file']?.[0];
    if (!file) return res.status(400).json({ error: 'No image uploaded' });

    const screenId = req.body.screen_id ? Number(req.body.screen_id) : null;
    const db = getDb();

    // If SVG, check for dangerous script tags, foreignObjects, and event handlers
    if (file.filename.endsWith('.svg')) {
      const fullPath = path.join(getUploadDir(), file.filename);
      try {
        const svgContent = fs.readFileSync(fullPath, 'utf-8');
        const hasDangerousTag = /<\s*(script|object|embed|foreignObject|iframe|animate|set)/i.test(svgContent);
        const hasEventHandler = /\bon[a-z]+\s*=/i.test(svgContent);
        const hasJsProtocol = /(javascript|vbscript|data\s*:)/i.test(svgContent);

        if (hasDangerousTag || hasEventHandler || hasJsProtocol) {
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          return res.status(400).json({ 
            error: 'Security Warning: SVG rejected due to embedded scripts, dangerous tags, or active event handlers' 
          });
        }
      } catch (e) {
        // Continue if read fails
      }
    }

    const stmt = db.prepare(`
      INSERT INTO images (screen_id, original_name, stored_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run(screenId, path.basename(file.originalname), file.filename, file.mimetype, file.size);
    const url = `/api/files/images/${file.filename}`;

    res.status(201).json({
      id: info.lastInsertRowid,
      originalName: path.basename(file.originalname),
      storedName: file.filename,
      url,
      sizeBytes: file.size
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/files/screen/:screenId - Get all images for a specific screen
router.get('/screen/:screenId', (req: Request, res: Response) => {
  try {
    const { screenId } = req.params;
    const db = getDb();
    const rows: any[] = db.prepare(`
      SELECT id, screen_id, original_name, stored_name, mime_type, size_bytes, created_at
      FROM images
      WHERE screen_id = ?
      ORDER BY id DESC
    `).all(screenId);

    const images = rows.map(r => ({
      ...r,
      url: `/api/files/images/${r.stored_name}`
    }));

    res.json(images);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/files/link-screen - Link uploaded images to a screen
router.post('/link-screen', (req: Request, res: Response) => {
  try {
    const { screenId, imageIds, storedNames } = req.body;
    if (!screenId) return res.status(400).json({ error: 'screenId is required' });

    const db = getDb();
    if (Array.isArray(imageIds) && imageIds.length > 0) {
      const placeholders = imageIds.map(() => '?').join(',');
      db.prepare(`UPDATE images SET screen_id = ? WHERE id IN (${placeholders})`).run(screenId, ...imageIds);
    }
    if (Array.isArray(storedNames) && storedNames.length > 0) {
      const placeholders = storedNames.map(() => '?').join(',');
      db.prepare(`UPDATE images SET screen_id = ? WHERE stored_name IN (${placeholders})`).run(screenId, ...storedNames);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/files/:id - File info
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const image: any = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });
    res.json(image);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/files/by-name/:storedName - Delete image by stored filename
router.delete('/by-name/:storedName', (req: Request, res: Response) => {
  try {
    const { storedName } = req.params;
    const db = getDb();
    const safeStoredName = path.basename(storedName);
    const filePath = path.join(getUploadDir(), safeStoredName);
    assertPathInside(getUploadDir(), filePath);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    db.prepare('DELETE FROM images WHERE stored_name = ?').run(safeStoredName);
    res.json({ message: 'Image deleted successfully by filename' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/files/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const image: any = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const safeStoredName = path.basename(image.stored_name);
    const filePath = path.join(getUploadDir(), safeStoredName);
    assertPathInside(getUploadDir(), filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM images WHERE id = ?').run(id);
    res.json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
