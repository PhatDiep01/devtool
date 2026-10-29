import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'DevToolkit';

export function formatPageTitle(title?: string | null): string {
  if (!title || !title.trim() || title.trim() === APP_NAME) {
    return APP_NAME;
  }
  return `${title.trim()} | ${APP_NAME}`;
}

export function setDocumentTitle(title?: string | null): void {
  if (typeof document !== 'undefined') {
    document.title = formatPageTitle(title);
  }
}

/**
 * Hook to set page title on component mount and update
 */
export function usePageTitle(title?: string | null, deps: any[] = []): void {
  useEffect(() => {
    if (title) {
      setDocumentTitle(title);
    }
  }, [title, ...deps]);
}

/**
 * Route-based Title Mapper
 */
export function getRouteTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';

  // Docs Module
  if (path === '/' || path === '/docs') {
    return 'Tài liệu Dự án';
  }
  if (path === '/docs/bugs') {
    return 'Bug Tracker';
  }
  if (path === '/docs/import') {
    return 'Import Tài liệu';
  }
  if (path === '/docs/search') {
    return 'Tìm kiếm Tài liệu';
  }
  if (path === '/docs/screens/new') {
    return 'Tạo Màn hình mới';
  }
  if (path.startsWith('/docs/screen/') && path.endsWith('/edit')) {
    return 'Chỉnh sửa Màn hình';
  }
  if (path.startsWith('/docs/screen/')) {
    return 'Chi tiết Màn hình';
  }
  if (path.startsWith('/docs/')) {
    return 'Module Tài liệu';
  }

  // Jira Module
  if (path === '/jira') {
    return 'Jira Dashboard';
  }
  if (path === '/jira/sprints') {
    return 'Quản lý Sprints';
  }
  if (path === '/jira/tasks') {
    return 'Danh sách Tasks';
  }
  if (path === '/jira/logwork') {
    return 'Chấm công Log Work';
  }
  if (path === '/jira/activity-stream') {
    return 'Activity Stream - Toàn bộ nhân sự log time';
  }
  if (path.startsWith('/jira/board/')) {
    return 'Kanban Board';
  }

  // Tools Module
  if (path === '/tools/crypto-identity') {
    return 'Mã hóa & Định danh';
  }
  if (path === '/tools/sticky-notes') {
    return 'Ghi chú Sticky Notes';
  }
  if (path === '/tools/text-formatter') {
    return 'Định dạng Văn bản (Formatter)';
  }
  if (path === '/tools/compare-text') {
    return 'So sánh Văn bản (Diff)';
  }
  if (path === '/tools') {
    return 'Công cụ Tiện ích';
  }

  // Settings
  if (path === '/settings') {
    return 'Cài đặt Hệ thống';
  }

  return APP_NAME;
}

/**
 * Route listener component that synchronizes document.title on every navigation
 */
export const PageTitleManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const title = getRouteTitle(location.pathname);
    setDocumentTitle(title);
  }, [location.pathname]);

  return null;
};
