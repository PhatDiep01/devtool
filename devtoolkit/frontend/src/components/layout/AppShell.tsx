import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';

export const AppShell: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
    <div className="flex h-screen h-[100dvh] w-full max-w-full overflow-hidden bg-background text-foreground">
      {/* Responsive 2-Level Collapsible Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileNavOpen} 
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktopCollapse={handleToggleDesktopSidebar}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar 
          onOpenCommand={() => setIsCommandOpen(true)} 
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktopCollapse={handleToggleDesktopSidebar}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />
    </div>
  );
};

export default AppShell;
