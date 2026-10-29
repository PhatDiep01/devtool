import { Router, Request, Response } from 'express';
import { getDb } from '../db/sqlite';

const router = Router();

// ==========================================
// 1. ENDPOINTS MANAGEMENT
// ==========================================

// GET /api/api-docs/endpoints - List endpoints with filtering & full search
router.get('/endpoints', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId, folder, version, method, status, tag, q, search } = req.query;
    const searchTerm = (q || search) as string | undefined;

    let sql = 'SELECT * FROM api_endpoints WHERE 1=1';
    const params: any[] = [];

    if (moduleId && moduleId !== 'all') {
      sql += ' AND module_id = ?';
      params.push(Number(moduleId));
    }

    if (folder && folder !== 'all') {
      sql += ' AND folder = ?';
      params.push(String(folder));
    }

    if (version && version !== 'all') {
      sql += ' AND version = ?';
      params.push(String(version));
    }

    if (method && method !== 'all') {
      sql += ' AND UPPER(method) = ?';
      params.push(String(method).toUpperCase());
    }

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(String(status));
    }

    if (tag && tag !== 'all') {
      sql += ' AND tags LIKE ?';
      params.push(`%"${String(tag)}"%'`);
    }

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      sql += ` AND (
        path LIKE ? OR 
        title LIKE ? OR 
        description LIKE ? OR 
        parameters LIKE ? OR 
        request_bodies LIKE ? OR 
        responses LIKE ? OR 
        related_error_codes LIKE ? OR 
        business_notes LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term, term);
    }

    sql += ' ORDER BY is_pinned DESC, folder ASC, sort_order ASC, id ASC';

    const rawRows = db.prepare(sql).all(...params);
    const parsedRows = rawRows.map((row: any) => ({
      ...row,
      tags: parseJsonSafe(row.tags, []),
      parameters: parseJsonSafe(row.parameters, []),
      request_bodies: parseJsonSafe(row.request_bodies, []),
      responses: parseJsonSafe(row.responses, []),
      related_error_codes: parseJsonSafe(row.related_error_codes, []),
      change_history: parseJsonSafe(row.change_history, []),
      is_pinned: Boolean(row.is_pinned)
    }));

    res.json(parsedRows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/api-docs/endpoints/:id - Get single endpoint
router.get('/endpoints/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const row: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({ error: 'Endpoint không tồn tại' });
    }

    res.json({
      ...row,
      tags: parseJsonSafe(row.tags, []),
      parameters: parseJsonSafe(row.parameters, []),
      request_bodies: parseJsonSafe(row.request_bodies, []),
      responses: parseJsonSafe(row.responses, []),
      related_error_codes: parseJsonSafe(row.related_error_codes, []),
      change_history: parseJsonSafe(row.change_history, []),
      is_pinned: Boolean(row.is_pinned)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/endpoints - Create endpoint
router.post('/endpoints', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const body = req.body;

    if (!body.module_id || !body.path || !body.title) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ: module_id, path và title' });
    }

    const folder = (body.folder || 'Chung').trim();
    const version = (body.version || 'v1').trim();
    const method = (body.method || 'GET').trim().toUpperCase();
    const pathVal = body.path.trim();
    const title = body.title.trim();

    // Check duplicate method + path within the same module & version
    const existing = db.prepare(`
      SELECT id, title FROM api_endpoints 
      WHERE module_id = ? AND version = ? AND UPPER(method) = ? AND path = ?
    `).get(body.module_id, version, method, pathVal);

    if (existing) {
      return res.status(409).json({ 
        error: `Trùng lặp: Phương thức ${method} đường dẫn ${pathVal} đã tồn tại trong phiên bản ${version} (${(existing as any).title})`
      });
    }

    // Determine next sort_order
    const maxSortResult: any = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) as maxSort 
      FROM api_endpoints 
      WHERE module_id = ? AND folder = ?
    `).get(body.module_id, folder);
    const sortOrder = (maxSortResult?.maxSort || 0) + 1;

    const initialHistory = [{
      author: body.assignee || 'User',
      action: 'Tạo mới endpoint',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    }];

    const stmt = db.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        deprecated_reason, replaced_by_id, tags, assignee, auth_type, auth_roles,
        parameters, request_bodies, responses, related_error_codes,
        business_notes, rate_limit, change_history, linked_screen_id, linked_bug_id,
        is_pinned, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Number(body.module_id),
      folder,
      version,
      method,
      pathVal,
      title,
      body.description || '',
      body.status || 'stable',
      body.deprecated_reason || null,
      body.replaced_by_id || null,
      JSON.stringify(body.tags || []),
      body.assignee || '',
      body.auth_type || 'bearer',
      body.auth_roles || '',
      JSON.stringify(body.parameters || []),
      JSON.stringify(body.request_bodies || []),
      JSON.stringify(body.responses || []),
      JSON.stringify(body.related_error_codes || []),
      body.business_notes || '',
      body.rate_limit || '',
      JSON.stringify(initialHistory),
      body.linked_screen_id || null,
      body.linked_bug_id || null,
      body.is_pinned ? 1 : 0,
      sortOrder
    );

    const created: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...created,
      tags: parseJsonSafe(created.tags, []),
      parameters: parseJsonSafe(created.parameters, []),
      request_bodies: parseJsonSafe(created.request_bodies, []),
      responses: parseJsonSafe(created.responses, []),
      related_error_codes: parseJsonSafe(created.related_error_codes, []),
      change_history: parseJsonSafe(created.change_history, []),
      is_pinned: Boolean(created.is_pinned)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/api-docs/endpoints/:id - Update endpoint
router.put('/endpoints/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const body = req.body;

    const existing: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Endpoint không tồn tại' });
    }

    const version = (body.version || existing.version || 'v1').trim();
    const method = (body.method || existing.method || 'GET').trim().toUpperCase();
    const pathVal = (body.path || existing.path).trim();
    const title = (body.title || existing.title).trim();
    const folder = (body.folder !== undefined ? body.folder : existing.folder).trim();

    // Check duplicate if method or path changed
    if (method !== existing.method || pathVal !== existing.path || version !== existing.version) {
      const duplicate = db.prepare(`
        SELECT id, title FROM api_endpoints 
        WHERE module_id = ? AND version = ? AND UPPER(method) = ? AND path = ? AND id != ?
      `).get(existing.module_id, version, method, pathVal, id);

      if (duplicate) {
        return res.status(409).json({ 
          error: `Trùng lặp: Phương thức ${method} đường dẫn ${pathVal} đã tồn tại trong phiên bản ${version}`
        });
      }
    }

    // Append to change history
    const oldHistory = parseJsonSafe(existing.change_history, []);
    const newHistoryItem = {
      author: body.editorName || body.assignee || 'User',
      action: body.changeNote || 'Cập nhật thông tin endpoint',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    const updatedHistory = [newHistoryItem, ...oldHistory.slice(0, 20)]; // keep last 20 entries

    db.prepare(`
      UPDATE api_endpoints SET
        folder = ?,
        version = ?,
        method = ?,
        path = ?,
        title = ?,
        description = ?,
        status = ?,
        deprecated_reason = ?,
        replaced_by_id = ?,
        tags = ?,
        assignee = ?,
        auth_type = ?,
        auth_roles = ?,
        parameters = ?,
        request_bodies = ?,
        responses = ?,
        related_error_codes = ?,
        business_notes = ?,
        rate_limit = ?,
        change_history = ?,
        linked_screen_id = ?,
        linked_bug_id = ?,
        is_pinned = ?,
        sort_order = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      folder,
      version,
      method,
      pathVal,
      title,
      body.description !== undefined ? body.description : existing.description,
      body.status !== undefined ? body.status : existing.status,
      body.deprecated_reason !== undefined ? body.deprecated_reason : existing.deprecated_reason,
      body.replaced_by_id !== undefined ? body.replaced_by_id : existing.replaced_by_id,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.assignee !== undefined ? body.assignee : existing.assignee,
      body.auth_type !== undefined ? body.auth_type : existing.auth_type,
      body.auth_roles !== undefined ? body.auth_roles : existing.auth_roles,
      body.parameters ? JSON.stringify(body.parameters) : existing.parameters,
      body.request_bodies ? JSON.stringify(body.request_bodies) : existing.request_bodies,
      body.responses ? JSON.stringify(body.responses) : existing.responses,
      body.related_error_codes ? JSON.stringify(body.related_error_codes) : existing.related_error_codes,
      body.business_notes !== undefined ? body.business_notes : existing.business_notes,
      body.rate_limit !== undefined ? body.rate_limit : existing.rate_limit,
      JSON.stringify(updatedHistory),
      body.linked_screen_id !== undefined ? body.linked_screen_id : existing.linked_screen_id,
      body.linked_bug_id !== undefined ? body.linked_bug_id : existing.linked_bug_id,
      body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : existing.is_pinned,
      typeof body.sort_order === 'number' ? body.sort_order : existing.sort_order,
      id
    );

    const updated: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(id);
    res.json({
      ...updated,
      tags: parseJsonSafe(updated.tags, []),
      parameters: parseJsonSafe(updated.parameters, []),
      request_bodies: parseJsonSafe(updated.request_bodies, []),
      responses: parseJsonSafe(updated.responses, []),
      related_error_codes: parseJsonSafe(updated.related_error_codes, []),
      change_history: parseJsonSafe(updated.change_history, []),
      is_pinned: Boolean(updated.is_pinned)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/api-docs/endpoints/:id - Delete endpoint
router.delete('/endpoints/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing: any = db.prepare('SELECT id, title FROM api_endpoints WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Endpoint không tồn tại' });
    }

    db.prepare('DELETE FROM api_endpoints WHERE id = ?').run(id);
    res.json({ message: `Đã xóa endpoint: ${existing.title}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/endpoints/:id/duplicate - Duplicate endpoint
router.post('/endpoints/:id/duplicate', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const source: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(id);
    if (!source) {
      return res.status(404).json({ error: 'Endpoint gốc không tồn tại' });
    }

    // Generate unique path
    let newPath = `${source.path}-copy`;
    let count = 1;
    while (db.prepare('SELECT id FROM api_endpoints WHERE module_id = ? AND version = ? AND UPPER(method) = ? AND path = ?').get(source.module_id, source.version, source.method, newPath)) {
      newPath = `${source.path}-copy-${count++}`;
    }

    const newTitle = `${source.title} (Bản sao)`;
    const newHistory = [{
      author: 'User',
      action: `Nhân bản từ [${source.method}] ${source.path}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    }];

    const stmt = db.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        deprecated_reason, replaced_by_id, tags, assignee, auth_type, auth_roles,
        parameters, request_bodies, responses, related_error_codes,
        business_notes, rate_limit, change_history, linked_screen_id, linked_bug_id,
        is_pinned, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      source.module_id,
      source.folder,
      source.version,
      source.method,
      newPath,
      newTitle,
      source.description,
      'draft',
      null,
      null,
      source.tags,
      source.assignee,
      source.auth_type,
      source.auth_roles,
      source.parameters,
      source.request_bodies,
      source.responses,
      source.related_error_codes,
      source.business_notes,
      source.rate_limit,
      JSON.stringify(newHistory),
      source.linked_screen_id,
      source.linked_bug_id,
      0,
      (source.sort_order || 0) + 1
    );

    const duplicated: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...duplicated,
      tags: parseJsonSafe(duplicated.tags, []),
      parameters: parseJsonSafe(duplicated.parameters, []),
      request_bodies: parseJsonSafe(duplicated.request_bodies, []),
      responses: parseJsonSafe(duplicated.responses, []),
      related_error_codes: parseJsonSafe(duplicated.related_error_codes, []),
      change_history: parseJsonSafe(duplicated.change_history, []),
      is_pinned: Boolean(duplicated.is_pinned)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/api-docs/endpoints/:id/pin - Toggle pin
router.patch('/endpoints/:id/pin', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const row: any = db.prepare('SELECT id, is_pinned FROM api_endpoints WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Endpoint không tồn tại' });

    const newPinned = row.is_pinned ? 0 : 1;
    db.prepare('UPDATE api_endpoints SET is_pinned = ? WHERE id = ?').run(newPinned, id);
    res.json({ id: Number(id), is_pinned: Boolean(newPinned) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/endpoints/reorder - Drag & Drop Reorder & Move folders
router.post('/endpoints/reorder', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { items } = req.body; // Array of { id: number, folder?: string, sort_order: number }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Dữ liệu items phải là mảng' });
    }

    const updateStmt = db.prepare(`
      UPDATE api_endpoints 
      SET sort_order = ?, folder = COALESCE(?, folder), updated_at = datetime('now')
      WHERE id = ?
    `);

    for (const item of items) {
      if (item.id) {
        updateStmt.run(item.sort_order, item.folder || null, item.id);
      }
    }

    res.json({ success: true, count: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/api-docs/folders - Get unique folders in module
router.get('/folders', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId } = req.query;

    let sql = 'SELECT DISTINCT folder FROM api_endpoints WHERE folder IS NOT NULL';
    const params: any[] = [];
    if (moduleId && moduleId !== 'all') {
      sql += ' AND module_id = ?';
      params.push(Number(moduleId));
    }
    sql += ' ORDER BY folder ASC';

    const rows: any[] = db.prepare(sql).all(...params);
    const folders = rows.map(r => r.folder).filter(Boolean);
    if (!folders.includes('Chung')) folders.unshift('Chung');
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. SCHEMAS / MODELS MANAGEMENT
// ==========================================

// GET /api/api-docs/models
router.get('/models', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId } = req.query;

    let sql = 'SELECT * FROM api_models WHERE 1=1';
    const params: any[] = [];
    if (moduleId && moduleId !== 'all') {
      sql += ' AND module_id = ?';
      params.push(Number(moduleId));
    }
    sql += ' ORDER BY name ASC';

    const rows: any[] = db.prepare(sql).all(...params);
    res.json(rows.map(r => ({
      ...r,
      fields: parseJsonSafe(r.fields, [])
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/models
router.post('/models', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { module_id, name, description, fields } = req.body;

    if (!module_id || !name || !name.trim()) {
      return res.status(400).json({ error: 'Tên model và module_id là bắt buộc' });
    }

    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM api_models WHERE module_id = ? AND name = ?').get(module_id, cleanName);
    if (existing) {
      return res.status(409).json({ error: `Model '${cleanName}' đã tồn tại trong module này` });
    }

    const stmt = db.prepare(`
      INSERT INTO api_models (module_id, name, description, fields)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(Number(module_id), cleanName, description || '', JSON.stringify(fields || []));
    const created: any = db.prepare('SELECT * FROM api_models WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...created,
      fields: parseJsonSafe(created.fields, [])
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/api-docs/models/:id
router.put('/models/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, description, fields } = req.body;

    const existing: any = db.prepare('SELECT * FROM api_models WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Model không tồn tại' });

    const cleanName = (name || existing.name).trim();
    if (cleanName !== existing.name) {
      const duplicate = db.prepare('SELECT id FROM api_models WHERE module_id = ? AND name = ? AND id != ?').get(existing.module_id, cleanName, id);
      if (duplicate) return res.status(409).json({ error: `Tên model '${cleanName}' đã trùng lặp` });
    }

    db.prepare(`
      UPDATE api_models 
      SET name = ?, description = ?, fields = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(cleanName, description !== undefined ? description : existing.description, fields ? JSON.stringify(fields) : existing.fields, id);

    const updated: any = db.prepare('SELECT * FROM api_models WHERE id = ?').get(id);
    res.json({
      ...updated,
      fields: parseJsonSafe(updated.fields, [])
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/api-docs/models/:id
router.delete('/models/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing: any = db.prepare('SELECT * FROM api_models WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Model không tồn tại' });

    // Check references in endpoints
    const referencingEps: any[] = db.prepare(`
      SELECT id, title, method, path FROM api_endpoints 
      WHERE module_id = ? AND (request_bodies LIKE ? OR responses LIKE ?)
    `).all(existing.module_id, `%"${existing.name}"%`, `%"${existing.name}"%`);

    db.prepare('DELETE FROM api_models WHERE id = ?').run(id);
    res.json({ 
      message: `Đã xóa model '${existing.name}'`,
      referencesCount: referencingEps.length,
      referencingEndpoints: referencingEps
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. ERROR CODES MANAGEMENT
// ==========================================

// GET /api/api-docs/error-codes
router.get('/error-codes', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId, category, httpStatus, q } = req.query;

    let sql = 'SELECT * FROM api_error_codes WHERE 1=1';
    const params: any[] = [];

    if (moduleId && moduleId !== 'all') {
      sql += ' AND (module_id = ? OR module_id IS NULL)';
      params.push(Number(moduleId));
    }

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(String(category));
    }

    if (httpStatus && httpStatus !== 'all') {
      sql += ' AND http_status = ?';
      params.push(Number(httpStatus));
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      sql += ' AND (code LIKE ? OR message LIKE ? OR description LIKE ? OR resolution LIKE ?)';
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY http_status ASC, code ASC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/error-codes
router.post('/error-codes', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { module_id, code, http_status = 400, message, description = '', resolution = '', category = 'business' } = req.body;

    if (!code || !code.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: 'Mã lỗi (code) và thông điệp (message) là bắt buộc' });
    }

    const cleanCode = code.trim().toUpperCase();
    const stmt = db.prepare(`
      INSERT INTO api_error_codes (module_id, code, http_status, message, description, resolution, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(module_id ? Number(module_id) : null, cleanCode, Number(http_status), message.trim(), description, resolution, category);
    const created = db.prepare('SELECT * FROM api_error_codes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/api-docs/error-codes/:id
router.put('/error-codes/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { code, http_status, message, description, resolution, category } = req.body;

    const existing: any = db.prepare('SELECT * FROM api_error_codes WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Mã lỗi không tồn tại' });

    const cleanCode = code ? code.trim().toUpperCase() : existing.code;
    db.prepare(`
      UPDATE api_error_codes 
      SET code = ?, http_status = ?, message = ?, description = ?, resolution = ?, category = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      cleanCode,
      http_status !== undefined ? Number(http_status) : existing.http_status,
      message !== undefined ? message.trim() : existing.message,
      description !== undefined ? description : existing.description,
      resolution !== undefined ? resolution : existing.resolution,
      category !== undefined ? category : existing.category,
      id
    );

    const updated = db.prepare('SELECT * FROM api_error_codes WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/api-docs/error-codes/:id
router.delete('/error-codes/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing: any = db.prepare('SELECT * FROM api_error_codes WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Mã lỗi không tồn tại' });

    db.prepare('DELETE FROM api_error_codes WHERE id = ?').run(id);
    res.json({ message: `Đã xóa mã lỗi ${existing.code}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. ENVIRONMENTS SETTINGS
// ==========================================

const DEFAULT_ENVIRONMENTS = [
  { id: 'dev', name: 'Development', url: 'https://dev-api.internal.domain', is_default: true },
  { id: 'test', name: 'Testing / Staging', url: 'https://test-api.internal.domain', is_default: false },
  { id: 'prod', name: 'Production', url: 'https://api.internal.domain', is_default: false }
];

// GET /api/api-docs/environments
router.get('/environments', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId } = req.query;
    const key = moduleId ? `api_environments_${moduleId}` : 'api_environments_default';

    const row: any = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (row && row.value) {
      return res.json(parseJsonSafe(row.value, DEFAULT_ENVIRONMENTS));
    }

    res.json(DEFAULT_ENVIRONMENTS);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/api-docs/environments
router.put('/environments', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId, environments } = req.body;

    if (!Array.isArray(environments)) {
      return res.status(400).json({ error: 'Environments phải là mảng' });
    }

    const key = moduleId ? `api_environments_${moduleId}` : 'api_environments_default';
    db.prepare(`
      INSERT INTO settings (key, value, category)
      VALUES (?, ?, 'api_docs')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(environments));

    res.json(environments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4.1. POSTMAN PROXY RUNNER & TEST TOOLS
// ==========================================

// POST /api/api-docs/proxy-test - Backend HTTP/HTTPS proxy to bypass browser CORS & mixed content
router.post('/proxy-test', async (req: Request, res: Response) => {
  try {
    const {
      url,
      method = 'GET',
      headers = {},
      params = {},
      body,
      timeoutMs = 30000
    } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL không được để trống' });
    }

    // Build target URL with params
    const parsedUrl = new URL(url);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        if (key && value !== undefined && value !== null && String(value).trim() !== '') {
          parsedUrl.searchParams.append(key, String(value));
        }
      }
    }

    const fullUrl = parsedUrl.toString();
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? await import('node:https') : await import('node:http');

    const reqHeaders: Record<string, string> = {};
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (k && v !== undefined && v !== null && String(v).trim() !== '') {
          reqHeaders[k] = String(v);
        }
      }
    }

    // Set User-Agent & Accept if missing
    if (!reqHeaders['user-agent'] && !reqHeaders['User-Agent']) {
      reqHeaders['User-Agent'] = 'DevToolkit-PostmanRunner/1.0';
    }
    if (!reqHeaders['accept'] && !reqHeaders['Accept']) {
      reqHeaders['Accept'] = '*/*';
    }

    // Prepare body
    let bodyBuffer: Buffer | undefined;
    const upperMethod = method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) && body !== undefined && body !== null) {
      if (typeof body === 'object') {
        bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        if (!reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      } else if (typeof body === 'string' && body.length > 0) {
        bodyBuffer = Buffer.from(body, 'utf8');
      }
      if (bodyBuffer) {
        reqHeaders['Content-Length'] = String(bodyBuffer.length);
      }
    }

    const startTime = performance.now();

    const result = await new Promise<{
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      sizeBytes: number;
    }>((resolve, reject) => {
      const options = {
        method: upperMethod,
        headers: reqHeaders,
        timeout: timeoutMs,
        rejectUnauthorized: false // Allow self-signed SSL certificates for dev/staging
      };

      const proxyReq = httpModule.request(fullUrl, options, (proxyRes) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;

        proxyRes.on('data', (chunk) => {
          chunks.push(chunk);
          totalSize += chunk.length;
        });

        proxyRes.on('end', () => {
          const respBuffer = Buffer.concat(chunks);
          const respText = respBuffer.toString('utf8');
          const respHeaders: Record<string, string> = {};
          for (const [hk, hv] of Object.entries(proxyRes.headers)) {
            if (hv !== undefined) {
              respHeaders[hk] = Array.isArray(hv) ? hv.join(', ') : hv;
            }
          }

          resolve({
            status: proxyRes.statusCode || 200,
            statusText: proxyRes.statusMessage || 'OK',
            headers: respHeaders,
            body: respText,
            sizeBytes: totalSize
          });
        });
      });

      proxyReq.on('error', (err) => {
        reject(err);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error(`Hết thời gian chờ phản hồi (Timeout sau ${timeoutMs}ms)`));
      });

      if (bodyBuffer) {
        proxyReq.write(bodyBuffer);
      }
      proxyReq.end();
    });

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    let parsedBody: any = result.body;
    let isJson = false;
    try {
      parsedBody = JSON.parse(result.body);
      isJson = true;
    } catch {
      isJson = false;
    }

    res.json({
      success: true,
      status: result.status,
      statusText: result.statusText,
      durationMs,
      sizeBytes: result.sizeBytes,
      headers: result.headers,
      body: parsedBody,
      rawBody: result.body,
      isJson
    });

  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'Lỗi khi gửi yêu cầu qua Proxy',
      code: error.code || 'PROXY_ERROR'
    });
  }
});

// POST /api/api-docs/endpoints/:id/save-response-example - Save real test response to Endpoint documentation
router.post('/endpoints/:id/save-response-example', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { statusCode = 200, description, name = 'Mẫu thực tế (Postman)', body } = req.body;

    const endpoint: any = db.prepare('SELECT responses FROM api_endpoints WHERE id = ?').get(id);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint không tồn tại' });
    }

    const responses: any[] = parseJsonSafe(endpoint.responses, []);
    let targetResponse = responses.find(r => r.statusCode === Number(statusCode));

    const formattedBody = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body || '{}');

    if (targetResponse) {
      if (!Array.isArray(targetResponse.examples)) {
        targetResponse.examples = [];
      }
      const exIndex = targetResponse.examples.findIndex((e: any) => e.name === name);
      if (exIndex >= 0) {
        targetResponse.examples[exIndex].body = formattedBody;
      } else {
        targetResponse.examples.push({ name, body: formattedBody });
      }
    } else {
      responses.push({
        statusCode: Number(statusCode),
        description: description || `Mã phản hồi ${statusCode}`,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        examples: [{ name, body: formattedBody }]
      });
    }

    db.prepare(`
      UPDATE api_endpoints 
      SET responses = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(responses), id);

    res.json({ success: true, message: 'Đã lưu mẫu phản hồi vào tài liệu đặc tả', responses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. IMPORT & EXPORT
// ==========================================

// POST /api/api-docs/import/curl
router.post('/import/curl', (req: Request, res: Response) => {
  try {
    const { curl, moduleId = 1, folder = 'Chung' } = req.body;
    if (!curl || typeof curl !== 'string') {
      return res.status(400).json({ error: 'Vui lòng cung cấp lệnh cURL hợp lệ' });
    }

    const parsed = parseCurlCommand(curl);
    const db = getDb();

    // Insert endpoint
    const stmt = db.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        parameters, request_bodies, responses, change_history
      ) VALUES (?, ?, 'v1', ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Number(moduleId),
      folder,
      parsed.method,
      parsed.path,
      parsed.title || `${parsed.method} ${parsed.path}`,
      `Nhập tự động từ cURL vào ngày ${new Date().toLocaleDateString('vi-VN')}`,
      JSON.stringify(parsed.parameters),
      JSON.stringify(parsed.requestBodies),
      JSON.stringify([{ statusCode: 200, description: 'Phản hồi thành công', examples: [] }]),
      JSON.stringify([{ author: 'cURL Import', action: 'Tạo từ lệnh cURL', timestamp: new Date().toISOString() }])
    );

    const created: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      message: 'Nhập cURL thành công',
      endpoint: {
        ...created,
        parameters: parseJsonSafe(created.parameters, []),
        request_bodies: parseJsonSafe(created.request_bodies, [])
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/import/openapi
router.post('/import/openapi', (req: Request, res: Response) => {
  try {
    const { spec, moduleId, defaultFolder = 'OpenAPI Import', conflictStrategy = 'overwrite' } = req.body;
    if (!spec || typeof spec !== 'object') {
      return res.status(400).json({ error: 'Nội dung spec OpenAPI không hợp lệ' });
    }
    if (!moduleId) {
      return res.status(400).json({ error: 'Thiếu moduleId' });
    }

    const db = getDb();
    let importedEndpoints = 0;
    let importedModels = 0;

    // 1. Import Components Schemas / Models
    const schemas = spec.components?.schemas || spec.definitions || {};
    const insertModel = db.prepare(`
      INSERT INTO api_models (module_id, name, description, fields)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(module_id, name) DO UPDATE SET
        description = excluded.description,
        fields = excluded.fields,
        updated_at = datetime('now')
    `);

    for (const [schemaName, schemaObj] of Object.entries<any>(schemas)) {
      const fields = extractFieldsFromSchema(schemaObj);
      insertModel.run(Number(moduleId), schemaName, schemaObj.description || '', JSON.stringify(fields));
      importedModels++;
    }

    // 2. Import Paths & Endpoints
    const paths = spec.paths || {};
    const version = spec.info?.version ? `v${spec.info.version.split('.')[0]}` : 'v1';

    for (const [rawPath, pathItem] of Object.entries<any>(paths)) {
      for (const [rawMethod, operation] of Object.entries<any>(pathItem)) {
        const method = rawMethod.toUpperCase();
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) continue;

        const folder = operation.tags?.[0] || defaultFolder;
        const title = operation.summary || operation.operationId || `${method} ${rawPath}`;
        const description = operation.description || '';

        // Extract parameters
        const parameters: any[] = [];
        const combinedParams = [...(pathItem.parameters || []), ...(operation.parameters || [])];
        for (const p of combinedParams) {
          parameters.push({
            name: p.name,
            in: p.in || 'query',
            type: p.schema?.type || p.type || 'string',
            required: Boolean(p.required),
            default: p.schema?.default !== undefined ? String(p.schema.default) : (p.default !== undefined ? String(p.default) : ''),
            example: p.example || p.schema?.example || '',
            description: p.description || ''
          });
        }

        // Extract Request Bodies
        const requestBodies: any[] = [];
        if (operation.requestBody?.content) {
          for (const [contentType, mediaObj] of Object.entries<any>(operation.requestBody.content)) {
            const schemaRef = mediaObj.schema?.$ref ? mediaObj.schema.$ref.split('/').pop() : '';
            let sampleJson = '';
            if (mediaObj.example) {
              sampleJson = JSON.stringify(mediaObj.example, null, 2);
            } else if (mediaObj.examples) {
              const firstEx: any = Object.values(mediaObj.examples)[0];
              sampleJson = JSON.stringify(firstEx?.value || firstEx, null, 2);
            }
            requestBodies.push({
              contentType,
              name: 'Mẫu chuẩn',
              schemaModel: schemaRef,
              body: sampleJson
            });
          }
        }

        // Extract Responses
        const responses: any[] = [];
        if (operation.responses) {
          for (const [statusCodeStr, respObj] of Object.entries<any>(operation.responses)) {
            const statusCode = Number(statusCodeStr) || 200;
            const respContent = respObj.content?.['application/json'];
            const schemaRef = respContent?.schema?.$ref ? respContent.schema.$ref.split('/').pop() : '';
            let exampleBody = '';
            if (respContent?.example) {
              exampleBody = JSON.stringify(respContent.example, null, 2);
            } else if (respContent?.examples) {
              const firstEx: any = Object.values(respContent.examples)[0];
              exampleBody = JSON.stringify(firstEx?.value || firstEx, null, 2);
            }
            responses.push({
              statusCode,
              description: respObj.description || '',
              headers: [],
              schemaModel: schemaRef,
              examples: exampleBody ? [{ name: 'Mẫu phản hồi', body: exampleBody }] : []
            });
          }
        }

        // Check duplicate
        const existing: any = db.prepare(`
          SELECT id FROM api_endpoints 
          WHERE module_id = ? AND version = ? AND UPPER(method) = ? AND path = ?
        `).get(moduleId, version, method, rawPath);

        if (existing) {
          if (conflictStrategy === 'skip') {
            continue;
          } else if (conflictStrategy === 'keep_both') {
            const newPath = `${rawPath}_dup_${Date.now().toString().slice(-4)}`;
            db.prepare(`
              INSERT INTO api_endpoints (
                module_id, folder, version, method, path, title, description, status,
                parameters, request_bodies, responses, tags
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stable', ?, ?, ?, ?)
            `).run(
              Number(moduleId),
              folder,
              version,
              method,
              newPath,
              title,
              description,
              JSON.stringify(parameters),
              JSON.stringify(requestBodies),
              JSON.stringify(responses),
              JSON.stringify(operation.tags || [])
            );
            importedEndpoints++;
            continue;
          }
          // Default: overwrite
          db.prepare(`
            UPDATE api_endpoints SET
              folder = ?, title = ?, description = ?, parameters = ?,
              request_bodies = ?, responses = ?, tags = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(
            folder,
            title,
            description,
            JSON.stringify(parameters),
            JSON.stringify(requestBodies),
            JSON.stringify(responses),
            JSON.stringify(operation.tags || []),
            existing.id
          );
          importedEndpoints++;
        } else {
          db.prepare(`
            INSERT INTO api_endpoints (
              module_id, folder, version, method, path, title, description, status,
              parameters, request_bodies, responses, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stable', ?, ?, ?, ?)
          `).run(
            Number(moduleId),
            folder,
            version,
            method,
            rawPath,
            title,
            description,
            JSON.stringify(parameters),
            JSON.stringify(requestBodies),
            JSON.stringify(responses),
            JSON.stringify(operation.tags || [])
          );
          importedEndpoints++;
        }
      }
    }

    res.json({
      success: true,
      importedEndpoints,
      importedModels,
      message: `Đã nhập thành công ${importedEndpoints} endpoints và ${importedModels} models`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/api-docs/import/postman
router.post('/import/postman', (req: Request, res: Response) => {
  try {
    const { collection, moduleId, conflictStrategy = 'overwrite' } = req.body;
    if (!collection || !collection.item || !Array.isArray(collection.item)) {
      return res.status(400).json({ error: 'File Postman Collection v2.1 không đúng cấu trúc' });
    }
    if (!moduleId) return res.status(400).json({ error: 'Thiếu moduleId' });

    const db = getDb();
    let importedEndpoints = 0;

    function processItems(items: any[], currentFolder: string) {
      for (const item of items) {
        if (item.item && Array.isArray(item.item)) {
          // Folder
          processItems(item.item, item.name || currentFolder);
        } else if (item.request) {
          // Request
          const req = item.request;
          const method = (req.method || 'GET').toUpperCase();
          let pathVal = '';

          if (typeof req.url === 'string') {
            try {
              const u = new URL(req.url);
              pathVal = u.pathname;
            } catch {
              pathVal = req.url.startsWith('/') ? req.url : `/${req.url}`;
            }
          } else if (req.url?.path) {
            pathVal = `/${Array.isArray(req.url.path) ? req.url.path.join('/') : req.url.path}`;
          }
          if (!pathVal) pathVal = '/';

          const title = item.name || `${method} ${pathVal}`;
          const description = req.description || '';

          // Parameters (query & headers)
          const parameters: any[] = [];
          if (req.url?.query && Array.isArray(req.url.query)) {
            for (const q of req.url.query) {
              parameters.push({
                name: q.key,
                in: 'query',
                type: 'string',
                required: false,
                default: q.value || '',
                example: q.value || '',
                description: q.description || ''
              });
            }
          }
          if (req.header && Array.isArray(req.header)) {
            for (const h of req.header) {
              parameters.push({
                name: h.key,
                in: 'header',
                type: 'string',
                required: false,
                default: h.value || '',
                example: h.value || '',
                description: h.description || ''
              });
            }
          }

          // Request Body
          const requestBodies: any[] = [];
          if (req.body?.raw) {
            requestBodies.push({
              contentType: 'application/json',
              name: 'Mẫu Postman',
              body: req.body.raw
            });
          }

          // Responses
          const responses: any[] = [];
          if (item.response && Array.isArray(item.response)) {
            for (const resp of item.response) {
              responses.push({
                statusCode: resp.code || 200,
                description: resp.name || 'Phản hồi mẫu',
                examples: resp.body ? [{ name: resp.name || 'Sample', body: resp.body }] : []
              });
            }
          }
          if (responses.length === 0) {
            responses.push({ statusCode: 200, description: 'OK', examples: [] });
          }

          // Insert or update
          const existing: any = db.prepare(`
            SELECT id FROM api_endpoints 
            WHERE module_id = ? AND UPPER(method) = ? AND path = ?
          `).get(moduleId, method, pathVal);

          if (existing && conflictStrategy === 'skip') {
            continue;
          }

          if (existing) {
            db.prepare(`
              UPDATE api_endpoints SET
                folder = ?, title = ?, description = ?, parameters = ?,
                request_bodies = ?, responses = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(
              currentFolder,
              title,
              description,
              JSON.stringify(parameters),
              JSON.stringify(requestBodies),
              JSON.stringify(responses),
              existing.id
            );
          } else {
            db.prepare(`
              INSERT INTO api_endpoints (
                module_id, folder, version, method, path, title, description, status,
                parameters, request_bodies, responses
              ) VALUES (?, ?, 'v1', ?, ?, ?, ?, 'stable', ?, ?, ?)
            `).run(
              Number(moduleId),
              currentFolder,
              method,
              pathVal,
              title,
              description,
              JSON.stringify(parameters),
              JSON.stringify(requestBodies),
              JSON.stringify(responses)
            );
          }
          importedEndpoints++;
        }
      }
    }

    processItems(collection.item, collection.info?.name || 'Postman Import');
    res.json({ success: true, importedEndpoints, message: `Đã nhập thành công ${importedEndpoints} endpoints từ Postman` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/api-docs/export/openapi - Export module to OpenAPI 3.0.3 JSON
router.get('/export/openapi', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId, version = 'v1' } = req.query;

    if (!moduleId) return res.status(400).json({ error: 'Thiếu moduleId' });

    const mod: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId);
    const endpoints: any[] = db.prepare('SELECT * FROM api_endpoints WHERE module_id = ? AND version = ?').all(moduleId, version);
    const models: any[] = db.prepare('SELECT * FROM api_models WHERE module_id = ?').all(moduleId);

    // Build OpenAPI 3.0.3 object
    const openApi: any = {
      openapi: '3.0.3',
      info: {
        title: `${mod ? mod.name : 'Module'} API Documentation`,
        version: version.toString().replace(/^v/, '') + '.0.0',
        description: mod?.description || 'Tài liệu kỹ thuật API được xuất từ DevToolkit Handover Platform.'
      },
      servers: [
        { url: 'https://api.internal.domain/api/v1', description: 'Production Gateway' },
        { url: 'https://dev-api.internal.domain/api/v1', description: 'Development Server' }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    };

    // Components schemas
    for (const m of models) {
      const fields = parseJsonSafe(m.fields, []);
      const properties: any = {};
      const requiredList: string[] = [];

      for (const f of fields) {
        properties[f.name] = {
          type: f.type || 'string',
          description: f.description || '',
          example: f.example !== undefined ? f.example : undefined
        };
        if (f.required) requiredList.push(f.name);
      }

      openApi.components.schemas[m.name] = {
        type: 'object',
        description: m.description || '',
        properties,
        ...(requiredList.length > 0 ? { required: requiredList } : {})
      };
    }

    // Paths
    for (const ep of endpoints) {
      const p = ep.path;
      if (!openApi.paths[p]) openApi.paths[p] = {};

      const methodLower = ep.method.toLowerCase();
      const params = parseJsonSafe(ep.parameters, []);
      const reqBodies = parseJsonSafe(ep.request_bodies, []);
      const responses = parseJsonSafe(ep.responses, []);

      const operation: any = {
        tags: [ep.folder || 'Chung'],
        summary: ep.title,
        description: ep.description || '',
        parameters: params.map((param: any) => ({
          name: param.name,
          in: param.in || 'query',
          required: Boolean(param.required),
          description: param.description || '',
          schema: { type: param.type || 'string', default: param.default }
        })),
        responses: {}
      };

      if (ep.status === 'deprecated') {
        operation.deprecated = true;
      }

      // Request Body
      if (reqBodies.length > 0) {
        const first = reqBodies[0];
        operation.requestBody = {
          required: true,
          content: {
            [first.contentType || 'application/json']: {
              schema: first.schemaModel ? { $ref: `#/components/schemas/${first.schemaModel}` } : { type: 'object' },
              ...(first.body ? { example: parseJsonSafe(first.body, first.body) } : {})
            }
          }
        };
      }

      // Responses
      for (const r of responses) {
        const ex = r.examples?.[0];
        operation.responses[String(r.statusCode || 200)] = {
          description: r.description || 'Thành công',
          content: {
            'application/json': {
              schema: r.schemaModel ? { $ref: `#/components/schemas/${r.schemaModel}` } : { type: 'object' },
              ...(ex?.body ? { example: parseJsonSafe(ex.body, ex.body) } : {})
            }
          }
        };
      }

      openApi.paths[p][methodLower] = operation;
    }

    res.setHeader('Content-Disposition', `attachment; filename="openapi_${mod ? mod.slug : 'api'}_${version}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(openApi, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/api-docs/export/markdown - Export module or endpoint to Markdown
router.get('/export/markdown', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { moduleId, endpointId } = req.query;

    if (endpointId) {
      const ep: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(endpointId);
      if (!ep) return res.status(404).json({ error: 'Endpoint không tồn tại' });
      const md = generateEndpointMarkdown(ep);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(md);
    }

    if (!moduleId) return res.status(400).json({ error: 'Thiếu moduleId' });

    const mod: any = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId);
    const endpoints: any[] = db.prepare('SELECT * FROM api_endpoints WHERE module_id = ? ORDER BY folder, sort_order').all(moduleId);

    let md = `# Tài Liệu API: ${mod ? mod.name : 'Module'}\n\n`;
    md += `> Tự động tạo từ DevToolkit Handover Platform - Ngày ${new Date().toLocaleDateString('vi-VN')}\n\n`;

    let currentFolder = '';
    for (const ep of endpoints) {
      if (ep.folder !== currentFolder) {
        currentFolder = ep.folder;
        md += `\n---\n\n## 📁 Thư mục: ${currentFolder}\n\n`;
      }
      md += generateEndpointMarkdown(ep) + '\n\n';
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(md);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function parseJsonSafe(str: any, fallback: any) {
  if (typeof str !== 'string') return str || fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseCurlCommand(curl: string) {
  const methodMatch = curl.match(/-X\s+([A-Z]+)/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : (curl.includes('--data') || curl.includes('-d') ? 'POST' : 'GET');

  const urlMatch = curl.match(/(?:'|")(https?:\/\/[^\s'"]+)(?:'|")/i) || curl.match(/(https?:\/\/[^\s'"]+)/i);
  let fullUrl = urlMatch ? urlMatch[1] : '';
  let path = '/';
  if (fullUrl) {
    try {
      const u = new URL(fullUrl);
      path = u.pathname;
    } catch {
      path = fullUrl.replace(/^https?:\/\/[^\/]+/, '') || '/';
    }
  }

  // Parameters
  const parameters: any[] = [];
  const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
  let match;
  while ((match = headerRegex.exec(curl)) !== null) {
    const parts = match[1].split(':');
    if (parts.length >= 2) {
      parameters.push({
        name: parts[0].trim(),
        in: 'header',
        type: 'string',
        required: false,
        example: parts.slice(1).join(':').trim(),
        description: 'Header từ cURL'
      });
    }
  }

  // Body
  const dataMatch = curl.match(/(?:--data|-d)\s+['"](.+?)['"](?:\s+|$)/s);
  const requestBodies: any[] = [];
  if (dataMatch) {
    requestBodies.push({
      contentType: 'application/json',
      name: 'Payload từ cURL',
      body: dataMatch[1]
    });
  }

  return {
    method,
    path,
    title: `${method} ${path}`,
    parameters,
    requestBodies
  };
}

function extractFieldsFromSchema(schema: any): any[] {
  const fields: any[] = [];
  if (!schema || !schema.properties) return fields;

  const requiredList: string[] = schema.required || [];
  for (const [propName, propObj] of Object.entries<any>(schema.properties)) {
    fields.push({
      name: propName,
      type: propObj.type || (propObj.$ref ? 'object' : 'string'),
      required: requiredList.includes(propName),
      description: propObj.description || '',
      example: propObj.example !== undefined ? propObj.example : ''
    });
  }
  return fields;
}

function generateEndpointMarkdown(ep: any): string {
  const params = parseJsonSafe(ep.parameters, []);
  const reqBodies = parseJsonSafe(ep.request_bodies, []);
  const responses = parseJsonSafe(ep.responses, []);

  let md = `### [${ep.method}] \`${ep.path}\`\n\n`;
  md += `**Tiêu đề:** ${ep.title}  \n`;
  md += `**Trạng thái:** \`${ep.status}\` | **Phiên bản:** \`${ep.version}\` | **Xác thực:** \`${ep.auth_type}\`  \n\n`;

  if (ep.description) {
    md += `${ep.description}\n\n`;
  }

  if (params.length > 0) {
    md += `#### Tham số (Parameters)\n\n`;
    md += `| Tên | Vị trí | Kiểu | Bắt buộc | Mặc định | Mô tả |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const p of params) {
      md += `| \`${p.name}\` | ${p.in || 'query'} | \`${p.type || 'string'}\` | ${p.required ? '**Có**' : 'Không'} | ${p.default || '-'} | ${p.description || '-'} |\n`;
    }
    md += `\n`;
  }

  if (reqBodies.length > 0) {
    md += `#### Request Body\n\n`;
    for (const rb of reqBodies) {
      md += `**${rb.name}** (\`${rb.contentType || 'application/json'}\`):\n\n`;
      md += `\`\`\`json\n${rb.body || '{}'}\n\`\`\`\n\n`;
    }
  }

  if (responses.length > 0) {
    md += `#### Responses\n\n`;
    for (const r of responses) {
      md += `**Mã phản hồi: \`${r.statusCode}\`** - ${r.description || ''}\n\n`;
      if (r.examples && r.examples.length > 0) {
        for (const ex of r.examples) {
          md += `*${ex.name}:*\n\`\`\`json\n${ex.body || '{}'}\n\`\`\`\n\n`;
        }
      }
    }
  }

  return md;
}

export default router;
