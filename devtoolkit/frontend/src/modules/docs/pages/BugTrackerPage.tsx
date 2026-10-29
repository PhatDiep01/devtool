import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bug, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Check, 
  ArrowRight, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Paperclip, 
  Download, 
  ZoomIn, 
  FileText, 
  FileSpreadsheet, 
  File as FileIcon,
  Eye, 
  RefreshCw, 
  LayoutGrid, 
  List,
  Sparkles,
  Link as LinkIcon,
  User,
  ShieldAlert,
  ClipboardPaste,
  Code,
  Copy,
  Terminal,
  FileCode,
  ListOrdered
} from 'lucide-react';
import { bugsApi, bugAnnotationsApi, resolveApiUrl } from '../../../services/api';
import { BugItem, BugStats, BugType, BugStatus, BugSeverity, BugAttachment, AnnotationItem } from '../../../types';
import { SearchableSelect, SelectOption, ConfirmModal } from '../../../components/ui';
import toast from 'react-hot-toast';
import { AnnotationModal, AnnotationOverlayView } from '../components/BugAnnotation';
import { generateMarkdownSummary } from '../components/BugAnnotation/mathUtils';
import { getAnnotationTypeName } from '../components/BugAnnotation/constants';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useSearchParams } from 'react-router-dom';

const KANBAN_COLUMNS: { id: BugStatus; label: string; dotColor: string }[] = [
  { id: 'todo', label: 'Chưa Fix', dotColor: 'bg-amber-500' },
  { id: 'in_progress', label: 'Đang Fix', dotColor: 'bg-blue-500 animate-pulse' },
  { id: 'resolved', label: 'Đã Fix', dotColor: 'bg-emerald-500' }
];

const statusFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'todo', label: 'Chưa fix (Todo)', badge: 'Todo', badgeColor: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'Đang fix (In Progress)', badge: 'In Progress', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { value: 'resolved', label: 'Đã fix (Resolved)', badge: 'Resolved', badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
];

const typeFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'FE', label: 'Frontend (FE)', badge: 'FE', badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  { value: 'BE', label: 'Backend (BE)', badge: 'BE', badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
];

const severityFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Mọi mức độ' },
  { value: 'critical', label: 'Khẩn cấp', badge: 'Critical', badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { value: 'high', label: 'Cao', badge: 'High', badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'Trung bình', badge: 'Medium', badgeColor: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  { value: 'low', label: 'Thấp', badge: 'Low', badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
];

const annotationFilterOptions: SelectOption<string>[] = [
  { value: 'all', label: 'Tất cả bug (Đánh dấu)' },
  { value: 'yes', label: 'Có ảnh đánh dấu', badge: 'Có đánh dấu', badgeColor: 'bg-primary/15 text-primary' },
  { value: 'no', label: 'Chưa đánh dấu', badge: 'Chưa đánh dấu', badgeColor: 'bg-muted text-muted-foreground' },
];

const formStatusOptions: SelectOption<BugStatus>[] = [
  { value: 'todo', label: 'Chưa fix (Todo)' },
  { value: 'in_progress', label: 'Đang fix (In Progress)' },
  { value: 'resolved', label: 'Đã fix (Resolved)' },
];

const formSeverityOptions: SelectOption<BugSeverity>[] = [
  { value: 'critical', label: 'Khẩn cấp (Critical)', badge: 'Critical', badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { value: 'high', label: 'Cao (High)', badge: 'High', badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'Trung bình (Medium)', badge: 'Medium', badgeColor: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  { value: 'low', label: 'Thấp (Low)', badge: 'Low', badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
];

export interface FormAttachmentItem {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  url?: string;
  filename?: string;
  file?: File;
  previewUrl?: string;
  isPending?: boolean;
  annotations?: AnnotationItem[];
}

export const BugTrackerPage: React.FC = () => {
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [stats, setStats] = useState<BugStats>({
    total: 0,
    todo: 0,
    in_progress: 0,
    resolved: 0,
    fe_count: 0,
    be_count: 0,
    both_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [annotationFilter, setAnnotationFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<BugItem | null>(null);
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null);

  // Delete bug confirmation modal state
  const [bugToDelete, setBugToDelete] = useState<BugItem | null>(null);
  const [isDeletingBug, setIsDeletingBug] = useState(false);

  // Status transition confirmation modal state
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    bugId: number;
    bugTitle?: string;
    fromStatus: BugStatus;
    toStatus: BugStatus;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Unsaved changes confirmation modal state
  const [showUnsavedConfirmModal, setShowUnsavedConfirmModal] = useState(false);

  // Bug Annotation Modal state
  const [annotationModalState, setAnnotationModalState] = useState<{
    isOpen: boolean;
    bug: BugItem | null;
    imageId?: string;
    isFormDraft?: boolean;
    customImages?: Array<{
      id: string;
      url: string;
      originalName: string;
      annotations?: AnnotationItem[];
      isPending?: boolean;
    }>;
  }>({
    isOpen: false,
    bug: null,
  });

  // Image preview lightbox & Annotation viewer
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    imageId?: string;
    bug?: BugItem | null;
    annotations?: AnnotationItem[];
  } | null>(null);
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const handleCopyMarkdownForPreview = (title: string, annotations: AnnotationItem[]) => {
    if (annotations.length === 0) return;
    const md = generateMarkdownSummary(title, undefined, title, annotations);
    navigator.clipboard.writeText(md)
      .then(() => toast.success('Đã sao chép bảng ghi chú vào Clipboard'))
      .catch(() => toast.error('Không thể sao chép bảng ghi chú'));
  };

  // Form inputs
  const [formTitle, setFormTitle] = useState('');
  const [formUsKey, setFormUsKey] = useState('');
  const [formUsLink, setFormUsLink] = useState('');
  const [formType, setFormType] = useState<BugType>('FE');
  const [formStatus, setFormStatus] = useState<BugStatus>('todo');
  const [formSeverity, setFormSeverity] = useState<BugSeverity>('medium');
  const [formDescription, setFormDescription] = useState('');
  const [formPayload, setFormPayload] = useState('');
  const [isPayloadCopied, setIsPayloadCopied] = useState(false);
  const [formFixSolution, setFormFixSolution] = useState('');
  const [formCreatedBy, setFormCreatedBy] = useState('QA/QC');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formAttachments, setFormAttachments] = useState<FormAttachmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  // Listen to searchParams (e.g. from global search command palette)
  useEffect(() => {
    const bugId = searchParams.get('bugId');
    if (bugId) {
      bugsApi.getById(Number(bugId)).then(res => {
        if (res.data) {
          setSelectedBug(res.data);
          setIsDetailModalOpen(true);
        }
      }).catch(() => {});
    }
    const q = searchParams.get('search') || searchParams.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    loadBugs();
  }, [statusFilter, typeFilter, severityFilter, annotationFilter]);

  // Prevent background scroll when any modal or lightbox is open
  useEffect(() => {
    if (isFormModalOpen || isDetailModalOpen || previewImage || annotationModalState.isOpen || bugToDelete || showUnsavedConfirmModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFormModalOpen, isDetailModalOpen, !!previewImage, annotationModalState.isOpen, !!bugToDelete, showUnsavedConfirmModal]);

  const loadBugs = async () => {
    setLoading(true);
    try {
      const res = await bugsApi.getAll({
        search: searchQuery,
        status: statusFilter,
        type: typeFilter,
        severity: severityFilter,
        has_annotations: annotationFilter !== 'all' ? annotationFilter : undefined
      });
      const loadedBugs = Array.isArray(res.data?.bugs) ? res.data.bugs : [];
      setBugs(loadedBugs);
      setSelectedBug(prev => prev ? (loadedBugs.find(b => b.id === prev.id) || prev) : null);
      setStats(res.data?.stats || {
        total: 0,
        todo: 0,
        in_progress: 0,
        resolved: 0,
        fe_count: 0,
        be_count: 0,
        both_count: 0,
        annotated_count: 0
      });
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách bug');
      setBugs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBugReportMarkdown = (bug: BugItem) => {
    let md = `# [BUG #${bug.id}] ${bug.title}\n\n`;
    md += `- **Mã US:** ${bug.us_key || 'Không có'}\n`;
    if (bug.us_link) md += `- **Link US:** ${bug.us_link}\n`;
    md += `- **Loại:** ${bug.type} | **Mức độ:** ${bug.severity} | **Trạng thái:** ${getStatusLabel(bug.status)}\n`;
    md += `- **Người tạo:** ${bug.created_by || 'QA/QC'} | **Phụ trách:** ${bug.assigned_to || 'Chưa gán'}\n\n`;
    md += `## Mô tả lỗi & Các bước tái hiện\n${bug.description || '_Không có mô tả_'}\n\n`;
    if (bug.payload) {
      md += `## Dữ liệu / Payload tái hiện lỗi\n\`\`\`json\n${bug.payload}\n\`\`\`\n\n`;
    }
    if (bug.fix_solution) {
      md += `## Hướng dẫn / Giải pháp fix\n${bug.fix_solution}\n\n`;
    }
    const images = (bug.attachments || []).filter(a => a.isImage);
    if (images.length > 0) {
      md += `## Hình ảnh đính kèm & Điểm đánh dấu (${images.length})\n\n`;
      for (const img of images) {
        const imgKey = img.id || img.filename;
        const imgAnnotations = bug.annotations?.[imgKey]?.annotations || [];
        md += generateMarkdownSummary(bug.title, bug.us_key, img.originalName, imgAnnotations) + '\n\n';
      }
    }
    navigator.clipboard.writeText(md)
      .then(() => toast.success('Đã sao chép toàn bộ báo cáo Markdown kèm bảng đánh dấu!'))
      .catch(() => toast.error('Không thể sao chép Markdown'));
  };

  const handlePayloadKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const spaces = '  ';
      target.value = val.substring(0, start) + spaces + val.substring(end);
      target.selectionStart = target.selectionEnd = start + spaces.length;
      setFormPayload(target.value);
    }
  };

  const handleFormatPayloadJson = () => {
    if (!formPayload.trim()) return;
    try {
      const parsed = JSON.parse(formPayload.trim());
      setFormPayload(JSON.stringify(parsed, null, 2));
      toast.success('Đã định dạng JSON!');
    } catch {
      toast.error('Nội dung không phải cú pháp JSON hợp lệ');
    }
  };

  const handleCopyFormPayload = () => {
    if (!formPayload) return;
    navigator.clipboard.writeText(formPayload);
    setIsPayloadCopied(true);
    toast.success('Đã sao chép payload!');
    setTimeout(() => setIsPayloadCopied(false), 2000);
  };

  const safeBugs = useMemo(() => Array.isArray(bugs) ? bugs : [], [bugs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadBugs();
  };

  const closeFormModal = () => {
    // Revoke any temporary object URLs created for preview
    formAttachments.forEach(att => {
      if (att.isPending && att.previewUrl) {
        try { URL.revokeObjectURL(att.previewUrl); } catch {}
      }
    });
    setFormAttachments([]);
    setEditingBug(null);
    setShowUnsavedConfirmModal(false);
    setIsFormModalOpen(false);
  };

  // Determine if form has unsaved modifications
  const isFormDirty = useMemo(() => {
    if (!isFormModalOpen) return false;

    if (!editingBug) {
      // In create mode: dirty if user entered any content or attached any file
      return Boolean(
        formTitle.trim() ||
        formUsKey.trim() ||
        formUsLink.trim() ||
        formDescription.trim() ||
        formPayload.trim() ||
        formFixSolution.trim() ||
        formAssignedTo.trim() ||
        formType !== 'FE' ||
        formStatus !== 'todo' ||
        formSeverity !== 'medium' ||
        formAttachments.length > 0
      );
    }

    // In edit mode: compare with initial editingBug properties
    const titleChanged = formTitle.trim() !== (editingBug.title || '').trim();
    const usKeyChanged = formUsKey.trim() !== (editingBug.us_key || '').trim();
    const usLinkChanged = formUsLink.trim() !== (editingBug.us_link || '').trim();
    const typeChanged = formType !== editingBug.type;
    const statusChanged = formStatus !== editingBug.status;
    const severityChanged = formSeverity !== editingBug.severity;
    const descChanged = formDescription.trim() !== (editingBug.description || '').trim();
    const payloadChanged = formPayload.trim() !== (editingBug.payload || '').trim();
    const fixChanged = formFixSolution.trim() !== (editingBug.fix_solution || '').trim();
    const createdByChanged = formCreatedBy.trim() !== (editingBug.created_by || 'QA/QC').trim();
    const assignedToChanged = formAssignedTo.trim() !== (editingBug.assigned_to || '').trim();

    // Check attachments: if any pending files, new annotations, or count differs
    const hasPending = formAttachments.some(a => a.isPending);
    const hasDraftAnnotations = formAttachments.some(a => a.annotations && a.annotations.length > 0);
    const initialAttachments = editingBug.attachments || [];
    const attachmentsChanged = hasPending || hasDraftAnnotations || formAttachments.length !== initialAttachments.length;

    return (
      titleChanged ||
      usKeyChanged ||
      usLinkChanged ||
      typeChanged ||
      statusChanged ||
      severityChanged ||
      descChanged ||
      payloadChanged ||
      fixChanged ||
      createdByChanged ||
      assignedToChanged ||
      attachmentsChanged
    );
  }, [
    isFormModalOpen,
    editingBug,
    formTitle,
    formUsKey,
    formUsLink,
    formType,
    formStatus,
    formSeverity,
    formDescription,
    formPayload,
    formFixSolution,
    formCreatedBy,
    formAssignedTo,
    formAttachments
  ]);

  const handleRequestCloseForm = () => {
    if (isSubmitting) return;
    if (isFormDirty) {
      setShowUnsavedConfirmModal(true);
    } else {
      closeFormModal();
    }
  };

  const handleDiscardAndClose = () => {
    setShowUnsavedConfirmModal(false);
    closeFormModal();
  };

  // Global Escape key listener to handle nested modal dismissing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedConfirmModal) {
          setShowUnsavedConfirmModal(false);
        } else if (bugToDelete) {
          if (!isDeletingBug) setBugToDelete(null);
        } else if (previewImage) {
          setPreviewImage(null);
        } else if (isFormModalOpen) {
          handleRequestCloseForm();
        } else if (isDetailModalOpen) {
          setIsDetailModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnsavedConfirmModal, bugToDelete, isDeletingBug, previewImage, isFormModalOpen, isDetailModalOpen, isFormDirty]);

  const openCreateModal = () => {
    setEditingBug(null);
    setFormTitle('');
    setFormUsKey('');
    setFormUsLink('');
    setFormType('FE');
    setFormStatus('todo');
    setFormSeverity('medium');
    setFormDescription('');
    setFormPayload('');
    setFormFixSolution('');
    setFormCreatedBy('QA/QC');
    setFormAssignedTo('');
    setFormAttachments([]);
    setShowUnsavedConfirmModal(false);
    setIsFormModalOpen(true);
  };

  const openEditModal = (bug: BugItem) => {
    setEditingBug(bug);
    setFormTitle(bug.title);
    setFormUsKey(bug.us_key || '');
    setFormUsLink(bug.us_link || '');
    setFormType(bug.type);
    setFormStatus(bug.status);
    setFormSeverity(bug.severity);
    setFormDescription(bug.description || '');
    setFormPayload(bug.payload || '');
    setFormFixSolution(bug.fix_solution || '');
    setFormCreatedBy(bug.created_by || 'QA/QC');
    setFormAssignedTo(bug.assigned_to || '');
    setFormAttachments((bug.attachments || []).map(a => ({
      ...a,
      isPending: false,
      annotations: bug.annotations?.[a.id || a.filename]?.annotations || []
    })));
    setShowUnsavedConfirmModal(false);
    setIsFormModalOpen(true);
  };

  const openDetailModal = (bug: BugItem) => {
    setSelectedBug(bug);
    setIsDetailModalOpen(true);
  };

  const handleOpenFormAnnotation = (targetAttachmentId?: string) => {
    const images = formAttachments.filter(a => a.isImage);
    if (images.length === 0) {
      toast.error('Chưa có hình ảnh nào để đánh dấu');
      return;
    }

    const customImages = images.map(a => ({
      id: a.id,
      url: a.isPending ? a.previewUrl! : resolveApiUrl(a.url!),
      originalName: a.originalName,
      annotations: a.annotations || [],
      isPending: a.isPending
    }));

    const initialId = targetAttachmentId || images[0].id;

    setAnnotationModalState({
      isOpen: true,
      bug: editingBug || null,
      imageId: initialId,
      isFormDraft: true,
      customImages
    });
  };

  const handleSaveFormAnnotations = (imageId: string, annotations: AnnotationItem[]) => {
    setFormAttachments(prev => prev.map(a => {
      if (a.id === imageId || (a.filename && a.filename === imageId)) {
        return { ...a, annotations };
      }
      return a;
    }));
  };

  const [isDragOver, setIsDragOver] = useState(false);

  // Add files to local form state with client-side preview.
  // CRITICAL: Files are NOT uploaded to server until user clicks "Ghi Nhận Bug" / "Lưu Thay Đổi".
  const addFilesToForm = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const newItems: FormAttachmentItem[] = [];
    for (let i = 0; i < files.length; i++) {
      let file = files[i];

      // Format filename for pasted images or blobs missing extensions
      if (!file.name || file.name === 'blob' || file.name === 'image' || !file.name.includes('.')) {
        const ext = file.type?.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        file = new File([file], `screenshot_${Date.now()}_${i + 1}.${ext}`, {
          type: file.type || `image/${ext}`
        });
      }

      const isImg = file.type.startsWith('image/');
      const previewUrl = isImg ? URL.createObjectURL(file) : '';

      newItems.push({
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        isImage: isImg,
        file,
        previewUrl,
        isPending: true,
        annotations: []
      });
    }

    setFormAttachments(prev => [...prev, ...newItems]);
    toast.success(`Đã thêm ${newItems.length} tệp (chờ lưu)`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFilesRef = useRef(addFilesToForm);
  addFilesRef.current = addFilesToForm;

  const extractImagesFromDataTransfer = (dt: DataTransfer | null): File[] => {
    if (!dt) return [];
    const images: File[] = [];

    // 1. Check items first (primary for clipboard)
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            const fixedFile = (!file.name || file.name === 'blob' || !file.name.includes('.'))
              ? new File([file], `screenshot_${Date.now()}_${images.length + 1}.${ext}`, { type: item.type })
              : file;
            images.push(fixedFile);
          }
        }
      }
    }

    // 2. Fallback to files
    if (images.length === 0 && dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        if (file.type.startsWith('image/')) {
          images.push(file);
        }
      }
    }

    return images;
  };

  // Global paste handler when Form Modal is active
  useEffect(() => {
    if (!isFormModalOpen || annotationModalState.isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const images = extractImagesFromDataTransfer(e.clipboardData);
      if (images.length > 0) {
        e.preventDefault();
        addFilesRef.current(images);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [isFormModalOpen, annotationModalState.isOpen]);

  const handlePasteButtonClick = async () => {
    try {
      if (!navigator.clipboard?.read) {
        toast('Hãy bấm phím Ctrl + V để dán hình ảnh trực tiếp.', { icon: '📋' });
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            const file = new File([blob], `screenshot_${Date.now()}_${files.length + 1}.${ext}`, { type });
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        addFilesToForm(files);
      } else {
        toast('Không tìm thấy hình ảnh trong clipboard. Vui lòng chụp hoặc sao chép ảnh trước rồi bấm Ctrl + V.', {
          icon: '⚠️'
        });
      }
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      toast('Không thể đọc tự động từ clipboard (quyền bị từ chối). Vui lòng nhấn tổ hợp phím Ctrl + V để dán ảnh.', {
        icon: '📋'
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToForm(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToForm(e.dataTransfer.files);
    }
  };

  const removeAttachment = (id: string) => {
    setFormAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target?.isPending && target.previewUrl) {
        try { URL.revokeObjectURL(target.previewUrl); } catch {}
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const executeSubmitBug = async (): Promise<boolean> => {
    if (!formTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề bug');
      return false;
    }

    setIsSubmitting(true);
    try {
      // 1. Separate already saved attachments vs pending new attachments
      const savedAttachments: BugAttachment[] = [];
      const pendingAttachments: FormAttachmentItem[] = [];

      for (const item of formAttachments) {
        if (item.isPending && item.file) {
          pendingAttachments.push(item);
        } else if (item.url && item.filename) {
          savedAttachments.push({
            id: item.id,
            url: item.url,
            filename: item.filename,
            originalName: item.originalName,
            size: item.size,
            mimeType: item.mimeType,
            isImage: item.isImage
          });
        }
      }

      // 2. ONLY upload pending attachments to server when the form is submitted
      const uploadedAttachments: { attachment: BugAttachment; annotations?: AnnotationItem[] }[] = [];
      for (let i = 0; i < pendingAttachments.length; i++) {
        const pending = pendingAttachments[i];
        const formData = new FormData();
        formData.append('file', pending.file!);

        const res = await bugsApi.upload(formData);
        uploadedAttachments.push({
          attachment: res.data,
          annotations: pending.annotations
        });
      }

      const finalAttachments = [...savedAttachments, ...uploadedAttachments.map(u => u.attachment)];

      const payload = {
        title: formTitle.trim(),
        us_key: formUsKey.trim() || null,
        us_link: formUsLink.trim() || null,
        type: formType,
        status: formStatus,
        severity: formSeverity,
        description: formDescription,
        payload: formPayload.trim() || null,
        fix_solution: formFixSolution,
        attachments: finalAttachments,
        created_by: formCreatedBy.trim() || null,
        assigned_to: formAssignedTo.trim() || null
      };

      let targetBugId: number | null = null;
      if (editingBug) {
        await bugsApi.update(editingBug.id, payload);
        targetBugId = editingBug.id;
        toast.success('Đã cập nhật thông tin bug!');
      } else {
        const createRes = await bugsApi.create(payload);
        targetBugId = createRes.data?.id;
        toast.success('Đã ghi nhận bug mới thành công!');
      }

      // 3. Save annotations for newly uploaded attachments
      if (targetBugId) {
        for (const u of uploadedAttachments) {
          if (u.annotations && u.annotations.length > 0) {
            const imgId = u.attachment.id || u.attachment.filename;
            try {
              await bugAnnotationsApi.save(targetBugId, imgId, {
                annotations: u.annotations
              });
            } catch (annErr) {
              console.error('Failed to save annotations for uploaded image:', imgId, annErr);
            }
          }
        }

        // 4. Save annotations for existing attachments in edit mode
        if (editingBug) {
          for (const item of formAttachments) {
            if (!item.isPending && item.annotations) {
              const imgId = item.id || item.filename;
              if (imgId) {
                try {
                  await bugAnnotationsApi.save(targetBugId, imgId, {
                    annotations: item.annotations
                  });
                } catch (annErr) {
                  console.error('Failed to save annotations for existing image:', imgId, annErr);
                }
              }
            }
          }
        }
      }

      // Revoke temporary preview object URLs
      pendingAttachments.forEach(p => {
        if (p.previewUrl) {
          try { URL.revokeObjectURL(p.previewUrl); } catch {}
        }
      });

      closeFormModal();
      loadBugs();
      return true;
    } catch (err: any) {
      toast.error('Lưu thông tin thất bại: ' + (err.response?.data?.error || err.message));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSubmitBug();
  };

  const handleSaveAndClose = async () => {
    if (!formTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề bug để lưu');
      setShowUnsavedConfirmModal(false);
      return;
    }
    const success = await executeSubmitBug();
    if (success) {
      setShowUnsavedConfirmModal(false);
    }
  };

  const getStatusLabel = (st: BugStatus) => {
    switch (st) {
      case 'todo': return 'Chưa fix';
      case 'in_progress': return 'Đang fix';
      case 'resolved': return 'Đã fix';
      default: return st;
    }
  };

  const handleQuickStatusChange = (bugId: number, nextStatus: BugStatus, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const bug = bugs.find(b => b.id === bugId) || (selectedBug?.id === bugId ? selectedBug : null);
    if (!bug || bug.status === nextStatus) return;

    setPendingStatusChange({
      bugId,
      bugTitle: bug.title,
      fromStatus: bug.status,
      toStatus: nextStatus
    });
  };

  const executeStatusChange = async () => {
    if (!pendingStatusChange) return;
    const { bugId, toStatus } = pendingStatusChange;
    setIsUpdatingStatus(true);
    try {
      await bugsApi.updateStatus(bugId, toStatus);
      toast.success(`Đã chuyển trạng thái sang "${getStatusLabel(toStatus)}"`);
      loadBugs();
      if (selectedBug && selectedBug.id === bugId) {
        setSelectedBug(prev => prev ? { ...prev, status: toStatus } : null);
      }
    } catch (err: any) {
      toast.error('Không thể đổi trạng thái');
    } finally {
      setIsUpdatingStatus(false);
      setPendingStatusChange(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const bugId = Number(draggableId);
    const targetStatus = destination.droppableId as BugStatus;

    if (!['todo', 'in_progress', 'resolved'].includes(targetStatus)) return;

    if (destination.droppableId !== source.droppableId) {
      handleQuickStatusChange(bugId, targetStatus);
    } else {
      // Reorder locally within same column
      const columnBugs = safeBugs.filter(b => b.status === source.droppableId);
      const reordered = Array.from(columnBugs);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      setBugs(prev => {
        const otherBugs = prev.filter(b => b.status !== source.droppableId);
        return [...otherBugs, ...reordered];
      });
    }
  };

  const confirmDeleteBug = (bug: BugItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBugToDelete(bug);
  };

  const executeDeleteBug = async () => {
    if (!bugToDelete) return;
    setIsDeletingBug(true);
    try {
      await bugsApi.delete(bugToDelete.id);
      toast.success('Đã xóa bug thành công!');
      if (selectedBug && selectedBug.id === bugToDelete.id) {
        setIsDetailModalOpen(false);
        setSelectedBug(null);
      }
      setBugToDelete(null);
      loadBugs();
    } catch (err: any) {
      toast.error('Xóa bug thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsDeletingBug(false);
    }
  };

  const getStatusBadge = (st: BugStatus) => {
    switch (st) {
      case 'todo':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Chưa fix</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Đang fix</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Đã fix</span>
          </span>
        );
    }
  };

  const getTypeBadge = (type: BugType) => {
    switch (type) {
      case 'FE':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
            FE BUG
          </span>
        );
      case 'BE':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
            BE BUG
          </span>
        );
      case 'BOTH':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            FULLSTACK
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: BugSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 flex items-center gap-0.5">
            <ShieldAlert className="w-3 h-3" />
            <span>Khẩn cấp</span>
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            <span>Cao</span>
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Trung bình
          </span>
        );
      case 'low':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            Thấp
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Quản Lý Bug (Fix Notes)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  BA & QA/QC
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Note danh sách các bug cần fix, phân loại FE/BE, đính kèm hình ảnh lỗi và theo dõi giải pháp khắc phục.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Báo cáo bug mới</span>
            </button>
            <button
              onClick={loadBugs}
              disabled={loading}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Statistics Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-border/80">
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">Tổng số Bug</span>
            <span className="text-xl font-bold text-foreground tabular-nums">{stats.total}</span>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 block">Chưa fix (Todo)</span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{stats.todo}</span>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 block">Đang fix</span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{stats.in_progress}</span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block">Đã fix</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.resolved}</span>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 block">Lỗi Frontend (FE)</span>
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{stats.fe_count}</span>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 block">Lỗi Backend (BE)</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{stats.be_count}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, US key (EMSPRO2-...), mô tả, cách fix..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary transition"
          />
        </form>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status filter */}
          <div className="w-40 sm:w-44">
            <SearchableSelect
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              placeholder="Trạng thái..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* Type filter */}
          <div className="w-36 sm:w-40">
            <SearchableSelect
              options={typeFilterOptions}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              placeholder="Loại bug..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* Severity filter */}
          <div className="w-36 sm:w-40">
            <SearchableSelect
              options={severityFilterOptions}
              value={severityFilter}
              onChange={(val) => setSeverityFilter(val)}
              placeholder="Mức độ..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* Annotation filter */}
          <div className="w-36 sm:w-44">
            <SearchableSelect
              options={annotationFilterOptions}
              value={annotationFilter}
              onChange={(val) => setAnnotationFilter(val)}
              placeholder="Đánh dấu ảnh..."
              searchable={false}
              size="sm"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'board' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              title="Xem dạng bảng Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              title="Xem dạng danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Đang tải danh sách bug...</span>
        </div>
      ) : bugs.length === 0 ? (
        <div className="py-16 text-center bg-card border border-dashed border-border rounded-3xl p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
            <Bug className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Không tìm thấy bug nào</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Chưa có bug nào được ghi nhận hoặc không có kết quả phù hợp với bộ lọc hiện tại. Bấm nút bên dưới để tạo ghi chú bug mới.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Bug Mới</span>
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW WITH DRAG & DROP */
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const colBugs = safeBugs.filter((b) => b.status === col.id);

              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`border rounded-3xl p-4 space-y-3 transition-colors duration-150 min-h-[350px] flex flex-col ${
                        snapshot.isDraggingOver
                          ? 'bg-primary/5 border-primary/50 ring-2 ring-primary/20 shadow-md'
                          : 'bg-muted/20 border-border'
                      }`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                          <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                            {col.label} ({colBugs.length})
                          </h3>
                        </div>
                      </div>

                      {/* Cards List with Draggable */}
                      <div className="space-y-3 flex-1">
                        {colBugs.map((bug, index) => (
                          <Draggable key={String(bug.id)} draggableId={String(bug.id)} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                className={`select-none ${
                                  dragSnapshot.isDragging
                                    ? 'opacity-95 shadow-2xl ring-2 ring-primary/40 rounded-2xl cursor-grabbing'
                                    : 'cursor-grab'
                                }`}
                              >
                                <BugCard
                                  bug={bug}
                                  onClick={() => openDetailModal(bug)}
                                  onEdit={() => openEditModal(bug)}
                                  onDelete={(e) => confirmDeleteBug(bug, e)}
                                  onStatusChange={(nextStatus, e) => handleQuickStatusChange(bug.id, nextStatus, e)}
                                  getTypeBadge={getTypeBadge}
                                  getSeverityBadge={getSeverityBadge}
                                  onPreviewImage={setPreviewImage}
                                  onOpenAnnotation={(bugItem, imgId) =>
                                    setAnnotationModalState({ isOpen: true, bug: bugItem, imageId: imgId })
                                  }
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {colBugs.length === 0 && (
                          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl flex flex-col items-center justify-center gap-1">
                            <span>Không có bug nào ở cột này</span>
                            <span className="text-[10px] text-muted-foreground/70">Kéo thả bug vào đây</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        /* LIST / TABLE VIEW */
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">#ID</th>
                  <th className="py-3 px-4">Tiêu Đề Bug</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">US Liên Quan</th>
                  <th className="py-3 px-4">Mức Độ</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Người Báo / Dev</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bugs.map((bug) => (
                  <tr
                    key={bug.id}
                    onClick={() => openDetailModal(bug)}
                    className="hover:bg-accent/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                      #{bug.id}
                    </td>
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                          {bug.title}
                        </span>
                        {bug.has_annotations && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{bug.annotated_images_count || 1} ảnh có đánh dấu</span>
                          </span>
                        )}
                        {bug.payload && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0" title="Có dữ liệu payload">
                            <Code className="w-2.5 h-2.5" />
                            <span>Payload</span>
                          </span>
                        )}
                      </div>
                      {bug.fix_solution && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate max-w-sm">
                          💡 Cách fix: {bug.fix_solution}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(bug.type)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {bug.us_key ? (
                        bug.us_link ? (
                          <a
                            href={bug.us_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded"
                          >
                            <span>{bug.us_key}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded">
                            {bug.us_key}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground italic">Không có</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getSeverityBadge(bug.severity)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(bug.status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-[11px]">
                      <div>Tạo: {bug.created_by || 'QA'}</div>
                      {bug.assigned_to && <div>Dev: {bug.assigned_to}</div>}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {bug.attachments?.some(a => a.isImage) && (
                          <button
                            type="button"
                            onClick={() => setAnnotationModalState({ isOpen: true, bug })}
                            className="p-1.5 rounded-lg hover:bg-primary/15 text-muted-foreground hover:text-primary transition"
                            title="Mở trình đánh dấu ảnh"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(bug)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => confirmDeleteBug(bug, e)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition"
                          title="Xóa"
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
        </div>
      )}

      {/* CREATE / EDIT BUG MODAL */}
      {isFormModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleRequestCloseForm}
        >
          <div 
            className="bg-card border border-border rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Compact and pinned (shrink-0) */}
            <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Bug className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-sm sm:text-base text-foreground leading-tight truncate">
                    {editingBug ? 'Chỉnh Sửa Bug' : 'Báo Cáo Bug Mới'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    Ghi chép thông tin lỗi, đính kèm ảnh và mô tả cách sửa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseForm}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0 ml-2"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form wrapping scrollable content and fixed sticky footer */}
            <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Tiêu đề bug */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground block">
                  Tiêu đề Bug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: [FE] Lỗi không hiển thị danh sách lớp học sau khi chọn cơ sở"
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-primary transition"
                />
              </div>

              {/* Phân loại FE vs BE & Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Type */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Phân loại Bug</label>
                  <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                    {(['FE', 'BE', 'BOTH'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormType(t)}
                        className={`py-1.5 text-center font-bold text-xs rounded-lg transition ${
                          formType === t
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t === 'BOTH' ? 'Cả hai' : t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Trạng thái</label>
                  <SearchableSelect<BugStatus>
                    options={formStatusOptions}
                    value={formStatus}
                    onChange={(val) => setFormStatus(val)}
                    placeholder="Chọn trạng thái..."
                    searchable={false}
                    size="sm"
                  />
                </div>

                {/* Severity */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Mức độ nghiêm trọng</label>
                  <SearchableSelect<BugSeverity>
                    options={formSeverityOptions}
                    value={formSeverity}
                    onChange={(val) => setFormSeverity(val)}
                    placeholder="Chọn mức độ..."
                    searchable={false}
                    size="sm"
                  />
                </div>
              </div>

              {/* US Key & US Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Mã User Story (US Key)
                  </label>
                  <input
                    type="text"
                    value={formUsKey}
                    onChange={(e) => setFormUsKey(e.target.value)}
                    placeholder="VD: EMSPRO2-10030"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">
                    Đường link đến US (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formUsLink}
                    onChange={(e) => setFormUsLink(e.target.value)}
                    placeholder="https://task.ascvn.com.vn/browse/..."
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Người báo cáo & Dev phụ trách */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Người log bug (BA / QA)</label>
                  <input
                    type="text"
                    value={formCreatedBy}
                    onChange={(e) => setFormCreatedBy(e.target.value)}
                    placeholder="Tên QA hoặc BA"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block">Dev được phân công fix</label>
                  <input
                    type="text"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    placeholder="Tên Dev (nếu đã phân công)"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Editor Mô tả Bug */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>Mô tả chi tiết Bug & Các bước tái hiện</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Hỗ trợ Markdown</span>
                </label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Mô tả hiện tượng lỗi, các bước tái hiện (Steps to reproduce), kết quả mong muốn (Expected) và kết quả thực tế (Actual)..."
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-primary resize-y transition"
                />
              </div>

              {/* Payload / Dữ liệu mô phỏng lỗi (Code Input) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-primary" />
                    <span>Payload / Dữ liệu gây lỗi</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(JSON, Request body, Response, cURL, Logs...)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {formPayload && (
                      <>
                        <button
                          type="button"
                          onClick={handleFormatPayloadJson}
                          className="px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border text-foreground text-[11px] font-mono flex items-center gap-1.5 shadow-2xs transition"
                          title="Tự động định dạng thụt lề JSON (Format JSON)"
                        >
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>Format JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyFormPayload}
                          className="px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border text-foreground text-[11px] font-mono flex items-center gap-1.5 shadow-2xs transition"
                          title="Sao chép payload"
                        >
                          {isPayloadCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500 font-bold">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-muted-foreground" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormPayload('')}
                          className="p-1 rounded-md bg-card hover:bg-red-500/10 border border-border text-muted-foreground hover:text-red-600 transition"
                          title="Xóa nội dung payload"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  {/* Top Editor Bar */}
                  <div className="px-3.5 py-2 bg-muted/60 dark:bg-muted/40 border-b border-border flex items-center justify-between text-xs font-mono select-none">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
                      </div>
                      <div className="h-3 w-px bg-border mx-1" />
                      <span className="text-foreground font-semibold text-[11px] flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-primary" />
                        <span>payload.json</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {formPayload ? (
                        <span>
                          {formPayload.split('\n').length} dòng • {formPayload.length} ký tự
                        </span>
                      ) : (
                        <span className="hidden sm:inline">Hỗ trợ phím Tab để thụt dòng</span>
                      )}
                    </div>
                  </div>

                  {/* Monospace Code Editor Textarea */}
                  <div className="p-3 bg-background/50 dark:bg-background/30">
                    <textarea
                      rows={6}
                      value={formPayload}
                      onChange={(e) => setFormPayload(e.target.value)}
                      onKeyDown={handlePayloadKeyDown}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      placeholder={`// Dán dữ liệu request body, params, response lỗi hoặc cURL tại đây...\n{\n  "endpoint": "POST /api/v1/surveys/submit",\n  "request": { "surveyId": 12975, "step": 2 },\n  "response": { "code": 500, "message": "NullPointerException" }\n}`}
                      className="w-full bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/50 leading-relaxed focus:outline-none resize-y min-h-[140px] max-h-[360px] selection:bg-primary/20 scrollbar-thin"
                    />
                  </div>
                </div>
              </div>

              {/* Mô tả cách fix (Fix solution) */}
              <div className="space-y-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5">
                <label className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mô tả giải pháp fix / Cách fix (Dành cho Dev)</span>
                </label>
                <textarea
                  rows={2}
                  value={formFixSolution}
                  onChange={(e) => setFormFixSolution(e.target.value)}
                  placeholder="Ghi lại nguyên nhân lỗi và giải pháp fix (Ví dụ: Thiếu await trong hook useEffect, đã fix tại commit #abc...)"
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 resize-y transition"
                />
              </div>

              {/* Upload hình ảnh / File đính kèm */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    <span>Hình ảnh minh họa / Tệp lỗi ({formAttachments.length})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {formAttachments.some((a) => a.isImage) && (
                      <button
                        type="button"
                        onClick={() => handleOpenFormAnnotation()}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition shadow-2xs"
                        title="Mở Trình Đánh Dấu Ảnh để vẽ khoanh vùng, mũi tên, số thứ tự"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Trình Đánh Dấu Ảnh</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePasteButtonClick}
                      disabled={isSubmitting}
                      className="text-xs font-bold text-primary hover:text-primary/90 flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/15 transition shadow-2xs"
                      title="Dán ảnh từ clipboard (hoặc nhấn Ctrl + V trực tiếp)"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Dán ảnh (Ctrl+V)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border bg-background hover:bg-accent transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Đang lưu...' : 'Tải tệp / ảnh'}</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.log,.txt,.json,.pdf,.xlsx,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {/* Drop & Paste Area */}
                {formAttachments.length === 0 ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                      isDragOver
                        ? 'border-primary bg-primary/10'
                        : 'border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        <span className="text-primary font-bold">Nhấn Ctrl + V để dán ảnh</span>, kéo thả hoặc click để chọn tệp
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Hỗ trợ ảnh chụp màn hình từ clipboard, PNG, JPG, GIF, WebP, PDF, Log, Excel... (tối đa 25MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {formAttachments.map((att) => {
                        const hasAnnotations = att.annotations && att.annotations.length > 0;
                        const imgUrl = att.isPending ? att.previewUrl! : resolveApiUrl(att.url!);

                        return (
                          <div
                            key={att.id}
                            className="rounded-xl border border-border bg-background p-2 relative flex flex-col gap-2 group hover:border-primary/50 transition shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              {att.isImage ? (
                                <div 
                                  className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer group/thumb"
                                  onClick={() => handleOpenFormAnnotation(att.id)}
                                  title="Nhấn để mở Trình Đánh Dấu Ảnh"
                                >
                                  <img
                                    src={imgUrl}
                                    alt=""
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                  </div>
                                  {hasAnnotations && (
                                    <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" title={`${att.annotations!.length} điểm đánh dấu`} />
                                  )}
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <FileIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-foreground truncate block text-[11px]" title={att.originalName}>
                                    {att.originalName}
                                  </span>
                                  {att.isPending && (
                                    <span className="shrink-0 text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                                      Mới
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground block">
                                  {formatBytes(att.size)}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeAttachment(att.id)}
                                className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition shrink-0"
                                title="Xóa tệp"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Button Trình Đánh Dấu Ảnh */}
                            {att.isImage && (
                              <button
                                type="button"
                                onClick={() => handleOpenFormAnnotation(att.id)}
                                className={`w-full py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                                  hasAnnotations
                                    ? 'bg-primary/15 text-primary hover:bg-primary/20 border border-primary/30'
                                    : 'bg-muted hover:bg-primary/10 text-foreground hover:text-primary border border-border'
                                }`}
                                title="Mở Trình Đánh Dấu Ảnh để vẽ khoanh vùng, mũi tên, số thứ tự"
                              >
                                <Sparkles className="w-3 h-3 text-primary" />
                                <span>
                                  {hasAnnotations 
                                    ? `Đã đánh dấu (${att.annotations!.length} điểm)` 
                                    : 'Trình Đánh Dấu Ảnh'}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick paste / drop helper when attachments already exist */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed rounded-xl py-2 px-3 text-center cursor-pointer transition flex items-center justify-center gap-2 text-xs ${
                        isDragOver
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/70 hover:border-primary/50 bg-muted/10 hover:bg-muted/30 text-muted-foreground'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Nhấn <strong className="text-foreground">Ctrl + V</strong> để dán thêm ảnh chụp màn hình, hoặc click/thả tệp vào đây</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sticky Compact Footer (Pinned at bottom, does not scroll) */}
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border bg-card flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleRequestCloseForm}
                className="px-3.5 py-1.5 rounded-xl border border-border text-foreground hover:bg-accent font-semibold transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formTitle.trim()}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{editingBug ? 'Đang lưu...' : 'Đang tải ảnh & lưu...'}</span>
                  </>
                ) : editingBug ? (
                  'Lưu Thay Đổi'
                ) : (
                  'Ghi Nhận Bug'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}

      {/* BUG DETAIL MODAL */}
      {isDetailModalOpen && selectedBug && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div 
            className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-foreground bg-accent px-2 py-0.5 rounded-md">
                    #{selectedBug.id}
                  </span>
                  {getTypeBadge(selectedBug.type)}
                  {getStatusBadge(selectedBug.status)}
                  {getSeverityBadge(selectedBug.severity)}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
                  {selectedBug.title}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyBugReportMarkdown(selectedBug)}
                  className="px-2.5 py-1.5 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Sao chép toàn bộ báo cáo bug và bảng đánh dấu sang Markdown"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Xuất Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openEditModal(selectedBug);
                  }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Chỉnh sửa bug"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => confirmDeleteBug(selectedBug)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition"
                  title="Xóa bug"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Meta Bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {selectedBug.us_key && (
                  <div className="flex items-center gap-1.5">
                    <span>US:</span>
                    {selectedBug.us_link ? (
                      <a
                        href={selectedBug.us_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{selectedBug.us_key}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-mono font-bold text-foreground">{selectedBug.us_key}</span>
                    )}
                  </div>
                )}
                <div>Người tạo: <span className="font-semibold text-foreground">{selectedBug.created_by || 'QA'}</span></div>
                {selectedBug.assigned_to && (
                  <div>Dev: <span className="font-semibold text-foreground">{selectedBug.assigned_to}</span></div>
                )}
              </div>

              {/* Quick Status Action Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Chuyển sang:</span>
                {selectedBug.status !== 'todo' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'todo')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition"
                  >
                    Chưa fix
                  </button>
                )}
                {selectedBug.status !== 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'in_progress')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition"
                  >
                    Đang fix
                  </button>
                )}
                {selectedBug.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedBug.id, 'resolved')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition"
                  >
                    Đã fix
                  </button>
                )}
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
              {/* Mô tả lỗi */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Mô tả lỗi & Các bước tái hiện
                </h4>
                <div className="bg-background border border-border rounded-2xl p-4 whitespace-pre-wrap leading-relaxed text-foreground min-h-[80px]">
                  {selectedBug.description || <span className="text-muted-foreground italic">Chưa có mô tả chi tiết.</span>}
                </div>
              </div>

              {/* Payload / Dữ liệu gây lỗi */}
              {selectedBug.payload && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-primary" />
                      <span>Payload / Dữ liệu gây lỗi</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBug.payload || '');
                        toast.success('Đã sao chép payload!');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground font-mono text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition"
                      title="Sao chép payload vào clipboard"
                    >
                      <Copy className="w-3 h-3 text-primary" />
                      <span>Sao chép Payload</span>
                    </button>
                  </div>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                    <div className="px-3.5 py-2 bg-muted/60 dark:bg-muted/40 border-b border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
                        </div>
                        <div className="h-3 w-px bg-border mx-1" />
                        <span className="text-foreground font-semibold flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-primary" />
                          <span>payload.json</span>
                        </span>
                      </div>
                      <span className="text-[10px]">
                        {selectedBug.payload.split('\n').length} dòng • {selectedBug.payload.length} ký tự
                      </span>
                    </div>
                    <div className="p-4 overflow-x-auto max-h-[280px] scrollbar-thin bg-background/50 dark:bg-background/30">
                      <pre className="font-mono text-xs text-foreground whitespace-pre leading-relaxed selection:bg-primary/20">
                        <code>{selectedBug.payload}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Giải pháp Fix */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Giải pháp fix / Cách fix</span>
                </h4>
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-4 whitespace-pre-wrap leading-relaxed text-foreground min-h-[60px]">
                  {selectedBug.fix_solution ? (
                    selectedBug.fix_solution
                  ) : (
                    <span className="text-muted-foreground italic">Chưa ghi nhận giải pháp fix cho bug này.</span>
                  )}
                </div>
              </div>

              {/* Hình ảnh & Tệp đính kèm */}
              {selectedBug.attachments && selectedBug.attachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      <span>Hình ảnh & Tệp đính kèm ({selectedBug.attachments.length})</span>
                    </h4>
                    {selectedBug.attachments.some(a => a.isImage) && (
                      <button
                        type="button"
                        onClick={() => setAnnotationModalState({ isOpen: true, bug: selectedBug })}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Mở Trình Đánh Dấu Ảnh</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedBug.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="rounded-xl border border-border bg-card overflow-hidden p-2 flex flex-col justify-between group hover:border-primary transition"
                      >
                        {att.isImage ? (
                          <div
                            onClick={() => {
                              const annList = selectedBug.annotations?.[att.id || att.filename]?.annotations || [];
                              setIsNotesSidebarOpen(typeof window !== 'undefined' && window.innerWidth >= 768 && annList.length > 0);
                              setHoveredAnnotationId(null);
                              setSelectedAnnotationId(null);
                              setPreviewImage({ 
                                url: resolveApiUrl(att.url), 
                                title: att.originalName,
                                imageId: att.id || att.filename,
                                bug: selectedBug,
                                annotations: annList
                              });
                            }}
                            className="aspect-video w-full bg-muted/30 rounded-lg overflow-hidden cursor-pointer relative mb-1.5"
                          >
                            <AnnotationOverlayView
                              imageSrc={resolveApiUrl(att.url)}
                              imageAlt={att.originalName}
                              annotations={selectedBug.annotations?.[att.id || att.filename]?.annotations || []}
                              className="w-full h-full"
                              showToggle={true}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white pointer-events-none">
                              <ZoomIn className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted/40 rounded-lg flex items-center justify-center mb-1.5">
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground truncate" title={att.originalName}>
                            {att.originalName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {att.isImage && (
                              <button
                                type="button"
                                onClick={() => setAnnotationModalState({
                                  isOpen: true,
                                  bug: selectedBug,
                                  imageId: att.id || att.filename
                                })}
                                className="p-1 rounded hover:bg-primary/20 text-primary transition"
                                title="Đánh dấu ảnh này"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                            )}
                            <a
                              href={resolveApiUrl(att.url)}
                              download={att.originalName}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                              title="Tải về"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX & ANNOTATION VIEWER */}
      {previewImage && typeof document !== 'undefined' && (() => {
        const activeBug = previewImage.bug || selectedBug;
        const activeAnnotations: AnnotationItem[] = 
          previewImage.annotations && previewImage.annotations.length > 0
            ? previewImage.annotations
            : (previewImage.imageId && activeBug?.annotations?.[previewImage.imageId]?.annotations) || [];

        return createPortal(
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200 select-none"
            onClick={() => setPreviewImage(null)}
          >
            {/* Top Bar */}
            <div 
              className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-white shrink-0 bg-black/70 backdrop-blur z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/20 text-primary shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                      {previewImage.title}
                    </span>
                    {activeBug?.id && (
                      <span className="font-mono text-[10px] font-bold text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded shrink-0">
                        Bug #{activeBug.id}
                      </span>
                    )}
                    {activeAnnotations.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1 shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{activeAnnotations.length} điểm đánh dấu</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle Notes List Sidebar */}
                {activeAnnotations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsNotesSidebarOpen(!isNotesSidebarOpen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isNotesSidebarOpen
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isNotesSidebarOpen ? 'Ẩn danh sách ghi chú' : 'Xem danh sách ghi chú đã note'}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Ghi chú ({activeAnnotations.length})</span>
                  </button>
                )}

                {/* Edit / Open Annotation Canvas */}
                {activeBug && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentBug = activeBug;
                      const imgId = previewImage.imageId;
                      setPreviewImage(null);
                      setAnnotationModalState({
                        isOpen: true,
                        bug: currentBug,
                        imageId: imgId
                      });
                    }}
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-1.5 text-xs font-semibold"
                    title="Mở trình đánh dấu ảnh để thêm/sửa ghi chú"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Đánh dấu ảnh</span>
                  </button>
                )}

                <a
                  href={previewImage.url}
                  download={previewImage.title}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                  title="Tải ảnh về máy"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Tải về</span>
                </a>
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                  title="Mở tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Mở gốc</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition ml-1"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewport & Notes Panel */}
            <div className="flex-1 flex overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
              {/* Image Viewport */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
                <AnnotationOverlayView
                  imageSrc={previewImage.url}
                  imageAlt={previewImage.title}
                  annotations={activeAnnotations}
                  className="max-h-[85vh] max-w-full rounded-xl shadow-2xl"
                  fit="contain"
                  showToggle={true}
                  hoveredId={hoveredAnnotationId}
                  selectedId={selectedAnnotationId}
                  onSelectAnnotation={(ann) => {
                    setSelectedAnnotationId(ann.id);
                    setIsNotesSidebarOpen(true);
                  }}
                />
              </div>

              {/* Side Drawer: Ghi Chú Đánh Dấu (Desktop side-by-side, Mobile overlay drawer) */}
              {isNotesSidebarOpen && activeAnnotations.length > 0 && (
                <>
                  {/* Mobile backdrop for notes drawer */}
                  <div
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-25 animate-in fade-in duration-200"
                    onClick={() => setIsNotesSidebarOpen(false)}
                  />
                  <div 
                    className="fixed md:relative inset-y-0 right-0 max-w-[85vw] w-80 sm:w-96 border-l border-white/10 bg-slate-950/95 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden z-30 shadow-2xl animate-in slide-in-from-right duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                        Ghi Chú Đánh Dấu ({activeAnnotations.length})
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMarkdownForPreview(previewImage.title, activeAnnotations)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                        title="Sao chép bảng ghi chú sang Markdown"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy MD</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNotesSidebarOpen(false)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                        title="Ẩn danh sách ghi chú"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                    {activeAnnotations
                      .slice()
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((ann) => {
                        const isHovered = hoveredAnnotationId === ann.id;
                        const isSelected = selectedAnnotationId === ann.id;

                        return (
                          <div
                            key={ann.id}
                            onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                            onMouseLeave={() => setHoveredAnnotationId(null)}
                            onClick={() => setSelectedAnnotationId(ann.id)}
                            className={`p-3 rounded-xl border transition cursor-pointer ${
                              isSelected || isHovered
                                ? 'bg-primary/20 border-primary shadow-lg ring-1 ring-primary/40'
                                : 'bg-white/5 hover:bg-white/10 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                                  style={{ backgroundColor: ann.color }}
                                >
                                  {ann.sequence}
                                </span>
                                <span className="text-xs font-bold text-slate-200 truncate">
                                  {getAnnotationTypeName(ann.type)} #{ann.sequence}
                                </span>
                              </div>
                              <span 
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ 
                                  backgroundColor: `${ann.color}25`, 
                                  color: ann.color, 
                                  border: `1px solid ${ann.color}50` 
                                }}
                              >
                                {ann.status === 'resolved' ? 'Đã fix' : ann.status === 'fixing' ? 'Đang fix' : 'Chưa fix'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words pl-7 select-text">
                              {ann.note ? (
                                ann.note
                              ) : (
                                <span className="italic text-slate-500">Chưa có ghi chú mô tả</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* BUG IMAGE ANNOTATION MODAL */}
      {annotationModalState.isOpen && (
        <AnnotationModal
          isOpen={annotationModalState.isOpen}
          onClose={() => setAnnotationModalState({ isOpen: false, bug: null, isFormDraft: false, customImages: undefined })}
          bug={annotationModalState.bug}
          initialImageId={annotationModalState.imageId}
          customImages={annotationModalState.customImages}
          customTitle={annotationModalState.isFormDraft ? (formTitle.trim() || (editingBug ? 'Chỉnh Sửa Bug' : 'Báo Cáo Bug Mới')) : undefined}
          customUsKey={annotationModalState.isFormDraft ? formUsKey.trim() : undefined}
          onSaveFormAnnotations={annotationModalState.isFormDraft ? handleSaveFormAnnotations : undefined}
          onAddDraftImage={annotationModalState.isFormDraft ? (file) => addFilesToForm([file]) : undefined}
          onAnnotationsUpdated={() => loadBugs()}
        />
      )}

      {/* CONFIRM DELETE BUG MODAL */}
      {bugToDelete && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isDeletingBug && setBugToDelete(null)}
        >
          <div 
            className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-foreground leading-tight">
                  Xác nhận xóa bug
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn bug <strong className="text-foreground">#{bugToDelete.id}</strong>: <span className="font-semibold text-foreground">"{bugToDelete.title}"</span>? Thao tác này sẽ xóa toàn bộ dữ liệu, hình ảnh và lịch sử chú thích của bug.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                disabled={isDeletingBug}
                onClick={() => setBugToDelete(null)}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs transition disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingBug}
                onClick={executeDeleteBug}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingBug ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM UNSAVED CHANGES MODAL */}
      {showUnsavedConfirmModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowUnsavedConfirmModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-foreground leading-tight">
                  Thay đổi chưa được lưu
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Bạn có các thông tin {editingBug ? `chỉnh sửa bug #${editingBug.id}` : 'nhập mới bug'} chưa được lưu. Bạn muốn lưu lại trước khi đóng hay hủy bỏ các thay đổi?
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirmModal(false)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs transition text-center"
              >
                Tiếp tục chỉnh sửa
              </button>
              <button
                type="button"
                onClick={handleDiscardAndClose}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs transition text-center"
              >
                Hủy bỏ & Đóng
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAndClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu & Đóng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Bug Status Change Modal */}
      <ConfirmModal
        isOpen={!!pendingStatusChange}
        title="Xác nhận chuyển trạng thái Bug"
        description={
          pendingStatusChange ? (
            <span>
              Bạn có chắc chắn muốn chuyển trạng thái bug <strong className="text-foreground">#{pendingStatusChange.bugId}</strong>
              {pendingStatusChange.bugTitle ? ` ("${pendingStatusChange.bugTitle}")` : ''} từ{' '}
              <span className="font-semibold text-muted-foreground">"{getStatusLabel(pendingStatusChange.fromStatus)}"</span> sang{' '}
              <span className="font-semibold text-primary">"{getStatusLabel(pendingStatusChange.toStatus)}"</span> không?
            </span>
          ) : ''
        }
        confirmText="Xác nhận chuyển"
        cancelText="Hủy bỏ"
        variant="primary"
        loading={isUpdatingStatus}
        onConfirm={executeStatusChange}
        onClose={() => {
          if (!isUpdatingStatus) setPendingStatusChange(null);
        }}
      />
    </div>
  );
};

// Sub-component: Bug Card for Kanban board
interface BugCardProps {
  bug: BugItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (nextStatus: BugStatus, e: React.MouseEvent) => void;
  getTypeBadge: (type: BugType) => React.ReactNode;
  getSeverityBadge: (sev: BugSeverity) => React.ReactNode;
  onPreviewImage: (img: { url: string; title: string }) => void;
  onOpenAnnotation: (bug: BugItem, imageId?: string) => void;
}

const BugCard: React.FC<BugCardProps> = React.memo(({
  bug,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
  getTypeBadge,
  getSeverityBadge,
  onPreviewImage,
  onOpenAnnotation
}) => {
  const images = bug.attachments?.filter(a => a.isImage) || [];

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/50 transition cursor-pointer shadow-2xs hover:shadow-sm space-y-2.5 group"
    >
      {/* Top Meta: Badges & Actions */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-muted-foreground">
            #{bug.id}
          </span>
          {getTypeBadge(bug.type)}
          {getSeverityBadge(bug.severity)}
        </div>

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenAnnotation(bug, images[0].id || images[0].filename)}
              className="p-1.5 sm:p-1 rounded hover:bg-primary/15 text-primary sm:text-muted-foreground sm:hover:text-primary transition"
              title="Đánh dấu hình ảnh"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 sm:p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
            title="Sửa bug"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 sm:p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition"
            title="Xóa bug"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-bold text-xs sm:text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition">
        {bug.title}
      </h4>

      {/* Description Snippet */}
      {bug.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {bug.description}
        </p>
      )}

      {/* First image thumbnail preview if any */}
      {images.length > 0 && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onOpenAnnotation(bug, images[0].id || images[0].filename);
          }}
          className="aspect-video w-full rounded-xl overflow-hidden bg-muted/30 relative border border-border/60 group/thumb"
        >
          <AnnotationOverlayView
            imageSrc={resolveApiUrl(images[0].url)}
            imageAlt={images[0].originalName}
            annotations={bug.annotations?.[images[0].id || images[0].filename]?.annotations || bug.annotations?.[images[0].filename]?.annotations || []}
            className="w-full h-full"
            showToggle={true}
          />
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold z-10 pointer-events-none">
            {images.length} ảnh
          </div>
          {bug.has_annotations && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center gap-1 shadow-md z-10 pointer-events-none">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{bug.annotated_images_count || 1} ảnh có đánh dấu</span>
            </div>
          )}
          {/* Mobile indicator pill for touch screens */}
          <div className="sm:hidden absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold flex items-center gap-1 z-10 pointer-events-none shadow-xs">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Mở Đánh Dấu</span>
          </div>

          {/* Desktop full hover overlay */}
          <div className="hidden sm:flex absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition items-center justify-center gap-1 text-white text-[11px] font-bold z-10">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Mở Đánh Dấu</span>
          </div>
        </div>
      )}

      {/* Fix solution preview if available */}
      {bug.fix_solution && (
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400">
          <div className="font-bold flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3" />
            <span>Cách fix:</span>
          </div>
          <p className="line-clamp-2">{bug.fix_solution}</p>
        </div>
      )}

      {/* Bottom Footer: US Key, Attachments count, Quick Next Status */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {bug.us_key && (
            bug.us_link ? (
              <a
                href={bug.us_link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 bg-blue-500/10 px-1.5 py-0.5 rounded"
              >
                <span>{bug.us_key}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="font-mono font-bold text-foreground bg-accent px-1.5 py-0.5 rounded">
                {bug.us_key}
              </span>
            )
          )}
          {bug.attachments && bug.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              <span>{bug.attachments.length}</span>
            </span>
          )}
          {bug.payload && (
            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-semibold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20" title="Có dữ liệu payload">
              <Code className="w-2.5 h-2.5" />
              <span>Payload</span>
            </span>
          )}
        </div>

        {/* Quick Transition buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {bug.status === 'todo' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('in_progress', e)}
              className="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] transition"
              title="Chuyển sang Đang fix"
            >
              Fix ngay →
            </button>
          )}
          {bug.status === 'in_progress' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('resolved', e)}
              className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] transition"
              title="Đánh dấu Đã fix"
            >
              Đã fix ✓
            </button>
          )}
          {bug.status === 'resolved' && (
            <button
              type="button"
              onClick={(e) => onStatusChange('todo', e)}
              className="px-2 py-0.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground font-semibold text-[10px] transition"
              title="Mở lại bug"
            >
              Mở lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
