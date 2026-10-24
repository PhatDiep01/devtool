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

// GET /api/settings/storage - Storage stats
router.get('/storage', (req: Request, res: Response) => {
  try {
    const dataDir = getDataDir();
    const docsDir = path.join(dataDir, 'docs');
    const imagesDir = path.join(dataDir, 'images');

    function getDirStats(dir: string) {
      let count = 0;
      let totalBytes = 0;
      if (!fs.existsSync(dir)) return { count, totalBytes };

      function walk(current: string) {
        const files = fs.readdirSync(current);
        for (const file of files) {
          const fp = path.join(current, file);
          const stat = fs.statSync(fp);
          if (stat.isDirectory()) {
            walk(fp);
          } else {
            count++;
            totalBytes += stat.size;
          }
        }
      }
      walk(dir);
      return { count, totalBytes };
    }

    const docsStats = getDirStats(docsDir);
    const imagesStats = getDirStats(imagesDir);

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    res.json({
      docsPath: docsDir,
      imagesPath: imagesDir,
      totalDocs: docsStats.count,
      totalImages: imagesStats.count,
      docsSize: formatBytes(docsStats.totalBytes),
      imagesSize: formatBytes(imagesStats.totalBytes),
      totalSize: formatBytes(docsStats.totalBytes + imagesStats.totalBytes)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
