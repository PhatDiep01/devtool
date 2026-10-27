import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderKanban, 
  Layers, 
  RefreshCw, 
  Calendar, 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  ExternalLink, 
  ArrowRight, 
  Sparkles,
  Inbox,
  Check,
  AlertCircle,
  Tag,
  User,
  Filter,
  ChevronsUpDown,
  ChevronsDownUp,
  Search,
  X,
  Pin,
  PinOff,
  ArrowUpDown,
  RotateCcw,
  GripVertical,
  ChevronLeft
} from 'lucide-react';
import { jiraApi, getJiraProxyImageUrl } from '../../../services/api';
import { JiraBoard, JiraSprint, JiraIssue, JiraBoardConfiguration } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { IssueTypeIcon } from '../components/IssueTypeIcon';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { LogWorkModal } from '../components/LogWorkModal';
import { SearchableSelect, SelectOption } from '../../../components/ui';
import { toast } from 'react-hot-toast';

interface AssigneeBadgeProps {
  assignee?: {
    displayName?: string;
    avatarUrls?: Record<string, string>;
  } | null;
  size?: 'sm' | 'md';
  maxTextWidth?: string;
  showUnassigned?: boolean;
}

const AssigneeBadge: React.FC<AssigneeBadgeProps> = ({
  assignee,
  size = 'md',
  maxTextWidth = 'max-w-[110px]',
  showUnassigned = true,
}) => {
  const [imgError, setImgError] = useState(false);

  if (!assignee || !assignee.displayName) {
    if (!showUnassigned) return null;
    return (
      <span className="hidden sm:inline-flex items-center gap-1 text-muted-foreground/70 italic text-[11px]">
        <User className="w-3 h-3 opacity-60 shrink-0" />
        <span>Unassigned</span>
      </span>
    );
  }

  const avatarUrl =
    assignee.avatarUrls?.['24x24'] ||
    assignee.avatarUrls?.['32x32'] ||
    assignee.avatarUrls?.['48x48'] ||
    assignee.avatarUrls?.['16x16'];

  const isSm = size === 'sm';
  const initial = assignee.displayName ? assignee.displayName.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={assignee.displayName}>
      {avatarUrl && !imgError ? (
        <img
          src={getJiraProxyImageUrl(avatarUrl)}
          alt={assignee.displayName}
          onError={() => setImgError(true)}
          className={`${
            isSm ? 'w-4 h-4' : 'w-5 h-5'
          } rounded-full object-cover shrink-0 border border-border/80 shadow-2xs`}
        />
      ) : (
        <div
          className={`${
            isSm ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'
          } rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/20`}
        >
          {initial}
        </div>
      )}
      <span
        className={`font-medium truncate ${
          isSm ? 'text-[11px] text-muted-foreground' : 'text-xs text-foreground'
        } ${maxTextWidth}`}
      >
        {assignee.displayName}
      </span>
    </div>
  );
};

export type SprintSortMode =
  | 'jira_default'
  | 'custom'
  | 'id_desc'
  | 'id_asc'
  | 'name_asc'
  | 'name_desc'
  | 'date_desc'
  | 'date_asc';

export const JiraSprintsPage: React.FC = () => {
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [boardConfig, setBoardConfig] = useState<JiraBoardConfiguration | null>(null);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<JiraSprint | null>(null);
  const [sprintIssues, setSprintIssues] = useState<JiraIssue[]>([]);
  const [backlogIssues, setBacklogIssues] = useState<JiraIssue[]>([]);
  
  // Tabs: issues vs backlog
  const [activeView, setActiveView] = useState<'issues' | 'backlog'>('issues');
  const [sprintStateTab, setSprintStateTab] = useState<'active' | 'future' | 'closed'>('active');
  const [sprintSearchQuery, setSprintSearchQuery] = useState('');

  // Local sprint ordering & pinning (purely client-side, zero Jira changes)
  const [sprintSortMode, setSprintSortMode] = useState<SprintSortMode>('jira_default');
  const [customSprintOrder, setCustomSprintOrder] = useState<number[]>([]);
  const [pinnedSprintIds, setPinnedSprintIds] = useState<number[]>([]);
  const [draggedSprintId, setDraggedSprintId] = useState<number | null>(null);
  const [dragOverSprintId, setDragOverSprintId] = useState<number | null>(null);

  // Filter subtasks (default: true to hide subtasks)
  const [hideSubtasks, setHideSubtasks] = useState<boolean>(true);

  // Loading states
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingSprintData, setLoadingSprintData] = useState(false);
  const [movingIssues, setMovingIssues] = useState(false);

  // Selected backlog issues to move
  const [selectedBacklogKeys, setSelectedBacklogKeys] = useState<string[]>([]);

  // Expanded US keys for subtask hierarchy
  const [expandedStoryKeys, setExpandedStoryKeys] = useState<Record<string, boolean>>({});

  // Modals
  const [detailIssueKey, setDetailIssueKey] = useState<string | null>(null);
  const [createSubtaskParentKey, setCreateSubtaskParentKey] = useState<string | null>(null);
  const [logWorkKey, setLogWorkKey] = useState<string | null>(null);
  const [logWorkSummary, setLogWorkSummary] = useState<string>('');

  useEffect(() => {
    loadBoards();
  }, []);

  useEffect(() => {
    if (selectedBoardId) {
      loadSprintsForBoard(selectedBoardId);
    }
  }, [selectedBoardId]);

  // Load custom sprint sorting & pin preferences from localStorage when board changes
  useEffect(() => {
    if (!selectedBoardId) {
      setSprintSortMode('jira_default');
      setCustomSprintOrder([]);
      setPinnedSprintIds([]);
      return;
    }

    try {
      const savedMode = (localStorage.getItem(`jira_sprint_sort_mode_${selectedBoardId}`) as SprintSortMode) || 'jira_default';
      const savedOrder = JSON.parse(localStorage.getItem(`jira_sprint_custom_order_${selectedBoardId}`) || '[]');
      const savedPinned = JSON.parse(localStorage.getItem(`jira_sprint_pinned_${selectedBoardId}`) || '[]');

      setSprintSortMode(savedMode);
      setCustomSprintOrder(Array.isArray(savedOrder) ? savedOrder : []);
      setPinnedSprintIds(Array.isArray(savedPinned) ? savedPinned : []);
    } catch (err) {
      console.warn('Failed to parse local sprint sort order:', err);
      setSprintSortMode('jira_default');
      setCustomSprintOrder([]);
      setPinnedSprintIds([]);
    }
  }, [selectedBoardId]);

  useEffect(() => {
    if (selectedSprint) {
      loadSprintDetailsAndIssues(selectedSprint.id);
    }
  }, [selectedSprint]);

  const loadBoards = async () => {
    setLoadingBoards(true);
    try {
      const res = await jiraApi.getBoards();
      const boardList: JiraBoard[] = res.data || [];
      setBoards(boardList);
      if (boardList.length > 0) {
        setSelectedBoardId(boardList[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách Jira board');
    } finally {
      setLoadingBoards(false);
    }
  };

  const loadSprintsForBoard = async (boardId: number) => {
    setLoadingSprintData(true);
    setSprintSearchQuery('');
    try {
      const [spRes, blRes, confRes] = await Promise.all([
        jiraApi.getSprints(boardId, 'active,future,closed').catch(() => ({ data: [] })),
        jiraApi.getBoardBacklog(boardId).catch(() => ({ data: [] })),
        jiraApi.getBoardConfiguration(boardId).catch(() => null)
      ]);

      const allSprints: JiraSprint[] = spRes.data || [];
      setSprints(allSprints);
      setBacklogIssues(blRes.data || []);
      setBoardConfig(confRes?.data || null);

      // Auto select active sprint or first
      const active = allSprints.find(s => s.state === 'active') || allSprints[0] || null;
      setSelectedSprint(active);
      if (active?.state) {
        setSprintStateTab(active.state as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSprintData(false);
    }
  };

  const loadSprintDetailsAndIssues = async (sprintId: number) => {
    setLoadingSprintData(true);
    try {
      const issRes = await jiraApi.getSprintIssues(sprintId);
      const rawData: any = issRes.data;
      const issues: JiraIssue[] = Array.isArray(rawData) ? rawData : (rawData?.issues || []);
      setSprintIssues(issues);

      // Only expand parent stories if hideSubtasks is disabled
      const exp: Record<string, boolean> = {};
      if (!hideSubtasks) {
        issues.forEach(i => {
          if (!i.fields.issuetype?.subtask) {
            exp[i.key] = true;
          }
        });
      }
      setExpandedStoryKeys(exp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSprintData(false);
    }
  };

  const toggleExpandStory = (key: string) => {
    setExpandedStoryKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleExpandAll = () => {
    const exp: Record<string, boolean> = {};
    parentIssues.forEach(story => {
      exp[story.key] = true;
    });
    setExpandedStoryKeys(exp);
  };

  const handleCollapseAll = () => {
    setExpandedStoryKeys({});
  };

  const handleMoveBacklogToSprint = async () => {
    if (!selectedSprint || selectedBacklogKeys.length === 0) return;

    setMovingIssues(true);
    try {
      await jiraApi.moveIssuesToSprint(selectedSprint.id, selectedBacklogKeys);
      toast.success(`Đã chuyển ${selectedBacklogKeys.length} công việc vào sprint "${selectedSprint.name}"!`);
      setSelectedBacklogKeys([]);
      setActiveView('issues');
      // Reload both sprint issues and backlog
      if (selectedBoardId) {
        await loadSprintsForBoard(selectedBoardId);
        await loadSprintDetailsAndIssues(selectedSprint.id);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Không thể chuyển công việc vào sprint';
      toast.error(msg);
    } finally {
      setMovingIssues(false);
    }
  };

  // Group sprint issues into Parents (Stories/Tasks) and their Subtasks
  const parentIssues: JiraIssue[] = [];
  const orphanSubtasks: JiraIssue[] = [];
  const allSubtasks: JiraIssue[] = [];

  // Issue lookup map for fast subtask resolution & enrichment
  const issueMap = new Map<string, JiraIssue>();
  sprintIssues.forEach(i => {
    issueMap.set(i.key, i);
  });

  sprintIssues.forEach(issue => {
    const isSub = Boolean(issue.fields.issuetype?.subtask || issue.fields.parent);
    if (isSub) {
      allSubtasks.push(issue);
      const hasParentInSprint = sprintIssues.some(
        p => p.key === issue.fields.parent?.key
      );
      if (!hasParentInSprint) {
        orphanSubtasks.push(issue);
      }
    } else {
      parentIssues.push(issue);
    }
  });

  // Calculate Estimation (Story Points & Time Original Estimate)
  const totalStoryPoints = sprintIssues.reduce((acc, iss) => {
    const pts = iss.fields.customfield_10110 
      ?? iss.fields.customfield_10103
      ?? iss.fields.customfield_10402
      ?? iss.fields.customfield_10016 
      ?? iss.fields.customfield_10026 
      ?? iss.fields.storyPoints 
      ?? 0;
    return acc + Number(pts);
  }, 0);

  const totalEstimateSeconds = sprintIssues.reduce((acc, iss) => {
    const est = iss.fields.timeoriginalestimate || 0;
    return acc + Number(est);
  }, 0);
  const totalEstimateHours = Number((totalEstimateSeconds / 3600).toFixed(1));

  const totalTimeSpentSeconds = sprintIssues.reduce((acc, iss) => {
    return acc + Number(iss.fields.timespent || 0);
  }, 0);
  const totalTimeSpentHours = Number((totalTimeSpentSeconds / 3600).toFixed(1));

  // Determine estimation mode / label based on Board configuration
  const estimationFieldId = boardConfig?.estimation?.field?.fieldId;
  const isTimeEstimationBoard = estimationFieldId === 'timeoriginalestimate' || (totalStoryPoints === 0 && totalEstimateSeconds > 0);

  // Issues completion stats
  const isDone = (i: JiraIssue) => i.fields.status?.statusCategory?.key === 'done';
  const completedIssues = sprintIssues.filter(isDone).length;
  const completedParents = parentIssues.filter(isDone).length;
  const completedSubtasks = allSubtasks.filter(isDone).length;
  const progressPercent = sprintIssues.length > 0 ? Math.round((completedIssues / sprintIssues.length) * 100) : 0;

  const filteredSprints = useMemo(() => {
    const base = sprints.filter(s => {
      const matchesState = s.state === sprintStateTab;
      const q = sprintSearchQuery.trim().toLowerCase();
      if (!q) return matchesState;
      const matchesSearch = s.name.toLowerCase().includes(q) || String(s.id).includes(q) || (s.goal && s.goal.toLowerCase().includes(q));
      return matchesState && matchesSearch;
    });

    return [...base].sort((a, b) => {
      // Pinned sprints always come first
      const aPinned = pinnedSprintIds.includes(a.id);
      const bPinned = pinnedSprintIds.includes(b.id);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedSprintIds.indexOf(a.id) - pinnedSprintIds.indexOf(b.id);
      }

      // Non-pinned items sort according to sprintSortMode
      switch (sprintSortMode) {
        case 'id_desc':
          return b.id - a.id;
        case 'id_asc':
          return a.id - b.id;
        case 'name_asc':
          return a.name.localeCompare(b.name, 'vi', { numeric: true });
        case 'name_desc':
          return b.name.localeCompare(a.name, 'vi', { numeric: true });
        case 'date_desc': {
          const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bDate - aDate;
        }
        case 'date_asc': {
          const aDate = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        }
        case 'custom': {
          const aIdx = customSprintOrder.indexOf(a.id);
          const bIdx = customSprintOrder.indexOf(b.id);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return sprints.indexOf(a) - sprints.indexOf(b);
        }
        case 'jira_default':
        default:
          return sprints.indexOf(a) - sprints.indexOf(b);
      }
    });
  }, [sprints, sprintStateTab, sprintSearchQuery, sprintSortMode, customSprintOrder, pinnedSprintIds]);

  const updateSortMode = (mode: SprintSortMode) => {
    setSprintSortMode(mode);
    if (selectedBoardId) {
      localStorage.setItem(`jira_sprint_sort_mode_${selectedBoardId}`, mode);
    }
  };

  const updateCustomOrder = (newOrder: number[]) => {
    setCustomSprintOrder(newOrder);
    setSprintSortMode('custom');
    if (selectedBoardId) {
      localStorage.setItem(`jira_sprint_custom_order_${selectedBoardId}`, JSON.stringify(newOrder));
      localStorage.setItem(`jira_sprint_sort_mode_${selectedBoardId}`, 'custom');
    }
  };

  const togglePinSprint = (sprintId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const isPinned = pinnedSprintIds.includes(sprintId);
    const nextPinned = isPinned
      ? pinnedSprintIds.filter(id => id !== sprintId)
      : [sprintId, ...pinnedSprintIds];
    
    setPinnedSprintIds(nextPinned);
    if (selectedBoardId) {
      localStorage.setItem(`jira_sprint_pinned_${selectedBoardId}`, JSON.stringify(nextPinned));
    }
    toast.success(isPinned ? 'Đã bỏ ghim sprint' : 'Đã ghim sprint lên đầu');
  };

  const handleResetJiraOrder = () => {
    setSprintSortMode('jira_default');
    setCustomSprintOrder([]);
    setPinnedSprintIds([]);
    if (selectedBoardId) {
      localStorage.removeItem(`jira_sprint_sort_mode_${selectedBoardId}`);
      localStorage.removeItem(`jira_sprint_custom_order_${selectedBoardId}`);
      localStorage.removeItem(`jira_sprint_pinned_${selectedBoardId}`);
    }
    toast.success('Đã khôi phục sắp xếp mặc định từ Jira');
  };

  const handleMoveSprint = (sprintId: number, direction: 'left' | 'right', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const currentIds = filteredSprints.map(s => s.id);
    const currentIndex = currentIds.indexOf(sprintId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;

    const nextIds = [...currentIds];
    const temp = nextIds[currentIndex];
    nextIds[currentIndex] = nextIds[targetIndex];
    nextIds[targetIndex] = temp;

    updateCustomOrder(nextIds);
  };

  const handleDragStart = (e: React.DragEvent, sprintId: number) => {
    e.dataTransfer.setData('text/plain', String(sprintId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSprintId(sprintId);
  };

  const handleDragOver = (e: React.DragEvent, sprintId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSprintId !== sprintId) {
      setDragOverSprintId(sprintId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSprintId: number) => {
    e.preventDefault();
    const sourceId = draggedSprintId || Number(e.dataTransfer.getData('text/plain'));
    setDraggedSprintId(null);
    setDragOverSprintId(null);

    if (!sourceId || sourceId === targetSprintId) return;

    const currentIds = filteredSprints.map(s => s.id);
    const sourceIndex = currentIds.indexOf(sourceId);
    const targetIndex = currentIds.indexOf(targetSprintId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextIds = [...currentIds];
    nextIds.splice(sourceIndex, 1);
    nextIds.splice(targetIndex, 0, sourceId);

    updateCustomOrder(nextIds);
    toast.success('Đã cập nhật vị trí sprint!');
  };

  const handleDragEnd = () => {
    setDraggedSprintId(null);
    setDragOverSprintId(null);
  };

  const otherMatches = sprintSearchQuery.trim()
    ? sprints.filter(s => {
        if (s.state === sprintStateTab) return false;
        const q = sprintSearchQuery.trim().toLowerCase();
        return s.name.toLowerCase().includes(q) || String(s.id).includes(q) || (s.goal && s.goal.toLowerCase().includes(q));
      })
    : [];

  const boardOptions = useMemo<SelectOption<number>[]>(() => {
    return boards.map(b => ({
      value: b.id,
      label: b.name,
      badge: b.type?.toUpperCase(),
      badgeColor: b.type === 'scrum' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    }));
  }, [boards]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Sprint Hub & Hierarchy
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Agile Execution
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage active sprint goals, view hierarchical User Stories with Sub-tasks, and plan backlog items.
              </p>
            </div>
          </div>

          {/* Board Selector */}
          <div className="flex items-end gap-2.5">
            <div className="w-56 sm:w-64">
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Active Board:</label>
              <SearchableSelect
                options={boardOptions}
                value={selectedBoardId}
                onChange={(val) => setSelectedBoardId(val)}
                disabled={loadingBoards || boards.length === 0}
                placeholder="Chọn bảng agile..."
                searchPlaceholder="Tìm kiếm board..."
                size="sm"
              />
            </div>

            <button
              onClick={() => {
                if (selectedBoardId) loadSprintsForBoard(selectedBoardId);
              }}
              disabled={loadingSprintData}
              className="p-2 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition mb-0.5"
              title="Refresh Sprints"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSprintData ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sprint State Filter Tabs */}
        <div className="mt-6 pt-6 border-t border-border/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border overflow-x-auto scrollbar-thin max-w-full flex-nowrap">
            {(['active', 'future', 'closed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setSprintStateTab(st);
                  const matched = sprints.filter(s => s.state === st);
                  if (matched.length > 0) {
                    setSelectedSprint(matched[0]);
                  }
                }}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-xl capitalize transition shrink-0 whitespace-nowrap ${
                  sprintStateTab === st
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st} Sprints ({sprints.filter(s => s.state === st).length})
              </button>
            ))}
          </div>

          {/* View Toggle: Sprint Issues vs Backlog */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('issues')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'issues'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sprint Issues ({sprintIssues.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('backlog')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeView === 'backlog'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Backlog ({backlogIssues.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sprints Horizontal Carousel / Selector */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Danh sách {sprintStateTab} sprints ({filteredSprints.length}
              {sprintSearchQuery ? ` / ${sprints.filter(s => s.state === sprintStateTab).length}` : ''}):
            </span>
            {pinnedSprintIds.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <Pin className="w-2.5 h-2.5 fill-current" />
                {pinnedSprintIds.length} đã ghim
              </span>
            )}
            <span className="text-[11px] italic hidden sm:inline text-muted-foreground/75">
              ← Kéo thả thẻ để đổi thứ tự, bấm Ghim để giữ lên đầu →
            </span>
          </div>

          {/* Right Toolbar: Sort Options & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sort Mode Dropdown */}
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-2.5 py-1 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <label htmlFor="sprint-sort-select" className="sr-only">Sắp xếp sprint</label>
              <select
                id="sprint-sort-select"
                value={sprintSortMode}
                onChange={(e) => updateSortMode(e.target.value as SprintSortMode)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer py-0.5 pr-1"
                title="Chọn tiêu chí sắp xếp hiển thị (Chỉ lưu trên trình duyệt của bạn, không ảnh hưởng Jira)"
              >
                <option value="jira_default">Mặc định Jira</option>
                <option value="custom">Tùy biến (Kéo thả)</option>
                <option value="id_desc">ID: Mới nhất → Cũ nhất</option>
                <option value="id_asc">ID: Cũ nhất → Mới nhất</option>
                <option value="name_asc">Tên: A → Z</option>
                <option value="name_desc">Tên: Z → A</option>
                <option value="date_desc">Ngày: Mới nhất trước</option>
                <option value="date_asc">Ngày: Cũ nhất trước</option>
              </select>

              {(sprintSortMode !== 'jira_default' || customSprintOrder.length > 0 || pinnedSprintIds.length > 0) && (
                <button
                  type="button"
                  onClick={handleResetJiraOrder}
                  className="ml-1 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1 text-[10px] font-medium"
                  title="Khôi phục sắp xếp mặc định từ Jira và xóa các ghim"
                >
                  <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span className="hidden xl:inline">Khôi phục</span>
                </button>
              )}
            </div>

            {/* Search Sprint Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sprintSearchQuery}
                onChange={(e) => setSprintSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredSprints.length > 0) {
                    setSelectedSprint(filteredSprints[0]);
                  }
                }}
                placeholder="Tìm sprint theo tên hoặc #ID..."
                className="w-full bg-card border border-border rounded-xl pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-primary font-medium transition shadow-2xs placeholder:text-muted-foreground/70"
              />
              {sprintSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSprintSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredSprints.length > 0 ? (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 px-0.5 scrollbar-thin">
            {filteredSprints.map((s, index) => {
              const isSelected = selectedSprint?.id === s.id;
              const isPinned = pinnedSprintIds.includes(s.id);
              const isDragging = draggedSprintId === s.id;
              const isDragOver = dragOverSprintId === s.id && draggedSprintId !== s.id;
              const hasDates = Boolean(s.startDate && s.endDate);
              const startDateStr = s.startDate ? new Date(s.startDate).toLocaleDateString('vi-VN') : null;
              const endDateStr = s.endDate ? new Date(s.endDate).toLocaleDateString('vi-VN') : null;

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSprint(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedSprint(s);
                    }
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, s.id)}
                  onDragOver={(e) => handleDragOver(e, s.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, s.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 rounded-2xl border text-left min-w-[280px] sm:min-w-[320px] max-w-[360px] transition-all flex flex-col justify-between shrink-0 relative group cursor-pointer select-none ${
                    isDragging
                      ? 'opacity-40 border-dashed border-primary scale-[0.98]'
                      : isDragOver
                      ? 'border-primary ring-2 ring-primary/40 bg-primary/10 shadow-lg scale-[1.02]'
                      : isSelected
                      ? 'bg-card border-primary ring-2 ring-primary/25 shadow-md scale-[1.01]'
                      : isPinned
                      ? 'bg-card/90 border-amber-500/50 hover:border-amber-500 shadow-2xs hover:shadow-xs'
                      : 'bg-card/70 hover:bg-card border-border hover:border-primary/50 shadow-2xs hover:shadow-xs'
                  }`}
                  title={`${s.name} (Kéo thả để sắp xếp vị trí)`}
                >
                  {/* Top Bar: Drag Handle, Sprint ID, Action Buttons & State Badge */}
                  <div className="flex items-center justify-between gap-1.5 w-full mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Drag handle */}
                      <span
                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-foreground transition rounded"
                        title="Kéo thả để thay đổi vị trí"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>

                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg shrink-0">
                        #{s.id}
                      </span>

                      {isPinned && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5 shrink-0">
                          <Pin className="w-2.5 h-2.5 fill-current" />
                          <span className="hidden sm:inline">Ghim</span>
                        </span>
                      )}
                    </div>

                    {/* Right tools: Move Left, Move Right, Pin toggle & State badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick Move Left / Right buttons */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-muted/60 rounded-lg p-0.5 border border-border/60">
                        <button
                          type="button"
                          onClick={(e) => handleMoveSprint(s.id, 'left', e)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 transition"
                          title="Dịch sang trái"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveSprint(s.id, 'right', e)}
                          disabled={index === filteredSprints.length - 1}
                          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 transition"
                          title="Dịch sang phải"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Pin / Unpin Button */}
                      <button
                        type="button"
                        onClick={(e) => togglePinSprint(s.id, e)}
                        className={`p-1.5 rounded-lg transition border ${
                          isPinned
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                            : 'border-transparent text-muted-foreground/40 hover:text-foreground hover:bg-muted'
                        }`}
                        title={isPinned ? 'Bỏ ghim sprint này' : 'Ghim sprint này lên đầu danh sách'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                      </button>

                      {/* State badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                        s.state === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                          : s.state === 'future'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {s.state === 'active' && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                        )}
                        {s.state}
                      </span>
                    </div>
                  </div>

                  {/* Sprint Name - Full display up to 2 lines without clipping */}
                  <div className="my-1 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition" title={s.name}>
                      {s.name}
                    </h3>

                    {/* Goal snippet if available */}
                    {s.goal && (
                      <p className="text-[11px] text-muted-foreground/90 italic line-clamp-1 mt-1.5">
                        🎯 {s.goal}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Date Range & Selection Indicator */}
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground w-full">
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      <span className="font-medium truncate">
                        {hasDates ? `${startDateStr} → ${endDateStr}` : 'Chưa xếp lịch'}
                      </span>
                    </div>

                    {isSelected ? (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1 shrink-0 bg-primary/10 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> Đang chọn
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0 flex items-center">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              {sprintSearchQuery ? (
                <>
                  Không tìm thấy sprint nào ở trạng thái <span className="font-bold uppercase text-foreground">{sprintStateTab}</span> khớp với từ khóa <span className="font-bold text-foreground">"{sprintSearchQuery}"</span>.
                </>
              ) : (
                <>Không có sprint nào ở trạng thái <span className="font-bold uppercase text-foreground">{sprintStateTab}</span>.</>
              )}
            </p>

            {otherMatches.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Gợi ý tìm thấy ở trạng thái khác:</span>
                {Array.from(new Set(otherMatches.map(s => s.state))).map(st => {
                  const count = otherMatches.filter(s => s.state === st).length;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setSprintStateTab(st as any);
                        const first = otherMatches.find(s => s.state === st);
                        if (first) setSelectedSprint(first);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition capitalize"
                    >
                      Chuyển sang {st} sprints ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {sprintSearchQuery && (
              <div>
                <button
                  type="button"
                  onClick={() => setSprintSearchQuery('')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Sprint Details Banner */}
      {selectedSprint && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-background to-card border border-indigo-500/20 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 px-2.5 py-0.5 rounded-md">
                  Sprint #{selectedSprint.id}
                </span>
                <h2 className="text-base sm:text-xl font-bold text-foreground">
                  {selectedSprint.name}
                </h2>
              </div>
              {selectedSprint.goal && (
                <p className="text-xs sm:text-sm text-foreground/80 italic font-medium">
                  🎯 Goal: "{selectedSprint.goal}"
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <span>
                  Duration: {selectedSprint.startDate ? new Date(selectedSprint.startDate).toLocaleDateString() : 'N/A'} → {selectedSprint.endDate ? new Date(selectedSprint.endDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-border/80 pt-3 sm:pt-0 sm:pl-6 shrink-0">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  {isTimeEstimationBoard ? 'Original Estimate' : 'Story Points'}
                </span>
                <span className="text-lg font-mono font-extrabold text-foreground">
                  {isTimeEstimationBoard ? `${totalEstimateHours}h` : `${totalStoryPoints} pts`}
                </span>
                {isTimeEstimationBoard && totalTimeSpentHours > 0 && (
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    {totalTimeSpentHours}h logged
                  </span>
                )}
                {!isTimeEstimationBoard && totalEstimateHours > 0 && (
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    {totalEstimateHours}h estimate
                  </span>
                )}
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">Issues Completed</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-foreground">
                    {completedIssues}/{sprintIssues.length}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ({progressPercent}%)
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block font-medium">
                  {completedParents}/{parentIssues.length} stories • {completedSubtasks}/{allSubtasks.length} subtasks
                </span>
              </div>
              <div className="w-24 sm:w-28 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-accent h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Sprint Issues Hierarchy Tree OR Backlog */}
      {activeView === 'issues' ? (
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-border/80 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm sm:text-base text-foreground">
                Sprint Issues Hierarchy
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Expand / Collapse All Controls */}
              <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-foreground hover:bg-card hover:shadow-xs font-semibold transition"
                  title="Mở rộng toàn bộ các Story và hiển thị toàn bộ Subtask (Expand All)"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-primary" />
                  <span>Mở rộng toàn bộ</span>
                </button>
                <div className="h-4 w-px bg-border/80 mx-0.5" />
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card hover:shadow-xs font-semibold transition"
                  title="Thu gọn toàn bộ các Story (Collapse All)"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                  <span>Thu gọn toàn bộ</span>
                </button>
              </div>

              <span className="text-xs text-muted-foreground font-semibold px-2.5 py-1 bg-muted/40 rounded-lg border border-border/60">
                {parentIssues.length} stories / tasks ({allSubtasks.length} subtasks)
              </span>
            </div>
          </div>

          {loadingSprintData ? (
            <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <span>Loading sprint issues...</span>
            </div>
          ) : sprintIssues.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">No issues in this sprint yet.</p>
              <p className="text-xs text-muted-foreground">
                Switch to the Backlog tab to add existing issues into this sprint.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {parentIssues.map((story) => {
                const isExpanded = Boolean(expandedStoryKeys[story.key]);
                const subtasks = story.fields.subtasks || [];
                const storyPoints = story.fields.customfield_10110 
                  ?? story.fields.customfield_10103
                  ?? story.fields.customfield_10402
                  ?? story.fields.customfield_10016 
                  ?? story.fields.customfield_10026 
                  ?? story.fields.storyPoints;

                const storyEstimateSec = story.fields.aggregatetimeoriginalestimate 
                  || story.fields.timeoriginalestimate 
                  || 0;
                const storyEstimateHours = storyEstimateSec > 0 ? Number((storyEstimateSec / 3600).toFixed(1)) : null;

                const doneSubs = subtasks.filter(st => {
                  const fullSub = issueMap.get(st.key);
                  const cat = fullSub?.fields.status?.statusCategory?.key || st.fields.status?.statusCategory?.key;
                  return cat === 'done';
                }).length;

                return (
                  <div
                    key={story.key}
                    className="border border-border rounded-2xl overflow-hidden bg-background/50 hover:border-primary/40 transition shadow-xs"
                  >
                    {/* Story Header Row */}
                    <div className="p-3 sm:p-4 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 w-full sm:w-auto">
                        {/* Expand/Collapse toggle */}
                        {subtasks.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpandStory(story.key)}
                            className="p-1 rounded-md hover:bg-accent text-muted-foreground transition shrink-0"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        ) : (
                          <div className="w-6 shrink-0" />
                        )}

                        {/* Issue Type Icon */}
                        <IssueTypeIcon type={story.fields.issuetype} className="w-4 h-4" />

                        {/* Story Key */}
                        <button
                          type="button"
                          onClick={() => setDetailIssueKey(story.key)}
                          className="font-mono font-bold text-foreground hover:text-primary transition shrink-0"
                        >
                          {story.key}
                        </button>

                        {/* Story Summary */}
                        <span 
                          onClick={() => setDetailIssueKey(story.key)}
                          className="font-semibold text-foreground truncate cursor-pointer hover:underline min-w-0"
                        >
                          {story.fields.summary}
                        </span>

                        {/* Subtask count pill */}
                        {subtasks.length > 0 && (
                          <span
                            onClick={() => toggleExpandStory(story.key)}
                            className="text-[10px] font-mono text-muted-foreground bg-accent/80 hover:bg-accent px-2 py-0.5 rounded-full cursor-pointer transition shrink-0"
                            title={`${doneSubs}/${subtasks.length} subtask hoàn thành (Bấm để đóng/mở)`}
                          >
                            {doneSubs}/{subtasks.length} subtasks
                          </span>
                        )}
                      </div>

                      {/* Right Meta & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 w-full sm:w-auto pl-8 sm:pl-0 pt-1 sm:pt-0 border-t border-border/40 sm:border-0">
                        <div className="flex items-center gap-2">
                          {storyPoints !== undefined && storyPoints !== null && storyPoints > 0 && (
                            <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-muted-foreground text-[11px]" title="Story Points">
                              {storyPoints} pts
                            </span>
                          )}

                          {storyEstimateHours !== null && (
                            <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-muted-foreground text-[11px]" title="Ước lượng (Original Estimate)">
                              {storyEstimateHours}h
                            </span>
                          )}

                          {/* Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                            story.fields.status?.statusCategory?.key === 'done'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : story.fields.status?.statusCategory?.key === 'indeterminate'
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {story.fields.status?.name}
                          </span>

                          {/* Assignee Badge with Avatar */}
                          <div className="hidden sm:block">
                            <AssigneeBadge assignee={story.fields.assignee} size="md" maxTextWidth="max-w-[120px]" />
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Quick Action: Log Work */}
                          <button
                            type="button"
                            onClick={() => {
                              setLogWorkKey(story.key);
                              setLogWorkSummary(story.fields.summary);
                            }}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition"
                            title="Log Time"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Action: Add Child Subtask */}
                          <button
                            type="button"
                            onClick={() => setCreateSubtaskParentKey(story.key)}
                            className="p-1.5 rounded-lg hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 transition"
                            title="Add Sub-task"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subtasks Tree Container */}
                    {isExpanded && subtasks.length > 0 && (
                      <div className="pl-2.5 sm:pl-12 pr-2 sm:pr-4 py-2 border-t border-border/60 bg-muted/20 space-y-1.5 text-xs">
                        {subtasks.map((st) => {
                          const fullSub = issueMap.get(st.key);
                          const subEstSec = fullSub?.fields.timeoriginalestimate || 0;
                          const subEstHours = subEstSec > 0 ? Number((subEstSec / 3600).toFixed(1)) : null;
                          const subAssignee = fullSub?.fields.assignee;
                          const subStatus = fullSub?.fields.status || st.fields.status;

                          return (
                            <div
                              key={st.key}
                              className="p-2.5 rounded-xl bg-card border border-border/60 hover:border-primary/40 transition flex items-center justify-between gap-3 group"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <GitBranch className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <button
                                  type="button"
                                  onClick={() => setDetailIssueKey(st.key)}
                                  className="font-mono font-bold text-foreground hover:text-primary transition shrink-0"
                                >
                                  {st.key}
                                </button>
                                <span 
                                  onClick={() => setDetailIssueKey(st.key)}
                                  className="text-muted-foreground truncate cursor-pointer hover:text-foreground min-w-0 flex-1"
                                >
                                  {st.fields.summary}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                {subEstHours !== null && (
                                  <span className="font-mono text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-accent/80" title="Subtask Estimate">
                                    {subEstHours}h
                                  </span>
                                )}

                                {/* Subtask Assignee Badge with Avatar */}
                                <div className="hidden md:block">
                                  <AssigneeBadge assignee={subAssignee || (st.fields as any)?.assignee} size="sm" maxTextWidth="max-w-[100px]" showUnassigned={false} />
                                </div>

                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  subStatus?.statusCategory?.key === 'done'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {subStatus?.name}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setLogWorkKey(st.key);
                                    setLogWorkSummary(st.fields.summary);
                                  }}
                                  className="p-1 rounded hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition"
                                  title="Log Time to Subtask"
                                >
                                  <Clock className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Orphan subtasks if any */}
              {orphanSubtasks.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Standalone Sub-tasks in Sprint
                  </h4>
                  <div className="space-y-1.5">
                    {orphanSubtasks.map(st => (
                      <div
                        key={st.key}
                        onClick={() => setDetailIssueKey(st.key)}
                        className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <GitBranch className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span className="font-mono font-bold text-foreground shrink-0">{st.key}</span>
                          <span className="text-muted-foreground truncate min-w-0 flex-1">{st.fields.summary}</span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          {st.fields.assignee && (
                            <div className="hidden sm:block">
                              <AssigneeBadge assignee={st.fields.assignee} size="sm" maxTextWidth="max-w-[100px]" showUnassigned={false} />
                            </div>
                          )}
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {st.fields.status?.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* BACKLOG TAB */
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground">
                Board Backlog
              </h3>
              <p className="text-xs text-muted-foreground">
                Select issues to plan and move into {selectedSprint?.name || 'Sprint'}.
              </p>
            </div>

            {selectedSprint && (
              <button
                type="button"
                onClick={handleMoveBacklogToSprint}
                disabled={movingIssues || selectedBacklogKeys.length === 0}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition shadow-sm disabled:opacity-40 flex items-center gap-2"
              >
                {movingIssues ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Moving...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>Move {selectedBacklogKeys.length} to Sprint</span>
                  </>
                )}
              </button>
            )}
          </div>

          {backlogIssues.length === 0 ? (
            <div className="py-20 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-2xl">
              No backlog issues found on this board.
            </div>
          ) : (
            <div className="space-y-2">
              {backlogIssues.map((issue) => {
                const isSelected = selectedBacklogKeys.includes(issue.key);

                return (
                  <div
                    key={issue.key}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedBacklogKeys(selectedBacklogKeys.filter(k => k !== issue.key));
                      } else {
                        setSelectedBacklogKeys([...selectedBacklogKeys, issue.key]);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-primary/10 border-primary font-medium'
                        : 'bg-card border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by div
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                      />

                      <IssueTypeIcon type={issue.fields.issuetype} className="w-4 h-4" />

                      <span className="font-mono font-bold text-foreground shrink-0">{issue.key}</span>
                      <span className="text-foreground truncate min-w-0 flex-1">{issue.fields.summary}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {issue.fields.assignee && (
                        <div className="hidden md:block">
                          <AssigneeBadge assignee={issue.fields.assignee} size="sm" maxTextWidth="max-w-[100px]" showUnassigned={false} />
                        </div>
                      )}
                      {issue.fields.storyPoints !== undefined && issue.fields.storyPoints !== null && issue.fields.storyPoints > 0 && (
                        <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-muted-foreground text-[11px]">
                          {issue.fields.storyPoints} pts
                        </span>
                      )}
                      {(issue.fields.timeoriginalestimate || 0) > 0 && (
                        <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-muted-foreground text-[11px]">
                          {Number(((issue.fields.timeoriginalestimate || 0) / 3600).toFixed(1))}h
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                        {issue.fields.status?.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailIssueKey(issue.key);
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {detailIssueKey && (
        <IssueDetailModal
          isOpen={Boolean(detailIssueKey)}
          onClose={() => setDetailIssueKey(null)}
          issueKey={detailIssueKey}
          onIssueUpdated={() => {
            if (selectedSprint) loadSprintDetailsAndIssues(selectedSprint.id);
          }}
        />
      )}

      {createSubtaskParentKey && (
        <CreateIssueModal
          isOpen={Boolean(createSubtaskParentKey)}
          onClose={() => setCreateSubtaskParentKey(null)}
          defaultParentKey={createSubtaskParentKey}
          defaultProjectKey={createSubtaskParentKey.split('-')[0]}
          isSubtaskOnly={true}
          onSuccess={() => {
            if (selectedSprint) loadSprintDetailsAndIssues(selectedSprint.id);
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
            if (selectedSprint) loadSprintDetailsAndIssues(selectedSprint.id);
          }}
        />
      )}
    </div>
  );
};
