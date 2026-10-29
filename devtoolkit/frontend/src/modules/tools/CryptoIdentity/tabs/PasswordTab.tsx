import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock,
  Copy,
  Check,
  RefreshCw,
  Download,
  Info,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Sliders,
  Sparkles,
  CheckCircle2,
  XCircle,
  KeyRound,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  generatePasswordBatch,
  calculatePasswordEntropy,
  checkPasswordStrength
} from '../engine/password';
import {
  PasswordMode,
  PasswordRandomOptions,
  PasswordPassphraseOptions,
  PasswordStrengthMetrics,
  PasswordCheckResult
} from '../types';

interface PasswordTabProps {
  mode: PasswordMode;
  randomOptions: PasswordRandomOptions;
  passphraseOptions: PasswordPassphraseOptions;
  onUpdateMode: (mode: PasswordMode) => void;
  onUpdateRandomOptions: (opts: Partial<PasswordRandomOptions>) => void;
  onUpdatePassphraseOptions: (opts: Partial<PasswordPassphraseOptions>) => void;
}

export const PasswordTab: React.FC<PasswordTabProps> = ({
  mode,
  randomOptions,
  passphraseOptions,
  onUpdateMode,
  onUpdateRandomOptions,
  onUpdatePassphraseOptions
}) => {
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [showMasked, setShowMasked] = useState<boolean>(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Strength Checker for existing password
  const [testPasswordInput, setTestPasswordInput] = useState<string>('');
  const [showTestPassword, setShowTestPassword] = useState<boolean>(false);

  // Generate batch
  const handleGenerate = useCallback(() => {
    const list = generatePasswordBatch(mode, randomOptions, passphraseOptions);
    setGeneratedList(list);
  }, [mode, randomOptions, passphraseOptions]);

  // Run on mount or configuration changes
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Entropy metrics of the primary generated password
  const primaryEntropy: PasswordStrengthMetrics = useMemo(() => {
    return calculatePasswordEntropy(generatedList[0] || '');
  }, [generatedList]);

  // Analysis result for user test password
  const testAnalysis: PasswordCheckResult = useMemo(() => {
    return checkPasswordStrength(testPasswordInput);
  }, [testPasswordInput]);

  // Copy single password
  const handleCopySingle = async (pwd: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(pwd);
      setCopiedIndex(idx);
      toast.success('Đã sao chép mật khẩu!');
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Copy all passwords
  const handleCopyAll = async () => {
    if (generatedList.length === 0) return;
    try {
      await navigator.clipboard.writeText(generatedList.join('\n'));
      setCopiedAll(true);
      toast.success(`Đã sao chép toàn bộ ${generatedList.length} mật khẩu!`);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Download .txt
  const handleDownloadTxt = () => {
    if (generatedList.length === 0) return;
    const blob = new Blob([generatedList.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passwords_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải file .txt');
  };

  // Strength Level Color & Bar Width helper
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'very_weak':
        return { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', width: '15%' };
      case 'weak':
        return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', width: '35%' };
      case 'medium':
        return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500', width: '60%' };
      case 'strong':
        return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', width: '85%' };
      case 'very_strong':
      default:
        return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', width: '100%' };
    }
  };

  const primaryLevelColor = getLevelColor(primaryEntropy.level);

  return (
    <div className="space-y-4">
      {/* Privacy Guarantee Banner */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Lưu ý bảo mật:</strong> Các mật khẩu được tạo ngẫu nhiên bảo mật bằng <code>crypto.getRandomValues</code> của trình duyệt. Hệ thống <strong>KHÔNG LƯU</strong> lịch sử các mật khẩu đã tạo vào bộ nhớ trình duyệt hay cơ sở dữ liệu. Tải lại trang sẽ xóa toàn bộ.
        </span>
      </div>

      {/* Main Configuration Card */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        {/* Top Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => onUpdateMode('random')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mode === 'random' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Ký tự ngẫu nhiên
            </button>
            <button
              type="button"
              onClick={() => onUpdateMode('passphrase')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mode === 'passphrase' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Cụm từ ghi nhớ (Passphrase)
            </button>
          </div>

          {/* Batch count & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">Số lượng tạo:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={mode === 'random' ? randomOptions.count : passphraseOptions.count}
              onChange={(e) => {
                const count = Math.min(50, Math.max(1, Number(e.target.value)));
                if (mode === 'random') {
                  onUpdateRandomOptions({ count });
                } else {
                  onUpdatePassphraseOptions({ count });
                }
              }}
              className="w-14 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg bg-muted/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo mới</span>
            </button>
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy tất cả</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="p-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs transition"
              title="Tải về file .txt"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MODE 1: RANDOM CHARACTERS CONTROLS */}
        {/* ======================================================== */}
        {mode === 'random' && (
          <div className="space-y-4">
            {/* Length Slider & Input */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-foreground">Độ dài mật khẩu:</span>
                <span className="font-mono text-sm font-bold text-primary">
                  {randomOptions.length} ký tự
                </span>
              </div>

              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="range"
                  min={4}
                  max={128}
                  value={randomOptions.length}
                  onChange={(e) => onUpdateRandomOptions({ length: Number(e.target.value) })}
                  className="flex-1 accent-primary cursor-pointer"
                />
                <input
                  type="number"
                  min={4}
                  max={128}
                  value={randomOptions.length}
                  onChange={(e) => onUpdateRandomOptions({ length: Math.min(128, Math.max(4, Number(e.target.value))) })}
                  className="w-16 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg bg-muted/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Character Set Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/10 cursor-pointer select-none hover:bg-muted/30 transition">
                <input
                  type="checkbox"
                  checked={randomOptions.lowercase}
                  onChange={(e) => onUpdateRandomOptions({ lowercase: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Chữ thường (a-z)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">abcdefgh...</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/10 cursor-pointer select-none hover:bg-muted/30 transition">
                <input
                  type="checkbox"
                  checked={randomOptions.uppercase}
                  onChange={(e) => onUpdateRandomOptions({ uppercase: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Chữ HOA (A-Z)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">ABCDEFGH...</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/10 cursor-pointer select-none hover:bg-muted/30 transition">
                <input
                  type="checkbox"
                  checked={randomOptions.numbers}
                  onChange={(e) => onUpdateRandomOptions({ numbers: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Chữ số (0-9)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">0123456789</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/10 cursor-pointer select-none hover:bg-muted/30 transition">
                <input
                  type="checkbox"
                  checked={randomOptions.symbols}
                  onChange={(e) => onUpdateRandomOptions({ symbols: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Ký tự đặc biệt</span>
                  <span className="text-[10px] text-muted-foreground font-mono">!@#$%^&*...</span>
                </div>
              </label>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={randomOptions.excludeAmbiguous}
                  onChange={(e) => onUpdateRandomOptions({ excludeAmbiguous: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <span>Loại bỏ ký tự dễ nhầm (0, O, o, 1, l, I)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={randomOptions.noConsecutiveDuplicates}
                  onChange={(e) => onUpdateRandomOptions({ noConsecutiveDuplicates: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <span>Không cho ký tự lặp liền kề (aa, 11)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={randomOptions.requireEachType}
                  onChange={(e) => onUpdateRandomOptions({ requireEachType: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <span>Bắt buộc có đủ mỗi bộ đã bật</span>
              </label>
            </div>

            {/* Excluded Chars & Custom Symbols Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="text-muted-foreground block mb-1">
                  Ký tự loại trừ riêng (không muốn xuất hiện):
                </label>
                <input
                  type="text"
                  value={randomOptions.excludedChars}
                  onChange={(e) => onUpdateRandomOptions({ excludedChars: e.target.value })}
                  placeholder="Ví dụ: &quot; ' \ / ~"
                  className="w-full px-3 py-1.5 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">
                  Bộ ký tự đặc biệt tùy chỉnh:
                </label>
                <input
                  type="text"
                  value={randomOptions.customSymbols}
                  onChange={(e) => onUpdateRandomOptions({ customSymbols: e.target.value })}
                  placeholder="!@#$%^&*()_+-=[]{}|;:,.<>?"
                  className="w-full px-3 py-1.5 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODE 2: PASSPHRASE CONTROLS */}
        {/* ======================================================== */}
        {mode === 'passphrase' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  Số lượng từ ({passphraseOptions.wordCount} từ):
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={passphraseOptions.wordCount}
                  onChange={(e) => onUpdatePassphraseOptions({ wordCount: Number(e.target.value) })}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  Ký tự phân cách:
                </label>
                <select
                  value={passphraseOptions.separator}
                  onChange={(e) => onUpdatePassphraseOptions({ separator: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground focus:outline-none"
                >
                  <option value="-">Gạch ngang (-)</option>
                  <option value="_">Gạch dưới (_)</option>
                  <option value=" ">Khoảng trắng ( )</option>
                  <option value=".">Dấu chấm (.)</option>
                  <option value="#">Thăng (#)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/10 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={passphraseOptions.capitalize}
                  onChange={(e) => onUpdatePassphraseOptions({ capitalize: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Viết hoa chữ đầu</span>
                  <span className="text-[10px] text-muted-foreground">Title Case</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/10 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={passphraseOptions.includeNumber}
                  onChange={(e) => onUpdatePassphraseOptions({ includeNumber: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="font-bold text-foreground block">Thêm số ngẫu nhiên</span>
                  <span className="text-[10px] text-muted-foreground">Ví dụ: Apple-42</span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ENTROPY & STRENGTH METERS */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">Độ ngẫu nhiên (Entropy):</span>
            <span className="font-mono text-sm font-bold text-primary">
              {primaryEntropy.entropyBits} bits
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full bg-muted ${primaryLevelColor.text}`}>
              {primaryEntropy.levelLabel}
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            Bẻ khóa: <strong className="text-foreground">{primaryEntropy.crackTimeDetails}</strong>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${primaryLevelColor.bg} transition-all duration-300`}
            style={{ width: primaryLevelColor.width }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* RESULTS DISPLAY AREA */}
      {/* ======================================================== */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>Mật khẩu đã tạo ({generatedList.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setShowMasked(!showMasked)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-xs"
          >
            {showMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showMasked ? 'Ẩn ký tự' : 'Hiện rõ ký tự'}</span>
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-1.5 font-mono text-xs">
          {generatedList.map((pwd, idx) => (
            <div
              key={`${pwd}_${idx}`}
              onClick={() => handleCopySingle(pwd, idx)}
              className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/40 cursor-pointer transition select-all"
              title="Bấm để sao chép"
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-6 text-right select-none font-sans">
                  {idx + 1}.
                </span>
                <span className="text-foreground font-mono font-semibold tracking-wide group-hover:text-primary transition">
                  {showMasked ? pwd : '•'.repeat(pwd.length)}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                {copiedIndex === idx ? (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Đã copy!
                  </span>
                ) : (
                  <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Copy
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* OFFLINE PASSWORD STRENGTH CHECKER & ANALYZER */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-primary" />
            <span>Kiểm tra độ mạnh mật khẩu có sẵn (Offline Password Analyzer):</span>
          </label>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Cục bộ • Tuyệt đối không gửi mật khẩu đi đâu
          </span>
        </div>

        <div className="relative">
          <input
            type={showTestPassword ? 'text' : 'password'}
            value={testPasswordInput}
            onChange={(e) => setTestPasswordInput(e.target.value)}
            placeholder="Dán hoặc gõ mật khẩu bạn muốn đánh giá độ bảo mật..."
            className="w-full pr-10 pl-3 py-2 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowTestPassword(!showTestPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showTestPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {testPasswordInput.length > 0 && (
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">Điểm đánh giá:</span>
                <span className={`font-bold ${getLevelColor(testAnalysis.metrics.level).text}`}>
                  {testAnalysis.metrics.levelLabel} ({testAnalysis.metrics.entropyBits} bits)
                </span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Thời gian bẻ khóa: <strong className="text-foreground">{testAnalysis.metrics.crackTimeEstimate}</strong>
              </div>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/60">
              <div className={`flex items-center gap-1.5 ${testAnalysis.checks.hasGoodLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {testAnalysis.checks.hasGoodLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                <span>Độ dài &ge; 12</span>
              </div>

              <div className={`flex items-center gap-1.5 ${testAnalysis.checks.hasUpper && testAnalysis.checks.hasLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {testAnalysis.checks.hasUpper && testAnalysis.checks.hasLower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                <span>Chữ Hoa & Thường</span>
              </div>

              <div className={`flex items-center gap-1.5 ${testAnalysis.checks.hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {testAnalysis.checks.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                <span>Có chữ số</span>
              </div>

              <div className={`flex items-center gap-1.5 ${testAnalysis.checks.hasSymbol ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {testAnalysis.checks.hasSymbol ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                <span>Ký tự đặc biệt</span>
              </div>
            </div>

            {/* Warnings list */}
            {testAnalysis.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] space-y-1">
                {testAnalysis.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
