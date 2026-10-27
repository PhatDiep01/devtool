import React, { useState, useEffect } from 'react';
import { Shield, HardDrive, Globe, Check, AlertCircle, Server, FileText, Image as ImageIcon, StickyNote, Database, RefreshCw } from 'lucide-react';
import { settingsApi } from '../../services/api';
import { useThemeStore } from '../../stores/theme.store';
import { StorageStats } from '../../types';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [jiraUrl, setJiraUrl] = useState('https://task.ascvn.com.vn');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [testingJira, setTestingJira] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Purge any legacy trycloudflare links from localStorage
    try {
      const stored = localStorage.getItem('custom_api_url');
      if (stored && stored.includes('.trycloudflare.com')) {
        localStorage.removeItem('custom_api_url');
      }
    } catch (e) {
      // ignore
    }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, storageRes] = await Promise.all([
        settingsApi.getAll(),
        settingsApi.getStorageStats()
      ]);

      const jira = settingsRes.data.jira || {};
      setJiraUrl(jira.jira_base_url || 'https://task.ascvn.com.vn');
      setJiraEmail(jira.jira_email || '');
      setJiraToken(jira.jira_api_token || '');
      setStorageStats(storageRes.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleTestAndSaveJira = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingJira(true);
    setTestResult(null);
    setSaveSuccess(false);

    try {
      const testRes = await settingsApi.testJira({
        baseUrl: jiraUrl,
        email: jiraEmail,
        apiToken: jiraToken
      });

      setTestResult({ success: true, message: testRes.data.message });

      // Save to SQLite
      await settingsApi.update([
        { key: 'jira_base_url', value: jiraUrl, category: 'jira' },
        { key: 'jira_email', value: jiraEmail, category: 'jira' },
        { key: 'jira_api_token', value: jiraToken, category: 'jira' }
      ]);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to connect to Jira'
      });
    } finally {
      setTestingJira(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Settings & Configuration</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Quản lý tích hợp Jira, lưu trữ SQLite local và tùy chỉnh giao diện.
        </p>
      </div>

      {/* Backend & Database Connection Status */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">Backend & Database System</h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đã kết nối cố định 24/7
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Toàn bộ dữ liệu được đồng bộ an toàn với máy chủ backend và cơ sở dữ liệu SQLite local qua tên miền chính thức.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono font-semibold text-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border/60">
              https://devtool.phatdiep.io.vn
            </span>
          </div>
        </div>
      </div>

      {/* Jira Settings */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border/50">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Jira Integration</h3>
            <p className="text-xs text-muted-foreground">Used for board visualization and task tracking proxy</p>
          </div>
        </div>

        <form onSubmit={handleTestAndSaveJira} className="space-y-4 pt-2">
          {testResult && (
            <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Jira Base URL (Mặc định: https://task.ascvn.com.vn - Có thể tùy chỉnh)
              </label>
            </div>
            <input
              type="text"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://task.ascvn.com.vn"
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Account (Không bắt buộc khi dùng PAT)</label>
              <input
                type="email"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
                placeholder="Không bắt buộc với Jira PAT / Server"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Jira API Token</label>
              <input
                type="password"
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-muted-foreground">
              Stored securely in local SQLite database on your machine.
            </span>
            <button
              type="submit"
              disabled={testingJira}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 disabled:opacity-50 transition shadow-sm shrink-0"
            >
              {testingJira ? 'Testing Connection...' : saveSuccess ? 'Saved Successfully!' : 'Test & Save Connection'}
            </button>
          </div>
        </form>
      </div>

      {/* Local Storage Status */}
      {storageStats && (
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Local Storage Metrics</h3>
                <p className="text-xs text-muted-foreground">
                  Thống kê tệp lưu trữ persistent dưới thư mục <code className="font-mono text-[11px] bg-accent px-1.5 py-0.5 rounded">data_docs_tooldev</code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground">Tổng dung lượng:</span>
                <span className="font-mono font-bold text-xs text-primary ml-1.5 bg-primary/10 px-2 py-0.5 rounded-md">
                  {storageStats.totalSize} ({storageStats.overallFileCount || 0} tệp)
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await settingsApi.getStorageStats();
                    setStorageStats(res.data);
                    toast.success('Đã cập nhật chỉ số lưu trữ');
                  } catch {
                    toast.error('Không thể tải chỉ số lưu trữ');
                  }
                }}
                className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Làm mới chỉ số lưu trữ"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-1">
            {/* 1. Docs & Screens */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Tài liệu & Screens</span>
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {storageStats.totalDocs} <span className="text-xs font-normal text-muted-foreground">tệp</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">{storageStats.docsSize}</span>
                {storageStats.dbModulesCount !== undefined && (
                  <span>{storageStats.dbModulesCount} module</span>
                )}
              </div>
            </div>

            {/* 2. Uploaded Images & Bug Files */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Hình ảnh & Bug Files</span>
                <ImageIcon className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {storageStats.totalImages} <span className="text-xs font-normal text-muted-foreground">ảnh</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">{storageStats.imagesSize}</span>
                {storageStats.bugFilesCount !== undefined && (
                  <span>{storageStats.bugFilesCount} ảnh bug</span>
                )}
              </div>
            </div>

            {/* 3. Sticky Notes */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Sticky Notes</span>
                <StickyNote className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {storageStats.totalStickyNotes ?? 0} <span className="text-xs font-normal text-muted-foreground">ghi chú</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">{storageStats.stickyNotesSize || '0 B'}</span>
                <span>Active</span>
              </div>
            </div>

            {/* 4. SQLite Database */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">SQLite Database</span>
                <Database className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-foreground font-mono">
                {storageStats.databaseSize || '0 B'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">devtoolkit.db</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">WAL Mode</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Appearance */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-foreground">Appearance</h3>
        <p className="text-xs text-muted-foreground">Choose your preferred visual theme</p>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition ${
              theme === 'light' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border hover:bg-accent text-foreground'
            }`}
          >
            Light Theme
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition ${
              theme === 'dark' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border hover:bg-accent text-foreground'
            }`}
          >
            Dark Theme
          </button>
        </div>
      </div>
    </div>
  );
};