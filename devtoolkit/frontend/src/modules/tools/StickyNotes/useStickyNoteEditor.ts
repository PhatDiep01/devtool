import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { stickyNotesApi } from '../../../services/api';
import { StickyNote, StickyNoteColor, ConflictErrorData } from '@/types';
import { SaveStatus } from './types';

interface EditorStats {
  charCount: number;
  wordCount: number;
  lineCount: number;
  byteSize: number;
}

export function useStickyNoteEditor(
  initialNote: StickyNote | null,
  onNoteUpdated: (updatedNote: StickyNote, isNew?: boolean) => void
) {
  const isNewNote = !initialNote?.id || initialNote.id.startsWith('draft_');

  const [title, setTitle] = useState<string>(initialNote?.title || 'New Note');
  const [content, setContent] = useState<string>(initialNote?.content || '');
  const [color, setColor] = useState<StickyNoteColor>(initialNote?.color || 'yellow');
  const [pinned, setPinned] = useState<boolean>(initialNote?.pinned || false);
  const [version, setVersion] = useState<number>(initialNote?.version || 1);
  const [currentId, setCurrentId] = useState<string>(initialNote?.id || '');

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [conflictData, setConflictData] = useState<ConflictErrorData | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState<boolean>(false);

  // Undo / Redo history
  const [history, setHistory] = useState<string[]>([initialNote?.content || '']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isUndoRedoAction = useRef<boolean>(false);

  // Ref to track last saved state
  const lastSavedRef = useRef({
    id: initialNote?.id || '',
    title: initialNote?.title || 'New Note',
    content: initialNote?.content || '',
    color: initialNote?.color || 'yellow',
    pinned: initialNote?.pinned || false,
    version: initialNote?.version || 1
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCloseCallbackRef = useRef<(() => void) | null>(null);

  // Sync state ONLY when switching to a DIFFERENT note ID
  useEffect(() => {
    if (initialNote && initialNote.id !== lastSavedRef.current.id) {
      setTitle(initialNote.title || 'New Note');
      setContent(initialNote.content || '');
      setColor(initialNote.color || 'yellow');
      setPinned(initialNote.pinned || false);
      setVersion(initialNote.version || 1);
      setCurrentId(initialNote.id || '');
      
      lastSavedRef.current = {
        id: initialNote.id || '',
        title: initialNote.title || 'New Note',
        content: initialNote.content || '',
        color: initialNote.color || 'yellow',
        pinned: initialNote.pinned || false,
        version: initialNote.version || 1
      };

      setHistory([initialNote.content || '']);
      setHistoryIndex(0);
      setSaveStatus('idle');
      setConflictData(null);
      setIsConflictModalOpen(false);
      setIsConfirmCloseOpen(false);
    }
  }, [initialNote?.id]);

  // Check dirty state
  const isDirty = useMemo(() => {
    const isCurrentlyDraft = !currentId || currentId.startsWith('draft_');
    const normalizedTitle = (title || '').trim() || 'New Note';
    const lastSavedTitle = (lastSavedRef.current.title || '').trim() || 'New Note';

    // If it's a draft note and user hasn't typed anything meaningful
    if (isCurrentlyDraft && normalizedTitle === 'New Note' && !content.trim()) {
      return false;
    }

    return (
      normalizedTitle !== lastSavedTitle ||
      content !== lastSavedRef.current.content ||
      color !== lastSavedRef.current.color ||
      pinned !== lastSavedRef.current.pinned
    );
  }, [title, content, color, pinned, currentId]);

  // Update saveStatus to 'dirty' when user edits
  useEffect(() => {
    if (isDirty && saveStatus !== 'saving' && saveStatus !== 'conflict') {
      setSaveStatus('dirty');
    } else if (!isDirty && saveStatus === 'dirty') {
      setSaveStatus('idle');
    }
  }, [isDirty, saveStatus]);

  // Browser beforeunload warning if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Bạn có thay đổi chưa lưu trên Sticky Note. Bạn có chắc muốn rời đi?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Compute text statistics
  const stats: EditorStats = useMemo(() => {
    const charCount = content.length;
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length === 1 && words[0] === '' ? 0 : words.length;
    const lineCount = content.length === 0 ? 0 : content.split('\n').length;
    const byteSize = new Blob([content]).size;
    return { charCount, wordCount, lineCount, byteSize };
  }, [content]);

  // Manual Save Action
  const manualSave = useCallback(
    async (forceOverwrite = false): Promise<StickyNote | null> => {
      setSaveStatus('saving');
      const cleanTitle = title.trim() || 'New Note';
      if (!title.trim()) {
        setTitle(cleanTitle);
      }

      const isCurrentDraft = !currentId || currentId.startsWith('draft_');

      try {
        let savedNote: StickyNote;

        if (isCurrentDraft) {
          // CREATE NEW NOTE ON SERVER
          const resp = await stickyNotesApi.create({
            title: cleanTitle,
            content,
            color,
            pinned
          });
          savedNote = resp.data;
          setCurrentId(savedNote.id);
          setVersion(savedNote.version);
          toast.success('Đã lưu ghi chú mới thành công!');
        } else {
          // UPDATE EXISTING NOTE
          const resp = await stickyNotesApi.update(currentId, {
            title: cleanTitle,
            content,
            color,
            pinned,
            expectedVersion: version,
            forceOverwrite
          });
          savedNote = resp.data;
          setVersion(savedNote.version);
          toast.success('Đã lưu các thay đổi!');
        }

        lastSavedRef.current = {
          id: savedNote.id,
          title: savedNote.title || cleanTitle,
          content: savedNote.content,
          color: savedNote.color,
          pinned: savedNote.pinned,
          version: savedNote.version
        };
        setTitle(savedNote.title || cleanTitle);

        setSaveStatus('saved');
        setConflictData(null);
        setIsConflictModalOpen(false);
        onNoteUpdated(savedNote, isCurrentDraft);

        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);

        return savedNote;
      } catch (err: any) {
        if (err.response?.status === 409 && err.response?.data?.conflictData) {
          setSaveStatus('conflict');
          setConflictData(err.response.data.conflictData);
          setIsConflictModalOpen(true);
          toast.error('Phát hiện xung đột: Ghi chú đã bị thay đổi ở một tab hoặc phiên khác!');
        } else {
          setSaveStatus('error');
          console.error('Lỗi lưu ghi chú:', err);
          toast.error(err.response?.data?.error || 'Lỗi khi lưu ghi chú');
        }
        return null;
      }
    },
    [currentId, title, content, color, pinned, version, onNoteUpdated]
  );

  // Content change with Undo/Redo tracking
  const handleContentChange = useCallback((newText: string) => {
    setContent(newText);
    if (!isUndoRedoAction.current) {
      setHistory(prev => {
        const sliced = prev.slice(0, historyIndex + 1);
        if (sliced.length > 50) sliced.shift();
        return [...sliced, newText];
      });
      setHistoryIndex(prev => Math.min(prev + 1, 50));
    }
    isUndoRedoAction.current = false;
  }, [historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevIndex = historyIndex - 1;
      const prevContent = history[prevIndex];
      setHistoryIndex(prevIndex);
      setContent(prevContent);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextIndex = historyIndex + 1;
      const nextContent = history[nextIndex];
      setHistoryIndex(nextIndex);
      setContent(nextContent);
    }
  }, [history, historyIndex]);

  // Smart Inline Formatting (Bold, Italic) - Prevents text jamming like "- Mục danh sách**Test**"
  const insertInlineFormat = useCallback((prefix: string, suffix: string, defaultText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const selectedText = content.substring(start, end);

    let leadingPad = '';
    // If not selected and previous character is a word or non-whitespace, add a space
    if (!hasSelection && start > 0) {
      const prevChar = content[start - 1];
      if (prevChar && !/\s/.test(prevChar)) {
        leadingPad = ' ';
      }
    }

    const textToInsert = hasSelection ? selectedText : defaultText;
    const replacement = `${leadingPad}${prefix}${textToInsert}${suffix}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);

    handleContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      const selectStart = start + leadingPad.length + prefix.length;
      const selectEnd = selectStart + textToInsert.length;
      textarea.setSelectionRange(selectStart, selectEnd);
    }, 10);
  }, [content, handleContentChange]);

  // Smart Block Formatting (H1, H2, H3, List, Checklist) - Always starts on a new line
  const insertBlockFormat = useCallback((prefix: string, defaultText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;

    if (hasSelection) {
      // Multi-line transform: prepend prefix to each selected line
      const selectedText = content.substring(start, end);
      const lines = selectedText.split('\n');
      const transformed = lines.map(line => {
        // Avoid double prefixing
        if (line.startsWith(prefix)) return line;
        return `${prefix}${line}`;
      }).join('\n');

      const newContent = content.substring(0, start) + transformed + content.substring(end);
      handleContentChange(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + transformed.length);
      }, 10);
      return;
    }

    // Single cursor: ensure it begins on a clean new line
    let leadingNewline = '';
    if (start > 0 && content[start - 1] !== '\n') {
      leadingNewline = '\n';
    }

    const replacement = `${leadingNewline}${prefix}${defaultText}\n`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);

    handleContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      const selectStart = start + leadingNewline.length + prefix.length;
      const selectEnd = selectStart + defaultText.length;
      textarea.setSelectionRange(selectStart, selectEnd);
    }, 10);
  }, [content, handleContentChange]);

  const handleFormatBold = () => insertInlineFormat('**', '**', 'chữ đậm');
  const handleFormatItalic = () => insertInlineFormat('*', '*', 'chữ nghiêng');
  const handleFormatHeading = (level: 1 | 2 | 3) => {
    const hashes = '#'.repeat(level) + ' ';
    insertBlockFormat(hashes, `Tiêu đề ${level}`);
  };
  const handleFormatList = () => insertBlockFormat('- ', 'Mục danh sách');
  const handleFormatChecklist = () => insertBlockFormat('- [ ] ', 'Công việc cần làm');

  // Interactive Checklist Toggle (tick/untick)
  const toggleChecklistLine = useCallback((lineIndex: number) => {
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]') || line.includes('- [X]')) {
      lines[lineIndex] = line.replace(/- \[[xX]\]/, '- [ ]');
    }

    handleContentChange(lines.join('\n'));
  }, [content, handleContentChange]);

  // Request Close with Safe Confirm Check
  const requestClose = useCallback((onProceedClose: () => void) => {
    const isCurrentlyDraft = !currentId || currentId.startsWith('draft_');
    const normalizedTitle = (title || '').trim() || 'New Note';

    // 1. If it's a draft note and user made no edits: close immediately without saving or asking!
    if (isCurrentlyDraft && normalizedTitle === 'New Note' && !content.trim()) {
      onProceedClose();
      return;
    }

    // 2. If no unsaved changes: close immediately without confirm popup!
    if (!isDirty) {
      onProceedClose();
      return;
    }

    // 3. Otherwise: show confirm popup modal
    pendingCloseCallbackRef.current = onProceedClose;
    setIsConfirmCloseOpen(true);
  }, [currentId, title, content, isDirty]);

  // Direct "Lưu & Đóng" Action: Saves and immediately closes with NO confirm popup
  const saveAndClose = useCallback(async (onProceedClose: () => void) => {
    const result = await manualSave();
    if (result) {
      setIsConfirmCloseOpen(false);
      onProceedClose();
    }
  }, [manualSave]);

  // Confirm: Save & Close (from inside confirmation dialog)
  const confirmSaveAndClose = useCallback(async () => {
    const result = await manualSave();
    if (result) {
      setIsConfirmCloseOpen(false);
      pendingCloseCallbackRef.current?.();
      pendingCloseCallbackRef.current = null;
    }
  }, [manualSave]);

  // Confirm: Discard & Close
  const confirmDiscardAndClose = useCallback(() => {
    setIsConfirmCloseOpen(false);
    pendingCloseCallbackRef.current?.();
    pendingCloseCallbackRef.current = null;
    toast('Đã hủy các thay đổi chưa lưu', { icon: 'ℹ️' });
  }, []);

  // Confirm: Cancel Close (Keep editing)
  const cancelClose = useCallback(() => {
    setIsConfirmCloseOpen(false);
    pendingCloseCallbackRef.current = null;
  }, []);

  // Conflict Resolution
  const handleResolveConflict = async (action: 'overwrite' | 'reload' | 'save_as_copy') => {
    if (!initialNote?.id || !conflictData) return;

    if (action === 'overwrite') {
      await manualSave(true);
      toast.success('Đã ghi đè thành công phiên bản của bạn lên máy chủ');
    } else if (action === 'reload') {
      setContent(conflictData.currentContent);
      setTitle(conflictData.currentTitle);
      setVersion(conflictData.currentVersion);
      lastSavedRef.current = {
        id: initialNote.id,
        title: conflictData.currentTitle,
        content: conflictData.currentContent,
        color,
        pinned,
        version: conflictData.currentVersion
      };
      setSaveStatus('idle');
      setConflictData(null);
      setIsConflictModalOpen(false);
      toast.success('Đã nạp lại nội dung mới nhất từ máy chủ');
    } else if (action === 'save_as_copy') {
      try {
        const resp = await stickyNotesApi.create({
          title: `${title} (Bản sao)`,
          content,
          color,
          pinned: false
        });
        toast.success(`Đã lưu bản sao mới: "${resp.data.title}"`);
        setContent(conflictData.currentContent);
        setTitle(conflictData.currentTitle);
        setVersion(conflictData.currentVersion);
        setIsConflictModalOpen(false);
      } catch {
        toast.error('Không thể tạo bản sao xung đột');
      }
    }
  };

  return {
    isNewNote,
    title,
    setTitle,
    content,
    setContent: handleContentChange,
    color,
    setColor,
    pinned,
    setPinned,
    version,
    saveStatus,
    isDirty,
    stats,
    textareaRef,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    handleUndo,
    handleRedo,
    handleFormatBold,
    handleFormatItalic,
    handleFormatHeading,
    handleFormatList,
    handleFormatChecklist,
    toggleChecklistLine,
    conflictData,
    isConflictModalOpen,
    setIsConflictModalOpen,
    handleResolveConflict,
    manualSave,
    saveAndClose,
    isConfirmCloseOpen,
    requestClose,
    confirmSaveAndClose,
    confirmDiscardAndClose,
    cancelClose
  };
}
