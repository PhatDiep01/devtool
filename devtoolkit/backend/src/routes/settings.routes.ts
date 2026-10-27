import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/sqlite';
import { getDataDir } from '../services/file-manager';

const router = Router();

// GET /api/settings - Get settings
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows: any[] = db.prepare('SELECT key, value, category FROM settings').all();
    const result: Record<string, Record<string, string>> = {};

    rows.forEach(r => {
      if (!result[r.category]) result[r.category] = {};
      // Mask api token for security
      if (r.key === 'jira_api_token' && r.value) {
        result[r.category][r.key] = '••••••••••••';
      } else {
        result[r.category][r.key] = r.value;
      }
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings - Bulk upsert settings
router.put('/', (req: Request, res: Response) => {
  try {
    const items: Array<{ key: string; value: string; category?: string }> = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array of settings' });

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, category)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category
    `);

    for (const item of items) {
      if (item.key === 'jira_api_token' && item.value === '••••••••••••') continue;
      stmt.run(item.key, item.value, item.category || 'general');
    }

    res.json({ success: true, message: 'Settings saved' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/jira/test - Test credentials
router.post('/jira/test', async (req: Request, res: Response) => {
  try {
    let { baseUrl, email, apiToken } = req.body;
    const db = getDb();

    // If token is masked, pull existing token from DB
    if (apiToken === '••••••••••••' || !apiToken) {
      const existing: any = db.prepare("SELECT value FROM settings WHERE key = 'jira_api_token'").get();
      if (existing) apiToken = existing.value;
    }

    if (!baseUrl || !apiToken) {
      return res.status(400).json({ success: false, message: 'Base URL và API Token là bắt buộc' });
    }

    let cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(cleanBaseUrl)) {
      cleanBaseUrl = 'https://' + cleanBaseUrl;
    }

    const cleanToken = apiToken.trim();
    const cleanEmail = (email || '').trim();

    // Try Bearer token first, or Basic auth if email provided
    let resp: any = null;
    let authHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;

    try {
      resp = await axios.get(`${cleanBaseUrl}/rest/api/2/myself`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeout: 8000
      });
    } catch (e1) {
      try {
        resp = await axios.get(`${cleanBaseUrl}/rest/api/3/myself`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          timeout: 8000
        });
      } catch (e2) {
        if (cleanEmail) {
          const basicAuth = `Basic ${Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64')}`;
          resp = await axios.get(`${cleanBaseUrl}/rest/api/3/myself`, {
            headers: { Authorization: basicAuth, Accept: 'application/json' },
            timeout: 8000
          });
        } else {
          throw e2;
        }
      }
    }

    const user = resp.data;
    res.json({
      success: true,
      message: `Kết nối thành công với tài khoản: ${user.displayName || user.name || 'Jira User'} (${user.emailAddress || cleanEmail || 'PAT Token'})`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Không thể kết nối đến máy chủ Jira'
    });
  }
});

// GET /api/settings/storage - Comprehensive storage metrics
router.get('/storage', (req: Request, res: Response) => {
  try {
    const dataDir = getDataDir();
    const db = getDb();

    function getDirStats(dir: string, ignoreTrash = false) {
      let count = 0;
      let totalBytes = 0;
      if (!fs.existsSync(dir)) return { count, totalBytes };

      function walk(current: string) {
        try {
          const entries = fs.readdirSync(current, { withFileTypes: true });
          for (const entry of entries) {
            const fp = path.join(current, entry.name);
            if (entry.isDirectory()) {
              if (ignoreTrash && entry.name === '.trash') continue;
              walk(fp);
            } else if (entry.isFile()) {
              try {
                const stat = fs.statSync(fp);
                count++;
                totalBytes += stat.size;
              } catch {}
            }
          }
        } catch {}
      }
      walk(dir);
      return { count, totalBytes };
    }

    const formatBytes = (bytes: number) => {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // 1. Docs, Templates & Schemas
    const docsDir = path.join(dataDir, 'docs');
    const templatesDir = path.join(dataDir, 'templates');
    const schemasDir = path.join(dataDir, 'schemas');
    const docsStats = getDirStats(docsDir);
    const templateStats = getDirStats(templatesDir);
    const schemaStats = getDirStats(schemasDir);

    let dbScreensCount = 0;
    let dbModulesCount = 0;
    try {
      const scr = db.prepare('SELECT COUNT(*) as cnt FROM screens').get() as any;
      dbScreensCount = Number(scr?.cnt || 0);
      const mod = db.prepare('SELECT COUNT(*) as cnt FROM modules').get() as any;
      dbModulesCount = Number(mod?.cnt || 0);
    } catch {}

    const totalDocsCount = docsStats.count + templateStats.count + schemaStats.count + dbScreensCount;
    const totalDocsBytes = docsStats.totalBytes + templateStats.totalBytes + schemaStats.totalBytes;

    // 2. Images & Uploaded Files (both generic images and bug attachments)
    const imagesDir = path.join(dataDir, 'images');
    const bugFilesDir = path.join(dataDir, 'bug_files');
    const imagesStats = getDirStats(imagesDir);
    const bugFilesStats = getDirStats(bugFilesDir);

    const totalImagesCount = imagesStats.count + bugFilesStats.count;
    const totalImagesBytes = imagesStats.totalBytes + bugFilesStats.totalBytes;

    // 3. Sticky Notes
    const stickyNotesDir = path.join(dataDir, 'sticky_notes');
    const stickyStats = getDirStats(stickyNotesDir, true);

    // 4. Database Files
    let dbTotalBytes = 0;
    ['devtoolkit.db', 'devtoolkit.db-wal', 'devtoolkit.db-shm'].forEach((name) => {
      const p = path.join(dataDir, name);
      if (fs.existsSync(p)) {
        try {
          dbTotalBytes += fs.statSync(p).size;
        } catch {}
      }
    });

    // 5. Overall Persistent Storage
    const overallStats = getDirStats(dataDir);

    res.json({
      dataDir,
      docsPath: docsDir,
      imagesPath: imagesDir,
      bugFilesPath: bugFilesDir,
      // Backward compatible fields
      totalDocs: totalDocsCount,
      totalImages: totalImagesCount,
      docsSize: formatBytes(totalDocsBytes),
      imagesSize: formatBytes(totalImagesBytes),
      totalSize: formatBytes(overallStats.totalBytes),
      // Detailed breakdown
      totalStickyNotes: stickyStats.count,
      stickyNotesSize: formatBytes(stickyStats.totalBytes),
      databaseSize: formatBytes(dbTotalBytes),
      overallFileCount: overallStats.count,
      dbScreensCount,
      dbModulesCount,
      bugFilesCount: bugFilesStats.count,
      genericImagesCount: imagesStats.count
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/restart - Gracefully exit process so NSSM automatically relaunches updated build
router.post('/restart', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is restarting...' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

export default router;
