import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  DiffMode,
  DiffOptions,
  ViewMode,
  CompareResult,
  TextStats,
  DiffHunk
} from './types';
import {
  computeTextStats,
  readTextFileClient,
  formatJsonCanonical,
  sortTextLines,
  copyToClipboard,
  LARGE_PAYLOAD_LINE_THRESHOLD,
  LARGE_PAYLOAD_CHAR_THRESHOLD
} from './text-utils';
import { downloadPatchFile, createTimestampedDiffFilename } from './patch-generator';
import { diffWorkerClient } from './diff-worker-client';

const STORAGE_KEY = 'devtoolkit_compare_text_state_v1';

const DEFAULT_OPTIONS: DiffOptions = {
  ignoreCase: false,
  trimWhitespace: false,
  collapseWhitespace: false,
  ignoreEmptyLines: false,
  normalizeLineEndings: true
};

export interface UseTextCompareReturn {
  // Inputs
  originalText: string;
  setOriginalText: (text: string) => void;
  modifiedText: string;
  setModifiedText: (text: string) => void;

  // Stats
  originalStats: TextStats;
  modifiedStats: TextStats;
  isLargePayload: boolean;

  // Modes & Options
  diffMode: DiffMode;
  setDiffMode: (mode: DiffMode) => void;
  options: DiffOptions;
  setOptions: React.Dispatch<React.SetStateAction<DiffOptions>>;
  updateOption: <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => void;

  // View Options
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  collapseUnchanged: boolean;
  setCollapseUnchanged: (collapse: boolean) => void;
  contextLines: number;
  setContextLines: (lines: number) => void;
  autoCompare: boolean;
  setAutoCompare: (auto: boolean) => void;

  // Processing & Results
  isProcessing: boolean;
  result: CompareResult | null;
  error: string | null;

  // Navigation
  currentDiffIndex: number;
  totalDiffs: number;
  currentDiffHunk: DiffHunk | null;
  goToNextDiff: () => void;
  goToPrevDiff: () => void;
  goToDiff: (index: number) => void;

  // Operations
  executeCompare: () => Promise<void>;
  swapTexts: () => void;
  clearText: (side: 'original' | 'modified' | 'both') => void;
  uploadFile: (side: 'original' | 'modified', file: File) => Promise<void>;

  // Extra Utilities
  formatJson: (side: 'original' | 'modified' | 'both') => void;
  sortLines: (side: 'original' | 'modified' | 'both', order?: 'asc' | 'desc') => void;
  copyUnifiedDiff: () => Promise<boolean>;
  downloadPatch: (extension?: 'diff' | 'patch') => void;
  copyNormalizedText: (side: 'original' | 'modified') => Promise<boolean>;
  resetToDefault: () => void;
}

export function useTextCompare(): UseTextCompareReturn {
  // 1. Initial State from localStorage (if exists)
  const [originalText, setOriginalText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.originalText || '';
      }
    } catch {
      // ignore
    }
    return '';
  });

  const [modifiedText, setModifiedText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.modifiedText || '';
      }
    } catch {
      // ignore
    }
    return '';
  });

  const [diffMode, setDiffMode] = useState<DiffMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).diffMode || 'line';
    } catch {}
    return 'line';
  });

  const [options, setOptions] = useState<DiffOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && JSON.parse(saved).options) {
        return { ...DEFAULT_OPTIONS, ...JSON.parse(saved).options };
      }
    } catch {}
    return DEFAULT_OPTIONS;
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).viewMode || 'side-by-side';
    } catch {}
    return 'side-by-side';
  });

  const [collapseUnchanged, setCollapseUnchanged] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return Boolean(JSON.parse(saved).collapseUnchanged);
    } catch {}
    return false;
  });

  const [contextLines, setContextLines] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && typeof JSON.parse(saved).contextLines === 'number') {
        return JSON.parse(saved).contextLines;
      }
    } catch {}
    return 3;
  });

  const [autoCompare, setAutoCompare] = useState<boolean>(false);

  // 2. Computed Stats
  const originalStats = useMemo(() => computeTextStats(originalText), [originalText]);
  const modifiedStats = useMemo(() => computeTextStats(modifiedText), [modifiedText]);

  const isLargePayload =
    originalStats.lines > LARGE_PAYLOAD_LINE_THRESHOLD ||
    modifiedStats.lines > LARGE_PAYLOAD_LINE_THRESHOLD ||
    originalStats.characters > LARGE_PAYLOAD_CHAR_THRESHOLD ||
    modifiedStats.characters > LARGE_PAYLOAD_CHAR_THRESHOLD;

  // 3. Processing and Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(-1);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Persistence to localStorage
  useEffect(() => {
    try {
      // Do not save texts > 500KB to localStorage to avoid quota exceeded
      const shouldSaveText = originalText.length < 500_000 && modifiedText.length < 500_000;
      const stateToPersist = {
        originalText: shouldSaveText ? originalText : '',
        modifiedText: shouldSaveText ? modifiedText : '',
        diffMode,
        options,
        viewMode,
        collapseUnchanged,
        contextLines,
        autoCompare
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // quota or private mode ignore
    }
  }, [originalText, modifiedText, diffMode, options, viewMode, collapseUnchanged, contextLines, autoCompare]);

  // 5. Compare Execution Runner
  const runCompare = useCallback(async () => {
    // If both empty, create quick instant empty result
    if (!originalText && !modifiedText) {
      setResult({
        isIdentical: false,
        isBothEmpty: true,
        isOriginalEmpty: false,
        isModifiedEmpty: false,
        stats: {
          addedLines: 0,
          removedLines: 0,
          modifiedLines: 0,
          unchangedLines: 0,
          totalDiffHunks: 0,
          similarityPercentage: 100
        },
        sideBySideRows: [],
        unifiedRows: [],
        hunks: [],
        unifiedDiffText: '',
        normalizedOriginal: '',
        normalizedModified: '',
        executionTimeMs: 0
      });
      setCurrentDiffIndex(-1);
      setError(null);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await diffWorkerClient.calculateDiff({
        originalText,
        modifiedText,
        diffMode,
        options,
        collapseUnchanged,
        contextLines
      });

      setResult(res);
      if (res.hunks.length > 0) {
        setCurrentDiffIndex(0);
      } else {
        setCurrentDiffIndex(-1);
      }
    } catch (err) {
      setError((err as Error).message || 'Có lỗi xảy ra khi so sánh văn bản.');
      toast.error(`Lỗi so sánh: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [originalText, modifiedText, diffMode, options, collapseUnchanged, contextLines]);

  // Only re-calculate if result already exists and options/collapse changed (NOT on text input)
  useEffect(() => {
    if (!result) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runCompare();
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [diffMode, options, collapseUnchanged, contextLines]);

  // Warning when text exceeds large payload threshold
  const hasWarnedLargeRef = useRef(false);
  useEffect(() => {
    if (isLargePayload && autoCompare && !hasWarnedLargeRef.current) {
      hasWarnedLargeRef.current = true;
      toast('Văn bản có kích thước lớn (>10.000 dòng). Đã tự động tắt tự động so sánh, vui lòng nhấn nút "So sánh" khi hoàn tất chỉnh sửa.', {
        icon: '⚠️',
        duration: 6000
      });
      setAutoCompare(false);
    } else if (!isLargePayload) {
      hasWarnedLargeRef.current = false;
    }
  }, [isLargePayload, autoCompare]);

  // 7. Navigation between diff hunks
  const totalDiffs = result?.hunks?.length || 0;
  const currentDiffHunk =
    result && result.hunks && currentDiffIndex >= 0 && currentDiffIndex < result.hunks.length
      ? result.hunks[currentDiffIndex]
      : null;

  const goToNextDiff = useCallback(() => {
    if (totalDiffs === 0) return;
    setCurrentDiffIndex((prev) => (prev + 1 >= totalDiffs ? 0 : prev + 1));
  }, [totalDiffs]);

  const goToPrevDiff = useCallback(() => {
    if (totalDiffs === 0) return;
    setCurrentDiffIndex((prev) => (prev - 1 < 0 ? totalDiffs - 1 : prev - 1));
  }, [totalDiffs]);

  const goToDiff = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalDiffs) {
        setCurrentDiffIndex(index);
      }
    },
    [totalDiffs]
  );

  // 8. User Actions
  const updateOption = useCallback(<K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const swapTexts = useCallback(() => {
    setOriginalText(modifiedText);
    setModifiedText(originalText);
    toast.success('Đã hoán đổi vị trí hai văn bản.');
  }, [originalText, modifiedText]);

  const clearText = useCallback((side: 'original' | 'modified' | 'both') => {
    if (side === 'original' || side === 'both') {
      setOriginalText('');
    }
    if (side === 'modified' || side === 'both') {
      setModifiedText('');
    }
    toast.success(
      side === 'both'
        ? 'Đã xóa nội dung cả hai bên.'
        : side === 'original'
        ? 'Đã xóa văn bản gốc.'
        : 'Đã xóa văn bản so sánh.'
    );
  }, []);

  const uploadFile = useCallback(async (side: 'original' | 'modified', file: File) => {
    try {
      const read = await readTextFileClient(file);
      if (side === 'original') {
        setOriginalText(read.content);
      } else {
        setModifiedText(read.content);
      }
      toast.success(`Đã tải file "${read.filename}" (${(read.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  const formatJson = useCallback((side: 'original' | 'modified' | 'both') => {
    try {
      if (side === 'original' || side === 'both') {
        setOriginalText((prev) => formatJsonCanonical(prev));
      }
      if (side === 'modified' || side === 'both') {
        setModifiedText((prev) => formatJsonCanonical(prev));
      }
      toast.success('Đã chuẩn hóa và sắp xếp các key JSON.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  const sortLines = useCallback((side: 'original' | 'modified' | 'both', order: 'asc' | 'desc' = 'asc') => {
    if (side === 'original' || side === 'both') {
      setOriginalText((prev) => sortTextLines(prev, order));
    }
    if (side === 'modified' || side === 'both') {
      setModifiedText((prev) => sortTextLines(prev, order));
    }
    toast.success(`Đã sắp xếp các dòng theo thứ tự ${order === 'asc' ? 'A -> Z' : 'Z -> A'}.`);
  }, []);

  const copyUnifiedDiff = useCallback(async (): Promise<boolean> => {
    if (!result?.unifiedDiffText) {
      toast.error('Không có nội dung diff để sao chép.');
      return false;
    }
    const ok = await copyToClipboard(result.unifiedDiffText);
    if (ok) {
      toast.success('Đã sao chép unified diff vào clipboard.');
    } else {
      toast.error('Không thể sao chép vào clipboard.');
    }
    return ok;
  }, [result]);

  const downloadPatch = useCallback((extension: 'diff' | 'patch' = 'patch') => {
    if (!result?.unifiedDiffText) {
      toast.error('Không có nội dung diff để tải xuống.');
      return;
    }
    const filename = createTimestampedDiffFilename(extension);
    downloadPatchFile(result.unifiedDiffText, filename);
    toast.success(`Đã tải tệp ${filename}`);
  }, [result]);

  const copyNormalizedText = useCallback(async (side: 'original' | 'modified'): Promise<boolean> => {
    const textToCopy = side === 'original' ? result?.normalizedOriginal : result?.normalizedModified;
    if (textToCopy === undefined) {
      toast.error('Chưa có nội dung văn bản chuẩn hóa.');
      return false;
    }
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      toast.success(`Đã sao chép văn bản ${side === 'original' ? 'gốc' : 'so sánh'} đã chuẩn hóa.`);
    } else {
      toast.error('Không thể sao chép vào clipboard.');
    }
    return ok;
  }, [result]);

  const resetToDefault = useCallback(() => {
    setOptions(DEFAULT_OPTIONS);
    setDiffMode('line');
    setViewMode('side-by-side');
    setCollapseUnchanged(false);
    setContextLines(3);
    setAutoCompare(true);
    toast.success('Đã khôi phục các tùy chọn so sánh về mặc định.');
  }, []);

  return {
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
    setOptions,
    updateOption,
    viewMode,
    setViewMode,
    collapseUnchanged,
    setCollapseUnchanged,
    contextLines,
    setContextLines,
    autoCompare,
    setAutoCompare,
    isProcessing,
    result,
    error,
    currentDiffIndex,
    totalDiffs,
    currentDiffHunk,
    goToNextDiff,
    goToPrevDiff,
    goToDiff,
    executeCompare: runCompare,
    swapTexts,
    clearText,
    uploadFile,
    formatJson,
    sortLines,
    copyUnifiedDiff,
    downloadPatch,
    copyNormalizedText,
    resetToDefault
  };
}
