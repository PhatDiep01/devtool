import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  Filter, 
  Layers, 
  ArrowRight, 
  ArrowLeft as ArrowBack,
  Check, 
  RotateCcw,
  Plus, 
  Clock, 
  User, 
  GitBranch,
  Search,
  Bookmark,
  Bug,
  CheckSquare
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { jiraApi } from '../../../services/api';
import { JiraSprint, JiraIssue, JiraBoardColumn } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { LogWorkModal } from '../components/LogWorkModal';
import { SearchableSelect, SelectOption, ConfirmModal } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { usePageTitle } from '../../../utils/usePageTitle';

export interface DynamicBoardColumn {
  id: string;
  name: string;
  statusIds: string[];
}

export const KanbanBoard: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  const currentSprint = sprints.find(s => String(s.id) === selectedSprintId);
  const boardTitle = currentSprint ? `${currentSprint.name} - Kanban Board` : 'Kanban Board';
  usePageTitle(boardTitle, [boardTitle]);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [columns, setColumns] = useState<DynamicBoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileColumn, setMobileColumn] = useState<string>('all');

  // Filter states: Default hideSubtasks = true (as requested)
  const [hideSubtasks, setHideSubtasks] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [detailIssueKey, setDetailIssueKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [logWorkKey, setLogWorkKey] = useState<string | null>(null);
  const [logWorkSummary, setLogWorkSummary] = useState<string>('');

  // Status transition confirmation state
  const [pendingMove, setPendingMove] = useState<{
    issueKey: string;
    issueSummary?: string;
    targetColId: string;
    targetColName: string;
    currentStatusName?: string;
  } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (!boardId) return;
    loadBoardData();
  }, [boardId]);

  const loadBoardData = async () => {
    setLoading(true);
    try {
      const [spRes, configRes] = await Promise.all([
        jiraApi.getSprints(Number(boardId)),
        jiraApi.getBoardConfiguration(Number(boardId)).catch(() => ({ data: null }))
      ]);

      // Parse dynamic columns from Jira Board Configuration
      const rawCols = configRes?.data?.columnConfig?.columns;
      if (Array.isArray(rawCols) && rawCols.length > 0) {
        const parsedCols: DynamicBoardColumn[] = rawCols.map((c: any, index: number) => ({
          id: `col-${index}-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: c.name,
          statusIds: (c.statuses || []).map((s: any) => String(s.id))
        }));
        setColumns(parsedCols);
      } else {
        // Fallback default agile columns if configuration endpoint unavailable
        setColumns([
          { id: 'col-todo', name: 'To Do', statusIds: ['1', '4', '10000'] },
          { id: 'col-inprogress', name: 'In Progress', statusIds: ['3', '10136', '10200', '10201', '10119', '10125', '10133'] },
          { id: 'col-done', name: 'Done', statusIds: ['6', '10001', '10004', '10005'] }
        ]);
      }

      setSprints(spRes.data || []);
      if (spRes.data && spRes.data.length > 0) {
        const active = spRes.data.find((s: any) => s.state === 'active') || spRes.data[0];
        setSelectedSprintId(String(active.id));
        loadSprintIssues(active.id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const loadSprintIssues = async (sprintId: number) => {
    setLoading(true);
    try {
      const issRes = await jiraApi.getSprintIssues(sprintId);
      setIssues(Array.isArray(issRes.data) ? issRes.data : []);
    } catch (err) {
      console.error(err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSprintChange = (sId: string) => {
    setSelectedSprintId(sId);
    loadSprintIssues(Number(sId));
  };

  // Helper to identify subtasks reliably across Jira Server & Cloud
  const isSubtask = (iss: JiraIssue): boolean => {
    if (!iss || !iss.fields) return false;
    if (iss.fields.issuetype?.subtask === true) return true;
    if (Boolean(iss.fields.parent)) return true;
    const typeName = iss.fields.issuetype?.name?.toLowerCase() || '';
    return typeName.includes('sub-task') || typeName.includes('subtask') || typeName.includes('sub task');
  };

  // Counts
  const subtasksCount = Array.isArray(issues) ? issues.filter(isSubtask).length : 0;

  // Group issues into dynamic board columns
  const getCategorized = () => {
    const grouped: Record<string, JiraIssue[]> = {};
    const safeColumns = Array.isArray(columns) ? columns : [];
    safeColumns.forEach(col => {
      grouped[col.id] = [];
    });

    let filtered = Array.isArray(issues) ? issues : [];
    
    // Filter out subtasks if hideSubtasks is enabled
    if (hideSubtasks) {
      filtered = filtered.filter(iss => !isSubtask(iss));
    }

    // Filter by text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(iss => 
        iss.key.toLowerCase().includes(q) ||
        iss.fields.summary.toLowerCase().includes(q) ||
        iss.fields.assignee?.displayName?.toLowerCase().includes(q)
      );
    }

    filtered.forEach((iss) => {
      const statusId = String(iss.fields.status?.id || '');
      const statusName = (iss.fields.status?.name || '').toLowerCase();
      const statusCat = iss.fields.status?.statusCategory?.key;

      // 1. Match by mapped status ID
      let matchedCol = columns.find(c => c.statusIds.includes(statusId));

      // 2. Match by exact status name
      if (!matchedCol) {
        matchedCol = columns.find(c => c.name.toLowerCase() === statusName);
      }

      // 3. Match by partial status name
      if (!matchedCol) {
        matchedCol = columns.find(c => 
          statusName.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(statusName)
        );
      }

      // 4. Match by status category (done -> last, new -> first, else middle)
      if (!matchedCol && columns.length > 0) {
        if (statusCat === 'done') {
          matchedCol = columns[columns.length - 1];
        } else if (statusCat === 'new') {
          matchedCol = columns[0];
        } else {
          matchedCol = columns[Math.floor(columns.length / 2)];
        }
      }

      if (matchedCol && grouped[matchedCol.id]) {
        grouped[matchedCol.id].push(iss);
      } else if (columns.length > 0) {
        grouped[columns[0].id]?.push(iss);
      }
    });

    return { grouped, totalVisible: filtered.length };
  };

  const { grouped, totalVisible } = getCategorized();

  const moveIssueToColumn = async (draggableId: string, targetColId: string) => {
    const targetCol = columns.find(c => c.id === targetColId);
    if (!targetCol) return;

    // Optimistically update issue in local state
    setIssues(prevIssues => 
      prevIssues.map(issue => {
        if (issue.key === draggableId) {
          return {
            ...issue,
            fields: {
              ...issue.fields,
              status: {
                ...issue.fields.status,
                name: targetCol.name,
                id: targetCol.statusIds[0] || issue.fields.status.id
              }
            }
          };
        }
        return issue;
      })
    );

    try {
      const transitionsRes = await jiraApi.getTransitions(draggableId);
      const transitions: any[] = transitionsRes.data || [];

      // Find best transition match:
      // 1. Target column's statusIds
      let match = transitions.find(t => targetCol.statusIds.includes(String(t.to?.id)));

      // 2. Status name
      if (!match) {
        match = transitions.find(t => (t.to?.name || '').toLowerCase() === targetCol.name.toLowerCase());
      }

      // 3. Transition name
      if (!match) {
        match = transitions.find(t => (t.name || '').toLowerCase().includes(targetCol.name.toLowerCase()));
      }

      if (match) {
        await jiraApi.transitionIssue(draggableId, match.id);
        toast.success(`Đã chuyển ${draggableId} sang "${targetCol.name}"`);
      } else {
        toast.error(`Jira workflow không hỗ trợ chuyển trực tiếp từ trạng thái hiện tại sang "${targetCol.name}"`);
        if (selectedSprintId) {
          loadSprintIssues(Number(selectedSprintId));
        }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.errorMessages?.[0] || err.message;
      toast.error(`Lỗi chuyển trạng thái: ${errMsg}`);
      if (selectedSprintId) {
        loadSprintIssues(Number(selectedSprintId));
      }
    }
  };

  const requestMove = (draggableId: string, targetColId: string) => {
    const targetCol = columns.find(c => c.id === targetColId);
    if (!targetCol) return;
    const issue = issues.find(i => i.key === draggableId);
    const currentStatus = issue?.fields?.status?.name || 'Hiện tại';
    
    // Check if destination column is already the current status column
    if (targetCol.name.toLowerCase() === currentStatus.toLowerCase()) {
      return;
    }

    setPendingMove({
      issueKey: draggableId,
      issueSummary: issue?.fields?.summary,
      targetColId,
      targetColName: targetCol.name,
      currentStatusName: currentStatus
    });
  };

  const confirmMove = async () => {
    if (!pendingMove) return;
    setIsMoving(true);
    try {
      await moveIssueToColumn(pendingMove.issueKey, pendingMove.targetColId);
    } finally {
      setIsMoving(false);
      setPendingMove(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    if (destination.droppableId === source.droppableId) return;

    requestMove(draggableId, destination.droppableId);
  };

  // Color theme generator for dynamic columns
  const getColumnColor = (name: string, index: number, total: number) => {
    const n = name.toLowerCase();
    if (n.includes('to do') || n.includes('open') || n.includes('backlog')) {
      return {
        dot: 'bg-slate-400',
        badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        border: 'border-slate-500/30'
      };
    }
    if (n.includes('analysis') || n.includes('spec') || n.includes('plan')) {
      return {
        dot: 'bg-purple-500',
        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        border: 'border-purple-500/30'
      };
    }
    if (n.includes('be') || n.includes('backend')) {
      return {
        dot: 'bg-blue-500',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        border: 'border-blue-500/30'
      };
    }
    if (n.includes('fe') || n.includes('frontend')) {
      return {
        dot: 'bg-cyan-500',
        badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
        border: 'border-cyan-500/30'
      };
    }
    if (n.includes('review') || n.includes('cr') || n.includes('code')) {
      return {
        dot: 'bg-amber-500',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        border: 'border-amber-500/30'
      };
    }
    if (n.includes('test') || n.includes('qa') || n.includes('qc')) {
      return {
        dot: 'bg-rose-500',
        badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        border: 'border-rose-500/30'
      };
    }
    if (n.includes('release') || n.includes('deploy') || n.includes('staging')) {
      return {
        dot: 'bg-teal-500',
        badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        border: 'border-teal-500/30'
      };
    }
    if (n.includes('done') || n.includes('close') || index === total - 1) {
      return {
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        border: 'border-emerald-500/30'
      };
    }
    return {
      dot: 'bg-primary',
      badge: 'bg-primary/10 text-primary border-primary/20',
      border: 'border-primary/30'
    };
  };

  // Helper to render type badge
  const renderTypeIcon = (typeName?: string) => {
    const t = (typeName || '').toLowerCase();
    if (t.includes('bug')) return <Bug className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    if (t.includes('story')) return <Bookmark className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (t.includes('sub')) return <GitBranch className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    return <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  };

  const sprintOptions = useMemo<SelectOption<string>[]>(() => {
    return sprints.map((s) => ({
      value: String(s.id),
      label: s.name,
      badge: s.state?.toUpperCase(),
      badgeColor: s.state === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    }));
  }, [sprints]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1920px] mx-auto space-y-4 animate-in fade-in flex flex-col h-full min-w-0">
      {/* Header & Sprint Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jira')}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">All Boards</span>
          </button>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Kanban Board</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent border border-border text-muted-foreground font-medium tabular-nums">
                {columns.length} cột trạng thái
              </span>
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sprints.length > 0 && (
            <div className="w-56 sm:w-64">
              <SearchableSelect
                options={sprintOptions}
                value={selectedSprintId}
                onChange={(val) => handleSprintChange(val)}
                placeholder="Chọn sprint..."
                searchPlaceholder="Tìm kiếm sprint..."
                size="sm"
              />
            </div>
          )}

          <button
            onClick={() => selectedSprintId && loadSprintIssues(Number(selectedSprintId))}
            className="p-2 rounded-xl border border-border hover:bg-accent text-muted-foreground transition-colors shrink-0"
            title="Làm mới danh sách công việc trong sprint"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Issue</span>
          </button>
        </div>
      </div>

      {/* FILTER TOOLBAR: HIDE SUBTASK FILTER + SEARCH INPUT + METRICS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Subtask Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setHideSubtasks(!hideSubtasks)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition border shadow-xs ${
              hideSubtasks
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15'
                : 'bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            title={hideSubtasks ? 'Đang ẩn Subtask (Bấm để hiện tất cả)' : 'Đang hiện tất cả (Bấm để lọc ẩn Subtask)'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{hideSubtasks ? 'Đang lọc: Ẩn Subtask' : 'Hiện toàn bộ (kèm Subtask)'}</span>
            {subtasksCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                hideSubtasks 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {hideSubtasks ? `-${subtasksCount}` : `+${subtasksCount}`}
              </span>
            )}
          </button>

          {/* Quick Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc mã hoặc tiêu đề công việc..."
              className="bg-background border border-border rounded-xl pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-48 sm:w-64 transition font-medium"
            />
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Status Count Summary */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Đang hiển thị: <b className="text-foreground">{totalVisible}</b> công việc</span>
          {subtasksCount > 0 && hideSubtasks && (
            <span className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
              Đã lọc {subtasksCount} subtask
            </span>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Column Selector Tabs */}
      <div className="flex xl:hidden bg-card border border-border rounded-xl p-1 gap-1 overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setMobileColumn('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition ${
            mobileColumn === 'all' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          Tất cả ({totalVisible})
        </button>
        {columns.map((col, idx) => {
          const colCount = (grouped[col.id] || []).length;
          const colColor = getColumnColor(col.name, idx, columns.length);
          return (
            <button
              key={col.id}
              onClick={() => setMobileColumn(col.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition flex items-center gap-1.5 ${
                mobileColumn === col.id ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${colColor.dot}`} />
              <span>{col.name}</span>
              <span className="text-[10px] opacity-80 font-mono">({colCount})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Đang tải các cột trạng thái và công việc...</span>
        </div>
      ) : sprints.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-sm max-w-lg mx-auto my-8">
          <Layers className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <h3 className="font-bold text-base text-foreground">Không có sprint hoạt động cho board này</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Board này hiện chưa có sprint active. Nếu đây là Kanban thuần túy, công việc có thể nằm trong backlog của dự án.
          </p>
          <button
            onClick={() => navigate('/jira')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl mt-2 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại danh sách Boards</span>
          </button>
        </div>
      ) : (
        /* DYNAMIC KANBAN BOARD WITH HORIZONTAL SCROLLING FOR ALL COLUMNS */
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6 pt-1 scrollbar-thin flex-1 items-start min-h-[550px]">
            {columns.map((col, colIndex) => {
              if (mobileColumn !== 'all' && mobileColumn !== col.id) {
                return null;
              }

              const colIssues = grouped[col.id] || [];
              const colColor = getColumnColor(col.name, colIndex, columns.length);
              const prevCol = colIndex > 0 ? columns[colIndex - 1] : null;
              const nextCol = colIndex < columns.length - 1 ? columns[colIndex + 1] : null;

              return (
                <div 
                  key={col.id} 
                  className="w-[285px] sm:w-[310px] shrink-0 bg-muted/20 border border-border/80 rounded-2xl p-3.5 flex flex-col min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3.5 px-1 pb-2.5 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colColor.dot}`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate" title={col.name}>
                        {col.name}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${colColor.badge}`}>
                      {colIssues.length}
                    </span>
                  </div>

                  {/* Droppable Issue Area */}
                  <Droppable droppableId={col.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 flex-1 min-h-[150px]">
                        {colIssues.map((item, index) => {
                          const subtasks = item.fields.subtasks || [];
                          const completedSubtasks = subtasks.filter((st: any) => st.fields?.status?.statusCategory?.key === 'done').length;

                          return (
                            <Draggable key={item.key} draggableId={item.key} index={index}>
                              {(dragProvided) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => setDetailIssueKey(item.key)}
                                  className="bg-card border border-border hover:border-primary/50 transition-all rounded-xl p-3.5 shadow-sm cursor-pointer group space-y-2.5"
                                >
                                  {/* Card Header: Type + Key + Priority */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {renderTypeIcon(item.fields.issuetype?.name)}
                                      <span className="text-xs font-mono font-bold text-blue-500 group-hover:underline truncate">{item.key}</span>
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                                      {item.fields.priority?.name || 'Medium'}
                                    </span>
                                  </div>

                                  {/* Summary */}
                                  <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                                    {item.fields.summary}
                                  </h4>

                                  {/* Subtasks Progress Indicator */}
                                  {subtasks.length > 0 && (
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-accent/60 px-2 py-1 rounded-lg">
                                      <GitBranch className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                      <span>{completedSubtasks}/{subtasks.length} subtask</span>
                                      <div className="flex-1 bg-border/80 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                          className="bg-indigo-500 h-full rounded-full transition-all" 
                                          style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Card Footer: Assignee + Quick Action Directional Buttons */}
                                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {item.fields.assignee ? (
                                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate" title={item.fields.assignee.displayName}>
                                          <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                            {item.fields.assignee.displayName.charAt(0)}
                                          </div>
                                          <span className="truncate max-w-[65px]">{item.fields.assignee.displayName.split(' ')[0]}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground/60 italic">Unassigned</span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLogWorkKey(item.key);
                                          setLogWorkSummary(item.fields.summary);
                                        }}
                                        className="p-1 text-muted-foreground hover:text-blue-500 rounded hover:bg-accent"
                                        title="Log Time"
                                      >
                                        <Clock className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {/* Directional Move Buttons */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {prevCol && (
                                        <button
                                          type="button"
                                          onClick={() => requestMove(item.key, prevCol.id)}
                                          className="p-1 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-[10px] transition"
                                          title={`Chuyển lùi về: ${prevCol.name}`}
                                        >
                                          <ArrowBack className="w-3 h-3" />
                                        </button>
                                      )}
                                      {nextCol && (
                                        <button
                                          type="button"
                                          onClick={() => requestMove(item.key, nextCol.id)}
                                          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold transition"
                                          title={`Chuyển tiếp sang: ${nextCol.name}`}
                                        >
                                          <span>Tiếp</span>
                                          <ArrowRight className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* MODALS */}
      {detailIssueKey && (
        <IssueDetailModal
          isOpen={Boolean(detailIssueKey)}
          issueKey={detailIssueKey}
          onClose={() => setDetailIssueKey(null)}
          onIssueUpdated={() => selectedSprintId && loadSprintIssues(Number(selectedSprintId))}
        />
      )}

      {showCreateModal && (
        <CreateIssueModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => selectedSprintId && loadSprintIssues(Number(selectedSprintId))}
        />
      )}

      {logWorkKey && (
        <LogWorkModal
          isOpen={Boolean(logWorkKey)}
          initialIssueKey={logWorkKey}
          initialIssueSummary={logWorkSummary}
          onClose={() => setLogWorkKey(null)}
          onSuccess={() => selectedSprintId && loadSprintIssues(Number(selectedSprintId))}
        />
      )}

      {/* Confirm Status Transition Modal */}
      <ConfirmModal
        isOpen={!!pendingMove}
        title="Xác nhận chuyển trạng thái"
        description={
          pendingMove ? (
            <span>
              Bạn có chắc chắn muốn chuyển trạng thái công việc{' '}
              <strong className="text-foreground">{pendingMove.issueKey}</strong>
              {pendingMove.issueSummary ? ` (${pendingMove.issueSummary})` : ''} sang cột{' '}
              <span className="font-semibold text-primary">"{pendingMove.targetColName}"</span> không?
            </span>
          ) : ''
        }
        confirmText="Xác nhận chuyển"
        cancelText="Hủy bỏ"
        variant="primary"
        loading={isMoving}
        onConfirm={confirmMove}
        onClose={() => {
          if (!isMoving) setPendingMove(null);
        }}
      />
    </div>
  );
};
