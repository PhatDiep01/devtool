import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../db/sqlite';

describe('API Documentation Backend Test Suite', () => {
  let testModuleId: number;
  let testEndpointId: number;
  let testModelId: number;
  let testErrorCodeId: number;

  before(() => {
    const db = getDb();
    // Ensure test module exists
    const mod = db.prepare('SELECT id FROM modules WHERE slug = ?').get('survey-management');
    if (mod) {
      testModuleId = (mod as any).id;
    } else {
      const res = db.prepare('INSERT INTO modules (name, slug) VALUES (?, ?)').run('Test Module', 'test-module');
      testModuleId = Number(res.lastInsertRowid);
    }
  });

  after(() => {
    const db = getDb();
    if (testEndpointId) {
      db.prepare('DELETE FROM api_endpoints WHERE id = ?').run(testEndpointId);
    }
    if (testModelId) {
      db.prepare('DELETE FROM api_models WHERE id = ?').run(testModelId);
    }
    if (testErrorCodeId) {
      db.prepare('DELETE FROM api_error_codes WHERE id = ?').run(testErrorCodeId);
    }
  });

  it('should verify api_endpoints table and indexes structure', () => {
    const db = getDb();
    const tableInfo = db.prepare('PRAGMA table_info(api_endpoints)').all();
    assert.ok(tableInfo.length > 0, 'api_endpoints table must exist');

    const colNames = tableInfo.map((c: any) => c.name);
    assert.ok(colNames.includes('id'));
    assert.ok(colNames.includes('module_id'));
    assert.ok(colNames.includes('folder'));
    assert.ok(colNames.includes('version'));
    assert.ok(colNames.includes('method'));
    assert.ok(colNames.includes('path'));
    assert.ok(colNames.includes('title'));
    assert.ok(colNames.includes('parameters'));
    assert.ok(colNames.includes('request_bodies'));
    assert.ok(colNames.includes('responses'));
    assert.ok(colNames.includes('related_error_codes'));
    assert.ok(colNames.includes('is_pinned'));
  });

  it('should insert a new API endpoint with JSON fields', () => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        parameters, request_bodies, responses, related_error_codes, is_pinned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      testModuleId,
      'Unit Test Folder',
      'v1',
      'POST',
      '/api/v1/test-endpoint',
      'Test Create Endpoint',
      'Test endpoint description',
      'draft',
      JSON.stringify([{ name: 'param1', in: 'query', type: 'string', required: true }]),
      JSON.stringify([{ name: 'Payload 1', contentType: 'application/json', body: '{"test": 123}' }]),
      JSON.stringify([{ statusCode: 200, description: 'OK', examples: [{ name: 'ex1', body: '{"ok": true}' }] }]),
      JSON.stringify(['TEST_ERR_01']),
      0
    );

    testEndpointId = Number(result.lastInsertRowid);
    assert.ok(testEndpointId > 0, 'Inserted endpoint ID must be positive');

    const fetched: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(testEndpointId);
    assert.equal(fetched.method, 'POST');
    assert.equal(fetched.path, '/api/v1/test-endpoint');
    assert.equal(fetched.title, 'Test Create Endpoint');
    assert.equal(fetched.status, 'draft');

    const params = JSON.parse(fetched.parameters);
    assert.equal(params.length, 1);
    assert.equal(params[0].name, 'param1');
  });

  it('should toggle pin status on an endpoint', () => {
    const db = getDb();
    db.prepare('UPDATE api_endpoints SET is_pinned = 1 WHERE id = ?').run(testEndpointId);
    const pinned: any = db.prepare('SELECT is_pinned FROM api_endpoints WHERE id = ?').get(testEndpointId);
    assert.equal(pinned.is_pinned, 1);

    db.prepare('UPDATE api_endpoints SET is_pinned = 0 WHERE id = ?').run(testEndpointId);
    const unpinned: any = db.prepare('SELECT is_pinned FROM api_endpoints WHERE id = ?').get(testEndpointId);
    assert.equal(unpinned.is_pinned, 0);
  });

  it('should duplicate an endpoint correctly', () => {
    const db = getDb();
    const source: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(testEndpointId);
    assert.ok(source);

    const dupRes = db.prepare(`
      INSERT INTO api_endpoints (
        module_id, folder, version, method, path, title, description, status,
        parameters, request_bodies, responses, is_pinned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      source.module_id,
      source.folder,
      source.version,
      source.method,
      `${source.path}-copy`,
      `${source.title} (Bản sao)`,
      source.description,
      'draft',
      source.parameters,
      source.request_bodies,
      source.responses,
      0
    );

    const dupId = Number(dupRes.lastInsertRowid);
    assert.ok(dupId > 0);

    const dupRow: any = db.prepare('SELECT * FROM api_endpoints WHERE id = ?').get(dupId);
    assert.equal(dupRow.path, '/api/v1/test-endpoint-copy');
    assert.equal(dupRow.title, 'Test Create Endpoint (Bản sao)');

    // Clean up duplicate
    db.prepare('DELETE FROM api_endpoints WHERE id = ?').run(dupId);
  });

  it('should create and verify API Model (Schema)', () => {
    const db = getDb();
    const res = db.prepare(`
      INSERT INTO api_models (module_id, name, description, fields)
      VALUES (?, ?, ?, ?)
    `).run(
      testModuleId,
      'TestUserDto',
      'Test user schema DTO',
      JSON.stringify([
        { name: 'id', type: 'integer', required: true },
        { name: 'username', type: 'string', required: true },
        { name: 'isActive', type: 'boolean', required: false }
      ])
    );

    testModelId = Number(res.lastInsertRowid);
    assert.ok(testModelId > 0);

    const model: any = db.prepare('SELECT * FROM api_models WHERE id = ?').get(testModelId);
    assert.equal(model.name, 'TestUserDto');
    const fields = JSON.parse(model.fields);
    assert.equal(fields.length, 3);
    assert.equal(fields[0].name, 'id');
  });

  it('should create and verify API Error Code', () => {
    const db = getDb();
    const res = db.prepare(`
      INSERT INTO api_error_codes (module_id, code, http_status, message, description, resolution, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      testModuleId,
      'TEST_ERR_CUSTOM',
      422,
      'Lỗi kiểm thử tùy chỉnh',
      'Nguyên nhân kiểm thử',
      'Cách khắc phục kiểm thử',
      'business'
    );

    testErrorCodeId = Number(res.lastInsertRowid);
    assert.ok(testErrorCodeId > 0);

    const ec: any = db.prepare('SELECT * FROM api_error_codes WHERE id = ?').get(testErrorCodeId);
    assert.equal(ec.code, 'TEST_ERR_CUSTOM');
    assert.equal(ec.http_status, 422);
    assert.equal(ec.category, 'business');
  });

  it('should save real response example to endpoint documentation', () => {
    const db = getDb();
    const endpoint: any = db.prepare('SELECT responses FROM api_endpoints WHERE id = ?').get(testEndpointId);
    assert.ok(endpoint);

    const initialResponses = JSON.parse(endpoint.responses || '[]');
    const newExample = {
      statusCode: 201,
      description: 'Phản hồi tạo mới thực tế từ Postman Runner',
      name: 'Mẫu thực tế (201 Created)',
      body: JSON.stringify({ id: 999, message: 'Created successfully' })
    };

    initialResponses.push({
      statusCode: newExample.statusCode,
      description: newExample.description,
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      examples: [{ name: newExample.name, body: newExample.body }]
    });

    db.prepare('UPDATE api_endpoints SET responses = ? WHERE id = ?').run(
      JSON.stringify(initialResponses),
      testEndpointId
    );

    const updated: any = db.prepare('SELECT responses FROM api_endpoints WHERE id = ?').get(testEndpointId);
    const parsedUpdated = JSON.parse(updated.responses);
    const found201 = parsedUpdated.find((r: any) => r.statusCode === 201);
    assert.ok(found201);
    assert.equal(found201.examples[0].name, 'Mẫu thực tế (201 Created)');
  });
});
