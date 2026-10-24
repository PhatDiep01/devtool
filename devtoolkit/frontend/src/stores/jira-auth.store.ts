import { create } from 'zustand';
import { jiraAuthApi } from '../services/api';
import type { JiraUser, JiraConfigInfo, JiraLoginParams } from '../types';

interface JiraAuthState {
  token: string | null;
  user: JiraUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  configInfo: JiraConfigInfo | null;
  fetchConfigInfo: () => Promise<void>;
  login: (params: JiraLoginParams) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  clearError: () => void;
}

const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem('jira_session_token') || sessionStorage.getItem('jira_session_token');
  } catch {
    return null;
  }
};

const getStoredUser = (): JiraUser | null => {
  try {
    const raw = localStorage.getItem('jira_user') || sessionStorage.getItem('jira_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useJiraAuthStore = create<JiraAuthState>((set, get) => {
  // Listen for invalid auth event from api interceptor
  if (typeof window !== 'undefined') {
    window.addEventListener('jira-auth-invalid', () => {
      set({ token: null, user: null, isAuthenticated: false });
    });
  }

  const initialToken = getStoredToken();
  const initialUser = getStoredUser();

  return {
    token: initialToken,
    user: initialUser,
    isAuthenticated: Boolean(initialToken),
    isLoading: false,
    error: null,
    configInfo: null,

    clearError: () => set({ error: null }),

    fetchConfigInfo: async () => {
      try {
        const res = await jiraAuthApi.getConfigInfo();
        set({ configInfo: res.data });
      } catch (err) {
        console.warn('Failed to load workspace Jira config info:', err);
      }
    },

    login: async (params: JiraLoginParams) => {
      set({ isLoading: true, error: null });
      try {
        const res = await jiraAuthApi.login(params);
        if (res.data.success && res.data.token) {
          const { token, user } = res.data;
          const isRemember = params.rememberMe ?? false;
          try {
            if (isRemember) {
              localStorage.setItem('jira_session_token', token);
              localStorage.setItem('jira_user', JSON.stringify(user));
              sessionStorage.removeItem('jira_session_token');
              sessionStorage.removeItem('jira_user');
            } else {
              sessionStorage.setItem('jira_session_token', token);
              sessionStorage.setItem('jira_user', JSON.stringify(user));
              localStorage.removeItem('jira_session_token');
              localStorage.removeItem('jira_user');
            }
          } catch (e) {
            console.warn('Failed to persist Jira session:', e);
          }

          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          // Refresh config info so UI reflects new saved status
          try {
            const cfg = await jiraAuthApi.getConfigInfo();
            set({ configInfo: cfg.data });
          } catch {}

          return true;
        } else {
          set({
            isLoading: false,
            error: res.data.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại token.'
          });
          return false;
        }
      } catch (err: any) {
        const message = err.response?.data?.message || err.message || 'Lỗi kết nối đến máy chủ Jira';
        set({
          isLoading: false,
          error: message
        });
        return false;
      }
    },

    logout: async () => {
      try {
        await jiraAuthApi.logout();
      } catch {
        // Silently proceed with local cleanup
      }
      try {
        localStorage.removeItem('jira_session_token');
        localStorage.removeItem('jira_user');
        sessionStorage.removeItem('jira_session_token');
        sessionStorage.removeItem('jira_user');
      } catch {
        // Ignore storage errors
      }
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        error: null
      });

      // Refresh config info after logout so UI knows token in SQL is cleared
      try {
        const cfg = await jiraAuthApi.getConfigInfo();
        set({ configInfo: cfg.data });
      } catch {}
    },

    checkSession: async () => {
      const { token } = get();
      if (!token) {
        set({ isAuthenticated: false, user: null });
        return false;
      }

      try {
        const res = await jiraAuthApi.getSession();
        if (res.data.authenticated && res.data.user) {
          set({
            isAuthenticated: true,
            user: res.data.user
          });
          try {
            if (localStorage.getItem('jira_session_token')) {
              localStorage.setItem('jira_user', JSON.stringify(res.data.user));
            } else if (sessionStorage.getItem('jira_session_token')) {
              sessionStorage.setItem('jira_user', JSON.stringify(res.data.user));
            }
          } catch {}
          return true;
        } else {
          set({ token: null, user: null, isAuthenticated: false });
          localStorage.removeItem('jira_session_token');
          localStorage.removeItem('jira_user');
          sessionStorage.removeItem('jira_session_token');
          sessionStorage.removeItem('jira_user');
          return false;
        }
      } catch {
        // If network or server error, retain local state or flag
        return get().isAuthenticated;
      }
    }
  };
});
