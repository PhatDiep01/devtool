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
  ChevronLeft,
  Star,
  Edit3,
  Trash2
} from 'lucide-react';
import { jiraApi, getJiraProxyImageUrl } from '../../../services/api';
import { JiraBoard, JiraSprint, JiraIssue, JiraBoardConfiguration } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { IssueTypeIcon } from '../components/IssueTypeIcon';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { LogWorkModal } from '../components/LogWorkModal';
import { EditStoryModal } from '../components/EditStoryModal';
import { SearchableSelect, SelectOption, ConfirmModal } from '../../../components/ui';
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

/**
 * Checks if a parent task is considered "completed" in sprint statistics:
 * A task is counted as completed once it reaches 'Review', 'Ready Test', 'Release', or 'Done/Resolved'.
 * Subtasks are completely excluded from this completion metric per sprint rules.
 */
export const isTaskSprintCompleted = (issue: JiraIssue): boolean => {
  const name = (issue.fields.status?.name || '').trim().toLowerCase();
  const cat = (issue.fields.status?.statusCategory?.key || '').trim().toLowerCase();

  // 1. Done / Closed / Resolved
  if (
    cat === 'done' ||
    name.includes('done') ||
    name.includes('closed') ||
    name.includes('complete') ||
    name.includes('resolved') ||
    name.includes('hoàn thành') ||
    name.includes('đã giải quyết') ||
    name.includes('đã sửa') ||
    name.includes('đóng')
  ) {
    return true;
  }

  // 2. Release / Deploy / Staging / Ready for Release
  if (
    name.includes('release') ||
    name.includes('deploy') ||
    name.includes('staging') ||
    name.includes('triển khai')
  ) {
    return true;
  }

  // 3. Ready Test / Testing / QA / QC / UAT / Ready for Test / Ready to Test
  if (
    name.includes('test') ||
    name.includes('qa') ||
    name.includes('qc') ||
    name.includes('uat') ||
    name.includes('kiểm thử') ||
    name.includes('verif')
  ) {
    return true;
  }

  // 4. Code Review / Review / CR / PR / In Review / Under Review
  if (
    name.includes('review') ||
    name.includes('cr') ||
    name.includes('pull request') ||
    name.includes('pr') ||
    name.includes('đang duyệt') ||
    name.includes('chờ duyệt')
  ) {
    return true;
  }

  return false;
};

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
  const [sprintStateTab, setSprintStateTab] = useState<'active' | 'future' | 'closed' | 'all'>('active');

  // Filter subtasks (default: true to hide subtasks)
  const [hideSubtasks, setHideSubtasks] = useState<boolean>(true);

  // Loading states
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingSprintData, setLoadingSprintData] = useState(false);
  const [movingIssues, setMovingIssues] = useState(false);

  // Selected backlog issues to move
  const [selectedBacklogKeys, setSelectedBacklogKeys] = useState<string[]>([]);
  const [showMoveConfirmModal, setShowMoveConfirmModal] = useState(false);

  // Expanded US keys for subtask hierarchy
  const [expandedStoryKeys, setExpandedStoryKeys] = useState<Record<string, boolean>>({});

  // Modals
  const [detailIssueKey, setDetailIssueKey] = useState<string | null>(null);
  const [createSubtaskParentKey, setCreateSubtaskParentKey] = useState<string | null>(null);
  const [logWorkKey, setLogWorkKey] = useState<string | null>(null);
  const [logWorkSummary, setLogWorkSummary] = useState<string>('');
  const [editingStory, setEditingStory] = useState<JiraIssue | null>(null);
  const [pendingDeleteStory, setPendingDeleteStory] = useState<JiraIssue | null>(null);
  const [isDeletingStory, setIsDeletingStory] = useState(false);

  const executeDeleteStory = async () => {
    if (!pendingDeleteStory) return;
    setIsDeletingStory(true);
    try {
      await jiraApi.deleteIssue(pendingDeleteStory.key, { deleteSubtasks: true });
      toast.success(`Đã xóa User Story ${pendingDeleteStory.key} thành công!`);
      if (selectedSprint) {
        await loadSprintDetailsAndIssues(selectedSprint.id);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Xóa thất bại';
      toast.error(`Xóa User Story thất bại: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    } finally {
      setIsDeletingStory(false);
      setPendingDeleteStory(null);
    }
  };

  // Favorite sprints persisted in localStorage
  const [favoriteSprintIds, setFavoriteSprintIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('jira_favorite_sprint_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(Number);
      }
      const single = localStorage.getItem('jira_favorite_sprint_id');
      if (single) {
        return [Number(single)];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const handleToggleFavorite = (sprintId: number) => {
    const isFav = favoriteSprintIds.includes(sprintId);
    let updated: number[];
    if (isFav) {
      updated = favoriteSprintIds.filter(id => id !== sprintId);
      if (selectedBoardId) {
        const currentBoardFav = localStorage.getItem(`jira_fav_sprint_board_${selectedBoardId}`);
        if (currentBoardFav && Number(currentBoardFav) === sprintId) {
          localStorage.removeItem(`jira_fav_sprint_board_${selectedBoardId}`);
        }
      }
      toast.success('Đã bỏ sprint khỏi danh sách yêu thích');
    } else {
      updated = [...favoriteSprintIds, sprintId];
      if (selectedBoardId) {
        localStorage.setItem(`jira_fav_sprint_board_${selectedBoardId}`, String(sprintId));
      }
      localStorage.setItem('jira_favorite_sprint_id', String(sprintId));
      toast.success('Đã đặt làm Sprint yêu thích! Hệ thống sẽ tự động chọn sprint này khi bạn mở trang.');
    }
    setFavoriteSprintIds(updated);
    try {
      localStorage.setItem('jira_favorite_sprint_ids', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const isCurrentSprintFavorite = selectedSprint ? favoriteSprintIds.includes(selectedSprint.id) : false;

  useEffect(() => {
    loadBoards();
  }, []);

  useEffect(() => {
    if (selectedBoardId) {
      loadSprintsForBoard(selectedBoardId);
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
        let boardIdToSelect = boardList[0].id;
        try {
          const savedBoardId = localStorage.getItem('jira_selected_board_id');
          if (savedBoardId) {
            const match = boardList.find(b => b.id === Number(savedBoardId));
            if (match) boardIdToSelect = match.id;
          }
        } catch (e) {
          console.error(e);
        }
        setSelectedBoardId(boardIdToSelect);
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

      // Check favorite sprint for this board or global favorites
      let favSprint: JiraSprint | null = null;
      try {
        const boardFavId = localStorage.getItem(`jira_fav_sprint_board_${boardId}`);
        if (boardFavId) {
          favSprint = allSprints.find(s => s.id === Number(boardFavId)) || null;
        }
        if (!favSprint) {
          const rawFavs = localStorage.getItem('jira_favorite_sprint_ids');
          const favIds: number[] = rawFavs ? JSON.parse(rawFavs) : [];
          favSprint = allSprints.find(s => favIds.includes(s.id)) || null;
        }
      } catch (e) {
        console.error('Error reading favorite sprint:', e);
      }

      if (favSprint) {
        setSelectedSprint(favSprint);
        if (favSprint.state) {
          setSprintStateTab(favSprint.state as any);
        }
      } else {
        // Auto select active sprint or first
        const active = allSprints.find(s => s.state === 'active') || allSprints[0] || null;
        setSelectedSprint(active);
        if (active?.state) {
          setSprintStateTab(active.state as any);
        } else {
          setSprintStateTab('all');
        }
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
      setShowMoveConfirmModal(false);
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

  // Sprint tasks completion stats (ONLY count parent tasks/stories, exclude subtasks)
  // A task is considered completed when it has transitioned to Review, Ready Test, Release, or Done/Resolved
  const completedTasks = parentIssues.filter(isTaskSprintCompleted).length;
  const totalTasks = parentIssues.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const currentTabSprints = useMemo(() => {
    if (sprintStateTab === 'all') return sprints;
    return sprints.filter(s => s.state === sprintStateTab);
  }, [sprints, sprintStateTab]);

  const sortedTabSprints = useMemo(() => {
    return [...currentTabSprints].sort((a, b) => {
      const aFav = favoriteSprintIds.includes(a.id);
      const bFav = favoriteSprintIds.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [currentTabSprints, favoriteSprintIds]);

  const sprintSelectOptions = useMemo<SelectOption<number>[]>(() => {
    const hasAnyFav = sortedTabSprints.some(s => favoriteSprintIds.includes(s.id));
    return sortedTabSprints.map(s => {
      const isFav = favoriteSprintIds.includes(s.id);
      const hasDates = Boolean(s.startDate && s.endDate);
      const start = s.startDate ? new Date(s.startDate).toLocaleDateString('vi-VN') : null;
      const end = s.endDate ? new Date(s.endDate).toLocaleDateString('vi-VN') : null;
      const datesSnippet = hasDates ? `${start} → ${end}` : 'Chưa xếp lịch';
      const goalSnippet = s.goal ? ` • 🎯 ${s.goal}` : '';
      const favPrefix = isFav ? '⭐ Yêu thích • ' : '';

      return {
        value: s.id,
        label: s.name,
        sublabel: `${favPrefix}#${s.id} • ${datesSnippet}${goalSnippet}`,
        icon: isFav ? (
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
        ) : undefined,
        badge: isFav ? `⭐ ${s.state?.toUpperCase()}` : s.state?.toUpperCase(),
        badgeColor: isFav
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold'
          : s.state === 'active'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
          : s.state === 'future'
          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
          : 'bg-muted text-muted-foreground border border-border',
        group:
          sprintStateTab === 'all'
            ? isFav
              ? '⭐ Sprint Yêu thích'
              : s.state === 'active'
              ? 'Active Sprints'
              : s.state === 'future'
              ? 'Future Sprints'
              : 'Closed Sprints'
            : hasAnyFav
            ? isFav
              ? '⭐ Sprint Yêu thích'
              : `${sprintStateTab === 'active' ? 'Active' : sprintStateTab === 'future' ? 'Future' : 'Closed'} Sprints`
            : undefined
      };
    });
  }, [sortedTabSprints, sprintStateTab, favoriteSprintIds]);

  const currentIndex = sortedTabSprints.findIndex(s => s.id === selectedSprint?.id);
  const hasPrevSprint = currentIndex > 0;
  const hasNextSprint = currentIndex !== -1 && currentIndex < sortedTabSprints.length - 1;

  const handlePrevSprint = () => {
    if (hasPrevSprint) {
      setSelectedSprint(sortedTabSprints[currentIndex - 1]);
    }
  };

  const handleNextSprint = () => {
    if (hasNextSprint) {
      setSelectedSprint(sortedTabSprints[currentIndex + 1]);
    }
  };

  const handleSprintSelect = (sprintId: number) => {
    const found = sprints.find(s => s.id === sprintId);
    if (found) {
      setSelectedSprint(found);
      if (sprintStateTab !== 'all' && found.state && found.state !== sprintStateTab) {
        setSprintStateTab(found.state as any);
      }
    }
  };

  const handleTabChange = (st: 'active' | 'future' | 'closed' | 'all') => {
    setSprintStateTab(st);
    const matched = st === 'all' ? sprints : sprints.filter(s => s.state === st);
    if (selectedSprint && (st === 'all' || selectedSprint.state === st)) {
      return;
    }
    if (matched.length > 0) {
      setSelectedSprint(matched[0]);
    } else {
      setSelectedSprint(null);
    }
  };

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
                onChange={(val) => {
                  setSelectedBoardId(val);
                  try {
                    localStorage.setItem('jira_selected_board_id', String(val));
                  } catch (e) {
                    console.error(e);
                  }
                }}
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
            {(['active', 'future', 'closed', 'all'] as const).map((st) => {
              const count = st === 'all' ? sprints.length : sprints.filter(s => s.state === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleTabChange(st)}
                  className={`py-1.5 px-3.5 text-xs font-bold rounded-xl capitalize transition shrink-0 whitespace-nowrap ${
                    sprintStateTab === st
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st === 'all' ? 'Tất cả' : st} Sprints ({count})
                </button>
              );
            })}
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

      {/* Sprint Selector & Quick Navigation Bar */}
      <div className="bg-card border border-border rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                <FolderKanban className="w-4 h-4 text-indigo-500" />
                <span>Sprint ({sprintStateTab === 'all' ? 'Tất cả' : sprintStateTab}):</span>
              </label>

              {/* Prev / Next 1-click step buttons & Favorite Pin */}
              <div className="flex items-center bg-muted/60 rounded-xl p-0.5 border border-border">
                <button
                  type="button"
                  onClick={handlePrevSprint}
                  disabled={!hasPrevSprint}
                  className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-25 transition"
                  title="Sprint trước (Previous)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSprint}
                  disabled={!hasNextSprint}
                  className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-25 transition"
                  title="Sprint tiếp theo (Next)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-border mx-0.5" />
                <button
                  type="button"
                  onClick={() => selectedSprint && handleToggleFavorite(selectedSprint.id)}
                  disabled={!selectedSprint}
                  className={`p-1.5 rounded-lg transition ${
                    isCurrentSprintFavorite
                      ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/25'
                      : 'text-muted-foreground hover:text-amber-500 hover:bg-background'
                  }`}
                  title={
                    isCurrentSprintFavorite
                      ? 'Bỏ đánh dấu sprint yêu thích'
                      : 'Đặt làm Sprint yêu thích (tự động chọn khi mở trang)'
                  }
                >
                  <Star className={`w-3.5 h-3.5 ${isCurrentSprintFavorite ? 'fill-amber-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* SearchableSelect for Sprints */}
            <div className="flex-1 max-w-2xl min-w-0">
              <SearchableSelect
                options={sprintSelectOptions}
                value={selectedSprint?.id ?? null}
                onChange={(sprintId) => handleSprintSelect(sprintId)}
                placeholder={
                  loadingSprintData
                    ? 'Đang tải danh sách sprints...'
                    : currentTabSprints.length === 0
                    ? `Không có ${sprintStateTab} sprint nào`
                    : 'Tìm & chọn sprint...'
                }
                searchPlaceholder="Tìm sprint theo tên, #ID, ngày hoặc mục tiêu..."
                searchable={true}
                disabled={loadingSprintData || currentTabSprints.length === 0}
                size="md"
              />
            </div>
          </div>

          {/* Right: Sprint state badge & counter */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            {selectedSprint && (
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  selectedSprint.state === 'active'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                    : selectedSprint.state === 'future'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {selectedSprint.state === 'active' && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                )}
                {selectedSprint.state}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {currentIndex >= 0
                ? `${currentIndex + 1} / ${currentTabSprints.length} sprints`
                : `${currentTabSprints.length} sprints`}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State when no sprint selected */}
      {!selectedSprint && !loadingSprintData && (
        <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center space-y-2">
          <FolderKanban className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Chưa chọn sprint</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {currentTabSprints.length === 0
              ? `Không có sprint nào ở trạng thái "${sprintStateTab}". Hãy chọn tab khác hoặc chọn Board khác.`
              : 'Vui lòng chọn một sprint từ danh sách trên để xem chi tiết và danh sách công việc.'}
          </p>
          {sprintStateTab !== 'all' && sprints.length > 0 && currentTabSprints.length === 0 && (
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              Xem tất cả ({sprints.length}) sprints
            </button>
          )}
        </div>
      )}

      {/* Selected Sprint Details Banner */}
      {selectedSprint && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-background to-card border border-indigo-500/20 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 px-2.5 py-0.5 rounded-md">
                  Sprint #{selectedSprint.id}
                </span>
                <h2 className="text-base sm:text-xl font-bold text-foreground">
                  {selectedSprint.name}
                </h2>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(selectedSprint.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition border ${
                    isCurrentSprintFavorite
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25 shadow-2xs'
                      : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                  }`}
                  title={
                    isCurrentSprintFavorite
                      ? 'Bỏ yêu thích sprint này'
                      : 'Đặt làm Sprint yêu thích (tự động chọn khi mở trang)'
                  }
                >
                  <Star className={`w-3.5 h-3.5 ${isCurrentSprintFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{isCurrentSprintFavorite ? 'Sprint yêu thích' : 'Đặt làm yêu thích'}</span>
                </button>
              </div>
              {selectedSprint.goal && (
                <p className="text-xs sm:text-sm text-foreground/80 italic font-medium">
                  🎯 Goal: "{selectedSprint.goal}"
                </p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500/80 shrink-0" />
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
                <span className="text-[11px] font-semibold text-muted-foreground block">Tasks Completed</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-foreground">
                    {completedTasks}/{totalTasks}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ({progressPercent}%)
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block font-medium" title="Tính các task đạt trạng thái Review, Ready Test, Release hoặc Done/Resolved">
                  Review / Test / Release ({completedTasks}/{totalTasks} tasks)
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

                          {/* Quick Action: Edit User Story */}
                          <button
                            type="button"
                            onClick={() => setEditingStory(story)}
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 transition"
                            title="Chỉnh sửa User Story"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Action: Delete User Story */}
                          <button
                            type="button"
                            onClick={() => setPendingDeleteStory(story)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition"
                            title="Xóa User Story"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                onClick={() => setShowMoveConfirmModal(true)}
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

      {/* Confirm Move Backlog to Sprint Modal */}
      <ConfirmModal
        isOpen={showMoveConfirmModal}
        title="Xác nhận chuyển công việc vào Sprint"
        description={
          <span>
            Bạn có chắc chắn muốn chuyển <strong className="text-foreground">{selectedBacklogKeys.length} công việc</strong> đã chọn ({selectedBacklogKeys.join(', ')}) từ Backlog vào sprint <span className="font-semibold text-primary">"{selectedSprint?.name}"</span> không?
          </span>
        }
        confirmText={`Chuyển ${selectedBacklogKeys.length} công việc`}
        cancelText="Hủy bỏ"
        variant="primary"
        loading={movingIssues}
        onConfirm={handleMoveBacklogToSprint}
        onClose={() => {
          if (!movingIssues) setShowMoveConfirmModal(false);
        }}
      />

      {/* Edit Story Modal */}
      {editingStory && (
        <EditStoryModal
          isOpen={Boolean(editingStory)}
          onClose={() => setEditingStory(null)}
          story={editingStory}
          onSuccess={() => {
            if (selectedSprint) {
              loadSprintDetailsAndIssues(selectedSprint.id);
            }
          }}
        />
      )}

      {/* Confirm Delete Story Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteStory)}
        title={`Xác nhận xóa User Story ${pendingDeleteStory?.key || ''}`}
        description={(
          <div className="space-y-2">
            <p>
              Bạn có chắc chắn muốn xóa User Story <strong className="text-foreground">{pendingDeleteStory?.key}</strong>: <span className="font-semibold text-foreground">{pendingDeleteStory?.fields.summary}</span> không?
            </p>
            <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              ⚠️ Cảnh báo: Thao tác này sẽ xóa vĩnh viễn User Story và tất cả các Subtask con liên quan trên Jira!
            </p>
          </div>
        )}
        confirmText="Xác nhận xóa vĩnh viễn"
        cancelText="Hủy bỏ"
        variant="destructive"
        loading={isDeletingStory}
        onConfirm={executeDeleteStory}
        onClose={() => {
          if (!isDeletingStory) setPendingDeleteStory(null);
        }}
      />
    </div>
  );
};
