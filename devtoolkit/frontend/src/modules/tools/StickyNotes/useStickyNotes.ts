import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { stickyNotesApi } from '../../../services/api';
import { 
  StickyNote, 
  StickyNoteColor, 
  StickyNoteSortBy, 
  StickyNoteSortOrder, 
  StickyNoteCreatePayload,
  StickyNoteUpdatePayload 
} from '@/types';

export function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [trashNotes, setTrashNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [trashLoading, setTrashLoading] = useState<boolean>(false);
  const [corruptedCount, setCorruptedCount] = useState<number>(0);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<StickyNoteSortBy>('updated_at');
  const [sortOrder, setSortOrder] = useState<StickyNoteSortOrder>('desc');

  // Active / Editing Note Modal State
  const [activeNote, setActiveNote] = useState<StickyNote | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Trash Modal State
  const [isTrashOpen, setIsTrashOpen] = useState<boolean>(false);

  // Delete Confirmation State
  const [noteToDelete, setNoteToDelete] = useState<StickyNote | null>(null);

  // Fetch active notes
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await stickyNotesApi.getAll({
        search: search.trim() || undefined,
        color: colorFilter !== 'all' ? colorFilter : undefined,
        sortBy,
        sortOrder
      });
      setNotes(resp.data.notes || []);
      setCorruptedCount(resp.data.corruptedCount || 0);
    } catch (err: any) {
      console.error('Lỗi nạp danh sách ghi chú:', err);
      toast.error(err.response?.data?.error || 'Không thể tải danh sách ghi chú');
    } finally {
      setLoading(false);
    }
  }, [search, colorFilter, sortBy, sortOrder]);

  // Fetch trash notes
  const fetchTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const resp = await stickyNotesApi.getTrash();
      setTrashNotes(resp.data.notes || []);
    } catch (err: any) {
      console.error('Lỗi nạp thùng rác:', err);
      toast.error('Không thể tải danh sách thùng rác');
    } finally {
      setTrashLoading(false);
    }
  }, []);

  // Initial & Dependency Fetch
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Create new note (in-memory draft, only saved to disk when user explicitly saves)
  const handleCreateNote = () => {
    const draftNote: StickyNote = {
      id: `draft_${Date.now()}`,
      title: 'New Note',
      content: '',
      color: 'yellow',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      preview: '',
      filename: '',
      size_bytes: 0
    };
    setActiveNote(draftNote);
    setIsEditorOpen(true);
    return draftNote;
  };

  // Toggle Pin
  const handleTogglePin = async (note: StickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const resp = await stickyNotesApi.update(note.id, {
        pinned: !note.pinned,
        expectedVersion: note.version
      });
      const updated = resp.data;
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      if (activeNote?.id === updated.id) {
        setActiveNote(updated);
      }
      toast.success(updated.pinned ? 'Đã ghim ghi chú lên đầu' : 'Đã bỏ ghim ghi chú');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể cập nhật trạng thái ghim');
      fetchNotes();
    }
  };

  // Quick Change Color
  const handleChangeColor = async (note: StickyNote, color: StickyNoteColor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const resp = await stickyNotesApi.update(note.id, {
        color,
        expectedVersion: note.version
      });
      const updated = resp.data;
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      if (activeNote?.id === updated.id) {
        setActiveNote(updated);
      }
      toast.success('Đã đổi màu ghi chú');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể đổi màu');
      fetchNotes();
    }
  };

  // Duplicate Note
  const handleDuplicateNote = async (note: StickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const resp = await stickyNotesApi.duplicate(note.id);
      const duplicated = resp.data;
      setNotes(prev => [duplicated, ...prev]);
      toast.success(`Đã nhân bản ghi chú: "${duplicated.title}"`);
      return duplicated;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể nhân bản ghi chú');
    }
  };

  // Confirm and Move to Trash
  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await stickyNotesApi.moveToTrash(noteToDelete.id);
      setNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
      if (activeNote?.id === noteToDelete.id) {
        setIsEditorOpen(false);
        setActiveNote(null);
      }
      toast.success(`Đã chuyển "${noteToDelete.title}" vào thùng rác`);
      setNoteToDelete(null);
      // Refresh trash in background if trash modal is open
      if (isTrashOpen) fetchTrash();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể xóa ghi chú');
    }
  };

  // Restore from Trash
  const handleRestoreNote = async (id: string) => {
    try {
      const resp = await stickyNotesApi.restoreFromTrash(id);
      const restored = resp.data;
      setTrashNotes(prev => prev.filter(n => n.id !== id));
      setNotes(prev => [restored, ...prev]);
      toast.success(`Đã khôi phục ghi chú: "${restored.title}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể khôi phục ghi chú');
    }
  };

  // Permanently Delete from Trash
  const handlePermanentDelete = async (id: string) => {
    try {
      await stickyNotesApi.permanentlyDelete(id);
      setTrashNotes(prev => prev.filter(n => n.id !== id));
      toast.success('Đã xóa vĩnh viễn ghi chú');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể xóa vĩnh viễn ghi chú');
    }
  };

  // Empty Entire Trash
  const handleEmptyTrash = async () => {
    try {
      const resp = await stickyNotesApi.emptyTrash();
      setTrashNotes([]);
      toast.success(resp.data.message || 'Đã dọn sạch thùng rác');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể làm rỗng thùng rác');
    }
  };

  // Import .txt file from client machine
  const handleImportFile = async (file: File) => {
    if (!file.name.endsWith('.txt')) {
      toast.error('Hệ thống chỉ hỗ trợ nhập file định dạng .txt');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await stickyNotesApi.importNote(formData);
      const imported = resp.data;
      setNotes(prev => [imported, ...prev]);
      setActiveNote(imported);
      setIsEditorOpen(true);
      toast.success(`Đã nhập thành công: "${imported.title}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể nhập file .txt');
    }
  };

  // Quick Copy Content
  const handleCopyContent = async (note: StickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.content);
      toast.success('Đã sao chép nội dung vào clipboard');
    } catch (err) {
      toast.error('Không thể truy cập clipboard');
    }
  };

  // Download / Export Note as .txt
  const handleExportNote = (note: StickyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const downloadUrl = stickyNotesApi.getExportUrl(note.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${note.title}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đang tải file .txt về máy');
  };

  return {
    notes,
    setNotes,
    trashNotes,
    loading,
    trashLoading,
    corruptedCount,
    search,
    setSearch,
    colorFilter,
    setColorFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeNote,
    setActiveNote,
    isEditorOpen,
    setIsEditorOpen,
    isTrashOpen,
    setIsTrashOpen,
    noteToDelete,
    setNoteToDelete,
    fetchNotes,
    fetchTrash,
    handleCreateNote,
    handleTogglePin,
    handleChangeColor,
    handleDuplicateNote,
    handleConfirmDelete,
    handleRestoreNote,
    handlePermanentDelete,
    handleEmptyTrash,
    handleImportFile,
    handleCopyContent,
    handleExportNote
  };
}
