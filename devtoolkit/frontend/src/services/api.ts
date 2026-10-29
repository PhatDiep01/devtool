import axios from 'axios';
import type { 
  Module, 
  Screen, 
  ScreenImage,
  DashboardStats, 
  SearchResult, 
  JiraBoard, 
  JiraBoardConfiguration,
  JiraSprint, 
  JiraIssue, 
  StorageStats,
  JiraUser,
  JiraConfigInfo,
  JiraLoginParams,
  JiraAuthResponse,
  JiraProject,
  JiraIssueType,
  JiraPriority,
  JiraAssignableUser,
  JiraWorklogItem,
  JiraCreateIssuePayload,
  JiraCreateWorklogPayload,
  JiraAssignedSubtask,
  WeeklyCalendarResponse,
  ActivityStreamResponse,
  BugItem,
  BugListResponse,
  BugAttachment,
  BugImageAnnotationRecord,
  AnnotationItem,
  StickyNote,
  StickyNoteListResponse,
  StickyNoteCreatePayload,
  StickyNoteUpdatePayload,
  ApiEndpoint,
  ApiModel,
  ApiErrorCode,
  ApiEnvironment
} from '@/types';
import { useAppUpdateStore } from '../stores/app-update.store';

/**
 * Checks if the frontend is currently running on the same host/origin as the backend Express server.
 * This includes:
 * - Localhost & loopback (127.0.0.1, localhost)
 * - Private LAN IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x, *.local)
 * - Direct Cloudflare Tunnel domain (*.trycloudflare.com, *.cfargotunnel.com)
 */
export const isSameOriginBackend = (): boolean => {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.toLowerCase();

  // Localhost / Loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true;
  }

  // Private LAN IPs (e.g. mobile phone connected to PC via Wi-Fi)
  if (
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host.endsWith('.local')
  ) {
    return true;
  }

  // Direct Cloudflare Tunnel URL or custom domain (e.g. devtool.phatdiep.io.vn or *.trycloudflare.com)
  if (
    host.endsWith('.trycloudflare.com') || 
    host.endsWith('.cfargotunnel.com') ||
    host.endsWith('phatdiep.io.vn')
  ) {
    return true;
  }

  // Any domain other than known third-party static SPA CDNs is served directly by our backend
  const isKnownStaticSpaHost = 
    host.endsWith('.web.app') || 
    host.endsWith('.firebaseapp.com') || 
    host.endsWith('.github.io') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app');

  if (!isKnownStaticSpaHost) {
    return true;
  }

  return false;
};

// Helper to retrieve the current active API base URL (supports build-time ENV and dynamic runtime LocalStorage override)
export const getActiveApiUrl = (): string => {
  // When developing or running on same-origin backend (localhost, LAN, or directly on Cloudflare Tunnel domain like devtool.phatdiep.io.vn),
  // always default to relative path '' so requests hit the local Express server directly.
  if (isSameOriginBackend()) {
    return '';
  }

  // If the user explicitly configured an override in localStorage (e.g. while on Firebase Hosting), respect it
  try {
    const localOverride = localStorage.getItem('custom_api_url');
    if (localOverride && localOverride.trim()) {
      let url = localOverride.trim().replace(/\/+$/, '');
      // Purge any old ephemeral trycloudflare.com tunnel
      if (url.includes('.trycloudflare.com')) {
        localStorage.removeItem('custom_api_url');
      } else {
        if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
          url = `https://${url}`;
        }
        return url;
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback to build-time environment variable or permanent production domain
  // @ts-ignore
  let envUrl = (import.meta.env?.VITE_API_URL || 'https://devtool.phatdiep.io.vn').trim().replace(/\/+$/, '');
  if (envUrl && !/^https?:\/\//i.test(envUrl) && !envUrl.startsWith('/')) {
    envUrl = `https://${envUrl}`;
  }
  return envUrl;
};

// @ts-ignore
export const API_BASE_URL: string = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Resolves a relative API or media path to a fully qualified URL when VITE_API_URL or custom_api_url is configured,
 * ensuring images and file downloads load correctly when Frontend is deployed on Firebase Hosting / external domain.
 */
export const resolveApiUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getActiveApiUrl();
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
};

/**
 * Proxies Jira avatar, issue type, and priority images through the backend
 * to bypass internal LAN IP restrictions (e.g. task.ascvn.com.vn on 192.168.0.240)
 * and Chrome Private Network Access / CORS restrictions.
 */
export const getJiraProxyImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let jiraToken = '';
  try {
    jiraToken = localStorage.getItem('jira_session_token') || sessionStorage.getItem('jira_session_token') || '';
  } catch {}

  const tokenParam = jiraToken ? `&jira_token=${encodeURIComponent(jiraToken)}` : '';
  return resolveApiUrl(`/api/jira/proxy/image?url=${encodeURIComponent(url)}${tokenParam}`);
};

const api = axios.create({
  baseURL: getActiveApiUrl(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const activeBaseUrl = getActiveApiUrl();
  if (activeBaseUrl && (!config.url || (!config.url.startsWith('http://') && !config.url.startsWith('https://')))) {
    config.baseURL = activeBaseUrl;
  }
  const isJiraRequest = Boolean(config.url && config.url.includes('/api/jira'));
  const jiraToken = localStorage.getItem('jira_session_token') || sessionStorage.getItem('jira_session_token');
  const appToken = localStorage.getItem('auth_token');

  if (jiraToken) {
    config.headers['x-jira-token'] = jiraToken;
  }

  if (isJiraRequest && jiraToken) {
    config.headers.Authorization = `Bearer ${jiraToken}`;
  } else if (appToken) {
    config.headers.Authorization = `Bearer ${appToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Check if backend returned newer build id header
    const remoteBuildId = response.headers?.['x-app-build-id'];
    if (remoteBuildId && typeof window !== 'undefined') {
      try {
        const current = useAppUpdateStore.getState().currentBuild;
        if (current && current.buildId !== remoteBuildId) {
          useAppUpdateStore.getState().checkForUpdates();
        }
      } catch {}
    }

    // Detect SPA fallback HTML response when calling API endpoints
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    const isApiUrl = Boolean(response.config?.url && response.config.url.includes('/api/'));
    if (
      isApiUrl &&
      typeof response.data === 'string' &&
      (contentType.includes('text/html') ||
        response.data.trim().startsWith('<!doctype') ||
        response.data.trim().startsWith('<html'))
    ) {
      const error: any = new Error(
        'Backend API chưa kết nối hoặc máy chủ trả về mã HTML thay vì dữ liệu JSON. Vui lòng kiểm tra cấu hình URL Backend trong phần Cài đặt.'
      );
      error.isHtmlFallback = true;
      error.response = response;
      return Promise.reject(error);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.url?.includes('/api/jira') && !error.config?.url?.includes('/api/jira/auth/login')) {
        localStorage.removeItem('jira_session_token');
        localStorage.removeItem('jira_user');
        sessionStorage.removeItem('jira_session_token');
        sessionStorage.removeItem('jira_user');
        window.dispatchEvent(new CustomEvent('jira-auth-invalid'));
      } else {
        localStorage.removeItem('auth_token');
      }
    }
    return Promise.reject(error);
  }
);

export const docsApi = {
  getModules: () => api.get<Module[]>('/api/docs/modules'),
  createModule: (data: { name: string; icon?: string; color?: string; description?: string }) => 
    api.post<Module>('/api/docs/modules', data),
  updateModule: (id: number, data: { name?: string; icon?: string; color?: string; description?: string }) => 
    api.put<Module>(`/api/docs/modules/${id}`, data),
  deleteModule: (id: number, targetModuleId?: number, cascade?: boolean) => 
    api.delete(`/api/docs/modules/${id}`, { 
      params: targetModuleId ? { targetModuleId } : (cascade ? { cascade: true } : undefined) 
    }),
  getScreens: (params?: { moduleId?: number | string; status?: string; q?: string; search?: string }) =>
    api.get<Screen[]>('/api/docs/screens', { params }),
  getScreensByModule: (slug: string) => api.get<Screen[]>(`/api/docs/modules/${slug}/screens`),
  getScreen: (id: number) => api.get<Screen>(`/api/docs/screens/${id}`),
  createScreen: (data: {
    moduleId: number;
    title: string;
    author?: string;
    status?: string;
    jira_key?: string;
    tags?: string[];
    raw_content?: string;
    image_ids?: number[];
  }) => api.post<Screen>('/api/docs/screens', data),
  importScreen: (formData: FormData) =>
    api.post<Screen>('/api/docs/screens/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateScreen: (id: number, data: Partial<Screen> & { moduleId?: number; image_ids?: number[] }) => 
    api.put<Screen>(`/api/docs/screens/${id}`, data),
  deleteScreen: (id: number) => api.delete(`/api/docs/screens/${id}`),
  search: (q: string) => api.get<SearchResult[]>('/api/docs/search', { params: { q } }),
  getStats: () => api.get<DashboardStats>('/api/docs/stats'),
  sync: () => api.post<{ success: boolean; count: number; message: string }>('/api/docs/sync'),
};

export const jiraAuthApi = {
  login: (params: JiraLoginParams) => api.post<JiraAuthResponse>('/api/jira/auth/login', params),
  getSession: () => api.get<{ authenticated: boolean; user?: JiraUser }>('/api/jira/auth/session'),
  logout: () => api.post<{ success: boolean; message: string }>('/api/jira/auth/logout'),
  getConfigInfo: () => api.get<JiraConfigInfo>('/api/jira/auth/config-info'),
  deleteSavedAccount: (username: string) => api.delete<{ success: boolean; message: string }>(`/api/jira/auth/saved-accounts/${encodeURIComponent(username)}`),
  getStatus: () => api.get<any>('/api/jira/status'),
  getCaptcha: (params?: { baseUrl?: string; captchaId?: string }) =>
    api.get<{ success: boolean; captchaId: string; captchaImage: string }>('/api/jira/auth/captcha', { params }),
};

export const jiraApi = {
  getStatus: () => api.get<any>('/api/jira/status'),
  getBoards: () => api.get<JiraBoard[]>('/api/jira/boards'),
  getBoardConfiguration: (boardId: number) => api.get<JiraBoardConfiguration>(`/api/jira/boards/${boardId}/configuration`),
  getSprints: (boardId: number, state?: string) => 
    api.get<JiraSprint[]>(`/api/jira/boards/${boardId}/sprints`, { params: state ? { state } : undefined }),
  getSprint: (sprintId: number) => api.get<JiraSprint>(`/api/jira/sprints/${sprintId}`),
  getSprintIssues: (sprintId: number) => api.get<JiraIssue[]>(`/api/jira/sprints/${sprintId}/issues`),
  getBoardBacklog: (boardId: number) => api.get<JiraIssue[]>(`/api/jira/boards/${boardId}/backlog`),
  moveIssuesToSprint: (sprintId: number, issues: string[]) => 
    api.post(`/api/jira/sprints/${sprintId}/move-issues`, { issues }),
  getProjects: () => api.get<JiraProject[]>('/api/jira/projects'),
  getIssueTypes: () => api.get<JiraIssueType[]>('/api/jira/issue-types'),
  getStatuses: () => api.get<any[]>('/api/jira/statuses'),
  getProjectIssueTypes: (projectIdOrKey: string) => 
    api.get<JiraIssueType[]>(`/api/jira/projects/${projectIdOrKey}/issuetypes`),
  getPriorities: () => api.get<JiraPriority[]>('/api/jira/priorities'),
  getAssignableUsers: (params?: { project?: string; issueKey?: string; query?: string }) => 
    api.get<JiraAssignableUser[]>('/api/jira/users/assignable', { params }),
  createIssue: (data: JiraCreateIssuePayload) => 
    api.post<{ id: string; key: string; self: string }>('/api/jira/issues', data),
  getIssue: (key: string) => api.get<JiraIssue>(`/api/jira/issues/${key}`),
  updateIssue: (key: string, data: any) => api.put(`/api/jira/issues/${key}`, data),
  deleteIssue: (key: string, params?: { deleteSubtasks?: boolean }) =>
    api.delete(`/api/jira/issues/${key}`, { params }),
  getTransitions: (issueKey: string) => api.get<any[]>(`/api/jira/issues/${issueKey}/transitions`),
  transitionIssue: (issueKey: string, transitionId: string) =>
    api.post(`/api/jira/issues/${issueKey}/transitions`, { transitionId }),
  addComment: (issueKey: string, body: string) =>
    api.post(`/api/jira/issues/${issueKey}/comment`, { body }),
  getWorklogs: (issueKey: string) =>
    api.get<{ total: number; worklogs: any[] }>(`/api/jira/issues/${issueKey}/worklog`),
  createWorklog: (issueKey: string, data: JiraCreateWorklogPayload) =>
    api.post(`/api/jira/issues/${issueKey}/worklog`, data),
  updateWorklog: (issueKey: string, worklogId: string, data: Partial<JiraCreateWorklogPayload>) =>
    api.put(`/api/jira/issues/${issueKey}/worklog/${worklogId}`, data),
  deleteWorklog: (issueKey: string, worklogId: string, params?: { adjustEstimate?: string }) =>
    api.delete(`/api/jira/issues/${issueKey}/worklog/${worklogId}`, { params }),
  getMyIssues: () => api.get<JiraIssue[]>('/api/jira/my-issues'),
  getMySubtasks: (params?: { status?: string; search?: string; limit?: number; dueToday?: boolean }) =>
    api.get<JiraAssignedSubtask[]>('/api/jira/my-subtasks', { params }),
  getRecentWorklogs: () => api.get<JiraWorklogItem[]>('/api/jira/worklogs/recent'),
  getWeeklyWorklogs: (params?: { startDate?: string; endDate?: string }) =>
    api.get<WeeklyCalendarResponse>('/api/jira/worklogs/week', { params }),
  getActivityStream: (params?: { startDate?: string; endDate?: string; author?: string; project?: string; q?: string; maxResults?: number }) =>
    api.get<ActivityStreamResponse>('/api/jira/activity-stream', { params }),
  search: (queryOrJql: string | { q?: string; jql?: string; status?: string; assignee?: string; issueType?: string; project?: string; startAt?: number; maxResults?: number }) => {
    if (typeof queryOrJql === 'string') {
      return api.get<any>('/api/jira/search', { params: { jql: queryOrJql } });
    }
    return api.get<{ startAt: number; maxResults: number; total: number; issues: JiraIssue[] }>('/api/jira/search', { params: queryOrJql });
  },
};

export const filesApi = {
  uploadImage: (formData: FormData) =>
    api.post<{ id: number; url: string; originalName?: string; storedName?: string; sizeBytes?: number }>('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getScreenImages: (screenId: number) =>
    api.get<ScreenImage[]>(`/api/files/screen/${screenId}`),
  linkImagesToScreen: (screenId: number, imageIds?: number[], storedNames?: string[]) =>
    api.post<{ success: boolean }>('/api/files/link-screen', { screenId, imageIds, storedNames }),
  deleteImage: (id: number) => api.delete(`/api/files/${id}`),
  deleteImageByName: (storedName: string) => api.delete(`/api/files/by-name/${encodeURIComponent(storedName)}`),
};

export const bugsApi = {
  getAll: (params?: { search?: string; status?: string; type?: string; severity?: string; has_annotations?: string }) =>
    api.get<BugListResponse>('/api/bugs', { params }),
  getById: (id: number) => api.get<BugItem>(`/api/bugs/${id}`),
  create: (data: Partial<BugItem>) => api.post<BugItem>('/api/bugs', data),
  update: (id: number, data: Partial<BugItem>) => api.put<BugItem>(`/api/bugs/${id}`, data),
  updateStatus: (id: number, status: string, fix_solution?: string) =>
    api.patch<BugItem>(`/api/bugs/${id}/status`, { status, fix_solution }),
  delete: (id: number) => api.delete<{ success: boolean; id: number }>(`/api/bugs/${id}`),
  upload: (formData: FormData) =>
    api.post<BugAttachment>('/api/bugs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const bugAnnotationsApi = {
  getAll: (bugId: number) => 
    api.get<Record<string, BugImageAnnotationRecord>>(`/api/bugs/${bugId}/annotations`),
  getByImage: (bugId: number, imageId: string) => 
    api.get<BugImageAnnotationRecord>(`/api/bugs/${bugId}/annotations/${imageId}`),
  save: (bugId: number, imageId: string, payload: { annotations: AnnotationItem[]; version?: number; force?: boolean }) => 
    api.put<BugImageAnnotationRecord>(`/api/bugs/${bugId}/annotations/${imageId}`, payload),
  delete: (bugId: number, imageId: string) => 
    api.delete<{ success: boolean; bug_id: number; image_id: string }>(`/api/bugs/${bugId}/annotations/${imageId}`),
};

export const settingsApi = {
  getAll: () => api.get<Record<string, Record<string, string>>>('/api/settings'),
  update: (items: Array<{ key: string; value: string; category?: string }>) => api.put('/api/settings', items),
  testJira: (data: { baseUrl: string; email: string; apiToken: string }) => api.post<{ success: boolean; message: string }>('/api/settings/jira/test', data),
  getStorageStats: () => api.get<StorageStats>('/api/settings/storage'),
};

export const authApi = {
  login: (password: string) => api.post<{ success: boolean; token: string }>('/api/auth/login', { password }),
  getMe: () => api.get('/api/auth/me'),
};

export const stickyNotesApi = {
  getAll: (params?: { search?: string; color?: string; sortBy?: string; sortOrder?: string }) =>
    api.get<StickyNoteListResponse>('/api/sticky-notes', { params }),
  getTrash: (params?: { search?: string }) =>
    api.get<StickyNoteListResponse>('/api/sticky-notes/trash', { params }),
  getById: (id: string, trash = false) =>
    api.get<StickyNote>(`/api/sticky-notes/${id}`, { params: trash ? { trash: true } : undefined }),
  create: (data: StickyNoteCreatePayload) =>
    api.post<StickyNote>('/api/sticky-notes', data),
  update: (id: string, data: StickyNoteUpdatePayload) =>
    api.put<StickyNote>(`/api/sticky-notes/${id}`, data),
  duplicate: (id: string) =>
    api.post<StickyNote>(`/api/sticky-notes/${id}/duplicate`),
  moveToTrash: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/api/sticky-notes/${id}/trash`),
  restoreFromTrash: (id: string) =>
    api.post<StickyNote>(`/api/sticky-notes/${id}/restore`),
  permanentlyDelete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/sticky-notes/${id}/permanent`),
  emptyTrash: () =>
    api.delete<{ message: string; deletedCount: number }>('/api/sticky-notes/trash'),
  importNote: (fileOrData: FormData | { rawText: string; filename?: string }) => {
    if (fileOrData instanceof FormData) {
      return api.post<StickyNote>('/api/sticky-notes/import', fileOrData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post<StickyNote>('/api/sticky-notes/import', fileOrData);
  },
  getExportUrl: (id: string, raw = false) =>
    resolveApiUrl(`/api/sticky-notes/${id}/export${raw ? '?raw=true' : ''}`)
};

export const apiDocsApi = {
  getEndpoints: (params?: { moduleId?: number | string; folder?: string; version?: string; method?: string; status?: string; tag?: string; q?: string }) =>
    api.get<ApiEndpoint[]>('/api/api-docs/endpoints', { params }),
  getEndpoint: (id: number) =>
    api.get<ApiEndpoint>(`/api/api-docs/endpoints/${id}`),
  createEndpoint: (data: Partial<ApiEndpoint>) =>
    api.post<ApiEndpoint>('/api/api-docs/endpoints', data),
  updateEndpoint: (id: number, data: Partial<ApiEndpoint>) =>
    api.put<ApiEndpoint>(`/api/api-docs/endpoints/${id}`, data),
  deleteEndpoint: (id: number) =>
    api.delete<{ message: string }>(`/api/api-docs/endpoints/${id}`),
  duplicateEndpoint: (id: number) =>
    api.post<ApiEndpoint>(`/api/api-docs/endpoints/${id}/duplicate`),
  togglePinEndpoint: (id: number) =>
    api.patch<{ id: number; is_pinned: boolean }>(`/api/api-docs/endpoints/${id}/pin`),
  reorderEndpoints: (items: Array<{ id: number; folder?: string; sort_order: number }>) =>
    api.post<{ success: boolean; count: number }>('/api/api-docs/endpoints/reorder', { items }),
  getFolders: (moduleId?: number | string) =>
    api.get<string[]>('/api/api-docs/folders', { params: { moduleId } }),

  // Models / Schemas
  getModels: (moduleId?: number | string) =>
    api.get<ApiModel[]>('/api/api-docs/models', { params: { moduleId } }),
  createModel: (data: Partial<ApiModel>) =>
    api.post<ApiModel>('/api/api-docs/models', data),
  updateModel: (id: number, data: Partial<ApiModel>) =>
    api.put<ApiModel>(`/api/api-docs/models/${id}`, data),
  deleteModel: (id: number) =>
    api.delete<{ message: string; referencesCount: number; referencingEndpoints: any[] }>(`/api/api-docs/models/${id}`),

  // Error Codes
  getErrorCodes: (params?: { moduleId?: number | string; category?: string; httpStatus?: number; q?: string }) =>
    api.get<ApiErrorCode[]>('/api/api-docs/error-codes', { params }),
  createErrorCode: (data: Partial<ApiErrorCode>) =>
    api.post<ApiErrorCode>('/api/api-docs/error-codes', data),
  updateErrorCode: (id: number, data: Partial<ApiErrorCode>) =>
    api.put<ApiErrorCode>(`/api/api-docs/error-codes/${id}`, data),
  deleteErrorCode: (id: number) =>
    api.delete<{ message: string }>(`/api/api-docs/error-codes/${id}`),

  // Environments
  getEnvironments: (moduleId?: number | string) =>
    api.get<ApiEnvironment[]>('/api/api-docs/environments', { params: { moduleId } }),
  saveEnvironments: (moduleId: number | string, environments: ApiEnvironment[]) =>
    api.put<ApiEnvironment[]>('/api/api-docs/environments', { moduleId, environments }),

  // Import
  importCurl: (data: { curl: string; moduleId: number; folder?: string }) =>
    api.post<{ message: string; endpoint: ApiEndpoint }>('/api/api-docs/import/curl', data),
  importOpenApi: (data: { spec: any; moduleId: number; defaultFolder?: string; conflictStrategy?: 'skip' | 'overwrite' | 'keep_both' }) =>
    api.post<{ success: boolean; importedEndpoints: number; importedModels: number; message: string }>('/api/api-docs/import/openapi', data),
  importPostman: (data: { collection: any; moduleId: number; conflictStrategy?: 'skip' | 'overwrite' | 'keep_both' }) =>
    api.post<{ success: boolean; importedEndpoints: number; message: string }>('/api/api-docs/import/postman', data),

  // Export URLs
  getExportOpenApiUrl: (moduleId: number, version = 'v1') =>
    resolveApiUrl(`/api/api-docs/export/openapi?moduleId=${moduleId}&version=${version}`),
  getExportMarkdownUrl: (moduleId: number, endpointId?: number) =>
    resolveApiUrl(`/api/api-docs/export/markdown?moduleId=${moduleId}${endpointId ? `&endpointId=${endpointId}` : ''}`),

  // Postman Runner Proxy & Example Sync
  proxyTest: (data: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
  }) =>
    api.post<{
      success: boolean;
      status: number;
      statusText: string;
      durationMs: number;
      sizeBytes: number;
      headers: Record<string, string>;
      body: any;
      rawBody: string;
      isJson: boolean;
    }>('/api/api-docs/proxy-test', data),

  saveResponseAsExample: (endpointId: number, data: {
    statusCode: number;
    description?: string;
    name?: string;
    body: any;
  }) =>
    api.post<{ success: boolean; message: string; responses: any[] }>(`/api/api-docs/endpoints/${endpointId}/save-response-example`, data),
};

export default api;
