import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Shield, HardDrive, Globe, Check, AlertCircle, Server, Radio, RotateCcw, ExternalLink, RefreshCw } from 'lucide-react';
import { settingsApi, getActiveApiUrl } from '../../services/api';
import { useThemeStore } from '../../stores/theme.store';
import { StorageStats } from '../../types';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [testingJira, setTestingJira] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cloudflare Tunnel & Custom Backend API URL states
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [tunnelTestResult, setTunnelTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tunnelSaveSuccess, setTunnelSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
    const savedApi = localStorage.getItem('custom_api_url') || '';
    setCustomApiUrl(savedApi);
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, storageRes] = await Promise.all([
        settingsApi.getAll(),
        settingsApi.getStorageStats()
      ]);

      const jira = settingsRes.data.jira || {};
      setJiraUrl(jira.jira_base_url || '');
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

  const handleTestTunnel = async () => {
    setTestingTunnel(true);
    setTunnelTestResult(null);

    const testUrl = (customApiUrl.trim() || getActiveApiUrl() || window.location.origin).replace(/\/+$/, '');
    try {
      const res = await axios.get(`${testUrl}/api/docs/stats`, { timeout: 6000 });
      if (res.status === 200) {
        setTunnelTestResult({
          success: true,
          message: `Kết nối thành công! Đã kết nối đến Backend SQLite (${res.data?.totalModules || 0} modules, ${res.data?.totalScreens || 0} screens).`
        });
      } else {
        setTunnelTestResult({
          success: false,
          message: `Server phản hồi mã HTTP ${res.status}.`
        });
      }
    } catch (err: any) {
      setTunnelTestResult({
        success: false,
        message: err.message || 'Không thể kết nối đến Backend qua URL này. Hãy đảm bảo Backend (port 3001) và Cloudflare Tunnel đã được khởi động.'
      });
    } finally {
      setTestingTunnel(false);
    }
  };

  const handleSaveTunnelUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = customApiUrl.trim().replace(/\/+$/, '');
    if (cleanUrl) {
      localStorage.setItem('custom_api_url', cleanUrl);
    } else {
      localStorage.removeItem('custom_api_url');
    }
    setTunnelSaveSuccess(true);
    setTimeout(() => {
      setTunnelSaveSuccess(false);
      window.location.reload();
    }, 700);
  };

  const handleResetTunnelUrl = () => {
    localStorage.removeItem('custom_api_url');
    setCustomApiUrl('');
    setTunnelTestResult(null);
    window.location.reload();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Settings & Configuration</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Quản lý kết nối Cloudflare Tunnel, lưu trữ SQLite local, Jira credentials và giao diện.
        </p>
      </div>

      {/* Cloudflare Tunnel & Backend Database Link */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">Cloudflare Tunnel / Backend URL</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  getActiveApiUrl()
                    ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}>
                  {getActiveApiUrl() ? 'Tunnel Connected' : 'Default (Local)'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Kết nối Frontend (Firebase Hosting) về Backend & Database SQLite trên máy tính cá nhân
              </p>
            </div>
          </div>

          {localStorage.getItem('custom_api_url') && (
            <button
              type="button"
              onClick={handleResetTunnelUrl}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 self-start sm:self-auto"
              title="Khôi phục về URL mặc định"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục mặc định</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveTunnelUrl} className="space-y-4 pt-1">
          {tunnelTestResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              tunnelTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {tunnelTestResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{tunnelTestResult.message}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Đường dẫn Backend API (HTTPS từ Cloudflare Tunnel):
              </label>
              <span className="text-[11px] font-mono text-muted-foreground/80">
                Hiện tại: {getActiveApiUrl() || '(Đang gọi cùng domain)'}
              </span>
            </div>
            <input
              type="url"
              value={customApiUrl}
              onChange={(e) => setCustomApiUrl(e.target.value)}
              placeholder="https://your-tunnel.trycloudflare.com hoặc https://api.yourdomain.com"
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary font-mono text-xs"
            />
          </div>

          <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-[11px] text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-primary" />
              <span>Cách mở Cloudflare Tunnel trên máy tính cá nhân:</span>
            </div>
            <p>1. Cài đặt Cloudflare CLI: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground">winget install Cloudflare.cloudflared</code></p>
            <p>2. Chạy mở tunnel port 3001: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground">cloudflared tunnel --url http://localhost:3001</code></p>
            <p>3. Copy link HTTPS có đuôi <code className="text-foreground font-mono">.trycloudflare.com</code> dán vào ô trên và bấm <strong>Lưu URL Backend</strong>.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestTunnel}
              disabled={testingTunnel}
              className="px-4 py-2 border border-border bg-background hover:bg-accent text-foreground font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingTunnel ? 'animate-spin' : ''}`} />
              <span>{testingTunnel ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition shadow-sm shrink-0"
            >
              {tunnelSaveSuccess ? 'Đã lưu & Đang tải lại...' : 'Lưu URL Backend'}
            </button>
          </div>
        </form>
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
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Jira Cloud Base URL</label>
            <input
              type="text"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://your-company.atlassian.net"
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
          <div className="flex items-center gap-3 pb-3 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Local Storage Metrics</h3>
              <p className="text-xs text-muted-foreground">Persistent files stored under data_docs_tooldev</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-muted-foreground">Total Docs</span>
              <div className="text-lg sm:text-xl font-bold mt-1 text-foreground">{storageStats.totalDocs} files</div>
              <span className="text-[11px] text-muted-foreground font-mono">{storageStats.docsSize}</span>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-muted-foreground">Uploaded Images</span>
              <div className="text-lg sm:text-xl font-bold mt-1 text-foreground">{storageStats.totalImages} images</div>
              <span className="text-[11px] text-muted-foreground font-mono">{storageStats.imagesSize}</span>
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
