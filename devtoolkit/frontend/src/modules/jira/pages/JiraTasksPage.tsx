import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  RefreshCw, 
  Clock, 
  Layers, 
  GitBranch, 
  User, 
  Tag, 
  ExternalLink, 
  ArrowLeft, 
  ArrowRight,
  Code,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw
} from 'lucide-react';
import { jiraApi, getJiraProxyImageUrl } from '../../../services/api';
import { JiraIssue, JiraIssueType, JiraAssignableUser } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { LogWorkModal } from '../components/LogWorkModal';
import { IssueTypeIcon } from '../components/IssueTypeIcon';
import { JiraAvatar } from '../components/JiraAvatar';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

// Helper to determine if an issue is a Sub-task
export const isJiraSubtask = (issue: JiraIssue): boolean => {
  return Boolean(
    issue.fields.issuetype?.subtask ||
    issue.fields.parent ||
    (issue.fields.issuetype?.name && /sub[-\s]?task/i.test(issue.fields.issuetype.name))
  );
};

// Workflow stage ranking (10: To Do -> 20: Analysis -> 30: In Progress -> 40: Review -> 50: QA -> 60: Deploy -> 70: Resolved -> 80: Done)
export const getStatusWorkflowRank = (statusName?: string, statusCategoryKey?: string): number => {
  const name = (statusName || '').trim().toLowerCase();
  const cat = (statusCategoryKey || '').trim().toLowerCase();

  // 1. To Do / Open / Backlog / New / Reopened
  if (
    name.includes('to do') ||
    name === 'open' ||
    name.includes('backlog') ||
    name === 'new' ||
    name.includes('reopen') ||
    name.includes('ready for dev') ||
    name.includes('selected') ||
    name.includes('chờ làm') ||
    name.includes('mới') ||
    name.includes('tiếp nhận')
  ) {
    return 10;
  }

  // 2. Analysis / Spec / Requirements / Planning
  if (
    name.includes('analysis') ||
    name.includes('spec') ||
    name.includes('plan') ||
    name.includes('requirement') ||
    name.includes('phân tích') ||
    name.includes('đặc tả')
  ) {
    return 20;
  }

  // 3. In Progress / Developing / Coding
  if (
    name.includes('in progress') ||
    name.includes('inprogress') ||
    name.includes('developing') ||
    name.includes('development') ||
    name.includes('coding') ||
    name.includes('backend') ||
    name.includes('frontend') ||
    name.includes('đang làm') ||
    name.includes('đang thực hiện') ||
    name.includes('tiến hành')
  ) {
    return 30;
  }

  // 4. Code Review / Review / CR / PR
  if (
    name.includes('review') ||
    name.includes('cr') ||
    name.includes('pull request') ||
    name.includes('pr') ||
    name.includes('đang duyệt') ||
    name.includes('chờ duyệt')
  ) {
    return 40;
  }

  // 5. Testing / QA / QC / In QA / Ready for QA
  if (
    name.includes('test') ||
    name.includes('qa') ||
    name.includes('qc') ||
    name.includes('uat') ||
    name.includes('verif') ||
    name.includes('kiểm thử') ||
    name.includes('chờ kiểm thử')
  ) {
    return 50;
  }

  // 6. Deploy / Staging / Ready for Release
  if (
    name.includes('deploy') ||
    name.includes('staging') ||
    name.includes('release') ||
    name.includes('triển khai')
  ) {
    return 60;
  }

  // 7. Resolved / Đã giải quyết
  if (name.includes('resolved') || name.includes('đã giải quyết') || name.includes('đã sửa')) {
    return 70;
  }

  // 8. Done / Closed / Completed
  if (
    name.includes('done') ||
    name.includes('closed') ||
    name.includes('complete') ||
    name.includes('hoàn thành') ||
    name.includes('đóng') ||
    cat === 'done'
  ) {
    return 80;
  }

  // Fallback by Jira status category
  if (cat === 'new' || cat === 'to_do' || cat === 'todo') return 15;
  if (cat === 'indeterminate' || cat === 'in_progress') return 35;
  if (cat === 'done') return 85;

  return 35;
};

// Workflow status badge colors
export const getWorkflowStatusBadgeClass = (statusName?: string, statusCategoryKey?: string): string => {
  const rank = getStatusWorkflowRank(statusName, statusCategoryKey);

  // To Do / Open
  if (rank <= 15) {
    return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25';
  }
  // Analysis / Spec
  if (rank <= 25) {
    return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25';
  }
  // In Progress / Coding
  if (rank <= 35) {
    return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25';
  }
  // Review / CR
  if (rank <= 45) {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25';
  }
  // Testing / QA
  if (rank <= 55) {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25';
  }
  // Staging / Deploy
  if (rank <= 65) {
    return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25';
  }
  // Resolved / Done / Closed
  return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25';
};

const getPriorityRank = (priorityName?: string): number => {
  const p = (priorityName || '').toLowerCase();
  if (p.includes('highest') || p.includes('blocker')) return 1;
  if (p.includes('high') || p.includes('critical')) return 2;
  if (p.includes('medium') || p.includes('major')) return 3;
  if (p.includes('low') || p.includes('minor')) return 4;
  if (p.includes('lowest') || p.includes('trivial')) return 5;
  return 3;
};

export type TaskSortField = 
  | 'workflow' 
  | 'type' 
  | 'key' 
  | 'summary' 
  | 'status' 
  | 'priority' 
  | 'assignee' 
  | 'points' 
  | 'updated';

const TASK_FILTERS_STORAGE_KEY = 'jira_task_filters';

interface StoredTaskFilters {
  selectedProject: string;
  selectedType: string;
  selectedStatus: string;
  selectedAssignee: string;
  quickFilter: 'all' | 'my' | 'inProgress' | 'story' | 'bug' | 'subtask' | 'done';
}

const loadSavedTaskFilters = (): StoredTaskFilters => {
  try {
    const raw = localStorage.getItem(TASK_FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        selectedProject: typeof parsed.selectedProject === 'string' ? parsed.selectedProject : '',
        selectedType: typeof parsed.selectedType === 'string' ? parsed.selectedType : '',
        selectedStatus: typeof parsed.selectedStatus === 'string' ? parsed.selectedStatus : 'active',
        selectedAssignee: typeof parsed.selectedAssignee === 'string' ? parsed.selectedAssignee : 'currentUser()',
        quickFilter: parsed.quickFilter || 'my'
      };
    }
  } catch (err) {
    console.error('Failed to parse saved Jira task filters from localStorage', err);
  }
  return {
    selectedProject: '',
    selectedType: '',
    selectedStatus: 'active',
    selectedAssignee: 'currentUser()',
    quickFilter: 'my'
  };
};

export const JiraTasksPage: React.FC = () => {
  const savedDefaults = loadSavedTaskFilters();

  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state - Note: keyword search is intentionally NOT persisted to localStorage
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'my' | 'inProgress' | 'story' | 'bug' | 'subtask' | 'done'>(savedDefaults.quickFilter);
  const [projects, setProjects] = useState<{ id: string; key: string; name: string }[]>([]);
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<JiraAssignableUser[]>([]);
  const [selectedProject, setSelectedProject] = useState(savedDefaults.selectedProject);
  const [selectedStatus, setSelectedStatus] = useState(savedDefaults.selectedStatus); // Mặc định 'active' (loại trừ Done để chỉ hiển thị task đang chạy)
  const [selectedType, setSelectedType] = useState(savedDefaults.selectedType);
  const [selectedAssignee, setSelectedAssignee] = useState(savedDefaults.selectedAssignee); // Mặc định 'currentUser()'
  const [useCustomJql, setUseCustomJql] = useState(false);
  const [customJql, setCustomJql] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<TaskSortField>('workflow');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [detailIssueKey, setDetailIssueKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubtaskParentKey, setCreateSubtaskParentKey] = useState<string | undefined>(undefined);
  const [isSubtaskOnlyModal, setIsSubtaskOnlyModal] = useState(false);
  
  const [logWorkKey, setLogWorkKey] = useState<string | null>(null);
  const [logWorkSummary, setLogWorkSummary] = useState<string>('');
  const [searchParams] = useSearchParams();

  // Listen to searchParams (e.g. from global search)
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam) {
      setSearchQuery(qParam);
    }
    const issueParam = searchParams.get('issue');
    if (issueParam) {
      setDetailIssueKey(issueParam);
    }
  }, [searchParams]);

  // Persist non-keyword filters to LocalStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(TASK_FILTERS_STORAGE_KEY, JSON.stringify({
        selectedProject,
        selectedType,
        selectedStatus,
        selectedAssignee,
        quickFilter
      }));
    } catch (e) {
      console.error('Failed to save task filters to localStorage', e);
    }
  }, [selectedProject, selectedType, selectedStatus, selectedAssignee, quickFilter]);

  useEffect(() => {
    jiraApi.getProjects().then(res => setProjects(res.data || [])).catch(() => {});
    jiraApi.getIssueTypes().then(res => setIssueTypes(res.data || [])).catch(() => {});
    jiraApi.getStatuses().then(res => setStatuses(res.data || [])).catch(() => {});
  }, []);

  // Fetch assignable users for selected project (or all assignees)
  useEffect(() => {
    jiraApi.getAssignableUsers(selectedProject ? { project: selectedProject } : undefined)
      .then(res => setAssignees(res.data || []))
      .catch(() => {});
  }, [selectedProject]);

  useEffect(() => {
    executeSearch();
  }, [page, pageSize, quickFilter, selectedProject, selectedStatus, selectedType, selectedAssignee, useCustomJql]);

  const handleResetFilters = () => {
    setSelectedProject('');
    setSelectedStatus('active');
    setSelectedType('');
    setSelectedAssignee('currentUser()');
    setSearchQuery('');
    setQuickFilter('my');
    setPage(0);
    try {
      localStorage.removeItem(TASK_FILTERS_STORAGE_KEY);
    } catch {}
  };

  const executeSearch = async () => {
    setLoading(true);
    try {
      if (useCustomJql) {
        const jql = customJql.trim() || 'ORDER BY updated DESC';
        const res = await jiraApi.search({
          jql,
          startAt: page * pageSize,
          maxResults: pageSize
        });
        setIssues(res.data.issues || []);
        setTotal(res.data.total || 0);
      } else {
        const params: any = {
          startAt: page * pageSize,
          maxResults: pageSize
        };

        if (searchQuery.trim()) {
          params.q = searchQuery.trim();
        }

        if (selectedProject) {
          params.project = selectedProject;
        }

        // Lọc trạng thái (active: đang chạy, done: đã xong, all: tất cả...)
        if (selectedStatus) {
          params.status = selectedStatus;
        }

        // Lọc loại issue (Story, Task, Bug, standard, subtask...)
        if (selectedType) {
          params.issueType = selectedType;
        }

        if (selectedAssignee) {
          params.assignee = selectedAssignee;
        }

        const res = await jiraApi.search(params);
        setIssues(res.data.issues || []);
        setTotal(res.data.total || 0);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (page !== 0) {
      setPage(0);
    } else {
      executeSearch();
    }
  };

  const openCreateSubtask = (parentKey?: string) => {
    setCreateSubtaskParentKey(parentKey || '');
    setIsSubtaskOnlyModal(true);
    setShowCreateModal(true);
  };

  const openCreateStandard = () => {
    setCreateSubtaskParentKey(undefined);
    setIsSubtaskOnlyModal(false);
    setShowCreateModal(true);
  };

  // Memoized options for modern SearchableSelects
  const projectOptions = useMemo<SelectOption<string>[]>(() => [
    { value: '', label: 'Tất cả dự án' },
    ...projects.map((p) => ({
      value: p.key,
      label: p.name,
      sublabel: p.key,
    })),
  ], [projects]);

  const typeOptions = useMemo<SelectOption<string>[]>(() => [
    { value: '', label: 'Tất cả loại (All Types)' },
    { value: 'standard', label: 'Standard Issues (Story, Task, Bug)', group: 'Phân loại cơ bản' },
    { value: 'subtask', label: 'Chỉ Sub-tasks (Tất cả Subtask)', group: 'Phân loại cơ bản' },
    ...(issueTypes.length > 0
      ? issueTypes.map((it) => ({
          value: it.name,
          label: it.name,
          badge: it.subtask ? 'Subtask' : undefined,
          badgeColor: it.subtask ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : undefined,
          group: 'Loại cụ thể',
        }))
      : [
          { value: 'Story', label: 'Story', group: 'Loại cụ thể' },
          { value: 'Task', label: 'Task', group: 'Loại cụ thể' },
          { value: 'Bug', label: 'Bug', group: 'Loại cụ thể' },
          { value: 'Sub-task', label: 'Sub-task', group: 'Loại cụ thể' },
        ]),
  ], [issueTypes]);

  const statusOptions = useMemo<SelectOption<string>[]>(() => [
    { value: 'active', label: '⚡ Đang chạy / Chưa Done (Mặc định)', group: 'Phổ biến' },
    { value: 'in_progress', label: '⏳ Đang thực hiện (In Progress)', group: 'Phổ biến' },
    { value: 'todo', label: '📋 Chờ làm (To Do)', group: 'Phổ biến' },
    { value: 'done', label: '✔️ Đã hoàn thành (Done)', group: 'Phổ biến' },
    { value: 'all', label: '🌐 Tất cả trạng thái (Bao gồm Done)', group: 'Phổ biến' },
    ...statuses.map((s) => ({
      value: s.name,
      label: s.name,
      group: 'Trạng thái chi tiết',
    })),
  ], [statuses]);

  const assigneeOptions = useMemo<SelectOption<string>[]>(() => [
    { value: 'currentUser()', label: '👤 Được giao cho tôi (Assigned to Me)', group: 'Mặc định' },
    { value: '', label: '🌐 Tất cả mọi người (All Assignees)', group: 'Mặc định' },
    { value: 'unassigned', label: '⚪ Chưa phân công (Unassigned)', group: 'Mặc định' },
    ...assignees.map((u) => {
      const userVal = u.name || u.accountId || '';
      return {
        value: userVal,
        label: u.displayName,
        sublabel: u.name && u.name !== u.displayName ? `@${u.name}` : undefined,
        avatarUrl: getJiraProxyImageUrl(u.avatarUrls?.['24x24'] || u.avatarUrls?.['32x32']),
        group: `Thành viên hệ thống (${assignees.length})`,
      };
    }),
  ], [assignees]);

  const handleSortClick = (field: TaskSortField) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const resetToDefaultSort = () => {
    setSortBy('workflow');
    setSortOrder('asc');
  };

  const sortedIssues = useMemo(() => {
    const list = [...issues];

    list.sort((a, b) => {
      // DEFAULT: 'workflow' sort (Subtask first, then Status ordered by workflow, then updated DESC)
      if (sortBy === 'workflow') {
        const aIsSub = isJiraSubtask(a);
        const bIsSub = isJiraSubtask(b);
        if (aIsSub !== bIsSub) {
          return aIsSub ? -1 : 1;
        }

        const aRank = getStatusWorkflowRank(a.fields.status?.name, a.fields.status?.statusCategory?.key);
        const bRank = getStatusWorkflowRank(b.fields.status?.name, b.fields.status?.statusCategory?.key);
        if (aRank !== bRank) {
          return sortOrder === 'asc' ? aRank - bRank : bRank - aRank;
        }

        const aDate = a.fields.updated ? new Date(a.fields.updated).getTime() : 0;
        const bDate = b.fields.updated ? new Date(b.fields.updated).getTime() : 0;
        return bDate - aDate;
      }

      if (sortBy === 'type') {
        const aIsSub = isJiraSubtask(a);
        const bIsSub = isJiraSubtask(b);
        if (aIsSub !== bIsSub) {
          return sortOrder === 'asc' ? (aIsSub ? -1 : 1) : (aIsSub ? 1 : -1);
        }
        const aRank = getStatusWorkflowRank(a.fields.status?.name, a.fields.status?.statusCategory?.key);
        const bRank = getStatusWorkflowRank(b.fields.status?.name, b.fields.status?.statusCategory?.key);
        return aRank - bRank;
      }

      if (sortBy === 'status') {
        const aRank = getStatusWorkflowRank(a.fields.status?.name, a.fields.status?.statusCategory?.key);
        const bRank = getStatusWorkflowRank(b.fields.status?.name, b.fields.status?.statusCategory?.key);
        if (aRank !== bRank) {
          return sortOrder === 'asc' ? aRank - bRank : bRank - aRank;
        }
        const aIsSub = isJiraSubtask(a);
        const bIsSub = isJiraSubtask(b);
        if (aIsSub !== bIsSub) return aIsSub ? -1 : 1;
        return 0;
      }

      if (sortBy === 'key') {
        const cmp = a.key.localeCompare(b.key, undefined, { numeric: true });
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'summary') {
        const aSum = a.fields.summary || '';
        const bSum = b.fields.summary || '';
        const cmp = aSum.localeCompare(bSum, 'vi');
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'priority') {
        const aP = getPriorityRank(a.fields.priority?.name);
        const bP = getPriorityRank(b.fields.priority?.name);
        return sortOrder === 'asc' ? aP - bP : bP - aP;
      }

      if (sortBy === 'assignee') {
        const aName = a.fields.assignee?.displayName || '';
        const bName = b.fields.assignee?.displayName || '';
        const cmp = aName.localeCompare(bName, 'vi');
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'points') {
        const aPts = Number(a.fields.customfield_10016 ?? a.fields.customfield_10026 ?? a.fields.storyPoints ?? 0);
        const bPts = Number(b.fields.customfield_10016 ?? b.fields.customfield_10026 ?? b.fields.storyPoints ?? 0);
        return sortOrder === 'asc' ? aPts - bPts : bPts - aPts;
      }

      if (sortBy === 'updated') {
        const aDate = a.fields.updated ? new Date(a.fields.updated).getTime() : 0;
        const bDate = b.fields.updated ? new Date(b.fields.updated).getTime() : 0;
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return 0;
    });

    return list;
  }, [issues, sortBy, sortOrder]);

  const { subtasks, standardIssues } = useMemo(() => {
    const subs: JiraIssue[] = [];
    const standards: JiraIssue[] = [];
    sortedIssues.forEach(iss => {
      if (isJiraSubtask(iss)) {
        subs.push(iss);
      } else {
        standards.push(iss);
      }
    });
    return { subtasks: subs, standardIssues: standards };
  }, [sortedIssues]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Task Search & Explorer
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent border border-border text-foreground">
                  {total} issues
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Query, filter, create User Stories, manage Sub-tasks, and inspect issue details.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={executeSearch}
              disabled={loading}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh issues"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateSubtask()}
              className="px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition flex items-center gap-1.5"
            >
              <GitBranch className="w-4 h-4" />
              <span>New Sub-task</span>
            </button>

            <button
              type="button"
              onClick={openCreateStandard}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create US / Issue</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Custom JQL Toggle */}
        <div className="mt-6 pt-6 border-t border-border/80 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={useCustomJql ? customJql : searchQuery}
                onChange={(e) => {
                  if (useCustomJql) setCustomJql(e.target.value);
                  else setSearchQuery(e.target.value);
                }}
                placeholder={
                  useCustomJql 
                    ? 'Enter custom JQL e.g. project = SURV AND status = "In Progress" ORDER BY updated DESC'
                    : 'Tìm kiếm theo tên task hoặc issue key (ví dụ: EMSPRO2-101)...'
                }
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-foreground font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setUseCustomJql(!useCustomJql)}
              className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                useCustomJql 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
              title="Toggle Custom JQL Mode"
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">JQL Mode</span>
            </button>
          </form>

          {/* Multi-Filter Dropdown Toolbar (When not in custom JQL) */}
          {!useCustomJql && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {/* Project Filter */}
                {projects.length > 0 && (
                  <div className="w-48 sm:w-56">
                    <SearchableSelect
                      options={projectOptions}
                      value={selectedProject}
                      onChange={(val) => {
                        setSelectedProject(val);
                        setPage(0);
                      }}
                      placeholder="Tất cả dự án"
                      searchPlaceholder="Tìm kiếm dự án..."
                      icon={<Layers className="w-3.5 h-3.5" />}
                      size="sm"
                    />
                  </div>
                )}

                {/* Issue Type Filter */}
                <div className="w-48 sm:w-56">
                  <SearchableSelect
                    options={typeOptions}
                    value={selectedType}
                    onChange={(val) => {
                      setSelectedType(val);
                      setPage(0);
                      if (val === 'Story') setQuickFilter('story');
                      else if (val === 'Bug') setQuickFilter('bug');
                      else if (val === 'subtask') setQuickFilter('subtask');
                      else if (val === '') setQuickFilter('all');
                    }}
                    placeholder="Tất cả loại"
                    searchPlaceholder="Tìm kiếm loại task..."
                    icon={<Tag className="w-3.5 h-3.5 text-blue-500" />}
                    size="sm"
                  />
                </div>

                {/* Status Filter */}
                <div className="w-48 sm:w-60">
                  <SearchableSelect
                    options={statusOptions}
                    value={selectedStatus}
                    onChange={(val) => {
                      setSelectedStatus(val);
                      setPage(0);
                      if (val === 'done') setQuickFilter('done');
                      else if (val === 'in_progress') setQuickFilter('inProgress');
                      else if (val === 'active' && selectedAssignee === 'currentUser()') setQuickFilter('my');
                    }}
                    placeholder="Trạng thái..."
                    searchPlaceholder="Tìm trạng thái..."
                    icon={<Clock className="w-3.5 h-3.5 text-amber-500" />}
                    size="sm"
                  />
                </div>

                {/* Assignee Filter with 100+ system users & search */}
                <div className="w-56 sm:w-64">
                  <SearchableSelect
                    options={assigneeOptions}
                    value={selectedAssignee}
                    onChange={(val) => {
                      setSelectedAssignee(val);
                      setPage(0);
                      if (val === 'currentUser()') setQuickFilter('my');
                      else if (val === '') setQuickFilter('all');
                      else setQuickFilter('all');
                    }}
                    placeholder="Phụ trách..."
                    searchPlaceholder="Tìm theo tên thành viên..."
                    icon={<User className="w-3.5 h-3.5 text-purple-500" />}
                    size="sm"
                  />
                </div>

                {/* Reset Filters */}
                {(selectedProject || selectedStatus !== 'active' || selectedType || selectedAssignee !== 'currentUser()' || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[11px] text-muted-foreground hover:text-primary font-semibold px-2 py-1 underline transition shrink-0"
                  >
                    Reset bộ lọc
                  </button>
                )}
              </div>

              {/* Quick Filter Chips & Status Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground mr-1">Bộ lọc nhanh:</span>
                  {[
                    { id: 'my', label: '👤 Của tôi (Đang chạy)' },
                    { id: 'inProgress', label: '⏳ In Progress' },
                    { id: 'story', label: '📖 User Stories' },
                    { id: 'subtask', label: '🌿 Sub-tasks' },
                    { id: 'bug', label: '🐞 Bugs' },
                    { id: 'done', label: '✔️ Đã Done (Tra cứu)' },
                    { id: 'all', label: '🌐 Tất cả của tôi (Cả Done)' }
                  ].map((chip) => {
                    const isActive = quickFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          setQuickFilter(chip.id as any);
                          setPage(0);
                          if (chip.id === 'my') {
                            setSelectedAssignee('currentUser()');
                            setSelectedStatus('active');
                          } else if (chip.id === 'inProgress') {
                            setSelectedStatus('in_progress');
                          } else if (chip.id === 'story') {
                            setSelectedType('Story');
                          } else if (chip.id === 'subtask') {
                            setSelectedType('subtask');
                          } else if (chip.id === 'bug') {
                            setSelectedType('Bug');
                          } else if (chip.id === 'done') {
                            setSelectedStatus('done');
                          } else if (chip.id === 'all') {
                            setSelectedStatus('all');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                {/* Status & Assignee Indicator Pills */}
                <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap">
                  {selectedAssignee && selectedAssignee !== 'currentUser()' && selectedAssignee !== 'unassigned' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Lọc theo: {assignees.find(u => (u.name || u.accountId) === selectedAssignee)?.displayName || selectedAssignee}
                    </span>
                  )}

                  {selectedStatus === 'done' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đang hiển thị task đã hoàn thành (Done)
                    </span>
                  ) : selectedStatus === 'all' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Tất cả trạng thái (Bao gồm cả Chưa Done & Đã Done)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Chỉ hiển thị task đang chạy (Tự động loại trừ Done)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Issues Table / List */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Table Top Toolbar: Active Sort Indicator & Counts */}
        <div className="px-5 py-3.5 border-b border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <span>Kết quả ({total} công việc):</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
              <GitBranch className="w-3 h-3" />
              {subtasks.length} Sub-tasks
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              <Layers className="w-3 h-3" />
              {standardIssues.length} Tasks / Stories
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Sắp xếp:</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-card border border-border text-foreground font-bold text-[11px] shadow-2xs flex items-center gap-1.5">
              {sortBy === 'workflow' ? (
                <>
                  <span className="text-purple-600 dark:text-purple-400">Sub-task trước</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-blue-600 dark:text-blue-400">Status theo Workflow</span>
                </>
              ) : sortBy === 'type' ? (
                <span>Loại task ({sortOrder === 'asc' ? 'Subtask trước' : 'Standard trước'})</span>
              ) : sortBy === 'status' ? (
                <span>Status ({sortOrder === 'asc' ? 'Workflow xuôi' : 'Workflow ngược'})</span>
              ) : (
                <span className="capitalize">{sortBy} ({sortOrder.toUpperCase()})</span>
              )}
            </span>
            {sortBy !== 'workflow' && (
              <button
                type="button"
                onClick={resetToDefaultSort}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                title="Khôi phục sắp xếp mặc định: Subtask trước → Status theo Workflow"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mặc định</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
            <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span>Retrieving issues from Jira...</span>
          </div>
        ) : issues.length === 0 ? (
          <div className="py-24 text-center text-sm text-muted-foreground space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
            <p className="font-semibold text-foreground">No issues found matching query.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search criteria, clearing filters, or create a new issue.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-xs select-none">
                  <th 
                    className="py-3 px-4 w-16 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('type')}
                    title="Bấm để sắp xếp theo loại (Subtask trước)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Type</span>
                      {sortBy === 'type' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : sortBy === 'workflow' ? (
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold" title="Sub-task ưu tiên 1">1st</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 w-28 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('key')}
                    title="Bấm để sắp xếp theo Issue Key"
                  >
                    <div className="flex items-center gap-1">
                      <span>Key</span>
                      {sortBy === 'key' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 min-w-[280px] cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('summary')}
                    title="Bấm để sắp xếp theo tiêu đề"
                  >
                    <div className="flex items-center gap-1">
                      <span>Summary</span>
                      {sortBy === 'summary' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 w-36 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('status')}
                    title="Bấm để sắp xếp trạng thái theo workflow (To Do → In Progress → Review → Done)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sortBy === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : sortBy === 'workflow' ? (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold" title="Workflow quy trình 2nd">2nd</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 w-28 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('priority')}
                    title="Bấm để sắp xếp theo độ ưu tiên"
                  >
                    <div className="flex items-center gap-1">
                      <span>Priority</span>
                      {sortBy === 'priority' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 w-36 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('assignee')}
                    title="Bấm để sắp xếp theo người phụ trách"
                  >
                    <div className="flex items-center gap-1">
                      <span>Assignee</span>
                      {sortBy === 'assignee' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 w-24 cursor-pointer hover:bg-accent/60 transition group"
                    onClick={() => handleSortClick('points')}
                    title="Bấm để sắp xếp theo Story Points"
                  >
                    <div className="flex items-center gap-1">
                      <span>Points</span>
                      {sortBy === 'points' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortBy === 'workflow' && subtasks.length > 0 && standardIssues.length > 0 ? (
                  <>
                    {/* Sub-tasks Section Header */}
                    <tr className="bg-purple-500/10 border-y border-purple-500/25">
                      <td colSpan={8} className="py-2.5 px-4 text-xs font-bold text-purple-700 dark:text-purple-300">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span>🌿 SUB-TASKS ({subtasks.length})</span>
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground/90">
                            Thứ tự quy trình: To Do → In Progress → Review → Testing → Done
                          </span>
                        </div>
                      </td>
                    </tr>
                    {subtasks.map(issue => {
                      const isSubtask = isJiraSubtask(issue);
                      const statusCat = issue.fields.status?.statusCategory?.key;
                      const badgeClass = getWorkflowStatusBadgeClass(issue.fields.status?.name, statusCat);

                      return (
                        <tr 
                          key={issue.key}
                          className="hover:bg-accent/40 transition group cursor-pointer"
                          onClick={() => setDetailIssueKey(issue.key)}
                        >
                          {/* Type Icon */}
                          <td className="py-3 px-4">
                            <IssueTypeIcon type={issue.fields.issuetype} className="w-4 h-4" />
                          </td>

                          {/* Key with Subtask indicator */}
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="group-hover:text-primary transition">{issue.key}</span>
                              {isSubtask && (
                                <span title="Sub-task" className="inline-flex items-center">
                                  <GitBranch className="w-3 h-3 text-purple-500 shrink-0" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Summary & Parent Breadcrumb */}
                          <td className="py-3 px-4 font-medium text-foreground">
                            <div className="space-y-0.5">
                              {issue.fields.parent && (
                                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                  <span>Parent:</span>
                                  <span className="font-bold text-foreground">{issue.fields.parent.key}</span>
                                </div>
                              )}
                              <div className="line-clamp-1">{issue.fields.summary}</div>
                            </div>
                          </td>

                          {/* Status Badge formatted with workflow color */}
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] inline-flex items-center gap-1.5 ${badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
                              <span>{issue.fields.status?.name}</span>
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                              {issue.fields.priority?.iconUrl && (
                                <img 
                                  src={getJiraProxyImageUrl(issue.fields.priority.iconUrl)} 
                                  alt="" 
                                  className="w-3.5 h-3.5 object-contain" 
                                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                />
                              )}
                              <span>{issue.fields.priority?.name || 'Medium'}</span>
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-3 px-4">
                            {issue.fields.assignee ? (
                              <div className="flex items-center gap-2 text-foreground font-medium">
                                <JiraAvatar 
                                  avatarUrl={issue.fields.assignee.avatarUrls?.['24x24'] || issue.fields.assignee.avatarUrls?.['32x32']} 
                                  displayName={issue.fields.assignee.displayName}
                                  className="w-5 h-5"
                                  sizeText="text-[9px]"
                                />
                                <span className="truncate max-w-[120px]">{issue.fields.assignee.displayName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </td>

                          {/* Story Points */}
                          <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                            {issue.fields.customfield_10016 ?? issue.fields.customfield_10026 ?? issue.fields.storyPoints ?? '-'}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setLogWorkKey(issue.key);
                                  setLogWorkSummary(issue.fields.summary);
                                }}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition"
                                title="Log Work to this task"
                              >
                                <Clock className="w-4 h-4" />
                              </button>

                              {!isSubtask && (
                                <button
                                  type="button"
                                  onClick={() => openCreateSubtask(issue.key)}
                                  className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition"
                                  title="Add child Sub-task"
                                >
                                  <GitBranch className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDetailIssueKey(issue.key)}
                                className="px-2 py-1 rounded-lg bg-accent hover:bg-accent/80 text-foreground font-semibold text-[11px] transition"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Standard Issues Section Header */}
                    <tr className="bg-blue-500/10 border-y border-blue-500/25">
                      <td colSpan={8} className="py-2.5 px-4 text-xs font-bold text-blue-700 dark:text-blue-300">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>📋 TASKS & USER STORIES ({standardIssues.length})</span>
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground/90">
                            Thứ tự quy trình: To Do → In Progress → Review → Testing → Done
                          </span>
                        </div>
                      </td>
                    </tr>
                    {standardIssues.map(issue => {
                      const isSubtask = isJiraSubtask(issue);
                      const statusCat = issue.fields.status?.statusCategory?.key;
                      const badgeClass = getWorkflowStatusBadgeClass(issue.fields.status?.name, statusCat);

                      return (
                        <tr 
                          key={issue.key}
                          className="hover:bg-accent/40 transition group cursor-pointer"
                          onClick={() => setDetailIssueKey(issue.key)}
                        >
                          {/* Type Icon */}
                          <td className="py-3 px-4">
                            <IssueTypeIcon type={issue.fields.issuetype} className="w-4 h-4" />
                          </td>

                          {/* Key with Subtask indicator */}
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="group-hover:text-primary transition">{issue.key}</span>
                              {isSubtask && (
                                <span title="Sub-task" className="inline-flex items-center">
                                  <GitBranch className="w-3 h-3 text-purple-500 shrink-0" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Summary & Parent Breadcrumb */}
                          <td className="py-3 px-4 font-medium text-foreground">
                            <div className="space-y-0.5">
                              {issue.fields.parent && (
                                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                  <span>Parent:</span>
                                  <span className="font-bold text-foreground">{issue.fields.parent.key}</span>
                                </div>
                              )}
                              <div className="line-clamp-1">{issue.fields.summary}</div>
                            </div>
                          </td>

                          {/* Status Badge formatted with workflow color */}
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] inline-flex items-center gap-1.5 ${badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
                              <span>{issue.fields.status?.name}</span>
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                              {issue.fields.priority?.iconUrl && (
                                <img 
                                  src={getJiraProxyImageUrl(issue.fields.priority.iconUrl)} 
                                  alt="" 
                                  className="w-3.5 h-3.5 object-contain" 
                                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                />
                              )}
                              <span>{issue.fields.priority?.name || 'Medium'}</span>
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-3 px-4">
                            {issue.fields.assignee ? (
                              <div className="flex items-center gap-2 text-foreground font-medium">
                                <JiraAvatar 
                                  avatarUrl={issue.fields.assignee.avatarUrls?.['24x24'] || issue.fields.assignee.avatarUrls?.['32x32']} 
                                  displayName={issue.fields.assignee.displayName}
                                  className="w-5 h-5"
                                  sizeText="text-[9px]"
                                />
                                <span className="truncate max-w-[120px]">{issue.fields.assignee.displayName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </td>

                          {/* Story Points */}
                          <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                            {issue.fields.customfield_10016 ?? issue.fields.customfield_10026 ?? issue.fields.storyPoints ?? '-'}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setLogWorkKey(issue.key);
                                  setLogWorkSummary(issue.fields.summary);
                                }}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition"
                                title="Log Work to this task"
                              >
                                <Clock className="w-4 h-4" />
                              </button>

                              {!isSubtask && (
                                <button
                                  type="button"
                                  onClick={() => openCreateSubtask(issue.key)}
                                  className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition"
                                  title="Add child Sub-task"
                                >
                                  <GitBranch className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDetailIssueKey(issue.key)}
                                className="px-2 py-1 rounded-lg bg-accent hover:bg-accent/80 text-foreground font-semibold text-[11px] transition"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ) : (
                  sortedIssues.map((issue) => {
                    const isSubtask = isJiraSubtask(issue);
                    const statusCat = issue.fields.status?.statusCategory?.key;
                    const badgeClass = getWorkflowStatusBadgeClass(issue.fields.status?.name, statusCat);

                    return (
                      <tr 
                        key={issue.key}
                        className="hover:bg-accent/40 transition group cursor-pointer"
                        onClick={() => setDetailIssueKey(issue.key)}
                      >
                        {/* Type Icon */}
                        <td className="py-3 px-4">
                          <IssueTypeIcon type={issue.fields.issuetype} className="w-4 h-4" />
                        </td>

                        {/* Key with Subtask indicator */}
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="group-hover:text-primary transition">{issue.key}</span>
                            {isSubtask && (
                              <span title="Sub-task" className="inline-flex items-center">
                                <GitBranch className="w-3 h-3 text-purple-500 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Summary & Parent Breadcrumb */}
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="space-y-0.5">
                            {issue.fields.parent && (
                              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                <span>Parent:</span>
                                <span className="font-bold text-foreground">{issue.fields.parent.key}</span>
                              </div>
                            )}
                            <div className="line-clamp-1">{issue.fields.summary}</div>
                          </div>
                        </td>

                        {/* Status Badge formatted with workflow color */}
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] inline-flex items-center gap-1.5 ${badgeClass}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
                            <span>{issue.fields.status?.name}</span>
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            {issue.fields.priority?.iconUrl && (
                              <img 
                                src={getJiraProxyImageUrl(issue.fields.priority.iconUrl)} 
                                alt="" 
                                className="w-3.5 h-3.5 object-contain" 
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            )}
                            <span>{issue.fields.priority?.name || 'Medium'}</span>
                          </div>
                        </td>

                        {/* Assignee */}
                        <td className="py-3 px-4">
                          {issue.fields.assignee ? (
                            <div className="flex items-center gap-2 text-foreground font-medium">
                              <JiraAvatar 
                                avatarUrl={issue.fields.assignee.avatarUrls?.['24x24'] || issue.fields.assignee.avatarUrls?.['32x32']} 
                                displayName={issue.fields.assignee.displayName}
                                className="w-5 h-5"
                                sizeText="text-[9px]"
                              />
                              <span className="truncate max-w-[120px]">{issue.fields.assignee.displayName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </td>

                        {/* Story Points */}
                        <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                          {issue.fields.customfield_10016 ?? issue.fields.customfield_10026 ?? issue.fields.storyPoints ?? '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLogWorkKey(issue.key);
                                setLogWorkSummary(issue.fields.summary);
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition"
                              title="Log Work to this task"
                            >
                              <Clock className="w-4 h-4" />
                            </button>

                            {!isSubtask && (
                              <button
                                type="button"
                                onClick={() => openCreateSubtask(issue.key)}
                                className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition"
                                title="Add child Sub-task"
                              >
                                <GitBranch className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDetailIssueKey(issue.key)}
                              className="px-2 py-1 rounded-lg bg-accent hover:bg-accent/80 text-foreground font-semibold text-[11px] transition"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-muted-foreground">
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <span>
              Showing {total === 0 ? 0 : page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} issues
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <span>Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="bg-card border border-border rounded-lg px-2 py-0.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={25}>25 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-accent disabled:opacity-40 transition flex items-center gap-1 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="font-mono px-2">Page {page + 1} / {Math.max(1, Math.ceil(total / pageSize))}</span>

            <button
              type="button"
              disabled={(page + 1) * pageSize >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-accent disabled:opacity-40 transition flex items-center gap-1 font-semibold"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {detailIssueKey && (
        <IssueDetailModal
          isOpen={Boolean(detailIssueKey)}
          onClose={() => setDetailIssueKey(null)}
          issueKey={detailIssueKey}
          onIssueUpdated={executeSearch}
        />
      )}

      {showCreateModal && (
        <CreateIssueModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateSubtaskParentKey(undefined);
          }}
          defaultParentKey={createSubtaskParentKey}
          isSubtaskOnly={isSubtaskOnlyModal}
          onSuccess={() => {
            executeSearch();
          }}
        />
      )}

      {logWorkKey && (
        <LogWorkModal
          isOpen={Boolean(logWorkKey)}
          onClose={() => setLogWorkKey(null)}
          initialIssueKey={logWorkKey}
          initialIssueSummary={logWorkSummary}
          onSuccess={() => {
            executeSearch();
          }}
        />
      )}
    </div>
  );
};
