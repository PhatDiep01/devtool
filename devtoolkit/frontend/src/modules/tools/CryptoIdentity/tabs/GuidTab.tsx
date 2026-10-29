import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Fingerprint,
  Copy,
  Check,
  RefreshCw,
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Search,
  Clock,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  generateGuidBatch,
  formatSingleGuid,
  inspectGuid
} from '../engine/guid';
import { GuidOptions, GuidVersion, GuidCase, GuidDelimiter, GuidInspection } from '../types';

interface GuidTabProps {
  options: GuidOptions;
  onUpdateOptions: (opts: Partial<GuidOptions>) => void;
}

export const GuidTab: React.FC<GuidTabProps> = ({ options, onUpdateOptions }) => {
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [formattedResultText, setFormattedResultText] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Inspector state
  const [inspectInput, setInspectInput] = useState<string>('');
  const inspectionResult: GuidInspection = useMemo(() => {
    return inspectGuid(inspectInput);
  }, [inspectInput]);

  // Generate batch
  const handleGenerate = useCallback(() => {
    const { rawList, formattedText } = generateGuidBatch(options);
    setGeneratedList(rawList);
    setFormattedResultText(formattedText);
  }, [options]);

  // Run on mount or when options change
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Copy single GUID
  const handleCopySingle = async (guid: string, index: number) => {
    const formatted = formatSingleGuid(guid, {
      casing: options.casing,
      hyphens: options.hyphens,
      braces: options.braces,
      quotes: options.quotes
    });

    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedIndex(index);
      toast.success('Đã sao chép 1 GUID!');
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Copy All
  const handleCopyAll = async () => {
    if (!formattedResultText) return;
    try {
      await navigator.clipboard.writeText(formattedResultText);
      setCopiedAll(true);
      toast.success(`Đã sao chép toàn bộ ${generatedList.length} GUID!`);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Download .txt
  const handleDownloadTxt = () => {
    if (!formattedResultText) return;
    const blob = new Blob([formattedResultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guid_list_${options.version}_${generatedList.length}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file .txt');
  };

  // Quick Preset Applier
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'csharp':
        onUpdateOptions({
          casing: 'upper',
          hyphens: true,
          braces: true,
          quotes: 'none',
          delimiter: 'newline'
        });
        toast.success('Đã áp dụng mẫu: C# / SQL Server {GUID}');
        break;
      case 'standard':
        onUpdateOptions({
          casing: 'lower',
          hyphens: true,
          braces: false,
          quotes: 'none',
          delimiter: 'newline'
        });
        toast.success('Đã áp dụng mẫu: Standard Lowercase');
        break;
      case 'raw':
        onUpdateOptions({
          casing: 'lower',
          hyphens: false,
          braces: false,
          quotes: 'none',
          delimiter: 'newline'
        });
        toast.success('Đã áp dụng mẫu: Raw Hex 32 ký tự');
        break;
      case 'sql_in':
        onUpdateOptions({
          casing: 'lower',
          hyphens: true,
          braces: false,
          quotes: 'single',
          delimiter: 'sql_in'
        });
        toast.success('Đã áp dụng mẫu: SQL IN Array');
        break;
      case 'json':
        onUpdateOptions({
          casing: 'lower',
          hyphens: true,
          braces: false,
          quotes: 'none',
          delimiter: 'json_array'
        });
        toast.success('Đã áp dụng mẫu: JSON Array');
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Configuration Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          {/* Version Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-primary" />
              Phiên bản:
            </span>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => onUpdateOptions({ version: 'v4' })}
                className={`px-3 py-1 rounded-lg transition ${
                  options.version === 'v4' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                UUID v4 (Ngẫu nhiên)
              </button>
              <button
                type="button"
                onClick={() => onUpdateOptions({ version: 'v7' })}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  options.version === 'v7' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                <span>UUID v7 (Thời gian + Sắp xếp)</span>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-bold">
                  Khuyên dùng DB
                </span>
              </button>
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground">Số lượng:</span>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.min(100, options.count)}
              onChange={(e) => onUpdateOptions({ count: Number(e.target.value) })}
              className="w-24 sm:w-32 accent-primary cursor-pointer"
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={options.count}
              onChange={(e) => onUpdateOptions({ count: Math.min(1000, Math.max(1, Number(e.target.value))) })}
              className="w-16 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg bg-muted/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo lại</span>
            </button>
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Đã copy tất cả' : 'Copy tất cả'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="p-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs transition"
              title="Tải về danh sách file .txt"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Format Presets & Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-muted-foreground mr-1">Mẫu nhanh:</span>
            <button
              type="button"
              onClick={() => applyPreset('standard')}
              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted font-medium text-foreground transition"
            >
              Chuẩn (lower)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('csharp')}
              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted font-medium text-foreground transition"
            >
              C# / SQL {'{GUID}'}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('raw')}
              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted font-medium text-foreground transition"
            >
              Raw (Không gạch)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('sql_in')}
              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted font-medium text-foreground transition"
            >
              SQL IN Array
            </button>
            <button
              type="button"
              onClick={() => applyPreset('json')}
              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted font-medium text-foreground transition"
            >
              JSON Array
            </button>
          </div>

          {/* Granular Toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={options.casing === 'upper'}
                onChange={(e) => onUpdateOptions({ casing: e.target.checked ? 'upper' : 'lower' })}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
              />
              <span>Chữ HOA</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={options.hyphens}
                onChange={(e) => onUpdateOptions({ hyphens: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
              />
              <span>Gạch ngang (-)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
              <input
                type="checkbox"
                checked={options.braces}
                onChange={(e) => onUpdateOptions({ braces: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary accent-primary"
              />
              <span>Ngoặc nhọn {'{}'}</span>
            </label>

            {/* Delimiter Selector */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Phân cách:</span>
              <select
                value={options.delimiter}
                onChange={(e) => onUpdateOptions({ delimiter: e.target.value as GuidDelimiter })}
                className="px-2 py-1 rounded-lg bg-muted/40 border border-border text-xs text-foreground focus:outline-none"
              >
                <option value="newline">Xuống dòng (\n)</option>
                <option value="comma">Dấu phẩy (,)</option>
                <option value="comma_space">Dấu phẩy cách (, )</option>
                <option value="comma_newline">Phẩy xuống dòng (,\n)</option>
                <option value="sql_in">SQL IN ('..')</option>
                <option value="json_array">JSON Array</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* UUID v7 Educational Notice */}
      {options.version === 'v7' && (
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <strong>Tại sao nên dùng UUID v7?</strong> RFC 9562 nhúng 48-bit timestamp vào đầu chuỗi UUID, giúp các bản ghi được <strong>sắp xếp tuần tự theo thời gian tạo</strong>. Khi dùng làm Khóa chính (Primary Key) trong PostgreSQL, MySQL, SQL Server, UUID v7 ngăn ngừa phân mảnh chỉ mục (B-Tree page fragmentation), tối ưu tốc độ INSERT gấp nhiều lần so với UUID v4 ngẫu nhiên truyền thống.
          </div>
        </div>
      )}

      {/* Results Display Area */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Danh sách GUID đã tạo ({generatedList.length})</span>
            <span className="text-[11px] text-muted-foreground font-normal ml-2">
              (Bấm vào bất kỳ dòng nào để copy tức thì)
            </span>
          </span>
          <button
            type="button"
            onClick={() => handleCopySingle(generatedList[0], 0)}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Copy GUID đầu tiên
          </button>
        </div>

        <div className="p-3 max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
          {generatedList.map((guid, idx) => {
            const formatted = formatSingleGuid(guid, {
              casing: options.casing,
              hyphens: options.hyphens,
              braces: options.braces,
              quotes: options.quotes
            });

            return (
              <div
                key={`${guid}_${idx}`}
                onClick={() => handleCopySingle(guid, idx)}
                className="group flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-muted/40 cursor-pointer transition select-all"
                title="Bấm để sao chép"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground w-6 text-right select-none font-sans">
                    {idx + 1}.
                  </span>
                  <span className="text-foreground group-hover:text-primary transition">
                    {formatted}
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
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* GUID INSPECTOR / VALIDATOR */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Search className="w-4 h-4 text-primary" />
            <span>Kiểm tra & Phân tích GUID/UUID (Inspector):</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            Dán một chuỗi bất kỳ để xác định tính hợp lệ, phiên bản và thời gian nhúng
          </span>
        </div>

        <input
          type="text"
          value={inspectInput}
          onChange={(e) => setInspectInput(e.target.value)}
          placeholder="Dán chuỗi GUID/UUID cần kiểm tra (ví dụ: 018e6e58-3d12-7abc-89ef-0123456789ab)..."
          className="w-full px-3 py-2 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />

        {inspectInput.trim() && (
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/80 text-xs space-y-2">
            {inspectionResult.isValid ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Chuỗi GUID / UUID HỢP LỆ!</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Phiên bản (Version):</span>
                    <strong className="text-foreground">{inspectionResult.versionName}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Biến thể (Variant):</span>
                    <strong className="text-foreground">{inspectionResult.variant}</strong>
                  </div>
                  {inspectionResult.timestampIso && (
                    <div>
                      <span className="text-muted-foreground text-[11px] block flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Thời điểm được nhúng (v7):
                      </span>
                      <strong className="text-primary">{inspectionResult.timestampIso}</strong>
                      <span className="text-muted-foreground ml-1">({inspectionResult.timestampRelative})</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{inspectionResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
