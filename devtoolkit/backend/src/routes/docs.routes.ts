import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/sqlite';
import { parseMarkdown } from '../services/markdown-parser';
import { 
  saveMarkdownFile, 
  deleteMarkdownFile, 
  readMarkdownFile, 
  sanitizeSlug, 
  getDataDir 
} from '../services/file-manager';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max for markdown
});

/**
 * Sync markdown files from persistent disk to SQLite database
 */
export function syncDocumentsFromDisk(db: any, force = false): number {
  let syncedCount = 0;
  try {
    if (!force) {
      const countResult: any = db.prepare('SELECT COUNT(*) as cnt FROM screens').get();
      if (countResult && countResult.cnt > 0) return 0;
    }

    const dataDir = getDataDir();
    const modulesDir = path.join(dataDir, 'docs', 'modules');
    if (!fs.existsSync(modulesDir)) return 0;

    const moduleFolders = fs.readdirSync(modulesDir);
    for (const folder of moduleFolders) {
      const folderPath = path.join(modulesDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseMarkdown(content);

        const modName = parsed.frontmatter.module || folder.replace(/-/g, ' ');
        const modSlug = sanitizeSlug(folder);

        let modRecord: any = db.prepare('SELECT * FROM modules WHERE slug = ?').get(modSlug);
        let modId: number;
        if (!modRecord) {
          const info = db.prepare('INSERT INTO modules (name, slug, icon) VALUES (?, ?, ?)').run(modName, modSlug, '📊');
          modId = Number(info.lastInsertRowid);
        } else {
          modId = modRecord.id;
        }

        const title = parsed.frontmatter.title || file.replace(/\.md$/i, '');
        const screenSlug = sanitizeSlug(parsed.frontmatter.screen || title);
        const relPath = path.join('docs', 'modules', modSlug, file);

        db.prepare(`
          INSERT INTO screens (
            module_id, title, slug, file_path, author, status, tags, jira_key, overview, raw_content, parsed_data, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(module_id, slug) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            status = excluded.status,
            tags = excluded.tags,
            jira_key = excluded.jira_key,
            overview = excluded.overview,
            raw_content = excluded.raw_content,
            parsed_data = excluded.parsed_data,
            updated_at = datetime('now')
        `).run(
          modId,
          title,
          screenSlug,
          relPath,
          parsed.frontmatter.author || 'Author',
          parsed.frontmatter.status || 'Published',
          JSON.stringify(parsed.frontmatter.tags || []),
          parsed.frontmatter.jira || null,
          parsed.sections.overview || '',
          content,
          JSON.stringify(parsed)
        );
        syncedCount++;
      }
    }
  } catch (err) {
    console.warn('Document disk sync non-fatal warning:', err);
  }
  return syncedCount;
}

function checkAndSeedDocuments(db: any) {
  syncDocumentsFromDisk(db, false);
}

// --- MODULES ---

// GET /api/docs/modules - List all modules with screen count
router.get('/modules', (req: Request, res: Response) => {
  try {
    const db = getDb();
    checkAndSeedDocuments(db);

    const modules = db.prepare(`
      SELECT m.*, COUNT(s.id) as screen_count
      FROM modules m
      LEFT JOIN screens s ON m.id = s.module_id
      GROUP BY m.id
      ORDER BY m.sort_order ASC, m.name ASC
    `).all();
    res.json(modules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/docs/modules - Create module
router.post('/modules', (req: Request, res: Response) => {
  try {
    const { name, icon = '📁', color = '#3b82f6', description = '', sort_order = 0 } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Valid module name is required' });
    }

    const trimmed = name.trim();
    if (trimmed.length > 100) {
      return res.status(400).json({ error: 'Module name exceeds maximum length of 100 characters' });
    }

    const slug = sanitizeSlug(trimmed);
    const db = getDb();

    let finalSlug = slug;
    let counter = 1;
    while (db.prepare('SELECT id FROM modules WHERE slug = ?').get(finalSlug)) {
      finalSlug = `${slug}-${counter++}`;
    }

    const stmt = db.prepare(`
      INSERT INTO modules (name, slug, icon, color, description, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(trimmed, finalSlug, icon || '📁', color || '#3b82f6', description || '', sort_order || 0);
    const created = db.prepare('SELECT * FROM modules WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/docs/modules/:id
router.put('/modules/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, color, description, sort_order } = req.body;
    const db = getDb();

    const existing: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Module not found' });

    const updatedName = (name && typeof name === 'string') ? name.trim() : existing.name;
    const updatedIcon = icon !== undefined ? icon : existing.icon;
    const updatedColor = color !== undefined ? color : (existing.color || '#3b82f6');
    const updatedDesc = description !== undefined ? description : (existing.description || '');
    const updatedSort = typeof sort_order === 'number' ? sort_order : existing.sort_order;

    db.prepare(`
      UPDATE modules
      SET name = ?, icon = ?, color = ?, description = ?, sort_order = ?
      WHERE id = ?
    `).run(updatedName, updatedIcon, updatedColor, updatedDesc, updatedSort, id);

    const result = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/docs/modules/:id
router.delete('/modules/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const targetModuleId = req.query.targetModuleId ? Number(req.query.targetModuleId) : (req.body?.targetModuleId ? Number(req.body.targetModuleId) : null);
    const cascade = req.query.cascade === 'true' || req.body?.cascade === true || req.query.force === 'true';
    const db = getDb();

    const existing: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Module not found' });

    const countResult: any = db.prepare('SELECT COUNT(*) as cnt FROM screens WHERE module_id = ?').get(id);
    if (countResult && countResult.cnt > 0) {
      if (targetModuleId && targetModuleId !== Number(id)) {
        const targetModule: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetModuleId);
        if (!targetModule) {
          return res.status(400).json({ error: 'Target module for transfer not found' });
        }
        
        // Transfer screens and organize files on disk
        const screensToMove: any[] = db.prepare('SELECT id, slug, file_path, raw_content FROM screens WHERE module_id = ?').all(id);
        for (const s of screensToMove) {
          try {
            if (s.raw_content) {
              const newRelPath = saveMarkdownFile(targetModule.slug, s.slug, s.raw_content);
              db.prepare('UPDATE screens SET module_id = ?, file_path = ? WHERE id = ?').run(targetModuleId, newRelPath, s.id);
              if (s.file_path && s.file_path !== newRelPath) {
                deleteMarkdownFile(s.file_path);
              }
            } else {
              db.prepare('UPDATE screens SET module_id = ? WHERE id = ?').run(targetModuleId, s.id);
            }
          } catch {
            db.prepare('UPDATE screens SET module_id = ? WHERE id = ?').run(targetModuleId, s.id);
          }
        }
      } else if (cascade) {
        // Cascade delete: remove all screen markdown files and DB records in this module
        const screensToDelete: any[] = db.prepare('SELECT id, file_path FROM screens WHERE module_id = ?').all(id);
        for (const s of screensToDelete) {
          try {
            if (s.file_path) {
              deleteMarkdownFile(s.file_path);
            }
          } catch {}
        }
        db.prepare('DELETE FROM screens WHERE module_id = ?').run(id);
      } else {
        return res.status(400).json({ 
          error: 'Nhóm này đang có tài liệu. Vui lòng chuyển các màn hình sang nhóm khác hoặc xác nhận xóa tất cả.',
          hasScreens: true,
          screenCount: countResult.cnt
        });
      }
    }

    db.prepare('DELETE FROM modules WHERE id = ?').run(id);
    res.json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SCREENS ---

// GET /api/docs/screens - List all screens with filters
router.get('/screens', (req: Request, res: Response) => {
  try {
    const db = getDb();
    checkAndSeedDocuments(db);

    const { moduleId, status, q, search } = req.query;
    const queryTerm = (q || search) as string | undefined;

    let sql = `
      SELECT s.id, s.module_id, s.title, s.slug, s.file_path, s.author, s.status, s.tags, s.jira_key, s.overview, s.raw_content, s.created_at, s.updated_at,
             m.name as module_name, m.slug as module_slug, m.icon as module_icon, m.color as module_color
      FROM screens s
      JOIN modules m ON s.module_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (moduleId && moduleId !== 'all') {
      sql += ' AND s.module_id = ?';
      params.push(Number(moduleId));
    }

    if (status && status !== 'all') {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    if (queryTerm && queryTerm.trim()) {
      const term = `%${queryTerm.trim()}%`;
      sql += ' AND (s.title LIKE ? OR s.author LIKE ? OR s.tags LIKE ? OR s.overview LIKE ? OR s.jira_key LIKE ? OR s.raw_content LIKE ?)';
      params.push(term, term, term, term, term, term);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const screens: any[] = db.prepare(sql).all(...params);
    const parsedScreens = screens.map(s => ({
      ...s,
      tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags
    }));

    res.json(parsedScreens);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/docs/screens - Direct screen creation from web editor
router.post('/screens', (req: Request, res: Response) => {
  try {
    const { moduleId, title, author = 'Author', status = 'Draft', jira_key = null, tags = [], raw_content } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Valid screen title is required' });
    }
    if (!moduleId) {
      return res.status(400).json({ error: 'Module/Group selection is required' });
    }

    const db = getDb();
    const mod: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId);
    if (!mod) {
      return res.status(404).json({ error: 'Selected module does not exist' });
    }

    const trimmedTitle = title.trim();
    let screenSlug = sanitizeSlug(trimmedTitle);

    let finalSlug = screenSlug;
    let counter = 1;
    while (db.prepare('SELECT id FROM screens WHERE module_id = ? AND slug = ?').get(moduleId, finalSlug)) {
      finalSlug = `${screenSlug}-${counter++}`;
    }

    const tagsArray = Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []);

    let markdownContent = raw_content;
    if (!markdownContent || typeof markdownContent !== 'string' || !markdownContent.trim()) {
      markdownContent = `---
title: ${trimmedTitle}
module: ${mod.name}
author: ${author}
status: ${status}
${jira_key ? `jira: ${jira_key}\n` : ''}tags: [${tagsArray.map((t: string) => `"${t}"`).join(', ')}]
created: ${new Date().toISOString().split('T')[0]}
---

# ${trimmedTitle}

## 1. TỔNG QUAN (OVERVIEW)
Mô tả mục đích và vai trò của màn hình ${trimmedTitle}.

## 2. TÍNH NĂNG & TIÊU CHÍ NGHIỆM THU (FEATURES & AC)
| Mã | Tính năng | Mô tả chi tiết | Tiêu chí nghiệm thu (AC) |
|---|---|---|---|
| FEAT-01 | Khởi tạo giao diện | Tải dữ liệu ban đầu cho màn hình | Hiển thị đầy đủ thông tin sau 1s |

## 3. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)
- **BR-01**: Quy tắc nghiệp vụ và ràng buộc dữ liệu cho màn hình này.

## 4. DANH SÁCH API ENDPOINTS
| Method | Endpoint | Mô tả | Request Body / Params | Response |
|---|---|---|---|---|
| GET | \`/api/example\` | Lấy danh sách dữ liệu | None | 200 OK |

## 5. CƠ SỞ DỮ LIỆU & ER
\`\`\`sql
-- Schema & Table mappings
\`\`\`

## 6. KIỂM THỬ & QA
- [ ] Kiểm tra hiển thị responsive (Mobile, Tablet, Desktop)
- [ ] Kiểm tra validation dữ liệu

## 7. GHI CHÚ & LƯU Ý
> [!NOTE]
> Ghi chú kỹ thuật hoặc hướng dẫn bàn giao cho developer tiếp nhận.
`;
    }

    const parsed = parseMarkdown(markdownContent);
    const savedRelPath = saveMarkdownFile(mod.slug, finalSlug, markdownContent);

    const effectiveTitle = trimmedTitle || parsed.frontmatter.title || 'Untitled Screen';
    const effectiveAuthor = author || parsed.frontmatter.author;
    const effectiveStatus = status || parsed.frontmatter.status;
    const effectiveJira = parsed.frontmatter.jira || jira_key || null;
    const effectiveTags = parsed.frontmatter.tags && Array.isArray(parsed.frontmatter.tags)
      ? parsed.frontmatter.tags
      : tagsArray;
    const effectiveOverview = parsed.sections.overview || '';

    const stmt = db.prepare(`
      INSERT INTO screens (
        module_id, title, slug, file_path, author, status, tags, jira_key, overview, raw_content, parsed_data, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = stmt.run(
      moduleId,
      effectiveTitle,
      finalSlug,
      savedRelPath,
      effectiveAuthor,
      effectiveStatus,
      JSON.stringify(effectiveTags),
      effectiveJira,
      effectiveOverview,
      markdownContent,
      JSON.stringify(parsed)
    );

    const createdId = Number(info.lastInsertRowid);

    // Auto-link any uploaded images referenced in the markdown content or passed via image_ids
    try {
      const imgRegex = /\/api\/files\/images\/([a-zA-Z0-9_\-\.]+)/g;
      let match;
      const foundFilenames: string[] = [];
      while ((match = imgRegex.exec(markdownContent)) !== null) {
        foundFilenames.push(match[1]);
      }
      if (foundFilenames.length > 0) {
        const placeholders = foundFilenames.map(() => '?').join(',');
        db.prepare(`UPDATE images SET screen_id = ? WHERE stored_name IN (${placeholders}) AND (screen_id IS NULL OR screen_id = 0)`).run(createdId, ...foundFilenames);
      }
      if (Array.isArray(req.body.image_ids) && req.body.image_ids.length > 0) {
        const placeholders = req.body.image_ids.map(() => '?').join(',');
        db.prepare(`UPDATE images SET screen_id = ? WHERE id IN (${placeholders})`).run(createdId, ...req.body.image_ids);
      }
    } catch {}

    const created: any = db.prepare(`
      SELECT s.*, m.name as module_name, m.slug as module_slug, m.icon as module_icon, m.color as module_color
      FROM screens s
      JOIN modules m ON s.module_id = m.id
      WHERE s.id = ?
    `).get(createdId);

    created.tags = typeof created.tags === 'string' ? JSON.parse(created.tags) : created.tags;
    created.parsed_data = typeof created.parsed_data === 'string' ? JSON.parse(created.parsed_data) : created.parsed_data;

    // Attach images
    const screenImages: any[] = db.prepare(`
      SELECT id, screen_id, original_name, stored_name, mime_type, size_bytes, created_at
      FROM images
      WHERE screen_id = ?
      ORDER BY id DESC
    `).all(createdId);
    created.images = screenImages.map(img => ({
      ...img,
      url: `/api/files/images/${img.stored_name}`
    }));

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/docs/modules/:slug/screens - List screens in module
router.get('/modules/:slug/screens', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const cleanSlug = sanitizeSlug(slug);
    const db = getDb();
    checkAndSeedDocuments(db);

    const moduleRecord: any = db.prepare('SELECT * FROM modules WHERE slug = ?').get(cleanSlug);
    if (!moduleRecord) return res.status(404).json({ error: 'Module not found' });

    const screens: any[] = db.prepare(`
      SELECT id, module_id, title, slug, file_path, author, status, tags, jira_key, overview, created_at, updated_at
      FROM screens
      WHERE module_id = ?
      ORDER BY updated_at DESC
    `).all(moduleRecord.id);

    const parsedScreens = screens.map(s => ({
      ...s,
      tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags
    }));

    res.json(parsedScreens);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/docs/screens/:id - Screen detail
router.get('/screens/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const screen: any = db.prepare(`
      SELECT s.*, m.name as module_name, m.slug as module_slug, m.icon as module_icon, m.color as module_color
      FROM screens s
      JOIN modules m ON s.module_id = m.id
      WHERE s.id = ?
    `).get(id);

    if (!screen) return res.status(404).json({ error: 'Screen document not found' });

    screen.tags = typeof screen.tags === 'string' ? JSON.parse(screen.tags) : screen.tags;
    screen.parsed_data = typeof screen.parsed_data === 'string' ? JSON.parse(screen.parsed_data) : screen.parsed_data;

    // Attach images
    const screenImages: any[] = db.prepare(`
      SELECT id, screen_id, original_name, stored_name, mime_type, size_bytes, created_at
      FROM images
      WHERE screen_id = ?
      ORDER BY id DESC
    `).all(id);
    screen.images = screenImages.map(img => ({
      ...img,
      url: `/api/files/images/${img.stored_name}`
    }));

    res.json(screen);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/docs/screens/import - Upload .md file
router.post('/screens/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    const moduleId = req.body.moduleId ? Number(req.body.moduleId) : null;

    if (!file) return res.status(400).json({ error: 'Markdown file (.md) is required' });
    const content = file.buffer.toString('utf-8');
    const parsed = parseMarkdown(content);

    const db = getDb();
    let targetModuleId = moduleId;

    if (!targetModuleId) {
      const moduleName = parsed.frontmatter.module || 'General';
      const moduleSlug = sanitizeSlug(moduleName);
      let mod: any = db.prepare('SELECT * FROM modules WHERE slug = ?').get(moduleSlug);
      if (!mod) {
        const info = db.prepare('INSERT INTO modules (name, slug, icon) VALUES (?, ?, ?)').run(moduleName, moduleSlug, '📋');
        targetModuleId = Number(info.lastInsertRowid);
      } else {
        targetModuleId = mod.id;
      }
    }

    const mod: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetModuleId);
    const title = parsed.frontmatter.title || file.originalname.replace(/\.md$/i, '');
    const screenSlug = sanitizeSlug(parsed.frontmatter.screen || title);

    const savedRelPath = saveMarkdownFile(mod.slug, screenSlug, content);

    const stmt = db.prepare(`
      INSERT INTO screens (
        module_id, title, slug, file_path, author, status, tags, jira_key, overview, raw_content, parsed_data, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(module_id, slug) DO UPDATE SET
        title = excluded.title,
        file_path = excluded.file_path,
        author = excluded.author,
        status = excluded.status,
        tags = excluded.tags,
        jira_key = excluded.jira_key,
        overview = excluded.overview,
        raw_content = excluded.raw_content,
        parsed_data = excluded.parsed_data,
        updated_at = datetime('now')
    `);

    const tagsJson = JSON.stringify(parsed.frontmatter.tags || []);
    const parsedDataJson = JSON.stringify(parsed);
    const overview = parsed.sections.overview || '';
    const author = parsed.frontmatter.author || 'Anonymous';
    const status = parsed.frontmatter.status || 'Draft';
    const jiraKey = parsed.frontmatter.jira || null;

    stmt.run(
      targetModuleId,
      title,
      screenSlug,
      savedRelPath,
      author,
      status,
      tagsJson,
      jiraKey,
      overview,
      content,
      parsedDataJson
    );

    const created: any = db.prepare('SELECT * FROM screens WHERE module_id = ? AND slug = ?').get(targetModuleId, screenSlug);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/docs/screens/:id - Update raw content & metadata & re-parse
router.put('/screens/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { raw_content, moduleId, title, author, status, jira_key, tags } = req.body;

    const db = getDb();
    const existing: any = db.prepare(`
      SELECT s.*, m.slug as module_slug, m.name as module_name
      FROM screens s 
      JOIN modules m ON s.module_id = m.id 
      WHERE s.id = ?
    `).get(id);

    if (!existing) return res.status(404).json({ error: 'Screen document not found' });

    let targetModuleId = moduleId ? Number(moduleId) : existing.module_id;
    let targetMod: any = { slug: existing.module_slug, name: existing.module_name };
    if (targetModuleId !== existing.module_id) {
      targetMod = db.prepare('SELECT * FROM modules WHERE id = ?').get(targetModuleId);
      if (!targetMod) return res.status(400).json({ error: 'Target module not found' });
    }

    const contentToSave = (raw_content && typeof raw_content === 'string') ? raw_content : existing.raw_content;
    const parsed = parseMarkdown(contentToSave);

    // If module changed, remove old file from disk
    if (targetModuleId !== existing.module_id) {
      try {
        deleteMarkdownFile(existing.file_path);
      } catch {}
    }

    const savedRelPath = saveMarkdownFile(targetMod.slug, existing.slug, contentToSave);

    const finalTitle = title || parsed.frontmatter.title || existing.title;
    const finalAuthor = author || parsed.frontmatter.author || existing.author;
    const finalStatus = status || parsed.frontmatter.status || existing.status;
    const finalJira = jira_key !== undefined ? jira_key : (parsed.frontmatter.jira || existing.jira_key);
    const finalTags = tags ? (Array.isArray(tags) ? tags : [tags]) : (parsed.frontmatter.tags || (typeof existing.tags === 'string' ? JSON.parse(existing.tags) : existing.tags));
    const tagsJson = JSON.stringify(finalTags || []);
    const parsedDataJson = JSON.stringify(parsed);
    const overview = parsed.sections.overview || existing.overview || '';

    db.prepare(`
      UPDATE screens
      SET module_id = ?, title = ?, file_path = ?, author = ?, status = ?, jira_key = ?, tags = ?, overview = ?, raw_content = ?, parsed_data = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(targetModuleId, finalTitle, savedRelPath, finalAuthor, finalStatus, finalJira, tagsJson, overview, contentToSave, parsedDataJson, id);

    // Auto-link any uploaded images referenced in the markdown content or passed via image_ids
    try {
      const imgRegex = /\/api\/files\/images\/([a-zA-Z0-9_\-\.]+)/g;
      let match;
      const foundFilenames: string[] = [];
      while ((match = imgRegex.exec(contentToSave)) !== null) {
        foundFilenames.push(match[1]);
      }
      if (foundFilenames.length > 0) {
        const placeholders = foundFilenames.map(() => '?').join(',');
        db.prepare(`UPDATE images SET screen_id = ? WHERE stored_name IN (${placeholders}) AND (screen_id IS NULL OR screen_id = 0)`).run(id, ...foundFilenames);
      }
      if (Array.isArray(req.body.image_ids) && req.body.image_ids.length > 0) {
        const placeholders = req.body.image_ids.map(() => '?').join(',');
        db.prepare(`UPDATE images SET screen_id = ? WHERE id IN (${placeholders})`).run(id, ...req.body.image_ids);
      }

      // Clean up orphaned images that were previously linked to this screen but were deleted
      const previouslyLinked: any[] = db.prepare('SELECT id, stored_name FROM images WHERE screen_id = ?').all(id);
      const remainingIds = new Set(Array.isArray(req.body.image_ids) ? req.body.image_ids.map(Number) : []);
      const uploadDir = path.join(getDataDir(), 'images');

      for (const oldImg of previouslyLinked) {
        const inContent = contentToSave.includes(oldImg.stored_name);
        if (!remainingIds.has(oldImg.id) && !inContent) {
          const safeStoredName = path.basename(oldImg.stored_name);
          const filePath = path.join(uploadDir, safeStoredName);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch {}
          }
          db.prepare('DELETE FROM images WHERE id = ?').run(oldImg.id);
        }
      }
    } catch {}

    const updated: any = db.prepare(`
      SELECT s.*, m.name as module_name, m.slug as module_slug, m.icon as module_icon, m.color as module_color
      FROM screens s
      JOIN modules m ON s.module_id = m.id
      WHERE s.id = ?
    `).get(id);

    updated.tags = typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags;
    updated.parsed_data = typeof updated.parsed_data === 'string' ? JSON.parse(updated.parsed_data) : updated.parsed_data;

    // Attach images
    const screenImages: any[] = db.prepare(`
      SELECT id, screen_id, original_name, stored_name, mime_type, size_bytes, created_at
      FROM images
      WHERE screen_id = ?
      ORDER BY id DESC
    `).all(id);
    updated.images = screenImages.map(img => ({
      ...img,
      url: `/api/files/images/${img.stored_name}`
    }));

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/docs/screens/:id
router.delete('/screens/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing: any = db.prepare('SELECT * FROM screens WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Screen not found' });

    try {
      deleteMarkdownFile(existing.file_path);
    } catch (e) {
      // File might already be removed
    }

    try {
      db.prepare('DELETE FROM images WHERE screen_id = ?').run(id);
    } catch (e) {}

    db.prepare('DELETE FROM screens WHERE id = ?').run(id);
    res.json({ message: 'Screen deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/docs/search?q=keyword
router.get('/search', (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) return res.json([]);

    const db = getDb();
    
    // Sanitize query to prevent FTS5 syntax errors
    const sanitized = q.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').trim();
    const tokens = sanitized.split(/\s+/).filter(Boolean);
    
    if (tokens.length === 0) return res.json([]);

    const formattedQuery = tokens.map(t => `"${t.replace(/"/g, '""')}"*`).join(' ');

    const results = db.prepare(`
      SELECT 
        s.id, s.title, s.slug, s.author, s.status, s.updated_at, m.slug as module_slug, m.name as module_name,
        highlight(screens_fts, 0, '<mark>', '</mark>') as title_hl,
        snippet(screens_fts, 4, '<mark>', '</mark>', '...', 15) as snippet
      FROM screens_fts
      JOIN screens s ON s.id = screens_fts.rowid
      JOIN modules m ON s.module_id = m.id
      WHERE screens_fts MATCH ?
      ORDER BY rank
      LIMIT 30
    `).all(formattedQuery);

    res.json(results);
  } catch (error: any) {
    // If syntax query fails fallback to safe LIKE query
    try {
      const db = getDb();
      const likeTerm = `%${String(req.query.q).replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      const fallback = db.prepare(`
        SELECT s.id, s.title, s.slug, s.author, s.status, s.updated_at, m.slug as module_slug, m.name as module_name, s.title as title_hl
        FROM screens s
        JOIN modules m ON s.module_id = m.id
        WHERE s.title LIKE ? ESCAPE '\\' OR s.raw_content LIKE ? ESCAPE '\\'
        ORDER BY s.updated_at DESC
        LIMIT 30
      `).all(likeTerm, likeTerm);
      return res.json(fallback);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

// GET /api/docs/stats - Dashboard metrics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
    checkAndSeedDocuments(db);

    const totalModules: any = db.prepare('SELECT COUNT(*) as count FROM modules').get();
    const totalScreens: any = db.prepare('SELECT COUNT(*) as count FROM screens').get();

    const statusCounts: any[] = db.prepare(`
      SELECT status, COUNT(*) as count FROM screens GROUP BY status
    `).all();

    const byStatus: Record<string, number> = {};
    statusCounts.forEach(sc => {
      byStatus[sc.status || 'Draft'] = sc.count;
    });

    const recentScreens: any[] = db.prepare(`
      SELECT s.id, s.title, s.slug, s.author, s.status, s.updated_at, m.name as module_name, m.slug as module_slug
      FROM screens s
      JOIN modules m ON s.module_id = m.id
      ORDER BY s.updated_at DESC
      LIMIT 6
    `).all();

    res.json({
      totalModules: totalModules.count,
      totalScreens: totalScreens.count,
      byStatus,
      recentScreens
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/docs/sync - Force re-sync disk markdown files into database
router.post('/sync', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const count = syncDocumentsFromDisk(db, true);
    const message = count > 0
      ? `Đã đồng bộ thành công ${count} tài liệu từ ổ đĩa!`
      : 'Đã kiểm tra ổ đĩa: tất cả tài liệu đã được đồng bộ mới nhất.';
    res.json({ success: true, count, message });
  } catch (error: any) {
    res.status(500).json({ error: error?.message ? `Lỗi khi đồng bộ tài liệu từ ổ đĩa: ${error.message}` : 'Lỗi khi đồng bộ tài liệu từ ổ đĩa' });
  }
});

export default router;
