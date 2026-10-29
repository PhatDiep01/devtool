import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  KeyRound, 
  ExternalLink, 
  AlertCircle, 
  Lock, 
  User,
  Eye, 
  EyeOff, 
  Globe, 
  Info,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { getRememberedAuth, clearRememberedAuth } from '../../../utils/auth-crypto';
import { toast } from 'react-hot-toast';

export const JiraLoginPage: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { 
    login, 
    isLoading, 
    error, 
    clearError, 
    configInfo, 
    fetchConfigInfo,
    isCaptcha,
    captchaId,
    captchaImage,
    fetchCaptcha,
    resetCaptcha
  } = useJiraAuthStore();

  const [authTab, setAuthTab] = useState<'token' | 'basic'>('token');
  const [baseUrl, setBaseUrl] = useState('https://task.ascvn.com.vn');
  const [showUrlEdit, setShowUrlEdit] = useState(false);

  // Tab 1: Token / PAT
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Tab 2: Username & Password (Basic Auth)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // CAPTCHA State
  const [captchaResponse, setCaptchaResponse] = useState('');
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const captchaInputRef = React.useRef<HTMLInputElement>(null);

  // Common options
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberedUser, setRememberedUser] = useState<{
    username?: string;
    authTab: 'token' | 'basic';
  } | null>(null);

  useEffect(() => {
    fetchConfigInfo();
  }, [fetchConfigInfo]);

  // Load remembered credentials from localStorage (de-obfuscated securely client-side)
  useEffect(() => {
    const saved = getRememberedAuth();
    if (saved) {
      setRememberMe(true);
      if (saved.baseUrl) setBaseUrl(saved.baseUrl);
      if (saved.authTab) setAuthTab(saved.authTab);
      if (saved.username) setUsername(saved.username);
      if (saved.password) setPassword(saved.password);
      if (saved.apiToken) setApiToken(saved.apiToken);
      setRememberedUser({
        username: saved.username,
        authTab: saved.authTab
      });
    }
  }, []);

  useEffect(() => {
    if (configInfo?.configuredBaseUrl && !getRememberedAuth()?.baseUrl) {
      setBaseUrl(configInfo.configuredBaseUrl);
    }
    if (configInfo?.authType === 'basic' && !getRememberedAuth()?.authTab) {
      setAuthTab('basic');
    }
  }, [configInfo]);

  const handleSwitchTab = (tab: 'token' | 'basic') => {
    if (authTab !== tab) {
      setAuthTab(tab);
      clearError();
      if (tab === 'token') {
        resetCaptcha();
        setCaptchaResponse('');
      }
    }
  };

  const handleRefreshCaptcha = async () => {
    setIsRefreshingCaptcha(true);
    setCaptchaResponse('');
    try {
      await fetchCaptcha(baseUrl);
    } finally {
      setIsRefreshingCaptcha(false);
      setTimeout(() => {
        captchaInputRef.current?.focus();
      }, 100);
    }
  };

  // Auto focus captcha input when captcha challenge is triggered
  useEffect(() => {
    if (isCaptcha && captchaInputRef.current) {
      setTimeout(() => {
        captchaInputRef.current?.focus();
      }, 150);
    }
  }, [isCaptcha, captchaImage]);

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

    if (authTab === 'token') {
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
            ? 'Đã kết nối Jira và ghi nhớ phiên an toàn trên trình duyệt!' 
            : 'Đã kết nối Jira (phiên làm việc tạm thời)!'
        );
        onSuccess?.();
      }
    } else {
      if (!username.trim()) {
        toast.error('Vui lòng nhập Tên đăng nhập (Username) hoặc Email');
        return;
      }
      if (!password.trim()) {
        toast.error('Vui lòng nhập Mật khẩu Jira');
        return;
      }
      if (isCaptcha && !captchaResponse.trim()) {
        toast.error('Vui lòng nhập mã bảo vệ (CAPTCHA)');
        captchaInputRef.current?.focus();
        return;
      }

      const success = await login({
        baseUrl: cleanUrl,
        username: username.trim(),
        email: username.trim(),
        password: password.trim(),
        apiToken: password.trim(),
        authType: 'basic',
        rememberMe,
        captchaId: captchaId || undefined,
        captchaResponse: captchaResponse.trim() || undefined
      });

      if (success) {
        toast.success(
          rememberMe 
            ? 'Đã kết nối Jira bằng tài khoản và ghi nhớ phiên an toàn trên trình duyệt!' 
            : 'Đã kết nối Jira (phiên làm việc tạm thời)!'
        );
        onSuccess?.();
      } else {
        if (isCaptcha || captchaImage) {
          setCaptchaResponse('');
          setTimeout(() => {
            captchaInputRef.current?.focus();
          }, 150);
        }
      }
    }
  };

  const handleClearRemembered = () => {
    clearRememberedAuth();
    setRememberedUser(null);
    setRememberMe(false);
    setUsername('');
    setPassword('');
    setApiToken('');
    toast.success('Đã xóa thông tin ghi nhớ trên trình duyệt này');
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
            {authTab === 'token' ? (
              <>Chỉ cần nhập <b>Jira API Token</b> (hoặc Personal Access Token) để truy cập Kanban Board, Sprint Hub và Log Work.</>
            ) : (
              <>Đăng nhập bằng <b>Tên tài khoản (Username)</b> và <b>Mật khẩu</b> Jira của bạn.</>
            )}
          </p>
        </div>

        {/* Tab Switcher: Token vs Username/Password */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-muted/70 border border-border/70 gap-1.5 select-none">
          <button
            type="button"
            onClick={() => handleSwitchTab('token')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              authTab === 'token'
                ? 'bg-card text-foreground shadow-sm border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
            }`}
          >
            <KeyRound className={`w-4 h-4 ${authTab === 'token' ? 'text-blue-500' : ''}`} />
            <span>API Token / PAT</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('basic')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              authTab === 'basic'
                ? 'bg-card text-foreground shadow-sm border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
            }`}
          >
            <User className={`w-4 h-4 ${authTab === 'basic' ? 'text-blue-500' : ''}`} />
            <span>Tài Khoản & Mật Khẩu</span>
          </button>
        </div>

        {/* Remembered Account Notice from Encrypted LocalStorage */}
        {rememberedUser && (
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 min-w-0">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
              <div className="min-w-0">
                <span className="font-bold">Đã ghi nhớ trên trình duyệt này: </span>
                <span className="font-mono font-semibold truncate">{rememberedUser.username || 'API Token'}</span>
                <span className="text-[11px] text-muted-foreground block">
                  (Dữ liệu mã hóa bảo mật trên máy khách, tuyệt đối không lưu thông tin đăng nhập vào SQLite máy chủ)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearRemembered}
              className="text-[11px] text-muted-foreground hover:text-destructive underline shrink-0 font-medium"
            >
              Xóa ghi nhớ
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
            <div className="flex-1 font-medium space-y-2">
              <p>{error}</p>
              {error.toLowerCase().includes('captcha') && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (authTab !== 'basic') handleSwitchTab('basic');
                      handleRefreshCaptcha();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold transition shadow-xs"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>Nhập CAPTCHA trực tiếp bên dưới</span>
                  </button>
                  <a
                    href={`${baseUrl.replace(/\/+$/, '')}/login.jsp`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive text-white hover:bg-destructive/90 text-[11px] font-bold transition shadow-xs"
                  >
                    <span>Mở web Jira</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('token')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px] font-bold transition"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Dùng Token (Không bị CAPTCHA)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Login Form */}
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

          {/* TAB 1: TOKEN / PAT */}
          {authTab === 'token' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
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
          )}

          {/* TAB 2: USERNAME & PASSWORD */}
          {authTab === 'basic' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Username / Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tên đăng nhập (Username hoặc Email)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc email Jira..."
                  autoComplete="username"
                  required
                  autoFocus
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary transition"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Mật khẩu Jira (Password)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu Jira của bạn..."
                    required
                    className="w-full bg-background border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Xác thực trực tiếp bằng tài khoản qua giao thức Basic Auth an toàn.
                </p>
              </div>

              {/* CAPTCHA CHALLENGE SECTION */}
              {(isCaptcha || captchaImage) ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                      <span>Mã Bảo Vệ Xác Thực (CAPTCHA)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleRefreshCaptcha}
                      disabled={isRefreshingCaptcha}
                      className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
                      title="Tải lại hình ảnh mã CAPTCHA mới"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshingCaptcha ? 'animate-spin' : ''}`} />
                      <span>Đổi mã khác</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Máy chủ Jira yêu cầu vượt qua bước kiểm tra CAPTCHA. Vui lòng nhập các ký tự hiển thị trong hình ảnh bên dưới:
                  </p>

                  {/* CAPTCHA Image Preview */}
                  <div className="flex items-center justify-center p-2 rounded-xl bg-white dark:bg-zinc-900 border border-border shadow-xs min-h-[58px] relative overflow-hidden select-none">
                    {captchaImage ? (
                      <img
                        src={captchaImage}
                        alt="Jira Security CAPTCHA"
                        className="h-12 object-contain filter contrast-125 rounded cursor-pointer transition hover:opacity-90"
                        onClick={handleRefreshCaptcha}
                        title="Bấm vào hình để đổi mã khác"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tải mã CAPTCHA từ máy chủ...</span>
                      </div>
                    )}
                  </div>

                  {/* CAPTCHA Text Input */}
                  <div className="space-y-1">
                    <input
                      ref={captchaInputRef}
                      type="text"
                      value={captchaResponse}
                      onChange={(e) => setCaptchaResponse(e.target.value)}
                      placeholder="Nhập mã chữ/số trong ảnh..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      required
                      className="w-full bg-background border border-amber-500/40 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-center uppercase font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition"
                    />
                    <p className="text-[10px] text-muted-foreground text-center">
                      Không phân biệt chữ hoa, chữ thường • Bấm hình ảnh để đổi mã nếu khó nhìn
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={handleRefreshCaptcha}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Tài khoản đang bị khóa CAPTCHA? Bấm lấy mã xác thực</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Remember Me Checkbox with Explicit Storage Description */}
          <div className="p-3.5 rounded-2xl bg-accent/40 border border-border/60 space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer mt-0.5 shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-foreground">Ghi nhớ đăng nhập trên trình duyệt này</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {rememberMe ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Đã chọn: Thông tin được mã hóa bảo mật trên trình duyệt này (LocalStorage) và duy trì phiên 30 ngày (tuyệt đối không lưu vào SQLite máy chủ).
                    </span>
                  ) : (
                    <span>
                      Không chọn: Thông tin <b>không lưu vào LocalStorage hay SQLite</b>. Phiên đăng nhập sẽ chỉ lưu tạm trong tab này và hết hạn sau phiên làm việc (8 tiếng).
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
                <span>
                  {authTab === 'token' ? 'Đăng Nhập bằng Token' : 'Đăng Nhập bằng Tài Khoản'}
                </span>
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
