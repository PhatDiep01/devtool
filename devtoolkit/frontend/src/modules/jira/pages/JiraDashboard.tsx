import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Layers, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Settings, 
  LogOut, 
  RefreshCw, 
  Search, 
  User, 
  ShieldCheck, 
  Tag,
  FolderKanban,
  GitBranch,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { jiraApi } from '../../../services/api';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { JiraBoard } from '../../../types';
import { IssueDetailModal } from '../components/IssueDetailModal';
import { JiraAvatar } from '../components/JiraAvatar';
import { toast } from 'react-hot-toast';

export const JiraDashboard: React.FC = () => {
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [myIssues, setMyIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedDetailKey, setSelectedDetailKey] = useState<string | null>(null);

  const { user, logout } = useJiraAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const statusRes = await jiraApi.getStatus();
      setStatus(statusRes.data);

      if (statusRes.data.connected || statusRes.data.authenticated) {
        const [boardsRes, searchRes] = await Promise.all([
          jiraApi.getBoards().catch(() => ({ data: [] })),
          jiraApi.search('assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC').catch(() => ({ data: { issues: [] } }))
        ]);
        setBoards(boardsRes.data || []);
        const rawIssues = searchRes.data?.issues || (Array.isArray(searchRes.data) ? searchRes.data : []);
        setMyIssues(rawIssues);
      }
    } catch (err: any) {
      console.error('Failed to load Jira data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc Jira?')) {
      setLoggingOut(true);
      await logout();
      toast.success('Đã đăng xuất khỏi Jira');
      setLoggingOut(false);
    }
  };

  const issuesList = Array.isArray(myIssues) ? myIssues : [];
  const filteredIssues = issuesList.filter(issue => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      issue.key?.toLowerCase().includes(term) ||
      issue.fields?.summary?.toLowerCase().includes(term) ||
      issue.fields?.status?.name?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="p-8 sm:p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Synchronizing Jira boards and sprint tasks...</span>
      </div>
    );
  }

  const firstBoardId = boards[0]?.id;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 md:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            {/* Avatar or User Icon */}
            <JiraAvatar
              avatarUrl={user?.avatarUrl || status?.user?.avatarUrl}
              displayName={user?.displayName || status?.user?.displayName}
              className="w-12 h-12 rounded-2xl border-2 border-primary/20 shadow-sm"
              sizeText="text-base"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground truncate">
                  {user?.displayName || status?.user?.displayName || 'Jira Task Hub'}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Jira Authenticated</span>
                </span>
                {status?.expiresAt && (
                  <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full border border-border">
                    Session active until {new Date(status.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {user?.emailAddress || status?.user?.emailAddress} •{' '}
                <a
                  href={user?.baseUrl || status?.user?.baseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {user?.baseUrl || status?.user?.baseUrl}
                </a>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
            <button
              onClick={checkConnection}
              className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-accent text-foreground transition shadow-sm flex items-center gap-1.5"
              title="Refresh Jira boards and tasks"
            >
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition shadow-sm flex items-center gap-1.5"
              title="Sign out of Jira session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Navigation Hub Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Kanban Board */}
        <div
          onClick={() => navigate(firstBoardId ? `/jira/board/${firstBoardId}` : '/jira')}
          className="bg-card border border-border hover:border-blue-500/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              Kanban Board
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Drag-and-drop sprint task columns with instant transition status syncing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs font-semibold text-primary flex items-center justify-between">
            <span>View Board</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Sprint Hub */}
        <div
          onClick={() => navigate('/jira/sprints')}
          className="bg-card border border-border hover:border-indigo-500/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Sprint Hub
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Track sprint goals, inspect hierarchical User Stories with Sub-tasks, and manage backlog.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
            <span>Manage Sprints</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. Task Explorer */}
        <div
          onClick={() => navigate('/jira/tasks')}
          className="bg-card border border-border hover:border-emerald-500/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Task Explorer
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Search tasks, run custom JQL queries, create User Stories, and attach Sub-tasks.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>Explore Tasks</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 4. Log Work / Timesheet */}
        <div
          onClick={() => navigate('/jira/logwork')}
          className="bg-card border border-border hover:border-amber-500/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Log Work & Timesheet
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Flexible time logging ("1h 30m", "45m", "1d"), ADF descriptions, and worklog history.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Log Work</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Available Agile Boards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-base font-extrabold text-foreground">Active Agile Boards</h3>
          </div>
          <span className="text-xs text-muted-foreground">{boards.length} boards available</span>
        </div>

        {boards.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-2 shadow-sm">
            <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto" />
            <h4 className="font-bold text-sm text-foreground">No accessible boards found</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No agile Scrum or Kanban boards were returned for this Jira account. Verify your project board permissions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/jira/board/${b.id}`)}
                className="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-5 cursor-pointer group shadow-sm flex flex-col justify-between hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      {b.type}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">ID: #{b.id}</span>
                  </div>
                  <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </h4>
                </div>

                <div className="mt-5 pt-3 border-t border-border/50 text-xs text-primary font-semibold flex items-center justify-between">
                  <span>Open Sprint Kanban</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Issues */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            <h3 className="text-base font-extrabold text-foreground">
              Assigned to Me ({filteredIssues.length})
            </h3>
          </div>

          {/* Quick Filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter tasks by key, summary..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-muted-foreground space-y-1">
              <p>No unresolved tasks found matching your filter. 🎉</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.key}
                onClick={() => setSelectedDetailKey(issue.key)}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-accent/40 transition-colors gap-2.5 group cursor-pointer"
              >
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded shrink-0 flex items-center gap-1 group-hover:bg-blue-500/20 transition-colors">
                    <span>{issue.key}</span>
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {issue.fields.summary}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0 self-end sm:self-auto">
                  {issue.fields.priority?.name && (
                    <span className="text-[11px] text-muted-foreground">
                      {issue.fields.priority.name}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-accent border border-border text-foreground font-medium text-[11px]">
                    {issue.fields.status?.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDetailKey(issue.key);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline ml-1"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Embedded Issue Detail Modal */}
      {selectedDetailKey && (
        <IssueDetailModal
          isOpen={Boolean(selectedDetailKey)}
          onClose={() => setSelectedDetailKey(null)}
          issueKey={selectedDetailKey}
          onIssueUpdated={checkConnection}
        />
      )}

    </div>
  );
};
