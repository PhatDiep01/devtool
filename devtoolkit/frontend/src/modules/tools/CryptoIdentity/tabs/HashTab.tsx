import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Hash,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  Upload,
  Play,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  FileText,
  Clock,
  Sparkles,
  Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  computeAllHashes,
  compareHashValues,
  hashFileInChunks,
  HASH_ALGORITHMS
} from '../engine/hash';
import {
  HashAlgorithm,
  HashItemResult,
  HashOutputCase,
  HashOutputEncoding,
  HashCompareResult,
  HashFileMeta
} from '../types';
import { formatByteSize } from '../engine/base64';

interface HashTabProps {
  casing: HashOutputCase;
  encoding: HashOutputEncoding;
  hmacEnabled: boolean;
  onUpdateCasing: (casing: HashOutputCase) => void;
  onUpdateEncoding: (encoding: HashOutputEncoding) => void;
  onUpdateHmacEnabled: (enabled: boolean) => void;
}

const SAMPLE_TEXT = 'DevToolkit - Hệ sinh thái công cụ dành cho lập trình viên 2026';

export const HashTab: React.FC<HashTabProps> = ({
  casing,
  encoding,
  hmacEnabled,
  onUpdateCasing,
  onUpdateEncoding,
  onUpdateHmacEnabled
}) => {
  const [inputText, setInputText] = useState<string>(SAMPLE_TEXT);
  const [hmacSecret, setHmacSecret] = useState<string>('');
  const [showHmacSecret, setShowHmacSecret] = useState<boolean>(false);
  const [compareInput, setCompareInput] = useState<string>('');
  const [results, setResults] = useState<HashItemResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // File hashing states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileProgress, setFileProgress] = useState<number>(0);
  const [fileMeta, setFileMeta] = useState<HashFileMeta | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comparison result
  const comparison: HashCompareResult = useMemo(() => {
    return compareHashValues(compareInput, results);
  }, [compareInput, results]);

  // Compute text hashes
  const runHashText = useCallback(async (text: string, secret: string) => {
    if (!text) {
      setResults([]);
      return;
    }
    setIsProcessing(true);
    try {
      const bytes = new TextEncoder().encode(text);
      const res = await computeAllHashes(bytes, {
        casing,
        encoding,
        hmacKey: hmacEnabled ? secret : undefined
      });
      setResults(res);
    } catch (err: any) {
      toast.error('Lỗi tính toán hash: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  }, [casing, encoding, hmacEnabled]);

  // Real-time update for text
  useEffect(() => {
    if (selectedFile) return; // If file is selected, do not compute text
    runHashText(inputText, hmacSecret);
  }, [inputText, hmacSecret, casing, encoding, hmacEnabled, selectedFile, runHashText]);

  // Copy helper
  const handleCopy = async (text: string, keyId: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      toast.success('Đã sao chép vào Clipboard!');
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Copy All Hashes
  const handleCopyAll = async () => {
    if (results.length === 0) return;
    const text = results.map((r) => `${r.algorithm}: ${r.value}`).join('\n');
    await handleCopy(text, 'all');
  };

  // Upload and hash file in chunks
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileProgress(0);
    setFileMeta(null);
    setResults([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true);

    try {
      const { results: fileResults, elapsedMs } = await hashFileInChunks(file, {
        casing,
        encoding,
        signal: controller.signal,
        onProgress: (pct) => setFileProgress(pct)
      });

      setResults(fileResults);
      setFileMeta({
        name: file.name,
        size: file.size,
        elapsedMs
      });
      toast.success(`Đã tính hash file thành công trong ${elapsedMs}ms!`);
    } catch (err: any) {
      if (err?.message?.includes('hủy')) {
        toast('Đã hủy tính toán hash file.');
      } else {
        toast.error('Lỗi tính toán file: ' + (err?.message || ''));
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
      e.target.value = '';
    }
  };

  // Cancel file hashing
  const handleCancelFileHash = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Clear all
  const handleClear = () => {
    setInputText('');
    setSelectedFile(null);
    setFileMeta(null);
    setResults([]);
    setCompareInput('');
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Format Options: Case & Encoding */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Case Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => onUpdateCasing('lower')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                casing === 'lower' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Chữ thường (lower)
            </button>
            <button
              type="button"
              onClick={() => onUpdateCasing('upper')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                casing === 'upper' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Chữ HOA (UPPER)
            </button>
          </div>

          {/* Encoding Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => onUpdateEncoding('hex')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                encoding === 'hex' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Hex (Thập lục phân)
            </button>
            <button
              type="button"
              onClick={() => onUpdateEncoding('base64')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                encoding === 'base64' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Base64
            </button>
          </div>

          {/* HMAC Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
            <input
              type="checkbox"
              checked={hmacEnabled}
              onChange={(e) => onUpdateHmacEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <span>Chế độ HMAC (Có khóa bí mật)</span>
          </label>
        </div>

        {/* Upload File & Action */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Hash File</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            disabled={results.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition disabled:opacity-40"
          >
            {copiedKey === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'all' ? 'Đã copy tất cả' : 'Copy tất cả'}</span>
          </button>
        </div>
      </div>

      {/* HMAC Secret Key Box (when enabled) */}
      {hmacEnabled && (
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>Khóa bí mật HMAC (Secret Key):</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHmacSecret(!showHmacSecret)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showHmacSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showHmacSecret ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>
          <input
            type={showHmacSecret ? 'text' : 'password'}
            value={hmacSecret}
            onChange={(e) => setHmacSecret(e.target.value)}
            placeholder="Nhập secret key để tạo chữ ký HMAC (HMAC-MD5, HMAC-SHA256...)..."
            className="w-full px-3 py-2 rounded-xl bg-card border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoComplete="off"
          />
        </div>
      )}

      {/* Main Grid: Input Left, Computed Hashes Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5 cols): Input Text or Selected File */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-primary" />
              <span>{selectedFile ? 'File đang chọn' : 'Nội dung văn bản (UTF-8)'}</span>
            </span>
            <div className="flex items-center gap-1">
              {!selectedFile && (
                <>
                  <button
                    type="button"
                    onClick={() => setInputText(SAMPLE_TEXT)}
                    className="px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  >
                    Ví dụ
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const txt = await navigator.clipboard?.readText();
                        if (txt) setInputText(txt);
                      } catch {
                        // ignore
                      }
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    title="Dán từ Clipboard"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition"
                title="Xóa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[260px] flex flex-col">
            {selectedFile ? (
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="w-12 h-12 text-primary" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">{selectedFile.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatByteSize(selectedFile.size)} • {selectedFile.type || 'Binary'}
                  </p>
                </div>

                {isProcessing && (
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                      <span>Đang tính toán theo khối...</span>
                      <span>{fileProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-150"
                        style={{ width: `${fileProgress}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelFileHash}
                      className="px-3 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition"
                    >
                      Hủy quá trình
                    </button>
                  </div>
                )}

                {fileMeta && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Thời gian tính: {fileMeta.elapsedMs} ms</span>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập bất kỳ văn bản tiếng Việt, mật khẩu, JSON hoặc chuỗi để băm..."
                className="w-full flex-1 p-4 bg-transparent resize-none font-mono text-xs focus:outline-none border-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
                spellCheck={false}
              />
            )}
          </div>

          <div className="px-4 py-2 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              Ký tự: <strong className="text-foreground">{selectedFile ? '—' : inputText.length.toLocaleString()}</strong>
            </span>
            <span>
              Kích thước: <strong className="text-foreground">{selectedFile ? formatByteSize(selectedFile.size) : formatByteSize(new TextEncoder().encode(inputText).length)}</strong>
            </span>
          </div>
        </div>

        {/* Right Column (7 cols): List of computed hashes */}
        <div className="lg:col-span-7 space-y-3">
          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý bảo mật:</strong> MD5 và SHA-1 đã bị phá vỡ về mặt mật mã học (cryptographically broken), chỉ nên dùng để kiểm tra tính toàn vẹn (checksum). Hãy ưu tiên <strong>SHA-256</strong> hoặc <strong>SHA-512</strong> cho bảo mật.
            </span>
          </div>

          {/* Results List */}
          <div className="space-y-2.5">
            {results.map((item) => (
              <div
                key={item.algorithm}
                className="p-3 rounded-2xl bg-card border border-border shadow-xs hover:border-border/80 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-foreground">
                      {hmacEnabled ? `HMAC-${item.algorithm}` : item.algorithm}
                    </span>
                    {item.isBrokenSecurity && (
                      <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Checksum only
                      </span>
                    )}
                    {item.algorithm === 'SHA-256' && (
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        Chuẩn khuyến nghị
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.value, item.algorithm)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition"
                  >
                    {copiedKey === item.algorithm ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === item.algorithm ? 'Đã copy' : 'Copy'}</span>
                  </button>
                </div>

                <div className="font-mono text-xs text-foreground bg-muted/30 p-2.5 rounded-xl break-all select-all leading-relaxed">
                  {item.value || '...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* HASH COMPARATOR / MATCHER */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Đối chiếu & So sánh mã Hash (Hash Matcher):</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            Dán hash đã biết từ nhà phát hành để đối chiếu toàn vẹn (không phân biệt HOA/thường)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={compareInput}
            onChange={(e) => setCompareInput(e.target.value.trim())}
            placeholder="Dán mã hash cần đối chiếu vào đây..."
            className="flex-1 px-3 py-2 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {compareInput && (
            <button
              type="button"
              onClick={() => setCompareInput('')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition"
              title="Xóa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Match Result Banner */}
        {comparison.hasInput && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              comparison.matched
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 border border-destructive/30 text-destructive'
            }`}
          >
            {comparison.matched ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  HOÀN TOÀN TRÙNG KHỚP! Giá trị hash khớp với thuật toán:{' '}
                  <strong>{comparison.matchedAlgorithms.join(', ')}</strong>. Dữ liệu vẹn toàn.
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 shrink-0" />
                <span>
                  KHÔNG TRÙNG KHỚP với bất kỳ thuật toán hash nào bên trên. Vui lòng kiểm tra lại dữ liệu đầu vào.
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
