import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  Users, 
  CheckCircle2, 
  Layers, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  List, 
  LayoutList, 
  FileText, 
  User, 
  GitBranch, 
  MessageSquare,
  Sparkles,
  ArrowUpDown,
  X,
  Edit3,
  Trash2
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { ActivityStreamResponse, ActivityStreamWorklog } from '../../../types';
import { JiraAvatar } from '../components/JiraAvatar';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { EditWorklogModal, EditableWorklog } from '../components/EditWorklogModal';
import { PersonnelMultiSelect } from '../components/PersonnelMultiSelect';
import { ConfirmModal } from '../../../components/ui';
import { formatRelativeTime } from '../../../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'last_30_days' | 'custom';

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateRangeForPreset(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = formatLocalDate(now);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = formatLocalDate(y);
      return { startDate: yStr, endDate: yStr };
    }

    case 'this_week': {
      const currentDay = now.getDay();
      const distanceToMonday = (currentDay + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: formatLocalDate(monday), endDate: formatLocalDate(sunday) };
    }

    case 'last_week': {
      const currentDay = now.getDay();
      const distanceToMonday = (currentDay + 6) % 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - distanceToMonday - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { startDate: formatLocalDate(lastMonday), endDate: formatLocalDate(lastSunday) };
    }

    case 'last_30_days': {
      const past = new Date(now);
      past.setDate(now.getDate() - 30);
      return { startDate: formatLocalDate(past), endDate: todayStr };
    }

    case 'custom':
    default:
      return { startDate: todayStr, endDate: todayStr };
  }
}

export const JiraActivityStreamPage: React.FC = () => {
  const { user } = useJiraAuthStore();

  // Filters & State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState(() => formatLocalDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => formatLocalDate(new Date()));
  const [selectedUserNames, setSelectedUserNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'stream' | 'table'>('stream');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam) {
      setSearchQuery(qParam);
    }
  }, [searchParams]);

  // Data & Async
  const [data, setData] = useState<ActivityStreamResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modal inspection
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);

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

  const executeDeleteWorklog = async () => {
    if (!pendingDeleteWorklog) return;
    setIsDeletingWorklog(true);
    try {
      await jiraApi.deleteWorklog(pendingDeleteWorklog.issueKey, pendingDeleteWorklog.id);
      toast.success(`Đã xóa lượt log work (${pendingDeleteWorklog.timeSpent}) thành công!`);
      fetchStream(false);
    } catch (err: any) {
      toast.error(`Xóa log work thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsDeletingWorklog(false);
      setPendingDeleteWorklog(null);
    }
  };

  // Compute active date range
  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'custom') {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return getDateRangeForPreset(datePreset);
  }, [datePreset, customStartDate, customEndDate]);

  // Load activity stream
  const fetchStream = async (showToast = false) => {
    setLoading(true);
    try {
      const params: any = {
        startDate,
        endDate,
        maxResults: 500
      };

      const res = await jiraApi.getActivityStream(params);
      setData(res.data);
      if (showToast) {
        toast.success(`Đã cập nhật ${res.data.worklogs.length} bản ghi log time`);
      }
    } catch (err: any) {
      console.error('Failed to load activity stream:', err);
      toast.error('Không thể tải dữ liệu Activity Stream');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStream();
  }, [startDate, endDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStream(true);
  };

  // Filtered worklogs based on multi-select personnel & search query
  const filteredWorklogs = useMemo(() => {
    if (!data?.worklogs) return [];
    let list = data.worklogs;

    // Personnel multi-select filter
    if (selectedUserNames.size > 0) {
      list = list.filter((w) => selectedUserNames.has(w.author.name));
    }

    // Keyword search filter (case-insensitive substring across issue key, summary, author, comment)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((w) => 
        w.issueKey.toLowerCase().includes(q) ||
        (w.issueSummary || '').toLowerCase().includes(q) ||
        (w.author.displayName || '').toLowerCase().includes(q) ||
        (w.author.name || '').toLowerCase().includes(q) ||
        (w.commentText && w.commentText.toLowerCase().includes(q))
      );
    }

    return list;
  }, [data?.worklogs, selectedUserNames, searchQuery]);

  // Compute live KPIs dynamically from filtered worklogs
  const kpiMetrics = useMemo(() => {
    const totalSecs = filteredWorklogs.reduce((acc, curr) => acc + (curr.timeSpentSeconds || 0), 0);
    const totalHours = Number((totalSecs / 3600).toFixed(1));
    const uniqueUsers = new Set(filteredWorklogs.map(w => w.author.name)).size;
    const uniqueIssues = new Set(filteredWorklogs.map(w => w.issueKey)).size;
    return {
      totalSeconds: totalSecs,
      totalHours,
      uniqueUsersCount: uniqueUsers,
      totalWorklogsCount: filteredWorklogs.length,
      uniqueIssuesCount: uniqueIssues
    };
  }, [filteredWorklogs]);

  // Group filtered worklogs by Date for Stream view
  const groupedWorklogs = useMemo(() => {
    const groups: { [date: string]: { dateStr: string; worklogs: ActivityStreamWorklog[]; totalSeconds: number } } = {};

    filteredWorklogs.forEach((w) => {
      const d = w.startedDate || (w.started || '').slice(0, 10);
      if (!groups[d]) {
        groups[d] = { dateStr: d, worklogs: [], totalSeconds: 0 };
      }
      groups[d].worklogs.push(w);
      groups[d].totalSeconds += w.timeSpentSeconds || 0;
    });

    return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredWorklogs]);

  // Format date display label in Vietnamese
  const formatDateLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const target = new Date(y, m - 1, d);
      const today = new Date();
      const todayStr = formatLocalDate(today);

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);

      const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = dayNames[target.getDay()];
      const formattedD = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

      if (dateStr === todayStr) {
        return `Hôm nay - ${dayName}, ${formattedD}`;
      }
      if (dateStr === yesterdayStr) {
        return `Hôm qua - ${dayName}, ${formattedD}`;
      }
      return `${dayName}, ${formattedD}`;
    } catch {
      return dateStr;
    }
  };

  // Export filtered worklogs to CSV (Excel compatible with UTF-8 BOM)
  const handleExportCsv = () => {
    if (filteredWorklogs.length === 0) {
      toast.error('Không có dữ liệu để xuất file CSV');
      return;
    }

    const headers = ['Ngày', 'Giờ bắt đầu', 'Nhân sự', 'Tài khoản', 'Mã Issue', 'Thuộc US', 'Tiêu đề công việc', 'Loại Issue', 'Thời gian log', 'Số giờ', 'Ghi chú nội dung'];
    const rows = filteredWorklogs.map((w) => [
      `"${w.startedDate || ''}"`,
      `"${w.started ? new Date(w.started).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}"`,
      `"${(w.author.displayName || '').replace(/"/g, '""')}"`,
      `"${w.author.name || ''}"`,
      `"${w.issueKey}"`,
      `"${w.parent?.key || ''}"`,
      `"${(w.issueSummary || '').replace(/"/g, '""')}"`,
      `"${w.issueType?.name || (w.isSubtask ? 'Sub-task' : 'Task')}"`,
      `"${w.timeSpent}"`,
      `${(w.timeSpentSeconds / 3600).toFixed(2)}`,
      `"${(w.commentText || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ActivityStream_Jira_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file CSV thành công');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jira</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="text-xs font-semibold text-primary">Activity Stream</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-primary" />
              Activity Stream
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Toàn bộ nhân sự
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Theo dõi và kiểm tra toàn bộ nhật ký chấm công (log time) của tất cả thành viên trong nhóm theo thời gian thực
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40">
            <button
              type="button"
              onClick={() => setViewMode('stream')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'stream'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dạng dòng thời gian (Stream)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Dòng sự kiện</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dạng bảng thống kê chi tiết"
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng dữ liệu</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredWorklogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent text-foreground transition shadow-2xs disabled:opacity-50"
            title="Xuất file CSV báo cáo"
          >
            <Download className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition shadow-xs disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Dynamic KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tổng thời gian</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
              {kpiMetrics.totalHours}h
            </div>
            <span className="text-[10px] text-muted-foreground">
              {kpiMetrics.totalSeconds ? `${(kpiMetrics.totalSeconds / (8 * 3600)).toFixed(1)} ngày công chuẩn` : 'Chưa có ghi nhận'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nhân sự ghi nhận</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400">
              {kpiMetrics.uniqueUsersCount}
            </div>
            <span className="text-[10px] text-muted-foreground">Thành viên có log time</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lượt chấm công</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {kpiMetrics.totalWorklogsCount}
            </div>
            <span className="text-[10px] text-muted-foreground">Bản ghi worklog</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Số công việc</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {kpiMetrics.uniqueIssuesCount}
            </div>
            <span className="text-[10px] text-muted-foreground">Tasks & Sub-tasks</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-2xs space-y-4">
        {/* Date presets row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" /> Khoảng thời gian:
            </span>
            {(
              [
                { id: 'today', label: 'Hôm nay' },
                { id: 'yesterday', label: 'Hôm qua' },
                { id: 'this_week', label: 'Tuần này' },
                { id: 'last_week', label: 'Tuần trước' },
                { id: 'last_30_days', label: '30 ngày qua' },
                { id: 'custom', label: 'Tùy chọn' }
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                  datePreset === p.id
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Active date range display */}
          <div className="text-xs font-mono font-medium text-muted-foreground flex items-center gap-1.5 bg-muted/30 px-3 py-1 rounded-xl border border-border/50">
            <span>{startDate}</span>
            <span>➔</span>
            <span>{endDate}</span>
          </div>
        </div>

        {/* Custom date range inputs (visible when preset === 'custom') */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Từ ngày:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Đến ngày:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchStream(true)}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Áp dụng
            </button>
          </div>
        )}

        {/* Search input & Multi-Select Personnel Selector row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-border/60">
          {/* Keyword Search Input */}
          <div className="md:col-span-7 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm theo mã Issue, tiêu đề công việc, ghi chú hoặc tên nhân sự..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Personnel Multi-Select Selector with Avatar & Keyword Search */}
          <div className="md:col-span-5 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 hidden sm:inline">
              Nhân sự:
            </span>
            <div className="flex-1 min-w-0">
              <PersonnelMultiSelect
                users={data?.users || []}
                selectedUserNames={selectedUserNames}
                onChange={setSelectedUserNames}
              />
            </div>
          </div>
        </div>

        {/* Active Personnel Filter Tag Bar */}
        {selectedUserNames.size > 0 && selectedUserNames.size < (data?.users?.length || 0) && (
          <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20 text-foreground animate-in fade-in">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground">Đang lọc theo:</span>
              <span className="font-semibold text-primary">{selectedUserNames.size} nhân sự đã chọn</span>
              <span className="text-muted-foreground">({filteredWorklogs.length} bản ghi worklog hiển thị)</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUserNames(new Set())}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition"
            >
              <X className="w-3 h-3" />
              <span>Xem tất cả nhân sự</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-card border border-border animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="space-y-1">
                    <div className="w-32 h-3.5 bg-muted rounded-md" />
                    <div className="w-20 h-2.5 bg-muted/60 rounded-md" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-muted rounded-full" />
              </div>
              <div className="w-full h-10 bg-muted/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredWorklogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border/80 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Không tìm thấy bản ghi log time nào</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Không có nhân sự nào chấm công trong khoảng thời gian đã chọn ({startDate} đến {endDate}) hoặc không khớp với bộ lọc nhân sự/từ khóa.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {selectedUserNames.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUserNames(new Set())}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent text-foreground hover:bg-accent/80 transition"
              >
                Bỏ lọc nhân sự
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDatePreset('last_30_days');
                setSelectedUserNames(new Set());
                setSearchQuery('');
              }}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition shadow-2xs"
            >
              Mở rộng phạm vi 30 ngày qua
            </button>
          </div>
        </div>
      ) : viewMode === 'stream' ? (
        /* Stream / Timeline Mode */
        <div className="space-y-6">
          {groupedWorklogs.map((group) => {
            const dayHours = Number((group.totalSeconds / 3600).toFixed(1));
            return (
              <div key={group.dateStr} className="space-y-3">
                {/* Date header badge */}
                <div className="flex items-center justify-between sticky top-0 z-10 bg-background/95 backdrop-blur-xs py-2 px-1 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h3 className="text-sm font-bold text-foreground">
                      {formatDateLabel(group.dateStr)}
                    </h3>
                    <span className="text-xs text-muted-foreground">({group.worklogs.length} lượt log)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Tổng ngày:</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {dayHours}h
                    </span>
                  </div>
                </div>

                {/* Worklog item cards */}
                <div className="space-y-2.5 pl-2 sm:pl-3 border-l-2 border-border/60">
                  {group.worklogs.map((w) => {
                    const startedTime = w.started 
                      ? new Date(w.started).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const isCurrentUser = user && (user.displayName === w.author.displayName || user.emailAddress === w.author.emailAddress);

                    return (
                      <div
                        key={w.worklogId}
                        className={`p-3.5 sm:p-4 rounded-2xl bg-card border transition space-y-2.5 hover:border-primary/50 shadow-2xs group ${
                          isCurrentUser ? 'border-primary/30 bg-primary/[0.02]' : 'border-border/80'
                        }`}
                      >
                        {/* Row 1: Author & Time spent badge */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <JiraAvatar
                              avatarUrl={w.author.avatarUrl}
                              displayName={w.author.displayName}
                              className="w-6 h-6 sm:w-7 sm:h-7"
                              sizeText="text-[10px]"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                                  {w.author.displayName}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-primary/10 text-primary">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                <span>{startedTime ? `Lúc ${startedTime}` : ''}</span>
                                {w.started && (
                                  <>
                                    <span>•</span>
                                    <span>{formatRelativeTime(w.started)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Time spent pill */}
                            <span 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tabular-nums shadow-2xs"
                              title={`Thời gian đã log: ${w.timeSpent}`}
                            >
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              <span>{w.timeSpent}</span>
                            </span>

                            {/* Status badge */}
                            {w.issueStatus && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                w.issueStatus.statusCategory?.key === 'done'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {w.issueStatus.name}
                              </span>
                            )}

                            {/* Worklog Edit & Delete actions */}
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
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
                                  started: w.started,
                                  author: w.author.displayName
                                })}
                                className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Xóa log work"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Issue Key, Type & Summary */}
                        <div className="flex items-start gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/60">
                          <button
                            type="button"
                            onClick={() => setSelectedIssueKey(w.issueKey)}
                            className="font-mono font-bold text-xs text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1 transition"
                            title="Bấm để xem chi tiết công việc trong popup"
                          >
                            <span>{w.issueKey}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          {w.isSubtask && w.parent && (
                            <span 
                              onClick={() => setSelectedIssueKey(w.parent!.key)}
                              className="text-[11px] text-muted-foreground font-mono hover:text-foreground cursor-pointer shrink-0 hidden sm:inline"
                              title={`Subtask của ${w.parent.key}`}
                            >
                              [US: {w.parent.key}]
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <span 
                              onClick={() => setSelectedIssueKey(w.issueKey)}
                              className="text-xs font-medium text-foreground hover:text-primary transition cursor-pointer line-clamp-2"
                            >
                              {w.issueSummary}
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Comment / Description (If present) */}
                        {w.commentText && (
                          <div className="flex items-start gap-2 pl-2 text-xs text-muted-foreground border-l-2 border-primary/40 italic bg-accent/20 p-2 rounded-r-xl">
                            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="line-clamp-3 select-text not-italic text-foreground/90 leading-relaxed font-sans">
                              {w.commentText}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Thời gian</th>
                  <th className="py-3 px-3.5">Nhân sự</th>
                  <th className="py-3 px-3.5">Mã Issue</th>
                  <th className="py-3 px-3.5">Thuộc US</th>
                  <th className="py-3 px-3.5 min-w-[220px]">Tiêu đề công việc</th>
                  <th className="py-3 px-3.5">Loại</th>
                  <th className="py-3 px-3.5 text-right">Giờ log</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Nội dung ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredWorklogs.map((w) => {
                  const startedTime = w.started 
                    ? new Date(w.started).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <tr key={w.worklogId} className="hover:bg-muted/30 transition">
                      <td className="py-2.5 px-3.5 font-mono whitespace-nowrap text-muted-foreground">
                        <div className="font-semibold text-foreground">{w.startedDate}</div>
                        <div className="text-[10px]">{startedTime}</div>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <JiraAvatar
                            avatarUrl={w.author.avatarUrl}
                            displayName={w.author.displayName}
                            className="w-5 h-5"
                            sizeText="text-[8px]"
                          />
                          <span className="font-semibold text-foreground truncate max-w-[130px]">
                            {w.author.displayName}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedIssueKey(w.issueKey)}
                          className="font-mono font-bold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          {w.issueKey}
                        </button>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {w.parent ? (
                          <button
                            type="button"
                            onClick={() => setSelectedIssueKey(w.parent!.key)}
                            className="hover:text-primary transition"
                          >
                            {w.parent.key}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3.5">
                        <span 
                          onClick={() => setSelectedIssueKey(w.issueKey)}
                          className="font-medium text-foreground hover:text-primary transition cursor-pointer line-clamp-1"
                          title={w.issueSummary}
                        >
                          {w.issueSummary}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          w.isSubtask ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {w.issueType?.name || (w.isSubtask ? 'Sub-task' : 'Task')}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
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
                              started: w.started,
                              author: w.author.displayName
                            })}
                            className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition"
                            title="Xóa log work"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-muted-foreground text-xs">
                        <span className="line-clamp-2" title={w.commentText}>
                          {w.commentText || <span className="italic text-muted-foreground/40">Không có ghi chú</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/40 border-t border-border font-bold">
                <tr>
                  <td colSpan={6} className="py-3 px-3.5 text-right uppercase tracking-wider text-[11px] text-muted-foreground">
                    Tổng cộng ({filteredWorklogs.length} bản ghi):
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                    {kpiMetrics.totalHours}h
                  </td>
                  <td className="py-3 px-3.5 text-muted-foreground text-xs font-normal">
                    {kpiMetrics.uniqueUsersCount} nhân sự • {kpiMetrics.uniqueIssuesCount} công việc
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Embedded Issue Detail Modal when clicking an issue key */}
      {selectedIssueKey && (
        <IssueDetailModal
          isOpen={Boolean(selectedIssueKey)}
          onClose={() => setSelectedIssueKey(null)}
          issueKey={selectedIssueKey}
          onIssueUpdated={() => fetchStream()}
        />
      )}

      {/* Edit Worklog Modal */}
      {editingWorklog && (
        <EditWorklogModal
          isOpen={Boolean(editingWorklog)}
          onClose={() => setEditingWorklog(null)}
          worklog={editingWorklog}
          onSuccess={() => fetchStream()}
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
              {pendingDeleteWorklog.started ? ` (ngày ${new Date(pendingDeleteWorklog.started).toLocaleDateString()})` : ''} của{' '}
              <span className="font-semibold text-foreground">{pendingDeleteWorklog.author || 'người dùng'}</span> trên công việc{' '}
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
