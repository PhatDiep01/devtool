// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { getDataDir } from '../services/file-manager';

let db: any = null;

/**
 * Get or create the singleton SQLite database instance using Node 22/24 built-in node:sqlite.
 * Zero external native C++ compilation needed!
 */
export function getDb(): any {
  if (db) return db;

  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'devtoolkit.db');
  db = new DatabaseSync(dbPath);

  // Enable WAL mode & foreign keys
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(db);

  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: any): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#3b82f6',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      file_path TEXT NOT NULL,
      author TEXT,
      status TEXT DEFAULT 'Draft',
      tags TEXT DEFAULT '[]',
      jira_key TEXT,
      overview TEXT,
      raw_content TEXT,
      parsed_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id),
      UNIQUE(module_id, slug)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_id INTEGER,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (screen_id) REFERENCES screens(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      category TEXT DEFAULT 'general'
    );

    -- Ensure default Jira base URL is task.ascvn.com.vn
    INSERT OR IGNORE INTO settings (key, value, category) 
    VALUES ('jira_base_url', 'https://task.ascvn.com.vn', 'jira');

    -- Ensure default backend production domain is permanently set to https://devtool.phatdiep.io.vn
    INSERT INTO settings (key, value, category) 
    VALUES ('backend_tunnel_url', 'https://devtool.phatdiep.io.vn', 'network')
    ON CONFLICT(key) DO UPDATE SET value = 'https://devtool.phatdiep.io.vn' WHERE value LIKE '%trycloudflare.com%' OR value = '';

    CREATE TABLE IF NOT EXISTS jira_sessions (
      token TEXT PRIMARY KEY,
      username TEXT,
      user_email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      base_url TEXT NOT NULL,
      api_token TEXT NOT NULL,
      auth_type TEXT DEFAULT 'basic',
      session_cookie TEXT,
      remember_me INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_jira_sessions_expires ON jira_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_screens_module_id ON screens(module_id);
    CREATE INDEX IF NOT EXISTS idx_screens_slug ON screens(slug);
    CREATE INDEX IF NOT EXISTS idx_screens_status ON screens(status);
    CREATE INDEX IF NOT EXISTS idx_screens_updated_at ON screens(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_images_screen_id ON images(screen_id);

    -- Full-text search FTS5 table
    CREATE VIRTUAL TABLE IF NOT EXISTS screens_fts USING fts5(
      title, author, tags, overview, raw_content,
      content='screens',
      content_rowid='id'
    );

    -- Triggers to sync screens with FTS index
    CREATE TRIGGER IF NOT EXISTS screens_ai AFTER INSERT ON screens BEGIN
      INSERT INTO screens_fts(rowid, title, author, tags, overview, raw_content)
      VALUES (new.id, new.title, new.author, new.tags, new.overview, new.raw_content);
    END;

    CREATE TRIGGER IF NOT EXISTS screens_ad AFTER DELETE ON screens BEGIN
      INSERT INTO screens_fts(screens_fts, rowid, title, author, tags, overview, raw_content)
      VALUES ('delete', old.id, old.title, old.author, old.tags, old.overview, old.raw_content);
    END;

    CREATE TRIGGER IF NOT EXISTS screens_au AFTER UPDATE ON screens BEGIN
      INSERT INTO screens_fts(screens_fts, rowid, title, author, tags, overview, raw_content)
      VALUES ('delete', old.id, old.title, old.author, old.tags, old.overview, old.raw_content);
      INSERT INTO screens_fts(rowid, title, author, tags, overview, raw_content)
      VALUES (new.id, new.title, new.author, new.tags, new.overview, new.raw_content);
    END;

    -- Bug Tracker Table
    CREATE TABLE IF NOT EXISTS bugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      us_key TEXT,
      us_link TEXT,
      type TEXT NOT NULL DEFAULT 'FE',
      status TEXT NOT NULL DEFAULT 'todo',
      severity TEXT DEFAULT 'medium',
      description TEXT,
      payload TEXT,
      fix_solution TEXT,
      attachments TEXT DEFAULT '[]',
      created_by TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
    CREATE INDEX IF NOT EXISTS idx_bugs_type ON bugs(type);
    CREATE INDEX IF NOT EXISTS idx_bugs_us_key ON bugs(us_key);
    CREATE INDEX IF NOT EXISTS idx_bugs_updated_at ON bugs(updated_at DESC);

    -- Bug Image Annotations Table
    CREATE TABLE IF NOT EXISTS bug_annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id INTEGER NOT NULL,
      image_id TEXT NOT NULL,
      annotations TEXT NOT NULL DEFAULT '[]',
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
      UNIQUE(bug_id, image_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bug_annotations_bug_id ON bug_annotations(bug_id);
    CREATE INDEX IF NOT EXISTS idx_bug_annotations_image_id ON bug_annotations(image_id);

    -- API Documentation: Endpoints Table
    CREATE TABLE IF NOT EXISTS api_endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      folder TEXT DEFAULT 'Chung',
      version TEXT DEFAULT 'v1',
      method TEXT NOT NULL DEFAULT 'GET',
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'stable',
      deprecated_reason TEXT,
      replaced_by_id INTEGER,
      tags TEXT DEFAULT '[]',
      assignee TEXT,
      auth_type TEXT DEFAULT 'bearer',
      auth_roles TEXT,
      parameters TEXT DEFAULT '[]',
      request_bodies TEXT DEFAULT '[]',
      responses TEXT DEFAULT '[]',
      related_error_codes TEXT DEFAULT '[]',
      business_notes TEXT,
      rate_limit TEXT,
      change_history TEXT DEFAULT '[]',
      linked_screen_id INTEGER,
      linked_bug_id INTEGER,
      is_pinned INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_api_endpoints_module ON api_endpoints(module_id);
    CREATE INDEX IF NOT EXISTS idx_api_endpoints_folder ON api_endpoints(folder);
    CREATE INDEX IF NOT EXISTS idx_api_endpoints_version ON api_endpoints(version);
    CREATE INDEX IF NOT EXISTS idx_api_endpoints_method ON api_endpoints(method);
    CREATE INDEX IF NOT EXISTS idx_api_endpoints_status ON api_endpoints(status);
    CREATE INDEX IF NOT EXISTS idx_api_endpoints_sort ON api_endpoints(sort_order ASC, id ASC);

    -- API Documentation: Schemas / Models Table
    CREATE TABLE IF NOT EXISTS api_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      fields TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
      UNIQUE(module_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_api_models_module ON api_models(module_id);

    -- API Documentation: Error Codes Table
    CREATE TABLE IF NOT EXISTS api_error_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER,
      code TEXT NOT NULL,
      http_status INTEGER DEFAULT 400,
      message TEXT NOT NULL,
      description TEXT,
      resolution TEXT,
      category TEXT DEFAULT 'business',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_error_codes_module ON api_error_codes(module_id);
    CREATE INDEX IF NOT EXISTS idx_api_error_codes_code ON api_error_codes(code);
    CREATE INDEX IF NOT EXISTS idx_api_error_codes_http ON api_error_codes(http_status);

    -- Seed essential modules
    INSERT OR IGNORE INTO modules (name, slug, icon, sort_order) VALUES ('Survey Management', 'survey-management', '📊', 1);
    INSERT OR IGNORE INTO modules (name, slug, icon, sort_order) VALUES ('General', 'general', '📁', 2);
  `);

  // Seed sample data for API Documentation if empty
  seedApiDocumentationSample(database);

  // Safe migration for existing DB
  try {
    database.exec("ALTER TABLE jira_sessions ADD COLUMN auth_type TEXT DEFAULT 'basic';");
  } catch {}
  try {
    database.exec("ALTER TABLE jira_sessions ADD COLUMN username TEXT;");
  } catch {}
  try {
    database.exec("ALTER TABLE jira_sessions ADD COLUMN session_cookie TEXT;");
  } catch {}
  try {
    database.exec("ALTER TABLE jira_sessions ADD COLUMN remember_me INTEGER DEFAULT 0;");
  } catch {}
  try {
    database.exec("ALTER TABLE modules ADD COLUMN description TEXT;");
  } catch {}
  try {
    database.exec("ALTER TABLE modules ADD COLUMN color TEXT DEFAULT '#3b82f6';");
  } catch {}
  try {
    database.exec("ALTER TABLE bugs ADD COLUMN payload TEXT;");
  } catch {}
}

function seedApiDocumentationSample(database: any): void {
  try {
    const epCountResult: any = database.prepare('SELECT COUNT(*) as cnt FROM api_endpoints').get();
    if (epCountResult && epCountResult.cnt > 0) return;

    let targetModule: any = database.prepare('SELECT id FROM modules WHERE slug = ?').get('survey-management');
    if (!targetModule) {
      targetModule = database.prepare('SELECT id FROM modules LIMIT 1').get();
    }
    if (!targetModule) return;
    const moduleId = targetModule.id;

    // 1. Seed Models
    const insertModel = database.prepare(`
      INSERT OR IGNORE INTO api_models (module_id, name, description, fields)
      VALUES (?, ?, ?, ?)
    `);

    insertModel.run(
      moduleId,
      'SurveyDto',
      'Thực thể đối tượng khảo sát đầy đủ thông tin',
      JSON.stringify([
        { name: 'id', type: 'integer', required: true, description: 'ID định danh duy nhất', example: 1024 },
        { name: 'surveyCode', type: 'string', required: true, description: 'Mã nghiệp vụ khảo sát', example: 'SRV-2026-0012' },
        { name: 'title', type: 'string', required: true, description: 'Tiêu đề khảo sát', example: 'Khảo sát độ hài lòng khách hàng Q4/2026' },
        { name: 'categoryCode', type: 'string', required: true, description: 'Mã danh mục khảo sát', example: 'CUSTOMER_CSAT' },
        { name: 'status', type: 'string', required: true, description: 'Trạng thái', enum: ['Draft', 'Published', 'Expired', 'Archived'], example: 'Published' },
        { name: 'isAnonymous', type: 'boolean', required: false, description: 'Cho phép trả lời ẩn danh', example: false },
        { name: 'startTime', type: 'string', required: true, description: 'Thời gian bắt đầu (ISO 8601 UTC)', example: '2026-11-01T08:00:00Z' },
        { name: 'endTime', type: 'string', required: true, description: 'Thời gian kết thúc (ISO 8601 UTC)', example: '2026-11-30T17:00:00Z' },
        { name: 'createdAt', type: 'string', required: true, description: 'Thời điểm tạo', example: '2026-10-24T08:30:00Z' }
      ])
    );

    insertModel.run(
      moduleId,
      'CreateSurveyRequest',
      'Dữ liệu payload yêu cầu tạo mới khảo sát',
      JSON.stringify([
        { name: 'title', type: 'string', required: true, description: 'Tiêu đề khảo sát (5 - 255 ký tự)', constraints: 'min: 5, max: 255', example: 'Khảo sát nhân viên 2026' },
        { name: 'categoryCode', type: 'string', required: true, description: 'Mã danh mục', example: 'INTERNAL_HR' },
        { name: 'startTime', type: 'string', required: true, description: 'Thời gian bắt đầu (UTC)', example: '2026-11-01T08:00:00Z' },
        { name: 'endTime', type: 'string', required: true, description: 'Thời gian kết thúc (phải sau startTime)', example: '2026-11-15T18:00:00Z' },
        { name: 'isAnonymous', type: 'boolean', required: false, description: 'Ẩn danh hay không (mặc định false)', example: false }
      ])
    );

    insertModel.run(
      moduleId,
      'PaginationMeta',
      'Cấu trúc thông tin phân trang danh sách',
      JSON.stringify([
        { name: 'page', type: 'integer', required: true, description: 'Trang hiện tại (bắt đầu từ 1)', example: 1 },
        { name: 'pageSize', type: 'integer', required: true, description: 'Số bản ghi trên mỗi trang', example: 20 },
        { name: 'totalCount', type: 'integer', required: true, description: 'Tổng số bản ghi thỏa điều kiện', example: 145 },
        { name: 'totalPages', type: 'integer', required: true, description: 'Tổng số trang', example: 8 }
      ])
    );

    // 2. Seed Error Codes
    const insertErrorCode = database.prepare(`
      INSERT INTO api_error_codes (module_id, code, http_status, message, description, resolution, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertErrorCode.run(moduleId, 'VALIDATION_FAILED', 400, 'Dữ liệu đầu vào không hợp lệ', 'Bỏ trống trường bắt buộc hoặc EndTime nhỏ hơn hoặc bằng StartTime', 'Client kiểm tra lại form và hiển thị inline lỗi ở từng trường', 'validation');
    insertErrorCode.run(moduleId, 'AUTH_TOKEN_EXPIRED', 401, 'Phiên đăng nhập đã hết hạn', 'Token JWT hết hạn hoặc chữ ký token không hợp lệ', 'Client gọi API refresh token hoặc chuyển hướng người dùng về màn hình đăng nhập', 'auth');
    insertErrorCode.run(moduleId, 'INSUFFICIENT_PERMISSIONS', 403, 'Không có quyền thao tác', 'Tài khoản thiếu vai trò Survey.Admin hoặc Survey.Manager', 'Liên hệ Quản trị viên hệ thống để được gán quyền phù hợp', 'auth');
    insertErrorCode.run(moduleId, 'SURVEY_NOT_FOUND', 404, 'Không tìm thấy khảo sát', 'ID khảo sát không tồn tại trong hệ thống hoặc đã bị xóa mềm', 'Kiểm tra lại ID trong đường dẫn hoặc tải lại danh sách khảo sát mới nhất', 'business');
    insertErrorCode.run(moduleId, 'CONCURRENCY_CONFLICT', 409, 'Xung đột phiên bản dữ liệu', 'Bản ghi đã được người dùng khác cập nhật trong lúc bạn đang thao tác', 'Tải lại dữ liệu mới nhất trước khi chỉnh sửa để tránh ghi đè dữ liệu cũ', 'business');
    insertErrorCode.run(moduleId, 'INTERNAL_SERVER_ERROR', 500, 'Lỗi máy chủ nội bộ', 'Xảy ra lỗi không mong muốn trong quá trình xử lý dịch vụ', 'Kiểm tra log hệ thống với Correlation-ID và báo cáo cho đội Backend', 'system');

    // 3. Seed Endpoints
    const insertEndpoint = database.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        deprecated_reason, tags, assignee, auth_type, auth_roles,
        parameters, request_bodies, responses, related_error_codes,
        business_notes, rate_limit, change_history, is_pinned, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Endpoint 1: GET /api/v1/surveys
    insertEndpoint.run(
      moduleId,
      'Khảo sát (Surveys)',
      'v1',
      'GET',
      '/api/v1/surveys',
      'Lấy danh sách khảo sát phân trang',
      'Truy xuất danh sách khảo sát có hỗ trợ phân trang, lọc theo trạng thái và tìm kiếm theo từ khóa tiêu đề.',
      'stable',
      null,
      JSON.stringify(['Survey', 'Read', 'Pagination']),
      'Nguyễn Văn A (Dev)',
      'bearer',
      'Survey.Viewer, Survey.Manager',
      JSON.stringify([
        { name: 'page', in: 'query', type: 'integer', required: false, default: '1', example: '1', description: 'Chỉ số trang' },
        { name: 'pageSize', in: 'query', type: 'integer', required: false, default: '20', example: '20', description: 'Số lượng bản ghi mỗi trang' },
        { name: 'status', in: 'query', type: 'string', required: false, default: '', example: 'Published', description: 'Lọc trạng thái', constraints: 'Draft | Published | Expired | Archived' },
        { name: 'keyword', in: 'query', type: 'string', required: false, default: '', example: 'CSAT', description: 'Từ khóa tìm kiếm theo tiêu đề' }
      ]),
      JSON.stringify([]),
      JSON.stringify([
        {
          statusCode: 200,
          description: 'Lấy danh sách khảo sát thành công',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          schemaModel: 'SurveyDto',
          examples: [
            {
              name: 'Trường hợp có dữ liệu',
              body: JSON.stringify({
                success: true,
                data: {
                  items: [
                    { id: 1024, surveyCode: 'SRV-2026-0012', title: 'Khảo sát CSAT Q4/2026', categoryCode: 'CUSTOMER_CSAT', status: 'Published', isAnonymous: false, startTime: '2026-11-01T08:00:00Z', endTime: '2026-11-30T17:00:00Z', createdAt: '2026-10-24T08:30:00Z' }
                  ],
                  pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }
                }
              }, null, 2)
            }
          ]
        },
        {
          statusCode: 401,
          description: 'Chưa xác thực hoặc token hết hạn',
          headers: [],
          examples: [
            {
              name: 'Lỗi 401',
              body: JSON.stringify({ success: false, code: 'AUTH_TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn' }, null, 2)
            }
          ]
        }
      ]),
      JSON.stringify(['AUTH_TOKEN_EXPIRED', 'INSUFFICIENT_PERMISSIONS']),
      '- Kết quả mặc định sắp xếp giảm dần theo `createdAt`.\n- Hỗ trợ cache phía Client trong 30 giây.',
      '120 req/min',
      JSON.stringify([{ author: 'Nguyễn Văn A', action: 'Khởi tạo endpoint v1', timestamp: '2026-10-24 10:00:00' }]),
      1,
      1
    );

    // Endpoint 2: POST /api/v1/surveys
    insertEndpoint.run(
      moduleId,
      'Khảo sát (Surveys)',
      'v1',
      'POST',
      '/api/v1/surveys',
      'Tạo bản nháp khảo sát mới',
      'Khởi tạo một bản ghi khảo sát mới ở trạng thái `Draft`. Yêu cầu quyền quản lý khảo sát.',
      'stable',
      null,
      JSON.stringify(['Survey', 'Create', 'Draft']),
      'Trần Thị B (BA)',
      'bearer',
      'Survey.Manager, Survey.Admin',
      JSON.stringify([
        { name: 'X-Correlation-ID', in: 'header', type: 'string', required: false, example: 'b947f63d-4c31-4c6e-8260-8f921f081290', description: 'Trace request qua các microservice' }
      ]),
      JSON.stringify([
        {
          contentType: 'application/json',
          name: 'Tạo khảo sát chuẩn',
          schemaModel: 'CreateSurveyRequest',
          body: JSON.stringify({
            title: 'Khảo sát mức độ hài lòng khách hàng VIP Q4/2026',
            categoryCode: 'CUSTOMER_CSAT',
            startTime: '2026-11-01T08:00:00Z',
            endTime: '2026-11-30T17:00:00Z',
            isAnonymous: false
          }, null, 2)
        },
        {
          contentType: 'application/json',
          name: 'Khảo sát ẩn danh nội bộ',
          schemaModel: 'CreateSurveyRequest',
          body: JSON.stringify({
            title: 'Khảo sát môi trường làm việc 2026',
            categoryCode: 'INTERNAL_HR',
            startTime: '2026-11-10T08:00:00Z',
            endTime: '2026-11-20T17:00:00Z',
            isAnonymous: true
          }, null, 2)
        }
      ]),
      JSON.stringify([
        {
          statusCode: 201,
          description: 'Tạo khảo sát thành công',
          headers: [{ name: 'Location', value: '/api/v1/surveys/1025' }],
          schemaModel: 'SurveyDto',
          examples: [
            {
              name: 'Phản hồi 201 Created',
              body: JSON.stringify({
                success: true,
                message: 'Tạo khảo sát thành công',
                data: { id: 1025, surveyCode: 'SRV-2026-0013', title: 'Khảo sát mức độ hài lòng khách hàng VIP Q4/2026', categoryCode: 'CUSTOMER_CSAT', status: 'Draft', isAnonymous: false, startTime: '2026-11-01T08:00:00Z', endTime: '2026-11-30T17:00:00Z', createdAt: '2026-10-28T09:00:00Z' }
              }, null, 2)
            }
          ]
        },
        {
          statusCode: 400,
          description: 'Dữ liệu không hợp lệ',
          headers: [],
          examples: [
            {
              name: 'Thiếu trường bắt buộc hoặc ngày kết thúc sai',
              body: JSON.stringify({
                success: false,
                code: 'VALIDATION_FAILED',
                message: 'Dữ liệu đầu vào không hợp lệ',
                errors: { endTime: ['Thời gian kết thúc phải lớn hơn thời gian bắt đầu'] }
              }, null, 2)
            }
          ]
        }
      ]),
      JSON.stringify(['VALIDATION_FAILED', 'AUTH_TOKEN_EXPIRED', 'INSUFFICIENT_PERMISSIONS']),
      '- Tiêu đề khảo sát không được trùng lặp trong cùng một khoảng thời gian của phân hệ.\n- Mã `surveyCode` được sinh tự động theo quy tắc `SRV-{YYYY}-{STT}`.',
      '60 req/min',
      JSON.stringify([{ author: 'Trần Thị B', action: 'Bổ sung ràng buộc endTime > startTime', timestamp: '2026-10-25 14:20:00' }]),
      1,
      2
    );

    // Endpoint 3: GET /api/v1/surveys/{id}
    insertEndpoint.run(
      moduleId,
      'Khảo sát (Surveys)',
      'v1',
      'GET',
      '/api/v1/surveys/{id}',
      'Lấy thông tin chi tiết một khảo sát',
      'Truy xuất đầy đủ thông tin chi tiết của một khảo sát thông qua ID bản ghi.',
      'stable',
      null,
      JSON.stringify(['Survey', 'Detail']),
      'Nguyễn Văn A (Dev)',
      'bearer',
      'Survey.Viewer, Survey.Manager',
      JSON.stringify([
        { name: 'id', in: 'path', type: 'integer', required: true, example: '1024', description: 'ID định danh duy nhất của khảo sát' }
      ]),
      JSON.stringify([]),
      JSON.stringify([
        {
          statusCode: 200,
          description: 'Tìm thấy khảo sát',
          headers: [],
          schemaModel: 'SurveyDto',
          examples: [
            {
              name: 'Chi tiết thành công',
              body: JSON.stringify({
                success: true,
                data: { id: 1024, surveyCode: 'SRV-2026-0012', title: 'Khảo sát CSAT Q4/2026', categoryCode: 'CUSTOMER_CSAT', status: 'Published', isAnonymous: false, startTime: '2026-11-01T08:00:00Z', endTime: '2026-11-30T17:00:00Z', createdAt: '2026-10-24T08:30:00Z' }
              }, null, 2)
            }
          ]
        },
        {
          statusCode: 404,
          description: 'Không tìm thấy khảo sát',
          headers: [],
          examples: [
            {
              name: 'Không tìm thấy ID',
              body: JSON.stringify({ success: false, code: 'SURVEY_NOT_FOUND', message: 'Không tìm thấy khảo sát với ID 1024' }, null, 2)
            }
          ]
        }
      ]),
      JSON.stringify(['SURVEY_NOT_FOUND', 'AUTH_TOKEN_EXPIRED']),
      'Nếu khảo sát ở trạng thái xóa mềm (`isDeleted = true`), API sẽ trả về 404.',
      '300 req/min',
      JSON.stringify([]),
      0,
      3
    );

    // Endpoint 4: DELETE /api/v1/surveys/{id} (Deprecated)
    insertEndpoint.run(
      moduleId,
      'Khảo sát (Surveys)',
      'v1',
      'DELETE',
      '/api/v1/surveys/{id}',
      'Xóa khảo sát (Sắp bãi bỏ)',
      'Xóa cứng bản ghi khảo sát khỏi hệ thống.',
      'deprecated',
      'Phương thức xóa cứng tiềm ẩn mất mát dữ liệu audit trail. Vui lòng chuyển sang dùng API lưu trữ: POST /api/v1/surveys/{id}/archive',
      JSON.stringify(['Survey', 'Delete', 'Deprecated']),
      'Lê Văn C (Tech Lead)',
      'bearer',
      'Survey.Admin',
      JSON.stringify([
        { name: 'id', in: 'path', type: 'integer', required: true, example: '1024', description: 'ID khảo sát cần xóa' }
      ]),
      JSON.stringify([]),
      JSON.stringify([
        {
          statusCode: 200,
          description: 'Xóa thành công',
          headers: [],
          examples: [
            {
              name: 'Phản hồi xóa',
              body: JSON.stringify({ success: true, message: 'Đã xóa khảo sát' }, null, 2)
            }
          ]
        }
      ]),
      JSON.stringify(['SURVEY_NOT_FOUND', 'INSUFFICIENT_PERMISSIONS']),
      'Endpoint này sẽ chính thức bị gỡ bỏ vào quý 1/2027.',
      '30 req/min',
      JSON.stringify([{ author: 'Lê Văn C', action: 'Đánh dấu Deprecated, hướng dẫn chuyển sang archive endpoint', timestamp: '2026-10-26 11:00:00' }]),
      0,
      4
    );

    console.log('[ApiDocs] Seeded sample API documentation data successfully.');
  } catch (err) {
    console.warn('[ApiDocs] Seed sample data non-fatal warning:', err);
  }
}
