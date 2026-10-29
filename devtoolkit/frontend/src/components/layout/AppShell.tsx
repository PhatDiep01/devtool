import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from '../ui';
import { getActiveApiUrl, isSameOriginBackend } from '../../services/api';
import { AlertTriangle, X } from 'lucide-react';

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [dismissApiBanner, setDismissApiBanner] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('devtoolkit_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const handleToggleDesktopSidebar = () => {
    setIsDesktopCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('devtoolkit_sidebar_collapsed', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
      // Shortcut Ctrl+B or Cmd+B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleDesktopSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 flex w-full h-full max-w-full overflow-hidden bg-background text-foreground">
      {/* Responsive 2-Level Collapsible Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileNavOpen} 
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktopCollapse={handleToggleDesktopSidebar}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Topbar 
          onOpenCommand={() => setIsCommandOpen(true)} 
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktopCollapse={handleToggleDesktopSidebar}
        />

        {/* Warning banner when accessed on remote domain without configured Backend API URL */}
        {!dismissApiBanner && 
         !isSameOriginBackend() && 
         !getActiveApiUrl() && 
         !location.pathname.startsWith('/settings') && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-4 py-2 text-xs flex items-center justify-between text-amber-800 dark:text-amber-300 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate">
                Chưa kết nối URL Backend API (Cloudflare Tunnel). Các tính năng lưu dữ liệu sẽ bị gián đoạn.
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="font-bold underline text-amber-700 dark:text-amber-300 hover:opacity-80 transition"
              >
                Cài đặt ngay
              </button>
              <button
                type="button"
                onClick={() => setDismissApiBanner(true)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                title="Tạm ẩn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-thin overscroll-y-contain">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </div>
  );
};

export default AppShell;
