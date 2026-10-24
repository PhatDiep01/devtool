import axios from 'axios';
import type { 
  Module, 
  Screen, 
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
  BugItem,
  BugListResponse,
  BugAttachment,
  StickyNote,
  StickyNoteListResponse,
  StickyNoteCreatePayload,
  StickyNoteUpdatePayload
} from '@/types';

// Helper to retrieve the current active API base URL (supports build-time ENV and dynamic runtime LocalStorage override)
export const getActiveApiUrl = (): string => {
  try {
    const localOverride = localStorage.getItem('custom_api_url');
    if (localOverride && localOverride.trim()) {
      return localOverride.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    // ignore
  }
  // @ts-ignore
  return (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
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
  (response) => response,
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
  }) => api.post<Screen>('/api/docs/screens', data),
  importScreen: (formData: FormData) =>
    api.post<Screen>('/api/docs/screens/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateScreen: (id: number, data: Partial<Screen> & { moduleId?: number }) => 
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
  getStatus: () => api.get<any>('/api/jira/status'),
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
  getTransitions: (issueKey: string) => api.get<any[]>(`/api/jira/issues/${issueKey}/transitions`),
  transitionIssue: (issueKey: string, transitionId: string) =>
    api.post(`/api/jira/issues/${issueKey}/transitions`, { transitionId }),
  addComment: (issueKey: string, body: string) =>
    api.post(`/api/jira/issues/${issueKey}/comment`, { body }),
  getWorklogs: (issueKey: string) =>
    api.get<{ total: number; worklogs: any[] }>(`/api/jira/issues/${issueKey}/worklog`),
  createWorklog: (issueKey: string, data: JiraCreateWorklogPayload) =>
    api.post(`/api/jira/issues/${issueKey}/worklog`, data),
  getMyIssues: () => api.get<JiraIssue[]>('/api/jira/my-issues'),
  getMySubtasks: (params?: { status?: string; search?: string; limit?: number }) =>
    api.get<JiraAssignedSubtask[]>('/api/jira/my-subtasks', { params }),
  getRecentWorklogs: () => api.get<JiraWorklogItem[]>('/api/jira/worklogs/recent'),
  getWeeklyWorklogs: (params?: { startDate?: string; endDate?: string }) =>
    api.get<WeeklyCalendarResponse>('/api/jira/worklogs/week', { params }),
  search: (queryOrJql: string | { q?: string; jql?: string; status?: string; assignee?: string; issueType?: string; project?: string; startAt?: number; maxResults?: number }) => {
    if (typeof queryOrJql === 'string') {
      return api.get<any>('/api/jira/search', { params: { jql: queryOrJql } });
    }
    return api.get<{ startAt: number; maxResults: number; total: number; issues: JiraIssue[] }>('/api/jira/search', { params: queryOrJql });
  },
};

export const filesApi = {
  uploadImage: (formData: FormData) =>
    api.post<{ id: number; url: string }>('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (id: number) => api.delete(`/api/files/${id}`),
};

export const bugsApi = {
  getAll: (params?: { search?: string; status?: string; type?: string; severity?: string }) =>
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

export default api;
