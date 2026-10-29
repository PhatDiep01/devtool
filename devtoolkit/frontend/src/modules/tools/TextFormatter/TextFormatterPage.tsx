import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  AlignLeft, 
  Copy, 
  Check, 
  Trash2, 
  ClipboardPaste, 
  Download, 
  Play, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode, 
  Database, 
  FileText, 
  Terminal, 
  Info,
  Maximize2,
  Sliders,
  Zap,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  formatText, 
  computeTextStats, 
  detectInputType, 
  copyToClipboard, 
  downloadTextFile, 
  formatByteSize, 
  PRESETS, 
  PERFORMANCE_THRESHOLD,
  FormatterOptions,
  DetectedType
} from './formatter-engine';

const SEPARATOR_OPTIONS = [
  { id: 'space', label: 'Khoảng trắng (" ")', value: ' ' },
  { id: 'comma', label: 'Dấu phẩy (",")', value: ',' },
  { id: 'comma-space', label: 'Dấu phẩy cách (", ")', value: ', ' },
  { id: 'semicolon', label: 'Chấm phẩy (";")', value: ';' },
  { id: 'pipe', label: 'Dấu Pipe ("|")', value: '|' },
  { id: 'custom', label: 'Tùy chỉnh...', value: '__CUSTOM__' }
];

export const TextFormatterPage: React.FC = () => {
  // Main states
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // Format options
  const [smartJson, setSmartJson] = useState<boolean>(true);
  const [selectedSeparatorId, setSelectedSeparatorId] = useState<string>('space');
  const [customSeparator, setCustomSeparator] = useState<string>(' ');
  const [trimLines, setTrimLines] = useState<boolean>(true);
  const [removeEmptyLines, setRemoveEmptyLines] = useState<boolean>(true);
  const [collapseSpaces, setCollapseSpaces] = useState<boolean>(true);
  const [autoFormat, setAutoFormat] = useState<boolean>(true);

  // Status & processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastExecutedInput, setLastExecutedInput] = useState<string>('');

  const outputRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active separator string
  const activeSeparator = useMemo(() => {
    if (selectedSeparatorId === 'custom') {
      return customSeparator;
    }
    const found = SEPARATOR_OPTIONS.find(s => s.id === selectedSeparatorId);
    return found ? found.value : ' ';
  }, [selectedSeparatorId, customSeparator]);

  // Options bundle
  const currentOptions: FormatterOptions = useMemo(() => ({
    smartJson,
    separator: activeSeparator,
    trimLines,
    removeEmptyLines,
    collapseSpaces
  }), [smartJson, activeSeparator, trimLines, removeEmptyLines, collapseSpaces]);

  // Realtime statistics
  const inputStats = useMemo(() => computeTextStats(inputText), [inputText]);
  const outputStats = useMemo(() => computeTextStats(outputText), [outputText]);
  const detectedType: DetectedType = useMemo(() => detectInputType(inputText), [inputText]);

  // Is payload > 100K threshold
  const isLargePayload = inputText.length > PERFORMANCE_THRESHOLD;

  // Reduction ratio calculation
  const reductionPercent = useMemo(() => {
    if (!inputStats.characters || !outputStats.characters) return 0;
    const diff = inputStats.characters - outputStats.characters;
    return diff > 0 ? Number(((diff / inputStats.characters) * 100).toFixed(1)) : 0;
  }, [inputStats.characters, outputStats.characters]);

  const charsSaved = useMemo(() => {
    return Math.max(0, inputStats.characters - outputStats.characters);
  }, [inputStats.characters, outputStats.characters]);

  // Execution function
  const runFormat = useCallback((textToFormat: string = inputText) => {
    setIsProcessing(true);
    try {
      const res = formatText(textToFormat, currentOptions);
      setOutputText(res.output);
      setJsonError(res.jsonError || null);
      setLastExecutedInput(textToFormat);
    } catch (e: any) {
      toast.error('Có lỗi xảy ra trong quá trình nén: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, currentOptions]);

  // Auto-format effect (debounced 120ms when <= 100K chars and autoFormat is ON)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!autoFormat || isLargePayload) {
      // Auto-format disabled or bypassed due to large payload
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      runFormat(inputText);
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText, autoFormat, isLargePayload, runFormat]);

  // Keyboard shortcut Ctrl+Enter to format now
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!inputText.trim()) {
          toast('Vui lòng nhập nội dung cần nén.', { icon: 'ℹ️' });
          return;
        }
        runFormat();
        toast.success('Đã nén định dạng thành công!', { id: 'manual-format' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runFormat, inputText]);

  // Quick Action: Paste from Clipboard
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputText(text);
          toast.success('Đã dán nội dung từ Clipboard!', { icon: '📋' });
          if (text.length <= PERFORMANCE_THRESHOLD) {
            runFormat(text);
          }
          return;
        }
      }
      toast('Không tìm thấy nội dung trong Clipboard hoặc quyền truy cập bị chặn.', { icon: 'ℹ️' });
    } catch {
      toast.error('Vui lòng cấp quyền đọc Clipboard trong trình duyệt hoặc dùng Ctrl+V để dán.');
    }
  };

  // Quick Action: Clear Both
  const handleClearAll = () => {
    setInputText('');
    setOutputText('');
    setJsonError(null);
    setLastExecutedInput('');
    toast('Đã xóa sạch nội dung.', { icon: '🧹' });
  };

  // Quick Action: Copy Output
  const handleCopyOutput = async () => {
    if (!outputText) {
      toast.error('Không có nội dung kết quả để sao chép.');
      return;
    }
    const ok = await copyToClipboard(outputText);
    if (ok) {
      setIsCopied(true);
      toast.success('Đã sao chép 1 dòng vào Clipboard!', {
        icon: '✅',
        duration: 2000
      });
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      toast.error('Không thể tự động sao chép. Hãy nhấp vào ô kết quả và bấm Ctrl+C.');
    }
  };

  // Quick Action: Download .txt
  const handleDownloadTxt = () => {
    if (!outputText) {
      toast.error('Không có nội dung để tải về.');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `oneline-formatted-${dateStr}.txt`;
    const ok = downloadTextFile(outputText, filename);
    if (ok) {
      toast.success(`Đã tải xuống file: ${filename}`, { icon: '💾' });
    } else {
      toast.error('Không thể tạo file tải về.');
    }
  };

  // Quick Preset Loader
  const handleLoadPreset = (presetContent: string, presetLabel: string) => {
    setInputText(presetContent);
    toast.success(`Đã nạp dữ liệu mẫu: ${presetLabel}`, { icon: '⚡' });
    runFormat(presetContent);
  };

  // Auto-select all text when clicking output box
  const handleOutputClick = () => {
    if (outputRef.current) {
      outputRef.current.select();
    }
  };

  // Helper Badge for Detected Type
  const renderTypeBadge = () => {
    switch (detectedType) {
      case 'JSON':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON Payload</span>
          </span>
        );
      case 'SQL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Database className="w-3.5 h-3.5" />
            <span>SQL Query</span>
          </span>
        );
      case 'LOG':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Terminal className="w-3.5 h-3.5" />
            <span>System Log</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <FileText className="w-3.5 h-3.5" />
            <span>Plain Text</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & TITLE BAR */}
      {/* ========================================================================= */}
      <div className="border-b border-border bg-card/60 backdrop-blur px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
            <AlignLeft className="w-5 h-5 font-bold" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                Định dạng văn bản
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                Online
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline-block">
                Bảo toàn dữ liệu
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate leading-relaxed">
              Nén văn bản, JSON và SQL thành 1 dòng duy nhất • Bảo toàn kiểu dữ liệu & an toàn bộ nhớ
            </p>
          </div>
        </div>

        {/* Action Header Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Compress Now Button */}
          <button
            type="button"
            onClick={() => {
              runFormat();
              toast.success('Đã nén định dạng thành công!', { id: 'manual-format' });
            }}
            disabled={isProcessing || !inputText}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition shadow-xs ${
              isLargePayload || (!autoFormat && inputText !== lastExecutedInput)
                ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Đang nén...' : 'Nén ngay (Ctrl+Enter)'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto w-full">
        {/* ========================================================================= */}
        {/* 2. PERFORMANCE SAFEGUARD BANNER (> 100K Characters) */}
        {/* ========================================================================= */}
        {isLargePayload && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Cảnh Báo Dữ Liệu Lớn ({inputStats.characters.toLocaleString()} ký tự &gt; 100.000)</span>
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    Safeguard Active
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chế độ nén tự động theo thời gian thực đã được tạm tắt để chống đơ tab trình duyệt. Vui lòng bấm nút <b>"Nén Ngay"</b> để xử lý theo yêu cầu.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => runFormat()}
              className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 shadow-md transition shrink-0 flex items-center gap-1.5 w-full sm:w-auto justify-center"
            >
              <Zap className="w-4 h-4" />
              <span>Nén Ngay Lập Tức</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CONFIGURATION & FORMATTING CONTROLS BAR */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            {/* Smart JSON Switch */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={smartJson}
                  onChange={(e) => setSmartJson(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <span className="text-xs font-bold text-foreground">
                  Chế độ Smart JSON
                </span>
              </label>

              {smartJson && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Bảo toàn null, boolean, số & chuỗi
                </span>
              )}
            </div>

            {/* Realtime Auto-format Switch */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoFormat && !isLargePayload}
                  disabled={isLargePayload}
                  onChange={(e) => setAutoFormat(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer disabled:opacity-50"
                />
                <span className={`text-xs font-bold ${isLargePayload ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  Tự động nén khi gõ (Real-time)
                </span>
              </label>
            </div>
          </div>

          {/* Separator & Advanced Text Stripping Controls */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Separator Selector */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
              <span className="text-xs font-bold text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Dấu Phân Cách:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {SEPARATOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedSeparatorId(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      selectedSeparatorId === opt.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/50 hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

                {selectedSeparatorId === 'custom' && (
                  <input
                    type="text"
                    value={customSeparator}
                    onChange={(e) => setCustomSeparator(e.target.value)}
                    placeholder="Nhập dấu..."
                    className="w-24 px-2 py-1 text-xs rounded-lg border border-primary bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            </div>

            {/* Fine-tuning Toggles */}
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trimLines}
                  onChange={(e) => setTrimLines(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                />
                <span>Trim lề đầu/cuối</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={removeEmptyLines}
                  onChange={(e) => setRemoveEmptyLines(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                />
                <span>Xóa dòng trống</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={collapseSpaces}
                  onChange={(e) => setCollapseSpaces(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                />
                <span>Gộp khoảng trắng</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. TWO-PANEL SYMMETRIC WORKSPACE (Input vs Output) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* ========================================== */}
          {/* LEFT PANEL: INPUT */}
          {/* ========================================== */}
          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-xs overflow-hidden h-[540px]">
            {/* Input Header Toolbar */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">Dữ Liệu Đầu Vào (Input)</span>
                {renderTypeBadge()}
              </div>

              {/* Input Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-foreground hover:bg-accent text-xs font-semibold transition"
                  title="Dán nhanh từ Clipboard"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Dán</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-foreground hover:bg-destructive/10 hover:text-destructive text-xs font-semibold transition"
                  title="Xóa sạch toàn bộ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa</span>
                </button>
              </div>
            </div>

            {/* Quick Presets Row */}
            <div className="px-4 py-2 bg-muted/15 border-b border-border/60 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
                Dữ liệu mẫu:
              </span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleLoadPreset(p.content, p.label)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-card border border-border hover:border-primary hover:text-primary transition shrink-0"
                  title={p.desc}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Textarea */}
            <div className="flex-1 relative p-3">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Dán hoặc nhập dữ liệu tự do tại đây (JSON, SQL query, log hệ thống, văn bản nhiều dòng)..."
                className="w-full h-full p-2 bg-transparent resize-none font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60 leading-relaxed scrollbar-thin"
                spellCheck={false}
              />
            </div>

            {/* Input Footer Status Bar */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <div className="flex items-center gap-3">
                <span>Ký tự: <b className="text-foreground">{inputStats.characters.toLocaleString()}</b></span>
                <span>Từ: <b className="text-foreground">{inputStats.words.toLocaleString()}</b></span>
                <span>Dòng: <b className="text-foreground">{inputStats.lines.toLocaleString()}</b></span>
              </div>
              <div>
                <span>Dung lượng: <b className="text-foreground">{formatByteSize(inputStats.byteSize)}</b></span>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* RIGHT PANEL: OUTPUT */}
          {/* ========================================== */}
          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-xs overflow-hidden h-[540px]">
            {/* Output Header Toolbar */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">Kết Quả Nén 1 Dòng (Output)</span>
                {outputText && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
                    Click để chọn toàn bộ
                  </span>
                )}
              </div>

              {/* Output Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyOutput}
                  disabled={!outputText}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs ${
                    isCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title="Sao chép toàn bộ kết quả vào Clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã Copy!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy 1 Dòng</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  disabled={!outputText}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-foreground hover:bg-accent text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Tải file kết quả (.txt)"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Tải .txt</span>
                </button>
              </div>
            </div>

            {/* JSON Error Warning Notice if any */}
            {jsonError && (
              <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Cú pháp JSON chưa hợp lệ ({jsonError}) → Đã fallback về chế độ Text.</span>
              </div>
            )}

            {/* Output Textarea (Readonly & Auto-select on Click) */}
            <div className="flex-1 relative p-3">
              <textarea
                ref={outputRef}
                readOnly
                value={outputText}
                onClick={handleOutputClick}
                onFocus={(e) => e.currentTarget.select()}
                onMouseUp={(e) => {
                  if (outputText && window.getSelection()?.toString() !== outputText) {
                    e.currentTarget.select();
                  }
                }}
                placeholder="Kết quả sau khi nén thành 1 dòng duy nhất sẽ xuất hiện tại đây..."
                className="w-full h-full p-2 bg-transparent resize-none font-mono text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60 leading-relaxed scrollbar-thin cursor-pointer"
                spellCheck={false}
              />
            </div>

            {/* Output Footer Status Bar with Reduction % */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground font-mono flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span>Ký tự: <b className="text-foreground">{outputStats.characters.toLocaleString()}</b></span>
                <span>Dòng: <b className="text-foreground">{outputStats.lines.toLocaleString()}</b></span>
                <span>Dung lượng: <b className="text-foreground">{formatByteSize(outputStats.byteSize)}</b></span>
              </div>

              {/* Compression Reduction Badge */}
              <div className="flex items-center gap-2">
                {charsSaved > 0 ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>-{reductionPercent}%</span>
                    <span className="text-[10px] font-normal">(-{charsSaved.toLocaleString()} ký tự)</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">0% Giảm</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. FEATURE HIGHLIGHTS & ARCHITECTURAL SPECS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Bảo Toàn Kiểu Dữ Liệu 100%</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sử dụng bộ nén JSON.stringify chuẩn xác tuyệt đối, giữ nguyên khóa, giá trị, null, boolean, số thực và ký tự tiếng Việt Unicode.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Bộ Đệm An Toàn &gt; 100K Ký Tự</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tự động kích hoạt cơ chế Performance Throttle khi dữ liệu vượt ngưỡng 100.000 ký tự, ngăn chặn hoàn toàn tình trạng treo trình duyệt.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Tùy Biến Phân Tách Linh Hoạt</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Hỗ trợ gom dòng với dấu cách, dấu phẩy, pipe (|), chấm phẩy hoặc bất kỳ ký tự phân cách nào bạn chỉ định.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextFormatterPage;
