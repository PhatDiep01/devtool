import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  ArrowRight,
  Plus,
  Info,
  AlertTriangle,
  Sparkles,
  Layers,
  Edit2,
  Globe,
  Sliders
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  encodeUrlText,
  decodeUrlTextOnce,
  decodeUrlMultiLayers,
  countEncodingLayers,
  hasPercentEncoding,
  parseFullUrl,
  rebuildUrlFromParts
} from '../engine/url';
import { UrlMode, UrlEncodeType, QueryParamItem, ParsedUrl } from '../types';

interface UrlTabProps {
  mode: UrlMode;
  encodeType: UrlEncodeType;
  onUpdateMode: (mode: UrlMode) => void;
  onUpdateEncodeType: (type: UrlEncodeType) => void;
}

const SAMPLE_FULL_URL = `https://admin:secret123@api.devtoolkit.vn:8080/v2/reports/search?keyword=Ti%E1%BA%BFng%20Vi%E1%BB%87t%20c%C3%B3%20d%E1%BA%A5u&category=c%C3%B4ng%20c%E1%BB%A5&page=1&limit=25&filters=%7B%22status%22%3A%22active%22%7D#results-section`;

const SAMPLE_QUERY_VALUE = `https://example.com/api/auth/callback?token=xyz123&redirect=https://app.devtoolkit.vn/dashboard?tab=analytics`;

export const UrlTab: React.FC<UrlTabProps> = ({
  mode,
  encodeType,
  onUpdateMode,
  onUpdateEncodeType
}) => {
  // Simple Encode/Decode states
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Multi-layer decode info
  const detectedLayers = useMemo(() => {
    if (mode !== 'decode' || !inputText) return 0;
    return countEncodingLayers(inputText);
  }, [mode, inputText]);

  // URL Parser & Builder states
  const [parserInput, setParserInput] = useState<string>(SAMPLE_FULL_URL);
  const [parsedUrl, setParsedUrl] = useState<ParsedUrl>(() => parseFullUrl(SAMPLE_FULL_URL));
  const [activeSubTab, setActiveSubTab] = useState<'convert' | 'parser'>('convert');

  // Run Conversion
  const handleConvert = useCallback((text: string = inputText) => {
    setErrorInfo(null);
    if (!text) {
      setOutputText('');
      return;
    }

    if (mode === 'encode') {
      const res = encodeUrlText(text, encodeType);
      setOutputText(res);
    } else {
      // Decode
      const res = decodeUrlTextOnce(text);
      if (res.error) {
        setErrorInfo(res.error);
      }
      setOutputText(res.result);
    }
  }, [mode, encodeType, inputText]);

  // Real-time update
  useEffect(() => {
    handleConvert(inputText);
  }, [inputText, mode, encodeType, handleConvert]);

  // Decode another layer
  const handleDecodeFurther = () => {
    if (!outputText) return;
    const step = decodeUrlTextOnce(outputText);
    if (step.error) {
      toast.error(step.error);
      return;
    }
    setOutputText(step.result);
    toast.success('Đã giải mã thêm 1 tầng URL!');
  };

  // Decode all layers
  const handleDecodeAllLayers = () => {
    if (!inputText) return;
    const res = decodeUrlMultiLayers(inputText, 10);
    setOutputText(res.result);
    if (res.error) {
      setErrorInfo(res.error);
    }
    toast.success(`Đã bóc tách thành công ${res.layersDecoded} tầng mã hóa!`);
  };

  // Copy output
  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Đã sao chép vào Clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Không thể truy cập Clipboard');
    }
  };

  // Paste into convert
  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        setInputText(text);
        toast.success('Đã dán từ Clipboard');
      }
    } catch {
      toast.error('Vui lòng dùng Ctrl+V');
    }
  };

  // ========================================================
  // URL PARSER & INTERACTIVE QUERY EDITOR
  // ========================================================
  const handleParseUrlChange = (newUrl: string) => {
    setParserInput(newUrl);
    setParsedUrl(parseFullUrl(newUrl));
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    const updatedParams = parsedUrl.params.map((p) => {
      if (p.id === id) {
        return { ...p, [field]: val };
      }
      return p;
    });

    const newUrl = rebuildUrlFromParts(parsedUrl, updatedParams);
    setParserInput(newUrl);
    setParsedUrl({
      ...parsedUrl,
      raw: newUrl,
      params: updatedParams
    });
  };

  const handleAddParam = () => {
    const newParam: QueryParamItem = {
      id: `param_${Math.random().toString(36).substring(2, 9)}`,
      key: 'new_param',
      value: '',
      enabled: true
    };
    const updatedParams = [...parsedUrl.params, newParam];
    const newUrl = rebuildUrlFromParts(parsedUrl, updatedParams);
    setParserInput(newUrl);
    setParsedUrl({
      ...parsedUrl,
      raw: newUrl,
      params: updatedParams
    });
  };

  const handleDeleteParam = (id: string) => {
    const updatedParams = parsedUrl.params.filter((p) => p.id !== id);
    const newUrl = rebuildUrlFromParts(parsedUrl, updatedParams);
    setParserInput(newUrl);
    setParsedUrl({
      ...parsedUrl,
      raw: newUrl,
      params: updatedParams
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Navigation between Converter & Parser */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('convert')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'convert'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mã hóa / Giải mã URL
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('parser')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'parser'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Phân tích & Chỉnh sửa Query URL
          </button>
        </div>

        {activeSubTab === 'convert' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switch */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onUpdateMode('encode')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  mode === 'encode' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Mã hóa
              </button>
              <button
                type="button"
                onClick={() => onUpdateMode('decode')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  mode === 'decode' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Giải mã
              </button>
            </div>

            {/* If Mode is Encode: Type selector */}
            {mode === 'encode' && (
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => onUpdateEncodeType('component')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    encodeType === 'component' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="encodeURIComponent: Mã hóa toàn bộ ký tự đặc biệt, thích hợp cho tham số query"
                >
                  Thành phần (Component)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateEncodeType('full')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    encodeType === 'full' ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="encodeURI: Giữ nguyên các ký tự cấu trúc URL như https://, ?, &, #, /"
                >
                  Toàn bộ URL (Full)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SUB-VIEW 1: ENCODE / DECODE */}
      {/* ======================================================== */}
      {activeSubTab === 'convert' && (
        <div className="space-y-4">
          {/* Explanation Banner */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              {mode === 'encode' ? (
                encodeType === 'component' ? (
                  <span>
                    <strong>Mã hóa thành phần (encodeURIComponent):</strong> Mã hóa tất cả các ký tự đặc biệt (kể cả dấu <code>/</code>, <code>?</code>, <code>&</code>, <code>=</code>, <code>#</code>). Dùng khi bạn muốn đưa một URL hoặc giá trị có chứa ký tự lạ vào làm <em>tham số query</em> của một URL khác.
                  </span>
                ) : (
                  <span>
                    <strong>Mã hóa toàn bộ URL (encodeURI):</strong> Bảo toàn các ký tự cấu trúc giao thức và phân tách như <code>https://</code>, <code>/</code>, <code>?</code>, <code>&</code>, <code>#</code>. Chỉ mã hóa khoảng trắng và các ký tự không an toàn khác trong một địa chỉ web hoàn chỉnh.
                  </span>
                )
              ) : (
                <span>
                  <strong>Giải mã URL (decodeURIComponent):</strong> Tự động chuyển đổi các mã escape (ví dụ <code>%20</code> thành khoảng trắng, <code>%2F</code> thành <code>/</code>, <code>%3A</code> thành <code>:</code>) về ký tự gốc có dấu và emoji.
                </span>
              )}
            </div>
          </div>

          {/* Multi-layer decode notice */}
          {mode === 'decode' && detectedLayers > 1 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 shrink-0" />
                <span>
                  Phát hiện chuỗi URL được mã hóa <strong>lồng nhau {detectedLayers} tầng</strong> (nested URL encoding)!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecodeFurther}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition"
                >
                  Giải mã tiếp (+1 tầng)
                </button>
                <button
                  type="button"
                  onClick={handleDecodeAllLayers}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
                >
                  Bóc toàn bộ ({detectedLayers} tầng)
                </button>
              </div>
            </div>
          )}

          {errorInfo && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorInfo}</span>
            </div>
          )}

          {/* Grid: Input Left, Output Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Panel */}
            <div className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                  {mode === 'encode' ? 'Văn bản / Tham số cần mã hóa' : 'Chuỗi URL cần giải mã'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setInputText(mode === 'encode' ? SAMPLE_QUERY_VALUE : encodeURIComponent(SAMPLE_QUERY_VALUE))}
                    className="px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
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
                    onClick={() => {
                      setInputText('');
                      setOutputText('');
                      setErrorInfo(null);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative flex-1 min-h-[300px]">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    mode === 'encode'
                      ? 'Nhập nội dung cần mã hóa URL...'
                      : 'Dán chuỗi URL đã mã hóa (%20, %3A, %2F...)'
                  }
                  className="w-full h-full p-4 bg-transparent resize-none font-mono text-xs focus:outline-none border-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <div className="px-4 py-2 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground">
                Ký tự: <strong className="text-foreground">{inputText.length.toLocaleString()}</strong>
              </div>
            </div>

            {/* Output Panel */}
            <div className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Kết quả
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(outputText)}
                  disabled={!outputText}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition disabled:opacity-40"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Đã copy' : 'Sao chép'}</span>
                </button>
              </div>

              <div className="relative flex-1 min-h-[300px]">
                <textarea
                  readOnly
                  value={outputText}
                  placeholder="Kết quả chuyển đổi hiển thị tại đây..."
                  className="w-full h-full p-4 bg-transparent resize-none font-mono text-xs focus:outline-none border-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <div className="px-4 py-2 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground">
                Ký tự: <strong className="text-foreground">{outputText.length.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-VIEW 2: URL PARSER & INTERACTIVE QUERY EDITOR */}
      {/* ======================================================== */}
      {activeSubTab === 'parser' && (
        <div className="space-y-4">
          {/* URL Input Box */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary" />
                <span>Nhập URL đầy đủ để phân tách cấu trúc:</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleParseUrlChange(SAMPLE_FULL_URL)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  Ví dụ mẫu
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(parserInput)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              value={parserInput}
              onChange={(e) => handleParseUrlChange(e.target.value)}
              placeholder="https://example.com/api/v1/search?key=value#tag..."
              className="w-full p-3 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Broken Down Breakdown Cards */}
          {parsedUrl.isValid ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-xl bg-card border border-border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Protocol</div>
                  <div className="font-mono text-xs font-bold text-primary mt-1 truncate" title={parsedUrl.protocol}>
                    {parsedUrl.protocol || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border sm:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Hostname / Host</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-1 truncate" title={parsedUrl.hostname}>
                    {parsedUrl.hostname || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Port</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-1">
                    {parsedUrl.port || '(mặc định)'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border sm:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Pathname</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-1 truncate" title={parsedUrl.pathname}>
                    {parsedUrl.pathname || '/'}
                  </div>
                </div>

                {parsedUrl.username && (
                  <div className="p-3 rounded-xl bg-card border border-border sm:col-span-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Auth User : Pass</div>
                    <div className="font-mono text-xs text-foreground mt-1 truncate">
                      {parsedUrl.username}:{parsedUrl.password ? '••••••' : ''}
                    </div>
                  </div>
                )}

                {parsedUrl.hash && (
                  <div className="p-3 rounded-xl bg-card border border-border sm:col-span-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Hash / Fragment</div>
                    <div className="font-mono text-xs font-bold text-indigo-500 mt-1 truncate">
                      {parsedUrl.hash}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Query Parameters Table */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">
                      Bảng Tham Số Query ({parsedUrl.params.length})
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      (Sửa tham số bên dưới sẽ tự động dựng lại URL ở trên)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm tham số</span>
                  </button>
                </div>

                {parsedUrl.params.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    URL này chưa có tham số query nào (query string rỗng). Bấm "Thêm tham số" để bổ sung.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                          <th className="py-2.5 px-4 w-12 text-center">Bật</th>
                          <th className="py-2.5 px-4 w-1/3">Key (Tên tham số)</th>
                          <th className="py-2.5 px-4">Value (Giá trị đã giải mã)</th>
                          <th className="py-2.5 px-4 w-28 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsedUrl.params.map((param) => (
                          <tr key={param.id} className="hover:bg-muted/20 transition group">
                            {/* Toggle enabled */}
                            <td className="py-2 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={param.enabled}
                                onChange={(e) => handleUpdateParam(param.id, 'enabled', e.target.checked)}
                                className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                              />
                            </td>

                            {/* Key */}
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={param.key}
                                onChange={(e) => handleUpdateParam(param.id, 'key', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="key"
                              />
                            </td>

                            {/* Value */}
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={param.value}
                                onChange={(e) => handleUpdateParam(param.id, 'value', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="value"
                              />
                            </td>

                            {/* Actions */}
                            <td className="py-2 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`${param.key}=${param.value}`)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                  title="Copy key=value"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParam(param.id)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition"
                                  title="Xóa tham số"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {parsedUrl.error || 'URL không hợp lệ.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
