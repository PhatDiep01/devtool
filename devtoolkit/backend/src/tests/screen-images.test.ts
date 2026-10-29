process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../index';
import { getDb } from '../db/sqlite';

let testServer: http.Server;
let port: number;

function makeRequest(
  path: string,
  options: http.RequestOptions = {},
  postData?: any
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const bodyStr = postData ? JSON.stringify(postData) : undefined;
    const reqOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed: any = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          parsed = body;
        }
        resolve({
          status: res.statusCode || 500,
          data: parsed,
          headers: res.headers,
        });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

describe('Screen Images & Documents API Test Suite', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    });
  });

  it('should auto-link images referenced in markdown content and retrieve them with screen', async () => {
    const db = getDb();

    // 1. Insert a test module
    const modRes = await makeRequest('/api/docs/modules', { method: 'POST' }, {
      name: 'Test Image Module',
      icon: '🖼️',
      color: '#3b82f6',
    });
    assert.equal(modRes.status, 201);
    const moduleId = modRes.data.id;

    // 2. Insert dummy image in images table
    const storedName = 'test-image-uuid-123.png';
    const originalName = 'Mockup_Dashboard.png';
    const imgInfo = db.prepare(`
      INSERT INTO images (original_name, stored_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?)
    `).run(originalName, storedName, 'image/png', 102400);
    const imageId = Number(imgInfo.lastInsertRowid);

    // 3. Create screen referencing this image in raw_content
    const screenRes = await makeRequest('/api/docs/screens', { method: 'POST' }, {
      moduleId,
      title: 'Màn hình Quản trị Test',
      author: 'Tester',
      status: 'Published',
      raw_content: `# Quản trị\n\n![Mockup](/api/files/images/${storedName})\n\n## 1. TỔNG QUAN\nNội dung mô tả.`,
    });

    assert.equal(screenRes.status, 201);
    const screenId = screenRes.data.id;
    assert.ok(Array.isArray(screenRes.data.images));
    assert.equal(screenRes.data.images.length, 1);
    assert.equal(screenRes.data.images[0].stored_name, storedName);

    // 4. Test GET /api/files/screen/:screenId
    const filesScreenRes = await makeRequest(`/api/files/screen/${screenId}`);
    assert.equal(filesScreenRes.status, 200);
    assert.ok(Array.isArray(filesScreenRes.data));
    assert.equal(filesScreenRes.data.length, 1);
    assert.equal(filesScreenRes.data[0].id, imageId);
    assert.equal(filesScreenRes.data[0].url, `/api/files/images/${storedName}`);

    // 5. Test GET /api/docs/screens/:id includes images
    const getScreenRes = await makeRequest(`/api/docs/screens/${screenId}`);
    assert.equal(getScreenRes.status, 200);
    assert.ok(Array.isArray(getScreenRes.data.images));
    assert.equal(getScreenRes.data.images.length, 1);
    assert.equal(getScreenRes.data.images[0].original_name, originalName);

    // Clean up
    await makeRequest(`/api/docs/screens/${screenId}`, { method: 'DELETE' });
    await makeRequest(`/api/docs/modules/${moduleId}`, { method: 'DELETE' });
  });

  it('should link images explicitly using /api/files/link-screen', async () => {
    const db = getDb();

    // 1. Insert module & screen
    const modRes = await makeRequest('/api/docs/modules', { method: 'POST' }, {
      name: 'Link Module Test',
      icon: '🔗',
    });
    const moduleId = modRes.data.id;

    const screenRes = await makeRequest('/api/docs/screens', { method: 'POST' }, {
      moduleId,
      title: 'Màn hình Link Test',
      raw_content: '# Link Test\n## 1. Overview\nContent',
    });
    const screenId = screenRes.data.id;

    // 2. Insert image without screen_id
    const storedName = 'test-link-image.jpg';
    const imgInfo = db.prepare(`
      INSERT INTO images (original_name, stored_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?)
    `).run('Photo.jpg', storedName, 'image/jpeg', 54321);
    const imageId = Number(imgInfo.lastInsertRowid);

    // 3. Link image
    const linkRes = await makeRequest('/api/files/link-screen', { method: 'POST' }, {
      screenId,
      imageIds: [imageId],
    });
    assert.equal(linkRes.status, 200);
    assert.equal(linkRes.data.success, true);

    // 4. Verify screen now has image
    const getRes = await makeRequest(`/api/docs/screens/${screenId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.images.length, 1);
    assert.equal(getRes.data.images[0].id, imageId);

    // Clean up
    await makeRequest(`/api/docs/screens/${screenId}`, { method: 'DELETE' });
    await makeRequest(`/api/docs/modules/${moduleId}`, { method: 'DELETE' });
  });
});
