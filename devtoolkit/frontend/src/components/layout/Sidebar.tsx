import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  FileText, 
  Code2, 
  Settings, 
  Terminal,
  X,
  Layers,
  ChevronRight,
  ChevronDown,
  Lock,
  FolderKanban,
  Clock,
  Search,
  LayoutDashboard,
  Upload,
  Database,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  HardDrive,
  Bug,
  AlignLeft,
  ArrowLeftRight,
  StickyNote
} from 'lucide-react';
import clsx from 'clsx';
import { useJiraAuthStore } from '../../stores/jira-auth.store';

export interface NavSubItem {
  id: string;
  title: string;
  desc?: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  exact?: boolean;
  disabled?: boolean;
  isProtected?: boolean;
}

export interface NavItem {
  id: string;
  title: string;
  desc?: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isProtected?: boolean;
  exact?: boolean;
  disabled?: boolean;
  children?: NavSubItem[];
}

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isMobileOpen = false, 
  onCloseMobile,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated: isJiraAuthenticated } = useJiraAuthStore();

  // Accordion state for expandable Level 1 menu groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    docs: true,
    jira: true,
    'dev-tools': location.pathname.startsWith('/tools'),
    settings: location.pathname.startsWith('/settings'),
  }));

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // 2-level structured navigation items
  const navItems: NavItem[] = [
    { 
      id: 'docs',
      title: 'Tài Liệu Đặc Tả', 
      desc: 'Screen specs & architecture', 
      path: '/docs', 
      icon: FileText,
      badge: 'Core',
      children: [
        {
          id: 'docs-dashboard',
          title: 'Tổng Quan Màn Hình',
          desc: 'Tất cả màn hình & module',
          path: '/docs',
          icon: LayoutDashboard,
          exact: true
        },
        {
          id: 'docs-import',
          title: 'Nhập Đặc Tả (.md)',
          desc: 'Thêm tài liệu từ markdown',
          path: '/docs/import',
          icon: Upload
        },
        {
          id: 'docs-bugs',
          title: 'Quản Lý Bug (Fix Notes)',
          desc: 'Theo dõi & log bug FE/BE',
          path: '/docs/bugs',
          icon: Bug,
          badge: 'Tracker'
        }
      ]
    },
    { 
      id: 'jira',
      title: 'Quản Lý Jira', 
      desc: 'Sprint tasks & timesheet', 
      path: '/jira', 
      icon: ClipboardCheck,
      badge: isJiraAuthenticated ? 'Connected' : 'Login Req',
      isProtected: true,
      children: [
        {
          id: 'jira-board',
          title: 'Kanban Board',
          desc: 'Bảng kéo thả trạng thái',
          path: '/jira',
          icon: Layers,
          exact: true
        },
        {
          id: 'jira-sprints',
          title: 'Sprint Hub',
          desc: 'Quản lý US & Sprints',
          path: '/jira/sprints',
          icon: FolderKanban
        },
        {
          id: 'jira-tasks',
          title: 'Task Explorer',
          desc: 'Tra cứu & tạo công việc',
          path: '/jira/tasks',
          icon: Search
        },
        {
          id: 'jira-logwork',
          title: 'Log Work / Timesheet',
          desc: 'Ghi nhận giờ & ADF',
          path: '/jira/logwork',
          icon: Clock
        }
      ]
    },
    {
      id: 'dev-tools',
      title: 'Công Cụ Mở Rộng',
      desc: 'Tiện ích chuẩn bị cho tương lai',
      icon: Wrench,
      badge: 'Mở rộng',
      children: [
        {
          id: 'tool-sticky-notes',
          title: 'Sticky Notes',
          desc: 'Ghi chú nhanh dạng file .txt',
          path: '/tools/sticky-notes',
          icon: StickyNote,
          badge: 'Mới'
        },
        {
          id: 'tool-compare-text',
          title: 'Compare Text Online',
          desc: 'Diff dòng, từ, ký tự & patch',
          path: '/tools/compare-text',
          icon: ArrowLeftRight,
          badge: 'Online'
        },
        {
          id: 'tool-text-formatter',
          title: 'Text Formatter Online',
          desc: 'Nén 1 dòng & Smart JSON',
          path: '/tools/text-formatter',
          icon: AlignLeft,
          badge: 'Online'
        },
        {
          id: 'tool-api',
          title: 'API Client & Tester',
          desc: 'Kiểm thử REST & JSON',
          path: '/tools/api',
          icon: Terminal,
          disabled: true,
          badge: 'Soon'
        },
        {
          id: 'tool-db',
          title: 'Database Studio',
          desc: 'Truy vấn & kết nối CSDL',
          path: '/tools/db',
          icon: Database,
          disabled: true,
          badge: 'Soon'
        },
        {
          id: 'tool-codegen',
          title: 'Code & DTO Generator',
          desc: 'Sinh boilerplate tự động',
          path: '/tools/codegen',
          icon: Code2,
          disabled: true,
          badge: 'Soon'
        }
      ]
    },
    {
      id: 'settings',
      title: 'Cấu Hình & Hệ Thống',
      desc: 'System config & storage',
      path: '/settings',
      icon: Settings,
      children: [
        {
          id: 'settings-jira',
          title: 'Cài Đặt Chung & Jira',
          desc: 'Cấu hình Jira & giao diện',
          path: '/settings',
          icon: Sliders,
          exact: true
        },
        {
          id: 'settings-storage',
          title: 'Bộ Nhớ & Đồng Bộ Disk',
          desc: 'Quản trị file & database',
          path: '/settings#storage',
          icon: HardDrive
        }
      ]
    }
  ];

  // Check if a child item is currently active
  const isChildActive = (child: NavSubItem) => {
    if (child.exact) {
      if (child.path === '/jira') {
        return location.pathname === '/jira' || location.pathname.startsWith('/jira/board');
      }
      return location.pathname === child.path;
    }
    return location.pathname.startsWith(child.path);
  };

  // Check if parent item or any of its children is active
  const isParentActive = (item: NavItem) => {
    if (item.exact && item.path) {
      return location.pathname === item.path;
    }
    if (item.path && location.pathname.startsWith(item.path)) {
      return true;
    }
    if (item.children) {
      return item.children.some(child => isChildActive(child));
    }
    return false;
  };

  // Auto-expand group if current path matches one of its children
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && isParentActive(item)) {
        setOpenGroups(prev => prev[item.id] ? prev : { ...prev, [item.id]: true });
      }
    });
  }, [location.pathname]);

  return (
    <>
      {/* ========================================================================= */}
      {/* --- DESKTOP COLLAPSIBLE SIDEBAR (w-16 collapsed, w-64 expanded) --- */}
      {/* ========================================================================= */}
      <aside 
        className={clsx(
          'hidden md:flex bg-card border-r border-border flex-col py-4 shrink-0 select-none z-30 transition-all duration-300 ease-in-out',
          isDesktopCollapsed ? 'w-16 items-center px-2' : 'w-64 px-3'
        )}
      >
        {/* --- HEADER --- */}
        {isDesktopCollapsed ? (
          /* Collapsed Header: Centered Logo + Click to Expand */
          <div className="flex flex-col items-center pb-3 mb-2 border-b border-border/60 w-full">
            <button
              type="button"
              onClick={onToggleDesktopCollapse}
              className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md transition-all hover:scale-105 group relative"
              title="Mở rộng menu bên trái (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <Terminal className="w-5 h-5 font-bold group-hover:hidden" />
              <PanelLeftOpen className="w-5 h-5 font-bold hidden group-hover:block" />
            </button>
          </div>
        ) : (
          /* Expanded Header: Brand + Title + Collapse Button */
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/60 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shrink-0 transition-transform hover:scale-105">
                <Terminal className="w-4 h-4 font-bold" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm text-foreground tracking-tight truncate">DevToolkit</h2>
                <p className="text-[10px] text-muted-foreground font-mono truncate">v1.2.0 • Pro Handover</p>
              </div>
            </div>
            {onToggleDesktopCollapse && (
              <button
                type="button"
                onClick={onToggleDesktopCollapse}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0"
                title="Thu gọn menu bên trái (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* --- NAVIGATION LIST --- */}
        <div className="flex-1 flex flex-col gap-1 w-full overflow-y-auto overflow-x-hidden scrollbar-thin">
          {!isDesktopCollapsed && (
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5 mt-1">
              Chức Năng Hệ Thống
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const parentActive = isParentActive(item);
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = !!openGroups[item.id];

            /* ========================================================== */
            /* 1. COLLAPSED DESKTOP VIEW (Icon Bar + Hover Flyout Submenu) */
            /* ========================================================== */
            if (isDesktopCollapsed) {
              return (
                <div key={item.id} className="relative group w-full flex justify-center py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.path) {
                        navigate(item.path);
                      } else if (onToggleDesktopCollapse) {
                        onToggleDesktopCollapse();
                      }
                    }}
                    title={item.isProtected && !isJiraAuthenticated ? `${item.title} (Cần đăng nhập Jira)` : item.title}
                    className={clsx(
                      'w-11 h-11 rounded-xl flex items-center justify-center transition-all relative',
                      parentActive
                        ? 'bg-accent text-primary font-semibold shadow-inner'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      item.disabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />

                    {/* Jira Protected Indicator */}
                    {item.isProtected && (
                      <div className="absolute top-1 right-1">
                        {isJiraAuthenticated ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 block shadow-sm" title="Jira kết nối" />
                        ) : (
                          <span className="w-3 h-3 rounded-full bg-muted flex items-center justify-center text-muted-foreground shadow-sm" title="Cần đăng nhập Jira">
                            <Lock className="w-2 h-2" />
                          </span>
                        )}
                      </div>
                    )}

                    {/* Active vertical pill indicator */}
                    {parentActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r" />
                    )}
                  </button>

                  {/* Sleek Flyout Popover on Hover (Shows 2-Level Submenu directly) */}
                  <div className="absolute left-full top-0 ml-2 w-56 bg-card border border-border shadow-2xl rounded-xl p-2.5 z-50 invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150">
                    <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-border/60">
                      <div className="font-bold text-xs text-foreground truncate">{item.title}</div>
                      {item.badge && (
                        <span className={clsx(
                          'text-[9px] font-semibold px-1.5 py-0.2 rounded-full border',
                          item.badge === 'Connected' || item.badge === 'Core'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/10 border-primary/20 text-primary'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {hasChildren ? (
                      <div className="space-y-1">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isChildActive(child);

                          if (child.disabled) {
                            return (
                              <div
                                key={child.id}
                                className="flex items-center justify-between px-2 py-1.5 rounded-lg text-muted-foreground/40 text-xs cursor-not-allowed"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {ChildIcon && <ChildIcon className="w-3.5 h-3.5 shrink-0" />}
                                  <span className="truncate">{child.title}</span>
                                </div>
                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">Soon</span>
                              </div>
                            );
                          }

                          return (
                            <NavLink
                              key={child.id}
                              to={child.path}
                              className={clsx(
                                'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition',
                                childActive
                                  ? 'bg-primary/10 text-primary font-bold shadow-xs'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {ChildIcon && <ChildIcon className={clsx('w-3.5 h-3.5 shrink-0', childActive ? 'text-primary' : 'text-muted-foreground')} />}
                                <span className="truncate">{child.title}</span>
                              </div>
                              {child.badge && (
                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                                  {child.badge}
                                </span>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                    )}
                  </div>
                </div>
              );
            }

            /* ========================================================== */
            /* 2. EXPANDED DESKTOP VIEW (Full 2-Level Hierarchical Accordion) */
            /* ========================================================== */
            return (
              <div key={item.id} className="w-full flex flex-col py-0.5">
                {/* Level 1 Item Row */}
                {hasChildren ? (
                  <div
                    onClick={() => toggleGroup(item.id)}
                    className={clsx(
                      'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none group',
                      parentActive
                        ? 'bg-accent/80 text-foreground font-bold'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={clsx('w-4 h-4 shrink-0', parentActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span className={clsx(
                          'text-[9px] font-semibold px-1.5 py-0.2 rounded-full border',
                          item.badge === 'Connected' || item.badge === 'Core'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/10 border-primary/20 text-primary'
                        )}>
                          {item.badge}
                        </span>
                      )}
                      <span 
                        className="p-0.5 rounded hover:bg-accent/80 text-muted-foreground transition"
                        title={isOpen ? 'Thu gọn' : 'Mở rộng'}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <NavLink
                    to={item.path || '#'}
                    className={clsx(
                      'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition',
                      parentActive
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={clsx('w-4 h-4 shrink-0', parentActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )}

                {/* Level 2 Sub-Menu (Nested with tree guide line) */}
                {hasChildren && isOpen && (
                  <div className="ml-4 pl-2.5 border-l-2 border-border/80 my-1 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isChildActive(child);

                      if (child.disabled) {
                        return (
                          <div
                            key={child.id}
                            className="flex items-center justify-between px-2 py-1.5 rounded-lg text-muted-foreground/40 text-[11px] cursor-not-allowed select-none"
                            title={`${child.title} (Sắp ra mắt)`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {ChildIcon ? <ChildIcon className="w-3.5 h-3.5 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />}
                              <span className="truncate">{child.title}</span>
                            </div>
                            <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-mono">Soon</span>
                          </div>
                        );
                      }

                      return (
                        <NavLink
                          key={child.id}
                          to={child.path}
                          className={clsx(
                            'flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-all relative',
                            childActive
                              ? 'bg-primary/10 text-primary font-bold border-l-2 -ml-[12px] pl-[10px] border-primary'
                              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {ChildIcon ? (
                              <ChildIcon className={clsx('w-3.5 h-3.5 shrink-0', childActive ? 'text-primary' : 'text-muted-foreground')} />
                            ) : (
                              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', childActive ? 'bg-primary' : 'bg-muted-foreground')} />
                            )}
                            <span className="truncate">{child.title}</span>
                          </div>

                          {child.badge && (
                            <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-mono">
                              {child.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* --- FOOTER DESKTOP --- */}
        <div className="pt-3 border-t border-border/60 w-full flex flex-col gap-2">
          {isDesktopCollapsed ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <NavLink
                to="/settings"
                title="Cài đặt hệ thống"
                className={clsx(
                  'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                  location.pathname === '/settings'
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Settings className="w-5 h-5" />
              </NavLink>

              <div 
                className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center text-[11px] font-bold text-foreground"
                title="Môi trường phát triển cục bộ"
              >
                DEV
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full px-1">
              <div className="p-2 rounded-xl bg-accent/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    DEV
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">Local Workspace</div>
                    <div className="text-[10px] text-muted-foreground truncate">Disk Storage Ready</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">Active</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* --- MOBILE DRAWER & BACKDROP --- */}
      {/* ========================================================================= */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[290px] max-w-[85vw] bg-card border-r border-border flex flex-col p-4 shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
              <Terminal className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-foreground">DevToolkit</h2>
              <p className="text-[11px] text-muted-foreground font-mono">v1.2.0 • Pro Handover</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition"
            aria-label="Đóng thanh menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Navigation List with 2-Level Menus */}
        <div className="flex-1 py-3 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
            Menu Chức Năng
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const parentActive = isParentActive(item);
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = !!openGroups[item.id];

            return (
              <div key={item.id} className="w-full flex flex-col">
                {/* Level 1 item */}
                <div
                  onClick={() => {
                    if (hasChildren) {
                      toggleGroup(item.id);
                    } else if (item.path) {
                      navigate(item.path);
                      onCloseMobile?.();
                    }
                  }}
                  className={clsx(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer',
                    parentActive
                      ? 'bg-accent/80 text-foreground font-bold'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={clsx('w-5 h-5 shrink-0', parentActive ? 'text-primary' : 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.title}</div>
                      {item.desc && <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className={clsx(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                        item.badge === 'Connected' || item.badge === 'Core'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-primary/10 border-primary/20 text-primary'
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {hasChildren && (
                      <span className="text-muted-foreground p-0.5">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Level 2 Sub-items in mobile drawer */}
                {hasChildren && isOpen && (
                  <div className="ml-5 pl-3 border-l-2 border-border/80 my-1 space-y-1">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isChildActive(child);

                      if (child.disabled) {
                        return (
                          <div
                            key={child.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground/40 text-xs cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2.5">
                              {ChildIcon && <ChildIcon className="w-4 h-4" />}
                              <span>{child.title}</span>
                            </div>
                            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono">Soon</span>
                          </div>
                        );
                      }

                      return (
                        <NavLink
                          key={child.id}
                          to={child.path}
                          onClick={onCloseMobile}
                          className={clsx(
                            'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all',
                            childActive
                              ? 'bg-primary/10 text-primary font-bold border-l-2 -ml-[14px] pl-[12px] border-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {ChildIcon && <ChildIcon className={clsx('w-4 h-4 shrink-0', childActive ? 'text-primary' : 'text-muted-foreground')} />}
                            <span className="truncate">{child.title}</span>
                          </div>
                          {child.badge && (
                            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                              {child.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="pt-3 border-t border-border/60 space-y-2">
          <NavLink
            to="/settings"
            onClick={onCloseMobile}
            className={clsx(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all',
              location.pathname === '/settings'
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-foreground hover:bg-accent'
            )}
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-semibold">Cài Đặt & Cấu Hình</span>
          </NavLink>

          <div className="bg-muted/40 p-3 rounded-xl border border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                DEV
              </div>
              <span className="text-xs font-semibold">Local Workspace</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
