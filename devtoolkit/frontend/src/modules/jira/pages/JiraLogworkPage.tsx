import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  User, 
  Tag, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  History,
  ExternalLink,
  Filter,
  GitBranch,
  Layers,
  AlertTriangle,
  Edit3,
  Trash2
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { JiraIssue, JiraWorklogItem, WeeklyCalendarResponse, JiraAssignedSubtask } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { EditWorklogModal, EditableWorklog } from '../components/EditWorklogModal';
import { WeeklyLogworkCalendar } from '../components/WeeklyLogworkCalendar';
import { SubtaskPicker } from '../components/SubtaskPicker';
import { WorklogDescriptionSuggestions } from '../components/WorklogDescriptionSuggestions';
import { DateTimePicker, ConfirmModal } from '../../../components/ui';
import { toast } from 'react-hot-toast';
import { 
  parseTimePreview, 
  formatSecondsToDuration, 
  extractSubtaskEstimates 
} from '../../../utils/jiraTime';

export const JiraLogworkPage: React.FC = () => {
  const { user } = useJiraAuthStore();
  const formRef = useRef<HTMLDivElement>(null);

  // Form State
  const [issueKey, setIssueKey] = useState('');
  const [issueSummary, setIssueSummary] = useState('');
  const [selectedIssueStatus, setSelectedIssueStatus] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'subtask' | 'manual'>('subtask');
  const [timeSpent, setTimeSpent] = useState('1h');
  const [suggestedEstimate, setSuggestedEstimate] = useState<string | null>(null);
  const [suggestedRemaining, setSuggestedRemaining] = useState<string | null>(null);
  const [started, setStarted] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data lists
  const [myIssues, setMyIssues] = useState<JiraIssue[]>([]);
  const [recentWorklogs, setRecentWorklogs] = useState<JiraWorklogItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [searchParams] = useSearchParams();

  // Handle preselected issue from search navigation
  useEffect(() => {
    const targetKey = searchParams.get('issue') || searchParams.get('subtask') || searchParams.get('key');
    if (targetKey) {
      const clean = targetKey.trim().toUpperCase();
      setIssueKey(clean);
      setInputMode('manual');
      loadTaskDetails(clean);
    }
  }, [searchParams]);

  // Weekly Calendar state
  const [calendarData, setCalendarData] = useState<WeeklyCalendarResponse | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Task specific timetracking and worklogs
  const [taskTimetracking, setTaskTimetracking] = useState<{
    timeSpent?: string;
    remainingEstimate?: string;
    originalEstimate?: string;
  } | null>(null);
  const [taskWorklogs, setTaskWorklogs] = useState<any[]>([]);
  const [loadingTaskWorklogs, setLoadingTaskWorklogs] = useState(false);
  const [worklogTab, setWorklogTab] = useState<'task' | 'recent'>('task');
  
  // Issue detail modal
  const [selectedDetailKey, setSelectedDetailKey] = useState<string | null>(null);

  // Worklog edit & delete states
  const [editingWorklog, setEditingWorklog] = useState<EditableWorklog | null>(null);
  const [pendingDeleteWorklog, setPendingDeleteWorklog] = useState<{
    id: string;
    issueKey: string;
    issueSummary?: string;
    timeSpent: string;
    started?: string;
    author?: string;
  } | null>(null);
  const [isDeletingWorklog, setIsDeletingWorklog] = useState(false);

  const handleWorklogMutationSuccess = () => {
    loadPageData();
    loadWeeklyCalendar(weekOffset);
    if (issueKey.trim()) {
      loadTaskDetails(issueKey.trim());
    }
  };

  const executeDeleteWorklog = async () => {
    if (!pendingDeleteWorklog) return;
    setIsDeletingWorklog(true);
    try {
      await jiraApi.deleteWorklog(pendingDeleteWorklog.issueKey, pendingDeleteWorklog.id);
      toast.success(`Đã xóa lượt log work (${pendingDeleteWorklog.timeSpent}) thành công!`);
      handleWorklogMutationSuccess();
    } catch (err: any) {
      toast.error(`Xóa log work thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsDeletingWorklog(false);
      setPendingDeleteWorklog(null);
    }
  };

  useEffect(() => {
    loadPageData();
    loadWeeklyCalendar(0);
  }, []);

  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Compute week range based on offset
  const getWeekRange = (offset: number = 0) => {
    const now = new Date();
    now.setDate(now.getDate() + offset * 7);
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      startDate: formatLocalDate(monday),
      endDate: formatLocalDate(sunday)
    };
  };

  const loadWeeklyCalendar = async (offset: number) => {
    setLoadingCalendar(true);
    try {
      const { startDate, endDate } = getWeekRange(offset);
      const res = await jiraApi.getWeeklyWorklogs({ startDate, endDate });
      setCalendarData(res.data);
    } catch (err) {
      console.error('Failed to load weekly worklogs:', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleNavigateWeek = (delta: number) => {
    const nextOffset = weekOffset + delta;
    setWeekOffset(nextOffset);
    loadWeeklyCalendar(nextOffset);
  };

  const handleResetToCurrentWeek = () => {
    setWeekOffset(0);
    loadWeeklyCalendar(0);
  };

  const handleSelectDayForLog = (dateStr: string) => {
    // Set started datetime to that day at 08:30 (or keep hour if today)
    const now = new Date();
    const isToday = dateStr === now.toISOString().slice(0, 10);
    const timePortion = isToday
      ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      : '08:30';

    setStarted(`${dateStr}T${timePortion}`);
    toast.success(`Đã chọn ngày ${dateStr} để ghi log work!`, { icon: '📅' });

    // Scroll smoothly to the form
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTaskDetails = async (key: string) => {
    if (!key.trim()) {
      setTaskTimetracking(null);
      setTaskWorklogs([]);
      setSelectedIssueStatus(null);
      return;
    }
    setLoadingTaskWorklogs(true);
    try {
      const [issueRes, worklogsRes] = await Promise.all([
        jiraApi.getIssue(key).catch(() => null),
        jiraApi.getWorklogs(key).catch(() => ({ data: { worklogs: [] } }))
      ]);

      if (issueRes?.data) {
        setIssueSummary(issueRes.data.fields?.summary || '');
        setSelectedIssueStatus(issueRes.data.fields?.status?.name || null);
        const tt = issueRes.data.fields?.timetracking;
        const origSec = typeof tt?.originalEstimateSeconds === 'number'
          ? tt.originalEstimateSeconds
          : (typeof issueRes.data.fields?.timeoriginalestimate === 'number' ? issueRes.data.fields.timeoriginalestimate : 0);
        const remSec = typeof tt?.remainingEstimateSeconds === 'number'
          ? tt.remainingEstimateSeconds
          : (typeof issueRes.data.fields?.timeestimate === 'number' ? issueRes.data.fields.timeestimate : 0);
        const spentSec = typeof tt?.timeSpentSeconds === 'number'
          ? tt.timeSpentSeconds
          : (typeof issueRes.data.fields?.timespent === 'number' ? issueRes.data.fields.timespent : 0);

        const origStr = tt?.originalEstimate || (origSec > 0 ? formatSecondsToDuration(origSec) : 'None');
        const remStr = tt?.remainingEstimate || (issueRes.data.fields?.timeestimate !== undefined && issueRes.data.fields?.timeestimate !== null ? formatSecondsToDuration(remSec) : 'Not set');
        const spentStr = tt?.timeSpent || (spentSec > 0 ? formatSecondsToDuration(spentSec) : '0m');

        setTaskTimetracking({
          timeSpent: spentStr,
          remainingEstimate: remStr,
          originalEstimate: origStr
        });

        const { estimate, remaining } = extractSubtaskEstimates({
          originalEstimate: origStr,
          remainingEstimate: remStr,
          originalEstimateSeconds: origSec,
          remainingEstimateSeconds: remSec
        });

        setSuggestedEstimate(estimate);
        setSuggestedRemaining(remaining);
        if (estimate && (!timeSpent || timeSpent === '1h')) {
          setTimeSpent(estimate);
        }
      }

      setTaskWorklogs(worklogsRes.data?.worklogs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTaskWorklogs(false);
    }
  };

  const loadPageData = async () => {
    setLoadingInitial(true);
    try {
      const [issuesRes, worklogsRes] = await Promise.all([
        jiraApi.getMyIssues().catch(() => ({ data: [] })),
        jiraApi.getRecentWorklogs().catch(() => ({ data: [] }))
      ]);

      setMyIssues(issuesRes.data || []);
      setRecentWorklogs(worklogsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSelectSubtaskFromPicker = (st: JiraAssignedSubtask) => {
    setIssueKey(st.key);
    setIssueSummary(st.summary);
    setSelectedIssueStatus(st.status?.name || null);
    if (st.timetracking) {
      setTaskTimetracking({
        timeSpent: st.timetracking.timeSpent || '0m',
        remainingEstimate: st.timetracking.remainingEstimate || 'Not set',
        originalEstimate: st.timetracking.originalEstimate || 'None'
      });
      const { estimate, remaining } = extractSubtaskEstimates(st.timetracking);
      setSuggestedEstimate(estimate);
      setSuggestedRemaining(remaining);
      if (estimate) {
        setTimeSpent(estimate);
      }
    } else {
      setSuggestedEstimate(null);
      setSuggestedRemaining(null);
    }
    loadTaskDetails(st.key);
  };

  // Auto-fetch task details when valid issue key is entered in manual mode
  useEffect(() => {
    if (inputMode === 'manual' && issueKey.trim().match(/^[A-Z0-9]+-\d+$/i)) {
      const timer = setTimeout(() => {
        loadTaskDetails(issueKey.trim().toUpperCase());
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [issueKey, inputMode]);

  const preview = parseTimePreview(timeSpent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = issueKey.trim().toUpperCase();

    if (!cleanKey) {
      toast.error('Vui lòng chọn hoặc nhập mã Jira Issue Key');
      return;
    }

    if (!preview.valid || preview.seconds <= 0) {
      toast.error('Vui lòng nhập định dạng thời gian hợp lệ (ví dụ: "1h 30m", "45m", "1d")');
      return;
    }

    if (!started || !started.trim() || isNaN(new Date(started).getTime())) {
      toast.error('Vui lòng chọn ngày và giờ bắt đầu hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const hasEstimate = Boolean(
        taskTimetracking?.remainingEstimate &&
        taskTimetracking.remainingEstimate !== 'Chưa đặt' &&
        taskTimetracking.remainingEstimate !== 'Not set' &&
        taskTimetracking.remainingEstimate !== '0m' &&
        taskTimetracking.remainingEstimate !== '0h'
      );

      await jiraApi.createWorklog(cleanKey, {
        timeSpent: timeSpent.trim(),
        timeSpentSeconds: preview.seconds,
        started: new Date(started).toISOString(),
        comment: comment.trim() || undefined,
        adjustEstimate: hasEstimate ? 'auto' : 'leave'
      });

      toast.success(`Đã ghi log thành công ${timeSpent} cho ${cleanKey}!`);
      setComment('');
      
      // Refresh weekly calendar, recent worklogs and task details
      loadWeeklyCalendar(weekOffset);
      const updatedWorklogs = await jiraApi.getRecentWorklogs().catch(() => ({ data: [] }));
      setRecentWorklogs(updatedWorklogs.data || []);
      if (cleanKey) {
        await loadTaskDetails(cleanKey);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Lỗi ghi log work vào Jira';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const isSelectedStatusDone = selectedIssueStatus && 
    ['done', 'rejected', 'cancelled', 'close', 'closed'].includes(selectedIssueStatus.toLowerCase());

  // Metrics
  const totalSecondsLogged = recentWorklogs.reduce((acc, curr) => acc + (curr.timeSpentSeconds || 0), 0);
  const totalHoursLogged = (totalSecondsLogged / 3600).toFixed(1);

  const filteredWorklogs = recentWorklogs.filter(w => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      w.issueKey.toLowerCase().includes(q) ||
      w.issueSummary.toLowerCase().includes(q) ||
      (w.commentText && w.commentText.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & TIMESHEET STATUS */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Chấm công Log Work & Timesheet
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Jira Server / DC
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Ghi nhận thời gian làm việc trực tiếp vào Jira, theo dõi lịch tuần, số lượng Task và Subtask hoàn thành.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadPageData();
                loadWeeklyCalendar(weekOffset);
              }}
              disabled={loadingInitial || loadingCalendar}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Làm mới bảng logwork"
            >
              <RefreshCw className={`w-4 h-4 ${loadingInitial || loadingCalendar ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. WEEKLY CALENDAR & KPI TIMESHEET (USER REQUEST: CALENDAR THEO TUẦN) */}
      <WeeklyLogworkCalendar
        calendarData={calendarData}
        loading={loadingCalendar}
        onNavigateWeek={handleNavigateWeek}
        onResetToCurrentWeek={handleResetToCurrentWeek}
        onSelectDayForLog={handleSelectDayForLog}
        onOpenIssueDetail={(key) => setSelectedDetailKey(key)}
        onEditWorklog={(w) => setEditingWorklog({
          id: w.worklogId,
          issueKey: w.issueKey,
          issueSummary: w.issueSummary,
          timeSpent: w.timeSpent,
          started: w.started,
          commentText: w.commentText
        })}
        onDeleteWorklog={(w) => setPendingDeleteWorklog({
          id: w.worklogId,
          issueKey: w.issueKey,
          issueSummary: w.issueSummary,
          timeSpent: w.timeSpent,
          started: w.started,
          author: w.author?.displayName
        })}
        currentWeekOffset={weekOffset}
      />

      {/* 3. MAIN WORK SECTION: LOG FORM (LEFT) & WORKLOG HISTORY (RIGHT) */}
      <div ref={formRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Log Work */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-sm sm:text-base text-foreground">Ghi nhận giờ làm việc (Log work)</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode Tabs: Subtask Picker vs Manual Input */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setInputMode('subtask')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                  inputMode === 'subtask'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Subtask của tôi</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                  inputMode === 'manual'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Nhập mã tự do</span>
              </button>
            </div>

            {/* Subtask Picker Mode */}
            {inputMode === 'subtask' ? (
              <SubtaskPicker
                selectedKey={issueKey}
                onSelectSubtask={handleSelectSubtaskFromPicker}
              />
            ) : (
              /* Manual Input Mode */
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Issue Key *</span>
                  {issueSummary && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px] font-normal">
                      {issueSummary}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={issueKey}
                  onChange={(e) => setIssueKey(e.target.value.toUpperCase())}
                  onBlur={() => {
                    if (issueKey.trim()) loadTaskDetails(issueKey.trim().toUpperCase());
                  }}
                  placeholder="e.g. EMSPRO2-13222, SURV-101"
                  required
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-primary transition"
                />

                {/* Quick Pick from My Issues */}
                {myIssues.length > 0 && (
                  <div className="pt-1.5">
                    <span className="text-[11px] text-muted-foreground block mb-1">Issue được assign gần đây:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {myIssues.slice(0, 6).map((iss) => (
                        <button
                          key={iss.key}
                          type="button"
                          onClick={() => {
                            setIssueKey(iss.key);
                            setIssueSummary(iss.fields.summary);
                            loadTaskDetails(iss.key);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition text-left truncate max-w-[200px] ${
                            issueKey === iss.key
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-accent/40 text-foreground border-border hover:bg-accent'
                          }`}
                          title={`${iss.key}: ${iss.fields.summary}`}
                        >
                          <span className="font-mono font-bold mr-1">{iss.key}</span>
                          <span className="opacity-80">{iss.fields.summary}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task Timetracking Details Badge */}
            {taskTimetracking && (
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Đã log từ trước:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{taskTimetracking.timeSpent || '0m'}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Thời gian còn lại (Remaining):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{taskTimetracking.remainingEstimate || 'Chưa đặt'}</span>
                </div>
                {taskTimetracking.originalEstimate && taskTimetracking.originalEstimate !== 'None' && (
                  <div className="flex items-center justify-between font-medium text-[11px] text-muted-foreground">
                    <span>Ước lượng ban đầu (Original):</span>
                    <span className="font-mono">{taskTimetracking.originalEstimate}</span>
                  </div>
                )}
              </div>
            )}

            {/* Safeguard Alert for Done / Rejected Tasks in Manual mode */}
            {inputMode === 'manual' && isSelectedStatusDone && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold block">Cảnh báo: Task [{issueKey}] đang ở trạng thái "{selectedIssueStatus}"</span>
                  <span className="text-[11px] opacity-90">Vui lòng kiểm tra lại để tránh log time nhầm vào task đã hoàn tất hoặc bị reject!</span>
                </div>
              </div>
            )}

            {/* Flexible Time Spent */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-bold text-foreground">Thời gian làm việc (Time Spent) *</label>
                  {suggestedEstimate && (
                    <button
                      type="button"
                      onClick={() => setTimeSpent(suggestedEstimate)}
                      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md transition cursor-pointer border ${
                        timeSpent === suggestedEstimate
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 font-bold shadow-xs'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold'
                      }`}
                      title="Nhấn để áp dụng thời gian Estimate của Subtask đã chọn"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Estimate: {suggestedEstimate}</span>
                    </button>
                  )}
                  {suggestedRemaining && suggestedRemaining !== suggestedEstimate && (
                    <button
                      type="button"
                      onClick={() => setTimeSpent(suggestedRemaining)}
                      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md transition cursor-pointer border ${
                        timeSpent === suggestedRemaining
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-xs'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold'
                      }`}
                      title="Nhấn để áp dụng thời gian Còn lại (Remaining) của Subtask"
                    >
                      <Clock className="w-3 h-3 text-emerald-500" />
                      <span>Còn lại: {suggestedRemaining}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {['30m', '1h', '1h 30m', '2h', '3h 30m', '4h', '4h 30m', '7h 30m', '8h'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTimeSpent(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition ${
                        timeSpent === preset
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                          : 'bg-muted hover:bg-accent text-foreground'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={timeSpent}
                onChange={(e) => setTimeSpent(e.target.value)}
                placeholder="Ví dụ: 4h 30m, 1h 30m, 45m, 4.5h, 2h"
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-primary transition"
              />
              {!preview.valid && timeSpent.trim() && (
                <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Định dạng chưa đúng (ví dụ: "4h 30m", "1h 30m", "45m", "2h", "4.5h")</span>
                </p>
              )}
            </div>

            {/* Date & Started Time */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Ngày & Giờ Bắt Đầu (Started Time) *</span>
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setStarted(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>Bây giờ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                      setStarted(`${d}T08:30`);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition"
                  >
                    08:30
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                      setStarted(`${d}T13:30`);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-accent text-foreground font-semibold transition"
                  >
                    13:30
                  </button>
                </div>
              </div>
              <DateTimePicker
                value={started}
                onChange={setStarted}
                showTime={true}
                placeholder="Chọn ngày và giờ bắt đầu log work..."
              />
            </div>

            {/* Comment - OPTIONAL with Suggestions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Mô tả công việc (Không bắt buộc)</span>
                </label>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-normal">Tùy chọn</span>
              </div>

              {/* Suggestions chips with 3 toggle buttons BE | FE | BA */}
              <WorklogDescriptionSuggestions
                subtaskTitle={issueSummary}
                comment={comment}
                onCommentChange={setComment}
              />

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Không bắt buộc - Có thể chọn gợi ý bên trên hoặc tự nhập mô tả chi tiết..."
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary resize-none transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !preview.valid || !issueKey.trim() || !started}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang đồng bộ lên Jira...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Log Work</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Section: Worklogs History (Task Specific vs All Recent) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setWorklogTab('task')}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition ${
                  worklogTab === 'task'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {issueKey ? `Lịch sử ${issueKey}` : 'Lịch sử Task'} ({taskWorklogs.length})
              </button>
              <button
                type="button"
                onClick={() => setWorklogTab('recent')}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl transition ${
                  worklogTab === 'recent'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Log Gần Đây ({recentWorklogs.length})
              </button>
            </div>

            {/* Search filter for logs */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Lọc theo mã hoặc nội dung..."
                className="bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary w-full sm:w-48 transition"
              />
            </div>
          </div>

          {/* Tab 1: Task Specific Worklogs */}
          {worklogTab === 'task' && (
            <div className="space-y-3">
              {loadingTaskWorklogs ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải lịch sử task...</span>
                </div>
              ) : taskWorklogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <Clock className="w-6 h-6 mx-auto opacity-40 text-muted-foreground" />
                  <p className="font-semibold text-foreground">Chưa có lượt log work nào cho task này</p>
                  <p className="text-[11px]">Dùng form bên trái để ghi nhận thời gian làm việc đầu tiên.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {taskWorklogs.map((w: any) => (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 hover:border-primary/40 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {w.author?.displayName || 'Người dùng'}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {w.started ? new Date(w.started).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                            {w.timeSpent}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingWorklog({
                              id: w.id,
                              issueKey: issueKey.trim().toUpperCase(),
                              issueSummary: issueSummary,
                              timeSpent: w.timeSpent,
                              started: w.started,
                              comment: w.comment
                            })}
                            className="p-1 rounded-md text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition"
                            title="Chỉnh sửa log work"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteWorklog({
                              id: w.id,
                              issueKey: issueKey.trim().toUpperCase(),
                              issueSummary: issueSummary,
                              timeSpent: w.timeSpent,
                              started: w.started,
                              author: w.author?.displayName
                            })}
                            className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Xóa log work"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {w.comment && (
                        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                          {typeof w.comment === 'string' ? w.comment : (w.comment?.body || '')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Recent Global Worklogs */}
          {worklogTab === 'recent' && (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {filteredWorklogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <History className="w-6 h-6 mx-auto opacity-40 text-muted-foreground" />
                  <p className="font-semibold text-foreground">Không tìm thấy lượt ghi log work nào</p>
                </div>
              ) : (
                filteredWorklogs.map((w) => (
                  <div
                    key={w.worklogId}
                    className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 hover:border-primary/40 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {w.isSubtask ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                            <GitBranch className="w-2.5 h-2.5" />
                            <span>Sub-task</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                            <Layers className="w-2.5 h-2.5" />
                            <span>Task</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedDetailKey(w.issueKey)}
                          className="font-mono text-xs font-bold text-blue-500 hover:underline flex items-center gap-0.5 shrink-0"
                        >
                          <span>{w.issueKey}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </button>

                        <span className="text-xs font-medium text-foreground truncate">
                          {w.issueSummary}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
                          {w.timeSpent}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingWorklog({
                            id: w.worklogId,
                            issueKey: w.issueKey,
                            issueSummary: w.issueSummary,
                            timeSpent: w.timeSpent,
                            started: w.started,
                            commentText: w.commentText
                          })}
                          className="p-1 rounded-md text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition"
                          title="Chỉnh sửa log work"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteWorklog({
                            id: w.worklogId,
                            issueKey: w.issueKey,
                            issueSummary: w.issueSummary,
                            timeSpent: w.timeSpent,
                            started: w.started
                          })}
                          className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Xóa log work"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span className="truncate max-w-[70%]" title={w.commentText || ''}>
                        {w.commentText ? `"${w.commentText}"` : <span className="italic opacity-60">Không có mô tả</span>}
                      </span>
                      <span className="font-mono text-[10px] shrink-0">
                        {w.started ? new Date(w.started).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Issue Detail Modal */}
      {selectedDetailKey && (
        <IssueDetailModal
          isOpen={true}
          issueKey={selectedDetailKey}
          onClose={() => setSelectedDetailKey(null)}
          onIssueUpdated={() => {
            loadPageData();
            loadWeeklyCalendar(weekOffset);
          }}
        />
      )}

      {/* Edit Worklog Modal */}
      {editingWorklog && (
        <EditWorklogModal
          isOpen={Boolean(editingWorklog)}
          onClose={() => setEditingWorklog(null)}
          worklog={editingWorklog}
          onSuccess={handleWorklogMutationSuccess}
        />
      )}

      {/* Confirm Delete Worklog Modal */}
      <ConfirmModal
        isOpen={!!pendingDeleteWorklog}
        title="Xác nhận xóa Log Work"
        description={
          pendingDeleteWorklog ? (
            <span>
              Bạn có chắc chắn muốn xóa lượt log work <strong className="text-foreground">{pendingDeleteWorklog.timeSpent}</strong>
              {pendingDeleteWorklog.started ? ` (ngày ${new Date(pendingDeleteWorklog.started).toLocaleDateString()})` : ''} trên công việc{' '}
              <span className="font-semibold text-primary">{pendingDeleteWorklog.issueKey}</span> không? Thao tác này sẽ xóa vĩnh viễn thời gian làm việc đã ghi nhận trên Jira.
            </span>
          ) : ''
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="destructive"
        loading={isDeletingWorklog}
        onConfirm={executeDeleteWorklog}
        onClose={() => {
          if (!isDeletingWorklog) setPendingDeleteWorklog(null);
        }}
      />
    </div>
  );
};
