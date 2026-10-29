import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  Download,
  Upload,
  Play,
  FileCode,
  Image as ImageIcon,
  AlertTriangle,
  Info,
  Sparkles,
  Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  encodeUtf8ToBase64,
  decodeBase64ToUtf8,
  validateBase64,
  base64ToBytes,
  detectMimeFromBytes,
  getUtf8ByteSize,
  formatByteSize
} from '../engine/base64';
import { Base64Mode, Base64Options } from '../types';

interface Base64TabProps {
  options: Base64Options;
  mode: Base64Mode;
  onUpdateOptions: (opts: Partial<Base64Options>) => void;
  onUpdateMode: (mode: Base64Mode) => void;
}

const SAMPLE_TEXT_VIETNAMESE = `Xin chào DevToolkit! 🚀
Hệ thống tiện ích lập trình viên 100% Client-Side.
Hỗ trợ tiếng Việt có dấu đầy đủ:
- Tiếng Việt: Ă, Â, Đ, Ê, Ô, Ơ, Ư
- Ký tự đặc biệt: ★, ⚡, ☕, 💻
- JSON: {"status": 200, "message": "Thành công", "data": [1, 2, 3]}`;

const SAMPLE_BASE64 = `WGluIGNow6BvIERldlRvb2xraXQhIPCfmYAKeMOqdGjhu5FuZyB0aeG7h24gw61jaCBs4bqtcCB0csOsbmggdmnDqm4gMTAwJSBDbGllbnQtU2lkZS4KSOG7lyB0cuG7oyB0aeG6v25nIFZp4buHdCBjw7MgZOG6pXUgxJHhuqd5IMSR4bunOgotIFRnhur9uZyBWaeG7h3Q6IMSCLCDDosK7IMSQLCDDisqKIMOULCDGoizCoMSsCi0gS8O9IHThu7EgxJHhurdjIGJp4buHdDog4piFLCDimqEsIOKYlSwg8J+SnwotIEpTT046IHsic3RhdHVzIjogMjAwLCAibWVzc2FnZSI6ICJUaMOgbmggY8O0bmciLCAiZGF0YSI6IFsxLCAyLCAzXX0=`;

export const Base64Tab: React.FC<Base64TabProps> = ({
  options,
  mode,
  onUpdateOptions,
  onUpdateMode
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [detectedFileInfo, setDetectedFileInfo] = useState<{ mime: string; ext: string; isImage: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stats calculation
  const inputChars = inputText.length;
  const inputBytes = useMemo(() => getUtf8ByteSize(inputText), [inputText]);
  const outputChars = outputText.length;
  const outputBytes = useMemo(() => getUtf8ByteSize(outputText), [outputText]);

  const sizeDiffPercent = useMemo(() => {
    if (!inputBytes || !outputBytes) return 0;
    const diff = outputBytes - inputBytes;
    return Number(((diff / inputBytes) * 100).toFixed(1));
  }, [inputBytes, outputBytes]);

  // Main Conversion Logic
  const handleConvert = useCallback((textToConvert: string = inputText) => {
    setErrorInfo(null);
    setPreviewImageUrl(null);
    setDetectedFileInfo(null);

    if (!textToConvert) {
      setOutputText('');
      return;
    }

    if (mode === 'encode') {
      try {
        const encoded = encodeUtf8ToBase64(textToConvert, {
          urlSafe: options.urlSafe,
          wrap76: options.wrap76
        });
        setOutputText(encoded);
      } catch (err: any) {
        setErrorInfo(`Lỗi mã hóa: ${err?.message || 'Không thể mã hóa UTF-8'}`);
      }
    } else {
      // Decode Mode
      const validation = validateBase64(textToConvert);
      if (!validation.isValid) {
        setErrorInfo(validation.error || 'Chuỗi Base64 không hợp lệ');
      }

      // Check if binary / image
      try {
        const bytes = base64ToBytes(textToConvert);
        const meta = detectMimeFromBytes(bytes);
        setDetectedFileInfo({ mime: meta.mime, ext: meta.extension, isImage: meta.isImage });

        if (meta.isImage) {
          const blob = new Blob([bytes as any], { type: meta.mime });
          const url = URL.createObjectURL(blob);
          setPreviewImageUrl(url);
        }
      } catch {
        // Ignore binary check error
      }

      const decoded = decodeBase64ToUtf8(textToConvert);
      if (decoded.error && !validation.error) {
        setErrorInfo(decoded.error);
      }
      setOutputText(decoded.text);
    }
  }, [mode, inputText, options.urlSafe, options.wrap76]);

  // Debounced real-time conversion (< 100K chars)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (inputText.length > 100000) {
      // Large payload, wait for manual click
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      handleConvert(inputText);
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText, handleConvert]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  // Swap input and output
  const handleSwap = () => {
    if (!outputText) return;
    setInputText(outputText);
    setOutputText(inputText);
    onUpdateMode(mode === 'encode' ? 'decode' : 'encode');
    toast.success('Đã đảo ngược đầu vào & đầu ra');
  };

  // Copy output
  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setIsCopied(true);
      toast.success('Đã sao chép vào Clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Không thể truy cập Clipboard trình duyệt');
    }
  };

  // Paste clipboard
  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        setInputText(text);
        toast.success('Đã dán từ Clipboard');
      } else {
        toast.error('Trình duyệt không hỗ trợ đọc tự động, vui lòng dùng Ctrl+V');
      }
    } catch {
      toast.error('Vui lòng cấp quyền đọc Clipboard trong trình duyệt');
    }
  };

  // Clear
  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setErrorInfo(null);
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(null);
    }
    setDetectedFileInfo(null);
  };

  // Use sample
  const handleUseSample = () => {
    if (mode === 'encode') {
      setInputText(SAMPLE_TEXT_VIETNAMESE);
    } else {
      setInputText(SAMPLE_BASE64);
    }
  };

  // Upload file to encode Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File vượt quá kích thước 20MB. Vui lòng chọn file nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (mode === 'encode') {
        // result is "data:<mime>;base64,<encoded>"
        const base64Only = result.split(',')[1] || '';
        setInputText(base64Only);
        toast.success(`Đã nạp file: ${file.name} (${formatByteSize(file.size)})`);
      } else {
        setInputText(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Download output as file
  const handleDownload = () => {
    if (!outputText) return;

    if (mode === 'encode') {
      // Download Base64 as .txt
      const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'base64-encoded.txt';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Decode: download decoded file
      try {
        const bytes = base64ToBytes(inputText);
        const meta = detectedFileInfo || detectMimeFromBytes(bytes);
        const blob = new Blob([bytes as any], { type: meta.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decoded-file.${meta.ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Đang tải file (${meta.ext.toUpperCase()})`);
      } catch {
        // Fallback to text
        const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'decoded-text.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuration & Mode Bar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onUpdateMode('encode')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'encode'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mã hóa (Text → Base64)
          </button>
          <button
            type="button"
            onClick={() => onUpdateMode('decode')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'decode'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Giải mã (Base64 → Text)
          </button>
        </div>

        {/* Options Toggles */}
        <div className="flex items-center gap-4 flex-wrap">
          {mode === 'encode' && (
            <>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={options.urlSafe}
                  onChange={(e) => onUpdateOptions({ urlSafe: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <span>URL-safe (- _ không padding)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={options.wrap76}
                  onChange={(e) => onUpdateOptions({ wrap76: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <span>Ngắt dòng 76 ký tự (MIME)</span>
              </label>
            </>
          )}

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            disabled={!outputText}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition disabled:opacity-40"
            title="Đảo ngược đầu vào và kết quả"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hoán đổi</span>
          </button>

          {/* Upload File */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition"
            title="Chọn file từ máy tính để mã hóa thành Base64"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nạp file</span>
          </button>

          {/* Manual Run button if large */}
          {inputChars > 100000 && (
            <button
              type="button"
              onClick={() => handleConvert()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chuyển đổi ngay</span>
            </button>
          )}
        </div>
      </div>

      {/* Error / Warning Alert */}
      {errorInfo && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Phát hiện bất thường: </span>
            <span>{errorInfo}</span>
          </div>
        </div>
      )}

      {/* Main Grid: Left Input, Right Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Input Panel */}
        <div className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-primary" />
              {mode === 'encode' ? 'Văn bản gốc (UTF-8)' : 'Chuỗi Base64 cần giải mã'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUseSample}
                className="px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="Điền dữ liệu mẫu kiểm thử"
              >
                Ví dụ
              </button>
              <button
                type="button"
                onClick={handlePaste}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="Dán từ Clipboard"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={!inputText}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition disabled:opacity-40"
                title="Xóa nội dung"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[320px]">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                mode === 'encode'
                  ? 'Nhập hoặc dán văn bản tiếng Việt có dấu, emoji, json...\nHoặc bấm "Nạp file" để mã hóa file nhị phân.'
                  : 'Dán chuỗi Base64 hoặc chuỗi data URI (data:image/png;base64,...)...'
              }
              className="w-full h-full p-4 bg-transparent resize-none font-mono text-xs focus:outline-none focus:ring-0 border-0 placeholder:text-muted-foreground/60 leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Footer Stats */}
          <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Ký tự: <strong className="text-foreground">{inputChars.toLocaleString()}</strong>
            </span>
            <span>
              Kích thước: <strong className="text-foreground">{formatByteSize(inputBytes)}</strong>
            </span>
          </div>
        </div>

        {/* Right Column: Output Panel */}
        <div className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {mode === 'encode' ? 'Kết quả Base64' : 'Kết quả giải mã'}
              {detectedFileInfo && (
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {detectedFileInfo.mime}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!outputText}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition disabled:opacity-40"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Đã copy' : 'Sao chép'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!outputText}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-40"
                title="Tải kết quả về file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[320px] flex flex-col">
            {/* Decoded Image Preview (if image detected) */}
            {previewImageUrl && (
              <div className="p-3 border-b border-border bg-muted/10 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <span>Xem trước hình ảnh tự động ({detectedFileInfo?.ext.toUpperCase()})</span>
                </div>
                <div className="max-h-48 overflow-hidden rounded-xl border border-border bg-checkered p-1">
                  <img
                    src={previewImageUrl}
                    alt="Base64 Preview"
                    className="max-h-44 object-contain rounded-lg"
                  />
                </div>
              </div>
            )}

            <textarea
              readOnly
              value={outputText}
              placeholder="Kết quả chuyển đổi sẽ hiển thị ngay tại đây..."
              className="w-full flex-1 p-4 bg-transparent resize-none font-mono text-xs focus:outline-none focus:ring-0 border-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Footer Stats */}
          <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Ký tự: <strong className="text-foreground">{outputChars.toLocaleString()}</strong>
            </span>
            <span>
              Chênh lệch:{' '}
              <strong className={sizeDiffPercent > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {sizeDiffPercent > 0 ? `+${sizeDiffPercent}%` : `${sizeDiffPercent}%`}
              </strong>{' '}
              ({formatByteSize(outputBytes)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
