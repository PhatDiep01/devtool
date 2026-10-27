import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlite';
import { 
  jiraAuthMiddleware, 
  getActiveJiraSession, 
  createJiraClientFromSession,
  AuthenticatedJiraRequest 
} from '../middleware/jira-auth';
import { 
  textToAdf, 
  adfToText, 
  parseFlexibleTimeToSeconds, 
  formatSecondsToTimeSpent,
  formatJiraError
} from '../services/jira-utils';

const router = Router();

/**
 * Helper to fetch Workspace Jira configuration (from SQLite settings or env)
 */
function getWorkspaceJiraConfig() {
  const db = getDb();
  const settings: any[] = db.prepare("SELECT key, value FROM settings WHERE category = 'jira'").all();
  const map: Record<string, string> = {};
  settings.forEach(s => { map[s.key] = s.value; });

  const baseUrl = map['jira_base_url'] || process.env.JIRA_BASE_URL || 'https://task.ascvn.com.vn';
  const email = map['jira_email'] || process.env.JIRA_EMAIL || '';
  // Token in SQLite settings takes precedence; if not in settings, return empty string
  const apiToken = map['jira_api_token'] || '';
  const authType = map['jira_auth_type'] || process.env.JIRA_AUTH_TYPE || 'bearer';

  return { baseUrl: baseUrl.replace(/\/+$/, ''), email, apiToken, authType };
}

function normalizeJiraUrl(url: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned && !/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

// ==========================================
// 1. JIRA AUTHENTICATION ENDPOINTS (PUBLIC)
// ==========================================

// GET /api/jira/auth/config-info - Check if workspace has preconfigured Jira
router.get('/auth/config-info', (req: Request, res: Response) => {
  try {
    const { baseUrl, email, apiToken, authType } = getWorkspaceJiraConfig();
    const hasConfigured = Boolean(baseUrl && apiToken && apiToken !== '••••••••••••');
    res.json({
      hasConfigured,
      configuredBaseUrl: baseUrl || '',
      configuredEmail: email || '',
      authType: authType || 'bearer'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/jira/auth/login - Log in to Jira Cloud or Server/DC
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { useWorkspace, rememberMe } = req.body;
    let authType = req.body.authType || 'bearer';
    let { baseUrl, email, username, password, apiToken, accessToken, bearerToken } = req.body;

    let token = accessToken || bearerToken || apiToken || password;
    let userIdentifier = (username || email || '').trim();

    const wsConfig = getWorkspaceJiraConfig();

    if (useWorkspace) {
      baseUrl = wsConfig.baseUrl;
      email = wsConfig.email;
      userIdentifier = wsConfig.email;
      token = wsConfig.apiToken;
      if (wsConfig.authType) {
        authType = wsConfig.authType;
      }

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Chưa có thông tin xác thực được lưu trên máy. Vui lòng nhập thông tin đăng nhập.'
        });
      }
    }

    if (!baseUrl) {
      baseUrl = wsConfig.baseUrl || process.env.JIRA_BASE_URL || 'https://task.ascvn.com.vn';
    }

    if (authType === 'basic') {
      if (!userIdentifier) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập Tên đăng nhập (Username) hoặc Email.'
        });
      }
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập Mật khẩu (Password).'
        });
      }
    } else {
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập Jira API Token hoặc Personal Access Token (PAT).'
        });
      }
    }

    const cleanBaseUrl = normalizeJiraUrl(baseUrl);
    const cleanEmail = (userIdentifier || wsConfig.email || '').trim();
    const cleanToken = (token || '').trim();

    // Helper to check if myself response is a genuine Jira user JSON object and not HTML login page
    const isValidJiraUserResponse = (res: any): boolean => {
      if (!res || !res.data) return false;
      if (typeof res.data === 'string') return false;
      const data = res.data;
      return Boolean(typeof data === 'object' && (data.name || data.key || data.accountId || data.displayName || data.emailAddress));
    };

    const isJiraCloud = cleanBaseUrl.includes('.atlassian.net');
    let myselfRes: any = null;
    let resolvedAuthType: 'bearer' | 'basic' = authType === 'basic' ? 'basic' : 'bearer';
    let isCaptchaBlocked = false;

    if (authType === 'basic') {
      const basicHeader = `Basic ${Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64')}`;

      // On Jira Cloud, try v3 then v2. On Jira Server, try v2 exclusively (v3 does not exist and returns HTML login page)
      const endpoints = isJiraCloud
        ? [`${cleanBaseUrl}/rest/api/3/myself`, `${cleanBaseUrl}/rest/api/2/myself`]
        : [`${cleanBaseUrl}/rest/api/2/myself`];

      for (const ep of endpoints) {
        try {
          const resp = await axios.get(ep, {
            headers: { Authorization: basicHeader, Accept: 'application/json' },
            timeout: 10000
          });
          if (isValidJiraUserResponse(resp)) {
            myselfRes = resp;
            resolvedAuthType = 'basic';
            break;
          }
        } catch (err: any) {
          const headers = err.response?.headers || {};
          const deniedReason = String(headers['x-authentication-denied-reason'] || '');
          if (deniedReason.includes('CAPTCHA') || err.response?.status === 403) {
            isCaptchaBlocked = true;
          }
        }
      }

      // If Basic Auth failed and it's Jira Server, also try Session Auth POST /rest/auth/1/session
      if (!myselfRes && !isJiraCloud && !isCaptchaBlocked) {
        try {
          const sessionRes = await axios.post(`${cleanBaseUrl}/rest/auth/1/session`, {
            username: cleanEmail,
            password: cleanToken
          }, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 10000
          });
          const cookieHdr = sessionRes.headers['set-cookie']?.join('; ');
          if (cookieHdr) {
            const userResp = await axios.get(`${cleanBaseUrl}/rest/api/2/myself`, {
              headers: { Cookie: cookieHdr, Accept: 'application/json' },
              timeout: 10000
            });
            if (isValidJiraUserResponse(userResp)) {
              myselfRes = userResp;
              resolvedAuthType = 'basic';
            }
          }
        } catch (sessErr: any) {
          const headers = sessErr.response?.headers || {};
          const deniedReason = String(headers['x-authentication-denied-reason'] || '');
          if (deniedReason.includes('CAPTCHA') || sessErr.response?.status === 403) {
            isCaptchaBlocked = true;
          }
        }
      }
    } else {
      // Bearer Token / PAT
      const bearerHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
      const endpoints = isJiraCloud
        ? [`${cleanBaseUrl}/rest/api/3/myself`, `${cleanBaseUrl}/rest/api/2/myself`]
        : [`${cleanBaseUrl}/rest/api/2/myself`];

      for (const ep of endpoints) {
        try {
          const resp = await axios.get(ep, {
            headers: { Authorization: bearerHeader, Accept: 'application/json' },
            timeout: 10000
          });
          if (isValidJiraUserResponse(resp)) {
            myselfRes = resp;
            resolvedAuthType = 'bearer';
            break;
          }
        } catch {}
      }

      // Fallback: If Bearer failed and cleanEmail exists, try Basic Auth
      if (!myselfRes && cleanEmail) {
        const basicHeader = `Basic ${Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64')}`;
        for (const ep of endpoints) {
          try {
            const resp = await axios.get(ep, {
              headers: { Authorization: basicHeader, Accept: 'application/json' },
              timeout: 10000
            });
            if (isValidJiraUserResponse(resp)) {
              myselfRes = resp;
              resolvedAuthType = 'basic';
              break;
            }
          } catch {}
        }
      }
    }

    if (!myselfRes) {
      if (isCaptchaBlocked) {
        return res.status(403).json({
          success: false,
          isCaptcha: true,
          message: `Máy chủ Jira đang yêu cầu xác minh CAPTCHA cho tài khoản "${cleanEmail}". Vui lòng đăng nhập 1 lần trên trình duyệt tại ${cleanBaseUrl}/login.jsp để vượt CAPTCHA, hoặc dùng tab "API Token / PAT" để đăng nhập ngay mà không bị chặn.`
        });
      }

      const errorMsg = authType === 'basic'
        ? 'Tên đăng nhập hoặc mật khẩu Jira không chính xác.'
        : 'Xác thực không thành công. Jira API Token không hợp lệ hoặc đã hết hạn.';

      return res.status(401).json({
        success: false,
        message: errorMsg
      });
    }

    const jiraUser = myselfRes.data;
    const resolvedEmail = jiraUser.emailAddress || jiraUser.name || cleanEmail || 'user@jira.local';
    const resolvedDisplayName = jiraUser.displayName || jiraUser.name || resolvedEmail;
    const resolvedAvatar = jiraUser.avatarUrls?.['48x48'] || jiraUser.avatarUrls?.['32x32'] || null;

    const db = getDb();
    const isRemember = Boolean(rememberMe);

    // Xử lý lưu SQLite theo yêu cầu:
    // Checkbox keep me signed on this device khi check vào thì mới tiến hành lưu token đó lên sqlite
    // Còn không check vào thì không lưu vào settings, hết hạn 1 phiên (8 tiếng) sẽ bắt login lại
    if (isRemember) {
      db.prepare(`
        INSERT INTO settings (key, value, category) VALUES ('jira_api_token', ?, 'jira')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(cleanToken);

      db.prepare(`
        INSERT INTO settings (key, value, category) VALUES ('jira_base_url', ?, 'jira')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(cleanBaseUrl);

      db.prepare(`
        INSERT INTO settings (key, value, category) VALUES ('jira_auth_type', ?, 'jira')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(resolvedAuthType);

      if (cleanEmail || resolvedEmail) {
        db.prepare(`
          INSERT INTO settings (key, value, category) VALUES ('jira_email', ?, 'jira')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(cleanEmail || resolvedEmail);
      }
    }

    // Thời lượng phiên: Nếu remember => 30 ngày. Nếu không remember => 8 tiếng (1 phiên làm việc)
    const durationHours = isRemember ? 30 * 24 : 8;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const sessionToken = uuidv4();

    db.prepare(`
      INSERT INTO jira_sessions (
        token, user_email, display_name, avatar_url, base_url, api_token, auth_type, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      sessionToken,
      resolvedEmail,
      resolvedDisplayName,
      resolvedAvatar,
      cleanBaseUrl,
      cleanToken,
      resolvedAuthType,
      expiresAt
    );

    res.json({
      success: true,
      token: sessionToken,
      expiresAt,
      user: {
        displayName: resolvedDisplayName,
        emailAddress: resolvedEmail,
        avatarUrl: resolvedAvatar,
        baseUrl: cleanBaseUrl,
        authType: resolvedAuthType
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi đăng nhập Jira' });
  }
});

// GET /api/jira/auth/session - Verify active Jira session
router.get('/auth/session', (req: Request, res: Response) => {
  const session = getActiveJiraSession(req);
  if (!session) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    expiresAt: session.expires_at,
    user: {
      displayName: session.display_name,
      emailAddress: session.user_email,
      avatarUrl: session.avatar_url,
      baseUrl: session.base_url,
      authType: session.auth_type || 'basic'
    }
  });
});

// POST /api/jira/auth/logout - Terminate Jira session
router.post('/auth/logout', (req: Request, res: Response) => {
  try {
    const session = getActiveJiraSession(req);
    const db = getDb();
    if (session) {
      db.prepare('DELETE FROM jira_sessions WHERE token = ?').run(session.token);
    }
    // "khi đăng xuất ra thì hãy xóa token đã lưu ở sql"
    db.prepare("DELETE FROM settings WHERE key IN ('jira_api_token', 'jira_email')").run();

    res.json({ success: true, message: 'Đã đăng xuất và xóa token đã lưu trong SQLite' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/jira/status - Connection & session status
router.get('/status', async (req: Request, res: Response) => {
  const session = getActiveJiraSession(req);
  if (!session) {
    return res.json({
      connected: false,
      configured: false,
      authenticated: false,
      message: 'Not logged in to Jira. Please sign in to access sprint tasks.'
    });
  }

  try {
    const client = createJiraClientFromSession(session);
    const isJiraServer = !session.base_url.includes('.atlassian.net');
    const endpoint = isJiraServer ? '/rest/api/2/myself' : '/rest/api/3/myself';
    const response = await client.get(endpoint);

    if (typeof response.data === 'string' || !response.data || (!response.data.name && !response.data.displayName && !response.data.accountId)) {
      return res.json({
        connected: false,
        configured: true,
        authenticated: false,
        expiresAt: session.expires_at,
        message: 'Phiên Jira không hợp lệ hoặc máy chủ trả về trang đăng nhập HTML.'
      });
    }

    res.json({
      connected: true,
      configured: true,
      authenticated: true,
      expiresAt: session.expires_at,
      user: {
        displayName: response.data.displayName || session.display_name,
        emailAddress: response.data.emailAddress || session.user_email,
        avatarUrl: response.data.avatarUrls?.['48x48'] || session.avatar_url,
        baseUrl: session.base_url,
        authType: session.auth_type || 'basic'
      }
    });
  } catch (error: any) {
    res.json({
      connected: false,
      configured: true,
      authenticated: true,
      expiresAt: session.expires_at,
      message: error.response?.data?.errorMessages?.[0] || error.message || 'Jira connection error'
    });
  }
});

// ==========================================
// 1.1 JIRA ATTACHMENT PROXY (PUBLIC OR TOKEN-AUTHENTICATED)
// ==========================================
const jiraCookieCache = new Map<string, { cookie: string; expires: number }>();

async function getJiraSessionCookie(baseUrl: string, patOrAuthHeader: string, isBearer: boolean): Promise<string> {
  const cacheKey = `${baseUrl}|${patOrAuthHeader}`;
  const now = Date.now();
  const cached = jiraCookieCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.cookie;
  }

  try {
    const authHdr = isBearer
      ? (patOrAuthHeader.startsWith('Bearer ') ? patOrAuthHeader : `Bearer ${patOrAuthHeader}`)
      : patOrAuthHeader;
    const res = await axios.get(`${baseUrl}/rest/api/2/myself`, {
      headers: { Authorization: authHdr, Accept: 'application/json' },
      timeout: 10000
    });
    const setCookies = res.headers['set-cookie'] || [];
    const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ');
    if (cookieStr) {
      jiraCookieCache.set(cacheKey, { cookie: cookieStr, expires: now + 10 * 60 * 1000 });
      return cookieStr;
    }
  } catch (err: any) {
    console.warn('Could not acquire Jira session cookie for attachments:', err.message);
  }
  return '';
}

// GET /api/jira/proxy/image - Proxy Jira avatar, issuetype icon, and priority icons
router.get(['/proxy/image', '/proxy-image'], async (req: Request, res: Response) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    if (!rawUrl) {
      return res.status(400).json({ error: 'Missing image URL' });
    }

    const session = getActiveJiraSession(req);
    const configuredBaseUrl = session?.base_url || process.env.JIRA_BASE_URL || 'https://task.ascvn.com.vn';
    const cleanBaseUrl = normalizeJiraUrl(configuredBaseUrl);

    let targetUrl = decodeURIComponent(rawUrl);
    if (targetUrl.startsWith('/')) {
      targetUrl = `${cleanBaseUrl}${targetUrl}`;
    }

    // Security validation: Only proxy images from Jira domain
    try {
      const parsedTarget = new URL(targetUrl);
      const parsedBase = new URL(cleanBaseUrl);
      if (
        parsedTarget.hostname !== parsedBase.hostname && 
        !parsedTarget.hostname.endsWith('atlassian.net') &&
        !parsedTarget.hostname.includes('ascvn.com.vn')
      ) {
        return res.status(403).json({ error: 'Untrusted image target host' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const isBearer = session ? (session.auth_type === 'bearer' || !session.user_email || session.api_token.startsWith('Bearer ')) : true;
    const authHeader = session
      ? (isBearer
          ? (session.api_token.startsWith('Bearer ') ? session.api_token : `Bearer ${session.api_token}`)
          : `Basic ${Buffer.from(`${session.user_email}:${session.api_token}`).toString('base64')}`)
      : undefined;

    let cookie = '';
    if (session && !cleanBaseUrl.includes('.atlassian.net') && authHeader) {
      cookie = await getJiraSessionCookie(cleanBaseUrl, authHeader, isBearer);
    }

    const reqHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DevToolkit/1.0',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    };
    if (authHeader) {
      reqHeaders['Authorization'] = authHeader;
    }
    if (cookie) {
      reqHeaders['Cookie'] = cookie;
    }

    const imgResp = await axios.get(targetUrl, {
      headers: reqHeaders,
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    });

    const contentType = String(imgResp.headers['content-type'] || 'image/png');
    // If returned HTML (e.g. login redirect), reject
    if (contentType.includes('text/html')) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(imgResp.data);
  } catch (error: any) {
    return res.status(error.response?.status || 500).json({ error: 'Failed to fetch Jira image' });
  }
});

// GET /api/jira/attachments/:id/:filename? - Proxy Jira attachments & inline images
router.get('/attachments/:id/:filename?', async (req: Request, res: Response) => {
  try {
    const { id, filename } = req.params;
    const session = getActiveJiraSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Jira authentication required' });
    }

    const isThumbnail = req.query.thumbnail === 'true';
    const baseUrl = session.base_url.replace(/\/+$/, '');
    const isBearer = session.auth_type === 'bearer' || !session.user_email || session.api_token.startsWith('Bearer ');
    const authHeader = isBearer
      ? (session.api_token.startsWith('Bearer ') ? session.api_token : `Bearer ${session.api_token}`)
      : `Basic ${Buffer.from(`${session.user_email}:${session.api_token}`).toString('base64')}`;

    // Get session cookie needed by Jira Server for /secure/attachment/...
    let cookie = '';
    if (!baseUrl.includes('.atlassian.net')) {
      cookie = await getJiraSessionCookie(baseUrl, authHeader, isBearer);
    }

    const cleanFilename = filename ? decodeURIComponent(filename) : 'attachment';
    const targetUrl = isThumbnail
      ? `${baseUrl}/secure/thumbnail/${id}/_thumb_${id}.png`
      : `${baseUrl}/secure/attachment/${id}/${encodeURIComponent(cleanFilename)}`;

    const reqHeaders: Record<string, string> = {
      Authorization: authHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DevToolkit/1.0'
    };
    if (cookie) {
      reqHeaders['Cookie'] = cookie;
    }

    try {
      const resp = await axios.get(targetUrl, {
        headers: reqHeaders,
        responseType: 'arraybuffer',
        maxRedirects: 5,
        timeout: 30000
      });

      const contentType = String(resp.headers['content-type'] || 'application/octet-stream');
      // If Jira returned HTML (login page redirect), refresh cookie and retry once
      if (contentType.includes('text/html')) {
        const freshCookie = await getJiraSessionCookie(baseUrl, authHeader, isBearer);
        if (freshCookie && freshCookie !== cookie) {
          reqHeaders['Cookie'] = freshCookie;
          const retryResp = await axios.get(targetUrl, {
            headers: reqHeaders,
            responseType: 'arraybuffer',
            maxRedirects: 5,
            timeout: 30000
          });
          const retryContentType = String(retryResp.headers['content-type'] || 'application/octet-stream');
          if (!retryContentType.includes('text/html')) {
            res.setHeader('Content-Type', retryContentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFilename)}"`);
            return res.send(retryResp.data);
          }
        }
        return res.status(403).send('Could not authenticate with Jira for this attachment');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFilename)}"`);
      return res.send(resp.data);
    } catch (fetchErr: any) {
      if (isThumbnail) {
        // Fallback 1: try main attachment directly
        try {
          const fullUrl = `${baseUrl}/secure/attachment/${id}/${encodeURIComponent(cleanFilename)}`;
          const fallbackResp = await axios.get(fullUrl, {
            headers: reqHeaders,
            responseType: 'arraybuffer',
            maxRedirects: 5,
            timeout: 30000
          });
          const fallbackContentType = String(fallbackResp.headers['content-type'] || 'application/octet-stream');
          if (!fallbackContentType.includes('text/html')) {
            res.setHeader('Content-Type', fallbackContentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFilename)}"`);
            return res.send(fallbackResp.data);
          }
        } catch {}
      }

      // Fallback 2: try Jira REST API attachment endpoint /rest/api/2/attachment/content/:id
      try {
        const restUrl = `${baseUrl}/rest/api/2/attachment/content/${id}`;
        const restResp = await axios.get(restUrl, {
          headers: reqHeaders,
          responseType: 'arraybuffer',
          maxRedirects: 5,
          timeout: 30000
        });
        const restContentType = String(restResp.headers['content-type'] || 'application/octet-stream');
        if (!restContentType.includes('text/html')) {
          res.setHeader('Content-Type', restContentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFilename)}"`);
          return res.send(restResp.data);
        }
      } catch {}

      throw fetchErr;
    }
  } catch (error: any) {
    console.error('Error proxying Jira attachment:', error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch attachment from Jira' });
  }
});

// ==========================================
// 2. PROTECTED JIRA DATA ROUTES
// ==========================================
router.use(jiraAuthMiddleware);

// GET /api/jira/myself
router.get('/myself', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const resp = await req.jiraClient!.get('/rest/api/3/myself');
    res.json(resp.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/projects - List accessible projects
router.get('/projects', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const resp = await req.jiraClient!.get('/rest/api/3/project');
    const projects = (resp.data || []).map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      avatarUrls: p.avatarUrls,
      lead: p.lead ? { displayName: p.lead.displayName, accountId: p.lead.accountId } : null
    }));
    res.json(projects);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/projects/:projectIdOrKey/issuetypes - Get issue types for project
router.get('/projects/:projectIdOrKey/issuetypes', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { projectIdOrKey } = req.params;
    let issueTypes: any[] = [];

    try {
      const resp = await req.jiraClient!.get(`/rest/api/3/project/${projectIdOrKey}`);
      issueTypes = resp.data.issueTypes || [];
    } catch {
      // Fallback to global issuetypes
      const globalResp = await req.jiraClient!.get('/rest/api/3/issuetype');
      issueTypes = globalResp.data || [];
    }

    const sanitized = issueTypes.map((it: any) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      subtask: Boolean(it.subtask),
      iconUrl: it.iconUrl,
      hierarchyLevel: it.hierarchyLevel
    }));

    res.json(sanitized);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/priorities - List priorities
router.get('/priorities', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const resp = await req.jiraClient!.get('/rest/api/3/priority');
    res.json(resp.data || []);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/issue-types - List all global issue types
router.get('/issue-types', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    let resp: any;
    try {
      resp = await req.jiraClient!.get('/rest/api/3/issuetype');
    } catch {
      resp = await req.jiraClient!.get('/rest/api/2/issuetype');
    }
    const issueTypes = (resp.data || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      subtask: Boolean(it.subtask),
      iconUrl: it.iconUrl
    }));
    res.json(issueTypes);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/statuses - List all global statuses with category
router.get('/statuses', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    let resp: any;
    try {
      resp = await req.jiraClient!.get('/rest/api/3/status');
    } catch {
      resp = await req.jiraClient!.get('/rest/api/2/status');
    }
    const statuses = (resp.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      statusCategory: s.statusCategory
    }));
    res.json(statuses);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/users/assignable - Search assignable users (supports Jira Server & Cloud)
router.get('/users/assignable', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    let project = (req.query.project as string) || '';
    const query = (req.query.query as string) || '';
    const issueKey = req.query.issueKey as string;

    // If no project or issueKey provided, default project to 'ASC' to get system users
    if (!project && !issueKey) {
      project = 'ASC';
    }

    let resp: any = null;

    if (project) {
      try {
        resp = await req.jiraClient!.get(
          `/rest/api/2/user/assignable/search?project=${encodeURIComponent(project)}&username=${encodeURIComponent(query)}&maxResults=200`
        );
      } catch {
        resp = await req.jiraClient!.get(
          `/rest/api/3/user/assignable/search?project=${encodeURIComponent(project)}&query=${encodeURIComponent(query)}&maxResults=200`
        );
      }
    } else if (issueKey) {
      try {
        resp = await req.jiraClient!.get(
          `/rest/api/2/user/assignable/search?issueKey=${encodeURIComponent(issueKey)}&username=${encodeURIComponent(query)}&maxResults=200`
        );
      } catch {
        resp = await req.jiraClient!.get(
          `/rest/api/3/user/assignable/search?issueKey=${encodeURIComponent(issueKey)}&query=${encodeURIComponent(query)}&maxResults=200`
        );
      }
    }

    const rawUsers = resp?.data || [];
    const users = rawUsers
      .filter((u: any) => u && (u.displayName || u.name))
      .map((u: any) => ({
        accountId: u.name || u.key || u.accountId,
        name: u.name || u.key || u.accountId,
        key: u.key || u.name || u.accountId,
        displayName: u.displayName || u.name || u.key,
        emailAddress: u.emailAddress || '',
        avatarUrls: u.avatarUrls,
        active: u.active !== false
      }))
      .sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));

    res.json(users);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/boards
router.get('/boards', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const resp = await req.jiraClient!.get('/rest/agile/1.0/board');
    res.json(resp.data.values || []);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/boards/:id/configuration - Get Jira board column configuration
router.get('/boards/:id/configuration', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const resp = await req.jiraClient!.get(`/rest/agile/1.0/board/${id}/configuration`);
    res.json(resp.data || {});
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/boards/:id/sprints - Supports ?state=active,future,closed
router.get('/boards/:id/sprints', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const state = (req.query.state as string) || 'active,future,closed';
    try {
      const resp = await req.jiraClient!.get(`/rest/agile/1.0/board/${id}/sprint?state=${state}`);
      res.json(resp.data.values || []);
    } catch (sprintErr: any) {
      // Board does not support sprints (e.g. Kanban board)
      if (sprintErr.response?.status === 400 || sprintErr.response?.status === 404) {
        return res.json([]);
      }
      throw sprintErr;
    }
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/boards/:id/backlog - Get board backlog issues
router.get('/boards/:id/backlog', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const maxResults = req.query.maxResults || 100;
    try {
      const resp = await req.jiraClient!.get(
        `/rest/agile/1.0/board/${id}/backlog?maxResults=${maxResults}&fields=summary,status,priority,issuetype,assignee,reporter,created,updated,parent,subtasks,timetracking,timeoriginalestimate,aggregatetimeoriginalestimate,customfield_10110,customfield_10103,customfield_10402,customfield_10016,customfield_10026`
      );
      const issues = resp.data.issues || [];
      issues.forEach((iss: any) => {
        if (iss.fields) {
          const sp = iss.fields.customfield_10110 
            ?? iss.fields.customfield_10103 
            ?? iss.fields.customfield_10402 
            ?? iss.fields.customfield_10016 
            ?? iss.fields.customfield_10026 
            ?? null;
          iss.fields.storyPoints = sp !== null ? Number(sp) : null;
        }
      });
      res.json(issues);
    } catch (backlogErr: any) {
      if (backlogErr.response?.status === 400 || backlogErr.response?.status === 404) {
        return res.json([]);
      }
      throw backlogErr;
    }
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/sprints/:id - Sprint details
router.get('/sprints/:id', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const resp = await req.jiraClient!.get(`/rest/agile/1.0/sprint/${id}`);
    res.json(resp.data);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/sprints/:id/issues - Issues inside sprint with subtasks (with auto-pagination & estimation fields)
router.get('/sprints/:id/issues', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requestedFields = [
      'summary',
      'status',
      'priority',
      'issuetype',
      'assignee',
      'reporter',
      'created',
      'updated',
      'parent',
      'subtasks',
      'timetracking',
      'timeoriginalestimate',
      'aggregatetimeoriginalestimate',
      'timeestimate',
      'timespent',
      'customfield_10110', // Story Points (Jira Server)
      'customfield_10103', // Original story points
      'customfield_10402', // BA Estimation Point
      'customfield_10401', // Dev - Earned Point
      'customfield_10016', // Story Points (Jira Cloud)
      'customfield_10026'  // Story Points (Jira Cloud alternate)
    ].join(',');

    let allIssues: any[] = [];
    let startAt = 0;
    const pageSize = 100;
    let total = 0;

    do {
      const resp = await req.jiraClient!.get(
        `/rest/agile/1.0/sprint/${id}/issue?startAt=${startAt}&maxResults=${pageSize}&fields=${requestedFields}`
      );
      const data = resp.data || {};
      const issues = data.issues || [];
      total = data.total || issues.length;

      // Enrich storyPoints on issue fields
      issues.forEach((iss: any) => {
        if (iss.fields) {
          const sp = iss.fields.customfield_10110 
            ?? iss.fields.customfield_10103 
            ?? iss.fields.customfield_10402 
            ?? iss.fields.customfield_10016 
            ?? iss.fields.customfield_10026 
            ?? null;
          iss.fields.storyPoints = sp !== null ? Number(sp) : null;
        }
      });

      allIssues = allIssues.concat(issues);
      startAt += issues.length;

      if (issues.length === 0 || startAt >= total) {
        break;
      }
    } while (startAt < total && allIssues.length < 1000);

    res.json(allIssues);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// POST /api/jira/sprints/:id/move-issues - Move issues to sprint
router.post('/sprints/:id/move-issues', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { issues } = req.body;
    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return res.status(400).json({ error: 'Array of issue keys is required', message: 'Array of issue keys is required' });
    }
    const resp = await req.jiraClient!.post(`/rest/agile/1.0/sprint/${id}/issue`, { issues });
    res.json(resp.data || { success: true });
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// POST /api/jira/issues - Create US, Standard Issue, or Sub-task
router.post('/issues', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { 
      projectKey, 
      issueTypeId, 
      issueTypeName, 
      summary, 
      description, 
      priorityId, 
      assigneeAccountId, 
      assignee,
      reporter,
      parentKey,
      storyPoints,
      components,
      originalEstimate,
      subtaskTypeId
    } = req.body;

    if (!projectKey || !summary?.trim()) {
      return res.status(400).json({ 
        error: 'Project key and issue summary are required', 
        message: 'Project key and issue summary are required' 
      });
    }

    const cleanProject = projectKey.trim().toUpperCase();
    const cleanSummary = summary.trim();
    const plainDesc = typeof description === 'string' ? description.trim() : (description?.text || '');

    const fields: any = {
      project: { key: cleanProject },
      summary: cleanSummary,
      issuetype: issueTypeId ? { id: issueTypeId } : { name: issueTypeName || 'Story' },
      description: plainDesc
    };

    if (parentKey?.trim()) {
      fields.parent = { key: parentKey.trim().toUpperCase() };
    }

    if (priorityId) {
      fields.priority = { id: priorityId };
    }

    // Assignee handling (supports Jira Server username or Jira Cloud accountId)
    const targetAssignee = assignee || assigneeAccountId;
    if (targetAssignee && targetAssignee !== 'Automatic' && targetAssignee !== '-1') {
      fields.assignee = { name: targetAssignee };
    }

    // Reporter handling
    if (reporter && typeof reporter === 'string' && reporter.trim()) {
      fields.reporter = { name: reporter.trim() };
    }

    // Original Estimate
    if (originalEstimate && typeof originalEstimate === 'string' && originalEstimate.trim()) {
      fields.timetracking = { originalEstimate: originalEstimate.trim() };
    }

    // Sub-task Type (customfield_10214 on Jira Server)
    if (subtaskTypeId && subtaskTypeId !== 'None' && subtaskTypeId !== '') {
      fields.customfield_10214 = { id: String(subtaskTypeId) };
    }

    if (Array.isArray(components) && components.length > 0) {
      fields.components = components.map(c => typeof c === 'string' ? { name: c } : c);
    }

    if (storyPoints !== undefined && storyPoints !== null && storyPoints !== '') {
      fields.customfield_10016 = Number(storyPoints);
    }

    let resp: any;
    try {
      // 1. Try Jira Server API v2 first with plain text description
      resp = await req.jiraClient!.post('/rest/api/2/issue', { fields });
    } catch (v2Err: any) {
      const errData = v2Err.response?.data;
      const errStr = JSON.stringify(errData || '');

      // Retry if assignee failed with { name } (e.g. Cloud expects accountId)
      if (errStr.includes('assignee') && targetAssignee) {
        fields.assignee = { accountId: targetAssignee };
      }
      if (errStr.includes('reporter') && reporter) {
        fields.reporter = { accountId: reporter };
      }
      if (errStr.includes('customfield_10016')) {
        delete fields.customfield_10016;
      }
      if (errStr.includes('customfield_10214')) {
        delete fields.customfield_10214;
      }
      if (errStr.includes('timetracking')) {
        delete fields.timetracking;
      }

      try {
        resp = await req.jiraClient!.post('/rest/api/2/issue', { fields });
      } catch (retryV2Err: any) {
        // Fallback to Jira Cloud API v3 with ADF description
        try {
          fields.description = textToAdf(plainDesc);
          resp = await req.jiraClient!.post('/rest/api/3/issue', { fields });
        } catch (v3Err: any) {
          throw retryV2Err || v2Err || v3Err;
        }
      }
    }

    res.json(resp.data);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/issues/:key - Full issue details with subtasks, worklogs, transitions
router.get('/issues/:key', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    const endpoint = isJiraServer
      ? `/rest/api/2/issue/${key}?expand=names,renderedFields,transitions,operations,changelog`
      : `/rest/api/3/issue/${key}?expand=names,renderedFields,transitions,operations,changelog`;
    const resp = await req.jiraClient!.get(endpoint);
    res.json(resp.data);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// PUT /api/jira/issues/:key - Update issue
router.put('/issues/:key', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const payload = { ...req.body };
    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');

    // Auto-convert plain description to ADF if provided for Cloud, or ensure plain string for Server
    if (payload.fields?.description) {
      if (isJiraServer) {
        payload.fields.description = typeof payload.fields.description === 'string'
          ? payload.fields.description
          : adfToText(payload.fields.description);
      } else {
        payload.fields.description = typeof payload.fields.description === 'object' && payload.fields.description.type === 'doc'
          ? payload.fields.description
          : textToAdf(payload.fields.description);
      }
    }

    const endpoint = isJiraServer ? `/rest/api/2/issue/${key}` : `/rest/api/3/issue/${key}`;
    const resp = await req.jiraClient!.put(endpoint, payload);
    res.json(resp.data || { success: true });
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/issues/:key/transitions
router.get('/issues/:key/transitions', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    const endpoint = isJiraServer ? `/rest/api/2/issue/${key}/transitions` : `/rest/api/3/issue/${key}/transitions`;
    const resp = await req.jiraClient!.get(endpoint);
    res.json(resp.data.transitions || []);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// POST /api/jira/issues/:key/transitions
router.post('/issues/:key/transitions', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { transitionId } = req.body;
    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    const endpoint = isJiraServer ? `/rest/api/2/issue/${key}/transitions` : `/rest/api/3/issue/${key}/transitions`;
    await req.jiraClient!.post(endpoint, {
      transition: { id: transitionId }
    });
    res.json({ success: true });
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// POST /api/jira/issues/:key/comment
router.post('/issues/:key/comment', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { body } = req.body;
    if (!body || (typeof body === 'string' && !body.trim())) {
      return res.status(400).json({ error: 'Comment body is required', message: 'Nội dung bình luận không được để trống' });
    }

    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    const commentPayload = isJiraServer
      ? (typeof body === 'string' ? body.trim() : adfToText(body))
      : (typeof body === 'object' && body.type === 'doc' ? body : textToAdf(body));

    const endpoint = isJiraServer ? `/rest/api/2/issue/${key}/comment` : `/rest/api/3/issue/${key}/comment`;

    const resp = await req.jiraClient!.post(endpoint, {
      body: commentPayload
    });
    res.json(resp.data);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/issues/:key/worklog - List worklogs for issue
router.get('/issues/:key/worklog', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    const endpoint = isJiraServer ? `/rest/api/2/issue/${key}/worklog` : `/rest/api/3/issue/${key}/worklog`;
    const resp = await req.jiraClient!.get(endpoint);
    const data = resp.data || { total: 0, worklogs: [] };
    
    // Enrich worklog comments with readable text if needed
    const enrichedWorklogs = (data.worklogs || []).map((w: any) => ({
      ...w,
      commentText: typeof w.comment === 'string' ? w.comment : adfToText(w.comment)
    }));

    res.json({
      total: data.total || 0,
      worklogs: enrichedWorklogs
    });
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// POST /api/jira/issues/:key/worklog - Log work with flexible time & ADF comment
router.post('/issues/:key/worklog', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { timeSpent, timeSpentSeconds, comment, started, adjustEstimate } = req.body;

    const seconds = Number(timeSpentSeconds) > 0 
      ? Number(timeSpentSeconds) 
      : parseFlexibleTimeToSeconds(timeSpent);

    if (!seconds || seconds <= 0) {
      return res.status(400).json({ 
        error: 'Invalid time spent. Please specify duration like "1h 30m", "45m", "2h", "1d" or hours.',
        message: 'Invalid time spent. Please specify duration like "1h 30m", "45m", "2h", "1d" or hours.'
      });
    }

    // Format ISO string to Jira expected format e.g. "2026-10-24T08:30:00.000+0000"
    let startedDateStr: string;
    try {
      const d = started ? new Date(started) : new Date();
      startedDateStr = d.toISOString().replace('Z', '+0000');
    } catch {
      startedDateStr = new Date().toISOString().replace('Z', '+0000');
    }

    const payload: any = {
      timeSpentSeconds: seconds,
      started: startedDateStr
    };

    const isJiraServer = !req.jiraSession?.base_url?.includes('.atlassian.net');
    if (comment) {
      if (isJiraServer) {
        payload.comment = typeof comment === 'string' ? comment.trim() : adfToText(comment);
      } else {
        payload.comment = typeof comment === 'object' && comment.type === 'doc' ? comment : textToAdf(comment.trim());
      }
    }

    let url = isJiraServer ? `/rest/api/2/issue/${key}/worklog` : `/rest/api/3/issue/${key}/worklog`;
    if (adjustEstimate) {
      url += `?adjustEstimate=${encodeURIComponent(adjustEstimate)}`;
    }

    const resp = await req.jiraClient!.post(url, payload);
    res.json(resp.data);
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

// GET /api/jira/my-issues - Current user's issues for quick selection
router.get('/my-issues', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const resp = await req.jiraClient!.post('/rest/api/2/search', {
      jql: 'assignee = currentUser() ORDER BY updated DESC',
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'issuetype', 'assignee', 'parent', 'subtasks', 'timetracking', 'timespent', 'timeestimate', 'updated']
    });
    res.json(resp.data.issues || []);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/my-subtasks - Current user's assigned subtasks with status filter (default: active = todo / in progress)
router.get('/my-subtasks', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { status = 'active', search, limit = 50 } = req.query;

    let jql = 'assignee = currentUser() AND issuetype in subTaskIssueTypes()';
    if (status === 'active') {
      jql += ' AND statusCategory != Done';
    } else if (status === 'done') {
      jql += ' AND statusCategory = Done';
    }

    if (search && typeof search === 'string' && search.trim()) {
      const cleanSearch = search.trim().replace(/['"\\]/g, '');
      jql += ` AND (text ~ "${cleanSearch}" OR key = "${cleanSearch.toUpperCase()}")`;
    }

    jql += ' ORDER BY updated DESC';

    const resp = await req.jiraClient!.post('/rest/api/2/search', {
      jql,
      maxResults: Math.min(Number(limit) || 50, 100),
      fields: ['summary', 'status', 'priority', 'issuetype', 'assignee', 'parent', 'timetracking', 'timespent', 'timeestimate', 'updated']
    });

    const issues = (resp.data.issues || []).map((iss: any) => ({
      key: iss.key,
      summary: iss.fields?.summary || '',
      issueType: iss.fields?.issuetype,
      status: iss.fields?.status,
      isSubtask: true,
      priority: iss.fields?.priority,
      parent: iss.fields?.parent ? {
        key: iss.fields.parent.key,
        summary: iss.fields.parent.fields?.summary || '',
        status: iss.fields.parent.fields?.status
      } : undefined,
      timetracking: {
        timeSpent: iss.fields?.timetracking?.timeSpent || (iss.fields?.timespent ? `${Math.round(iss.fields.timespent / 3600)}h` : '0m'),
        remainingEstimate: iss.fields?.timetracking?.remainingEstimate || (iss.fields?.timeestimate ? `${Math.round(iss.fields.timeestimate / 3600)}h` : 'Not set'),
        originalEstimate: iss.fields?.timetracking?.originalEstimate || 'None'
      },
      updated: iss.fields?.updated
    }));

    res.json(issues);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET /api/jira/worklogs/week - Weekly calendar worklogs breakdown (by day, tasks and subtasks)
router.get('/worklogs/week', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    let { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    // Default to current week (Monday to Sunday) if not specified
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
      const distanceToMonday = (currentDay + 6) % 7; // days since Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      startDate = formatLocalDate(monday);
      endDate = formatLocalDate(sunday);
    }

    const jql = `worklogAuthor = currentUser() AND worklogDate >= "${startDate}" AND worklogDate <= "${endDate}" ORDER BY updated DESC`;

    const searchResp = await req.jiraClient!.post('/rest/api/2/search', {
      jql,
      maxResults: 100,
      fields: ['summary', 'status', 'issuetype', 'worklog', 'parent']
    });

    const issues = searchResp.data.issues || [];

    // Helper to format day name
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    // Generate 7 day slots
    const daysMap: Record<string, {
      date: string;
      dayOfWeek: number;
      dayName: string;
      totalSeconds: number;
      totalHours: number;
      taskKeys: Set<string>;
      subtaskKeys: Set<string>;
      taskCount: number;
      subtaskCount: number;
      worklogs: any[];
    }> = {};

    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const startD = new Date(sYear, sMonth - 1, sDay);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startD);
      d.setDate(startD.getDate() + i);
      const dateStr = formatLocalDate(d);
      const dow = d.getDay();
      daysMap[dateStr] = {
        date: dateStr,
        dayOfWeek: dow,
        dayName: dayNames[dow],
        totalSeconds: 0,
        totalHours: 0,
        taskKeys: new Set<string>(),
        subtaskKeys: new Set<string>(),
        taskCount: 0,
        subtaskCount: 0,
        worklogs: []
      };
    }

    const allWorklogs: any[] = [];
    const totalTaskKeys = new Set<string>();
    const totalSubtaskKeys = new Set<string>();

    for (const issue of issues) {
      const isSubtask = Boolean(issue.fields?.issuetype?.subtask || issue.fields?.parent);
      const issueWorklogs = issue.fields?.worklog?.worklogs || [];

      for (const w of issueWorklogs) {
        let startedDateStr = '';
        try {
          startedDateStr = formatLocalDate(new Date(w.started));
        } catch {
          startedDateStr = (w.started || '').slice(0, 10);
        }

        if (daysMap[startedDateStr]) {
          const item = {
            worklogId: w.id,
            issueKey: issue.key,
            issueSummary: issue.fields?.summary || '',
            issueType: issue.fields?.issuetype?.name || (isSubtask ? 'Sub-task' : 'Task'),
            issueStatus: issue.fields?.status?.name || '',
            isSubtask,
            author: w.author,
            started: w.started,
            timeSpent: w.timeSpent,
            timeSpentSeconds: w.timeSpentSeconds || 0,
            commentText: typeof w.comment === 'string' ? w.comment : adfToText(w.comment),
            created: w.created
          };

          daysMap[startedDateStr].worklogs.push(item);
          daysMap[startedDateStr].totalSeconds += item.timeSpentSeconds;
          if (isSubtask) {
            daysMap[startedDateStr].subtaskKeys.add(issue.key);
            totalSubtaskKeys.add(issue.key);
          } else {
            daysMap[startedDateStr].taskKeys.add(issue.key);
            totalTaskKeys.add(issue.key);
          }
          allWorklogs.push(item);
        }
      }
    }

    // Finalize day counts
    const days = Object.values(daysMap).map(d => ({
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      dayName: d.dayName,
      totalSeconds: d.totalSeconds,
      totalHours: Number((d.totalSeconds / 3600).toFixed(2)),
      taskCount: d.taskKeys.size,
      subtaskCount: d.subtaskKeys.size,
      worklogs: d.worklogs.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime())
    }));

    const weeklyTotalSeconds = allWorklogs.reduce((acc, curr) => acc + (curr.timeSpentSeconds || 0), 0);

    res.json({
      startDate,
      endDate,
      totalSeconds: weeklyTotalSeconds,
      totalHours: Number((weeklyTotalSeconds / 3600).toFixed(1)),
      totalTaskCount: totalTaskKeys.size,
      totalSubtaskCount: totalSubtaskKeys.size,
      totalWorklogsCount: allWorklogs.length,
      days,
      allWorklogs: allWorklogs.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime())
    });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/worklogs/recent - Recent worklogs across user's issues
router.get('/worklogs/recent', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    // 1. Search issues recently updated with worklogs by currentUser
    const searchResp = await req.jiraClient!.post('/rest/api/2/search', {
      jql: 'worklogAuthor = currentUser() AND worklogDate >= -30d ORDER BY updated DESC',
      maxResults: 25,
      fields: ['summary', 'status', 'issuetype', 'worklog', 'timetracking', 'timespent', 'parent']
    });

    const issues = searchResp.data.issues || [];
    const recentWorklogs: any[] = [];

    // 2. Collect worklogs from returned issues
    for (const issue of issues) {
      const isSubtask = Boolean(issue.fields?.issuetype?.subtask || issue.fields?.parent);
      const issueWorklogs = issue.fields?.worklog?.worklogs || [];
      issueWorklogs.forEach((w: any) => {
        recentWorklogs.push({
          issueKey: issue.key,
          issueSummary: issue.fields?.summary || '',
          issueType: issue.fields?.issuetype,
          issueStatus: issue.fields?.status,
          isSubtask,
          worklogId: w.id,
          author: w.author,
          started: w.started,
          timeSpent: w.timeSpent,
          timeSpentSeconds: w.timeSpentSeconds,
          commentText: typeof w.comment === 'string' ? w.comment : adfToText(w.comment),
          created: w.created
        });
      });
    }

    // Sort recent worklogs descending by started date
    recentWorklogs.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());

    res.json(recentWorklogs.slice(0, 50));
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ error: error.response?.data || error.message });
  }
});

// GET /api/jira/search - Multi-purpose search (keyword, filters, or custom JQL)
router.get('/search', async (req: AuthenticatedJiraRequest, res: Response) => {
  try {
    const { 
      q, 
      jql: rawJql, 
      status, 
      assignee, 
      issueType, 
      project, 
      startAt = 0, 
      maxResults = 50 
    } = req.query;

    let finalJql = '';

    if (rawJql && typeof rawJql === 'string' && rawJql.trim()) {
      finalJql = rawJql.trim();
    } else {
      const clauses: string[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        const queryTerm = q.trim();
        const cleanTerm = queryTerm.replace(/["\\]/g, '').trim();
        // Search exclusively by Issue Key or Name (Summary), excluding Description
        if (/^[A-Z0-9]+-\d+$/i.test(cleanTerm)) {
          clauses.push(`(issueKey = "${cleanTerm.toUpperCase()}" OR summary ~ "${cleanTerm}")`);
        } else if (/^\d+$/.test(cleanTerm) && project && typeof project === 'string' && project.trim()) {
          clauses.push(`(issueKey = "${project.trim().toUpperCase()}-${cleanTerm}" OR summary ~ "${cleanTerm}")`);
        } else {
          clauses.push(`summary ~ "${cleanTerm}"`);
        }
      }

      if (project && typeof project === 'string' && project.trim()) {
        clauses.push(`project = "${project.trim().toUpperCase()}"`);
      }

      // Status clause handling:
      // - 'active' / 'not_done' / default: statusCategory != Done (only running/active tasks)
      // - 'done': statusCategory = Done (completed/closed tasks)
      // - 'in_progress': statusCategory in ("In Progress")
      // - 'todo': statusCategory in ("To Do")
      // - 'all': no status filter applied (both active and done)
      // - specific custom status name: status = "..."
      if (status && typeof status === 'string' && status.trim()) {
        const s = status.trim().toLowerCase();
        if (s === 'done') {
          clauses.push('statusCategory = Done');
        } else if (s === 'active' || s === 'not_done') {
          clauses.push('statusCategory != Done');
        } else if (s === 'in_progress' || s === 'inprogress') {
          clauses.push('statusCategory in ("In Progress")');
        } else if (s === 'todo' || s === 'to do') {
          clauses.push('statusCategory in ("To Do")');
        } else if (s === 'all') {
          // No status clause: returns both active and done
        } else {
          clauses.push(`status = "${status.trim()}"`);
        }
      } else {
        // DEFAULT RULE: If status is not explicitly set, filter out Done to keep the list focused on running/active tasks
        clauses.push('statusCategory != Done');
      }

      // Issue Type clause handling:
      // - 'subtask' / 'sub-task': issuetype in subTaskIssueTypes()
      // - 'standard': issuetype in standardIssueTypes() (Story, Task, Bug, etc.)
      // - 'all': no type filter
      // - specific type name: issuetype = "..."
      if (issueType && typeof issueType === 'string' && issueType.trim()) {
        const it = issueType.trim().toLowerCase();
        if (it === 'subtask' || it === 'sub-task') {
          clauses.push('issuetype in subTaskIssueTypes()');
        } else if (it === 'standard') {
          clauses.push('issuetype in standardIssueTypes()');
        } else if (it === 'all') {
          // No type filter
        } else {
          clauses.push(`issuetype = "${issueType.trim()}"`);
        }
      }

      if (assignee && typeof assignee === 'string' && assignee.trim()) {
        const a = assignee.trim();
        if (a === 'currentUser()' || a === 'currentUser' || a === 'my') {
          clauses.push('assignee = currentUser()');
        } else if (a === 'unassigned') {
          clauses.push('assignee is EMPTY');
        } else if (a !== 'all' && a !== '__all__') {
          clauses.push(`assignee = "${a}"`);
        }
      } else {
        // If neither assignee, nor query term, nor project is specified, default to currentUser()
        const hasScope = (q && typeof q === 'string' && q.trim()) || (project && typeof project === 'string' && project.trim());
        if (!hasScope) {
          clauses.push('assignee = currentUser()');
        }
      }

      finalJql = clauses.length > 0 
        ? clauses.join(' AND ') + ' ORDER BY updated DESC'
        : 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
    }

    const resp = await req.jiraClient!.post('/rest/api/2/search', {
      jql: finalJql,
      startAt: Number(startAt) || 0,
      maxResults: Number(maxResults) || 50,
      fields: [
        'summary', 
        'status', 
        'priority', 
        'issuetype', 
        'assignee', 
        'reporter', 
        'created', 
        'updated',
        'parent',
        'subtasks',
        'timetracking',
        'timespent',
        'timeestimate',
        'customfield_10016',
        'customfield_10026'
      ]
    });

    res.json({
      startAt: resp.data.startAt || 0,
      maxResults: resp.data.maxResults || 50,
      total: resp.data.total || 0,
      issues: resp.data.issues || []
    });
  } catch (error: any) {
    const formatted = formatJiraError(error);
    res.status(error.response?.status || 500).json(formatted);
  }
});

export default router;
