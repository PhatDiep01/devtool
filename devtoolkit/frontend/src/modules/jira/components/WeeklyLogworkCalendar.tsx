import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Layers, 
  GitBranch, 
  Plus, 
  ExternalLink,
  Filter,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Trash2,
  Edit3
} from 'lucide-react';
import { WeeklyCalendarResponse, WeeklyCalendarDay, JiraWorklogItem } from '../../../types';

interface WeeklyLogworkCalendarProps {
  calendarData: WeeklyCalendarResponse | null;
  loading: boolean;
  onNavigateWeek: (offset: number) => void;
  onResetToCurrentWeek: () => void;
  onSelectDayForLog: (dateStr: string) => void;
  onOpenIssueDetail: (issueKey: string) => void;
  onEditWorklog?: (w: JiraWorklogItem) => void;
  onDeleteWorklog?: (w: JiraWorklogItem) => void;
  currentWeekOffset: number;
}

export const WeeklyLogworkCalendar: React.FC<WeeklyLogworkCalendarProps> = ({
  calendarData,
  loading,
  onNavigateWeek,
  onResetToCurrentWeek,
  onSelectDayForLog,
  onOpenIssueDetail,
  onEditWorklog,
  onDeleteWorklog,
  currentWeekOffset
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'subtask' | 'task'>('all');

  // Format date helper: "YYYY-MM-DD" -> "DD/MM"
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Format full date: "YYYY-MM-DD" -> "DD/MM/YYYY"
  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // Check if date is today
  const isToday = (dateStr: string) => {
    const today = new Date();
    const dStr = today.toISOString().slice(0, 10);
    return dateStr === dStr;
  };

  const days = calendarData?.days || [];
  const activeDay = selectedDate 
    ? days.find(d => d.date === selectedDate) 
    : days.find(d => isToday(d.date)) || days[0];

  const worklogsToShow = (activeDay ? activeDay.worklogs : (calendarData?.allWorklogs || []))
    .filter(w => {
      if (filterType === 'subtask') return w.isSubtask;
      if (filterType === 'task') return !w.isSubtask;
      return true;
    });

  // Calculate 40h work week progress
  const weeklyHours = calendarData?.totalHours || 0;
  const targetHours = 40;
  const progressPercent = Math.min(100, Math.round((weeklyHours / targetHours) * 100));

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
      {/* 1. Header with Week Navigation & Key Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                Lịch Log Work Theo Tuần
              </h2>
              {currentWeekOffset === 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Tuần hiện tại
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {currentWeekOffset > 0 ? `+${currentWeekOffset} tuần` : `${currentWeekOffset} tuần`}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Theo dõi chi tiết thời gian đã log, số lượng Task và Subtask hoàn thành trong từng ngày.
            </p>
          </div>
        </div>

        {/* Week Switcher Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 border border-border rounded-2xl p-1">
            <button
              type="button"
              onClick={() => onNavigateWeek(-1)}
              className="p-1.5 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground transition"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold px-3 text-foreground font-mono">
              {calendarData ? `${formatShortDate(calendarData.startDate)} - ${formatFullDate(calendarData.endDate)}` : 'Đang tải...'}
            </span>

            <button
              type="button"
              onClick={() => onNavigateWeek(1)}
              className="p-1.5 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground transition"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {currentWeekOffset !== 0 && (
            <button
              type="button"
              onClick={onResetToCurrentWeek}
              className="px-3 py-1.5 rounded-xl bg-background border border-border text-xs font-bold hover:bg-accent text-foreground transition"
            >
              Về Tuần Này
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Weekly Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Weekly Hours */}
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Tổng giờ tuần này</span>
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground font-mono">{weeklyHours}h</span>
            <span className="text-xs text-muted-foreground font-mono">/ 40h</span>
          </div>
          <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                progressPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Subtasks Logged (Specific User Request) */}
        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Subtask đã log</span>
            <GitBranch className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {calendarData?.totalSubtaskCount || 0}
            </span>
            <span className="text-xs text-muted-foreground">subtasks</span>
          </div>
          <span className="text-[10px] text-muted-foreground block truncate">
            {calendarData?.totalWorklogsCount || 0} lượt log work ghi nhận
          </span>
        </div>

        {/* KPI 3: Tasks/Stories Logged (Specific User Request) */}
        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Task / Story đã log</span>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {calendarData?.totalTaskCount || 0}
            </span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <span className="text-[10px] text-muted-foreground block truncate">
            Không tính subtask đi kèm
          </span>
        </div>

        {/* KPI 4: Active Logging Days */}
        <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Số ngày có log work</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {days.filter(d => d.totalHours > 0).length}
            </span>
            <span className="text-xs text-muted-foreground">/ 7 ngày</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">
            {days.filter(d => d.totalHours >= 8).length} ngày đạt chuẩn 8h
          </span>
        </div>
      </div>

      {/* 3. The 7-Day Calendar Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Chi tiết từng ngày trong tuần (Bấm vào ngày để xem danh sách worklog):</span>
          </span>
          {activeDay && (
            <span className="text-[11px] font-medium text-muted-foreground">
              Đang xem: <strong className="text-foreground">{activeDay.dayName} ({formatShortDate(activeDay.date)})</strong>
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Đang tải dữ liệu tuần...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {days.map((day) => {
              const today = isToday(day.date);
              const isSelected = activeDay?.date === day.date;
              const hasHours = day.totalHours > 0;
              const meetsStandard = day.totalHours >= 8;

              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`relative rounded-2xl p-3 border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] text-left group ${
                    isSelected
                      ? 'bg-card border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                      : today
                        ? 'bg-accent/40 border-primary/50 hover:border-primary'
                        : 'bg-muted/20 border-border hover:border-border/80 hover:bg-muted/40'
                  }`}
                >
                  {/* Card Header: Day Name + Date */}
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        today ? 'text-primary' : 'text-foreground'
                      }`}>
                        {day.dayName.replace('Thứ ', 'T')}
                      </span>
                      {today && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-primary text-primary-foreground">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                      {formatShortDate(day.date)}
                    </span>
                  </div>

                  {/* Hours Badge */}
                  <div className="my-2">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-extrabold font-mono tracking-tight ${
                        meetsStandard 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : hasHours 
                            ? 'text-indigo-600 dark:text-indigo-400' 
                            : 'text-muted-foreground/60'
                      }`}>
                        {day.totalHours}h
                      </span>
                    </div>

                    {/* Breakdown Badges (Task & Subtask counts) */}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {day.subtaskCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" title={`${day.subtaskCount} Subtask`}>
                          <GitBranch className="w-2.5 h-2.5 shrink-0" />
                          <span>{day.subtaskCount} sub</span>
                        </span>
                      )}

                      {day.taskCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" title={`${day.taskCount} Task/Story`}>
                          <Layers className="w-2.5 h-2.5 shrink-0" />
                          <span>{day.taskCount} task</span>
                        </span>
                      )}

                      {!hasHours && (
                        <span className="text-[10px] text-muted-foreground/60 italic">
                          Chưa log
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action: Quick Log on this day */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDayForLog(day.date);
                    }}
                    className="w-full mt-1 py-1 px-2 rounded-xl text-[10px] font-bold border border-border/80 bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary text-muted-foreground transition flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100"
                    title={`Log work cho ngày ${day.dayName} (${day.date})`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Log Ngày Này</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Active Day Worklog Details View */}
      {activeDay && (
        <div className="p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Danh sách công việc đã log trong {activeDay.dayName} ({formatFullDate(activeDay.date)})
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-accent text-muted-foreground">
                {activeDay.totalHours}h ({activeDay.worklogs.length} bản ghi)
              </span>
            </div>

            {/* Filter by Type: All, Subtasks, Tasks */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterType === 'all'
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Tất cả ({activeDay.worklogs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('subtask')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterType === 'subtask'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                }`}
              >
                <GitBranch className="w-3 h-3" />
                <span>Subtask ({activeDay.subtaskCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('task')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterType === 'task'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Task ({activeDay.taskCount})</span>
              </button>
            </div>
          </div>

          {/* Worklog Cards */}
          {worklogsToShow.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
              <Clock className="w-6 h-6 mx-auto opacity-40 text-muted-foreground" />
              <p>Chưa có lượt ghi log work nào phù hợp với bộ lọc trong ngày này.</p>
              <button
                type="button"
                onClick={() => onSelectDayForLog(activeDay.date)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ghi Log Work cho ngày này</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {worklogsToShow.map((w) => (
                <div
                  key={w.worklogId || `${w.issueKey}-${w.started}`}
                  className="bg-card border border-border/80 rounded-2xl p-3.5 space-y-2 shadow-xs hover:border-primary/50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {w.isSubtask ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>Sub-task</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{w.issueType?.name || 'Task'}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenIssueDetail(w.issueKey)}
                        className="font-mono text-xs font-bold text-blue-500 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        <span>{w.issueKey}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </button>

                      {w.issueStatus?.name && (
                        <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.2 rounded bg-muted truncate">
                          {w.issueStatus.name}
                        </span>
                      )}
                    </div>

                    {/* Time spent & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-extrabold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
                        {w.timeSpent}
                      </span>
                      {onEditWorklog && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditWorklog(w);
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition"
                          title="Chỉnh sửa log work"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteWorklog && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWorklog(w);
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Xóa log work"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                    {w.issueSummary}
                  </h4>

                  {/* Comment & Started Time */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="truncate max-w-[70%]" title={w.commentText || 'Không có mô tả'}>
                      {w.commentText ? `"${w.commentText}"` : <span className="italic opacity-60">Không có mô tả</span>}
                    </span>
                    <span className="font-mono text-[10px] shrink-0 opacity-80">
                      {w.started ? new Date(w.started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
