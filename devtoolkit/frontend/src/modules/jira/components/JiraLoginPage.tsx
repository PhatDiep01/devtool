import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  KeyRound, 
  ExternalLink, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  Globe, 
  Building2, 
  Sparkles,
  Info,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { toast } from 'react-hot-toast';

export const JiraLoginPage: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, configInfo, fetchConfigInfo } = useJiraAuthStore();

  const [baseUrl, setBaseUrl] = useState('https://task.ascvn.com.vn');
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    fetchConfigInfo();
  }, [fetchConfigInfo]);

  useEffect(() => {
    if (configInfo?.configuredBaseUrl) {
      setBaseUrl(configInfo.configuredBaseUrl);
    }
  }, [configInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    let cleanUrl = baseUrl.trim();
    if (!cleanUrl) {
      cleanUrl = 'https://task.ascvn.com.vn';
      setBaseUrl(cleanUrl);
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
      setBaseUrl(cleanUrl);
    }

    if (!apiToken.trim()) {
      toast.error('Vui lòng nhập Jira API Token hoặc Personal Access Token');
      return;
    }

    const success = await login({
      baseUrl: cleanUrl,
      apiToken: apiToken.trim(),
      authType: 'bearer',
      rememberMe
    });

    if (success) {
      toast.success(
        rememberMe 
          ? 'Đã kết nối Jira và lưu token vào SQLite!' 
          : 'Đã kết nối Jira (phiên tạm thời 1 phiên làm việc)!'
      );
      onSuccess?.();
    }
  };

  const handleWorkspaceFastPass = async () => {
    clearError();
    const success = await login({
      useWorkspace: true,
      rememberMe: true
    });

    if (success) {
      toast.success('Đã kết nối thành công với Jira qua Token lưu trên máy!');
      onSuccess?.();
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-b from-background via-background to-accent/20">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Jira Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 mb-1 transition-transform hover:scale-105">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M11.53 2c0 2.4 1.97 4.35 4.39 4.35h2.19v2.18c0 2.41 1.97 4.36 4.39 4.36V2H11.53zm-5.76 5.82c0 2.4 1.97 4.35 4.39 4.35h2.19v2.18c0 2.41 1.97 4.36 4.39 4.36V7.82H5.77zM0 13.64c0 2.4 1.97 4.35 4.39 4.35h2.19v2.18c0 2.41 1.97 4.36 4.39 4.36V13.64H0z" />
            </svg>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Xác Thực Jira Workspace</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            Đăng Nhập Jira
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Chỉ cần nhập <b>Jira API Token</b> (hoặc Personal Access Token) để truy cập Kanban Board, Sprint Hub và Log Work.
          </p>
        </div>

        {/* Workspace Fast-Pass Notice if already configured on server */}
        {configInfo?.hasConfigured && (
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold">Đã có Token lưu trên máy: </span>
                <span className="font-mono">{configInfo.configuredBaseUrl}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleWorkspaceFastPass}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-sm shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đăng Nhập Nhanh</span>
            </button>
          </div>
        )}

        {/* Handover Notice Banner */}
        <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/80 flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <b>Lưu ý:</b> Tài liệu đặc tả kỹ thuật luôn mở công khai cho tất cả mọi người. Việc đăng nhập Jira chỉ dùng cho các thao tác quản lý Task, Sprint và Ghi nhận giờ làm (Log Work).
          </span>
        </div>

        {/* Auth Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Main Login Form - ONLY REQUIRES JIRA TOKEN */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Jira Server URL Display & Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                <span>Máy Chủ Jira (Site URL)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowUrlEdit(!showUrlEdit)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
              >
                <span>{showUrlEdit ? 'Thu gọn' : 'Đổi máy chủ'}</span>
                {showUrlEdit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            
            {showUrlEdit ? (
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://task.ascvn.com.vn"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-primary transition"
              />
            ) : (
              <div 
                onClick={() => setShowUrlEdit(true)}
                className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground flex items-center justify-between cursor-pointer hover:bg-muted/60 transition"
                title="Bấm để chỉnh sửa URL máy chủ Jira"
              >
                <span className="truncate">{baseUrl}</span>
                <span className="text-[10px] text-muted-foreground font-sans">Mặc định</span>
              </div>
            )}
          </div>

          {/* Jira API Token / Access Token Input */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1 items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                <span>Jira API Token / Personal Access Token (PAT)</span>
              </label>
              <a
                href={`${baseUrl.replace(/\/+$/, '')}/secure/ViewProfile.jspa`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                title="Mở hồ sơ cá nhân Jira để tạo Personal Access Token"
              >
                <span>Tạo Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Nhập Jira API Token hoặc Bearer PAT..."
                required
                autoFocus
                className="w-full bg-background border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-sm focus:outline-none focus:border-primary font-mono text-xs transition"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition"
                aria-label={showToken ? 'Ẩn token' : 'Hiện token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chỉ cần nhập Token, hệ thống sẽ tự động xác thực và nhận diện người dùng tương ứng.
            </p>
          </div>

          {/* Remember Me Checkbox with Explicit Clear Storage Description */}
          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/60 space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer mt-0.5 shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-foreground">Keep me signed in on this device</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {rememberMe ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Đã chọn: Token sẽ được lưu vào SQLite trên máy và duy trì đăng nhập (30 ngày).
                    </span>
                  ) : (
                    <span>
                      Không chọn: Token <b>sẽ KHÔNG lưu vào SQLite</b>. Phiên đăng nhập sẽ kết thúc sau 1 phiên làm việc hoặc khi đóng trình duyệt.
                    </span>
                  )}
                </p>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang kết nối đến máy chủ Jira...</span>
              </>
            ) : (
              <>
                <span>Đăng Nhập Jira</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Navigation fallback for guests & reviewers */}
        <div className="pt-2 border-t border-border/60 space-y-2">
          <button
            type="button"
            onClick={() => navigate('/docs')}
            className="w-full py-2.5 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Tài Liệu Đặc Tả Công Khai</span>
          </button>
        </div>

      </div>
    </div>
  );
};
