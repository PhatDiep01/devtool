import axios from 'axios';

export interface JiraCaptchaSessionPayload {
  cookie: string;
  baseUrl: string;
  time: number;
}

export interface JiraCaptchaResult {
  captchaId: string;
  captchaImage: string;
  cookie: string;
}

export interface JiraCaptchaLoginResult {
  success: boolean;
  authenticatedCookies?: string;
  isCaptchaError?: boolean;
  errorMessage?: string;
  myselfData?: any;
}

/**
 * Formats Set-Cookie header array into a standard Cookie header string
 */
export function formatCookieHeader(setCookies?: string[] | null): string {
  if (!setCookies || !Array.isArray(setCookies)) return '';
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Merges existing Cookie header with newly received Set-Cookie headers
 */
export function mergeCookies(baseCookies?: string, newSetCookies?: string[] | null): string {
  const map = new Map<string, string>();
  if (baseCookies) {
    baseCookies.split(';').forEach((pair) => {
      const parts = pair.trim().split('=');
      if (parts[0]) map.set(parts[0], parts.slice(1).join('='));
    });
  }
  if (newSetCookies && Array.isArray(newSetCookies)) {
    newSetCookies.forEach((c) => {
      const main = c.split(';')[0].trim();
      const parts = main.split('=');
      if (parts[0]) map.set(parts[0], parts.slice(1).join('='));
    });
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Encodes cookie session and Jira base URL into a stateless URL-safe token
 */
export function encodeCaptchaToken(cookie: string, baseUrl: string): string {
  const payload: JiraCaptchaSessionPayload = {
    cookie,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    time: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decodes captcha token, validating timestamp expiry (15 minutes)
 */
export function decodeCaptchaToken(token: string): { cookie: string; baseUrl: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as JiraCaptchaSessionPayload;
    if (!payload.cookie || !payload.baseUrl) return null;
    // Expire after 15 minutes
    if (Date.now() - payload.time > 15 * 60 * 1000) {
      return null;
    }
    return { cookie: payload.cookie, baseUrl: payload.baseUrl };
  } catch {
    return null;
  }
}

/**
 * Fetches Jira CAPTCHA challenge image as Base64 Data URI from on-premise Jira Server / Data Center
 */
export async function fetchJiraCaptcha(baseUrl: string, existingCookie?: string): Promise<JiraCaptchaResult> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  let cookieHeader = existingCookie || '';

  // If no existing cookie provided, request login.jsp first to obtain session cookies (JSESSIONID)
  if (!cookieHeader) {
    const loginPageRes = await axios.get(`${cleanBaseUrl}/login.jsp`, {
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 DevToolkit/1.0'
      }
    });
    const rawCookies = loginPageRes.headers['set-cookie'];
    const setCookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [String(rawCookies)] : [];
    cookieHeader = formatCookieHeader(setCookies);
  }

  // Request the CAPTCHA image using the active session cookie
  const captchaRes = await axios.get(`${cleanBaseUrl}/captcha`, {
    headers: {
      Cookie: cookieHeader,
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 DevToolkit/1.0'
    },
    responseType: 'arraybuffer',
    timeout: 10000
  });

  const rawMime = String(captchaRes.headers['content-type'] || 'image/jpeg');
  const mimeType = rawMime.split(';')[0].trim() || 'image/jpeg';
  const base64Data = Buffer.from(captchaRes.data).toString('base64');
  const captchaImage = `data:${mimeType};base64,${base64Data}`;

  // If new cookies were returned from /captcha, merge them
  const rawSetCookie = captchaRes.headers['set-cookie'];
  if (rawSetCookie) {
    const capCookies = Array.isArray(rawSetCookie) ? rawSetCookie : [String(rawSetCookie)];
    cookieHeader = mergeCookies(cookieHeader, capCookies);
  }

  const captchaId = encodeCaptchaToken(cookieHeader, cleanBaseUrl);

  return {
    captchaId,
    captchaImage,
    cookie: cookieHeader
  };
}

/**
 * Submits username, password, and CAPTCHA answer to Jira's web login endpoint (/login.jsp)
 */
export async function submitJiraWebLoginWithCaptcha(params: {
  baseUrl: string;
  username: string;
  password: string;
  captchaId: string;
  captchaResponse: string;
}): Promise<JiraCaptchaLoginResult> {
  const { baseUrl, username, password, captchaId, captchaResponse } = params;
  const decoded = decodeCaptchaToken(captchaId);

  if (!decoded) {
    return {
      success: false,
      isCaptchaError: true,
      errorMessage: 'Phiên CAPTCHA đã hết hạn hoặc không hợp lệ. Vui lòng tải lại mã bảo vệ mới.'
    };
  }

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const cookieHeader = decoded.cookie;

  const formParams = new URLSearchParams();
  formParams.append('os_username', username);
  formParams.append('os_password', password);
  formParams.append('os_captcha', captchaResponse.trim());
  formParams.append('os_cookie', 'true');

  try {
    const postRes = await axios.post(`${cleanBaseUrl}/login.jsp`, formParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 DevToolkit/1.0'
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      timeout: 15000
    });

    const loginReason = String(postRes.headers['x-seraph-loginreason'] || '').toUpperCase();
    const isFailed = loginReason.includes('FAILED') || loginReason.includes('DENIED');
    const rawNewCookies = postRes.headers['set-cookie'];
    const newCookies = Array.isArray(rawNewCookies) ? rawNewCookies : rawNewCookies ? [String(rawNewCookies)] : [];
    const mergedCookies = mergeCookies(cookieHeader, newCookies);

    if (isFailed) {
      let extractedMsg = 'Mã xác thực CAPTCHA hoặc mật khẩu không chính xác.';
      const html = typeof postRes.data === 'string' ? postRes.data : '';
      const match = html.match(/<div class="aui-message[^"]*">([\s\S]*?)<\/div>/i);
      if (match) {
        const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text) extractedMsg = text;
      }

      return {
        success: false,
        isCaptchaError: true,
        errorMessage: extractedMsg,
        authenticatedCookies: mergedCookies
      };
    }

    // Success login: Attempt to fetch Jira myself profile to confirm authentication
    const basicAuthHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    let myselfRes: any = null;

    // Try fetching with session cookie first, then with Basic Auth
    try {
      myselfRes = await axios.get(`${cleanBaseUrl}/rest/api/2/myself`, {
        headers: {
          Cookie: mergedCookies,
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 DevToolkit/1.0'
        },
        timeout: 10000
      });
    } catch {
      try {
        myselfRes = await axios.get(`${cleanBaseUrl}/rest/api/2/myself`, {
          headers: {
            Authorization: basicAuthHeader,
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 DevToolkit/1.0'
          },
          timeout: 10000
        });
      } catch (err: any) {
        // If myself still fails
        return {
          success: false,
          errorMessage: 'Đăng nhập thành công nhưng không thể lấy thông tin hồ sơ người dùng Jira.',
          authenticatedCookies: mergedCookies
        };
      }
    }

    if (myselfRes && myselfRes.data && (myselfRes.data.name || myselfRes.data.key || myselfRes.data.displayName)) {
      return {
        success: true,
        authenticatedCookies: mergedCookies,
        myselfData: myselfRes.data
      };
    }

    return {
      success: false,
      errorMessage: 'Đăng nhập không thành công. Máy chủ không trả về thông tin người dùng hợp lệ.',
      authenticatedCookies: mergedCookies
    };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err.message || 'Lỗi kết nối khi gửi thông tin xác thực đến máy chủ Jira.'
    };
  }
}
