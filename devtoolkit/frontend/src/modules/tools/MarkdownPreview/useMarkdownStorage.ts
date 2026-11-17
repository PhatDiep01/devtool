import { useState, useEffect, useCallback } from 'react';
import { SavedMarkdownFile, MarkdownStats } from './types';

const STORAGE_KEY = 'devtoolkit_saved_markdown_files_v1';

export function calculateMarkdownStats(text: string): MarkdownStats {
  if (!text) {
    return {
      lines: 0,
      words: 0,
      chars: 0,
      byteSize: 0,
      formattedSize: '0 B'
    };
  }

  const lines = text.split('\n').length;
  // Match words across unicode / vietnamese
  const wordsMatch = text.trim().match(/[\p{L}\p{N}_-]+/gu);
  const words = wordsMatch ? wordsMatch.length : 0;
  const chars = text.length;
  const byteSize = new Blob([text]).size;

  let formattedSize = '0 B';
  if (byteSize < 1024) {
    formattedSize = `${byteSize} B`;
  } else if (byteSize < 1024 * 1024) {
    formattedSize = `${(byteSize / 1024).toFixed(1)} KB`;
  } else {
    formattedSize = `${(byteSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    lines,
    words,
    chars,
    byteSize,
    formattedSize
  };
}

export function sanitizeFileName(name: string): string {
  // Loại bỏ các ký tự cấm trong tên file: \ / : * ? " < > |
  let clean = name.replace(/[\\/:*?"<>|]/g, '').trim();
  if (clean.toLowerCase().endsWith('.md')) {
    clean = clean.slice(0, -3).trim();
  }
  return clean || 'tai-lieu-moi';
}

export function extractFirstH1(content: string): string {
  if (!content) return 'tai-lieu-moi';
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    const raw = match[1].trim();
    // Bỏ formatting như bold/italic trong heading
    const textOnly = raw.replace(/[*_~`]/g, '').trim();
    return sanitizeFileName(textOnly);
  }
  return 'tai-lieu-moi';
}

export function downloadMarkdownFile(fileName: string, content: string) {
  const finalName = fileName.toLowerCase().endsWith('.md') ? fileName : `${fileName}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useMarkdownStorage() {
  const [files, setFiles] = useState<SavedMarkdownFile[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load from local storage
  useEffect(() => {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (Array.isArray(parsed)) {
          setFiles(parsed);
        }
      }
    } catch (e) {
      console.error('Không thể đọc danh sách file Markdown từ LocalStorage', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to local storage
  const persistFiles = useCallback((newFiles: SavedMarkdownFile[]) => {
    setFiles(newFiles);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFiles));
    } catch (e) {
      console.error('Không thể lưu vào LocalStorage:', e);
      throw e;
    }
  }, []);

  const checkNameExists = useCallback((nameToCheck: string, excludeId?: string): boolean => {
    const clean = sanitizeFileName(nameToCheck).toLowerCase();
    return files.some(f => {
      if (excludeId && f.id === excludeId) return false;
      return sanitizeFileName(f.name).toLowerCase() === clean;
    });
  }, [files]);

  const suggestNewName = useCallback((baseName: string): string => {
    const clean = sanitizeFileName(baseName);
    let counter = 1;
    let candidate = `${clean}_${counter}`;
    while (checkNameExists(candidate)) {
      counter++;
      candidate = `${clean}_${counter}`;
    }
    return candidate;
  }, [checkNameExists]);

  const saveFile = useCallback(async (params: {
    id?: string;
    name: string;
    content: string;
    note?: string;
    source: 'upload' | 'manual';
    overwriteExistingId?: string;
  }): Promise<SavedMarkdownFile> => {
    // Giả lập async delay nhẹ để tạo cảm giác xử lý chuyên nghiệp và mượt mà
    await new Promise(res => setTimeout(res, 300));

    const cleanName = sanitizeFileName(params.name);
    const stats = calculateMarkdownStats(params.content);
    const now = new Date().toISOString();

    const existingIndex = files.findIndex(f => 
      (params.overwriteExistingId && f.id === params.overwriteExistingId) ||
      (params.id && f.id === params.id) ||
      sanitizeFileName(f.name).toLowerCase() === cleanName.toLowerCase()
    );

    let updatedFiles: SavedMarkdownFile[];
    let savedRecord: SavedMarkdownFile;

    if (existingIndex >= 0) {
      // Ghi đè file cũ
      savedRecord = {
        ...files[existingIndex],
        name: cleanName,
        content: params.content,
        note: params.note !== undefined ? params.note : files[existingIndex].note,
        sizeBytes: stats.byteSize,
        linesCount: stats.lines,
        wordsCount: stats.words,
        charsCount: stats.chars,
        updatedAt: now
      };
      updatedFiles = [...files];
      updatedFiles[existingIndex] = savedRecord;
    } else {
      // Tạo file mới
      savedRecord = {
        id: params.id || `md_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        content: params.content,
        note: params.note || '',
        sizeBytes: stats.byteSize,
        linesCount: stats.lines,
        wordsCount: stats.words,
        charsCount: stats.chars,
        source: params.source,
        createdAt: now,
        updatedAt: now
      };
      updatedFiles = [savedRecord, ...files];
    }

    persistFiles(updatedFiles);
    return savedRecord;
  }, [files, persistFiles]);

  const renameFile = useCallback((id: string, newName: string): boolean => {
    const clean = sanitizeFileName(newName);
    if (!clean) return false;
    if (checkNameExists(clean, id)) return false;

    const updated = files.map(f => {
      if (f.id === id) {
        return {
          ...f,
          name: clean,
          updatedAt: new Date().toISOString()
        };
      }
      return f;
    });

    persistFiles(updated);
    return true;
  }, [files, checkNameExists, persistFiles]);

  const deleteFile = useCallback((id: string) => {
    const updated = files.filter(f => f.id !== id);
    persistFiles(updated);
  }, [files, persistFiles]);

  return {
    files,
    isLoaded,
    saveFile,
    renameFile,
    deleteFile,
    checkNameExists,
    suggestNewName
  };
}
