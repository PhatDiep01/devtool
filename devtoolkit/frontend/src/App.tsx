import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppToaster } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
import { DocsDashboard } from './modules/docs/pages/DocsDashboard';
import { ModuleScreens } from './modules/docs/pages/ModuleScreens';
import { ScreenDetail } from './modules/docs/pages/ScreenDetail';
import { ScreenEditorPage } from './modules/docs/pages/ScreenEditorPage';
import { ImportScreen } from './modules/docs/pages/ImportScreen';
import { SearchResults } from './modules/docs/pages/SearchResults';
import { BugTrackerPage } from './modules/docs/pages/BugTrackerPage';
import { JiraDashboard } from './modules/jira/pages/JiraDashboard';
import { KanbanBoard } from './modules/jira/pages/KanbanBoard';
import { JiraSprintsPage } from './modules/jira/pages/JiraSprintsPage';
import { JiraTasksPage } from './modules/jira/pages/JiraTasksPage';
import { JiraLogworkPage } from './modules/jira/pages/JiraLogworkPage';
import { JiraRouteGuard } from './modules/jira/components/JiraRouteGuard';
import { SettingsPage } from './modules/settings/SettingsPage';
import { TextFormatterPage } from './modules/tools/TextFormatter/TextFormatterPage';
import { CompareTextPage } from './modules/tools/CompareText/CompareTextPage';
import { StickyNotesPage } from './modules/tools/StickyNotes/StickyNotesPage';
import { useThemeStore } from './stores/theme.store';
import { PageTitleManager } from './utils/usePageTitle';

export const App: React.FC = () => {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <>
      <PageTitleManager />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/docs" replace />} />
          
          {/* Docs Module */}
          <Route path="/docs" element={<DocsDashboard />} />
          <Route path="/docs/bugs" element={<BugTrackerPage />} />
          <Route path="/docs/:moduleSlug" element={<ModuleScreens />} />
          <Route path="/docs/screen/:id" element={<ScreenDetail />} />
          <Route path="/docs/screen/:id/edit" element={<ScreenEditorPage />} />
          <Route path="/docs/screens/new" element={<ScreenEditorPage />} />
          <Route path="/docs/import" element={<ImportScreen />} />
          <Route path="/docs/search" element={<SearchResults />} />

          {/* Jira Module - Protected with JiraRouteGuard */}
          <Route 
            path="/jira" 
            element={
              <JiraRouteGuard>
                <JiraDashboard />
              </JiraRouteGuard>
            } 
          />
          <Route 
            path="/jira/board/:boardId" 
            element={
              <JiraRouteGuard>
                <KanbanBoard />
              </JiraRouteGuard>
            } 
          />
          <Route 
            path="/jira/sprints" 
            element={
              <JiraRouteGuard>
                <JiraSprintsPage />
              </JiraRouteGuard>
            } 
          />
          <Route 
            path="/jira/tasks" 
            element={
              <JiraRouteGuard>
                <JiraTasksPage />
              </JiraRouteGuard>
            } 
          />
          <Route 
            path="/jira/logwork" 
            element={
              <JiraRouteGuard>
                <JiraLogworkPage />
              </JiraRouteGuard>
            } 
          />

          {/* Dev Tools Module */}
          <Route path="/tools/sticky-notes" element={<StickyNotesPage />} />
          <Route path="/tools/text-formatter" element={<TextFormatterPage />} />
          <Route path="/tools/compare-text" element={<CompareTextPage />} />
          <Route path="/tools" element={<Navigate to="/tools/sticky-notes" replace />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/docs" replace />} />
        </Route>
      </Routes>
      <AppToaster position="top-right" />
    </>
  );
};

export default App;
