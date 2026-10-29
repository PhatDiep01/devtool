process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../index';
import { getDb, closeDb } from '../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { 
  parseFlexibleTimeToSeconds, 
  formatSecondsToTimeSpent, 
  textToAdf, 
  adfToText,
  formatJiraError
} from '../services/jira-utils';
import { deepSanitizeForJiraServer } from '../middleware/jira-auth';
import { 
  encodeCaptchaToken, 
  decodeCaptchaToken, 
  mergeCookies, 
  formatCookieHeader 
} from '../services/jira-captcha';

let testServer: http.Server;
let port: number;
let baseUrl: string;

function makeRequest(path: string, options: http.RequestOptions = {}, postData?: any): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const reqOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
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
          headers: res.headers
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

describe('Jira Dedicated Authentication & Public Handover Docs API Test Suite', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      const db = getDb();
      db.prepare("DELETE FROM jira_sessions WHERE base_url LIKE '%company.atlassian.net%' OR user_email LIKE '%@company.com%'").run();
    } catch {}
    await new Promise<void>((resolve) => {
      testServer.close(() => resolve());
    });
    closeDb();
  });

  // --- 1. Handover Documents Accessibility ---
  describe('Handover Document Routes (Public Access)', () => {
    it('GET /api/docs/modules should be publicly accessible without any Jira credentials', async () => {
      const res = await makeRequest('/api/docs/modules');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Expected array of modules');
      assert.ok(res.data.length > 0, 'Expected at least 1 module');
    });

    it('GET /api/docs/stats should be accessible without Jira authentication', async () => {
      const res = await makeRequest('/api/docs/stats');
      assert.equal(res.status, 200);
      assert.ok(typeof res.data.totalModules === 'number');
      assert.ok(typeof res.data.totalScreens === 'number');
    });

    it('GET /api/docs/search should be accessible without Jira authentication', async () => {
      const res = await makeRequest('/api/docs/search?q=test');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('GET /api/docs/screens should return list of screens', async () => {
      const res = await makeRequest('/api/docs/screens');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('POST /api/docs/modules and screen CRUD operations should succeed', async () => {
      const modRes = await makeRequest('/api/docs/modules', { method: 'POST' }, {
        name: 'Test Group Automation',
        icon: '🚀',
        color: '#10b981',
        description: 'Test group for automation'
      });
      assert.equal(modRes.status, 201);
      assert.equal(modRes.data.name, 'Test Group Automation');
      const testModId = modRes.data.id;

      const screenRes = await makeRequest('/api/docs/screens', { method: 'POST' }, {
        moduleId: testModId,
        title: 'Màn hình Kiểm Thử Tự Động',
        author: 'Tester',
        status: 'Draft',
        tags: ['test', 'automation']
      });
      assert.equal(screenRes.status, 201);
      assert.equal(screenRes.data.title, 'Màn hình Kiểm Thử Tự Động');
      const testScreenId = screenRes.data.id;

      const updateRes = await makeRequest(`/api/docs/screens/${testScreenId}`, { method: 'PUT' }, {
        title: 'Màn hình Kiểm Thử Tự Động (Updated)',
        status: 'Published'
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.title, 'Màn hình Kiểm Thử Tự Động (Updated)');
      assert.equal(updateRes.data.status, 'Published');

      const delScreenRes = await makeRequest(`/api/docs/screens/${testScreenId}`, { method: 'DELETE' });
      assert.equal(delScreenRes.status, 200);

      const delModRes = await makeRequest(`/api/docs/modules/${testModId}`, { method: 'DELETE' });
      assert.equal(delModRes.status, 200);
    });

    it('DELETE /api/docs/modules/:id should transfer screens when targetModuleId provided', async () => {
      // Create source and target modules
      const mod1 = await makeRequest('/api/docs/modules', { method: 'POST' }, { name: 'Source Module Transfer' });
      const mod2 = await makeRequest('/api/docs/modules', { method: 'POST' }, { name: 'Destination Module Transfer' });
      assert.equal(mod1.status, 201);
      assert.equal(mod2.status, 201);

      // Create screen in mod1
      const screen = await makeRequest('/api/docs/screens', { method: 'POST' }, {
        moduleId: mod1.data.id,
        title: 'Màn hình Cần Chuyển Nhóm',
        raw_content: '# Màn hình Cần Chuyển Nhóm\nNội dung đặc tả chi tiết.'
      });
      assert.equal(screen.status, 201);

      // Attempt deletion without targetModuleId - should fail with 400
      const failDelete = await makeRequest(`/api/docs/modules/${mod1.data.id}`, { method: 'DELETE' });
      assert.equal(failDelete.status, 400);

      // Delete with targetModuleId - should succeed and transfer screen to mod2
      const successDelete = await makeRequest(`/api/docs/modules/${mod1.data.id}?targetModuleId=${mod2.data.id}`, { method: 'DELETE' });
      assert.equal(successDelete.status, 200);

      // Verify screen now belongs to mod2
      const updatedScreen = await makeRequest(`/api/docs/screens/${screen.data.id}`);
      assert.equal(updatedScreen.status, 200);
      assert.equal(updatedScreen.data.module_id, mod2.data.id);

      // Cleanup
      await makeRequest(`/api/docs/screens/${screen.data.id}`, { method: 'DELETE' });
      await makeRequest(`/api/docs/modules/${mod2.data.id}`, { method: 'DELETE' });
    });

    it('DELETE /api/docs/modules/:id?cascade=true should cascade delete module and its screens', async () => {
      const mod = await makeRequest('/api/docs/modules', { method: 'POST' }, { name: 'Cascade Delete Test' });
      const screen = await makeRequest('/api/docs/screens', { method: 'POST' }, {
        moduleId: mod.data.id,
        title: 'Cascade Screen Child',
        raw_content: '# Child screen'
      });
      assert.equal(screen.status, 201);

      // Delete with cascade=true
      const delRes = await makeRequest(`/api/docs/modules/${mod.data.id}?cascade=true`, { method: 'DELETE' });
      assert.equal(delRes.status, 200);

      // Verify screen is deleted
      const checkScreen = await makeRequest(`/api/docs/screens/${screen.data.id}`);
      assert.equal(checkScreen.status, 404);

      // Verify module is deleted
      const checkMod = await makeRequest(`/api/docs/modules/${mod.data.id}`);
      assert.equal(checkMod.status, 404);
    });

    it('GET /api/docs/screens should filter by keyword in raw_content', async () => {
      const mod = await makeRequest('/api/docs/modules', { method: 'POST' }, { name: 'Search Test Module' });
      const screen = await makeRequest('/api/docs/screens', { method: 'POST' }, {
        moduleId: mod.data.id,
        title: 'Screen Search Demo',
        raw_content: '# Overview\nCó tính năng FEAT-SPECIFIC-KEYWORD-999 cần tìm.'
      });

      const searchRes = await makeRequest('/api/docs/screens?q=FEAT-SPECIFIC-KEYWORD-999');
      assert.equal(searchRes.status, 200);
      assert.ok(searchRes.data.length >= 1);
      assert.equal(searchRes.data[0].id, screen.data.id);

      // Cleanup
      await makeRequest(`/api/docs/screens/${screen.data.id}`, { method: 'DELETE' });
      await makeRequest(`/api/docs/modules/${mod.data.id}`, { method: 'DELETE' });
    });

    it('POST /api/docs/sync should return success with Vietnamese status message', async () => {
      const res = await makeRequest('/api/docs/sync', { method: 'POST' });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(typeof res.data.count, 'number');
      assert.equal(typeof res.data.message, 'string');
      assert.ok(res.data.message.includes('đồng bộ'));
    });

    it('POST /api/bugs should successfully handle null fields without throwing Cannot read properties of null (reading trim)', async () => {
      const bugPayload = {
        title: 'Bug with null fields test',
        us_key: null,
        us_link: null,
        type: 'FE',
        status: 'todo',
        severity: 'medium',
        description: '',
        payload: null,
        fix_solution: '',
        attachments: [],
        created_by: null,
        assigned_to: null
      };

      const res = await makeRequest('/api/bugs', { method: 'POST' }, bugPayload);
      assert.equal(res.status, 201);
      assert.ok(res.data.id > 0);
      assert.equal(res.data.title, 'Bug with null fields test');
      assert.equal(res.data.assigned_to, null);
      assert.equal(res.data.created_by, null);
      assert.equal(res.data.payload, null);

      // Also test updating with null fields
      const updateRes = await makeRequest(`/api/bugs/${res.data.id}`, { method: 'PUT' }, {
        title: 'Updated title with null assigned_to',
        assigned_to: null,
        payload: null
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.title, 'Updated title with null assigned_to');

      // Cleanup
      await makeRequest(`/api/bugs/${res.data.id}`, { method: 'DELETE' });
    });
  });

  // --- 2. Jira Protected Routes Enforcement ---
  describe('Jira Protected Endpoints Enforcement (jiraAuthMiddleware)', () => {
    it('GET /api/jira/boards should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/boards');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
      assert.equal(res.data.authenticated, false);
    });

    it('GET /api/jira/boards/1/sprints should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/boards/1/sprints');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/sprints/1/issues should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/sprints/1/issues');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/search should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/search?jql=assignee=currentUser()');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/boards should reject invalid or forged token with 401', async () => {
      const res = await makeRequest('/api/jira/boards', {
        headers: {
          Authorization: 'Bearer invalid-dummy-token-12345'
        }
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/projects should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/projects');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/priorities should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/priorities');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('POST /api/jira/issues should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues', { method: 'POST' }, { projectKey: 'TEST', summary: 'Sample' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/my-issues should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/my-issues');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/worklogs/recent should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/worklogs/recent');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/boards/1/backlog should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/boards/1/backlog');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/sprints/1 should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/sprints/1');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/projects/TEST/issuetypes should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/projects/TEST/issuetypes');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/users/assignable should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/users/assignable');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('POST /api/jira/sprints/1/move-issues should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/sprints/1/move-issues', { method: 'POST' }, { issues: ['TEST-1'] });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('PUT /api/jira/issues/TEST-1/worklog/1001 should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/TEST-1/worklog/1001', { method: 'PUT' }, { timeSpent: '1h' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('DELETE /api/jira/issues/TEST-1/worklog/1001 should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/TEST-1/worklog/1001', { method: 'DELETE' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/issues/SURV-1 should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('PUT /api/jira/issues/SURV-1 should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1', { method: 'PUT' }, { fields: { summary: 'Updated' } });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/issues/SURV-1/transitions should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1/transitions');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('POST /api/jira/issues/SURV-1/transitions should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1/transitions', { method: 'POST' }, { transitionId: '11' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('POST /api/jira/issues/SURV-1/comment should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1/comment', { method: 'POST' }, { body: 'Test comment' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('GET /api/jira/issues/SURV-1/worklog should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1/worklog');
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('POST /api/jira/issues/SURV-1/worklog should return 401 when unauthenticated', async () => {
      const res = await makeRequest('/api/jira/issues/SURV-1/worklog', { method: 'POST' }, { timeSpent: '1h' });
      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'JIRA_AUTH_REQUIRED');
    });
  });

  // --- 3. Jira Auth Endpoints & Session Management ---
  describe('Jira Authentication & Session Management', () => {
    it('GET /api/jira/auth/config-info should return workspace Jira availability safely', async () => {
      const res = await makeRequest('/api/jira/auth/config-info');
      assert.equal(res.status, 200);
      assert.ok('hasConfigured' in res.data);
      assert.ok('configuredBaseUrl' in res.data);
    });

    it('GET /api/jira/status should report unauthenticated status when no session exists', async () => {
      const res = await makeRequest('/api/jira/status');
      assert.equal(res.status, 200);
      assert.equal(res.data.authenticated, false);
      assert.equal(res.data.connected, false);
    });

    it('POST /api/jira/auth/login should reject empty payload with 400', async () => {
      const res = await makeRequest('/api/jira/auth/login', { method: 'POST' }, {});
      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
    });

    it('POST /api/jira/auth/login should reject basic auth without username or password with 400', async () => {
      const res1 = await makeRequest('/api/jira/auth/login', { method: 'POST' }, { authType: 'basic', password: '123' });
      assert.equal(res1.status, 400);
      assert.equal(res1.data.success, false);

      const res2 = await makeRequest('/api/jira/auth/login', { method: 'POST' }, { authType: 'basic', username: 'user1' });
      assert.equal(res2.status, 400);
      assert.equal(res2.data.success, false);
    });

    it('POST /api/jira/auth/login should reject non-existent site with 400 or 401', async () => {
      const res = await makeRequest('/api/jira/auth/login', { method: 'POST' }, {
        baseUrl: 'https://non-existent-jira-site-test-12345.atlassian.net',
        email: 'dev@test.com',
        apiToken: 'fake-token'
      });
      assert.ok([400, 401].includes(res.status));
      assert.equal(res.data.success, false);
    });

    it('Active session verification and graceful logout', async () => {
      // Create a valid session directly in SQLite database
      const db = getDb();
      const mockToken = uuidv4();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO jira_sessions (
          token, user_email, display_name, avatar_url, base_url, api_token, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        mockToken,
        'developer@company.com',
        'Phat Dang',
        'https://avatar.example.com/phat.png',
        'https://company.atlassian.net',
        'secret-token-123',
        futureDate
      );

      // Verify session with GET /api/jira/auth/session using Bearer token
      const sessionRes = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${mockToken}` }
      });
      assert.equal(sessionRes.status, 200);
      assert.equal(sessionRes.data.authenticated, true);
      assert.equal(sessionRes.data.user.displayName, 'Phat Dang');
      assert.equal(sessionRes.data.user.emailAddress, 'developer@company.com');

      // Also verify session with x-jira-token header
      const headerRes = await makeRequest('/api/jira/auth/session', {
        headers: { 'x-jira-token': mockToken }
      });
      assert.equal(headerRes.status, 200);
      assert.equal(headerRes.data.authenticated, true);

      // Logout with POST /api/jira/auth/logout
      const logoutRes = await makeRequest('/api/jira/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockToken}` }
      });
      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.data.success, true);

      // Verify session is now terminated
      const verifyRes = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${mockToken}` }
      });
      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.data.authenticated, false);
    });

    it('Expired sessions should be rejected as unauthenticated', async () => {
      const db = getDb();
      const expiredToken = uuidv4();
      // Set expiration to 10 minutes ago today
      const pastDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO jira_sessions (
          token, user_email, display_name, avatar_url, base_url, api_token, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'), ?)
      `).run(
        expiredToken,
        'expired@company.com',
        'Expired User',
        null,
        'https://company.atlassian.net',
        'expired-token',
        pastDate
      );

      // Verify that session endpoint rejects expired session
      const res = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.authenticated, false);

      // Verify that protected routes reject expired session with 401
      const boardsRes = await makeRequest('/api/jira/boards', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.equal(boardsRes.status, 401);
      assert.equal(boardsRes.data.code, 'JIRA_AUTH_REQUIRED');
    });

    it('Personal Access Token / Bearer token session creation and retrieval', async () => {
      const db = getDb();
      const bearerSessionToken = uuidv4();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO jira_sessions (
          token, user_email, display_name, avatar_url, base_url, api_token, auth_type, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        bearerSessionToken,
        'bearer-dev@company.com',
        'Bearer Developer',
        null,
        'https://company.atlassian.net',
        'pat-secret-token-12345',
        'bearer',
        futureDate
      );

      const res = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${bearerSessionToken}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.authenticated, true);
      assert.equal(res.data.user.displayName, 'Bearer Developer');
      assert.equal(res.data.user.authType, 'bearer');
    });

    it('Multi-account support with separate username and user_email', async () => {
      const db = getDb();
      const sessionTokenA = uuidv4();
      const sessionTokenB = uuidv4();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // User A (LDAP username different from email)
      db.prepare(`
        INSERT INTO jira_sessions (
          token, username, user_email, display_name, avatar_url, base_url, api_token, auth_type, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        sessionTokenA,
        'phatdm',
        'phatdm@ascvn.com.vn',
        'Doan Minh Phat',
        null,
        'https://task.ascvn.com.vn',
        'pwdA',
        'basic',
        futureDate
      );

      // User B (another person logging in with their own account)
      db.prepare(`
        INSERT INTO jira_sessions (
          token, username, user_email, display_name, avatar_url, base_url, api_token, auth_type, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        sessionTokenB,
        'KhaiDPQ',
        'khaidpq@ascvn.com.vn',
        'Khai Do Pham Quang',
        null,
        'https://task.ascvn.com.vn',
        'pwdB',
        'basic',
        futureDate
      );

      // Verify User A session returns phatdm
      const resA = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${sessionTokenA}` }
      });
      assert.equal(resA.status, 200);
      assert.equal(resA.data.authenticated, true);
      assert.equal(resA.data.user.username, 'phatdm');
      assert.equal(resA.data.user.emailAddress, 'phatdm@ascvn.com.vn');

      // Verify User B session returns KhaiDPQ and does not collide with User A
      const resB = await makeRequest('/api/jira/auth/session', {
        headers: { Authorization: `Bearer ${sessionTokenB}` }
      });
      assert.equal(resB.status, 200);
      assert.equal(resB.data.authenticated, true);
      assert.equal(resB.data.user.username, 'KhaiDPQ');
      assert.equal(resB.data.user.emailAddress, 'khaidpq@ascvn.com.vn');

      // Clean up
      db.prepare('DELETE FROM jira_sessions WHERE token IN (?, ?)').run(sessionTokenA, sessionTokenB);
    });

    it('Security policy: No credentials stored in SQLite, config-info returns hasConfigured: false', async () => {
      const cfgRes = await makeRequest('/api/jira/auth/config-info');
      assert.equal(cfgRes.status, 200);
      assert.equal(cfgRes.data.hasConfigured, false);
      assert.ok('configuredBaseUrl' in cfgRes.data);

      const db = getDb();
      const checkSettings = db.prepare("SELECT * FROM settings WHERE key IN ('jira_api_token', 'jira_email', 'jira_username')").all();
      assert.equal(checkSettings.length, 0, 'No credentials should exist in SQLite settings table');
    });
  });

  // --- 4. Jira Utilities: ADF & Worklog Parsing ---
  describe('Jira Utilities (ADF v3 & Flexible Worklog Parsing)', () => {
    it('parseFlexibleTimeToSeconds should accurately parse human time strings', () => {
      assert.equal(parseFlexibleTimeToSeconds('1h 30m'), 5400);
      assert.equal(parseFlexibleTimeToSeconds('2h'), 7200);
      assert.equal(parseFlexibleTimeToSeconds('45m'), 2700);
      assert.equal(parseFlexibleTimeToSeconds('1d'), 28800); // 8 hours
      assert.equal(parseFlexibleTimeToSeconds('1w'), 144000); // 40 hours
      assert.equal(parseFlexibleTimeToSeconds('1.5'), 5400); // decimal treated as hours
      assert.equal(parseFlexibleTimeToSeconds('1.5h'), 5400);
      assert.equal(parseFlexibleTimeToSeconds('1,5'), 5400); // comma decimal support
      assert.equal(parseFlexibleTimeToSeconds('2,5h'), 9000);
      assert.equal(parseFlexibleTimeToSeconds('01:30'), 5400);
      assert.equal(parseFlexibleTimeToSeconds(3600), 3600);
      assert.equal(parseFlexibleTimeToSeconds(''), 0);
      assert.equal(parseFlexibleTimeToSeconds(null), 0);
    });

    it('formatSecondsToTimeSpent should format duration into Jira-friendly string', () => {
      assert.equal(formatSecondsToTimeSpent(5400), '1h 30m');
      assert.equal(formatSecondsToTimeSpent(7200), '2h');
      assert.equal(formatSecondsToTimeSpent(2700), '45m');
      assert.equal(formatSecondsToTimeSpent(0), '0m');
    });

    it('textToAdf should convert plain text into valid Atlassian Document Format v3', () => {
      const adf = textToAdf('Line 1\nLine 2\n\nParagraph 2');
      assert.equal(adf.type, 'doc');
      assert.equal(adf.version, 1);
      assert.ok(Array.isArray(adf.content));
      assert.equal(adf.content.length, 2);
      assert.equal(adf.content[0].type, 'paragraph');
      assert.equal(adf.content[1].type, 'paragraph');

      // Heading support
      const headingAdf = textToAdf('# Main Heading\n\nSome paragraph');
      assert.equal(headingAdf.content[0].type, 'heading');
      assert.equal(headingAdf.content[0].attrs.level, 1);

      // Bullet list support
      const bulletAdf = textToAdf('- Item 1\n- Item 2');
      assert.equal(bulletAdf.content[0].type, 'bulletList');
      assert.equal(bulletAdf.content[0].content.length, 2);
    });

    it('adfToText should convert ADF v3 back to readable text', () => {
      const adf = textToAdf('First paragraph\n\nSecond paragraph');
      const text = adfToText(adf);
      assert.ok(text.includes('First paragraph'));
      assert.ok(text.includes('Second paragraph'));
    });

    it('formatJiraError should format diverse Jira error structures into user-friendly messages', () => {
      // 1. Jira errorMessages array
      const err1 = { response: { data: { errorMessages: ['Issue does not exist or you do not have permission'] } } };
      assert.equal(formatJiraError(err1).message, 'Issue does not exist or you do not have permission');

      // 2. Jira field errors map
      const err2 = { response: { data: { errors: { summary: 'Field is required', project: 'Project not found' } } } };
      assert.equal(formatJiraError(err2).message, 'summary: Field is required, project: Project not found');

      // 3. Fallback error message
      const err3 = new Error('Network timeout connecting to Jira');
      assert.equal(formatJiraError(err3).message, 'Network timeout connecting to Jira');
    });

    it('deepSanitizeForJiraServer should flatten nested ADF objects and string fields for Jira Server', () => {
      const payloadWithAdf = {
        body: textToAdf('Comment text from editor'),
        fields: {
          description: textToAdf('Issue description text'),
          summary: 'Normal string'
        },
        update: {
          comment: [
            { add: { body: textToAdf('Nested comment') } }
          ]
        }
      };

      const sanitized = deepSanitizeForJiraServer(payloadWithAdf);
      assert.equal(typeof sanitized.body, 'string');
      assert.ok(sanitized.body.includes('Comment text from editor'));
      assert.equal(typeof sanitized.fields.description, 'string');
      assert.ok(sanitized.fields.description.includes('Issue description text'));
      assert.equal(typeof sanitized.update.comment[0].add.body, 'string');
      assert.ok(sanitized.update.comment[0].add.body.includes('Nested comment'));
      assert.equal(sanitized.fields.summary, 'Normal string');
    });
  });

  // --- 5. Jira CAPTCHA Handling & Token Tokenization ---
  describe('Jira CAPTCHA Handling & Stateless Token Verification', () => {
    it('encodeCaptchaToken and decodeCaptchaToken should accurately round-trip payload', () => {
      const cookie = 'JSESSIONID=A1B2C3D4E5F6; atlassian.xsrf.token=XYZ789';
      const baseUrl = 'https://task.ascvn.com.vn';
      const token = encodeCaptchaToken(cookie, baseUrl);
      assert.ok(typeof token === 'string');
      assert.ok(token.length > 20);

      const decoded = decodeCaptchaToken(token);
      assert.ok(decoded !== null);
      assert.equal(decoded?.cookie, cookie);
      assert.equal(decoded?.baseUrl, baseUrl);
    });

    it('decodeCaptchaToken should reject expired or invalid tokens', () => {
      // 1. Invalid base64
      assert.equal(decodeCaptchaToken('not-a-valid-token-string!'), null);

      // 2. Expired timestamp (> 15 minutes)
      const expiredPayload = {
        cookie: 'JSESSIONID=EXPIRED123',
        baseUrl: 'https://task.ascvn.com.vn',
        time: Date.now() - 20 * 60 * 1000 // 20 minutes ago
      };
      const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      assert.equal(decodeCaptchaToken(expiredToken), null);
    });

    it('mergeCookies should update existing cookie keys and append new ones without duplicates', () => {
      const base = 'JSESSIONID=OLD_SESSION; token=123';
      const newSetCookies = [
        'JSESSIONID=NEW_SESSION; Path=/; HttpOnly',
        'atlassian.xsrf.token=XSRF_NEW; Path=/'
      ];
      const merged = mergeCookies(base, newSetCookies);
      assert.ok(merged.includes('JSESSIONID=NEW_SESSION'));
      assert.ok(merged.includes('token=123'));
      assert.ok(merged.includes('atlassian.xsrf.token=XSRF_NEW'));
      assert.ok(!merged.includes('OLD_SESSION'));
    });

    it('GET /api/jira/auth/captcha should reject Jira Cloud domains', async () => {
      const res = await makeRequest('/api/jira/auth/captcha?baseUrl=https://company.atlassian.net');
      assert.equal(res.status, 400);
      assert.equal(res.data.success, false);
      assert.ok(res.data.message.includes('Jira Cloud'));
    });
  });
});
