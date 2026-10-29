import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  CheckSquare, 
  Settings, 
  ArrowRight, 
  CornerDownLeft, 
  X, 
  AlignLeft, 
  ArrowLeftRight, 
  StickyNote,
  Bug,
  GitBranch,
  Clock,
  Layers,
  FolderKanban,
  Upload,
  LayoutDashboard,
  Activity,
  Lock,
  ExternalLink,
  Tag,
  ShieldCheck,
  Code2
} from 'lucide-react';
import { docsApi, bugsApi, stickyNotesApi, jiraApi } from '../../services/api';
import { useJiraAuthStore } from '../../stores/jira-auth.store';

export type SearchScope = 
  | 'all'
  | 'screens'
  | 'docs'
  | 'bugs'
  | 'notes'
  | 'jira_tasks'
  | 'jira_subtasks'
  | 'jira_worklogs';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppScreenItem {
  id: string;
  title: string;
  desc: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  category: string;
  keywords: string[];
}

// 1. Comprehensive Website Screens list for search and quick navigation
const APP_SCREENS: AppScreenItem[] = [
  {
    id: 'docs-dashboard',
    title: 'Tổng quan màn hình đặc tả',
    desc: 'Tất cả module, kiến trúc và màn hình bàn giao nghiệp vụ',
    path: '/docs',
    icon: LayoutDashboard,
    badge: 'Docs',
    category: 'Màn hình mô tả task',
    keywords: ['docs', 'tai lieu', 'dac ta', 'man hinh', 'tong quan', 'module', 'architecture', 'mo ta']
  },
  {
    id: 'docs-api',
    title: 'Tài liệu API (REST)',
    desc: 'Quản lý endpoints, mẫu request/response, schemas DTOs và bảng mã lỗi',
    path: '/docs/api',
    icon: Code2,
    badge: 'REST',
    category: 'Màn hình mô tả task',
    keywords: ['api', 'endpoint', 'rest', 'swagger', 'openapi', 'ma loi', 'request', 'response', 'curl', 'tai lieu api']
  },
  {
    id: 'docs-import',
    title: 'Nhập đặc tả (.md)',
    desc: 'Nhập và cập nhật tài liệu từ file markdown',
    path: '/docs/import',
    icon: Upload,
    badge: 'Docs',
    category: 'Màn hình mô tả task',
    keywords: ['import', 'nhap', 'markdown', 'md', 'upload', 'file', 'tai lieu']
  },
  {
    id: 'docs-bugs',
    title: 'Quản lý Bug (Bug Tracker)',
    desc: 'Báo cáo, theo dõi bug FE/BE, đánh dấu ảnh và đính kèm tài liệu',
    path: '/docs/bugs',
    icon: Bug,
    badge: 'Tracker',
    category: 'Quản lý Bug',
    keywords: ['bug', 'loi', 'tracker', 'quan ly bug', 'danh dau anh', 'fix', 'screenshot', 'bao cao bug']
  },
  {
    id: 'jira-board',
    title: 'Kanban Board Jira',
    desc: 'Bảng kéo thả trực quan theo dõi tiến độ công việc và sprint',
    path: '/jira',
    icon: Layers,
    badge: 'Jira',
    category: 'Quản lý Jira',
    keywords: ['jira', 'kanban', 'board', 'bang', 'keo tha', 'trang thai', 'tien do']
  },
  {
    id: 'jira-sprints',
    title: 'Sprint Hub',
    desc: 'Quản lý User Stories (US), danh sách Sprint và backlog',
    path: '/jira/sprints',
    icon: FolderKanban,
    badge: 'Jira',
    category: 'Quản lý Jira',
    keywords: ['sprint', 'hub', 'us', 'user story', 'backlog', 'chu ky']
  },
  {
    id: 'jira-tasks',
    title: 'Tra cứu công việc Jira',
    desc: 'Tra cứu, lọc JQL theo dự án, assignee và tạo task / subtask mới',
    path: '/jira/tasks',
    icon: Search,
    badge: 'Jira',
    category: 'Quản lý Jira',
    keywords: ['task', 'cong viec', 'tim kiem task', 'tao task', 'jql', 'tra cuu', 'subtask']
  },
  {
    id: 'jira-logwork',
    title: 'Chấm công Log Work',
    desc: 'Ghi nhận giờ làm việc, lịch tuần 7 ngày và gợi ý description',
    path: '/jira/logwork',
    icon: Clock,
    badge: 'Jira',
    category: 'Quản lý Jira',
    keywords: ['logwork', 'log work', 'cham cong', 'gio lam viec', 'timesheet', 'description', 'be', 'fe', 'ba']
  },
  {
    id: 'jira-activity-stream',
    title: 'Activity Stream Jira',
    desc: 'Nhật ký log work toàn bộ nhân sự dự án theo ngày và thời gian',
    path: '/jira/activity-stream',
    icon: Activity,
    badge: 'Jira',
    category: 'Quản lý Jira',
    keywords: ['activity', 'stream', 'nhan su', 'nhat ky', 'tong hop', 'nhan vien']
  },
  {
    id: 'tool-crypto-identity',
    title: 'Mã hóa & Định danh (Crypto & Identity)',
    desc: 'Bộ 6 công cụ Base64, URL Encode, JWT Decoder, Hash & HMAC, GUID và Mật khẩu client-side',
    path: '/tools/crypto-identity',
    icon: ShieldCheck,
    badge: 'Tiện ích',
    category: 'Tiện ích',
    keywords: ['ma hoa', 'dinh danh', 'crypto', 'base64', 'url', 'jwt', 'hash', 'guid', 'uuid', 'password', 'mat khau', 'md5', 'sha256', 'token']
  },
  {
    id: 'tool-sticky-notes',
    title: 'Sticky Notes (Ghi chú)',
    desc: 'Ghi chú nhanh định dạng .txt lưu trữ an toàn trên máy',
    path: '/tools/sticky-notes',
    icon: StickyNote,
    badge: 'Tiện ích',
    category: 'Ghi chú Note',
    keywords: ['note', 'sticky', 'ghi chu', 'txt', 'nhac viec', 'so tay']
  },
  {
    id: 'tool-compare-text',
    title: 'So sánh văn bản (Text Diff)',
    desc: 'Diff dòng, từ, ký tự và kiểm tra thay đổi văn bản trực tuyến',
    path: '/tools/compare-text',
    icon: ArrowLeftRight,
    badge: 'Tiện ích',
    category: 'Tiện ích',
    keywords: ['diff', 'so sanh', 'compare', 'van ban', 'text', 'code']
  },
  {
    id: 'tool-text-formatter',
    title: 'Định dạng văn bản (Text Formatter)',
    desc: 'Chuyển đổi hoa thường, xóa khoảng trắng thừa và regex',
    path: '/tools/text-formatter',
    icon: AlignLeft,
    badge: 'Tiện ích',
    category: 'Tiện ích',
    keywords: ['format', 'dinh dang', 'hoa thuong', 'clean text', 'regex']
  },
  {
    id: 'settings',
    title: 'Cài đặt hệ thống',
    desc: 'Cấu hình Jira, API Cloudflare Tunnel và theo dõi dung lượng',
    path: '/settings',
    icon: Settings,
    badge: 'Hệ thống',
    category: 'Hệ thống',
    keywords: ['setting', 'cai dat', 'config', 'token', 'dung luong', 'storage', 'tunnel']
  }
];

export interface SearchResultItem {
  id: string;
  scope: SearchScope;
  scopeLabel: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { isAuthenticated: isJiraAuthenticated } = useJiraAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // If Jira session expires or user logs out while scope is jira-specific, reset to 'all'
  useEffect(() => {
    if (!isJiraAuthenticated && (scope === 'jira_tasks' || scope === 'jira_subtasks' || scope === 'jira_worklogs')) {
      setScope('all');
    }
  }, [isJiraAuthenticated, scope]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          results[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  // Main search effect
  useEffect(() => {
    if (!isOpen) return;

    const trimmedQuery = query.trim().toLowerCase();

    // 1. EMPTY QUERY: Render quick suggestions and recent items
    if (!trimmedQuery) {
      loadEmptyStateResults(scope);
      return;
    }

    // 2. HAS QUERY: Debounce search across scopes
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const collected: SearchResultItem[] = [];

        // --- A. Website Screens (Local instant match) ---
        if (scope === 'all' || scope === 'screens') {
          const matchedScreens = APP_SCREENS.filter(s => 
            s.title.toLowerCase().includes(trimmedQuery) ||
            s.desc.toLowerCase().includes(trimmedQuery) ||
            s.keywords.some(k => k.includes(trimmedQuery))
          );
          matchedScreens.forEach(s => {
            collected.push({
              id: `screen-${s.id}`,
              scope: 'screens',
              scopeLabel: 'Màn hình',
              title: s.title,
              subtitle: s.desc,
              badge: s.badge,
              badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
              icon: s.icon,
              action: () => {
                navigate(s.path);
                onClose();
              }
            });
          });
        }

        // --- B. Handover Docs / Màn hình mô tả task ---
        const shouldSearchDocs = scope === 'all' || scope === 'docs';
        const docsPromise = shouldSearchDocs 
          ? docsApi.search(trimmedQuery).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        // --- C. Bug Tracker ---
        const shouldSearchBugs = scope === 'all' || scope === 'bugs';
        const bugsPromise = shouldSearchBugs 
          ? bugsApi.getAll({ search: trimmedQuery }).catch(() => ({ data: { bugs: [] } }))
          : Promise.resolve({ data: { bugs: [] } });

        // --- D. Sticky Notes ---
        const shouldSearchNotes = scope === 'all' || scope === 'notes';
        const notesPromise = shouldSearchNotes 
          ? stickyNotesApi.getAll({ search: trimmedQuery }).catch(() => ({ data: { notes: [] } }))
          : Promise.resolve({ data: { notes: [] } });

        // --- E. Jira Scopes (Only when Jira authenticated) ---
        const shouldSearchJiraTasks = isJiraAuthenticated && (scope === 'all' || scope === 'jira_tasks');
        const jiraTasksPromise = shouldSearchJiraTasks
          ? jiraApi.search({ q: trimmedQuery, maxResults: scope === 'jira_tasks' ? 20 : 6 }).catch(() => ({ data: { issues: [] } }))
          : Promise.resolve({ data: { issues: [] } });

        const shouldSearchJiraSubtasks = isJiraAuthenticated && (scope === 'all' || scope === 'jira_subtasks');
        const jiraSubtasksPromise = shouldSearchJiraSubtasks
          ? jiraApi.getMySubtasks({ search: trimmedQuery, limit: scope === 'jira_subtasks' ? 20 : 6 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const shouldSearchJiraWorklogs = isJiraAuthenticated && (scope === 'all' || scope === 'jira_worklogs');
        const jiraWorklogsPromise = shouldSearchJiraWorklogs
          ? jiraApi.getActivityStream({ q: trimmedQuery, maxResults: scope === 'jira_worklogs' ? 20 : 6 }).catch(() => ({ data: { worklogs: [] } }))
          : Promise.resolve({ data: { worklogs: [] } });

        // Await all promises in parallel safely
        const [
          docsRes,
          bugsRes,
          notesRes,
          jiraTasksRes,
          jiraSubtasksRes,
          jiraWorklogsRes
        ] = await Promise.all([
          docsPromise,
          bugsPromise,
          notesPromise,
          jiraTasksPromise,
          jiraSubtasksPromise,
          jiraWorklogsPromise
        ]);

        // Process Docs
        if (Array.isArray(docsRes.data)) {
          docsRes.data.forEach((d: any) => {
            collected.push({
              id: `doc-${d.id}`,
              scope: 'docs',
              scopeLabel: 'Mô tả task',
              title: d.title,
              subtitle: `Module: ${d.module_name || 'Chung'} • Tác giả: ${d.author || 'N/A'}`,
              snippet: d.snippet,
              badge: d.module_name,
              badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
              icon: FileText,
              action: () => {
                navigate(`/docs/screen/${d.id}`);
                onClose();
              }
            });
          });
        }

        // Process Bugs
        const rawBugs = bugsRes.data?.bugs || [];
        if (Array.isArray(rawBugs)) {
          rawBugs.slice(0, scope === 'bugs' ? 20 : 6).forEach((b: any) => {
            collected.push({
              id: `bug-${b.id}`,
              scope: 'bugs',
              scopeLabel: 'Quản lý Bug',
              title: b.title,
              subtitle: `[${b.type || 'BUG'}] Trạng thái: ${b.status} • Độ nghiêm trọng: ${b.severity} ${b.us_key ? `• ${b.us_key}` : ''}`,
              badge: b.status,
              badgeColor: b.status === 'resolved' 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
              icon: Bug,
              action: () => {
                navigate(`/docs/bugs?bugId=${b.id}&search=${encodeURIComponent(b.title)}`);
                onClose();
              }
            });
          });
        }

        // Process Sticky Notes
        const rawNotes = notesRes.data?.notes || [];
        if (Array.isArray(rawNotes)) {
          rawNotes.slice(0, scope === 'notes' ? 20 : 6).forEach((n: any) => {
            collected.push({
              id: `note-${n.id}`,
              scope: 'notes',
              scopeLabel: 'Ghi chú Note',
              title: n.title,
              subtitle: n.contentPreview ? n.contentPreview.slice(0, 80) : 'Ghi chú cá nhân',
              badge: 'Note',
              badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
              icon: StickyNote,
              action: () => {
                navigate(`/tools/sticky-notes?noteId=${n.id}`);
                onClose();
              }
            });
          });
        }

        // Process Jira Tasks / US
        const rawJiraTasks = jiraTasksRes.data?.issues || [];
        if (Array.isArray(rawJiraTasks)) {
          rawJiraTasks.forEach((t: any) => {
            const isSubtask = Boolean(t.fields?.issuetype?.subtask);
            if (scope === 'all' && isSubtask) return; // avoid duplicate with subtasks in 'all' view
            collected.push({
              id: `jira-task-${t.key}`,
              scope: 'jira_tasks',
              scopeLabel: t.fields?.issuetype?.name?.toLowerCase().includes('story') ? 'Jira US' : 'Jira Task',
              title: `${t.key}: ${t.fields?.summary || ''}`,
              subtitle: `Loại: ${t.fields?.issuetype?.name || 'Task'} • Trạng thái: ${t.fields?.status?.name || 'Open'} • Phụ trách: ${t.fields?.assignee?.displayName || 'Chưa gán'}`,
              badge: t.key,
              badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
              icon: CheckSquare,
              action: () => {
                navigate(`/jira/tasks?q=${t.key}&issue=${t.key}`);
                onClose();
              }
            });
          });
        }

        // Process Jira Subtasks
        const rawSubtasks = Array.isArray(jiraSubtasksRes.data) ? jiraSubtasksRes.data : [];
        rawSubtasks.forEach((st: any) => {
          collected.push({
            id: `jira-st-${st.key}`,
            scope: 'jira_subtasks',
            scopeLabel: 'SubTask',
            title: `${st.key}: ${st.summary}`,
            subtitle: `${st.parentKey ? `Thuộc US: ${st.parentKey} • ` : ''}Trạng thái: ${st.status?.name || 'Open'}`,
            badge: st.key,
            badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            icon: GitBranch,
            action: () => {
              navigate(`/jira/logwork?issue=${st.key}`);
              onClose();
            }
          });
        });

        // Process Jira Worklogs
        const rawWorklogs = jiraWorklogsRes.data?.worklogs || [];
        if (Array.isArray(rawWorklogs)) {
          rawWorklogs.forEach((w: any) => {
            collected.push({
              id: `jira-wl-${w.worklogId || w.id || Math.random()}`,
              scope: 'jira_worklogs',
              scopeLabel: 'Logwork',
              title: `${w.issueKey}: ${w.issueSummary || 'Log work'}`,
              subtitle: `Thời gian: ${w.timeSpent} • ${w.author?.displayName || ''} • "${w.commentText || 'Không có mô tả'}"`,
              badge: w.timeSpent,
              badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
              icon: Clock,
              action: () => {
                navigate(`/jira/activity-stream?q=${encodeURIComponent(w.issueKey)}`);
                onClose();
              }
            });
          });
        }

        setResults(collected);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Command palette search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, scope, isJiraAuthenticated, isOpen]);

  // Handle empty state (quick suggestions & navigation)
  const loadEmptyStateResults = async (targetScope: SearchScope) => {
    setLoading(true);
    try {
      if (targetScope === 'all' || targetScope === 'screens') {
        // Show all app screens as quick navigation
        const items: SearchResultItem[] = APP_SCREENS.map(s => ({
          id: `screen-${s.id}`,
          scope: 'screens',
          scopeLabel: 'Màn hình',
          title: s.title,
          subtitle: s.desc,
          badge: s.badge,
          badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          icon: s.icon,
          action: () => {
            navigate(s.path);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'docs') {
        const res = await docsApi.search('').catch(() => ({ data: [] }));
        const items: SearchResultItem[] = (res.data || []).slice(0, 10).map((d: any) => ({
          id: `doc-${d.id}`,
          scope: 'docs',
          scopeLabel: 'Mô tả task',
          title: d.title,
          subtitle: `Module: ${d.module_name || 'Chung'} • Tác giả: ${d.author || 'N/A'}`,
          badge: d.module_name,
          badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: FileText,
          action: () => {
            navigate(`/docs/screen/${d.id}`);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'bugs') {
        const res = await bugsApi.getAll({}).catch(() => ({ data: { bugs: [] } }));
        const items: SearchResultItem[] = (res.data?.bugs || []).slice(0, 10).map((b: any) => ({
          id: `bug-${b.id}`,
          scope: 'bugs',
          scopeLabel: 'Quản lý Bug',
          title: b.title,
          subtitle: `[${b.type || 'BUG'}] Trạng thái: ${b.status} • Độ nghiêm trọng: ${b.severity}`,
          badge: b.status,
          badgeColor: b.status === 'resolved' 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          icon: Bug,
          action: () => {
            navigate(`/docs/bugs?bugId=${b.id}`);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'notes') {
        const res = await stickyNotesApi.getAll({}).catch(() => ({ data: { notes: [] } }));
        const items: SearchResultItem[] = (res.data?.notes || []).slice(0, 10).map((n: any) => ({
          id: `note-${n.id}`,
          scope: 'notes',
          scopeLabel: 'Ghi chú Note',
          title: n.title,
          subtitle: n.contentPreview ? n.contentPreview.slice(0, 80) : 'Ghi chú cá nhân',
          badge: 'Note',
          badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: StickyNote,
          action: () => {
            navigate(`/tools/sticky-notes?noteId=${n.id}`);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'jira_subtasks' && isJiraAuthenticated) {
        const res = await jiraApi.getMySubtasks({ limit: 12 }).catch(() => ({ data: [] }));
        const items: SearchResultItem[] = (res.data || []).map((st: any) => ({
          id: `jira-st-${st.key}`,
          scope: 'jira_subtasks',
          scopeLabel: 'SubTask',
          title: `${st.key}: ${st.summary}`,
          subtitle: `${st.parentKey ? `Thuộc US: ${st.parentKey} • ` : ''}Trạng thái: ${st.status?.name || 'Open'}`,
          badge: st.key,
          badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          icon: GitBranch,
          action: () => {
            navigate(`/jira/logwork?issue=${st.key}`);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'jira_worklogs' && isJiraAuthenticated) {
        const res = await jiraApi.getRecentWorklogs().catch(() => ({ data: [] }));
        const items: SearchResultItem[] = (res.data || []).slice(0, 12).map((w: any) => ({
          id: `jira-wl-${w.worklogId || Math.random()}`,
          scope: 'jira_worklogs',
          scopeLabel: 'Logwork',
          title: `${w.issueKey}: ${w.issueSummary || 'Log work'}`,
          subtitle: `Thời gian: ${w.timeSpent} • ${w.author?.displayName || ''} • "${w.commentText || 'Không có mô tả'}"`,
          badge: w.timeSpent,
          badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
          icon: Clock,
          action: () => {
            navigate(`/jira/activity-stream?q=${encodeURIComponent(w.issueKey)}`);
            onClose();
          }
        }));
        setResults(items);
      } else if (targetScope === 'jira_tasks' && isJiraAuthenticated) {
        const res = await jiraApi.getMyIssues().catch(() => ({ data: [] }));
        const items: SearchResultItem[] = (res.data || []).slice(0, 12).map((t: any) => ({
          id: `jira-task-${t.key}`,
          scope: 'jira_tasks',
          scopeLabel: 'Jira Task',
          title: `${t.key}: ${t.fields?.summary || ''}`,
          subtitle: `Loại: ${t.fields?.issuetype?.name || 'Task'} • Trạng thái: ${t.fields?.status?.name || 'Open'}`,
          badge: t.key,
          badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: CheckSquare,
          action: () => {
            navigate(`/jira/tasks?q=${t.key}&issue=${t.key}`);
            onClose();
          }
        }));
        setResults(items);
      }
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Grouped results for clear category presentation
  const groupedResults = useMemo(() => {
    const groups: { label: string; scope: SearchScope; items: SearchResultItem[] }[] = [];
    const map = new Map<string, SearchResultItem[]>();

    results.forEach(item => {
      const key = item.scopeLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    map.forEach((items, label) => {
      groups.push({
        label,
        scope: items[0]?.scope || 'all',
        items
      });
    });

    return groups;
  }, [results]);

  if (!isOpen) return null;

  // Available Scope Pills based on Jira authentication status
  const scopesList: { id: SearchScope; label: string; icon: any }[] = [
    { id: 'all', label: 'Tất cả', icon: Search },
    { id: 'screens', label: 'Màn hình', icon: LayoutDashboard },
    { id: 'docs', label: 'Mô tả task', icon: FileText },
    { id: 'bugs', label: 'Quản lý Bug', icon: Bug },
    { id: 'notes', label: 'Ghi chú', icon: StickyNote },
    ...(isJiraAuthenticated
      ? [
          { id: 'jira_tasks' as SearchScope, label: 'Jira US/Task', icon: CheckSquare },
          { id: 'jira_subtasks' as SearchScope, label: 'SubTask', icon: GitBranch },
          { id: 'jira_worklogs' as SearchScope, label: 'Logwork', icon: Clock }
        ]
      : [])
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-3 sm:pt-16 p-4 animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-3 bg-muted/20">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              scope === 'all'
                ? isJiraAuthenticated
                  ? 'Tìm kiếm màn hình, mô tả task, bug, note, US, subtask, logwork...'
                  : 'Tìm kiếm màn hình, mô tả task, quản lý bug, ghi chú note...'
                : `Tìm trong phạm vi ${scopesList.find(s => s.id === scope)?.label || ''}...`
            }
            className="flex-1 bg-transparent border-none text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Xóa từ khóa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded border border-border font-mono">
            ESC
          </kbd>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 sm:hidden text-muted-foreground hover:text-foreground transition"
            aria-label="Đóng cửa sổ tìm kiếm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Filter Pills Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/70 bg-muted/40 overflow-x-auto scrollbar-none text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pl-1 pr-1 shrink-0 flex items-center gap-1">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span>Phạm vi:</span>
          </span>

          {scopesList.map((sc) => {
            const Icon = sc.icon;
            const isActive = scope === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScope(sc.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sc.label}</span>
              </button>
            );
          })}

          {/* Quick Jira login prompt if not authenticated */}
          {!isJiraAuthenticated && (
            <button
              type="button"
              onClick={() => {
                navigate('/jira');
                onClose();
              }}
              className="ml-auto px-2 py-1 rounded-lg text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition flex items-center gap-1 shrink-0"
              title="Đăng nhập Jira để mở khóa tìm kiếm nhanh US, SubTask, Logwork"
            >
              <Lock className="w-3 h-3" />
              <span>Đăng nhập Jira (Mở khóa US, SubTask)</span>
            </button>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang tìm kiếm trong kho dữ liệu...</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Không tìm thấy kết quả phù hợp</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Không có dữ liệu khớp với từ khóa "{query}" trong phạm vi đã chọn. Hãy thử đổi từ khóa hoặc mở rộng sang "Tất cả".
              </p>
            </div>
          )}

          {/* Category Grouped Results */}
          {!loading && groupedResults.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>{group.label}</span>
                <span className="text-[10px] font-normal lowercase bg-muted px-1.5 py-0.5 rounded">
                  {group.items.length} kết quả
                </span>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const globalIdx = results.findIndex(r => r.id === item.id);
                  const isSelected = selectedIndex === globalIdx;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex items-start justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-colors group ${
                        isSelected 
                          ? 'bg-primary/10 border border-primary/25 text-primary' 
                          : 'hover:bg-accent/70 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground group-hover:text-foreground'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono font-medium ${item.badgeColor || 'bg-muted text-muted-foreground border-border'}`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          )}
                          {item.snippet && (
                            <div 
                              className="text-[11px] text-muted-foreground mt-1 line-clamp-1 bg-muted/40 px-2 py-1 rounded border border-border/40 font-mono"
                              dangerouslySetInnerHTML={{ __html: item.snippet }}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2 mt-1">
                        <ArrowRight className={`w-4 h-4 transition-colors ${
                          isSelected ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-primary'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Di chuyển: <b>↑</b> <b>↓</b></span>
            <span>Mở: <kbd className="px-1 py-0.2 bg-accent rounded border font-mono">↵ Enter</kbd></span>
            <span>Đóng: <kbd className="px-1 py-0.2 bg-accent rounded border font-mono">Esc</kbd></span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Phạm vi: {scopesList.find(s => s.id === scope)?.label || 'Tất cả'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
