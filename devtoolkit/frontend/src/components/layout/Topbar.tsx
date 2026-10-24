import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Plus, Menu, Lock, ShieldCheck } from 'lucide-react';
import { useThemeStore } from '../../stores/theme.store';
import { useJiraAuthStore } from '../../stores/jira-auth.store';

interface TopbarProps {
  onOpenCommand: () => void;
  onToggleMobileNav?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ 
  onOpenCommand, 
  onToggleMobileNav,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const { isAuthenticated: isJiraAuthenticated, user: jiraUser } = useJiraAuthStore();

  const getPageTitle = () => {
    if (location.pathname.startsWith('/jira/sprints')) return { title: 'Sprint Hub', badge: 'Sprints & US Tree' };
    if (location.pathname.startsWith('/jira/tasks')) return { title: 'Task Explorer', badge: 'Search & Create' };
    if (location.pathname.startsWith('/jira/logwork')) return { title: 'Log Work & Timesheet', badge: 'ADF v3' };
    if (location.pathname.startsWith('/jira/board')) return { title: 'Kanban Board', badge: 'Board Columns' };
    if (location.pathname.startsWith('/jira')) return { title: 'Jira Task Manager', badge: 'Connected' };
    if (location.pathname.startsWith('/tools/sticky-notes')) return { title: 'Sticky Notes', badge: 'Fast Note .txt' };
    if (location.pathname.startsWith('/tools/text-formatter')) return { title: 'Text Formatter Online', badge: 'OneLine Studio' };
    if (location.pathname.startsWith('/tools')) return { title: 'Công Cụ Mở Rộng', badge: 'Dev Tools' };
    if (location.pathname.startsWith('/docs')) return { title: 'TÀI LIỆU ĐẶC TẢ', badge: 'Handover Portal' };
    if (location.pathname.startsWith('/settings')) return { title: 'Platform Settings', badge: 'Local & Cloudflare' };
    return { title: 'DevToolkit', badge: 'v1.2.0' };
  };

  const { title, badge } = getPageTitle();

  return (
    <header className="h-14 border-b border-border bg-card px-3 sm:px-6 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left side: Menu / Sidebar Toggle (Mobile & Desktop) + Title + Badge */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              onToggleMobileNav?.();
            } else {
              onToggleDesktopCollapse?.();
            }
          }}
          className="p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center justify-center shrink-0"
          title={isDesktopCollapsed ? "Mở rộng menu bên trái (Ctrl+B)" : "Thu gọn menu bên trái (Ctrl+B)"}
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-bold text-sm sm:text-base text-foreground tracking-tight truncate">
          {title}
        </h1>

        {badge && (
          <span className="hidden sm:inline-block text-[11px] px-2.5 py-0.5 rounded-full bg-accent border border-border text-muted-foreground font-medium shrink-0">
            {badge}
          </span>
        )}

        {/* Jira Sub-nav Bar on Desktop */}
        {location.pathname.startsWith('/jira') && isJiraAuthenticated && (
          <div className="hidden xl:flex items-center gap-1 ml-4 pl-4 border-l border-border/80">
            {[
              { path: '/jira', label: 'Kanban', exact: true },
              { path: '/jira/sprints', label: 'Sprint Hub' },
              { path: '/jira/tasks', label: 'Tasks' },
              { path: '/jira/logwork', label: 'Log Work' }
            ].map(tab => {
              const isTabActive = tab.exact 
                ? (location.pathname === tab.path || location.pathname.startsWith('/jira/board'))
                : location.pathname.startsWith(tab.path);

              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => navigate(tab.path)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                    isTabActive
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side: Jira status + Search + Quick Action + Theme */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Jira Auth Status Pill */}
        {isJiraAuthenticated && jiraUser ? (
          <div 
            onClick={() => navigate('/jira')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:bg-blue-500/15 transition shrink-0"
            title={`Connected to Jira as ${jiraUser.displayName} (${jiraUser.emailAddress})`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="hidden lg:inline truncate max-w-[130px]">{jiraUser.displayName}</span>
            <span className="lg:hidden text-[11px]">Jira</span>
          </div>
        ) : (
          location.pathname.startsWith('/jira') && (
            <div 
              role="button"
              onClick={() => navigate('/jira')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-600 dark:text-amber-400 font-medium shrink-0 cursor-pointer hover:bg-amber-500/15 transition"
              title="Click to sign in to Jira"
            >
              <Lock className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Login Required</span>
            </div>
          )
        )}

        {/* Global Search trigger */}
        <button
          onClick={onOpenCommand}
          className="w-9 sm:w-52 md:w-60 h-9 sm:h-auto p-0 sm:px-3 sm:py-1.5 flex items-center justify-center sm:justify-between bg-background border border-border hover:border-primary/50 transition-colors rounded-xl text-xs text-muted-foreground text-left shadow-sm shrink-0"
          title="Search documents, screens, and tasks (Cmd+K)"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="hidden sm:inline truncate">Search docs...</span>
          </div>
          <kbd className="hidden sm:inline-block text-[10px] bg-accent px-1.5 py-0.5 rounded border border-border font-mono shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Quick action button for docs */}
        {location.pathname.startsWith('/docs') && (
          <button
            onClick={() => navigate('/docs/import')}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition shadow-sm shrink-0"
            title="Import Markdown Specification"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Import .md</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
