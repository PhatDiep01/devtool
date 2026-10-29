import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight,
  Trash2,
  Upload,
  Copy,
  Download,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  AlignLeft,
  Columns,
  List,
  Minus,
  Plus,
  PenLine,
  WrapText,
  Link2,
  Link2Off,
  Focus
} from 'lucide-react';
import { useTextCompare } from './useTextCompare';
import { DiffMode, DiffToken, SideBySideRow, UnifiedRow, DiffHunk } from './types';

export const CompareTextPage: React.FC = () => {
  const {
    originalText,
    setOriginalText,
    modifiedText,
    setModifiedText,
    originalStats,
    modifiedStats,
    isLargePayload,
    diffMode,
    setDiffMode,
    options,
    updateOption,
    viewMode,
    setViewMode,
    collapseUnchanged,
    setCollapseUnchanged,
    contextLines,
    setContextLines,
    isProcessing,
    result,
    error,
    currentDiffIndex,
    totalDiffs,
    goToNextDiff,
    goToPrevDiff,
    goToDiff,
    executeCompare,
    swapTexts,
    clearText,
    uploadFile,
    formatJson,
    sortLines,
    copyUnifiedDiff,
    downloadPatch,
    copyNormalizedText,
    resetToDefault
  } = useTextCompare();

  const originalFileRef = useRef<HTMLInputElement>(null);
  const modifiedFileRef = useRef<HTMLInputElement>(null);

  // UI preferences for diff grids
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [wrapLines, setWrapLines] = useState<boolean>(false);

  const handleFileChange = (side: 'original' | 'modified') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(side, file);
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1700px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 tracking-tight">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            So sánh văn bản (Diff)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            So sánh văn bản trực quan 2 cột (side-by-side) hoặc hợp nhất (unified), tô màu khác biệt cấp độ dòng và ký tự, hỗ trợ xuất bản vá (patch).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={resetToDefault}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border hover:bg-accent flex items-center gap-1.5 transition-colors shadow-xs"
            title="Khôi phục tùy chọn mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Mặc định
          </button>

          <button
            onClick={() => executeCompare()}
            disabled={isProcessing}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Đang so sánh...' : 'So sánh ngay'}
          </button>
        </div>
      </div>

      {/* Large Payload Warning Alert */}
      {isLargePayload && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Văn bản có khối lượng lớn (&gt; 10.000 dòng hoặc 500.000 ký tự)</p>
            <p className="text-xs opacity-90 mt-0.5">
              Nhấn nút &quot;Compare&quot; ở trên sau khi nhập hoặc chỉnh sửa nội dung văn bản để bắt đầu tính toán.
            </p>
          </div>
        </div>
      )}

      {/* Options Panel */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 font-medium text-sm text-foreground">
            <Sliders className="w-4 h-4 text-primary" />
            <span>Chế độ &amp; Tùy chọn so sánh:</span>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
            {(['line', 'word', 'char'] as DiffMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDiffMode(mode)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  diffMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'line' ? 'Theo dòng (Line)' : mode === 'word' ? 'Theo từ (Word)' : 'Theo ký tự (Char)'}
              </button>
            ))}
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.ignoreCase}
              onChange={(e) => updateOption('ignoreCase', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Bỏ qua hoa/thường</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.trimWhitespace}
              onChange={(e) => updateOption('trimWhitespace', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Trim đầu/cuối dòng</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.collapseWhitespace}
              onChange={(e) => updateOption('collapseWhitespace', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Gộp khoảng trắng</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.ignoreEmptyLines}
              onChange={(e) => updateOption('ignoreEmptyLines', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Bỏ qua dòng trống</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.normalizeLineEndings}
              onChange={(e) => updateOption('normalizeLineEndings', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Chuẩn hóa CRLF/LF</span>
          </label>
        </div>
      </div>

      {/* Input Areas: Original & Modified */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              <span>Văn Bản Gốc (Original)</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{originalStats.lines.toLocaleString()} dòng</span>
              <span>•</span>
              <span>{originalStats.characters.toLocaleString()} ký tự</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Dán hoặc gõ văn bản gốc tại đây..."
              rows={11}
              className="w-full p-4 font-mono text-sm bg-transparent border-0 focus:ring-0 resize-y outline-none leading-relaxed"
            />
          </div>

          {/* Left Actions Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={originalFileRef}
                type="file"
                onChange={handleFileChange('original')}
                className="hidden"
              />
              <button
                onClick={() => originalFileRef.current?.click()}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Tải tệp từ máy (.txt, .md, .json, .csv, .log, .sql, etc.)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Mở file</span>
              </button>

              <button
                onClick={() => formatJson('original')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Format và sắp xếp key JSON"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                onClick={() => sortLines('original', 'asc')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Sắp xếp dòng A-Z"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Sort</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyNormalizedText('original')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Sao chép văn bản gốc đã chuẩn hóa"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => clearText('original')}
                className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive flex items-center gap-1"
                title="Xóa nội dung bản gốc"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Modified */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span>Văn Bản So Sánh (Modified)</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{modifiedStats.lines.toLocaleString()} dòng</span>
              <span>•</span>
              <span>{modifiedStats.characters.toLocaleString()} ký tự</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={modifiedText}
              onChange={(e) => setModifiedText(e.target.value)}
              placeholder="Dán hoặc gõ văn bản chỉnh sửa tại đây..."
              rows={11}
              className="w-full p-4 font-mono text-sm bg-transparent border-0 focus:ring-0 resize-y outline-none leading-relaxed"
            />
          </div>

          {/* Right Actions Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border text-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <input
                ref={modifiedFileRef}
                type="file"
                onChange={handleFileChange('modified')}
                className="hidden"
              />
              <button
                onClick={() => modifiedFileRef.current?.click()}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Tải tệp từ máy (.txt, .md, .json, .csv, .log, .sql, etc.)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Mở file</span>
              </button>

              <button
                onClick={() => formatJson('modified')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Format và sắp xếp key JSON"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                onClick={() => sortLines('modified', 'asc')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Sắp xếp dòng A-Z"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Sort</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copyNormalizedText('modified')}
                className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Sao chép văn bản so sánh đã chuẩn hóa"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => clearText('modified')}
                className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive flex items-center gap-1"
                title="Xóa nội dung bản so sánh"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Middle Actions: Swap & Clear Both */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={swapTexts}
          className="px-4 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-accent flex items-center gap-2 shadow-sm transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Hoán đổi hai bên (Swap)</span>
        </button>

        <button
          onClick={executeCompare}
          disabled={isProcessing}
          className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'Comparing...' : 'Compare'}</span>
        </button>

        <button
          onClick={() => clearText('both')}
          className="px-4 py-2 text-xs font-medium rounded-lg border border-border bg-card hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 shadow-sm transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa tất cả (Clear both)</span>
        </button>
      </div>

      {/* Results Header: Stats, View Switcher, Navigation, Export */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Identical notification */}
          {result.isIdentical && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm font-semibold">
                Hai văn bản giống hệt nhau! Không có sự khác biệt nào được tìm thấy.
              </div>
            </div>
          )}

          {/* Stats & Global Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
            {/* Stats badges */}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-semibold text-foreground">Thống kê:</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {result.stats.addedLines} thêm
              </span>
              <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <Minus className="w-3 h-3" />
                {result.stats.removedLines} xóa
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <PenLine className="w-3 h-3" />
                {result.stats.modifiedLines} sửa
              </span>
              <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                {result.stats.unchangedLines} không đổi
              </span>
              <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                Tương đồng: {result.stats.similarityPercentage}%
              </span>
              <span className="text-muted-foreground">({result.executionTimeMs} ms)</span>
            </div>

            {/* View Mode & Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Diff Navigation with auto scroll & focus */}
              {totalDiffs > 0 && (
                <div className="flex items-center gap-1.5 border border-primary/40 rounded-lg p-1 bg-primary/5 text-xs shadow-sm">
                  <span className="px-2 font-medium text-muted-foreground flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5 text-primary" />
                    <span>Điểm khác:</span>
                    <strong className="text-foreground text-sm font-bold">
                      {currentDiffIndex + 1}
                    </strong>{' '}
                    / {totalDiffs}
                  </span>
                  <button
                    onClick={goToPrevDiff}
                    className="p-1 rounded bg-background border border-border hover:bg-accent text-foreground transition-colors shadow-xs"
                    title="Khác biệt trước đó (Scroll & Focus)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={goToNextDiff}
                    className="p-1 rounded bg-background border border-border hover:bg-accent text-foreground transition-colors shadow-xs"
                    title="Khác biệt tiếp theo (Scroll & Focus)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* View Switcher: 2 Lưới (Side-by-Side) vs Gộp (Unified) */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                    viewMode === 'side-by-side'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Hiển thị 2 lưới song song"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>2 Lưới (Song song)</span>
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                    viewMode === 'unified'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Hiển thị 1 lưới gộp dạng Git diff"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Gộp (Unified)</span>
                </button>
              </div>

              {/* Display Options: Sync Scroll, Wrap Text, Collapse Unchanged */}
              <div className="flex items-center gap-2 border-l border-border pl-3 text-xs">
                {viewMode === 'side-by-side' && (
                  <button
                    onClick={() => setSyncScroll(!syncScroll)}
                    className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                      syncScroll
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                    title={syncScroll ? 'Đang bật cuộn đồng bộ' : 'Đang tắt cuộn đồng bộ'}
                  >
                    {syncScroll ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Cuộn đồng bộ</span>
                  </button>
                )}

                <button
                  onClick={() => setWrapLines(!wrapLines)}
                  className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                    wrapLines
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title={wrapLines ? 'Tắt tự động xuống dòng' : 'Bật tự động xuống dòng'}
                >
                  <WrapText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xuống dòng</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={collapseUnchanged}
                      onChange={(e) => setCollapseUnchanged(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <span>Ẩn dòng giống</span>
                  </label>
                  {collapseUnchanged && (
                    <select
                      value={contextLines}
                      onChange={(e) => setContextLines(Number(e.target.value))}
                      className="text-xs rounded border border-border bg-background px-1 py-0.5"
                    >
                      <option value={1}>1 dòng</option>
                      <option value={3}>3 dòng</option>
                      <option value={5}>5 dòng</option>
                      <option value={10}>10 dòng</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-1.5 border-l border-border pl-3">
                <button
                  onClick={copyUnifiedDiff}
                  className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Sao chép Unified Diff chuẩn Git"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Git Diff</span>
                </button>
                <button
                  onClick={() => downloadPatch('patch')}
                  className="px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Tải tệp .patch"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải .patch</span>
                </button>
              </div>
            </div>
          </div>

          {/* Diff Result Viewers */}
          {viewMode === 'side-by-side' ? (
            <DualGridDiffViewer
              rows={result.sideBySideRows}
              hunks={result.hunks}
              currentDiffIndex={currentDiffIndex}
              syncScroll={syncScroll}
              wrapLines={wrapLines}
              onSelectHunk={goToDiff}
              onCopyOriginal={() => copyNormalizedText('original')}
              onCopyModified={() => copyNormalizedText('modified')}
            />
          ) : (
            <UnifiedDiffViewer
              rows={result.unifiedRows}
              hunks={result.hunks}
              currentDiffIndex={currentDiffIndex}
              wrapLines={wrapLines}
              onSelectHunk={goToDiff}
            />
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Sub-components: Render Tokenized Intra-line Highlight
// -------------------------------------------------------------

const TokenizedLine: React.FC<{
  tokens?: DiffToken[];
  fallbackText: string;
}> = ({ tokens, fallbackText }) => {
  if (!tokens || tokens.length === 0) {
    return <span>{fallbackText}</span>;
  }

  return (
    <span>
      {tokens.map((token, idx) => {
        if (token.type === 'unchanged') {
          return <span key={idx}>{token.value}</span>;
        }
        if (token.type === 'removed') {
          return (
            <span
              key={idx}
              className="bg-red-500/40 text-red-950 dark:text-red-100 font-semibold px-0.5 rounded shadow-sm"
            >
              {token.value}
            </span>
          );
        }
        if (token.type === 'added') {
          return (
            <span
              key={idx}
              className="bg-emerald-500/40 text-emerald-950 dark:text-emerald-100 font-semibold px-0.5 rounded shadow-sm"
            >
              {token.value}
            </span>
          );
        }
        return <span key={idx}>{token.value}</span>;
      })}
    </span>
  );
};

// -------------------------------------------------------------
// DualGridDiffViewer: 2 Lưới độc lập với Sync Scroll & Gutter Markers
// -------------------------------------------------------------

interface DualGridDiffViewerProps {
  rows: SideBySideRow[];
  hunks: DiffHunk[];
  currentDiffIndex: number;
  syncScroll: boolean;
  wrapLines: boolean;
  onSelectHunk: (index: number) => void;
  onCopyOriginal: () => void;
  onCopyModified: () => void;
}

const DualGridDiffViewer: React.FC<DualGridDiffViewerProps> = ({
  rows,
  hunks,
  currentDiffIndex,
  syncScroll,
  wrapLines,
  onSelectHunk,
  onCopyOriginal,
  onCopyModified
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Synchronized scrolling handler
  const handleScroll = (source: 'left' | 'right') => () => {
    if (!syncScroll || isSyncingRef.current) return;

    isSyncingRef.current = true;
    requestAnimationFrame(() => {
      const leftEl = leftScrollRef.current;
      const rightEl = rightScrollRef.current;

      if (leftEl && rightEl) {
        if (source === 'left') {
          rightEl.scrollTop = leftEl.scrollTop;
          rightEl.scrollLeft = leftEl.scrollLeft;
        } else {
          leftEl.scrollTop = rightEl.scrollTop;
          leftEl.scrollLeft = rightEl.scrollLeft;
        }
      }
      isSyncingRef.current = false;
    });
  };

  // Scroll active hunk into view and set focus precisely
  useEffect(() => {
    if (currentDiffIndex < 0 || currentDiffIndex >= hunks.length) return;
    const activeHunk = hunks[currentDiffIndex];
    if (!activeHunk) return;

    // Locate the first non-collapsed row element for this hunk
    let rowEl: HTMLElement | null = null;
    for (let r = activeHunk.sideBySideStartRow; r <= activeHunk.sideBySideEndRow; r++) {
      const el = document.getElementById(`sbs-left-row-${r}`);
      if (el) {
        rowEl = el;
        break;
      }
    }

    if (leftScrollRef.current && rowEl) {
      const container = leftScrollRef.current;
      const rowTop = rowEl.offsetTop;
      const rowHeight = rowEl.offsetHeight;
      const containerHeight = container.clientHeight;
      const targetScrollTop = Math.max(0, rowTop - containerHeight / 2 + rowHeight / 2);

      isSyncingRef.current = true;
      leftScrollRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      if (rightScrollRef.current) {
        rightScrollRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }

      // Focus element for keyboard navigation and screen readers
      rowEl.focus({ preventScroll: true });

      setTimeout(() => {
        isSyncingRef.current = false;
      }, 450);
    }
  }, [currentDiffIndex, hunks]);

  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Dual Panel Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-border bg-muted/60 text-xs font-semibold select-none">
        {/* Left Panel Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="text-foreground">Lưới Bản Gốc (Original / Before)</span>
          </div>
          <button
            onClick={onCopyOriginal}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
            title="Sao chép toàn bộ văn bản gốc"
          >
            <Copy className="w-3 h-3" />
            <span>Copy gốc</span>
          </button>
        </div>

        {/* Right Panel Header */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-foreground">Lưới Bản Chỉnh Sửa (Modified / After)</span>
          </div>
          <button
            onClick={onCopyModified}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
            title="Sao chép toàn bộ văn bản chỉnh sửa"
          >
            <Copy className="w-3 h-3" />
            <span>Copy sửa</span>
          </button>
        </div>
      </div>

      {/* 2 Grids Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Left Panel: Original */}
        <div
          ref={leftScrollRef}
          onScroll={handleScroll('left')}
          className="overflow-x-auto max-h-[680px] overflow-y-auto font-mono text-xs select-text focus:outline-none"
        >
          <div className="min-w-full inline-block">
            {rows.map((row) => {
              if (row.isContextCollapsed) return null;

              const isCurrentHunk = row.diffHunkIndex !== null && row.diffHunkIndex === currentDiffIndex;
              const isRemoved = row.type === 'removed';
              const isModified = row.type === 'modified';
              const isEmpty = row.left.type === 'empty';

              // Visual styling for row
              let rowBg = 'hover:bg-muted/30';
              if (isRemoved) {
                rowBg = 'bg-red-500/10 dark:bg-red-950/25 text-red-950 dark:text-red-200';
              } else if (isModified) {
                rowBg = 'bg-amber-500/10 dark:bg-amber-950/20 text-foreground';
              } else if (isEmpty) {
                rowBg = 'bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(150,150,150,0.06)_6px,rgba(150,150,150,0.06)_12px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_12px)]';
              }

              return (
                <div
                  key={row.rowNumber}
                  id={`sbs-left-row-${row.rowNumber}`}
                  tabIndex={-1}
                  onClick={() => {
                    if (row.diffHunkIndex !== null) onSelectHunk(row.diffHunkIndex);
                  }}
                  className={`flex items-stretch border-b border-border/30 transition-all outline-none ${rowBg} ${
                    isCurrentHunk
                      ? 'ring-2 ring-primary ring-inset bg-primary/10 shadow-sm border-l-4 border-l-primary'
                      : ''
                  }`}
                >
                  {/* Line Number Gutter */}
                  <div className="w-12 py-1 px-2 text-right text-muted-foreground/60 select-none border-r border-border/40 flex-shrink-0 bg-muted/20">
                    {row.left.lineNumber ?? ''}
                  </div>

                  {/* Marker Icon Gutter */}
                  <div className="w-8 py-1 flex items-center justify-center select-none border-r border-border/40 flex-shrink-0">
                    {isRemoved && (
                      <span className="w-4 h-4 rounded flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400">
                        <Minus className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    {isModified && (
                      <span className="w-4 h-4 rounded flex items-center justify-center bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <PenLine className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Code Text Content */}
                  <div
                    className={`py-1 px-3 flex-1 overflow-hidden ${
                      wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                    }`}
                  >
                    {!isEmpty && (
                      <TokenizedLine
                        tokens={row.left.tokens}
                        fallbackText={row.left.content}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Modified */}
        <div
          ref={rightScrollRef}
          onScroll={handleScroll('right')}
          className="overflow-x-auto max-h-[680px] overflow-y-auto font-mono text-xs select-text focus:outline-none"
        >
          <div className="min-w-full inline-block">
            {rows.map((row) => {
              if (row.isContextCollapsed) return null;

              const isCurrentHunk = row.diffHunkIndex !== null && row.diffHunkIndex === currentDiffIndex;
              const isAdded = row.type === 'added';
              const isModified = row.type === 'modified';
              const isEmpty = row.right.type === 'empty';

              // Visual styling for row
              let rowBg = 'hover:bg-muted/30';
              if (isAdded) {
                rowBg = 'bg-emerald-500/10 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-200';
              } else if (isModified) {
                rowBg = 'bg-emerald-500/10 dark:bg-emerald-950/20 text-foreground';
              } else if (isEmpty) {
                rowBg = 'bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(150,150,150,0.06)_6px,rgba(150,150,150,0.06)_12px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.02)_6px,rgba(255,255,255,0.02)_12px)]';
              }

              return (
                <div
                  key={row.rowNumber}
                  id={`sbs-right-row-${row.rowNumber}`}
                  tabIndex={-1}
                  onClick={() => {
                    if (row.diffHunkIndex !== null) onSelectHunk(row.diffHunkIndex);
                  }}
                  className={`flex items-stretch border-b border-border/30 transition-all outline-none ${rowBg} ${
                    isCurrentHunk
                      ? 'ring-2 ring-primary ring-inset bg-primary/10 shadow-sm border-l-4 border-l-primary'
                      : ''
                  }`}
                >
                  {/* Line Number Gutter */}
                  <div className="w-12 py-1 px-2 text-right text-muted-foreground/60 select-none border-r border-border/40 flex-shrink-0 bg-muted/20">
                    {row.right.lineNumber ?? ''}
                  </div>

                  {/* Marker Icon Gutter */}
                  <div className="w-8 py-1 flex items-center justify-center select-none border-r border-border/40 flex-shrink-0">
                    {isAdded && (
                      <span className="w-4 h-4 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Plus className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    {isModified && (
                      <span className="w-4 h-4 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                      </span>
                    )}
                  </div>

                  {/* Code Text Content */}
                  <div
                    className={`py-1 px-3 flex-1 overflow-hidden ${
                      wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                    }`}
                  >
                    {!isEmpty && (
                      <TokenizedLine
                        tokens={row.right.tokens}
                        fallbackText={row.right.content}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// UnifiedDiffViewer: 1 Lưới Gộp với Gutter Icons & Scroll/Focus
// -------------------------------------------------------------

interface UnifiedDiffViewerProps {
  rows: UnifiedRow[];
  hunks: DiffHunk[];
  currentDiffIndex: number;
  wrapLines: boolean;
  onSelectHunk: (index: number) => void;
}

const UnifiedDiffViewer: React.FC<UnifiedDiffViewerProps> = ({
  rows,
  hunks,
  currentDiffIndex,
  wrapLines,
  onSelectHunk
}) => {
  const unifiedScrollRef = useRef<HTMLDivElement>(null);

  // Scroll active hunk into view in unified mode
  useEffect(() => {
    if (currentDiffIndex < 0 || currentDiffIndex >= hunks.length) return;
    const activeHunk = hunks[currentDiffIndex];
    if (!activeHunk) return;

    let rowEl: HTMLElement | null = null;
    for (let r = activeHunk.unifiedStartRow; r <= activeHunk.unifiedEndRow; r++) {
      const el = document.getElementById(`unified-row-${r}`);
      if (el) {
        rowEl = el;
        break;
      }
    }

    if (unifiedScrollRef.current && rowEl) {
      const container = unifiedScrollRef.current;
      const rowTop = rowEl.offsetTop;
      const rowHeight = rowEl.offsetHeight;
      const containerHeight = container.clientHeight;
      const targetScrollTop = Math.max(0, rowTop - containerHeight / 2 + rowHeight / 2);

      unifiedScrollRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      rowEl.focus({ preventScroll: true });
    }
  }, [currentDiffIndex, hunks]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="border-b border-border bg-muted/60 px-4 py-2.5 text-xs font-semibold select-none flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-primary" />
          <span>Chế độ Gộp (Unified Diff View)</span>
        </div>
        <span className="text-muted-foreground text-[11px]">Đỏ (-): Xóa / Xanh (+): Thêm</span>
      </div>

      <div
        ref={unifiedScrollRef}
        className="overflow-x-auto max-h-[680px] overflow-y-auto font-mono text-xs select-text focus:outline-none"
      >
        <div className="min-w-full inline-block">
          {rows.map((row) => {
            if (row.isContextCollapsed) return null;

            const isCurrentHunk = row.diffHunkIndex !== null && row.diffHunkIndex === currentDiffIndex;
            const isAdded = row.type === 'added';
            const isRemoved = row.type === 'removed';

            let rowBg = 'hover:bg-muted/30';
            if (isAdded) {
              rowBg = 'bg-emerald-500/10 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-200';
            } else if (isRemoved) {
              rowBg = 'bg-red-500/10 dark:bg-red-950/25 text-red-950 dark:text-red-200';
            }

            return (
              <div
                key={row.rowNumber}
                id={`unified-row-${row.rowNumber}`}
                tabIndex={-1}
                onClick={() => {
                  if (row.diffHunkIndex !== null) onSelectHunk(row.diffHunkIndex);
                }}
                className={`flex items-stretch border-b border-border/30 transition-all outline-none ${rowBg} ${
                  isCurrentHunk
                    ? 'ring-2 ring-primary ring-inset bg-primary/10 shadow-sm border-l-4 border-l-primary'
                    : ''
                }`}
              >
                {/* Old Line Number */}
                <div className="w-12 py-1 px-2 text-right text-muted-foreground/60 select-none border-r border-border/40 flex-shrink-0 bg-muted/20">
                  {row.oldLineNumber ?? ''}
                </div>

                {/* New Line Number */}
                <div className="w-12 py-1 px-2 text-right text-muted-foreground/60 select-none border-r border-border/40 flex-shrink-0 bg-muted/20">
                  {row.newLineNumber ?? ''}
                </div>

                {/* Marker Icon Gutter */}
                <div className="w-8 py-1 flex items-center justify-center select-none border-r border-border/40 flex-shrink-0">
                  {isRemoved && (
                    <span className="w-4 h-4 rounded flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400">
                      <Minus className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                  {isAdded && (
                    <span className="w-4 h-4 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div
                  className={`py-1 px-3 flex-1 overflow-hidden ${
                    wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                  }`}
                >
                  <TokenizedLine tokens={row.tokens} fallbackText={row.content} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
